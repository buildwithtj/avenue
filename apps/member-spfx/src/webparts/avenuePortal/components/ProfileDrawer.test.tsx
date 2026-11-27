import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import ProfileDrawer from './ProfileDrawer';
import type { IFeedbackPrefs } from './feedback';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const wait = (ms = 40): Promise<void> => act(async () => { await new Promise(resolve => setTimeout(resolve, ms)); });

const source = (flags: unknown[] = []): never => ({
  getMyMembership: async () => ({ status: 'Active', planName: 'Emerging-10', monthlyHours: 10, collectionDay: 5, businessName: 'Maple' }),
  listMyRequests: async () => [], listMyDocuments: async () => [], listMyFlags: async () => flags, listRequiredDocTypes: async () => ['County food permit'], listMyInvoices: async () => []
}) as never;

describe('profile drawer', () => {
  let host: HTMLDivElement; let root: Root;
  let closed: number; let nav: string[]; let prefs: IFeedbackPrefs; let setPrefCalls: Array<[string, boolean]>;
  beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); closed = 0; nav = []; prefs = { sound: true, haptics: true, alerts: false }; setPrefCalls = []; });
  afterEach(() => { act(() => root.unmount()); host.remove(); document.body.style.overflow = ''; });
  const draw = async (open: boolean, flags: unknown[] = [], extra: Partial<React.ComponentProps<typeof ProfileDrawer>> = {}): Promise<void> => {
    await act(async () => {
      root.render(<ProfileDrawer open={open} onClose={() => { closed++; }} source={source(flags)} isDemo={true} userName="Ana Cook" userEmail="a@b.co" timeZone="America/New_York" prefs={prefs} setPref={(k, v) => setPrefCalls.push([k, v])} full={false} setFull={() => undefined} onNavigate={t => nav.push(t)} {...extra} />);
    });
    await wait();
  };
  const dlg = (): HTMLElement | null => document.querySelector('[role="dialog"]');
  const text = (): string => (dlg() ? (dlg() as HTMLElement).textContent || '' : '');

  it('renders nothing when closed, and a labelled modal dialog when open', async () => {
    await draw(false);
    expect(dlg()).toBeNull();
    await draw(true);
    expect(dlg()?.getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById('pd-title')?.textContent).toBe('Ana Cook');
    expect(document.body.style.overflow).toBe('hidden');
  });
  it('shows the plan, glance figures and account destinations in order, without a floating menu', async () => {
    await draw(true);
    const t = text();
    expect(t).toContain('Maple');
    expect(t.indexOf('At a glance')).toBeLessThan(t.indexOf('Your account'));
    expect(t.indexOf('Your account')).toBeLessThan(t.indexOf('Preferences'));
    expect(t.indexOf('Preferences')).toBeLessThan(t.indexOf('Help'));
    expect(t).toContain('$824.00');
    expect(t).toContain('Documents');
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });
  it('Escape closes; so does the scrim', async () => {
    await draw(true);
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(closed).toBe(1);
    await act(async () => { (document.querySelector('[aria-hidden="true"][class*="pdScrim"], [class*="pdScrim"]') as HTMLElement).click(); });
    expect(closed).toBe(2);
  });
  it('choosing a destination closes the sheet and then opens that screen', async () => {
    await draw(true);
    const row = Array.prototype.slice.call(dlg()!.querySelectorAll('button')).filter((b: HTMLElement) => /^Billing/.test(b.textContent || ''))[0] as HTMLElement;
    await act(async () => { row.click(); });
    await wait(10);
    expect(closed).toBe(1);
    expect(nav).toEqual(['billing']);
  });
  it('switches report their state and call setPref', async () => {
    await draw(true);
    const sw = Array.prototype.slice.call(dlg()!.querySelectorAll('[role="switch"]')) as HTMLElement[];
    const sound = sw.filter(b => /Sounds/.test(b.textContent || ''))[0];
    expect(sound.getAttribute('aria-checked')).toBe('true');
    await act(async () => { sound.click(); });
    expect(setPrefCalls).toEqual([['sound', false]]);
  });
  it('a booking hold shows first under Needs attention, in red', async () => {
    await draw(true, [{ submissionId: 'f', docType: 'County food permit', reason: 'Other', outcome: 'Booking hold: call us' }]);
    const t = text();
    expect(t.indexOf('Needs attention')).toBeLessThan(t.indexOf('At a glance'));
    expect(t).toContain('Bookings are paused');
    expect(dlg()!.querySelector('[data-tone="bad"]')).not.toBeNull();
  });
  it('Tab stays inside the sheet', async () => {
    await draw(true);
    const items = Array.prototype.slice.call(dlg()!.querySelectorAll('a[href], button:not([disabled]), summary')) as HTMLElement[];
    items[items.length - 1].focus();
    const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    await act(async () => { document.dispatchEvent(ev); });
    expect(ev.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(items[0]);
  });
  it('still offers preferences (so full screen can be turned off) when no facility is loaded', async () => {
    await draw(true, [], { timeZone: undefined });
    expect(text()).toContain('Full screen');
    expect(text()).not.toContain('At a glance');
  });
  it('closing restores focus to the element that opened it', async () => {
    const opener = document.createElement('button'); document.body.appendChild(opener); opener.focus();
    await draw(true);
    await draw(false);
    await wait(260);
    expect(document.activeElement).toBe(opener);
    expect(dlg()).toBeNull();
    opener.remove();
  });
});
