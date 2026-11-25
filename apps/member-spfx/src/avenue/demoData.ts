// DEVELOPMENT MOCK — NOT A VERIFIED INTEGRATION.
// Serves invented sample rows in the shape of SharePoint REST responses so the portal can be exercised without the
// tenant. Names, equipment, questions and notices are placeholders, not Flavors' data. The web part shows a
// "Demo data" banner whenever this is in use, and nothing written in demo mode leaves the browser tab.

import type { IIntakeWriter } from './contracts';
import { type FetchJson, LISTS } from './readSource';
import { DEMO_INVOICES } from './billing';

/** Demo member e-mail; matches the sample membership row. */
export const DEMO_MEMBER_EMAIL: string = 'demo.member@example.com';

export const DEMO_FACILITY_ID: string = 'demo-facility';

const HOUR_MS: number = 60 * 60 * 1000;

function at(daysFromToday: number, utcHour: number): string {
  const midnight: number = Date.parse(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
  return new Date(midnight + daysFromToday * 24 * HOUR_MS + utcHour * HOUR_MS).toISOString();
}

type Row = Record<string, unknown>;

/** Items "written" in demo mode, per list. Exported so tests can inspect them. */
export const demoStore: Record<string, Row[]> = {};

let nextId: number = 1;

// Sample team roster so the demo wellness check and My team screen have people; held in the store so Remove/Bring back work.
demoStore[LISTS.teamMembers] = [
  { Id: 9101, FacilityId: DEMO_FACILITY_ID, TeamMemberId: 'demo-t1', PersonName: 'Sample Lead', Role: 'Lead', Active: true },
  { Id: 9102, FacilityId: DEMO_FACILITY_ID, TeamMemberId: 'demo-t2', PersonName: 'Sample Cook', Role: 'Member', Active: true }
];

export const demoWriter: IIntakeWriter = {
  add: (list: string, item: Row) => {
    const id: number = nextId++;
    // The Stripe host is not reachable in demo mode: the "flow" answers at once and never returns a payment link.
    const echo: Row = list === LISTS.supportMessages ? { Outcome: 'Received. Flavors will reply here.' } : list === LISTS.eventRequests ? { Outcome: 'Received. Flavors will confirm the date and send the invoice.' } : list === LISTS.storageRequests ? { Outcome: 'Received. Flavors will confirm availability and the price.' } : list === LISTS.hostRequests ? { Outcome: 'Demo mode: no payment page opens and nothing is charged. In the live portal Stripe\'s secure page opens here.' } : {};
    (demoStore[list] = demoStore[list] || []).push({ ...item, ...echo, Id: id, Attachments: false, Created: new Date().toISOString() });
    return Promise.resolve(id);
  },
  update: (list: string, id: number, fields: Row) => {
    const row: Row | undefined = (demoStore[list] || []).filter(r => r.Id === id)[0];
    if (!row) {
      return Promise.reject(new Error('Demo item not found.'));
    }
    Object.keys(fields).forEach(k => { row[k] = fields[k]; });
    // Mimic the processing flows so the demo shows realistic outcomes.
    if (list === LISTS.documentSubmissions && row.Outcome === null) {
      row.Outcome = 'Received. Flavors will verify it.';
    }
    if (list === LISTS.supportMessages && row.Outcome === null) {
      row.Outcome = 'Received. Flavors will reply here.';
    }
    return Promise.resolve();
  },
  attach: (list: string, id: number) => {
    const row: Row | undefined = (demoStore[list] || []).filter(r => r.Id === id)[0];
    if (row) {
      row.Attachments = true;
    }
    return Promise.resolve();
  }
};

/** [EquipmentId, title, category, groupId]. Invented sample catalogue in the shape of the client's list (Q-B7 awaits the real one). */
const DEMO_EQUIPMENT: [string, string, string, string?][] = [
  ['stove-1', 'Stove #1', 'Stove'], ['stove-2', 'Stove #2', 'Stove'],
  ['grill-1', 'Flat Top Gas Grill #1', 'Grill'], ['grill-2', 'Flat Top Gas Grill #2', 'Grill'],
  ['oven-up', 'Convection Oven (Upper)', 'Oven', 'oven-1'], ['oven-low', 'Convection Oven (Lower)', 'Oven', 'oven-1'],
  ['warmer-1', 'Warming Holding Cabinet #1', 'Warmer'], ['warmer-2', 'Warming Holding Cabinet #2', 'Warmer'],
  ['pizza-up', 'Pizza Oven 1 (Upper)', 'Pizza oven', 'pizza-1'],
  ['prep-1', 'Prep table 1', 'Prep table'], ['prep-2', 'Prep table 2', 'Prep table'], ['prep-3', 'Prep table 3', 'Prep table'],
  ['prep-4', 'Prep table 4', 'Prep table'], ['prep-5', 'Prep table 5', 'Prep table'], ['prep-6', 'Prep table 6', 'Prep table'],
  ['mixer-1', 'Stand mixer', 'Mixer']
];

function rows(list: string): Row[] {
  const f: string = DEMO_FACILITY_ID;
  switch (list) {
    case LISTS.facilities:
      return [{ FacilityId: f, Title: 'Demo Kitchen (sample data)', TimeZone: 'America/New_York', EntryGraceMinutes: 30, ExitGraceMinutes: 30, CheckoutAlertMinutes: 30, MinPrepTables: 2 }];
    case LISTS.resources:
      return DEMO_EQUIPMENT.map(([id, title, category, group], i) => ({
        FacilityId: f, EquipmentId: id, Title: title, Kind: category === 'Prep table' ? 'Prep table' : 'Equipment', Category: category,
        SortOrder: i + 1, BookableByMembers: true, GroupId: group || null
      }));
    case LISTS.diningTables:
      return [
        { FacilityId: f, TableId: 'dt-1', Seats: 30 },
        { FacilityId: f, TableId: 'dt-2', Seats: 30 }
      ];
    case LISTS.calendar:
      return [
        // Two companies, same window, different equipment.
        { FacilityId: f, BookingId: 'demo-1', Space: 'Kitchen', EquipmentIds: 'stove-1;grill-1;prep-1;prep-2', MemberDisplayName: 'Sample Bakery', StartUtc: at(0, 14), EndUtc: at(0, 18) },
        { FacilityId: f, BookingId: 'demo-2', Space: 'Kitchen', EquipmentIds: 'oven-up;prep-3;prep-4', MemberDisplayName: 'Sample Catering', StartUtc: at(0, 15), EndUtc: at(0, 17) },
        // Starts exactly when demo-1 ends (touching, not a clash).
        { FacilityId: f, BookingId: 'demo-3', Space: 'Kitchen', EquipmentIds: 'stove-1;prep-1;prep-2', MemberDisplayName: 'Sample Tacos', StartUtc: at(0, 18), EndUtc: at(0, 20) },
        // Crosses midnight.
        { FacilityId: f, BookingId: 'demo-4', Space: 'Kitchen', EquipmentIds: 'pizza-up;prep-5;prep-6', MemberDisplayName: 'Sample Pizza', StartUtc: at(1, 22), EndUtc: at(2, 3) },
        { FacilityId: f, BookingId: 'demo-5', Space: 'Dining', EquipmentIds: '', MemberDisplayName: 'Sample Catering', StartUtc: at(3, 15), EndUtc: at(3, 21) },
        { FacilityId: f, BookingId: 'demo-6', Space: 'Whole facility', EquipmentIds: '', MemberDisplayName: 'Sample Events', StartUtc: at(5, 14), EndUtc: at(5, 22) },
        // Deliberately foreign row: the read path must drop it.
        { FacilityId: 'other-facility', BookingId: 'x-1', Space: 'Kitchen', MemberDisplayName: 'Must not appear', StartUtc: at(0, 14), EndUtc: at(0, 15) }
      ];
    case LISTS.requests:
      return [
        { FacilityId: f, RequestId: 'demo-r1', Space: 'Kitchen', StartUtc: at(2, 14), EndUtc: at(2, 17), Outcome: 'Approved' },
        { FacilityId: f, RequestId: 'demo-r2', Space: 'Dining', StartUtc: at(5, 16), EndUtc: at(5, 19), Outcome: 'Pending' },
        ...(demoStore[list] || [])
      ];
    case LISTS.myMembership:
      return [{ FacilityId: f, MemberId: DEMO_MEMBER_EMAIL, BusinessName: 'Sample Bakery', PlanId: 'demo-plan', CollectionDay: 5, Status: 'Active', PaymentStatus: 'Current', PayMethod: 'Card' }];
    case LISTS.invoices:
      return DEMO_INVOICES.filter(i => !i.isEstimate).map((i, n) => ({
        FacilityId: f, InvoiceId: i.invoiceId, MemberId: DEMO_MEMBER_EMAIL, Number: `DEMO-${n + 1}`, Kind: 'Membership', Status: i.status,
        AmountDueCents: i.amountDueCents, AmountPaidCents: i.amountPaidCents, DueDate: i.dueDate, PeriodStart: i.periodStart, PeriodEnd: i.periodEnd,
        Lines: JSON.stringify(i.lines)
      }));
    case LISTS.plans:
      return [{ FacilityId: f, PlanId: 'demo-plan', Title: 'Sample plan (Flavors will supply tiers)', MonthlyHours: 10, Active: true }];
    case LISTS.questions:
      return [
        { Id: 1, FacilityId: f, Kind: 'Entry', Question: 'Sample entry question 1 (Flavors will supply the real checklist)', SortOrder: 1 },
        { Id: 2, FacilityId: f, Kind: 'Entry', Question: 'Sample entry question 2', SortOrder: 2 },
        { Id: 3, FacilityId: f, Kind: 'Exit', Question: 'Sample exit question 1', SortOrder: 1 },
        { Id: 4, FacilityId: f, Kind: 'Wellness', Question: 'Sample wellness question 1 (Flavors will supply the real questions)', SortOrder: 1 },
        { Id: 5, FacilityId: f, Kind: 'Wellness', Question: 'Sample wellness question 2', SortOrder: 2 }
      ];
    case LISTS.notices:
      return [
        { Id: 1, FacilityId: f, Title: 'Sample notice', Body: 'Notices from Flavors appear here.', PublishedAt: at(-1, 15), Category: 'General', Pinned: false },
        { Id: 2, FacilityId: f, Title: 'Sample pinned maintenance notice', Body: 'Stove #2 is being serviced.', PublishedAt: at(-3, 15), Category: 'Maintenance', Pinned: true },
        { Id: 3, FacilityId: f, Title: 'Sample expired notice', Body: 'Must not appear.', PublishedAt: at(-9, 15), ExpiresAt: at(-2, 0) }
      ];
    case LISTS.supportMessages:
      return [
        { Id: 9001, FacilityId: f, MessageId: 'demo-sm1', ThreadId: 'demo-sm1', Category: 'Billing', Subject: 'Sample question about my invoice', Body: 'Sample message from the demo member.', Outcome: 'Received. Flavors will reply here.', Reply: 'Sample reply from Flavors: this is how an answer appears.' },
        ...(demoStore[list] || [])
      ];
    default:
      return demoStore[list] || [];
  }
}

export const demoFetchJson: FetchJson = (url: string) => {
  const match: RegExpMatchArray | null = /getbytitle\('([^']+)'\)/.exec(url);
  return Promise.resolve({ value: rows(match ? match[1] : '') });
};
