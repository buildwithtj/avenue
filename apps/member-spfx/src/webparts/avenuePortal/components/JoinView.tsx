import * as React from 'react';
import s from './Site.module.scss';
import type { IMyHostRequest, IPlan, PayMethod, PlanGroup } from '../../../avenue/contracts';
import { firstPaymentPreview, type IJoinInput, joinErrors, planPriceCents, stepErrors, toJoinPayload } from '../../../avenue/join';
import { formatCents, formatPrice, PAYMENTS_TEST_MODE, safeLink, STRIPE_HOSTS, TEST_MODE_NOTE } from '../../../avenue/billing';
import { type AvenueReadSource, newSubmissionId } from '../../../avenue/readSource';
import { formatDate, ordinal, useLoad } from './ui';
import { useReducedMotion } from './motion';

export interface IJoinViewProps {
  source: AvenueReadSource;
  /** Facility-local YYYY-MM-DD. */
  today: string;
  /** Opens Stripe's checkout page. Injected for tests; defaults to a full-page navigation. */
  navigate?: (url: string) => void;
  pollMs?: number;
  /** Payments are mocked (pilot preview, STR-06): the pay button calls this instead of asking for a Stripe page. */
  onMockPay?: () => void;
}

const STEPS: string[] = ['Plan', 'Business', 'Payment day', 'Review and pay'];
const GROUPS: PlanGroup[] = ['Emerging', 'Mobile Kitchen'];
const POLL_TRIES: number = 30;
const DAY_MS: number = 24 * 60 * 60 * 1000;

/** A payment link the member already asked for in the last 24 hours and has not been refused. */
function pendingLink(list: IMyHostRequest[], nowMs: number): string | undefined {
  const r: IMyHostRequest | undefined = list.filter(x => x.kind === 'Join')[0];
  if (!r || (r.outcome || '').indexOf('Refused') === 0 || !r.createdUtc || nowMs - Date.parse(r.createdUtc) > DAY_MS) { return undefined; }
  return safeLink(r.link, STRIPE_HOSTS.checkout);
}

