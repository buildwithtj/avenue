import * as React from 'react';
import s from './Site.module.scss';
import {
  type BookingMode, type ISelectionInput, type ISelectionResult, DEFAULT_MIN_PREP_TABLES, DINING_KEY,
  buildBusyMap, cookingUnits, dayTimeline, hoursPreview, prepTables, unitStatus, validateSelection
} from '../../../avenue/availability';
import { hoursThisMonth } from '../../../avenue/booking';
import { selectionToRequest, sentOutcome } from '../../../avenue/bookingFlow';
import { addDays, localDay, localTime } from '../../../avenue/calendar';
import type { IBookingRequestInput, IDiningTable, IFacility, IMyMembership, IMyRequest, IResource } from '../../../avenue/contracts';
import { selectionMessages, timeLines } from '../../../avenue/copy';
import { type AvenueReadSource, newSubmissionId } from '../../../avenue/readSource';
import { hoursLabel, lengthBounds, lengthLabel, minuteToUtc } from '../../../avenue/ui-helpers';
import { categoryGroups } from '../../../avenue/ui-view';
import { EquipmentArt } from './EquipmentArt';
import { formatWhen, useCalendarDay, useLoad } from './ui';
import { buzz, toast } from './feedback';

export interface IBookFlowProps {
  source: AvenueReadSource;
  facility: IFacility;
  resources: IResource[];
  tables: IDiningTable[];
  onSent: () => void;
  userEmail?: string;
  /** Equipment picked on the Schedule: starts the request with this piece ticked. */
  preselectUnit?: string;
  preselectMode?: BookingMode;
}

type Step = 'choose' | 'review';
const WHAT: { mode: BookingMode; title: string; sub: string; art: string }[] = [
  { mode: 'equipment', title: 'Equipment', sub: 'Choose the stoves, ovens and tables you need', art: 'Stove' },
  { mode: 'whole-kitchen', title: 'Whole kitchen', sub: 'Every station and prep table', art: 'Oven' },
  { mode: 'dining', title: 'Dining room', sub: 'Tables and chairs for a group', art: 'dining' },
  { mode: 'private-event', title: 'Private event', sub: 'Kitchen and dining room together', art: 'dining' }
];
const SUMMARY: Record<BookingMode, string> = { equipment: 'Equipment', 'whole-kitchen': 'Whole kitchen', dining: 'Dining room', 'private-event': 'Private event' };

type MarkState = 'sending' | 'checking' | 'approved' | 'waiting' | 'declined' | 'cancelled';
/** Loader ring while sending, then the ring draws closed and a tick draws in; gold burst on approval, shake on decline. */
function SendMark(props: { state: MarkState }): React.ReactElement {
  const st: MarkState = props.state;
  const bad: boolean = st === 'declined' || st === 'cancelled';
  return (
    <div className={`${s.sendMark} ${st === 'sending' ? s.smSpin : ''} ${st === 'approved' ? s.smGold : ''} ${bad ? s.smBad : ''}`} aria-hidden="true" data-state={st}>
      <svg viewBox="0 0 64 64">
        <circle className={s.smTrack} cx="32" cy="32" r="28" />
        <circle className={s.smRing} cx="32" cy="32" r="28" />
        {st !== 'sending' && !bad && <path className={s.smTick} d="M20 33l8 8 16-17" />}
        {bad && <path className={s.smTick} d="M32 19v17M32 44v1" />}
      </svg>
      {st === 'approved' && <span className={s.smBurst}>{[0, 1, 2, 3, 4, 5, 6, 7].map(i => <i key={i} style={{ transform: `rotate(${i * 45}deg)` }} />)}</span>}
    </div>
  );
}

/**
 * BOOK: left column picks the window (what, day, start time, then end time); right column lists the equipment with its
 * availability for that window right under each piece. Taken pieces offer the next start time they are free.
 * The request always goes to Flavors; nothing is booked until it is approved.
 */
