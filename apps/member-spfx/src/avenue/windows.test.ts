import type { ICalendarEntry, IFacility, IMyRequest } from './contracts';
import { buildBusyMap, hoursPreview, unitStatus } from './availability';
import { checklistAllowed, eligibleBookings } from './checklist';
import { bookingPhase, bookingWindows, durationText, endReminderDue, endsInText, leaveByText, startsInText } from './windows';

const TZ = 'America/New_York';
const F: IFacility = { facilityId: 'f', title: 'F', timeZone: TZ, earlyEntryMinutes: 30, cleanupMinutes: 30, checkoutAlertMinutes: 30 };
const NONE: IFacility = { facilityId: 'f', title: 'F', timeZone: TZ };
const min = (iso: string, m: number): number => Date.parse(iso) + m * 60000;
// 3:00 PM to 5:00 PM Eastern (EDT = UTC-4) on 14 Oct 2026
const B = { startUtc: '2026-10-14T19:00:00Z', endUtc: '2026-10-14T21:00:00Z' };

describe('bookingWindows', () => {
  it('adds the facility minutes around the booked time', () => {
    expect(bookingWindows(B, F, TZ)).toEqual({ entryOpensUtc: '2026-10-14T18:30:00.000Z', startUtc: '2026-10-14T19:00:00.000Z', endUtc: '2026-10-14T21:00:00.000Z', cleanupEndsUtc: '2026-10-14T21:30:00.000Z' });
  });
  it('undefined settings: the windows equal the booked time', () => {
    const w = bookingWindows(B, NONE);
    expect(w.entryOpensUtc).toBe(w.startUtc);
    expect(w.cleanupEndsUtc).toBe(w.endUtc);
  });
  it('ActualEndUtc does not move the windows', () => {
    expect(bookingWindows({ ...B, actualEndUtc: '2026-10-14T22:10:00Z' }, F).cleanupEndsUtc).toBe('2026-10-14T21:30:00.000Z');
  });
});

describe('daylight saving (America/New_York)', () => {
  it('spring forward 2026-03-08: a booking ending 01:30 EST has cleaning until 03:00 EDT (30 real minutes)', () => {
    // 01:30 EST = 06:30Z; 02:00 does not exist
    const w = bookingWindows({ startUtc: '2026-03-08T05:00:00Z', endUtc: '2026-03-08T06:30:00Z' }, F);
    expect(w.cleanupEndsUtc).toBe('2026-03-08T07:00:00.000Z');
    expect(leaveByText({ startUtc: '2026-03-08T05:00:00Z', endUtc: '2026-03-08T06:30:00Z' }, F)).toBe('Leave by 3:00 AM');
  });
  it('spring forward: early entry for a 03:00 EDT start opens 01:30 EST', () => {
    const w = bookingWindows({ startUtc: '2026-03-08T07:00:00Z', endUtc: '2026-03-08T09:00:00Z' }, F);
    expect(w.entryOpensUtc).toBe('2026-03-08T06:30:00.000Z');
  });
  it('fall back 2026-11-01: end 01:30 EDT (05:30Z) -> cleaning ends 01:00 EST (06:00Z), still 30 real minutes', () => {
    const b = { startUtc: '2026-11-01T04:00:00Z', endUtc: '2026-11-01T05:30:00Z' };
    expect(bookingWindows(b, F).cleanupEndsUtc).toBe('2026-11-01T06:00:00.000Z');
    expect(leaveByText(b, F)).toBe('Leave by 1:00 AM');
  });
  it('fall back: phases follow elapsed time across the repeated hour', () => {
    const b = { startUtc: '2026-11-01T05:00:00Z', endUtc: '2026-11-01T07:00:00Z' }; // 01:00 EDT .. 02:00 EST
    expect(bookingPhase(b, F, min(b.endUtc, -30))).toBe('ending-soon');
    expect(bookingPhase(b, F, min(b.endUtc, -31))).toBe('in-progress');
  });
  it('reminder window across spring forward is 30 real minutes', () => {
    const b = { status: 'Approved', startUtc: '2026-03-08T05:00:00Z', endUtc: '2026-03-08T07:00:00Z' }; // ends 03:00 EDT
    expect(endReminderDue(b, F, min(b.endUtc, -30))).toBe(true);
    expect(endReminderDue(b, F, min(b.endUtc, -31))).toBe(false);
  });
});

