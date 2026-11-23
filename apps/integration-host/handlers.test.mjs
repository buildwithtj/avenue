import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createMemoryTable, createTableStore } from './store.mjs';
import { stripeWebhook, myInvoices, health, sensorSync, reconcile } from './handlers.mjs';

const SECRET = 'whsec_test_not_real', NOW = 1_800_000_000;
const sign = (body, t = NOW) => `t=${t},v1=${createHmac('sha256', SECRET).update(`${t}.${body}`).digest('hex')}`;
const ev = (id, type = 'invoice.paid', created = NOW - 5) => JSON.stringify({ id, type, created, account: 'acct_ok', data: { object: { id: 'in_1', amount_paid: 5000, amount_due: 5000 } } });
const mk = () => ({ store: createTableStore(createMemoryTable()), webhookSecret: () => SECRET, nowSec: () => NOW, allowedAccounts: ['acct_ok'] });
const post = (deps, body, sig = sign(body)) => stripeWebhook({ rawBody: body, headers: { 'stripe-signature': sig } }, deps);

test('webhook: processed once, duplicate on retry', async () => {
  const d = mk(); const b = ev('evt_1');
  assert.deepEqual((await post(d, b)).body, { status: 'processed' });
  assert.deepEqual((await post(d, b)).body, { status: 'duplicate' });
});
test('webhook: concurrent identical deliveries apply once', async () => {
  const d = mk(); const b = ev('evt_2');
  const r = await Promise.all([post(d, b), post(d, b), post(d, b)]);
  assert.equal(r.filter(x => x.body.status === 'processed').length, 1);
  assert.ok(r.every(x => x.status === 200));
});
test('webhook: bad signature and unknown account are 400, never applied', async () => {
  const d = mk(); const b = ev('evt_3');
  assert.equal((await post(d, b, 't=1,v1=00')).status, 400);
  const other = b.replace('acct_ok', 'acct_evil');
  assert.equal((await post(d, other)).status, 400);
  assert.equal(await d.store.has('evt_3'), false);
});
test('webhook: late payment_failed after paid is stale', async () => {
  const d = mk();
  await post(d, ev('evt_a', 'invoice.paid'));
  assert.equal((await post(d, ev('evt_b', 'invoice.payment_failed', NOW - 50))).body.status, 'stale');
});
test('webhook: store failure returns 500 so Stripe retries', async () => {
  const d = mk(); d.store.putIfAbsent = async () => { throw new Error('storage down'); };
  assert.equal((await post(d, ev('evt_4'))).status, 500);
});

const claims = { aud: 'api://avenue', tid: 'T', exp: NOW + 60, preferred_username: 'Pat@Example.com' };
const authDeps = (c) => ({ nowSec: () => NOW, auth: { audience: 'api://avenue', tenantId: 'T', verifyJwt: async () => { if (!c) throw new Error('bad'); return c; } },
  invoiceReader: async (email) => [{ owner: email }] });
const tok = { headers: { authorization: 'Bearer aaa.bbb.ccc' } };

test('my-invoices: identity from token only, query ignored', async () => {
  const r = await myInvoices({ ...tok, query: { email: 'victim@x.com' } }, authDeps(claims));
  assert.deepEqual(r.body.invoices, [{ owner: 'pat@example.com' }]);
});
test('my-invoices: fails closed', async () => {
  assert.equal((await myInvoices({ headers: {} }, authDeps(claims))).status, 401);
  assert.equal((await myInvoices(tok, authDeps(null))).status, 401);
  assert.equal((await myInvoices(tok, authDeps({ ...claims, aud: 'other' }))).status, 403);
  assert.equal((await myInvoices(tok, authDeps({ ...claims, tid: 'X' }))).status, 403);
  assert.equal((await myInvoices(tok, authDeps({ ...claims, exp: NOW - 1 }))).status, 401);
  assert.equal((await myInvoices(tok, authDeps({ ...claims, preferred_username: 'nope' }))).status, 403);
});
test('health has no secrets', async () => {
  const r = await health({ version: '1', lastWebhookAt: () => null });
  assert.deepEqual(Object.keys(r.body).sort(), ['lastSensorSyncAt', 'lastWebhookAt', 'ok', 'version']);
});
test('sensor sync stores only new readings and alerts on out-of-range', async () => {
  const cfg = { minF: 0, maxF: 41, staleAfterMinutes: 30 }; const stored = [];
  const rd = (t, v) => ({ sensorId: 's1', timestamp: t, value: v, unit: 'F' });
  const deps = { config: cfg, nowIso: () => '2026-11-14T12:00:00Z', fetchReadings: async () => [rd('2026-11-14T11:59:00Z', 38), rd('2026-11-14T11:59:30Z', 50), rd('2026-11-14T11:59:00Z', 38)],
    existingKeys: async () => new Set(), append: async (rows) => stored.push(...rows), alert: async (a) => { deps.alerted = a.length; } };
  const r = await sensorSync(deps);
  assert.deepEqual(r, { received: 3, stored: 2, alerts: 1 });
  assert.equal(deps.alerted, 1);
});
test('reconcile reports differences only', async () => {
  const d = mk(); await post(d, ev('evt_r'));
  const r = await reconcile({ store: d.store, listStripeInvoices: async () => [{ id: 'in_1', paid: true }, { id: 'in_9', paid: true }] });
  assert.deepEqual(r.differences, [{ id: 'in_9', stored: 'unknown', live: 'paid' }]);
});
