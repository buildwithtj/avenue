/** @jest-environment jsdom */
import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { DateArc } from './DateArc';
import { DateWeek } from './DateWeek';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const wait = async (ms: number): Promise<void> => { await act(async () => { await new Promise(resolve => setTimeout(resolve, ms)); }); };
const DAYS: string[] = ['2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04'];
const setMotion = (reduced: boolean): void => {
  (window as unknown as { matchMedia: unknown }).matchMedia = (q: string): unknown => ({ matches: /reduce/.test(q) ? reduced : false, media: q, addEventListener: (): void => undefined, removeEventListener: (): void => undefined });
};

let host: HTMLDivElement; let root: Root; let got: string[];
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); got = []; });
afterEach(() => { act(() => root.unmount()); host.remove(); delete (window as unknown as { matchMedia?: unknown }).matchMedia; });

const Harness = (p: { start?: string; Comp?: typeof DateArc }): React.ReactElement => {
  const [v, setV] = React.useState<string>(p.start || '2026-11-27');
  const C = p.Comp || DateArc;
  return <C days={DAYS} value={v} label="Pick a day" today="2026-11-27" onChange={d => { got.push(d); setV(d); }} renderDay={d => <b>{d.slice(8)}</b>} />;
};
const draw = async (el: React.ReactElement): Promise<void> => { await act(async () => { root.render(el); }); };
const opts = (): HTMLElement[] => Array.from(host.querySelectorAll('[role="option"]'));
const sel = (): string => (host.querySelector('[aria-selected="true"]') as HTMLElement).getAttribute('aria-label') || '';
const key = async (k: string): Promise<void> => { await act(async () => { (host.querySelector('[role="listbox"]') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })); }); };

describe('DateArc', () => {
  it('renders every date as an option, the value selected, and announces it', async () => {
    setMotion(false);
    await draw(<Harness />);
    expect(opts().length).toBe(DAYS.length);
    expect(sel()).toBe('Friday, November 27');
    expect(host.querySelector('[aria-live="polite"]')?.textContent).toBe('Friday, November 27');
    expect(host.querySelector('[data-arc="arc"]')).not.toBeNull();
  });

  it('arrow keys, Home and End move the selection and call onChange', async () => {
    setMotion(false);
    await draw(<Harness />);
    await key('ArrowRight'); await wait(450);
    expect(got).toEqual(['2026-11-28']);
    expect(sel()).toBe('Saturday, November 28');
    await key('ArrowLeft'); await wait(450);
    expect(got[1]).toBe('2026-11-27');
    await key('End'); await wait(900);
    expect(got[2]).toBe('2026-12-04');
    await key('Home'); await wait(900);
    expect(got[3]).toBe('2026-11-26');
  });

  it('tapping a date glides it to the centre and selects it', async () => {
    setMotion(false);
    await draw(<Harness />);
    await act(async () => { opts()[3].click(); });
    await wait(500);
    expect(got).toEqual(['2026-11-29']);
    expect(sel()).toBe('Sunday, November 29');
  });

  it('reduced motion renders the flat scroll-snap row with the same options', async () => {
    setMotion(true);
    await draw(<Harness />);
    expect(host.querySelector('[data-arc="flat"]')).not.toBeNull();
    expect(host.querySelector('svg')).toBeNull();
    expect(opts().length).toBe(DAYS.length);
    await act(async () => { opts()[2].click(); });
    expect(got).toEqual(['2026-11-28']);
    await key('ArrowRight');
    expect(got[1]).toBe('2026-11-29');
  });
});

describe('DateWeek', () => {
  it('shows 7 days, moves a week, and picks from the month popover', async () => {
    await draw(<Harness Comp={DateWeek} />);
    const days = (): HTMLElement[] => Array.from(host.querySelectorAll('[aria-label="Pick a day"] button'));
    expect(days().length).toBe(7);
    await act(async () => { days()[2].click(); });
    expect(got).toEqual(['2026-11-29']);
    await act(async () => { (host.querySelector('[aria-label="Next week"]') as HTMLElement).click(); });
    expect(days()[0].getAttribute('aria-label')).toBe('Saturday, November 28');
    await act(async () => { (host.querySelector('[aria-haspopup="dialog"]') as HTMLElement).click(); });
    const cell = host.querySelector('[role="dialog"] [data-d="2026-11-30"]') as HTMLElement;
    expect(cell.getAttribute('aria-disabled')).toBe('false');
    expect((host.querySelector('[role="dialog"] [data-d="2026-11-10"]') as HTMLElement).getAttribute('aria-disabled')).toBe('true');
    await act(async () => { cell.click(); });
    expect(got[1]).toBe('2026-11-30');
    expect(host.querySelector('[role="dialog"]')).toBeNull();
  });
});
