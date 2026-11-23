import * as React from 'react';
import s from './Site.module.scss';
import { NOTICE_CATEGORIES, type IFacility, type INotice, type NoticeCategory } from '../../../avenue/contracts';
import { type AvenueReadSource, sortNotices } from '../../../avenue/readSource';
import { NOTICE_GROUPS, noticeGroup, noticeParagraphs, noticeWhen, type NoticeGroup } from '../../../avenue/ui-helpers';
import { useLoad, useReadIds } from './ui';
import { EquipmentArt } from './EquipmentArt';
import { Sheet } from './Sheet';
import { rise, useReducedMotion } from './motion';

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
// Bodies are plain text: React renders them as text, so markup in a notice is shown, never run. Read state is per device.
export default function NoticesView(props: INoticesViewProps): React.ReactElement {
  const { source, facility } = props;
  const reduced: boolean = useReducedMotion();
  const notices = useLoad<INotice[]>(() => (props.notices ? Promise.resolve(props.notices) : source.listNotices()), [source, props.notices]);
  const [filter, setFilter] = React.useState<Filter>('All');
  const [read, markRead] = useReadIds();
  const [openId, setOpenId] = React.useState<number | undefined>(undefined);
  const close = React.useCallback(() => setOpenId(undefined), []);
  const nowMs: number = Date.now();
  const longDate = (iso: string): string => new Intl.DateTimeFormat('en-US', { timeZone: facility.timeZone, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

  if (notices.error) {
    return <div className={s.container}><div className={s.errorPanel} role="alert"><strong>We could not load notices.</strong><span>Check your connection and try again.</span><button type="button" className={s.btn} onClick={notices.reload}>Try again</button></div></div>;
  }
  if (!notices.data) { return <div className={s.container}><div className={s.skeleton} style={{ height: 240 }} role="status" aria-label="Loading notices" /></div>; }
  const all: INotice[] = sortNotices(notices.data);
  const unread = (n: INotice): boolean => read.indexOf(n.id) < 0;
  const unreadCount: number = all.filter(unread).length;
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
      <div className={s.pageHead}>
        <div className={`${s.container} ${s.headRow}`}>
          <h1 className={s.pageTitle}>Notices</h1>
          {unreadCount > 0 && <button type="button" className={s.linkBtn} onClick={() => mark(all.map(n => n.id))}>Mark all as read ({unreadCount})</button>}
        </div>
      </div>
      <div className={s.container}>
        <div className={s.ntFilters} role="group" aria-label="Filter notices">
          {(['All', 'Unread'] as Filter[]).concat(NOTICE_CATEGORIES).map(c => (
            <button key={c} type="button" className={filter === c ? s.ntFilterOn : ''} aria-pressed={filter === c} onClick={() => setFilter(c)}>
              {c}<b>{countOf(c)}</b>
            </button>
          ))}
        </div>
        {groups.length === 0 ? (
          <div className={s.ntEmpty}><EquipmentArt hint="Prep table" size="md" /><div><strong>{filter === 'All' ? 'No notices right now.' : filter === 'Unread' ? 'You are all caught up.' : `No ${filter.toLowerCase()} notices right now.`}</strong><p>New notices from Flavors appear here, and the bell in the top bar shows how many are unread.</p></div></div>
        ) : groups.map(({ g, items }) => (
          <div key={g} className={s.ntGroup}>
            <h2 className={s.ntGroupHead}>{g}</h2>
            <ul className={s.ntRows}>
              {items.map(n => (
                <li key={n.id} data-notice={n.id} {...rise(index++, reduced, `${unread(n) ? s.ntUnread : ''} ${n.category === 'Urgent' ? s.ntRowUrgent : ''}`)}>
                  <button type="button" className={s.ntRow} onClick={() => open(n)} aria-haspopup="dialog">
                    <span className={s.ntDotCell}>{unread(n) && <span className={s.ntDot} data-testid="unread-dot" role="img" aria-label="Unread" />}</span>
                    <span className={`${s.ntIcon} ${CAT[n.category]}`} aria-hidden="true">{n.category.charAt(0)}</span>
                    <span className={s.ntText}>
                      <strong>{n.title}</strong>
                      <span className={s.ntPreview}>{preview(n.body)}</span>
                    </span>
                    <span className={s.ntSide}>
                      <time dateTime={n.publishedUtc}>{noticeWhen(n.publishedUtc, nowMs, facility.timeZone)}</time>
                      {n.category === 'Urgent' && <span className={`${s.ntTag} ${s.ntUrgent}`}>Urgent</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
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
