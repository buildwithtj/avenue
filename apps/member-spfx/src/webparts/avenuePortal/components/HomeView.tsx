import * as React from 'react';
import s from './Site.module.scss';
import type { ICalendarEntry, IMyDocumentSubmission, IMyFlag, IMyMembership, IMyRequest, INotice } from '../../../avenue/contracts';
import { groupByDay, localDay, localTime, queryWindow } from '../../../avenue/calendar';
import { equipmentChips } from '../../../avenue/ui-helpers';
import type { AvenueReadSource } from '../../../avenue/readSource';
import type { IInvoice } from '../../../avenue/billing';
import { balanceDueCents, formatCents } from '../../../avenue/billing';
import { hoursThisMonth } from '../../../avenue/booking';
import { actionItems, facilityDayLabel, hoursSummary, isBookingBlocked, newestPerType, pickNextBooking } from '../../../avenue/home';
import type { IActionItem, INextBooking } from '../../../avenue/home';
import { tabOn } from '../../../avenue/release';
import { categoryGroups, phaseView } from '../../../avenue/ui-view';
import { buildBusyMap, dayTimeline } from '../../../avenue/availability';
import { unitStatus } from './UnitCards';
import { heroImage } from '../assets';
import type { IPortalData, TabKey } from './AvenuePortal';
import { EquipmentArt } from './EquipmentArt';
import { ordinal, useLoad, useReadIds } from './ui';
import { useCountUp, useReducedMotion } from './motion';

export interface IHomeViewProps {
  source: AvenueReadSource;
  data: IPortalData;
  userEmail: string;
  userName?: string;
  isDemo: boolean;
  onNavigate: (tab: TabKey) => void;
  /** Open one booking in My bookings, optionally straight into Extend. */
  /** Start a booking, optionally with a booking type chosen. */
  onBook?: (mode?: 'equipment' | 'whole-kitchen' | 'dining' | 'private-event') => void;
  onOpenBooking?: (bookingId: string, action?: 'extend') => void;
  /** Notices already loaded by the shell. */
  notices?: INotice[];
}

interface IHomeData {
  requests: IMyRequest[];
  notices: INotice[];
  documents: IMyDocumentSubmission[];
  flags: IMyFlag[];
  required: string[];
  membership?: IMyMembership;
  today: ICalendarEntry[];
  invoices: IInvoice[] | 'not-connected';
}

const TONE: Record<string, string> = { live: s.tone_live, clean: s.tone_clean, leave: s.tone_leave, pending: s.tone_pending, soon: s.tone_soon, entry: s.tone_entry, done: s.tone_done };
const facilityToday = (nowMs: number, tz: string): string => localDay(new Date(nowMs), tz);

/** A clock that ticks every `ms`, so the live phase moves without a reload. */
function useNow(ms: number): number {
  const [now, setNow] = React.useState<number>(() => Date.now());
  React.useEffect(() => { const id: number = window.setInterval(() => setNow(Date.now()), ms); return () => window.clearInterval(id); }, [ms]);
  return now;
}

const mins = (ms: number): string => { const m: number = Math.max(0, Math.round(ms / 60000)); const h: number = Math.floor(m / 60); return h > 0 ? `${h}h ${m % 60}m` : `${m}m`; };

