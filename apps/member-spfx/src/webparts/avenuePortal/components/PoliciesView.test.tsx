/** @jest-environment jsdom */
import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import PoliciesView, { POLICY_SECTIONS } from './PoliciesView';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const facility = { facilityId: 'f1', title: 'Flavors', timeZone: 'America/New_York', earlyEntryMinutes: 30, cleanupMinutes: 30, minPrepTables: 2 };
let host: HTMLDivElement; let root: Root;
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe('Policies and help', () => {
  it('has one section per footer link, shows open plans and never legacy ones, and routes its buttons', async () => {
    const plans = [
      { planId: 'e10', name: 'Emerging-10', group: 'Emerging', monthlyHours: 10, extraHourRate: 75, priceCents: 80000, openToNew: true },
      { planId: 'l1', name: 'Legacy-Launch', group: 'Legacy', monthlyHours: 5, extraHourRate: 35, priceCents: 42400, openToNew: false }
    ];
    const went: string[] = [];
    await act(async () => { root.render(<PoliciesView source={{ listPlans: async () => plans } as never} facility={facility as never} onNavigate={t => went.push(t)} />); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
    POLICY_SECTIONS.forEach(x => expect(host.querySelector(`#policy-${x.id}`)).not.toBeNull());
    const text: string = host.textContent || '';
    expect(text).toMatch(/Emerging-10.*\$800.*10 h.*\$75/);
    expect(text).not.toMatch(/Legacy-Launch/);
    expect(text).toMatch(/30 minutes before/);
    expect(text).toMatch(/3% is added/);
    await act(async () => { (Array.from(host.querySelectorAll('button')).find(b => /See my plan/.test(b.textContent || '')) as HTMLButtonElement).click(); });
    expect(went).toContain('membership');
  });
});
