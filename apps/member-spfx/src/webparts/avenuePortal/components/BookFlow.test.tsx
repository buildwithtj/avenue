/** @jest-environment jsdom */
import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import BookFlow from './BookFlow';
import { SizeContext, type PortalSize } from './motion';
import { motionAllowed } from './gsapMotion';
import type { IFacility, IResource } from '../../../avenue/contracts';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const flush = async (): Promise<void> => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); }); };

let host: HTMLDivElement; let root: Root;
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); delete (window as unknown as { matchMedia?: unknown }).matchMedia; });

const facility = (o: Partial<IFacility> = {}): IFacility => ({ facilityId: 'fac1', title: 'Flavors', timeZone: 'America/New_York', minBookingMinutes: 60, bookingStepMinutes: 30, minPrepTables: 1, ...o });
const resources: IResource[] = [
  { resourceId: 's1', title: 'Stove 1', kind: 'Equipment', category: 'Stove', sortOrder: 1 },
  { resourceId: 'p1', title: 'Prep table 1', kind: 'Prep table', category: 'Prep table', sortOrder: 2 }
];
const source = (sent: unknown[][] = [], monthlyHours: number = 10): never => ({
  listCalendar: async () => [],
  getMyMembership: async () => ({ monthlyHours, extraHourRate: 25 }),
  listMyRequests: async () => [],
  submitRequest: async (...a: unknown[]) => { sent.push(a); }
}) as never;
const draw = async (el: React.ReactElement, size: PortalSize = 'wide'): Promise<void> => {
  await act(async () => { root.render(<SizeContext.Provider value={size}>{el}</SizeContext.Provider>); }); await flush();
};
const btn = (label: RegExp, scope: ParentNode = document.body): HTMLButtonElement => Array.from(scope.querySelectorAll('button')).find(b => label.test(b.textContent || '')) as HTMLButtonElement;
const click = async (el: Element): Promise<void> => { await act(async () => { (el as HTMLElement).click(); }); await flush(); };
const cart = (): Element => host.querySelector('aside[aria-label="Your booking"]') as Element;
/** Tomorrow (never in the past), then its first free window (two hours). */
const pickHours = async (): Promise<void> => {
  await click(host.querySelectorAll('.bkDays button')[1]);
  await click(host.querySelector('.winList button') as Element);
};

