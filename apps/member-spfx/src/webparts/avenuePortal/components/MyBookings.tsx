import { toast } from './feedback';
import * as React from 'react';
import s from './Site.module.scss';
import { canSelfCancel, extensionWaiting, hoursThisMonth, validateExtension } from '../../../avenue/booking';
import { addDays, localDay, localTime, zonedToUtc } from '../../../avenue/calendar';
import type { IFacility, IMyRequest, IResource } from '../../../avenue/contracts';
import { sentOutcome } from '../../../avenue/bookingFlow';
import { detailLines, hoursNote, timeLines } from '../../../avenue/copy';
import { equipmentChips } from '../../../avenue/ui-helpers';
import { type AvenueReadSource, newSubmissionId } from '../../../avenue/readSource';
import { dateParts, facilityDayLabel, relativeDay } from '../../../avenue/home';
import { tabOn } from '../../../avenue/release';
import { ScrollRow } from './ScrollRow';
import { agendaGroups, buildIcs, icsFileName, monthStrip, phaseView } from '../../../avenue/ui-view';
import { EquipmentArt } from './EquipmentArt';
import { BookingProgress, RefIcon, shortSite } from './RefUi';
import { Sheet } from './Sheet';
import { formatWhen, useLoad } from './ui';

export interface IMyBookingsProps {
  source: AvenueReadSource;
  facility: IFacility;
  /** Equipment catalogue, to show names and artwork instead of ids. */
  resources?: IResource[];
  onBook: () => void;
  onCheckIn?: () => void;
  /** From ?booking=<id>&action=extend: open this booking's drawer (and its Extend dialog). */
  deepLink?: { bookingId: string; action?: string };
}

