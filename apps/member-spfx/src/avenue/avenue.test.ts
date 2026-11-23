import { canSelfCancel, extensionWaiting, hoursThisMonth, overlapHints, toCancelItem, toExtendItem, toIntakeItem, validateExtension, validateRequest } from './booking';
import { addDays, groupByDay, localDay, queryWindow, zonedToUtc } from './calendar';
import type { IBookingRequestInput, ICalendarEntry, IMyRequest } from './contracts';
import { DEMO_FACILITY_ID, demoFetchJson, demoStore, demoWriter } from './demoData';
import type { IIntakeWriter } from './contracts';
import { parseOutcome } from './outcome';
import { toCheckInItem, validateCheckIn } from './checkin';
import { safeFileName, toDocumentItem, validateDocument } from './documents';
import { LISTS, newSubmissionId } from './readSource';

function fakeWriter(): IIntakeWriter & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    add: jest.fn((list: string, item: Record<string, unknown>) => { calls.push(`add ${list} ${JSON.stringify(item)}`); return Promise.resolve(7); }),
    update: jest.fn((list: string, id: number, fields: Record<string, unknown>) => { calls.push(`update ${list} ${id} ${JSON.stringify(fields)}`); return Promise.resolve(); }),
    attach: jest.fn((list: string, id: number, name: string) => { calls.push(`attach ${list} ${id} ${name}`); return Promise.resolve(); })
  };
}
import { AvenueReadSource, isTimeZone, toCalendarEntry, toFacility, toMembership } from './readSource';

const TZ: string = 'America/New_York';

function entry(bookingId: string, startUtc: string, endUtc: string, resourceId: string = 'r1'): ICalendarEntry {
  return { bookingId, resourceId, equipmentIds: [], memberName: 'M', startUtc, endUtc };
}

describe('calendar helpers', () => {
  it('buckets by facility-local day, not UTC day', () => {
    // 02:00Z on the 11th is 21:00 on the 10th in New York (EST).
    expect(localDay('2026-11-11T02:00:00Z', TZ)).toBe('2026-11-10');
  });

  it('adds days across month and DST boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-08', -1)).toBe('2026-03-07');
  });

  it('query window covers the local days with padding', () => {
    expect(queryWindow('2026-11-10', 7)).toEqual({ fromUtc: '2026-11-09T00:00:00Z', toUtc: '2026-11-18T00:00:00Z' });
  });

  it('groups, sorts, filters by resource and excludes out-of-range days', () => {
    const days = groupByDay(
      [
        entry('late', '2026-11-10T20:00:00Z', '2026-11-10T22:00:00Z'),
        entry('early', '2026-11-10T14:00:00Z', '2026-11-10T16:00:00Z'),
        entry('other-resource', '2026-11-10T14:00:00Z', '2026-11-10T16:00:00Z', 'r2'),
        entry('padding-only', '2026-11-09T14:00:00Z', '2026-11-09T16:00:00Z')
      ],
      TZ, '2026-11-10', 2, 'r1'
    );
    expect(days.map(d => d.day)).toEqual(['2026-11-10', '2026-11-11']);
    expect(days[0].entries.map(e => e.bookingId)).toEqual(['early', 'late']);
    expect(days[1].entries).toEqual([]);
  });

  it('shows an overnight booking on both days, but not one ending exactly at local midnight', () => {
    const overnight = entry('overnight', '2026-11-11T03:00:00Z', '2026-11-11T07:00:00Z'); // 22:00–02:00 local
    const toMidnight = entry('to-midnight', '2026-11-11T03:00:00Z', '2026-11-11T05:00:00Z'); // 22:00–00:00 local
    const days = groupByDay([overnight, toMidnight], TZ, '2026-11-10', 2);
    expect(days[0].entries.map(e => e.bookingId).sort()).toEqual(['overnight', 'to-midnight']);
    expect(days[1].entries.map(e => e.bookingId)).toEqual(['overnight']);
  });
});

