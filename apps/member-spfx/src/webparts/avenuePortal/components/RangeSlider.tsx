import * as React from 'react';
import s from './Site.module.scss';
import { buzz } from './feedback';

export interface IRangeSliderProps {
  /** Minutes from the start of the day; the slider spans [min, max] (the free window). */
  min: number;
  max: number;
  step: number;
  start: number;
  end: number;
  /** Shortest and longest booking, in minutes. */
  minLen: number;
  maxLen: number;
  format: (minute: number) => string;
  onChange: (start: number, end: number) => void;
}

type Which = 'start' | 'end';

/**
 * Two-handle time range. The handle under the finger tracks it 1:1 (pointer events, touch-action: none on the track, direct transform writes through a CSS
 * variable on the handle only); the value snaps to `step` and the handle settles onto the snapped spot on release. A bubble shows the time while dragging.
 * Keyboard: arrows = one step, Page Up/Down = one hour, Home/End = the ends. Each handle is a role="slider".
 */
export default function RangeSlider(props: IRangeSliderProps): React.ReactElement {
  const { min, max, step, start, end, minLen, maxLen, format, onChange } = props;
  const track = React.useRef<HTMLDivElement>(null);
  // Which handle is held: React state changes only on press and release (for the bubble), never per move event.
  const [drag, setDrag] = React.useState<Which | undefined>();
  const handles = React.useRef<Record<Which, HTMLSpanElement | null>>({ start: null, end: null });
  const fill = React.useRef<HTMLSpanElement>(null);
  const live = React.useRef<{ which: Which; a: number; b: number } | undefined>(undefined);
  const rect = React.useRef<DOMRect | undefined>(undefined);
  const span: number = Math.max(1, max - min);
  const pctOf = (m: number): number => ((m - min) / span) * 100;
  const clamp = (which: Which, v: number): number => (which === 'start'
    ? Math.max(min, Math.min(v, end - minLen))
    : Math.max(start + minLen, Math.min(v, Math.min(max, start + maxLen))));
  const snap = (raw: number): number => min + Math.round((raw - min) / step) * step;
  const set = (which: Which, v: number): void => {
    const c: number = clamp(which, v);
    if (which === 'start' ? c !== start : c !== end) { buzz('tap'); onChange(which === 'start' ? c : start, which === 'end' ? c : end); }
  };

  const fromX = (x: number): number => { const r: DOMRect | undefined = rect.current; return r ? min + Math.max(0, Math.min(1, (x - r.left) / Math.max(1, r.width))) * span : min; };
  const down = (which: Which) => (e: React.PointerEvent<HTMLElement>): void => {
    e.preventDefault();
    rect.current = track.current ? track.current.getBoundingClientRect() : undefined; // measured once per gesture, never while moving
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* synthetic or already released pointer */ }
    live.current = { which, a: pctOf(start), b: pctOf(end) };
    setDrag(which);
  };
  // 1:1 tracking: the held handle and the fill are written directly (transform via a CSS variable on those two elements only); the VALUE snaps.
  const move = (e: React.PointerEvent<HTMLElement>): void => {
    const l = live.current; if (!l) { return; }
    const raw: number = clamp(l.which, fromX(e.clientX));
    const p: number = pctOf(raw);
    if (l.which === 'start') { l.a = p; } else { l.b = p; }
    const h: HTMLSpanElement | null = handles.current[l.which];
    if (h) { h.style.setProperty('--p', `${p}%`); }
    if (fill.current) { fill.current.style.setProperty('--a', `${l.a}%`); fill.current.style.setProperty('--w', `${Math.max(0, l.b - l.a) / 100}`); }
    set(l.which, snap(raw));
  };
  // Release: the handle settles onto the snapped value (CSS transition on the handle).
  const up = (): void => {
    const l = live.current; live.current = undefined; setDrag(undefined);
    if (!l) { return; }
    const h: HTMLSpanElement | null = handles.current[l.which];
    if (h) { h.style.removeProperty('--p'); }
    if (fill.current) { fill.current.style.removeProperty('--a'); fill.current.style.removeProperty('--w'); }
  };
  // Tapping the track moves the nearer handle there.
  const trackDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if ((e.target as HTMLElement).getAttribute('role') === 'slider') { return; }
    rect.current = track.current ? track.current.getBoundingClientRect() : undefined;
    const v: number = fromX(e.clientX);
    set(Math.abs(v - start) <= Math.abs(v - end) ? 'start' : 'end', snap(v));
  };
  const key = (which: Which) => (e: React.KeyboardEvent<HTMLElement>): void => {
    const cur: number = which === 'start' ? start : end;
    const k: string = e.key;
    const next: number | undefined = k === 'ArrowLeft' || k === 'ArrowDown' ? cur - step : k === 'ArrowRight' || k === 'ArrowUp' ? cur + step
      : k === 'PageDown' ? cur - 60 : k === 'PageUp' ? cur + 60 : k === 'Home' ? min : k === 'End' ? max : undefined;
    if (next !== undefined) { e.preventDefault(); set(which, next); }
  };

  const a: number = pctOf(start);
  const b: number = pctOf(end);
  const hours: number[] = [];
  const first: number = Math.ceil(min / 60) * 60;
  const every: number = span > 12 * 60 ? 180 : span > 6 * 60 ? 120 : 60;
  for (let m = first; m <= max; m += every) { hours.push(m); }
  const thumb = (which: Which, p: number): React.ReactElement => {
    const value: number = which === 'start' ? start : end;
    return (
      <span ref={el => { handles.current[which] = el; }} className={s.rsHandle} style={{ ['--p' as string]: `${p}%` } as React.CSSProperties} data-drag={drag === which ? '1' : undefined}>
        <span role="slider" tabIndex={0} aria-label={which === 'start' ? 'Start time' : 'End time'} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} aria-valuetext={format(value)}
          className={s.rsThumb} onPointerDown={down(which)} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={key(which)}>
          <i aria-hidden="true" />
        </span>
        {drag === which && <b className={s.rsBubble} aria-hidden="true">{format(value)}</b>}
      </span>
    );
  };
  return (
    <div className={s.rs}>
      <p className={s.rsSum}><b>{format(start)} - {format(end)}</b><span>{Math.round(((end - start) / 60) * 10) / 10} h</span></p>
      <div ref={track} className={s.rsTrack} onPointerDown={trackDown} data-dragging={drag ? '1' : undefined}>
        <span className={s.rsRail} aria-hidden="true" />
        <span ref={fill} className={s.rsFill} aria-hidden="true" style={{ ['--a' as string]: `${a}%`, ['--w' as string]: `${Math.max(0, b - a) / 100}` } as React.CSSProperties} />
        {hours.map(m => <span key={m} className={s.rsTick} aria-hidden="true" style={{ left: `${pctOf(m)}%` }} />)}
        {thumb('start', a)}
        {thumb('end', b)}
      </div>
      <div className={s.rsLabels} aria-hidden="true">{hours.map(m => <span key={m} style={{ left: `${pctOf(m)}%` }}>{format(m).replace(':00', '')}</span>)}</div>
    </div>
  );
}