// A kitchen ticket carries a rubber stamp; the stamp is the status.
const STAMP: Record<string, string> = { Approved: s.mbOk, Pending: s.mbWait, Declined: s.mbBad, Cancelled: s.mbOff, 'No-show credited': s.mbOff };
const stampText = (r: IMyRequest): string => (!r.status || r.status === 'Pending' ? 'Waiting' : r.status === 'No-show credited' ? 'Credited' : r.status);
const lengthOf = (r: IMyRequest): string => { const m: number = Math.round((Date.parse(r.endUtc) - Date.parse(r.startUtc)) / 60000); const h: number = Math.floor(m / 60); return `${h > 0 ? `${h} h` : ''}${m % 60 ? ` ${m % 60} min` : ''}`.trim(); };
const statusText = (r: IMyRequest): string => (r.status === 'Pending' || !r.status ? 'Waiting for approval' : r.status);

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
  const anchorRef: React.MutableRefObject<HTMLButtonElement | null> = React.useRef<HTMLButtonElement | null>(null);

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
  const STRIP_TONE: Record<string, string> = { Approved: s.monthOk, Pending: s.monthWait, Mixed: s.monthMixed };
  const open: IMyRequest | undefined = all.filter(r => r.requestId === openId)[0];

  const cancellable = (r: IMyRequest): boolean => !r.cancelSent && !r.cancelRequested && (r.status === 'Approved' || r.status === 'Pending' || !r.status) && Date.parse(r.startUtc) > now;
  const hhmm = (iso: string): string => new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
  const extendable = (r: IMyRequest): boolean => r.status === 'Approved' && Date.parse(r.endUtc) > now && !extensionWaiting(r.extension);
  const openExtend = (r: IMyRequest): void => { setDone(undefined); setExtendError(undefined); setNewEnd(hhmm(new Date(Date.parse(r.endUtc) + 3600000).toISOString())); setExtend(r); };

  // Open the strip scrolled to the anchor day (once per view, after the bookings load).
  React.useEffect(() => {
    const el: HTMLButtonElement | null = anchorRef.current;
    if (el && typeof el.scrollIntoView === 'function') { el.scrollIntoView({ block: 'nearest', inline: 'center' }); }
  }, [!!requests.data, view]);

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
    const w = timeLines(r, facility);
    const phase = phaseView({ startUtc: r.startUtc, endUtc: r.endUtc, status: r.status }, facility, Date.now());
    const total: number = Date.parse(r.endUtc) - Date.parse(r.startUtc);
    const early: number = (facility.earlyEntryMinutes || 0) * 60000;
    const clean: number = (facility.cleanupMinutes || 0) * 60000;
    const span: number = early + total + clean;
    return (
      <Sheet title="Booking details" onClose={() => setOpenId(undefined)}
        footer={(
          <div className={s.row}>
            {extendable(r) && <button type="button" className={`${s.btn} ${s.btnCitrus}`} onClick={() => openExtend(r)}>Extend</button>}
            <button type="button" className={s.btn} aria-label="Add to calendar" onClick={() => addToCalendar(r)}>Calendar</button>
            {cancellable(r) && <button type="button" className={s.btn} onClick={() => { setDone(undefined); setCancelMsg(''); setConfirm(r); }} aria-label={canSelfCancel(r.startUtc, Date.now()) ? 'Cancel booking' : 'Ask to cancel'}>{canSelfCancel(r.startUtc, Date.now()) ? 'Cancel' : 'Ask to cancel'}</button>}
          </div>
        )}>
        <div className={s.mbSheetHead}>
          <span className={`${s.mbStamp} ${STAMP[r.status || 'Pending']}`}>{stampText(r)}</span>
          <h3>{facilityDayLabel(localDay(r.startUtc, tz), localDay(new Date(), tz))}{['Today', 'Tomorrow'].indexOf(facilityDayLabel(localDay(r.startUtc, tz), localDay(new Date(), tz))) >= 0 ? `, ${new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(r.startUtc))}` : ''}</h3>
          <p className={s.mbSheetTime}>{localTime(r.startUtc, tz)} - {localTime(r.endUtc, tz)}<em>{lengthOf(r)}</em></p>
          {r.status === 'Approved' && phase.tone !== 'done' && <p className={s.drawerPhase}>{phase.headline}</p>}
        </div>
        {span > 0 && (
          <div className={s.mbWin} aria-hidden="true">
            <span className={s.mbWinEarly} style={{ flexGrow: early }}>Entry</span><span className={s.mbWinBooked} style={{ flexGrow: total }}>Booked</span><span className={s.mbWinClean} style={{ flexGrow: clean }}>Clean-up</span>
          </div>
        )}
        <ul className={s.mbWindows} aria-label="Entry, booked and cleaning times">
          <li>{w.early}</li><li>{w.booked}</li><li>{w.cleaning}</li>
        </ul>
        <p className={s.muted}>{hoursNote(facility)}</p>
        <h4 className={s.mbSub}>{r.space === 'Kitchen' ? 'Equipment' : 'Space'}</h4>
        <ul className={s.mbPlates}>
          {r.space === 'Kitchen' && names(r).length > 0
            ? (r.equipmentIds || []).map(id => <li key={id}><EquipmentArt unit={artOf(id)} hint={id} size="xs" /><span>{(artOf(id) || { title: id }).title}</span></li>)
            : equipmentChips(r.space, r.equipmentIds, resources).map(c => <li key={c}><EquipmentArt hint={c} size="xs" /><span>{c}</span></li>)}
        </ul>
        <h4 className={s.mbSub}>Message from Flavors</h4>
        <blockquote className={s.mbSlip}>{r.note || sentOutcome(r).detail || 'No message yet.'}</blockquote>
        {r.cancelRequested && r.status !== 'Cancelled' && <p className={s.muted}>Cancellation requested. Flavors will reply here.</p>}
        {r.hoursKept && <p className={s.muted}>Cancelled by Flavors. The hours for this booking were not returned.</p>}
        {r.extension && <p className={s.muted}>Extra time to {localTime(r.extension.endUtc, tz)}: {r.extension.outcome || 'sent, waiting for Flavors'}</p>}
        <details className={s.more}><summary>More details</summary><ul>{detailLines(facility).map((l, i) => <li key={i}>{l}</li>)}</ul></details>
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
          <div><p className={s.pgEyebrow}>{shortSite(props.facility.title)}</p><h1 className={s.pageTitle}>My bookings<span className={s.rDot} aria-hidden="true">.</span></h1>
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
            {props.onCheckIn && tabOn('checkin') && <button type="button" className={`${s.btn} ${s.btnTonal}`} onClick={props.onCheckIn}><RefIcon name="clipboard-check" size={17} />Check in</button>}
          </div>
        </div>
      </div>
      <div className={s.container}>
        {done && <div className={s.okBar} role="status">{done}<button type="button" className={s.linkBtn} onClick={() => setDone(undefined)}>Dismiss</button></div>}
        {error && <div className={s.errorPanel} role="alert">{error}</div>}
        {requests.error && <div className={s.errorPanel} role="alert">{`Could not load your bookings. ${requests.error}`}</div>}

        <div key={view} className={s.pane} data-dir={pdir}>
        <div className={s.stripHead}><b>{new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(`${focusDay || anchorYmd || todayYmd}T12:00:00Z`))}</b><button type="button" onClick={() => { const el: HTMLElement | null = document.querySelector(`[data-ymd="${todayYmd}"]`); if (el && el.scrollIntoView) { el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); } }}>Today</button></div>
        <div className={s.datePanel} data-idle>
        <ScrollRow label="days">
        <ol className={s.monthStrip} aria-label={view === 'past' ? 'Last 31 days, booked days marked' : 'Next 31 days, booked days marked'}>
          {strip.map(d => {
            const dt = new Date(`${d.ymd}T12:00:00Z`);
            const isNext: boolean = view === 'upcoming' && d.ymd === anchorYmd;
            const what: string = d.status === 'Approved' ? 'approved' : d.status === 'Pending' ? 'waiting for approval' : 'approved and waiting';
            return (
              <li key={d.ymd}>
                <button type="button" ref={d.ymd === anchorYmd ? anchorRef : undefined} data-ymd={d.ymd} data-status={d.status}
                  className={`${s.monthDay} ${d.booked ? `${s.monthBooked} ${s.monthFill} ${STRIP_TONE[d.status || ''] || ''}` : ''} ${d.today ? s.monthToday : ''} ${focusDay === d.ymd ? s.monthFocus : ''}`} disabled={!d.booked}
                  aria-label={`${facilityDayLabel(d.ymd, todayYmd)}${d.booked ? `, ${d.count} ${d.count === 1 ? 'booking' : 'bookings'} ${what}${d.firstStartUtc ? ` from ${localTime(d.firstStartUtc, tz)}` : ', continues overnight'}` : ''}${isNext ? ', next booking' : ''}`}
                  onClick={e => { setFocusDay(d.ymd); if (e.currentTarget.scrollIntoView) { e.currentTarget.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); } const el: HTMLElement | null = document.getElementById(`day-${d.ymd}`); if (el && el.scrollIntoView) { el.scrollIntoView({ block: 'start', behavior: 'smooth' }); } }}>
                  {isNext && <em className={s.monthNext} aria-hidden="true">Next</em>}
                  <span>{new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short' }).format(dt)}</span><b>{dt.getUTCDate()}</b>
                  {d.booked && <small className={s.monthTime} aria-hidden="true">{d.firstStartUtc ? shortTime(d.firstStartUtc) : 'cont.'}</small>}
                </button>
              </li>
            );
          })}
        </ol>
        </ScrollRow>
        </div>

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
                          <span className={`${s.mbStamp} ${STAMP[r.status || 'Pending']}`}>{stampText(r)}</span>
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
