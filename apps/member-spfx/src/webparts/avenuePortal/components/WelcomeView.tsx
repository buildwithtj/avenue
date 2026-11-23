import * as React from 'react';
import s from './Site.module.scss';
import type { IMyMembership } from '../../../avenue/contracts';
import type { AvenueReadSource } from '../../../avenue/readSource';

export interface IWelcomeViewProps {
  source: AvenueReadSource;
  userEmail: string;
  /** The member is set up: leave the welcome screen (and start on Documents). */
  onContinue: () => void;
  pollMs?: number;
}

const POLL_TRIES: number = 24;

/** Pure: which steps are done. A membership row only exists once the host saw the payment (a redirect never counts). */
export function welcomeSteps(m: IMyMembership | undefined): { label: string; detail: string; done: boolean }[] {
  const has: boolean = !!m && m.status !== 'Inactive';
  const active: boolean = !!m && m.status === 'Active';
  return [
    { label: 'Payment received', detail: has ? 'Stripe confirmed your payment.' : 'Waiting for Stripe to confirm. Bank payments can take a few days.', done: has },
    { label: 'Portal access', detail: has ? 'You are signed in to Avenue.' : 'Opens once the payment is confirmed.', done: has },
    { label: 'Compliance documents', detail: active ? 'Done.' : 'Upload your permits and insurance next.', done: active },
    { label: 'Approval by Flavors', detail: active ? 'Approved. You can book.' : 'Flavors reviews your account and documents.', done: active }
  ];
}

// Return screen after Stripe checkout: a timeline that fills in as the host and flows write the membership (polls ~2 minutes).
export default function WelcomeView(props: IWelcomeViewProps): React.ReactElement {
  const { source, userEmail, onContinue } = props;
  const pollMs: number = props.pollMs ?? 5000;
  const [m, setM] = React.useState<IMyMembership | undefined>();
  const [tries, setTries] = React.useState<number>(0);
  React.useEffect(() => {
    let live: boolean = true;
    let n: number = 0;
    let timer: number | undefined;
    const tick = (): void => {
      n += 1;
      source.getMyMembership(userEmail).catch(() => undefined).then(r => {
        if (!live) { return; }
        setM(r); setTries(n);
        if ((!r || r.status !== 'Active') && n < POLL_TRIES) { timer = window.setTimeout(tick, pollMs); }
      }, () => undefined);
    };
    tick();
    return () => { live = false; window.clearTimeout(timer); };
  }, [source, userEmail]);
  const steps = welcomeSteps(m);
  const done: number = steps.filter(x => x.done).length;
  return (
    <section className={`${s.cw} ${s.jn}`} aria-label="Welcome">
      <header className={s.cwHead}>
        <div>
          <h2>Welcome to Flavors</h2>
          <p aria-live="polite">{done === steps.length ? 'You are all set.' : m ? 'Payment confirmed. A few steps to go.' : tries >= POLL_TRIES ? 'We have not heard from Stripe yet. We will e-mail you when your access is ready.' : 'Confirming your payment…'}</p>
        </div>
        <div className={s.cwBar} aria-hidden="true"><span style={{ width: `${Math.round((done / steps.length) * 100)}%` }} /></div>
      </header>
      <ol className={s.wlTimeline}>
        {steps.map((x, k) => (
          <li key={x.label} data-done={x.done ? 'true' : 'false'} style={{ ['--i' as string]: k } as React.CSSProperties}>
            <i aria-hidden="true">{x.done ? '✓' : k + 1}</i>
            <div><strong>{x.label}</strong><span>{x.detail}</span></div>
            <span className={s.srOnly}>{x.done ? 'done' : 'not done yet'}</span>
          </li>
        ))}
      </ol>
      {m && <div className={s.cwActions}><button type="button" className={s.cwYes} onClick={onContinue}>{m.status === 'Active' ? 'Go to Avenue' : 'Upload my documents'}</button></div>}
    </section>
  );
}
