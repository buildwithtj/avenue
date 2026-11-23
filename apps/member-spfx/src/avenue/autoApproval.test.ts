import type { ICalendarEntry, IFacility } from './contracts';
import { buildBusyMap } from './availability';
import { type IAutoApprovalInput, decideAutoApproval } from './autoApproval';

const F: IFacility = { facilityId: 'f', title: 'F', timeZone: 'America/New_York', autoApproveWhenFree: true, minBookingMinutes: 60, maxBookingMinutes: 480 };
const S = '2026-10-14T19:00:00Z';
const E = '2026-10-14T21:00:00Z';
const entry = (id: string, ids: string[], s: string, e: string, space: ICalendarEntry['space'] = 'Kitchen'): ICalendarEntry =>
  ({ bookingId: id, resourceId: '', space, equipmentIds: ids, memberName: id, startUtc: s, endUtc: e });
const base = (o: Partial<IAutoApprovalInput> = {}): IAutoApprovalInput => ({
  mode: 'equipment', unitIds: ['s1', 'p1', 'p2'], startUtc: S, endUtc: E, memberActive: true, expiredDocs: 0, ownerOverride: false,
  busy: buildBusyMap([]), facility: F, nowMs: Date.parse('2026-10-01T00:00:00Z'), ...o
});

describe('decideAutoApproval', () => {
  it('approves a free, valid request when the setting is on', () => {
    expect(decideAutoApproval(base())).toEqual({ approve: true, reasons: [] });
  });
  it('never approves when the setting is off or undefined', () => {
    expect(decideAutoApproval(base({ facility: { ...F, autoApproveWhenFree: false } })).approve).toBe(false);
    expect(decideAutoApproval(base({ facility: { ...F, autoApproveWhenFree: undefined } })).approve).toBe(false);
    expect(decideAutoApproval(base({ facility: { ...F, autoApproveWhenFree: false } })).reasons).toEqual(['Auto-approval is off.']);
  });
  it('member must be active', () => {
    const r = decideAutoApproval(base({ memberActive: false }));
    expect(r.approve).toBe(false);
    expect(r.reasons[0]).toMatch(/not active/);
  });
  it('an expired document blocks unless the owner overrode it', () => {
    expect(decideAutoApproval(base({ expiredDocs: 1 })).approve).toBe(false);
    expect(decideAutoApproval(base({ expiredDocs: 1, ownerOverride: true })).approve).toBe(true);
    expect(decideAutoApproval(base({ expiredDocs: 0, ownerOverride: false })).approve).toBe(true);
  });
  it('an approved booking on any requested unit blocks, a different unit does not', () => {
    expect(decideAutoApproval(base({ busy: buildBusyMap([entry('a', ['p2'], '2026-10-14T20:00:00Z', '2026-10-14T22:00:00Z')]) })).approve).toBe(false);
    expect(decideAutoApproval(base({ busy: buildBusyMap([entry('a', ['s2'], S, E)]) })).approve).toBe(true);
  });
  it('touching bookings are not an overlap', () => {
    const busy = buildBusyMap([entry('a', ['s1'], '2026-10-14T17:00:00Z', S), entry('b', ['s1'], E, '2026-10-14T23:00:00Z')]);
    expect(decideAutoApproval(base({ busy })).approve).toBe(true);
  });
  it('an approved private event (whole facility) blocks everything', () => {
    const busy = buildBusyMap([entry('pe', [], S, E, 'Whole facility')]);
    expect(decideAutoApproval(base({ busy })).approve).toBe(false);
    expect(decideAutoApproval(base({ mode: 'dining', unitIds: [], busy })).approve).toBe(false);
  });
  it('whole kitchen: any one busy unit blocks; private event also needs the dining room free', () => {
    const units = ['s1', 's2', 'p1'];
    expect(decideAutoApproval(base({ mode: 'whole-kitchen', unitIds: units })).approve).toBe(true);
    expect(decideAutoApproval(base({ mode: 'whole-kitchen', unitIds: units, busy: buildBusyMap([entry('a', ['s2'], S, E)]) })).approve).toBe(false);
    const dining = buildBusyMap([entry('d', [], S, E, 'Dining')]);
    expect(decideAutoApproval(base({ mode: 'whole-kitchen', unitIds: units, busy: dining })).approve).toBe(true);
    expect(decideAutoApproval(base({ mode: 'private-event', unitIds: units, busy: dining })).approve).toBe(false);
  });
  it('dining: approved dining booking in the window stops auto-approval (no table data, fail closed)', () => {
    expect(decideAutoApproval(base({ mode: 'dining', unitIds: [] })).approve).toBe(true);
    expect(decideAutoApproval(base({ mode: 'dining', unitIds: [], busy: buildBusyMap([entry('d', [], S, E, 'Dining')]) })).approve).toBe(false);
  });
  it('equipment request with no units is not auto-approved', () => {
    expect(decideAutoApproval(base({ unitIds: [] })).approve).toBe(false);
  });
  it('length is checked only when defined', () => {
    expect(decideAutoApproval(base({ endUtc: '2026-10-14T19:30:00Z' })).approve).toBe(false);
    expect(decideAutoApproval(base({ endUtc: '2026-10-15T08:00:00Z' })).approve).toBe(false);
    const open: IFacility = { ...F, minBookingMinutes: undefined, maxBookingMinutes: undefined };
    expect(decideAutoApproval(base({ facility: open, endUtc: '2026-10-14T19:15:00Z' })).approve).toBe(true);
    expect(decideAutoApproval(base({ facility: open, endUtc: '2026-10-16T19:00:00Z' })).approve).toBe(true);
  });
  it('past, reversed or invalid times are not approved', () => {
    expect(decideAutoApproval(base({ nowMs: Date.parse('2026-10-14T19:30:00Z') })).approve).toBe(false);
    expect(decideAutoApproval(base({ startUtc: E, endUtc: S })).approve).toBe(false);
    expect(decideAutoApproval(base({ startUtc: 'nope' })).approve).toBe(false);
  });
  it('collects every reason', () => {
    const r = decideAutoApproval(base({ memberActive: false, expiredDocs: 2, busy: buildBusyMap([entry('a', ['s1'], S, E)]) }));
    expect(r.reasons.length).toBe(3);
  });
});
