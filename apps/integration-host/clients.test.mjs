import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createSign } from 'node:crypto';
import { createVerifyJwt } from './jwt.mjs';
import { createAzureTable } from './tableClient.mjs';
import { createTableStore } from './store.mjs';
import { createGraphWriter } from './graphWriter.mjs';
import { createStripeClient } from './stripeClient.mjs';

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1' };
const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const mkJwt = (claims, header = { alg: 'RS256', kid: 'k1' }, key = privateKey) => {
  const p = `${enc(header)}.${enc(claims)}`;
  return `${p}.${createSign('RSA-SHA256').update(p).sign(key).toString('base64url')}`;
};

test('jwt: valid signature returns claims; forgeries refused', async () => {
  const v = createVerifyJwt(async (kid) => kid === 'k1' ? jwk : undefined);
  assert.equal((await v(mkJwt({ aud: 'x' }))).aud, 'x');
  const other = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  await assert.rejects(v(mkJwt({ aud: 'x' }, undefined, other)), /bad signature/);
  await assert.rejects(v(mkJwt({ aud: 'x' }, { alg: 'none', kid: 'k1' })), /unsupported/);
  await assert.rejects(v(mkJwt({ aud: 'x' }, { alg: 'RS256', kid: 'zzz' })), /unknown key/);
  await assert.rejects(v('a.b'), /malformed/);
  const t = mkJwt({ aud: 'x' }); await assert.rejects(v(t.slice(0, -4) + 'AAAA'), /bad signature/);
});

// Fake TableClient with Azure's status codes (409 conflict, 404 missing, 412 ETag mismatch).
function fakeClient() {
  const m = new Map(); let n = 0; const err = (s) => Object.assign(new Error('x'), { statusCode: s });
  return {
    async createEntity(e) { if (m.has(e.rowKey)) throw err(409); m.set(e.rowKey, { ...e, etag: `W/${++n}` }); },
    async getEntity(_p, k) { if (!m.has(k)) throw err(404); return m.get(k); },
    async updateEntity(e, _mode, { etag }) { const c = m.get(e.rowKey); if (!c) throw err(404); if (c.etag !== etag) throw err(412); m.set(e.rowKey, { ...e, etag: `W/${++n}` }); },
    async upsertEntity(e) { m.set(e.rowKey, { ...e, etag: `W/${++n}` }); }
  };
}
test('azure table adapter keeps put-if-absent and compare-and-set semantics', async () => {
  const store = createTableStore(createAzureTable(fakeClient()));
  assert.equal(await store.putIfAbsent({ id: 'evt:1/odd#key', outcome: 'pending' }), true);
  assert.equal(await store.putIfAbsent({ id: 'evt:1/odd#key', outcome: 'pending' }), false);
  assert.equal(await store.compareAndSet('invoice:1', 0, { paid: true }), true);
  assert.equal(await store.compareAndSet('invoice:1', 0, { paid: false }), false);   // stale version
  assert.equal((await store.get('invoice:1')).paid, true);
  const won = await Promise.all([1, 2, 3].map(() => store.putIfAbsent({ id: 'race', v: 1 })));
  assert.equal(won.filter(Boolean).length, 1);
});

const res = (status, body, headers = {}) => ({ ok: status >= 200 && status < 300, status, headers: { get: (k) => headers[k.toLowerCase()] }, json: async () => body });
test('graph writer: posts fields, retries on 429, fails closed, never leaks the token', async () => {
  const calls = []; const seq = [res(429, {}, { 'retry-after': '1' }), res(201, { id: '7' })];
  const w = createGraphWriter({ siteId: 'site,1,2', getToken: async () => 'TOKEN123', sleep: async () => {}, fetch: async (u, o) => { calls.push([u, o]); return seq.shift(); } });
  assert.deepEqual(await w.addItem('AvenueInvoices', { Title: 'a' }), { id: '7' });
  assert.equal(calls.length, 2);
  assert.match(calls[0][0], /lists\/AvenueInvoices\/items$/);
  assert.equal(calls[0][1].headers.authorization, 'Bearer TOKEN123');
  const bad = createGraphWriter({ siteId: 's', getToken: async () => 'TOKEN123', sleep: async () => {}, fetch: async () => res(403, {}) });
  await assert.rejects(bad.addItem('L', {}), (e) => /403/.test(e.message) && !/TOKEN123/.test(e.message));
});
test('stripe client: test keys only, direct-charge header, no key in errors', async () => {
  assert.throws(() => createStripeClient({ secretKey: 'sk_live_abc123', fetch: async () => {} }), /test-mode/);
  assert.throws(() => createStripeClient({ secretKey: '', fetch: async () => {} }), /test-mode/);
  let seen;
  const c = createStripeClient({ secretKey: 'sk_test_abc123', fetch: async (u, o) => { seen = [u, o]; return res(200, { id: 'ii_1' }); } });
  await c.createInvoiceItem('acct_1', { customer: 'cus_1', amountCents: 1250.4, description: 'Extra hours' });
  assert.equal(seen[1].headers['stripe-account'], 'acct_1');
  assert.match(seen[1].body, /amount=1250/);
  await c.createAccountLink('acct_1', 'https://r', 'https://b');
  assert.equal(seen[1].headers['stripe-account'], undefined);
  const bad = createStripeClient({ secretKey: 'sk_test_abc123', fetch: async () => res(400, { error: { code: 'resource_missing', message: 'sk_test_abc123 leaked?' } }) });
  await assert.rejects(bad.createAccountLink('a', 'u', 'v'), (e) => /400/.test(e.message) && !/sk_test/.test(e.message));
});
