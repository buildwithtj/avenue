import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { parseTreemap, createSwiftClient } from './swiftClient.mjs';
import { createSensorJob } from './sensorJob.mjs';
import { createTableStore, createMemoryTable } from './store.mjs';
import { bridgeFromEnv } from './bridge.mjs';

const iso = (s) => new Date(s * 1000).toISOString();
const T0 = Date.UTC(2026, 10, 23, 10, 0, 0) / 1000;   // 23 Nov 2026 10:00 UTC
const ROWS = [{ SensorId: 'AAA111', UnitName: 'Complimentary Refrigerator 1', MinF: 36, MaxF: 40 }, { SensorId: 'BBB222', UnitName: 'Complimentary Refrigerator 1', MinF: 36, MaxF: 40 }];

// ---------- swift client ----------
// A tree in the shape of the docs (collector -> device -> sensors), extended with Celsius / Kelvin / humidity sensors.
const node = (extra) => ({ time: T0 - 60, precision: 1, thresholdStatus: 1, ...extra });
const TREE = { serverTime: T0 * 1000, treeMap: {
  a_: { name: 'Flavors', children: ['c_22'] },
  c_22: { name: 'SG3-1010N (25NA)', hwId: '10:20:30:AB:EB:00', parent: 'a_', children: ['d_33', 'd_34', 'd_35', 'd_36'] },
  d_33: { name: 'SS3-102 (A00L4N)', hwId: '10:20:30:AB:EB:01', batteryLevel: 91, parent: 'c_22', children: ['s_44', 's_45'] },
  s_44: node({ profileName: 'Temperature', unitId: 1, value: 38.2, parent: 'd_33' }),
  s_45: node({ profileName: 'Humidity', unitId: 4, value: 55, parent: 'd_33' }),
  d_34: { name: 'SS3-102 (A00JY1)', hwId: '10:20:30:AB:EB:02', parent: 'c_22', children: ['s_46'] },
  s_46: node({ profileName: 'Temperature', unitId: 2, value: 3, parent: 'd_34' }),
  d_35: { name: 'Sensor (89:03)', hwId: '10:20:30:AB:EB:A00JJL', parent: 'c_22', children: ['s_47'] },
  s_47: node({ profileName: 'Temperature', unitId: 3, value: 276.15, parent: 'd_35', time: (T0 - 120) * 1000 }),
  d_36: { name: 'Contact', parent: 'c_22', children: ['s_48'] },
  s_48: node({ profileName: 'Contact', unitId: 19, value: 1, parent: 'd_36' }) } };
