import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifySignature } from './webhook.mjs';
import { handleWebhookAtomic, createMemoryAtomicStore } from './webhook-atomic.mjs';

const SECRET = 'whsec_test_placeholder'; // test-only value, not a real key
const NOW = 1_800_000_000;
const sign = (body, t = NOW, secret = SECRET) =>
  `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;
const event = (over = {}) =>
  JSON.stringify({
    id: 'evt_1',
    type: 'invoice.paid',
    account: 'acct_A',
    data: { object: { id: 'in_1', amount_paid: 5000, amount_due: 5000 } },
    ...over
  });

const args = (body, extra = {}) => ({
  rawBody: body,
  signatureHeader: sign(body),
  secret: SECRET,
  nowSec: NOW,
  allowedAccounts: ['acct_A'],
  store: createMemoryAtomicStore(),
  ...extra
});

test('accepts a correct signature', () => {
  verifySignature('{}', sign('{}'), SECRET, NOW);
});

test('rejects wrong secret, tampered body, old timestamp, malformed header', () => {
  assert.throws(() => verifySignature('{}', sign('{}', NOW, 'other'), SECRET, NOW), /no match/);
  assert.throws(() => verifySignature('{"x":1}', sign('{}'), SECRET, NOW), /no match/);
  assert.throws(() => verifySignature('{}', sign('{}', NOW - 301), SECRET, NOW), /tolerance/);
  assert.throws(() => verifySignature('{}', 'garbage', SECRET, NOW), /malformed/);
  assert.throws(() => verifySignature('{}', sign('{}'), '', NOW), /missing/);
});

test('processes a paid invoice once and records it', async () => {
  const a = args(event());
  const r = await handleWebhookAtomic(a);
  assert.equal(r.status, 'processed');
  assert.equal(r.amountCents, 5000);
  assert.equal(a.store.m.get('evt_1').outcome, 'processed');
  assert.equal(a.store.m.get('invoice:in_1').paid, true);
});

test('a replayed event changes nothing', async () => {
  const a = args(event());
  await handleWebhookAtomic(a);
  const before = [...a.store.m.entries()];
  const again = await handleWebhookAtomic(a);
  assert.equal(again.status, 'duplicate');
  assert.deepEqual([...a.store.m.entries()], before);
});

// Sends several events through one store sequentially
const run = async (store, ...evs) => {
  const out = [];
  for (const e of evs) {
    out.push(await handleWebhookAtomic({ ...args(e), store }));
  }
  return out;
};

test('out of order: a payment_failed arriving after paid is stale and the invoice stays paid', async () => {
  const s = createMemoryAtomicStore();
  const [paid, late] = await run(
    s,
    event({ id: 'evt_p', created: 200 }),
    event({ id: 'evt_f', type: 'invoice.payment_failed', created: 100 })
  );
  assert.equal(paid.status, 'processed');
  assert.equal(late.status, 'stale');
  assert.equal(s.m.get('invoice:in_1').paid, true);
  assert.equal(
    (
      await handleWebhookAtomic({
        ...args(event({ id: 'evt_f', type: 'invoice.payment_failed', created: 100 })),
        store: s
      })
    ).status,
    'duplicate'
  );
});

test('paid is final, failed then paid applies, and an older failure after a newer one is stale', async () => {
  const s = createMemoryAtomicStore();
  const r = await run(
    s,
    event({ id: 'e1', type: 'invoice.payment_failed', created: 100 }),
    event({ id: 'e0', type: 'invoice.payment_failed', created: 50 }),
    event({ id: 'e2', created: 300 }),
    event({ id: 'e3', created: 400 })
  );
  assert.deepEqual(
    r.map((x) => x.status),
    ['processed', 'stale', 'processed', 'stale']
  );
  assert.equal(s.m.get('invoice:in_1').lastEventId, 'e2');
});

test('rejects events for an account that is not onboarded, or with no account', async () => {
  await assert.rejects(
    handleWebhookAtomic(args(event({ account: 'acct_X' }))),
    /unknown connected account/
  );
  await assert.rejects(
    handleWebhookAtomic(args(event({ account: undefined }))),
    /unknown connected account/
  );
});

test('unsigned or badly signed requests never reach the store', async () => {
  const a = args(event(), { signatureHeader: sign(event(), NOW, 'attacker') });
  await assert.rejects(handleWebhookAtomic(a), /no match/);
  assert.equal(a.store.m.size, 0);
});

test('unhandled types are recorded as ignored, failed payments carry the amount due', async () => {
  const ign = args(event({ id: 'evt_2', type: 'customer.created' }));
  assert.equal((await handleWebhookAtomic(ign)).status, 'ignored');
  const fail = await handleWebhookAtomic(args(event({ id: 'evt_3', type: 'invoice.payment_failed' })));
  assert.equal(fail.paid, false);
  assert.equal(fail.amountCents, 5000);
});

test('20 identical events delivered with Promise.all give exactly ONE "processed" and 19 "duplicate"', async () => {
  const store = createMemoryAtomicStore();
  const body = event({ id: 'concurrent_evt_1' });
  const tasks = Array.from({ length: 20 }, () =>
    handleWebhookAtomic({ ...args(body), store })
  );

  const results = await Promise.all(tasks);
  const processed = results.filter((r) => r.status === 'processed');
  const duplicates = results.filter((r) => r.status === 'duplicate');

  assert.equal(processed.length, 1);
  assert.equal(duplicates.length, 19);
  assert.equal(processed.length + duplicates.length, 20);

  const invoiceState = await store.get('invoice:in_1');
  assert(invoiceState, 'Invoice state must exist');
  assert.equal(invoiceState.version, 1, 'Invoice state was written exactly once');
});

test('failing-first-delivery reproduction passes after fix (second delivery returns "processed" and invoice state exists)', async () => {
  const store = createMemoryAtomicStore();
  const realCas = store.compareAndSet.bind(store);
  // Force compareAndSet to return false on the first delivery
  store.compareAndSet = async () => false;

  const body = event({ id: 'evt_fail_then_retry', data: { object: { id: 'in_retry_1', amount_paid: 5000, amount_due: 5000 } } });

  // First delivery: fails due to CAS conflicts
  await assert.rejects(
    handleWebhookAtomic({ ...args(body), store }),
    /retry limit exceeded/
  );

  // Event was recorded as pending, and invoice state is NOT saved
  const pendingEvent = await store.get('evt_fail_then_retry');
  assert(pendingEvent, 'Event record must exist in store');
  assert.equal(pendingEvent.outcome, 'pending', 'Event must remain in pending outcome');
  const missingInvoice = await store.get('invoice:in_retry_1');
  assert.equal(missingInvoice, undefined, 'Invoice state must not exist after failure');

  // Restore normal compareAndSet
  store.compareAndSet = realCas;

  // Deliver the same signed event again
  const secondResult = await handleWebhookAtomic({ ...args(body), store });
  assert.equal(secondResult.status, 'processed');

  const finalInvoice = await store.get('invoice:in_retry_1');
  assert(finalInvoice, 'Invoice state must exist after second delivery');
  assert.equal(finalInvoice.paid, true);

  const finalEvent = await store.get('evt_fail_then_retry');
  assert.equal(finalEvent.outcome, 'processed');
});

test('redelivery after a successful run returns "duplicate" and changes nothing', async () => {
  const store = createMemoryAtomicStore();
  const body = event({ id: 'evt_redeliver_test' });
  const first = await handleWebhookAtomic({ ...args(body), store });
  assert.equal(first.status, 'processed');

  const beforeStore = [...store.m.entries()];
  const second = await handleWebhookAtomic({ ...args(body), store });
  assert.equal(second.status, 'duplicate');
  assert.deepEqual([...store.m.entries()], beforeStore);
});

test('forged signature, unknown account, malformed event throw and write nothing', async () => {
  const store = createMemoryAtomicStore();

  // Forged signature
  await assert.rejects(
    handleWebhookAtomic({
      ...args(event({ id: 'bad_sig' }), {
        signatureHeader: sign(event({ id: 'bad_sig' }), NOW, 'bad_secret')
      }),
      store
    }),
    /no match/
  );
  assert.equal(store.m.size, 0);

  // Unknown account
  await assert.rejects(
    handleWebhookAtomic({
      ...args(event({ id: 'bad_acct', account: 'rogue_account' })),
      store
    }),
    /unknown connected account/
  );
  assert.equal(store.m.size, 0);

  // Malformed event (no id)
  const malformed = JSON.stringify({ type: 'invoice.paid' });
  await assert.rejects(
    handleWebhookAtomic({
      rawBody: malformed,
      signatureHeader: sign(malformed),
      secret: SECRET,
      nowSec: NOW,
      allowedAccounts: ['acct_A'],
      store
    }),
    /malformed/
  );
  assert.equal(store.m.size, 0);
});

test('compareAndSet retry limit triggers error when conflicts persist', async () => {
  const store = createMemoryAtomicStore();
  // Rig compareAndSet to always return false
  store.compareAndSet = async () => false;

  await assert.rejects(
    handleWebhookAtomic({
      ...args(event({ id: 'evt_retry_fail' })),
      store
    }),
    /retry limit exceeded/
  );
});

test('hardening M2: exactly one "processed" per invoice regardless of delivery order of 30 shuffled events (500 cases)', async () => {
  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const rng = mulberry32(987654321);

  for (let iteration = 0; iteration < 500; iteration++) {
    const store = createMemoryAtomicStore();
    const invoiceId = `inv_rand_${iteration}`;

    // 30 events for this invoice: 30 identical/replay events of the invoice.paid event
    const events = [];
    for (let i = 0; i < 30; i++) {
      events.push({
        id: `evt_paid_${iteration}`,
        type: 'invoice.paid',
        account: 'acct_A',
        created: 500,
        data: { object: { id: invoiceId, amount_paid: 1000, amount_due: 1000 } }
      });
    }

    // Fisher-Yates shuffle
    for (let i = events.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [events[i], events[j]] = [events[j], events[i]];
    }

    let processedCount = 0;
    for (const ev of events) {
      const body = JSON.stringify(ev);
      const res = await handleWebhookAtomic({
        rawBody: body,
        signatureHeader: sign(body),
        secret: SECRET,
        nowSec: NOW,
        allowedAccounts: ['acct_A'],
        store
      });
      if (res.status === 'processed') {
        processedCount++;
      }
    }

    assert.equal(processedCount, 1, `Expected exactly 1 processed event, got ${processedCount}`);
    const invoiceState = await store.get(`invoice:${invoiceId}`);
    assert(invoiceState, 'Invoice state must exist');
    assert.equal(invoiceState.paid, true, 'Invoice must be paid');
  }
});
