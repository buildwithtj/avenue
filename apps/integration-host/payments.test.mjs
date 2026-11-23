import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHmac } from 'node:crypto';
import { createApp } from './server.mjs';
import { createTableStore, createMemoryTable } from './store.mjs';
import { bridgeRequest, nextAnchor, validateJoin } from './bridge.mjs';
import { processEvent } from './events.mjs';
import { joinForm, joinPost, rateLimiter } from './join.mjs';
import { flat } from './stripeClient.mjs';
import { PLANS, lookupKey, planById } from './plans.mjs';
import { wanted, syncCatalog } from './catalog.mjs';
import { importMembers, parseCsv } from './import-members.mjs';

const NOW = 1_795_000_000;   // 2026-11-18T...Z
const SECRET = 'whsec_test_x', KEY = 'bridge-key-test';
const sign = (body, t = NOW) => `t=${t},v1=${createHmac('sha256', SECRET).update(`${t}.${body}`).digest('hex')}`;

/** In-memory SharePoint behind the bridge. query matches every `Field eq 'v'` in the filter (a field may list several values = or). */
function fakeBridge(rows = {}) {
  const lists = { AvenueApplicants: [], AvenueMembers: [], AvenueInvoices: [], AvenueHoursLedger: [], ...rows };
  const upserts = [];
  return {
    lists, upserts,
    async upsert(list, keyField, key, fields, grantTo) {
      upserts.push({ list, key, fields, grantTo });
      const rs = lists[list] ||= []; const r = rs.find(x => x[keyField] === key);
      if (r) Object.assign(r, fields); else rs.push({ [keyField]: key, ...fields });
      return { id: 1 };
    },
    async query(list, filter) {
      const want = {};
      for (const [, f, v] of filter.matchAll(/(\w+) eq '((?:[^']|'')*)'/g)) (want[f] ||= []).push(v.replace(/''/g, "'"));
      return (lists[list] || []).filter(r => Object.entries(want).every(([f, vs]) => vs.includes(String(r[f]))));
    }
  };
}
function fakeStripe() {
  const calls = [];
  const rec = (name, ret) => async (...a) => { calls.push([name, ...a]); return typeof ret === 'function' ? ret(...a) : ret; };
  return {
    calls,
    pricesByLookupKeys: rec('prices', (_a, keys) => keys.map(k => ({ id: `price_${k}`, lookup_key: k }))),
    get: rec('get', (path) => ({ data: [{ id: 'pmc_bank', name: 'Avenue bank only', active: true }, { id: 'pmc_card', name: 'Avenue card only', active: true }] })),
    createCheckoutSession: rec('checkout', { url: 'https://checkout.stripe.com/c/pay/cs_test_1' }),
    createPortalSession: rec('portal', { url: 'https://billing.stripe.com/p/session/x' }),
    customersByEmail: rec('customers', []),
    createCustomer: rec('createCustomer', { id: 'cus_new' }),
    createAccountLink: rec('accountLink', { url: 'https://connect.stripe.com/setup/x' }),
    createInvoice: rec('createInvoice', (_a, p) => ({ id: `in_${p.metadata.part}` })),
    createInvoiceItem: rec('invoiceItem', { id: 'ii_1' }),
    finalizeInvoice: rec('finalize', (_a, id) => ({ id, hosted_invoice_url: `https://invoice.stripe.com/${id}` })),
    cancelAtPeriodEnd: rec('cancel', { current_period_end: NOW + 10 * 86400 }),
    createSubscription: rec('createSub', { id: 'sub_imp' }),
    createPrice: rec('createPrice', { id: 'price_new' })
  };
}
const mkDeps = (over = {}) => ({
  bridge: fakeBridge(), stripe: fakeStripe(), account: 'acct_ok', bridgeKey: KEY, nowSec: () => NOW, portalUrl: 'https://portal.example/p', publicBaseUrl: 'https://host.example',
  applicationDays: 14, store: createTableStore(createMemoryTable()), webhookSecret: () => SECRET, allowedAccounts: ['acct_ok'], state: {}, ...over
});
const req = (body, key = KEY) => ({ headers: { 'x-avenue-bridge-key': key }, rawBody: JSON.stringify(body) });
const JOIN = { planId: 'emerging-10', businessName: 'Keith Plates', contactName: 'Keith', phone: '301 555 0100', teamSize: 2, collectionDay: 5, payMethod: 'Card' };

