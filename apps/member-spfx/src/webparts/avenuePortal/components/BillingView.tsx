import * as React from 'react';
import styles from './AvenuePortal.module.scss';
import {
  formatCents,
  balanceDueCents,
  invoiceChip,
  isOverdue,
  safeLink,
  sortInvoices,
  STRIPE_HOSTS,
  toInvoiceRow,
  IInvoice,
  InvoiceChip,
  PAYMENTS_TEST_MODE,
  TEST_MODE_NOTE
} from '../../../avenue/billing';
import { dueInfo, paymentEstimate } from '../../../avenue/payments';
import { hoursThisMonth } from '../../../avenue/booking';
import { localDay } from '../../../avenue/calendar';
import type { IMyMembership, IMyRequest, IPlan } from '../../../avenue/contracts';
import { extraHourLines, memberPlan, usageState } from '../../../avenue/plans';
import { type AvenueReadSource, newSubmissionId } from '../../../avenue/readSource';
import { useCountUp, useReducedMotion } from './motion';
import { Sheet } from './Sheet';
import s from './Site.module.scss';
import rx from './Ref.module.scss';
import { ModuleRow } from './RefUi';
import { Empty, formatDate, LoadError, Section, useLoad } from './ui';

export interface IBillingViewProps {
  isDemo: boolean;
  source: AvenueReadSource;
  userEmail: string;
  timeZone: string;
  /** Opens a Stripe page in a new tab. Injected for tests. */
  openUrl?: (url: string) => void;
  pollMs?: number;
  /** Payments are mocked (pilot preview): Manage payment method explains instead of asking for a Stripe page. */
  mockPayments?: boolean;
}

/** Balance card: counts up to what is owed, or draws a check when everything is paid. */
function Balance(props: { cents: number; openCount: number }): React.ReactElement {
  const reduced: boolean = useReducedMotion();
  const shown: number = useCountUp(props.cents, reduced, 600);
  if (props.cents <= 0) {
    return (
      <div className={`${s.blBalance} ${s.blPaid}`} role="status">
        <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true"><circle cx="20" cy="20" r="18" /><path d="M12 21l6 6 11-13" /></svg>
        <div><strong>All paid</strong><span>Nothing is owed right now.</span></div>
      </div>
    );
  }
  return (
    <div className={s.blBalance} role="status">
      <div><span>Balance due</span><strong aria-label={formatCents(props.cents)}>{formatCents(Math.round(shown))}</strong><span>{props.openCount} open invoice{props.openCount === 1 ? '' : 's'}</span></div>
    </div>
  );
}

const CHIP_CLASS: Record<InvoiceChip, string> = { 'Paid': s.biPaid, 'Open': s.biOpen, 'Past due': s.biLate, 'Void': s.biVoid };
const Chip = (p: { chip: InvoiceChip }): React.ReactElement => <span className={`${s.biChip} ${CHIP_CLASS[p.chip]}`}>{p.chip}</span>;
const period = (inv: IInvoice): string => (inv.periodStart ? `${formatDate(inv.periodStart)}${inv.periodEnd && inv.periodEnd !== inv.periodStart ? ` - ${formatDate(inv.periodEnd)}` : ''}` : 'Period not shown');

interface IHoursData { requests: IMyRequest[]; membership?: IMyMembership; plans: IPlan[] }

