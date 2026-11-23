import { DEPOSIT_CENTS, eventQuote, PACKAGES, toEventItem, validateEvent } from './events';

const ok = { facilityId: 'f', pkg: 'Opulence' as const, eventDate: '2027-02-10', guests: 40, notes: '' };

describe('events', () => {
  it('has the sheet member prices', () => {
    expect(Object.keys(PACKAGES).map(k => PACKAGES[k as keyof typeof PACKAGES].priceCents)).toEqual([95000, 120000, 140000, 185000]);
    expect(PACKAGES.Platinum.hours).toBe(12);
    expect(DEPOSIT_CENTS).toBe(50000);
  });
  it('validates package, date, guests and notes', () => {
    expect(validateEvent(ok, '2026-11-23')).toEqual([]);
    expect(validateEvent({ ...ok, pkg: '' }, '2026-11-23').length).toBe(1);
    expect(validateEvent({ ...ok, eventDate: '2026-11-23' }, '2026-11-23')).toEqual(['The event date must be after today.']);
    expect(validateEvent({ ...ok, eventDate: '' }, '2026-11-23')).toEqual(['Choose the event date.']);
    expect(validateEvent({ ...ok, guests: 0 }, '2026-11-23').length).toBe(1);
    expect(validateEvent({ ...ok, guests: 61 }, '2026-11-23').length).toBe(1);
    expect(validateEvent({ ...ok, guests: 2.5 }, '2026-11-23').length).toBe(1);
    expect(validateEvent({ ...ok, notes: 'x'.repeat(1001) }, '2026-11-23').length).toBe(1);
  });
  it('balance is due 30 days before, or now when sooner, including month ends and the boundary', () => {
    expect(eventQuote('Opulence', '2027-03-15', '2026-11-23', 10)).toMatchObject({ balanceDueYmd: '2027-02-13', balanceDueNow: false, packageCents: 120000, hours: 6 });
    expect(eventQuote('Simplicity', '2026-12-10', '2026-11-23', 10)).toMatchObject({ balanceDueYmd: '2026-11-23', balanceDueNow: true });
    expect(eventQuote('Simplicity', '2026-12-23', '2026-11-23', 10)).toMatchObject({ balanceDueYmd: '2026-11-23', balanceDueNow: true });
    expect(eventQuote('Simplicity', '2026-12-24', '2026-11-23', 10)).toMatchObject({ balanceDueYmd: '2026-11-24', balanceDueNow: false });
    expect(eventQuote('Simplicity', '2027-03-01', '2026-11-23', 10).balanceDueYmd).toBe('2027-01-30');
  });
  it('flags a party over the 50 seats', () => {
    expect(eventQuote('Simplicity', '2027-03-01', '2026-11-23', 51).overSeats).toBe(true);
    expect(eventQuote('Simplicity', '2027-03-01', '2026-11-23', 50).overSeats).toBe(false);
  });
  it('writes the date at noon UTC so no time zone moves it a day', () => {
    expect(toEventItem(ok, 'r1')).toMatchObject({ RequestId: 'r1', Package: 'Opulence', EventDate: '2027-02-10T12:00:00Z', Guests: 40 });
  });
});
