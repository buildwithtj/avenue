import * as React from 'react';
import s from './Site.module.scss';
import {
  type BookingMode, type BusyMap, type IDayTimeline, type ISelectionInput, type ISelectionResult, DEFAULT_MIN_PREP_TABLES, DINING_KEY, WHOLE_FACILITY_KEY,
  assignPrepTables, buildBusyMap, cookingUnits, dayTimeline, hoursPreview, nextFreeSlots, prepTables, unitStatus, validateSelection
} from '../../../avenue/availability';
import { hoursThisMonth } from '../../../avenue/booking';
import { selectionToRequest, sentOutcome } from '../../../avenue/bookingFlow';
import { addDays, localDay, localTime, zonedToUtc } from '../../../avenue/calendar';
import type { IBookingRequestInput, IDiningTable, IFacility, IMyMembership, IMyRequest, IResource } from '../../../avenue/contracts';
import { detailLines, selectionMessages, timeLines } from '../../../avenue/copy';
import { type AvenueReadSource, newSubmissionId } from '../../../avenue/readSource';
import { clamp, hmLabel, hoursLabel, lengthBounds, lengthLabel, minuteToUtc, toHm } from '../../../avenue/ui-helpers';
import { type KitKey, KITS, categoryGroups, kitSelection, mergeSegments, pickSlots, prepShortSegments } from '../../../avenue/ui-view';
import { diningRoomImage } from '../assets';
import Board, { type IBoardLane } from './Board';
import { EquipmentArt } from './EquipmentArt';
import { Sheet } from './Sheet';
import { formatWhen, useCalendarDay, useLoad } from './ui';
import { anim, useReducedMotion } from './motion';

export interface IBookBoardProps {
  source: AvenueReadSource;
  facility: IFacility;
  resources: IResource[];
  tables: IDiningTable[];
  onSent: () => void;
  /** Signed-in member's e-mail. Only used to read their own plan hours for the "hours left" line. */
  userEmail?: string;
  /** Equipment chosen on the Schedule: starts the request with this piece ticked. */
  preselectUnit?: string;
}

const KIT_ART: Record<KitKey, string> = { 'hot-line': 'stove', bakery: 'oven', prep: 'prep', 'whole-kitchen': 'range', dining: 'dining', 'private-event': 'dining' };
const KIT_SUMMARY: Record<BookingMode, string> = { equipment: 'Equipment', 'whole-kitchen': 'Whole kitchen', dining: 'Dining room', 'private-event': 'Private event (whole facility)' };
const PREP_LANE: string = '#prep';
const KITCHEN_LANE: string = '#kitchen';
const BUILDING_LANE: string = '#building';

interface IBlock { startUtc: string; endUtc: string }

function Tick(): React.ReactElement {
  return <svg className={s.tick} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
}

/**
 * BOOK ON THE BOARD. The schedule is the booking surface: choose a kit, then draw your block on the free space of your
 * equipment rows (drag, or tap a start then an end). A clashing block is refused with a suggestion in our own words. The
 * dock at the bottom confirms and sends a REQUEST: nothing is booked until Flavors approves (client call 11 Nov 2026).
 */
