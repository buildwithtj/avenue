/** @jest-environment jsdom */
import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import styles from './AvenuePortal.module.scss';
import NoticesView from './NoticesView';
import { countUpValue, layoutFor, useContainerLayout, useCountUp, type PortalLayout } from './motion';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); delete (window as unknown as { matchMedia?: unknown }).matchMedia; delete (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver; });

const setReduced = (reduced: boolean): void => {
  (window as unknown as { matchMedia: unknown }).matchMedia = (): unknown => ({ matches: reduced, addEventListener: (): void => undefined, removeEventListener: (): void => undefined });
};

function Counter(props: { target: number; reduced: boolean }): React.ReactElement {
  return <span data-testid="n">{useCountUp(props.target, props.reduced, 1000)}</span>;
}

describe('count-up', () => {
  it('eases from 0 to the target and ends exactly on it (one decimal kept for 7.5)', () => {
    expect(countUpValue(0, 10, 0)).toBe(0);
    expect(countUpValue(0, 10, 0.5)).toBeGreaterThan(5);   // ease-out is ahead of linear
    expect(countUpValue(0, 10, 1)).toBe(10);
    expect(countUpValue(0, 7.5, 0.4) * 10 % 1).toBe(0);    // at most one decimal
    expect(countUpValue(0, 7.5, 2)).toBe(7.5);
  });

  it('shows the final number at once when motion is reduced, and never touches requestAnimationFrame', async () => {
    const raf: jest.SpyInstance = jest.spyOn(window, 'requestAnimationFrame');
    await act(async () => { root.render(<Counter target={10} reduced />); });
    expect(host.textContent).toBe('10');
    expect(raf).not.toHaveBeenCalled();
    raf.mockRestore();
  });

  it('counts up frame by frame when motion is allowed', async () => {
    let cb: FrameRequestCallback | undefined;
    const raf: jest.SpyInstance = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((f: FrameRequestCallback) => { cb = f; return 1; });
    const cancel: jest.SpyInstance = jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    await act(async () => { root.render(<Counter target={10} reduced={false} />); });
    expect(host.textContent).toBe('0');
    await act(async () => { (cb as FrameRequestCallback)(100); });          // first frame fixes t0
    await act(async () => { (cb as FrameRequestCallback)(600); });          // 50%
    const mid: number = Number(host.textContent);
    expect(mid).toBeGreaterThan(5);
    expect(mid).toBeLessThan(10);
    await act(async () => { (cb as FrameRequestCallback)(1200); });
    expect(host.textContent).toBe('10');
    raf.mockRestore();
    cancel.mockRestore();
  });
});

describe('container layout', () => {
  it('switches at 1100px of container width', () => {
    expect(layoutFor(1099)).toBe('narrow');
    expect(layoutFor(1100)).toBe('wide');
    expect(layoutFor(360)).toBe('narrow');
  });

  it('follows the element width through a ResizeObserver, not the viewport', async () => {
    let notify: (() => void) | undefined;
    let disconnected: boolean = false;
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { constructor(f: () => void) { notify = f; } public observe(): void { /* none */ } public disconnect(): void { disconnected = true; } };
    let width: number = 1000;
    function Probe(): React.ReactElement {
      const ref: React.RefObject<HTMLDivElement> = React.useRef<HTMLDivElement>(null);
      const layout: PortalLayout = useContainerLayout(ref);
      return <div ref={ref} data-layout={layout} />;
    }
    const proto: jest.SpyInstance = jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({ width } as DOMRect));
    await act(async () => { root.render(<Probe />); });
    expect(host.firstElementChild?.getAttribute('data-layout')).toBe('narrow');
    width = 1200;
    await act(async () => { (notify as () => void)(); });
    expect(host.firstElementChild?.getAttribute('data-layout')).toBe('wide');
    act(() => root.unmount());
    expect(disconnected).toBe(true);
    root = createRoot(host);
    proto.mockRestore();
  });
});

describe('reduced motion removes the animation classes', () => {
  const source = { listNotices: async () => [{ id: 1, title: 'A', body: 'b', category: 'General', pinned: false, publishedUtc: '2026-11-10T15:00:00Z' }] } as never;
  const facility = { facilityId: 'f', title: 'F', timeZone: 'America/New_York' };
  const render = async (): Promise<void> => {
    await act(async () => { root.render(<NoticesView source={source} facility={facility} />); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  };

  it('adds the staggered rise class and --i when motion is allowed', async () => {
    setReduced(false);
    await render();
    const card = host.querySelector('[data-notice="1"]') as HTMLElement;
    expect(card.className).toContain(styles.rise);
    expect(card.style.getPropertyValue('--i')).toBe('0');
  });

  it('drops them when the user prefers reduced motion', async () => {
    setReduced(true);
    await render();
    const card = host.querySelector('[data-notice="1"]') as HTMLElement;
    expect(card.className).not.toContain(styles.rise);
    expect(card.style.getPropertyValue('--i')).toBe('');
    expect(host.querySelector('.' + styles.rise)).toBeNull();
  });
});
