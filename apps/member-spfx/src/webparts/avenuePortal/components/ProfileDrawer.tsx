import * as React from 'react';
import s from './Site.module.scss';
import type { IMyDocumentSubmission, IMyFlag, IMyMembership, IMyRequest, DocType } from '../../../avenue/contracts';
import { balanceDueCents } from '../../../avenue/billing';
import { profileModel, type IProfileModel, type IProfileRow } from '../../../avenue/profile';
import { anyReplyWaiting } from '../../../avenue/support';
import { localDay } from '../../../avenue/calendar';
import type { AvenueReadSource } from '../../../avenue/readSource';
import { tabOn } from '../../../avenue/release';
import type { IFeedbackPrefs } from './feedback';
import { alertsSupported, requestAlerts } from './feedback';
import { useReducedMotion } from './motion';
import { useLoad } from './ui';
import { initials } from '../../../avenue/ui-view';
import type { TabKey } from './AvenuePortal';

export interface IProfileDrawerProps {
  open: boolean;
  onClose: () => void;
  source: AvenueReadSource | undefined;
  isDemo: boolean;
  userName: string;
  userEmail: string;
  /** Undefined until the facility has loaded; the summary waits for it (the time zone is never defaulted). */
  timeZone: string | undefined;
  prefs: IFeedbackPrefs;
  setPref: (k: keyof IFeedbackPrefs, v: boolean) => void;
  full: boolean;
  setFull: (v: boolean) => void;
  onNavigate: (tab: TabKey) => void;
  /** Phone: the avatar opens the person's profile only (summary, details, preferences, sign out). Destinations live in the More sheet. */
  profileOnly?: boolean;
}

const EXIT_MS = 220;
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/** Right-edge modal sheet opened from the name pill: account summary, destinations, preferences, sign out (docs/PROFILE_DRAWER_PLAN.md). */
export default function ProfileDrawer(props: IProfileDrawerProps): React.ReactElement | null {
  const { open, onClose } = props;
  const reduced: boolean = useReducedMotion();
  const [mounted, setMounted] = React.useState<boolean>(open);
  const [shown, setShown] = React.useState<boolean>(false);
  const sheet: React.RefObject<HTMLDivElement> = React.useRef<HTMLDivElement>(null);
  const opener: React.MutableRefObject<Element | null> = React.useRef<Element | null>(null);

  // Enter: mount, then flip to "shown" on the next frame so the slide transition runs. Exit: flip, then unmount after the slide.
  React.useEffect(() => {
    if (open) {
      opener.current = document.activeElement;
      setMounted(true);
      const raf: number = window.requestAnimationFrame(() => setShown(true));
      return () => window.cancelAnimationFrame(raf);
    }
    setShown(false);
    const t: number = window.setTimeout(() => { setMounted(false); const o = opener.current as HTMLElement | null; if (o && o.focus) { o.focus(); } }, reduced ? 0 : EXIT_MS);
    return () => window.clearTimeout(t);
  }, [open]);

  React.useEffect(() => {
    if (!mounted) { return undefined; }
    const prev: string = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const key = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab' || !sheet.current) { return; }
      const items: HTMLElement[] = Array.prototype.slice.call(sheet.current.querySelectorAll(FOCUSABLE)).filter((x: HTMLElement) => !x.hasAttribute('hidden'));
      if (items.length === 0) { return; }
      const first: HTMLElement = items[0], last: HTMLElement = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === sheet.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('keydown', key, true); document.body.style.overflow = prev; };
  }, [mounted, onClose]);

  React.useEffect(() => { if (shown && sheet.current) { sheet.current.focus(); } }, [shown]);

  if (!mounted) { return null; }
  return (
    <div className={s.pdRoot} data-open={shown ? 'true' : 'false'}>
      <div className={s.pdScrim} onClick={onClose} aria-hidden="true" />
      <div ref={sheet} className={s.pdSheet} role="dialog" aria-modal="true" aria-labelledby="pd-title" tabIndex={-1}>
        <DrawerBody {...props} />
      </div>
    </div>
  );
}

