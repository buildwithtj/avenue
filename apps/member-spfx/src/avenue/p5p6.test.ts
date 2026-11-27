jest.mock('./support', () => ({ ...jest.requireActual('./support'), SUPPORT_ATTACHMENTS_ENABLED: true }));

import { AvenueReadSource, LISTS, mergeDocuments, mergeMirrorBookings, toMirrorDocument } from './readSource';
import { requiredOrSheet, requiredRows, requiredSummary } from './compliance';
import { sentChecklistLabel } from './checklist';
import { MAX_ATTACHMENT_BYTES, threadStatus, groupThreads, validateAttachments, validateSupport } from './support';
import { SUPPORT_CATEGORIES, type IIntakeWriter, type IMyDocumentSubmission, type IMySupportMessage, type IMyRequest } from './contracts';

type Rows = Record<string, unknown[] | Error>;
/** A fake SharePoint: rows per list; an Error value makes that list's read fail (e.g. the list does not exist yet). */
const fake = (rows: Rows, urls: string[] = []): ((url: string) => Promise<unknown>) => (url: string): Promise<unknown> => {
  urls.push(decodeURIComponent(url));
  const list: string = (/getbytitle\('([^']+)'\)/.exec(url) || [])[1] || '';
  const r = rows[list];
  return r instanceof Error ? Promise.reject(r) : Promise.resolve({ value: r || [] });
};
const src = (rows: Rows, urls?: string[], w?: IIntakeWriter, email: string | undefined = 'a@b.co'): AvenueReadSource => new AvenueReadSource('https://x', 'f1', fake(rows, urls), w, 5, email);
const doc = (o: Partial<IMyDocumentSubmission>): IMyDocumentSubmission => ({ submissionId: 's', docType: 'County food permit', issueDate: '2026-01-01', expiryDate: '2027-01-01', outcome: 'Received. Flavors will verify it.', ...o });

describe('documents mirror (AvenueMyDocuments)', () => {
  const sub = { SubmissionId: 'doc-1', DocType: 'Liability insurance', IssueDate: '2026-01-01T12:00:00Z', ExpiryDate: '2027-01-01T12:00:00Z', Outcome: 'Received' };
  it('merges verified records with own submissions, dropping the submission that is the same document', async () => {
    const urls: string[] = [];
    const out = await src({ [LISTS.documentSubmissions]: [sub, { ...sub, SubmissionId: 'doc-2', DocType: 'MD good standing' }],
      [LISTS.myDocuments]: [{ Id: 9, FacilityId: 'f1', DocType: 'Liability insurance', IssueDate: '2026-01-01', ExpiryDate: '2027-01-01T00:00:00Z', Verified: true, Status: 'Current' },
        { Id: 10, DocType: 'Food handler card', ExpiryDate: '2026-12-01', Verified: false }] }, urls).listMyDocuments();
    expect(out.map(d => d.submissionId).sort()).toEqual(['doc-2', 'record-10', 'record-9']);
    expect(out.filter(d => d.submissionId === 'record-9')[0]).toMatchObject({ verified: true, fromRecord: true });
    expect(urls.filter(u => u.indexOf(LISTS.myDocuments) >= 0)[0]).toContain("MemberId eq 'a@b.co'");
  });
  it('falls back silently to submissions when the mirror is missing, and never reads it without an e-mail', async () => {
    expect((await src({ [LISTS.documentSubmissions]: [sub], [LISTS.myDocuments]: new Error('404') }).listMyDocuments()).map(d => d.submissionId)).toEqual(['doc-1']);
    const urls: string[] = [];
    await src({ [LISTS.documentSubmissions]: [sub] }, urls, undefined, '').listMyDocuments();
    expect(urls.some(u => u.indexOf(LISTS.myDocuments) >= 0)).toBe(false);
  });
  it('maps a rejected record so it reads as not accepted', () => {
    expect(toMirrorDocument({ Id: 1, DocType: 'MD good standing', ExpiryDate: '2027-01-01', Status: 'Rejected', Verified: true })).toMatchObject({ verified: false, outcome: expect.stringMatching(/^Not accepted/) });
    expect(toMirrorDocument({ Id: 1, DocType: 'Unknown', ExpiryDate: '2027-01-01' })).toBeUndefined();
    expect(mergeDocuments([], [doc({})])).toHaveLength(1);
  });
});

