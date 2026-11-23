import { buildIcs, KITS, agendaGroups, artKeyFor, blockFromSlots, initials, kitSelection, mergeSegments, monthStrip, phaseView, pickSlots, slotFromX, weekHeat } from './ui-view';
import { buildBusyMap } from './availability';
import type { IFacility, IMyRequest, IResource } from './contracts';

const f: IFacility = { facilityId: 'f', title: 'F', timeZone: 'America/New_York', earlyEntryMinutes: 30, cleanupMinutes: 30, checkoutAlertMinutes: 30 };
const U = (id: string, title: string, category: IResource['category'], sortOrder: number): IResource =>
  ({ resourceId: id, title, kind: category === 'Prep table' ? 'Prep table' : 'Equipment', category, sortOrder, bookable: true });
const units: IResource[] = [U('s1', 'Stove #1', 'Stove', 1), U('s2', 'Stove #2', 'Stove', 2), U('g1', 'Grill #1', 'Grill', 3), U('o1', 'Oven', 'Oven', 4), U('p1', 'Prep 1', 'Prep table', 5), U('p2', 'Prep 2', 'Prep table', 6), U('p3', 'Prep 3', 'Prep table', 7)];

describe('kits', () => {
  it('hot line pre-selects the first stove and grill plus the minimum prep tables', () => {
    expect(kitSelection('hot-line', units, f)).toEqual({ mode: 'equipment', unitIds: ['s1', 'g1'], prepTableCount: 2 });
    expect(kitSelection('prep', units, { ...f, minPrepTables: 3 })).toEqual({ mode: 'equipment', unitIds: [], prepTableCount: 3 });
    expect(kitSelection('private-event', units, f).mode).toBe('private-event');
    expect(KITS.map(k => k.title)).toEqual(['Hot line', 'Bakery and ovens', 'Prep only', 'Whole kitchen', 'Dining room', 'Private event']);
  });
});

describe('board geometry', () => {
  it('snaps to the step and includes the end slot', () => {
    expect(slotFromX(250, 0, 1000, 1440, 30)).toBe(360);
    expect(slotFromX(5000, 0, 1000, 1440, 30)).toBe(1410);
    expect(blockFromSlots(600, 540, 30, 1440)).toEqual({ startMin: 540, endMin: 630 });
    expect(blockFromSlots(600, 600, 30, 1440)).toEqual({ startMin: 600, endMin: 630 });
    expect(mergeSegments([[{ startMin: 0, endMin: 60, label: 'A' }], [{ startMin: 30, endMin: 90, label: 'B' }]])).toEqual([{ startMin: 0, endMin: 90, label: undefined }]);
  });
  it('picks well-spaced slots', () => {
    const base = Date.parse('2026-11-20T14:00:00Z');
    const s = [0, 30, 60, 120, 180, 240].map(m => new Date(base + m * 60000).toISOString());
    expect(pickSlots(s, 120, 3).map(x => (Date.parse(x) - base) / 60000)).toEqual([0, 120, 240]);
  });
});

describe('agenda, strip, heat', () => {
  const r = (id: string, s: string, e: string, status: IMyRequest['status'] = 'Approved'): IMyRequest => ({ requestId: id, space: 'Kitchen', startUtc: s, endUtc: e, cancelSent: false, cancelRequested: false, status });
  const now = Date.parse('2026-11-18T12:00:00Z');
  const reqs = [r('a', '2026-11-19T15:00:00Z', '2026-11-19T17:00:00Z'), r('b', '2026-11-19T19:00:00Z', '2026-11-19T20:00:00Z'), r('c', '2026-11-10T15:00:00Z', '2026-11-10T17:00:00Z'), r('d', '2026-11-21T15:00:00Z', '2026-11-21T17:00:00Z', 'Declined')];
  it('groups by day', () => {
    const up = agendaGroups(reqs, f.timeZone, now, 'upcoming');
    expect(up.map(g => [g.day, g.requests.length])).toEqual([['2026-11-19', 2], ['2026-11-21', 1]]);
    expect(agendaGroups(reqs, f.timeZone, now, 'past')[0].requests[0].requestId).toBe('c');
  });
  it('marks booked days but not declined ones', () => {
    const m = monthStrip(reqs, '2026-11-18', f.timeZone, 5);
    expect(m.map(d => d.booked)).toEqual([false, true, false, false, false]);
    expect(m[0].today).toBe(true);
  });
  it('shades the week by share of the day booked', () => {
    const busy = buildBusyMap([{ bookingId: 'x', resourceId: '', space: 'Kitchen', equipmentIds: ['s1'], memberName: 'A', startUtc: '2026-11-19T05:00:00Z', endUtc: '2026-11-19T17:00:00Z' }]);
    const rows = weekHeat(units, busy, '2026-11-18', 3, f.timeZone);
    const s1 = rows.filter(x => x.unitId === 's1')[0];
    expect(s1.cells.map(c => c.level)).toEqual([0, 3, 0]);
    expect(s1.cells[1].percent).toBe(50);
  });
});

