import * as React from 'react';
import s from './Site.module.scss';
import type { DocType, ICalendarEntry, IMyDocumentSubmission, IMyFlag, IMyMembership, IMyRequest, INotice } from '../../../avenue/contracts';
import { groupByDay, localDay, localTime, queryWindow } from '../../../avenue/calendar';
import { equipmentChips } from '../../../avenue/ui-helpers';
import type { AvenueReadSource } from '../../../avenue/readSource';
import type { IInvoice } from '../../../avenue/billing';
import { balanceDueCents, formatCents, formatPrice } from '../../../avenue/billing';
import { hoursThisMonth } from '../../../avenue/booking';
import { actionItems, facilityDayLabel, hoursSummary, isBookingBlocked, newestPerType, pickNextBooking } from '../../../avenue/home';
import type { IActionItem, INextBooking } from '../../../avenue/home';
import { tabOn } from '../../../avenue/release';
import { durationText } from '../../../avenue/windows';
import { requiredOrSheet, requiredRows, requiredSummary, type IRequiredRow } from '../../../avenue/compliance';
import { categoryGroups, phaseView } from '../../../avenue/ui-view';
import { buildBusyMap, dayTimeline } from '../../../avenue/availability';
import { unitStatus } from './UnitCards';
import type { IPortalData, TabKey } from './AvenuePortal';
import { EquipmentArt } from './EquipmentArt';
import { ordinal, useLoad, useReadIds } from './ui';
import r from './Ref.module.scss';
import { HomeHero, QuickShortcuts, RefIcon } from './RefUi';
import { tiltProps, useSheetCover } from './mobileFx';
import { useCenterScale } from './smoothScrollX';
import { useSize } from './motion';

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

// One countdown format app-wide ("22 h 8 min"), the same as the Starts-in line.
const mins = (ms: number): string => durationText(ms);

/** The member's next or current booking: a ring (time left in the kitchen, or time to start), one line of when, the kit, two actions. */
function Live(props: { next?: INextBooking; data: IPortalData; now: number; onNavigate: (t: TabKey) => void; onOpen: (id: string, action?: 'extend') => void }): React.ReactElement {
  const { next, data, now } = props;
  const tz: string = data.facility.timeZone;
  const kitMax: number = useSize() === 'phone' ? 3 : 5; // one row of icons on a phone
  if (!next) {
    return (
      <div className={`${s.lp} ${s.lpEmpty}`} aria-label="Next booking">
        <div className={s.lpText}>
          <span className={s.lpLabel}>Next booking</span>
          <h2 className={s.lpHead}>Nothing booked yet</h2>
          <p className={s.lpMeta}>Pick a day, your hours and the equipment.</p>
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
        <span><b>{(inside ? mins(en - now) : now < st ? mins(st - now) : 'Done').split(/ (?=\d+ min)/).map((x, i) => <em key={i}>{x}</em>)}</b><small>{inside ? 'left' : now < st ? 'to start' : ''}</small></span>
      </div>
      <div className={s.lpText}>
        <span className={s.lpLabel}><i aria-hidden="true" />{ph.headline.toLowerCase().indexOf(ph.label.toLowerCase()) === 0 ? (inside ? 'Now' : 'Next') : ph.label}</span>
        <h2 className={s.lpHead} data-testid="live-headline">{ph.headline}</h2>
        <p className={s.lpMeta}>{facilityDayLabel(localDay(r.startUtc, tz), facilityToday(now, tz))}, {localTime(r.startUtc, tz)} - {localTime(r.endUtc, tz)}</p>
        {kit.length > 0 && <ul className={s.lpKit} aria-label="Equipment">{kit.slice(0, kitMax).map(u => <li key={u.resourceId} title={u.title}><EquipmentArt unit={u} size="xs" /></li>)}{kit.length > kitMax && <li className={s.lpMore}>+{kit.length - kitMax}</li>}</ul>}
      </div>
      <div className={s.lpAct}>
        {ph.extend && <button type="button" className={`${s.btn} ${s.btnCitrus}`} onClick={() => props.onOpen(r.requestId, 'extend')}>Extend</button>}
        {next.phase === 'in-progress' && tabOn('checkin') && <button type="button" className={s.btn} onClick={() => props.onNavigate('checkin')}>Check in</button>}
        <button type="button" className={s.btn} onClick={() => props.onOpen(r.requestId)}>{next.phase === 'waiting' ? 'View request' : 'View booking'}</button>
      </div>
    </div>
  );
}

const NOTICE_ICON: Record<string, string> = { Urgent: 'triangle-alert', Maintenance: 'wrench', Schedule: 'calendar-days', General: 'megaphone' };
const NOTICE_LABEL: Record<string, string> = { Urgent: 'Urgent', Maintenance: 'Maintenance', Schedule: 'Schedule change', General: 'Announcement' };
/** "5 min ago", "3 h ago", "Yesterday", "Nov 22". */
function ago(iso: string, nowMs: number, tz: string): string {
  const t: number = Date.parse(iso); if (!isFinite(t)) { return ''; }
  const m: number = Math.max(0, Math.round((nowMs - t) / 60000));
  if (m < 2) { return 'Just now'; } if (m < 60) { return `${m} min ago`; } if (m < 1440) { return `${Math.round(m / 60)} h ago`; } if (m < 2880) { return 'Yesterday'; }
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'short', day: 'numeric' }).format(new Date(t));
}