describe('required documents', () => {
  it('uses the sheet\'s seven types while AvenueRequiredDocTypes is empty', () => {
    expect(requiredOrSheet([])).toEqual(['County food permit', 'MD good standing', 'Liability insurance', 'Workers comp or waiver', 'Food safety manager', 'Food manager card', 'Food handler card']);
    expect(requiredOrSheet(['Permit'])).toEqual(['Permit']);
  });
  it('a valid document without a mirror record stays current (today\'s behaviour)', () => {
    const rows = requiredRows(['Permit' as never], [doc({ docType: 'Permit', expiryDate: '2027-06-01' })], '2026-11-23');
    expect(rows[0].state).toBe('current');
  });
  it('gives current / waiting / expiring (30-15-10) / expired / missing', () => {
    const today = '2026-11-23';
    const rows = requiredRows(requiredOrSheet([]), [
      doc({ docType: 'County food permit', expiryDate: '2027-06-01', verified: true }),
      doc({ docType: 'MD good standing', expiryDate: '2027-06-01', verified: false }),
      doc({ docType: 'Liability insurance', expiryDate: '2026-12-01' }),
      doc({ docType: 'Workers comp or waiver', expiryDate: '2026-12-20' }),
      doc({ docType: 'Food safety manager', expiryDate: '2026-11-01' }),
      doc({ docType: 'Food manager card', outcome: 'Not accepted: blurry' })
    ], today);
    expect(rows.map(r => r.state)).toEqual(['current', 'waiting', 'expiring', 'expiring', 'expired', 'missing', 'missing']);
    expect(rows[2]).toMatchObject({ daysLeft: 8, warn: 10 });
    expect(rows[3]).toMatchObject({ daysLeft: 27, warn: 30 });
    expect(rows[5].rejected).toBe(true);
    expect(requiredSummary(rows)).toEqual({ current: 1, waiting: 1, expiring: 2, expired: 1, missing: 2 });
  });
});

describe('check-in labels (A1)', () => {
  const b: IMyRequest = { requestId: 'staff-8154b356', space: 'Kitchen', equipmentIds: ['oven-1', 'stove-2'], startUtc: '2026-11-24T14:00:00Z', endUtc: '2026-11-24T18:00:00Z', cancelSent: false, cancelRequested: false };
  const h = { submissionId: 'chk-1', bookingId: 'staff-8154b356', kind: 'Entry' as const, createdUtc: '2026-11-20T15:00:00Z' };
  it('shows date, time and equipment, never the id', () => {
    const label = sentChecklistLabel(h, b, 'America/New_York');
    expect(label).toBe('Tue Nov 24, 9:00 AM - 1:00 PM · oven-1, stove-2');
    expect(sentChecklistLabel(h, { ...b, equipmentIds: [] }, 'America/New_York')).toMatch(/· Kitchen$/);
  });
  it('falls back to "Booking" and the day it was sent', () => {
    expect(sentChecklistLabel(h, undefined, 'America/New_York')).toBe('Booking · sent Fri, Nov 20');
    expect(sentChecklistLabel({ ...h, createdUtc: undefined }, undefined, 'America/New_York')).toBe('Booking');
  });
});

describe('support categories', () => {
  it('reads active categories in SortOrder and falls back to the built-in list when missing or empty', async () => {
    expect(await src({ [LISTS.supportCategories]: [{ Title: 'Plan change', SortOrder: 2 }, { Title: 'Kitchen', SortOrder: 1 }, { Title: 'Kitchen', SortOrder: 3 }] }).listSupportCategories()).toEqual(['Kitchen', 'Plan change']);
    expect(await src({ [LISTS.supportCategories]: [] }).listSupportCategories()).toEqual(SUPPORT_CATEGORIES);
    expect(await src({ [LISTS.supportCategories]: new Error('404') }).listSupportCategories()).toEqual(SUPPORT_CATEGORIES);
  });
  it('validates against the offered list', () => {
    const i = { facilityId: 'f', category: 'Plan change', subject: 'Change', body: 'Please move me up' };
    expect(validateSupport(i)).toEqual(['Choose what your message is about.']);
    expect(validateSupport(i, ['Plan change'])).toEqual([]);
  });
  it('reads attachments with $expand and still reads messages if the expand fails', async () => {
    const urls: string[] = [];
    const row = { Id: 1, MessageId: 'm1', Category: 'Retired one', Subject: 'S', AttachmentFiles: [{ FileName: 'a.png', ServerRelativeUrl: '/sites/x/a.png' }, { FileName: 'bad', ServerRelativeUrl: 'http://plain.example/x' }] };
    const out = await src({ [LISTS.supportMessages]: [row] }, urls).listMySupportMessages();
    expect(urls[0]).toContain('$expand=AttachmentFiles');
    expect(out[0]).toMatchObject({ category: 'Retired one', attachments: [{ name: 'a.png', url: '/sites/x/a.png' }] });
    let n = 0;
    const flaky = new AvenueReadSource('https://x', 'f1', url => (n++ === 0 ? Promise.reject(new Error('400')) : Promise.resolve({ value: [{ ...row, AttachmentFiles: undefined }] })));
    expect((await flaky.listMySupportMessages())[0].messageId).toBe('m1');
  });
});