describe('bookingPhase', () => {
  const at = (iso: string, m: number): number => min(iso, m);
  it('walks every phase at the exact boundaries', () => {
    expect(bookingPhase(B, F, at(B.startUtc, -31))).toBe('upcoming');
    expect(bookingPhase(B, F, at(B.startUtc, -30))).toBe('entry-open');
    expect(bookingPhase(B, F, at(B.startUtc, 0))).toBe('in-progress');
    expect(bookingPhase(B, F, at(B.endUtc, -31))).toBe('in-progress');
    expect(bookingPhase(B, F, at(B.endUtc, -30))).toBe('ending-soon');
    expect(bookingPhase(B, F, at(B.endUtc, 0))).toBe('cleanup');
    expect(bookingPhase(B, F, at(B.endUtc, 29))).toBe('cleanup');
    expect(bookingPhase(B, F, at(B.endUtc, 30))).toBe('done');
  });
  it('without settings there is no entry-open, ending-soon or cleanup', () => {
    expect(bookingPhase(B, NONE, min(B.startUtc, -1))).toBe('upcoming');
    expect(bookingPhase(B, NONE, min(B.endUtc, -1))).toBe('in-progress');
    expect(bookingPhase(B, NONE, min(B.endUtc, 0))).toBe('done');
  });
});

describe('countdown text', () => {
  it('formats durations', () => {
    expect(durationText(130 * 60000)).toBe('2 h 10 min');
    expect(durationText(28 * 60000)).toBe('28 min');
    expect(durationText(180 * 60000)).toBe('3 h');
    expect(durationText(28 * 3600000)).toBe('1 d 4 h');
    expect(durationText(1000)).toBe('1 min');
    expect(durationText(0)).toBe('under a minute');
  });
  it('starts in / ends in / leave by', () => {
    expect(startsInText(B, min(B.startUtc, -130))).toBe('starts in 2 h 10 min');
    expect(startsInText(B, min(B.startUtc, 1))).toBe('');
    expect(endsInText(B, min(B.endUtc, -28))).toBe('ends in 28 min');
    expect(endsInText(B, min(B.endUtc, 0))).toBe('');
    expect(leaveByText(B, F)).toBe('Leave by 5:30 PM');
    expect(leaveByText(B, NONE)).toBe('Leave by 5:00 PM');
  });
});

describe('free windows never block or count', () => {
  const entry = (id: string, s: string, e: string): ICalendarEntry => ({ bookingId: id, resourceId: '', space: 'Kitchen', equipmentIds: ['s1'], memberName: id, startUtc: s, endUtc: e });
  it('a booking starting exactly when another ends is free (cleaning/early windows ignored)', () => {
    const busy = buildBusyMap([entry('a', '2026-10-14T17:00:00Z', B.startUtc)]); // a ends at 3 PM = our start; our early entry (2:30) overlaps a, which is fine
    expect(unitStatus('s1', B.startUtc, B.endUtc, busy).free).toBe(true);
    expect(bookingWindows(B, F).entryOpensUtc < '2026-10-14T19:00:00.000Z').toBe(true);
    const next = buildBusyMap([entry('b', B.endUtc, '2026-10-14T23:00:00Z')]); // starts at our end, inside our cleaning window
    expect(unitStatus('s1', B.startUtc, B.endUtc, next).free).toBe(true);
  });
  it('a booking overlapping by one minute still conflicts', () => {
    const busy = buildBusyMap([entry('a', '2026-10-14T17:00:00Z', '2026-10-14T19:01:00Z')]);
    expect(unitStatus('s1', B.startUtc, B.endUtc, busy).free).toBe(false);
  });
  it('hoursPreview counts booked time only, never early entry or cleaning', () => {
    const w = bookingWindows(B, F);
    const booked = Date.parse(w.endUtc) - Date.parse(w.startUtc);
    const wide = Date.parse(w.cleanupEndsUtc) - Date.parse(w.entryOpensUtc);
    expect(hoursPreview(booked, 10, 0).thisBooking).toBe(2);
    expect(wide).toBeGreaterThan(booked);
    expect(hoursPreview(booked, 10, 0)).toEqual({ thisBooking: 2, leftAfter: 8, over: 0 });
  });
});