export default function BookFlow(props: IBookFlowProps): React.ReactElement {
  const { source, facility, resources, tables, userEmail } = props;
  const tz: string = facility.timeZone;
  const baseBounds = lengthBounds(facility);
  const minPrep: number = facility.minPrepTables === undefined ? DEFAULT_MIN_PREP_TABLES : facility.minPrepTables;
  const cooking: IResource[] = cookingUnits(resources);
  const prep: IResource[] = prepTables(resources);
  const maxPrep: number = Math.max(prep.length, minPrep);
  const totalSeats: number | undefined = tables.length > 0 ? tables.reduce((a, t) => a + t.seats, 0) : undefined;
  const catalog: { equipmentIds: string[]; totalSeats?: number } = { equipmentIds: resources.map(r => r.resourceId), totalSeats };
  const today: string = localDay(new Date(), tz);

  const pre: boolean = !!props.preselectUnit && cooking.some(u => u.resourceId === props.preselectUnit);
  const [step, setStep] = React.useState<Step>('choose');
  const [mode, setMode] = React.useState<BookingMode>(props.preselectMode || 'equipment');
  // Client sheet (19 Nov 2026): private events are booked as 4 / 6 / 8 / 12-hour packages, so the shortest is 4 hours (UI limit; further hours are extra).
  const bounds = mode === 'private-event' ? { ...baseBounds, min: Math.max(baseBounds.min, 240), max: Math.max(baseBounds.max, 240) } : baseBounds;
  const [day, setDay] = React.useState<string>(today);
  const [startMin, setStartMin] = React.useState<number | undefined>();
  const [endMin, setEndMin] = React.useState<number | undefined>();
  const [unitIds, setUnitIds] = React.useState<string[]>(pre && props.preselectUnit ? [props.preselectUnit] : []);
  const [prepCount, setPrepCount] = React.useState<number>(minPrep);
  const [people, setPeople] = React.useState<string>('');
  const [errors, setErrors] = React.useState<string[]>([]);
  const [sending, setSending] = React.useState<boolean>(false);
  const [sentId, setSentId] = React.useState<string | undefined>();
  const [sentRequest, setSentRequest] = React.useState<IMyRequest | undefined>();
  const [sentSummary, setSentSummary] = React.useState<string>('');
  const inFlight: React.MutableRefObject<boolean> = React.useRef<boolean>(false);

  const cal = useCalendarDay(source, day, 3);
  const busy = React.useMemo(() => buildBusyMap(cal.entries, undefined, (facility.earlyEntryMinutes || 0) + (facility.cleanupMinutes || 0)), [cal.entries, facility.earlyEntryMinutes, facility.cleanupMinutes]);
  const timeline = React.useMemo(() => dayTimeline(resources.concat({ resourceId: DINING_KEY, title: 'Dining room', kind: 'Space', sortOrder: 100000 }), busy, day, tz), [resources, busy, day, tz]);
  const me = useLoad<{ membership?: IMyMembership; requests: IMyRequest[] }>(async () => {
    const [membership, requests] = await Promise.all([
      userEmail ? source.getMyMembership(userEmail).catch(() => undefined) : Promise.resolve(undefined),
      source.listMyRequests().catch((): IMyRequest[] => [])
    ]);
    return { membership, requests };
  }, [source, userEmail]);

  // After sending, ask the member's own request list for the flow's answer (about two minutes).
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

  const finalSeen: React.MutableRefObject<string> = React.useRef<string>('');
  React.useEffect(() => {
    const st: string | undefined = sentRequest && sentRequest.status;
    if (!sentId || !st || finalSeen.current === `${sentId}|${st}`) { return; }
    finalSeen.current = `${sentId}|${st}`;
    if (st === 'Approved') { toast('Approved. Your booking is confirmed.'); } else if (st === 'Declined') { toast('Flavors did not accept this request.', 'bad'); } else if (st === 'Pending') { toast('Sent to Flavors for a decision.', 'info'); }
  }, [sentId, sentRequest]);
  const title = (id: string): string => (resources.filter(r => r.resourceId === id)[0] || { title: id }).title;
  const peopleNum: number = people === '' ? NaN : Number(people);
  const peopleOk: boolean = Number.isInteger(peopleNum) && peopleNum >= 1 && (totalSeats === undefined || peopleNum <= totalSeats);
  const lengthMin: number = startMin !== undefined && endMin !== undefined ? endMin - startMin : bounds.min;
  const sel = (ids: string[], m: number, len: number = lengthMin): ISelectionInput => ({
    mode, unitIds: ids, prepTableCount: prepCount, startUtc: minuteToUtc(timeline, m), endUtc: minuteToUtc(timeline, m + len),
    units: resources, busy, facility, nowMs: Date.now()
  });
  // A start time is offered when the kitchen could take it at all (not past, whole kitchen / dining free, prep tables free).
  const slotOk = (m: number, len: number = lengthMin): boolean => {
    const r: ISelectionResult = validateSelection(sel(mode === 'equipment' ? [] : unitIds, m, len));
    return r.unavailable.length === 0 && !r.problems.some(p => /in the past|prep tables? (is|are) free|refrigerator is free/.test(p));
  };
  const starts: number[] = [];
  const nowMs: number = Date.now();
  // Open 24 hours (client sheet, Booking Rules): any start from midnight on the step.
  for (let m: number = 0; m <= timeline.totalMinutes - bounds.min; m += bounds.step) { if (Date.parse(minuteToUtc(timeline, m)) > nowMs) { starts.push(m); } }
  const timed: boolean = startMin !== undefined && endMin !== undefined;
  const result: ISelectionResult | undefined = timed && startMin !== undefined ? validateSelection(sel(unitIds, startMin)) : undefined;
  const problems: string[] = result ? result.problems.slice() : [];
  if (mode === 'dining' && !peopleOk) { problems.push(totalSeats !== undefined && peopleNum > totalSeats ? `The dining room seats ${totalSeats}.` : 'Enter how many people are coming.'); }
  const needsPick: boolean = mode === 'equipment' || mode === 'dining';
  const startUtc: string | undefined = timed && startMin !== undefined ? minuteToUtc(timeline, startMin) : undefined;
  const endUtc: string | undefined = timed && endMin !== undefined ? minuteToUtc(timeline, endMin) : undefined;

  const free = (id: string): { free: boolean; until?: string; untilUtc?: string } => {
    if (!startUtc || !endUtc) { return { free: true }; }
    const st = unitStatus(id, startUtc, endUtc, busy);
    return { free: st.free, until: st.takenUntilUtc ? localTime(st.takenUntilUtc, tz) : undefined, untilUtc: st.takenUntilUtc };
  };
  const planHours: number | undefined = me.data && me.data.membership ? me.data.membership.monthlyHours : undefined;
  let hoursLine: string | undefined;
  if (planHours !== undefined && startUtc && endUtc && me.data) {
    const p = hoursPreview(Date.parse(endUtc) - Date.parse(startUtc), planHours, hoursThisMonth(me.data.requests, tz, new Date(startUtc)));
    hoursLine = p.over > 0 ? `Uses ${hoursLabel(p.thisBooking)}, ${hoursLabel(p.over)} over plan. Extra is billed next payment.` : `Uses ${hoursLabel(p.thisBooking)}, ${hoursLabel(p.leftAfter)} left this month.`;
  }
  const fridge: string | undefined = result ? result.resolvedUnitIds.filter(id => resources.some(r => r.resourceId === id && r.category === 'Fridge'))[0] : undefined;
  const equipmentText: string = mode === 'equipment'
    ? `${unitIds.length > 0 ? unitIds.map(title).join(', ') : 'No cooking equipment'} + ${result && result.resolvedUnitIds.length > 0 ? result.resolvedUnitIds.filter(id => prep.some(p => p.resourceId === id)).length : prepCount} prep tables${fridge ? ` + ${title(fridge)} (included)` : ''}`
    : mode === 'dining' ? `${peopleOk ? peopleNum : '?'} people` : mode === 'whole-kitchen' ? 'All kitchen equipment and prep tables' : 'Kitchen and dining room';

  const ready: boolean = timed && startMin !== undefined && slotOk(startMin) && problems.length === 0;
  const send = (): void => {
    if (inFlight.current || sending || !result || startUtc === undefined || endUtc === undefined) { return; }
    if (problems.length > 0) { setErrors(problems); return; }
    const body: IBookingRequestInput = selectionToRequest({
      mode, facilityId: facility.facilityId, resolvedUnitIds: result.resolvedUnitIds, kitchenUnitIds: cooking.concat(prep).map(u => u.resourceId),
      peopleCount: mode === 'dining' ? peopleNum : undefined, startUtc, endUtc
    });
    const id: string = newSubmissionId('req');
    inFlight.current = true;
    setSending(true);
    source.submitRequest(body, id, catalog, Date.now())
      .then(() => { setSentSummary(`${SUMMARY[mode]} · ${formatWhen(startUtc, endUtc, tz)}`); setSentId(id); toast('Request sent to Flavors'); })
      .catch((err: Error) => { setErrors([`${err.message} Your choices are kept; you can send again.`]); toast('Could not send. Your choices are kept.', 'bad'); })
      .then(() => { inFlight.current = false; setSending(false); }, () => { inFlight.current = false; setSending(false); });
  };

  if (sending && !sentId) {
    return (
      <section className={s.result} aria-live="polite" aria-label="Sending your request">
        <SendMark state="sending" />
        <div className={s.eyebrow}>Sending</div>
        <h2 className={s.display}>Sending your request…</h2>
        <p className={s.muted}>{SUMMARY[mode]}{startUtc && endUtc ? ` · ${formatWhen(startUtc, endUtc, tz)}` : ''}</p>
      </section>
    );
  }
  if (sentId) {
    const o = sentOutcome(sentRequest);
    return (
      <section className={`${s.result} ${o.state === 'approved' ? s.resultOk : o.state === 'declined' ? s.resultBad : ''}`} aria-live="polite" aria-label="Booking request result">
        <SendMark state={o.state as MarkState} />
        <div className={s.eyebrow}>{o.final ? 'Result' : 'Sent'}</div>
        <h2 className={s.display}>{o.title}</h2>
        <p>{o.detail}</p>
        <p className={s.muted}>{sentSummary}</p>
        {!o.final && <p className={`${s.muted} ${s.waitDots}`}>Checking with Flavors<i /><i /><i /></p>}
        {!o.final && <p className={s.muted}>You can leave this page; the result also appears in My bookings.</p>}
        <div className={s.row}>
          <button type="button" className={`${s.btn} ${s.btnInk}`} onClick={props.onSent}>View my bookings</button>
          <button type="button" className={s.btn} onClick={() => { setSentId(undefined); setSentRequest(undefined); setStartMin(undefined); setEndMin(undefined); setUnitIds([]); setStep('choose'); setErrors([]); }}>Book something else</button>
        </div>
      </section>
    );
  }

  const at: number = step === 'choose' ? 0 : 1;
  const steps: string[] = ['Choose', 'Review', 'Confirmed'];
  const action: React.ReactElement = step === 'review'
    ? <button type="button" className={`${s.btn} ${s.btnCitrus}`} onClick={send} disabled={sending || problems.length > 0}>{sending ? <><i className={s.btnSpin} aria-hidden="true" />Sending…</> : 'Send request'}</button>
    : <button type="button" className={`${s.btn} ${s.btnCitrus}`} disabled={!ready} onClick={() => { buzz('tap'); setStep('review'); }}>Review request</button>;
  const lines = startUtc && endUtc ? timeLines({ startUtc, endUtc }, facility) : undefined;
  const dayOpts: string[] = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  const fmt = (d: string, o: Intl.DateTimeFormatOptions): string => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...o }).format(new Date(`${d}T12:00:00Z`));
  const at12 = (m: number): string => (m >= timeline.totalMinutes ? 'Midnight' : localTime(minuteToUtc(timeline, m), tz));
  const okStarts: number[] = starts.filter(m => slotOk(m, bounds.min));
  const pickDay = (d: string): void => { buzz('tap'); setDay(d); setStartMin(undefined); setEndMin(undefined); };
  const pickMode = (m: BookingMode): void => { buzz('tap'); setMode(m); setUnitIds([]); setStartMin(undefined); setEndMin(undefined); };
  // Taken piece: offer the first start (on the step) when it is free again, keeping the chosen length if the day allows it.
  const moveTo = (untilUtc: string, unitId: string): number | undefined => {
    const raw: number = (Date.parse(untilUtc) - Date.parse(timeline.dayStartUtc)) / 60000;
    const m: number = Math.ceil(raw / bounds.step) * bounds.step;
    return m + lengthMin <= timeline.totalMinutes && slotOk(m, lengthMin) && unitStatus(unitId, minuteToUtc(timeline, m), minuteToUtc(timeline, m + lengthMin), busy).free ? m : undefined;
  };
  // When the kitchen is actually free: consecutive offered starts merge into one window; the gaps between are one block each.
  const windows: { a: number; b: number }[] = [];
  let lastStart: number = -1;
  okStarts.forEach(m => {
    const w = windows[windows.length - 1];
    if (w && m === lastStart + bounds.step) { w.b = Math.min(m + bounds.min, timeline.totalMinutes); } else { windows.push({ a: m, b: Math.min(m + bounds.min, timeline.totalMinutes) }); }
    lastStart = m;
  });
  const blocks: { a: number; b: number; free: boolean }[] = [];
  let cursor: number = starts.length > 0 ? starts[0] : timeline.totalMinutes;
  windows.forEach(w => { if (w.a > cursor) { blocks.push({ a: cursor, b: w.a, free: false }); } blocks.push({ a: w.a, b: w.b, free: true }); cursor = Math.max(cursor, w.b); });
  if (cursor < timeline.totalMinutes && starts.length > 0) { blocks.push({ a: cursor, b: timeline.totalMinutes, free: false }); }
  const win = startMin !== undefined ? windows.filter(w => startMin >= w.a && startMin < w.b)[0] : undefined;
  const pickWindow = (w: { a: number; b: number }): void => { buzz('tap'); setStartMin(w.a); setEndMin(Math.min(w.b, w.a + Math.max(bounds.min, Math.min(120, bounds.max)))); };
  const dur = (m: number): string => { const h: number = Math.floor(m / 60); return `${h > 0 ? `${h} h` : ''}${m % 60 ? ` ${m % 60} min` : ''}`.trim(); };
  const DAY0: number = 0;
  const pastEnd: number = starts.length > 0 ? starts[0] : timeline.totalMinutes;
  const span: number = timeline.totalMinutes - DAY0;
  const pct = (m: number): number => Math.max(0, Math.min(100, ((m - DAY0) / span) * 100));
  const unitBar = (id: string): React.ReactElement => {
    const row = timeline.rows.filter(r => r.unitId === id)[0];
    const segs = row ? row.segments.filter(g => g.endMin > DAY0) : [];
    return (
      <span className={s.bkBar} aria-hidden="true">
        {segs.map((g, i) => <i key={i} className={s.bkBusy} style={{ left: `${pct(g.startMin)}%`, width: `${pct(g.endMin) - pct(g.startMin)}%` }} />)}
        {timed && startMin !== undefined && endMin !== undefined && <i className={s.bkWin} style={{ left: `${pct(startMin)}%`, width: `${pct(endMin) - pct(startMin)}%` }} />}
      </span>
    );
  };
  const dayNote = (id: string): string => {
    const row = timeline.rows.filter(r => r.unitId === id)[0];
    const segs = row ? row.segments : [];
    if (segs.length === 0) { return 'Free all day'; }
    return `${segs.length} ${segs.length === 1 ? 'booking' : 'bookings'}`;
  };

  return (
    <section className={s.bf} aria-label="Book kitchen time">
      <div className={s.container}>
        <ol className={s.steps} aria-label="Booking steps">
          {steps.map((n, i) => <li key={n} className={i < at ? s.stepDone : i === at ? s.stepNow : ''} aria-current={i === at ? 'step' : undefined}><b>{i < at ? '✓' : i + 1}</b>{n}</li>)}
        </ol>
        {step === 'choose' && (
          <div className={s.bk}>
            <div className={s.bkSide} role="group" aria-label="When">
              <h1 className={s.bfTitle}>Book the kitchen</h1>
              <div className={s.bkModes} role="group" aria-label="What you need">
                {WHAT.map(w => <button key={w.mode} type="button" aria-pressed={mode === w.mode} className={mode === w.mode ? s.bkModeOn : ''} onClick={() => pickMode(w.mode)}>{w.title}</button>)}
              </div>

              <h2 className={s.bkLabel}>1 · Date</h2>
              <div className={s.bkDays}>
                {dayOpts.map(d => (
                  <button key={d} type="button" aria-pressed={day === d} aria-label={fmt(d, { weekday: 'long', month: 'long', day: 'numeric' })} className={day === d ? s.bkDayOn : ''} onClick={() => pickDay(d)}>
                    <span>{d === today ? 'Today' : fmt(d, { weekday: 'short' })}</span><b>{fmt(d, { day: 'numeric' })}</b>
                  </button>
                ))}
              </div>

              <h2 className={s.bkLabel}>2 · Your hours</h2>
              {!cal.ready ? <div className={s.skeleton} style={{ height: 120 }} role="status" aria-label="Checking what is booked" />
                : windows.length === 0 ? <p className={s.bfEmpty}>Nothing is free on this day for {SUMMARY[mode].toLowerCase()}. Try another day.</p> : (
                  <>
                    <div className={s.dayTrack} aria-hidden="true">
                      {pastEnd > DAY0 && <i className={s.dtPast} style={{ left: 0, width: `${pct(pastEnd)}%` }} />}
                      {blocks.map((k, i) => <i key={i} className={k.free ? s.dtFree : s.dtBusy} style={{ left: `${pct(k.a)}%`, width: `${pct(k.b) - pct(k.a)}%` }} />)}
                      {timed && startMin !== undefined && endMin !== undefined && <b className={s.dtSel} style={{ left: `${pct(startMin)}%`, width: `${pct(endMin) - pct(startMin)}%` }} />}
                    </div>
                    <div className={s.dtScale} aria-hidden="true"><span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>12 AM</span></div>
                    <ul className={s.winList} aria-label="Free and booked times">
                      {blocks.map((k, i) => k.free ? (
                        <li key={i}><button type="button" aria-pressed={win === undefined ? false : win.a === k.a} className={win && win.a === k.a ? s.winOn : ''} onClick={() => pickWindow(k)}>
                          <span className={s.winDot} aria-hidden="true" /><strong>{at12(k.a)} – {at12(k.b)}</strong><em>{dur(k.b - k.a)} free</em><i aria-hidden="true">{win && win.a === k.a ? '✓' : '›'}</i>
                        </button></li>
                      ) : (
                        <li key={i} className={s.winBusy}><span className={s.winDot} aria-hidden="true" /><strong>{at12(k.a)} – {at12(k.b)}</strong><em>Not available</em></li>
                      ))}
                    </ul>
                    {win && startMin !== undefined && endMin !== undefined && (
                      <div className={s.range} role="group" aria-label="Start and end time">
                        <div className={s.rangeRead}>
                          <div><small>Start</small><b>{at12(startMin)}</b></div>
                          <span>{dur(endMin - startMin)}</span>
                          <div><small>End</small><b>{at12(endMin)}</b></div>
                        </div>
                        <div className={s.rangeTrack}>
                          <i style={{ left: `${((startMin - win.a) / (win.b - win.a)) * 100}%`, width: `${((endMin - startMin) / (win.b - win.a)) * 100}%` }} />
                          <input type="range" aria-label="Start time" min={win.a} max={win.b} step={bounds.step} value={startMin}
                            onChange={e => { const v: number = Math.min(Number(e.target.value), endMin - bounds.min); if (v !== startMin) { buzz('tap'); setStartMin(v); } }} />
                          <input type="range" aria-label="End time" min={win.a} max={win.b} step={bounds.step} value={endMin}
                            onChange={e => { const v: number = Math.min(Math.max(Number(e.target.value), startMin + bounds.min), startMin + bounds.max); if (v !== endMin) { buzz('tap'); setEndMin(v); } }} />
                        </div>
                        <div className={s.rangeEnds} aria-hidden="true"><span>{at12(win.a)}</span><span>{at12(win.b)}</span></div>
                      </div>
                    )}
                  </>
                )}
              {cal.failed && <p className={s.muted}>We could not check what is booked. You can still send a request; our team will check it.</p>}
            </div>

            <div className={s.bkMain}>
              <div className={s.bkHead}>
                <h2>{mode === 'equipment' ? 'Your equipment' : SUMMARY[mode]}</h2>
                <p>{timed && startUtc && endUtc ? `Availability for ${formatWhen(startUtc, endUtc, tz)}` : `Availability on ${day === today ? 'today' : fmt(day, { weekday: 'long', month: 'short', day: 'numeric' })}. Pick your hours to check them.`}</p>
                <ul className={s.bkKey} aria-hidden="true"><li><i className={s.bkKeyBusy} />Booked</li><li><i className={s.bkKeyWin} />Your time</li></ul>
                <div className={s.bkScale} aria-hidden="true"><span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>12 AM</span></div>
              </div>

              {mode === 'equipment' && (
                <>
                  {categoryGroups(resources).map(g => (
                    <section key={g.category} aria-label={g.title} className={s.bkGroup}>
                      <h3>{g.title}</h3>
                      <ul className={s.bkUnits}>
                        {g.units.map(u => {
                          const f = free(u.resourceId);
                          const on: boolean = unitIds.indexOf(u.resourceId) >= 0;
                          const alt: number | undefined = !f.free && f.untilUtc ? moveTo(f.untilUtc, u.resourceId) : undefined;
                          return (
                            <li key={u.resourceId} className={`${on ? s.bkUnitOn : ''} ${timed && !f.free ? s.bkUnitOff : ''}`}>
                              <button type="button" disabled={!f.free && !on} aria-pressed={on} data-unit={u.resourceId} className={s.bkUnitBtn}
                                onClick={() => { buzz('tap'); setUnitIds(on ? unitIds.filter(x => x !== u.resourceId) : unitIds.concat(u.resourceId)); }}>
                                <EquipmentArt unit={u} size="sm" />
                                <span className={s.bkUnitText}><strong title={u.title}>{u.title}</strong><i className={s.leader} aria-hidden="true" />
                                  <em className={timed ? (f.free ? s.bkFree : s.bkTaken) : ''}>{timed ? (f.free ? (on ? 'Yours' : 'Free') : `Taken till ${f.until || ''}`) : dayNote(u.resourceId)}</em>
                                </span>
                                <b className={s.bkTick} aria-hidden="true">{on ? '✓' : '+'}</b>
                              </button>
                              {unitBar(u.resourceId)}
                              {timed && !f.free && (alt !== undefined
                                ? <button type="button" className={s.bkMove} onClick={() => { buzz('success'); setStartMin(alt); setEndMin(alt + lengthMin); }}>Move to {at12(alt)} – {at12(alt + lengthMin)}</button>
                                : <span className={s.bkMoveNone}>Not free later today. Try another day.</span>)}
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ))}
                  <div className={s.bfPrep}>
                    <EquipmentArt hint="Prep table" size="sm" /><div><strong>Prep tables</strong><span>Every booking includes at least {minPrep}</span></div>
                    <div className={s.stepper} role="group" aria-label="Number of prep tables">
                      <button type="button" className={s.iconBtn} aria-label="Fewer prep tables" disabled={prepCount <= minPrep} onClick={() => setPrepCount(prepCount - 1)}>−</button>
                      <b aria-live="polite">{prepCount}</b>
                      <button type="button" className={s.iconBtn} aria-label="More prep tables" disabled={prepCount >= maxPrep || prep.length === 0} onClick={() => setPrepCount(prepCount + 1)}>+</button>
                    </div>
                  </div>
                  {problems.length > 0 && result && startMin !== undefined && <p className={s.inlineErr} role="alert">{selectionMessages(sel(unitIds, startMin), result)[0] || problems[0]}</p>}
                </>
              )}

              {mode === 'dining' && (
                <section className={s.bkGroup} aria-label="Guests">
                  <h3>How many people?</h3>
                  <div className={s.diningForm}>
                    <label className={s.inline}><span>Number of people</span><input type="number" inputMode="numeric" min={1} step={1} value={people} onChange={e => setPeople(e.target.value)} /></label>
                    {totalSeats !== undefined && <button type="button" className={s.btn} onClick={() => setPeople(String(totalSeats))}>Whole room ({totalSeats})</button>}
                  </div>
                  {problems.length > 0 && people !== '' && <p className={s.inlineErr} role="alert">{problems[0]}</p>}
                </section>
              )}

              {(mode === 'whole-kitchen' || mode === 'private-event') && (
                <section className={s.bkGroup} aria-label="Included">
                  <h3>{mode === 'whole-kitchen' ? 'Every station and prep table is yours' : 'The kitchen and the dining room are yours'}</h3>
                  <p className={s.muted}>Only start and end times when everything is free are offered on the left.</p>
                  {mode === 'private-event' && <p className={s.muted}>Event packages: 4 hours, 6 hours, 8 hours or 12 hours of access, each with a $500 refundable deposit. Hours beyond your package are added at the member rate. Flavors confirms the price with your request.</p>}
                  {problems.length > 0 && timed && <p className={s.inlineErr} role="alert">{problems[0]}</p>}
                </section>
              )}
            </div>
          </div>
        )}
        <div className={s.bfLayout}>
          <div className={s.bfMain}>
            {step === 'review' && startUtc && endUtc && (
              <>
                <h1 className={s.bfTitle}>Review and send</h1>
                <div className={s.bfTicket}>
                  <dl className={s.facts}>
                    <div><dt>What</dt><dd>{SUMMARY[mode]}</dd></div>
                    <div><dt>When</dt><dd>{formatWhen(startUtc, endUtc, tz)} · {lengthLabel(lengthMin)}</dd></div>
                    <div><dt>Includes</dt><dd>{equipmentText}</dd></div>
                  </dl>
                  {lines && <ul className={s.windows}><li>{lines.early}</li><li>{lines.booked}</li><li>{lines.cleaning}</li></ul>}
                  {hoursLine && <p className={s.hoursLine}>{hoursLine}</p>}
                  <p className={s.muted}>Nothing to pay now. Flavors confirms every request, and the answer appears in My bookings.</p>
                  {(errors.length > 0 || problems.length > 0) && <ul className={s.problems} role="alert">{(errors.length > 0 ? errors : problems).map((p, i) => <li key={i}>{p}</li>)}</ul>}
                </div>
              </>
            )}
          </div>

          <aside className={s.bfSummary} aria-label="Your booking">
            <h2>Your booking</h2>
            <dl>
              <div><dt>What</dt><dd>{SUMMARY[mode]}</dd></div>
              <div><dt>When</dt><dd>{startUtc && endUtc ? formatWhen(startUtc, endUtc, tz) : 'Choose a start and end time'}</dd></div>
              {startUtc && <div><dt>Length</dt><dd>{lengthLabel(lengthMin)}</dd></div>}
              {startUtc && needsPick && <div><dt>Includes</dt><dd>{equipmentText}</dd></div>}
            </dl>
            {hoursLine && <p className={s.hoursLine}>{hoursLine}</p>}
            <p className={s.bfFine}>Nothing to pay now. Flavors confirms every request.</p>
            <div className={s.bfSummaryAct}>{action}</div>
            {step === 'review' && <button type="button" className={s.linkBtn} onClick={() => setStep('choose')}>Change details</button>}
          </aside>
        </div>
        {step === 'choose' && me.data && me.data.requests.length > 0 && (
          <section className={s.bfRecent} aria-label="Recent bookings">
            <h2>Recent bookings</h2>
            <ul>
              {me.data.requests.slice().sort((a, b) => Date.parse(b.startUtc) - Date.parse(a.startUtc)).slice(0, 3).map(r => (
                <li key={r.requestId}>
                  <span><strong>{r.space === 'Whole facility' ? 'Private event' : r.space}</strong><em>{formatWhen(r.startUtc, r.endUtc, tz)}</em></span>
                  <b className={s.bfRecentSt} data-status={r.status || 'Pending'}>{r.cancelRequested && r.status !== 'Cancelled' ? 'Cancel requested' : r.status || 'Sent'}</b>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className={s.bfBar}>
        <div className={s.container}>
          {step === 'review' ? <button type="button" className={s.btn} onClick={() => setStep('choose')}>Back</button> : <span />}
          <span className={s.bfBarText}>{startUtc && endUtc ? `${SUMMARY[mode]} · ${formatWhen(startUtc, endUtc, tz)}` : 'Pick your hours'}</span>
          {action}
        </div>
      </div>
    </section>
  );
}
