import * as React from 'react';
import { RefIcon, SiteEyebrow } from './RefUi';
import s from './Site.module.scss';
import rf from './Ref.module.scss';
import { DINING_KEY, buildBusyMap, cookingUnits, dayTimeline, type IDayTimeline } from '../../../avenue/availability';
import { addDays, groupByDay, localDay, localTime } from '../../../avenue/calendar';
import type { IFacility, IResource } from '../../../avenue/contracts';
import type { AvenueReadSource } from '../../../avenue/readSource';
import { busyLevels, equipmentChips, minuteToUtc } from '../../../avenue/ui-helpers';
import { useCalendarDay } from './ui';
import { scrollMainTo } from './smoothScroll';
import { UnitCards, unitStatus } from './UnitCards';
import MonthCalendar from './MonthCalendar';

export interface ICalendarViewProps {
  source: AvenueReadSource;
  facility: IFacility;
  resources: IResource[];
  /** Opens the booking board (the schedule is also the booking surface). */
  onBook?: (unitId?: string) => void;
}

const WEEK: string[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dow = (ymd: string): number => new Date(`${ymd}T12:00:00Z`).getUTCDay();

// Facility schedule: the month calendar, the equipment cards for one day, or one week as a 7-cell grid with every day's bookings under it.
// Names are the member display name only (the existing shared-calendar rule).

export default function CalendarView(props: ICalendarViewProps): React.ReactElement {
  const { source, facility, resources } = props;
  const tz: string = facility.timeZone;
  const today: string = localDay(new Date(), tz);
  const [day, setDay] = React.useState<string>(today);
  const [view, setViewRaw] = React.useState<'month' | 'cards' | 'week'>('month');
  const [vdir, setVdir] = React.useState<'fwd' | 'back'>('fwd');
  const setView = (v: 'month' | 'cards' | 'week'): void => { const o: string[] = ['month', 'cards', 'week']; setVdir(o.indexOf(v) >= o.indexOf(view) ? 'fwd' : 'back'); setViewRaw(v); };
  const [filter, setFilter] = React.useState<'all' | 'free' | 'busy'>('all');
  const weekStart: string = addDays(day, -dow(day));
  const cal = useCalendarDay(source, view === 'week' ? weekStart : day, view === 'week' ? 7 : 1);
  const dayRefs = React.useRef<Record<string, HTMLElement | null>>({});
  const busy = React.useMemo(() => buildBusyMap(cal.entries), [cal.entries]);
  const units: IResource[] = React.useMemo(() => resources.concat({ resourceId: DINING_KEY, title: 'Dining room', kind: 'Space', category: 'Other', sortOrder: 100000 }), [resources]);
  const timeline: IDayTimeline = React.useMemo(() => dayTimeline(units, busy, day, tz), [units, busy, day, tz]);

  const timeOf = (m: number): string => localTime(minuteToUtc(timeline, m), tz);
  const short = (ymd: string): string => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', day: 'numeric' }).format(new Date(`${ymd}T12:00:00Z`));
  const range = (ymd: string): string => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(new Date(`${ymd}T12:00:00Z`));
  const cookUnits = cookingUnits(resources);
  const cookingAll: number = cookUnits.length;
  const cookingFree: number = cookUnits.filter(u => unitStatus((timeline.rows.filter(r => r.unitId === u.resourceId)[0] || { segments: [] }).segments, timeline, tz, Date.now()).free).length;
  const dayCount: number = cal.entries.filter(en => localDay(en.startUtc, tz) === day).length;
  const levels: number[] = busyLevels(timeline, cookUnits.map(u => u.resourceId), 30);
  const peak: number = Math.max(0, ...levels);
  let pa: number = levels.indexOf(peak); let pb: number = pa;
  while (pb + 1 < levels.length && levels[pb + 1] === peak) { pb += 1; }
  const busiest: string = peak === 0 ? 'None' : `${timeOf(pa * 30)} - ${timeOf((pb + 1) * 30)}`;

  return (
    <section aria-label="Facility schedule">
      <div className={s.pageHead}>
        <div className={`${s.container} ${s.headRow}`}>
          <div className={rf['head-copy']}>
            <SiteEyebrow title={props.facility.title} />
            <h1 className={s.srOnly}>{view === 'week' ? 'The week at a glance' : 'Schedule'}</h1>
            <dl className={s.factRow}>
              <div><dt>{day === today ? 'Free now' : 'Free all day'}</dt><dd>{cal.ready ? `${cookingFree} of ${cookingAll}` : '…'}</dd></div>
              <div><dt>{day === today ? 'Bookings today' : `Bookings ${short(day)}`}</dt><dd>{cal.ready ? dayCount : '…'}</dd></div>
              <div><dt>Busiest</dt><dd>{cal.ready ? busiest : '…'}</dd></div>
            </dl>
          </div>
          <div className={s.row}>
            <div className={`${s.segmented} ${s.segIcons}`} role="group" aria-label="Schedule view">
              <button type="button" aria-pressed={view === 'month'} onClick={() => setView('month')}><RefIcon name="calendar-days" /><span>Calendar</span></button>
              <button type="button" aria-pressed={view === 'cards'} onClick={() => setView('cards')}><RefIcon name="cooking-pot" /><span>Equipment</span></button>
              <button type="button" aria-pressed={view === 'week'} onClick={() => setView('week')}><RefIcon name="activity" /><span>Week</span></button>
            </div>
          </div>
        </div>
      </div>

      {view === 'month' && <div key="v-month" className={`${s.container} ${s.pane}`} data-dir={vdir}><MonthCalendar source={source} facility={facility} resources={resources} /></div>}
      {view !== 'month' && <div key={`v-${view}`} className={`${s.container} ${s.pane}`} data-dir={vdir}>
        <div className={s.dateHead}>
          <button type="button" className={s.roundBtn} aria-label={view === 'week' ? 'Previous week' : 'Previous day'} onClick={() => setDay(addDays(day, view === 'week' ? -7 : -1))}><RefIcon name="chevron-left" size={18} /></button>
          <h2 className={s.dateTitle}>{view === 'week' ? `${range(weekStart)} - ${range(addDays(weekStart, 6))}` : new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${day}T12:00:00Z`))}</h2>
          <button type="button" className={s.roundBtn} aria-label={view === 'week' ? 'Next week' : 'Next day'} onClick={() => setDay(addDays(day, view === 'week' ? 7 : 1))}><RefIcon name="chevron-right" size={18} /></button>
          <span className={s.dateTools}>
            {day !== today && <button type="button" className={s.todayPill} onClick={() => setDay(today)}>Today</button>}
            <label className={s.roundBtn} title="Pick a date"><span className={s.srOnly}>Pick a date</span><RefIcon name="calendar-days" size={18} /><input type="date" value={day} onChange={e => { if (e.target.value) { setDay(e.target.value); } }} /></label>
            <button type="button" className={s.roundBtn} aria-label="Refresh" title="Refresh" onClick={cal.reload}><RefIcon name="rotate-cw" size={18} /></button>
          </span>
        </div>

        {cal.failed && <div className={s.errorPanel} role="alert"><strong>We could not load the schedule.</strong><button type="button" className={s.btn} onClick={cal.reload}>Try again</button></div>}
        {!cal.ready && <div className={s.skeleton} style={{ height: 260 }} role="status" aria-label="Loading the schedule" />}

        {cal.ready && !cal.failed && view === 'week' && (
          <>
            <div className={s.mcGrid} role="grid" aria-label="Week calendar">
              {WEEK.map(w => <div key={w} className={s.mcDow} role="columnheader">{w}</div>)}
              {groupByDay(cal.entries, tz, weekStart, 7).map(b => (
                <button key={b.day} type="button" role="gridcell" aria-selected={day === b.day} aria-label={`${short(b.day)}, ${b.entries.length} ${b.entries.length === 1 ? 'booking' : 'bookings'}`}
                  className={`${s.mcCell} ${b.day === today ? s.mcToday : ''} ${day === b.day ? s.mcSel : ''}`}
                  onClick={() => { setDay(b.day); const el = dayRefs.current[b.day]; if (el) { scrollMainTo(el); } }}>
                  <b>{Number(b.day.slice(8))}</b>
                  {b.entries.length > 0 && <span className={s.mcBars} aria-hidden="true">{b.entries.slice(0, 4).map(e => <i key={e.bookingId} />)}{b.entries.length > 4 && <em>+{b.entries.length - 4}</em>}</span>}
                </button>
              ))}
            </div>
            <div className={s.weekList} aria-label="Bookings this week">
              {groupByDay(cal.entries, tz, weekStart, 7).map(b => (
                <section key={b.day} ref={el => { dayRefs.current[b.day] = el; }} className={`${s.weekDay} ${day === b.day ? s.weekSel : ''}`} aria-label={short(b.day)}>
                  <div className={s.weekDayHead}><strong>{new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${b.day}T12:00:00Z`))}</strong>{b.day === today && <span className={s.weekToday}>Today</span>}</div>
                  {b.entries.length === 0 ? <p className={s.muted}>Nothing booked</p> : <ul>{b.entries.map(e => (
                    <li key={e.bookingId}><strong>{localTime(e.startUtc, tz)} - {localTime(e.endUtc, tz)}</strong><span>{e.memberName}, {equipmentChips(e.space || '', e.equipmentIds, resources).join(', ') || 'Booking'}</span></li>
                  ))}</ul>}
                </section>
              ))}
            </div>
          </>
        )}

        {cal.ready && !cal.failed && view === 'cards' && (
          <>
            <div className={s.freeSummary} role="status">
              <strong>{cookingFree} of {cookingAll} cooking stations free{day === today ? ' right now' : ' all day'}</strong>
              <div className={s.chips} role="group" aria-label="Show">
                {(['all', 'free', 'busy'] as const).map(f => <button key={f} type="button" className={`${s.chipToggle} ${filter === f ? s.chipOn : ''}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f === 'all' ? 'All' : f === 'free' ? 'Free' : 'In use'}</button>)}
              </div>
            </div>
            <UnitCards timeline={timeline} units={resources} tz={tz} nowMs={Date.now()} filter={filter} onPick={props.onBook} />
          </>
        )}
      </div>}
    </section>
  );
}
