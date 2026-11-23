import type { ICalendarEntry, IFacility, IResource } from './contracts';
import {
  type IDayTimeline, type ITimelineSegment, assignPrepTables, buildBusyMap, cookingEquipmentFree, dayTimeline, fridgeUnits, hoursPreview, nextFreeSlots, unitHolders, unitStatus, validateSelection
} from './availability';
import { selectionToRequest } from './bookingFlow';
import { toIntakeItem } from './booking';

const TZ: string = 'America/New_York';
const facility: IFacility = { facilityId: 'f', title: 'F', timeZone: TZ };
const U = (id: string, title: string, category: IResource['category'], sortOrder: number, extra: Partial<IResource> = {}): IResource =>
  ({ resourceId: id, title, kind: category === 'Prep table' ? 'Prep table' : 'Equipment', category, sortOrder, bookable: true, ...extra });
const units: IResource[] = [
  U('s1', 'Stove #1', 'Stove', 1), U('s2', 'Stove #2', 'Stove', 2),
  U('p3', 'Prep table 3', 'Prep table', 3), U('p1', 'Prep table 1', 'Prep table', 1), U('p2', 'Prep table 2', 'Prep table', 2),
  U('hidden', 'Staff only oven', 'Oven', 9, { bookable: false })
];
const E = (id: string, ids: string[], start: string, end: string, space: ICalendarEntry['space'] = 'Kitchen', name: string = 'Acme'): ICalendarEntry =>
  ({ bookingId: id, resourceId: '', space, equipmentIds: ids, memberName: name, startUtc: start, endUtc: end });
const NOW: number = Date.parse('2026-06-01T00:00:00Z');
const A: string = '2026-06-02T14:00:00Z';
const B: string = '2026-06-02T16:00:00Z';
const C: string = '2026-06-02T18:00:00Z';

describe('unitStatus', () => {
  const busy = buildBusyMap([E('b1', ['s1'], A, B)]);
  it('touching windows do not overlap', () => {
    expect(unitStatus('s1', B, C, busy).free).toBe(true);
    expect(unitStatus('s1', '2026-06-02T12:00:00Z', A, busy).free).toBe(true);
  });
  it('partial overlap is busy and reports when it frees up', () => {
    expect(unitStatus('s1', '2026-06-02T15:00:00Z', C, busy)).toEqual({ free: false, takenUntilUtc: '2026-06-02T16:00:00.000Z' });
  });
  it('different equipment in the same window stays free', () => {
    expect(unitStatus('s2', A, B, busy).free).toBe(true);
  });
  it('back-to-back bookings chain into one takenUntil', () => {
    const chain = buildBusyMap([E('b1', ['s1'], A, B), E('b2', ['s1'], B, C)]);
    expect(unitStatus('s1', A, B, chain).takenUntilUtc).toBe('2026-06-02T18:00:00.000Z');
  });
  it('whole-facility booking blocks every unit; ignore id skips a booking', () => {
    const wf = buildBusyMap([E('w', [], A, B, 'Whole facility')]);
    expect(unitStatus('s2', A, B, wf).free).toBe(false);
    expect(unitStatus('s2', A, B, buildBusyMap([E('w', [], A, B, 'Whole facility')], 'w')).free).toBe(true);
  });
  it('legacy resourceId counts; bad rows are ignored', () => {
    const m = buildBusyMap([{ ...E('l', [], A, B), resourceId: 's2' }, E('bad', ['s1'], B, A)]);
    expect(unitStatus('s2', A, B, m).free).toBe(false);
    expect(unitStatus('s1', A, B, m).free).toBe(true);
  });
  it('holders are display names only', () => {
    expect(unitHolders('s1', A, B, busy)).toEqual(['Acme']);
  });
});

describe('prep tables and cooking banner', () => {
  it('assigns free tables by sortOrder and reports shortBy', () => {
    const busy = buildBusyMap([E('b', ['p1'], A, B)]);
    expect(assignPrepTables(units, busy, A, B, 2)).toEqual({ ids: ['p2', 'p3'], shortBy: 0 });
    expect(assignPrepTables(units, busy, A, B, 3)).toEqual({ ids: ['p2', 'p3'], shortBy: 1 });
    expect(assignPrepTables(units, buildBusyMap([]), A, B, 2).ids).toEqual(['p1', 'p2']);
  });
  it('cooking free ignores prep tables and non-bookable units', () => {
    expect(cookingEquipmentFree(units, buildBusyMap([E('b', ['p1', 'hidden'], A, B)]), A, B)).toBe(true);
    expect(cookingEquipmentFree(units, buildBusyMap([E('b', ['s2'], A, B)]), A, B)).toBe(false);
  });
});

