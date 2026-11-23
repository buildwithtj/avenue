import * as React from 'react';
import s from './Site.module.scss';
import type { IDayTimeline, ITimelineSegment } from '../../../avenue/availability';
import { localTime } from '../../../avenue/calendar';
import type { IResource } from '../../../avenue/contracts';
import { minuteToUtc, nowPercent } from '../../../avenue/ui-helpers';
import { blockFromSlots, slotBusy, slotFromX } from '../../../avenue/ui-view';
import { EquipmentArt } from './EquipmentArt';
import { anim, useReducedMotion } from './motion';

export interface IBoardLane {
  id: string;
  label: string;
  /** Equipment shown as artwork; aggregate lanes give an art hint instead. */
  unit?: IResource;
  artHint?: string;
  group?: string;
  segments: ITimelineSegment[];
  drawable: boolean;
  selected?: boolean;
  onToggle?: () => void;
}

export interface IBoardBlock { startMin: number; endMin: number; flagged?: boolean }

export interface IBoardProps {
  timeline: IDayTimeline;
  tz: string;
  lanes: IBoardLane[];
  nowMs: number;
  step: number;
  label: string;
  /** Book mode: the member's block, drawn on these lanes. */
  block?: IBoardBlock;
  blockLaneIds?: string[];
  /** A drawn block that was refused flashes here. */
  rejected?: { startMin: number; endMin: number; key: number };
  onCommit?: (startMin: number, endMin: number, laneId: string) => void;
  onBusy?: (laneId: string, minute: number) => void;
}