// Four steps, then Stripe's own payment page (ONB-01..03). The member never types card or bank details into Avenue.
// The request goes to AvenueHostRequests; a flow adds who sent it and the host answers with a checkout link.
export default function JoinView(props: IJoinViewProps): React.ReactElement {
  const { source, today } = props;
  const navigate = props.navigate || ((url: string) => window.location.assign(url));
  const pollMs: number = props.pollMs ?? 2000;
  const reduced: boolean = useReducedMotion();
  const plans = useLoad<IPlan[]>(() => source.listPlans(), [source]);
  const mine = useLoad<IMyHostRequest[]>(() => source.listMyHostRequests().catch((): IMyHostRequest[] => []), [source]);
  const [step, setStep] = React.useState<number>(0);
  const [dir, setDir] = React.useState<1 | -1>(1);
  const [group, setGroup] = React.useState<PlanGroup>('Emerging');
  const [input, setInput] = React.useState<IJoinInput>({ planId: '', businessName: '', contactName: '', phone: '', teamSize: 1, collectionDay: 1, payMethod: '' });
  const [shown, setShown] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState<boolean>(false);
  const [outcome, setOutcome] = React.useState<string | undefined>();
  const heading = React.useRef<HTMLHeadingElement>(null);
  const live = React.useRef<boolean>(true);
  React.useEffect(() => () => { live.current = false; }, []);
  const moved = React.useRef<boolean>(false);
  React.useEffect(() => { if (moved.current && heading.current) { heading.current.focus(); } moved.current = true; }, [step]);

  const list: IPlan[] = plans.data || [];
  const plan: IPlan | undefined = list.filter(p => p.planId === input.planId)[0];
  const set = <K extends keyof IJoinInput>(k: K, v: IJoinInput[K]): void => { setInput(x => ({ ...x, [k]: v })); setShown([]); };
  const go = (n: number): void => {
    if (n > step) {
      const errs: string[] = stepErrors(step, input, list);
      if (errs.length > 0) { setShown(errs); return; }
    }
    setShown([]); setOutcome(undefined); setDir(n >= step ? 1 : -1); setStep(Math.max(0, Math.min(STEPS.length - 1, n)));
  };

  const send = (): void => {
    if (busy) { return; }
    const e = joinErrors(input, list);
    const msgs: string[] = Object.keys(e).map(k => e[k as keyof IJoinInput] as string);
    if (msgs.length > 0) { setShown(msgs); return; }
    if (props.onMockPay) { props.onMockPay(); return; }
    const id: string = newSubmissionId('join');
    setBusy(true); setOutcome(undefined);
    let tries: number = 0;
    const poll = (): void => {
      tries += 1;
      source.listMyHostRequests().then(rs => {
        if (!live.current) { return; }
        const r: IMyHostRequest | undefined = rs.filter(x => x.requestId === id)[0];
        const url: string | undefined = r ? safeLink(r.link, STRIPE_HOSTS.checkout) : undefined;
        if (url) { navigate(url); return; }
        if (r && (r.outcome || r.link)) { setBusy(false); setOutcome(r.outcome || 'The payment page could not be opened. Please try again.'); return; }
        if (tries < POLL_TRIES) { window.setTimeout(poll, pollMs); } else { setBusy(false); setOutcome('Your payment page is still being prepared. Press "Continue to secure payment" again in a minute.'); }
      }).catch(() => { if (live.current && tries < POLL_TRIES) { window.setTimeout(poll, pollMs); } });
    };
    source.submitHostRequest('Join', toJoinPayload(input), id)
      .then(() => { if (live.current) { window.setTimeout(poll, pollMs); } })
      .catch((err: Error) => { setBusy(false); setOutcome(err.message); });
  };

  const price: number | undefined = plan ? planPriceCents(plan, input.payMethod || 'Card') : undefined;
  const preview = price !== undefined ? firstPaymentPreview(price, input.collectionDay, today) : undefined;
  const resume: string | undefined = mine.data ? pendingLink(mine.data, Date.now()) : undefined;
  const animCls: string = reduced ? s.jnFade : dir === 1 ? s.cwInFwd : s.cwInBack;

  return (
    <section className={`${s.cw} ${s.jn}`} aria-label="Join Flavors">
      <header className={s.cwHead}>
        <div>
          <h2>Become a member</h2>
          <p>Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>
        </div>
        <ol className={s.jnRail} aria-hidden="true">
          {STEPS.map((t, k) => <li key={t} data-state={k < step ? 'done' : k === step ? 'on' : 'todo'}><i>{k < step ? '✓' : k + 1}</i><span>{t}</span></li>)}
        </ol>
      </header>

      {resume && step === 0 && !props.onMockPay && (
        <div className={s.jnResume} role="status">
          <span>You already started joining. Your secure payment page is ready.</span>
          <button type="button" className={s.cwYes} onClick={() => navigate(resume)}>Continue to payment</button>
        </div>
      )}

      <div className={s.cwStage}>
        <div key={step} className={`${s.cwCard} ${animCls}`}>
          {step === 0 && (
            <>
              <span className={s.cwEyebrow}>Choose your plan</span>
              <h3 ref={heading} tabIndex={-1}>Which plan fits your kitchen time?</h3>
              <div className={s.jnSegs} role="tablist" aria-label="Plan type">
                {GROUPS.map(g => <button key={g} type="button" role="tab" aria-selected={group === g} className={`${s.jnSeg} ${group === g ? s.jnSegOn : ''}`} onClick={() => setGroup(g)}>{g}</button>)}
              </div>
              {plans.error && <p className={s.cwErr} role="alert">Plans could not be loaded. {plans.error}</p>}
              {!plans.data && !plans.error && <p className={s.cwHelp} role="status">Loading plans…</p>}
              <div className={s.jnPlans} role="radiogroup" aria-label={`${group} plans`}>
                {list.filter(p => p.group === group).map(p => {
                  const on: boolean = p.planId === input.planId;
                  return (
                    <button key={p.planId} type="button" role="radio" aria-checked={on} className={`${s.jnPlan} ${on ? s.jnPlanOn : ''}`} onClick={() => set('planId', p.planId)}>
                      {on && <i className={s.jnCheck} aria-hidden="true">✓</i>}
                      <strong>{p.name}</strong>
                      <b>{p.priceCents !== undefined ? formatPrice(p.priceCents) : 'Price on request'}<small>/month</small></b>
                      <span>{p.monthlyHours !== undefined ? `${p.monthlyHours} hours a month` : 'Hours set by Flavors'}</span>
                      {p.extraHourRate !== undefined && <span>Extra hours ${p.extraHourRate}/h</span>}
                    </button>
                  );
                })}
              </div>
              <p className={s.cwHelp}>Bank payments are at this price; card payments add 3%. Hours reset on the 1st and do not roll over.</p>
            </>
          )}
          {step === 1 && (
            <>
              <span className={s.cwEyebrow}>Your business</span>
              <h3 ref={heading} tabIndex={-1}>Tell us about your business</h3>
              <div className={s.cwForm}>
                <label className={s.cwWide}>Business name<input value={input.businessName} maxLength={120} autoComplete="organization" onChange={e => set('businessName', e.target.value)} /></label>
                <label>Contact person<input value={input.contactName} maxLength={120} autoComplete="name" onChange={e => set('contactName', e.target.value)} /></label>
                <label>Phone<input value={input.phone} maxLength={24} type="tel" autoComplete="tel" onChange={e => set('phone', e.target.value)} /></label>
                <label>People on your team<input value={String(input.teamSize)} type="number" min={1} max={50} onChange={e => set('teamSize', Number(e.target.value))} /></label>
              </div>
              <p className={s.cwHelp}>We use your sign-in e-mail.</p>
            </>
          )}
          {step === 2 && (
            <>
              <span className={s.cwEyebrow}>Monthly payment day</span>
              <h3 ref={heading} tabIndex={-1}>Which day of the month should we collect?</h3>
              <div className={s.jnDays} role="radiogroup" aria-label="Payment day">
                {Array.from({ length: 15 }, (_x, k) => k + 1).map(d => (
                  <button key={d} type="button" role="radio" aria-checked={input.collectionDay === d} aria-label={`${ordinal(d)} of the month`} className={`${s.jnDay} ${input.collectionDay === d ? s.jnDayOn : ''}`} onClick={() => set('collectionDay', d)}>{d}</button>
                ))}
              </div>
              {preview && <p className={s.jnDates}>Next charges: {preview.charges.map(formatDate).join(' · ')}</p>}
            </>
          )}
          {step === 3 && (
            <>
              <span className={s.cwEyebrow}>Review and pay</span>
              <h3 ref={heading} tabIndex={-1}>How would you like to pay?</h3>
              <div className={s.jnMethods} role="radiogroup" aria-label="Payment method">
                {(['Bank', 'Card'] as PayMethod[]).map(m => {
                  const c: number | undefined = plan ? planPriceCents(plan, m) : undefined;
                  return (
                    <button key={m} type="button" role="radio" aria-checked={input.payMethod === m} className={`${s.jnPlan} ${input.payMethod === m ? s.jnPlanOn : ''}`} onClick={() => set('payMethod', m)}>
                      {input.payMethod === m && <i className={s.jnCheck} aria-hidden="true">✓</i>}
                      <strong>{m === 'Bank' ? 'Bank account (ACH)' : 'Card, Apple Pay or Google Pay'}</strong>
                      <b>{c !== undefined ? formatPrice(c) : '-'}<small>/month</small></b>
                      <span>{m === 'Bank' ? 'No processing fee.' : plan && plan.cardPriceCents === plan.priceCents ? 'Fee already included.' : 'Includes a 3% card processing fee.'}</span>
                    </button>
                  );
                })}
              </div>
              {plan && (
                <dl className={s.jnSum}>
                  <div><dt>Plan</dt><dd>{plan.name}{plan.monthlyHours !== undefined ? ` · ${plan.monthlyHours} h a month` : ''}</dd></div>
                  <div><dt>Business</dt><dd>{input.businessName.trim()}</dd></div>
                  <div><dt>Payment day</dt><dd>{ordinal(input.collectionDay)} of each month</dd></div>
                  {input.payMethod === 'Card' && price !== undefined && plan.priceCents !== undefined && price > plan.priceCents && <div><dt>Card fee (3%)</dt><dd>{formatCents(price - plan.priceCents)} a month</dd></div>}
                  {preview && input.payMethod && <div className={s.jnTotal}><dt>Due today (estimate)</dt><dd>{formatCents(preview.prorationCents)}</dd></div>}
                  {preview && input.payMethod && price !== undefined && <div><dt>Then</dt><dd>{formatCents(price)} on {formatDate(preview.anchorYmd)} and the {ordinal(input.collectionDay)} of every month</dd></div>}
                </dl>
              )}
              {props.onMockPay
                ? <p className={s.jnNote} role="status">{TEST_MODE_NOTE}. The button below takes you straight into Avenue.</p>
                : <>{PAYMENTS_TEST_MODE && <p className={s.testPill} role="note">{TEST_MODE_NOTE}</p>}<p className={s.cwHelp}>Today you pay for the days up to your first payment day; Stripe shows the exact amount before you confirm. {input.payMethod === 'Card' ? 'The 3% card fee is shown on Stripe\'s page before you pay.' : ''} Payment opens on Stripe&apos;s secure page; Avenue never sees your card or bank details.</p></>}
            </>
          )}

          {shown.length > 0 && <ul className={s.cwErr} role="alert">{shown.map(m => <li key={m}>{m}</li>)}</ul>}
          {outcome && <p className={(outcome.indexOf('Refused') === 0 ? s.cwErr : s.jnNote)} role="status">{outcome}</p>}
        </div>
      </div>

      <footer className={s.cwNav}>
        <button type="button" className={s.cwSkip} disabled={step === 0 || busy} onClick={() => go(step - 1)}>Back</button>
        {step < STEPS.length - 1
          ? <button type="button" className={s.cwYes} onClick={() => go(step + 1)}>Next</button>
          : <button type="button" className={s.cwYes} disabled={busy} onClick={send}>{props.onMockPay ? 'Pay and continue to Avenue' : busy ? 'Preparing secure payment…' : 'Continue to secure payment'}</button>}
      </footer>
    </section>
  );
}
