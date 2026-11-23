// Environment module job (docs/ENVIRONMENT_PLAN.md sections 3 and 5): read the Swift treemap, classify each unit against its own range, keep raw readings on the
// host (hourly buckets, 90 days), write latest / hourly summaries / excursions to SharePoint through the narrow bridge flows. STATUS ONLY, never an alarm (SEN-03).
// All time comes from `nowSec` (no clock reads here). `store` is the host's key/value store (createTableStore): get/put/del.
import { classifyReading } from '../sensors-core/readings.mjs';
import { FACILITY } from './bridge.mjs';

const HOUR = 3600, DAY = 86400;
const STALE_MIN = 30, OFFLINE_SEC = 2 * HOUR, CACHE_SEC = HOUR, KEEP_HOURS = 90 * 24, BUDGET_STOP = 0.8, GAP_SEC = HOUR;
const iso = (sec) => new Date(sec * 1000).toISOString();
const hourOf = (sec) => Math.floor(sec / HOUR);
const r1 = (n) => Math.round(n * 10) / 10;
const bucketKey = (sid, h) => `sensor:${sid}:${iso(h * HOUR).slice(0, 13)}`;
export const hourKey = (sid, h) => `${sid}-${iso(h * HOUR).slice(0, 13)}`;   // A00L4N-2026-11-23T14
const lit = (s) => String(s).replace(/'/g, "''");

export function createSensorJob({ swift, bridge, store, nowSec, budget = 100000, log = () => {} }) {
  let cache = null, running = false, idMap = {};   // idMap: {code: {id, unit}} of the units found in the last treemap (backfill asks Swift for those numeric ids)
  const status = { lastSyncAt: null, reporting: 0, calls: null, unmatched: [] };

  /** Active units and their ranges from AvenueSensors (the owner edits them), cached for 1 h. Units without a numeric range are ignored. */
  async function sensors(now) {
    if (cache && now - cache.at < CACHE_SEC) return cache.byId;
    const byId = new Map();
    for (const r of await bridge.query('AvenueSensors', 'Active eq 1', ['SensorId', 'UnitName', 'MinF', 'MaxF'], 100)) {
      if (r.SensorId && r.MinF != null && r.MaxF != null && Number.isFinite(Number(r.MinF)) && Number.isFinite(Number(r.MaxF))) byId.set(String(r.SensorId), { name: r.UnitName, minF: Number(r.MinF), maxF: Number(r.MaxF) });
    }
    cache = { at: now, byId }; return byId;
  }
  const monthKey = (now) => `scalls:${iso(now).slice(0, 7)}`;
  const monthCalls = async (now) => (await store.get(monthKey(now)))?.n || 0;
  async function addCalls(now, delta) { const n = (await monthCalls(now)) + delta; await store.put({ id: monthKey(now), n }); status.calls = n; return n; }

  const cfgOf = (c) => ({ minF: c.minF, maxF: c.maxF, staleAfterMinutes: STALE_MIN });
  const dist = (f, c) => (f > c.maxF ? f - c.maxF : c.minF - f);   // how far outside the range (positive = outside)
  const farther = (a, b, c) => (a === undefined || dist(b, c) > dist(a, c) ? b : a);

  /** Normal | OutOfRange | Stale | Offline for a unit's last reading. Stale beats Normal and OutOfRange; no reading for 2 h = Offline. */
  function stateOf(st, c, now) {
    if (!st?.atSec || now - st.atSec > OFFLINE_SEC) return 'Offline';
    const k = classifyReading({ sensorId: 'x', timestamp: iso(st.atSec), value: st.valueF, unit: 'F' }, cfgOf(c), iso(now));
    return k === 'stale' ? 'Stale' : k === 'out-of-range' ? 'OutOfRange' : k === 'normal' ? 'Normal' : 'Offline';
  }

  /** One reading: advance the excursion state machine (SharePoint write FIRST), then persist state, then the raw bucket. A failed write leaves nothing persisted, so the next run retries. */
  async function ingest(sid, r, c, now) {
    const f = r.unit === 'C' ? (r.value * 9) / 5 + 32 : r.value;
    const reading = { sensorId: sid, timestamp: iso(r.atSec), value: f, unit: 'F' };
    if (classifyReading(reading, cfgOf(c), iso(now)) === 'invalid') return false;   // future timestamp, bad number
    const oor = classifyReading(reading, cfgOf(c), reading.timestamp) === 'out-of-range';   // range judged at the reading's own time (history is not "stale")
    const bk = bucketKey(sid, hourOf(r.atSec)), sk = `sstate:${sid}`;
    const bucket = (await store.get(bk)) || { id: bk, r: [] };
    if (bucket.r.some(x => x[0] === r.atSec)) return false;   // duplicate raw reading
    const st = (await store.get(sk)) || { id: sk, atSec: 0 };
    const next = { ...st, id: sk };
    if (r.atSec > st.atSec) {   // an older reading (late history) only goes into the bucket
      Object.assign(next, { atSec: r.atSec, valueF: f, battery: r.battery ?? st.battery, signal: r.signal ?? st.signal });
      let ev = null;
      if (oor) {
        next.inn = 0; next.out = (st.out || 0) + 1;
        if (next.out === 1) { next.streakStart = r.atSec; next.streakPeak = f; } else next.streakPeak = farther(st.streakPeak, f, c);
        if (next.out >= 2 && !st.open) { next.open = `exc-${sid}-${next.streakStart}`; next.openedAt = next.streakStart; next.peak = next.streakPeak; ev = 'open'; }
        else if (st.open) { next.peak = farther(st.peak, f, c); if (next.peak !== st.peak) ev = 'peak'; }
      } else {
        next.out = 0; next.inn = (st.inn || 0) + 1; if (next.inn === 1) next.inStart = r.atSec;
        if (st.open && next.inn >= 2) ev = 'close';
      }
      if (ev) {
        const id = next.open, fields = { FacilityId: FACILITY, ExcursionId: id, SensorId: sid, StartedAt: iso(next.openedAt), PeakF: r1(next.peak) };
        if (ev === 'open') Object.assign(fields, { Minutes: Math.round((r.atSec - next.openedAt) / 60), State: 'Open' });
        if (ev === 'peak') fields.Minutes = Math.round((r.atSec - next.openedAt) / 60);
        if (ev === 'close') {
          Object.assign(fields, { EndedAt: iso(next.inStart), Minutes: Math.round((next.inStart - next.openedAt) / 60) });
          const [ex] = await bridge.query('AvenueTempExcursions', `ExcursionId eq '${lit(id)}'`, ['State'], 1);
          if (ex?.State !== 'Acknowledged') fields.State = 'Closed';   // a member of staff may have acknowledged it while it was open
          next.open = null; next.streakStart = undefined;
        }
        await bridge.upsert('AvenueTempExcursions', 'ExcursionId', id, fields);
      }
      await store.put(next);
    }
    bucket.r.push([r.atSec, f, oor ? 1 : 0]);
    await store.put(bucket);
    return true;
  }

  /** Previous completed UTC hours: one AvenueSensorHourly row per unit (upsert by HourKey, so a restart or retry never duplicates). The marker moves after the whole hour. */
  async function summarize(byId, now) {
    const cur = hourOf(now);
    const marker = (await store.get('sjob:hourly'))?.h ?? cur - 2;
    for (let h = Math.max(marker + 1, cur - 24); h < cur; h++) {
      for (const sid of byId.keys()) {
        const b = await store.get(bucketKey(sid, h));
        if (b?.r?.length) {
          const v = b.r.map(x => x[1]);
          await bridge.upsert('AvenueSensorHourly', 'HourKey', hourKey(sid, h), { FacilityId: FACILITY, HourKey: hourKey(sid, h), SensorId: sid, HourUtc: iso(h * HOUR),
            MinF: r1(Math.min(...v)), MaxF: r1(Math.max(...v)), AvgF: r1(v.reduce((a, x) => a + x, 0) / v.length), Count: v.length, OutOfRangeCount: b.r.filter(x => x[2]).length });
        }
        await store.del(bucketKey(sid, h - KEEP_HOURS));   // 90-day raw retention
      }
      await store.put({ id: 'sjob:hourly', h });
    }
  }

  /** History for up to 24 h after a gap (host down, Swift outage), so the hourly record has no holes. */
  const backfill = (map, fromSec, nowS) => swift.series(map, Math.max(fromSec, nowS - DAY), nowS);

  async function runOnce() {
    const now = nowSec();
    const used = await monthCalls(now);
    status.calls = used;
    if (used >= budget * BUDGET_STOP) { log(`sensors: stopped at ${used} Swift calls this month (80% of the budget)`); return { skipped: 'budget', calls: used }; }
    const byId = await sensors(now), last = await store.get('sjob:last'), calls0 = swift.callCount();
    let readings = [];
    try {
      const tree = await swift.treemap([...byId.keys()]);
      readings = tree.readings; idMap = tree.ids; status.unmatched = tree.unmatched;   // configured units missing from the Swift tree are counted, not an error
      if (last && now - last.atSec > GAP_SEC && Object.keys(idMap).length) readings = readings.concat(await backfill(idMap, last.atSec, now));
    } finally { await addCalls(now, swift.callCount() - calls0); }
    let stored = 0, unknown = 0;
    for (const r of readings.sort((a, b) => a.atSec - b.atSec)) {
      const c = byId.get(r.sensorId);
      if (!c) { unknown++; continue; }   // mapped by Swift id only, never by name
      if (await ingest(r.sensorId, r, c, now)) stored++;
    }
    let reporting = 0;
    for (const [sid, c] of byId) {
      const sk = `sstate:${sid}`, st = (await store.get(sk)) || { id: sk, atSec: 0 }, state = stateOf(st, c, now);
      if (state === 'Normal' || state === 'OutOfRange') reporting++;
      if (st.sig === `${st.atSec}|${state}`) continue;   // nothing changed: no SharePoint write
      await bridge.upsert('AvenueSensorLatest', 'SensorId', sid, { FacilityId: FACILITY, SensorId: sid, ReadAt: st.atSec ? iso(st.atSec) : null,
        ValueF: st.atSec ? r1(st.valueF) : null, State: state, Battery: st.battery ?? null, Signal: st.signal ?? null, UpdatedAt: iso(now) });
      await store.put({ ...st, sig: `${st.atSec}|${state}` });
    }
    await summarize(byId, now);
    await store.put({ id: 'sjob:last', atSec: now });
    status.lastSyncAt = iso(now); status.reporting = reporting;
    return { received: readings.length, stored, unknown, reporting };
  }

  return {
    /** One poll. A second call while one is running returns {skipped:'running'}. */
    async run() { if (running) return { skipped: 'running' }; running = true; try { return await runOnce(); } finally { running = false; } },
    status: () => ({ lastSyncAt: status.lastSyncAt, reporting: status.reporting, callsThisMonth: status.calls, unmatched: status.unmatched }),
  };
}
