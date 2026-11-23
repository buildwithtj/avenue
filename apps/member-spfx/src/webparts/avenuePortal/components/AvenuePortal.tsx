import * as React from 'react';
import { AVENUE_FONT_WOFF2, brandLogoOnDark } from '../assets';
import { MessageBar, MessageBarType } from '@fluentui/react';
import styles from './AvenuePortal.module.scss';
import s from './Site.module.scss';
import type { IDiningTable, IFacility, INotice, IResource } from '../../../avenue/contracts';
import type { AvenueReadSource } from '../../../avenue/readSource';
import CalendarView from './CalendarView';
import CheckInView from './CheckInView';
import DocumentsView from './DocumentsView';
import HomeView from './HomeView';
import { type IFeedbackPrefs, type IToast, buzz, chime, notify, readPrefs, toast, writePrefs } from './feedback';
import { DEMO_MEMBER_EMAIL } from '../../../avenue/demoData';
import MyBookings from './MyBookings';
import NoticesView from './NoticesView';
import ProfileDrawer from './ProfileDrawer';
import BookFlow from './BookFlow';
import BillingView from './BillingView';
import MembershipView from './MembershipView';
import JoinView from './JoinView';
import WelcomeView from './WelcomeView';
import InactiveView from './InactiveView';
import SupportView from './SupportView';
import EventsView from './EventsView';
import StorageView from './StorageView';
import TeamView from './TeamView';
import { localDay } from '../../../avenue/calendar';
import { MOCK_PAYMENTS } from '../../../avenue/billing';
import { tabOn } from '../../../avenue/release';
import { ErrorBoundary, useAlerts, useLoad, useReadIds } from './ui';
import { SizeContext, anim, revealSelector, useContainerLayout, useReducedMotion, useRevealFallback, type PortalSize } from './motion';
import { initials } from '../../../avenue/ui-view';
import { acquireImmersive, releaseImmersive } from '../immersive';

export interface IAvenuePortalProps {
  /** Undefined when the web part has no facility configured. */
  source: AvenueReadSource | undefined;
  isDemo: boolean;
  /** Staff page only: shows the "for member" field on Documents. The flow, not this flag, decides who may use it. */
  staffUpload?: boolean;
  userDisplayName: string;
  /** Signed-in user's e-mail; selects their own membership row. */
  userEmail: string;
  /** [PROPOSED] Hide the SharePoint header and left navigation around the portal (web part property, read mode only). Default off here; the web part passes it on. */
  immersive?: boolean;
}

export interface IPortalData {
  facility: IFacility;
  resources: IResource[];
  tables: IDiningTable[];
}

export type TabKey = 'home' | 'book' | 'calendar' | 'bookings' | 'checkin' | 'documents' | 'billing' | 'membership' | 'join' | 'notices' | 'support' | 'events' | 'storage' | 'team';

/** Primary links, in plain words. Screens whose module is not in the release are hidden by tabOn. */
const PRIMARY: { key: TabKey; label: string; icon: string }[] = [
  // Kitchen icons: chef's hat, stock pot, order ticket, prep calendar, service bell.
  { key: 'home', label: 'Home', icon: 'M7 14.5a4 4 0 1 1 1.6-7.7 4 4 0 0 1 6.8 0A4 4 0 1 1 17 14.5V18H7zM7 21h10M10 18v-3M14 18v-3' },
  { key: 'book', label: 'Book', icon: 'M3 10h18M5 10v7a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-7M2 12h3M19 12h3M9 7V5M12 7V3.5M15 7V5' },
  { key: 'bookings', label: 'My bookings', icon: 'M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4zM9 8h6M9 12h6M9 16h3' },
  { key: 'calendar', label: 'Schedule', icon: 'M4 6h16v14H4zM4 11h16M8 3v5M16 3v5M9 15h2M13 15h2' },
  { key: 'notices', label: 'Notices', icon: 'M5 17a7 7 0 0 1 14 0zM12 10V8M10.5 7h3M3 20h18' }
];

