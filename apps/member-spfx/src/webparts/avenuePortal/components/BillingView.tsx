import * as React from 'react';
import { DefaultButton, PrimaryButton, Spinner } from '@fluentui/react';
import styles from './AvenuePortal.module.scss';
import {
  formatCents,
  balanceDueCents,
  isOverdue,
  safeLink,
  sortInvoices,
  STRIPE_HOSTS,
  toInvoiceRow,
  IInvoice,
  IInvoiceRow
} from '../../../avenue/billing';
import { dueInfo, monthlyCharge, overageCents } from '../../../avenue/payments';
import { hoursThisMonth } from '../../../avenue/booking';
import type { IMyMembership, IMyRequest } from '../../../avenue/contracts';
import { hoursSummary } from '../../../avenue/home';
import { type AvenueReadSource, newSubmissionId } from '../../../avenue/readSource';
import { useCountUp, useReducedMotion } from './motion';
import s from './Site.module.scss';
import { Empty, ErrorBar, formatDate, ordinal, Section, StatusBadge, useLoad } from './ui';

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

export default function BillingView(props: IBillingViewProps): React.ReactElement {
  const { isDemo, source, userEmail, timeZone } = props;
  const openUrl = props.openUrl || ((url: string) => { window.open(url, '_blank', 'noopener,noreferrer'); });
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});

  const billing = useLoad<IInvoice[]>(() => source.listMyInvoices(userEmail), [source, userEmail]);
  const [portalBusy, setPortalBusy] = React.useState<boolean>(false);
  const [portalNote, setPortalNote] = React.useState<string | undefined>();
  const managePayment = (): void => {
    if (portalBusy) { return; }
    if (props.mockPayments) { setPortalNote('Payments are switched off during the preview. Nothing is charged.'); return; }
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
    source.submitHostRequest('PaymentPortal', {}, id).then(() => { window.setTimeout(poll, pollMs); }).catch((e: Error) => { setPortalBusy(false); setPortalNote(e.message); });
  };

  // Hours are known even while payments are not connected: the estimate comes from the member's approved bookings and plan.
  const hoursData = useLoad<{ requests: IMyRequest[]; membership?: IMyMembership }>(async () => {
    const [requests, membership] = await Promise.all([source.listMyRequests(), source.getMyMembership(userEmail).catch(() => undefined)]);
    return { requests, membership };
  }, [source, userEmail]);
  const hours = hoursData.data ? hoursSummary(hoursThisMonth(hoursData.data.requests, timeZone, new Date()), hoursData.data.membership?.monthlyHours) : undefined;
  const collection: number | undefined = hoursData.data?.membership?.collectionDay;

  const toggleExpand = (invoiceId: string): void => {
    setExpanded(prev => ({ ...prev, [invoiceId]: !prev[invoiceId] }));
  };

  const today: string = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const ms: IMyMembership | undefined = hoursData.data?.membership;
  const charge = monthlyCharge(ms?.planName || ms?.planId, ms?.payMethod);
  const due = collection !== undefined ? dueInfo(collection, today) : undefined;
  const extra: number | undefined = hours && hours.allowance !== undefined ? overageCents(hours.over, ms?.extraHourRate, ms?.payMethod) : undefined;
  const isNotConnected: boolean = !!billing.error;

  return (
    <div className={styles.stack}>
      {ms && isOverdue(ms.paymentStatus) && (
        <div className={s.blOverdue} role="alert"><strong>Payment overdue.</strong> Bookings are paused until the payment is made. Pay the open invoice below or update your payment method.</div>
      )}
      <section aria-label="Hours this month">
        <h2 className={styles.sectionLabel}>This month</h2>
        <div className={styles.summaryRow}>
          <div className={styles.summaryButton}>
            <span className={styles.summaryKey}>Hours</span>
            {!hours && <Spinner />}
            {hours && hours.allowance !== undefined && (
              <>
                <span className={styles.summaryValue}>{hours.over > 0 ? `${hours.over} h over your plan` : `${hours.left} h left`}</span>
                <span className={styles.meter} aria-hidden="true"><span className={`${styles.meterFill} ${hours.over > 0 ? styles.meterOver : ''}`} style={{ width: `${Math.round(hours.fraction * 100)}%` }} /></span>
                <span className={styles.summaryNote}>{hours.used} of {hours.allowance} h used. Hours do not roll over.</span>
              </>
            )}
            {hours && hours.allowance === undefined && (
              <>
                <span className={styles.summaryValue}>{hours.used} h booked</span>
                <span className={styles.summaryNote}>Your plan hours appear once Flavors sets up plans.</span>
              </>
            )}
          </div>
          <div className={styles.summaryButton}>
            <span className={styles.summaryKey}>Extra hours</span>
            <span className={styles.summaryValue}>{hours && hours.allowance !== undefined ? `${hours.over} h` : 'Not known yet'}</span>
            <span className={styles.summaryNote}>An estimate from your approved bookings. Extra hours are billed with your next payment{collection !== undefined ? `, collected on the ${ordinal(collection)}` : ''}. Nothing is charged when you book.</span>
          </div>
        </div>
      </section>

      <Section title="Next payment" description={isDemo ? 'Demo: nothing is charged.' : 'Collected automatically by Stripe (test mode until Flavors approves live payments).'}>
        {!charge && <Empty>Your plan price appears here once Flavors confirms your plan.</Empty>}
        {charge && (
          <div className={styles.summaryCard}>
            <div className={styles.summaryTile}>
              <span className={styles.summaryLabel}>{ms?.planName} monthly</span>
              <span className={styles.summaryValue}>{formatCents(charge.totalCents)}</span>
              <span className={styles.summaryMeta}>{charge.feeIncluded ? 'Card fee already included in your price.' : charge.feeCents === 0 ? 'Bank payment: no processing fee.' : `${formatCents(charge.planCents)} plan + ${formatCents(charge.feeCents)} card fee (3%)`}</span>
            </div>
            {due && (
              <div className={styles.summaryTile}>
                <span className={styles.summaryLabel}>Due</span>
                <span className={styles.summaryValue}>{formatDate(due.dueYmd)}</span>
                <span className={styles.summaryMeta}>{due.daysLeft === 0 ? 'Due today. ' : `In ${due.daysLeft} days. `}{due.graceYmd ? `Pay by ${formatDate(due.graceYmd)} at the latest. ` : ''}A {formatCents(due.lateFeeCents)} late fee applies after the due date.</span>
              </div>
            )}
            {extra !== undefined && extra > 0 && (
              <div className={styles.summaryTile}>
                <span className={styles.summaryLabel}>Extra hours so far</span>
                <span className={styles.summaryValue}>{formatCents(extra)}</span>
                <span className={styles.summaryMeta}>Estimate, billed with your next payment. Nothing is charged when you book.</span>
              </div>
            )}
          </div>
        )}
        <p className={styles.muted}>Pay by bank account (ACH, no fee) or card, Apple Pay or Google Pay (3% fee).</p>
        {!isDemo && (
          <div className={s.blActions}>
            <DefaultButton text={portalBusy ? 'Opening Stripe…' : 'Manage payment method'} disabled={portalBusy} onClick={managePayment} />
            {portalNote && <span className={styles.muted} role="status">{portalNote}</span>}
          </div>
        )}
      </Section>

      <Section
        title="Invoices"
        description="Your invoices and payment history."
      >
        {isNotConnected && (
          <div className={styles.notConnected}>
            <strong>Invoices are not available right now.</strong>
            <span>Your invoices and payment history appear here once Stripe has sent your first invoice. Until then, your hours above are the guide.</span>
            <ErrorBar error={billing.error} />
          </div>
        )}

        {billing.loading && !billing.data && !billing.error && (
          <Spinner label="Loading billing" />
        )}

        {billing.data && (
          <>
            <Balance cents={balanceDueCents(billing.data)} openCount={billing.data.filter(i => i.status === 'open').length} />

            {billing.data.length === 0 ? (
              <Empty>No invoices.</Empty>
            ) : (
              <div className={styles.stack}>
                {sortInvoices(billing.data).map(inv => {
                  const row: IInvoiceRow = toInvoiceRow(inv);
                  const isExp: boolean = !!expanded[inv.invoiceId];
                  return (
                    <article key={inv.invoiceId} className={styles.invoiceCard}>
                      <div className={styles.invoiceHeader}>
                        <div className={styles.invoiceMain}>
                          <h3 className={styles.invoiceTitle}>{row.title}</h3>
                          <div className={styles.invoiceMeta}>
                            <span>Invoice {inv.number || row.invoiceId}</span>
                            {row.dueText && <span> · Due {row.dueText}</span>}
                          </div>
                          {row.estimateNote && (
                            <div className={styles.estimateCallout}>{row.estimateNote}</div>
                          )}
                        </div>
                        <div className={styles.invoiceRight}>
                          <span className={styles.invoiceAmount}>{row.amountText}</span>
                          <StatusBadge label={row.statusLabel} />
                          {inv.status === 'open' && safeLink(inv.hostedUrl, STRIPE_HOSTS.pay) && (
                            <PrimaryButton text="Pay" onClick={() => openUrl(safeLink(inv.hostedUrl, STRIPE_HOSTS.pay) as string)} className={styles.smallButton} />
                          )}
                          {(inv.status === 'paid' || inv.status === 'open') && safeLink(inv.pdfUrl, STRIPE_HOSTS.receipt) && (
                            <DefaultButton text={inv.status === 'paid' ? 'Receipt' : 'PDF'} onClick={() => openUrl(safeLink(inv.pdfUrl, STRIPE_HOSTS.receipt) as string)} className={styles.smallButton} />
                          )}
                          {inv.lines.length > 0 && (
                            <DefaultButton
                              text={isExp ? 'Hide lines' : 'View lines'}
                              onClick={() => toggleExpand(inv.invoiceId)}
                              className={styles.smallButton}
                            />
                          )}
                        </div>
                      </div>

                      {isExp && inv.lines.length > 0 && (
                        <div className={`${styles.invoiceLines} ${s.blLines}`}>
                          <div className={styles.linesHeader}>Line items</div>
                          {inv.lines.map((line, idx) => (
                            <div key={idx} className={styles.invoiceLine}>
                              <span>{line.description}</span>
                              <span className={styles.lineAmount}>{formatCents(line.amountCents)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </Section>
    </div>
  );
}