describe('endReminderDue', () => {
  const ok = { ...B, status: 'Approved' };
  it('only inside [end - alert, end)', () => {
    expect(endReminderDue(ok, F, min(B.endUtc, -31))).toBe(false);
    expect(endReminderDue(ok, F, min(B.endUtc, -30))).toBe(true);
    expect(endReminderDue(ok, F, min(B.endUtc, -1))).toBe(true);
    expect(endReminderDue(ok, F, min(B.endUtc, 0))).toBe(false);
  });
  it('once: false when already sent', () => {
    expect(endReminderDue(ok, F, min(B.endUtc, -10), '2026-10-14T20:35:00Z')).toBe(false);
    expect(endReminderDue(ok, F, min(B.endUtc, -10), '')).toBe(true);
  });
  it('only Approved bookings', () => {
    for (const status of ['Pending', 'Declined', 'Cancelled', 'No-show credited', undefined]) {
      expect(endReminderDue({ ...B, status }, F, min(B.endUtc, -10))).toBe(false);
    }
  });
  it('never without the setting', () => {
    expect(endReminderDue(ok, NONE, min(B.endUtc, -10))).toBe(false);
    expect(endReminderDue(ok, { ...F, checkoutAlertMinutes: 0 }, min(B.endUtc, -10))).toBe(false);
  });
});

describe('check-in eligibility with windows', () => {
  const bk = (extra: Partial<IMyRequest> = {}): IMyRequest => ({ requestId: 'r', space: 'Kitchen', ...B, cancelSent: false, cancelRequested: false, status: 'Approved', ...extra });
  it('entry opens earlyEntryMinutes before the start', () => {
    expect(checklistAllowed('Entry', bk(), F, min(B.startUtc, -31))).toBe(false);
    expect(checklistAllowed('Entry', bk(), F, min(B.startUtc, -30))).toBe(true);
  });
  it('early entry undefined means 0: entry opens at the start', () => {
    expect(checklistAllowed('Entry', bk(), NONE, min(B.startUtc, -1))).toBe(false);
    expect(checklistAllowed('Entry', bk(), NONE, min(B.startUtc, 0))).toBe(true);
  });
  it('exit is allowed until cleanupEndsUtc, not after', () => {
    expect(checklistAllowed('Exit', bk(), F, min(B.endUtc, 29))).toBe(true);
    expect(checklistAllowed('Exit', bk(), F, min(B.endUtc, 30))).toBe(false);
    expect(checklistAllowed('Exit', bk(), NONE, min(B.endUtc, 1))).toBe(false);
    expect(checklistAllowed('Exit', bk(), F, min(B.startUtc, -10))).toBe(false);
  });
  it('only approved bookings', () => {
    expect(checklistAllowed('Entry', bk({ status: 'Pending' }), F, min(B.startUtc, 5))).toBe(false);
  });
  it('eligibleBookings with the facility uses the windows; without it the old 12 h / 24 h rule holds', () => {
    const now = min(B.startUtc, -20);
    expect(eligibleBookings([bk()], now, { facility: F, kind: 'Entry' }).length).toBe(1);
    expect(eligibleBookings([bk()], min(B.startUtc, -40), { facility: F }).length).toBe(0);
    expect(eligibleBookings([bk()], min(B.startUtc, -40)).length).toBe(1);
    expect(eligibleBookings([bk()], min(B.endUtc, 60), { facility: F }).length).toBe(0);
  });
});
