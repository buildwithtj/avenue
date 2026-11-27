import * as React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, Root } from 'react-dom/client';
import { ClockPicker } from './ClockPicker';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLElement; let root: Root;
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });
const f = (m: number): string => `m${m}`;
const b = (re: RegExp): HTMLButtonElement => Array.from(document.body.querySelectorAll('button')).find(x => re.test(x.getAttribute('aria-label') || x.textContent || '')) as HTMLButtonElement;
const draw = async (allowed: number[], onPick: (m: number) => void, value?: number): Promise<void> => {
  await act(async () => { root.render(<ClockPicker title="Start" value={value} allowed={allowed} step={30} format={f} onPick={onPick} onClose={() => undefined} />); });
};
const click = async (el: HTMLElement): Promise<void> => { await act(async () => { el.click(); }); };

describe('ClockPicker', () => {
  it('disables hours with no allowed time and the empty half', async () => {
    await draw([18 * 60, 18 * 60 + 30], () => undefined);
    expect(b(/^6 PM$/).disabled).toBe(false);
    expect(b(/^7 PM$/).disabled).toBe(true);
    expect(b(/^AM$/).disabled).toBe(true);
  });
  it('switches to PM and picks hour then minute', async () => {
    const got: number[] = [];
    await draw([9 * 60, 18 * 60, 18 * 60 + 30], m => got.push(m));
    await click(b(/^PM$/));
    await click(b(/^6 PM$/));
    await click(b(/^:30$/));
    expect(got).toEqual([18 * 60 + 30]);
  });
  it('picks directly when one minute is allowed, and offers Midnight', async () => {
    const got: number[] = [];
    await draw([9 * 60, 1440], m => got.push(m));
    await click(b(/^9 AM$/));
    await click(b(/Midnight/));
    expect(got).toEqual([540, 1440]);
  });
});