const approx = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('parseTreemap: maps codes onto temperature sensors by device name or hwId; Celsius and Kelvin become deg F; other properties ignored', () => {
  const r = parseTreemap(TREE, ['A00L4N', 'A00JY1', 'A00JJL', 'NOPE99']);
  assert.deepEqual(r.readings.map(x => x.sensorId), ['A00L4N', 'A00JY1', 'A00JJL']);
  const [a, b, c] = r.readings;
  assert.deepEqual([a.value, a.atSec, a.unit, a.battery], [38.2, T0 - 60, 'F', 91]);
  approx(b.value, 37.4); assert.equal(b.battery, undefined);
  approx(c.value, 37.4); assert.equal(c.atSec, T0 - 120, 'a millisecond time is turned into seconds');
  assert.deepEqual(r.ids, { A00L4N: { id: 44, unit: 'F' }, A00JY1: { id: 46, unit: 'C' }, A00JJL: { id: 47, unit: 'K' } });
  assert.deepEqual(r.unmatched, ['NOPE99']);
  assert.deepEqual(parseTreemap(null, ['A00L4N']), { readings: [], unmatched: ['A00L4N'], ids: {} });   // a bad answer is "not found", never a throw
  assert.deepEqual(parseTreemap({ treeMap: { s_1: { unitId: 1, value: 'x', time: 5 } } }, ['A']).readings, []);
});
test('parseTreemap: a code is a whole token; two units with the same display name map by code; the collector name is only a fallback', () => {
  const two = { treeMap: {
    d_1: { name: 'Complimentary Refrigerator 1 (A00L4N)', children: ['s_1'] }, s_1: node({ unitId: 1, value: 37, parent: 'd_1' }),
    d_2: { name: 'Complimentary Refrigerator 1 (A00JY1)', children: ['s_2'] }, s_2: node({ unitId: 1, value: 39, parent: 'd_2' }) } };
  const r = parseTreemap(two, ['A00JY1', 'A00L4N']);
  assert.deepEqual(r.readings.map(x => [x.sensorId, x.value]), [['A00JY1', 39], ['A00L4N', 37]]);
  assert.deepEqual(parseTreemap(two, ['A00L4']).unmatched, ['A00L4'], 'a prefix is not a match');
  assert.deepEqual(parseTreemap({ treeMap: { d_1: { name: 'xA00L4Nx', children: ['s_1'] }, s_1: node({ unitId: 1, value: 37, parent: 'd_1' }) } }, ['A00L4N']).unmatched, ['A00L4N']);
  const viaCollector = { treeMap: { c_1: { name: 'SS3-102 (A00JRF)', children: ['d_1'] }, d_1: { name: 'Sensor', parent: 'c_1', children: ['s_1'] }, s_1: node({ unitId: 1, value: -4, parent: 'd_1' }) } };
  assert.equal(parseTreemap(viaCollector, ['A00JRF']).readings[0].value, -4);
  const both = { treeMap: { c_1: { name: 'A00JRF', children: ['d_1', 'd_2'] }, d_1: { name: 'Sensor (A00JRF)', parent: 'c_1', children: ['s_1'] }, d_2: { name: 'Other', parent: 'c_1', children: ['s_2'] },
    s_1: node({ unitId: 1, value: -4, parent: 'd_1' }), s_2: node({ unitId: 1, value: 70, parent: 'd_2' }) } };
  assert.equal(parseTreemap(both, ['A00JRF']).readings[0].value, -4, 'a device-level match beats the collector name');
  const newest = { treeMap: { d_1: { name: 'A00L4N', children: ['s_1', 's_2'] }, s_1: node({ unitId: 1, value: 37, parent: 'd_1', time: 100 }), s_2: node({ unitId: 1, value: 39, parent: 'd_1', time: 200 }) } };
  assert.equal(parseTreemap(newest, ['A00L4N']).readings[0].value, 39, 'two matches: the newest reading wins');
});
test('parseTreemap: SWIFT_VALUE_UNIT overrides the unit read from unitId (value stored in Celsius, display unit Fahrenheit)', () => {
  const t = { treeMap: { d_1: { name: 'A00L4N', children: ['s_1'] }, s_1: node({ unitId: 1, value: 3, parent: 'd_1' }) } };
  assert.equal(parseTreemap(t, ['A00L4N']).readings[0].value, 3);
  const r = parseTreemap(t, ['A00L4N'], { valueUnit: 'C' });
  approx(r.readings[0].value, 37.4); assert.equal(r.ids.A00L4N.unit, 'C');
  assert.equal(parseTreemap({ treeMap: { d_1: { name: 'A00L4N', children: ['s_1'] }, s_1: node({ unitId: 19, value: 3, parent: 'd_1' }) } }, ['A00L4N'], { valueUnit: 'C' }).readings.length, 0, 'still only temperature sensors');
});

function fakeFetch(route) {
  const log = [];
  const f = async (url, o = {}) => {
    const u = new URL(url); log.push({ path: u.pathname.replace('/api/client/v1', ''), search: u.search, method: o.method, headers: o.headers, body: o.body });
    const r = route(log[log.length - 1], log); if (r instanceof Error) throw r;
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.json };
  };
  f.log = log; return f;
}
const client = (f, o = {}) => createSwiftClient({ baseUrl: 'https://swift.test/api/client/v1', apiKey: 'KEY-SECRET', user: 'user@secret.test', password: 'PW-SECRET', fetch: f, nowSec: () => o.now?.() ?? T0, sleep: async (ms) => o.sleeps?.push(ms), ...o.cfg });
const ok = (json) => ({ status: 200, json });
const signedIn = (tok = 'TOK1') => ok({ access_token: tok, expires_in: 86400, token_type: 'Bearer', refresh_token: 'REFRESH-SECRET', account_id: '.12345.' });
const SIGNIN = '/sign-in';