test('plans: 18 plans, card = +3% for current only, lookup keys', () => {
  assert.equal(PLANS.length, 18);
  assert.equal(planById('Emerging-10').cardPriceCents, 82400);
  assert.equal(planById('legacy-launch').cardPriceCents, 42400);
  assert.equal(lookupKey('mobile kitchen-20', 'Card'), 'avenue-mobile-kitchen-20-card');
  assert.equal(lookupKey('legacy: emerging-10a', 'Card'), 'avenue-legacy-emerging-10a-bank');
  assert.equal(wanted().length, 26);
});

test('bridge key: missing or wrong is 401', async () => {
  assert.equal((await bridgeRequest(req({ kind: 'Join' }, 'nope'), mkDeps())).status, 401);
  assert.equal((await bridgeRequest({ headers: {}, rawBody: '{}' }, mkDeps())).status, 401);
  assert.equal((await bridgeRequest(req({ kind: 'Join' }), mkDeps({ bridgeKey: '' }))).status, 401);
});

test('join validation refuses bad input and legacy plans', () => {
  assert.ok(validateJoin({ ...JOIN, planId: 'legacy-launch' }).errors);
  assert.ok(validateJoin({ ...JOIN, collectionDay: 16 }).errors);
  assert.ok(validateJoin({ ...JOIN, collectionDay: 2.5 }).errors);
  assert.ok(validateJoin({ ...JOIN, payMethod: 'Cash' }).errors);
  assert.ok(validateJoin({ ...JOIN, businessName: 'x' }).errors);
  assert.ok(validateJoin({ ...JOIN, phone: '<script>' }).errors);
  assert.deepEqual(validateJoin(JOIN).value.planId, 'emerging-10');
});

