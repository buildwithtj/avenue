import * as React from 'react';
import s_nm from './Site.module.scss';
import { MessageBar, MessageBarType } from '@fluentui/react';
import styles from './AvenuePortal.module.scss';
import type { BookingStatus, ICalendarEntry } from '../../../avenue/contracts';
import { queryWindow } from '../../../avenue/calendar';
import type { AvenueReadSource } from '../../../avenue/readSource';
import { type IAlert, bookingAlerts, markAlertsSeen, markNoticesRead, readNoticeIds, unseenAlerts } from '../../../avenue/ui-helpers';
import { actionItems } from '../../../avenue/home';
import { localDay } from '../../../avenue/calendar';
import { rise, useReducedMotion } from './motion';

/** "Wed 18 Nov, 9:00 AM – 1:00 PM" in the facility's time zone. */
export function formatWhen(startUtc: string, endUtc: string, timeZone: string): string {
  const day: string = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(startUtc));
  const time = (iso: string): string => new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
  return `${day}, ${time(startUtc)} – ${time(endUtc)}`;
}

/** "18 Nov 2026" for a YYYY-MM-DD date (no time zone involved). */
export function formatDate(ymd: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${ymd}T12:00:00Z`));
}

/** 1 → "1st", 2 → "2nd", 13 → "13th". */
export function ordinal(n: number): string {
  const tens: number = n % 100;
  const suffix: string = tens >= 11 && tens <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th';
  return `${n}${suffix}`;
}

const STATUS_CLASS: Record<BookingStatus, string> = {
  'Pending': styles.badgePending,
  'Approved': styles.badgeApproved,
  'Declined': styles.badgeDeclined,
  'Cancelled': styles.badgeMuted,
  'No-show credited': styles.badgeMuted
};

export function StatusBadge(props: { status?: BookingStatus; label?: string }): React.ReactElement {
  const label: string = props.label || props.status || 'Sent';
  const cls: string = props.status ? STATUS_CLASS[props.status] : styles.badgeMuted;
  return <span className={`${styles.badge} ${cls}`}>{props.status === 'Pending' ? 'Waiting for approval' : label}</span>;
}

export function Section(props: { title: string; description?: string; actions?: React.ReactNode; children: React.ReactNode }): React.ReactElement {
  const reduced: boolean = useReducedMotion();
  return (
    <section {...rise(0, reduced, styles.card)} aria-label={props.title}>
      <div className={styles.cardHeader}>
        <div>
          <h2 className={styles.cardTitle}>{props.title}</h2>
          {props.description && <p className={styles.muted}>{props.description}</p>}
        </div>
        {props.actions && <div className={styles.cardActions}>{props.actions}</div>}
      </div>
      {props.children}
    </section>
  );
}

export function ErrorBar(props: { error?: string; onDismiss?: () => void }): React.ReactElement {
  return props.error ? (
    <MessageBar messageBarType={MessageBarType.error} isMultiline onDismiss={props.onDismiss}>{props.error}</MessageBar>
  ) : <></>;
}

/** A read that failed: one plain sentence and a retry, never the raw SharePoint error text (plan F4). */
export function LoadError(props: { error?: string; what: string; onRetry: () => void }): React.ReactElement {
  return props.error ? (
    <div className={s_nm.errorPanel} role="alert">
      <strong>{`We could not load ${props.what}.`}</strong><span>Check your connection and try again. If it keeps happening, tell the Flavors team.</span>
      <button type="button" className={s_nm.btn} onClick={props.onRetry}>Try again</button>
    </div>
  ) : <></>;
}

export function Empty(props: { children: React.ReactNode }): React.ReactElement {
  return <p className={styles.empty}>{props.children}</p>;
}

/** Shows a plain message instead of a blank web part if any screen throws while rendering. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  public state: { failed: boolean } = { failed: false };
  public static getDerivedStateFromError(): { failed: boolean } { return { failed: true }; }
  public render(): React.ReactNode {
    return this.state.failed
      ? <MessageBar messageBarType={MessageBarType.error}>Avenue hit a problem showing this page. Refresh the page; if it keeps happening, tell Flavors.</MessageBar>
      : this.props.children;
  }
}

/** Loads data with cancellation on unmount and an explicit reload, so screens never show half-loaded data. A failed background reload keeps the data already shown. */
export function useLoad<T>(load: () => Promise<T>, deps: React.DependencyList): { data?: T; error?: string; loading: boolean; reload: () => void } {
  const [state, setState] = React.useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  const [tick, setTick] = React.useState<number>(0);
  React.useEffect(() => {
    let live: boolean = true;
    setState(s => ({ data: s.data, loading: true }));
    load()
      .then(data => { if (live) { setState({ data, loading: false }); } })
      .catch((e: Error) => { if (live) { setState(prev => (prev.data !== undefined ? { data: prev.data, loading: false } : { error: e.message, loading: false })); } });
    return () => { live = false; };
  }, [...deps, tick]);
  return { ...state, reload: () => setTick(t => t + 1) };
}

/**
 * Approved calendar entries around one facility-local day (the day plus one day either side, so bookings that cross
 * midnight are seen). Reloads when the day changes and never throws: a failed read sets `failed` and leaves no entries.
 */
export function useCalendarDay(source: AvenueReadSource, day: string, days: number = 1): { entries: ICalendarEntry[]; ready: boolean; failed: boolean; reload: () => void } {
  const rangeKey: string = `${day}|${days}`;
  const [state, setState] = React.useState<{ rangeKey?: string; entries: ICalendarEntry[]; failed: boolean }>({ entries: [], failed: false });
  const [tick, setTick] = React.useState<number>(0);
  React.useEffect(() => {
    let live: boolean = true;
    const { fromUtc, toUtc } = queryWindow(day, days);
    Promise.resolve().then(() => source.listCalendar(fromUtc, toUtc))
      .then(entries => { if (live) { setState({ rangeKey, entries, failed: false }); } })
      .catch(() => { if (live) { setState({ rangeKey, entries: [], failed: true }); } });
    return () => { live = false; };
  }, [source, day, days, tick]);
  const ready: boolean = state.rangeKey === rangeKey;
  return { entries: ready ? state.entries : [], ready, failed: ready && state.failed, reload: () => setTick(t => t + 1) };
}

export function SkeletonBlock(props: { height?: number; label?: string }): React.ReactElement {
  return <div className={styles.skeleton} style={{ height: props.height || 64 }} role="status" aria-label={props.label || 'Loading'} />;
}

/** Notice read state, shared by every screen: marking a notice read anywhere updates the bell, banner, ribbon and list at once. */
export function useReadIds(): [number[], (ids: number[]) => void] {
  const [ids, setIds] = React.useState<number[]>(() => readNoticeIds());
  React.useEffect(() => {
    const on = (): void => setIds(readNoticeIds());
    window.addEventListener('avenue-notices-read', on);
    return () => window.removeEventListener('avenue-notices-read', on);
  }, []);
  const mark = (add: number[]): void => { setIds(markNoticesRead(add)); window.dispatchEvent(new Event('avenue-notices-read')); };
  return [ids, mark];
}

/**
 * The member's alerts: booking decisions (confirmed, declined, cancelled, extra time) and items that need them (documents).
 * Reads their own requests and documents every minute and when the tab regains focus. Returns only alerts not yet seen.
 */
export function useAlerts(source: AvenueReadSource | undefined, tz: string | undefined, enabled: boolean): { alerts: IAlert[]; markSeen: (keys: string[]) => void } {
  const [alerts, setAlerts] = React.useState<IAlert[]>([]);
  const refresh = React.useCallback(() => {
    if (!source || !tz || !enabled) { return; }
    Promise.all([source.listMyRequests().catch(() => undefined), source.listMyDocuments().catch(() => undefined), source.listMyFlags().catch(() => undefined)]).then(([reqs, docs, flg]) => {
      if (!reqs) { return; }
      const all: IAlert[] = bookingAlerts(reqs, r => formatWhen(r.startUtc, r.endUtc, tz), Date.now());
      actionItems(docs || [], reqs, localDay(new Date(), tz), flg || []).forEach(i => { if (i.target === 'documents') { all.push({ key: `attn|${i.key}`, tone: i.kind === 'document-expired' || i.kind === 'compliance-hold' ? 'bad' : 'info', title: i.title, text: i.howTo, target: 'documents' }); } });
      setAlerts(unseenAlerts(all));
    }).catch(() => undefined);
  }, [source, tz, enabled]);
  React.useEffect(() => {
    refresh();
    const id: number = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    window.addEventListener('avenue-notices-read', refresh);
    return () => { window.clearInterval(id); window.removeEventListener('focus', refresh); window.removeEventListener('avenue-notices-read', refresh); };
  }, [refresh]);
  const markSeen = (keys: string[]): void => { markAlertsSeen(keys); setAlerts(a => a.filter(x => keys.indexOf(x.key) < 0)); };
  return { alerts, markSeen };
}

/** What happened to a request the member sent: the echoed outcome and, when staff wrote one, their reply (display only). */
export function RequestStatus(props: { outcome?: string; reply?: string }): React.ReactElement {
  return (
    <>
      <p className={s_nm.nmOutcome}>{props.outcome || 'Waiting for Flavors.'}</p>
      {props.reply && props.reply.trim() && <blockquote className={s_nm.nmReply}><strong>Reply from Flavors</strong><span>{props.reply}</span></blockquote>}
    </>
  );
}
