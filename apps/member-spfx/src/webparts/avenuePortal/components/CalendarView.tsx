import * as React from 'react';
import s from './Site.module.scss';
import { DINING_KEY, buildBusyMap, cookingUnits, dayTimeline, type IDayTimeline, type ITimelineSegment } from '../../../avenue/availability';
import { addDays, groupByDay, localDay, localTime } from '../../../avenue/calendar';
import type { IFacility, IResource } from '../../../avenue/contracts';
import { facilityDayLabel } from '../../../avenue/home';
import type { AvenueReadSource } from '../../../avenue/readSource';
import { busyLevels, minuteToUtc } from '../../../avenue/ui-helpers';
import { categoryGroups, weekHeat } from '../../../avenue/ui-view';
import Board, { type IBoardLane } from './Board';
import { EquipmentArt } from './EquipmentArt';
import { useCalendarDay } from './ui';
import { useSize } from './motion';
import { UnitCards, unitStatus } from './UnitCards';
import MonthCalendar from './MonthCalendar';

export interface ICalendarViewProps {
  source: AvenueReadSource;
  facility: IFacility;
  resources: IResource[];
  /** Opens the booking board (the schedule is also the booking surface). */
  onBook?: (unitId?: string) => void;
}

const LEVEL: string[] = [s.heat0, s.heat1, s.heat2, s.heat3, s.heat4];

