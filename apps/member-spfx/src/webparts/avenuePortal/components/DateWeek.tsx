import * as React from 'react';
import ds from './DateSelect.module.scss';
import { dayFmt, longDay, type IDateArcProps } from './DateArc';
import { addDays } from '../../../avenue/calendar';

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const monthOf = (vm: string): string => dayFmt(`${vm}-01`, { month: 'long', year: 'numeric' });
const shiftMonth = (vm: string, k: number): string => { const d: Date = new Date(Date.UTC(+vm.slice(0, 4), +vm.slice(5, 7) - 1 + k, 1)); return d.toISOString().slice(0, 7); };

/**
 * Desktop date selector: a week bar of 7 day pills with previous/next week buttons, and the month label as a button that opens a
 * month-grid popover (arrow keys move by day and week, Enter or Space selects, Escape and outside click close it).
 * Same props as DateArc so a page can swap the two by screen size.
 */
export function DateWeek(props: IDateArcProps): React.ReactElement {
  const { days, value, onChange, renderDay, label, markers, today, describe } = props;
  const n: number = days.length;
  const idx: number = Math.max(0, days.indexOf(value));
  const maxStart: number = Math.max(0, n - 7);
  const [start, setStart] = React.useState<number>(() => clamp(idx, 0, maxStart));
  const s0: number = idx >= start && idx < start + 7 ? start : clamp(idx, 0, maxStart);
  React.useEffect(() => { if (s0 !== start) { setStart(s0); } }, [s0, start]);

  const [open, setOpen] = React.useState<boolean>(false);
  const [vm, setVm] = React.useState<string>(value.slice(0, 7));
  const [focus, setFocus] = React.useState<string>(value);
  const wrap: React.RefObject<HTMLDivElement> = React.useRef<HTMLDivElement>(null);
  const monthBtn: React.RefObject<HTMLButtonElement> = React.useRef<HTMLButtonElement>(null);
  const grabFocus: React.MutableRefObject<boolean> = React.useRef<boolean>(false);

  const close = (back: boolean): void => { setOpen(false); if (back && monthBtn.current) { monthBtn.current.focus(); } };
  const openPop = (): void => { setVm(value.slice(0, 7)); setFocus(value); grabFocus.current = true; setOpen(true); };
  React.useEffect(() => {
    if (!open) { return undefined; }
    const h = (e: PointerEvent): void => { if (wrap.current && !wrap.current.contains(e.target as Node)) { setOpen(false); } };
    document.addEventListener('pointerdown', h);
    return () => document.removeEventListener('pointerdown', h);
  }, [open]);
  // Move real focus with the roving cell (only after a keyboard move or on open, never when the pointer picks a month).
  React.useEffect(() => {
    if (!open || !grabFocus.current || !wrap.current) { return; }
    const el: HTMLElement | null = wrap.current.querySelector(`[data-d="${focus}"]`);
    if (el) { el.focus(); }
  }, [open, focus, vm]);

  const has: Set<string> = React.useMemo(() => new Set(days), [days]);
  const first: string = `${vm}-01`;
  const lead: number = new Date(`${first}T12:00:00Z`).getUTCDay();
  const count: number = new Date(Date.UTC(+vm.slice(0, 4), +vm.slice(5, 7), 0)).getUTCDate();
  const cells: (string | undefined)[] = [];
  for (let i: number = 0; i < lead; i++) { cells.push(undefined); }
  for (let i: number = 1; i <= count; i++) { cells.push(`${vm}-${i < 10 ? '0' : ''}${i}`); }
  const tab: string = focus.slice(0, 7) === vm ? focus : first;

  const move = (to: string): void => { grabFocus.current = true; setFocus(to); setVm(to.slice(0, 7)); };
  const onGridKey = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    const delta: number | undefined = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' ? -7 : e.key === 'ArrowDown' ? 7 : undefined;
    if (delta !== undefined) { e.preventDefault(); move(addDays(tab, delta)); }
    else if (e.key === 'Home') { e.preventDefault(); move(first); }
    else if (e.key === 'End') { e.preventDefault(); move(`${vm}-${count < 10 ? '0' : ''}${count}`); }
  };
  const pickCell = (c: string): void => { if (has.has(c)) { onChange(c); close(true); } };

  return (
    <div className={ds.week} ref={wrap} onKeyDown={e => { if (open && e.key === 'Escape') { e.stopPropagation(); close(true); } }}>
      <div className={ds.weekHead}>
        <button type="button" ref={monthBtn} className={ds.monthBtn} aria-haspopup="dialog" aria-expanded={open} aria-label={`${monthOf(value.slice(0, 7))}, choose a date`} onClick={() => (open ? close(false) : openPop())}>{monthOf(value.slice(0, 7))}</button>
        <button type="button" className={ds.navBtn} aria-label="Previous week" disabled={s0 <= 0} onClick={() => setStart(Math.max(0, s0 - 7))}>‹</button>
        <button type="button" className={ds.navBtn} aria-label="Next week" disabled={s0 >= maxStart} onClick={() => setStart(Math.min(maxStart, s0 + 7))}>›</button>
      </div>
      <div className={ds.pills} role="group" aria-label={label}>
        {days.slice(s0, s0 + 7).map(d => (
          <button key={d} type="button" aria-pressed={d === value} aria-label={longDay(d) + (describe ? describe(d) : '')}
            className={`${ds.cell} ${ds.pill} ${d === today ? ds.today : ''} ${(markers && markers(d)) || ''} ${d === value ? ds.sel : ''}`} onClick={() => onChange(d)}>
            {renderDay(d, d === value)}
          </button>
        ))}
      </div>
      {open && (
        <div className={ds.pop} role="dialog" aria-label="Choose a date">
          <div className={ds.popHead}>
            <button type="button" className={ds.navBtn} aria-label="Previous month" onClick={() => { grabFocus.current = false; setVm(shiftMonth(vm, -1)); }}>‹</button>
            <strong>{monthOf(vm)}</strong>
            <button type="button" className={ds.navBtn} aria-label="Next month" onClick={() => { grabFocus.current = false; setVm(shiftMonth(vm, 1)); }}>›</button>
          </div>
          <div className={ds.grid} role="group" aria-label={monthOf(vm)} onKeyDown={onGridKey}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((x, i) => <span key={i} className={ds.dow} aria-hidden="true">{x}</span>)}
            {cells.map((c, i) => c === undefined ? <i key={`b${i}`} /> : (
              <button key={c} type="button" data-d={c} tabIndex={c === tab ? 0 : -1} aria-pressed={c === value} aria-disabled={!has.has(c)} aria-label={longDay(c)}
                className={`${ds.mcell} ${c === today ? ds.today : ''} ${has.has(c) ? (markers && markers(c)) || '' : ''} ${c === value ? ds.sel : ''}`} onClick={() => pickCell(c)}>{+c.slice(8)}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