describe('validateSelection', () => {
  const base = { units, facility, nowMs: NOW, startUtc: A, endUtc: B };
  const free = buildBusyMap([]);
  it('equipment with 2 prep tables is ok and resolves ids', () => {
    const r = validateSelection({ ...base, mode: 'equipment', unitIds: ['s1'], prepTableCount: 2, busy: free });
    expect(r.ok).toBe(true);
    expect(r.resolvedUnitIds).toEqual(['s1', 'p1', 'p2']);
  });
  it('no cooking equipment is allowed', () => {
    expect(validateSelection({ ...base, mode: 'equipment', unitIds: [], prepTableCount: 2, busy: free }).ok).toBe(true);
  });
  it('minPrepTables defaults to 2 and the facility value wins when set', () => {
    expect(validateSelection({ ...base, mode: 'equipment', unitIds: [], prepTableCount: 1, busy: free }).problems).toEqual(['Include at least 2 prep tables.']);
    expect(validateSelection({ ...base, facility: { ...facility, minPrepTables: 1 }, mode: 'equipment', unitIds: [], prepTableCount: 1, busy: free }).ok).toBe(true);
  });
  it('taken equipment gives a plain message with the local time', () => {
    const r = validateSelection({ ...base, mode: 'equipment', unitIds: ['s1'], prepTableCount: 2, busy: buildBusyMap([E('b', ['s1'], A, B)]) });
    expect(r.ok).toBe(false);
    expect(r.problems).toEqual(['Stove #1 is booked until 12:00 PM. Choose another time or equipment.']);
    expect(r.unavailable).toEqual([{ unitId: 's1', title: 'Stove #1', takenUntilUtc: '2026-06-02T16:00:00.000Z' }]);
  });
  it('too few free prep tables', () => {
    const r = validateSelection({ ...base, mode: 'equipment', unitIds: [], prepTableCount: 3, busy: buildBusyMap([E('b', ['p1'], A, B)]) });
    expect(r.problems[0]).toMatch(/Only 2 prep tables are free/);
  });
  it('unknown or non-bookable equipment is refused', () => {
    expect(validateSelection({ ...base, mode: 'equipment', unitIds: ['hidden', 'zzz'], prepTableCount: 2, busy: free }).ok).toBe(false);
  });
  it('whole kitchen is blocked by one busy stove, and by a busy prep table', () => {
    expect(validateSelection({ ...base, mode: 'whole-kitchen', unitIds: [], prepTableCount: 0, busy: buildBusyMap([E('b', ['s2'], A, B)]) }).unavailable.map(u => u.unitId)).toEqual(['s2']);
    expect(validateSelection({ ...base, mode: 'whole-kitchen', unitIds: [], prepTableCount: 0, busy: buildBusyMap([E('b', ['p2'], A, B)]) }).ok).toBe(false);
    const ok = validateSelection({ ...base, mode: 'whole-kitchen', unitIds: [], prepTableCount: 0, busy: free });
    expect(ok.ok).toBe(true);
    expect(ok.resolvedUnitIds.sort()).toEqual(['p1', 'p2', 'p3', 's1', 's2']);
  });
  it('dining ignores kitchen use but not a whole-facility booking', () => {
    expect(validateSelection({ ...base, mode: 'dining', unitIds: [], prepTableCount: 0, busy: buildBusyMap([E('b', ['s1'], A, B)]) }).ok).toBe(true);
    expect(validateSelection({ ...base, mode: 'dining', unitIds: [], prepTableCount: 0, busy: buildBusyMap([E('w', [], A, B, 'Whole facility')]) }).ok).toBe(false);
  });
  it('private event needs kitchen units and dining free', () => {
    const p = { ...base, mode: 'private-event' as const, unitIds: [], prepTableCount: 0 };
    expect(validateSelection({ ...p, busy: free }).ok).toBe(true);
    expect(validateSelection({ ...p, busy: buildBusyMap([E('d', [], A, B, 'Dining')]) }).problems).toEqual(['The dining room is booked until 12:00 PM. Choose another time.']);
    expect(validateSelection({ ...p, busy: buildBusyMap([E('k', ['s1'], A, B)]) }).ok).toBe(false);
  });
  it('min, max and step are enforced only when the facility defines them', () => {
    const run = (f: Partial<IFacility>, end: string): string[] =>
      validateSelection({ ...base, facility: { ...facility, ...f }, endUtc: end, mode: 'dining', unitIds: [], prepTableCount: 0, busy: free }).problems;
    expect(run({}, '2026-06-02T14:05:00Z')).toEqual([]);
    expect(run({}, '2026-06-05T14:00:00Z')).toEqual([]);
    expect(run({ minBookingMinutes: 60 }, '2026-06-02T14:30:00Z')).toEqual(['Book at least 60 minutes.']);
    expect(run({ maxBookingMinutes: 120 }, '2026-06-02T17:00:00Z')).toEqual(['Book at most 120 minutes.']);
    expect(run({ bookingStepMinutes: 30 }, '2026-06-02T14:45:00Z')).toEqual(['Book in steps of 30 minutes.']);
    expect(run({ bookingStepMinutes: 30, minBookingMinutes: 60, maxBookingMinutes: 240 }, '2026-06-02T16:30:00Z')).toEqual([]);
  });
  it('rejects bad, inverted and past times', () => {
    const run = (s: string, e: string): string[] => validateSelection({ ...base, startUtc: s, endUtc: e, mode: 'dining', unitIds: [], prepTableCount: 0, busy: free }).problems;
    expect(run('x', B)).toEqual(['Choose a start and end time.']);
    expect(run(B, A)).toEqual(['The end time must be after the start time.']);
    expect(run('2026-05-01T10:00:00Z', '2026-05-01T11:00:00Z')).toEqual(['The start time is in the past.']);
  });
});

