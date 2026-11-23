import { addMonths, anchorYmd, firstPaymentPreview, type IJoinInput, joinErrors, planFromSheet, planPriceCents, sheetPlans, stepErrors, toJoinPayload } from './join';
import type { IPlan } from './contracts';

const plans: IPlan[] = sheetPlans();
const ok: IJoinInput = { planId: 'emerging-10', businessName: 'Sweet Maple', contactName: 'Ana Ruiz', phone: '(301) 555-0100', teamSize: 3, collectionDay: 5, payMethod: 'Bank' };

describe('join validation', () => {
  it('accepts a complete input', () => {
    expect(joinErrors(ok, plans)).toEqual({});
  });
  it('refuses legacy, unknown and closed plans', () => {
    expect(joinErrors({ ...ok, planId: 'legacy-launch' }, plans).planId).toBeDefined();
    expect(joinErrors({ ...ok, planId: 'nope' }, plans).planId).toBeDefined();
    expect(joinErrors(ok, plans.map(p => ({ ...p, openToNew: false }))).planId).toBeDefined();
  });
  it('checks name lengths, phone digits, team size, day and method', () => {
    expect(joinErrors({ ...ok, businessName: ' A ' }, plans).businessName).toBeDefined();
    expect(joinErrors({ ...ok, businessName: 'A'.repeat(121) }, plans).businessName).toBeDefined();
    expect(joinErrors({ ...ok, contactName: '' }, plans).contactName).toBeDefined();
    expect(joinErrors({ ...ok, phone: '555-0100' }, plans).phone).toBeDefined();
    expect(joinErrors({ ...ok, phone: '+1 301 555 0100' }, plans).phone).toBeUndefined();
    expect(joinErrors({ ...ok, teamSize: 0 }, plans).teamSize).toBeDefined();
    expect(joinErrors({ ...ok, teamSize: 51 }, plans).teamSize).toBeDefined();
    expect(joinErrors({ ...ok, teamSize: 2.5 }, plans).teamSize).toBeDefined();
    expect(joinErrors({ ...ok, collectionDay: 16 }, plans).collectionDay).toBeDefined();
    expect(joinErrors({ ...ok, collectionDay: 0 }, plans).collectionDay).toBeDefined();
    expect(joinErrors({ ...ok, payMethod: '' }, plans).payMethod).toBeDefined();
  });
  it('reports only the current step', () => {
    const bad: IJoinInput = { ...ok, businessName: '', payMethod: '' };
    expect(stepErrors(0, bad, plans)).toEqual([]);
    expect(stepErrors(1, bad, plans)).toHaveLength(1);
    expect(stepErrors(3, bad, plans)).toHaveLength(1);
  });
  it('trims the payload and carries no identity', () => {
    const p = toJoinPayload({ ...ok, businessName: '  Sweet Maple  ' });
    expect(p.businessName).toBe('Sweet Maple');
    expect(Object.keys(p)).not.toContain('email');
  });
});

describe('plans and prices', () => {
  it('lists only open sheet plans, legacy never', () => {
    expect(plans.length).toBe(8);
    expect(plans.every(p => p.group !== 'Legacy')).toBe(true);
    expect(plans.filter(p => p.group === 'Mobile Kitchen')).toHaveLength(4);
  });
  it('bank is the list price, card adds 3%, legacy already includes it', () => {
    const e10 = plans.filter(p => p.planId === 'emerging-10')[0];
    expect(planPriceCents(e10, 'Bank')).toBe(80000);
    expect(planPriceCents(e10, 'Card')).toBe(82400);
    const legacy = planFromSheet('legacy-launch', 'Legacy-Launch');
    expect(legacy.openToNew).toBe(false);
    expect(legacy.cardPriceCents).toBe(legacy.priceCents);
    expect(planFromSheet('unknown', 'Unknown').priceCents).toBeUndefined();
  });
});

describe('first payment estimate', () => {
  it('anchors on the next chosen day strictly after today', () => {
    expect(anchorYmd(5, '2026-11-21')).toBe('2026-12-05');
    expect(anchorYmd(15, '2026-11-03')).toBe('2026-11-15');
    expect(anchorYmd(5, '2026-11-05')).toBe('2026-12-05');
    expect(anchorYmd(1, '2026-12-31')).toBe('2027-01-01');
  });
  it('adds months across a year end', () => {
    expect(addMonths('2026-12-05', 1)).toBe('2027-01-05');
    expect(addMonths('2027-01-05', -1)).toBe('2026-12-05');
  });
  it('prorates to the anchor and lists three charge dates', () => {
    const p = firstPaymentPreview(80000, 1, '2027-01-31');
    expect(p.anchorYmd).toBe('2027-02-01');
    expect(p.prorationCents).toBe(Math.round(80000 / 31));
    expect(p.charges).toEqual(['2027-02-01', '2027-03-01', '2027-04-01']);
    const same = firstPaymentPreview(80000, 5, '2026-11-05');
    expect(same.prorationCents).toBe(80000);
    expect(firstPaymentPreview(80000, 15, '2026-11-14').prorationCents).toBe(Math.round(80000 / 31));
  });
});
