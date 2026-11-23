// Member-facing wording for booking times, early entry, cleaning, the end-of-booking reminder, approval notes and error
// suggestions: ONE place, mirrored by the e-mail text in flows/PROPOSED_FLOW_CHANGES.md so wording never drifts. Our own
// words (not the old system's). Every function takes the facility settings and returns short plain text; where a setting is
// undefined the number is left out. No I/O.

import type { IFacility, IResource } from './contracts';
import { type ISelectionInput, type ISelectionResult, cookingUnits, nextFreeSlots, unitStatus } from './availability';
import { localTime } from './calendar';
import { type IWindowBooking, bookingWindows, durationText, endsInText, bookingPhase, leaveByText, startsInText } from './windows';

/** Cancellation notice agreed 11 Nov 2026 (BKG-09): free up to 24 hours before the start. */
export const CANCEL_NOTICE_HOURS: number = 24;

const set = (n: number | undefined): n is number => n !== undefined && n > 0;
export function minutesText(n: number): string {
  return n === 60 ? '1 hour' : n === 1 ? '1 minute' : `${n} minutes`;
}
const t = (iso: string, f: IFacility): string => localTime(iso, f.timeZone);

/** Short rule, e.g. "Enter 30 minutes early. Free." The long wording is in detailLines(). */
export function earlyEntryRule(f: IFacility): string {
  return set(f.earlyEntryMinutes) ? `Enter ${minutesText(f.earlyEntryMinutes)} early. Free.` : 'Your time starts when you arrive.';
}

/** For one booking: "Entry from 2:30 PM." (just the start when there is no early entry). */
export function earlyEntryLine(b: IWindowBooking, f: IFacility): string {
  const w = bookingWindows(b, f);
  return set(f.earlyEntryMinutes) ? `Entry from ${t(w.entryOpensUtc, f)}.` : `Starts at ${t(w.startUtc, f)}.`;
}

export function bookedTimeLine(b: IWindowBooking, f: IFacility): string {
  const mins: number = Math.round((Date.parse(b.endUtc) - Date.parse(b.startUtc)) / 60000);
  return `Booked ${t(b.startUtc, f)} to ${t(b.endUtc, f)} (${durationText(mins * 60000)}).`;
}

export function cleaningRule(f: IFacility): string {
  return set(f.cleanupMinutes) ? `${minutesText(f.cleanupMinutes)} to clean. Free.` : 'Finish cleaning by your end time.';
}

export function cleaningLine(b: IWindowBooking, f: IFacility): string {
  const w = bookingWindows(b, f);
  return set(f.cleanupMinutes) ? `Clean-up until ${t(w.cleanupEndsUtc, f)}, free.` : `Out by ${t(w.endUtc, f)}.`;
}

/** The three lines for a review sheet or detail view, in order. */
export function timeLines(b: IWindowBooking, f: IFacility): { early: string; booked: string; cleaning: string } {
  return { early: earlyEntryLine(b, f), booked: bookedTimeLine(b, f), cleaning: cleaningLine(b, f) };
}

/** One line about hours: cleaning and early entry never use hours. */
export function hoursNote(_f?: IFacility): string { return 'Only booked time uses hours.'; }

export function approvalNote(): string { return 'Flavors confirms by e-mail.'; }
export function noPaymentNote(): string { return 'Nothing is charged now.'; }
export function cancellationNote(): string { return `Free cancel up to ${CANCEL_NOTICE_HOURS} h before.`; }

/** The full wording, shown only inside an expandable "More details". */
export function detailLines(f: IFacility): string[] {
  return [
    set(f.earlyEntryMinutes) ? `You can come in ${minutesText(f.earlyEntryMinutes)} before your start time. It is free and not counted as booked time.` : 'Your booked time starts when you arrive.',
    set(f.cleanupMinutes) ? `You have ${minutesText(f.cleanupMinutes)} after your end time to clean. It is free and not counted as booked time.` : 'Please finish cleaning by your end time.',
    'Only your booked time uses hours. Need longer than your booked time? Ask for more time.',
    'Flavors reviews every request and confirms it by e-mail. Nothing is charged when you request a slot.',
    `You can cancel free up to ${CANCEL_NOTICE_HOURS} hours before the start. Closer than that, message Flavors and they will help.`
  ];
}

/** What the member sees when a request was auto-approved or is waiting (display only). */
export function waitingText(): string { return 'Waiting for approval'; }

// --- End-of-booking reminder (portal banner and e-mail) ---
export function endReminderSubject(b: IWindowBooking, f: IFacility): string {
  return `Your Flavors booking ends at ${t(b.endUtc, f)}`;
}

