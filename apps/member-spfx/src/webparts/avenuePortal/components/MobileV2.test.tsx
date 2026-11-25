/** @jest-environment jsdom */
import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import MoreSheet from './MoreSheet';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement; let root: Root;
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe('More sheet (phone)', () => {
  it('lists destinations with badges, nothing about the person, and navigates then closes', async () => {
    const went: string[] = []; let closed = 0;
    await act(async () => { root.render(<MoreSheet open onClose={() => { closed += 1; }} onNavigate={t => went.push(t)} isDemo badges={{ notices: 3 }} />); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
    const dlg = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dlg.getAttribute('aria-labelledby')).toBe('more-title');
    expect(dlg.textContent).toContain('Billing');
    expect(dlg.textContent).toContain('Policies and help');
    expect(dlg.textContent).not.toContain('Sign out');
    expect(dlg.querySelector('[aria-label="3 new"]')).not.toBeNull();
    const tile = Array.from(dlg.querySelectorAll('button')).find(b => /Billing/.test(b.textContent || '')) as HTMLButtonElement;
    await act(async () => { tile.click(); await new Promise(resolve => setTimeout(resolve, 10)); });
    expect(closed).toBe(1);
    expect(went).toEqual(['billing']);
  });
  it('Escape closes it', async () => {
    let closed = 0;
    await act(async () => { root.render(<MoreSheet open onClose={() => { closed += 1; }} onNavigate={() => undefined} isDemo badges={{}} />); });
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(closed).toBe(1);
  });
});
