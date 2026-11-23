// Host-independent core for Stripe webhook handling. A trusted host (Q-01, not selected) must call
// handleWebhook with the RAW request body. Nothing here reads secrets from the environment or sends anything.
import { createHmac, timingSafeEqual } from 'node:crypto';

const TOLERANCE_SEC = 300; // Stripe's default replay window

/** Verifies a Stripe-Signature header (scheme v1: HMAC-SHA256 of `${t}.${rawBody}`). Throws on any problem. */
export function verifySignature(rawBody, header, secret, nowSec, toleranceSec = TOLERANCE_SEC) {
  if (typeof rawBody !== 'string' || !header || !secret) throw new Error('signature: missing input');
  const parts = header.split(',').map(p => p.split('='));
  const t = parts.find(p => p[0] === 't')?.[1];
  const sigs = parts.filter(p => p[0] === 'v1').map(p => p[1]);
  if (!t || !/^\d+$/.test(t) || sigs.length === 0) throw new Error('signature: malformed header');
  if (Math.abs(nowSec - Number(t)) > toleranceSec) throw new Error('signature: timestamp outside tolerance');
  const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest();
  const ok = sigs.some(s => {
    const got = Buffer.from(s, 'hex');
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
  if (!ok) throw new Error('signature: no match');
}

/** Event types this slice acts on. Others are acknowledged and recorded as ignored, never guessed at. */
const HANDLED = new Set(['invoice.paid', 'invoice.payment_failed']);

/**
 * store: { has(id), get(id), put(record) } all async, keyed by record.id. In tests this is a Map; in production it is
 * whatever Q-01 selects. Besides one record per event id it keeps one state record per invoice ('invoice:<id>').
 * allowedAccounts: connected account ids onboarded for this facility. Events for any other account are rejected.
 * Returns { status: 'processed' | 'duplicate' | 'ignored' | 'stale', ... }. Throws on verification or account failures.
 * Out of order: Stripe does not guarantee delivery order. Paid is final, and an event older than the invoice's last
 * applied event is recorded as 'stale' and changes nothing, so a late payment_failed never undoes a payment.
 */
export async function handleWebhook({ rawBody, signatureHeader, secret, nowSec, allowedAccounts, store }) {
  verifySignature(rawBody, signatureHeader, secret, nowSec);
  const event = JSON.parse(rawBody);
  if (!event?.id || typeof event.type !== 'string') throw new Error('event: malformed');
  if (!event.account || !allowedAccounts.includes(event.account)) throw new Error('event: unknown connected account');
  if (await store.has(event.id)) return { status: 'duplicate', id: event.id };
  if (!HANDLED.has(event.type)) {
    await store.put({ id: event.id, type: event.type, account: event.account, outcome: 'ignored' });
    return { status: 'ignored', id: event.id };
  }
  const inv = event.data?.object;
  if (!inv?.id) throw new Error('event: missing invoice');
  const paid = event.type === 'invoice.paid';
  const created = Number(event.created) || 0;
  const prior = await store.get(`invoice:${inv.id}`);
  if (prior && (prior.paid || created < prior.created)) {
    await store.put({ id: event.id, type: event.type, account: event.account, outcome: 'stale', invoiceId: inv.id });
    return { status: 'stale', id: event.id, invoiceId: inv.id };
  }
  const record = {
    id: event.id, type: event.type, account: event.account, outcome: 'processed',
    invoiceId: inv.id, paid, amountCents: paid ? inv.amount_paid : inv.amount_due
  };
  // Record first-writer-wins: a concurrent duplicate must not apply twice. Hosts need an atomic put-if-absent here,
  // and the invoice state write must be conditional on the prior state read above (same store transaction or ETag).
  await store.put(record);
  await store.put({ id: `invoice:${inv.id}`, paid, created, lastEventId: event.id });
  return { status: 'processed', ...record };
}