/** E-mail body text (portal link added by the flow). Mirrors the flow spec exactly. */
export function endReminderMessage(b: IWindowBooking, f: IFacility): string {
  const w = bookingWindows(b, f);
  const stay: string = set(f.cleanupMinutes) ? ` You can stay until ${t(w.cleanupEndsUtc, f)} for cleaning (not charged).` : '';
  return `Your booking ends at ${t(b.endUtc, f)}. Please start cleaning now.${stay} Need more time? Extend.`;
}

/** In-page banner while inside the reminder window: "Time to clean up. Ends in 28 min. Extend." */
export function endBannerText(b: IWindowBooking, f: IFacility, nowMs: number): string {
  const left: string = endsInText(b, nowMs);
  return left ? `Time to clean up. ${left[0].toUpperCase()}${left.slice(1)}. Extend.` : '';
}

/** One calm status line for a booking right now (Home hero). */
export function phaseLine(b: IWindowBooking, f: IFacility, nowMs: number): string {
  const up = (s: string): string => s ? s[0].toUpperCase() + s.slice(1) : s;
  switch (bookingPhase(b, f, nowMs)) {
    case 'upcoming': return up(startsInText(b, nowMs));
    case 'entry-open': return `You can come in now. Booked time starts at ${t(b.startUtc, f)}.`;
    case 'in-progress': return `In the kitchen until ${t(b.endUtc, f)}.`;
    case 'ending-soon': return `${up(endsInText(b, nowMs))}. Time to clean up.`;
    case 'cleanup': return `Cleaning time. ${leaveByText(b, f)}.`;
    default: return 'Finished.';
  }
}

// --- Error suggestions ---
const dayOfSlots = (iso: string, f: IFacility): string => t(iso, f);

/**
 * "Stove #1 is busy until 5:00 PM. Try 5:30 PM, or use Stove #2." for every unavailable unit of a validated selection,
 * built from the availability results. The time is the first start where that unit is free for the same length; the
 * alternatives are bookable units of the same category that are free in the window and not already chosen.
 */
export function conflictMessages(input: ISelectionInput, result: ISelectionResult): string[] {
  const f: IFacility = input.facility;
  const durationMin: number = (Date.parse(input.endUtc) - Date.parse(input.startUtc)) / 60000;
  const chosen: string[] = result.resolvedUnitIds;
  return result.unavailable.map(u => {
    const base: string = `${u.title} is busy until ${u.takenUntilUtc ? dayOfSlots(u.takenUntilUtc, f) : 'then'}.`;
    const unit: IResource | undefined = input.units.filter(x => x.resourceId === u.unitId)[0];
    const alts: string[] = unit
      ? cookingUnits(input.units).filter(x => x.resourceId !== u.unitId && chosen.indexOf(x.resourceId) < 0 && x.category === unit.category
          && unitStatus(x.resourceId, input.startUtc, input.endUtc, input.busy).free).slice(0, 2).map(x => x.title)
      : [];
    const slot: string | undefined = u.takenUntilUtc
      ? nextFreeSlots([u.unitId], durationMin, u.takenUntilUtc, input.busy, f.bookingStepMinutes || 30, 1)[0]
      : undefined;
    const parts: string[] = [];
    if (slot) { parts.push(`Try ${t(slot, f)}`); }
    if (alts.length > 0) { parts.push(`${slot ? 'or use' : 'Use'} ${alts.join(' or ')}${slot ? '' : ' instead'}`); }
    return parts.length === 0 ? `${base} Choose another time.` : `${base} ${parts.join(', ')}.`;
  });
}

/** All problems of a selection in our voice: conflict suggestions first, the other validation sentences unchanged. */
export function selectionMessages(input: ISelectionInput, result: ISelectionResult): string[] {
  const conflictTitles: string[] = result.unavailable.map(u => `${u.title} is booked until`);
  const others: string[] = result.problems.filter(p => !conflictTitles.some(c => p.indexOf(c) === 0));
  return conflictMessages(input, result).concat(others);
}

export function prepShortText(free: number, wanted: number): string {
  return free <= 0
    ? 'No prep tables are free then. Try another time.'
    : `Only ${free} of ${wanted} prep tables are free then. Try another time or fewer tables.`;
}

export function lengthText(f: IFacility, minutes: number): string {
  if (set(f.minBookingMinutes) && minutes < f.minBookingMinutes) { return `Make it at least ${minutesText(f.minBookingMinutes)} long.`; }
  if (set(f.maxBookingMinutes) && minutes > f.maxBookingMinutes) { return `Make it at most ${minutesText(f.maxBookingMinutes)} long, or send two requests.`; }
  return '';
}
