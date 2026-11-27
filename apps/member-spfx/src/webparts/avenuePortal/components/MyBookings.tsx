import { toast } from './feedback';
import * as React from 'react';
import s from './Site.module.scss';
import rf from './Ref.module.scss';
import { canSelfCancel, extensionWaiting, hoursThisMonth, validateExtension } from '../../../avenue/booking';
import { addDays, localDay, localTime, zonedToUtc } from '../../../avenue/calendar';
import type { IFacility, IMyRequest, IResource } from '../../../avenue/contracts';
import { sentOutcome } from '../../../avenue/bookingFlow';
import { detailLines, hoursNote, timeLines } from '../../../avenue/copy';
import { equipmentChips } from '../../../avenue/ui-helpers';
import { type AvenueReadSource, newSubmissionId } from '../../../avenue/readSource';
import { dateParts, facilityDayLabel, relativeDay } from '../../../avenue/home';
import { tabOn } from '../../../avenue/release';
import ds from './DateSelect.module.scss';
import { DateArc } from './DateArc';
import { DateWeek } from './DateWeek';
import { useSize } from './motion';
import { eligibleBookings } from '../../../avenue/checklist';
import { agendaGroups, buildIcs, icsFileName, monthStrip, phaseView } from '../../../avenue/ui-view';
import { EquipmentArt } from './EquipmentArt';
import { BookingProgress, RefIcon, SiteEyebrow } from './RefUi';
import { Sheet } from './Sheet';
import { formatWhen, useLoad } from './ui';

export interface IMyBookingsProps {
  source: AvenueReadSource;
  facility: IFacility;
  /** Equipment catalogue, to show names and artwork instead of ids. */
  resources?: IResource[];
  onBook: () => void;
  /** Opens Check in; with a booking id it pre-picks that booking. */
  onCheckIn?: (bookingId?: string) => void;
  /** From ?booking=<id>&action=extend: open this booking's drawer (and its Extend dialog). */
  deepLink?: { bookingId: string; action?: string };
}

// A kitchen ticket carries a rubber stamp; the stamp is the status.
const STAMP: Record<string, string> = { Approved: s.mbOk, Pending: s.mbWait, Declined: s.mbBad, Cancelled: s.mbOff, 'No-show credited': s.mbOff };
const stampText = (r: IMyRequest): string => (!r.status || r.status === 'Pending' ? 'Waiting' : r.status === 'No-show credited' ? 'Credited' : r.status);
const lengthOf = (r: IMyRequest): string => { const m: number = Math.round((Date.parse(r.endUtc) - Date.parse(r.startUtc)) / 60000); const h: number = Math.floor(m / 60); return `${h > 0 ? `${h} h` : ''}${m % 60 ? ` ${m % 60} min` : ''}`.trim(); };
const statusText = (r: IMyRequest): string => (r.status === 'Pending' || !r.status ? 'Waiting for approval' : r.status);

interface IEqItem { key: string; title: string; sub?: string; unit?: IResource; hint: string }
const EQ_LIMIT = 5;
// One card per unit (name left, photo right). Beyond five, the rest sit behind a Show all / Show fewer button.
function EquipmentRows(props: { items: IEqItem[] }): React.ReactElement {
  const [open, setOpen] = React.useState<boolean>(false);
  const id: string = React.useId();
  const more: boolean = props.items.length > EQ_LIMIT;
  const shown: IEqItem[] = more && !open ? props.items.slice(0, EQ_LIMIT) : props.items;
  return (
    <>
      <ul id={id} className={s.mbdEq} data-testid="equipment-rows">
        {shown.map((i, n) => (
          <li key={i.key} className={n >= EQ_LIMIT ? s.mbdEqNew : undefined}>
            <span className={s.mbdEqText}><b>{i.title}</b>{i.sub && <em>{i.sub}</em>}</span>
            <EquipmentArt unit={i.unit} hint={i.hint} size="md" />
          </li>
        ))}
      </ul>
      {more && (
        <button type="button" className={s.mbdToggle} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
          {open ? 'Show fewer' : `Show all ${props.items.length} items`}<RefIcon name="chevron-down" size={16} />
        </button>
      )}
    </>
  );
}

