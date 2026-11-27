import * as React from 'react';
import { Spinner } from '@fluentui/react';
import styles from './AvenuePortal.module.scss';
import rx from './Ref.module.scss';
import { ModuleCard, StatCard } from './RefUi';
import s from './Site.module.scss';
import type { IFacility, IMyMembership, IMyRequest, IPlan } from '../../../avenue/contracts';
import { type AvenueReadSource, newSubmissionId } from '../../../avenue/readSource';
import { hoursThisMonth } from '../../../avenue/booking';
import { localDay } from '../../../avenue/calendar';
import { formatCents, formatPrice } from '../../../avenue/billing';
import { dueInfo } from '../../../avenue/payments';
import { firstOfNextMonth, memberPlan, planChangeMessage, planChoices, recommendPlan, usageState } from '../../../avenue/plans';
import { Sheet } from './Sheet';
import { Empty, formatDate, LoadError, useLoad } from './ui';

export interface IMembershipViewProps {
  source: AvenueReadSource;
  userEmail: string;
  /** Opens Messages with Flavors after a plan-change request. Optional: without it the success note names the page. */
  onNavigate?: (tab: 'support') => void;
}

interface IMembershipData {
  membership?: IMyMembership;
  facility: IFacility;
  requests: IMyRequest[];
  plans: IPlan[];
}

const money = (cents: number | undefined): string => (cents !== undefined ? formatCents(cents) : 'Not set yet');
const rateText = (p: IPlan): string => (p.extraHourRate !== undefined ? `${formatCents(Math.round(p.extraHourRate * 100))}/h` : 'Not set yet');

