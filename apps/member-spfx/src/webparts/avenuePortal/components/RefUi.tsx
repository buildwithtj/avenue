import * as React from 'react';
import r from './Ref.module.scss';
import { homeImage } from '../assets';

// Reference console building blocks (markup lifted from https://culina-rust.vercel.app/; classes in Ref.module.scss).
// Icons are the reference's own set (lucide, 24 grid, 2 px stroke), drawn inline so there is no icon font to load.
const P: Record<string, string[]> = {
  'cooking-pot': ['M2 12h20', 'M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8', 'm4 8 16-4', 'm8.86 6.78-.45-1.81a2 2 0 0 1 1.45-2.43l1.94-.48a2 2 0 0 1 2.43 1.46l.45 1.8'],
  'chevron-left': ['m15 18-6-6 6-6'], 'chevron-right': ['m9 18 6-6-6-6'], 'chevron-down': ['m6 9 6 6 6-6'],
  'layout-dashboard': ['M3 3h7v9H3z', 'M14 3h7v5h-7z', 'M14 12h7v9h-7z', 'M3 16h7v5H3z'],
  'calendar-days': ['M8 2v4', 'M16 2v4', 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M3 10h18', 'M8 14h.01', 'M12 14h.01', 'M16 14h.01', 'M8 18h.01', 'M12 18h.01', 'M16 18h.01'],
  utensils: ['M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2', 'M7 2v20', 'M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7'],
  users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  activity: ['M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2'],
  'settings-2': ['M14 17H5', 'M19 7h-9', 'M17 14a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 'M7 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
  'circle-question-mark': ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3', 'M12 17h.01'],
  'arrow-up-right': ['M7 7h10v10', 'M7 17 17 7'],
  ellipsis: ['M12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2z', 'M19 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2z', 'M5 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2z'],
  bell: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'],
  plus: ['M5 12h14', 'M12 5v14'],
  'clock-3': ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 6v6h4.5'],
  'map-pin': ['M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0', 'M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
  'shield-check': ['M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z', 'm9 12 2 2 4-4'],
  download: ['M12 15V3', 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm7 10 5 5 5-5'],
  'clipboard-check': ['M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z', 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2', 'm9 14 2 2 4-4'],
  'credit-card': ['M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', 'M2 10h20'],
  'file-text': ['M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z', 'M14 2v4a2 2 0 0 0 2 2h4', 'M10 9H8', 'M16 13H8', 'M16 17H8'],
  'message-square': ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
  'id-card': ['M16 10h2', 'M16 14h2', 'M6.17 15a3 3 0 0 1 5.66 0', 'M9 9a2 2 0 1 0 0 4 2 2 0 0 0 0-4z', 'M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z'],
  sparkles: ['M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z'],
  paperclip: ['m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48'],
  send: ['m22 2-7 20-4-9-9-4Z', 'M22 2 11 13'],
  check: ['M20 6 9 17l-5-5'],
  'check-check': ['M18 6 7 17l-5-5', 'm22 10-7.5 7.5L13 16'],
  megaphone: ['m3 11 18-5v12L3 14v-3z', 'M11.6 16.8a3 3 0 1 1-5.8-1.6'],
  wrench: ['M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z'],
  'triangle-alert': ['m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3', 'M12 9v4', 'M12 17h.01'],
  info: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 16v-4', 'M12 8h.01'],
  house: ['M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8', 'M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'],
  archive: ['M3 3h18a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', 'M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8', 'M10 12h4'],
  flame: ['M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z'],
  oven: ['M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', 'M3 8h18', 'M7 5.5h.01', 'M11 5.5h.01', 'M7 12h10v5H7z'],
  'rotate-cw': ['M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8', 'M21 3v5h-5']
};

export type RefIconName = keyof typeof P;

export function RefIcon(props: { name: string; size?: number }): React.ReactElement {
  const size: number = props.size || 17;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="-1 -1 26 26" overflow="visible" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {(P[props.name] || P['circle-question-mark']).map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

/** Page eyebrow: the facility name only (client 25 Nov 2026: "Flavors Culinary Hub", one line). */
export const shortSite = (t: string): string => t.split(' · ')[0].replace(/\s+Hyattsville$/i, '');

/** Page header block of the reference: gold-dash eyebrow, 27 px title with a gold full stop, grey sub line, primary action on the right. */
export function PageHead(props: { eyebrow: string; title: string; lede?: string; action?: React.ReactNode; back?: React.ReactNode }): React.ReactElement {
  return (
    <div className={r['greeting-row']}>
      <div>
        {props.back}
        <div className={`${r.eyebrow} ${r['page-eyebrow']}`}>{shortSite(props.eyebrow)}</div>
        <h1>{props.title}<span aria-hidden="true">.</span></h1>
        {props.lede && <p className={r['page-subtitle']}>{props.lede}</p>}
      </div>
      {props.action}
    </div>
  );
}


/** Reference "module-view": white card with eyebrow + h2 heading (and an optional count / actions), then the body. */
export function ModuleCard(props: { id?: string; icon?: string; focal?: boolean; eyebrow?: string; title?: string; count?: React.ReactNode; actions?: React.ReactNode; className?: string; ariaLabel?: string; children: React.ReactNode }): React.ReactElement {
  return (
    <section id={props.id} data-focal={props.focal ? '1' : undefined} className={`${r['module-view']} ${props.className || ''}`} aria-label={props.title ? undefined : props.ariaLabel} aria-labelledby={props.id && props.title ? `${props.id}-h` : undefined}>
      {(props.title || props.count || props.actions) && (
        <div className={r['module-view-heading']}>
          <div>{props.eyebrow && <span className={r.eyebrow}>{props.eyebrow}</span>}{props.title && <h2 id={props.id ? `${props.id}-h` : undefined}>{props.icon && <span className={r['mv-ico']} aria-hidden="true"><RefIcon name={props.icon} size={20} /></span>}<span className={r['mv-title-text']}>{props.title}</span></h2>}</div>
          <div className={r['module-heading-side']}>{props.actions}{props.count !== undefined && props.count !== '' && <span className={r['module-count']}>{props.count}</span>}</div>
        </div>
      )}
      {props.children}
    </section>
  );
}

/** Reference list row: avatar tile, two-line copy, time, status chip, action. Every slot is optional. */
export function ModuleRow(props: { avatar?: React.ReactNode; tone?: 'teal' | 'gold' | 'slate'; title: React.ReactNode; sub?: React.ReactNode; time?: React.ReactNode; status?: React.ReactNode; statusTone?: 'ok' | 'wait' | 'bad'; action?: React.ReactNode; onClick?: () => void; className?: string; extra?: React.ReactNode }): React.ReactElement {
  const body: React.ReactNode = (
    <>
      {props.avatar !== undefined && <span className={`${r['tenant-avatar']} ${r[props.tone || 'teal']}`} aria-hidden="true">{props.avatar}</span>}
      <div className={r['module-row-copy']}><b>{props.title}</b>{props.sub && <span>{props.sub}</span>}{props.extra}</div>
      {props.time && <span className={r['module-row-time']}>{props.time}</span>}
      {props.status && <span className={`${r['module-status']} ${props.statusTone === 'wait' ? r['is-pending'] : props.statusTone === 'bad' ? r['is-bad'] : ''}`}>{props.status}</span>}
      {props.action}
    </>
  );
  return props.onClick
    ? <button type="button" className={`${r['module-row']} ${r['module-row-btn']} ${props.className || ''}`} onClick={props.onClick}>{body}</button>
    : <div className={`${r['module-row']} ${props.className || ''}`}>{body}</div>;
}

/** Reference stat card: icon tile, h3, caption, optional progress bar and teal footer line. */
export function StatCard(props: { icon: string; title: React.ReactNode; sub?: React.ReactNode; pct?: number; foot?: React.ReactNode; action?: React.ReactNode }): React.ReactElement {
  return (
    <article className={r['module-stat-card']}>
      <span className={r['kpi-icon']}><RefIcon name={props.icon} size={15} /></span>
      <h3>{props.title}</h3>
      {props.sub && <p>{props.sub}</p>}
      {props.pct !== undefined && <div className={r['module-progress']}><i style={{ width: `${Math.max(0, Math.min(100, props.pct))}%` }} /></div>}
      {props.foot && <b>{props.foot}</b>}
      {props.action}
    </article>
  );
}

/** Reference settings row: label + caption on the left, a teal pill (or any node) on the right. */
export function SettingRow(props: { title: React.ReactNode; sub?: React.ReactNode; side?: React.ReactNode }): React.ReactElement {
  return <article className={r['module-setting-row']}><div><b>{props.title}</b>{props.sub && <p>{props.sub}</p>}</div>{props.side !== undefined && (typeof props.side === 'string' ? <span>{props.side}</span> : props.side)}</article>;
}

/** Reference tab strip (filter-tabs): underline on the active tab, optional count pill. */
export function Tabs<T extends string>(props: { value: T; items: { key: T; label: string; count?: number }[]; onChange: (k: T) => void; label: string }): React.ReactElement {
  return (
    <div className={r['filter-tabs']} role="group" aria-label={props.label} style={{ ['--n' as string]: props.items.length, ['--i' as string]: Math.max(0, props.items.map(i => i.key).indexOf(props.value)) } as React.CSSProperties}>
      {props.items.map(i => <button key={i.key} type="button" className={props.value === i.key ? r['filter-active'] : ''} aria-pressed={props.value === i.key} onClick={() => props.onChange(i.key)}>{i.label}{i.count !== undefined && <span>{i.count}</span>}</button>)}
    </div>
  );
}

/** A small empty-state illustration: a pot with rising steam. The steam loops only while it is on screen (data-idle / data-playing), static under reduced motion. */
export function EmptyArt(): React.ReactElement {
  return (
    <span className={r['empty-art']} data-idle aria-hidden="true">
      <svg viewBox="0 0 64 64" width="64" height="64">
        <path className={r['steam']} d="M24 22c-3-4 3-6 0-10" /><path className={r['steam']} d="M32 20c-3-4 3-6 0-10" /><path className={r['steam']} d="M40 22c-3-4 3-6 0-10" />
        <rect x="12" y="30" width="40" height="22" rx="8" className={r['pot']} /><rect x="8" y="27" width="48" height="6" rx="3" className={r['lid']} />
      </svg>
    </span>
  );
}

/** Reference empty state: soft icon tile, title, caption, optional action. */
export function EmptyState(props: { icon?: string; title: string; sub?: string; action?: React.ReactNode }): React.ReactElement {
  return (
    <div className={r['ref-empty']} role="status">
      <EmptyArt />
      <b>{props.title}</b>{props.sub && <p>{props.sub}</p>}{props.action}
    </div>
  );
}

/** Home photo card in the reference's card language: fixed aspect ratio (no layout shift), soft scrim, eyebrow, caption and a quiet action.
 *  The picture comes from ONE constant (assets/index.ts: homeImage); a neutral tile shows if it cannot load. */
export function HomeImageCard(props: { facility: string; onBook?: () => void }): React.ReactElement {
  const [failed, setFailed] = React.useState<boolean>(false);
  return (
    <section className={r['photo-card']} aria-label={`Your kitchen at ${props.facility}`} data-failed={failed ? '1' : undefined}>
      {!failed && <img className={r['photo-img']} src={homeImage} alt={`The dining room at ${props.facility}`} loading="lazy" decoding="async" width={960} height={600} onError={() => setFailed(true)} />}
      <div className={r['photo-scrim']} aria-hidden="true" />
      <div className={r['photo-copy']}>
        <span className={`${r.eyebrow} ${r['photo-eyebrow']}`}>Your kitchen</span>
        <b>Your kitchen at {props.facility}</b>
        {props.onBook && <button type="button" className={r['photo-action']} onClick={props.onBook}>Book kitchen time<RefIcon name="arrow-up-right" size={14} /></button>}
      </div>
    </section>
  );
}

/** Home hero: the kitchen photo at the very top with the greeting and the primary action over a dark-to-clear scrim (white text on the scrim is AA).
 *  Fixed aspect ratio (no layout shift); the photo is the page's first paint so it loads eagerly. Same constant as HomeImageCard (assets: homeImage). */
export function HomeHero(props: { facility: string; eyebrow: string; title: string; lede?: string; pill?: string; onBook?: () => void; children?: React.ReactNode }): React.ReactElement {
  const [failed, setFailed] = React.useState<boolean>(false);
  const ref = React.useRef<HTMLElement>(null);
  // Phone: the photo is full screen and stays behind while the content slides over it. --hero-p (0..1) follows the scroll of the page's scroller
  // and fades/zooms the photo slightly. Reduced motion: no listener, no parallax.
  React.useEffect(() => {
    const el: HTMLElement | null = ref.current;
    if (!el || !(typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: no-preference)').matches)) { return undefined; }
    let sc: HTMLElement | null = el.parentElement;
    while (sc && !(/(auto|scroll)/.test(getComputedStyle(sc).overflowY) && sc.scrollHeight > sc.clientHeight)) { sc = sc.parentElement; }
    const target: HTMLElement | Window = sc || window;
    // No layout reads while scrolling: the hero height is measured once (and on resize); the handler is passive and rAF-throttled, and only writes one CSS variable.
    let h: number = Math.max(1, el.offsetHeight); let queued: boolean = false;
    const write = (): void => { queued = false; const y: number = sc ? sc.scrollTop : window.scrollY; el.style.setProperty('--hero-p', Math.min(1, Math.max(0, y / h)).toFixed(2)); };
    const read = (): void => { if (!queued) { queued = true; requestAnimationFrame(write); } };
    const measure = (): void => { h = Math.max(1, el.offsetHeight); read(); };
    window.addEventListener('resize', measure, { passive: true } as AddEventListenerOptions);
    target.addEventListener('scroll', read, { passive: true } as AddEventListenerOptions);
    read();
    return () => { window.removeEventListener('resize', measure); target.removeEventListener('scroll', read); };
  }, []);
  return (
    <section ref={ref} className={r.hero} aria-label={`Your kitchen at ${props.facility}`} data-failed={failed ? '1' : undefined}>
      {!failed && <img className={r['hero-img']} src={homeImage} alt={`The dining room at ${props.facility}`} decoding="async" width={1280} height={560} onError={() => setFailed(true)} />}
      <div className={r['hero-blur']} aria-hidden="true" />
      <div className={r['hero-scrim']} aria-hidden="true" />
      <div className={r['hero-copy']}>
        {props.pill && <span className={r['hero-pill']}><i aria-hidden="true" />{props.pill}</span>}
        <div className={`${r.eyebrow} ${r['hero-eyebrow']}`}>{props.eyebrow}</div>
        <h1>{props.title}<span aria-hidden="true">.</span></h1>
        {props.lede && <p>{props.lede}</p>}
        {props.onBook && <button type="button" className={r['hero-cta']} aria-label="Book kitchen time" onClick={props.onBook}><span className={r['cta-plus']} aria-hidden="true"><RefIcon name="plus" size={15} /></span>Book kitchen time</button>}
        {props.children}
      </div>
    </section>
  );
}

/** Round icon shortcuts under the hero (Book, My bookings, Check in, Documents ...). 44 px targets, label under each circle. */
export function QuickShortcuts(props: { items: { key: string; label: string; icon: string; onClick: () => void; badge?: number }[]; onHero?: boolean }): React.ReactElement {
  if (props.items.length === 0) { return <></>; }
  return (
    <nav className={`${r.shortcuts} ${props.onHero ? r['shortcuts-hero'] : r['shortcuts-below']}`} aria-label="Quick actions">
      {props.items.map(i => (
        <button key={i.key} type="button" onClick={i.onClick}>
          <span className={r['shortcut-dot']}><RefIcon name={i.icon} size={20} />{!!i.badge && <b aria-label={`${i.badge} new`}>{i.badge > 9 ? '9+' : i.badge}</b>}</span>
          <span>{i.label}</span>
        </button>
      ))}
    </nav>
  );
}

/** Order-tracker style progress for a booking: Requested, Approved, In use, Done. A refused or cancelled booking shows one stopped step instead. */
export function BookingProgress(props: { status?: string; live?: boolean; past?: boolean }): React.ReactElement {
  const st: string = props.status || 'Pending';
  if (st === 'Cancelled' || st === 'Declined') {
    return <ol className={`${r.track} ${r['track-stop']}`} aria-label={`Booking ${st.toLowerCase()}`}><li data-s="stop"><i aria-hidden="true" /><span>{st}</span></li></ol>;
  }
  const at: number = props.past ? 3 : props.live ? 2 : st === 'Approved' ? 1 : 0;
  return (
    <ol className={r.track} aria-label={`Progress: ${['Requested', 'Approved', 'In use', 'Done'][at]}`}>
      {['Requested', 'Approved', 'In use', 'Done'].map((l, i) => <li key={l} data-s={i < at ? 'done' : i === at ? 'now' : 'todo'} aria-current={i === at ? 'step' : undefined}><i aria-hidden="true" /><span>{l}</span></li>)}
    </ol>
  );
}

/** Counts a number up once on mount (about 600 ms ease-out). Reduced motion or no matchMedia (tests): the final value at once. */
export function useCountUp(target: number): number {
  const [v, setV] = React.useState<number>(target);
  React.useEffect(() => {
    if (!(typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: no-preference)').matches) || target <= 0) { setV(target); return undefined; }
    let raf: number = 0; const t0: number = performance.now();
    const tick = (t: number): void => { const p: number = Math.min(1, (t - t0) / 600); setV(Math.round(target * (1 - Math.pow(1 - p, 3)) * 10) / 10); if (p < 1) { raf = requestAnimationFrame(tick); } };
    setV(0); raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return v;
}

/** A number that counts up once (see useCountUp). */
export function CountUp(props: { value: number }): React.ReactElement { const v: number = useCountUp(props.value); return <>{v}</>; }
