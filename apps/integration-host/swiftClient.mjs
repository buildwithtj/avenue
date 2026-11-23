// Swift Sensors API client (docs/ENVIRONMENT_PLAN.md section 5). READ ONLY: it never writes to Swift.
// API facts VERIFIED against Swift's public docs (https://my.swiftsensors.net/api-docs, read 23 Nov 2026):
//   base https://api.swiftsensors.net/api/client/v1; every call has header X-API-Key; POST /sign-in {email, password, language:null} -> {access_token, expires_in 86400,
//   token_type, refresh_token, account_id}; every other call also has `Authorization: {token_type} {access_token}` and lives under /accounts/{account_id}/...;
//   403 = token expired (sign in again); GET .../treemap; POST .../time-series/sensor; sign-in failure 400 {error: 1123 bad credentials | 1122 locked out | 1176/1169 two-factor};
//   API-key errors 400 {error: 9997 mismatch | 9998 quota | 9999 invalid}.
// STILL UNVERIFIED (run swiftdiscover.mjs on the server on the first real run): (a) whether treemap `value` is in the unit named by `unitId` (display unit) or in the stored unit
// (the docs say value uses the stored type; SWIFT_VALUE_UNIT=F|C overrides), (b) where the code printed in the client sheet ('SS3-102 (A00L4N)' -> A00L4N) appears in the tree.
const DEFAULT_BASE = 'https://api.swiftsensors.net/api/client/v1';
export const SIGN_IN = '/sign-in';
const TOKEN_TTL = 23 * 3600;   // the token lasts 24 h; renew an hour early
const LOCK_SEC = 3600;         // after ANY failed sign-in (4xx) stop trying for an hour: Swift locks a user out after too many wrong logins (error 1122)
const TEMP_UNITS = { 1: 'F', 2: 'C', 3: 'K' };   // static types: unit 1 Fahrenheit, 2 Celsius, 3 Kelvin; every other unitId is another property and is ignored
const toF = (v, u) => (u === 'C' ? (v * 9) / 5 + 32 : u === 'K' ? ((v - 273.15) * 9) / 5 + 32 : v);
const epoch = (t) => Math.floor(t > 1e11 ? t / 1000 : t);
const tokenRe = (code) => new RegExp(`(^|[^A-Za-z0-9])${String(code).replace(/[^A-Za-z0-9]/g, '')}($|[^A-Za-z0-9])`, 'i');   // a code matches only as a whole token ('AAA11' is not in 'AAA111')
const labelsOf = (...nodes) => nodes.flatMap(n => (n ? [n.name, n.description, n.hwId, n.hwId && String(n.hwId).replace(/[:.\-]/g, '')] : [])).filter(x => typeof x === 'string' && x);

/** Maps the configured unit codes (AvenueSensors.SensorId, e.g. 'A00L4N') onto temperature sensors of the treemap.
 *  A code matches a sensor when it appears as a whole token in the sensor node's or its device's name / description / hwId; only when no sensor or device matches, the collector's
 *  name / hwId is tried. Several matches: the newest reading wins. Returns {readings (deg F, sensorId = the configured code), unmatched [codes], ids {code: {id, unit}}}. */
export function parseTreemap(json, wanted = [], { valueUnit } = {}) {
  const nodes = json?.treeMap && typeof json.treeMap === 'object' ? json.treeMap : {};
  const temps = [];
  for (const [k, n] of Object.entries(nodes)) {
    if (!/^s_\d+$/.test(k) || !n || !TEMP_UNITS[n.unitId]) continue;
    const t = Number(n.time), v = n.value === null || n.value === '' ? NaN : Number(n.value);
    if (!Number.isFinite(v) || !Number.isFinite(t) || t <= 0) continue;
    const dev = nodes[n.parent], col = nodes[dev?.parent];
    temps.push({ id: Number(k.slice(2)), n, dev, v, t: epoch(t), unit: valueUnit || TEMP_UNITS[n.unitId], near: labelsOf(n, dev), far: labelsOf(col) });
  }
  const readings = [], unmatched = [], ids = {};
  for (const code of wanted) {
    const re = tokenRe(code), hits = (lvl) => temps.filter(s => s[lvl].some(l => re.test(l)));
    const found = hits('near'), pool = found.length ? found : hits('far');
    if (!pool.length) { unmatched.push(code); continue; }
    const s = pool.reduce((a, b) => (b.t > a.t ? b : a));
    const bat = Number(s.dev?.batteryLevel);
    readings.push({ sensorId: code, atSec: s.t, value: toF(s.v, s.unit), unit: 'F', battery: s.dev?.batteryLevel != null && Number.isFinite(bat) ? bat : undefined, signal: undefined });
    ids[code] = { id: s.id, unit: s.unit };
  }
  return { readings, unmatched, ids };
}