describe('selectionToRequest', () => {
  const common = { facilityId: 'f', startUtc: A, endUtc: B, kitchenUnitIds: ['s1', 's2', 'p1'] };
  it('maps each mode and keeps the ";" joined EquipmentIds format', () => {
    const eq = selectionToRequest({ ...common, mode: 'equipment', resolvedUnitIds: ['s1', 'p1', 'p2'] });
    expect(eq.space).toBe('Kitchen');
    expect(toIntakeItem(eq, 'r1').EquipmentIds).toBe('s1;p1;p2');
    const wk = selectionToRequest({ ...common, mode: 'whole-kitchen', resolvedUnitIds: [] });
    expect([wk.space, wk.equipmentIds]).toEqual(['Kitchen', ['s1', 's2', 'p1']]);
    expect(selectionToRequest({ ...common, mode: 'private-event', resolvedUnitIds: [] })).toMatchObject({ space: 'Whole facility', equipmentIds: [] });
    expect(selectionToRequest({ ...common, mode: 'dining', resolvedUnitIds: [], peopleCount: 4 })).toMatchObject({ space: 'Dining', peopleCount: 4 });
  });
});

describe('nextFreeSlots', () => {
  const busy = buildBusyMap([E('b', ['s1'], A, B), E('c', ['s2'], B, C)]);
  it('finds the next windows where all units are free', () => {
    expect(nextFreeSlots(['s1', 's2'], 60, A, busy)).toEqual(['2026-06-02T18:00:00.000Z', '2026-06-02T18:30:00.000Z', '2026-06-02T19:00:00.000Z']);
  });
  it('aligns up to the step, honours limit and horizon', () => {
    expect(nextFreeSlots(['s1'], 30, '2026-06-02T16:10:00Z', busy, 30, 1)).toEqual(['2026-06-02T16:30:00.000Z']);
    expect(nextFreeSlots(['s1'], 30, A, buildBusyMap([E('x', ['s1'], A, '2026-06-10T00:00:00Z')]), 30, 3, 2)).toEqual([]);
    expect(nextFreeSlots(['s1'], 0, A, busy)).toEqual([]);
  });
});