/** The member's next or current booking: a ring (time left in the kitchen, or time to start), one line of when, the kit, two actions. */
function Live(props: { next?: INextBooking; data: IPortalData; now: number; onNavigate: (t: TabKey) => void; onOpen: (id: string, action?: 'extend') => void }): React.ReactElement {
  const { next, data, now } = props;
  const tz: string = data.facility.timeZone;
  if (!next) {
    return (
      <div className={`${s.lp} ${s.lpEmpty}`} aria-label="Next booking">
        <div className={s.lpText}>
          <span className={s.lpLabel}>Next booking</span>
          <h2 className={s.lpHead}>Nothing booked yet</h2>
          <p className={s.lpMeta}>Choose a day, your hours and the equipment. Flavors confirms.</p>
        </div>
        {tabOn('book') && <div className={s.lpAct}><button type="button" className={`${s.btn} ${s.btnCitrus}`} onClick={() => props.onNavigate('book')}>Book kitchen time</button></div>}
      </div>
    );
  }
  const r: IMyRequest = next.request;
  const ph = phaseView({ startUtc: r.startUtc, endUtc: r.endUtc, status: r.status }, data.facility, now);
  const st: number = Date.parse(r.startUtc);
  const en: number = Date.parse(r.endUtc);
  const inside: boolean = now >= st && now < en;
  const pct: number = inside ? (now - st) / (en - st) : now < st ? Math.max(0.04, 1 - (st - now) / (24 * 3600000)) : 1;
  const kit = data.resources.filter(u => (r.equipmentIds || []).indexOf(u.resourceId) >= 0);
  const C: number = 2 * Math.PI * 44;
  return (
    <div className={`${s.lp} ${TONE[ph.tone]}`} aria-label="Next booking" data-tone={ph.tone}>
      <div className={s.lpRing} role="img" aria-label={inside ? `${mins(en - now)} left` : `${mins(st - now)} to start`}>
        <svg viewBox="0 0 100 100"><circle className={s.lpTrack} cx="50" cy="50" r="44" /><circle className={s.lpArc} cx="50" cy="50" r="44" style={{ strokeDasharray: C, strokeDashoffset: C * (1 - pct) }} /></svg>
        <span><b>{inside ? mins(en - now) : now < st ? mins(st - now) : 'Done'}</b><small>{inside ? 'left' : now < st ? 'to start' : ''}</small></span>
      </div>
      <div className={s.lpText}>
        <span className={s.lpLabel}><i aria-hidden="true" />{ph.headline.toLowerCase().indexOf(ph.label.toLowerCase()) === 0 ? (inside ? 'Now' : 'Next') : ph.label}</span>
        <h2 className={s.lpHead} data-testid="live-headline">{ph.headline}</h2>
        <p className={s.lpMeta}>{facilityDayLabel(localDay(r.startUtc, tz), facilityToday(now, tz))}, {localTime(r.startUtc, tz)} – {localTime(r.endUtc, tz)}</p>
        {kit.length > 0 && <ul className={s.lpKit} aria-label="Equipment">{kit.slice(0, 5).map(u => <li key={u.resourceId} title={u.title}><EquipmentArt unit={u} size="xs" /></li>)}{kit.length > 5 && <li className={s.lpMore}>+{kit.length - 5}</li>}</ul>}
      </div>
      <div className={s.lpAct}>
        {ph.extend && <button type="button" className={`${s.btn} ${s.btnCitrus}`} onClick={() => props.onOpen(r.requestId, 'extend')}>Extend</button>}
        {next.phase === 'in-progress' && tabOn('checkin') && <button type="button" className={s.btn} onClick={() => props.onNavigate('checkin')}>Check in</button>}
        <button type="button" className={s.btn} onClick={() => props.onOpen(r.requestId)}>{next.phase === 'waiting' ? 'View request' : 'View booking'}</button>
      </div>
    </div>
  );
}

function Meter(props: { hours: ReturnType<typeof hoursSummary>; collectionDay?: number; onClick: () => void }): React.ReactElement {
  const { hours } = props;
  const reduced: boolean = useReducedMotion();
  const known: boolean = hours.allowance !== undefined;
  const shown: number = useCountUp(!known ? hours.used : hours.over > 0 ? hours.over : (hours.left || 0), reduced);
  return (
    <section aria-label="Your hours this month" data-testid="hours-block" className={s.meter}>
      <div className={s.meterTop}><h2 className={s.miniHead}>Hours this month</h2><b>{shown} h <span>{!known ? 'booked' : hours.over > 0 ? 'over plan' : 'left'}</span></b></div>
      <div className={s.meterBar} role="img" aria-label={known ? `${hours.used} of ${hours.allowance} hours used` : 'Plan hours not set up yet'}>
        <span className={hours.over > 0 ? s.meterOver : ''} style={{ transform: `scaleX(${known ? hours.fraction : 0})` }} />
      </div>
      <button type="button" className={s.linkBtn} onClick={props.onClick}>
        {known ? (hours.over > 0 ? `${hours.used} h used of ${hours.allowance} h · ${hours.over} h over plan` : `${hours.used} of ${hours.allowance} h used`) : 'Your plan hours appear once Flavors sets up plans.'}{props.collectionDay !== undefined ? ` · collected on the ${ordinal(props.collectionDay)}` : ''}
      </button>
    </section>
  );
}