function Rows(props: { rows: IProfileRow[]; onPick: (r: IProfileRow) => void; start: number }): React.ReactElement {
  return (
    <ul className={s.pdList}>
      {props.rows.map((r, n) => (
        <li key={r.key} style={{ ['--i' as string]: Math.min(props.start + n, 8) } as React.CSSProperties}>
          <button type="button" className={s.pdRow} data-tone={r.tone || 'none'} onClick={() => props.onPick(r)}>
            <span className={s.pdRowMain}><strong>{r.label}</strong>{r.detail && <small>{r.detail}</small>}</span>
            <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M7 4l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Switch(props: { label: string; on: boolean; onChange: () => void }): React.ReactElement {
  return (
    <li>
      <button type="button" role="switch" aria-checked={props.on} className={s.pdSwitch} onClick={props.onChange}>
        <span>{props.label}</span><i aria-hidden="true" data-on={props.on ? 'true' : 'false'} />
      </button>
    </li>
  );
}

function DrawerBody(props: IProfileDrawerProps): React.ReactElement {
  const { source, isDemo, userEmail, onNavigate, onClose } = props;
  const data = useLoad<{ membership?: IMyMembership; requests: IMyRequest[]; documents: IMyDocumentSubmission[]; flags: IMyFlag[]; required: DocType[]; balance: number | 'not-connected'; replyWaiting: boolean } | undefined>(async () => {
    if (!source || !props.timeZone) { return undefined; }
    const [membership, requests, documents, flags, required, balance, replyWaiting] = await Promise.all([
      source.getMyMembership(userEmail).catch(() => undefined),
      source.listMyRequests().catch((): IMyRequest[] => []),
      source.listMyDocuments().catch((): IMyDocumentSubmission[] => []),
      source.listMyFlags().catch((): IMyFlag[] => []),
      source.listRequiredDocTypes().catch((): DocType[] => []),
      source.listMyInvoices(userEmail).then((v): number | 'not-connected' => balanceDueCents(v)).catch((): 'not-connected' => 'not-connected'),
      tabOn('support', isDemo) && typeof source.listMySupportMessages === 'function' ? source.listMySupportMessages().then(anyReplyWaiting).catch(() => false) : Promise.resolve(false)
    ]);
    return { membership, requests, documents, flags, required, balance, replyWaiting };
  }, [source, userEmail, isDemo, props.timeZone]);

  const model: IProfileModel | undefined = React.useMemo(() => data.data && props.timeZone
    ? profileModel({ ...data.data, timeZone: props.timeZone, todayYmd: localDay(new Date(), props.timeZone), now: new Date(), on: t => tabOn(t, isDemo) })
    : undefined, [data.data, props.timeZone]);

  const go = (r: IProfileRow): void => { onClose(); window.setTimeout(() => onNavigate(r.target), 0); };
  const signOut: string = `${window.location.origin}/_layouts/15/SignOut.aspx`;
  const m: IMyMembership | undefined = data.data && data.data.membership;

  return (
    <>
      <header className={s.pdHead}>
        <button type="button" className={s.pdClose} onClick={onClose} aria-label="Close account panel">
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </button>
        <span className={s.pdAvatar} aria-hidden="true">{initials(props.userName)}</span>
        <div>
          <h2 id="pd-title">{props.userName}</h2>
          <p>{isDemo ? 'Demo account' : userEmail}</p>
          {m && <p className={s.pdPlan}>{m.businessName ? `${m.businessName} · ` : ''}{m.status || 'Member'}{m.planName ? ` · ${m.planName}` : ''}</p>}
        </div>
      </header>

      <div className={s.pdScroll}>
        {data.loading && !data.data && <div className={s.pdSkel} role="status" aria-label="Loading your account"><i /><i /><i /></div>}
        {data.error && !data.data && <p className={s.pdNote} role="alert">We could not load your account summary. {data.error}</p>}

        {!props.profileOnly && model && model.attention.length > 0 && (
          <section aria-label="Needs attention" className={s.pdGroup}>
            <h3>Needs attention</h3>
            <Rows rows={model.attention} onPick={go} start={0} />
          </section>
        )}
        {model && model.glance.length > 0 && (
          <section aria-label="At a glance" className={s.pdGroup}>
            <h3>At a glance</h3>
            <dl className={s.pdGlance}>
              {model.glance.map((g, k) => (
                <div key={g.key} data-tone={g.tone || 'none'} style={{ ['--i' as string]: k } as React.CSSProperties}>
                  <dt>{g.label}</dt><dd>{g.value}</dd>{g.note && <small>{g.note}</small>}
                </div>
              ))}
            </dl>
          </section>
        )}
        {!props.profileOnly && model && model.account.length > 0 && (
          <section aria-label="Your account" className={s.pdGroup}>
            <h3>Your account</h3>
            <Rows rows={model.account} onPick={go} start={2} />
          </section>
        )}
        {props.profileOnly && (
          <section aria-label="Your details" className={s.pdGroup}>
            <h3>Your details</h3>
            <dl className={s.pdDetails}>
              <div><dt>Name</dt><dd>{props.userName}</dd></div>
              <div><dt>Sign-in e-mail</dt><dd>{isDemo ? 'Demo account' : userEmail}</dd></div>
              {m && m.businessName && <div><dt>Business</dt><dd>{m.businessName}</dd></div>}
              {m && m.planName && <div><dt>Plan</dt><dd>{m.planName}{m.monthlyHours !== undefined ? ` · ${m.monthlyHours} h a month` : ''}</dd></div>}
              {m && m.status && <div><dt>Status</dt><dd>{m.status}</dd></div>}
            </dl>
          </section>
        )}
        {model && model.onboarding && (
          <section aria-label="Getting started" className={s.pdGroup}>
            <h3>Getting started</h3>
            <div className={s.pdProgress}>
              <span>{model.onboarding.steps.filter(x => x.done).length} of {model.onboarding.steps.length} steps done</span>
              <i aria-hidden="true"><b style={{ width: `${Math.round((model.onboarding.steps.filter(x => x.done).length / model.onboarding.steps.length) * 100)}%` }} /></i>
              <small>{(model.onboarding.steps.filter(x => !x.done)[0] || { detail: '' }).detail}</small>
            </div>
          </section>
        )}

        <section aria-label="Preferences" className={s.pdGroup}>
          <h3>Preferences</h3>
          <ul className={s.pdList}>
            <Switch label="Sounds" on={props.prefs.sound} onChange={() => props.setPref('sound', !props.prefs.sound)} />
            <Switch label="Vibration" on={props.prefs.haptics} onChange={() => props.setPref('haptics', !props.prefs.haptics)} />
            {alertsSupported() && <Switch label="Desktop alerts" on={props.prefs.alerts} onChange={() => { if (props.prefs.alerts) { props.setPref('alerts', false); } else { requestAlerts().then(ok => props.setPref('alerts', ok)).catch(() => undefined); } }} />}
            <Switch label="Full screen" on={props.full} onChange={() => props.setFull(!props.full)} />
          </ul>
        </section>

        {!props.profileOnly && <section aria-label="Help" className={s.pdGroup}>
          <h3>Help</h3>
          {model && model.help.length > 0 && <Rows rows={model.help} onPick={go} start={4} />}
          <button type="button" className={s.pdPolicies} onClick={() => { onClose(); window.setTimeout(() => onNavigate('policies'), 0); }}><strong>Policies and help</strong><span>Booking, cancelling, payments, documents</span></button>
        </section>}

        {!isDemo && <a className={s.pdSignOut} href={signOut}>Sign out</a>}
      </div>
    </>
  );
}