/** Notices on Home: a titled block (icon, "Notices", unread count, See all) over snap-scrolling glass cards. Each card says what it is:
 *  a category icon tile, a labelled pill (Urgent / Maintenance / Schedule change / Announcement), the title, how long ago, a chevron.
 *  A single notice becomes one slim row. Total height about 120 px. */
function NoticeRail(props: { notices: INotice[]; readIds: number[]; tz: string; onOpen: (n: INotice) => void; onAll: () => void }): React.ReactElement {
  const { notices, readIds, onOpen } = props;
  const rail = React.useRef<HTMLElement>(null);
  const [at, setAt] = React.useState<number>(0);
  const raf = React.useRef<number>(0);
  const nowMs: number = Date.now();
  const unread: number = notices.filter(n => readIds.indexOf(n.id) < 0).length;
  const onScroll = (): void => {
    if (raf.current) { return; }
    raf.current = window.requestAnimationFrame(() => {
      raf.current = 0;
      const el: HTMLElement | null = rail.current; const first: HTMLElement | null = el ? (el.firstElementChild as HTMLElement | null) : null;
      if (el && first) { setAt(Math.max(0, Math.min(notices.length - 1, Math.round(el.scrollLeft / (first.offsetWidth + 10))))); }
    });
  };
  React.useEffect(() => () => { if (raf.current) { window.cancelAnimationFrame(raf.current); } }, []);
  return (
    <div className={r['notice-wrap']} data-reveal>
      <header className={r['notice-head']}>
        <span className={r['nh-icon']} aria-hidden="true"><RefIcon name="megaphone" size={14} /></span>
        <h2>Notices</h2>
        {unread > 0 && <b className={r['nh-count']}>{unread} new</b>}
        {notices.length > 1 && <div className={r['notice-dots']} aria-hidden="true">{notices.map((n, i) => <i key={n.id} data-on={i === at ? '1' : '0'} />)}</div>}
        <button type="button" onClick={props.onAll}>See all <RefIcon name="chevron-right" size={14} /></button>
      </header>
      <section ref={rail} className={r['notice-rail']} data-count={notices.length} aria-label="Notices from Flavors" onScroll={onScroll}>
        {notices.map(n => (
          <button key={n.id} type="button" className={`${r['notice-slide']} ${n.category === 'Urgent' ? r['is-urgent'] : ''}`} data-cat={n.category} onClick={() => onOpen(n)}>
            <span className={r['ns-tile']} aria-hidden="true"><RefIcon name={NOTICE_ICON[n.category] || 'info'} size={18} />{readIds.indexOf(n.id) < 0 && <i />}</span>
            <span className={r['ns-text']}>
              <span className={r['ns-meta']}><em className={r['ns-pill']}>{NOTICE_LABEL[n.category] || n.category}</em><small>{ago(n.publishedUtc, nowMs, props.tz)}{readIds.indexOf(n.id) < 0 ? ' · New' : ''}</small></span>
              <b>{n.title}</b>
            </span>
            <RefIcon name="chevron-right" size={16} />
          </button>
        ))}
      </section>
    </div>
  );
}

