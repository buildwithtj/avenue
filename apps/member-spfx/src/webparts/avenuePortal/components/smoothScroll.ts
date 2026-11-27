import type Lenis from 'lenis';

/**
 * Lenis smooth wheel scrolling for SharePoint's inner page scroller (div[data-automation-id="contentScrollRegion"]).
 * Desktop / trackpad only: touch keeps native momentum, reduced motion keeps native scrolling. Inner scrollers (rails, sheets,
 * dialogs, anything marked data-lenis-prevent or with its own scrollable overflow) are left to the browser.
 */
let active: Lenis | null = null;

export const findMainScroller = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('[data-automation-id="contentScrollRegion"]') || (document.scrollingElement as HTMLElement | null);

/** True when a node scrolls by itself, so Lenis must not take its wheel events. */
const ownScroller = (node: HTMLElement): boolean => {
  if (node.closest('[data-lenis-prevent], [role="dialog"]')) { return true; }
  const main: HTMLElement | null = findMainScroller();
  for (let el: HTMLElement | null = node; el && el !== main && el !== document.body; el = el.parentElement) {
    const cs: CSSStyleDeclaration = getComputedStyle(el);
    if (/(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 2) { return true; }
    if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 2) { return true; }
  }
  return false;
};

/** Guard: motion-ok, fine pointer (mouse / trackpad), scroller present. False in jsdom (no matchMedia). */
export function smoothScrollWanted(root: Element | null): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') { return false; }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || (root && root.closest("[data-motion='reduce']"))) { return false; }
  const sc: HTMLElement | null = findMainScroller();
  return window.matchMedia('(pointer: fine)').matches && !!sc && !!sc.firstElementChild;
}

export function startSmoothScroll(root: Element | null): Lenis | null {
  if (!smoothScrollWanted(root)) { return null; }
  const scroller: HTMLElement = findMainScroller() as HTMLElement;
  // Lazy require: lenis ships ESM only, jest (commonjs) never reaches this line because the guard is false in jsdom; webpack bundles it normally.
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const LenisCtor: typeof Lenis = (require('lenis') as { default: typeof Lenis }).default;
  return new LenisCtor({ wrapper: scroller, content: scroller.firstElementChild as HTMLElement, smoothWheel: true, syncTouch: false, lerp: 0.12, wheelMultiplier: 1, autoRaf: true, prevent: ownScroller });
}

/** Evaluates the guard now and on resize / orientation / pointer / motion changes; returns the clean-up. */
export function installSmoothScroll(root: Element | null): () => void {
  const sync = (): void => {
    const want: boolean = smoothScrollWanted(root);
    if (want && !active) { active = startSmoothScroll(root); } else if (!want && active) { active.destroy(); active = null; }
  };
  sync();
  const mqs: MediaQueryList[] = typeof window.matchMedia === 'function' ? [window.matchMedia('(prefers-reduced-motion: reduce)'), window.matchMedia('(pointer: fine)')] : [];
  mqs.forEach(m => { if (m.addEventListener) { m.addEventListener('change', sync); } });
  const attr: MutationObserver | undefined = root && typeof MutationObserver === 'function' ? new MutationObserver(sync) : undefined;
  if (attr && root) { attr.observe(root, { attributes: true, attributeFilter: ['data-motion'] }); }
  window.addEventListener('resize', sync);
  window.addEventListener('orientationchange', sync);
  // SharePoint's scroll content element keeps a fixed box size, so Lenis's own observer never sees the page grow and it
  // keeps the first measured limit (1.15.8 bug: wheel scrolling stuck at 48 px). Watch the portal itself and re-measure.
  const grow: ResizeObserver | undefined = root && typeof ResizeObserver === 'function' ? new ResizeObserver(() => { if (active) { active.resize(); } }) : undefined;
  if (grow && root) { grow.observe(root); }
  return () => {
    if (grow) { grow.disconnect(); }
    mqs.forEach(m => { if (m.removeEventListener) { m.removeEventListener('change', sync); } });
    if (attr) { attr.disconnect(); }
    window.removeEventListener('resize', sync); window.removeEventListener('orientationchange', sync);
    if (active) { active.destroy(); active = null; }
  };
}

/** Scroll the MAIN scroller to an element: Lenis when active, else native. offset in px (negative leaves room for the bar). */
export function scrollMainTo(el: HTMLElement, smooth: boolean = true, offset?: number): void {
  if (active) {
    const bar: number = parseFloat(getComputedStyle(el).getPropertyValue('--bar-h')) || 0;
    offset = offset === undefined ? -bar : offset;
    active.scrollTo(el, { offset, immediate: !smooth }); return;
  }
  if (el.scrollIntoView) { el.scrollIntoView(smooth ? { behavior: 'smooth', block: 'start' } : { block: 'start' }); }
}
