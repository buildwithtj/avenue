import * as React from 'react';

/**
 * Lenis-style smooth HORIZONTAL scrolling for the portal's rails (Kitchen right now, date strips, notices, tabs).
 * Wheel / trackpad sideways and mouse drag glide with easing (lerp each frame) and settle on the nearest snap point.
 * Touch stays native (already momentum-smooth). Vertical scrolling is deliberately NOT touched: Lenis on SharePoint's
 * inner scroller fought programmatic scrolling (docs/DECISIONS_AND_OPEN_QUESTIONS.md, 24 Nov 2026).
 */
const EASE: number = 0.12;

interface IGlide { target: number; raf: number; idle: number; snap: boolean }

const scrollableX = (el: HTMLElement | undefined): boolean => {
  if (!el) { return false; }
  const ox: string = getComputedStyle(el).overflowX;
  return (ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth + 2;
};
const railOf = (t: EventTarget | null): HTMLElement | undefined => {
  let el: HTMLElement | undefined = t instanceof HTMLElement ? t : undefined;
  while (el && el !== document.body) { if (scrollableX(el)) { return el; } el = el.parentElement || undefined; }
  return undefined;
};

/** Nearest snap offset for a rail whose children use scroll-snap-align start or center; otherwise the value itself. */
function snapped(el: HTMLElement, x: number): number {
  const kids: HTMLElement[] = Array.from(el.children).filter((k): k is HTMLElement => k instanceof HTMLElement);
  const inline: string = el.style.scrollSnapType; el.style.scrollSnapType = ''; // read the stylesheet's snap, not our temporary 'none'
  const type: string = getComputedStyle(el).scrollSnapType;
  el.style.scrollSnapType = inline;
  if (kids.length === 0 || !type || type === 'none') { return Math.max(0, Math.min(el.scrollWidth - el.clientWidth, x)); }
  const pad: number = parseFloat(getComputedStyle(el).scrollPaddingLeft) || 0;
  let best: number = x; let gap: number = Infinity;
  kids.forEach(k => {
    const centre: boolean = getComputedStyle(k).scrollSnapAlign.indexOf('center') >= 0;
    const at: number = centre ? k.offsetLeft - (el.clientWidth - k.offsetWidth) / 2 : k.offsetLeft - pad;
    const d: number = Math.abs(at - x);
    if (d < gap) { gap = d; best = at; }
  });
  return Math.max(0, Math.min(el.scrollWidth - el.clientWidth, best));
}

/** Install once on the portal root; returns the clean-up. */
export function installSmoothScrollX(root: HTMLElement): () => void {
  if (typeof window === 'undefined' || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) { return () => undefined; }
  const glides: WeakMap<HTMLElement, IGlide> = new WeakMap<HTMLElement, IGlide>();
  const stateOf = (el: HTMLElement): IGlide => { let g: IGlide | undefined = glides.get(el); if (!g) { g = { target: el.scrollLeft, raf: 0, idle: 0, snap: false }; glides.set(el, g); } return g; };

  const run = (el: HTMLElement): void => {
    const g: IGlide = stateOf(el);
    if (g.raf) { return; }
    el.style.scrollSnapType = 'none'; el.style.scrollBehavior = 'auto';
    const step = (): void => {
      const d: number = g.target - el.scrollLeft;
      if (Math.abs(d) < 1) { el.scrollLeft = g.target; g.raf = 0; if (!g.snap) { el.style.scrollSnapType = ''; el.style.scrollBehavior = ''; } return; }
      el.scrollLeft += Math.sign(d) * Math.max(1, Math.abs(d) * EASE); // at least 1 px: scrollLeft rounds, so tiny steps would stall
      g.raf = window.requestAnimationFrame(step);
    };
    g.raf = window.requestAnimationFrame(step);
  };
  /** After input stops, glide on to the nearest snap point, then give snapping back to CSS. */
  const settle = (el: HTMLElement): void => {
    const g: IGlide = stateOf(el);
    window.clearTimeout(g.idle);
    g.idle = window.setTimeout(() => {
      g.snap = true; g.target = snapped(el, g.target); run(el);
      window.setTimeout(() => { g.snap = false; if (!g.raf) { el.style.scrollSnapType = ''; el.style.scrollBehavior = ''; } }, 700);
    }, 90);
  };

  const onWheel = (e: WheelEvent): void => {
    if (e.ctrlKey) { return; }
    const sideways: boolean = Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey;
    if (!sideways) { return; }
    const el: HTMLElement | undefined = railOf(e.target);
    if (!el) { return; }
    const g: IGlide = stateOf(el);
    if (!g.raf) { g.target = el.scrollLeft; }
    g.snap = false;
    g.target = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, g.target + (e.shiftKey && e.deltaX === 0 ? e.deltaY : e.deltaX)));
    e.preventDefault();
    run(el); settle(el);
  };

  // Mouse drag with momentum (touch and pen keep native scrolling).
  let drag: { el: HTMLElement; x: number; start: number; last: number; v: number; moved: boolean } | undefined;
  const onDown = (e: PointerEvent): void => {
    if (e.pointerType !== 'mouse' || e.button !== 0) { return; }
    const el: HTMLElement | undefined = railOf(e.target);
    if (!el) { return; }
    const g: IGlide = stateOf(el); window.cancelAnimationFrame(g.raf); g.raf = 0;
    el.style.scrollSnapType = 'none'; el.style.scrollBehavior = 'auto';
    drag = { el, x: e.clientX, start: el.scrollLeft, last: e.clientX, v: 0, moved: false };
  };
  const onMove = (e: PointerEvent): void => {
    if (!drag) { return; }
    if (!drag.moved && Math.abs(e.clientX - drag.x) < 5) { return; }
    drag.moved = true; drag.v = drag.last - e.clientX; drag.last = e.clientX;
    drag.el.scrollLeft = drag.start - (e.clientX - drag.x);
    drag.el.style.cursor = 'grabbing';
  };
  const onUp = (): void => {
    if (!drag) { return; }
    const d = drag; drag = undefined; d.el.style.cursor = '';
    if (!d.moved) { d.el.style.scrollSnapType = ''; d.el.style.scrollBehavior = ''; return; }
    const g: IGlide = stateOf(d.el);
    g.target = Math.max(0, Math.min(d.el.scrollWidth - d.el.clientWidth, d.el.scrollLeft + d.v * 14)); g.snap = false;
    run(d.el); settle(d.el);
  };
  const noClickAfterDrag = (e: MouseEvent): void => { if (drag && drag.moved) { e.preventDefault(); e.stopPropagation(); } };
  let suppress: boolean = false;
  const swallowDragClick = (e: MouseEvent): void => { if (suppress) { e.preventDefault(); e.stopPropagation(); suppress = false; } };
  const markSuppress = (): void => { if (drag && drag.moved) { suppress = true; window.setTimeout(() => { suppress = false; }, 50); } };

  root.addEventListener('wheel', onWheel, { passive: false });
  root.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  const onWinUp = (): void => { markSuppress(); onUp(); };
  window.addEventListener('pointerup', onWinUp);
  root.addEventListener('click', swallowDragClick, true);
  root.addEventListener('dragstart', noClickAfterDrag, true);
  return () => {
    root.removeEventListener('wheel', onWheel); root.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onWinUp); root.removeEventListener('dragstart', noClickAfterDrag, true); root.removeEventListener('click', swallowDragClick, true);
  };
}

/**
 * Cover-flow for a rail: the card nearest the centre grows (1.0), the others shrink towards 0.86 and fade slightly.
 * One passive scroll listener, rAF-throttled, writes only a CSS variable (--k) per card; CSS does the transform.
 */
export function useCenterScale(ref: { current: HTMLElement | null }, ready: boolean): void {
  React.useEffect(() => {
    const el: HTMLElement | null = ref.current;
    if (!el) { return undefined; }
    let queued: boolean = false;
    const paint = (): void => {
      queued = false;
      // The rail is position: relative, so offsetLeft is measured from it (and ignores the transform: no feedback).
      const mid: number = el.scrollLeft + el.clientWidth / 2;
      Array.from(el.children).forEach(k => {
        const c: HTMLElement = k as HTMLElement;
        const d: number = Math.min(1, Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid) / (c.offsetWidth + 12));
        c.style.setProperty('--k', (1 - d).toFixed(3));
      });
    };
    const onScroll = (): void => { if (!queued) { queued = true; window.requestAnimationFrame(paint); } };
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    paint();
    return () => { el.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, [ref, ready]);
}
