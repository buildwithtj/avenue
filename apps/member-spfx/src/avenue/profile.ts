// What the profile drawer shows, as plain data (see docs/PROFILE_DRAWER_PLAN.md). Pure: no React, no fetching, no invented values.
// Order is fixed: needs attention, at a glance, account destinations, getting started. A row is left out when its module is off or its data is unknown.

import type { DocType, IMyDocumentSubmission, IMyFlag, IMyMembership, IMyRequest } from './contracts';
import { actionItems, dateState, hoursSummary, newestPerType } from './home';
import { hoursThisMonth } from './booking';
import { onboarding, type IOnboarding } from './compliance';
import { dueInfo, monthlyCharge } from './payments';
import { formatCents, isOverdue } from './billing';
import type { TabKey } from '../webparts/avenuePortal/components/AvenuePortal';

export type Tone = 'ok' | 'warn' | 'bad' | 'muted';

export interface IProfileRow { key: string; label: string; detail?: string; tone?: Tone; target: TabKey }
export interface IGlance { key: 'hours' | 'payment' | 'balance'; label: string; value: string; note?: string; tone?: Tone }
export interface IProfileModel { attention: IProfileRow[]; glance: IGlance[]; account: IProfileRow[]; help: IProfileRow[]; onboarding?: IOnboarding }

export interface IProfileInput {
  membership?: IMyMembership;
  requests: IMyRequest[];
  documents: IMyDocumentSubmission[];
  flags: IMyFlag[];
  required: DocType[];
  timeZone: string;
  /** Facility-local YYYY-MM-DD. */
  todayYmd: string;
  now: Date;
  /** Whether a screen is in this release (the portal's tabOn). */
  on: (tab: TabKey) => boolean;
  /** Cents owed on open invoices, or 'not-connected' when the invoice list cannot be read. */
  balance: number | 'not-connected';
  /** Staff have answered the newest message of a conversation the member has not followed up (see support.ts). */
  replyWaiting?: boolean;
}

const MAX_ATTENTION = 3;

function nextBookingText(requests: IMyRequest[], now: Date): string | undefined {
  const next: IMyRequest | undefined = requests
    .filter(r => r.status === 'Approved' && Date.parse(r.startUtc) > now.getTime())
    .sort((a, b) => Date.parse(a.startUtc) - Date.parse(b.startUtc))[0];
  return next ? new Intl.DateTimeFormat('en-US', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(next.startUtc)) : undefined;
}

export function profileModel(i: IProfileInput): IProfileModel {
  const attention: IProfileRow[] = actionItems(i.documents, i.requests, i.todayYmd, i.flags, i.required)
    .filter(a => a.target === 'documents' ? i.on('documents') : i.on('bookings'))
    .sort((a, b) => rank(a.kind) - rank(b.kind))
    .slice(0, MAX_ATTENTION)
    .map(a => ({ key: a.key, label: a.title, detail: a.consequence, tone: (a.kind === 'compliance-hold' || a.kind === 'document-expired') ? 'bad' : 'warn', target: a.target } as IProfileRow));
  if (i.on('billing') && i.membership && isOverdue(i.membership.paymentStatus)) {
    attention.unshift({ key: 'payment-overdue', label: 'Payment overdue', detail: 'Bookings are paused until the payment is made.', tone: 'bad', target: 'billing' });
    attention.splice(MAX_ATTENTION);
  }

  const glance: IGlance[] = [];
  const m: IMyMembership | undefined = i.membership;
  if (i.on('bookings') || i.on('billing')) {
    const used: number = hoursThisMonth(i.requests, i.timeZone, i.now);
    const h = hoursSummary(used, m && m.monthlyHours);
    glance.push(h.allowance === undefined
      ? { key: 'hours', label: 'Hours this month', value: `${h.used} h`, note: 'Plan hours not set yet' }
      : { key: 'hours', label: 'Hours this month', value: h.over > 0 ? `${h.over} h over` : `${h.left} h left`, note: `${h.used} of ${h.allowance} h used`, tone: h.over > 0 ? 'bad' : 'ok' });
  }
  if (i.on('billing')) {
    const c = monthlyCharge(m && (m.planName || m.planId), m && m.payMethod);
    const d = m && m.collectionDay !== undefined ? dueInfo(m.collectionDay, i.todayYmd) : undefined;
    glance.push(c
      ? { key: 'payment', label: 'Next payment', value: formatCents(c.totalCents), note: d ? `Due ${new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(new Date(`${d.dueYmd}T12:00:00Z`))}` : 'Payment day not set' }
      : { key: 'payment', label: 'Next payment', value: 'Not set yet', note: 'Shown once Flavors confirms your plan', tone: 'muted' });
    glance.push(i.balance === 'not-connected'
      ? { key: 'balance', label: 'Balance due', value: 'Not available', note: 'Invoices could not be loaded', tone: 'muted' }
      : { key: 'balance', label: 'Balance due', value: formatCents(i.balance), tone: i.balance > 0 ? 'warn' : 'ok' });
  }

  const required: DocType[] = i.required;
  const latest = newestPerType(i.documents);
  const have: number = required.filter(t => { const d = latest.get(t); return !!d && dateState(d.expiryDate, i.todayYmd) !== 'expired'; }).length;
  const docsNeed: boolean = required.length > 0 && have < required.length;
  const next: string | undefined = nextBookingText(i.requests, i.now);
  const account: IProfileRow[] = [];
  const add = (tab: TabKey, row: Omit<IProfileRow, 'target'>): void => { if (i.on(tab)) { account.push({ ...row, target: tab }); } };
  add('membership', { key: 'membership', label: 'My membership', detail: m && m.planName ? `${m.planName}${m.collectionDay !== undefined ? ` · payment day ${m.collectionDay}` : ''}` : undefined });
  add('documents', { key: 'documents', label: 'Documents and compliance', detail: required.length > 0 ? `${have} of ${required.length} required on file` : undefined, tone: docsNeed ? 'warn' : undefined });
  add('billing', { key: 'billing', label: 'Billing and payments', detail: m && m.collectionDay !== undefined ? `Collected on day ${m.collectionDay}` : undefined });
  add('bookings', { key: 'bookings', label: 'My bookings', detail: next ? `Next: ${next}` : undefined });
  add('checkin', { key: 'checkin', label: 'Check in' });
  add('events', { key: 'events', label: 'Event request', detail: 'Dining room and private events' });
  add('storage', { key: 'storage', label: 'Storage', detail: 'Fridge, freezer and dry storage' });
  add('team', { key: 'team', label: 'My team', detail: 'Names for the wellness check' });
  const help: IProfileRow[] = [];
  if (i.on('support')) { help.push({ key: 'support', label: 'Messages with Flavors', detail: i.replyWaiting ? 'Reply received' : 'Ask a question or report a problem', tone: i.replyWaiting ? 'warn' : undefined, target: 'support' }); }

  const ob: IOnboarding | undefined = m && i.on('documents') ? onboarding(m, i.documents, required, i.todayYmd) : undefined;
  return { attention, glance, account, help, onboarding: ob && !ob.complete ? ob : undefined };
}

function rank(kind: string): number {
  return ({ 'compliance-hold': 0, 'document-expired': 1, 'compliance-info': 2, 'document-expiring': 3, 'onboarding-docs': 4, 'cancel-pending': 5 } as Record<string, number>)[kind] ?? 9;
}
