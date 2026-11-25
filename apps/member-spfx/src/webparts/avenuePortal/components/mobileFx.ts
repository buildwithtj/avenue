import * as React from 'react';

/** Mobile v2 helpers (docs/MOBILE_UI_V2_PLAN.md): full-bleed measuring, scroll-linked variables, reveal-on-scroll, touch tilt.
 *  No library: one passive, rAF-throttled scroll listener on the REAL scroll parent (SharePoint scrolls an inner element, not the window)
 *  writes CSS variables; nothing here sets React state while scrolling. */

export function motionOk(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
}

/** The element (or window) that actually scrolls the portal. */
export function findScroller(el: HTMLElement | null): HTMLElement | undefined {
  let sc: HTMLElement | null = el ? el.parentElement : null;
  while (sc && !(/(auto|scroll)/.test(getComputedStyle(sc).overflowY) && sc.scrollHeight > sc.clientHeight + 1)) { sc = sc.parentElement; }
  return sc || undefined;
}

/** Edge to edge: whatever padding or offset SharePoint puts around the web part (the iOS app adds its own), the portal root is
 *  stretched to the visible width and shifted to x = 0. Re-measured on resize / rotation. Active only while `on`. */
export function useFullBleed(ref: React.RefObject<HTMLElement>, on: boolean): void {
  React.useLayoutEffect(() => {
    const el: HTMLElement | null = ref.current;
    if (!el) { return undefined; }
    const clear = (): void => { el.style.marginLeft = ''; el.style.width = ''; el.style.maxWidth = ''; };
    if (!on) { clear(); return undefined; }
    const apply = (): void => {
      clear();
      const left: number = el.getBoundingClientRect().left;
      const sc: HTMLElement | undefined = findScroller(el);
      // The VISIBLE width: never wider than the real scroller (a scrollbar or the iOS app's inset would otherwise push the right edge off screen).
      const vw: number = Math.min(document.documentElement.clientWidth || window.innerWidth, window.innerWidth || Infinity, sc && sc.clientWidth ? sc.clientWidth : Infinity);
      const w: number = el.getBoundingClientRect().width;
      if (Math.abs(left) > 0.5 || Math.abs(w - vw) > 0.5) {
        el.style.marginLeft = `${-left}px`; el.style.width = `${vw}px`; el.style.maxWidth = 'none';
      }
    };
    apply();
    const t: number = window.setTimeout(apply, 400); // SharePoint finishes its own layout after first paint
    window.addEventListener('resize', apply, { passive: true } as AddEventListenerOptions);
    window.addEventListener('orientationchange', apply);
    const ro: ResizeObserver | undefined = typeof ResizeObserver === 'function' && el.parentElement ? new ResizeObserver(apply) : undefined;
    if (ro && el.parentElement) { ro.observe(el.parentElement); }
    return () => { window.clearTimeout(t); window.removeEventListener('resize', apply); window.removeEventListener('orientationchange', apply); if (ro) { ro.disconnect(); } clear(); };
  }, [ref, on]);
}

/** Reveal-on-scroll for `[data-reveal]` elements (fade, small rise, staggered by --ri). IntersectionObserver only: there is NO scroll listener and no CSS variable
 *  written while scrolling (zero style/layout work per frame). Reduced motion: everything is visible at once. */
