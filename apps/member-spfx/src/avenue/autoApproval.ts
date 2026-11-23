// [PROPOSED, NOT CONFIRMED BY THE CLIENT: Q-B21] Auto-approval when the space is free. The client sheet says every booking
// needs management approval, so this is OFF unless AvenueFacilities.AutoApproveWhenFree is Yes. Pure; the request flow
// mirrors it (flows/PROPOSED_FLOW_CHANGES.md). Fails closed: anything unclear stays Pending for staff.

import type { IFacility } from './contracts';
import { type BookingMode, type BusyMap, DINING_KEY, WHOLE_FACILITY_KEY, unitStatus } from './availability';

export interface IAutoApprovalInput {
  mode: BookingMode;
  /** The units on the request (picked equipment plus assigned prep tables; every unit for whole-kitchen / private-event). */
  unitIds: string[];
  startUtc: string;
  endUtc: string;
  memberActive: boolean;
  /** Number of the member's required documents that are expired (and not superseded). */
  expiredDocs: number;
  /** An active AvenueComplianceOverrides row for the member. */
  ownerOverride: boolean;
  /** Built from APPROVED bookings only (buildBusyMap). */
  busy: BusyMap;
  facility: IFacility;
  nowMs: number;
}

export interface IAutoApprovalResult { approve: boolean; reasons: string[] }

export function decideAutoApproval(i: IAutoApprovalInput): IAutoApprovalResult {
  if (!i.facility.autoApproveWhenFree) { return { approve: false, reasons: ['Auto-approval is off.'] }; }
  const reasons: string[] = [];
  const s: number = Date.parse(i.startUtc);
  const e: number = Date.parse(i.endUtc);
  if (isNaN(s) || isNaN(e) || e <= s) { return { approve: false, reasons: ['The requested time is not valid.'] }; }
  if (s < i.nowMs) { reasons.push('The start time is in the past.'); }
  if (!i.memberActive) { reasons.push('The membership is not active.'); }
  if (i.expiredDocs > 0 && !i.ownerOverride) { reasons.push('A required document has expired and there is no owner override.'); }
  const mins: number = (e - s) / 60000;
  const { minBookingMinutes: lo, maxBookingMinutes: hi } = i.facility;
  if (lo !== undefined && mins < lo) { reasons.push(`Shorter than the minimum of ${lo} minutes.`); }
  if (hi !== undefined && mins > hi) { reasons.push(`Longer than the maximum of ${hi} minutes.`); }

  // Busy checks. Whole-facility bookings are included by unitStatus. Dining has no table-level data here, so any approved
  // dining or whole-facility booking in the window stops auto-approval (fail closed).
  const keys: string[] = i.unitIds.slice();
  if (i.mode === 'dining' || i.mode === 'private-event') { keys.push(DINING_KEY); }
  if (i.mode === 'dining' || i.mode === 'private-event' || i.mode === 'whole-kitchen') { keys.push(WHOLE_FACILITY_KEY); }
  if (i.unitIds.length === 0 && i.mode !== 'dining') { reasons.push('No equipment on the request.'); }
  const clashes: string[] = keys.filter(k => !unitStatus(k, i.startUtc, i.endUtc, i.busy).free);
  if (clashes.length > 0) { reasons.push(`An approved booking overlaps: ${clashes.map(k => k === WHOLE_FACILITY_KEY ? 'whole facility' : k === DINING_KEY ? 'dining room' : k).join(', ')}.`); }
  return { approve: reasons.length === 0, reasons };
}
