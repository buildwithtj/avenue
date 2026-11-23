// Parses the display-only Outcome text that the calendar flow writes onto a member's own request:
//   "<Status>[ · cancellation requested, Flavors will reply][ · Note: <text>]"
// It is never used for a decision; it only drives what the member sees.

import { BOOKING_STATUSES, type BookingStatus } from './contracts';

/** Booking status staff set when they cancel a late request and keep the hours (the hours flow only credits "Cancelled"). */
export const HOURS_KEPT: string = 'Cancelled (hours kept)';

export interface IParsedOutcome {
  status?: BookingStatus;
  note?: string;
  cancelRequested: boolean;
  /** Staff cancelled a late request without returning the hours (status "Cancelled (hours kept)"). */
  hoursKept: boolean;
}

export function parseOutcome(outcome: string | undefined): IParsedOutcome {
  if (!outcome || !outcome.trim()) {
    return { cancelRequested: false, hoursKept: false };
  }
  const parts: string[] = outcome.split(' · ');
  const head: string = parts[0].trim();
  const hoursKept: boolean = head === HOURS_KEPT;
  const status: BookingStatus | undefined = hoursKept ? 'Cancelled' : BOOKING_STATUSES.filter(s => s === head)[0];
  const noteIndex: number = outcome.indexOf(' · Note: ');
  return {
    status,
    note: noteIndex >= 0 ? outcome.slice(noteIndex + ' · Note: '.length).trim() || undefined : undefined,
    cancelRequested: outcome.indexOf('cancellation requested') >= 0,
    hoursKept
  };
}