export function useScrollFx(ref: React.RefObject<HTMLElement>, active: boolean, key: unknown): void {
  React.useEffect(() => {
    const root: HTMLElement | null = ref.current;
    if (!root || !active) { return undefined; }
    const showAll = (): void => root.querySelectorAll('[data-reveal]').forEach(el => el.setAttribute('data-in', '1'));
    if (!motionOk() || typeof IntersectionObserver !== 'function') { showAll(); return undefined; }
    const io: IntersectionObserver = new IntersectionObserver(es => {
      for (const e of es) { if (e.isIntersecting) { (e.target as HTMLElement).setAttribute('data-in', '1'); io.unobserve(e.target); } }
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    const scan = (): void => {
      const items: HTMLElement[] = Array.prototype.slice.call(root.querySelectorAll('[data-reveal]:not([data-in]):not([data-seen])'));
      items.forEach((el, i) => { el.setAttribute('data-seen', '1'); el.style.setProperty('--ri', String(Math.min(i, 5))); io.observe(el); });
    };
    const t: number = window.setTimeout(scan, 80);
    const mo: MutationObserver | undefined = typeof MutationObserver === 'function' ? new MutationObserver(() => { window.setTimeout(scan, 60); }) : undefined;
    if (mo) { mo.observe(root, { childList: true, subtree: true }); }
    const safety: number = window.setTimeout(showAll, 3500);
    // Idle loops (ambient light, empty-state steam, the date-panel mesh) run only while on screen: data-playing toggles with visibility.
    const idle: IntersectionObserver = new IntersectionObserver(es => { for (const e of es) { (e.target as HTMLElement).setAttribute('data-playing', e.isIntersecting ? '1' : '0'); } }, { threshold: 0 });
    const scanIdle = (): void => { root.querySelectorAll('[data-idle]:not([data-idle-seen])').forEach(el => { el.setAttribute('data-idle-seen', '1'); idle.observe(el); }); };
    const ti: number = window.setTimeout(scanIdle, 100);
    const mi: MutationObserver | undefined = typeof MutationObserver === 'function' ? new MutationObserver(() => { window.setTimeout(scanIdle, 60); }) : undefined;
    if (mi) { mi.observe(root, { childList: true, subtree: true }); }
    return () => { window.clearTimeout(t); window.clearTimeout(ti); window.clearTimeout(safety); if (mo) { mo.disconnect(); } if (mi) { mi.disconnect(); } io.disconnect(); idle.disconnect(); };
  }, [ref, active, key]);
}

/** Home hero (phone): marks `data-cover="1"` on `host` once the content sheet has risen about 40 px over the pinned photo, so the overlay text can fade
 *  (opacity only). One IntersectionObserver on a sentinel at the sheet's top edge, no scroll handler. Re-measured on resize. */
export function useSheetCover(host: React.RefObject<HTMLElement>, mark: React.RefObject<HTMLElement>, active: boolean, ready: boolean): void {
  React.useEffect(() => {
    const h: HTMLElement | null = host.current; const m: HTMLElement | null = mark.current;
    if (!h || !m || !active || typeof IntersectionObserver !== 'function') { if (h) { h.setAttribute('data-cover', '0'); } return undefined; }
    let io: IntersectionObserver | undefined;
    const build = (): void => {
      if (io) { io.disconnect(); }
      const sc: HTMLElement | undefined = findScroller(h);
      const top0: number = m.getBoundingClientRect().top - (sc ? sc.getBoundingClientRect().top : 0) + (sc ? sc.scrollTop : window.scrollY);
      // Visible while the sentinel sits below (its start position - 40 px), i.e. before the sheet has risen 40 px.
      io = new IntersectionObserver(es => { const e = es[es.length - 1]; h.setAttribute('data-cover', e.isIntersecting ? '0' : '1'); }, { root: sc || null, rootMargin: `-${Math.max(0, Math.round(top0 - 40))}px 0px 0px 0px`, threshold: 0 });
      io.observe(m);
    };
    const t: number = window.setTimeout(build, 300);
    window.addEventListener('resize', build, { passive: true } as AddEventListenerOptions);
    return () => { window.clearTimeout(t); window.removeEventListener('resize', build); if (io) { io.disconnect(); } };
  }, [host, mark, active, ready]);
}

/** Touch / pointer tilt for a card: writes --rx / --ry (degrees) while a finger or mouse is down or moving over it; springs back on release.
 *  Spread the returned props on the element. Reduced motion: no handlers. */
export function tiltProps(): { onPointerMove: (e: React.PointerEvent<HTMLElement>) => void; onPointerLeave: (e: React.PointerEvent<HTMLElement>) => void; onPointerUp: (e: React.PointerEvent<HTMLElement>) => void; onPointerCancel: (e: React.PointerEvent<HTMLElement>) => void } | Record<string, never> {
  if (!motionOk()) { return {}; }
  const set = (el: HTMLElement, x: number, y: number): void => { el.style.setProperty('--rx', `${(-y * 7).toFixed(2)}deg`); el.style.setProperty('--ry', `${(x * 9).toFixed(2)}deg`); };
  const reset = (e: React.PointerEvent<HTMLElement>): void => { const el: HTMLElement = e.currentTarget; el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); };
  return {
    onPointerMove: (e: React.PointerEvent<HTMLElement>): void => {
      if (e.pointerType === 'mouse' && e.buttons === 0) { /* hover tilt on desktop is fine too */ }
      const el: HTMLElement = e.currentTarget; const r: DOMRect = el.getBoundingClientRect();
      set(el, ((e.clientX - r.left) / Math.max(1, r.width)) - 0.5, ((e.clientY - r.top) / Math.max(1, r.height)) - 0.5);
    },
    onPointerLeave: reset, onPointerUp: reset, onPointerCancel: reset
  };
}