test('swift client: sign-in request shape, token cached 23 h, account path and headers, every call counted', async () => {
  let now = T0;
  const f = fakeFetch(r => (r.path === SIGNIN ? signedIn() : ok(TREE)));
  const c = client(f, { now: () => now });
  assert.equal((await c.treemap(['A00L4N'])).readings.length, 1); await c.treemap(['A00L4N']);
  const [si] = f.log; assert.deepEqual([si.method, si.path, si.headers['X-API-Key'], si.headers['content-type']], ['POST', '/sign-in', 'KEY-SECRET', 'application/json']);
  assert.deepEqual(JSON.parse(si.body), { email: 'user@secret.test', password: 'PW-SECRET', language: null });
  assert.equal(si.headers.authorization, undefined, 'sign-in carries no token');
  assert.equal(f.log.filter(x => x.path === SIGNIN).length, 1); assert.equal(c.callCount(), 3);
  const t = f.log.find(x => x.path.endsWith('/treemap'));
  assert.deepEqual([t.method, t.path, t.headers.authorization, t.headers['X-API-Key']], ['GET', '/accounts/.12345./treemap', 'Bearer TOK1', 'KEY-SECRET']);
  now += 23 * 3600 + 1; await c.treemap(['A00L4N']);
  assert.equal(f.log.filter(x => x.path === SIGNIN).length, 2);
});
test('swift client: 403 (expired token) signs in again once; a second 403 throws', async () => {
  let n = 0; const f = fakeFetch(r => (r.path === SIGNIN ? signedIn('T' + (++n)) : r.headers.authorization === 'Bearer T1' ? { status: 403 } : ok(TREE)));
  assert.equal((await client(f).treemap(['A00L4N'])).readings.length, 1); assert.equal(n, 2);
  const g = fakeFetch(r => (r.path === SIGNIN ? signedIn() : { status: 403 }));
  await assert.rejects(client(g).treemap([]), /swift: treemap returned 403/);
  assert.equal(g.log.filter(x => x.path === SIGNIN).length, 2);
});
test('swift client: a failed sign-in pauses all sign-ins for an hour (no lock-out), then tries again', async () => {
  let now = T0, answer = { status: 400, json: { error: 1123, msg: 'Email and/or password is invalid', secret: 'BODY-SECRET' } };
  const f = fakeFetch(r => (r.path === SIGNIN ? answer : ok(TREE)));
  const c = client(f, { now: () => now });
  await assert.rejects(c.treemap([]), /^Error: swift: sign-in returned 400 \(error 1123\)$/);
  assert.equal(f.log.length, 1);
  await assert.rejects(c.treemap([]), /swift: sign-in paused for an hour after a failed attempt \(error 1123\)/);
  now += 3599; await assert.rejects(c.treemap([]), /paused/); assert.equal(f.log.length, 1, 'no HTTP call at all during the pause');
  now += 2; answer = signedIn(); assert.equal((await c.treemap([])).readings.length, 0); assert.equal(f.log.length, 3);   // sign-in + treemap
  const g = fakeFetch(r => (r.path === SIGNIN ? { status: 400, json: { error: 9997 } } : ok(TREE)));
  const d = client(g); await assert.rejects(d.treemap([]), /error 9997/); await assert.rejects(d.treemap([]), /paused/); assert.equal(g.log.length, 1);
  const h = fakeFetch(r => (r.path === SIGNIN ? { status: 503 } : ok(TREE)));
  const e = client(h, { sleeps: [] }); await assert.rejects(e.treemap([]), /sign-in returned 503/); await assert.rejects(e.treemap([]), /sign-in returned 503/);
  assert.equal(h.log.length, 4, 'a 5xx is retried once and is NOT a lock (2 attempts per call)');
});
test('swift client: 429/5xx/network retried once after 500 ms, then thrown', async () => {
  const sleeps = []; let n = 0;
  const f = fakeFetch(r => (r.path === SIGNIN ? signedIn() : ++n === 1 ? { status: 429 } : ok(TREE)));
  assert.equal((await client(f, { sleeps }).treemap(['A00L4N'])).readings.length, 1); assert.deepEqual(sleeps, [500]);
  const s2 = []; await assert.rejects(client(fakeFetch(r => (r.path === SIGNIN ? signedIn() : { status: 429 })), { sleeps: s2 }).treemap([]), /returned 429/); assert.deepEqual(s2, [500]);
  await assert.rejects(client(fakeFetch(() => new Error('socket hang up'))).treemap([]), /sign-in returned no answer/);
});
test('swift client: errors carry the status and the Swift error code but never the key, e-mail, password, token or a response body', async () => {
  const body = { error: 1123, secret: 'BODY-SECRET', access_token: 'TOK-SECRET', msg: 'MSG-TEXT' };
  for (const route of [() => ({ status: 400, json: body }), r => (r.path === SIGNIN ? signedIn('TOK-SECRET') : { status: 500, json: body }), r => (r.path === SIGNIN ? signedIn('TOK-SECRET') : { status: 404, json: { error: 1101, ...body } }), () => ok({ nothing: 1 })]) {
    const e = await client(fakeFetch(route)).treemap([]).then(() => null, x => x);
    assert.ok(e, 'must throw');
    for (const s of ['KEY-SECRET', 'secret.test', 'PW-SECRET', 'TOK-SECRET', 'BODY-SECRET', 'REFRESH-SECRET', 'MSG-TEXT', 'swift.test']) assert.ok(!e.message.includes(s), `error leaks ${s}`);
  }
  assert.match((await client(fakeFetch(() => ({ status: 400, json: body }))).treemap([]).catch(x => x)).message, /\(error 1123\)/);
});
test('swift client: series posts the numeric ids and the window and returns every raw sample as deg F', async () => {
  const f = fakeFetch(r => (r.path === SIGNIN ? signedIn() : ok({ startTime: 1, endTime: 2, timeSeriesData: [
    { id: 44, samples: [[T0 - 600, 38], [T0 - 300, 39.5]] }, { id: 46, samples: [[T0 - 600, 3], [T0 - 300, null], ['x', 1]] }, { id: 99, samples: [[T0, 1]] }] })));
  const idMap = { A00L4N: { id: 44, unit: 'F' }, A00JY1: { id: 46, unit: 'C' } };
  const r = await client(f).series(idMap, T0 - 900, T0);
  const req = f.log.at(-1); assert.deepEqual([req.method, req.path], ['POST', '/accounts/.12345./time-series/sensor']);
  assert.deepEqual(JSON.parse(req.body), { timeUnitDesignation: 'seconds', startTime: T0 - 900, endTime: T0, influxFn: null, ids: [44, 46], type: 'samples' });
  assert.deepEqual(r.map(x => [x.sensorId, x.atSec, x.unit]), [['A00L4N', T0 - 600, 'F'], ['A00L4N', T0 - 300, 'F'], ['A00JY1', T0 - 600, 'F']]);
  approx(r[2].value, 37.4);
});
test('swiftdiscover: lists every temperature sensor and what matched, without secrets', async () => {
  const { discoverLines } = await import('./swiftdiscover.mjs');
  const lines = discoverLines(TREE, ['A00L4N', 'NOPE99'], { nowSec: T0 }), text = lines.join('\n');
  assert.match(lines[0], /3 temperature sensors/);
  assert.ok(text.includes('s_44 | Temperature | unit F (id 1) | value 38.2') && text.includes('device "SS3-102 (A00L4N)"') && !text.includes('s_45'));
  assert.ok(text.includes('MATCHED A00L4N -> s_44') && text.includes('NOT FOUND in the tree: NOPE99'));
});

