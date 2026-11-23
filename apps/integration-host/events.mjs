// Stripe webhook processing for the AWS host (docs/MODULES_PLAN.md §11.3). Signature on the raw body, connected-account allow-list,
// de-duplication by event id (a failed effect stays "pending" and answers 500 so Stripe retries), per-invoice ordering (older events
// are stale, paid is final). Effects are idempotent upserts through the SharePoint bridge. Without a bridge (tests) only state is kept.
import { verifySignature } from '../billing-core/webhook.mjs';
import { summariseUsage } from '../billing-core/usage.mjs';
import { planById, CARD_FEE } from './plans.mjs';
import { FACILITY, q } from './bridge.mjs';

const iso = (sec) => (sec ? new Date(sec * 1000).toISOString() : null);
const sub = (inv) => inv.subscription || inv.parent?.subscription_details?.subscription || null;
const subMeta = (inv) => inv.subscription_details?.metadata || inv.parent?.subscription_details?.metadata || {};
const STATUS = { active: 'Current', trialing: 'Current', past_due: 'PastDue', unpaid: 'Unpaid', canceled: 'Cancelled', incomplete_expired: 'Cancelled' };

export async function processEvent({ rawBody, headers }, deps) {
  let secret; try { secret = deps.webhookSecret(); } catch { return { status: 500, body: { error: 'server error' } }; }
  let event;
  try {
    verifySignature(rawBody, headers?.['stripe-signature'], secret, deps.nowSec());
    event = JSON.parse(rawBody);
    if (!event?.id || typeof event.type !== 'string') throw new Error('malformed');
    if (!event.account || !deps.allowedAccounts.includes(event.account)) throw new Error('unknown account');
  } catch { return { status: 400, body: { error: 'rejected' } }; }
  const done = (r) => r && r.outcome !== 'pending';
  if (done(await deps.store.get(event.id))) return { status: 200, body: { status: 'duplicate' } };
  if (!(await deps.store.putIfAbsent({ id: event.id, type: event.type, account: event.account, outcome: 'pending' })) && done(await deps.store.get(event.id)))
    return { status: 200, body: { status: 'duplicate' } };
  try {
    const status = await apply(event, deps);
    await deps.store.put({ id: event.id, type: event.type, account: event.account, outcome: status });
    return { status: 200, body: { status } };
  } catch (e) {
    deps.log?.(`webhook ${event.type} failed: ${e.message}`);
    return { status: 500, body: { error: 'server error' } };
  }
}

async function apply(event, deps) {
  const o = event.data?.object || {};
  const b = deps.bridge;
  if (event.type === 'account.updated') { if (deps.state) deps.state.chargesEnabled = !!o.charges_enabled; return 'processed'; }
  if (event.type === 'checkout.session.completed') {
    if (b && o.client_reference_id) await b.upsert('AvenueApplicants', 'ApplicantId', o.client_reference_id, { StripeCustomerId: o.customer || '', SubscriptionId: o.subscription || '' });
    return 'processed';
  }
  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const st = event.type.endsWith('deleted') ? 'Cancelled' : STATUS[o.status];
    if (b && st) await setPaymentStatus(b, `StripeCustomerId eq ${q(o.customer)}`, st);
    return 'processed';
  }
  if (event.type === 'invoice.upcoming') { await billOverage(o, deps); return 'processed'; }
  if (!event.type.startsWith('invoice.') || !o.id) return 'ignored';

  // Ordering: older than the last applied event for this invoice, or anything after paid, changes nothing.
  const key = `inv:${o.id}`, prev = await deps.store.get(key);
  const status = event.type === 'invoice.paid' ? 'paid' : o.status;
  if (prev && (prev.created > event.created || (prev.status === 'paid' && status !== 'paid'))) return 'stale';
  if (b) {
    const email = String(o.customer_email || '').toLowerCase();
    const lines = (o.lines?.data || []).map(l => ({ description: l.description || '', amountCents: l.amount }));
    await b.upsert('AvenueInvoices', 'InvoiceId', o.id, {
      FacilityId: FACILITY, InvoiceId: o.id, MemberId: email, Number: o.number || '', Kind: o.metadata?.kind || (sub(o) ? 'Membership' : 'Other'),
      Status: status, AmountDueCents: o.amount_due ?? 0, AmountPaidCents: o.amount_paid ?? 0, Currency: o.currency || 'usd',
      DueDate: iso(o.due_date), PeriodStart: iso(o.lines?.data?.[0]?.period?.start ?? o.period_start), PeriodEnd: iso(o.lines?.data?.[0]?.period?.end ?? o.period_end),
      HostedUrl: o.hosted_invoice_url || '', PdfUrl: o.invoice_pdf || '', Lines: JSON.stringify(lines), StripeCreated: o.created ?? event.created
    }, email || undefined);
    if (event.type === 'invoice.paid' && sub(o) && email) await onSubscriptionPaid(o, email, deps);
    if (event.type === 'invoice.payment_failed' && sub(o)) await setPaymentStatus(b, `StripeCustomerId eq ${q(o.customer)}`, 'PastDue');
  }
  await deps.store.put({ id: key, created: event.created, status });
  return 'processed';
}

