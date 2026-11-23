import { equipmentAvailability, sentOutcome, stepProblems, stepsFor } from './bookingFlow';
import type { ICalendarEntry, IMyRequest, IResource } from './contracts';

const RES: IResource[] = [{ resourceId: 'oven', title: 'Oven', kind: 'Equipment' }, { resourceId: 'mixer', title: 'Mixer', kind: 'Equipment' }];
const NOW = Date.parse('2026-11-14T15:00:00Z');
const CTX = { equipmentIds: ['oven', 'mixer'], totalSeats: 20, nowMs: NOW };
const entry = (id: string, s: string, e: string, eq: string[], space: ICalendarEntry['space'] = 'Kitchen'): ICalendarEntry =>
  ({ bookingId: id, resourceId: '', space, equipmentIds: eq, memberName: 'M ' + id, startUtc: s, endUtc: e });

describe('equipmentAvailability', () => {
  const entries = [entry('a', '2026-11-15T14:00:00Z', '2026-11-15T16:00:00Z', ['oven']), entry('w', '2026-11-16T14:00:00Z', '2026-11-16T16:00:00Z', [], 'Whole facility')];
  it('marks only the equipment that is booked at that time', () => {
    const r = equipmentAvailability(RES, entries, '2026-11-15T15:00:00Z', '2026-11-15T17:00:00Z');
    expect(r.find(x => x.resourceId === 'oven')!.busyWith.map(e => e.bookingId)).toEqual(['a']);
    expect(r.find(x => x.resourceId === 'mixer')!.busyWith).toEqual([]);
  });
  it('a whole-facility booking makes everything busy', () => {
    const r = equipmentAvailability(RES, entries, '2026-11-16T15:00:00Z', '2026-11-16T15:30:00Z');
    expect(r.every(x => x.busyWith.length === 1)).toBe(true);
  });
  it('touching ends do not overlap', () => {
    const r = equipmentAvailability(RES, entries, '2026-11-15T16:00:00Z', '2026-11-15T17:00:00Z');
    expect(r.every(x => x.busyWith.length === 0)).toBe(true);
  });
  it('an invalid or empty range reports nothing busy', () => {
    expect(equipmentAvailability(RES, entries, 'nope', '2026-11-15T17:00:00Z').every(x => x.busyWith.length === 0)).toBe(true);
    expect(equipmentAvailability(RES, entries, '2026-11-15T17:00:00Z', '2026-11-15T16:00:00Z').every(x => x.busyWith.length === 0)).toBe(true);
    expect(equipmentAvailability(RES, [], '2026-11-15T15:00:00Z', '2026-11-15T17:00:00Z').every(x => x.busyWith.length === 0)).toBe(true);
  });
});

describe('steps', () => {
  const ok = { startUtc: '2026-11-15T14:00:00Z', endUtc: '2026-11-15T16:00:00Z' };
  it('kitchen has an equipment step; dining and private events do not', () => {
    expect(stepsFor('Kitchen')).toEqual(['details', 'equipment', 'review']);
    expect(stepsFor('Dining')).toEqual(['details', 'review']);
    expect(stepsFor('Whole facility')).toEqual(['details', 'review']);
  });
  it('details step checks time only (and people for dining)', () => {
    expect(stepProblems('details', { space: 'Kitchen', equipmentIds: [], ...ok }, CTX)).toEqual([]);
    expect(stepProblems('details', { space: 'Kitchen', equipmentIds: [], startUtc: '2026-11-14T10:00:00Z', endUtc: '2026-11-14T12:00:00Z' }, CTX).join(' ')).toMatch(/past/);
    expect(stepProblems('details', { space: 'Kitchen', equipmentIds: [], startUtc: ok.endUtc, endUtc: ok.startUtc }, CTX).join(' ')).toMatch(/after the start/);
    expect(stepProblems('details', { space: 'Dining', equipmentIds: [], ...ok }, CTX).join(' ')).toMatch(/people/);
    expect(stepProblems('details', { space: 'Dining', equipmentIds: [], peopleCount: 21, ...ok }, CTX).join(' ')).toMatch(/seats 20/);
    expect(stepProblems('details', { space: 'Dining', equipmentIds: [], peopleCount: 12, ...ok }, CTX)).toEqual([]);
  });
  it('equipment step requires at least one valid item for the kitchen', () => {
    expect(stepProblems('equipment', { space: 'Kitchen', equipmentIds: [], ...ok }, CTX).join(' ')).toMatch(/equipment/);
    expect(stepProblems('equipment', { space: 'Kitchen', equipmentIds: ['ghost'], ...ok }, CTX).join(' ')).toMatch(/not available/);
    expect(stepProblems('equipment', { space: 'Kitchen', equipmentIds: ['oven'], ...ok }, CTX)).toEqual([]);
  });
  it('review step runs every rule', () => {
    expect(stepProblems('review', { space: 'Kitchen', equipmentIds: ['oven'], ...ok }, CTX)).toEqual([]);
    expect(stepProblems('review', { space: 'Whole facility', equipmentIds: ['oven'], ...ok }, CTX).join(' ')).toMatch(/no equipment/);
    expect(stepProblems('review', { space: 'Kitchen', equipmentIds: ['oven'] }, CTX).length).toBeGreaterThan(0);
  });
});

describe('sentOutcome', () => {
  const req = (status: IMyRequest['status'], note?: string): IMyRequest => ({ requestId: 'r', space: 'Kitchen', startUtc: 's', endUtc: 'e', cancelSent: false, cancelRequested: false, status, note });
  it('says "checking" until the flow answers', () => {
    expect(sentOutcome(undefined).state).toBe('checking');
    expect(sentOutcome(req(undefined)).final).toBe(false);
  });
  it('reports the flow\'s real result and note', () => {
    expect(sentOutcome(req('Approved'))).toMatchObject({ state: 'approved', final: true });
    const w = sentOutcome(req('Pending', 'Sample conflict'));
    expect(w).toMatchObject({ state: 'waiting', final: true });
    expect(w.detail).toBe('Sample conflict');
    const d = sentOutcome(req('Declined', 'Refused automatically: a required document has expired. The Flavors owner can override.'));
    expect(d.state).toBe('declined');
    expect(d.detail).toMatch(/document has expired/);
    expect(sentOutcome(req('Declined')).detail).toBe('No reason was given.');
  });
});