// The member's own plan, usage, the plans they may move to and a plan-change request. Hours do not roll over and extra hours
// are billed with the next payment (D5). A plan change is a message to Flavors only: no Stripe object, no host request.
export default function MembershipView(props: IMembershipViewProps): React.ReactElement {
  const { source, userEmail } = props;
  const data = useLoad<IMembershipData>(async () => {
    const [membership, facility, requests, plans] = await Promise.all([
      source.getMyMembership(userEmail).catch(() => undefined),
      source.getFacility(),
      source.listMyRequests(),
      source.listPlans().catch((): IPlan[] => [])
    ]);
    return { membership, facility, requests, plans };
  }, [source, userEmail]);
  const [target, setTarget] = React.useState<IPlan | undefined>();
  const [note, setNote] = React.useState<string>('');
  const [busy, setBusy] = React.useState<boolean>(false);
  const [sendError, setSendError] = React.useState<string | undefined>();
  const [sent, setSent] = React.useState<string | undefined>();

  if (data.error) { return <LoadError error={data.error} what="your membership" onRetry={data.reload} />; }
  if (!data.data) { return <Spinner label="Loading membership" />; }

  const { membership: m, facility, requests, plans } = data.data;
  if (!m) {
    return <Empty>Your membership details appear here once Flavors has set up your account.</Empty>;
  }
  const plan: IPlan | undefined = memberPlan(m, plans);
  const used: number = hoursThisMonth(requests, facility.timeZone, new Date());
  const today: string = localDay(new Date(), facility.timeZone);
  const allowance: number | undefined = plan?.monthlyHours;
  const usage = usageState(used, allowance, plan?.extraHourRate);
  const choices: IPlan[] = plan ? planChoices(plan, plans) : [];
  const recommended: IPlan | undefined = recommendPlan(choices, used);
  const due = m.collectionDay !== undefined ? dueInfo(m.collectionDay, today) : undefined;
  const pct: number = allowance ? Math.min(100, Math.round((used / allowance) * 100)) : 0;

  const send = (): void => {
    if (!plan || !target || busy) { return; }
    setBusy(true); setSendError(undefined);
    source.submitSupportMessage(planChangeMessage(facility.facilityId, plan, target, note), newSubmissionId('msg'))
      .then(() => { setBusy(false); setSent(target.name); setTarget(undefined); setNote(''); })
      .catch(() => { setBusy(false); setSendError('We could not send your request. Check your connection and try again.'); });
  };

  return (
    <div className={styles.stack}>
      <ModuleCard title={m.businessName || 'Not set yet'} ariaLabel="My membership" count={m.status || 'Not set yet'}>{null}</ModuleCard>

      {sent && (
        <div className={s.mbSent} role="status">
          <strong>Plan change request sent.</strong>
          <span>{`You asked to move to ${sent}. Flavors confirms plan changes and when they start; nothing is charged now. Their reply appears in Messages.`}</span>
          {props.onNavigate && <button type="button" className={s.btn} onClick={() => props.onNavigate && props.onNavigate('support')}>Open Messages</button>}
        </div>
      )}

      {plan && (
        <ModuleCard eyebrow="Current plan" title={plan.name} ariaLabel="Current plan" count={plan.priceCents !== undefined ? `${formatPrice(plan.priceCents)}/month` : undefined}>
          <div className={rx['module-stat-grid']}>
            <StatCard icon="clock-3" title={allowance !== undefined ? `${allowance} h` : 'Not set yet'} sub="Hours each month" />
            <StatCard icon="credit-card" title={rateText(plan)} sub="Extra hours" />
            <StatCard icon="calendar-days" title={due ? formatDate(due.dueYmd) : 'Not set yet'} sub="Next collection" />
          </div>
          {plan.priceCents !== undefined && plan.cardPriceCents !== undefined && (
            <p className={s.mbNote} style={{ marginTop: 14 }}>{plan.cardPriceCents === plan.priceCents
              ? 'The card fee is already included in this price.'
              : `Bank (ACH) price. By card or other electronic payment 3% is added: ${formatCents(plan.cardPriceCents)}/month.`}</p>
          )}
        </ModuleCard>
      )}

      <ModuleCard eyebrow="This month" title="Plan hours" ariaLabel="Hours this month">
        <div className={`${s.mbUsage} ${usage.level === 'over' ? s.mbOver : usage.level === 'high' ? s.mbHigh : ''}`}>
          {allowance !== undefined ? (
            <>
              <strong className={s.mbUsed}>{`${used} of ${allowance} h used`}<small>{`Resets on ${formatDate(firstOfNextMonth(today))}`}</small></strong>
              <span className={s.mbMeter} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Plan hours used"><span style={{ width: `${pct}%` }} /></span>
              {usage.level === 'over' && (
                <span className={s.mbOverText}>{`${usage.overHours} h over your plan${plan?.extraHourRate !== undefined ? ` · about ${formatCents(usage.extraCents)} extra so far (estimate, before any card fee)` : ''}. Extra hours are billed with your next payment.`}</span>
              )}
              {usage.level === 'high' && <span>Nearly at your plan hours. Hours do not roll over.</span>}
              {usage.level === 'ok' && <span>Hours do not roll over. An estimate from your approved bookings.</span>}
            </>
          ) : (
            <>
              <strong className={s.mbUsed}>{`${used} h booked this month`}</strong>
              <span>Your plan hours appear once Flavors sets up your plan.</span>
            </>
          )}
        </div>
      </ModuleCard>

      {plan && choices.length > 0 && (
        <ModuleCard title="Compare plans" ariaLabel="Compare plans" count={`${choices.length} plans`}>
          <div className={s.mbCompare}>
            {choices.map(p => {
              const current: boolean = p.planId === plan.planId;
              return (
                <article key={p.planId} className={`${s.mbCard} ${current ? s.mbCardOn : ''}`} aria-label={p.name}>
                  <div className={s.mbBadges}>
                    {current && <span className={s.mbBadge}>Current plan</span>}
                    {!current && recommended && recommended.planId === p.planId && <span className={`${s.mbBadge} ${s.mbBadgeRec}`} title="Smallest plan that covers this month's hours">Recommended</span>}
                  </div>
                  <h3>{p.name}</h3>
                  <div className={s.mbCardPrice}><strong>{money(p.priceCents)}</strong>{p.priceCents !== undefined && <span>/month</span>}</div>
                  <ul>
                    <li>{p.monthlyHours} h each month</li>
                    <li>{`Extra hours ${rateText(p)}`}</li>
                    {p.cardPriceCents !== undefined && p.cardPriceCents !== p.priceCents && <li>{`${formatCents(p.cardPriceCents)} by card (+3%)`}</li>}
                  </ul>
                  {current ? <span className={s.mbYours}>Your plan</span> : <button type="button" className={s.btn} onClick={() => { setTarget(p); setSendError(undefined); }}>Change plan</button>}
                </article>
              );
            })}
          </div>
        </ModuleCard>
      )}

      {plan && target && (
        <Sheet title="Change plan" onClose={() => { if (!busy) { setTarget(undefined); } }} footer={
          <div className={s.row}>
            <button type="button" className={`${s.btn} ${s.btnCitrus}`} disabled={busy} onClick={send}>{busy ? 'Sending…' : 'Send request'}</button>
            <button type="button" className={s.btn} disabled={busy} onClick={() => setTarget(undefined)}>Cancel</button>
          </div>
        }>
          <table className={s.mbTable}>
            <thead><tr><th scope="col"><span className={s.srOnly}>Detail</span></th><th scope="col">Now</th><th scope="col">New</th></tr></thead>
            <tbody>
              <tr><th scope="row">Plan</th><td>{plan.name}</td><td>{target.name}</td></tr>
              <tr><th scope="row">Price</th><td>{money(plan.priceCents)}</td><td>{money(target.priceCents)}</td></tr>
              <tr><th scope="row">Hours</th><td>{plan.monthlyHours ?? '-'} h</td><td>{target.monthlyHours ?? '-'} h</td></tr>
              <tr><th scope="row">Extra hours</th><td>{rateText(plan)}</td><td>{rateText(target)}</td></tr>
            </tbody>
          </table>
          <p className={s.mbNote}>Flavors confirms plan changes and when they start; nothing is charged now.</p>
          <label className={s.mbField}>
            <span>Note for Flavors (optional)</span>
            <textarea rows={3} maxLength={1000} value={note} onChange={e => setNote(e.target.value)} />
          </label>
          {sendError && <p className={s.mbErr} role="alert">{sendError}</p>}
        </Sheet>
      )}
    </div>
  );
}