describe('toCalendarEntry (fail closed, allowlist)', () => {
  const good = {
    FacilityId: 'f1', BookingId: 'b1', ResourceId: 'r1', Space: 'Kitchen', EquipmentIds: 'e1; e2', MemberDisplayName: 'Acme',
    StartUtc: '2026-11-10T14:00:00Z', EndUtc: '2026-11-10T16:00:00Z'
  };

  it('maps a valid row and copies nothing beyond the shared-calendar fields', () => {
    const mapped = toCalendarEntry({ ...good, Balance: 120, MemberEmail: 'a@b.c', WellnessAnswers: 'x' }, 'f1');
    expect(mapped).toEqual({
      bookingId: 'b1', resourceId: 'r1', space: 'Kitchen', equipmentIds: ['e1', 'e2'], memberName: 'Acme',
      startUtc: '2026-11-10T14:00:00.000Z', endUtc: '2026-11-10T16:00:00.000Z'
    });
  });

  it('drops foreign-facility, incomplete, unparseable and inverted rows', () => {
    expect(toCalendarEntry({ ...good, FacilityId: 'f2' }, 'f1')).toBeUndefined();
    expect(toCalendarEntry({ ...good, FacilityId: undefined }, 'f1')).toBeUndefined();
    expect(toCalendarEntry({ ...good, MemberDisplayName: ' ' }, 'f1')).toBeUndefined();
    expect(toCalendarEntry({ ...good, StartUtc: 'not a date' }, 'f1')).toBeUndefined();
    expect(toCalendarEntry({ ...good, EndUtc: good.StartUtc }, 'f1')).toBeUndefined();
  });
});

