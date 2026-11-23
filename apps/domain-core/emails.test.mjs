import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noticeEmail, reminderEmail, decisionEmail } from './emails.mjs';

const PORTAL_URL = 'https://bstreethq.sharepoint.com/sites/Avenue';

test('noticeEmail: outputs subject and text containing portalUrl, and never contains a title', () => {
  const email = noticeEmail({ portalUrl: PORTAL_URL });
  assert.equal(email.subject, 'New notice from Flavors Culinary Hub');
  assert(email.text.includes(PORTAL_URL));
  assert(!email.text.toLowerCase().includes('title'));
});

test('noticeEmail rejects extra properties (title, body, wellness, amount, etc.)', () => {
  assert.throws(
    () => noticeEmail({ portalUrl: PORTAL_URL, title: 'Holiday Closure' }),
    /Disallowed property "title"/
  );
  assert.throws(
    () => noticeEmail({ portalUrl: PORTAL_URL, body: 'We are closed tomorrow.' }),
    /Disallowed property "body"/
  );
  assert.throws(
    () => noticeEmail({ portalUrl: PORTAL_URL, amount: 100 }),
    /Disallowed property "amount"/
  );
  assert.throws(
    () => noticeEmail({ portalUrl: PORTAL_URL, wellness: 'passed' }),
    /Disallowed property "wellness"/
  );
});

test('reminderEmail: formats time in Eastern and includes portal URL', () => {
  const email = reminderEmail({
    startUtc: '2026-06-15T18:00:00.000Z',
    portalUrl: PORTAL_URL
  });
  // 18:00 UTC in June (EDT -4) is 14:00 (2:00 PM)
  assert.equal(email.subject, 'Reminder: your Flavors booking starts at 2:00 PM');
  assert(email.text.includes('2026-06-15'));
  assert(email.text.includes('2:00 PM'));
  assert(email.text.includes(PORTAL_URL));
});

test('reminderEmail rejects extra properties (answers, amount, documentType, etc.)', () => {
  assert.throws(
    () => reminderEmail({ startUtc: '2026-06-15T18:00:00.000Z', portalUrl: PORTAL_URL, answers: ['yes', 'no'] }),
    /Disallowed property "answers"/
  );
  assert.throws(
    () => reminderEmail({ startUtc: '2026-06-15T18:00:00.000Z', portalUrl: PORTAL_URL, documentType: 'Insurance' }),
    /Disallowed property "documentType"/
  );
  assert.throws(
    () => reminderEmail({ startUtc: '2026-06-15T18:00:00.000Z', portalUrl: PORTAL_URL, wellness: true }),
    /Disallowed property "wellness"/
  );
  assert.throws(
    () => reminderEmail({ startUtc: '2026-06-15T18:00:00.000Z', portalUrl: PORTAL_URL, amount: 5000 }),
    /Disallowed property "amount"/
  );
});

test('decisionEmail: builds approved, declined, cancelled e-mails with optional staffNote', () => {
  // Approved without staffNote
  const approved = decisionEmail({
    status: 'Approved',
    space: 'Kitchen',
    startUtc: '2026-06-15T18:00:00.000Z',
    portalUrl: PORTAL_URL
  });
  assert.equal(approved.subject, 'Your Flavors booking is Approved');
  assert(approved.text.includes('Space: Kitchen'));
  assert(approved.text.includes('2:00 PM'));
  assert(approved.text.includes(PORTAL_URL));
  assert(!approved.text.includes('Note from Flavors:'));

  // Declined with staffNote (trimmed)
  const declined = decisionEmail({
    status: 'Declined',
    space: 'Dining',
    startUtc: '2026-06-15T18:00:00.000Z',
    staffNote: '   Overlapping maintenance scheduled   ',
    portalUrl: PORTAL_URL
  });
  assert.equal(declined.subject, 'Your Flavors booking is Declined');
  assert(declined.text.includes('Space: Dining'));
  assert(declined.text.includes('Note from Flavors: Overlapping maintenance scheduled'));

  // Cancelled
  const cancelled = decisionEmail({
    status: 'Cancelled',
    space: 'Whole facility',
    startUtc: '2026-06-15T18:00:00.000Z',
    portalUrl: PORTAL_URL
  });
  assert.equal(cancelled.subject, 'Your Flavors booking is Cancelled');
});

test('decisionEmail rejects invalid status or extra properties', () => {
  assert.throws(
    () => decisionEmail({
      status: 'Pending', // not allowed
      space: 'Kitchen',
      startUtc: '2026-06-15T18:00:00.000Z',
      portalUrl: PORTAL_URL
    }),
    /status must be one of Approved, Declined, Cancelled/
  );

  assert.throws(
    () => decisionEmail({
      status: 'Approved',
      space: 'Kitchen',
      startUtc: '2026-06-15T18:00:00.000Z',
      portalUrl: PORTAL_URL,
      amount: 1000
    }),
    /Disallowed property "amount"/
  );

  assert.throws(
    () => decisionEmail({
      status: 'Approved',
      space: 'Kitchen',
      startUtc: '2026-06-15T18:00:00.000Z',
      portalUrl: PORTAL_URL,
      answers: {}
    }),
    /Disallowed property "answers"/
  );
});

test('portalUrl validation: must start with https://', () => {
  assert.throws(
    () => noticeEmail({ portalUrl: 'http://insecure.com' }),
    /https:\/\//
  );
  assert.throws(
    () => reminderEmail({ startUtc: '2026-06-15T18:00:00.000Z', portalUrl: 'ftp://files' }),
    /https:\/\//
  );
  assert.throws(
    () => decisionEmail({ status: 'Approved', space: 'Kitchen', startUtc: '2026-06-15T18:00:00.000Z', portalUrl: 'invalid-url' }),
    /https:\/\//
  );
});

test('times convert correctly across the November daylight-saving change', () => {
  // 1 Nov 2026 05:30 UTC -> still EDT (-4) -> 01:30 AM
  const beforeDstEnd = reminderEmail({
    startUtc: '2026-11-01T05:30:00.000Z',
    portalUrl: PORTAL_URL
  });
  assert.equal(beforeDstEnd.subject, 'Reminder: your Flavors booking starts at 1:30 AM');
  assert(beforeDstEnd.text.includes('1:30 AM'));

  // 1 Nov 2026 06:00 UTC -> EST (-5) -> 01:00 AM
  const afterDstEnd = reminderEmail({
    startUtc: '2026-11-01T06:00:00.000Z',
    portalUrl: PORTAL_URL
  });
  assert.equal(afterDstEnd.subject, 'Reminder: your Flavors booking starts at 1:00 AM');
  assert(afterDstEnd.text.includes('1:00 AM'));
});