/** Secondary screens, reached from the user menu so the bar stays short. */
const MORE: { key: TabKey; label: string }[] = [{ key: 'checkin', label: 'Check in' }, { key: 'documents', label: 'Documents' }, { key: 'billing', label: 'Billing' }];

/** Which primary item a secondary screen belongs to, so the bar always shows where you are. */
const LEGACY_HEAD: Partial<Record<TabKey, { eyebrow: string; title: string; lede: string }>> = {
  checkin: { eyebrow: 'During your booking', title: 'Check in', lede: 'A short checklist when you arrive and when you leave.' },
  documents: { eyebrow: 'Your account', title: 'Documents', lede: 'Keep your permits and insurance current so you can keep booking.' },
  billing: { eyebrow: 'Your account', title: 'Billing', lede: 'Invoices and what is due.' },
  membership: { eyebrow: 'Your account', title: 'My membership', lede: 'Your plan and hours.' },
  join: { eyebrow: 'Welcome', title: 'Join', lede: 'Choose a plan to start booking.' }
};
const MOCK_JOIN_KEY: string = 'avenue.mockJoined';
const PARENT: Partial<Record<TabKey, TabKey>> = { checkin: 'bookings', membership: 'billing', join: 'home', support: 'home', events: 'book', storage: 'home', team: 'bookings' };

/** ?booking=<id>&action=extend from the reminder e-mail. */
function readDeepLink(): { bookingId: string; action?: string } | undefined {
  try {
    const q: URLSearchParams = new URLSearchParams(window.location.search);
    const id: string | null = q.get('booking');
    return id && /^[A-Za-z0-9._-]{1,80}$/.test(id) ? { bookingId: id, action: q.get('action') || undefined } : undefined;
  } catch { return undefined; }
}

function Icon(props: { d: string }): React.ReactElement {
  return <svg viewBox="0 0 24 24" className={s.navIcon} aria-hidden="true" focusable="false"><path d={props.d} /></svg>;
}

/** Toasts raised by feedback.toast(): slide up above the tab bar, slide out after 3.2 s; hover or focus pauses the timer.
 *  Errors are announced as alerts, the rest politely. */
function Toaster(): React.ReactElement {
  const [items, setItems] = React.useState<(IToast & { leaving?: boolean })[]>([]);
  const timers: React.MutableRefObject<Record<number, number>> = React.useRef<Record<number, number>>({});
  const reduced: boolean = useReducedMotion();
  const leave = React.useCallback((id: number): void => {
    setItems(xs => xs.map(x => (x.id === id ? { ...x, leaving: true } : x)));
    window.setTimeout(() => setItems(xs => xs.filter(x => x.id !== id)), reduced ? 0 : 160);
  }, [reduced]);
  const arm = (id: number, ms: number): void => { window.clearTimeout(timers.current[id]); timers.current[id] = window.setTimeout(() => leave(id), ms); };
  const pause = (id: number): void => window.clearTimeout(timers.current[id]);
  React.useEffect(() => {
    const on = (e: Event): void => {
      const t: IToast = (e as CustomEvent<IToast>).detail;
      setItems(xs => xs.concat(t).slice(-3));
      arm(t.id, 3200);
    };
    window.addEventListener('avenue-toast', on);
    return () => window.removeEventListener('avenue-toast', on);
  }, [leave]);
  const one = (t: IToast & { leaving?: boolean }): React.ReactElement => (
    <div key={t.id} className={`${s.toast} ${t.tone === 'bad' ? s.toastBad : t.tone === 'info' ? s.toastInfo : ''} ${t.leaving ? s.toastOut : ''}`}
      onMouseEnter={() => pause(t.id)} onMouseLeave={() => arm(t.id, 1500)} onFocus={() => pause(t.id)} onBlur={() => arm(t.id, 1500)} tabIndex={-1}>
      <i aria-hidden="true">{t.tone === 'bad' ? '!' : t.tone === 'info' ? 'i' : '✓'}</i>{t.text}
    </div>
  );
  return (
    <div className={s.toasts}>
      <div role="alert" aria-live="assertive" className={s.toastLane}>{items.filter(t => t.tone === 'bad').map(one)}</div>
      <div role="status" aria-live="polite" className={s.toastLane}>{items.filter(t => t.tone !== 'bad').map(one)}</div>
    </div>
  );
}

