import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import MembershipView from './MembershipView';
import BillingView from './BillingView';
import { sheetPlans } from '../../../avenue/join';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const wait = (ms = 30): Promise<void> => act(async () => { await new Promise(resolve => setTimeout(resolve, ms)); });

let host: HTMLDivElement; let root: Root;
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });
// Sheets render into document.body, so search the whole body.
const btn = (label: RegExp): HTMLButtonElement => Array.prototype.slice.call(document.body.querySelectorAll('button')).filter((b: HTMLElement) => label.test(b.textContent || ''))[0];
const click = async (label: RegExp): Promise<void> => { const b = btn(label); if (!b) { throw new Error(`no button ${label}`); } await act(async () => { b.click(); }); };

// 12 h approved this month on a 10 h plan: 2 h over.
const now = new Date();
const day = (d: number, h: number): string => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), d, h)).toISOString();
const requests = [
  { requestId: 'r1', space: 'Kitchen', startUtc: day(10, 14), endUtc: day(10, 20), status: 'Approved', cancelSent: false, cancelRequested: false },
  { requestId: 'r2', space: 'Kitchen', startUtc: day(12, 14), endUtc: day(12, 20), status: 'Approved', cancelSent: false, cancelRequested: false }
];
const facility = { facilityId: 'f1', title: 'Flavors', timeZone: 'UTC' };

describe('my membership (P4)', () => {
  const source = (sent: unknown[][], host: unknown[]): never => ({
    getMyMembership: async () => ({ businessName: 'Sweet Maple', status: 'Active', planId: 'emerging-10', collectionDay: 5, payMethod: 'Card' }),
    getFacility: async () => facility,
    listMyRequests: async () => requests,
    listPlans: async () => sheetPlans().map(p => (p.planId === 'emerging-10' ? { ...p, name: 'Emerging 10 hours' } : p)),
    submitSupportMessage: async (...a: unknown[]) => { sent.push(a); },
    submitHostRequest: async (...a: unknown[]) => { host.push(a); }
  }) as never;

  it('shows the plan name, usage over plan and the recommended plan', async () => {
    await act(async () => { root.render(<MembershipView source={source([], [])} userEmail="a@b.co" />); });
    await wait();
    expect(host.textContent).toContain('Emerging 10 hours');
    expect(host.textContent).not.toContain('emerging-10 ');
    expect(host.textContent).toContain('12 of 10 h used');
    expect(host.textContent).toContain('2 h over your plan · about $150.00 extra so far');
    const rec = host.querySelector('[aria-label="Emerging-20"]');
    expect(rec?.textContent).toContain('Recommended');
    expect(host.querySelector('[aria-label="Emerging 10 hours"]')?.textContent).toContain('Current plan');
  });

  it('sends one Billing support message for a plan change and no host request', async () => {
    const sent: unknown[][] = []; const hostReqs: unknown[] = [];
    await act(async () => { root.render(<MembershipView source={source(sent, hostReqs)} userEmail="a@b.co" onNavigate={() => undefined} />); });
    await wait();
    const card = host.querySelector('[aria-label="Emerging-40"]') as HTMLElement;
    await act(async () => { (card.querySelector('button') as HTMLButtonElement).click(); });
    expect(document.body.textContent).toContain('Flavors confirms plan changes and when they start; nothing is charged now.');
    await click(/^Send request$/);
    await wait(250);
    expect(sent).toHaveLength(1);
    const input = sent[0][0] as { category: string; subject: string; facilityId: string };
    expect([input.category, input.subject, input.facilityId]).toEqual(['Billing', 'Plan change request: Emerging 10 hours → Emerging-40', 'f1']);
    expect(hostReqs).toHaveLength(0);
    expect(host.textContent).toContain('Plan change request sent.');
    expect(btn(/^Open Messages$/)).toBeTruthy();
  });

  it('shows a friendly error with Try again instead of SharePoint text', async () => {
    const bad = { getMyMembership: async () => undefined, getFacility: async () => facility, listMyRequests: async () => { throw new Error('HTTP 500 Microsoft.SharePoint.SPException'); }, listPlans: async () => [] } as never;
    await act(async () => { root.render(<MembershipView source={bad} userEmail="a@b.co" />); });
    await wait();
    expect(host.textContent).toContain('We could not load your membership.');
    expect(host.textContent).not.toContain('SPException');
    expect(btn(/^Try again$/)).toBeTruthy();
  });
});

describe('billing (P4)', () => {
  const inv = (o: Record<string, unknown>): unknown => ({ invoiceId: 'in_1', number: 'A-001', periodStart: '2026-10-01', periodEnd: '2026-10-31', currency: 'usd', amountDueCents: 82400, amountPaidCents: 82400, status: 'paid', dueDate: '2026-10-05', isEstimate: false, lines: [{ description: 'Emerging-10', amountCents: 82400 }], pdfUrl: 'https://pay.stripe.com/receipts/x', ...o });
  const source = (invoices: unknown[]): never => ({
    listMyInvoices: async () => invoices, listMyRequests: async () => requests, listPlans: async () => sheetPlans(),
    getMyMembership: async () => ({ status: 'Active', planId: 'emerging-10', collectionDay: 5, payMethod: 'Card', paymentStatus: 'Current' }),
    listMyHostRequests: async () => [], submitHostRequest: async () => undefined
  }) as never;

  it('estimates plan + extra hours x rate + 3% card fee and lists the extra-hour lines', async () => {
    await act(async () => { root.render(<BillingView isDemo={false} source={source([])} userEmail="a@b.co" timeZone="UTC" mockPayments />); });
    await wait();
    // 80000 + 2 h x $75 (15000) + 3% of 95000 (2850) = 97850.
    expect(host.textContent).toContain('$978.50');
    expect(host.textContent).toContain('Card fee (3%)');
    expect(host.textContent).toContain('Estimate until the invoice is issued.');
    expect(host.textContent).toMatch(/Extra hours · .* · 2 h\$150\.00/);
    expect(host.textContent).toContain('No invoices yet.');
    await click(/^Manage payment method$/);
    expect(host.textContent).toContain('Test mode: no money is charged');
  });

  it('shows status chips as text and opens an invoice detail sheet', async () => {
    const opened: string[] = [];
    await act(async () => { root.render(<BillingView isDemo={false} source={source([inv({}), inv({ invoiceId: 'in_2', number: 'A-002', status: 'void', lines: [] })])} userEmail="a@b.co" timeZone="UTC" openUrl={u => opened.push(u)} />); });
    await wait();
    expect(host.textContent).toContain('Paid');
    expect(host.textContent).toContain('Void');
    await click(/^Invoice A-001/);
    const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.getAttribute('aria-label')).toBe('Invoice A-001');
    expect(dialog.textContent).toContain('Emerging-10$824.00');
    await click(/^Receipt$/);
    expect(opened).toEqual(['https://pay.stripe.com/receipts/x']);
  });

  it('replaces raw invoice errors with a friendly message and Try again', async () => {
    const bad = { ...(source([]) as object), listMyInvoices: async () => { throw new Error('HTTP 404 List does not exist'); } } as never;
    await act(async () => { root.render(<BillingView isDemo={false} source={bad} userEmail="a@b.co" timeZone="UTC" />); });
    await wait();
    expect(host.textContent).toContain('Invoices are not available right now.');
    expect(host.textContent).not.toContain('List does not exist');
    expect(btn(/^Try again$/)).toBeTruthy();
  });
});
