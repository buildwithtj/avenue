import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseChecklist } from './checklist.seed.mjs';

test('empty input loads nothing and invents nothing', () => {
  for (const x of ['', '  ', [], undefined]) assert.deepEqual(parseChecklist(x), { rows: [], errors: [] });
});
test('CSV with quotes and default order per kind', () => {
  const r = parseChecklist('Kind,Question,SortOrder,Active\nEntry,"Is the floor clean, dry?",,\nEntry,Hands washed?,,\nExit,Equipment cleaned?,1,false\nWellness,Feeling well?,,');
  assert.equal(r.errors.length, 0);
  assert.deepEqual(r.rows.map(x => [x.Kind, x.SortOrder, x.Active]), [['Entry', 1, true], ['Entry', 2, true], ['Exit', 1, false], ['Wellness', 1, true]]);
  assert.equal(r.rows[0].Question, 'Is the floor clean, dry?');
});
test('JSON array accepted', () => assert.equal(parseChecklist('[{"Kind":"Exit","Question":"Done?","SortOrder":2}]').rows[0].SortOrder, 2));
test('bad rows are reported and nothing is returned', () => {
  const r = parseChecklist([{ Kind: 'Lunch', Question: 'x' }, { Kind: 'Entry', Question: '' }, { Kind: 'Entry', Question: 'a'.repeat(501) }, { Kind: 'Entry', Question: 'ok', SortOrder: 1 }, { Kind: 'Entry', Question: 'dup', SortOrder: 1 }, { Kind: 'Exit', Question: 'q', SortOrder: 0 }]);
  assert.equal(r.rows.length, 0); assert.equal(r.errors.length, 5);
  assert.match(r.errors.join('\n'), /Kind must be/); assert.match(r.errors.join('\n'), /used twice/);
});
