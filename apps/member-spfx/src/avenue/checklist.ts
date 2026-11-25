// Pure helpers for the member check-in screen. Rules stay as approved: a checklist is recorded only for the member's own
// APPROVED booking (the flow re-checks), the question set and pass criteria are Flavors' (Q-10), and no automatic consequence
// follows a "No" (CHK-05): staff see every answer. Nothing here invents a time window beyond the existing one
// (approved bookings from 12 h ago to 24 h ahead).

import type { CheckInKind, IChecklistQuestion, IFacility, IMyCheckIn, IMyRequest } from './contracts';
import { bookingWindows } from './windows';
import type { Answer } from './checkin';
import { dateParts } from './home';

const HOUR_MS: number = 60 * 60 * 1000;

/**
 * May a checklist of this kind be started now? Entry: from start - earlyEntryMinutes (0 when the setting is undefined) until the
 * cleaning window ends. Exit: from the start until the cleaning window ends (cleanupEndsUtc). Early entry and cleaning are free, not booked time.
 */
export function checklistAllowed(kind: CheckInKind, booking: IMyRequest, facility: IFacility, now: number): boolean {
  if (booking.status !== 'Approved') { return false; }
  const w = bookingWindows(booking, facility);
  const from: number = Date.parse(kind === 'Entry' ? w.entryOpensUtc : w.startUtc);
  return now >= from && now < Date.parse(w.cleanupEndsUtc);
}

/**
 * Approved bookings a checklist can sensibly be for, soonest first. Without `opts` the existing loose window applies
 * (12 h ago to 24 h ahead). With the facility (and optionally the kind) the booking windows decide: see checklistAllowed.
 */
export function eligibleBookings(bookings: IMyRequest[], now: number, opts?: { facility: IFacility; kind?: CheckInKind }): IMyRequest[] {
  const o = opts;
  return bookings
    .filter(b => o
      ? (o.kind ? checklistAllowed(o.kind, b, o.facility, now) : checklistAllowed('Entry', b, o.facility, now) || checklistAllowed('Exit', b, o.facility, now))
      : b.status === 'Approved' && Date.parse(b.endUtc) > now - 12 * HOUR_MS && Date.parse(b.startUtc) < now + 24 * HOUR_MS)
    .sort((a, b) => Date.parse(a.startUtc) - Date.parse(b.startUtc));
}

/** The booking to pre-select: one in progress, else the soonest. */
export function defaultBooking(eligible: IMyRequest[], now: number): IMyRequest | undefined {
  return eligible.filter(b => Date.parse(b.startUtc) <= now && Date.parse(b.endUtc) > now)[0] || eligible[0];
}

/** Suggest the checklist still to do for a booking. Only a suggestion: the member can switch. */
export function suggestKind(bookingId: string, history: IMyCheckIn[]): CheckInKind {
  const mine: IMyCheckIn[] = history.filter(h => h.bookingId === bookingId);
  const did = (k: CheckInKind): boolean => mine.some(h => h.kind === k);
  return did('Entry') && !did('Exit') ? 'Exit' : 'Entry';
}

export interface IProgress {
  answered: number;
  total: number;
  complete: boolean;
  noCount: number;
}

export function progress(questions: IChecklistQuestion[], answers: Record<number, Answer>): IProgress {
  const answered: number = questions.filter(q => answers[q.id] === 'Yes' || answers[q.id] === 'No').length;
  return { answered, total: questions.length, complete: questions.length > 0 && answered === questions.length, noCount: questions.filter(q => answers[q.id] === 'No').length };
}

export type RecordState = 'recording' | 'recorded' | 'not-recorded';

/** What the member sees for a sent checklist, from the flow's own Outcome text. */
export function recordState(item: IMyCheckIn | undefined): { state: RecordState; text: string } {
  const o: string = ((item && item.outcome) || '').trim();
  if (!item || !o) { return { state: 'recording', text: 'Being recorded…' }; }
  if (o.indexOf('Not recorded') === 0) { return { state: 'not-recorded', text: o }; }
  if (o.indexOf('Recorded') === 0 || o.indexOf('Already recorded') === 0) { return { state: 'recorded', text: o }; }
  return { state: 'recording', text: o };
}

const MIN_MS: number = 60 * 1000;

/**
 * Minutes left to check in, while the check-in window is open: from `earlyMin` before the start until `graceMin` after it
 * (sheet: 10-minute check-in grace). Undefined outside the window. Display only; the flows decide what is missed.
 */
export function checkInCountdown(startUtc: string, nowMs: number, earlyMin: number = 30, graceMin: number = 10): number | undefined {
  const start: number = Date.parse(startUtc);
  if (isNaN(start) || nowMs < start - earlyMin * MIN_MS || nowMs > start + graceMin * MIN_MS) { return undefined; }
  return Math.max(0, Math.ceil((start + graceMin * MIN_MS - nowMs) / MIN_MS));
}

/**
 * A1: what a sent checklist was for, without ids. The booking's date, time and equipment when the member can read it (own
 * request or the booking mirror); otherwise "Booking" and the day the checklist was sent.
 */
export function sentChecklistLabel(h: IMyCheckIn, booking: IMyRequest | undefined, timeZone: string): string {
  if (booking) {
    const p = dateParts(booking.startUtc, booking.endUtc, timeZone);
    const what: string = booking.equipmentIds && booking.equipmentIds.length > 0 ? booking.equipmentIds.join(', ') : booking.space;
    return `${p.weekday} ${p.month} ${p.day}, ${p.time} · ${what}`;
  }
  if (h.createdUtc && !isNaN(Date.parse(h.createdUtc))) {
    return `Booking · sent ${new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(h.createdUtc))}`;
  }
  return 'Booking';
}