// ---------- job ----------
function fakeBridge(rows) {
  const b = { sensorRows: rows.map(r => ({ ...r })), failOnce: null, lists: { AvenueSensorLatest: [], AvenueSensorHourly: [], AvenueTempExcursions: [] },
    async query(name, filter) {
      if (name === 'AvenueSensors') return this.sensorRows;
      const m = /ExcursionId eq '([^']*)'/.exec(filter);
      return name === 'AvenueTempExcursions' && m ? this.lists[name].filter(r => r.ExcursionId === m[1]) : [];
    },
    async upsert(name, key, val, fields) {
      if (this.failOnce === name) { this.failOnce = null; throw new Error('bridge: down'); }
      const l = this.lists[name], i = l.findIndex(r => r[key] === val);
      if (i >= 0) l[i] = { ...l[i], ...fields }; else l.push({ ...fields });
      return { id: l.length };
    } };
  return b;
}
function fakeFeed() {
  return { readings: [], seriesData: [], seriesCalls: [], n: 0,
    async treemap(wanted) { this.n++; this.asked = wanted; return { readings: this.readings.map(r => ({ ...r })), unmatched: this.unmatched || [], ids: Object.fromEntries(wanted.map((c, i) => [c, { id: i + 1, unit: 'F' }])) }; },
    async series(idMap, a, b) { this.n++; this.seriesCalls.push([Object.keys(idMap), a, b]); return this.seriesData.map(r => ({ ...r })); },
    callCount() { return this.n; } };
}
function make({ rows = ROWS, budget = 100000, start = T0 } = {}) {
  const m = { t: { now: start }, store: createTableStore(createMemoryTable()), bridge: fakeBridge(rows), swift: fakeFeed() };
  m.mk = () => createSensorJob({ swift: m.swift, bridge: m.bridge, store: m.store, nowSec: () => m.t.now, budget });
  m.job = m.mk();
  return m;
}
const L = (m, name) => m.bridge.lists[name];
const latest = (m, id) => L(m, 'AvenueSensorLatest').find(r => r.SensorId === id);
/** Advance 10 min and report one reading for AAA111 at that moment. */
async function poll(m, value, id = 'AAA111', unit = 'F') { m.t.now += 600; m.swift.readings = [{ sensorId: id, atSec: m.t.now, value, unit }]; return m.job.run(); }

