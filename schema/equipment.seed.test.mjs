import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildEquipment, CATEGORIES } from './equipment.seed.mjs';

const schema = JSON.parse(readFileSync(new URL('./lists.v2.json', import.meta.url)));
const eq = schema.lists.find(l => l.title === 'AvenueEquipment');
const cats = eq.fields.find(f => f.name === 'Category').choices;
const rows = buildEquipment();

test('ids unique, no test/demo prefix, required fields set', () => {
  assert.equal(new Set(rows.map(r => r.key)).size, rows.length);
  const names = new Set(['Title', ...eq.fields.map(f => f.name)]);
  for (const r of rows) {
    assert.ok(!/^(gaptest-|demo-)/.test(r.key));
    assert.equal(r.fields.EquipmentId, r.key);
    for (const k of ['Title', 'FacilityId', 'Kind', 'Category', 'Location', 'SortOrder']) assert.ok(r.fields[k] !== undefined, `${r.key}.${k}`);
    assert.equal(r.fields.Active, r.fields.BookableByMembers); assert.equal(r.fields.Active, !/^pizza-oven/.test(r.key));
    for (const k of Object.keys(r.fields)) assert.ok(names.has(k), `${k} not in schema`);
  }
});
test('categories valid and in sync with the schema; sort order spaced by 10', () => {
  assert.deepEqual(CATEGORIES, cats);
  for (const r of rows) assert.ok(cats.includes(r.fields.Category));
  rows.forEach((r, i) => assert.equal(r.fields.SortOrder, (i + 1) * 10));
});
test('kind matches category; 6 prep tables; convection pair shares a group', () => {
  assert.equal(rows.filter(r => r.fields.Kind === 'Prep table').length, 6);
  assert.ok(rows.every(r => (r.fields.Category === 'Prep table') === (r.fields.Kind === 'Prep table')));
  assert.equal(rows.filter(r => r.fields.GroupId === 'convection-oven').length, 2);
});
