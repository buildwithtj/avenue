import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSeed, buildSupportTopics, zoned, PREFIX } from './seed.data.mjs';

const schema = JSON.parse(readFileSync(new URL('./lists.v2.json', import.meta.url)));
const fieldsOf = Object.fromEntries(schema.lists.map(l => [l.title, new Set(['Title', ...l.fields.map(f => f.name)])]));
const NOW = Date.parse('2026-11-14T15:00:00Z');

test('every row uses a real list and real fields, and Title carries the prefix', () => {
  for (const r of buildSeed({ now: NOW })) {
    assert.ok(fieldsOf[r.list], `unknown list ${r.list}`);
    assert.ok(r.fields.Title.startsWith(PREFIX));
    for (const k of Object.keys(r.fields)) assert.ok(fieldsOf[r.list].has(k), `${r.list}.${k} is not in the schema`);
  }
});
test('keys are unique and stable between runs', () => {
  const a = buildSeed({ now: NOW }), b = buildSeed({ now: NOW + 3600e3 });
  assert.equal(new Set(a.map(r => r.list + r.key)).size, a.length);
  assert.deepEqual(a.map(r => r.key), b.map(r => r.key));
});
test('dates are facility-relative and follow DST', () => {
  assert.equal(zoned(NOW, 1, 9, 0, 'America/New_York'), '2026-11-15T14:00:00.000Z');
  assert.equal(zoned(Date.parse('2026-07-14T15:00:00Z'), 1, 9, 0, 'America/New_York'), '2026-07-15T13:00:00.000Z');
  assert.equal(zoned(Date.parse('2026-11-15T03:00:00Z'), 0, 9, 0, 'America/New_York'), '2026-11-14T14:00:00.000Z');
});
test('scenarios exist', () => {
  const rows = buildSeed({ now: NOW });
  const get = (list, key) => rows.find(r => r.list === list && r.key === PREFIX + key).fields;
  assert.ok(get('AvenueMemberDocuments', 'doc-green').ExpiryDate < '2026-11-14');
  assert.ok(get('AvenueMemberDocuments', 'doc-maple').ExpiryDate > '2026-11-14');
  assert.equal(get('AvenueBookings', 'bk-harvest-pending').Status, 'Pending');
  assert.ok(get('AvenueBookings', 'bk-maple-ext').ExtensionTo);
  assert.equal(get('AvenueCheckIns', 'chk-maple-fail').AllPassed, false);
  assert.equal(get('AvenueNotices', 'notice-published').Active, true);
  assert.equal(get('AvenueNoticeDrafts', 'notice-draft').State, 'Draft');
});
test('no e-mail can be triggered: every row a live flow watches carries its "already handled" marker', () => {
  const rows = buildSeed({ now: NOW });
  for (const r of rows.filter(x => x.list === 'AvenueBookings')) { assert.ok(r.fields.DecisionNotified); assert.ok(r.fields.OverlapNotified); }
  assert.ok(rows.find(r => r.list === 'AvenueNotices').fields.NotifiedAt);
  assert.ok(rows.find(r => r.list === 'AvenueCheckIns').fields.AlertSentAt);
  for (const l of ['AvenueCalendar', 'AvenueMyMembership', 'AvenueHoursLedger', 'AvenueDocumentSubmissions', 'AvenueBookingRequests']) assert.ok(!rows.some(r => r.list === l), `${l} must be created by its flow, not seeded`);
});
test('no price, secret or real address is seeded', () => {
  const s = JSON.stringify(buildSeed({ now: NOW }));
  assert.ok(!/ExtraHourRate/.test(s));
  assert.ok(!/@(?!example\.invalid)[a-z0-9.-]+\.[a-z]{2,}/i.test(s));
});
test('support topics: the five current categories, real fields, never matched by the demo-/gaptest- cleanups', () => {
  const rows = buildSupportTopics();
  assert.deepEqual(rows.map(r => r.fields.Title), ['Booking', 'Billing', 'Documents', 'Equipment', 'Other']);
  for (const r of rows) {
    assert.equal(r.key, r.fields.Title);
    assert.ok(!r.key.startsWith(PREFIX) && !r.key.startsWith('gaptest-'));
    for (const k of Object.keys(r.fields)) assert.ok(fieldsOf[r.list].has(k), `${r.list}.${k} is not in the schema`);
  }
});
