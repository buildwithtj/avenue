import * as React from 'react';
import ds from './DateSelect.module.scss';
import { buzz } from './feedback';
import { easeOut, useReducedMotion } from './motion';

/** Formats a YYYY-MM-DD day (UTC noon, so no zone shifts it). */
export function dayFmt(d: string, o: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...o }).format(new Date(`${d}T12:00:00Z`));
}
export const longDay = (d: string): string => dayFmt(d, { weekday: 'long', month: 'long', day: 'numeric' });

export interface IDateArcProps {
  days: string[];
  value: string;
  onChange: (day: string) => void;
  /** Content inside each bubble. Use ds-less markup: DateSelect.module.scss exports wd / num / time / tag. */
  renderDay: (day: string, selected: boolean) => React.ReactNode;
  label: string;
  /** Extra class per day (e.g. booked-day states). */
  markers?: (day: string) => string | undefined;
  today?: string;
  /** Extra words after the date in each option's spoken label (e.g. ", 2 bookings approved"). */
  describe?: (day: string) => string;
  /** Days shown greyed and not selectable (e.g. past days). The wheel never settles on one. */
  disabled?: (day: string) => boolean;
}

const BW: number = 56;
const BH: number = 64;
const TOP: number = 22; // room above the bubbles for the caret
const SPAN: number = 6.4; // dates across the visible width
const TH_MAX: number = Math.asin(0.5 / 1.4); // angle of the screen edge: R = 1.4 * width, so it never depends on the width
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const OVER: number = 0.4; // days the wheel may be dragged past the first/last enabled day (rubber-band limit)
/** Rubber band: free inside [lo, hi], resists asymptotically to OVER days beyond. */
const band = (v: number, lo: number, hi: number): number => v < lo ? lo - OVER * (1 - Math.exp((v - lo) / OVER)) : v > hi ? hi + OVER * (1 - Math.exp((hi - v) / OVER)) : v;

/**
 * Phone date wheel: dates ride a fixed quarter-ish circle (radius 1.4 x width, bowing upward); only the dates move.
 * Styles are written by ref in rAF (transform and opacity), so dragging never re-renders React.
 * Reduced motion (OS setting or [data-motion='reduce']): a plain scroll-snap row.
 */
