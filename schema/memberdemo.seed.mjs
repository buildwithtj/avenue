// [PROPOSED] Complete demo data for ONE member (the signed-in tester) so every member-portal page has something to show.
// PURE: builds records, writes nothing. Runner: schema/memberdemo.browser.js. Every row has a Title starting "demo-md-" (or a flow-made
// row keyed by an id starting "demo-md-"), so cleanup finds exactly this set. All values are SAMPLES, never client-approved:
// the client's real checklist questions are still open (Q-10), so each question text starts "Sample:". Money values are sample figures.
// Flow safety: only lists whose flows send no e-mail are written. No BookingRequests, CheckInSubmissions or DocumentSubmissions rows
// (their flows would create real bookings/records); bookings use the member-visible mirror plus one AvenueBookings row that carries the
// flows' own "already handled" markers (same as schema/seed.data.mjs).
export const MD = 'demo-md-';

export function zoned(now, dayOffset, hh, mm) { // UTC instant; the portal shows it in the facility zone, a small DST error is harmless for samples
  const d = new Date(now); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() + dayOffset); d.setUTCHours(hh, mm, 0, 0); return d.toISOString();
}

const ENTRY = ['Have you washed your hands and put on clean outerwear?', 'Is your work area free of food from the last member?', 'Are the floors and prep tables clean and dry?', 'Is the equipment you booked working?', 'Have you read the posted safety instructions?', 'Are cleaning supplies and sanitiser available?'];
const EXIT = ['Is all equipment you used switched off?', 'Are your work surfaces and equipment cleaned and sanitised?', 'Is your food labelled, dated and stored in your own space?', 'Is the floor swept and the trash taken out?', 'Is every item returned to where you found it?', 'Is the door locked behind you?'];
const WELLNESS = ['Are you free of vomiting or diarrhoea in the last 48 hours?', 'Are you free of fever or a sore throat with fever?', 'Are you free of jaundice (yellow skin or eyes)?', 'Are you free of open cuts or sores on your hands?', 'Have you washed your hands before starting?'];