describe('AvenueReadSource', () => {
  it('rejects a missing or injection-shaped facility id before any request', () => {
    const fetchJson = jest.fn();
    expect(() => new AvenueReadSource('https://x', '', fetchJson)).toThrow();
    expect(() => new AvenueReadSource('https://x', "a' or 1 eq 1 or 'a", fetchJson)).toThrow();
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it('scopes every query to the facility and selects only allowlisted columns', async () => {
    const urls: string[] = [];
    const source = new AvenueReadSource('https://t.sharepoint.com/sites/a/', 'f1', url => {
      urls.push(decodeURIComponent(url));
      return Promise.resolve({ value: [] });
    });
    await source.listResources();
    await source.listCalendar('2026-11-09T00:00:00Z', '2026-11-18T00:00:00Z');
    for (const url of urls) {
      expect(url).toContain("$filter=FacilityId eq 'f1' and ");
    }
    expect(urls[1]).toContain("/sites/a/_api/web/lists/getbytitle('AvenueCalendar')/items?$select=FacilityId,BookingId,ResourceId,Space,EquipmentIds,MemberDisplayName,StartUtc,EndUtc&");
    expect(urls[1]).toContain("StartUtc lt datetime'2026-11-18T00:00:00.000Z' and EndUtc gt datetime'2026-11-09T00:00:00.000Z'");
  });

  it('follows paging links so results beyond one page are not lost', async () => {
    const row = (id: string): object => ({
      FacilityId: 'f1', BookingId: id, ResourceId: 'r1', MemberDisplayName: 'M',
      StartUtc: '2026-11-10T14:00:00Z', EndUtc: '2026-11-10T15:00:00Z'
    });
    const fetchJson = jest.fn()
      .mockResolvedValueOnce({ value: [row('a')], '@odata.nextLink': 'https://x/next' })
      .mockResolvedValueOnce({ value: [row('b')] });
    const entries = await new AvenueReadSource('https://x', 'f1', fetchJson).listCalendar('2026-11-09T00:00:00Z', '2026-11-12T00:00:00Z');
    expect(entries.map(e => e.bookingId)).toEqual(['a', 'b']);
    expect(fetchJson).toHaveBeenNthCalledWith(2, 'https://x/next');
  });

  it('fails rather than returning a partial calendar on a bad response or runaway paging', async () => {
    await expect(new AvenueReadSource('https://x', 'f1', () => Promise.resolve({ error: 'denied' })).listResources()).rejects.toThrow();
    const endless = (): Promise<unknown> => Promise.resolve({ value: [], '@odata.nextLink': 'https://x/next' });
    await expect(new AvenueReadSource('https://x', 'f1', endless).listResources()).rejects.toThrow(/partial/);
  });

  it('fails closed when the facility row is absent or duplicated', async () => {
    const f = { FacilityId: 'f1', Title: 'F', TimeZone: TZ };
    await expect(new AvenueReadSource('https://x', 'f1', () => Promise.resolve({ value: [] })).getFacility()).rejects.toThrow();
    await expect(new AvenueReadSource('https://x', 'f1', () => Promise.resolve({ value: [f, f] })).getFacility()).rejects.toThrow();
    await expect(new AvenueReadSource('https://x', 'f1', () => Promise.resolve({ value: [f] })).getFacility()).resolves.toMatchObject({ facilityId: 'f1', title: 'F', timeZone: TZ, minPrepTables: 2, maxBookingMinutes: undefined });
  });

  it('demo mock: foreign-facility row never reaches the calendar', async () => {
    const source = new AvenueReadSource('https://demo.invalid', DEMO_FACILITY_ID, demoFetchJson);
    const entries = await source.listCalendar('2000-01-01T00:00:00Z', '2100-01-01T00:00:00Z');
    expect(entries.length).toBe(6);
    expect(entries.some(e => e.memberName === 'Must not appear')).toBe(false);
    expect((await source.getFacility()).timeZone).toBe(TZ);
  });
});

describe('zonedToUtc', () => {
  it('is correct in winter and summer', () => {
    expect(zonedToUtc('2026-11-02', '09:00', TZ)).toBe('2026-11-02T14:00:00.000Z');
    expect(zonedToUtc('2026-07-01', '09:00', TZ)).toBe('2026-07-01T13:00:00.000Z');
  });
  it('rejects a bad date', () => {
    expect(() => zonedToUtc('nope', '09:00', TZ)).toThrow();
  });
});

describe('booking requests', () => {
  const NOW: number = Date.parse('2026-11-11T12:00:00Z');
  const ctx = { equipmentIds: ['e1', 'e2'], totalSeats: 60, nowMs: NOW };
  const base: IBookingRequestInput = {
    facilityId: 'f1', space: 'Kitchen', equipmentIds: ['e1'], startUtc: '2026-11-12T14:00:00Z', endUtc: '2026-11-12T18:00:00Z'
  };
  const booked = (space: ICalendarEntry['space'], ids: string[]): ICalendarEntry =>
    ({ bookingId: 'b', resourceId: '', space, equipmentIds: ids, memberName: 'M', startUtc: '2026-11-12T16:00:00Z', endUtc: '2026-11-12T20:00:00Z' });

  it('accepts a good kitchen request', () => {
    expect(validateRequest(base, ctx)).toEqual([]);
  });
  it('rejects bad times, unknown equipment, and missing equipment', () => {
    expect(validateRequest({ ...base, endUtc: base.startUtc }, ctx).length).toBe(1);
    expect(validateRequest({ ...base, startUtc: '2026-11-10T14:00:00Z', endUtc: '2026-11-10T15:00:00Z' }, ctx).length).toBe(1);
    expect(validateRequest({ ...base, equipmentIds: ['zzz'] }, ctx).length).toBe(1);
    expect(validateRequest({ ...base, equipmentIds: [] }, ctx).length).toBe(1);
  });
  it('dining needs a whole number of people within the seats; whole facility takes no equipment', () => {
    const d: IBookingRequestInput = { ...base, space: 'Dining', equipmentIds: [] };
    expect(validateRequest(d, ctx).length).toBe(1);
    expect(validateRequest({ ...d, peopleCount: 1.5 }, ctx).length).toBe(1);
    expect(validateRequest({ ...d, peopleCount: 61 }, ctx).length).toBe(1);
    expect(validateRequest({ ...d, peopleCount: 20 }, ctx)).toEqual([]);
    expect(validateRequest({ ...base, space: 'Whole facility' }, ctx).length).toBe(1);
    expect(validateRequest({ ...base, space: 'Whole facility', equipmentIds: [] }, ctx)).toEqual([]);
  });
  it('hints on shared equipment or a whole-facility booking, not on different equipment or dining', () => {
    expect(overlapHints(base, [booked('Kitchen', ['e1'])]).map(h => h.kind)).toEqual(['equipment']);
    expect(overlapHints(base, [booked('Kitchen', ['e2'])])).toEqual([]);
    expect(overlapHints(base, [booked('Whole facility', [])]).map(h => h.kind)).toEqual(['whole-facility']);
    expect(overlapHints({ ...base, space: 'Whole facility', equipmentIds: [] }, [booked('Kitchen', ['e2'])]).map(h => h.kind)).toEqual(['whole-facility']);
    expect(overlapHints({ ...base, space: 'Dining', equipmentIds: [], peopleCount: 5 }, [booked('Dining', [])])).toEqual([]);
  });
  it('the intake item carries no member identity', () => {
    const item = toIntakeItem(base, 'req-1');
    expect(Object.keys(item).sort()).toEqual(['EndUtc', 'EquipmentIds', 'FacilityId', 'RequestId', 'Space', 'StartUtc', 'Title']);
  });
  it('submitRequest refuses without a sink, for another facility, or with errors; otherwise sends once', async () => {
    const catalog = { equipmentIds: ['e1', 'e2'], totalSeats: 60 };
    const noSink = new AvenueReadSource('https://x', 'f1', jest.fn());
    await expect(noSink.submitRequest(base, 'r', catalog, NOW)).rejects.toThrow();
    const sink = fakeWriter();
    const source = new AvenueReadSource('https://x', 'f1', jest.fn(), sink);
    await expect(source.submitRequest({ ...base, facilityId: 'f2' }, 'r', catalog, NOW)).rejects.toThrow();
    await expect(source.submitRequest({ ...base, equipmentIds: [] }, 'r', catalog, NOW)).rejects.toThrow();
    expect(sink.add).not.toHaveBeenCalled();
    await source.submitRequest(base, 'r', catalog, NOW);
    expect(sink.add).toHaveBeenCalledTimes(1);
  });
  it('demo writer keeps items in memory only', async () => {
    const id: number = await demoWriter.add(LISTS.notices, { a: 1 });
    await demoWriter.update(LISTS.notices, id, { a: 2 });
    expect(demoStore[LISTS.notices].length).toBe(1);
    expect(demoStore[LISTS.notices][0].a).toBe(2);
  });
});

describe('cancellation', () => {
  const NOW: number = Date.parse('2026-11-11T12:00:00Z');
  it('self-cancel only at 24 hours or more ahead', () => {
    expect(canSelfCancel('2026-11-12T12:00:00Z', NOW)).toBe(true);
    expect(canSelfCancel('2026-11-12T11:59:00Z', NOW)).toBe(false);
    expect(canSelfCancel('nope', NOW)).toBe(false);
  });
  it('cancel item names the booking and carries no member field', () => {
    expect(Object.keys(toCancelItem('f1', 'c1', 'b1')).sort()).toEqual(['CancelBookingId', 'FacilityId', 'RequestId', 'Title']);
  });
  it('lists only the member rows that are requests, flags ones with a cancellation, rejects odd ids', async () => {
    const row = (id: string, cancel?: string): object => ({ FacilityId: 'f1', RequestId: id, Space: 'Kitchen', StartUtc: '2026-12-01T14:00:00Z', EndUtc: '2026-12-01T15:00:00Z', CancelBookingId: cancel });
    const sink = fakeWriter();
    const source = new AvenueReadSource('https://x', 'f1', () => Promise.resolve({ value: [row('a'), row('b'), row('c1', 'a')] }), sink);
    const mine = await source.listMyRequests();
    expect(mine.map(m => m.requestId + ':' + m.cancelSent)).toEqual(['a:true', 'b:false']);
    await expect(source.submitCancel("a' or 1 eq 1", 'c2')).rejects.toThrow();
    await source.submitCancel('b', 'c3');
    expect(sink.add).toHaveBeenCalledWith(LISTS.requests, { Title: 'Cancel request', FacilityId: 'f1', RequestId: 'c3', CancelBookingId: 'b' });
  });
});

describe('late cancellation', () => {
  it('a late cancel carries the member message (trimmed, capped); an early one carries none', () => {
    expect(toCancelItem('f1', 'c1', 'b1', '  delivery fell through ')).toMatchObject({ CancelBookingId: 'b1', Message: 'delivery fell through' });
    expect(Object.keys(toCancelItem('f1', 'c1', 'b1', '   '))).not.toContain('Message');
    expect((toCancelItem('f1', 'c1', 'b1', 'x'.repeat(900)).Message as string).length).toBe(500);
  });
  it('"Cancelled (hours kept)" reads as cancelled and still counts as used hours', () => {
    const o = parseOutcome('Cancelled (hours kept) · Note: Too late to release the slot');
    expect(o).toMatchObject({ status: 'Cancelled', hoursKept: true, note: 'Too late to release the slot' });
    expect(parseOutcome('Cancelled').hoursKept).toBe(false);
  });
});
describe('outcome echo', () => {
  it('reads status, note and cancellation flag; tolerates blanks and junk', () => {
    expect(parseOutcome(undefined)).toEqual({ cancelRequested: false, hoursKept: false });
    expect(parseOutcome('Approved')).toEqual({ status: 'Approved', note: undefined, cancelRequested: false, hoursKept: false });
    expect(parseOutcome('Declined · Note: Refused automatically: the requested time is not valid.'))
      .toEqual({ status: 'Declined', note: 'Refused automatically: the requested time is not valid.', cancelRequested: false, hoursKept: false });
    expect(parseOutcome('Approved · cancellation requested, Flavors will reply').cancelRequested).toBe(true);
    expect(parseOutcome('Hacked status').status).toBeUndefined();
  });
  it('my requests carry the echoed status', async () => {
    const rowWith = (outcome: string): object => ({ FacilityId: 'f1', RequestId: 'a', Space: 'Kitchen', StartUtc: '2026-12-01T14:00:00Z', EndUtc: '2026-12-01T15:00:00Z', Outcome: outcome });
    const source = new AvenueReadSource('https://x', 'f1', () => Promise.resolve({ value: [rowWith('Pending')] }));
    expect((await source.listMyRequests())[0].status).toBe('Pending');
  });
});

describe('check-in', () => {
  const qs = [{ id: 1, kind: 'Entry' as const, text: 'Q1', order: 2 }, { id: 2, kind: 'Entry' as const, text: 'Q2', order: 1 }, { id: 3, kind: 'Exit' as const, text: 'Q3', order: 1 }];
  it('requires a booking, configured questions and every answer', () => {
    expect(validateCheckIn({ facilityId: 'f1', bookingId: '', kind: 'Entry', answers: { 1: 'Yes', 2: 'Yes' } }, qs).length).toBe(1);
    expect(validateCheckIn({ facilityId: 'f1', bookingId: 'b1', kind: 'Entry', answers: { 1: 'Yes' } }, qs).length).toBe(1);
    expect(validateCheckIn({ facilityId: 'f1', bookingId: 'b1', kind: 'Entry', answers: {} }, []).length).toBe(1);
    expect(validateCheckIn({ facilityId: 'f1', bookingId: 'b1', kind: 'Entry', answers: { 1: 'Yes', 2: 'No' } }, qs)).toEqual([]);
  });
  it('stores answers in question order with text, passes only when all Yes, and has no member field', () => {
    const item = toCheckInItem({ facilityId: 'f1', bookingId: 'b1', kind: 'Entry', answers: { 1: 'Yes', 2: 'No' } }, qs, 's1');
    expect(JSON.parse(item.Answers as string)).toEqual([{ q: 'Q2', a: 'No' }, { q: 'Q1', a: 'Yes' }]);
    expect(item.AllPassed).toBe(false);
    expect(Object.keys(item).some(k => /member/i.test(k))).toBe(false);
  });
  it('submitCheckIn validates before writing', async () => {
    const w = fakeWriter();
    const source = new AvenueReadSource('https://x', 'f1', jest.fn(), w);
    await expect(source.submitCheckIn({ facilityId: 'f1', bookingId: 'b1', kind: 'Entry', answers: {} }, qs, 's1')).rejects.toThrow();
    expect(w.add).not.toHaveBeenCalled();
    await source.submitCheckIn({ facilityId: 'f1', bookingId: 'b1', kind: 'Exit', answers: { 3: 'Yes' } }, qs, 's2');
    expect(w.add).toHaveBeenCalledTimes(1);
  });
});

describe('documents', () => {
  const ok = { facilityId: 'f1', docType: 'Licence' as const, issueDate: '2026-01-01', expiryDate: '2027-01-01', file: { name: 'licence.pdf', size: 1000 } };
  it('accepts a good document and rejects bad dates, types, sizes and missing files', () => {
    expect(validateDocument(ok)).toEqual([]);
    expect(validateDocument({ ...ok, expiryDate: '2025-12-31' }).length).toBe(1);
    expect(validateDocument({ ...ok, issueDate: '2026-02-30' }).length).toBe(1);
    expect(validateDocument({ ...ok, docType: undefined }).length).toBe(1);
    expect(validateDocument({ ...ok, file: { name: 'run.exe', size: 10 } }).length).toBe(1);
    expect(validateDocument({ ...ok, file: { name: 'big.pdf', size: 11 * 1024 * 1024 } }).length).toBe(1);
    expect(validateDocument({ ...ok, file: undefined }).length).toBe(1);
  });
  it('makes file names safe and keeps the extension', () => {
    expect(safeFileName('My Licence (2026)!.PDF')).toBe('My-Licence-2026.pdf');
    expect(safeFileName("../../x'; drop.pdf")).toBe('x-drop.pdf');
    expect(safeFileName('???.png')).toBe('document.png');
  });
  it('writes date-only values at noon UTC, starts as Uploading, and carries no member field', () => {
    const item = toDocumentItem(ok, 'd1');
    expect(item.ExpiryDate).toBe('2027-01-01T12:00:00Z');
    expect(item.Outcome).toBe('Uploading');
    expect(Object.keys(item).some(k => /member/i.test(k))).toBe(false);
  });
  it('submitDocument adds, attaches, then clears Uploading, in that order', async () => {
    const w = fakeWriter();
    const source = new AvenueReadSource('https://x', 'f1', jest.fn(), w);
    const file = Object.assign(new Blob(['x']), { name: 'my licence.pdf' });
    await source.submitDocument(ok, file, 'd1');
    expect(w.calls.map(c => c.split(' ')[0])).toEqual(['add', 'attach', 'update']);
    expect(w.calls[1]).toBe(`attach ${LISTS.documentSubmissions} 7 my-licence.pdf`);
    expect(w.calls[2]).toBe(`update ${LISTS.documentSubmissions} 7 {"Outcome":null}`);
  });
  it('submitDocument refuses invalid input without writing', async () => {
    const w = fakeWriter();
    const source = new AvenueReadSource('https://x', 'f1', jest.fn(), w);
    await expect(source.submitDocument({ ...ok, expiryDate: '2020-01-01' }, Object.assign(new Blob(['x']), { name: 'a.pdf' }), 'd2')).rejects.toThrow();
    expect(w.calls.length).toBe(0);
  });
});

describe('submission ids', () => {
  it('are unique and safe to use in an OData filter', () => {
    const a: string = newSubmissionId('req');
    expect(a).toMatch(/^req-[a-z0-9]+-[A-Za-z0-9]+$/);
    expect(newSubmissionId('req')).not.toBe(a);
  });
});

describe('hoursThisMonth', () => {
  const r = (startUtc: string, endUtc: string, status?: 'Approved' | 'Pending' | 'Cancelled' | 'No-show credited'): IMyRequest =>
    ({ requestId: startUtc, space: 'Kitchen', startUtc, endUtc, cancelSent: false, status, cancelRequested: false });
  const tz = 'America/New_York';
  const now = new Date('2026-11-15T15:00:00Z');
  it('counts only approved bookings in the facility-local month', () => {
    expect(hoursThisMonth([
      r('2026-11-02T14:00:00Z', '2026-11-02T18:00:00Z', 'Approved'),
      r('2026-11-20T14:00:00Z', '2026-11-20T15:30:00Z', 'Approved'),
      r('2026-11-03T14:00:00Z', '2026-11-03T18:00:00Z', 'Pending'),
      r('2026-11-04T14:00:00Z', '2026-11-04T18:00:00Z', 'Cancelled'),
      r('2026-11-05T14:00:00Z', '2026-11-05T18:00:00Z', 'No-show credited'),
      r('2026-10-30T14:00:00Z', '2026-10-30T18:00:00Z', 'Approved')
    ], tz, now)).toBe(5.5);
  });
  it('uses the facility month, not the UTC month', () => {
    // 1 Dec 01:00 UTC is still 30 Nov evening in New York.
    expect(hoursThisMonth([r('2026-12-01T01:00:00Z', '2026-12-01T03:00:00Z', 'Approved')], tz, now)).toBe(2);
    expect(hoursThisMonth([r('2026-11-01T02:00:00Z', '2026-11-01T03:00:00Z', 'Approved')], tz, now)).toBe(0);
  });
});

describe('extra time (BKG-08)', () => {
  const now = Date.parse('2026-11-15T15:00:00Z');
  const booking = (over: Partial<IMyRequest> = {}): IMyRequest => ({
    requestId: 'req-1', space: 'Kitchen', startUtc: '2026-11-15T14:00:00Z', endUtc: '2026-11-15T16:00:00Z',
    cancelSent: false, status: 'Approved', cancelRequested: false, ...over
  });
  it('accepts a later end on an approved booking that has not ended', () => {
    expect(validateExtension(booking(), '2026-11-15T17:00:00Z', now)).toEqual([]);
  });
  it('refuses an earlier or equal end, an unapproved or ended booking, and a second waiting request', () => {
    expect(validateExtension(booking(), '2026-11-15T16:00:00Z', now).length).toBe(1);
    expect(validateExtension(booking({ status: 'Pending' }), '2026-11-15T17:00:00Z', now).length).toBe(1);
    expect(validateExtension(booking({ endUtc: '2026-11-15T14:30:00Z' }), '2026-11-15T17:00:00Z', now).length).toBe(1);
    const waiting = booking({ extension: { requestId: 'e1', bookingId: 'req-1', endUtc: '2026-11-15T17:00:00Z' } });
    expect(validateExtension(waiting, '2026-11-15T18:00:00Z', now).length).toBe(1);
  });
  it('treats only unanswered or "Extension requested" outcomes as waiting', () => {
    expect(extensionWaiting({ requestId: 'e', bookingId: 'b', endUtc: 'x' })).toBe(true);
    expect(extensionWaiting({ requestId: 'e', bookingId: 'b', endUtc: 'x', outcome: 'Extension requested · Flavors will reply' })).toBe(true);
    expect(extensionWaiting({ requestId: 'e', bookingId: 'b', endUtc: 'x', outcome: 'Extension not approved' })).toBe(false);
    expect(extensionWaiting(undefined)).toBe(false);
  });
  it('names the booking but never the member', () => {
    const item = toExtendItem('f1', 'ext-1', booking(), '2026-11-15T17:00:00Z');
    expect(Object.keys(item).sort()).toEqual(['EndUtc', 'ExtendBookingId', 'FacilityId', 'RequestId', 'Space', 'StartUtc', 'Title']);
    expect(item.ExtendBookingId).toBe('req-1');
  });
});

describe('own items', () => {
  it('filters intake lists by the signed-in author (admins bypass item-level read) and leaves shared lists alone', async () => {
    const urls: string[] = [];
    const source = new AvenueReadSource('https://x', 'f1', url => { urls.push(decodeURIComponent(url)); return Promise.resolve({ value: [] }); }, undefined, 7);
    await source.listMyRequests();
    await source.listMyHostRequests();
    await source.listResources();
    expect(urls[0]).toContain("FacilityId eq 'f1' and AuthorId eq 7");
    expect(urls[1]).toContain('AuthorId eq 7');
    expect(urls[2]).not.toContain('AuthorId');
  });
});
describe('listMyRequests with extensions', () => {
  it('ignores foreign and malformed rows without losing valid requests', async () => {
    const valid = { FacilityId: 'f1', RequestId: 'b1', Space: 'Dining', StartUtc: '2026-11-15T14:00:00Z', EndUtc: '2026-11-15T16:00:00Z', Outcome: 'Approved' };
    const rows = [valid,
      { ...valid, RequestId: 'bad-end', EndUtc: 'invalid' },
      { ...valid, RequestId: 'backwards', EndUtc: '2026-11-15T13:00:00Z' },
      { ...valid, FacilityId: 'f2', RequestId: 'foreign' },
      { FacilityId: 'f2', RequestId: 'cancel', CancelBookingId: 'b1' },
      { FacilityId: 'f2', RequestId: 'extension', ExtendBookingId: 'b1', EndUtc: '2026-11-15T20:00:00Z', Outcome: 'Extension approved' }
    ];
    const source = new AvenueReadSource('https://x', 'f1', () => Promise.resolve({ value: rows }));
    const list = await source.listMyRequests();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ requestId: 'b1', cancelSent: false, endUtc: '2026-11-15T16:00:00.000Z' });
    expect(list[0].extension).toBeUndefined();
  });

  it('hides extension items and moves the end only for an approved extension', async () => {
    const rows = [
      { FacilityId: 'f1', RequestId: 'req-1', Space: 'Kitchen', StartUtc: '2026-11-15T14:00:00Z', EndUtc: '2026-11-15T16:00:00Z', Outcome: 'Approved' },
      { FacilityId: 'f1', RequestId: 'ext-1', ExtendBookingId: 'req-1', Space: 'Kitchen', StartUtc: '2026-11-15T14:00:00Z', EndUtc: '2026-11-15T17:00:00Z', Outcome: 'Extension approved · now ends 12:00 PM' },
      { FacilityId: 'f1', RequestId: 'req-2', Space: 'Kitchen', StartUtc: '2026-11-16T14:00:00Z', EndUtc: '2026-11-16T16:00:00Z', Outcome: 'Approved' },
      { FacilityId: 'f1', RequestId: 'ext-2', ExtendBookingId: 'req-2', Space: 'Kitchen', StartUtc: '2026-11-16T14:00:00Z', EndUtc: '2026-11-16T18:00:00Z', Outcome: 'Extension not approved' }
    ];
    const source = new AvenueReadSource('https://x/sites/a', 'f1', () => Promise.resolve({ value: rows }));
    const list = await source.listMyRequests();
    expect(list.map(r => r.requestId)).toEqual(['req-1', 'req-2']);
    expect(list[0].endUtc).toBe('2026-11-15T17:00:00.000Z');
    expect(list[1].endUtc).toBe('2026-11-16T16:00:00.000Z');
    expect(list[1].extension?.outcome).toBe('Extension not approved');
  });
});