test('job: units mapped by Swift id even when two share a name; Celsius converted; ranges per unit', async () => {
  const m = make(); m.swift.readings = [{ sensorId: 'AAA111', atSec: T0 - 60, value: 38, unit: 'F' }, { sensorId: 'BBB222', atSec: T0 - 60, value: 3, unit: 'C' }, { sensorId: 'ZZZ999', atSec: T0 - 60, value: 38, unit: 'F' }];
  const r = await m.job.run();
  assert.equal(r.stored, 2); assert.equal(r.unknown, 1); assert.equal(L(m, 'AvenueSensorLatest').length, 2);
  assert.deepEqual([latest(m, 'AAA111').ValueF, latest(m, 'AAA111').State], [38, 'Normal']);
  assert.deepEqual([latest(m, 'BBB222').ValueF, latest(m, 'BBB222').State], [37.4, 'Normal']);
  m.t.now += 600; m.swift.readings = [{ sensorId: 'AAA111', atSec: m.t.now, value: 45, unit: 'F' }]; await m.job.run();
  assert.equal(latest(m, 'AAA111').State, 'OutOfRange');
});
test('job: asks the tree for the configured codes only and reports the ones missing from it (no error); health lists them', async () => {
  const m = make(); m.swift.unmatched = ['BBB222']; m.swift.readings = [{ sensorId: 'AAA111', atSec: T0 - 60, value: 38, unit: 'F' }];
  const r = await m.job.run();
  assert.deepEqual(m.swift.asked, ['AAA111', 'BBB222']); assert.equal(r.stored, 1);
  assert.deepEqual(m.job.status().unmatched, ['BBB222']); assert.equal(latest(m, 'BBB222').State, 'Offline');
});
test('job: stale beats normal, no reading for 2 h is Offline, a unit never seen is Offline, future timestamps are ignored', async () => {
  const m = make(); m.swift.readings = [{ sensorId: 'AAA111', atSec: T0 - 40 * 60, value: 38, unit: 'F' }];
  await m.job.run(); assert.equal(latest(m, 'AAA111').State, 'Stale'); assert.equal(latest(m, 'BBB222').State, 'Offline'); assert.equal(latest(m, 'BBB222').ReadAt, null);
  m.t.now += 3 * 3600; m.swift.readings = [{ sensorId: 'AAA111', atSec: T0 - 40 * 60, value: 38, unit: 'F' }]; await m.job.run();
  assert.equal(latest(m, 'AAA111').State, 'Offline');
  const f = make(); f.swift.readings = [{ sensorId: 'AAA111', atSec: T0 + 3600, value: 38, unit: 'F' }];
  assert.equal((await f.job.run()).stored, 0); assert.equal(latest(f, 'AAA111').State, 'Offline');
});
test('job: excursion opens on the 2nd consecutive out-of-range reading, tracks the peak, closes on the 2nd in-range one', async () => {
  const m = make();
  await poll(m, 44); assert.equal(L(m, 'AvenueTempExcursions').length, 0, 'one reading is not an excursion');
  await poll(m, 38); await poll(m, 44); assert.equal(L(m, 'AvenueTempExcursions').length, 0, 'a reading in range resets the count');
  await poll(m, 46);
  const [ex] = L(m, 'AvenueTempExcursions'), start = m.t.now - 600;
  assert.deepEqual([ex.State, ex.PeakF, ex.StartedAt], ['Open', 46, iso(start)]);
  await poll(m, 47); assert.deepEqual([ex.State, L(m, 'AvenueTempExcursions')[0].PeakF], ['Open', 47]);
  await poll(m, 38); await poll(m, 44); assert.equal(L(m, 'AvenueTempExcursions')[0].State, 'Open', 'one in-range reading does not close it');
  await poll(m, 38); await poll(m, 38);
  const c = L(m, 'AvenueTempExcursions'); assert.equal(c.length, 1);
  assert.deepEqual([c[0].State, c[0].EndedAt], ['Closed', iso(m.t.now - 600)]); assert.equal(c[0].Minutes, (m.t.now - 600 - start) / 60);
});
test('job: an acknowledged excursion keeps its state when it closes', async () => {
  const m = make(); await poll(m, 44); await poll(m, 45);
  L(m, 'AvenueTempExcursions')[0].State = 'Acknowledged'; L(m, 'AvenueTempExcursions')[0].CorrectiveAction = 'door shut';
  await poll(m, 38); await poll(m, 38);
  const [ex] = L(m, 'AvenueTempExcursions'); assert.deepEqual([ex.State, ex.CorrectiveAction, ex.EndedAt !== undefined], ['Acknowledged', 'door shut', true]);
});
test('job: an excursion can span midnight (UTC); the hourly summary of the last hour before midnight is written', async () => {
  const m = make({ start: Date.UTC(2026, 10, 23, 23, 30) / 1000 });
  await poll(m, 38); await poll(m, 44); await poll(m, 45); await poll(m, 38); await poll(m, 38);
  const [ex] = L(m, 'AvenueTempExcursions');
  assert.deepEqual([ex.StartedAt, ex.EndedAt, ex.Minutes, ex.State], ['2026-11-23T23:50:00.000Z', '2026-11-24T00:10:00.000Z', 20, 'Closed']);
  const h = L(m, 'AvenueSensorHourly').find(r => r.HourKey === 'AAA111-2026-11-23T23');
  assert.deepEqual([h.Count, h.OutOfRangeCount, h.MinF, h.MaxF, h.HourUtc], [2, 1, 38, 44, '2026-11-23T23:00:00.000Z']);
});
test('job: thresholds edited mid-excursion apply from the next cache refresh; the excursion then closes by the new range', async () => {
  const m = make(); await poll(m, 41); await poll(m, 42); assert.equal(L(m, 'AvenueTempExcursions')[0].State, 'Open');
  m.bridge.sensorRows[0].MaxF = 50; m.t.now += 3100;   // the unit list is cached for 1 h, so this poll (> 1 h later) reads the new range
  await poll(m, 43); assert.equal(L(m, 'AvenueTempExcursions')[0].State, 'Open'); await poll(m, 43);
  assert.deepEqual([L(m, 'AvenueTempExcursions')[0].State, L(m, 'AvenueTempExcursions')[0].EndedAt], ['Closed', iso(m.t.now - 600)]);
});
test('job: the same raw reading is stored once', async () => {
  const m = make(); m.t.now += 600; m.swift.readings = [{ sensorId: 'AAA111', atSec: m.t.now, value: 38, unit: 'F' }];
  assert.equal((await m.job.run()).stored, 1); assert.equal((await m.job.run()).stored, 0);
  assert.equal((await m.store.get('sensor:AAA111:2026-11-23T10')).r.length, 1);
});
test('job: hourly summary is idempotent across a failed write, a restart and a re-run', async () => {
  const m = make(); await poll(m, 38); await poll(m, 39); await poll(m, 41);
  m.t.now = Date.UTC(2026, 10, 23, 11, 5) / 1000 - 600; m.bridge.failOnce = 'AvenueSensorHourly';
  await assert.rejects(poll(m, 38), /bridge: down/);
  assert.equal(L(m, 'AvenueSensorHourly').length, 0, 'nothing written yet; the marker did not move');
  const again = m.mk();   // restart: new job object, same store
  m.job = again; await poll(m, 38); await poll(m, 38);
  const rows = L(m, 'AvenueSensorHourly'); assert.equal(rows.length, 1);
  assert.deepEqual([rows[0].HourKey, rows[0].MinF, rows[0].MaxF, rows[0].AvgF, rows[0].Count, rows[0].OutOfRangeCount], ['AAA111-2026-11-23T10', 38, 41, 39.3, 3, 1]);
  await m.store.put({ id: 'sjob:hourly', h: Math.floor(T0 / 3600) - 1 }); await poll(m, 38);   // marker pushed back: the hour is summarised again
  assert.equal(L(m, 'AvenueSensorHourly').length, 1);
});
test('job: stops at 80% of the monthly call budget and counts every Swift call', async () => {
  const m = make({ budget: 100 }); await m.store.put({ id: 'scalls:2026-11', n: 79 });
  assert.equal((await poll(m, 38)).stored, 1); assert.equal((await m.store.get('scalls:2026-11')).n, 80); assert.equal(m.job.status().callsThisMonth, 80);
  const calls = m.swift.n; assert.deepEqual(await poll(m, 38), { skipped: 'budget', calls: 80 }); assert.equal(m.swift.n, calls, 'no Swift call once stopped');
});
test('job: a second run while one is in progress is skipped', async () => {
  const m = make(); let release; const real = m.swift.treemap.bind(m.swift);
  m.swift.treemap = () => new Promise(r => { release = r; });
  const p1 = m.job.run(); assert.deepEqual(await m.job.run(), { skipped: 'running' });
  await new Promise(r => setImmediate(r)); release({ readings: [], unmatched: [], ids: {} }); await p1;
  m.swift.treemap = real; assert.ok(!(await m.job.run()).skipped);
});
test('job: a gap over 1 h backfills up to 24 h of history; a short gap does not', async () => {
  const m = make(); await poll(m, 38); const last = m.t.now;
  m.t.now += 3 * 3600; m.swift.readings = [{ sensorId: 'AAA111', atSec: m.t.now, value: 38, unit: 'F' }];
  m.swift.seriesData = [{ sensorId: 'AAA111', atSec: last + 3600, value: 38, unit: 'F' }, { sensorId: 'AAA111', atSec: last + 3600 + 600, value: 38.5, unit: 'F' }];
  await m.job.run();
  assert.deepEqual(m.swift.seriesCalls, [[['AAA111', 'BBB222'], last, m.t.now]]);
  assert.equal((await m.store.get(`sensor:AAA111:${iso(last + 3600).slice(0, 13)}`)).r.length, 2);
  await poll(m, 38); assert.equal(m.swift.seriesCalls.length, 1, 'a 10 minute gap needs no history');
  m.t.now += 30 * 3600; m.swift.seriesData = []; m.swift.readings = [{ sensorId: 'AAA111', atSec: m.t.now, value: 38, unit: 'F' }]; await m.job.run();
  assert.equal(m.swift.seriesCalls[1][1], m.t.now - 86400, 'never more than 24 h of history');
});

