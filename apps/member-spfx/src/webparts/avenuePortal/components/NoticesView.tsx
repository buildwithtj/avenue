import * as React from 'react';
import s from './Site.module.scss';
import { NOTICE_CATEGORIES, type IFacility, type INotice, type NoticeCategory } from '../../../avenue/contracts';
import { type AvenueReadSource, sortNotices } from '../../../avenue/readSource';
import { NOTICE_GROUPS, isRecentNotice, noticeExpiryLabel, noticeGroup, noticeParagraphs, noticeWhen, type NoticeGroup } from '../../../avenue/ui-helpers';
import { useLoad, useReadIds } from './ui';
import { Sheet } from './Sheet';
import { rise, useReducedMotion } from './motion';
import r from './Ref.module.scss';
import { EmptyState, ModuleCard, PageHead, Tabs } from './RefUi';

export interface INoticesViewProps {
  source: AvenueReadSource;
  facility: IFacility;
  /** Notices already loaded by the shell (avoids a second read). */
  notices?: INotice[];
  onRead?: () => void;
}

type Filter = NoticeCategory | 'All' | 'Unread';
const CAT: Record<NoticeCategory, string> = { General: s.ntGeneral, Maintenance: s.ntMaintenance, Schedule: s.ntSchedule, Urgent: s.ntUrgent };
const preview = (body: string): string => noticeParagraphs(body).join(' ');

