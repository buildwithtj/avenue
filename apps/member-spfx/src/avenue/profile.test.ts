import { profileModel, type IProfileInput } from './profile';
import type { IMyDocumentSubmission, IMyFlag } from './contracts';

const doc = (docType: IMyDocumentSubmission['docType'], expiryDate: string): IMyDocumentSubmission => ({ submissionId: docType + expiryDate, docType, issueDate: '2026-01-01', expiryDate });
const base = (o: Partial<IProfileInput> = {}): IProfileInput => ({
  membership: { status: 'Active', planName: 'Emerging-10', monthlyHours: 10, collectionDay: 5 }, requests: [], documents: [], flags: [], required: [],
  timeZone: 'America/New_York', todayYmd: '2026-11-21', now: new Date('2026-11-21T15:00:00Z'), on: () => true, balance: 'not-connected', ...o
});
const hold: IMyFlag = { submissionId: 'f1', docType: 'County food permit', reason: 'Other', outcome: 'Booking hold: please call' };

describe('profile model', () => {
  it('puts a booking hold first, then expired, then expiring, capped at three', () => {
    const m = profileModel(base({ flags: [hold], required: ['MD good standing', 'Liability insurance'], documents: [doc('Food manager card', '2026-11-01'), doc('Workers comp or waiver', '2026-12-01')] }));
    expect(m.attention.map(a => a.tone)).toEqual(['bad', 'bad', 'warn']);
    expect(m.attention[0].label).toContain('Bookings are paused');
    expect(m.attention.length).toBeLessThanOrEqual(3);
  });
  it('shows nothing under attention when all is well', () => {
    expect(profileModel(base()).attention).toEqual([]);
  });
  it('at a glance: hours left, next payment with the 3% fee, balance not available', () => {
    const g = profileModel(base()).glance;
    expect(g.map(x => x.key)).toEqual(['hours', 'payment', 'balance']);
    expect(g[0].value).toBe('10 h left');
    expect(g[1].value).toBe('$824.00');
    expect(g[1].note).toBe('Due Dec 5');
    expect(g[2].value).toBe('Not available');
  });
  it('says so when the plan has no known price, and shows hours over', () => {
    const m = profileModel(base({ membership: { status: 'Active', planName: 'demo-plan-std', monthlyHours: 0.5 }, requests: [{ id: 1, requestId: 'r', space: 'Kitchen', equipmentIds: [], startUtc: '2026-11-10T15:00:00Z', endUtc: '2026-11-10T17:00:00Z', status: 'Approved' } as never] }));
    expect(m.glance[0].tone).toBe('bad');
    expect(m.glance[1].value).toBe('Not set yet');
  });
  it('shows a real balance when payments are connected', () => {
    expect(profileModel(base({ balance: 18500 })).glance[2]).toMatchObject({ value: '$185.00', tone: 'warn' });
    expect(profileModel(base({ balance: 0 })).glance[2]).toMatchObject({ value: '$0.00', tone: 'ok' });
  });
  it('leaves out rows whose module is off', () => {
    const m = profileModel(base({ on: t => t === 'bookings' }));
    expect(m.account.map(r => r.key)).toEqual(['bookings']);
    expect(m.glance.map(x => x.key)).toEqual(['hours']);
  });
  it('documents row counts required documents on file; expired ones do not count', () => {
    const m = profileModel(base({ required: ['County food permit', 'Liability insurance'], documents: [doc('County food permit', '2027-09-30'), doc('Liability insurance', '2026-01-01')] }));
    const r = m.account.filter(x => x.key === 'documents')[0];
    expect(r.detail).toBe('1 of 2 required on file');
    expect(r.tone).toBe('warn');
  });
  it('getting started appears until onboarding is complete, then disappears', () => {
    const req = ['County food permit' as const];
    expect(profileModel(base({ required: req })).onboarding?.complete).toBe(false);
    expect(profileModel(base({ required: req, documents: [doc('County food permit', '2027-09-30')] })).onboarding).toBeUndefined();
  });
  it('no membership: no invented values', () => {
    const m = profileModel(base({ membership: undefined }));
    expect(m.onboarding).toBeUndefined();
    expect(m.glance.filter(g => g.key === 'payment')[0].value).toBe('Not set yet');
    expect(m.account.filter(r => r.key === 'membership')[0].detail).toBeUndefined();
  });
  it('an overdue payment comes first under attention and opens billing', () => {
    const m = profileModel(base({ flags: [hold], membership: { status: 'Active', planName: 'Emerging-10', paymentStatus: 'PastDue' } }));
    expect(m.attention[0]).toMatchObject({ key: 'payment-overdue', tone: 'bad', target: 'billing' });
    expect(profileModel(base({ membership: { status: 'Active', paymentStatus: 'PastDue' }, on: t => t !== 'billing' })).attention).toEqual([]);
  });
  it('bank payers see the list price without the card fee', () => {
    expect(profileModel(base({ membership: { status: 'Active', planId: 'emerging-10', payMethod: 'Bank', collectionDay: 5 } })).glance[1].value).toBe('$800.00');
  });
  it('adds Event request, Storage and My team to the account group and Messages to help, hidden when their module is off', () => {
    const m = profileModel(base());
    expect(m.account.map(r => r.key)).toEqual(expect.arrayContaining(['events', 'storage', 'team']));
    expect(m.help.map(r => r.key)).toEqual(['support']);
    const off = profileModel(base({ on: t => t === 'bookings' }));
    expect(off.account.map(r => r.key)).toEqual(['bookings']);
    expect(off.help).toEqual([]);
  });
  it('marks Messages when a reply is waiting', () => {
    expect(profileModel(base({ replyWaiting: true })).help[0]).toMatchObject({ detail: 'Reply received', tone: 'warn', target: 'support' });
    expect(profileModel(base()).help[0].tone).toBeUndefined();
  });
});
