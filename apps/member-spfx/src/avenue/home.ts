// Pure logic behind the member Home screen: which booking is "next", what the member must do, and how to show dates.
// No React, no network, no clock except the `now` passed in. Rules here only restate approved ones:
// - an expired, unrenewed document blocks new bookings; only the Flavors owner can override (BKG-01 / CMP-02);
// - hours do not roll over and extra hours are billed with the next payment (D5, PAY-02).
// Nothing here decides a check-in window: that is Flavors' to set (Q-10), so "Check in" is offered only to a booking
// that has started and has not ended.

import type { IMyDocumentSubmission, IMyFlag, IMyRequest } from './contracts';

export type BookingPhase = 'in-progress' | 'upcoming' | 'waiting' | 'none';

export interface INextBooking {
  request: IMyRequest;
  phase: BookingPhase;
}

/** The booking that deserves the big card: one in progress, else the soonest approved, else the soonest waiting. */
export function pickNextBooking(requests: IMyRequest[], now: number): INextBooking | undefined {
  const live: IMyRequest[] = requests.filter(r => r.status !== 'Cancelled' && Date.parse(r.endUtc) > now);
  const byStart = (a: IMyRequest, b: IMyRequest): number => Date.parse(a.startUtc) - Date.parse(b.startUtc);
  const approved: IMyRequest[] = live.filter(r => r.status === 'Approved').sort(byStart);
  const running: IMyRequest | undefined = approved.find(r => Date.parse(r.startUtc) <= now);
  if (running) { return { request: running, phase: 'in-progress' }; }
  if (approved[0]) { return { request: approved[0], phase: 'upcoming' }; }
  const waiting: IMyRequest | undefined = live.filter(r => r.status === 'Pending' || !r.status).sort(byStart)[0];
  return waiting ? { request: waiting, phase: 'waiting' } : undefined;
}

export type ActionKind = 'onboarding-docs' | 'document-expired' | 'document-expiring' | 'cancel-pending' | 'compliance-hold' | 'compliance-info';

export interface IActionItem {
  kind: ActionKind;
  /** Short headline, e.g. "Your Permit expired on 1 Nov 2026". */
  title: string;
  /** What this prevents or why it matters. */
  consequence: string;
  /** What to do next. */
  howTo: string;
  /** Where the member goes to fix it. */
  target: 'documents' | 'bookings';
  key: string;
}

const DAY_MS: number = 24 * 60 * 60 * 1000;