test('join: applicant written, checkout params correct, identity from author not payload', async () => {
  const d = mkDeps();
  const r = await bridgeRequest(req({ requestId: 'r1', kind: 'Join', author: 'New@Biz.com', isStaff: false, payload: JSON.stringify({ ...JOIN, email: 'evil@x.com' }) }), d);
  assert.equal(r.body.outcome, 'Payment link ready');
  assert.match(r.body.link, /^https:\/\/checkout\.stripe\.com/);
  const app = d.bridge.lists.AvenueApplicants[0];
  assert.equal(app.Email, 'new@biz.com'); assert.equal(app.Stage, 'PaymentPending'); assert.equal(app.Source, 'Portal');
  assert.equal(app.ExpiresAt, new Date((NOW + 14 * 86400) * 1000).toISOString());
  const [, acct, p] = d.stripe.calls.find(c => c[0] === 'checkout');
  assert.equal(acct, 'acct_ok');
  assert.equal(p.mode, 'subscription'); assert.equal(p.customer_email, 'new@biz.com'); assert.equal(p.client_reference_id, app.ApplicantId);
  assert.equal(p.payment_method_types, undefined); assert.equal(p.payment_method_configuration, 'pmc_card'); assert.ok(p.custom_text.submit.message.includes('3%'));
  assert.equal(p.line_items[0].price, 'price_avenue-emerging-10-card');
  assert.ok(p.subscription_data.billing_cycle_anchor > NOW); assert.equal(new Date(p.subscription_data.billing_cycle_anchor * 1000).getUTCDate(), 5);
  assert.equal(p.subscription_data.metadata.applicantId, app.ApplicantId); assert.equal(p.metadata.payMethod, 'Card');
  assert.ok(p.expires_at <= NOW + 86400); assert.match(p.success_url, /#welcome$/);
  // bank: ACH only, no fee note
  const d2 = mkDeps(); await bridgeRequest(req({ requestId: 'r2', kind: 'Join', author: 'b@biz.com', payload: { ...JOIN, payMethod: 'Bank' } }), d2);
  const p2 = d2.stripe.calls.find(c => c[0] === 'checkout')[2];
  assert.equal(p2.payment_method_configuration, 'pmc_bank'); assert.equal(p2.custom_text, undefined);
});

test('join refusals: active member, application in progress; pending application is reused', async () => {
  const d = mkDeps({ bridge: fakeBridge({ AvenueMembers: [{ MemberId: 'a@b.com', Status: 'Active' }], AvenueApplicants: [{ ApplicantId: 'app-x', Email: 'c@d.com', Stage: 'Onboarding' }, { ApplicantId: 'app-p', Email: 'e@f.com', Stage: 'PaymentPending' }] }) });
  assert.match((await bridgeRequest(req({ requestId: '1', kind: 'Join', author: 'a@b.com', payload: JOIN }), d)).body.outcome, /active membership/);
  assert.match((await bridgeRequest(req({ requestId: '2', kind: 'Join', author: 'c@d.com', payload: JOIN }), d)).body.outcome, /already being processed/);
  assert.equal((await bridgeRequest(req({ requestId: '3', kind: 'Join', author: 'e@f.com', payload: JOIN }), d)).body.outcome, 'Payment link ready');
  assert.equal(d.bridge.lists.AvenueApplicants.filter(a => a.Email === 'e@f.com').length, 1);
  assert.equal(d.stripe.calls.filter(c => c[0] === 'checkout').length, 1);
});

test('staff-only kinds refuse members; errors never leak', async () => {
  const d = mkDeps();
  for (const kind of ['AccountLink', 'EventInvoice', 'CancelSubscription'])
    assert.match((await bridgeRequest(req({ requestId: 'x', kind, author: 'm@b.com', isStaff: false, payload: {} }), d)).body.outcome, /only Flavors staff/);
  assert.match((await bridgeRequest(req({ requestId: 'x', kind: 'Nope', author: 'm@b.com' }), d)).body.outcome, /unknown request/);
  const broken = mkDeps({ stripe: { ...fakeStripe(), createAccountLink: async () => { throw new Error('stripe: /account_links returned 500'); } } });
  assert.match((await bridgeRequest(req({ requestId: 'x', kind: 'AccountLink', author: 's@f.com', isStaff: true }), broken)).body.outcome, /^Error: could not complete/);
});

test('staff kinds: account link, event invoices (deposit + balance due 30 days before), cancel at period end, payment portal', async () => {
  const d = mkDeps({ bridge: fakeBridge({ AvenueMembers: [{ MemberId: 'm@b.com', StripeCustomerId: 'cus_m', SubscriptionId: 'sub_m' }] }) });
  assert.match((await bridgeRequest(req({ requestId: 'a', kind: 'AccountLink', author: 's@f.com', isStaff: true }), d)).body.link, /connect\.stripe/);
  const ev = await bridgeRequest(req({ requestId: 'e1', kind: 'EventInvoice', author: 's@f.com', isStaff: 'true', payload: { memberEmail: 'm@b.com', packageName: 'Opulence', eventDate: '2027-03-01', member: true } }), d);
  assert.match(ev.body.outcome, /deposit \$500\.00.*balance \$1200\.00 due 2027-01-30/);
  assert.equal(d.stripe.calls.filter(c => c[0] === 'createInvoice').length, 2);
  assert.match((await bridgeRequest(req({ requestId: 'e2', kind: 'EventInvoice', author: 's@f.com', isStaff: true, payload: { memberEmail: 'm@b.com', packageName: 'Huge', eventDate: '2027-03-01' } }), d)).body.outcome, /^Refused/);
  assert.match((await bridgeRequest(req({ requestId: 'c', kind: 'CancelSubscription', author: 's@f.com', isStaff: true, payload: { memberEmail: 'm@b.com' } }), d)).body.outcome, /end on/);
  assert.match((await bridgeRequest(req({ requestId: 'p', kind: 'PaymentPortal', author: 'm@b.com' }), d)).body.link, /billing\.stripe/);
  assert.match((await bridgeRequest(req({ requestId: 'p2', kind: 'PaymentPortal', author: 'nobody@b.com' }), d)).body.outcome, /^Refused/);
  // the staff app's EventInvoice payload (string JSON, yyyy-mm-dd, member true): every package maps to its member price; non-staff, wrong date formats and past dates are refused
  const want = { Simplicity: '950.00', Opulence: '1200.00', Elevation: '1400.00', Platinum: '1850.00' };
  for (const [name, dollars] of Object.entries(want)) {
    const dd = mkDeps();
    const r = await bridgeRequest(req({ requestId: 'ev-' + name, kind: 'EventInvoice', author: 's@f.com', isStaff: true, payload: JSON.stringify({ memberEmail: 'm@b.com', packageName: name, eventDate: '2027-06-15', member: true }) }), dd);
    assert.ok(r.body.outcome.includes('balance $' + dollars + ' due 2027-05-16'), name + ': ' + r.body.outcome);
  }
  const d3 = mkDeps();
  assert.match((await bridgeRequest(req({ requestId: 'x1', kind: 'EventInvoice', author: 'm@b.com', isStaff: false, payload: { memberEmail: 'm@b.com', packageName: 'Simplicity', eventDate: '2027-06-15' } }), d3)).body.outcome, /only Flavors staff/);
  for (const bad of ['2027-06-15T00:00:00Z', '15/06/2027', '2020-01-01']) assert.match((await bridgeRequest(req({ requestId: 'x2', kind: 'EventInvoice', author: 's@f.com', isStaff: true, payload: { memberEmail: 'm@b.com', packageName: 'Simplicity', eventDate: bad } }), d3)).body.outcome, /^Refused/, bad);
  assert.equal(d3.stripe.calls.filter(c => c[0] === 'createInvoice').length, 0);
});

test('anchor: strictly future, at most one month ahead', () => {
  const t = Date.UTC(2026, 10, 15, 12) / 1000;
  assert.equal(new Date(nextAnchor(15, t) * 1000).toISOString(), '2026-12-15T12:00:00.000Z');
  assert.equal(new Date(nextAnchor(15, t - 1800) * 1000).toISOString(), '2026-12-15T12:00:00.000Z');   // within the 1 h margin
  assert.equal(new Date(nextAnchor(15, Date.UTC(2026, 10, 1) / 1000) * 1000).toISOString(), '2026-11-15T12:00:00.000Z');
  assert.equal(new Date(nextAnchor(3, Date.UTC(2026, 11, 20) / 1000) * 1000).toISOString(), '2027-01-03T12:00:00.000Z');
});

// --- webhooks
const evt = (id, type, object, created = NOW - 5, account = 'acct_ok') => JSON.stringify({ id, type, created, account, data: { object } });
const hook = (body, d, sig = sign(body)) => processEvent({ rawBody: body, headers: { 'stripe-signature': sig } }, d);
const INV = (over = {}) => ({ id: 'in_1', customer: 'cus_1', customer_email: 'New@Biz.com', number: 'A-1', status: 'paid', amount_due: 82400, amount_paid: 82400, currency: 'usd', subscription: 'sub_1',
  subscription_details: { metadata: { applicantId: 'app-1' } }, hosted_invoice_url: 'https://invoice.stripe.com/i', invoice_pdf: 'https://pay.stripe.com/pdf', created: NOW - 10,
  lines: { data: [{ description: '1 × Emerging-10', amount: 82400, period: { start: NOW - 10, end: NOW + 86400 * 20 } }] }, ...over });

test('webhook: forged signature and unknown account are 400 and store nothing', async () => {
  const d = mkDeps(); const b = evt('evt_f', 'invoice.paid', INV());
  assert.equal((await hook(b, d, 't=1,v1=00')).status, 400);
  assert.equal((await hook(evt('evt_u', 'invoice.paid', INV(), NOW, 'acct_other'), d)).status, 400);
  assert.equal(await d.store.get('evt_f'), undefined);
  assert.equal((await hook(b, mkDeps({ webhookSecret: () => { throw new Error('none'); } }))).status, 500);
});

test('webhook: first paid invoice turns the applicant into an onboarding member; duplicate is ignored', async () => {
  const d = mkDeps({ bridge: fakeBridge({ AvenueApplicants: [{ ApplicantId: 'app-1', Email: 'new@biz.com', Stage: 'PaymentPending', Source: 'Portal', BusinessName: 'Keith Plates', PlanId: 'emerging-10', CollectionDay: 5, PayMethod: 'Card' }] }) });
  const b = evt('evt_1', 'invoice.paid', INV());
  assert.deepEqual((await hook(b, d)).body, { status: 'processed' });
  const inv = d.bridge.upserts.find(u => u.list === 'AvenueInvoices');
  assert.equal(inv.grantTo, 'new@biz.com'); assert.equal(inv.fields.Status, 'paid'); assert.equal(inv.fields.Kind, 'Membership'); assert.equal(JSON.parse(inv.fields.Lines)[0].amountCents, 82400);
  assert.equal(d.bridge.lists.AvenueApplicants[0].Stage, 'Onboarding');
  const m = d.bridge.lists.AvenueMembers[0];
  assert.equal(m.MemberId, 'new@biz.com'); assert.equal(m.Status, 'Onboarding'); assert.equal(m.PaymentStatus, 'Current'); assert.equal(m.SubscriptionId, 'sub_1'); assert.equal(m.PayMethod, 'Card');
  const n = d.bridge.upserts.length;
  assert.deepEqual((await hook(b, d)).body, { status: 'duplicate' });
  assert.equal(d.bridge.upserts.length, n);
  // public source goes to InviteNeeded
  const d2 = mkDeps({ bridge: fakeBridge({ AvenueApplicants: [{ ApplicantId: 'app-1', Email: 'new@biz.com', Stage: 'PaymentPending', Source: 'Public', PlanId: 'emerging-10' }] }) });
  await hook(b, d2); assert.equal(d2.bridge.lists.AvenueApplicants[0].Stage, 'InviteNeeded');
});

test('webhook: a failed effect stays pending and is retried', async () => {
  let fail = true; const bridge = fakeBridge(); const up = bridge.upsert;
  bridge.upsert = async (...a) => { if (fail) throw new Error('bridge: upsert AvenueInvoices returned 502'); return up(...a); };
  const d = mkDeps({ bridge }); const b = evt('evt_r', 'invoice.finalized', INV({ status: 'open' }));
  assert.equal((await hook(b, d)).status, 500);
  fail = false;
  assert.deepEqual((await hook(b, d)).body, { status: 'processed' });
});

test('webhook: out of order — failed after paid is stale; failed marks PastDue, override survives', async () => {
  const d = mkDeps({ bridge: fakeBridge({ AvenueMembers: [{ MemberId: 'new@biz.com', StripeCustomerId: 'cus_1', PaymentStatus: 'Current' }] }) });
  await hook(evt('evt_p', 'invoice.paid', INV(), NOW - 5), d);
  assert.deepEqual((await hook(evt('evt_late', 'invoice.payment_failed', INV({ status: 'open' }), NOW - 60), d)).body, { status: 'stale' });
  assert.equal(d.bridge.lists.AvenueInvoices[0].Status, 'paid');
  await hook(evt('evt_f2', 'invoice.payment_failed', INV({ id: 'in_2', status: 'open' }), NOW), d);
  assert.equal(d.bridge.lists.AvenueMembers[0].PaymentStatus, 'PastDue');
  d.bridge.lists.AvenueMembers[0].PaymentStatus = 'OwnerOverride';
  await hook(evt('evt_f3', 'invoice.payment_failed', INV({ id: 'in_3', status: 'open' }), NOW), d);
  assert.equal(d.bridge.lists.AvenueMembers[0].PaymentStatus, 'OwnerOverride');
});

test('webhook: subscription status mapping', async () => {
  const d = mkDeps({ bridge: fakeBridge({ AvenueMembers: [{ MemberId: 'm@b.com', StripeCustomerId: 'cus_1', PaymentStatus: 'Current' }] }) });
  const s = (id, type, status) => hook(evt(id, type, { id: 'sub_1', customer: 'cus_1', status }), d);
  await s('e1', 'customer.subscription.updated', 'past_due'); assert.equal(d.bridge.lists.AvenueMembers[0].PaymentStatus, 'PastDue');
  await s('e2', 'customer.subscription.updated', 'unpaid'); assert.equal(d.bridge.lists.AvenueMembers[0].PaymentStatus, 'Unpaid');
  await s('e3', 'customer.subscription.updated', 'active'); assert.equal(d.bridge.lists.AvenueMembers[0].PaymentStatus, 'Current');
  await s('e4', 'customer.subscription.deleted', 'canceled'); assert.equal(d.bridge.lists.AvenueMembers[0].PaymentStatus, 'Cancelled');
  assert.deepEqual((await hook(evt('e5', 'charge.refunded', { id: 'ch_1' }), d)).body, { status: 'ignored' });
  await hook(evt('e6', 'account.updated', { id: 'acct_ok', charges_enabled: true }), d); assert.equal(d.state.chargesEnabled, true);
});

test('overage: ended months only, plan rate, +3% for card, billed once', async () => {
  const ledger = [
    { EntryId: '1', MemberId: 'm@b.com', Period: '2026-10', Hours: 13.5, Reason: 'Used' },
    { EntryId: '2', MemberId: 'm@b.com', Period: '2026-10', Hours: -1, Reason: 'Credit back' },
    { EntryId: '3', MemberId: 'm@b.com', Period: '2026-10', Hours: 2, Reason: 'Overage' },     // not usage
    { EntryId: '4', MemberId: 'm@b.com', Period: '2026-11', Hours: 30, Reason: 'Used' },        // current month: not yet
    { EntryId: '5', MemberId: 'm@b.com', Period: '2026-09', Hours: 8, Reason: 'Used' }          // under plan
  ];
  const d = mkDeps({ bridge: fakeBridge({ AvenueMembers: [{ MemberId: 'm@b.com', StripeCustomerId: 'cus_1', PlanId: 'emerging-10', PayMethod: 'Card' }], AvenueHoursLedger: ledger }) });
  const up = { customer: 'cus_1', subscription: 'sub_1', customer_email: 'm@b.com' };
  await hook(evt('u1', 'invoice.upcoming', up), d);
  const items = d.stripe.calls.filter(c => c[0] === 'invoiceItem');
  assert.equal(items.length, 1);
  assert.equal(items[0][2].amountCents, Math.round(2.5 * 75 * 100 * 1.03));   // 2.5 h over at $75 + 3%
  assert.equal(items[0][3], 'overage:m@b.com:2026-10');
  await hook(evt('u2', 'invoice.upcoming', up), d);
  assert.equal(d.stripe.calls.filter(c => c[0] === 'invoiceItem').length, 1);
  // bank: no fee
  const d2 = mkDeps({ bridge: fakeBridge({ AvenueMembers: [{ MemberId: 'm@b.com', StripeCustomerId: 'cus_1', PlanId: 'emerging-10', PayMethod: 'Bank' }], AvenueHoursLedger: ledger }) });
  await hook(evt('u3', 'invoice.upcoming', up), d2);
  assert.equal(d2.stripe.calls.find(c => c[0] === 'invoiceItem')[2].amountCents, 18750);
});

// --- join page
test('join page: escaped, honeypot, rate limit, errors re-render', async () => {
  const f = joinForm({ businessName: '<img src=x onerror=alert(1)>' }, ['<b>bad</b>']);
  assert.ok(!f.includes('<img src=x')); assert.ok(f.includes('&lt;img')); assert.ok(f.includes('&lt;b&gt;bad'));
  assert.ok(!f.includes('Legacy'));
  const d = mkDeps({ allow: rateLimiter(2, 600) });
  const form = new URLSearchParams({ ...JOIN, email: 'p@biz.com', teamSize: '2', collectionDay: '5' }).toString();
  assert.deepEqual(await joinPost(`${form}&website=spam`, '1.1.1.1', d), { status: 303, location: '/join/done' });
  assert.equal(d.stripe.calls.length, 0);
  const ok = await joinPost(form, '1.1.1.1', d); assert.equal(ok.status, 303); assert.match(ok.location, /checkout\.stripe\.com/);
  assert.equal(d.bridge.lists.AvenueApplicants[0].Source, 'Public');
  assert.equal((await joinPost(form.replace('collectionDay=5', 'collectionDay=20'), '1.1.1.1', d)).status, 400);
  assert.equal((await joinPost(form, '1.1.1.1', d)).status, 429);
});

test('join routes over HTTP: 404 unless JOIN_PUBLIC; health flags carry no secrets', async () => {
  for (const joinPublic of [false, true]) {
    const server = http.createServer(createApp(mkDeps({ joinPublic, secretConfigured: () => true, version: 't' })));
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
      const r = await fetch(`${base}/join`);
      assert.equal(r.status, joinPublic ? 200 : 404);
      if (joinPublic) { assert.match(r.headers.get('content-security-policy'), /default-src 'none'/); assert.match(await r.text(), /Become a member/); }
      const h = await (await fetch(`${base}/api/health`)).json();
      assert.equal(h.joinPublic, joinPublic); assert.equal(h.stripeKeyConfigured, true); assert.equal(h.bridgeConfigured, true);
      assert.ok(!JSON.stringify(h).includes(KEY));
      assert.equal((await fetch(`${base}/api/bridge/request`, { method: 'POST', body: '{}' })).status, 401);
    } finally { server.close(); }
  }
});

