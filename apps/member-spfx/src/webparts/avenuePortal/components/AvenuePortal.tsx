import * as React from 'react';
import { installSmoothScrollX } from './smoothScrollX';
import { brandLogoOnDark, brandLogoOnLight, brandMark } from '../assets';
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
import MoreSheet from './MoreSheet';
import { useFullBleed, useScrollFx } from './mobileFx';
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
import PoliciesView, { POLICY_SECTIONS } from './PoliciesView';
import { localDay } from '../../../avenue/calendar';
import { MOCK_PAYMENTS } from '../../../avenue/billing';
import { tabOn } from '../../../avenue/release';
import { ErrorBoundary, useAlerts, useLoad, useReadIds } from './ui';
import { SizeContext, anim, revealSelector, useContainerLayout, useReducedMotion, useRevealFallback, type PortalSize } from './motion';
import { initials } from '../../../avenue/ui-view';
import r from './Ref.module.scss';
import { PageHead, RefIcon } from './RefUi';
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

export type TabKey = 'home' | 'book' | 'calendar' | 'bookings' | 'checkin' | 'documents' | 'billing' | 'membership' | 'join' | 'notices' | 'support' | 'events' | 'storage' | 'team' | 'policies';

/** Primary links, in plain words. Screens whose module is not in the release are hidden by tabOn. */
const PRIMARY: { key: TabKey; label: string; icon: string }[] = [
  // Kitchen icons: chef's hat, stock pot, order ticket, prep calendar, service bell.
  { key: 'home', label: 'Home', icon: 'M7 14.5a4 4 0 1 1 1.6-7.7 4 4 0 0 1 6.8 0A4 4 0 1 1 17 14.5V18H7zM7 21h10M10 18v-3M14 18v-3' },
  { key: 'book', label: 'Book', icon: 'M3 10h18M5 10v7a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-7M2 12h3M19 12h3M9 7V5M12 7V3.5M15 7V5' },
  { key: 'bookings', label: 'My bookings', icon: 'M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4zM9 8h6M9 12h6M9 16h3' },
  { key: 'calendar', label: 'Schedule', icon: 'M4 6h16v14H4zM4 11h16M8 3v5M16 3v5M9 15h2M13 15h2' },
  { key: 'notices', label: 'Notices', icon: 'M5 17a7 7 0 0 1 14 0zM12 10V8M10.5 7h3M3 20h18' }
];


/** Sidebar (wide layout): MEMBER and ACCOUNT groups. Same tab keys and tabOn gating as the top bar; extra line icons for the account pages. */
const IC = {
  checkin: 'M5 12l4 4 10-10M4 20h16',
  membership: 'M4 7h16v10H4zM4 11h16M8 15h3',
  billing: 'M12 3v18M16 7.5c0-1.7-1.8-3-4-3s-4 1.3-4 3 1.8 3 4 3 4 1.3 4 3-1.8 3-4 3-4-1.3-4-3',
  documents: 'M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5',
  support: 'M4 5h16v11H9l-5 4zM8 9h8M8 12h5',
  events: 'M3 20h18M5 20V9l7-5 7 5v11M9 20v-6h6v6',
  storage: 'M4 4h16v6H4zM4 14h16v6H4zM8 7h2M8 17h2',
  policies: 'M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6zM9.5 12l2 2 3.5-4'
};
const SIDE: { label: string; items: { key: TabKey; label: string; icon: string }[] }[] = [
  { label: 'Member', items: [
    { key: 'home', label: 'Home', icon: '' }, { key: 'book', label: 'Book', icon: '' }, { key: 'bookings', label: 'My bookings', icon: '' },
    { key: 'calendar', label: 'Schedule', icon: '' }, { key: 'checkin', label: 'Check in', icon: IC.checkin }] },
  { label: 'Account', items: [
    { key: 'membership', label: 'Membership', icon: IC.membership }, { key: 'billing', label: 'Billing', icon: IC.billing }, { key: 'documents', label: 'Documents', icon: IC.documents },
    { key: 'notices', label: 'Notices', icon: '' }, { key: 'support', label: 'Messages', icon: IC.support }, { key: 'events', label: 'Events', icon: IC.events },
    { key: 'storage', label: 'Storage', icon: IC.storage }, { key: 'policies', label: 'Policies and help', icon: IC.policies }] }
];
const CRUMB: Partial<Record<TabKey, string>> = { home: 'Overview', book: 'Book', bookings: 'My bookings', calendar: 'Schedule', notices: 'Notices', checkin: 'Check in', documents: 'Documents', billing: 'Billing', membership: 'Membership', support: 'Messages', events: 'Events', storage: 'Storage', team: 'My team', policies: 'Policies and help', join: 'Join' };

