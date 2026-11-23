import { defaultBooking, eligibleBookings, progress, recordState, suggestKind } from './checklist';
import type { IChecklistQuestion, IMyCheckIn, IMyRequest } from './contracts';

const NOW = Date.parse('2026-11-14T15:00:00Z');
const H = 3600e3;
const bk = (id: string, startH: number, endH: number, status: IMyRequest['status'] = 'Approved'): IMyRequest =>
  ({ requestId: id, space: 'Kitchen', startUtc: new Date(NOW + startH * H).toISOString(), endUtc: new Date(NOW + endH * H).toISOString(), cancelSent: false, cancelRequested: false, status });
const ci = (bookingId: string, kind: 'Entry' | 'Exit', outcome?: string): IMyCheckIn => ({ submissionId: bookingId + kind, bookingId, kind, outcome });
const Q = (id: number): IChecklistQuestion => ({ id, kind: 'Entry', text: 'q' + id, order: id });

describe('eligibleBookings and defaultBooking', () => {
  it('keeps approved bookings from 12 h ago to 24 h ahead, soonest first', () => {
    const all = [bk('far', 30, 34), bk('later', 5, 8), bk('now', -1, 2), bk('old', -20, -13), bk('justEnded', -14, -11.9), bk('pending', 2, 4, 'Pending')];
    expect(eligibleBookings(all, NOW).map(b => b.requestId)).toEqual(['justEnded', 'now', 'later']);
  });
  it('the boundary 12 h after the end and 24 h before the start are handled exactly', () => {
    expect(eligibleBookings([bk('a', -20, -12)], NOW)).toEqual([]);
    expect(eligibleBookings([bk('b', 24, 26)], NOW)).toEqual([]);
    expect(eligibleBookings([bk('c', 23.9, 26)], NOW).length).toBe(1);
  });
  it('pre-selects the booking in progress, else the soonest, else nothing', () => {
    const e = eligibleBookings([bk('later', 5, 8), bk('now', -1, 2)], NOW);
    expect(defaultBooking(e, NOW)!.requestId).toBe('now');
    expect(defaultBooking(eligibleBookings([bk('later', 5, 8)], NOW), NOW)!.requestId).toBe('later');
    expect(defaultBooking([], NOW)).toBeUndefined();
  });
});

describe('suggestKind', () => {
  it('Entry first, Exit once an entry exists, Entry again if both are done', () => {
    expect(suggestKind('b', [])).toBe('Entry');
    expect(suggestKind('b', [ci('b', 'Entry')])).toBe('Exit');
    expect(suggestKind('b', [ci('b', 'Entry'), ci('b', 'Exit')])).toBe('Entry');
    expect(suggestKind('b', [ci('other', 'Entry')])).toBe('Entry');
  });
});

describe('progress', () => {
  it('counts answers and Nos; incomplete until every question is answered', () => {
    expect(progress([Q(1), Q(2), Q(3)], { 1: 'Yes', 2: 'No' })).toEqual({ answered: 2, total: 3, complete: false, noCount: 1 });
    expect(progress([Q(1), Q(2)], { 1: 'Yes', 2: 'Yes' })).toMatchObject({ complete: true, noCount: 0 });
  });
  it('no questions is never complete', () => {
    expect(progress([], {}).complete).toBe(false);
  });
  it('ignores answers for questions that are not shown', () => {
    expect(progress([Q(1)], { 1: 'Yes', 99: 'No' })).toMatchObject({ answered: 1, noCount: 0 });
  });
});

describe('recordState', () => {
  it('maps the flow outcomes', () => {
    expect(recordState(undefined).state).toBe('recording');
    expect(recordState(ci('b', 'Entry')).state).toBe('recording');
    expect(recordState(ci('b', 'Entry', 'Recorded')).state).toBe('recorded');
    expect(recordState(ci('b', 'Entry', 'Already recorded')).state).toBe('recorded');
    const n = recordState(ci('b', 'Entry', 'Not recorded: this is not one of your approved bookings'));
    expect(n.state).toBe('not-recorded');
    expect(n.text).toMatch(/approved bookings/);
  });
});
