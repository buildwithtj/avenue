import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSensors } from './sensors.seed.mjs';

const schema = JSON.parse(readFileSync(new URL('./lists.v2.json', import.meta.url)));
const list = schema.lists.find(l => l.title === 'AvenueSensors');
const rows = buildSensors();

test('8 sensors, unique Swift ids and names, fields exist in the schema', () => {
  assert.equal(rows.length, 8);
  assert.equal(new Set(rows.map(r => r.key)).size, 8);
  assert.equal(new Set(rows.map(r => r.fields.UnitName)).size, 8, 'the two Complimentary Refrigerator units must not share a name');
  const names = new Set(['Title', ...list.fields.map(f => f.name)]);
  for (const r of rows) for (const k of Object.keys(r.fields)) assert.ok(names.has(k), `${k} not in schema`);
});

test('sheet ranges: fridges 36-40 F, freezers -8-0 F', () => {
  for (const { fields: f } of rows) assert.deepEqual([f.MinF, f.MaxF], f.UnitType === 'Fridge' ? [36, 40] : [-8, 0]);
  assert.equal(rows.filter(r => r.fields.UnitType === 'Freezer').length, 3);
});