/** Header for every screen without its own: eyebrow, title, one line. Same band and type size as the main pages. */
const PAGE_HEAD: Partial<Record<TabKey, { title: string; lede: string }>> = {
  checkin: { title: 'Check in', lede: 'Entry and exit checklists, and team wellness.' },
  documents: { title: 'Documents', lede: 'Permits and insurance, kept current.' },
  billing: { title: 'Billing', lede: 'Invoices and payments.' },
  membership: { title: 'Membership', lede: 'Your plan and hours.' },
  support: { title: 'Messages', lede: 'Ask a question or report a problem. Flavors replies here.' },
  events: { title: 'Events', lede: 'Book the dining room for a private event.' },
  storage: { title: 'Storage', lede: 'Fridge, freezer and dry storage on request.' },
  team: { title: 'My team', lede: 'The people who work with you. Their names fill in the wellness check.' },
  policies: { title: 'Policies and help', lede: 'How booking, cancelling, payments and documents work at Flavors.' },
  join: { title: 'Join', lede: 'Choose a plan to start booking.' }
};
/** Account screens open from the avatar menu; while one is open the avatar shows as the current place. */
const SIDE_ICON: Record<string, string> = { home: 'layout-dashboard', book: 'cooking-pot', bookings: 'calendar-days', calendar: 'clock-3', checkin: 'clipboard-check', membership: 'id-card', billing: 'credit-card', documents: 'file-text', notices: 'bell', support: 'message-square', events: 'sparkles', storage: 'archive', policies: 'shield-check', team: 'users' };
const MOCK_JOIN_KEY: string = 'avenue.mockJoined';
/** Which primary item a secondary screen belongs to, so the bar always shows where you are. */
const PARENT: Partial<Record<TabKey, TabKey>> = { checkin: 'bookings', join: 'home', events: 'book', team: 'bookings' };
/** Phone bar: Book sits in the middle, raised; Notices stay one tap away under the bell; More opens the account menu. */
const PHONE: TabKey[] = ['home', 'bookings', 'book', 'calendar'];

/** ?booking=<id>&action=extend from the reminder e-mail. */
function readDeepLink(): { bookingId: string; action?: string } | undefined {
  try {
    const q: URLSearchParams = new URLSearchParams(window.location.search);
    const id: string | null = q.get('booking');
    return id && /^[A-Za-z0-9._-]{1,80}$/.test(id) ? { bookingId: id, action: q.get('action') || undefined } : undefined;
  } catch { return undefined; }
}

/** One icon set for the phone tab bar: 24 px, 1.75 px round line icons (Lucide shapes), the same optical size on every tab. */
const TAB_ICON: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5',
  bookings: 'M8 2v4M16 2v4M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM3 10h18M9 16l2 2 4-4',
  book: 'M12 5v14M5 12h14',
  calendar: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6v6l4 2',
  more: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z'
};
function Icon(props: { d: string }): React.ReactElement {
  return <svg viewBox="-1 -1 26 26" overflow="visible" className={s.navIcon} aria-hidden="true" focusable="false"><path d={props.d} /></svg>;
}

/** Toasts raised by feedback.toast(): slide up above the tab bar, slide out after 3.2 s; hover or focus pauses the timer.
 *  Errors are announced as alerts, the rest politely. */