/** One compact banner for everything that needs the member's attention: count, worst severity, one action, expandable list. */
function AttnBanner(props: { items: { key: string; kind: string; title: string; consequence: string; howTo: string; target: TabKey }[]; onNavigate: (t: TabKey) => void }): React.ReactElement {
  const { items, onNavigate } = props;
  const [open, setOpen] = React.useState<boolean>(false);
  const urgent: boolean = items.some(i => i.kind === 'document-expired');
  const docs: boolean = items.some(i => i.target === 'documents');
  const row = (i: { key: string; kind: string; title: string; consequence: string; howTo: string; target: TabKey }): React.ReactElement => (
    <div key={i.key} className={i.kind === 'document-expired' ? s.attnUrgent : ''} title={`${i.consequence} ${i.howTo}`}>
      <i aria-hidden="true">!</i><strong>{i.title}</strong>
      <button type="button" className={s.linkBtn} onClick={() => onNavigate(i.target)}>{i.target === 'documents' ? (i.kind === 'onboarding-docs' ? 'Upload documents' : 'Upload renewal') : 'View'}</button>
    </div>
  );
  if (items.length === 1) { return <section aria-label="Needs your attention" className={s.attn4}>{row(items[0])}</section>; }
  return (
    <section aria-label="Needs your attention" className={`${s.attn4} ${s.attnOne}`}>
      <div className={urgent ? s.attnUrgent : ''}>
        <i aria-hidden="true">!</i>
        <strong>{docs && items.every(i => i.target === 'documents') ? `${items.length} documents need attention` : `${items.length} things need your attention`}{urgent ? ' · one has expired' : ''}</strong>
        <span className={s.attnActs}>
          <button type="button" className={s.linkBtn} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Show all'}</button>
          <button type="button" className={s.linkBtn} onClick={() => onNavigate(docs ? 'documents' : items[0].target)}>{docs ? 'Review documents' : 'View'}</button>
        </span>
      </div>
      {open && <div className={s.attnList}>{items.map(row)}</div>}
    </section>
  );
}

type KpiTone = 'ok' | 'warn' | 'bad' | 'info';
/** One "Your month" card. Every card has the same five parts, so the grid reads as one set: heading and icon, the number,
 *  a status pill (green ok / amber soon / red act now / grey no data), one line of detail, and a pill button. */
function Kpi(props: { label: string; icon: string; value: string; pill: { text: string; tone: KpiTone }; detail: string; action?: { text: string; go: () => void }; testId?: string }): React.ReactElement {
  return (
    <article className={r['kpi-card']} data-testid={props.testId} data-reveal {...tiltProps()}>
      <div className={r['kpi-top']}><span>{props.label}</span><span className={r['kpi-icon']}><RefIcon name={props.icon} size={16} /></span></div>
      <div className={r['kpi-value']}>{props.value}</div>
      <span className={r['kpi-pill']} data-tone={props.pill.tone}>{props.pill.text}</span>
      <div className={r['kpi-foot']}>{props.detail}</div>
      {props.action && <button type="button" className={r['review-link']} onClick={props.action.go}>{props.action.text} <RefIcon name="arrow-up-right" size={13} /></button>}
    </article>
  );
}

