import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMemberDemo, MD } from './memberdemo.seed.mjs';

test('member demo seed: tagged, complete, sample-labelled', () => {
  const rows = buildMemberDemo({ email: 'Tester@Example.com', now: Date.parse('2026-11-24T15:00:00Z') });
  assert.ok(rows.every(r => r.key.startsWith(MD) && r.fields.Title === r.key));
  const q = rows.filter(r => r.list === 'AvenueChecklistQuestions');
  assert.deepEqual(['Entry', 'Exit', 'Wellness'].map(k => q.filter(r => r.fields.Kind === k).length), [6, 6, 5]);
  assert.ok(q.every(r => r.fields.Question.startsWith('Sample:') && r.fields.Active === true));
  assert.equal(rows.filter(r => r.list === 'AvenueMyDocuments').length, 6);
  assert.ok(rows.filter(r => r.fields.MemberId).every(r => r.fields.MemberId === 'tester@example.com'));
  assert.ok(!rows.some(r => ['AvenueBookingRequests', 'AvenueCheckInSubmissions', 'AvenueDocumentSubmissions'].includes(r.list)));
  assert.equal(new Set(rows.map(r => r.list + r.key)).size, rows.length);
});
