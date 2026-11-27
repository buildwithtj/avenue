import * as React from 'react';
import { RefIcon, SiteEyebrow } from './RefUi';
import s from './Site.module.scss';
import rf from './Ref.module.scss';
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
/** Category icons for the grouped day view. */
const GROUP_ICON: Record<string, string> = { Stove: 'cooking-pot', Oven: 'oven', 'Pizza oven': 'oven', Grill: 'flame', Warmer: 'flame', Other: 'settings-2', Rack: 'archive', Refrigeration: 'archive', Fridge: 'archive', 'Prep table': 'layout-dashboard', Mixer: 'settings-2' };

export default function CalendarView(props: ICalendarViewProps): React.ReactElement {
  const { source, facility, resources } = props;
  const tz: string = facility.timeZone;
  const size = useSize();
  const today: string = localDay(new Date(), tz);
  const [day, setDay] = React.useState<string>(today);
  const [view, setViewRaw] = React.useState<'month' | 'cards' | 'day' | 'week'>('month');
  const [vdir, setVdir] = React.useState<'fwd' | 'back'>('fwd');
  const setView = (v: 'month' | 'cards' | 'day' | 'week'): void => { const o: string[] = ['month', 'cards', 'day', 'week']; setVdir(o.indexOf(v) >= o.indexOf(view) ? 'fwd' : 'back'); setViewRaw(v); };
  const [filter, setFilter] = React.useState<'all' | 'free' | 'busy'>('all');
  const cal = useCalendarDay(source, day, view === 'week' ? 7 : 1);
  const busy = React.useMemo(() => buildBusyMap(cal.entries), [cal.entries]);
  const units: IResource[] = React.useMemo(() => resources.concat({ resourceId: DINING_KEY, title: 'Dining room', kind: 'Space', category: 'Other', sortOrder: 100000 }), [resources]);
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
  const busiest: string = peak === 0 ? 'None' : `${timeOf(pa * 30)} - ${timeOf((pb + 1) * 30)}`;
  const heat = React.useMemo(() => weekHeat(units, busy, day, 7, tz), [units, busy, day, tz]);

  return (
    <section aria-label="Facility schedule">
      <div className={s.pageHead}>
        <div className={`${s.container} ${s.headRow}`}>
          <div className={rf['head-copy']}>
            <SiteEyebrow title={props.facility.title} />
            <h1 className={s.pageTitle}>{view === 'month' ? 'Kitchen schedule' : view === 'week' ? 'The week at a glance' : facilityDayLabel(day, today)}<span className={s.rDot} aria-hidden="true">.</span></h1>
            {view !== 'month' && <p className={s.scSub}>{view === 'week' ? `${range(day)} - ${range(addDays(day, 6))}` : long(day)}</p>}
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
              <button type="button" aria-pressed={view === 'day'} onClick={() => setView('day')}><RefIcon name="clock-3" /><span>Timeline</span></button>
              <button type="button" aria-pressed={view === 'week'} onClick={() => setView('week')}><RefIcon name="activity" /><span>Week</span></button>
            </div>
          </div>
        </div>
      </div>

      {view === 'month' && <div key="v-month" className={`${s.container} ${s.pane}`} data-dir={vdir}><MonthCalendar source={source} facility={facility} resources={resources} /></div>}
      {view !== 'month' && <div key={`v-${view}`} className={`${s.container} ${s.pane}`} data-dir={vdir}>
        <div className={s.dateHead}>
          <button type="button" className={s.roundBtn} aria-label={view === 'week' ? 'Previous week' : 'Previous day'} onClick={() => setDay(addDays(day, view === 'week' ? -7 : -1))}><RefIcon name="chevron-left" size={18} /></button>
          <h2 className={s.dateTitle}>{new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${day}T12:00:00Z`))}</h2>
          <button type="button" className={s.roundBtn} aria-label={view === 'week' ? 'Next week' : 'Next day'} onClick={() => setDay(addDays(day, view === 'week' ? 7 : 1))}><RefIcon name="chevron-right" size={18} /></button>
          <span className={s.dateTools}>
            {day !== today && <button type="button" className={s.todayPill} onClick={() => setDay(today)}>Today</button>}
            <label className={s.roundBtn} title="Pick a date"><span className={s.srOnly}>Pick a date</span><RefIcon name="calendar-days" size={18} /><input type="date" value={day} onChange={e => { if (e.target.value) { setDay(e.target.value); } }} /></label>
            <button type="button" className={s.roundBtn} aria-label="Refresh" title="Refresh" onClick={cal.reload}><RefIcon name="rotate-cw" size={18} /></button>
          </span>
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
                    <li key={e.bookingId}><strong>{localTime(e.startUtc, tz)} - {localTime(e.endUtc, tz)}</strong><span>{e.memberName}, {e.space || "Booking"}</span></li>
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
            {size !== 'phone' && timeline.rows.every(r => r.segments.length === 0) && <p className={s.muted}>Nothing is booked on this day.</p>}
            {size !== 'phone' && <Board timeline={timeline} tz={tz} lanes={lanes} nowMs={Date.now()} step={30} label="Schedule board" />}
            {size === 'phone' && (
              <div className={s.agendaByUnit} data-testid="schedule-list">
                {wf.length > 0 && <div className={s.wfBanner} role="status"><strong>The whole building is booked</strong><ul>{wf.map((sg, i) => <li key={i}>{timeOf(sg.startMin)} - {timeOf(sg.endMin)}</li>)}</ul></div>}
                {inUse.map(r => (
                  <article key={r.unitId} className={s.unitAgenda} data-unit={r.unitId}>
                    <h3>{r.title}</h3>
                    <ul>{r.segments.filter(sg => !isWf(sg)).map((sg, i) => <li key={i}><strong>{timeOf(sg.startMin)} - {timeOf(sg.endMin)}</strong><span>{sg.label || 'Booked'}</span></li>)}</ul>
                  </article>
                ))}
                <div className={s.dayStat} role="status"><i aria-hidden="true" /><b>{idle.length === timeline.rows.length ? `All ${timeline.rows.length}` : `${idle.length} of ${timeline.rows.length}`}</b><span>units free {day === today ? 'today' : 'all day'}</span></div>
                {categoryGroups(resources, true).map((g, gi) => {
                  const rowsG = g.units.map(u => ({ u, segs: ((timeline.rows.filter(r2 => r2.unitId === u.resourceId)[0] || { segments: [] }).segments as ITimelineSegment[]).filter(sg => !isWf(sg)) }));
                  const freeN: number = rowsG.filter(x => x.segs.length === 0).length;
                  return (
                    <details key={g.category} className={s.grp} open={gi === 0}>
                      <summary><span className={`${s.ico3d} ${s.ico40}`}><RefIcon name={GROUP_ICON[String(g.category)] || 'cooking-pot'} size={18} /></span><b>{g.title}</b><em className={freeN === rowsG.length ? s.pillOk : freeN === 0 ? s.pillBad : s.pillWait}>{freeN} of {rowsG.length} free</em></summary>
                      <ul className={s.grpRows}>
                        {rowsG.map(({ u, segs }) => (
                          <li key={u.resourceId}>
                            <button type="button" className={s.grpRow} onClick={() => props.onBook && props.onBook(u.resourceId)} disabled={!props.onBook}>
                              <EquipmentArt unit={u} size="xs" />
                              <span className={s.grpName}>{u.title}</span>
                              <em className={segs.length === 0 ? s.pillOk : segs.length === 1 ? s.pillBad : s.pillWait}>{segs.length === 0 ? 'Free' : segs.length === 1 ? `Busy ${timeOf(segs[0].startMin)} - ${timeOf(segs[0].endMin)}` : 'Partly free'}</em>
                              <span className={s.grpBar} aria-hidden="true">{segs.map((sg, i) => <i key={i} style={{ left: `${(sg.startMin / timeline.totalMinutes) * 100}%`, width: `${((sg.endMin - sg.startMin) / timeline.totalMinutes) * 100}%` }} />)}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </details>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>}
    </section>
  );
}