test('stripe params flatten to bracket keys', () => {
  assert.deepEqual(flat({ line_items: [{ price: 'p', quantity: 1 }], subscription_data: { metadata: { a: 'b' } }, x: undefined, ok: true }),
    { 'line_items[0][price]': 'p', 'line_items[0][quantity]': '1', 'subscription_data[metadata][a]': 'b', ok: 'true' });
});

test('catalog: dry run creates nothing; apply creates only missing prices', async () => {
  const s = fakeStripe(); s.pricesByLookupKeys = async (_a, keys) => keys.filter(k => k === 'avenue-emerging-10-bank').map(k => ({ lookup_key: k }));
  const logs = [];
  assert.equal((await syncCatalog(s, 'acct_ok', false, l => logs.push(l))).length, 25);
  assert.equal(s.calls.length, 0);
  await syncCatalog(s, 'acct_ok', true, () => {});
  const created = s.calls.filter(c => c[0] === 'createPrice');
  assert.equal(created.length, 25);
  assert.equal(created.find(c => c[2].lookup_key === 'avenue-emerging-10-card')[2].unit_amount, 82400);
});

test('import: dry run validates; apply creates customer, subscription anchored in January, member Active', async () => {
  const rows = parseCsv('email,businessName,planId,collectionDay,payMethod\nKeith@Plates.com,Keith Plates,legacy-launch,5,Bank\nbad,No Plan,zzz,20,Cash\n');
  const d = mkDeps();
  assert.equal(await importMembers(rows, { ...d, apply: false, log: () => {} }), 1);
  assert.equal(d.stripe.calls.length, 0);
  await importMembers(rows, { ...d, apply: true, log: () => {} });
  const sub = d.stripe.calls.find(c => c[0] === 'createSub')[2];
  assert.equal(sub.collection_method, 'send_invoice'); assert.equal(sub.proration_behavior, 'none');
  assert.equal(new Date(sub.billing_cycle_anchor * 1000).toISOString(), '2027-01-05T12:00:00.000Z');
  assert.deepEqual(d.bridge.lists.AvenueMembers[0], { MemberId: 'keith@plates.com', FacilityId: 'flavors-hyattsville', BusinessName: 'Keith Plates', PlanId: 'legacy-launch', CollectionDay: 5, Status: 'Active', StripeCustomerId: 'cus_new', SubscriptionId: 'sub_imp', PayMethod: 'Bank', PaymentStatus: 'Current' });
});