describe('BookFlow (v7 Book)', () => {
  it('shows the intro strip and "How booking works" opens Policies', async () => {
    const went: string[] = [];
    await draw(<BookFlow source={source()} facility={facility()} resources={resources} tables={[]} onSent={() => undefined} userEmail="m@x" onNavigate={t => went.push(t)} />);
    expect(host.textContent).toContain('Flavors confirms every request; nothing is charged now.');
    await click(btn(/How booking works/));
    expect(went).toEqual(['policies']);
    expect(host.textContent).not.toContain('Confirmed');
  });

  it('cart says what is missing, then shows plan-hours usage', async () => {
    await draw(<BookFlow source={source()} facility={facility()} resources={resources} tables={[]} onSent={() => undefined} userEmail="m@x" />);
    expect(cart().textContent).toContain('Pick your hours');
    expect(btn(/Review request/, cart()).disabled).toBe(true);
    await pickHours();
    expect(cart().textContent).toContain('This booking: 2 h · 0 of 10 plan hours used this month');
    expect(cart().textContent).not.toContain('estimate');
    expect(btn(/Review request/, cart()).disabled).toBe(false);
  });

  it('asks for an item when nothing is in the cart', async () => {
    await draw(<BookFlow source={source()} facility={facility({ minPrepTables: 0 })} resources={resources} tables={[]} onSent={() => undefined} userEmail="m@x" />);
    await pickHours();
    expect(cart().textContent).toContain('Add at least one item');
    expect(btn(/Review request/, cart()).disabled).toBe(true);
  });

  it('adds the extra-hours estimate only over the plan', async () => {
    await draw(<BookFlow source={source([], 1)} facility={facility()} resources={resources} tables={[]} onSent={() => undefined} userEmail="m@x" />);
    await pickHours();
    expect(cart().textContent).toContain('1 h of it is extra time: 1 h × $25 = $25.00 (estimate, billed with your next payment)');
  });

  it('Review opens the sheet; Send calls submitRequest with the same payload as before', async () => {
    const sent: unknown[][] = [];
    await draw(<BookFlow source={source(sent)} facility={facility()} resources={resources} tables={[]} onSent={() => undefined} userEmail="m@x" />);
    await pickHours();
    await click(host.querySelector('button[data-unit="s1"]') as Element);
    expect(cart().textContent).toContain('Stove 1');
    await click(btn(/Review request/, cart()));
    const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.getAttribute('aria-label')).toBe('Review and send');
    expect(dialog.textContent).toContain('Cancel 24 hours or more ahead to get your hours back.');
    expect(dialog.textContent).toContain('This booking: 2 h · 0 of 10 plan hours used this month');
    await click(btn(/Send request/, dialog));
    expect(sent.length).toBe(1);
    const [body, id, catalog] = sent[0] as [Record<string, unknown>, string, unknown];
    expect(Object.keys(body).sort()).toEqual(['endUtc', 'equipmentIds', 'facilityId', 'space', 'startUtc']);
    expect(body).toMatchObject({ facilityId: 'fac1', space: 'Kitchen' });
    expect((body.equipmentIds as string[]).slice().sort()).toEqual(['p1', 's1']);
    expect(Date.parse(body.endUtc as string) - Date.parse(body.startUtc as string)).toBe(2 * 3600000);
    expect(id).toMatch(/^req-/);
    expect(catalog).toEqual({ equipmentIds: ['s1', 'p1'], totalSeats: undefined });
    expect(document.body.textContent).toContain('Request sent — Flavors will confirm');
  });

  it('phone: the bottom bar shows items and hours and opens the same sheet', async () => {
    await draw(<BookFlow source={source()} facility={facility()} resources={resources} tables={[]} onSent={() => undefined} userEmail="m@x" />, 'phone');
    expect(cart()).toBeNull();
    expect(host.querySelector('.bfBar')!.textContent).toContain('Pick your hours');
    await pickHours();
    expect(host.querySelector('.bfBar')!.textContent).toContain('1 item · 2 h');
    await click(btn(/^Review$/, host.querySelector('.bfBar') as Element));
    expect(document.body.querySelector('[role="dialog"]')!.getAttribute('aria-label')).toBe('Review and send');
  });

  it('reduced motion: no GSAP, the sheet is fully visible and Back closes it at once', async () => {
    (window as unknown as { matchMedia: unknown }).matchMedia = (q: string) => ({ matches: /:\s*reduce\)/.test(q), media: q, addEventListener: () => undefined, removeEventListener: () => undefined });
    expect(motionAllowed()).toBe(false);
    await draw(<BookFlow source={source()} facility={facility()} resources={resources} tables={[]} onSent={() => undefined} userEmail="m@x" />);
    await pickHours();
    await click(btn(/Review request/, cart()));
    const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.style.opacity).toBe('');
    expect(dialog.style.transform).toBe('');
    expect((dialog.previousElementSibling as HTMLElement).style.opacity).toBe('');
    await click(btn(/^Back$/, dialog));
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });

  it('motion on: GSAP opens the sheet, and Back unmounts it after the reverse', async () => {
    (window as unknown as { matchMedia: unknown }).matchMedia = (q: string) => ({ matches: /no-preference/.test(q), media: q, addListener: () => undefined, removeListener: () => undefined, addEventListener: () => undefined, removeEventListener: () => undefined });
    expect(motionAllowed()).toBe(true);
    await draw(<BookFlow source={source()} facility={facility()} resources={resources} tables={[]} onSent={() => undefined} userEmail="m@x" />);
    await pickHours();
    await click(btn(/Review request/, cart()));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 400)); });
    const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.style.opacity).toBe('1');
    await click(btn(/^Back$/, dialog));
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 400)); });
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });
});