export default function HomeView(props: IHomeViewProps): React.ReactElement {
  const { source, data, userEmail, isDemo, onNavigate } = props;
  const tz: string = data.facility.timeZone;
  const now: number = useNow(30000);
  const open = (id: string, action?: 'extend'): void => { if (props.onOpenBooking) { props.onOpenBooking(id, action); } else { onNavigate('bookings'); } };
  const [readIds, markRead] = useReadIds();
  const home = useLoad<IHomeData>(async () => {
    const todayYmd: string = localDay(new Date(), tz);
    const [requests, notices, documents, flags, required, membership, invoices, today] = await Promise.all([
      source.listMyRequests(), props.notices ? Promise.resolve(props.notices) : source.listNotices(), source.listMyDocuments(), source.listMyFlags().catch((): IMyFlag[] => []), source.listRequiredDocTypes().catch((): string[] => []),
      source.getMyMembership(userEmail).catch(() => undefined),
      tabOn('billing') ? source.listMyInvoices(userEmail).catch((): 'not-connected' => 'not-connected') : Promise.resolve<'not-connected'>('not-connected'),
      tabOn('calendar')
        ? source.listCalendar(queryWindow(todayYmd, 1).fromUtc, queryWindow(todayYmd, 1).toUtc).then(e => groupByDay(e, tz, todayYmd, 1)[0].entries).catch((): ICalendarEntry[] => [])
        : Promise.resolve<ICalendarEntry[]>([])
    ]);
    return { requests, notices, documents, flags, required, membership, invoices, today };
  }, [source, userEmail, isDemo, props.notices]);

  if (home.error) {
    return <div className={s.container}><div className={s.errorPanel} role="alert"><strong>We could not load your overview.</strong><span>{home.error}</span><button type="button" className={s.btn} onClick={home.reload}>Try again</button></div></div>;
  }
  if (!home.data) {
    return <div className={s.heroBand} role="status" aria-live="polite" aria-label="Loading your overview"><div className={s.container}><div className={`${s.skeleton} ${s.skeletonDark}`} style={{ height: 180 }} /></div></div>;
  }

  const d: IHomeData = home.data;
  const todayYmd: string = facilityToday(now, tz);
  const items: IActionItem[] = actionItems(d.documents, d.requests, todayYmd, d.flags, d.required);
  const blocked: boolean = isBookingBlocked(items);
  const blockingDoc: string | undefined = blocked ? Array.from(newestPerType(d.documents).values()).find(x => x.expiryDate < todayYmd)?.docType : undefined;
  const next: INextBooking | undefined = pickNextBooking(d.requests, now);
  const hours = hoursSummary(hoursThisMonth(d.requests, tz, new Date(now)), d.membership?.monthlyHours);
  const owed: string = d.invoices === 'not-connected' ? 'Not available' : formatCents(balanceDueCents(d.invoices));
  const notice: INotice | undefined = d.notices.filter(n => readIds.indexOf(n.id) < 0)[0];
  const weekEnd: number = now + 7 * 86400000;
  const agenda: IMyRequest[] = d.requests.filter(r => r.status !== 'Cancelled' && r.status !== 'Declined' && Date.parse(r.endUtc) > now && Date.parse(r.startUtc) < weekEnd);
  const homeTl = dayTimeline(data.resources, buildBusyMap(d.today), todayYmd, tz);
  const first: string = (props.userName || '').split(' ')[0];

  const fac = data.facility;
  const early: number = fac.earlyEntryMinutes === undefined ? 30 : fac.earlyEntryMinutes;
  const goBook = (m?: 'equipment' | 'whole-kitchen' | 'dining' | 'private-event'): void => { if (props.onBook) { props.onBook(m); } else { onNavigate('book'); } };
  const clean: number = fac.cleanupMinutes === undefined ? 30 : fac.cleanupMinutes;
  const alertMin: number = fac.checkoutAlertMinutes === undefined ? 30 : fac.checkoutAlertMinutes;
  const prepMin: number = fac.minPrepTables === undefined ? 2 : fac.minPrepTables;
  const EX_MIN: number = 240;
  const exTotal: number = early + EX_MIN + clean;
  const hm = (m: number): string => { const tot: number = m + 510; const h: number = Math.floor(tot / 60); const mm: number = tot % 60; return `${h > 12 ? h - 12 : h}:${mm < 10 ? '0' : ''}${mm} ${h >= 12 ? 'PM' : 'AM'}`; };
  const groupsFree = categoryGroups(data.resources, true).map(g => ({ g, free: g.units.filter(u => unitStatus((homeTl.rows.filter(r => r.unitId === u.resourceId)[0] || { segments: [] }).segments, homeTl, tz, now).free).length }));

  const hr: number = Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(new Date(now))) % 24;
  const greet: string = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const isFree = (unitId: string): boolean => unitStatus((homeTl.rows.filter(r => r.unitId === unitId)[0] || { segments: [] }).segments, homeTl, tz, now).free;

  return (
    <div className={s.h4}>
      <section className={s.hx} aria-label="Welcome">
        <div className={s.hxText}>
          <div className={s.hxInner}>
            <p className={s.hxKicker}>{greet}{first ? `, ${first}` : ''}.</p>
            <h1 className={s.hxTitle}>Your kitchen, booked by the piece.</h1>
            <p className={s.hxLede}>Pick the equipment and the hours. Flavors confirms, and it is yours. Open around the clock.</p>
            {tabOn('book') && !next && blocked && (
              <div className={s.blockedNote}><p>You need a current document on file before you can book.</p>{tabOn('documents') && <button type="button" className={s.btn} onClick={() => onNavigate('documents')}>Renew your {blockingDoc || 'document'}</button>}</div>
            )}
            {tabOn('bookings') && <Live next={next} data={data} now={now} onNavigate={onNavigate} onOpen={open} />}
          </div>
        </div>
        <div className={s.hxMedia} aria-hidden="true"><div className={s.hxPhoto} style={{ backgroundImage: `url(${heroImage})` }} /></div>
      </section>

      {tabOn('calendar') && (
        <section className={s.kb} aria-label="Kitchen right now">
          <div className={s.container}>
            <div className={s.kbHead}>
              <div><span className={s.kbLive}><i aria-hidden="true" />Live</span><h2>Kitchen right now</h2></div>
              <button type="button" className={s.linkBtn} onClick={() => onNavigate('calendar')}>Open schedule</button>
            </div>
            <ul className={s.kbList}>
              {groupsFree.map(({ g, free }) => (
                <li key={g.category} className={free > 0 ? s.kbFree : s.kbBusy}>
                  <button type="button" onClick={() => goBook('equipment')} aria-label={`${g.title}: ${free} of ${g.units.length} free now. Book`}>
                    <EquipmentArt hint={g.category} size="md" />
                    <strong>{g.title}</strong>
                    <b className={s.kbCount}>{free}<small>/{g.units.length} free</small></b>
                    <span className={s.kbBars} aria-hidden="true">{g.units.map(u => <i key={u.resourceId} className={isFree(u.resourceId) ? s.kbOn : ''} />)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {notice && tabOn('notices') && (
        <section className={`${s.ribbon} ${notice.category === 'Urgent' ? s.ribbonUrgent : ''}`} aria-label={notice.pinned ? 'Pinned notice' : 'Latest notice'}>
          <div className={s.container}>
            <span className={s.ribbonTag}>{notice.pinned ? 'Pinned notice' : 'Latest notice'} · {notice.category}</span>
            <strong>{notice.title}</strong>
            <button type="button" className={s.linkBtn} onClick={() => { markRead([notice.id]); onNavigate('notices'); }}>Read</button>
            <button type="button" className={s.dismissX} aria-label="Dismiss this notice" onClick={() => markRead([notice.id])}>✕</button>
          </div>
        </section>
      )}

      {items.filter(i => tabOn(i.target)).length > 0 && (
        <section aria-label="Needs your attention" className={s.attn4}>
          <div className={s.container}>
            {items.filter(i => tabOn(i.target)).map(i => (
              <div key={i.key} className={i.kind === 'document-expired' ? s.attnUrgent : ''} title={`${i.consequence} ${i.howTo}`}>
                <i aria-hidden="true">!</i><strong>{i.title}</strong>
                <button type="button" className={s.linkBtn} onClick={() => onNavigate(i.target)}>{i.target === 'documents' ? 'Upload renewal' : 'View'}</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {tabOn('bookings') && (
        <section aria-label="Your week" className={s.wk}>
          <div className={`${s.container} ${s.wkGrid}`}>
            <div>
              <div className={s.wkHead}><h2>Coming up</h2><button type="button" className={s.linkBtn} onClick={() => onNavigate('bookings')}>All bookings</button></div>
              {agenda.length === 0 ? (
                <div className={s.wkEmpty}><EquipmentArt hint="Stove" size="md" /><div><strong>Nothing booked in the next 7 days</strong><p>Choose a day and your hours to reserve equipment.</p></div>{tabOn('book') && <button type="button" className={`${s.btn} ${s.btnCitrus}`} onClick={() => goBook()}>Book now</button>}</div>
              ) : (
                <ol className={s.wkRail}>
                  {agenda.slice(0, 4).map(r => (
                    <li key={r.requestId}>
                      <button type="button" onClick={() => open(r.requestId)}>
                        <time><b>{facilityDayLabel(localDay(r.startUtc, tz), todayYmd)}</b><span>{localTime(r.startUtc, tz)}</span></time>
                        <span className={s.wkBody}><strong>{localTime(r.startUtc, tz)} – {localTime(r.endUtc, tz)}</strong><em>{((ch: string[]) => `${ch.slice(0, 3).join(', ')}${ch.length > 3 ? ` +${ch.length - 3}` : ''}`)(equipmentChips(r.space, r.equipmentIds, data.resources))}</em></span>
                        <i className={r.status === 'Approved' ? s.pillOk : s.pillWait}>{r.status === 'Approved' ? 'Approved' : 'Waiting'}</i>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </div>
            <aside className={s.wkSide}>
              {d.membership && <Meter hours={hours} collectionDay={tabOn('billing') ? d.membership.collectionDay : undefined} onClick={() => onNavigate('bookings')} />}
              {tabOn('billing') && <div><div className={s.eyebrow}>Billing</div><button type="button" className={s.linkBtn} onClick={() => onNavigate('billing')}>{isDemo && d.invoices !== 'not-connected' ? 'You owe (demo figures)' : 'You owe'}: {owed}</button></div>}
              {tabOn('book') && (
                <div className={s.wkModes}>
                  <span className={s.eyebrow}>Book something bigger</span>
                  <button type="button" onClick={() => goBook('whole-kitchen')}><EquipmentArt hint="Oven" size="xs" />Whole kitchen<em>›</em></button>
                  <button type="button" onClick={() => goBook('dining')}><EquipmentArt hint="dining" size="xs" />Dining room<em>›</em></button>
                </div>
              )}
            </aside>
          </div>
        </section>
      )}

      <section aria-label="A booking from start to finish" className={`${s.band} ${s.bandInk}`}>
        <div className={s.container}>
          <div className={s.splitHead}>
            <div><div className={s.eyebrowOnDark}>One booking, start to finish</div><h2>Early entry and clean-up are on us.</h2></div>
            <p>Come {early} minutes early to set up and take {clean} minutes after to clean. Both are free. Here is a 4-hour booking starting at 9:00 AM.</p>
          </div>
          <div className={s.tl} role="img" aria-label={`Early entry ${early} minutes, booked time 4 hours, clean-up ${clean} minutes`}>
            <span className={s.tlEarly} style={{ flexBasis: `${(early / exTotal) * 100}%` }}>Early entry</span>
            <span className={s.tlBook} style={{ flexBasis: `${(EX_MIN / exTotal) * 100}%` }}>Your booking</span>
            <span className={s.tlClean} style={{ flexBasis: `${(clean / exTotal) * 100}%` }}>Clean-up</span>
          </div>
          <div className={s.tlTimes} aria-hidden="true">
            <span style={{ flexBasis: `${(early / exTotal) * 100}%` }}>{hm(0)} in</span>
            <span style={{ flexBasis: `${(EX_MIN / exTotal) * 100}%` }}>{hm(early)} starts</span>
            <span style={{ flexBasis: `${(clean / exTotal) * 100}%` }}>{hm(early + EX_MIN)} ends · {hm(exTotal)} out</span>
          </div>
        </div>
      </section>

      <section aria-label="Before you go" className={s.band}>
        <div className={s.container}>
          <div className={s.secHead}><div><div className={s.eyebrow}>Before you go</div><h2>Three things worth knowing</h2></div></div>
          <ul className={s.threeGrid}>
            <li><b>24/7</b><strong>Open around the clock</strong><span>Members have their own door code. Every request is confirmed by Flavors, and nothing is paid at booking.</span></li>
            <li><b>{prepMin}</b><strong>Prep tables every time</strong><span>Even a booking with no cooking equipment includes at least {prepMin} prep tables.</span></li>
            <li><b>{alertMin}′</b><strong>A reminder before you leave</strong><span>We tell you {alertMin} minutes before your booking ends, with a way to extend. Cancel 24 hours or more ahead to get your hours back.</span></li>
          </ul>
        </div>
      </section>

    </div>
  );
}