/** Success moment: a check that morphs in and 10 dots bursting outward, about 700 ms, once per event; then it removes itself. Reduced motion: none. */
function Celebration(): React.ReactElement | null {
  const [shot, setShot] = React.useState<{ id: number; text: string } | undefined>();
  const reduced: boolean = useReducedMotion();
  React.useEffect(() => {
    let t: number = 0;
    const on = (e: Event): void => {
      if (reduced) { return; }
      window.clearTimeout(t);
      setShot({ id: Date.now(), text: (e as CustomEvent<{ text: string }>).detail.text });
      t = window.setTimeout(() => setShot(undefined), 900);
    };
    window.addEventListener('avenue-celebrate', on);
    return () => { window.removeEventListener('avenue-celebrate', on); window.clearTimeout(t); };
  }, [reduced]);
  if (!shot) { return null; }
  return (
    <div key={shot.id} className={s.cele} aria-hidden="true">
      <span className={s.celeRing}><svg viewBox="0 0 52 52"><path d="M15 27l8 8 15-17" pathLength={1} /></svg></span>
      {Array.from({ length: 10 }).map((_, i) => <i key={i} style={{ ['--a' as string]: `${i * 36 + (i % 2 ? 10 : -6)}deg`, ['--d' as string]: `${54 + (i % 3) * 12}px` } as React.CSSProperties} />)}
    </div>
  );
}

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
  // Lenis-style glide for every horizontal rail (wheel sideways and mouse drag); vertical scrolling stays native.
  React.useEffect(() => (rootRef.current ? installSmoothScrollX(rootRef.current) : undefined), []);
  React.useEffect(() => {
    if (!full) { return undefined; }
    acquireImmersive();
    return releaseImmersive;
  }, [full]);
  const link = React.useMemo(readDeepLink, []);
  const [tab, setTabRaw] = React.useState<TabKey>(link && tabOn('bookings') ? 'bookings' : 'home');
  const [deep, setDeep] = React.useState<{ bookingId: string; action?: string } | undefined>(link);
  const [menu, setMenu] = React.useState<boolean>(false);
  const [more, setMore] = React.useState<boolean>(false);
  // Sections stay mounted once visited (no reload on return); `dir` tells the page which side to enter from.
  const [visited, setVisited] = React.useState<TabKey[]>([link && tabOn('bookings') ? 'bookings' : 'home']);
  const [dir, setDir] = React.useState<'left' | 'right' | 'none'>('none');
  const [fresh, setFresh] = React.useState<number>(0);
  const order = (t: TabKey): number => { const k: TabKey = PARENT[t] || t; const i: number = PRIMARY.map(x => x.key).indexOf(k); return i < 0 ? PRIMARY.length : i; };
  const go = (t: TabKey): void => {
    setTabRaw(prev => { if (prev !== t) { setDir(order(t) >= order(prev) ? 'right' : 'left'); buzz('tap'); } return t; });
    setVisited(v => (v.indexOf(t) >= 0 ? v : v.concat(t)));
  };
  // Pages opened from the More sheet keep "More" lit on the phone tab bar; any other navigation clears it.
  const [viaMore, setViaMore] = React.useState<boolean>(false);
  const setTab = (t: TabKey): void => { if (tabOn(t, isDemo)) { go(t); setMenu(false); setViaMore(false); if (t !== 'bookings') { setDeep(undefined); } } };
  const goFromMore = (t: TabKey): void => { setTab(t); setViaMore(true); };
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
  const [readIds, markRead] = useReadIds(source);
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
  // Bell: unread notices first, then an "Earlier" section of the most recent read ones; five notices at most.
  const bellUnread: INotice[] = unreadList.slice(0, 5);
  const bellEarlier: INotice[] = (notices.data || []).filter(n => readIds.indexOf(n.id) >= 0)
    .sort((a, b) => b.publishedUtc.localeCompare(a.publishedUtc)).slice(0, 5 - bellUnread.length);
  const bellNotice = (n: INotice, wasRead: boolean): React.ReactElement => (
    <li key={n.id} className={wasRead ? s.bellRead : undefined}><button type="button" role="menuitem" onClick={() => { if (!wasRead) { markRead([n.id]); } setBell(false); setTab('notices'); }}>
      <span className={s.bellCat}><i className={`${s.ntIcon} ${s.bellNtIcon} ${n.category === 'Urgent' ? s.ntUrgent : n.category === 'Maintenance' ? s.ntMaintenance : n.category === 'Schedule' ? s.ntSchedule : s.ntGeneral}`} aria-hidden="true">{n.category.charAt(0)}</i>Notice · {n.category}</span><strong>{n.title}</strong>
      <em>{new Intl.DateTimeFormat('en-US', { timeZone: portal.data ? portal.data.facility.timeZone : undefined, month: 'short', day: 'numeric' }).format(new Date(n.publishedUtc))}</em>
    </button></li>
  );
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
  // Sidebar rail (reference): the chevron folds the 246 px sidebar to a 72 px icon rail; remembered per browser.
  const [rail, setRail] = React.useState<boolean>(() => { try { return window.localStorage.getItem('avenue.rail') === '1'; } catch { return false; } });
  const toggleRail = (): void => { const n: boolean = !rail; setRail(n); try { window.localStorage.setItem('avenue.rail', n ? '1' : '0'); } catch { /* this visit only */ } };
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
  // The bar slims down once the page scrolls (SharePoint scrolls an inner element, not the window).
  const [compact, setCompact] = React.useState<boolean>(false);
  React.useEffect(() => {
    let el: HTMLElement | null = rootRef.current ? rootRef.current.parentElement : null;
    // Match on overflow only: at mount the page may not be taller than the scroller yet, and a height test would fall back to window and never fire.
    while (el && !/(auto|scroll)/.test(getComputedStyle(el).overflowY)) { el = el.parentElement; }
    const target: HTMLElement | Window = el || window;
    const read = (): void => setCompact((el ? el.scrollTop : window.scrollY) > 24);
    target.addEventListener('scroll', read, { passive: true } as AddEventListenerOptions);
    read();
    return () => target.removeEventListener('scroll', read);
  }, [portal.data, showJoin]);
  const wide: boolean = size === 'wide' && !!source && !!portal.data && !showJoin;
  // Sidebar height = the visible height of the real scroll container (SharePoint scrolls an inner element under its own header),
  // not a blind 100vh. The sidebar is sticky inside that scroller; --av-vh follows it through a ResizeObserver.
  React.useEffect(() => {
    const root: HTMLDivElement | null = rootRef.current;
    if (!root || !wide) { return undefined; }
    let el: HTMLElement | null = root.parentElement;
    while (el && !/(auto|scroll)/.test(getComputedStyle(el).overflowY)) { el = el.parentElement; }
    const set = (): void => { root.style.setProperty('--av-vh', `${Math.max(420, Math.round(el ? el.clientHeight : window.innerHeight))}px`); };
    set();
    const ro: ResizeObserver | undefined = el && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(set) : undefined;
    if (ro && el) { ro.observe(el); }
    window.addEventListener('resize', set);
    return () => { window.removeEventListener('resize', set); if (ro) { ro.disconnect(); } };
  }, [wide, portal.data, showJoin]);
  // The nav list opens at its top; it only scrolls to the active item when that item is out of view (short windows).
  React.useEffect(() => {
    const root: HTMLDivElement | null = rootRef.current;
    const list: HTMLElement | null = root ? root.querySelector('nav[aria-label="Avenue menu"]') : null;
    const on: HTMLElement | null = list ? list.querySelector('[aria-current="page"]') : null;
    if (!list || !on) { return; }
    const top: number = on.offsetTop - list.offsetTop;
    if (top < list.scrollTop) { list.scrollTop = Math.max(0, top - 8); } else if (top + on.offsetHeight > list.scrollTop + list.clientHeight) { list.scrollTop = top + on.offsetHeight - list.clientHeight + 8; }
  }, [here, wide, rail]);
  useFullBleed(rootRef, size === 'phone');
  // Button press ripple from the touch point: one delegated, passive pointerdown listener; a short-lived span animated with transform/opacity only.
  React.useEffect(() => {
    const root: HTMLDivElement | null = rootRef.current;
    if (!root || reduced) { return undefined; }
    const on = (e: PointerEvent): void => {
      const b: HTMLElement | null = (e.target as HTMLElement).closest ? (e.target as HTMLElement).closest('button') : null;
      if (!b || !root.contains(b) || (b as HTMLButtonElement).disabled) { return; }
      const r: DOMRect = b.getBoundingClientRect();
      const host: HTMLSpanElement = document.createElement('span'); host.className = s.ripple;
      const dot: HTMLElement = document.createElement('i');
      const d: number = Math.max(r.width, r.height) * 2;
      dot.style.cssText = `left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px;width:${d}px;height:${d}px`;
      host.appendChild(dot); b.appendChild(host);
      window.setTimeout(() => host.remove(), 500);
    };
    root.addEventListener('pointerdown', on, { passive: true });
    return () => root.removeEventListener('pointerdown', on);
  }, [reduced]);
  useScrollFx(rootRef, size !== 'wide', `${tab}-${fresh}-${!!portal.data}-${visited.length}`);
  const phoneKeys: TabKey[] = PHONE.filter(k => tabOn(k));
  const phoneHere: TabKey | undefined = viaMore ? undefined : tab === 'join' ? 'home' : tab; // More destinations (checkin, events, team...) are not in PHONE, so index -1 lights More
  const phoneIndex: number = phoneHere === undefined ? -1 : phoneKeys.indexOf(phoneHere);
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
      case 'book': return <BookFlow key={bookKey} preselectMode={preMode} preselectUnit={preUnit} source={source} facility={d.facility} resources={d.resources} tables={d.tables} userEmail={email} onSent={sent} onNavigate={setTab} />;
      case 'calendar': return <CalendarView source={source} facility={d.facility} resources={d.resources} onBook={tabOn('book') ? (unitId?: string) => { setPreMode(undefined); setPreUnit(unitId); setBookKey(n => n + 1); setTab('book'); } : undefined} />;
      case 'bookings': return <MyBookings source={source} facility={d.facility} resources={d.resources} onBook={() => setTab('book')} onCheckIn={() => setTab('checkin')} deepLink={deep} />;
      case 'notices': return <NoticesView source={source} facility={d.facility} notices={notices.data} />;
      default: {
        const h = PAGE_HEAD[t];
        return (
        <>
          {h && (
            <PageHead
              eyebrow={d.facility.title}
              title={h.title}
              lede={h.lede}
              action={t === 'billing' && tabOn('membership') ? <button type="button" className={s.crossLink} onClick={() => setTab('membership')}>My membership ›</button>
                : t === 'membership' && tabOn('billing') ? <button type="button" className={s.crossLink} onClick={() => setTab('billing')}>Billing and payments ›</button> : undefined}
            />
          )}
        <div className={s.container}>
          <div className={`${s.legacy} ${s.pgBody}`}>
            {t === 'checkin' && <CheckInView source={source} facility={d.facility} rosterOn={tabOn('team', isDemo)} resources={d.resources} />}
            {t === 'documents' && <DocumentsView source={source} timeZone={d.facility.timeZone} staffUpload={staffUpload} userEmail={email} />}
            {t === 'billing' && <BillingView isDemo={isDemo} source={source} userEmail={email} timeZone={d.facility.timeZone} mockPayments={MOCK_PAYMENTS} />}
            {t === 'membership' && <MembershipView source={source} userEmail={email} onNavigate={setTab} />}
            {t === 'support' && <SupportView source={source} facilityId={d.facility.facilityId} />}
            {t === 'events' && <EventsView source={source} facilityId={d.facility.facilityId} timeZone={d.facility.timeZone} />}
            {t === 'storage' && <StorageView source={source} facilityId={d.facility.facilityId} />}
            {t === 'team' && <TeamView source={source} />}
            {t === 'join' && isDemo && <JoinView source={source} today={localDay(new Date(), d.facility.timeZone)} onMockPay={MOCK_PAYMENTS ? () => setTab('home') : undefined} />}
            {t === 'policies' && <PoliciesView source={source} facility={d.facility} onNavigate={setTab} />}
          </div>
        </div>
        </>
        );
      }
    }
  };
  const announceEl: React.ReactNode = pinned && tab !== 'home' && tabOn('notices') && portal.data ? (
            <div className={`${s.announce} ${pinned.category === 'Urgent' ? s.announceUrgent : ''}`}>
              <span>{pinned.category === 'Urgent' ? 'Urgent' : 'New'}: <strong>{pinned.title}</strong></span>
              <button type="button" className={s.linkBtnOnDark} onClick={() => { markRead([pinned.id]); setTab('notices'); }}>Read</button>
              <button type="button" className={s.dismissOnDark} aria-label="Dismiss this notice" onClick={() => markRead([pinned.id])}>✕</button>
            </div>
  ) : null;
  return (
    <SizeContext.Provider value={size}>
      <div className={`${styles.avenuePortal} ${s.site} ${r.refVars} ${wide ? `${r['app-shell']} ${rail ? r['sidebar-collapsed'] : ''}` : ''}`} ref={rootRef} data-layout={layout} data-size={size} data-hero={tab === 'home' && !compact && !showJoin ? 'top' : undefined} data-rail={rail ? 'on' : 'off'} data-screen={xxl === 'wide' ? 'xxl' : undefined} data-motion={reduced ? 'reduce' : 'full'} data-immersive={full ? 'on' : 'off'} data-compact={compact ? 'on' : 'off'}>
        {wide && (
          <aside className={r.sidebar} aria-label="Avenue navigation">
            <div className={r.brand}>
              <button type="button" className={r['brand-home']} onClick={() => setTab('home')} aria-label="Avenue, home">
                {rail
                  ? <img className={r['brand-logo-mark']} src={brandMark} alt="Avenue" />
                  : <img className={r['brand-logo']} src={brandLogoOnLight} alt="Avenue" />}
              </button>
              <button type="button" className={r['collapse-btn']} aria-label={rail ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!rail} onClick={toggleRail}><RefIcon name="chevron-left" size={16} /></button>
            </div>
            <div className={r['workspace-switch']} title={portal.data ? portal.data.facility.title : ''}>
              <span className={r['workspace-icon']} aria-hidden="true">{portal.data ? portal.data.facility.title.charAt(0) : ''}</span>
              <span className={r['workspace-copy']}><b>{portal.data ? portal.data.facility.title : ''}</b><small>Member</small></span>
              <RefIcon name="chevron-down" size={15} />
            </div>
            <nav className={r['nav-groups']} aria-label="Avenue menu">
              {SIDE.map(g => {
                const its = g.items.filter(i => tabOn(i.key));
                return its.length === 0 ? null : (
                  <div key={g.label} className={r['nav-group']}>
                    <div className={r['nav-label']}>{g.label.toUpperCase()}</div>
                    {its.map(i => {
                      const badge: number = i.key === 'notices' ? unreadList.length : i.key === 'bookings' ? alerts.length : 0;
                      return (
                        <button key={i.key} type="button" title={i.label} className={`${r['nav-item']} ${here === i.key ? r.selected : ''}`} aria-current={here === i.key ? 'page' : undefined} onClick={() => setTab(i.key)}>
                          <RefIcon name={SIDE_ICON[i.key] || 'circle-question-mark'} /><span>{i.label}</span>{badge > 0 && <span className={r['nav-count']} aria-label={`${badge} unread`}>{badge > 9 ? '9+' : badge}</span>}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </nav>
            <div className={r['sidebar-bottom']}>
              {tabOn('support') && (
                <div className={r['help-card']}>
                  <div className={r['help-icon']}><RefIcon name="circle-question-mark" size={17} /></div>
                  <b>Need a hand?</b><p>Message Flavors.</p>
                  <button type="button" onClick={() => setTab('support')}>Message Flavors <RefIcon name="arrow-up-right" size={13} /></button>
                </div>
              )}
              <button type="button" className={r.profile} title={userDisplayName} aria-haspopup="dialog" aria-expanded={menu} onClick={() => { setMenu(!menu); setBell(false); }}>
                <div className={r['profile-avatar']}>{initials(userDisplayName)}</div>
                <div className={r['profile-copy']}><b>{userDisplayName}</b><small>Member</small></div>
                <RefIcon name="ellipsis" size={17} />
              </button>
            </div>
          </aside>
        )}
        <div className={wide ? r['main-area'] : s.col}>
        {isDemo && <div className={s.demoBar}><MessageBar messageBarType={MessageBarType.warning}>Demo data: invented sample records. Nothing you do here is saved.</MessageBar></div>}
        {wide && announceEl}
        <header className={wide ? r.topbar : s.topbar}>
          {!wide && announceEl}
          <div className={s.bar} data-wide={wide ? '1' : undefined}>
            {!wide && <button type="button" className={s.brand} onClick={() => setTab('home')} aria-label="Flavors Avenue, home"><span className={s.logoStack}><img className={`${s.brandLogo} ${s.logoOnLight}`} src={brandLogoOnLight} alt="Avenue" /><img className={`${s.brandLogo} ${s.logoOnDark}`} src={brandLogoOnDark} alt="" aria-hidden="true" /></span></button>}
            {wide
              ? <span aria-hidden="true" />
              : <p className={s.crumb} aria-label="You are here"><span>{portal.data ? portal.data.facility.title : 'Flavors'}</span><i aria-hidden="true">›</i><strong>{CRUMB[tab] || 'Avenue'}</strong></p>}
            {!wide && <nav className={s.links} aria-label="Avenue sections" ref={linksRef}>
              {ink && <span className={s.navInk} style={{ transform: `translateX(${ink.left}px)`, width: ink.width }} aria-hidden="true" />}
              {PRIMARY.filter(t => tabOn(t.key)).map(t => (
                <button key={t.key} type="button" className={`${s.link} ${here === t.key ? s.linkOn : ''}`} aria-current={here === t.key ? 'page' : undefined} onClick={() => setTab(t.key)}>
                  {t.label}{((t.key === 'notices' && unreadList.length > 0) || (t.key === 'bookings' && alerts.length > 0)) && <i className={s.navDot} aria-label={`${unread} unread`} />}
                </button>
              ))}
            </nav>}
            <div className={wide ? r['top-actions'] : s.actions}>
            {(tabOn('notices') || tabOn('bookings')) && portal.data && (
              <div className={`${s.bellWrap} ${wide ? r['notification-wrap'] : ''}`}>
                <button type="button" className={wide ? r['icon-button'] : s.bell} aria-label={`Notifications, ${unread} unread`} aria-haspopup="menu" aria-expanded={bell} onClick={() => { setBell(!bell); setMenu(false); }}>
                  <RefIcon name="bell" size={wide ? 17 : 20} />
                  {wide ? (unread > 0 && <i className={r['notification-dot']} />) : (unread > 0 && <b>{unread > 9 ? '9+' : unread}</b>)}
                </button>
                {(bell || bellMounted) && (
                  <>
                    <div className={s.bellBackdrop} data-state={bell ? 'open' : 'closing'} onClick={() => setBell(false)} />
                    <div className={s.bellMenu} data-state={bell ? 'open' : 'closing'} role="menu" aria-label="Notifications" aria-hidden={!bell}>
                      <div className={s.bellHead}><strong>Notifications</strong>{unread > 0 && <button type="button" className={s.linkBtn} onClick={() => { markRead(unreadList.map(n => n.id)); markSeen(alerts.map(a => a.key)); }}>Mark all as read</button>}</div>
                      {unread === 0 && <p className={s.bellEmpty}><span aria-hidden="true">✓</span>You are all caught up.</p>}
                      {(unread > 0 || bellEarlier.length > 0) && (
                        <ul>
                          {alerts.slice(0, 6).map(a => (
                            <li key={a.key}><button type="button" role="menuitem" onClick={() => { markSeen([a.key]); setBell(false); if (a.requestId) { openBooking(a.requestId); } else { setTab(a.target); } }}>
                              <span className={`${s.bellCat} ${a.tone === 'ok' ? s.bellOk : a.tone === 'bad' ? s.bellBad : ''}`}>{a.tone === 'ok' ? '✓ Booking' : a.tone === 'bad' ? '! Attention' : 'Update'}</span><strong>{a.title}</strong><em>{a.text}</em>
                            </button></li>
                          ))}
                          {bellUnread.map(n => bellNotice(n, false))}
                          {bellEarlier.length > 0 && <li className={s.bellSection} role="presentation">Earlier</li>}
                          {bellEarlier.map(n => bellNotice(n, true))}
                        </ul>
                      )}
                      <button type="button" className={s.bellAll} onClick={() => { setBell(false); setTab('notices'); }}>See all notices</button>
                    </div>
                  </>
                )}
              </div>
            )}
            {wide
              ? <button type="button" className={r['top-avatar']} aria-label={`${userDisplayName}, account menu`} aria-haspopup="dialog" aria-expanded={menu} onClick={() => { setMenu(!menu); setBell(false); }}>{initials(userDisplayName)}</button>
              : <div className={s.userWrap}>
                <button type="button" className={`${s.userChip} ${menu ? s.userChipOn : ''}`} aria-label={`${userDisplayName}, profile`} aria-haspopup="dialog" aria-expanded={menu} onClick={() => { setMenu(!menu); setMore(false); setBell(false); }}>
                  <span className={s.avatar} aria-hidden="true">{initials(userDisplayName)}</span><span className={s.userName}>{userDisplayName}</span>
                </button>
              </div>}
            </div>
          </div>
        </header>

        {!source && <div className={s.container}><MessageBar>This page is not set up yet. Edit the web part and enter the facility ID.</MessageBar></div>}
        {source && portal.error && <div className={s.container}><MessageBar messageBarType={MessageBarType.error}>Avenue could not load the facility. {portal.error}</MessageBar></div>}
        {source && !portal.error && !portal.data && <div className={s.splash} role="status" aria-label="Loading Avenue"><img src={brandLogoOnDark} alt="Avenue" /><i aria-hidden="true" /></div>}

        {source && portal.data && showJoin && (
          <main className={`${s.main} ${r.content}`}>
            <div className={s.container}>
              {inactive ? <InactiveView facilityTitle={portal.data.facility.title} /> : joined
                ? <WelcomeView source={source} userEmail={email} onContinue={leaveWelcome} />
                : <JoinView source={source} today={localDay(new Date(), portal.data.facility.timeZone)} onMockPay={MOCK_PAYMENTS ? mockPay : undefined} />}
            </div>
          </main>
        )}
        {source && portal.data && !showJoin && (
          <main className={`${s.main} ${r.content}`} data-dir={dir}>
            {visited.map(k => (
              <div key={k === 'home' || k === 'bookings' || k === 'calendar' ? `${k}-${fresh}` : k} hidden={k !== tab} className={k === tab ? `${s.page} ${anim(reduced, s.pageEnter)}` : s.page} data-section={k}>
                {renderTab(k)}
              </div>
            ))}
          </main>
        )}

        {source && portal.data && (
          <footer className={`${s.siteFooter} ${s.footCompact}`}>
            <div className={`${s.container} ${s.footRow}`}>
              <img className={s.footLogo} src={brandLogoOnLight} alt="Avenue" />
              <span className={s.footLine}>Booking and membership for {portal.data.facility.title} · open 24 hours</span>
              <details className={s.footMore}>
                <summary>More links</summary>
                <nav aria-label="More links">
                  {tabOn('events') && <button type="button" onClick={() => setTab('events')}>Events</button>}
                  {tabOn('storage') && <button type="button" onClick={() => setTab('storage')}>Storage</button>}
                  {tabOn('support') && <button type="button" onClick={() => setTab('support')}>Message Flavors</button>}
                  {POLICY_SECTIONS.map(x => <button key={x.id} type="button" onClick={() => { setTab('policies'); window.setTimeout(() => { const el: HTMLElement | null = document.getElementById(`policy-${x.id}`); if (el && el.scrollIntoView) { el.scrollIntoView({ block: 'start' }); } }, 60); }}>{x.title}</button>)}
                </nav>
              </details>
            </div>
            <div className={`${s.container} ${s.footBase}`}><span>© {new Date().getFullYear()} B Street HQ. Powered by Avenue™.</span><button type="button" className={s.footLink} onClick={() => setTab('policies')}>All policies and help</button></div>
          </footer>
        )}
        </div>

        <ProfileDrawer open={menu} onClose={() => setMenu(false)} source={source} isDemo={isDemo} userName={userDisplayName} userEmail={email} timeZone={portal.data ? portal.data.facility.timeZone : undefined} prefs={prefs} setPref={setPref} full={full} setFull={setFull} onNavigate={setTab} profileOnly={size === 'phone'} />
        <MoreSheet open={more} onClose={() => setMore(false)} onNavigate={goFromMore} isDemo={isDemo} badges={{ notices: unreadList.length, bookings: alerts.length }} />
        <Toaster />
        <Celebration />
        <nav className={s.tabbar} aria-label="Avenue sections (phone)" data-book={tab === 'book' ? '1' : undefined} style={{ ['--tabs' as string]: phoneKeys.length + 1, ['--ti' as string]: phoneIndex < 0 ? phoneKeys.length : phoneIndex } as React.CSSProperties}>
          <span className={s.tabInk} aria-hidden="true" />
          {phoneKeys.map(k => { const t = PRIMARY.filter(x => x.key === k)[0]; return (
            <button key={t.key} type="button" className={`${s.tab} ${phoneHere === t.key ? s.tabOn : ''} ${t.key === 'book' ? s.tabBook : ''}`} aria-current={phoneHere === t.key ? 'page' : undefined} onClick={() => setTab(t.key)}>
              <Icon d={TAB_ICON[t.key] || t.icon} /><span>{t.key === 'bookings' ? 'Bookings' : t.label}</span>{t.key === 'bookings' && alerts.length > 0 && <i className={s.navDot} aria-hidden="true" />}
            </button>
          ); })}
          <button type="button" className={`${s.tab} ${phoneIndex < 0 || more ? s.tabOn : ''}`} aria-haspopup="dialog" aria-expanded={more} onClick={() => { setMore(!more); setMenu(false); setBell(false); }}>
            <Icon d={TAB_ICON.more} /><span>More</span>{unreadList.length > 0 && <i className={s.navDot} aria-hidden="true" />}
          </button>
        </nav>
      </div>
    </SizeContext.Provider>
  );
}