export default function BookBoard(props: IBookBoardProps): React.ReactElement {
  const { source, facility, resources, tables, onSent, userEmail } = props;
  const tz: string = facility.timeZone;
  const bounds = lengthBounds(facility);
  const step: number = bounds.step;
  const minPrep: number = facility.minPrepTables === undefined ? DEFAULT_MIN_PREP_TABLES : facility.minPrepTables;
  const cooking: IResource[] = cookingUnits(resources);
  const prep: IResource[] = prepTables(resources);
  const maxPrep: number = Math.max(prep.length, minPrep);
  const totalSeats: number | undefined = tables.length > 0 ? tables.reduce((a, t) => a + t.seats, 0) : undefined;
  const catalog: { equipmentIds: string[]; totalSeats?: number } = { equipmentIds: resources.map(r => r.resourceId), totalSeats };
  const reduced: boolean = useReducedMotion();

  const today: string = localDay(new Date(), tz);
  const [kit, setKit] = React.useState<KitKey | undefined>();
  const [mode, setMode] = React.useState<BookingMode>('equipment');
  const [unitIds, setUnitIds] = React.useState<string[]>([]);
  const [prepCount, setPrepCount] = React.useState<number>(minPrep);
  const [people, setPeople] = React.useState<string>('');
  const [day, setDayRaw] = React.useState<string>(today);
  const [block, setBlock] = React.useState<IBlock | undefined>();
  const [lengthMin, setLengthMin] = React.useState<number>(clamp(120, bounds.min, bounds.max));
  const [messages, setMessages] = React.useState<string[]>([]);
  const [rejected, setRejected] = React.useState<{ startMin: number; endMin: number; key: number } | undefined>();
  const [findOpen, setFindOpen] = React.useState<boolean>(false);
  const [detailsOpen, setDetailsOpen] = React.useState<boolean>(false);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [sending, setSending] = React.useState<boolean>(false);
  const [sentId, setSentId] = React.useState<string | undefined>();
  const [sentRequest, setSentRequest] = React.useState<IMyRequest | undefined>();
  const [sentSummary, setSentSummary] = React.useState<string>('');
  const inFlight: React.MutableRefObject<boolean> = React.useRef<boolean>(false);

  React.useEffect(() => {
    const id: string | undefined = props.preselectUnit;
    if (id && cooking.some(u => u.resourceId === id)) { setMode('equipment'); setUnitIds([id]); setKit('hot-line'); }
  }, [props.preselectUnit]);

  const setDay = (d: string): void => { setDayRaw(d); setBlock(undefined); setMessages([]); setRejected(undefined); };

  const cal = useCalendarDay(source, day, 3);
  const busy: BusyMap = React.useMemo(() => buildBusyMap(cal.entries), [cal.entries]);
  const timeline: IDayTimeline = React.useMemo(() => {
    const dining: IResource = { resourceId: DINING_KEY, title: 'Dining room', kind: 'Space', sortOrder: 100000 };
    return dayTimeline(resources.concat(dining), busy, day, tz);
  }, [resources, busy, day, tz]);
  const rowOf = (id: string): IDayTimeline['rows'][number] | undefined => timeline.rows.filter(r => r.unitId === id)[0];

  const me = useLoad<{ membership?: IMyMembership; requests: IMyRequest[] }>(async () => {
    const [membership, requests] = await Promise.all([
      userEmail ? source.getMyMembership(userEmail).catch(() => undefined) : Promise.resolve(undefined),
      source.listMyRequests().catch((): IMyRequest[] => [])
    ]);
    return { membership, requests };
  }, [source, userEmail]);

  // After sending, ask the member's own request list for the flow's answer until it has one (or about two minutes pass).
  React.useEffect(() => {
    if (!sentId) { return undefined; }
    let live: boolean = true;
    let tries: number = 0;
    const timer: { id?: number } = {};
    const poll = (): void => {
      source.listMyRequests().then(rs => {
        if (!live) { return; }
        const mine: IMyRequest | undefined = rs.filter(r => r.requestId === sentId)[0];
        setSentRequest(mine);
        tries += 1;
        if (!(mine && mine.status) && tries < 15) { timer.id = window.setTimeout(poll, 8000); }
      }).catch(() => { if (live && tries < 15) { tries += 1; timer.id = window.setTimeout(poll, 8000); } });
    };
    timer.id = window.setTimeout(poll, 3000);
    return () => { live = false; window.clearTimeout(timer.id); };
  }, [source, sentId]);

  const title = (id: string): string => (resources.filter(r => r.resourceId === id)[0] || { title: id }).title;
  const selection = (ids: string[], b: IBlock): ISelectionInput => ({ mode, unitIds: ids, prepTableCount: prepCount, startUtc: b.startUtc, endUtc: b.endUtc, units: resources, busy, facility, nowMs: Date.now() });

  /** Draw or move the block. A clash (taken equipment, too few prep tables, the past) is refused with a suggestion. */
  const tryApply = (b: IBlock, ids: string[] = unitIds): boolean => {
    const input: ISelectionInput = selection(ids, b);
    const result: ISelectionResult = validateSelection(input);
    const prepShort: boolean = result.problems.some(p => /prep tables? (is|are) free/.test(p));
    const past: boolean = result.problems.some(p => /in the past/.test(p));
    if (result.unavailable.length > 0 || prepShort || past) {
      const startMin: number = (Date.parse(b.startUtc) - Date.parse(timeline.dayStartUtc)) / 60000;
      const endMin: number = (Date.parse(b.endUtc) - Date.parse(timeline.dayStartUtc)) / 60000;
      setRejected({ startMin, endMin, key: Date.now() });
      setMessages(past && result.unavailable.length === 0 ? ['That start time has already passed. Draw your block later in the day.'] : selectionMessages(input, result));
      return false;
    }
    setRejected(undefined);
    setMessages([]);
    setUnitIds(ids);
    setBlock(b);
    setErrors([]);
    return true;
  };

  const onCommit = (a: number, z: number, laneId: string): void => {
    const extra: string | undefined = mode === 'equipment' && laneId !== PREP_LANE && unitIds.indexOf(laneId) < 0 && cooking.some(u => u.resourceId === laneId) ? laneId : undefined;
    tryApply({ startUtc: minuteToUtc(timeline, a), endUtc: minuteToUtc(timeline, z) }, extra ? unitIds.concat(extra) : unitIds);
  };
  const onBusy = (laneId: string, minute: number): void => {
    const input: ISelectionInput = { ...selection(laneId === PREP_LANE ? unitIds : unitIds.concat(laneId), { startUtc: minuteToUtc(timeline, minute), endUtc: minuteToUtc(timeline, minute + Math.max(step, lengthMin)) }) };
    setMessages(selectionMessages(input, validateSelection(input)).slice(0, 2));
  };

  const pickKit = (key: KitKey): void => {
    const sel = kitSelection(key, resources, facility);
    setKit(key); setMode(sel.mode); setUnitIds(sel.unitIds); setPrepCount(clamp(sel.prepTableCount, minPrep, maxPrep)); setMessages([]); setRejected(undefined); setErrors([]);
  };
  const toggleUnit = (id: string): void => {
    const on: boolean = unitIds.indexOf(id) >= 0;
    const ids: string[] = on ? unitIds.filter(x => x !== id) : unitIds.concat(id);
    if (block && !on) { tryApply(block, ids); } else { setUnitIds(ids); setMessages([]); }
  };

  const lanes: IBoardLane[] = [];
  if (mode === 'equipment') {
    categoryGroups(resources).forEach(g => g.units.forEach(u => lanes.push({
      id: u.resourceId, label: u.title, unit: u, group: g.title, segments: (rowOf(u.resourceId) || { segments: [] }).segments, drawable: true,
      selected: unitIds.indexOf(u.resourceId) >= 0, onToggle: () => toggleUnit(u.resourceId)
    })));
    lanes.push({ id: PREP_LANE, label: `Prep tables (${prepCount})`, artHint: 'prep', group: 'Prep tables', segments: prepShortSegments(resources, busy, timeline, prepCount, step), drawable: true, selected: true });
  } else if (mode === 'whole-kitchen') {
    lanes.push({ id: KITCHEN_LANE, label: 'Whole kitchen', artHint: 'stove', group: 'Your booking', segments: mergeSegments(cooking.concat(prep).map(u => ((rowOf(u.resourceId) || { segments: [] }).segments))), drawable: true, selected: true });
    categoryGroups(resources, true).forEach(g => g.units.forEach(u => lanes.push({ id: u.resourceId, label: u.title, unit: u, group: 'Included', segments: (rowOf(u.resourceId) || { segments: [] }).segments, drawable: false })));
  } else if (mode === 'dining') {
    lanes.push({ id: DINING_KEY, label: 'Dining room', artHint: 'dining', group: 'Your booking', segments: (rowOf(DINING_KEY) || { segments: [] }).segments, drawable: true, selected: true });
  } else {
    lanes.push({ id: BUILDING_LANE, label: 'Whole building', artHint: 'dining', group: 'Your booking', segments: mergeSegments(timeline.rows.map(r => r.segments)), drawable: true, selected: true });
  }
  const blockLaneIds: string[] = mode === 'equipment' ? unitIds.concat(PREP_LANE) : mode === 'whole-kitchen' ? [KITCHEN_LANE] : mode === 'dining' ? [DINING_KEY] : [BUILDING_LANE];

  const dayStartMs: number = Date.parse(timeline.dayStartUtc);
  const minOf = (iso: string): number => (Date.parse(iso) - dayStartMs) / 60000;
  const startMin: number | undefined = block ? minOf(block.startUtc) : undefined;
  const endMin: number | undefined = block ? minOf(block.endUtc) : undefined;
  const result: ISelectionResult | undefined = block ? validateSelection(selection(unitIds, block)) : undefined;
  const peopleNum: number = people === '' ? NaN : Number(people);
  const peopleOk: boolean = Number.isInteger(peopleNum) && peopleNum >= 1 && (totalSeats === undefined || peopleNum <= totalSeats);
  const problems: string[] = result ? result.problems.slice() : [];
  if (mode === 'dining' && block && !peopleOk) { problems.push(totalSeats !== undefined && peopleNum > totalSeats ? `The dining room seats ${totalSeats}.` : 'Enter how many people are coming.'); }
  const canSend: boolean = !!block && !!result && problems.length === 0 && !sending;

  const startOptions: number[] = [];
  for (let m: number = 0; m < timeline.totalMinutes; m += step) { startOptions.push(m); }
  const endOptions: number[] = [];
  if (startMin !== undefined) { for (let m: number = startMin + bounds.min; m <= startMin + Math.min(bounds.max, 24 * 60); m += step) { endOptions.push(m); } }
  const timeText = (m: number): string => `${localTime(minuteToUtc(timeline, m), tz)}${m >= timeline.totalMinutes ? ' (next day)' : ''}`;
  const setStartPick = (m: number): void => { const len: number = block && startMin !== undefined && endMin !== undefined ? endMin - startMin : lengthMin; tryApply({ startUtc: minuteToUtc(timeline, m), endUtc: minuteToUtc(timeline, m + len) }); setLengthMin(len); };
  const setEndPick = (m: number): void => { if (startMin !== undefined) { setLengthMin(m - startMin); tryApply({ startUtc: minuteToUtc(timeline, startMin), endUtc: minuteToUtc(timeline, m) }); } };

  // Hours line: only when the member's plan hours are known. Booked time only; early entry and cleaning are free.
  const planHours: number | undefined = me.data && me.data.membership ? me.data.membership.monthlyHours : undefined;
  let hoursLine: string | undefined;
  let hoursFact: string | undefined;
  if (planHours !== undefined && block && me.data) {
    const p = hoursPreview(Date.parse(block.endUtc) - Date.parse(block.startUtc), planHours, hoursThisMonth(me.data.requests, tz, new Date(block.startUtc)));
    hoursLine = p.over > 0 ? `Uses ${hoursLabel(p.thisBooking)}, ${hoursLabel(p.over)} over plan. Extra is billed next payment.` : `Uses ${hoursLabel(p.thisBooking)}, ${hoursLabel(p.leftAfter)} left.`;
    hoursFact = p.over > 0 ? `${hoursLabel(p.over)} over plan` : `${hoursLabel(p.leftAfter)} left`;
  }

  // Find my time: the best three starts for the current kit and length.
  const findIds: string[] = mode === 'equipment' ? unitIds : mode === 'dining' ? [WHOLE_FACILITY_KEY]
    : cooking.concat(prep).map(u => u.resourceId).concat(mode === 'private-event' ? [DINING_KEY] : []);
  const findSlots = (): string[] => {
    const dayStart: number = Date.parse(zonedToUtc(day, '00:00', tz));
    const from: number = Math.max(Date.now(), dayStart);
    const hours: number = Math.max(1, 3 * 24 - (from - dayStart) / 3600000 - 12);
    const all: string[] = nextFreeSlots(findIds, lengthMin, new Date(from).toISOString(), busy, step, 300, hours)
      .filter(a => mode !== 'equipment' || assignPrepTables(resources, busy, a, new Date(Date.parse(a) + lengthMin * 60000).toISOString(), prepCount).shortBy === 0);
    return pickSlots(all, lengthMin, 3);
  };
  const applySlot = (iso: string): void => {
    const d: string = localDay(iso, tz);
    setDayRaw(d); setRejected(undefined); setMessages([]);
    setBlock({ startUtc: iso, endUtc: new Date(Date.parse(iso) + lengthMin * 60000).toISOString() });
    setFindOpen(false);
  };

  const send = (): void => {
    if (inFlight.current || sending) { return; }
    if (!block || !result) { setErrors(['Draw your time on the board first.']); return; }
    if (problems.length > 0) { setErrors(problems); return; }
    const body: IBookingRequestInput = selectionToRequest({
      mode, facilityId: facility.facilityId, resolvedUnitIds: result.resolvedUnitIds, kitchenUnitIds: cooking.concat(prep).map(u => u.resourceId),
      peopleCount: mode === 'dining' ? peopleNum : undefined, startUtc: block.startUtc, endUtc: block.endUtc
    });
    const id: string = newSubmissionId('req');
    inFlight.current = true;
    setSending(true);
    source.submitRequest(body, id, catalog, Date.now())
      .then(() => { setSentSummary(`${KIT_SUMMARY[mode]} · ${formatWhen(block.startUtc, block.endUtc, tz)}`); setSentId(id); })
      .catch((err: Error) => { setErrors([`${err.message} Your block is kept; you can send it again.`]); })
      .then(() => { inFlight.current = false; setSending(false); }, () => { inFlight.current = false; setSending(false); });
  };
  const reset = (): void => { setSentId(undefined); setSentRequest(undefined); setBlock(undefined); setUnitIds([]); setKit(undefined); setPrepCount(minPrep); setPeople(''); setErrors([]); setMessages([]); };

  if (sentId) {
    const o = sentOutcome(sentRequest);
    return (
      <section className={`${s.result} ${anim(reduced, s.resultIn)} ${o.state === 'approved' ? s.resultOk : o.state === 'declined' ? s.resultBad : ''}`} aria-live="polite" aria-label="Booking request result">
        <div className={s.resultMark} aria-hidden="true">{o.state === 'declined' ? '!' : <Tick />}</div>
        <div className={s.eyebrow}>{o.final ? 'Result' : 'Sent'}</div>
        <h2 className={s.display}>{o.title}</h2>
        <p>{o.detail}</p>
        <p className={s.muted}>{sentSummary}</p>
        {!o.final && <p className={s.muted}>Checking for the answer automatically. You can leave this page; the result also appears in My bookings.</p>}
        <div className={s.row}>
          <button type="button" className={`${s.btn} ${s.btnInk}`} onClick={onSent}>View my bookings</button>
          <button type="button" className={s.btn} onClick={reset}>Book again</button>
        </div>
      </section>
    );
  }

  const lines = block ? timeLines({ startUtc: block.startUtc, endUtc: block.endUtc }, facility) : undefined;
  const lengthChips: number[] = [60, 120, 180, 240].filter(m => m >= bounds.min && m <= bounds.max);
  const statusFor = (id: string): { free: boolean; until?: string } => {
    if (!block) { return { free: true }; }
    const st = unitStatus(id, block.startUtc, block.endUtc, busy);
    return { free: st.free, until: st.takenUntilUtc ? localTime(st.takenUntilUtc, tz) : undefined };
  };
  const equipmentText: string = mode === 'equipment'
    ? `${unitIds.length > 0 ? unitIds.map(title).join(', ') : 'No cooking equipment'}; prep tables: ${result && result.resolvedUnitIds.length > 0 ? result.resolvedUnitIds.filter(id => prep.some(p => p.resourceId === id)).map(title).join(', ') || prepCount : prepCount}`
    : mode === 'dining' ? (peopleOk ? `${peopleNum} ${peopleNum === 1 ? 'person' : 'people'}` : 'Number of people not set')
      : mode === 'whole-kitchen' ? 'All kitchen equipment and prep tables' : 'Kitchen and dining room';

  return (
    <section className={s.bookPage} aria-label="Book kitchen time">
      <div className={s.pageHead}>
        <div className={s.container}>
          <div className={s.eyebrow}>Book on the board</div>
          <ol className={s.steps} aria-label="Booking steps">
            {['Choose', 'Pick a time', 'Review & send', 'Confirmed'].map((n, i) => {
              const at: number = !kit && unitIds.length === 0 ? 0 : !block ? 1 : 2;
              return <li key={n} className={i < at ? s.stepDone : i === at ? s.stepNow : ''} aria-current={i === at ? 'step' : undefined}><b>{i < at ? '✓' : i + 1}</b>{n}</li>;
            })}
          </ol>
          <h1 className={s.pageTitle}>{!kit && unitIds.length === 0 ? 'What are you making?' : !block ? 'Now pick your time' : 'Review and send'}</h1>
          <div className={s.kitBar} role="group" aria-label="Kits">
            {KITS.map(k => (
              <button key={k.key} type="button" className={`${s.kit} ${kit === k.key ? s.kitOn : ''}`} aria-pressed={kit === k.key} data-kit={k.key} onClick={() => pickKit(k.key)}>
                <EquipmentArt hint={KIT_ART[k.key]} size="sm" />
                <span className={s.kitText}><strong>{k.title}</strong></span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={s.boardBand}>
        <div className={s.container}>
          <div className={s.boardTools}>
            <div className={s.dayNav}>
              <button type="button" className={s.iconBtn} aria-label="Previous day" onClick={() => setDay(addDays(day, -1))} disabled={day <= today}>‹</button>
              <label className={s.dateField}><span className={s.srOnly}>Day</span><input type="date" value={day} min={today} onChange={e => { if (e.target.value) { setDay(e.target.value); } }} /></label>
              <button type="button" className={s.iconBtn} aria-label="Next day" onClick={() => setDay(addDays(day, 1))}>›</button>
              <button type="button" className={s.btn} onClick={() => setDay(today)} disabled={day === today}>Today</button>
            </div>
            <div className={s.pickers} role="group" aria-label="Start and end, without dragging">
              <label><span>Start</span>
                <select value={startMin === undefined ? '' : String(startMin)} onChange={e => { if (e.target.value !== '') { setStartPick(Number(e.target.value)); } }}>
                  <option value="">Choose</option>
                  {startOptions.map(m => <option key={m} value={m}>{hmLabel(toHm(m % 1440))}</option>)}
                </select>
              </label>
              <label><span>End</span>
                <select value={endMin === undefined ? '' : String(endMin)} disabled={startMin === undefined} onChange={e => { if (e.target.value !== '') { setEndPick(Number(e.target.value)); } }}>
                  <option value="">Choose</option>
                  {endOptions.map(m => <option key={m} value={m}>{timeText(m)}</option>)}
                </select>
              </label>
            </div>
            <button type="button" className={`${s.btn} ${s.btnLight}`} onClick={() => setFindOpen(true)}>Find my time</button>
          </div>

          {mode === 'equipment' && (
            <div className={s.chipBar}>
              <div className={s.chips} role="group" aria-label="Equipment on your block">
                {cooking.map(u => {
                  const on: boolean = unitIds.indexOf(u.resourceId) >= 0;
                  const st = statusFor(u.resourceId);
                  return (
                    <button key={u.resourceId} type="button" className={`${s.chipToggle} ${on ? s.chipOn : ''}`} aria-pressed={on} data-unit={u.resourceId} onClick={() => toggleUnit(u.resourceId)}>
                      <i className={`${s.dot} ${st.free ? s.dotFree : s.dotTaken}`} aria-hidden="true" />{u.title}{!st.free && <span className={s.srOnly}>, taken until {st.until}</span>}
                    </button>
                  );
                })}
              </div>
              <div className={s.stepper} role="group" aria-label="Number of prep tables">
                <span>Prep tables</span>
                <button type="button" className={s.iconBtn} aria-label="Fewer prep tables" disabled={prepCount <= minPrep} onClick={() => setPrepCount(prepCount - 1)}>−</button>
                <b aria-live="polite">{prepCount}</b>
                <button type="button" className={s.iconBtn} aria-label="More prep tables" disabled={prepCount >= maxPrep || prep.length === 0} onClick={() => setPrepCount(prepCount + 1)}>+</button>
              </div>
            </div>
          )}
          {mode === 'dining' && (
            <>
              <div className={s.diningStrip}><img src={diningRoomImage} alt="The dining room at Flavors" /><p>{totalSeats !== undefined ? `${totalSeats} seats` : 'Seating confirmed by Flavors'}</p></div>
              <div className={s.diningForm}>
                <label className={s.inline}><span>Number of people</span><input type="number" inputMode="numeric" min={1} step={1} value={people} onChange={e => setPeople(e.target.value)} /></label>
                {totalSeats !== undefined && <button type="button" className={s.btn} onClick={() => setPeople(String(totalSeats))}>Whole room</button>}
              </div>
              {block && !peopleOk && <p className={s.inlineErr} role="alert">{totalSeats !== undefined && peopleNum > totalSeats ? `The room seats ${totalSeats}.` : 'Enter how many people.'}</p>}
            </>
          )}
          {block && problems.filter(x => !/people|seats/i.test(x)).length > 0 && <p className={s.inlineErr} role="alert">{problems.filter(x => !/people|seats/i.test(x))[0]}</p>}

          <div className={s.messages} role="alert" aria-live="assertive">
            {messages.map((m, i) => <p key={i} className={s.suggest}>{m}</p>)}
          </div>
          {!cal.ready ? <div className={s.skeleton} style={{ height: 260 }} role="status" aria-label="Checking what is booked" />
            : <Board timeline={timeline} tz={tz} lanes={lanes} nowMs={Date.now()} step={step} label="Booking board" block={block && startMin !== undefined && endMin !== undefined ? { startMin, endMin, flagged: problems.length > 0 } : undefined} blockLaneIds={blockLaneIds} rejected={rejected} onCommit={onCommit} onBusy={onBusy} />}
          {cal.failed && <p className={s.hintOnDark} role="status">We could not check what is already booked. You can still send your request; Flavors will check it.</p>}
        </div>
      </div>

      <aside className={s.dock} aria-label="Your booking">
        <div className={s.container}>
          {!block ? (
            <p className={s.dockText}><span>{kit ? 'Now draw your time on the board.' : 'Pick a kit, then draw your time.'}</span></p>
          ) : (
            <>
              <p className={s.dockText}>
                <strong>{kit ? KITS.filter(k => k.key === kit)[0].title : KIT_SUMMARY[mode]}</strong>
                <span>{formatWhen(block.startUtc, block.endUtc, tz)}</span>
              </p>
              <span className={s.dockFact}>{hoursFact || lengthLabel((Date.parse(block.endUtc) - Date.parse(block.startUtc)) / 60000)}</span>
              {problems.length > 0 && <span className={s.dockCount} aria-live="polite">{problems.length} {problems.length === 1 ? 'thing' : 'things'} to fix</span>}
              <button type="button" className={s.btn} onClick={() => setDetailsOpen(true)}>Details</button>
              <button type="button" className={`${s.btn} ${s.btnCitrus}`} onClick={send} disabled={!canSend}>{sending ? 'Sending…' : 'Send request'}</button>
            </>
          )}
        </div>
      </aside>

      {detailsOpen && block && (
        <Sheet title="Your booking" onClose={() => setDetailsOpen(false)}
          footer={<div className={s.row}><button type="button" className={`${s.btn} ${s.btnInk}`} onClick={() => setDetailsOpen(false)}>Back to the board</button></div>}>
          <dl className={s.facts}>
            <div><dt>What</dt><dd>{KIT_SUMMARY[mode]}</dd></div>
            <div><dt>When</dt><dd>{formatWhen(block.startUtc, block.endUtc, tz)} · {lengthLabel((Date.parse(block.endUtc) - Date.parse(block.startUtc)) / 60000)}</dd></div>
            <div><dt>Equipment</dt><dd>{equipmentText}</dd></div>
          </dl>
          {lines && <ul className={s.windows}><li>{lines.early}</li><li>{lines.booked}</li><li>{lines.cleaning}</li></ul>}
          {hoursLine && <p className={s.hoursLine}>{hoursLine}</p>}
          {(problems.length > 0 || errors.length > 0) && <ul className={s.problems} role="alert">{(errors.length > 0 ? errors : problems).map((p, i) => <li key={i}>{p}</li>)}</ul>}
          <details className={s.more}><summary>More details</summary><ul>{detailLines(facility).map((l, i) => <li key={i}>{l}</li>)}</ul></details>
        </Sheet>
      )}

      {findOpen && (
        <Sheet title="Find my time" side="center" onClose={() => setFindOpen(false)}>
          <div className={s.chips} role="group" aria-label="How long">
            {lengthChips.map(m => <button key={m} type="button" className={`${s.chipToggle} ${lengthMin === m ? s.chipOn : ''}`} aria-pressed={lengthMin === m} onClick={() => setLengthMin(m)}>{lengthLabel(m)}</button>)}
          </div>
          <ul className={s.slots} aria-label="Suggested times">
            {findSlots().map((iso, i) => (
              <li key={iso}><button type="button" className={s.slot} onClick={() => applySlot(iso)}>
                <b>{i === 0 ? 'Earliest' : `Option ${i + 1}`}</b>
                <span>{formatWhen(iso, new Date(Date.parse(iso) + lengthMin * 60000).toISOString(), tz)}</span>
              </button></li>
            ))}
          </ul>
          {findSlots().length === 0 && <p className={s.muted}>We could not find a free time in the next few days. Try fewer pieces of equipment.</p>}
        </Sheet>
      )}
    </section>
  );
}
