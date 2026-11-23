import { onboarding, categoryProgress, CATEGORIES, flagState, hasHold, itemState, toFlagItem, validateFlag, wizardSteps } from './compliance';
import { actionItems } from './home';
import type { IMyDocumentSubmission } from './contracts';

const doc = (docType: IMyDocumentSubmission['docType'], expiryDate: string): IMyDocumentSubmission => ({ submissionId: docType + expiryDate, docType, issueDate: '2026-01-01', expiryDate });

describe('compliance catalogue', () => {
  it('has the client\'s seven documents in three categories', () => {
    expect(CATEGORIES.map(c => c.items.length)).toEqual([2, 2, 3]);
    expect(wizardSteps().length).toBe(7);
  });
  it('reports each document and category from what is on file', () => {
    const docs = [doc('County food permit', '2027-09-30'), doc('Liability insurance', '2026-12-01')];
    expect(itemState('County food permit', docs, '2026-11-20')).toBe('current');
    expect(itemState('Liability insurance', docs, '2026-11-20')).toBe('expiring');
    expect(itemState('Food handler card', docs, '2026-11-20')).toBe('missing');
    expect(categoryProgress(docs, '2026-11-20').map(p => [p.done, p.needs])).toEqual([[1, 1], [0, 2], [0, 3]]);
  });
});

describe('compliance escalation', () => {
  const ok = { facilityId: 'f', docType: 'Liability insurance' as const, reason: 'Additional insured missing' as const, note: '' };
  it('validates a flag', () => {
    expect(validateFlag(ok)).toEqual([]);
    expect(validateFlag({ ...ok, reason: undefined }).length).toBe(1);
    expect(validateFlag({ ...ok, docType: undefined }).length).toBe(1);
    expect(validateFlag({ ...ok, reason: 'Other', note: 'x' }).length).toBe(1);
    expect(validateFlag({ ...ok, note: 'x'.repeat(1001) }).length).toBe(1);
  });
  it('writes only display fields, never a decision', () => {
    expect(Object.keys(toFlagItem(ok, 'flag-1')).sort()).toEqual(['DocType', 'FacilityId', 'Note', 'Reason', 'SubmissionId', 'Title']);
  });
  it('reads staff decisions from the echoed outcome', () => {
    expect(flagState(undefined).state).toBe('open');
    expect(flagState('Cleared: no issue').state).toBe('cleared');
    expect(flagState('More information needed: send the full COI').state).toBe('info');
    expect(flagState('Booking hold: limits too low').state).toBe('hold');
    expect(flagState('Hold released: thanks').state).toBe('released');
  });
  it('holds only while the newest flag per document is a hold', () => {
    const f = (o: string, id: string, t: IMyFlagT['docType'] = 'Liability insurance'): IMyFlagT => ({ submissionId: id, docType: t, reason: 'Other', outcome: o });
    expect(hasHold([f('Booking hold: x', '2'), f('Cleared', '1')])).toBe(true);
    expect(hasHold([f('Hold released: ok', '2'), f('Booking hold: x', '1')])).toBe(false);
    expect(hasHold([])).toBe(false);
  });
  it('tells the member on Home', () => {
    const items = actionItems([], [], '2026-11-20', [{ submissionId: '1', docType: 'Food manager card', reason: 'Other', outcome: 'Booking hold: please call' }]);
    expect(items.map(i => i.kind)).toEqual(['compliance-hold']);
  });
});
type IMyFlagT = import('./contracts').IMyFlag;

describe('onboarding checklist', () => {
  const req: import('./contracts').DocType[] = ['County food permit', 'Liability insurance', 'Food manager card'];
  const m = { status: 'Active', planName: 'Emerging-10', collectionDay: 5 };
  it('is incomplete until every required document is sent and current', () => {
    const o = onboarding(m, [doc('County food permit', '2027-09-30')], req, '2026-11-20');
    expect(o.complete).toBe(false);
    expect(o.missing).toEqual(['Liability insurance', 'Food manager card']);
    expect(o.steps[2].detail).toContain('1 of 3 sent');
  });
  it('treats an expired document as missing', () => {
    expect(onboarding(m, [doc('County food permit', '2026-01-01')], ['County food permit'], '2026-11-20').missing).toEqual(['County food permit']);
  });
  it('completes when membership, plan and documents are all in place', () => {
    const docs = req.map(t => doc(t, '2027-12-01'));
    expect(onboarding(m, docs, req, '2026-11-20').complete).toBe(true);
  });
  it('does not complete with no required documents configured, an inactive member or no payment day', () => {
    expect(onboarding(m, [], [], '2026-11-20').complete).toBe(false);
    expect(onboarding({ ...m, status: 'Invited' }, req.map(t => doc(t, '2027-12-01')), req, '2026-11-20').complete).toBe(false);
    expect(onboarding({ status: 'Active', planName: 'Emerging-10' }, req.map(t => doc(t, '2027-12-01')), req, '2026-11-20').complete).toBe(false);
    expect(onboarding(undefined, [], req, '2026-11-20').steps[0].done).toBe(false);
  });
  it('tells Home about required documents never sent', () => {
    const items = actionItems([doc('County food permit', '2027-09-30')], [], '2026-11-20', [], req);
    expect(items.map(i => i.kind)).toEqual(['onboarding-docs']);
    expect(items[0].howTo).toContain('Liability insurance');
  });
});
