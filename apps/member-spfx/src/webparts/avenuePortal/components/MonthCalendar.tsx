import * as React from 'react';
import s from './Site.module.scss';
import { addDays, groupByDay, localDay, localTime } from '../../../avenue/calendar';
import type { IFacility, IResource } from '../../../avenue/contracts';
import { facilityDayLabel } from '../../../avenue/home';
import type { AvenueReadSource } from '../../../avenue/readSource';
import { equipmentChips } from '../../../avenue/ui-helpers';
import { useCalendarDay } from './ui';

export interface IMonthCalendarProps { source: AvenueReadSource; facility: IFacility; resources: IResource[]; onBook?: () => void }

const WEEK: string[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dow = (ymd: string): number => new Date(`${ymd}T12:00:00Z`).getUTCDay();
const fmt = (ymd: string, o: Intl.DateTimeFormatOptions): string => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...o }).format(new Date(`${ymd}T12:00:00Z`));

/** The shared facility calendar as a month grid: who has what and when (member display name only). Pick a day to read it in full. */
export default function MonthCalendar(props: IMonthCalendarProps): React.ReactElement {
  const { source, facility, resources } = props;
  const tz: string = facility.timeZone;
  const today: string = localDay(new Date(), tz);
  const [month, setMonth] = React.useState<string>(`${today.slice(0, 7)}-01`);
  const [sel, setSel] = React.useState<string>(today);
  const gridStart: string = addDays(month, -dow(month));
  const cal = useCalendarDay(source, gridStart, 42);
  const days = React.useMemo(() => groupByDay(cal.entries, tz, gridStart, 42), [cal.entries, tz, gridStart]);
  const shift = (n: number): void => {
    const d: Date = new Date(`${month}T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + n, 1);
    const next: string = d.toISOString().slice(0, 10);
    setMonth(next); setSel(next.slice(0, 7) === today.slice(0, 7) ? today : next);
  };
  const picked = days.filter(d => d.day === sel)[0];

  return (
    <div className={s.mc}>
      <div className={s.mcHead}>
        <h2>{fmt(month, { month: 'long', year: 'numeric' })}</h2>
        <div className={s.row}>
          <button type="button" className={s.iconBtn} aria-label="Previous month" onClick={() => shift(-1)}>‹</button>
          <button type="button" className={s.btn} onClick={() => { setMonth(`${today.slice(0, 7)}-01`); setSel(today); }}>Today</button>
          <button type="button" className={s.iconBtn} aria-label="Next month" onClick={() => shift(1)}>›</button>
          {props.onBook && <button type="button" className={`${s.btn} ${s.btnCitrus}`} onClick={props.onBook}>Book equipment</button>}
        </div>
      </div>
      {cal.failed && <div className={s.errorPanel} role="alert"><strong>We could not load the calendar.</strong><button type="button" className={s.btn} onClick={cal.reload}>Try again</button></div>}
      <div className={s.mcLayout}>
        <div className={s.mcGrid} role="grid" aria-label="Shared facility calendar" aria-busy={!cal.ready}>
          {WEEK.map(w => <div key={w} className={s.mcDow} role="columnheader">{w}</div>)}
          {days.map(d => {
            const inMonth: boolean = d.day.slice(0, 7) === month.slice(0, 7);
            return (
              <button key={d.day} type="button" role="gridcell" aria-selected={sel === d.day} aria-label={`${fmt(d.day, { weekday: 'long', month: 'long', day: 'numeric' })}, ${d.entries.length} ${d.entries.length === 1 ? 'booking' : 'bookings'}`}
                className={`${s.mcCell} ${inMonth ? '' : s.mcOut} ${d.day === today ? s.mcToday : ''} ${sel === d.day ? s.mcSel : ''}`} onClick={() => setSel(d.day)}>
                <b>{Number(d.day.slice(8))}</b>
                {d.entries.length > 0 && <span className={s.mcBars} aria-hidden="true">{d.entries.slice(0, 4).map(e => <i key={e.bookingId} />)}{d.entries.length > 4 && <em>+{d.entries.length - 4}</em>}</span>}
              </button>
            );
          })}
        </div>
        <aside className={s.mcSide} aria-label="Selected day">
          <div className={s.eyebrow}>{fmt(sel, { weekday: 'long' })}</div>
          <h3>{facilityDayLabel(sel, today) === 'Today' || facilityDayLabel(sel, today) === 'Tomorrow' ? `${facilityDayLabel(sel, today)}, ${fmt(sel, { month: 'long', day: 'numeric' })}` : fmt(sel, { month: 'long', day: 'numeric', year: 'numeric' })}</h3>
          {!cal.ready ? <div className={s.skeleton} style={{ height: 120 }} role="status" aria-label="Loading the calendar" />
            : !picked || picked.entries.length === 0 ? <p className={s.muted}>No approved bookings. The kitchen is free all day.</p> : (
              <ul className={s.mcList}>
                {picked.entries.map(e => (
                  <li key={e.bookingId}>
                    <b>{localTime(e.startUtc, tz)} – {localTime(e.endUtc, tz)}</b>
                    <strong>{e.memberName}</strong>
                    <span>{equipmentChips(e.space || '', e.equipmentIds, resources).join(', ') || 'Booking'}</span>
                  </li>
                ))}
              </ul>
            )}
          <p className={s.mcNote}>Approved bookings only. Names and equipment, nothing else.</p>
        </aside>
      </div>
    </div>
  );
}