/** OwnerOverride survives PastDue/Unpaid; Current or Cancelled replaces it. Only existing member rows are touched. */
async function setPaymentStatus(b, filter, st) {
  const m = (await b.query('AvenueMembers', filter, ['MemberId', 'PaymentStatus'], 1))[0];
  if (!m || (m.PaymentStatus === 'OwnerOverride' && (st === 'PastDue' || st === 'Unpaid')) || m.PaymentStatus === st) return;
  await b.upsert('AvenueMembers', 'MemberId', m.MemberId, { PaymentStatus: st });
}

/** First paid subscription invoice of an applicant: applicant -> Onboarding (portal) or InviteNeeded (public), member row written. */
async function onSubscriptionPaid(inv, email, deps) {
  const b = deps.bridge;
  const id = subMeta(inv).applicantId;
  const a = (await b.query('AvenueApplicants', id ? `ApplicantId eq ${q(id)}` : `Email eq ${q(email)} and (Stage eq 'PaymentPending' or Stage eq 'Paid')`,
    ['ApplicantId', 'Stage', 'Source', 'BusinessName', 'PlanId', 'CollectionDay', 'PayMethod'], 1))[0];
  if (!a || (a.Stage !== 'PaymentPending' && a.Stage !== 'Paid')) { await setPaymentStatus(b, `MemberId eq ${q(email)}`, 'Current'); return; }
  const now = iso(deps.nowSec());
  await b.upsert('AvenueApplicants', 'ApplicantId', a.ApplicantId, { Stage: a.Source === 'Public' ? 'InviteNeeded' : 'Onboarding', PaidAt: now, StripeCustomerId: inv.customer || '', SubscriptionId: sub(inv) });
  await b.upsert('AvenueMembers', 'MemberId', email, {
    FacilityId: FACILITY, MemberId: email, BusinessName: a.BusinessName, PlanId: a.PlanId, CollectionDay: a.CollectionDay, Status: 'Onboarding',
    StripeCustomerId: inv.customer || '', SubscriptionId: sub(inv), PayMethod: a.PayMethod, PaymentStatus: 'Current'
  });
}

/** invoice.upcoming: add extra hours of each fully ended calendar month not yet billed to the renewal invoice. */
// ponytail: months are UTC calendar months; switch to the facility time zone if a booking near midnight on the 1st is ever misplaced.
export async function billOverage(inv, deps) {
  const b = deps.bridge;
  if (!b || !inv.customer) return;
  const m = (await b.query('AvenueMembers', `StripeCustomerId eq ${q(inv.customer)}`, ['MemberId', 'PlanId', 'PayMethod'], 1))[0];
  const plan = m && planById(m.PlanId);
  if (!plan) return;
  const rows = await b.query('AvenueHoursLedger', `MemberId eq ${q(m.MemberId)}`, ['EntryId', 'MemberId', 'Period', 'Hours', 'Reason'], 5000);
  const entries = rows.filter(r => r.Reason !== 'Overage' && /^\d{4}-\d{2}$/.test(r.Period || '')).map(r => ({ entryId: r.EntryId, memberId: m.MemberId, period: r.Period, hours: Number(r.Hours) || 0 }));
  const thisMonth = new Date(deps.nowSec() * 1000).toISOString().slice(0, 7);
  for (const u of summariseUsage(entries, { [m.MemberId]: { monthlyHours: plan.hours } })) {
    if (u.period >= thisMonth || !(u.overageHours > 0)) continue;
    const key = `overage:${m.MemberId}:${u.period}`;
    if (await deps.store.get(key)) continue;
    const base = Math.round(u.overageHours * plan.extraRate * 100);
    const amountCents = m.PayMethod === 'Card' ? Math.round(base * (1 + CARD_FEE)) : base;
    await deps.stripe.createInvoiceItem(deps.account, {
      customer: inv.customer, amountCents, metadata: { kind: 'Overage', period: u.period },
      description: `Extra hours ${u.period}: ${u.overageHours} h × $${plan.extraRate}${m.PayMethod === 'Card' ? ' + 3% card fee' : ''}`
    }, key);
    await deps.store.put({ id: key, amountCents });
  }
}
