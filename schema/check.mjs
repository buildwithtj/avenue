#!/usr/bin/env node
// Offline checks for lists.v2.json and the provisioning plan. Needs no tenant. Run: node schema/check.mjs
import assert from 'node:assert/strict';
import { defs, plan, fieldXml } from './provision.mjs';

const web = 'https://example.sharepoint.com/sites/avenue-test';
const CALENDAR_ALLOWED = ['FacilityId', 'BookingId', 'ResourceId', 'Space', 'EquipmentIds', 'MemberDisplayName', 'StartUtc', 'EndUtc'];
const titles = defs.lists.map(l => l.title);
assert.equal(new Set(titles).size, titles.length, 'duplicate list titles');

for (const l of defs.lists) {
  const names = l.fields.map(f => f.name);
  assert.equal(new Set(names).size, names.length, `${l.title}: duplicate field names`);
  assert.ok(defs.access[l.access], `${l.title}: unknown access class ${l.access}`);
  const fid = l.fields.find(f => f.name === 'FacilityId');
  assert.ok(fid && fid.indexed, `${l.title}: FacilityId must exist and be indexed`);
  for (const f of l.fields) {
    assert.match(f.name, /^[A-Za-z][A-Za-z0-9]{0,31}$/, `${l.title}.${f.name}: internal name must be letters/digits, <= 32`);
    if (f.unique) assert.ok(f.indexed, `${l.title}.${f.name}: unique requires indexed`);
    if (f.type === 'Choice') assert.ok(f.choices?.length, `${l.title}.${f.name}: choice needs options`);
  }
}
// Privacy: the shared calendar may carry only the agreed fields, and private lists must exclude members.
const cal = defs.lists.find(l => l.title === 'AvenueCalendar');
for (const f of cal.fields) assert.ok(CALENDAR_ALLOWED.includes(f.name), `AvenueCalendar has non-shared field ${f.name}`);
assert.deepEqual(Object.keys(defs.access.calendar).sort(), ['Avenue Flavors Owner', 'Avenue Flavors Staff', 'Avenue Members']);
assert.ok(!('Avenue Members' in defs.access.private), 'private lists must not grant Avenue Members');
for (const [cls, grants] of Object.entries(defs.access)) {
  for (const [g, role] of Object.entries(grants)) {
    assert.ok(defs.groups.some(x => x.name === g), `${cls}: unknown group ${g}`);
    if (g === 'Avenue Members') assert.equal(role, cls === 'intake' ? 'Contribute' : 'Read', `${cls}: members may only Read (or add own requests on intake lists)`);
  }
}
// Intake lists let members add requests, so they must restrict reads and edits to the creator's own items.
for (const l of defs.lists.filter(x => x.access === 'intake')) {
  assert.equal(l.itemLevel, true, `${l.title}: intake list must use item-level read/write security`);
  assert.ok(!l.fields.some(f => f.unique), `${l.title}: SharePoint refuses unique fields on own-items-only lists; de-duplicate in the processing flow`);
  assert.ok(!l.fields.some(f => f.name === 'MemberId'), `${l.title}: member identity must come from the item author, not a supplied field`);
}
// Plan: every list gets inheritance broken before any role is granted.
const steps = plan(web);
for (const l of defs.lists) {
  const i = steps.findIndex(s => s.desc === `permissions ${l.title}: break inheritance`);
  const firstGrant = steps.findIndex(s => s.desc.startsWith(`permissions ${l.title}:`) && !s.desc.includes('break'));
  assert.ok(i >= 0 && firstGrant > i, `${l.title}: inheritance must be broken before grants`);
}
// XML is well formed enough: tags balance for each field type.
for (const l of defs.lists) for (const f of l.fields) {
  const x = fieldXml(f); assert.ok(x.startsWith('<Field ') && (x.endsWith('/>') || x.endsWith('</Field>')), `${l.title}.${f.name}: bad XML`);
}
console.log(`OK: ${defs.lists.length} lists, ${defs.lists.reduce((a, l) => a + l.fields.length, 0)} fields, ${steps.length} provisioning steps.`);
