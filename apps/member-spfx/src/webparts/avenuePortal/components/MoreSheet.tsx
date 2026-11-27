import * as React from 'react';
import s from './Site.module.scss';
import { tabOn } from '../../../avenue/release';
import type { TabKey } from './AvenuePortal';
import { useReducedMotion } from './motion';
import { RefIcon } from './RefUi';

export interface IMoreSheetProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (t: TabKey) => void;
  isDemo: boolean;
  /** Unread badge per destination (Notices, Messages ...). */
  badges: Partial<Record<TabKey, number>>;
}

interface IDest { key: TabKey; label: string; hint: string; icon: string; tone: 'teal' | 'gold' | 'slate' | 'rose' | 'sky' }

/** Everything that is not one of the four main tabs. Same tab keys and tabOn gating as the sidebar. */
const DESTS: IDest[] = [
  { key: 'checkin', label: 'Check in', hint: 'Entry and exit checklists, and team wellness', icon: 'clipboard-check', tone: 'teal' },
  { key: 'membership', label: 'Membership', hint: 'Your plan and hours', icon: 'id-card', tone: 'gold' },
  { key: 'billing', label: 'Billing', hint: 'Invoices and payments', icon: 'credit-card', tone: 'sky' },
  { key: 'documents', label: 'Documents', hint: 'Permits and insurance', icon: 'file-text', tone: 'rose' },
  { key: 'notices', label: 'Notices', hint: 'News and schedule changes', icon: 'bell', tone: 'gold' },
  { key: 'support', label: 'Messages', hint: 'Ask a question or report a problem', icon: 'message-square', tone: 'teal' },
  { key: 'events', label: 'Events', hint: 'Book the dining room for a private event', icon: 'sparkles', tone: 'slate' },
  { key: 'storage', label: 'Storage', hint: 'Fridge, freezer and dry storage on request', icon: 'archive', tone: 'sky' },
  { key: 'team', label: 'My team', hint: 'Names for the wellness check', icon: 'users', tone: 'teal' },
  { key: 'policies', label: 'Policies and help', hint: 'How things work', icon: 'shield-check', tone: 'slate' }
];

const EXIT_MS = 260;
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** The bottom "More" sheet: a grid of destinations, nothing about the person (that is the Profile). Slides up, closes on the scrim, Escape or a down-drag. */
export default function MoreSheet(props: IMoreSheetProps): React.ReactElement | null {
  const { open, onClose } = props;
  const reduced: boolean = useReducedMotion();
  const [mounted, setMounted] = React.useState<boolean>(open);
  const [shown, setShown] = React.useState<boolean>(false);
  const sheet: React.RefObject<HTMLDivElement> = React.useRef<HTMLDivElement>(null);
  const opener: React.MutableRefObject<Element | null> = React.useRef<Element | null>(null);
  const drag: React.MutableRefObject<{ y: number; dy: number; t: number; v: number } | undefined> = React.useRef<{ y: number; dy: number; t: number; v: number } | undefined>(undefined);

  React.useEffect(() => {
    if (open) {
      opener.current = document.activeElement; setMounted(true);
      const raf: number = window.requestAnimationFrame(() => window.requestAnimationFrame(() => setShown(true)));
      return () => window.cancelAnimationFrame(raf);
    }
    setShown(false);
    const t: number = window.setTimeout(() => { setMounted(false); const o = opener.current as HTMLElement | null; if (o && o.focus) { o.focus(); } }, reduced ? 0 : EXIT_MS);
    return () => window.clearTimeout(t);
  }, [open]);

  React.useEffect(() => {
    if (!mounted) { return undefined; }
    const key = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab' || !sheet.current) { return; }
      const items: HTMLElement[] = Array.prototype.slice.call(sheet.current.querySelectorAll(FOCUSABLE));
      if (items.length === 0) { return; }
      const first: HTMLElement = items[0], last: HTMLElement = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', key, true);
    return () => document.removeEventListener('keydown', key, true);
  }, [mounted, onClose]);
  React.useEffect(() => { if (shown && sheet.current) { sheet.current.focus(); } }, [shown]);

  if (!mounted) { return null; }
  const items: IDest[] = DESTS.filter(d => tabOn(d.key, props.isDemo));
  const onDown = (e: React.PointerEvent<HTMLElement>): void => { drag.current = { y: e.clientY, dy: 0, t: performance.now(), v: 0 }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); };
  const onMove = (e: React.PointerEvent<HTMLElement>): void => {
    const d = drag.current; if (!d || !sheet.current) { return; }
    // 1:1 with the finger going down; going up is rubber-banded (a fraction of the distance). Velocity is kept for the release.
    const raw: number = e.clientY - d.y; const now: number = performance.now();
    d.v = (raw - d.dy) / Math.max(1, now - d.t); d.t = now; d.dy = raw;
    sheet.current.style.transform = `translate3d(0, ${raw >= 0 ? raw : raw * 0.2}px, 0)`; sheet.current.style.transition = 'none';
  };
  const onUp = (): void => {
    const d = drag.current; drag.current = undefined;
    if (!sheet.current) { return; }
    sheet.current.style.transition = ''; sheet.current.style.transform = '';
    // Dismiss on distance OR a fast flick; otherwise snap back quickly.
    if (d && (d.dy > 90 || d.v > 0.5)) { onClose(); }
  };
  return (
    <div className={s.moreRoot} data-open={shown ? 'true' : 'false'}>
      <div className={s.moreScrim} onClick={onClose} aria-hidden="true" />
      <div ref={sheet} className={s.moreSheet} role="dialog" data-lenis-prevent="" aria-modal="true" aria-labelledby="more-title" tabIndex={-1}>
        <div className={s.moreGrab} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} aria-hidden="true"><i /></div>
        <header className={s.moreHead}><h2 id="more-title">More</h2><button type="button" className={s.moreClose} onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg></button></header>
        <ul className={s.moreGrid}>
          {items.map((d, i) => {
            const n: number = props.badges[d.key] || 0;
            return (
              <li key={d.key} style={{ ['--i' as string]: i } as React.CSSProperties}>
                <button type="button" className={s.moreTile} data-tone={d.tone} onClick={() => { onClose(); window.setTimeout(() => props.onNavigate(d.key), 0); }}>
                  <span className={s.moreIcon}><RefIcon name={d.icon} size={22} />{n > 0 && <b aria-label={`${n} new`}>{n > 9 ? '9+' : n}</b>}</span>
                  <strong>{d.label}</strong><small>{d.hint}</small>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
