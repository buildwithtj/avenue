// Existing members for January billing (ONB-05, Q-21). CSV header: email,businessName,planId,collectionDay,payMethod (no quoted commas).
// Dry run unless --apply. Per member: Stripe customer + subscription (send_invoice, 7 days to pay, anchored to their day in January 2027, no proration)
// on the connected account, then AvenueMembers Active / Current through the bridge. Idempotency keys make a re-run safe within Stripe's 24 h window.
// Run on the server with the host env loaded (see README): `node import-members.mjs members.csv [--apply]`.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { planById, lookupKey } from './plans.mjs';
import { createStripeClient } from './stripeClient.mjs';
import { bridgeFromEnv, FACILITY } from './bridge.mjs';

export function parseCsv(text) {
  const [head, ...rows] = text.trim().split(/\r?\n/).map(l => l.split(',').map(c => c.trim()));
  return rows.filter(r => r.some(Boolean)).map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

export function checkRow(r) {
  const email = String(r.email || '').toLowerCase(), day = Number(r.collectionDay), plan = planById(r.planId);
  const errors = [];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('email');
  if (!plan) errors.push('planId');
  if (!Number.isInteger(day) || day < 1 || day > 15) errors.push('collectionDay');
  if (r.payMethod !== 'Bank' && r.payMethod !== 'Card') errors.push('payMethod');
  if (!r.businessName) errors.push('businessName');
  return { email, day, plan, errors };
}

export async function importMembers(rows, { stripe, bridge, account, apply, log = console.log }) {
  let ok = 0;
  for (const r of rows) {
    const { email, day, plan, errors } = checkRow(r);
    if (errors.length) { log(`skip ${r.email || '(no email)'}: bad ${errors.join(', ')}`); continue; }
    const key = lookupKey(plan.planId, r.payMethod);
    log(`${apply ? 'import' : 'would import'} ${email} ${plan.name} day ${day} ${key}`);
    ok++;
    if (!apply) continue;
    const [price] = await stripe.pricesByLookupKeys(account, [key]);
    if (!price) throw new Error(`no Stripe price ${key}: run catalog.mjs --apply first`);
    const customer = (await stripe.customersByEmail(account, email))[0] || await stripe.createCustomer(account, { email, name: r.businessName, metadata: { source: 'import' } }, `import-${email}-customer`);
    const s = await stripe.createSubscription(account, {
      customer: customer.id, items: [{ price: price.id }], collection_method: 'send_invoice', days_until_due: 7,
      billing_cycle_anchor: Date.UTC(2027, 0, day, 12) / 1000, proration_behavior: 'none', metadata: { planId: plan.planId, payMethod: r.payMethod, source: 'import' }
    }, `import-${email}-subscription`);
    await bridge.upsert('AvenueMembers', 'MemberId', email, { FacilityId: FACILITY, MemberId: email, BusinessName: r.businessName, PlanId: plan.planId, CollectionDay: day,
      Status: 'Active', StripeCustomerId: customer.id, SubscriptionId: s.id, PayMethod: r.payMethod, PaymentStatus: 'Current' });
  }
  log(`${ok} of ${rows.length} rows ${apply ? 'imported' : 'valid (dry run)'}`);
  return ok;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const env = process.env, file = process.argv[2];
  if (!file) { console.error('usage: node import-members.mjs members.csv [--apply]'); process.exit(2); }
  await importMembers(parseCsv(readFileSync(file, 'utf8')), {
    stripe: createStripeClient({ secretKey: env.STRIPE_SECRET_KEY, fetch }), bridge: bridgeFromEnv(env, fetch).bridge,
    account: env.STRIPE_ACCOUNT || (env.ALLOWED_ACCOUNTS || '').split(',')[0], apply: process.argv.includes('--apply')
  });
}
