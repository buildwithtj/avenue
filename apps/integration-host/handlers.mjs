// Framework-agnostic handlers. Request: {headers, rawBody, query}; response: {status, body}. No secret is read here: the host passes them in `deps`.
// Rules: identity from the token only; fail closed; no secret, card or bank data in responses or logs.
import { handleWebhookAtomic } from '../billing-core/webhook-atomic.mjs';
import { classifyReading, newReadings, readingKey } from '../sensors-core/readings.mjs';
import { authenticate, HttpError } from './auth.mjs';

const json = (status, body) => ({ status, body });
const fail = (e) => e instanceof HttpError ? json(e.status, { error: e.message }) : json(500, { error: 'server error' });

/** POST /api/stripe/webhook. 200 for processed/duplicate/ignored/stale, 400 for a bad signature or event, 500 so Stripe retries. */
export async function stripeWebhook(req, deps) {
  try {
    const r = await handleWebhookAtomic({
      rawBody: req.rawBody, signatureHeader: req.headers?.['stripe-signature'], secret: deps.webhookSecret(),
      nowSec: deps.nowSec(), allowedAccounts: deps.allowedAccounts, store: deps.store
    });
    if (r.status === 'processed') await deps.onInvoiceChange?.(r);
    return json(200, { status: r.status });
  } catch (e) {
    const m = String(e.message);
    if (/signature|timestamp|malformed|unknown connected account|missing invoice|JSON/i.test(m)) return json(400, { error: 'rejected' });
    return json(500, { error: 'server error' });
  }
}

/** GET /api/billing/my-invoices: only the caller's own invoices (e-mail from the token). */
export async function myInvoices(req, deps) {
  try {
    const who = await authenticate(req.headers, { ...deps.auth, nowSec: deps.nowSec() });
    return json(200, { invoices: await deps.invoiceReader(who.email) });
  } catch (e) { return fail(e); }
}

/** GET /api/health: no secrets, no personal data. */
export async function health(deps) {
  return json(200, { ok: true, version: deps.version, lastWebhookAt: deps.lastWebhookAt?.() ?? null, lastSensorSyncAt: deps.lastSensorSyncAt?.() ?? null });
}

/** Timer: pull readings, classify, append only new ones. Stops cleanly at the call budget. */
export async function sensorSync(deps) {
  const incoming = await deps.fetchReadings();           // one provider call (Q-12: cadence and quota are open)
  const keys = await deps.existingKeys();
  const fresh = newReadings(keys, incoming);
  const now = deps.nowIso();
  const rows = fresh.map(r => ({ ...r, key: readingKey(r), state: classifyReading(r, deps.config, now) }));
  if (rows.length) await deps.append(rows);
  const alerts = rows.filter(r => r.state === 'out-of-range' || r.state === 'stale');
  if (alerts.length) await deps.alert?.(alerts);
  return { received: incoming.length, stored: rows.length, alerts: alerts.length };
}

/** Daily: report invoices whose stored state differs from Stripe. Reads only; changes nothing. */
export async function reconcile(deps) {
  const stripe = await deps.listStripeInvoices();         // [{id, paid}]
  const diffs = [];
  for (const inv of stripe) {
    const s = await deps.store.get(`invoice:${inv.id}`);
    const stored = s ? (s.paid ? 'paid' : 'unpaid') : 'unknown';
    const live = inv.paid ? 'paid' : 'unpaid';
    if (stored !== live) diffs.push({ id: inv.id, stored, live });
  }
  return { checked: stripe.length, differences: diffs };
}
