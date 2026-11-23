// First-real-run helper: signs in to Swift ONCE and prints every temperature sensor of the account tree plus how the configured unit codes map onto it.
// Run on the server:  sudo node --env-file=/etc/avenue/host.env /opt/avenue/apps/integration-host/swiftdiscover.mjs [CODE ...]     (codes default to SWIFT_CODES or the 8 sheet units)
// Prints names, ids, values and times only: never the API key, e-mail, password or token. Use it to check (a) the value unit and (b) where each code appears in the tree.
import { pathToFileURL } from 'node:url';
import { createSwiftClient, parseTreemap } from './swiftClient.mjs';

const SHEET_CODES = ['A00L4N', 'A00JY1', 'A00JJL', 'A00JN6', 'A00JP7', 'A00JPK', 'A00JQ4', 'A00JRF'];   // schema/sensors.seed.mjs (8 of the 9 units, Q-E1)
const UNITS = { 1: 'F', 2: 'C', 3: 'K' };

/** Report lines for a raw treemap JSON and a list of codes. Pure, so it is tested without the network. */
export function discoverLines(json, codes, { valueUnit, nowSec = Math.floor(Date.now() / 1000) } = {}) {
  const nodes = json?.treeMap || {}, out = [];
  const temps = Object.entries(nodes).filter(([k, n]) => /^s_\d+$/.test(k) && UNITS[n?.unitId]);
  out.push(`tree: ${Object.keys(nodes).length} nodes, ${temps.length} temperature sensors (value unit override: ${valueUnit || 'none, taken from unitId'})`);
  for (const [k, n] of temps) {
    const dev = nodes[n.parent] || {}, col = nodes[dev.parent] || {};
    const age = Number.isFinite(Number(n.time)) ? `${Math.round((nowSec - Number(n.time)) / 60)} min ago` : 'no time';
    out.push(`${k} | ${n.profileName ?? '-'} | unit ${UNITS[n.unitId]} (id ${n.unitId}) | value ${n.value} (precision ${n.precision ?? '-'}) | ${age} | device "${dev.name ?? '-'}" hwId ${dev.hwId ?? '-'} | collector "${col.name ?? '-'}" | threshold ${n.thresholdStatus ?? '-'}`);
  }
  const r = parseTreemap(json, codes, { valueUnit });
  for (const x of r.readings) out.push(`MATCHED ${x.sensorId} -> s_${r.ids[x.sensorId].id} (${x.value.toFixed(1)} F, read as ${r.ids[x.sensorId].unit})`);
  for (const c of r.unmatched) out.push(`NOT FOUND in the tree: ${c}`);
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const env = process.env, args = process.argv.slice(2);
  const codes = args.length ? args : env.SWIFT_CODES ? env.SWIFT_CODES.split(',').map(s => s.trim()).filter(Boolean) : SHEET_CODES;
  const valueUnit = ['F', 'C'].includes(env.SWIFT_VALUE_UNIT) ? env.SWIFT_VALUE_UNIT : undefined;
  const client = createSwiftClient({ baseUrl: env.SWIFT_BASE_URL || undefined, apiKey: env.SWIFT_API_KEY, user: env.SWIFT_USER, password: env.SWIFT_PASSWORD, valueUnit, fetch, nowSec: () => Math.floor(Date.now() / 1000) });
  try { for (const l of discoverLines(await client.tree(), codes, { valueUnit })) console.log(l); console.log(`Swift calls made: ${client.callCount()}`); }
  catch (e) { console.log(/^swift: [^\n]{1,160}$/.test(e.message) ? e.message : 'failed'); process.exitCode = 1; }
}