// The member's own requests (they can read only their own). Status is what the flows echo back; display only. Cancelling 24 hours
// or more ahead cancels and returns hours; under 24 hours it messages management (BKG-09).
export default function MyBookings(props: IMyBookingsProps): React.ReactElement {
  const { source, facility, onBook } = props;
  const resources: IResource[] = props.resources || [];
  const tz: string = facility.timeZone;
  const [view, setViewRaw] = React.useState<'upcoming' | 'past'>('upcoming');
  // Which way the panes slide: towards Past = forward, back to Upcoming = back.
  const [pdir, setPdir] = React.useState<'fwd' | 'back'>('fwd');
  const setView = (v: 'upcoming' | 'past'): void => { setPdir(v === 'past' ? 'fwd' : 'back'); setViewRaw(v); };
  const [openId, setOpenId] = React.useState<string | undefined>();
  const requests = useLoad<IMyRequest[]>(() => source.listMyRequests(), [source]);
  // Poll only while something is waiting for an answer; settled bookings do not change by themselves.
  const waiting: React.MutableRefObject<boolean> = React.useRef<boolean>(true);
  waiting.current = !requests.data || requests.data.some(r => !r.status || r.status === 'Pending');
  React.useEffect(() => {
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible' && waiting.current) { requests.reload(); } }, 15000);
    return () => window.clearInterval(timer);
  }, [source]);
  const [confirm, setConfirm] = React.useState<IMyRequest | undefined>();
  const [cancelMsg, setCancelMsg] = React.useState<string>('');
  const [busy, setBusy] = React.useState<boolean>(false);
  const inFlight: React.MutableRefObject<boolean> = React.useRef<boolean>(false);
  const release = (): void => { inFlight.current = false; setBusy(false); };
  const [error, setError] = React.useState<string | undefined>();
  const [done, setDone] = React.useState<string | undefined>();
  const [extend, setExtend] = React.useState<IMyRequest | undefined>();
  const [newEnd, setNewEnd] = React.useState<string>('');
  const [extendError, setExtendError] = React.useState<string | undefined>();
  const [focusDay, setFocusDay] = React.useState<string | undefined>();
  const size = useSize();

  const now: number = Date.now();
  const all: IMyRequest[] = requests.data || [];
  const groups = agendaGroups(all, tz, now, view);
  const todayYmd: string = localDay(new Date(now), tz);
  const strip = monthStrip(all, todayYmd, tz, 31, view);
  // The day the strip opens on: the first upcoming booked day ("Next"), or in Past the most recent booked one.
  const booked = strip.filter(d => d.booked);
  const anchorYmd: string | undefined = view === 'past' ? (booked[booked.length - 1] || { ymd: undefined }).ymd : (booked[0] || { ymd: undefined }).ymd;
  // "3:30p": fits the 58 px day card.
  const shortTime = (iso: string): string => new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(new Date(iso)).replace(':00 ', ' ');
  const STRIP_TONE: Record<string, string> = { Approved: ds.ok, Pending: ds.wait, Mixed: ds.mixed };
  const byDay: Map<string, (typeof strip)[number]> = new Map(strip.map(d => [d.ymd, d] as [string, (typeof strip)[number]]));
  const stripValue: string = focusDay && byDay.has(focusDay) ? focusDay : anchorYmd || todayYmd;
  // Choosing a day (wheel, week bar, month grid, Today) marks it and brings its bookings into view.
  const pickStripDay = (ymd: string): void => { setFocusDay(ymd); const el: HTMLElement | null = document.getElementById(`day-${ymd}`); if (el && el.scrollIntoView) { el.scrollIntoView({ block: 'start', behavior: 'smooth' }); } };
  const open: IMyRequest | undefined = all.filter(r => r.requestId === openId)[0];

  const cancellable = (r: IMyRequest): boolean => !r.cancelSent && !r.cancelRequested && (r.status === 'Approved' || r.status === 'Pending' || !r.status) && Date.parse(r.startUtc) > now;
  const hhmm = (iso: string): string => new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
  const extendable = (r: IMyRequest): boolean => r.status === 'Approved' && Date.parse(r.endUtc) > now && !extensionWaiting(r.extension);
  const openExtend = (r: IMyRequest): void => { setDone(undefined); setExtendError(undefined); setNewEnd(hhmm(new Date(Date.parse(r.endUtc) + 3600000).toISOString())); setExtend(r); };

  // Deep link (the reminder e-mail): open the booking, and its Extend dialog when asked. Once.
  const linked: React.MutableRefObject<boolean> = React.useRef<boolean>(false);
  React.useEffect(() => {
    const link = props.deepLink;
    if (!link || linked.current || !requests.data) { return; }
    const r: IMyRequest | undefined = requests.data.filter(x => x.requestId === link.bookingId)[0];
    linked.current = true;
    if (!r) { return; }
    setView(Date.parse(r.endUtc) > Date.now() ? 'upcoming' : 'past');
    setOpenId(r.requestId);
    if (link.action === 'extend' && extendable(r)) { openExtend(r); }
  }, [requests.data, props.deepLink]);

  const sendCancel = (): void => {
    if (!confirm || inFlight.current) { return; }
    const self: boolean = canSelfCancel(confirm.startUtc, Date.now());
    inFlight.current = true;
    setBusy(true);
    setError(undefined);
    source.submitCancel(confirm.requestId, newSubmissionId('cancel'), self ? undefined : cancelMsg)
      .then(() => {
        toast(self ? 'Cancellation sent' : 'Message sent to Flavors');
        setDone(self ? 'Cancellation sent. Your hours are returned once it is processed.' : 'Request sent. Flavors staff will review it and reply here.');
        setConfirm(undefined); setOpenId(undefined); requests.reload();
      })
      .catch((e: Error) => { setError(e.message); toast('Could not send', 'bad'); })
      .then(release, release);
  };
  const sendExtend = (): void => {
    if (!extend) { return; }
    let endUtc: string;
    try {
      endUtc = zonedToUtc(localDay(extend.endUtc, tz), newEnd, tz);
      // A new end at or before the old one on the same day means after midnight (11:30 PM + 1 h = 12:30 AM next day).
      // Only within 12 hours, so an earlier time typed by mistake still shows the "after the current end" error.
      if (Date.parse(endUtc) <= Date.parse(extend.endUtc)) {
        const next: string = zonedToUtc(addDays(localDay(extend.endUtc, tz), 1), newEnd, tz);
        if (Date.parse(next) - Date.parse(extend.endUtc) <= 12 * 3600000) { endUtc = next; }
      }
    } catch { setExtendError('Choose a valid end time.'); return; }
    const problems: string[] = validateExtension(extend, endUtc, Date.now());
    if (problems.length > 0) { setExtendError(problems.join(' ')); return; }
    if (inFlight.current) { return; }
    inFlight.current = true;
    setBusy(true);
    source.submitExtension(extend, endUtc, newSubmissionId('ext'), Date.now())
      .then(() => { toast('Extension request sent'); setDone('Request for more time sent. Flavors will reply here.'); setExtend(undefined); requests.reload(); })
      .catch((e: Error) => { setExtendError(e.message); toast('Could not send', 'bad'); })
      .then(release, release);
  };

  const names = (r: IMyRequest): string[] => (r.equipmentIds || []).map(id => (resources.filter(x => x.resourceId === id)[0] || { title: id }).title);
  const addToCalendar = (r: IMyRequest): void => {
    const lines = timeLines(r, facility);
    const ics: string = buildIcs({
      id: r.requestId, startUtc: r.startUtc, endUtc: r.endUtc,
      summary: `Flavors kitchen: ${equipmentChips(r.space, r.equipmentIds, resources).join(', ')}`,
      description: `${lines.early} ${lines.booked} ${lines.cleaning}`, location: facility.title
    });
    const a: HTMLAnchorElement = document.createElement('a');
    a.href = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
    a.download = icsFileName(r.startUtc);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const artOf = (id: string): IResource | undefined => resources.filter(x => x.resourceId === id)[0];

  const drawer = (r: IMyRequest): React.ReactElement => {
    const phase = phaseView({ startUtc: r.startUtc, endUtc: r.endUtc, status: r.status }, facility, Date.now());
    const total: number = Date.parse(r.endUtc) - Date.parse(r.startUtc);
    const early: number = (facility.earlyEntryMinutes || 0) * 60000;
    const clean: number = (facility.cleanupMinutes || 0) * 60000;
    const span: number = early + total + clean;
    const at = (ms: number): string => localTime(new Date(ms).toISOString(), tz);
    const dayLabel: string = facilityDayLabel(localDay(r.startUtc, tz), localDay(new Date(), tz));
    const dayHead: string = ['Today', 'Tomorrow'].indexOf(dayLabel) >= 0 ? `${dayLabel}, ${new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(r.startUtc))}` : dayLabel;
    const items: IEqItem[] = r.space === 'Kitchen' && names(r).length > 0
      ? (r.equipmentIds || []).map(id => { const u = artOf(id); return { key: id, title: (u || { title: id }).title, sub: u && u.category, unit: u, hint: id }; })
      : equipmentChips(r.space, r.equipmentIds, resources).map(c => ({ key: c, title: c, hint: c }));
    return (
      <Sheet title="Booking details" onClose={() => setOpenId(undefined)}
        footer={(
          <div className={s.mbdActs}>
            {extendable(r) && <button type="button" className={`${s.mbdAct} ${s.mbdPrimary}`} onClick={() => openExtend(r)}>Extend</button>}
            {props.onCheckIn && tabOn('checkin') && eligibleBookings([r], Date.now()).length > 0 && <button type="button" className={`${s.mbdAct} ${extendable(r) ? '' : s.mbdPrimary}`} onClick={() => { setOpenId(undefined); props.onCheckIn!(r.requestId); }}><RefIcon name="clipboard-check" size={17} />Check in</button>}
            <button type="button" className={s.mbdAct} aria-label="Add to calendar" onClick={() => addToCalendar(r)}><RefIcon name="calendar-plus" size={17} />Calendar</button>
            {cancellable(r) && <button type="button" className={s.mbdAct} onClick={() => { setDone(undefined); setCancelMsg(''); setConfirm(r); }} aria-label={canSelfCancel(r.startUtc, Date.now()) ? 'Cancel booking' : 'Ask to cancel'}><RefIcon name="x-circle" size={17} />{canSelfCancel(r.startUtc, Date.now()) ? 'Cancel' : 'Ask to cancel'}</button>}
          </div>
        )}>
        <div className={s.mbd}>
          <div className={s.mbdHead}>
            <span className={`${s.mbStamp} ${STAMP[r.status || 'Pending']}`}>{stampText(r)}</span>
            <h3>{dayHead}</h3>
            <p className={s.mbdTime}>{localTime(r.startUtc, tz)} - {localTime(r.endUtc, tz)}<em>{lengthOf(r)}</em></p>
            {r.status === 'Approved' && phase.tone !== 'done' && <p className={s.drawerPhase}>{phase.headline}</p>}
          </div>
          {span > 0 && (
            <div className={s.mbdCard} aria-label="Entry, booked and cleaning times" role="group">
              <div className={s.mbdTrack} aria-hidden="true">
                {early > 0 && <span className={s.mbdEarly} style={{ flexGrow: early }} />}<span className={s.mbdBooked} style={{ flexGrow: total }} />{clean > 0 && <span className={s.mbdClean} style={{ flexGrow: clean }} />}
              </div>
              <dl className={s.mbdStops}>
                {early > 0 && <div><dt><i className={s.mbdEarly} />Entry</dt><dd>{at(Date.parse(r.startUtc) - early)}</dd></div>}
                <div><dt><i className={s.mbdBooked} />Start</dt><dd>{localTime(r.startUtc, tz)}</dd></div>
                <div><dt><i className={s.mbdBooked} />End</dt><dd>{localTime(r.endUtc, tz)}</dd></div>
                {clean > 0 && <div><dt><i className={s.mbdClean} />Clean-up until</dt><dd>{at(Date.parse(r.endUtc) + clean)}</dd></div>}
              </dl>
              <p className={s.mbdFoot}>{hoursNote(facility)}</p>
            </div>
          )}
          <section>
            <h4 className={s.mbdLabel}>{r.space === 'Kitchen' ? 'Equipment' : 'Space'}</h4>
            <EquipmentRows key={r.requestId} items={items} />
          </section>
          <section>
            <h4 className={s.mbdLabel}>Message from Flavors</h4>
            <div className={s.mbdMsg}>
              <span className={s.mbdAvatar} aria-hidden="true"><RefIcon name="message-square" size={16} /></span>
              <p>{r.note || sentOutcome(r).detail || 'No message yet.'}</p>
            </div>
            {r.cancelRequested && r.status !== 'Cancelled' && <p className={s.muted}>Cancellation requested. Flavors will reply here.</p>}
            {r.hoursKept && <p className={s.muted}>Cancelled by Flavors. The hours for this booking were not returned.</p>}
            {r.extension && <p className={s.muted}>Extra time to {localTime(r.extension.endUtc, tz)}: {r.extension.outcome || 'sent, waiting for Flavors'}</p>}
          </section>
          <details className={s.mbdMore}><summary>More details<RefIcon name="chevron-down" size={16} /></summary><ul>{detailLines(facility).map((l, i) => <li key={i}>{l}</li>)}</ul></details>
        </div>
      </Sheet>
    );
  };

  const upcoming: IMyRequest[] = all.filter(r => Date.parse(r.endUtc) > now && r.status !== 'Cancelled' && r.status !== 'Declined').sort((x, y) => Date.parse(x.startUtc) - Date.parse(y.startUtc));
  const liveNow: IMyRequest | undefined = upcoming.filter(r => r.status === 'Approved' && Date.parse(r.startUtc) <= now)[0];
  const nextUp: IMyRequest | undefined = upcoming.filter(r => Date.parse(r.startUtc) > now)[0] || upcoming[0];
  const waitingCount: number = upcoming.filter(r => !r.status || r.status === 'Pending').length;
  const monthHours: number = Math.round(hoursThisMonth(all, tz, new Date(now)) * 10) / 10;
  const dayTitle = (ymd: string): { main: string; sub: string } => {
    const label: string = facilityDayLabel(ymd, todayYmd);
    const dt: Date = new Date(`${ymd}T12:00:00Z`);
    const f = (o: Intl.DateTimeFormatOptions): string => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...o }).format(dt);
    return label === 'Today' || label === 'Tomorrow' ? { main: label, sub: f({ weekday: 'short', month: 'short', day: 'numeric' }) } : { main: f({ weekday: 'long' }), sub: f({ month: 'short', day: 'numeric' }) };
  };

  return (
    <section aria-label="My bookings" className={s.mb}>
      <div className={s.pageHead}>
        <div className={`${s.container} ${s.headRow}`}>
          <div className={rf['head-copy']}><SiteEyebrow title={props.facility.title} /><h1 className={s.pageTitle}>My bookings<span className={s.rDot} aria-hidden="true">.</span></h1>
            <dl className={s.factRow}>
              <div><dt>{liveNow ? 'Now' : 'Next'}</dt><dd>{liveNow ? `In the kitchen until ${localTime(liveNow.endUtc, tz)}` : nextUp ? `${facilityDayLabel(localDay(nextUp.startUtc, tz), todayYmd)}, ${localTime(nextUp.startUtc, tz)}` : 'Nothing booked'}</dd></div>
              <div><dt>Waiting</dt><dd>{waitingCount}</dd></div>
              <div><dt>This month</dt><dd>{monthHours} h</dd></div>
            </dl>
          </div>
          <div className={s.row}>
            <div className={s.segmented} role="group" aria-label="Show">
              <button type="button" aria-pressed={view === 'upcoming'} onClick={() => setView('upcoming')}>Upcoming</button>
              <button type="button" aria-pressed={view === 'past'} onClick={() => setView('past')}>Past</button>
            </div>
            {props.onCheckIn && tabOn('checkin') && <button type="button" className={`${s.btn} ${s.btnTonal}`} onClick={() => props.onCheckIn!()}><RefIcon name="clipboard-check" size={17} />Check in</button>}
          </div>
        </div>
      </div>
      <div className={s.container}>
        {done && <div className={s.okBar} role="status">{done}<button type="button" className={s.linkBtn} onClick={() => setDone(undefined)}>Dismiss</button></div>}
        {error && <div className={s.errorPanel} role="alert">{error}</div>}
        {requests.error && <div className={s.errorPanel} role="alert">{`Could not load your bookings. ${requests.error}`}</div>}

        <div key={view} className={s.pane} data-dir={pdir}>
        <div className={s.stripHead}>{size === 'phone' ? <b>{new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(`${stripValue}T12:00:00Z`))}</b> : <span />}<button type="button" onClick={() => pickStripDay(todayYmd)}>Today</button></div>
        {(() => {
          const stripLabel: string = view === 'past' ? 'Last 31 days, booked days marked' : 'Next 31 days, booked days marked';
          const lead: string[] = view === 'upcoming' ? Array.from({ length: 14 }, (_, i) => addDays(todayYmd, i - 14)) : [];
          const days: string[] = lead.concat(strip.map(d => d.ymd));
          const past = view === 'upcoming' ? (ymd: string): boolean => ymd < todayYmd : undefined;
          const marker = (ymd: string): string | undefined => { const d = byDay.get(ymd); return d && d.booked ? STRIP_TONE[d.status || ''] : undefined; };
          const describe = (ymd: string): string => {
            const d = byDay.get(ymd);
            const what: string = !d || !d.booked ? '' : d.status === 'Approved' ? 'approved' : d.status === 'Pending' ? 'waiting for approval' : 'approved and waiting';
            return `${d && d.booked ? `, ${d.count} ${d.count === 1 ? 'booking' : 'bookings'} ${what}${d.firstStartUtc ? ` from ${localTime(d.firstStartUtc, tz)}` : ', continues overnight'}` : ''}${view === 'upcoming' && ymd === anchorYmd ? ', next booking' : ''}`;
          };
          const cell = (ymd: string): React.ReactNode => {
            const d = byDay.get(ymd);
            const dt = new Date(`${ymd}T12:00:00Z`);
            return (
              <>
                {view === 'upcoming' && ymd === anchorYmd && <em className={ds.tag} aria-hidden="true">Next</em>}
                <span className={ds.wd}>{new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short' }).format(dt)}</span><b className={ds.num}>{dt.getUTCDate()}</b>
                {d && d.booked && <small className={ds.time} aria-hidden="true">{d.firstStartUtc ? shortTime(d.firstStartUtc) : 'cont.'}</small>}
              </>
            );
          };
          return size === 'phone'
            ? <div className={s.datePanel} data-idle><DateArc days={days} value={stripValue} onChange={pickStripDay} renderDay={cell} markers={marker} describe={describe} label={stripLabel} today={todayYmd} disabled={past} /></div>
            : <div className={ds.weekWrap}><DateWeek days={days} value={stripValue} onChange={pickStripDay} renderDay={cell} markers={marker} describe={describe} label={stripLabel} today={todayYmd} disabled={past} /></div>;
        })()}

        {!requests.data && !requests.error && <div className={s.skeleton} style={{ height: 160 }} role="status" aria-label="Loading your bookings" />}
        {requests.data && groups.length === 0 && (
          <div className={s.mbEmpty}><EquipmentArt hint="Stove" size="md" /><div><strong>{view === 'upcoming' ? 'No upcoming bookings' : 'No past bookings yet'}</strong><p>{view === 'upcoming' ? 'Pick a day and your hours.' : 'Finished bookings appear here.'}</p></div>{view === 'upcoming' && <button type="button" className={`${s.btn} ${s.btnCitrus}`} onClick={onBook}>Book kitchen time</button>}</div>
        )}
        <div className={s.mbList}>
          {groups.slice(0, view === 'past' ? 20 : 60).map(g => {
            const t = dayTitle(g.day);
            return (
              <section key={g.day} id={`day-${g.day}`} className={s.mbDay} aria-label={facilityDayLabel(g.day, todayYmd)}>
                <h2 className={s.mbDayHead}><b>{t.main}</b><span>{t.sub}</span>{view === 'upcoming' && t.main !== 'Today' && t.main !== 'Tomorrow' && <em>{relativeDay(g.requests[0].startUtc, now, tz)}</em>}</h2>
                <ul className={s.mbTickets}>
                  {g.requests.map(r => {
                    const st: number = Date.parse(r.startUtc); const en: number = Date.parse(r.endUtc);
                    const live: boolean = r.status === 'Approved' && now >= st && now < en;
                    const units: IResource[] = (r.equipmentIds || []).map(artOf).filter((u): u is IResource => !!u && u.category !== 'Prep table');
                    const chips: string[] = equipmentChips(r.space, r.equipmentIds, resources);
                    return (
                      <li key={r.requestId} data-booking={r.requestId} className={`${live ? s.mbLive : ''} ${view === 'past' || r.status === 'Cancelled' || r.status === 'Declined' ? s.mbPast : ''}`}>
                        <button type="button" className={s.mbTicket} onClick={() => setOpenId(r.requestId)} aria-label={`${dateParts(r.startUtc, r.endUtc, tz).time}, ${statusText(r)}. Open details`}>
                          <span className={s.mbTime}><b>{localTime(r.startUtc, tz)}</b><b>{localTime(r.endUtc, tz)}</b><em>{lengthOf(r)}</em></span>
                          <span className={s.mbBody}>
                            {live && <span className={s.mbNow}><i aria-hidden="true" />In the kitchen until {localTime(r.endUtc, tz)}</span>}
                            <span className={s.mbKit} aria-hidden="true">{units.slice(0, 4).map(u => <EquipmentArt key={u.resourceId} unit={u} size="xs" />)}{units.length === 0 && <EquipmentArt hint={r.space === 'Kitchen' ? 'prep' : 'dining'} size="xs" />}{units.length > 4 && <i>+{units.length - 4}</i>}</span>
                            <strong className={s.kitChips}>{chips.slice(0, 2).map(c => <i key={c}>{c}</i>)}{chips.length > 2 && <i>+{chips.length - 2}</i>}</strong>
                            {r.note && <em className={s.mbNote}>{r.note}</em>}
                          </span>
                          {(r.status === 'Cancelled' || r.status === 'Declined') && <span className={`${s.mbStamp} ${STAMP[r.status || 'Pending']}`}>{stampText(r)}</span>}
                        </button>
                        {r.status !== 'Cancelled' && r.status !== 'Declined' && <BookingProgress status={r.status} live={live} past={view === 'past'} />}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
        </div>
      </div>

      {open && drawer(open)}
      {confirm && (
        <Sheet title={canSelfCancel(confirm.startUtc, now) ? 'Cancel this booking?' : 'Ask Flavors to cancel?'} side="center" onClose={() => !busy && setConfirm(undefined)}
          footer={<div className={s.row}><button type="button" className={`${s.btn} ${s.btnInk}`} onClick={sendCancel} disabled={busy}>{busy ? 'Sending…' : 'Yes, send'}</button><button type="button" className={s.btn} onClick={() => setConfirm(undefined)} disabled={busy}>Keep booking</button></div>}>
          <p>{`${confirm.space}, ${formatWhen(confirm.startUtc, confirm.endUtc, tz)}. `}{canSelfCancel(confirm.startUtc, now) ? 'It is 24 hours or more away, so it will be cancelled and your hours returned.' : 'It is less than 24 hours away, so Flavors staff review it. They decide whether to cancel it and whether your hours are returned.'}</p>
          {!canSelfCancel(confirm.startUtc, now) && (
            <label className={s.inline}><span>Message to Flavors (optional)</span>
              <textarea value={cancelMsg} maxLength={500} rows={3} placeholder="For example: a supplier delivery fell through" onChange={e => setCancelMsg(e.target.value)} />
            </label>
          )}
        </Sheet>
      )}
      {extend && (
        <Sheet title="Extend your booking" side="center" onClose={() => !busy && setExtend(undefined)}
          footer={<div className={s.row}><button type="button" className={`${s.btn} ${s.btnCitrus}`} onClick={sendExtend} disabled={busy}>{busy ? 'Sending…' : 'Send request'}</button><button type="button" className={s.btn} onClick={() => setExtend(undefined)} disabled={busy}>Close</button></div>}>
          <p>{`${extend.space}, ${formatWhen(extend.startUtc, extend.endUtc, tz)}. Flavors approves every extension.`}</p>
          <label className={s.inline}><span>{`New end time (${tz})`}</span><input type="time" value={newEnd} onChange={e => setNewEnd(e.target.value)} required /></label>
          {extendError && <p className={s.problems} role="alert">{extendError}</p>}
        </Sheet>
      )}
    </section>
  );
}