export default function BillingView(props: IBillingViewProps): React.ReactElement {
  const { isDemo, source, userEmail, timeZone } = props;
  const openUrl = props.openUrl || ((url: string) => { window.open(url, '_blank', 'noopener,noreferrer'); });
  const [detail, setDetail] = React.useState<IInvoice | undefined>();

  const billing = useLoad<IInvoice[]>(() => source.listMyInvoices(userEmail), [source, userEmail]);
  const [portalBusy, setPortalBusy] = React.useState<boolean>(false);
  const [portalNote, setPortalNote] = React.useState<string | undefined>();
  const managePayment = (): void => {
    if (portalBusy) { return; }
    if (props.mockPayments) { setPortalNote(`${TEST_MODE_NOTE}.`); return; }
    const id: string = newSubmissionId('pay');
    const pollMs: number = props.pollMs ?? 2000;
    let tries: number = 0;
    setPortalBusy(true); setPortalNote(undefined);
    const poll = (): void => {
      tries += 1;
      source.listMyHostRequests().then(rs => {
        const r = rs.filter(x => x.requestId === id)[0];
        const url: string | undefined = r ? safeLink(r.link, STRIPE_HOSTS.portal) : undefined;
        if (url) { setPortalBusy(false); openUrl(url); return; }
        if (r && (r.outcome || r.link)) { setPortalBusy(false); setPortalNote(r.outcome || 'The payment page could not be opened.'); return; }
        if (tries < 30) { window.setTimeout(poll, pollMs); } else { setPortalBusy(false); setPortalNote('Still preparing the page. Try again in a minute.'); }
      }).catch(() => { if (tries < 30) { window.setTimeout(poll, pollMs); } else { setPortalBusy(false); } });
    };
    source.submitHostRequest('PaymentPortal', {}, id).then(() => { window.setTimeout(poll, pollMs); }).catch(() => { setPortalBusy(false); setPortalNote('The payment page could not be opened. Try again in a minute.'); });
  };

  // Hours are known even while payments are not connected: the estimate comes from the member's approved bookings and plan.
  const hoursData = useLoad<IHoursData>(async () => {
    const [requests, membership, plans] = await Promise.all([
      source.listMyRequests(),
      source.getMyMembership(userEmail).catch(() => undefined),
      source.listPlans().catch((): IPlan[] => [])
    ]);
    return { requests, membership, plans };
  }, [source, userEmail]);

  const now: Date = new Date();
  const today: string = localDay(now, timeZone);
  const ms: IMyMembership | undefined = hoursData.data?.membership;
  const plan: IPlan | undefined = hoursData.data ? memberPlan(ms, hoursData.data.plans) : undefined;
  const used: number | undefined = hoursData.data ? hoursThisMonth(hoursData.data.requests, timeZone, now) : undefined;
  const usage = used !== undefined ? usageState(used, plan?.monthlyHours, plan?.extraHourRate) : undefined;
  const estimate = plan && plan.priceCents !== undefined && usage ? paymentEstimate(plan.priceCents, plan.cardPriceCents, usage.overHours, plan.extraHourRate, ms?.payMethod) : undefined;
  const extras = hoursData.data && plan ? extraHourLines(hoursData.data.requests, plan.monthlyHours, plan.extraHourRate, timeZone, now) : [];
  const due = ms?.collectionDay !== undefined ? dueInfo(ms.collectionDay, today) : undefined;
  const openInvoices: IInvoice[] = (billing.data || []).filter(i => i.status === 'open');
  const card: boolean = ms?.payMethod !== 'Bank';
  const pay = (inv: IInvoice): string | undefined => (inv.status === 'open' ? safeLink(inv.hostedUrl, STRIPE_HOSTS.pay) : undefined);
  const receipt = (inv: IInvoice): string | undefined => (inv.status === 'paid' || inv.status === 'open' ? safeLink(inv.pdfUrl, STRIPE_HOSTS.receipt) : undefined);

  return (
    <div className={styles.stack}>
      {PAYMENTS_TEST_MODE && !isDemo && <p className={s.testPill} role="note">{TEST_MODE_NOTE}</p>}
      {ms && isOverdue(ms.paymentStatus) && (
        <div className={s.blOverdue} role="alert"><strong>Payment overdue.</strong> Bookings are paused until the payment is made. Pay the open invoice below or update your payment method.</div>
      )}

      <Section title="Next payment" description={isDemo ? 'Demo: nothing is charged.' : 'Collected automatically on your payment day.'}>
        <LoadError error={hoursData.error} what="your plan and hours" onRetry={hoursData.reload} />
        {!hoursData.data && !hoursData.error && <div className={rx['ref-skeleton']} role="status" aria-label="Loading your plan" />}
        {hoursData.data && !estimate && <Empty>{due ? `Collected on ${formatDate(due.dueYmd)}. The amount appears once Flavors confirms your plan.` : 'Payment day not set yet.'}</Empty>}
        {estimate && plan && (
          <div className={s.biNext}>
            <div className={s.biTotal}>
              <span>Estimate</span>
              <strong>{formatCents(estimate.totalCents)}</strong>
              <span>{due ? `Collected on ${formatDate(due.dueYmd)}${due.daysLeft === 0 ? ' (today)' : ` (in ${due.daysLeft} days)`}` : 'Payment day not set yet'}</span>
            </div>
            <dl className={s.biBreak}>
              <div><dt>{`${plan.name} monthly`}</dt><dd>{formatCents(estimate.planCents)}</dd></div>
              {estimate.extraCents > 0 && usage && <div><dt>{`Extra hours (${usage.overHours} h × ${formatCents(Math.round((plan.extraHourRate || 0) * 100))})`}</dt><dd>{formatCents(estimate.extraCents)}</dd></div>}
              {estimate.feeCents > 0 && <div><dt>Card fee (3%)</dt><dd>{formatCents(estimate.feeCents)}</dd></div>}
            </dl>
            <p className={s.mbNote}>
              {!card ? 'Bank payment: no processing fee. ' : estimate.feeIncluded ? 'Card fee already included in your plan price. ' : ''}
              Estimate until the invoice is issued.{due ? ` A ${formatCents(due.lateFeeCents)} late fee applies after the due date.` : ''}
            </p>
          </div>
        )}
      </Section>

      <Section title="Charges this month" description="An estimate from your plan and approved bookings. The final amounts are on your invoice.">
        {hoursData.data && !estimate && <Empty>Charges appear once Flavors confirms your plan.</Empty>}
        {plan && estimate && (
          <ul className={s.biLines}>
            <li><span>{`${plan.name} · ${plan.monthlyHours ?? '-'} h included`}</span><span>{formatCents(estimate.planCents)}</span></li>
            {extras.map(x => (
              <li key={x.ymd}><span>{`Extra hours · ${formatDate(x.ymd)} · ${x.hours} h`}</span><span>{formatCents(x.cents)}</span></li>
            ))}
            {extras.length === 0 && <li className={s.biQuiet}><span>No extra hours so far this month</span><span>{formatCents(0)}</span></li>}
            {openInvoices.map(inv => (
              <li key={inv.invoiceId}><span>{`Open invoice ${inv.number || toInvoiceRow(inv).title}`}</span><span>{formatCents(Math.max(0, inv.amountDueCents - inv.amountPaidCents))}</span></li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Invoices" description="Your invoices and payments.">
        {billing.error && (
          <div className={styles.notConnected}>
            <strong>Invoices are not available right now.</strong>
            <button type="button" className={s.btn} onClick={billing.reload}>Try again</button>
          </div>
        )}
        {billing.loading && !billing.data && !billing.error && <div className={rx['ref-skeleton']} role="status" aria-label="Loading billing" />}
        {billing.data && (
          <>
            <Balance cents={balanceDueCents(billing.data)} openCount={openInvoices.length} />
            {billing.data.length === 0 ? (
              <Empty>No invoices yet.</Empty>
            ) : (
              <ul className={`${s.biList} ${rx['module-booking-list']}`}>
                {sortInvoices(billing.data).map(inv => {
                  const ch: InvoiceChip = invoiceChip(inv, today);
                  return (
                    <li key={inv.invoiceId} className={rx['module-row-pair']}>
                      <ModuleRow onClick={() => setDetail(inv)} title={`Invoice ${inv.number || inv.invoiceId}`} sub={period(inv)} time={formatCents(inv.amountDueCents)} status={ch} statusTone={ch === 'Paid' ? 'ok' : ch === 'Past due' ? 'bad' : 'wait'} />
                      {pay(inv) && <button type="button" className={rx['primary-button']} onClick={() => openUrl(pay(inv) as string)}>Pay</button>}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </Section>

      <Section title="Payment method" description="Pay by bank account (ACH, no fee) or card, Apple Pay or Google Pay (3% fee).">
        <p className={s.mbNote}>{ms?.payMethod === 'Bank' ? 'Bank account (ACH).' : ms?.payMethod === 'Card' ? 'Card or other electronic payment (3% fee).' : 'Not set yet.'}</p>
        {!isDemo && (
          <div className={s.blActions}>
            <button type="button" className={s.btn} disabled={portalBusy} onClick={managePayment}>{portalBusy ? 'Opening Stripe…' : 'Manage payment method'}</button>
            {portalNote && <span className={styles.muted} role="status">{portalNote}</span>}
          </div>
        )}
      </Section>

      {detail && (
        <Sheet title={`Invoice ${detail.number || detail.invoiceId}`} onClose={() => setDetail(undefined)}>
          <div className={s.biDetailHead}><strong>{formatCents(detail.amountDueCents)}</strong><Chip chip={invoiceChip(detail, today)} /></div>
          <dl className={s.biBreak}>
            <div><dt>Period</dt><dd>{period(detail)}</dd></div>
            {detail.dueDate && <div><dt>Due</dt><dd>{formatDate(detail.dueDate)}</dd></div>}
            <div><dt>Paid</dt><dd>{formatCents(detail.amountPaidCents)}</dd></div>
          </dl>
          {detail.lines.length > 0 ? (
            <ul className={s.biLines}>
              {detail.lines.map((l, i) => <li key={i}><span>{l.description}</span><span>{formatCents(l.amountCents)}</span></li>)}
            </ul>
          ) : <p className={s.mbNote}>Line items are on the Stripe invoice.</p>}
          <div className={s.row}>
            {pay(detail) && <button type="button" className={`${s.btn} ${s.btnCitrus}`} onClick={() => openUrl(pay(detail) as string)}>Pay invoice</button>}
            {receipt(detail) && <button type="button" className={s.btn} onClick={() => openUrl(receipt(detail) as string)}>{detail.status === 'paid' ? 'Receipt' : 'Invoice PDF'}</button>}
          </div>
        </Sheet>
      )}
    </div>
  );
}
