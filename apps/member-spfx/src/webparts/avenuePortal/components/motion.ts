import * as React from 'react';
import styles from './AvenuePortal.module.scss';

// Motion helpers for the visual pass (CSS does the animating; these only decide WHETHER to animate and feed values).
// Nothing here changes behaviour: with reduced motion (or no matchMedia, as in jsdom) every helper yields the final state at once.

const REDUCED_QUERY: string = '(prefers-reduced-motion: reduce)';

/** True when the user asked for less motion. Without matchMedia (tests, very old hosts) there is no motion either. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') { return true; }
  return window.matchMedia(REDUCED_QUERY).matches;
}

/** Live reduced-motion flag; follows the OS setting while the page is open. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState<boolean>(prefersReducedMotion);
  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') { return undefined; }
    const mq: MediaQueryList = window.matchMedia(REDUCED_QUERY);
    const on = (): void => setReduced(mq.matches);
    on();
    if (typeof mq.addEventListener === 'function') { mq.addEventListener('change', on); return () => mq.removeEventListener('change', on); }
    return undefined;
  }, []);
  return reduced;
}

/** className + style that fade-and-rise an element in with a stagger (`--i` feeds animation-delay). Under reduced motion only `extra` is kept. */
export function rise(index: number, reduced: boolean, extra: string = ''): { className: string; style?: React.CSSProperties } {
  return reduced ? { className: extra } : { className: `${extra} ${styles.rise}`.trim(), style: { '--i': Math.min(index, 12) } as React.CSSProperties };
}

/** Class name that is dropped entirely under reduced motion. */
export function anim(reduced: boolean, cls: string): string {
  return reduced ? '' : cls;
}

/** Ease-out cubic, 0..1. */
export function easeOut(t: number): number { return 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3); }

/** The number shown `t` (0..1) of the way from `from` to `to`, rounded to the target's own decimals so the last frame is exactly `to`. */
export function countUpValue(from: number, to: number, t: number): number {
  if (t >= 1) { return to; }
  const decimals: number = Math.min(2, (String(to).split('.')[1] || '').length);
  const v: number = from + (to - from) * easeOut(t);
  return Number(v.toFixed(decimals));
}

/** Counts from 0 to `target` with requestAnimationFrame. Returns `target` immediately when motion is reduced. */
export function useCountUp(target: number, reduced: boolean, durationMs: number = 700): number {
  const [value, setValue] = React.useState<number>(reduced ? target : 0);
  React.useEffect(() => {
    if (reduced || typeof window.requestAnimationFrame !== 'function') { setValue(target); return undefined; }
    let raf: number = 0;
    let t0: number | undefined;
    const tick = (now: number): void => {
      if (t0 === undefined) { t0 = now; }
      const t: number = (now - t0) / durationMs;
      setValue(countUpValue(0, target, t));
      if (t < 1) { raf = window.requestAnimationFrame(tick); }
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [target, reduced, durationMs]);
  return value;
}

/** Wide when the portal's own container is at least `breakpoint` px: the SharePoint page chrome narrows the web part, so viewport media queries lie. */
export type PortalLayout = 'wide' | 'narrow';
export const WIDE_FROM: number = 1100;
export function layoutFor(width: number, breakpoint: number = WIDE_FROM): PortalLayout { return width >= breakpoint ? 'wide' : 'narrow'; }

/** Measures `ref` with a ResizeObserver (window resize as the fallback) and returns the layout to set as `data-layout`. */
export function useContainerLayout(ref: React.RefObject<HTMLElement>, breakpoint: number = WIDE_FROM): PortalLayout {
  const [layout, setLayout] = React.useState<PortalLayout>('narrow');
  React.useLayoutEffect(() => {
    const el: HTMLElement | null = ref.current;
    if (!el) { return undefined; }
    const measure = (): void => setLayout(layoutFor(el.getBoundingClientRect().width || el.clientWidth, breakpoint));
    measure();
    if (typeof ResizeObserver === 'function') {
      const ro: ResizeObserver = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [ref, breakpoint]);
  return layout;
}

/** phone < 720px, mid < 1100px, wide otherwise (the portal's own container width, not the viewport). */
export type PortalSize = 'phone' | 'mid' | 'wide';
export const SizeContext: React.Context<PortalSize> = React.createContext<PortalSize>('wide');
export function useSize(): PortalSize { return React.useContext(SizeContext); }

/** Elements that rise into view as they scroll in. Browsers with CSS scroll timelines do this in CSS (Site.module.scss §10);
 *  the rest get the same effect from an IntersectionObserver (useRevealFallback). Class names come in already resolved. */
export function revealSelector(cls: Record<string, string>): string {
  return ['kbList li', 'wkRail li', 'winList li', 'bkUnits li', 'agendaList li', 'mcList li', 'threeGrid li', 'unitCard', 'kTile', 'kbHead', 'wkHead', 'secHead', 'splitHead', 'mbTickets li', 'mbDayHead']
    .map(sel => sel.split(' ').map((part, i) => (i === 0 ? `.${cls[part] || part}` : part)).join(' ')).join(',');
}

function cssHasScrollTimeline(): boolean {
  try { return typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('animation-timeline', 'view()'); } catch { return false; }
}

/** Fallback scroll reveal: marks matching elements `pending` (hidden, lowered) and reveals each once it is 10% in view.
 *  Off under reduced motion, without IntersectionObserver, or where CSS scroll timelines already animate it. Re-scans on `key`. */
export function useRevealFallback(ref: React.RefObject<HTMLElement>, selector: string, pending: string, reduced: boolean, key: unknown): void {
  React.useEffect(() => {
    const root: HTMLElement | null = ref.current;
    if (!root || reduced || typeof IntersectionObserver !== 'function' || cssHasScrollTimeline()) { return undefined; }
    const io: IntersectionObserver = new IntersectionObserver(entries => {
      for (const e of entries) { if (e.isIntersecting) { e.target.classList.remove(pending); io.unobserve(e.target); } }
    }, { rootMargin: '0px 0px -10% 0px' });
    const scan = (): void => {
      root.querySelectorAll<HTMLElement>(selector).forEach(el => {
        if (el.dataset.revealed) { return; }
        el.dataset.revealed = '1';
        const r: DOMRect = el.getBoundingClientRect();
        if (r.top < window.innerHeight) { return; } // already on screen: never hide what the user can see
        el.classList.add(pending); io.observe(el);
      });
    };
    const t: number = window.setTimeout(scan, 120);
    return () => { window.clearTimeout(t); io.disconnect(); };
  }, [ref, selector, pending, reduced, key]);
}
