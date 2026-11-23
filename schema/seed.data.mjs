// Seed set for member-journey testing on the real Avenue site. PURE: builds records, writes nothing. Runner: schema/seed.browser.js.
// Every row's Title starts with "demo-", so cleanup finds exactly this set. Dates are facility-relative ("day +1 09:00" is tomorrow
// 09:00 in the facility's time zone whenever the seed is run). INVENTED values (names, 10 plan hours) are labelled "(sample)".
// No price is seeded (Q-04 open); billing in the portal is a labelled demo fixture until Stripe test mode is wired.
// E-mails use example.invalid (never deliverable, not a sign-in). The live flows trigger on item creation, so rows carry the flows'
// own "already handled" markers (DecisionNotified, OverlapNotified, NotifiedAt, AlertSentAt) and the seed writes only rows whose
// flows do not duplicate them: no AvenueCalendar, AvenueMyMembership, hours ledger or submission rows (flows create those).
export const PREFIX = 'demo-';

/** UTC ISO instant for a facility-local wall-clock time `dayOffset` days from `now`. */
export function zoned(now, dayOffset, hh, mm, tz) {
  const ymd = d => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const base = new Date(`${ymd(new Date(now))}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + dayOffset);
  const [y, mo, d] = base.toISOString().slice(0, 10).split('-').map(Number);
  let guess = Date.UTC(y, mo - 1, d, hh, mm);
  for (let i = 0; i < 3; i++) { // converge on the zone's offset (handles DST)
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(new Date(guess));
    const g = t => Number(parts.find(p => p.type === t).value);
    guess += Date.UTC(y, mo - 1, d, hh, mm) - Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'));
  }
  return new Date(guess).toISOString();
}

export const PERSONAS = {
  maple: { id: 'demo.maple@example.invalid', business: 'Sweet Maple Bakery (sample)', role: 'Eligible member: upcoming bookings, hours left, extension waiting' },
  harvest: { id: 'demo.harvest@example.invalid', business: 'Harvest Table Catering (sample)', role: 'Second member: privacy checks; overlaps the same slot' },
  green: { id: 'demo.green@example.invalid', business: 'Green Leaf Foods (sample)', role: 'Blocked member: expired permit' }
};

/** @returns {{list:string, key:string, fields:Record<string,unknown>}[]} */
export function buildSeed({ now = Date.now(), facilityId = 'flavors-hyattsville', tz = 'America/New_York' } = {}) {
  const t = (day, h, m = 0) => zoned(now, day, h, m, tz);
  const day = n => t(n, 12).slice(0, 10);
  const stamp = new Date(now).toISOString();
  const rows = [];
  const add = (list, key, fields) => rows.push({ list, key: PREFIX + key, fields: { Title: PREFIX + key, FacilityId: facilityId, ...fields } });
  const m = PERSONAS;

  for (const [k, kind] of [['oven', 'Equipment'], ['mixer', 'Equipment'], ['prep1', 'Prep table']]) add('AvenueEquipment', `eq-${k}`, { EquipmentId: `${PREFIX}${k}`, Kind: kind, Active: true });
  add('AvenuePlans', 'plan-std', { PlanId: `${PREFIX}plan-std`, MonthlyHours: 10, Active: true }); // 10 h is an INVENTED sample; no rate
  for (const [k, p] of Object.entries(m)) add('AvenueMembers', `member-${k}`, { MemberId: p.id, BusinessName: p.business, PlanId: `${PREFIX}plan-std`, CollectionDay: k === 'green' ? 15 : 1, Status: 'Active' });

  add('AvenueMemberDocuments', 'doc-maple', { MemberId: m.maple.id, DocType: 'Permit', IssueDate: day(-165), ExpiryDate: day(200), DocStatus: 'Current', Verified: true });
  add('AvenueMemberDocuments', 'doc-harvest', { MemberId: m.harvest.id, DocType: 'Permit', IssueDate: day(-165), ExpiryDate: day(200), DocStatus: 'Current', Verified: true });
  add('AvenueMemberDocuments', 'doc-green', { MemberId: m.green.id, DocType: 'Permit', IssueDate: day(-375), ExpiryDate: day(-10), DocStatus: 'Expired', Verified: true });

  // Bookings are fixtures for the staff console (the member portal reads a member's own requests). Flow markers prevent e-mails.
  const done = { DecisionNotified: 'Approved', OverlapNotified: 'seed', RequestedAt: t(-1, 10) };
  const booking = (k, who, status, d, h1, h2, extra = {}) => add('AvenueBookings', `bk-${k}`, { BookingId: `${PREFIX}bk-${k}`, MemberId: who.id, Space: 'Kitchen', EquipmentIds: `${PREFIX}oven`, StartUtc: t(d, h1), EndUtc: t(d, h2), Status: status, ...done, ...extra });
  booking('maple-next', m.maple, 'Approved', 1, 9, 13, { DecidedBy: 'demo-staff', DecidedAt: t(-1, 11) });
  booking('maple-ext', m.maple, 'Approved', 3, 9, 12, { ExtensionTo: t(3, 14), ExtensionRequestedAt: stamp, ExtensionRequestId: `${PREFIX}ext-1` });
  booking('harvest-pending', m.harvest, 'Pending', 1, 11, 15, { DecisionNotified: 'Pending', OverlapNote: 'Sample conflict: overlaps the Sweet Maple (sample) booking on the same equipment.' });

  add('AvenueCheckIns', 'chk-maple-fail', { BookingId: `${PREFIX}bk-maple-next`, MemberId: m.maple.id, Kind: 'Exit', Answers: JSON.stringify([{ q: 'Sample question: area left clean?', a: 'No' }]), AllPassed: false, SubmittedAt: t(-1, 18), SubmissionId: `${PREFIX}chk-1`, AlertSentAt: stamp });
  add('AvenueNotices', 'notice-published', { Body: 'Sample notice: the walk-in cooler will be serviced on a date Flavors will confirm.', PublishedAt: t(0, 7), Active: true, NotifiedAt: stamp });
  add('AvenueNoticeDrafts', 'notice-draft', { Body: 'Sample DRAFT: this must never be visible to members.', State: 'Draft' });
  return rows;
}
