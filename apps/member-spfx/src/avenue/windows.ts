// Booking windows (client call 16 Nov 2026). Early entry and cleaning time are FREE: they are not booked hours and never
// block another booking (availability.ts and hoursPreview only ever see startUtc..endUtc). Pure, no I/O. Every number comes
// from the facility settings; an undefined setting means "no extra window" (never a default in code).

import type { IFacility } from './contracts';
import { localTime } from './calendar';

const MIN_MS: number = 60000;

/** The part of a booking this module needs (IMyRequest and the flows' AvenueBookings rows both fit). */
export interface IWindowBooking {
  startUtc: string;
  endUtc: string;
  /** Staff-corrected departure (AvenueBookings.ActualEndUtc). Billing only; the windows stay tied to the booked time. */
  actualEndUtc?: string;
}

export interface IBookingWindows {
  entryOpensUtc: string;
  startUtc: string;
  endUtc: string;
  cleanupEndsUtc: string;
}

export type BookingPhase = 'upcoming' | 'entry-open' | 'in-progress' | 'ending-soon' | 'cleanup' | 'done';

function minutes(n: number | undefined): number {
  return n !== undefined && n > 0 ? n : 0;
}

/**
 * entryOpens = start - earlyEntryMinutes, cleanupEnds = end + cleanupMinutes. Both are plain elapsed minutes, so a daylight-saving
 * change inside the window is handled (the window is 30 real minutes, the wall clock may jump). `_tz` is accepted for a uniform
 * call shape with the text helpers; it does not change the instants.
 */
export function bookingWindows(booking: IWindowBooking, facility: IFacility, _tz?: string): IBookingWindows {
  const s: number = Date.parse(booking.startUtc);
  const e: number = Date.parse(booking.endUtc);
  return {
    entryOpensUtc: new Date(s - minutes(facility.earlyEntryMinutes) * MIN_MS).toISOString(),
    startUtc: new Date(s).toISOString(),
    endUtc: new Date(e).toISOString(),
    cleanupEndsUtc: new Date(e + minutes(facility.cleanupMinutes) * MIN_MS).toISOString()
  };
}

/** Where `nowMs` falls. ending-soon starts checkoutAlertMinutes before the booked end (never when the setting is undefined). */
export function bookingPhase(booking: IWindowBooking, facility: IFacility, nowMs: number): BookingPhase {
  const w: IBookingWindows = bookingWindows(booking, facility);
  const alert: number = minutes(facility.checkoutAlertMinutes);
  const end: number = Date.parse(w.endUtc);
  if (nowMs < Date.parse(w.entryOpensUtc)) { return 'upcoming'; }
  if (nowMs < Date.parse(w.startUtc)) { return 'entry-open'; }
  if (nowMs < end - alert * MIN_MS) { return 'in-progress'; }
  if (nowMs < end) { return 'ending-soon'; }
  if (nowMs < Date.parse(w.cleanupEndsUtc)) { return 'cleanup'; }
  return 'done';
}

/** "2 h 10 min", "28 min", "3 h", "1 d 4 h". Rounds UP to the next minute so a countdown never shows 0 while time is left. */
export function durationText(ms: number): string {
  const total: number = Math.max(0, Math.ceil(ms / MIN_MS));
  if (total < 1) { return 'under a minute'; }
  const d: number = Math.floor(total / 1440);
  const h: number = Math.floor((total % 1440) / 60);
  const m: number = total % 60;
  if (d > 0) { return h > 0 ? `${d} d ${h} h` : `${d} d`; }
  if (h > 0) { return m > 0 ? `${h} h ${m} min` : `${h} h`; }
  return `${m} min`;
}

/** "starts in 2 h 10 min". Empty once the booking has started. */
export function startsInText(booking: IWindowBooking, nowMs: number): string {
  const ms: number = Date.parse(booking.startUtc) - nowMs;
  return ms > 0 ? `starts in ${durationText(ms)}` : '';
}

/** "ends in 28 min". Empty once the booked time is over. */
export function endsInText(booking: IWindowBooking, nowMs: number): string {
  const ms: number = Date.parse(booking.endUtc) - nowMs;
  return ms > 0 ? `ends in ${durationText(ms)}` : '';
}

/** "Leave by 5:30 PM" (the end of the cleaning window; the booked end when there is none). */
export function leaveByText(booking: IWindowBooking, facility: IFacility, tz: string = facility.timeZone): string {
  return `Leave by ${localTime(bookingWindows(booking, facility).cleanupEndsUtc, tz)}`;
}

export interface IReminderBooking extends IWindowBooking { status?: string }

/**
 * True when the "your booking ends soon, start cleaning" reminder should be sent (and the in-page banner shown): Approved
 * only, the setting is defined, nothing sent yet (`alreadySentIso` empty), and now is in [end - checkoutAlertMinutes, end).
 * "Exactly once" is the flow's job: it writes EndAlertSentAt BEFORE sending. [PROPOSED] reading: the alert is measured from the
 * booked end (client call 16 Nov: 20 or 30 minutes before checkout); the cleaning window follows the booked end.
 */
export function endReminderDue(booking: IReminderBooking, facility: IFacility, nowMs: number, alreadySentIso?: string): boolean {
  const alert: number | undefined = facility.checkoutAlertMinutes;
  if (booking.status !== 'Approved' || alert === undefined || !(alert > 0) || (alreadySentIso && alreadySentIso.trim() !== '')) { return false; }
  const end: number = Date.parse(booking.endUtc);
  return !isNaN(end) && nowMs >= end - alert * MIN_MS && nowMs < end;
}
