// Creates two payment-method settings on the connected account (test mode only): "Avenue bank only" (ACH) and "Avenue card only" (card, Apple Pay, Google Pay).
// Stripe no longer accepts payment_method_types on Checkout, so the join flow passes one of these ids instead. Dry run unless --apply; re-runnable.
import { pathToFileURL } from 'node:url';
import { createStripeClient } from './stripeClient.mjs';

export const SETS = { Bank: { name: 'Avenue bank only', on: ['us_bank_account'] }, Card: { name: 'Avenue card only', on: ['card', 'apple_pay', 'google_pay'] } };

/** Parameters for a configuration where only `on` methods are shown; every other method the account offers is switched off. */
export function configParams(template, name, on) {
  const p = { name };
  for (const [k, v] of Object.entries(template || {})) if (v && typeof v === 'object' && v.display_preference) p[k] = { display_preference: { preference: on.includes(k) ? 'on' : 'off' } };
  return p;
}

export async function ensureConfigs(stripe, account, apply, log = console.log) {
  const list = (await stripe.get('/payment_method_configurations', { limit: 100 }, account)).data || [];
  const template = list.find(c => c.is_default) || list[0];
  const ids = {};
  for (const [method, s] of Object.entries(SETS)) {
    const found = list.find(c => c.name === s.name && c.active !== false);
    if (found) { ids[method] = found.id; log(`exists ${s.name}`); continue; }
    log(`${apply ? 'create' : 'would create'} ${s.name}`);
    if (apply) ids[method] = (await stripe.post('/payment_method_configurations', configParams(template, s.name, s.on), account)).id;
  }
  return ids;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const env = process.env;
  const account = env.STRIPE_ACCOUNT || (env.ALLOWED_ACCOUNTS || '').split(',')[0];
  await ensureConfigs(createStripeClient({ secretKey: env.STRIPE_SECRET_KEY, fetch }), account, process.argv.includes('--apply'));
}