export default function AvenuePortal(props: IAvenuePortalProps): React.ReactElement {
  return <ErrorBoundary><PortalInner {...props} /></ErrorBoundary>;
}

/** Registers the bundled Inter Variable face once per page (inlined data URI; nothing is fetched from a font CDN). */
function useBrandFont(): void {
  React.useEffect(() => {
    if (document.getElementById('avenue-font')) { return; }
    const st: HTMLStyleElement = document.createElement('style');
    st.id = 'avenue-font';
    st.textContent = `@font-face{font-family:'Avenue Sans';src:url(${AVENUE_FONT_WOFF2}) format('woff2');font-weight:100 900;font-style:normal;font-display:swap;}`;
    document.head.appendChild(st);
  }, []);
}

function PortalInner(props: IAvenuePortalProps): React.ReactElement {
  useBrandFont();
  const { source, isDemo, userDisplayName, userEmail, staffUpload } = props;
  const rootRef: React.RefObject<HTMLDivElement> = React.useRef<HTMLDivElement>(null);
  const layout = useContainerLayout(rootRef);
  const mid = useContainerLayout(rootRef, 720);
  const xxl = useContainerLayout(rootRef, 1600);
  const size: PortalSize = layout === 'wide' ? 'wide' : mid === 'wide' ? 'mid' : 'phone';
  const reduced: boolean = useReducedMotion();
  // Immersive (full screen): body class + scoped style while on. The user menu turns it on or off for this page view.
  const [full, setFull] = React.useState<boolean>(!!props.immersive);
  React.useEffect(() => { setFull(!!props.immersive); }, [props.immersive]);
  React.useEffect(() => {
    if (!full) { return undefined; }
    acquireImmersive();
    return releaseImmersive;
  }, [full]);
  const link = React.useMemo(readDeepLink, []);
  const [tab, setTabRaw] = React.useState<TabKey>(link && tabOn('bookings') ? 'bookings' : 'home');
  const [deep, setDeep] = React.useState<{ bookingId: string; action?: string } | undefined>(link);
  const [menu, setMenu] = React.useState<boolean>(false);
  // Sections stay mounted once visited (no reload on return); `dir` tells the page which side to enter from.
  const [visited, setVisited] = React.useState<TabKey[]>([link && tabOn('bookings') ? 'bookings' : 'home']);
  const [dir, setDir] = React.useState<'left' | 'right' | 'none'>('none');
  const [fresh, setFresh] = React.useState<number>(0);
  const order = (t: TabKey): number => { const k: TabKey = PARENT[t] || t; const i: number = PRIMARY.map(x => x.key).indexOf(k); return i < 0 ? PRIMARY.length : i; };
  const go = (t: TabKey): void => {
    setTabRaw(prev => { if (prev !== t) { setDir(order(t) >= order(prev) ? 'right' : 'left'); buzz('tap'); } return t; });
    setVisited(v => (v.indexOf(t) >= 0 ? v : v.concat(t)));
  };
  const setTab = (t: TabKey): void => { if (tabOn(t, isDemo)) { go(t); setMenu(false); if (t !== 'bookings') { setDeep(undefined); } } };
  const [prefs, setPrefs] = React.useState<IFeedbackPrefs>(readPrefs);
  const setPref = (k: keyof IFeedbackPrefs, v: boolean): void => { const n: IFeedbackPrefs = { ...prefs, [k]: v }; setPrefs(n); writePrefs(n); if (v && k === 'sound') { chime('info'); } if (v && k === 'haptics') { buzz('success'); } };
  const [preMode, setPreMode] = React.useState<'equipment' | 'whole-kitchen' | 'dining' | 'private-event' | undefined>();
  const [preUnit, setPreUnit] = React.useState<string | undefined>();
  const [bookKey, setBookKey] = React.useState<number>(0);
  const openBooking = (bookingId: string, action?: 'extend'): void => { setDeep({ bookingId, action }); go('bookings'); };
  const portal = useLoad<IPortalData | undefined>(async () => {
    if (!source) { return undefined; }
    const [facility, resources, tables] = await Promise.all([source.getFacility(), source.listResources(), source.listDiningTables()]);
    return { facility, resources, tables };
  }, [source]);
  const notices = useLoad<INotice[]>(() => (source && tabOn('notices') ? source.listNotices().catch((): INotice[] => []) : Promise.resolve<INotice[]>([])), [source]);
  // A notice staff publish (or withdraw) while the portal is open reaches the bell within a minute, or on returning to the tab.
  React.useEffect(() => {
    const again = (): void => notices.reload();
    const id: number = window.setInterval(again, 60000);
    window.addEventListener('focus', again);
    return () => { window.clearInterval(id); window.removeEventListener('focus', again); };
  }, [source]);
  const [readIds, markRead] = useReadIds();
  const [bell, setBell] = React.useState<boolean>(false);
  // The dropdown stays mounted for its closing animation (0.24 s), then leaves the page; Escape closes it.
  const [bellMounted, setBellMounted] = React.useState<boolean>(false);
  React.useEffect(() => {
    if (bell) { setBellMounted(true); return undefined; }
    if (reduced) { setBellMounted(false); return undefined; }
    const t: number = window.setTimeout(() => setBellMounted(false), 240);
    return () => window.clearTimeout(t);
  }, [bell, reduced]);
  React.useEffect(() => {
    if (!bell) { return undefined; }
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') { setBell(false); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [bell]);
  const unreadList: INotice[] = (notices.data || []).filter(n => readIds.indexOf(n.id) < 0);
  const { alerts, markSeen } = useAlerts(source, portal.data ? portal.data.facility.timeZone : undefined, tabOn('bookings') && !isDemo);
  const unread: number = unreadList.length + alerts.length;
  const lastAlerts: React.MutableRefObject<number> = React.useRef<number>(-1);
  React.useEffect(() => {
    if (lastAlerts.current >= 0 && alerts.length > lastAlerts.current) {
      const a = alerts[0];
      chime(a.tone === 'bad' ? 'bad' : 'ok'); buzz(a.tone === 'bad' ? 'warn' : 'success');
      notify(`Flavors: ${a.title}`, a.text);
    }
    lastAlerts.current = alerts.length;
  }, [alerts.length]);
  const pinned: INotice | undefined = unreadList[0];
  const email: string = isDemo ? DEMO_MEMBER_EMAIL : userEmail;
  // Someone signed in with no membership yet sees the join screen; after Stripe checkout (?joined=1 or #welcome) the welcome
  // timeline. A failed membership read never shows Join (fail towards the normal portal; the flows still refuse bookings).
  const [joined, setJoined] = React.useState<boolean>(() => { try { return !isDemo && (/[?&]joined=1(&|$)/.test(window.location.search) || window.location.hash === '#welcome'); } catch { return false; } });
  // No membership row: a newcomer (no earlier requests of their own) sees Join; a former member (requests on record) sees the
  // inactive screen (plan F2), because deactivation deletes the row and Join would invite them to sign up again.
  const gate = useLoad<'member' | 'join' | 'inactive'>(async () => {
    if (!source || isDemo || staffUpload || (await source.getMyMembership(email)) !== undefined) { return 'member'; }
    const past = await source.listMyRequests().catch(() => []);
    return past.length > 0 ? 'inactive' : 'join';
  }, [source, email, isDemo, staffUpload]);
  // Payments are mocked for the pilot preview (STR-06): finishing the join screens lets a newcomer into the portal, remembered
  // per browser. ponytail: UI only, like the gate itself; the flows still refuse bookings until staff add the member (Members screen).
  const [mockIn, setMockIn] = React.useState<boolean>(() => { try { return !!email && window.localStorage.getItem(MOCK_JOIN_KEY) === email; } catch { return false; } });
  const mockPay = (): void => {
    try { window.localStorage.setItem(MOCK_JOIN_KEY, email); } catch { /* private mode: this visit only */ }
    setMockIn(true); setTab('home');
    toast('Welcome to Avenue. No payment was taken during the preview.');
  };
  const inactive: boolean = !joined && !mockIn && gate.data === 'inactive';
  const showJoin: boolean = joined || inactive || (gate.data === 'join' && !mockIn);
  const leaveWelcome = (): void => {
    setJoined(false);
    try { window.history.replaceState(null, '', window.location.pathname + window.location.search.replace(/([?&])joined=1(&|$)/, '$1').replace(/[?&]$/, '')); } catch { /* address bar only */ }
    gate.reload();
    setTab('documents');
  };
  const here: TabKey = PARENT[tab] || tab;
  const linksRef: React.RefObject<HTMLElement> = React.useRef<HTMLElement>(null);
  const [ink, setInk] = React.useState<{ left: number; width: number } | undefined>();
  React.useLayoutEffect(() => {
    const nav: HTMLElement | null = linksRef.current;
    const on: HTMLElement | null = nav ? nav.querySelector('[aria-current="page"]') : null;
    setInk(on && nav ? { left: on.offsetLeft + 12, width: on.offsetWidth - 24 } : undefined);
  }, [here, size, portal.data]);
  const tabKeys: TabKey[] = PRIMARY.filter(t => tabOn(t.key)).map(t => t.key);
  const tabIndex: number = tabKeys.indexOf(here);
  useRevealFallback(rootRef, React.useMemo(() => revealSelector(s as unknown as Record<string, string>), []), s.rvPending, reduced, `${tab}-${fresh}-${!!portal.data}`);
  // A new section starts at its top, not at the scroll position of the last one.
  const firstTab: React.MutableRefObject<boolean> = React.useRef<boolean>(true);
  React.useEffect(() => {
    if (firstTab.current) { firstTab.current = false; return; }
    if (rootRef.current && rootRef.current.scrollIntoView) { rootRef.current.scrollIntoView({ block: 'start' }); }
  }, [tab]);

  const renderTab = (t: TabKey): React.ReactElement | null => {
    if (!source || !portal.data) { return null; }
    const d: IPortalData = portal.data;
    const sent = (): void => { setFresh(n => n + 1); setTab('bookings'); };
    switch (t) {
      case 'home': return <HomeView source={source} data={d} userEmail={email} userName={userDisplayName} isDemo={isDemo} onNavigate={setTab} onOpenBooking={openBooking} onBook={(m) => { setPreMode(m); setPreUnit(undefined); setBookKey(n => n + 1); setTab('book'); }} notices={notices.data} />;
      case 'book': return <BookFlow key={bookKey} preselectMode={preMode} preselectUnit={preUnit} source={source} facility={d.facility} resources={d.resources} tables={d.tables} userEmail={email} onSent={sent} />;
      case 'calendar': return <CalendarView source={source} facility={d.facility} resources={d.resources} onBook={tabOn('book') ? (unitId?: string) => { setPreMode(undefined); setPreUnit(unitId); setBookKey(n => n + 1); setTab('book'); } : undefined} />;
      case 'bookings': return <MyBookings source={source} facility={d.facility} resources={d.resources} onBook={() => setTab('book')} onCheckIn={() => setTab('checkin')} deepLink={deep} />;
      case 'notices': return <NoticesView source={source} facility={d.facility} notices={notices.data} />;
      default: return (
        <div className={s.container}>
          <div className={s.legacy}>
            {PARENT[t] && t !== 'join' && <p><button type="button" className={s.linkBtn} onClick={() => setTab(PARENT[t] as TabKey)}>{`← ${PRIMARY.concat([{ key: 'billing', label: 'Billing', icon: '' }]).filter(x => x.key === PARENT[t])[0].label}`}</button></p>}
            {t === 'billing' && tabOn('membership') && <p><button type="button" className={s.linkBtn} onClick={() => setTab('membership')}>My membership</button></p>}
            {t === 'checkin' && <CheckInView source={source} facility={d.facility} rosterOn={tabOn('team', isDemo)} />}
            {t === 'documents' && <DocumentsView source={source} timeZone={d.facility.timeZone} staffUpload={staffUpload} userEmail={email} />}
            {t === 'billing' && <BillingView isDemo={isDemo} source={source} userEmail={email} timeZone={d.facility.timeZone} mockPayments={MOCK_PAYMENTS} />}
            {t === 'membership' && <MembershipView source={source} userEmail={email} />}
            {t === 'support' && <SupportView source={source} facilityId={d.facility.facilityId} />}
            {t === 'events' && <EventsView source={source} facilityId={d.facility.facilityId} timeZone={d.facility.timeZone} />}
            {t === 'storage' && <StorageView source={source} facilityId={d.facility.facilityId} />}
            {t === 'team' && <TeamView source={source} />}
            {t === 'join' && isDemo && <JoinView source={source} today={localDay(new Date(), d.facility.timeZone)} onMockPay={MOCK_PAYMENTS ? () => setTab('home') : undefined} />}
          </div>
        </div>
      );
    }
  };
  return (
    <SizeContext.Provider value={size}>
      <div className={`${styles.avenuePortal} ${s.site}`} ref={rootRef} data-layout={layout} data-size={size} data-screen={xxl === 'wide' ? 'xxl' : undefined} data-motion={reduced ? 'reduce' : 'full'} data-immersive={full ? 'on' : 'off'}>
        {isDemo && <div className={s.demoBar}><MessageBar messageBarType={MessageBarType.warning}>Demo data: invented sample records. Nothing you do here is saved.</MessageBar></div>}
        <header className={s.topbar}>
          {pinned && tab !== 'home' && tabOn('notices') && portal.data && (
            <div className={`${s.announce} ${pinned.category === 'Urgent' ? s.announceUrgent : ''}`}>
              <span>{pinned.category === 'Urgent' ? 'Urgent' : 'New'}: <strong>{pinned.title}</strong></span>
              <button type="button" className={s.linkBtnOnDark} onClick={() => { markRead([pinned.id]); setTab('notices'); }}>Read</button>
              <button type="button" className={s.dismissOnDark} aria-label="Dismiss this notice" onClick={() => markRead([pinned.id])}>✕</button>
            </div>
          )}
          <div className={s.bar}>
            <button type="button" className={s.brand} onClick={() => setTab('home')} aria-label="Flavors Avenue, home"><img className={s.brandLogo} src={brandLogoOnDark} alt="Avenue" /><span className={s.brandSub}>Flavors</span></button>
            <nav className={s.links} aria-label="Avenue sections" ref={linksRef}>
              {ink && <span className={s.navInk} style={{ transform: `translateX(${ink.left}px)`, width: ink.width }} aria-hidden="true" />}
              {PRIMARY.filter(t => tabOn(t.key)).map(t => (
                <button key={t.key} type="button" className={`${s.link} ${here === t.key ? s.linkOn : ''}`} aria-current={here === t.key ? 'page' : undefined} onClick={() => setTab(t.key)}>
                  {t.label}{((t.key === 'notices' && unreadList.length > 0) || (t.key === 'bookings' && alerts.length > 0)) && <i className={s.navDot} aria-label={`${unread} unread`} />}
                </button>
              ))}
            </nav>
            {(tabOn('notices') || tabOn('bookings')) && portal.data && (
              <div className={s.bellWrap}>
                <button type="button" className={s.bell} aria-label={`Notifications, ${unread} unread`} aria-haspopup="menu" aria-expanded={bell} onClick={() => { setBell(!bell); setMenu(false); }}>
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 17a7 7 0 0 1 14 0zM12 10V8M10.5 7h3M3 20h18" /></svg>
                  {unread > 0 && <b>{unread > 9 ? '9+' : unread}</b>}
                </button>
                {(bell || bellMounted) && (
                  <>
                    <div className={s.bellBackdrop} data-state={bell ? 'open' : 'closing'} onClick={() => setBell(false)} />
                    <div className={s.bellMenu} data-state={bell ? 'open' : 'closing'} role="menu" aria-label="Notifications" aria-hidden={!bell}>
                      <div className={s.bellHead}><strong>Notifications</strong>{unread > 0 && <button type="button" className={s.linkBtn} onClick={() => { markRead(unreadList.map(n => n.id)); markSeen(alerts.map(a => a.key)); }}>Mark all as read</button>}</div>
                      {unread === 0 ? <p className={s.bellEmpty}><span aria-hidden="true">✓</span>You are all caught up.</p> : (
                        <ul>
                          {alerts.slice(0, 6).map(a => (
                            <li key={a.key}><button type="button" role="menuitem" onClick={() => { markSeen([a.key]); setBell(false); if (a.requestId) { openBooking(a.requestId); } else { setTab(a.target); } }}>
                              <span className={`${s.bellCat} ${a.tone === 'ok' ? s.bellOk : a.tone === 'bad' ? s.bellBad : ''}`}>{a.tone === 'ok' ? '✓ Booking' : a.tone === 'bad' ? '! Attention' : 'Update'}</span><strong>{a.title}</strong><em>{a.text}</em>
                            </button></li>
                          ))}
                          {unreadList.slice(0, 5).map(n => (
                            <li key={n.id}><button type="button" role="menuitem" onClick={() => { markRead([n.id]); setBell(false); setTab('notices'); }}>
                              <span className={s.bellCat}><i className={`${s.ntIcon} ${s.bellNtIcon} ${n.category === 'Urgent' ? s.ntUrgent : n.category === 'Maintenance' ? s.ntMaintenance : n.category === 'Schedule' ? s.ntSchedule : s.ntGeneral}`} aria-hidden="true">{n.category.charAt(0)}</i>Notice · {n.category}</span><strong>{n.title}</strong>
                              <em>{new Intl.DateTimeFormat('en-US', { timeZone: portal.data ? portal.data.facility.timeZone : undefined, month: 'short', day: 'numeric' }).format(new Date(n.publishedUtc))}</em>
                            </button></li>
                          ))}
                        </ul>
                      )}
                      <button type="button" className={s.bellAll} onClick={() => { setBell(false); setTab('notices'); }}>See all notices</button>
                    </div>
                  </>
                )}
              </div>
            )}
            <div className={s.userWrap}>
              <button type="button" className={s.userChip} aria-haspopup="dialog" aria-expanded={menu} onClick={() => { setMenu(!menu); setBell(false); }}>
                <span className={s.avatar} aria-hidden="true">{initials(userDisplayName)}</span><span className={s.userName}>{userDisplayName}</span>
              </button>
            </div>
          </div>
        </header>

        {!source && <div className={s.container}><MessageBar>This page is not set up yet. Edit the web part and enter the facility ID.</MessageBar></div>}
        {source && portal.error && <div className={s.container}><MessageBar messageBarType={MessageBarType.error}>Avenue could not load the facility. {portal.error}</MessageBar></div>}
        {source && !portal.error && !portal.data && <div className={s.splash} role="status" aria-label="Loading Avenue"><img src={brandLogoOnDark} alt="Avenue" /><i aria-hidden="true" /></div>}

        {source && portal.data && showJoin && (
          <main className={s.main}>
            <div className={s.container}>
              {inactive ? <InactiveView facilityTitle={portal.data.facility.title} /> : joined
                ? <WelcomeView source={source} userEmail={email} onContinue={leaveWelcome} />
                : <JoinView source={source} today={localDay(new Date(), portal.data.facility.timeZone)} onMockPay={MOCK_PAYMENTS ? mockPay : undefined} />}
            </div>
          </main>
        )}
        {source && portal.data && !showJoin && (
          <main className={s.main} data-dir={dir}>
            {visited.map(k => (
              <div key={k === 'home' || k === 'bookings' || k === 'calendar' ? `${k}-${fresh}` : k} hidden={k !== tab} className={k === tab ? `${s.page} ${anim(reduced, s.pageEnter)}` : s.page} data-section={k}>
                {renderTab(k)}
              </div>
            ))}
          </main>
        )}

        {source && portal.data && (
          <footer className={s.siteFooter}>
            <div className={`${s.container} ${s.footGrid}`}>
              <div>
                <img className={s.footLogo} src={brandLogoOnDark} alt="Avenue" />
                <p>Booking and membership for {portal.data.facility.title}.</p>
                <p className={s.footFine}>Powered by Avenue™ · B Street HQ</p>
              </div>
              <nav aria-label="Quick links"><h3>Quick links</h3>
                {PRIMARY.filter(t => tabOn(t.key) && t.key !== 'home').map(t => <button key={t.key} type="button" onClick={() => setTab(t.key)}>{t.label}</button>)}
                {MORE.filter(m => tabOn(m.key)).map(m => <button key={m.key} type="button" onClick={() => setTab(m.key)}>{m.label}</button>)}
              </nav>
              <div><h3>The kitchen</h3><p>Open 24 hours with your own door code.</p><p>{portal.data.facility.title}</p></div>
              <div><h3>Policies</h3><p>Flavors confirms every request.</p><p>Cancel 24 hours or more ahead to get your hours back.</p><p>Early entry and clean-up time are free.</p></div>
            </div>
            <div className={`${s.container} ${s.footBase}`}><span>© 2026 B Street HQ. All rights reserved.</span><span>Questions about a booking? Ask the Flavors team at the facility.</span></div>
          </footer>
        )}

        <ProfileDrawer open={menu} onClose={() => setMenu(false)} source={source} isDemo={isDemo} userName={userDisplayName} userEmail={email} timeZone={portal.data ? portal.data.facility.timeZone : undefined} prefs={prefs} setPref={setPref} full={full} setFull={setFull} onNavigate={setTab} />
        <Toaster />
        <nav className={s.tabbar} aria-label="Avenue sections (phone)" style={{ ['--tabs' as string]: tabKeys.length, ['--ti' as string]: tabIndex < 0 ? 0 : tabIndex } as React.CSSProperties}>
          <span className={s.tabInk} aria-hidden="true" />
          {PRIMARY.filter(t => tabOn(t.key)).map(t => (
            <button key={t.key} type="button" className={`${s.tab} ${here === t.key ? s.tabOn : ''}`} aria-current={here === t.key ? 'page' : undefined} onClick={() => setTab(t.key)}>
              <Icon d={t.icon} /><span>{t.label}</span>{((t.key === 'notices' && unreadList.length > 0) || (t.key === 'bookings' && alerts.length > 0)) && <i className={s.navDot} aria-hidden="true" />}
            </button>
          ))}
        </nav>
      </div>
    </SizeContext.Provider>
  );
}