export default function HomeView(props: IHomeViewProps): React.ReactElement {
  const { source, data, userEmail, isDemo, onNavigate } = props;
  const homeRef = React.useRef<HTMLDivElement>(null);
  const markRef = React.useRef<HTMLSpanElement>(null);
  const kbRef = React.useRef<HTMLUListElement>(null);
  const phoneSize: boolean = useSize() === 'phone';
  const tz: string = data.facility.timeZone;
  const now: number = useNow(30000);
  const open = (id: string, action?: 'extend'): void => { if (props.onOpenBooking) { props.onOpenBooking(id, action); } else { onNavigate('bookings'); } };
  const [readIds, markRead] = useReadIds(source);
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
    // Notices are read from props below, not a dependency: the shell's 60 s notice poll must not refetch the whole overview (A4).
  }, [source, userEmail, isDemo]);

  useSheetCover(homeRef, markRef, phoneSize, !!home.data);
  useCenterScale(kbRef, !!home.data);
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
  const recent: INotice[] = (props.notices || d.notices).slice(0, 3);
  // Same computation as the Documents page, so both screens show the same figures.
  const reqRows: IRequiredRow[] = requiredRows(requiredOrSheet(d.required as DocType[]), d.documents, todayYmd);
  const reqN = requiredSummary(reqRows);
  const docIssues: number = items.filter(i => i.target === 'documents').length;
  const weekEnd: number = now + 7 * 86400000;
  const agenda: IMyRequest[] = d.requests.filter(r => r.status !== 'Cancelled' && r.status !== 'Declined' && Date.parse(r.endUtc) > now && Date.parse(r.startUtc) < weekEnd);
  const homeTl = dayTimeline(data.resources, buildBusyMap(d.today), todayYmd, tz);
  const first: string = (props.userName || '').split(' ')[0];

  const goBook = (m?: 'equipment' | 'whole-kitchen' | 'dining' | 'private-event'): void => { if (props.onBook) { props.onBook(m); } else { onNavigate('book'); } };
  // Same set as Schedule's count: bookable cooking units (prep tables come with every booking, so they are not counted).
  const groupsFree = categoryGroups(data.resources).map(g => ({ g, free: g.units.filter(u => unitStatus((homeTl.rows.filter(r => r.unitId === u.resourceId)[0] || { segments: [] }).segments, homeTl, tz, now).free).length }));

  const hr: number = Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(new Date(now))) % 24;
  const greet: string = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const isFree = (unitId: string): boolean => unitStatus((homeTl.rows.filter(r => r.unitId === unitId)[0] || { segments: [] }).segments, homeTl, tz, now).free;

  const nextTxt: string = next ? (now < Date.parse(next.request.startUtc) ? mins(Date.parse(next.request.startUtc) - now) : mins(Math.max(0, Date.parse(next.request.endUtc) - now))) : 'None';
  const dateLine: string = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(now)).toUpperCase();

  const shortcutItems = [
        ...(tabOn('bookings') ? [{ key: 'bookings', label: 'My bookings', icon: 'calendar-days', onClick: () => onNavigate('bookings') }] : []),
        ...(tabOn('checkin') ? [{ key: 'checkin', label: 'Check in', icon: 'clipboard-check', onClick: () => onNavigate('checkin') }] : []),
        ...(tabOn('documents') ? [{ key: 'documents', label: 'Documents', icon: 'file-text', onClick: () => onNavigate('documents'), badge: docIssues }] : []),
        ...(tabOn('support') ? [{ key: 'support', label: 'Messages', icon: 'message-square', onClick: () => onNavigate('support') }] : [])
      ];
  return (
    <div className={s.h4} ref={homeRef} data-cover="0">
      <HomeHero
        facility={data.facility.title}
        eyebrow={dateLine}
        title={`${greet}${first ? `, ${first}` : ''}`}
        lede="Open 24 hours."
        pill={next ? `${now < Date.parse(next.request.startUtc) ? 'Next booking in' : 'In the kitchen,'} ${nextTxt}${now < Date.parse(next.request.startUtc) ? '' : ' left'}` : 'Open 24 hours'}
        onBook={tabOn('book') ? () => goBook() : undefined}
      >
        <QuickShortcuts onHero items={shortcutItems} />
      </HomeHero>
      <QuickShortcuts items={shortcutItems} />
      <div className={r['home-sheet']} data-idle>
      <span ref={markRef} className={r['sheet-mark']} aria-hidden="true" />
      {tabOn('notices') && recent.length > 0 && (
        <NoticeRail notices={recent} readIds={readIds} tz={tz} onAll={() => onNavigate('notices')} onOpen={n => { markRead([n.id]); onNavigate('notices'); }} />
      )}
      {tabOn('book') && !next && blocked && (
        <div className={s.blockedNote}><p>You need a current document on file before you can book.</p>{tabOn('documents') && <button type="button" className={s.btn} onClick={() => onNavigate('documents')}>Renew your {blockingDoc || 'document'}</button>}</div>
      )}

      <section aria-label="At a glance" className={r['home-sec']}>
        <header className={r['sec-head']}><span className={r['sec-ico']} aria-hidden="true"><RefIcon name="activity" size={16} /></span><h2>Your month</h2></header>
        <div className={r['kpi-grid']}>
          {/* Next booking is shown by the hero pill and the next-booking card, so it has no KPI tile here. */}
          {d.membership && (
            <Kpi testId="hours-block" label="Plan hours" icon="clock-3" value={`${hours.used} h`}
              pill={hours.allowance === undefined ? { text: 'Plan not set up', tone: 'info' } : hours.over > 0 ? { text: `${hours.over} h over`, tone: 'bad' } : (hours.left || 0) <= hours.allowance * 0.2 ? { text: `${hours.left || 0} h left`, tone: 'warn' } : { text: 'On track', tone: 'ok' }}
              detail={hours.allowance === undefined ? 'Flavors sets up your plan' : hours.over > 0 ? `Used ${hours.used} of ${hours.allowance} h this month` : `${hours.used} of ${hours.allowance} h used · ${hours.left || 0} h left`}
              action={tabOn('membership') ? { text: 'View plan', go: () => onNavigate('membership') } : undefined} />
          )}
          {tabOn('documents') && (
            <Kpi label="Documents" icon="file-text" value={`${reqN.current} of ${reqRows.length}`}
              pill={reqN.missing + reqN.expired > 0 ? { text: 'Needs attention', tone: 'bad' } : reqN.expiring > 0 ? { text: 'Expiring soon', tone: 'warn' } : { text: 'All current', tone: 'ok' }}
              detail={`Current · ${reqN.missing + reqN.expired > 0 ? `${reqN.missing + reqN.expired} still to send` : reqN.expiring > 0 ? `${reqN.expiring} expiring soon` : 'nothing missing'}`}
              action={{ text: docIssues > 0 ? 'Review' : 'View', go: () => onNavigate('documents') }} />
          )}
          {tabOn('billing') && (() => {
            const due: number = d.invoices === 'not-connected' ? 0 : balanceDueCents(d.invoices);
            return (
              <Kpi label="Balance due" icon="credit-card" value={d.invoices === 'not-connected' ? '-' : owed}
                pill={d.invoices === 'not-connected' ? { text: 'Not available', tone: 'info' } : due > 0 ? { text: 'Payment due', tone: 'warn' } : { text: 'Paid up', tone: 'ok' }}
                detail={isDemo && d.invoices !== 'not-connected' ? 'Demo figures' : d.membership && d.membership.collectionDay !== undefined ? `Collected on the ${ordinal(d.membership.collectionDay)}` : 'From your invoices'}
                action={{ text: 'View billing', go: () => onNavigate('billing') }} />
            );
          })()}
        </div>
      </section>

      {items.filter(i => tabOn(i.target)).length > 0 && (
        <AttnBanner items={items.filter(i => tabOn(i.target))} onNavigate={onNavigate} />
      )}

      <div className={r['dashboard-grid']}>
        <div className={r['right-column']} style={{ minWidth: 0 }}>
          {tabOn('bookings') && <section className={r['schedule-card']} aria-label="Next booking detail" data-reveal><Live next={next} data={data} now={now} onNavigate={onNavigate} onOpen={open} /></section>}
          {tabOn('bookings') && (
            <section className={r['schedule-card']} aria-label="Coming up" data-reveal>
              <div className={r['section-header']}><div><h2>Coming up</h2><p>Your bookings in the next 7 days</p></div><button type="button" className={r['text-button']} onClick={() => onNavigate('bookings')}>All bookings</button></div>
              {agenda.length === 0 ? (
                <div className={s.wkEmpty}><EquipmentArt hint="Stove" size="md" /><div><strong>Nothing booked in the next 7 days</strong><p>Pick a day and your hours to reserve equipment.</p></div>{tabOn('book') && <button type="button" className={`${s.btn} ${s.btnCitrus}`} onClick={() => goBook()}>Book</button>}</div>
              ) : (
                <div className={r['module-booking-list']} style={{ padding: '0 18px 18px' }}>
                  {agenda.slice(0, 4).map(rq => (
                    <article key={rq.requestId} className={r['module-row']} data-reveal>
                      <span className={`${r['tenant-avatar']} ${r.teal}`}>{localDay(rq.startUtc, tz).slice(8)}</span>
                      <div className={r['module-row-copy']}><b>{localTime(rq.startUtc, tz)} - {localTime(rq.endUtc, tz)}</b><span className={s.kitChips}>{((ch: string[]) => ch.slice(0, 2).map(c => <i key={c}>{c}</i>).concat(ch.length > 2 ? [<i key="more">+{ch.length - 2}</i>] : []))(equipmentChips(rq.space, rq.equipmentIds || [], data.resources))}</span></div>
                      <span className={r['module-row-time']}>{facilityDayLabel(localDay(rq.startUtc, tz), todayYmd)}</span>
                      <span className={`${r['module-status']} ${rq.status === 'Approved' ? '' : r['is-pending']}`}>{rq.status === 'Approved' ? 'Approved' : 'Waiting'}</span>
                      <button type="button" className={r['module-action']} onClick={() => open(rq.requestId)}>Details</button>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
        <aside className={r['right-column']}>
          {d.membership && tabOn('membership') && (
            <section className={r['occupancy-card']} aria-label="My plan" data-reveal>
              <div className={`${r['section-header']} ${r.compact}`}><div><h2>My plan</h2><p>{d.membership.monthlyHours !== undefined ? `${d.membership.monthlyHours} hours a month` : 'Hours not set up yet'}</p></div><button type="button" className={r['text-button']} onClick={() => onNavigate('membership')}>Manage</button></div>
              <div className={r['occupancy-summary']} style={{ padding: '0 18px 18px' }}><b>{d.membership.planName || 'Plan not set'}</b><span>{d.membership.extraHourRate !== undefined ? `Extra hours ${formatPrice(Math.round(d.membership.extraHourRate * 100))} each` : 'Extra-hour rate not set'}</span></div>
            </section>
          )}
          {tabOn('notices') && (
            <section className={r['tenants-card']} aria-label="Latest notices" data-reveal>
              <div className={`${r['section-header']} ${r.compact}`}><div><h2>Notices</h2><p>Latest from Flavors</p></div><button type="button" className={r['text-button']} onClick={() => onNavigate('notices')}>View all</button></div>
              <div className={r['tenant-list']}>
                {recent.length === 0 ? <p style={{ margin: 0, padding: '0 18px 18px', color: '#6b7280' }}>No notices right now.</p> : recent.map(n => (
                  <button key={n.id} type="button" className={r['tenant-row']} onClick={() => { markRead([n.id]); onNavigate('notices'); }}>
                    <span className={`${r['tenant-avatar']} ${n.category === 'Urgent' ? r.gold : r.teal}`} aria-hidden="true">{n.category.charAt(0)}</span>
                    <span className={r['tenant-details']}><b>{n.title}</b><small>{n.category}</small></span>
                    {readIds.indexOf(n.id) < 0 && <span className={r['tenant-rank']}>New</span>}
                  </button>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>

      {tabOn('calendar') && (
        <section className={`${r['module-view']}`} aria-label="Kitchen right now" style={{ marginTop: 15 }}>
          <div className={r['module-view-heading']}>
            <div><h2 id="kb-title">Kitchen right now</h2></div>
            <button type="button" className={r['text-button']} onClick={() => onNavigate('calendar')}>Open schedule</button>
          </div>
          <ul ref={kbRef} className={`${s.kbList} ${s.kbSlider}`}>
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
        </section>
      )}

      </div>
    </div>
  );
}