const HOURS: number[] = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
const hourLabel = (h: number): string => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'a' : 'p'}`;

/**
 * The schedule board: equipment rows grouped by category, time ruler across, "now" marker, other companies as muted bars.
 * With onCommit the member draws on it: drag with a mouse, or tap a start then an end (touch and mouse). Keyboard users use
 * the start and end pickers beside the board; this component never decides whether a block is allowed.
 */
export default function Board(props: IBoardProps): React.ReactElement {
  const { timeline: tl, tz, lanes, step, block } = props;
  const reduced: boolean = useReducedMotion();
  const interactive: boolean = !!props.onCommit;
  const [pending, setPending] = React.useState<{ min: number } | undefined>();
  const [drag, setDrag] = React.useState<{ laneId: string; a: number; b: number } | undefined>();
  const dragRef: React.MutableRefObject<{ laneId: string; a: number; b: number; moved: boolean } | undefined> = React.useRef<{ laneId: string; a: number; b: number; moved: boolean } | undefined>();
  const swallow: React.MutableRefObject<boolean> = React.useRef<boolean>(false);
  const scroller: React.RefObject<HTMLDivElement> = React.useRef<HTMLDivElement>(null);
  const now: number | undefined = nowPercent(tl, props.nowMs);
  const timeOf = (m: number): string => localTime(minuteToUtc(tl, m), tz);
  const segText = (sg: ITimelineSegment): string => `${sg.label || 'Booked'}, ${timeOf(sg.startMin)} to ${timeOf(sg.endMin)}`;

  React.useEffect(() => {
    const el: HTMLDivElement | null = scroller.current;
    if (el && typeof el.scrollTo === 'function') { el.scrollLeft = Math.max(0, ((now !== undefined ? now : 33) / 100) * 24 * 56 - 40); }
  }, [tl.dayStartUtc]);

  const minuteAt = (e: { clientX: number }, track: HTMLElement): number => {
    const r: DOMRect = track.getBoundingClientRect();
    return slotFromX(e.clientX, r.left, r.width, tl.totalMinutes, step);
  };

  const down = (e: React.PointerEvent<HTMLDivElement>, lane: IBoardLane): void => {
    if (!interactive || !lane.drawable || e.pointerType === 'touch' || (e.button !== undefined && e.button !== 0)) { return; }
    const m: number = minuteAt(e, e.currentTarget);
    if (slotBusy(lane.segments, m, step)) { return; }
    dragRef.current = { laneId: lane.id, a: m, b: m, moved: false };
    setDrag({ laneId: lane.id, a: m, b: m });
    if (typeof e.currentTarget.setPointerCapture === 'function' && e.pointerId !== undefined) { try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not capturable */ } }
  };
  const move = (e: React.PointerEvent<HTMLDivElement>): void => {
    const d = dragRef.current;
    if (!d) { return; }
    const m: number = minuteAt(e, e.currentTarget);
    if (m !== d.a) { d.moved = true; }
    d.b = m;
    setDrag({ laneId: d.laneId, a: d.a, b: m });
  };
  const up = (): void => {
    const d = dragRef.current;
    dragRef.current = undefined;
    setDrag(undefined);
    if (d && d.moved && props.onCommit) {
      const b = blockFromSlots(d.a, d.b, step, tl.totalMinutes);
      swallow.current = true;
      window.setTimeout(() => { swallow.current = false; }, 0);
      setPending(undefined);
      props.onCommit(b.startMin, b.endMin, d.laneId);
    }
  };
  const click = (e: React.MouseEvent<HTMLDivElement>, lane: IBoardLane): void => {
    if (!interactive || !lane.drawable || swallow.current) { return; }
    const m: number = minuteAt(e, e.currentTarget);
    if (slotBusy(lane.segments, m, step)) { if (props.onBusy) { props.onBusy(lane.id, m); } return; }
    if (!pending) { setPending({ min: m }); return; }
    const b = blockFromSlots(pending.min, m, step, tl.totalMinutes);
    setPending(undefined);
    if (props.onCommit) { props.onCommit(b.startMin, b.endMin, lane.id); }
  };

  const pct = (m: number): string => `${(m / tl.totalMinutes) * 100}%`;
  const wide = (a: number, b: number): string => `${((b - a) / tl.totalMinutes) * 100}%`;
  const ghost = drag ? blockFromSlots(drag.a, drag.b, step, tl.totalMinutes) : undefined;
  const groups: string[] = lanes.map(l => l.group || '').filter((g, i, all) => all.indexOf(g) === i);

  return (
    <div className={s.boardWrap}>
      {interactive && (
        <p className={s.boardHint} role="status" aria-live="polite">
          {pending ? `Start ${timeOf(pending.min)}. Tap where you finish.` : 'Drag across a free row, or tap a start and then an end.'}
          {pending && <button type="button" className={s.linkBtn} onClick={() => setPending(undefined)}>Cancel</button>}
        </p>
      )}
      <div className={s.board} ref={scroller} tabIndex={0} role="region" aria-label={`${props.label}, scrolls sideways`} data-testid="board">
        <div className={s.boardGrid} style={{ '--p': now !== undefined ? now / 100 : 0 } as React.CSSProperties}>
          <div className={s.ruler}>
            <div className={s.rulerCorner} />
            <div className={s.rulerTrack} aria-hidden="true">{HOURS.map(h => <span key={h} style={{ left: `${(h / 24) * 100}%` }}>{hourLabel(h)}</span>)}</div>
          </div>
          {groups.map(g => (
            <React.Fragment key={g}>
              {g && <div className={s.groupRow}><span>{g}</span></div>}
              {lanes.filter(l => (l.group || '') === g).map(lane => {
                const onBlock: boolean = !!block && !!props.blockLaneIds && props.blockLaneIds.indexOf(lane.id) >= 0;
                return (
                  <div key={lane.id} className={`${s.lane} ${lane.selected ? s.laneOn : ''} ${lane.drawable ? s.laneDrawable : ''}`} data-lane={lane.id}>
                    {lane.onToggle
                      ? <button type="button" className={s.laneLabel} aria-pressed={!!lane.selected} onClick={lane.onToggle}><EquipmentArt unit={lane.unit} hint={lane.artHint} size="xs" /><span>{lane.label}</span></button>
                      : <div className={s.laneLabel}><EquipmentArt unit={lane.unit} hint={lane.artHint} size="xs" /><span>{lane.label}</span></div>}
                    <div
                      className={s.laneTrack} data-track={lane.id} role="group" aria-label={lane.label}
                      onPointerDown={e => down(e, lane)} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onClick={e => click(e, lane)}
                    >
                      {lane.segments.map((sg, i) => (
                        <span key={i} className={`${s.busy} ${anim(reduced, s.busyGrow)}`} style={{ left: pct(sg.startMin), width: wide(sg.startMin, sg.endMin) }} title={segText(sg)} aria-label={segText(sg)} role="img">
                          <strong>{sg.label || 'Booked'}</strong>
                        </span>
                      ))}
                      {onBlock && block && <span key={`${block.startMin}-${block.endMin}`} className={`${s.block} ${block.flagged ? s.blockFlag : ''} ${anim(reduced, s.blockSettle)}`} style={{ left: pct(block.startMin), width: wide(block.startMin, block.endMin) }} data-testid="block"><b>{timeOf(block.startMin)} – {timeOf(block.endMin)}</b></span>}
                      {props.rejected && lane.drawable && <span key={props.rejected.key} className={`${s.block} ${s.blockRejected} ${anim(reduced, s.blockShake)}`} style={{ left: pct(props.rejected.startMin), width: wide(props.rejected.startMin, props.rejected.endMin) }} aria-hidden="true" />}
                      {drag && drag.laneId === lane.id && ghost && <span className={`${s.block} ${s.blockGhost}`} style={{ left: pct(ghost.startMin), width: wide(ghost.startMin, ghost.endMin) }} aria-hidden="true" />}
                      {pending && lane.drawable && <span className={s.pendingMark} style={{ left: pct(pending.min) }} aria-hidden="true" />}
                    </div>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
          {now !== undefined && <div className={`${s.nowLine} ${anim(reduced, s.nowPulse)}`} title="Now" style={{ height: '100%' }}><span>Now</span></div>}
        </div>
      </div>
      <ul className={s.legend} aria-label="Legend">
        <li><i className={s.keyFree} />Free</li><li><i className={s.keyBusy} />Booked by another company</li>{interactive && <li><i className={s.keyBlock} />Your block</li>}
      </ul>
    </div>
  );
}
