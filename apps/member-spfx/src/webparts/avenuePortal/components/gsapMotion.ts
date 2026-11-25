import * as React from 'react';
import { gsap } from 'gsap';
// The UMD build: 'gsap/Flip' resolves to an ES module that Jest (no transform for node_modules) cannot load.
import { Flip } from 'gsap/dist/Flip';
import { useGSAP } from '@gsap/react';

// GSAP motion for the Book page (plan §3.4, [PROPOSED]). Every helper animates only under
// '(prefers-reduced-motion: no-preference)'; with reduced motion or no window.matchMedia (jsdom) it does nothing,
// so the final state is what renders (no opacity 0 left behind).
gsap.registerPlugin(useGSAP, Flip);

const OK: string = '(prefers-reduced-motion: no-preference)';

/** True when motion may run now. */
export function motionAllowed(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(OK).matches;
}

/**
 * Opens the Sheet that holds `ref` (scale .96→1 + fade, or slide up for the bottom sheet; 220 ms power2.out) and
 * returns `close(done)`: plays it back in 160 ms, then calls `done` (at once when nothing was animated).
 * Pass `motion="external"` to that Sheet so its CSS animation does not run as well.
 */
export function useSheetMotion(ref: React.RefObject<HTMLElement>, open: boolean, bottom: boolean): (done: () => void) => void {
  const tl: React.MutableRefObject<gsap.core.Timeline | undefined> = React.useRef<gsap.core.Timeline | undefined>();
  useGSAP(() => {
    const el: HTMLElement | null = ref.current;
    const panel: Element | null = el ? el.closest('[role="dialog"]') : null;
    if (!open || !panel || !motionAllowed()) { return undefined; }
    const mm = gsap.matchMedia();
    mm.add(OK, () => {
      const t: gsap.core.Timeline = gsap.timeline({ defaults: { duration: 0.22, ease: 'power2.out' } });
      if (panel.previousElementSibling) { t.fromTo(panel.previousElementSibling, { opacity: 0 }, { opacity: 1 }, 0); }
      // The centred dialog is placed with translate(-50%, -50%); keep it while scaling.
      t.fromTo(panel, bottom ? { yPercent: 100 } : { xPercent: -50, yPercent: -50, x: 0, y: 0, scale: 0.96, opacity: 0 },
        bottom ? { yPercent: 0 } : { xPercent: -50, yPercent: -50, x: 0, y: 0, scale: 1, opacity: 1 }, 0);
      tl.current = t;
      return () => { tl.current = undefined; };
    });
    return () => mm.revert();
  }, { dependencies: [open, bottom] });
  return React.useCallback((done: () => void): void => {
    const t: gsap.core.Timeline | undefined = tl.current;
    if (!t) { done(); return; }
    t.eventCallback('onReverseComplete', done);
    t.timeScale(220 / 160).reverse();
  }, []);
}

/**
 * Flip for a list whose items carry `data-flip-id`: call the returned `capture()` just before the change; when `key`
 * changes the items glide from where they were and new ones fade in.
 */
export function useFlipList(ref: React.RefObject<HTMLElement>, key: string): () => void {
  const state: React.MutableRefObject<Flip.FlipState | undefined> = React.useRef<Flip.FlipState | undefined>();
  React.useLayoutEffect(() => {
    const st: Flip.FlipState | undefined = state.current;
    state.current = undefined;
    const el: HTMLElement | null = ref.current;
    if (!st || !el || !motionAllowed()) { return; }
    Flip.from(st, {
      targets: el.querySelectorAll('[data-flip-id]'), duration: 0.22, ease: 'power2.out',
      onEnter: (els: Element[]) => gsap.fromTo(els, { opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1, duration: 0.2, ease: 'power2.out' })
    });
  }, [key]);
  return React.useCallback((): void => {
    const el: HTMLElement | null = ref.current;
    if (el && motionAllowed()) { state.current = Flip.getState(el.querySelectorAll('[data-flip-id]')); }
  }, [ref]);
}

/** The "added" tick: a short pop on `el`. */
export function popIn(el: Element | undefined): void {
  if (!el || !motionAllowed()) { return; }
  gsap.fromTo(el, { scale: 0.5 }, { scale: 1, duration: 0.28, ease: 'back.out(3)', clearProps: 'transform' });
}