// Facility schedule: the board for one day, or a week of equipment x day heat. Names are the member display name only (the
// existing shared-calendar rule). On phones the day becomes a list per piece of equipment.
export default function CalendarView(props: ICalendarViewProps): React.ReactElement {
  const { source, facility, resources } = props;
  const tz: string = facility.timeZone;
  const size = useSize();
  const today: string = localDay(new Date(), tz);
  const [day, setDay] = React.useState<string>(today);
  const [view, setView] = React.useState<'month' | 'cards' | 'day' | 'week'>('month');
  const [filter, setFilter] = React.useState<'all' | 'free' | 'busy'>('all');
  const cal = useCalendarDay(source, day, view === 'week' ? 7 : 1);
  const busy = React.useMemo(() => buildBusyMap(cal.entries), [cal.entries]);
  const units: IResource[] = React.useMemo(() => resources.concat({ resourceId: DINING_KEY, title: 'Dining room', kind: 'Space', category: 'Other', sortOrder: 100000 }), [resources]);
  const zoneName: string = ((): string => {
    try { const t: string = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longGeneric' } as Intl.DateTimeFormatOptions).format(new Date()); return t.indexOf(', ') > 0 ? t.slice(t.indexOf(', ') + 2) : tz; } catch { return tz; }
  })();
  const timeline: IDayTimeline = React.useMemo(() => dayTimeline(units, busy, day, tz), [units, busy, day, tz]);
  const wf: ITimelineSegment[] = React.useMemo(() => dayTimeline([{ resourceId: 'wf', title: 'wf', kind: 'Space' }], buildBusyMap(cal.entries.filter(e => e.space === 'Whole facility')), day, tz).rows[0].segments, [cal.entries, day, tz]);

  const lanes: IBoardLane[] = [];
  categoryGroups(resources, true).forEach(g => g.units.forEach(u => lanes.push({ id: u.resourceId, label: u.title, unit: u, group: g.title, segments: timeline.rows.filter(r => r.unitId === u.resourceId)[0].segments, drawable: false })));
  lanes.push({ id: DINING_KEY, label: 'Dining room', artHint: 'dining', group: 'Dining', segments: timeline.rows.filter(r => r.unitId === DINING_KEY)[0].segments, drawable: false });

  const timeOf = (m: number): string => localTime(minuteToUtc(timeline, m), tz);
  const isWf = (sg: ITimelineSegment): boolean => wf.some(w => w.startMin === sg.startMin && w.endMin === sg.endMin && w.label === sg.label);
  const inUse = timeline.rows.filter(r => r.segments.some(sg => !isWf(sg)));
  const idle = timeline.rows.filter(r => !r.segments.some(sg => !isWf(sg)));
  const long = (ymd: string): string => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${ymd}T12:00:00Z`));
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
  const busiest: string = peak === 0 ? 'Quiet day' : `${timeOf(pa * 30)} – ${timeOf((pb + 1) * 30)}`;
  const heat = React.useMemo(() => weekHeat(units, busy, day, 7, tz), [units, busy, day, tz]);

  return (
    <section aria-label="Facility schedule">
      <div className={s.pageHead}>
        <div className={`${s.container} ${s.headRow}`}>
          <div>
            <h1 className={s.pageTitle}>{view === 'month' ? 'Kitchen schedule' : view === 'week' ? 'The week at a glance' : facilityDayLabel(day, today)}</h1>
            <p className={s.scSub}>{view === 'month' ? 'Approved bookings only' : view === 'week' ? `${range(day)} – ${range(addDays(day, 6))}` : long(day)}, {zoneName}</p>
            <dl className={s.factRow}>
              <div><dt>{day === today ? 'Free now' : 'Free all day'}</dt><dd>{cal.ready ? `${cookingFree} of ${cookingAll}` : '…'}</dd></div>
              <div><dt>{day === today ? 'Bookings today' : `Bookings ${short(day)}`}</dt><dd>{cal.ready ? dayCount : '…'}</dd></div>
              <div><dt>Busiest</dt><dd>{cal.ready ? busiest : '…'}</dd></div>
            </dl>
          </div>
          <div className={s.row}>
            <div className={s.segmented} role="group" aria-label="Schedule view">
              <button type="button" aria-pressed={view === 'month'} onClick={() => setView('month')}>Calendar</button>
              <button type="button" aria-pressed={view === 'cards'} onClick={() => setView('cards')}>Equipment</button>
              <button type="button" aria-pressed={view === 'day'} onClick={() => setView('day')}>Timeline</button>
              <button type="button" aria-pressed={view === 'week'} onClick={() => setView('week')}>Week view</button>
            </div>
            {props.onBook && <button type="button" className={`${s.btn} ${s.btnCitrus}`} onClick={() => props.onBook && props.onBook()}>Book</button>}
          </div>
        </div>
      </div>

      {view === 'month' && <div className={s.container}><MonthCalendar source={source} facility={facility} resources={resources} /></div>}
      {view !== 'month' && <div className={s.container}>
        <div className={s.dayNav}>
          <button type="button" className={s.iconBtn} aria-label={view === 'week' ? 'Previous week' : 'Previous day'} onClick={() => setDay(addDays(day, view === 'week' ? -7 : -1))}>‹</button>
          <label className={s.dateField}><span className={s.srOnly}>Pick a date</span><input type="date" value={day} onChange={e => { if (e.target.value) { setDay(e.target.value); } }} /></label>
          <button type="button" className={s.iconBtn} aria-label={view === 'week' ? 'Next week' : 'Next day'} onClick={() => setDay(addDays(day, view === 'week' ? 7 : 1))}>›</button>
          <button type="button" className={s.btn} onClick={() => setDay(today)} disabled={day === today}>Today</button>
          <button type="button" className={s.iconBtn} aria-label="Refresh" title="Refresh" onClick={cal.reload}>↻</button>
        </div>

        {cal.failed && <div className={s.errorPanel} role="alert"><strong>We could not load the schedule.</strong><button type="button" className={s.btn} onClick={cal.reload}>Try again</button></div>}
        {!cal.ready && <div className={s.skeleton} style={{ height: 260 }} role="status" aria-label="Loading the schedule" />}

        {cal.ready && !cal.failed && view === 'week' && (size === 'phone'
          ? (
            <div className={s.weekList} aria-label="Seven-day booking overview">
              {groupByDay(cal.entries, tz, day, 7).map(bucket => (
                <section key={bucket.day} className={s.weekDay} aria-label={bucket.day}>
                  <div className={s.weekDayHead}><strong>{short(bucket.day)}</strong><button type="button" className={s.linkBtn} onClick={() => { setDay(bucket.day); setView('day'); }}>View day<span className={s.srOnly}> {bucket.day}</span></button></div>
                  {bucket.entries.length === 0 ? <p className={s.muted}>No approved bookings</p> : <ul>{bucket.entries.map(e => (
                    <li key={e.bookingId}><strong>{localTime(e.startUtc, tz)} – {localTime(e.endUtc, tz)}</strong><span>{e.memberName}, {e.space || "Booking"}</span></li>
                  ))}</ul>}
                </section>
              ))}
            </div>
          )
          : (
            <div className={s.heatWrap} role="region" aria-label="Seven-day booking overview" tabIndex={0}>
              <table className={s.heat}>
                <thead><tr><th scope="col"><span className={s.srOnly}>Equipment</span></th>{heat[0].cells.map(c => <th key={c.day} scope="col">{short(c.day)}</th>)}</tr></thead>
                <tbody>
                  {heat.map(r => (
                    <tr key={r.unitId}>
                      <th scope="row"><EquipmentArt unit={units.filter(u => u.resourceId === r.unitId)[0]} size="xs" /><span>{r.title}</span></th>
                      {r.cells.map(c => (
                        <td key={c.day} className={LEVEL[c.level]}><button type="button" aria-label={`${r.title}, ${short(c.day)}: booked ${c.percent}% of the day`} onClick={() => { setDay(c.day); setView('day'); }}>{c.percent > 0 ? `${c.percent}%` : ''}</button></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <ul className={s.legend} aria-label="Legend"><li><i className={s.heat0} />Free</li><li><i className={s.heat2} />Half booked</li><li><i className={s.heat4} />Fully booked</li></ul>
            </div>
          ))}

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

        {cal.ready && !cal.failed && view === 'day' && (
          <>
            {timeline.rows.every(r => r.segments.length === 0) && <p className={s.muted}>Nothing is booked on this day.</p>}
            {size !== 'phone' && <Board timeline={timeline} tz={tz} lanes={lanes} nowMs={Date.now()} step={30} label="Schedule board" />}
            {size === 'phone' && (
              <div className={s.agendaByUnit} data-testid="schedule-list">
                {wf.length > 0 && <div className={s.wfBanner} role="status"><strong>The whole building is booked</strong><ul>{wf.map((sg, i) => <li key={i}>{timeOf(sg.startMin)} – {timeOf(sg.endMin)}</li>)}</ul></div>}
                {inUse.map(r => (
                  <article key={r.unitId} className={s.unitAgenda} data-unit={r.unitId}>
                    <h3>{r.title}</h3>
                    <ul>{r.segments.filter(sg => !isWf(sg)).map((sg, i) => <li key={i}><strong>{timeOf(sg.startMin)} – {timeOf(sg.endMin)}</strong><span>{sg.label || 'Booked'}</span></li>)}</ul>
                  </article>
                ))}
                {idle.length > 0 && <p className={s.muted}>{wf.length > 0 ? 'No separate bookings: ' : 'Free all day: '}{idle.map(r => r.title).join(', ')}</p>}
              </div>
            )}
          </>
        )}
      </div>}
    </section>
  );
}
