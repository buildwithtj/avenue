import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { handleWebhook, verifySignature } from './webhook.mjs';

const SECRET = 'whsec_test_placeholder'; // test-only value, not a real key
const NOW = 1_800_000_000;
const sign = (body, t = NOW, secret = SECRET) => `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;
const event = (over = {}) => JSON.stringify({ id: 'evt_1', type: 'invoice.paid', account: 'acct_A', data: { object: { id: 'in_1', amount_paid: 5000, amount_due: 5000 } }, ...over });
const mkStore = () => { const m = new Map(); return { m, has: async id => m.has(id), get: async id => m.get(id), put: async r => { m.set(r.id, r); } }; };
const args = (body, extra = {}) => ({ rawBody: body, signatureHeader: sign(body), secret: SECRET, nowSec: NOW, allowedAccounts: ['acct_A'], store: mkStore(), ...extra });

test('accepts a correct signature', () => verifySignature('{}', sign('{}'), SECRET, NOW));
test('rejects wrong secret, tampered body, old timestamp, malformed header', () => {
  assert.throws(() => verifySignature('{}', sign('{}', NOW, 'other'), SECRET, NOW), /no match/);
  assert.throws(() => verifySignature('{"x":1}', sign('{}'), SECRET, NOW), /no match/);
  assert.throws(() => verifySignature('{}', sign('{}', NOW - 301), SECRET, NOW), /tolerance/);
  assert.throws(() => verifySignature('{}', 'garbage', SECRET, NOW), /malformed/);
  assert.throws(() => verifySignature('{}', sign('{}'), '', NOW), /missing/);
});
test('processes a paid invoice once and records it', async () => {
  const a = args(event());
  const r = await handleWebhook(a);
  assert.equal(r.status, 'processed');
  assert.equal(r.amountCents, 5000);
  assert.equal(a.store.m.get('evt_1').outcome, 'processed');
  assert.equal(a.store.m.get('invoice:in_1').paid, true);
});
test('a replayed event changes nothing', async () => {
  const a = args(event());
  await handleWebhook(a);
  const before = [...a.store.m.entries()];
  const again = await handleWebhook(a);
  assert.equal(again.status, 'duplicate');
  assert.deepEqual([...a.store.m.entries()], before);
});
// Sends several events through one store, each signed separately.
const run = async (store, ...evs) => { const out = []; for (const e of evs) out.push(await handleWebhook({ ...args(e), store })); return out; };
test('out of order: a payment_failed arriving after paid is stale and the invoice stays paid', async () => {
  const s = mkStore();
  const [paid, late] = await run(s, event({ id: 'evt_p', created: 200 }), event({ id: 'evt_f', type: 'invoice.payment_failed', created: 100 }));
  assert.equal(paid.status, 'processed');
  assert.equal(late.status, 'stale');
  assert.equal(s.m.get('invoice:in_1').paid, true);
  assert.equal((await handleWebhook({ ...args(event({ id: 'evt_f', type: 'invoice.payment_failed', created: 100 })), store: s })).status, 'duplicate');
});
test('paid is final, failed then paid applies, and an older failure after a newer one is stale', async () => {
  const s = mkStore();
  const r = await run(s,
    event({ id: 'e1', type: 'invoice.payment_failed', created: 100 }),
    event({ id: 'e0', type: 'invoice.payment_failed', created: 50 }),
    event({ id: 'e2', created: 300 }),
    event({ id: 'e3', created: 400 }));
  assert.deepEqual(r.map(x => x.status), ['processed', 'stale', 'processed', 'stale']);
  assert.equal(s.m.get('invoice:in_1').lastEventId, 'e2');
});
test('rejects events for an account that is not onboarded, or with no account', async () => {
  await assert.rejects(handleWebhook(args(event({ account: 'acct_X' }))), /unknown connected account/);
  await assert.rejects(handleWebhook(args(event({ account: undefined }))), /unknown connected account/);
});
test('unsigned or badly signed requests never reach the store', async () => {
  const a = args(event(), { signatureHeader: sign(event(), NOW, 'attacker') });
  await assert.rejects(handleWebhook(a), /no match/);
  assert.equal(a.store.m.size, 0);
});
test('unhandled types are recorded as ignored, failed payments carry the amount due', async () => {
  const ign = args(event({ id: 'evt_2', type: 'customer.created' }));
  assert.equal((await handleWebhook(ign)).status, 'ignored');
  const fail = await handleWebhook(args(event({ id: 'evt_3', type: 'invoice.payment_failed' })));
  assert.equal(fail.paid, false);
  assert.equal(fail.amountCents, 5000);
});
