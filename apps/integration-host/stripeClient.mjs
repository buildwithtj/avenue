// Minimal Stripe REST client, TEST MODE ONLY until the client approves the demonstrated flow (STR-06): a live key is refused at construction.
// `fetch` is injected. Direct charges: member objects live ON the connected account (Stripe-Account header).

/** {a:{b:[{c:1}]}} -> {'a[b][0][c]': '1'}; undefined/null dropped. */
export function flat(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') flat(v, key, out); else out[key] = String(v);
  }
  return out;
}

export function createStripeClient({ secretKey, fetch }) {
  if (!/^(sk|rk)_test_[A-Za-z0-9]+$/.test(String(secretKey || ''))) throw new Error('stripe: only test-mode keys are accepted');
  async function call(method, path, params, account, idempotencyKey) {
    const qs = new URLSearchParams(flat(params)).toString();
    const res = await fetch(`https://api.stripe.com/v1${path}${method === 'GET' && qs ? `?${qs}` : ''}`, {
      method,
      headers: {
        authorization: `Bearer ${secretKey}`, 'content-type': 'application/x-www-form-urlencoded',
        ...(account ? { 'stripe-account': account } : {}), ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {})
      },
      ...(method === 'GET' ? {} : { body: qs })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`stripe: ${path} returned ${res.status}${body?.error?.code ? ` (${body.error.code})` : ''}${body?.error?.message ? `: ${String(body.error.message).replace(/\b[a-z]{2}_(test|live)_[A-Za-z0-9]+/gi, '[redacted]').slice(0, 200)}` : ''}`);   // never echo the key or full body
    return body;
  }
  const post = (path, params, account, key) => call('POST', path, params, account, key);
  const get = (path, params, account) => call('GET', path, params, account);
  return {
    get, post,
    createAccountLink: (account, refreshUrl, returnUrl) => post('/account_links', { account, refresh_url: refreshUrl, return_url: returnUrl, type: 'account_onboarding' }),
    createInvoiceItem: (account, { customer, amountCents, currency = 'usd', description, invoice, metadata }, key) =>
      post('/invoiceitems', { customer, amount: Math.round(amountCents), currency, description, invoice, metadata }, account, key),
    pricesByLookupKeys: async (account, keys) => (await get('/prices', { lookup_keys: keys, active: true, limit: 100 }, account)).data || [],
    createPrice: (account, params, key) => post('/prices', params, account, key),
    createCheckoutSession: (account, params) => post('/checkout/sessions', params, account),
    createPortalSession: (account, customer, returnUrl) => post('/billing_portal/sessions', { customer, return_url: returnUrl }, account),
    customersByEmail: async (account, email) => (await get('/customers', { email, limit: 10 }, account)).data || [],
    createCustomer: (account, params, key) => post('/customers', params, account, key),
    createInvoice: (account, params, key) => post('/invoices', params, account, key),
    finalizeInvoice: (account, id) => post(`/invoices/${encodeURIComponent(id)}/finalize`, {}, account),
    cancelAtPeriodEnd: (account, subId) => post(`/subscriptions/${encodeURIComponent(subId)}`, { cancel_at_period_end: true }, account),
    createSubscription: (account, params, key) => post('/subscriptions', params, account, key)
  };
}