/** @returns {{list:string, key:string, fields:Record<string,unknown>, after?:string}[]} */
export function buildMemberDemo({ email, now = Date.now(), facilityId = 'flavors-hyattsville' } = {}) {
  if (!/^[^@\s]+@[^@\s]+$/.test(email || '')) throw new Error('memberdemo: give the tester e-mail');
  const me = email.toLowerCase();
  const rows = [];
  const add = (list, key, fields) => rows.push({ list, key: MD + key, fields: { Title: MD + key, FacilityId: facilityId, ...fields } });
  const at = (d, h, m = 0) => zoned(now, d, h, m);
  const day = d => at(d, 12).slice(0, 10);

  // Checklist questions (clearly sample). SortOrder starts at 10 so the 4 earlier "DEMO ONLY" rows stay first.
  [['Entry', ENTRY], ['Exit', EXIT], ['Wellness', WELLNESS]].forEach(([kind, qs]) => qs.forEach((q, i) =>
    add('AvenueChecklistQuestions', `q-${kind.toLowerCase()}-${i + 1}`, { Kind: kind, Question: `Sample: ${q}`, SortOrder: 10 + i * 10, Active: true })));

  // Compliance: one document per required type in varied states. "Food handler card" is left out on purpose (shows Missing).
  const docs = [
    ['County food permit', -300, 65, 'Current', true], ['MD good standing', -340, 25, 'Current', true], ['Liability insurance', -355, 10, 'Current', true],
    ['Workers comp or waiver', -380, -12, 'Expired', true], ['Food safety manager', -60, 15, 'Current', true], ['Food manager card', -2, 700, 'Received', false]
  ];
  docs.forEach(([type, issue, expiry, status, verified], i) => add('AvenueMyDocuments', `doc-${i + 1}`,
    { DocKey: `${MD}doc-${i + 1}`, MemberId: me, DocType: type, IssueDate: day(issue), ExpiryDate: day(expiry), Status: status, Verified: verified }));

  // Bookings: mirror rows (member-visible, flow-free). One Approved booking opens its entry window now (starts in 20 min) so Check in works.
  const bk = (k, status, d, h1, m1, h2, m2, eq) => add('AvenueMyBookings', `bk-${k}`, { BookingId: `${MD}bk-${k}`, MemberId: me, Space: 'Kitchen', EquipmentIds: eq, StartUtc: at(d, h1, m1), EndUtc: at(d, h2, m2), Status: status });
  const soon = new Date(now + 20 * 60000), end = new Date(now + 200 * 60000);
  rows.push({ list: 'AvenueMyBookings', key: `${MD}bk-now`, fields: { Title: `${MD}bk-now`, FacilityId: facilityId, BookingId: `${MD}bk-now`, MemberId: me, Space: 'Kitchen', EquipmentIds: 'Gas Stove w/Under Oven #1;Prep table 1', StartUtc: soon.toISOString(), EndUtc: end.toISOString(), Status: 'Approved' } });
  bk('past-1', 'Approved', -3, 9, 0, 13, 0, 'Convection Oven (Upper);Prep table 2');
  bk('past-2', 'No-show credited', -9, 14, 0, 17, 0, 'Flat Top Gas Grill #1');
  bk('past-3', 'Declined', -6, 8, 0, 10, 0, 'Gas Stove w/Under Oven #2');
  bk('pending', 'Pending', 4, 10, 0, 14, 0, 'Convection Oven (Lower);Prep table 1');
  bk('cancelled', 'Cancelled', 6, 9, 0, 12, 0, 'Flat Top Gas Grill #2');
  // The matching private booking (Approved, flow markers set so no mail goes out) lets the check-in flow record a real submission.
  add('AvenueBookings', 'bk-now', { BookingId: `${MD}bk-now`, MemberId: me, Space: 'Kitchen', EquipmentIds: 'Gas Stove w/Under Oven #1;Prep table 1', StartUtc: soon.toISOString(), EndUtc: end.toISOString(), Status: 'Approved', DecisionNotified: 'Approved', OverlapNotified: 'seed', RequestedAt: at(-1, 10), DecidedBy: 'demo-staff', DecidedAt: at(-1, 11) });

  // Hours mirror (display only), current and last month.
  const period = o => { const d = new Date(now); d.setUTCMonth(d.getUTCMonth() + o, 1); return d.toISOString().slice(0, 7); };
  add('AvenueMyHours', 'hours-0', { HoursKey: `${me}|${period(0)}`, MemberId: me, Period: period(0), UsedHours: 6.5, AllowanceHours: 10, ExtraHours: 0 });
  add('AvenueMyHours', 'hours-1', { HoursKey: `${me}|${period(-1)}`, MemberId: me, Period: period(-1), UsedHours: 12, AllowanceHours: 10, ExtraHours: 2 });

  // Invoices (sample figures, labelled in the line text).
  const inv = (k, kind, status, due, paid, lines, d0, d1) => add('AvenueInvoices', `inv-${k}`, { InvoiceId: `${MD}inv-${k}`, MemberId: me, Number: `DEMO-${k}`, Kind: kind, Status: status, AmountDueCents: due, AmountPaidCents: paid, Currency: 'usd', DueDate: at(d1, 12), PeriodStart: at(d0, 12), PeriodEnd: at(d1, 12), Lines: JSON.stringify(lines) });
  inv('1', 'Membership', 'paid', 30000, 30000, [{ description: 'Membership (sample amount)', amountCents: 30000 }], -60, -30);
  inv('2', 'Overage', 'paid', 5000, 5000, [{ description: 'Extra hours, 2 h (sample amount)', amountCents: 5000 }], -45, -30);
  inv('3', 'Membership', 'open', 30000, 0, [{ description: 'Membership (sample amount)', amountCents: 30000 }], -2, 5);

  // Notices (NotifiedAt set so the notice e-mail flow stays quiet).
  add('AvenueNotices', 'notice-1', { Body: 'Sample notice: the walk-in cooler is serviced on Thursday morning; please keep the door closed.', PublishedAt: at(-1, 9), Active: true, NotifiedAt: at(-1, 9), Category: 'Maintenance', Pinned: true });
  add('AvenueNotices', 'notice-2', { Body: 'Sample notice: the dining room is reserved for a private event on Saturday.', PublishedAt: at(-2, 15), Active: true, NotifiedAt: at(-2, 15), Category: 'Schedule' });
  add('AvenueNotices', 'notice-3', { Body: 'Sample notice (expires in 12 hours): water will be off from 10 pm tonight.', PublishedAt: at(0, 6), Active: true, NotifiedAt: at(0, 6), Category: 'Urgent', ExpiresAt: new Date(now + 12 * 3600000).toISOString() });

  // Team roster.
  [['Lead', 'Sample Lead'], ['Member', 'Sample Cook A'], ['Member', 'Sample Cook B']].forEach(([role, name], i) =>
    add('AvenueTeamMembers', `team-${i + 1}`, { TeamMemberId: `${MD}team-${i + 1}`, PersonName: name, Role: role, Active: true }));

  // Own-item intake rows whose flows only create a case and echo an outcome (no e-mail): support, event, storage.
  add('AvenueSupportMessages', 'msg-1', { MessageId: `${MD}msg-1`, Category: 'Equipment', Subject: 'Sample: oven door seal', Body: 'Sample message: the lower oven door does not close fully.' });
  add('AvenueEventRequests', 'evt-1', { RequestId: `${MD}evt-1`, Package: 'Simplicity', EventDate: at(30, 17), Guests: 24, Notes: 'Sample event request.' });
  add('AvenueStorageRequests', 'sto-1', { RequestId: `${MD}sto-1`, Item: 'Half-door fridge', Quantity: 1, Notes: 'Sample storage request.' });
  return rows;
}

/** Where cleanup looks, per list: Title prefix always, plus the key field of rows a flow makes from the above. */
export const CLEANUP = {
  AvenueChecklistQuestions: 'Title', AvenueMyDocuments: 'Title', AvenueMyBookings: 'Title', AvenueBookings: 'Title', AvenueMyHours: 'Title', AvenueInvoices: 'Title',
  AvenueNotices: 'Title', AvenueTeamMembers: 'Title', AvenueSupportMessages: 'Title', AvenueEventRequests: 'Title', AvenueStorageRequests: 'Title',
  AvenueSupportCases: 'CaseId', AvenueEventCases: 'RequestId', AvenueStorageCases: 'RequestId', AvenueCalendar: 'BookingId', AvenueHoursLedger: 'BookingId'
};