/** Series answer -> readings (deg F) for the sensors in `idMap` ({code: {id, unit}}). Times are seconds because the request says so. */
export function parseSeries(json, idMap = {}) {
  const byId = new Map(Object.entries(idMap).map(([code, m]) => [Number(m.id), { code, unit: m.unit }]));
  const out = [];
  for (const s of Array.isArray(json?.timeSeriesData) ? json.timeSeriesData : []) {
    const m = byId.get(Number(s?.id));
    if (!m) continue;
    for (const p of Array.isArray(s.samples) ? s.samples : []) {
      const t = Number(p?.[0]), v = p?.[1] === null ? NaN : Number(p?.[1]);
      if (Number.isFinite(t) && t > 0 && Number.isFinite(v)) out.push({ sensorId: m.code, atSec: epoch(t), value: toF(v, m.unit), unit: 'F' });
    }
  }
  return out;
}

/** `fetch` and `sleep` are injected. Token cached in memory for 23 h; one re-sign-in on 403; one retry after 500 ms on a network error, 429 or 5xx; a failed sign-in (4xx) pauses all
 *  sign-ins for 1 h. Errors say only "swift: <label> returned <status> (error <Swift code>)": never the key, e-mail, password, token or a response body.
 *  `callCount()` counts every HTTP call (sign-ins included). */
export function createSwiftClient({ baseUrl = DEFAULT_BASE, apiKey, user, password, valueUnit, fetch, nowSec, sleep = (ms) => new Promise(r => setTimeout(r, ms)) }) {
  let auth = null, expires = 0, calls = 0, lock = null;
  const fail = (label, r) => new Error(`swift: ${label} returned ${r.status || 'no answer'}${r.code ? ` (error ${r.code})` : ''}`);
  async function http(method, path, { headers = {}, body } = {}) {
    for (let attempt = 0; ; attempt++) {
      let status = 0, json = null;
      try {
        calls++;
        const res = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, { method, headers: { 'X-API-Key': apiKey, accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
        status = res.status; json = await res.json().catch(() => null);
      } catch { status = 0; }
      if ((status === 0 || status === 429 || status >= 500) && attempt === 0) { await sleep(500); continue; }
      return { status, json, code: Number.isInteger(json?.error) ? json.error : undefined };
    }
  }
  async function signIn() {
    if (lock && nowSec() < lock.until) throw new Error(`swift: sign-in paused for an hour after a failed attempt${lock.code ? ` (error ${lock.code})` : ''}`);
    const r = await http('POST', SIGN_IN, { body: { email: user, password, language: null } });
    const j = r.json;
    if (r.status === 200 && j?.access_token && j?.account_id) {
      auth = { header: `${j.token_type || 'Bearer'} ${j.access_token}`, account: encodeURIComponent(String(j.account_id)) }; expires = nowSec() + TOKEN_TTL; lock = null; return;
    }
    if (r.status >= 400 && r.status < 500) lock = { until: nowSec() + LOCK_SEC, code: r.code };   // a transient 5xx / network failure is NOT locked
    throw fail('sign-in', r);
  }
  async function authed(method, path, label, body) {
    for (let again = 0; ; again++) {
      if (!auth || nowSec() >= expires) await signIn();
      const r = await http(method, `/accounts/${auth.account}${path}`, { headers: { authorization: auth.header }, body });
      if (r.status === 403 && again === 0) { auth = null; continue; }
      if (r.status === 0 || r.status >= 300 || !r.json) throw fail(label, r);
      return r.json;
    }
  }
  return {
    callCount: () => calls,
    /** The raw treemap JSON (swiftdiscover.mjs). */
    tree: () => authed('GET', '/treemap', 'treemap'),
    /** Latest reading per wanted code: {readings, unmatched, ids}. */
    treemap: async (wanted) => parseTreemap(await authed('GET', '/treemap', 'treemap'), wanted, { valueUnit }),
    /** Raw samples (no averaging) of the sensors in idMap ({code: {id, unit}}) between two epoch-second times, as readings in deg F. */
    series: async (idMap, startSec, endSec) => parseSeries(await authed('POST', '/time-series/sensor', 'series',
      { timeUnitDesignation: 'seconds', startTime: startSec, endTime: endSec, influxFn: null, ids: Object.values(idMap).map(m => m.id), type: 'samples' }), idMap)
  };
}
