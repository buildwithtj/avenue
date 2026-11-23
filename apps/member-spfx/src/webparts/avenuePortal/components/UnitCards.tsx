import * as React from 'react';
import s from './Site.module.scss';
import type { IDayTimeline, ITimelineSegment } from '../../../avenue/availability';
import { localTime } from '../../../avenue/calendar';
import type { IResource } from '../../../avenue/contracts';
import { minuteToUtc } from '../../../avenue/ui-helpers';
import { categoryGroups } from '../../../avenue/ui-view';
import { EquipmentArt } from './EquipmentArt';
import { ScrollRow } from './ScrollRow';

export interface IUnitStatus { free: boolean; text: string; sub?: string }

/** One line of status for a piece of equipment on the timeline's day: in use now, free now, or free all day. */
export function unitStatus(segs: ITimelineSegment[], tl: IDayTimeline, tz: string, nowMs: number): IUnitStatus {
  const at = (m: number): string => localTime(minuteToUtc(tl, m), tz);
  const nowMin: number = (nowMs - Date.parse(tl.dayStartUtc)) / 60000;
  const isToday: boolean = nowMin >= 0 && nowMin < tl.totalMinutes;
  if (segs.length === 0) { return { free: true, text: 'Free all day' }; }
  if (!isToday) { return { free: false, text: segs.length === 1 ? '1 booking' : `${segs.length} bookings`, sub: `${at(segs[0].startMin)} – ${at(segs[segs.length - 1].endMin)}` }; }
  const cur: ITimelineSegment | undefined = segs.filter(x => x.startMin <= nowMin && nowMin < x.endMin)[0];
  if (cur) { return { free: false, text: `In use until ${at(cur.endMin)}`, sub: cur.label || undefined }; }
  const nxt: ITimelineSegment | undefined = segs.filter(x => x.startMin > nowMin)[0];
  return nxt ? { free: true, text: 'Free now', sub: `Next booking ${at(nxt.startMin)}` } : { free: true, text: 'Free for the rest of today' };
}

/** Equipment as illustrated cards, grouped by category, each with a status line and a 24-hour strip. */
export function UnitCards(props: { timeline: IDayTimeline; units: IResource[]; tz: string; nowMs: number; filter: 'all' | 'free' | 'busy'; onPick?: (unitId: string) => void }): React.ReactElement {
  const { timeline: tl, tz, nowMs } = props;
  const nowPct: number = ((nowMs - Date.parse(tl.dayStartUtc)) / 60000 / tl.totalMinutes) * 100;
  const rowOf = (id: string): ITimelineSegment[] => (tl.rows.filter(r => r.unitId === id)[0] || { segments: [] }).segments;
  const groups = categoryGroups(props.units, true);
  const [cat, setCat] = React.useState<string>('all');
  const cards = groups.filter(g => cat === 'all' || g.category === cat).reduce((acc: { g: typeof groups[number]; u: IResource }[], g) => acc.concat(g.units.map(u => ({ g, u }))), [])
    .filter(({ u }) => { const st = unitStatus(rowOf(u.resourceId), tl, tz, nowMs); return props.filter === 'all' || (props.filter === 'free' ? st.free : !st.free); });
  return (
    <div data-testid="unit-cards">
      <ScrollRow className={s.catTabs} label="equipment types">
        {[{ category: 'all', title: 'All equipment' }].concat(groups.map(g => ({ category: g.category as string, title: g.title }))).map(g => (
          <button key={g.category} type="button" role="tab" aria-selected={cat === g.category} className={cat === g.category ? s.catOn : ''} onClick={() => setCat(g.category)}>{g.title}</button>
        ))}
      </ScrollRow>
      {cards.length === 0 ? <p className={s.muted}>Nothing matches this filter.</p> : (
        <>
          <div className={s.scScale} aria-hidden="true"><span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>12 AM</span></div>
          <ul className={s.scUnits}>
            {cards.map(({ g, u }) => {
              const segs: ITimelineSegment[] = rowOf(u.resourceId);
              const st: IUnitStatus = unitStatus(segs, tl, tz, nowMs);
              return (
                <li key={u.resourceId} className={`${s.scUnit} ${st.free ? s.scFree : s.scBusy}`} data-unit={u.resourceId}>
                  <EquipmentArt unit={u} size="sm" />
                  <span className={s.scName}><strong>{u.title}</strong><em>{g.title}</em></span>
                  <span className={s.scState}><b><i aria-hidden="true" />{st.text}</b>{st.sub && <em>{st.sub}</em>}</span>
                  <span className={s.scBar} role="img" aria-label={segs.length === 0 ? 'No bookings' : segs.map(x => `${localTime(minuteToUtc(tl, x.startMin), tz)} to ${localTime(minuteToUtc(tl, x.endMin), tz)}`).join(', ')}>
                    {segs.map((x, i) => <i key={i} style={{ left: `${(x.startMin / tl.totalMinutes) * 100}%`, width: `${((x.endMin - x.startMin) / tl.totalMinutes) * 100}%` }} />)}
                    {nowPct >= 0 && nowPct <= 100 && <b style={{ left: `${nowPct}%` }} />}
                  </span>
                  {props.onPick && <button type="button" className={`${s.btn} ${st.free ? s.btnCitrus : ''}`} onClick={() => props.onPick && props.onPick(u.resourceId)}>Book</button>}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
