import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHmac } from 'node:crypto';
import { createApp } from './server.mjs';
import { createTableStore } from './store.mjs';
import { createSqliteTable } from './sqliteTable.mjs';

const SECRET = 'whsec_test_not_real', NOW = 1_800_000_000;
const sign = (body, t = NOW) => `t=${t},v1=${createHmac('sha256', SECRET).update(`${t}.${body}`).digest('hex')}`;
const ev = id => JSON.stringify({ id, type: 'invoice.paid', created: NOW - 5, account: 'acct_ok', data: { object: { id: 'in_1', amount_paid: 5000, amount_due: 5000 } } });

async function run(fn, { secret = true } = {}) {
  const table = createSqliteTable(':memory:');
  const deps = { store: createTableStore(table), webhookSecret: () => { if (!secret) throw new Error('none'); return SECRET; }, secretConfigured: () => secret, nowSec: () => NOW, allowedAccounts: ['acct_ok'], version: 't' };
  const server = http.createServer(createApp(deps));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn(base, deps); } finally { server.close(); table.close(); }
}
const post = (base, body, sig) => fetch(`${base}/api/stripe/webhook`, { method: 'POST', body, headers: sig ? { 'stripe-signature': sig } : {} });

test('health: ok, reports secret state, no secrets', async () => {
  await run(async base => { const j = await (await fetch(`${base}/api/health`)).json(); assert.equal(j.ok, true); assert.equal(j.webhookSecretConfigured, true); assert.ok(!JSON.stringify(j).includes(SECRET)); });
  await run(async base => { assert.equal((await (await fetch(`${base}/api/health`)).json()).webhookSecretConfigured, false); }, { secret: false });
});
test('webhook over HTTP: processed once, duplicate on retry, persisted', async () => {
  await run(async (base, deps) => {
    const b = ev('evt_1');
    assert.deepEqual(await (await post(base, b, sign(b))).json(), { status: 'processed' });
    assert.deepEqual(await (await post(base, b, sign(b))).json(), { status: 'duplicate' });
    assert.equal(await deps.store.has('evt_1'), true);
    assert.ok((await (await fetch(`${base}/api/health`)).json()).lastWebhookAt);
  });
});
test('webhook over HTTP: bad or missing signature is 400 and stores nothing', async () => {
  await run(async (base, deps) => {
    const b = ev('evt_2');
    assert.equal((await post(base, b, 't=1,v1=00')).status, 400);
    assert.equal((await post(base, b)).status, 400);
    assert.equal(await deps.store.has('evt_2'), false);
  });
});
test('webhook with no secret configured fails closed (500 so Stripe retries)', async () => {
  await run(async base => { const b = ev('evt_3'); assert.equal((await post(base, b, sign(b))).status, 500); }, { secret: false });
});
test('routing: wrong method 405, unknown 404, oversize 413, my-invoices 501', async () => {
  await run(async base => {
    assert.equal((await fetch(`${base}/api/stripe/webhook`)).status, 405);
    assert.equal((await fetch(`${base}/api/health`, { method: 'POST' })).status, 405);
    assert.equal((await fetch(`${base}/nope`)).status, 404);
    assert.equal((await fetch(`${base}/api/billing/my-invoices`)).status, 501);
    const r = await post(base, 'x'.repeat(300 * 1024), 't=1,v1=00').catch(() => ({ status: 413 }));
    assert.equal(r.status, 413);
  });
});
test('sqlite table: insert once, replace needs the current etag, upsert overwrites', async () => {
  const t = createSqliteTable(':memory:');
  assert.equal(await t.insert('a', { n: 1 }), true);
  assert.equal(await t.insert('a', { n: 2 }), false);
  const r = await t.get('a'); assert.equal(r.n, 1);
  assert.equal(await t.replace('a', { n: 3 }, r.etag + 5), false);
  assert.equal(await t.replace('a', { n: 3 }, r.etag), true);
  assert.equal((await t.get('a')).n, 3);
  await t.upsert('b', { n: 9 }); await t.upsert('b', { n: 10 });
  assert.equal((await t.get('b')).n, 10);
  t.close();
});