export function DateArc(props: IDateArcProps): React.ReactElement {
  const { days, value, onChange, renderDay, label, markers, today, describe, disabled } = props;
  const n: number = days.length;
  const isOff = (i: number): boolean => !!(disabled && days[i] !== undefined && disabled(days[i]));
  let lo: number = 0; while (lo < n - 1 && isOff(lo)) { lo++; }
  let hi: number = n - 1; while (hi > lo && isOff(hi)) { hi--; }
  const uid: string = React.useId();
  const rootRef: React.RefObject<HTMLDivElement> = React.useRef<HTMLDivElement>(null);
  const items: React.MutableRefObject<(HTMLDivElement | null)[]> = React.useRef<(HTMLDivElement | null)[]>([]);
  const osReduced: boolean = useReducedMotion();
  const [attrReduced, setAttrReduced] = React.useState<boolean>(false);
  React.useEffect(() => { setAttrReduced(!!(rootRef.current && rootRef.current.closest("[data-motion='reduce']"))); });
  const flat: boolean = osReduced || attrReduced;

  const [w, setW] = React.useState<number>(0);
  React.useLayoutEffect(() => {
    const el: HTMLDivElement | null = rootRef.current;
    if (!el) { return undefined; }
    const m = (): void => setW(Math.round(el.getBoundingClientRect().width || el.clientWidth));
    m();
    if (typeof ResizeObserver === 'function') { const ro: ResizeObserver = new ResizeObserver(m); ro.observe(el); return () => ro.disconnect(); }
    window.addEventListener('resize', m);
    return () => window.removeEventListener('resize', m);
  }, []);

  // Geometry: radius from the measured width, angle step so about 6.4 dates span the width (1:1 under the finger).
  const W: number = w || 360;
  const R: number = W * 1.4;
  const step: number = W / SPAN / R;
  const ppd: number = R * step; // px of finger travel per date
  const yc: number = TOP + BH / 2;
  const yEdge: number = yc + R * (1 - Math.cos(TH_MAX));
  const H: number = Math.ceil(TOP + BH + R * (1 - Math.cos(TH_MAX)) + 26); // + room under the bubbles for the "Next" tag

  const st = React.useRef({ days, n, value, onChange, W, R, step, ppd, lo, hi, off: isOff });
  st.current = { days, n, value, onChange, W, R, step, ppd, lo, hi, off: isOff };
  const pos = React.useRef<number>(Math.max(0, days.indexOf(value))); // continuous index under the caret
  const tgt = React.useRef<number>(pos.current);
  const lastC = React.useRef<number>(pos.current);
  const lastTick = React.useRef<number>(0);
  const silent = React.useRef<boolean>(false);
  const raf = React.useRef<number>(0);
  const drawRaf = React.useRef<number>(0);
  const dragging = React.useRef<boolean>(false);
  const suppress = React.useRef<boolean>(false);
  const drag = React.useRef({ id: -1, x0: 0, p0: 0, lastX: 0, lastT: 0, v: 0, moved: false });

  const paint = (): void => {
    const { W: w0, R: r0, step: s0 } = st.current;
    const p: number = pos.current;
    const c: number = Math.round(p);
    items.current.forEach((el, i) => {
      if (!el) { return; }
      const th: number = (i - p) * s0;
      const x: number = r0 * Math.sin(th);
      // Hide by angle as well as by x: sin() repeats, so a date far along the circle (|th| > 90deg) would come back on screen.
      if (Math.abs(th) > Math.PI / 2 || Math.abs(x) > w0 / 2 + BW) { if (el.style.visibility !== 'hidden') { el.style.visibility = 'hidden'; } return; }
      const t: number = Math.min(1, Math.abs(th) / TH_MAX);
      el.style.visibility = 'visible';
      const off: boolean = st.current.off(i);
      el.style.opacity = String((1 - 0.65 * t) * (off ? 0.38 : 1));
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${(r0 * (1 - Math.cos(th))).toFixed(1)}px, 0) rotate(${th.toFixed(4)}rad) scale(${(1 - 0.25 * t).toFixed(3)})`;
      el.classList.toggle(ds.sel, i === c && !off);
    });
    // Haptic rule: one 5 ms tick each time a new date crosses the centre while the member drags or it flings (at most one per 24 ms).
    if (c !== lastC.current) {
      lastC.current = c;
      const now: number = performance.now();
      if (!silent.current && now - lastTick.current >= 24) { lastTick.current = now; buzz('tick'); }
    }
  };
  const schedule = (): void => { if (!drawRaf.current) { drawRaf.current = requestAnimationFrame(() => { drawRaf.current = 0; paint(); }); } };
  const stop = (): void => { if (raf.current) { cancelAnimationFrame(raf.current); raf.current = 0; } };
  const commit = (i: number): void => {
    const d: string | undefined = st.current.days[i];
    if (d && d !== st.current.value) { st.current.value = d; st.current.onChange(d); }
  };
  /** Spring-like settle (ease-out, 250 ms plus 45 ms per date travelled) to a whole index, then report it. */
  const go = (target: number, quiet: boolean = false, commitIt: boolean = true): void => {
    stop();
    const from: number = pos.current;
    // Nearest enabled day to the target, preferring the direction of travel.
    const tc: number = clamp(Math.round(target), 0, st.current.n - 1);
    const dir: number = target >= from ? 1 : -1;
    let t: number = tc;
    for (let k: number = 0; k < st.current.n; k++) {
      const a: number = tc + dir * k; const b: number = tc - dir * k;
      if (a >= 0 && a < st.current.n && !st.current.off(a)) { t = a; break; }
      if (b >= 0 && b < st.current.n && !st.current.off(b)) { t = b; break; }
    }
    tgt.current = t;
    silent.current = quiet;
    if (Math.abs(t - from) < 0.001) { pos.current = t; paint(); silent.current = false; if (commitIt) { commit(t); } return; }
    const dur: number = Math.min(900, 250 + Math.abs(t - from) * 45);
    const t0: number = performance.now();
    const frame = (now: number): void => {
      const k: number = Math.min(1, (now - t0) / dur);
      pos.current = from + (t - from) * easeOut(k);
      paint();
      if (k < 1) { raf.current = requestAnimationFrame(frame); } else { raf.current = 0; silent.current = false; if (commitIt) { commit(t); } }
    };
    raf.current = requestAnimationFrame(frame);
  };

  React.useLayoutEffect(() => { if (!flat) { paint(); } });
  // Keep in sync when the value changes from outside (Calendar input, Today button): glide there, no haptics.
  React.useEffect(() => {
    if (flat) { return; }
    const i: number = days.indexOf(value);
    if (i >= 0 && i !== Math.round(pos.current) && !dragging.current) { go(i, true, false); }
  }, [value, n, flat]);
  React.useEffect(() => () => { stop(); if (drawRaf.current) { cancelAnimationFrame(drawRaf.current); } }, []);

  // Flat row: keep the chosen date centred.
  React.useEffect(() => {
    const row: HTMLDivElement | null = rootRef.current;
    const on: HTMLElement | null = row && flat ? row.querySelector('[aria-selected="true"]') : null;
    if (!row || !on || row.scrollWidth <= row.clientWidth + 4) { return; }
    const left: number = on.offsetLeft - (row.clientWidth - on.offsetWidth) / 2;
    if (typeof row.scrollTo === 'function') { row.scrollTo({ left, behavior: 'smooth' }); } else { row.scrollLeft = left; }
  }, [value, flat]);

  // Trackpad / mouse horizontal wheel (needs a non-passive listener to stop the page panning sideways).
  React.useEffect(() => {
    const el: HTMLDivElement | null = rootRef.current;
    if (!el || flat) { return undefined; }
    let timer: number = 0;
    const h = (e: WheelEvent): void => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) { return; }
      e.preventDefault();
      stop();
      silent.current = false;
      pos.current = band(pos.current + e.deltaX / st.current.ppd, st.current.lo, st.current.hi);
      schedule();
      window.clearTimeout(timer);
      timer = window.setTimeout(() => go(pos.current), 120);
    };
    el.addEventListener('wheel', h, { passive: false });
    return () => { el.removeEventListener('wheel', h); window.clearTimeout(timer); };
  }, [flat]);

  const onDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (flat || (e.pointerType === 'mouse' && e.button !== 0)) { return; }
    stop();
    const d = drag.current;
    d.id = e.pointerId; d.x0 = e.clientX; d.p0 = pos.current; d.lastX = e.clientX; d.lastT = performance.now(); d.v = 0; d.moved = false;
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    const d = drag.current;
    if (d.id !== e.pointerId) { return; }
    const dx: number = e.clientX - d.x0;
    if (!d.moved) {
      if (Math.abs(dx) < 5) { return; }
      d.moved = true; dragging.current = true; silent.current = false;
      try { if (rootRef.current) { rootRef.current.setPointerCapture(e.pointerId); } } catch { /* synthetic pointer */ }
    }
    const now: number = performance.now();
    const dt: number = now - d.lastT;
    if (dt > 0) { d.v = 0.7 * d.v + 0.3 * (-(e.clientX - d.lastX) / st.current.ppd / dt); }
    d.lastX = e.clientX; d.lastT = now;
    pos.current = band(d.p0 - dx / st.current.ppd, st.current.lo, st.current.hi);
    schedule();
  };
  const onUp = (e: React.PointerEvent<HTMLDivElement>): void => {
    const d = drag.current;
    if (d.id !== e.pointerId) { return; }
    d.id = -1;
    if (!d.moved) { if (Math.abs(pos.current - Math.round(pos.current)) > 0.001) { go(pos.current); } return; }
    dragging.current = false;
    suppress.current = true;
    window.setTimeout(() => { suppress.current = false; }, 0);
    try { if (rootRef.current) { rootRef.current.releasePointerCapture(e.pointerId); } } catch { /* already released */ }
    const v: number = performance.now() - d.lastT > 80 ? 0 : d.v; // a held finger is not a fling
    go(pos.current + v * 325); // friction time constant 325 ms: the distance the fling would still travel
  };

  const choose = (i: number): void => {
    const t: number = clamp(i, 0, n - 1);
    if (isOff(t)) { return; }
    if (flat) { if (days[t] && days[t] !== value) { onChange(days[t]); } } else { go(t); }
  };
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    const cur: number = flat ? Math.max(0, days.indexOf(value)) : tgt.current;
    const walk = (dir: number): number => { let j: number = cur + dir; while (j >= 0 && j < n && isOff(j)) { j += dir; } return j >= 0 && j < n ? j : cur; };
    const to: number | undefined = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? walk(-1) : e.key === 'ArrowRight' || e.key === 'ArrowDown' ? walk(1) : e.key === 'Home' ? lo : e.key === 'End' ? hi : undefined;
    if (to === undefined) { return; }
    e.preventDefault();
    choose(to);
  };

  return (
    <>
    <div ref={rootRef} className={flat ? ds.flat : ds.arc} style={flat ? undefined : { height: H }} role="listbox" aria-label={label} tabIndex={0}
      aria-activedescendant={`${uid}${value}`} data-arc={flat ? 'flat' : 'arc'}
      onKeyDown={onKey} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      {!flat && <svg className={ds.guide} width={W} height={H} aria-hidden="true"><path d={`M0 ${yEdge.toFixed(1)} A ${R.toFixed(1)} ${R.toFixed(1)} 0 0 1 ${W} ${yEdge.toFixed(1)}`} /></svg>}
      {!flat && <i className={ds.caret} aria-hidden="true" />}
      {days.map((d, i) => (
        <div key={d} id={`${uid}${d}`} role="option" aria-selected={d === value} aria-disabled={isOff(i) || undefined} aria-label={longDay(d) + (describe ? describe(d) : '')} ref={el => { items.current[i] = el; }}
          className={`${ds.cell} ${ds.bub} ${d === today ? ds.today : ''} ${isOff(i) ? ds.off : ''} ${(markers && markers(d)) || ''} ${flat && d === value ? ds.sel : ''}`}
          onClick={() => { if (!suppress.current) { choose(i); } }}>
          {renderDay(d, d === value)}
        </div>
      ))}
    </div>
    <span className={ds.sr} aria-live="polite">{longDay(value)}</span>
    </>
  );
}