function dayLabel(ymd: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${ymd}T12:00:00Z`));
}

/**
 * Things the member must act on. Only the newest submission per document type counts, so a renewal that is
 * uploaded (even if still awaiting review) replaces the old expiry in this list rather than leaving a stale warning.
 * `todayYmd` is the facility-local date (YYYY-MM-DD).
 */
/** Newest submission per type. A failed upload (Outcome still "Uploading") never hides a real document of the same type. */
export function newestPerType(documents: IMyDocumentSubmission[]): Map<string, IMyDocumentSubmission> {
  const latest = new Map<string, IMyDocumentSubmission>();
  for (const d of documents) {
    const have: IMyDocumentSubmission | undefined = latest.get(d.docType);
    const dUp: boolean = d.outcome === 'Uploading';
    const haveUp: boolean = !!have && have.outcome === 'Uploading';
    if (!have || (haveUp && !dUp) || (haveUp === dUp && d.expiryDate > have.expiryDate)) { latest.set(d.docType, d); }
  }
  return latest;
}

export function actionItems(documents: IMyDocumentSubmission[], requests: IMyRequest[], todayYmd: string, flags: IMyFlag[] = [], required: string[] = []): IActionItem[] {
  const out: IActionItem[] = [];
  const have: Map<string, IMyDocumentSubmission> = newestPerType(documents);
  const neverSent: string[] = required.filter(t => !have.get(t));
  if (neverSent.length > 0) {
    out.push({ kind: 'onboarding-docs', key: 'onboarding-docs', target: 'documents', title: `Finish setting up: ${neverSent.length} required document${neverSent.length === 1 ? '' : 's'} to send`, consequence: 'Flavors needs these on file for your membership.', howTo: `Still needed: ${neverSent.join(', ')}. Answer one question per document on the Documents page.` });
  }
  // Newest flag per document decides (same rule as compliance.hasHold; kept here so home.ts does not import compliance.ts).
  const seenFlag: Record<string, boolean> = {};
  flags.forEach(f => {
    if (seenFlag[f.docType]) { return; }
    seenFlag[f.docType] = true;
    const o: string = (f.outcome || '').trim();
    if (o.indexOf('Booking hold') === 0) {
      out.push({ kind: 'compliance-hold', key: `flag-${f.submissionId}`, target: 'documents', title: `Bookings are paused: ${f.docType} under review`, consequence: 'You cannot request new bookings until Flavors releases the hold.', howTo: o });
    } else if (o.indexOf('More information') === 0) {
      out.push({ kind: 'compliance-info', key: `flag-${f.submissionId}`, target: 'documents', title: `Flavors needs more about your ${f.docType}`, consequence: 'Your case stays open until you answer.', howTo: o });
    }
  });
  const latest: Map<string, IMyDocumentSubmission> = newestPerType(documents);
  const soon: string = new Date(Date.parse(`${todayYmd}T12:00:00Z`) + 30 * DAY_MS).toISOString().slice(0, 10);
  latest.forEach(d => {
    // A type Flavors no longer requires (e.g. a legacy "Licence") only matters once it has expired, because the booking check
    // still counts expired documents; its "expires soon" note is not shown, so Home, Documents and Profile agree.
    if (required.length > 0 && required.indexOf(d.docType) < 0 && d.expiryDate >= todayYmd) { return; }
    if (d.expiryDate < todayYmd) {
      out.push({
        kind: 'document-expired', key: `doc-${d.submissionId}`, target: 'documents',
        title: `Your ${d.docType} expired on ${dayLabel(d.expiryDate)}`,
        consequence: 'You cannot book kitchen time until a current one is on file. Only the Flavors owner can make an exception.',
        howTo: 'Upload the renewed document. Flavors will then verify it.'
      });
    } else if (d.expiryDate < soon) {
      out.push({
        kind: 'document-expiring', key: `doc-${d.submissionId}`, target: 'documents',
        title: `Your ${d.docType} expires on ${dayLabel(d.expiryDate)}`,
        consequence: 'Once it expires you will not be able to book until it is renewed.',
        howTo: 'Upload the renewal before then.'
      });
    }
  });
  for (const r of requests) {
    if (r.cancelRequested && r.status !== 'Cancelled') {
      out.push({
        kind: 'cancel-pending', key: `cancel-${r.requestId}`, target: 'bookings',
        title: 'Your cancellation is waiting for Flavors',
        consequence: 'Cancellations under 24 hours need management approval.',
        howTo: 'Nothing to do. The result appears here.'
      });
    }
  }
  return out.sort((a, b) => rank(a.kind) - rank(b.kind));
}

function rank(k: ActionKind): number {
  return k === 'document-expired' ? 0 : k === 'cancel-pending' ? 1 : 2;
}

/** True when the member has an expired document with no renewal, which blocks new bookings. */
export function isBookingBlocked(items: IActionItem[]): boolean {
  return items.some(i => i.kind === 'document-expired');
}

export interface IDateParts {
  weekday: string;
  day: string;
  month: string;
  /** "9:00 AM - 1:00 PM" in the facility's time zone. */
  time: string;
}

/** Date treatment for the booking card, in the facility's time zone (never the phone's). */
export function dateParts(startUtc: string, endUtc: string, timeZone: string): IDateParts {
  const f = (o: Intl.DateTimeFormatOptions, iso: string): string => new Intl.DateTimeFormat('en-US', { timeZone, ...o }).format(new Date(iso));
  return {
    weekday: f({ weekday: 'short' }, startUtc),
    day: f({ day: 'numeric' }, startUtc),
    month: f({ month: 'short' }, startUtc),
    time: `${f({ hour: 'numeric', minute: '2-digit' }, startUtc)} - ${f({ hour: 'numeric', minute: '2-digit' }, endUtc)}`
  };
}

/** "Today", "Tomorrow", "In 3 days" relative to the facility-local calendar day. */
export function relativeDay(startUtc: string, nowMs: number, timeZone: string): string {
  const ymd = (ms: number): string => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
  const days: number = Math.round((Date.parse(`${ymd(Date.parse(startUtc))}T00:00:00Z`) - Date.parse(`${ymd(nowMs)}T00:00:00Z`)) / DAY_MS);
  if (days <= 0) { return 'Today'; }
  if (days === 1) { return 'Tomorrow'; }
  return `In ${days} days`;
}

export interface IHoursSummary {
  used: number;
  allowance?: number;
  /** Hours left, never negative. Undefined when the allowance is unknown. */
  left?: number;
  /** Hours over the allowance (an estimate; the invoice is final). */
  over: number;
  /** 0..1 */
  fraction: number;
}

const r1 = (n: number): number => Math.round(n * 10) / 10;

export function hoursSummary(used: number, allowance: number | undefined): IHoursSummary {
  if (allowance === undefined || !isFinite(allowance) || allowance <= 0) {
    return { used: r1(used), over: 0, fraction: 0 };
  }
  return { used: r1(used), allowance, left: Math.max(0, r1(allowance - used)), over: Math.max(0, r1(used - allowance)), fraction: Math.min(1, used / allowance) };
}

export type ReviewState = 'uploading' | 'received' | 'not-accepted' | 'processing';
export type DateState = 'expired' | 'expiring' | 'current';

export interface IDocumentCard {
  submission: IMyDocumentSubmission;
  dateState: DateState;
  review: ReviewState;
  /** Flavors' own words when a document was not accepted. */
  reviewNote?: string;
}

/**
 * What the member may be told about a document. The flow writes "Received. Flavors will verify it." when it registers the file;
 * whether Flavors has VERIFIED it is kept in a private list the member cannot read, so "verified" is never shown here.
 */
export function reviewState(outcome: string | undefined): { review: ReviewState; note?: string } {
  const o: string = (outcome || '').trim();
  if (o === 'Uploading') { return { review: 'uploading' }; }
  if (o.indexOf('Not accepted') === 0) { return { review: 'not-accepted', note: o }; }
  if (o.indexOf('Received') === 0 || o.indexOf('Already received') === 0) { return { review: 'received' }; }
  return { review: 'processing' };
}

export function dateState(expiryYmd: string, todayYmd: string): DateState {
  if (expiryYmd < todayYmd) { return 'expired'; }
  const soon: string = new Date(Date.parse(`${todayYmd}T12:00:00Z`) + 30 * DAY_MS).toISOString().slice(0, 10);
  return expiryYmd < soon ? 'expiring' : 'current';
}

/** The newest submission per document type, as cards, most urgent first; older ones are history. */
export function documentCards(documents: IMyDocumentSubmission[], todayYmd: string): { current: IDocumentCard[]; history: IMyDocumentSubmission[] } {
  const latest: Map<string, IMyDocumentSubmission> = newestPerType(documents);
  const order: Record<DateState, number> = { expired: 0, expiring: 1, current: 2 };
  const current: IDocumentCard[] = [];
  latest.forEach(d => {
    const r = reviewState(d.outcome);
    current.push({ submission: d, dateState: dateState(d.expiryDate, todayYmd), review: r.review, reviewNote: r.note });
  });
  current.sort((a, b) => order[a.dateState] - order[b.dateState] || a.submission.docType.localeCompare(b.submission.docType));
  const keep = new Set(current.map(c => c.submission.submissionId));
  const history: IMyDocumentSubmission[] = documents.filter(d => !keep.has(d.submissionId)).sort((a, b) => b.expiryDate.localeCompare(a.expiryDate));
  return { current, history };
}

/** "Today", "Tomorrow", or "Mon 16 Nov" for a facility-local YYYY-MM-DD, relative to the facility-local today. */
export function facilityDayLabel(ymd: string, todayYmd: string): string {
  const diff: number = Math.round((Date.parse(`${ymd}T00:00:00Z`) - Date.parse(`${todayYmd}T00:00:00Z`)) / DAY_MS);
  if (diff === 0) { return 'Today'; }
  if (diff === 1) { return 'Tomorrow'; }
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${ymd}T12:00:00Z`));
}
