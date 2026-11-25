import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import JoinView from './JoinView';
import BillingView from './BillingView';
import WellnessCheck from './WellnessCheck';
import { welcomeSteps } from './WelcomeView';
import { sheetPlans } from '../../../avenue/join';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const wait = (ms = 30): Promise<void> => act(async () => { await new Promise(resolve => setTimeout(resolve, ms)); });

let host: HTMLDivElement; let root: Root;
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });
const btn = (label: RegExp): HTMLButtonElement => Array.prototype.slice.call(host.querySelectorAll('button')).filter((b: HTMLElement) => label.test(b.textContent || ''))[0];
const click = async (label: RegExp): Promise<void> => { const b = btn(label); if (!b) { throw new Error(`no button ${label}`); } await act(async () => { b.click(); }); };
const type = async (el: HTMLInputElement, value: string): Promise<void> => {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

/** A source whose host request answers with `answer` once it has been sent. */
function joinSource(answer: { outcome?: string; link?: string }): { src: never; sent: Array<[string, Record<string, unknown>]> } {
  const sent: Array<[string, Record<string, unknown>]> = [];
  let id = '';
  const src = {
    listPlans: async () => sheetPlans(),
    listMyHostRequests: async () => (id ? [{ requestId: id, kind: 'Join', ...answer }] : []),
    submitHostRequest: async (kind: string, payload: Record<string, unknown>, requestId: string) => { sent.push([kind, payload]); id = requestId; }
  } as never;
  return { src, sent };
}

async function fillJoin(): Promise<void> {
  await wait();
  await click(/^Emerging-10/);
  await click(/^Next$/);
  const inputs = host.querySelectorAll('input');
  await type(inputs[0] as HTMLInputElement, 'Sweet Maple');
  await type(inputs[1] as HTMLInputElement, 'Ana Ruiz');
  await type(inputs[2] as HTMLInputElement, '301 555 0100');
  await click(/^Next$/);
  await click(/^5$/);
  await click(/^Next$/);
}

describe('join wizard', () => {
  it('will not leave a step with errors and shows them', async () => {
    const { src } = joinSource({});
    await act(async () => { root.render(<JoinView source={src} today="2026-11-21" navigate={() => undefined} pollMs={5} />); });
    await wait();
    expect(host.textContent).not.toContain('Legacy');
    await click(/^Next$/);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Choose one of the plans');
    expect(host.textContent).toContain('Step 1 of 4');
  });
  it('sends the join request and opens only a Stripe checkout link', async () => {
    const { src, sent } = joinSource({ link: 'https://checkout.stripe.com/c/pay/cs_test_1', outcome: 'Payment page ready' });
    const went: string[] = [];
    await act(async () => { root.render(<JoinView source={src} today="2026-11-21" navigate={u => went.push(u)} pollMs={5} />); });
    await fillJoin();
    expect(host.textContent).toContain('Step 4 of 4');
    await click(/^Card, Apple Pay/);
    expect(host.textContent).toContain('$824.00');
    await click(/Continue to secure payment/);
    await wait(60);
    expect(sent[0][0]).toBe('Join');
    expect(sent[0][1]).toMatchObject({ planId: 'emerging-10', businessName: 'Sweet Maple', collectionDay: 5, payMethod: 'Card' });
    expect(went).toEqual(['https://checkout.stripe.com/c/pay/cs_test_1']);
  });
  it('never follows a link to another host and shows a refusal instead', async () => {
    const { src } = joinSource({ link: 'https://evil.example.com/pay', outcome: 'Refused: an application is already open.' });
    const went: string[] = [];
    await act(async () => { root.render(<JoinView source={src} today="2026-11-21" navigate={u => went.push(u)} pollMs={5} />); });
    await fillJoin();
    await click(/^Bank account/);
    await click(/Continue to secure payment/);
    await wait(60);
    expect(went).toEqual([]);
    expect(host.textContent).toContain('Refused: an application is already open.');
  });
  it('with payments mocked, the pay button enters the app and never contacts Stripe', async () => {
    const { src, sent } = joinSource({ link: 'https://checkout.stripe.com/c/pay/cs_test_1' });
    const went: string[] = []; let entered = 0;
    await act(async () => { root.render(<JoinView source={src} today="2026-11-21" navigate={u => went.push(u)} pollMs={5} onMockPay={() => { entered += 1; }} />); });
    await fillJoin();
    await click(/^Bank account/);
    expect(host.textContent).toContain('Nothing is charged');
    await click(/Pay and continue to Avenue/);
    await wait(60);
    expect(entered).toBe(1);
    expect(sent).toEqual([]);
    expect(went).toEqual([]);
  });
});

describe('welcome timeline', () => {
  it('fills as the membership appears and becomes active', () => {
    expect(welcomeSteps(undefined).filter(x => x.done)).toHaveLength(0);
    expect(welcomeSteps({ status: 'Onboarding' }).map(x => x.done)).toEqual([true, true, false, false]);
    expect(welcomeSteps({ status: 'Active' }).every(x => x.done)).toBe(true);
  });
});

describe('billing', () => {
  const inv = (o: Record<string, unknown>): unknown => ({ invoiceId: 'in_1', periodStart: '2026-11-05', periodEnd: '2026-12-05', currency: 'usd', amountDueCents: 82400, amountPaidCents: 0, status: 'open', dueDate: '2026-11-05', isEstimate: false, lines: [], ...o });
  const billingSource = (invoices: unknown[], paymentStatus = 'Current'): never => ({
    listMyInvoices: async () => invoices, listMyRequests: async () => [], listPlans: async () => sheetPlans(),
    getMyMembership: async () => ({ status: 'Active', planId: 'emerging-10', planName: 'Emerging-10', collectionDay: 5, payMethod: 'Bank', paymentStatus }),
    listMyHostRequests: async () => [], submitHostRequest: async () => undefined
  }) as never;
  it('pays through the Stripe invoice page only and shows the bank price', async () => {
    const opened: string[] = [];
    await act(async () => { root.render(<BillingView isDemo={false} source={billingSource([inv({ hostedUrl: 'https://invoice.stripe.com/i/acct_1/test_1' }), inv({ invoiceId: 'in_2', hostedUrl: 'https://evil.example.com/x' })])} userEmail="a@b.co" timeZone="America/New_York" openUrl={u => opened.push(u)} />); });
    await wait();
    const pays = Array.prototype.slice.call(host.querySelectorAll('button')).filter((b: HTMLElement) => /^Pay$/.test(b.textContent || ''));
    expect(pays).toHaveLength(1);
    await act(async () => { (pays[0] as HTMLElement).click(); });
    expect(opened).toEqual(['https://invoice.stripe.com/i/acct_1/test_1']);
    expect(host.textContent).toContain('$800.00');
    expect(host.textContent).toContain('Bank payment: no processing fee.');
  });
  it('warns that bookings are paused when the payment is overdue, and says all paid when nothing is owed', async () => {
    await act(async () => { root.render(<BillingView isDemo={false} source={billingSource([inv({ status: 'paid', amountPaidCents: 82400 })], 'PastDue')} userEmail="a@b.co" timeZone="America/New_York" />); });
    await wait();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Bookings are paused until the payment is made');
    expect(host.textContent).toContain('All paid');
  });
});

describe('team wellness', () => {
  it('sends one Wellness submission per person with that person\'s answers', async () => {
    const calls: Array<Record<string, unknown>> = [];
    const src = { submitCheckIn: async (input: Record<string, unknown>) => { calls.push(input); } } as never;
    const qs = [{ id: 7, kind: 'Wellness' as const, text: 'Feeling well today?', order: 1 }];
    let done = 0;
    await act(async () => { root.render(<WellnessCheck source={src} facilityId="f" timeZone="America/New_York" bookingId="b1" questions={qs} onDone={() => { done++; }} />); });
    const input = host.querySelector('input') as HTMLInputElement;
    await type(input, 'Ana'); await click(/^Add$/);
    await type(input, 'Ben'); await click(/^Add$/);
    await click(/Start wellness check/);
    expect(host.textContent).toContain('Person 1 of 2: Ana');
    await click(/^Yes$/);
    expect(host.textContent).toContain('Person 2 of 2: Ben');
    await click(/^No$/);
    await wait();
    expect(calls.map(c => [c.personName, c.kind, (c.answers as Record<number, string>)[7]])).toEqual([['Ana', 'Wellness', 'Yes'], ['Ben', 'Wellness', 'No']]);
    expect(host.textContent).toContain('Wellness sent for 2 people');
    await click(/^Done$/);
    expect(done).toBe(1);
  });
  it('shows a quiet note when Flavors has no wellness questions', async () => {
    await act(async () => { root.render(<WellnessCheck source={{} as never} facilityId="f" timeZone="UTC" bookingId="b1" questions={[]} onDone={() => undefined} />); });
    expect(host.textContent).toContain('has not added wellness questions');
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });
});