// ---------- bridge allow-list and server wiring ----------
test('bridge: sensor lists are routed to their own flows; the catalogue is read only; unset sensor flows do not make the bridge incomplete', async () => {
  const core = { SP_BRIDGE_APPLICANTS: 'https://f/a', SP_BRIDGE_MEMBERS: 'https://f/m', SP_BRIDGE_INVOICES: 'https://f/i', SP_BRIDGE_LEDGER: 'https://f/l', SP_BRIDGE_GRANT: 'https://f/g' };
  const sensors = { SP_BRIDGE_SENSORS: 'https://f/s', SP_BRIDGE_SENSOR_LATEST: 'https://f/sl', SP_BRIDGE_SENSOR_HOURLY: 'https://f/sh', SP_BRIDGE_EXCURSIONS: 'https://f/ex' };
  assert.deepEqual([bridgeFromEnv(core, fetch).complete, bridgeFromEnv(core, fetch).sensorsComplete], [true, false]);
  assert.deepEqual([bridgeFromEnv({ ...core, ...sensors }, fetch).complete, bridgeFromEnv({ ...core, ...sensors }, fetch).sensorsComplete], [true, true]);
  const hits = []; const f = async (url, o) => { hits.push([url, JSON.parse(o.body)]); return { ok: true, json: async () => ({ status: 200, body: { value: [], Id: 1 } }) }; };
  const { bridge } = bridgeFromEnv({ ...core, ...sensors }, f);
  await bridge.query('AvenueSensors', 'Active eq 1', ['SensorId'], 10); await bridge.upsert('AvenueSensorLatest', 'SensorId', 'AAA111', { State: 'Normal' });
  assert.equal(hits[0][0], 'https://f/s'); assert.ok(hits.slice(1).every(h => h[0] === 'https://f/sl'));
  await assert.rejects(bridge.upsert('AvenueSensors', 'SensorId', 'AAA111', { MinF: 1 }), /not allowed/);
  await assert.rejects(bridgeFromEnv(core, f).bridge.query('AvenueSensors', 'Active eq 1', ['SensorId'], 1), /not configured/);
});
test('server: sensors off unless the Swift credentials and all four sensor flows are set; health reports it without secrets', async () => {
  const { depsFromEnv, createApp } = await import('./server.mjs');
  const base = { DB_PATH: ':memory:' }, swift = { SWIFT_API_KEY: 'k-secret', SWIFT_USER: 'u', SWIFT_PASSWORD: 'p' };
  const flows = { SP_BRIDGE_SENSORS: 'https://f/1', SP_BRIDGE_SENSOR_LATEST: 'https://f/2', SP_BRIDGE_SENSOR_HOURLY: 'https://f/3', SP_BRIDGE_EXCURSIONS: 'https://f/4' };
  for (const env of [base, { ...base, ...swift }, { ...base, ...flows }, { ...base, ...swift, ...flows, SP_BRIDGE_EXCURSIONS: '' }, { ...base, ...swift, ...flows, SWIFT_PASSWORD: '' }])
    assert.equal(depsFromEnv(env).sensors, undefined);
  const health = async (deps) => {
    const server = http.createServer(createApp({ ...deps, secretConfigured: () => true, webhookSecret: () => 'x', allowedAccounts: [] }));
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    try { return await (await fetch(`http://127.0.0.1:${server.address().port}/api/health`)).json(); } finally { server.close(); }
  };
  const on = depsFromEnv({ ...base, ...swift, ...flows }); assert.ok(on.sensors);
  const j = await health(on);
  assert.deepEqual([j.sensorsConfigured, j.sensorsReporting, j.callsThisMonth, j.lastSensorSyncAt], [true, 0, null, null]);
  assert.ok(!JSON.stringify(j).includes('k-secret') && !JSON.stringify(j).includes('https://f/'));
  assert.equal((await health(depsFromEnv(base))).sensorsConfigured, false);
});