// Notices from Flavors as a notification list (plan phase 2): dense rows grouped Pinned / Today / This week / Earlier,
// unread dot, category icon, one-line preview, short time; the full notice opens in the drawer and is marked read.
// Tabs: Recent (published in the last 7 days) and All; read notices stay listed, dimmed. Bodies are plain text: React renders
// them as text, so markup in a notice is shown, never run. Read state: this browser plus [PROPOSED] AvenueNoticeReads.
export default function NoticesView(props: INoticesViewProps): React.ReactElement {
  const { source, facility } = props;
  const reduced: boolean = useReducedMotion();
  const notices = useLoad<INotice[]>(() => (props.notices ? Promise.resolve(props.notices) : source.listNotices()), [source, props.notices]);
  const [filter, setFilter] = React.useState<Filter>('All');
  // Opens on Recent when it has anything, else All, so the page never opens on an empty tab.
  const [tab, setTab] = React.useState<'Recent' | 'All' | undefined>(undefined);
  const [read, markRead] = useReadIds(source);
  const [openId, setOpenId] = React.useState<number | undefined>(undefined);
  const close = React.useCallback(() => setOpenId(undefined), []);
  const nowMs: number = Date.now();
  const longDate = (iso: string): string => new Intl.DateTimeFormat('en-US', { timeZone: facility.timeZone, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

  if (notices.error) {
    return <div className={s.container}><div className={s.errorPanel} role="alert"><strong>We could not load notices.</strong><span>Check your connection and try again.</span><button type="button" className={s.btn} onClick={notices.reload}>Try again</button></div></div>;
  }
  if (!notices.data) { return <div className={s.container}><div className={s.skeleton} style={{ height: 240 }} role="status" aria-label="Loading notices" /></div>; }
  const recent: INotice[] = sortNotices(notices.data).filter(n => isRecentNotice(n, nowMs));
  const shown: 'Recent' | 'All' = tab || (recent.length > 0 ? 'Recent' : 'All');
  const all: INotice[] = shown === 'Recent' ? recent : sortNotices(notices.data);
  const unread = (n: INotice): boolean => read.indexOf(n.id) < 0;
  const unreadCount: number = all.filter(unread).length;
  const totalUnread: INotice[] = notices.data.filter(unread);
  const list: INotice[] = filter === 'All' ? all : filter === 'Unread' ? all.filter(unread) : all.filter(n => n.category === filter);
  const mark = (ids: number[]): void => { markRead(ids); if (props.onRead) { props.onRead(); } };
  const open = (n: INotice): void => { setOpenId(n.id); if (unread(n)) { mark([n.id]); } };
  const countOf = (c: Filter): number => (c === 'All' ? all.length : c === 'Unread' ? unreadCount : all.filter(n => n.category === c).length);
  const groups: { g: NoticeGroup; items: INotice[] }[] = NOTICE_GROUPS
    .map(g => ({ g, items: list.filter(n => noticeGroup(n, nowMs, facility.timeZone) === g) }))
    .filter(x => x.items.length > 0);
  const opened: INotice | undefined = all.filter(n => n.id === openId)[0];
  let index: number = 0;

  return (
    <section aria-label="Notices" className={s.nt}>
      <PageHead
        eyebrow={props.facility.title}
        title="Notices"
        lede={`News and updates from ${props.facility.title}.`}
        action={totalUnread.length > 0 ? <button type="button" className={r['secondary-button']} onClick={() => mark(totalUnread.map(n => n.id))}>Mark all as read ({totalUnread.length})</button> : undefined}
      />
      <ModuleCard eyebrow={props.facility.title} title="Notices" count={`${all.length} ${shown === 'Recent' ? 'in the last 7 days' : 'total'}`}>
        <Tabs<'Recent' | 'All'> label="Show notices" value={shown} items={[{ key: 'Recent', label: 'Recent' }, { key: 'All', label: 'All' }]} onChange={setTab} />
        <div className={s.ntFilters} role="group" aria-label="Filter notices">
          {(['All', 'Unread'] as Filter[]).concat(NOTICE_CATEGORIES).map(c => (
            <button key={c} type="button" className={filter === c ? s.ntFilterOn : ''} aria-pressed={filter === c} onClick={() => setFilter(c)}>
              {c}<b>{countOf(c)}</b>
            </button>
          ))}
        </div>
        {groups.length === 0 ? (
          <EmptyState icon="bell" title={filter === 'All' ? (shown === 'Recent' ? 'No notices in the last 7 days.' : 'No notices right now.') : filter === 'Unread' ? 'You are all caught up.' : `No ${filter.toLowerCase()} notices.`} sub={shown === 'Recent' ? 'Older notices are under All.' : 'Flavors posts news and schedule changes here.'} />
        ) : groups.map(({ g, items }) => (
          <div key={`${shown}-${g}`} className={`${s.ntGroup} ${s.pane}`} data-dir={shown === 'All' ? 'fwd' : 'back'}>
            <h3 className={r['module-sub']}>{g}</h3>
            <ul className={`${s.ntRows} ${r['module-booking-list']}`}>
              {items.map(n => (
                <li key={n.id} data-notice={n.id} {...rise(index++, reduced, `${unread(n) ? s.ntUnread : s.ntRead} ${n.category === 'Urgent' ? s.ntRowUrgent : ''}`)}>
                  <button type="button" className={`${r['module-row']} ${r['module-row-btn']}`} onClick={() => open(n)} aria-haspopup="dialog">
                    <span className={`${r['tenant-avatar']} ${n.category === 'Urgent' ? r.gold : r.teal}`} aria-hidden="true">{n.category.charAt(0)}</span>
                    <span className={r['module-row-copy']}>
                      <strong>{unread(n) && <span className={s.ntDot} data-testid="unread-dot" role="img" aria-label="Unread" />}{n.title}</strong>
                      <span>{preview(n.body)}</span>
                    </span>
                    <time className={r['module-row-time']} dateTime={n.publishedUtc}>{noticeWhen(n.publishedUtc, nowMs, facility.timeZone)}</time>
                    {n.category === 'Urgent' && <span className={`${r['module-status']} ${r['is-bad']}`}>Urgent</span>}
                    {noticeExpiryLabel(n, nowMs) && <span className={`${r['module-status']} ${r['is-pending']}`}>{noticeExpiryLabel(n, nowMs)}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </ModuleCard>
      {opened && (
        <Sheet title={opened.title} onClose={close}>
          <div className={s.ntMeta}>
            <span className={`${s.ntTag} ${CAT[opened.category]}`}><i aria-hidden="true" />{opened.category}</span>
            {opened.pinned && <span className={s.ntTag}>Pinned</span>}
            <time dateTime={opened.publishedUtc}>{longDate(opened.publishedUtc)}</time>
          </div>
          <div className={s.ntBody}>{noticeParagraphs(opened.body).map((p, i) => <p key={i}>{p}</p>)}</div>
        </Sheet>
      )}
    </section>
  );
}
