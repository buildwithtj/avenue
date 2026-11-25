import { extraHourLines, firstOfNextMonth, memberPlan, planChangeMessage, planChoices, recommendPlan, usageState } from './plans';
import { paymentEstimate } from './payments';
import { invoiceChip, type IInvoice } from './billing';
import { sheetPlans } from './join';
import type { IMyRequest, IPlan } from './contracts';

const plans: IPlan[] = sheetPlans();
const req = (start: string, end: string, o: Partial<IMyRequest> = {}): IMyRequest => ({ requestId: start, space: 'Kitchen', startUtc: start, endUtc: end, cancelSent: false, cancelRequested: false, status: 'Approved', ...o } as IMyRequest);

describe('member plans (P4)', () => {
  it('names the plan from the plan record, never the raw id unless nothing matches', () => {
    const std: IPlan = { planId: 'demo-plan-std', name: 'Standard', group: 'Emerging', monthlyHours: 10, priceCents: 50000, openToNew: true };
    expect(memberPlan({ planId: 'demo-plan-std' }, [std])?.name).toBe('Standard');
    expect(memberPlan({ planId: 'demo-plan-std', planName: 'Standard row' }, [])?.name).toBe('Standard row');
    expect(memberPlan({ planId: 'demo-plan-std' }, [])?.name).toBe('demo-plan-std');
    expect(memberPlan({}, [std])).toBeUndefined();
  });
  it('falls back to the sheet price for a legacy plan listPlans does not return', () => {
    const p = memberPlan({ planId: 'legacy-launch', planName: 'Legacy-Launch' }, plans);
    expect([p?.priceCents, p?.cardPriceCents, p?.monthlyHours, p?.group]).toEqual([42400, 42400, 5, 'Legacy']);
    expect(planChoices(p as IPlan, plans).map(x => x.planId)).toEqual(['emerging-10', 'emerging-20', 'emerging-40', 'emerging-80']);
  });
  it('offers only open plans in the same group, smallest first', () => {
    const mk = memberPlan({ planId: 'mobile kitchen-20' }, plans) as IPlan;
    expect(planChoices(mk, plans).map(x => x.monthlyHours)).toEqual([10, 20, 40, 80]);
    expect(planChoices(mk, plans).every(x => x.group === 'Mobile Kitchen')).toBe(true);
  });
  it('recommends the smallest plan that covers this month', () => {
    const em = planChoices(memberPlan({ planId: 'emerging-10' }, plans) as IPlan, plans);
    expect(recommendPlan(em, 0)?.planId).toBe('emerging-10');
    expect(recommendPlan(em, 10)?.planId).toBe('emerging-10');
    expect(recommendPlan(em, 12.5)?.planId).toBe('emerging-20');
    expect(recommendPlan(em, 81)).toBeUndefined();
  });
  it('colours usage amber from 80% and red over, with hours over x rate', () => {
    expect(usageState(7.9, 10, 75).level).toBe('ok');
    expect(usageState(8, 10, 75).level).toBe('high');
    expect(usageState(12.5, 10, 75)).toEqual({ level: 'over', overHours: 2.5, extraCents: 18750 });
    expect(usageState(3, undefined, 75)).toEqual({ level: 'ok', overHours: 0, extraCents: 0 });
  });
  it('estimates the next payment: plan + extra hours x rate + 3% by card', () => {
    // Emerging-10 by card, 2.5 h over at $75: 80000 + 18750 + 3% of both (2400 + 563).
    expect(paymentEstimate(80000, 82400, 2.5, 75, 'Card')).toEqual({ planCents: 80000, extraCents: 18750, feeCents: 2963, totalCents: 101713, feeIncluded: false });
    expect(paymentEstimate(80000, 82400, 2.5, 75, 'Bank').totalCents).toBe(98750);
    expect(paymentEstimate(42400, 42400, 0, 35, 'Card')).toEqual({ planCents: 42400, extraCents: 0, feeCents: 0, totalCents: 42400, feeIncluded: true });
    expect(paymentEstimate(80000, undefined, 0, 75).feeCents).toBe(2400);
  });
  it('splits extra hours by booking date once the allowance is used', () => {
    const rs = [
      req('2026-11-03T14:00:00Z', '2026-11-03T20:00:00Z'),
      req('2026-11-10T14:00:00Z', '2026-11-10T19:00:00Z'),
      req('2026-11-12T14:00:00Z', '2026-11-12T16:00:00Z'),
      req('2026-11-13T14:00:00Z', '2026-11-13T18:00:00Z', { status: 'Declined' }),
      req('2026-10-30T14:00:00Z', '2026-10-30T20:00:00Z')
    ];
    expect(extraHourLines(rs, 10, 75, 'America/New_York', new Date('2026-11-20T12:00:00Z'))).toEqual([
      { ymd: '2026-11-10', hours: 1, cents: 7500 }, { ymd: '2026-11-12', hours: 2, cents: 15000 }
    ]);
    expect(extraHourLines(rs, undefined, 75, 'America/New_York', new Date('2026-11-20T12:00:00Z'))).toEqual([]);
  });
  it('resets on the 1st of next month', () => {
    expect(firstOfNextMonth('2026-11-23')).toBe('2026-12-01');
    expect(firstOfNextMonth('2026-12-02')).toBe('2027-01-01');
    expect(firstOfNextMonth('2026-08-31')).toBe('2026-09-01');
  });
  it('writes the plan-change message as a Billing support message', () => {
    const from = memberPlan({ planId: 'emerging-10' }, plans) as IPlan;
    const to = memberPlan({ planId: 'emerging-20' }, plans) as IPlan;
    const msg = planChangeMessage('f1', from, to, '  more evenings ');
    expect(msg.category).toBe('Billing');
    expect(msg.subject).toBe('Plan change request: Emerging-10 → Emerging-20');
    expect(msg.body).toContain('Current: Emerging-10 ($800.00/month · 10 h · $75.00 per extra hour)');
    expect(msg.body).toContain('Requested: Emerging-20 ($1400.00/month · 20 h · $65.00 per extra hour)');
    expect(msg.body).toContain('Note: more evenings');
  });
  it('labels invoices Paid / Open / Past due / Void', () => {
    const inv = (o: Partial<IInvoice>): IInvoice => ({ invoiceId: 'i', periodStart: '2026-11-01', periodEnd: '2026-11-30', currency: 'usd', amountDueCents: 1, amountPaidCents: 0, status: 'open', dueDate: '2026-12-01', isEstimate: false, lines: [], ...o });
    expect(invoiceChip(inv({ status: 'paid' }), '2026-11-23')).toBe('Paid');
    expect(invoiceChip(inv({}), '2026-11-23')).toBe('Open');
    expect(invoiceChip(inv({}), '2026-12-02')).toBe('Past due');
    expect(invoiceChip(inv({ status: 'uncollectible' }), '2026-11-23')).toBe('Past due');
    expect(invoiceChip(inv({ status: 'void' }), '2026-11-23')).toBe('Void');
    expect(invoiceChip(inv({ status: 'draft' }), '2026-11-23')).toBe('Open');
  });
});