describe('live phase', () => {
  const b = { startUtc: '2026-11-18T19:00:00Z', endUtc: '2026-11-18T22:00:00Z', status: 'Approved' };
  const at = (iso: string): number => Date.parse(iso);
  it('words each phase from the facility settings', () => {
    expect(phaseView(b, f, at('2026-11-18T17:00:00Z')).headline).toBe('Entry opens 1:30 PM');
    expect(phaseView(b, f, at('2026-11-18T20:00:00Z')).headline).toBe('In the kitchen until 5:00 PM');
    const clean = phaseView(b, f, at('2026-11-18T21:32:00Z'));
    expect(clean.headline).toBe('Time to clean up, ends in 28 min');
    expect(clean.extend).toBe(true);
    expect(phaseView(b, f, at('2026-11-18T22:10:00Z')).headline).toBe('Cleaning time: leave by 5:30 PM');
    expect(phaseView({ ...b, status: 'Pending' }, f, 0).headline).toBe('Waiting for approval');
  });
});

describe('art key and calendar file', () => {
  it('maps categories, ids and titles to artwork', () => {
    expect(artKeyFor('Stove')).toBe('stove');
    expect(artKeyFor('oven-up', 'Convection Oven (Upper)', 'Oven')).toBe('oven-upper');
    expect(artKeyFor('Pizza oven')).toBe('pizza');
    expect(artKeyFor('x', 'Flat Top Gas Grill #2', 'Grill')).toBe('flattop');
    expect(artKeyFor('Prep table')).toBe('prep');
    expect(artKeyFor('???')).toBe('generic');
    expect(initials('Ana Cook')).toBe('AC');
  });
  it('writes a valid one-event ics with CRLF and escapes', () => {
    const ics = buildIcs({ id: 'req-1', startUtc: '2026-11-18T19:00:00Z', endUtc: '2026-11-18T22:00:00Z', summary: 'Kitchen, Stove #1', description: 'Line one\nLine two; ok', location: 'Flavors' }, '2026-11-17T00:00:00Z');
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTART:20261118T190000Z');
    expect(ics).toContain('DTEND:20261118T220000Z');
    expect(ics).toContain('SUMMARY:Kitchen\\, Stove #1');
    expect(ics).toContain('DESCRIPTION:Line one\\nLine two\\; ok');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });
});

import { bookingAlerts, unseenAlerts } from './ui-helpers';
describe('alerts', () => {
  const mem = (): { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void } => { const m: Record<string, string> = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; } }; };
  const req = (id: string, status: string): never => ({ requestId: id, space: 'Kitchen', startUtc: 'x', endUtc: 'y', cancelSent: false, cancelRequested: false, status } as never);
  it('starts empty (baseline), then alerts only on a new decision', () => {
    const st = mem();
    const a1 = bookingAlerts([req('r1', 'Approved')], () => 'when');
    expect(unseenAlerts(a1, st)).toHaveLength(0);
    const a2 = bookingAlerts([req('r1', 'Approved'), req('r2', 'Approved'), req('r3', 'Declined')], () => 'when');
    expect(unseenAlerts(a2, st).map(a => a.title)).toEqual(['Booking confirmed', 'Request declined']);
  });
  it('ignores pending requests', () => { expect(bookingAlerts([req('r1', 'Pending')], () => 'w')).toHaveLength(0); });
  it('reminds 24 hours and 1 hour before an approved booking, once each', () => {
    const now = Date.parse('2026-06-02T12:00:00Z');
    const at = (iso: string): never => ({ requestId: 'r9', space: 'Kitchen', startUtc: iso, endUtc: '2026-06-03T20:00:00Z', cancelSent: false, cancelRequested: false, status: 'Approved' } as never);
    expect(bookingAlerts([at('2026-06-03T09:00:00Z')], () => 'w', now).map(a => a.key)).toEqual(expect.arrayContaining(['r9|remind24', 'r9|Approved']));
    expect(bookingAlerts([at('2026-06-02T12:30:00Z')], () => 'w', now).map(a => a.key)).toContain('r9|remind1');
    expect(bookingAlerts([at('2026-06-09T12:30:00Z')], () => 'w', now).map(a => a.key)).toEqual(['r9|Approved']);
  });
});