describe('membership', () => {
  it('maps the row and plan, rejecting out-of-range values', () => {
    expect(toMembership({ BusinessName: 'B', PlanId: 'p1', CollectionDay: 5, Status: 'Active' }, { Title: 'Basic', MonthlyHours: 10 }))
      .toEqual({ businessName: 'B', status: 'Active', planId: 'p1', planName: 'Basic', monthlyHours: 10, collectionDay: 5 });
    expect(toMembership({ CollectionDay: 16 }, undefined).collectionDay).toBeUndefined();
    expect(toMembership({ CollectionDay: 2.5 }, undefined).collectionDay).toBeUndefined();
    expect(toMembership({}, { MonthlyHours: -1 }).monthlyHours).toBeUndefined();
  });
  it('reads only the signed-in member\'s row and its active plan', async () => {
    const urls: string[] = [];
    const source = new AvenueReadSource('https://x/sites/a', 'f1', url => {
      urls.push(decodeURIComponent(url));
      return Promise.resolve({ value: url.indexOf('AvenueMyMembership') >= 0
        ? [{ MemberId: 'm@x.com', BusinessName: 'B', PlanId: 'p1', CollectionDay: 3, Status: 'Active' }]
        : [{ PlanId: 'p1', Title: 'Basic', MonthlyHours: 10 }] });
    });
    const m = await source.getMyMembership(' M@X.com ');
    expect(m?.planName).toBe('Basic');
    expect(urls[0]).toContain("MemberId eq 'm@x.com'");
    expect(urls[1]).toContain("PlanId eq 'p1' and Active eq 1");
  });
  it('fails closed on a bad e-mail or an ambiguous result', async () => {
    let calls = 0;
    const two = new AvenueReadSource('https://x/sites/a', 'f1', () => { calls++; return Promise.resolve({ value: [{}, {}] }); });
    expect(await two.getMyMembership("x' or 1 eq 1 or 'a@b.c")).toBeUndefined();
    expect(calls).toBe(0);
    expect(await two.getMyMembership('a@b.co')).toBeUndefined();
  });
});

