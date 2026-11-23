// Pure rules for a member's booking REQUEST. Nothing here approves anything: the client decided on 11 Nov 2026
// that management reviews and approves every booking, and judges overlaps mainly by equipment.
// Only rules the client stated or that are logically necessary are enforced. No minimum or maximum duration,
// no lead time and no hour limits are invented.

import type { IBookingRequestInput, ICalendarEntry, IMyExtension, IMyRequest } from './contracts';
import { localDay } from './calendar';

export interface IRequestContext {
  /** EquipmentIds in the facility catalog. */
  equipmentIds: string[];
  /** Total dining seats from the dining tables list, when known. */
  totalSeats?: number;
  nowMs: number;
}

export function validateRequest(input: IBookingRequestInput, ctx: IRequestContext): string[] {
  const errors: string[] = [];
  const start: number = Date.parse(input.startUtc);
  const end: number = Date.parse(input.endUtc);
  if (isNaN(start) || isNaN(end)) {
    errors.push('Choose a valid start and end time.');
  } else {
    if (end <= start) {
      errors.push('The end time must be after the start time.');
    }
    if (start < ctx.nowMs) {
      errors.push('The start time is in the past.');
    }
  }
  const unknown: string[] = input.equipmentIds.filter(id => ctx.equipmentIds.indexOf(id) < 0);
  if (unknown.length > 0) {
    errors.push('Some of the equipment you chose is not available to book.');
  }
  if (input.space === 'Kitchen' && input.equipmentIds.length === 0) {
    errors.push('Choose the equipment you need. Bookings are made by equipment.');
  }
  if (input.space === 'Whole facility' && input.equipmentIds.length > 0) {
    errors.push('A private event books the whole facility, so no equipment is chosen.');
  }
  if (input.space === 'Dining') {
    const people: number | undefined = input.peopleCount;
    if (people === undefined || !(people >= 1) || Math.floor(people) !== people) {
      errors.push('Enter how many people are coming.');
    } else if (ctx.totalSeats !== undefined && people > ctx.totalSeats) {
      errors.push(`The dining room seats ${ctx.totalSeats}.`);
    }
  }
  return errors;
}

export type Hint = { kind: 'whole-facility'; entry: ICalendarEntry } | { kind: 'equipment'; entry: ICalendarEntry; equipmentIds: string[] };

/**
 * Existing approved bookings that touch the same time. These are hints shown to the member and to management; they
 * do not block the request, because management may approve an overlap (for example light use of one machine).
 * Dining bookings share the room, so two dining bookings are not an overlap (how many people the room allows is Q-22).
 */
export function overlapHints(input: IBookingRequestInput, entries: ICalendarEntry[]): Hint[] {
  const start: number = Date.parse(input.startUtc);
  const end: number = Date.parse(input.endUtc);
  if (isNaN(start) || isNaN(end) || end <= start) {
    return [];
  }
  const hints: Hint[] = [];
  for (const e of entries) {
    if (!(Date.parse(e.startUtc) < end && start < Date.parse(e.endUtc))) {
      continue;
    }
    if (e.space === 'Whole facility' || input.space === 'Whole facility') {
      hints.push({ kind: 'whole-facility', entry: e });
      continue;
    }
    const shared: string[] = input.equipmentIds.filter(id => e.equipmentIds.indexOf(id) >= 0);
    if (shared.length > 0) {
      hints.push({ kind: 'equipment', entry: e, equipmentIds: shared });
    }
  }
  return hints;
}

/** The SharePoint item written to AvenueBookingRequests. There is deliberately no member identifier. */
export function toIntakeItem(input: IBookingRequestInput, requestId: string): Record<string, unknown> {
  const item: Record<string, unknown> = {
    Title: `${input.space} request`,
    FacilityId: input.facilityId,
    RequestId: requestId,
    Space: input.space,
    EquipmentIds: input.equipmentIds.join(';'),
    StartUtc: input.startUtc,
    EndUtc: input.endUtc
  };
  if (input.space === 'Dining' && input.peopleCount !== undefined) {
    item.PeopleCount = input.peopleCount;
  }
  return item;
}

const DAY_MS: number = 24 * 60 * 60 * 1000;

/**
 * Client rule (call 11 Nov): 24 hours or more ahead the member cancels and hours return; under 24 hours the member
 * messages management instead. This is a convenience for the screen: the cancellation flow enforces the same rule.
 */
export function canSelfCancel(startUtc: string, nowMs: number): boolean {
  const start: number = Date.parse(startUtc);
  return !isNaN(start) && start - nowMs >= DAY_MS;
}

/** The intake item for a cancellation (or, under 24 hours, a message to management). Names the booking only; no member field. */
export function toCancelItem(facilityId: string, requestId: string, cancelBookingId: string, message?: string): Record<string, unknown> {
  const item: Record<string, unknown> = { Title: 'Cancel request', FacilityId: facilityId, RequestId: requestId, CancelBookingId: cancelBookingId };
  // A late (under 24 h) request can carry a message for staff; display only, no flow reads it.
  const m: string = (message || '').trim().slice(0, 500);
  if (m) { item.Message = m; }
  return item;
}

/**
 * Hours the member's approved bookings use in the current month, in the facility's time zone. Display only: the hours
 * ledger written by Avenue's flow is the record (call 11 Nov: hours count only for approved time in the facility).
 */
export function hoursThisMonth(requests: IMyRequest[], timeZone: string, now: Date): number {
  const month: string = localDay(now, timeZone).slice(0, 7);
  const ms: number = requests
    .filter(r => (r.status === 'Approved' || r.hoursKept) && localDay(r.startUtc, timeZone).slice(0, 7) === month)
    .reduce((sum, r) => sum + Math.max(0, Date.parse(r.endUtc) - Date.parse(r.startUtc)), 0);
  return Math.round(ms / 360000) / 10;
}

/** True while an extra-time request is waiting for Flavors (sent, or echoed back as requested). */
export function extensionWaiting(ext: IMyExtension | undefined): boolean {
  return !!ext && (!ext.outcome || ext.outcome.indexOf('Extension requested') === 0);
}

/**
 * BKG-08: extra time on the member's own approved booking that has not ended yet. No maximum is invented; Flavors
 * approves every extension and sees any overlap. The flow re-checks ownership, status and the end time.
 */
export function validateExtension(booking: IMyRequest, newEndUtc: string, nowMs: number): string[] {
  const problems: string[] = [];
  const end: number = Date.parse(booking.endUtc);
  const next: number = Date.parse(newEndUtc);
  if (booking.status !== 'Approved') {
    problems.push('Only an approved booking can be extended.');
  }
  if (end <= nowMs) {
    problems.push('This booking has already ended.');
  }
  if (isNaN(next)) {
    problems.push('Choose a valid end time.');
  } else if (next <= end) {
    problems.push('The new end must be later than the current end.');
  }
  if (extensionWaiting(booking.extension)) {
    problems.push('A request for more time is already waiting for Flavors.');
  }
  return problems;
}

/** The intake item for an extra-time request. Names the booking only; the member is the item's author. */
export function toExtendItem(facilityId: string, requestId: string, booking: IMyRequest, newEndUtc: string): Record<string, unknown> {
  return {
    Title: 'Extension request', FacilityId: facilityId, RequestId: requestId, ExtendBookingId: booking.requestId,
    Space: booking.space, StartUtc: booking.startUtc, EndUtc: newEndUtc
  };
}
