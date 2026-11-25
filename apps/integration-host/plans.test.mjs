import test from 'node:test';
import assert from 'node:assert/strict';
import { PLANS, plansFromRows, createPlanSource, lookupKey } from './plans.mjs';
import { createBridge, bridgeFromEnv, validateJoin, startJoin } from './bridge.mjs';
import { joinForm } from './join.mjs';

const ROWS = [
  { PlanId: 'Starter-5', PlanGroup: 'Emerging', PriceCents: 50000, CardPriceCents: null, MonthlyHours: 5, ExtraHourRate: 80, OpenToNew: true, Active: true },
  { PlanId: 'Legacy-X', PlanGroup: 'Legacy', PriceCents: 40000, CardPriceCents: 99999, MonthlyHours: 5, ExtraHourRate: 35, OpenToNew: true, Active: true },
  { PlanId: 'Closed-10', PlanGroup: { Value: 'Mobile Kitchen' }, PriceCents: 60000, CardPriceCents: 61000, MonthlyHours: 10, OpenToNew: false, Active: true },
  { PlanId: '', PriceCents: 100, MonthlyHours: 1 }, { PlanId: 'no-price', MonthlyHours: 3 }, { PlanId: 'off', PriceCents: 100, MonthlyHours: 1, Active: false }
];
const JOIN = { planId: 'starter-5', businessName: 'Biz', contactName: 'Pat', phone: '', teamSize: 1, collectionDay: 3, payMethod: 'Card' };

test('plansFromRows: same shape as PLANS, invalid rows skipped, legacy one price and closed, card default = bank + 3 %', () => {
  const p = plansFromRows(ROWS);
  assert.deepEqual(p.map(x => x.planId), ['starter-5', 'legacy-x', 'closed-10']);
  assert.deepEqual(Object.keys(p[0]).sort(), Object.keys(PLANS[0]).sort());
  assert.equal(p[0].cardPriceCents, 51500);
  assert.equal(p[1].cardPriceCents, 40000); assert.equal(p[1].openToNew, false);
  assert.equal(p[2].group, 'Mobile Kitchen'); assert.equal(p[2].openToNew, false);
});

/** Fake read-only plans flow; counts calls. */
function source({ rows = ROWS, fail = false, ttlSec = 600 } = {}) {
  let now = 1000, calls = 0; const logs = [];
  const bridge = { query: async (name, filter, select, top) => { calls++; assert.equal(name, 'AvenuePlans'); assert.match(filter, /Active eq 1/); assert.ok(top >= 1); if (fail) throw new Error('bridge: GET AvenuePlans/items returned 500'); return rows; } };
  const plans = createPlanSource({ bridge, nowSec: () => now, ttlSec, log: l => logs.push(l) });
  return { plans, logs, tick: s => { now += s; }, calls: () => calls };
}

test('plan source: cached for ttl, then re-read', async () => {
  const s = source();
  assert.equal((await s.plans())[0].planId, 'starter-5');
  await s.plans(); assert.equal(s.calls(), 1);
  s.tick(601); await s.plans(); assert.equal(s.calls(), 2);
});

test('plan source: falls back to plans.mjs on error or when nothing is open to new members, and does not retry every request', async () => {
  const s = source({ fail: true });
  assert.equal(await s.plans(), PLANS); await s.plans();
  assert.equal(s.calls(), 1); assert.match(s.logs[0], /built-in list/); assert.doesNotMatch(s.logs.join(), /sig=|https?:/);
  const c = source({ rows: [ROWS[2]] });
  assert.equal(await c.plans(), PLANS);
});

test('plan source: keeps the last good list when a later read fails', async () => {
  let fail = false, now = 0;
  const plans = createPlanSource({ bridge: { query: async () => { if (fail) throw new Error('x'); return ROWS; } }, nowSec: () => now });
  const first = await plans(); fail = true; now = 700;
  assert.equal(await plans(), first);
});

test('validateJoin and lookupKey use the given plan list', () => {
  const p = plansFromRows(ROWS);
  assert.ok(validateJoin(JOIN).errors, 'unknown in plans.mjs');
  assert.equal(validateJoin(JOIN, p).value.planId, 'starter-5');
  assert.ok(validateJoin({ ...JOIN, planId: 'closed-10' }, p).errors);
  assert.equal(lookupKey('starter-5', 'Card', p), 'avenue-starter-5-card');
  assert.equal(lookupKey('legacy-x', 'Card', p), 'avenue-legacy-x-bank');
});

test('startJoin reads plans from deps.plans (test mode, payment skipped)', async () => {
  const writes = [];
  const deps = { nowSec: () => 1e9, paymentsRequired: false, plans: async () => plansFromRows(ROWS),
    bridge: { query: async () => [], upsert: async (list, k, key, fields) => { writes.push([list, fields]); return { id: 1 }; } } };
  const r = await startJoin({ email: 'a@b.com', input: JOIN, source: 'Portal' }, deps);
  assert.match(r.outcome, /Test mode/);
  assert.equal(writes[0][1].PlanId, 'starter-5');
});

test('join form lists the given plans (open ones only)', () => {
  const html = joinForm({}, [], plansFromRows(ROWS));
  assert.match(html, /Starter-5/); assert.doesNotMatch(html, /Closed-10|Legacy-X/);
  assert.match(joinForm(), /Emerging-10/);   // default: plans.mjs
});

test('bridge: AvenuePlans is read only and optional in env (not part of complete)', async () => {
  const sent = [];
  const fetch = async (u, o) => { sent.push(u); return { ok: true, status: 200, json: async () => ({ status: 200, body: { value: [] } }) }; };
  const b = createBridge({ urls: { AvenuePlans: 'https://flow.example/plans?sig=S' }, fetch, sleep: async () => {} });
  await b.query('AvenuePlans', 'x', ['PlanId']);
  assert.equal(sent[0], 'https://flow.example/plans?sig=S');
  await assert.rejects(b.upsert('AvenuePlans', 'PlanId', 'p', { PriceCents: 1 }), /not allowed/);
  const env = bridgeFromEnv({ SP_BRIDGE_PLANS: 'https://flow.example/plans?sig=S' }, fetch);
  assert.equal(env.plansConfigured, true); assert.equal(env.complete, false); assert.ok(env.bridge);
  assert.equal(bridgeFromEnv({}, fetch).plansConfigured, false);
});
