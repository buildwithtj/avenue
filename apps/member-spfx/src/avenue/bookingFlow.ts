// Pure logic for the guided booking form: which equipment is free at the chosen time, step gating, and what the member
// is told after sending. Availability is INFORMATION only: Flavors approves every booking and may allow an overlap
// (client call 11 Nov 2026), so nothing here blocks a request. No duration, lead-time or hour limit is invented.

import type { BookingMode } from './availability';
import type { IBookingRequestInput, ICalendarEntry, IMyRequest, IResource, Space } from './contracts';
import { validateRequest, type IRequestContext } from './booking';

export interface IAvailability {
  resourceId: string;
  /** Approved bookings that touch this equipment (or the whole facility) at the chosen time. */
  busyWith: ICalendarEntry[];
}

/** For each piece of equipment: who has it, or the whole facility, during [startUtc, endUtc). */
export function equipmentAvailability(resources: IResource[], entries: ICalendarEntry[], startUtc: string, endUtc: string): IAvailability[] {
  const start: number = Date.parse(startUtc);
  const end: number = Date.parse(endUtc);
  const valid: boolean = !isNaN(start) && !isNaN(end) && end > start;
  return resources.map(r => ({
    resourceId: r.resourceId,
    busyWith: !valid ? [] : entries.filter(e =>
      Date.parse(e.startUtc) < end && start < Date.parse(e.endUtc) &&
      (e.space === 'Whole facility' || e.equipmentIds.indexOf(r.resourceId) >= 0 || e.resourceId === r.resourceId))
  }));
}

export type Step = 'details' | 'equipment' | 'review';

export interface IDraft {
  space: Space;
  equipmentIds: string[];
  peopleCount?: number;
  startUtc?: string;
  endUtc?: string;
}

/** Problems that stop the member leaving a step. The same rules as validateRequest, split by step. */
export function stepProblems(step: Step, draft: IDraft, ctx: IRequestContext): string[] {
  const full: IBookingRequestInput = {
    facilityId: 'x', space: draft.space, equipmentIds: draft.equipmentIds, peopleCount: draft.peopleCount,
    startUtc: draft.startUtc || '', endUtc: draft.endUtc || ''
  };
  const all: string[] = validateRequest(full, ctx);
  const timeProblem = (p: string): boolean => /start|end time|valid|past/i.test(p);
  const needsEquipment = (p: string): boolean => /equipment/i.test(p);
  const needsPeople = (p: string): boolean => /people|seats/i.test(p);
  if (step === 'details') {
    return all.filter(p => timeProblem(p) || (draft.space === 'Dining' && needsPeople(p)));
  }
  if (step === 'equipment') {
    return all.filter(needsEquipment);
  }
  return all;
}

/** Which steps the member must pass through for this space (dining and private events have no equipment step). */
export function stepsFor(space: Space): Step[] {
  return space === 'Kitchen' ? ['details', 'equipment', 'review'] : ['details', 'review'];
}

export type SentState = 'checking' | 'approved' | 'waiting' | 'declined' | 'cancelled';

export interface ISentOutcome {
  state: SentState;
  title: string;
  detail: string;
  /** True once the flow has answered and there is nothing more to wait for here. */
  final: boolean;
}

/**
 * What to tell the member about the request they just sent, from the flow's own echoed status and note.
 * `Pending` is how an overlap is referred to Flavors; the note carries the reason.
 */
export function sentOutcome(request: IMyRequest | undefined): ISentOutcome {
  if (!request || !request.status) {
    return { state: 'checking', title: 'Request sent. Avenue is checking it.', detail: 'This usually takes under a minute.', final: false };
  }
  switch (request.status) {
    case 'Approved':
      return { state: 'approved', title: 'Approved. Your booking is confirmed.', detail: request.note || 'It is on the facility calendar.', final: true };
    case 'Pending':
      return { state: 'waiting', title: 'Sent to Flavors for a decision.', detail: request.note || 'Flavors reviews every request that needs a decision. The result appears in Bookings.', final: true };
    case 'Declined':
      return { state: 'declined', title: 'This request was not accepted.', detail: request.note || 'No reason was given.', final: true };
    case 'Cancelled':
    case 'No-show credited':
      return { state: 'cancelled', title: 'This booking was cancelled.', detail: request.note || '', final: true };
    default:
      return { state: 'checking', title: 'Request sent.', detail: '', final: false };
  }
}

/**
 * Turns a checked selection into the request. EquipmentIds keeps the ';'-joined form the live flows parse (toIntakeItem).
 * equipment -> Kitchen + chosen ids; whole-kitchen -> Kitchen + every kitchen unit id; dining -> Dining; private-event -> Whole facility, no ids.
 * `resolvedUnitIds` comes from validateSelection; `kitchenUnitIds` is every bookable kitchen unit (cooking + prep).
 */
export function selectionToRequest(
  sel: { mode: BookingMode; facilityId: string; resolvedUnitIds: string[]; kitchenUnitIds: string[]; peopleCount?: number; startUtc: string; endUtc: string }
): IBookingRequestInput {
  const base = { facilityId: sel.facilityId, startUtc: sel.startUtc, endUtc: sel.endUtc };
  switch (sel.mode) {
    case 'equipment': return { ...base, space: 'Kitchen', equipmentIds: sel.resolvedUnitIds };
    case 'whole-kitchen': return { ...base, space: 'Kitchen', equipmentIds: sel.kitchenUnitIds };
    case 'dining': return { ...base, space: 'Dining', equipmentIds: [], peopleCount: sel.peopleCount };
    default: return { ...base, space: 'Whole facility', equipmentIds: [] };
  }
}
