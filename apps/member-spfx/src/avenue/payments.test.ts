import { dueInfo, eventDepositRefundCents, monthlyCharge, nextDueDate, overageCents } from './payments';

describe('payments (client sheet rules)', () => {
  it('adds 3% to current plans: $800 -> $824, $1400 -> $1442; legacy already includes it', () => {
    expect(monthlyCharge('Emerging-10')?.totalCents).toBe(82400);
    expect(monthlyCharge('Emerging-20')?.totalCents).toBe(144200);
    expect(monthlyCharge('Legacy-Launch')).toEqual({ planCents: 42400, feeCents: 0, totalCents: 42400, feeIncluded: true });
    expect(monthlyCharge('Unknown')).toBeUndefined();
  });
  it('prices extra hours at the plan rate plus the card fee', () => {
    expect(overageCents(5, 75)).toBe(Math.round(37500 * 1.03));
    expect(overageCents(0, 75)).toBe(0);
    expect(overageCents(2, undefined)).toBeUndefined();
  });
  it('finds the next due date and the grace/late fee', () => {
    expect(nextDueDate(1, '2026-11-20')).toBe('2026-12-01');
    expect(nextDueDate(15, '2026-11-20')).toBe('2026-12-15');
    expect(nextDueDate(15, '2026-11-10')).toBe('2026-11-15');
    expect(nextDueDate(1, '2026-12-20')).toBe('2027-01-01');
    expect(dueInfo(1, '2026-11-20')).toEqual({ dueYmd: '2026-12-01', daysLeft: 11, graceYmd: '2026-12-05', lateFeeCents: 9900 });
    expect(dueInfo(10, '2026-11-20').graceYmd).toBeUndefined();
  });
  it('returns the deposit only 30+ days before the event', () => {
    expect(eventDepositRefundCents(30)).toBe(50000);
    expect(eventDepositRefundCents(29)).toBe(0);
  });
});
