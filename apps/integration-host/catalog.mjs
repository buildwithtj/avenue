// Creates the Stripe prices for every plan on the connected account (test mode only). Dry run unless --apply. Re-runnable: existing lookup keys are skipped.
// Run on the server as root with the host env loaded (see README), e.g. `node catalog.mjs --apply`.
import { pathToFileURL } from 'node:url';
import { PLANS, lookupKey } from './plans.mjs';
import { createStripeClient } from './stripeClient.mjs';

/** The prices that should exist: [{lookup_key, nickname, unit_amount, planId, name}]. */
export const wanted = () => PLANS.flatMap(p => (p.group === 'Legacy' ? [['Bank', p.priceCents]] : [['Bank', p.priceCents], ['Card', p.cardPriceCents]])
  .map(([m, cents]) => ({ lookup_key: lookupKey(p.planId, m), nickname: `${p.name} (${m === 'Card' ? 'card' : p.group === 'Legacy' ? 'all methods' : 'bank'})`, unit_amount: cents, planId: p.planId, name: p.name })));

export async function syncCatalog(stripe, account, apply, log = console.log) {
  const all = wanted();
  const have = new Set();
  for (let i = 0; i < all.length; i += 10) for (const p of await stripe.pricesByLookupKeys(account, all.slice(i, i + 10).map(w => w.lookup_key))) have.add(p.lookup_key);
  const missing = all.filter(w => !have.has(w.lookup_key));
  for (const w of missing) {
    log(`${apply ? 'create' : 'would create'} ${w.lookup_key} $${(w.unit_amount / 100).toFixed(2)}/month`);
    if (apply) await stripe.createPrice(account, { currency: 'usd', unit_amount: w.unit_amount, recurring: { interval: 'month' }, lookup_key: w.lookup_key, nickname: w.nickname,
      product_data: { name: `Avenue membership – ${w.name}`, metadata: { planId: w.planId } }, metadata: { planId: w.planId } }, `catalog-${w.lookup_key}`);
  }
  log(`${all.length - missing.length} already exist, ${missing.length} ${apply ? 'created' : 'missing (dry run)'}`);
  return missing;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const env = process.env;
  const account = env.STRIPE_ACCOUNT || (env.ALLOWED_ACCOUNTS || '').split(',')[0];
  await syncCatalog(createStripeClient({ secretKey: env.STRIPE_SECRET_KEY, fetch }), account, process.argv.includes('--apply'));
}
