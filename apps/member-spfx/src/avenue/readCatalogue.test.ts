import { AvenueReadSource, sortNotices, toFacility, toNotice, toResource } from './readSource';

const NOW: number = Date.parse('2026-11-18T12:00:00Z');
const notice = (id: number, extra: Record<string, unknown> = {}): Record<string, unknown> => ({ Id: id, Title: `N${id}`, PublishedAt: `2026-11-1${id}T10:00:00Z`, ...extra });

describe('toFacility new columns', () => {
  const row = { FacilityId: 'f', Title: 'F', TimeZone: 'America/New_York' };
  it('leaves empty values undefined and defaults only minPrepTables', () => {
    expect(toFacility(row, 'f')).toMatchObject({ minPrepTables: 2, minBookingMinutes: undefined, entryGraceMinutes: undefined, maxCompaniesInKitchen: undefined });
    expect(toFacility({ ...row, MinBookingMinutes: '', MaxBookingMinutes: null, MinPrepTables: null }, 'f')?.minPrepTables).toBe(2);
  });
  it('reads numbers (also as text) and keeps a zero grace', () => {
    expect(toFacility({ ...row, MinBookingMinutes: 60, BookingStepMinutes: '30', EntryGraceMinutes: 30, ExitGraceMinutes: 0, MinPrepTables: 3, CheckoutAlertMinutes: 20 }, 'f'))
      .toMatchObject({ minBookingMinutes: 60, bookingStepMinutes: 30, entryGraceMinutes: 30, exitGraceMinutes: 0, minPrepTables: 3, checkoutAlertMinutes: 20 });
  });
});

describe('toResource new columns', () => {
  const row = { FacilityId: 'f', EquipmentId: 'e1', Title: 'Stove #1', Kind: 'Equipment' };
  it('missing columns map to undefined and bookable defaults to true', () => {
    expect(toResource(row, 'f')).toMatchObject({ resourceId: 'e1', category: undefined, photoUrl: undefined, sortOrder: undefined, bookable: true });
  });
  it('maps known values and drops bad ones', () => {
    expect(toResource({ ...row, Category: 'Stove', SortOrder: 2, BookableByMembers: false, GroupId: 'oven-1', PhotoUrl: 'https://x/y.jpg', Location: 'Line 1', Description: 'Gas' }, 'f'))
      .toMatchObject({ category: 'Stove', sortOrder: 2, bookable: false, groupId: 'oven-1', photoUrl: 'https://x/y.jpg', location: 'Line 1', description: 'Gas' });
    expect(toResource({ ...row, Category: 'Spaceship', PhotoUrl: 'data:text/html,x', GroupId: 'a b' }, 'f')).toMatchObject({ category: undefined, photoUrl: undefined, groupId: undefined });
  });
});

describe('notices', () => {
  it('defaults category and pinned, drops expired, keeps unexpired', () => {
    expect(toNotice(notice(1), NOW)).toMatchObject({ category: 'General', pinned: false, expiresUtc: undefined });
    expect(toNotice(notice(1, { Category: 'Urgent', Pinned: true, Audience: 'Caterers' }), NOW)).toMatchObject({ category: 'Urgent', pinned: true, audience: 'Caterers' });
    expect(toNotice(notice(1, { Category: 'Weird' }), NOW)?.category).toBe('General');
    expect(toNotice(notice(1, { ExpiresAt: '2026-11-18T11:59:00Z' }), NOW)).toBeUndefined();
    expect(toNotice(notice(1, { ExpiresAt: '2026-11-19T00:00:00Z' }), NOW)).toBeDefined();
  });
  it('listNotices sorts pinned first then newest and filters expired', async () => {
    const rows = [notice(1), notice(3), notice(2, { Pinned: true }), notice(4, { ExpiresAt: '2026-11-01T00:00:00Z' })].map(r => ({ ...r, FacilityId: 'f' }));
    const source = new AvenueReadSource('https://x', 'f', () => Promise.resolve({ value: rows }));
    expect((await source.listNotices(NOW)).map(n => n.id)).toEqual([2, 3, 1]);
    expect(sortNotices([]).length).toBe(0);
  });
});