test('test mode: PAYMENTS_REQUIRED=0 skips Checkout, applicant and member go to Onboarding, nothing charged', async () => {
  const d = mkDeps({ paymentsRequired: false });
  const r = await bridgeRequest(req({ requestId: 'r9', kind: 'Join', author: 'T@Biz.com', payload: JOIN }), d);
  assert.match(r.body.outcome, /payment skipped/); assert.equal(d.stripe.calls.some(c => c[0] === 'checkout'), false);
  assert.equal(d.bridge.lists.AvenueApplicants[0].Stage, 'Onboarding'); assert.match(d.bridge.lists.AvenueApplicants[0].Note, /No money/);
  assert.equal(d.bridge.lists.AvenueMembers[0].Status, 'Onboarding'); assert.equal(d.bridge.lists.AvenueMembers[0].MemberId, 't@biz.com');
  const pub = mkDeps({ paymentsRequired: false }); const r2 = await bridgeRequest(req({ requestId: 'r10', kind: 'Join', author: 'u@biz.com', payload: JOIN }), pub);
  assert.equal(pub.bridge.lists.AvenueApplicants[0].Stage, 'Onboarding');
});
test('server: PAYMENTS_REQUIRED=0 is honoured only with a test key', async () => {
  const { depsFromEnv } = await import('./server.mjs');
  const base = { DB_PATH: ':memory:', STRIPE_ACCOUNT: 'acct_x' };
  assert.equal(depsFromEnv({ ...base, PAYMENTS_REQUIRED: '0', STRIPE_SECRET_KEY: 'sk_test_abc' }).paymentsRequired, false);
  assert.equal(depsFromEnv({ ...base, PAYMENTS_REQUIRED: '0' }).paymentsRequired, true);
  assert.equal(depsFromEnv({ ...base, STRIPE_SECRET_KEY: 'sk_test_abc' }).paymentsRequired, true);
});
