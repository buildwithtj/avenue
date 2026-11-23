import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPlans } from './plans.seed.mjs';

const schema = JSON.parse(readFileSync(new URL('./lists.v2.json', import.meta.url)));
const plans = schema.lists.find(l => l.title === 'AvenuePlans');
const payments = readFileSync(new URL('../apps/member-spfx/src/avenue/payments.ts', import.meta.url), 'utf8');
const rows = buildPlans();

test('18 plans, unique ids matching the portal price table, fields in schema', () => {
  assert.equal(rows.length, 18);
  assert.equal(new Set(rows.map(r => r.key)).size, 18);
  const names = new Set(['Title', ...plans.fields.map(f => f.name)]);
  for (const r of rows) {
    assert.ok(payments.includes(`'${r.key}'`), `${r.key} missing from PLAN_PRICES`);
    for (const k of Object.keys(r.fields)) assert.ok(names.has(k), `${k} not in schema`);
  }
});

test('card price is +3% for current plans, unchanged for legacy; only current plans open', () => {
  const e10 = rows.find(r => r.key === 'emerging-10').fields;
  assert.equal(e10.PriceCents, 80000); assert.equal(e10.CardPriceCents, 82400); assert.equal(e10.OpenToNew, true);
  const leg = rows.find(r => r.key === 'legacy-launch').fields;
  assert.equal(leg.CardPriceCents, leg.PriceCents); assert.equal(leg.OpenToNew, false); assert.equal(leg.PlanGroup, 'Legacy');
});