describe('support attachments', () => {
  const f = (name: string, size: number = 1000): { name: string; size: number } => ({ name, size });
  it('limits count, size and type', () => {
    expect(validateAttachments([f('a.jpg'), f('b.PNG'), f('c.heic'), f('d.webp'), f('e.pdf')])).toEqual([]);
    expect(validateAttachments([1, 2, 3, 4, 5, 6].map(i => f(`${i}.jpg`)))).toEqual(['Attach up to 5 files.']);
    expect(validateAttachments([f('big.pdf', MAX_ATTACHMENT_BYTES + 1)])[0]).toMatch(/smaller than 10 MB/);
    expect(validateAttachments([f('x.exe')])[0]).toMatch(/photo .* or a PDF/);
    expect(validateAttachments([f('empty.png', 0)])).toHaveLength(1);
  });
  it('sends in three steps (item marked Uploading, each file, clear the mark) and without files in one', async () => {
    const calls: string[] = [];
    const w: IIntakeWriter = {
      add: async (l, i) => { calls.push(`add ${l} ${String(i.Outcome)}`); return 4; },
      attach: async (l, id, name) => { calls.push(`attach ${id} ${name}`); },
      update: async (l, id, fields) => { calls.push(`update ${id} ${JSON.stringify(fields)}`); }
    };
    const s = src({}, [], w);
    const input = { facilityId: 'f1', category: 'Billing', subject: 'Invoice', body: 'See attached' };
    const file = (name: string): Blob & { name: string } => Object.assign(new Blob(['x']), { name });
    await s.submitSupportMessage(input, 'msg-1', undefined, [file('My photo.jpg'), file('My photo.jpg'), file('scan.pdf')]);
    expect(calls).toEqual([`add ${LISTS.supportMessages} Uploading`, 'attach 4 My-photo.jpg', 'attach 4 My-photo-2.jpg', 'attach 4 scan.pdf', 'update 4 {"Outcome":null}']);
    calls.length = 0;
    await s.submitSupportMessage(input, 'msg-2');
    expect(calls).toEqual([`add ${LISTS.supportMessages} undefined`]);
    await expect(s.submitSupportMessage(input, 'msg-3', undefined, [file('virus.exe')])).rejects.toThrow(/or a PDF/);
  });
  it('derives the ticket status', () => {
    const m = (o: object): IMySupportMessage => ({ id: 1, messageId: 'm', threadId: 't', category: 'Billing', subject: 's', body: 'b', ...o });
    expect(threadStatus(groupThreads([m({})])[0])).toBe('Open');
    expect(threadStatus(groupThreads([m({ reply: 'Hi', outcome: 'Answered' })])[0])).toBe('Answered');
    expect(threadStatus(groupThreads([m({ reply: 'Hi', outcome: 'Closed by Flavors' })])[0])).toBe('Closed');
    expect(threadStatus(groupThreads([m({ outcome: 'Archived by Flavors' })])[0])).toBe('Archived');
    expect(threadStatus(groupThreads([m({ outcome: 'Uploading' })])[0])).toBe('Uploading');
  });
});

describe('bookings mirror (A2)', () => {
  const own = { RequestId: 'req-1', FacilityId: 'f1', Space: 'Kitchen', StartUtc: '2026-12-01T14:00:00Z', EndUtc: '2026-12-01T16:00:00Z', Outcome: 'Approved' };
  const staff = { BookingId: 'staff-1', FacilityId: 'f1', Space: 'Kitchen', EquipmentIds: 'oven-1', StartUtc: '2026-11-30T14:00:00Z', EndUtc: '2026-11-30T16:00:00Z', Status: 'Approved', MemberId: 'a@b.co' };
  it('adds bookings staff made for the member to listMyRequests, own rows winning on the same id', async () => {
    const urls: string[] = [];
    const out = await src({ [LISTS.requests]: [own, { RequestId: 'req-9', FacilityId: 'f1', CancelBookingId: 'staff-1' }],
      [LISTS.myBookings]: [staff, { ...staff, BookingId: 'req-1', Status: 'Pending' }, { ...staff, BookingId: 'other', FacilityId: 'f2' }] }, urls).listMyRequests();
    expect(out.map(r => r.requestId)).toEqual(['staff-1', 'req-1']);
    expect(out[0]).toMatchObject({ status: 'Approved', equipmentIds: ['oven-1'], cancelSent: true });
    expect(urls.filter(u => u.indexOf(LISTS.myBookings) >= 0)[0]).toContain("MemberId eq 'a@b.co'");
  });
  it('is unchanged when the mirror is missing or there is no e-mail', async () => {
    expect((await src({ [LISTS.requests]: [own], [LISTS.myBookings]: new Error('404') }).listMyRequests()).map(r => r.requestId)).toEqual(['req-1']);
    const urls: string[] = [];
    await src({ [LISTS.requests]: [own] }, urls, undefined, '').listMyRequests();
    expect(urls.length).toBe(1);
  });
  it('merge helper de-duplicates mirror rows', () => {
    const r = (id: string): IMyRequest => ({ requestId: id, space: 'Kitchen', startUtc: 'a', endUtc: 'b', cancelSent: false, cancelRequested: false });
    expect(mergeMirrorBookings([r('a')], [r('a'), r('b'), r('b')]).map(x => x.requestId)).toEqual(['a', 'b']);
  });
});