describe('dayTimeline', () => {
  const seg = (t: IDayTimeline, id: string): ITimelineSegment[] => t.rows.filter(r => r.unitId === id)[0].segments;
  const day = (ymd: string, entries: ICalendarEntry[]): IDayTimeline => dayTimeline(units, buildBusyMap(entries), ymd, TZ);
  it('clips to the local day and skips non-bookable units', () => {
    const t = day('2026-06-02', [E('b', ['s1'], A, B)]);
    expect(t.totalMinutes).toBe(1440);
    expect(t.rows.map(r => r.unitId).sort()).toEqual(['p1', 'p2', 'p3', 's1', 's2']);
    expect(seg(t, 's1')).toEqual([{ startMin: 600, endMin: 720, label: 'Acme' }]);
    expect(seg(t, 's2')).toEqual([]);
  });
  it('splits a booking that crosses local midnight across both days', () => {
    const e = E('n', ['s1'], '2026-06-03T02:00:00Z', '2026-06-03T06:00:00Z'); // 22:00 Jun 2 to 02:00 Jun 3 local
    expect(seg(day('2026-06-02', [e]), 's1')).toEqual([{ startMin: 1320, endMin: 1440, label: 'Acme' }]);
    expect(seg(day('2026-06-03', [e]), 's1')).toEqual([{ startMin: 0, endMin: 120, label: 'Acme' }]);
  });
  it('spring forward 2026-03-08 has 23 hours', () => {
    // 05:00Z = 00:00 EST; 07:00Z = 03:00 EDT, only 2 elapsed hours later.
    const t = day('2026-03-08', [E('d', ['s1'], '2026-03-08T05:00:00Z', '2026-03-08T07:00:00Z')]);
    expect(t.totalMinutes).toBe(1380);
    expect(seg(t, 's1')).toEqual([{ startMin: 0, endMin: 120, label: 'Acme' }]);
    expect(day('2026-03-08', [E('d', ['s1'], '2026-03-08T20:00:00Z', '2026-03-09T10:00:00Z')]).rows.filter(r => r.unitId === 's1')[0].segments[0].endMin).toBe(1380);
  });
  it('fall back 2026-11-01 has 25 hours', () => {
    const t = day('2026-11-01', [E('d', ['s1'], '2026-11-01T05:30:00Z', '2026-11-01T07:30:00Z')]);
    expect(t.totalMinutes).toBe(1500);
    expect(seg(t, 's1')).toEqual([{ startMin: 90, endMin: 210, label: 'Acme' }]);
  });
  it('a whole-facility booking shows on every unit', () => {
    expect(day('2026-06-02', [E('w', [], A, B, 'Whole facility')]).rows.every(r => r.segments.length === 1)).toBe(true);
  });
});

describe('hoursPreview', () => {
  it('splits booked time into left and over', () => {
    expect(hoursPreview(2 * 3600000, 10, 3)).toEqual({ thisBooking: 2, leftAfter: 5, over: 0 });
    expect(hoursPreview(4 * 3600000, 10, 8)).toEqual({ thisBooking: 4, leftAfter: 0, over: 2 });
    expect(hoursPreview(-5, 10, 0)).toEqual({ thisBooking: 0, leftAfter: 10, over: 0 });
  });
});

describe('1 hour gap and complimentary fridges (client sheet, 19 Nov 2026)', () => {
  it('a 60 minute gap keeps the same equipment unavailable until an hour after the end', () => {
    const busy = buildBusyMap([E('b1', ['s1'], A, B)], undefined, 60);
    expect(unitStatus('s1', B, C, busy).free).toBe(false);
    expect(unitStatus('s1', '2026-06-02T17:00:00Z', '2026-06-02T19:00:00Z', busy).free).toBe(true);
    expect(unitStatus('s1', '2026-06-02T11:00:00Z', A, busy).free).toBe(false);
    expect(unitStatus('s2', B, C, busy).free).toBe(true);
  });
  const withFridges: IResource[] = units.concat([U('f1', 'Fridge 1', 'Fridge', 10), U('f2', 'Fridge 2', 'Fridge', 11)]);
  it('fridges are not offered as equipment and one is assigned to each booking', () => {
    expect(fridgeUnits(withFridges).length).toBe(2);
    const r = validateSelection({ mode: 'equipment', unitIds: ['s1'], prepTableCount: 2, startUtc: A, endUtc: B, nowMs: NOW, facility, units: withFridges, busy: buildBusyMap([]), people: undefined } as never);
    expect(r.resolvedUnitIds).toContain('f1');
    expect(r.resolvedUnitIds).not.toContain('f2');
  });
  it('a third company is refused when both fridges are in use', () => {
    const busy = buildBusyMap([E('x1', ['f1'], A, B), E('x2', ['f2'], A, B)]);
    const r = validateSelection({ mode: 'equipment', unitIds: ['s1'], prepTableCount: 2, startUtc: A, endUtc: B, nowMs: NOW, facility, units: withFridges, busy, people: undefined } as never);
    expect(r.ok).toBe(false);
  });
});