describe('facility time zone', () => {
  it('rejects a name Intl cannot use, so no screen throws while rendering', () => {
    expect(isTimeZone('America/New_York')).toBe(true);
    expect(isTimeZone('Eastern Standard Time')).toBe(false);
    expect(toFacility({ FacilityId: 'f', Title: 'F', TimeZone: 'Eastern Standard Time' }, 'f')).toBeUndefined();
  });
});

describe('zonedToUtc around clock changes', () => {
  it('a time that does not exist moves forward, not back', () => {
    expect(zonedToUtc('2026-03-08', '02:30', TZ)).toBe('2026-03-08T07:30:00.000Z');
  });
  it('a time that happens twice takes the first', () => {
    expect(zonedToUtc('2026-11-01', '01:30', TZ)).toBe('2026-11-01T05:30:00.000Z');
  });
  it('ordinary days are unchanged either side', () => {
    expect(zonedToUtc('2026-03-08', '09:00', TZ)).toBe('2026-03-08T13:00:00.000Z');
    expect(zonedToUtc('2026-11-01', '09:00', TZ)).toBe('2026-11-01T14:00:00.000Z');
  });
});

describe('staff upload on behalf of a member', () => {
  const base = { facilityId: 'f', docType: 'Permit' as const, issueDate: '2026-01-01', expiryDate: '2027-01-01', file: { name: 'a.pdf', size: 10 } };
  it('adds OnBehalfOf lower-cased, only when given', () => {
    expect(toDocumentItem({ ...base, onBehalfOf: ' Pat@Example.com ' }, 's1').OnBehalfOf).toBe('pat@example.com');
    expect('OnBehalfOf' in toDocumentItem(base, 's1')).toBe(false);
  });
  it('rejects a bad e-mail', () => {
    expect(validateDocument({ ...base, onBehalfOf: 'not-an-email' }).length).toBe(1);
    expect(validateDocument({ ...base, onBehalfOf: 'pat@example.com' })).toEqual([]);
  });
});
