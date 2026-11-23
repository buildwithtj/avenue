import test from 'node:test';
import assert from 'node:assert/strict';
import { createBridge, bridgeFromEnv } from './bridge.mjs';

const URLS = { AvenueApplicants: 'https://flow.example/applicants?sig=SECRETSIG', AvenueMembers: 'https://flow.example/members?sig=SECRETSIG',
  AvenueInvoices: 'https://flow.example/invoices?sig=SECRETSIG', AvenueHoursLedger: 'https://flow.example/ledger?sig=SECRETSIG' };
const GRANT = 'https://flow.example/grant?sig=SECRETSIG';
/** Fake narrow flows: `route(url, req)` returns {status, body}; every request the host sends is recorded with the URL it went to. */
function flows(route, opts = {}) {
  const sent = [];
  const fetch = async (u, o) => { const r = JSON.parse(o.body); sent.push({ url: u, ...r }); const out = await route(u, r); if (out instanceof Error) throw out; return { ok: true, status: 200, json: async () => out }; };
  return { sent, bridge: createBridge({ urls: URLS, grantUrl: GRANT, fetch, sleep: async () => {}, ...opts }) };
}
const ok = (body) => ({ status: 200, body });

test('query: routed to the list flow, suffix starts with /items, escaped, select and top validated', async () => {
  const { sent, bridge } = flows(() => ok({ value: [{ Id: 1 }] }));
  assert.deepEqual(await bridge.query('AvenueMembers', "MemberId eq 'o''x@b.com'", ['MemberId'], 1), [{ Id: 1 }]);
  assert.equal(sent[0].url, URLS.AvenueMembers);
  assert.equal(sent[0].method, 'GET');
  assert.equal(sent[0].suffix, "/items?$filter=MemberId%20eq%20'o''x%40b.com'&$select=MemberId&$top=1");
  assert.equal(sent[0].headers.accept, 'application/json;odata=nometadata');
  assert.equal('uri' in sent[0], false);
  await bridge.query('AvenueApplicants', 'x', ['Id']); await bridge.query('AvenueHoursLedger', "MemberId eq 'a'", ['Hours'], 5);
  assert.deepEqual(sent.slice(1).map(r => r.url), [URLS.AvenueApplicants, URLS.AvenueHoursLedger]);
  await assert.rejects(bridge.query('AvenueMembers', 'x', ['a b'], 1), /bad field/);
  await assert.rejects(bridge.query('AvenueMembers', 'x', ['A'], 0), /bad top/);
});

test('allow-list: unknown list throws before any request; the ledger can never be written', async () => {
  const { sent, bridge } = flows(() => ok({}));
  await assert.rejects(bridge.query('AvenueBookings', 'x', ['Id']), /not allowed/);
  await assert.rejects(bridge.upsert('AvenueHoursLedger', 'EntryId', 'e', { Hours: 1 }), /not allowed/);
  await assert.rejects(bridge.upsert("AvenueMembers')/x", 'MemberId', 'e', {}), /not allowed/);
  await assert.rejects(bridge.upsert('AvenueMembers', 'MemberId', 'e', {}, 'a@b.com'), /bad grantTo/);   // grant is for invoices only
  assert.equal(sent.length, 0);
});

test('every suffix the host can send starts with /items and carries no metadata', async () => {
  const { sent, bridge } = flows((u, r) => r.method === 'GET' ? ok({ value: sent.length > 2 ? [{ Id: 3 }] : [] }) : ok({ Id: 3 }));
  await bridge.upsert('AvenueApplicants', 'ApplicantId', 'a1', { Stage: 'Paid' });   // create
  await bridge.upsert('AvenueApplicants', 'ApplicantId', 'a1', { Stage: 'Paid' });   // update
  assert.ok(sent.length >= 4);
  for (const r of sent) { assert.match(r.suffix, /^\/items/); assert.doesNotMatch(r.suffix, /role|delete|recycle|\.\./i); assert.equal(JSON.stringify(r.body ?? {}).includes('__metadata'), false); }
});

test('upsert create: apostrophe doubled in the key lookup, POST /items with nometadata headers, dates as ISO, no entity-type lookup', async () => {
  const { sent, bridge } = flows((u, r) => r.method === 'GET' ? ok({ value: [] }) : ok({ Id: 7 }));
  const out = await bridge.upsert('AvenueMembers', 'MemberId', "o'b@x.com", { Status: 'Active', PaidAt: new Date('2026-11-21T12:00:00Z') });
  assert.deepEqual(out, { id: 7 });
  assert.match(sent[0].suffix, /\$filter=MemberId%20eq%20'o''b%40x\.com'/);
  assert.equal(sent.length, 2);
  const post = sent[1];
  assert.equal(post.url, URLS.AvenueMembers); assert.equal(post.method, 'POST'); assert.equal(post.suffix, '/items');
  assert.equal(post.headers['content-type'], 'application/json;odata=nometadata');
  assert.deepEqual(post.body, { Status: 'Active', PaidAt: '2026-11-21T12:00:00.000Z' });
});

test('upsert update: MERGE items(<Id>) with X-HTTP-Method and IF-MATCH; no grant call without grantTo', async () => {
  const { sent, bridge } = flows((u, r) => r.method === 'GET' ? ok({ value: [{ Id: 42 }] }) : ok(null));
  assert.deepEqual(await bridge.upsert('AvenueApplicants', 'ApplicantId', 'app-1', { Stage: 'Paid' }), { id: 42 });
  const post = sent.at(-1);
  assert.equal(post.suffix, '/items(42)'); assert.equal(post.url, URLS.AvenueApplicants);
  assert.equal(post.headers['X-HTTP-Method'], 'MERGE'); assert.equal(post.headers['IF-MATCH'], '*');
  assert.equal(sent.some(r => r.url === GRANT), false);
});

test('grantTo: after the write, one call to the grant flow with {itemId, email}; string or {grantTo}', async () => {
  const { sent, bridge } = flows((u, r) => u === GRANT ? ok(null) : r.method === 'GET' ? ok({ value: [] }) : ok({ Id: 101 }));
  assert.deepEqual(await bridge.upsert('AvenueInvoices', 'InvoiceId', 'in_1', { Status: 'paid' }, 'm@b.com'), { id: 101, granted: true });
  const g = sent.filter(r => r.url === GRANT);
  assert.equal(g.length, 1); assert.deepEqual(g[0], { url: GRANT, itemId: 101, email: 'm@b.com' });
  assert.equal(sent.at(-1).url, GRANT);   // grant is last: after the item exists
  assert.equal((await bridge.upsert('AvenueInvoices', 'InvoiceId', 'in_2', {}, { grantTo: 'n@b.com' })).granted, true);
  await assert.rejects(bridge.upsert('AvenueInvoices', 'InvoiceId', 'in_3', {}, 'not-an-email'), /bad grantTo/);
});

test('grantTo: a failing or missing grant flow is not fatal (the invoice mirror still succeeds)', async () => {
  const { bridge } = flows((u, r) => u === GRANT ? { status: 400, body: { secret: 'x' } } : r.method === 'GET' ? ok({ value: [{ Id: 9 }] }) : ok(null));
  assert.deepEqual(await bridge.upsert('AvenueInvoices', 'InvoiceId', 'in_1', { Status: 'open' }, 'guest@b.com'), { id: 9, granted: false });
  const none = createBridge({ urls: URLS, fetch: async (u, o) => ({ ok: true, json: async () => (JSON.parse(o.body).method === 'GET' ? ok({ value: [] }) : ok({ Id: 4 })) }), sleep: async () => {} });
  assert.deepEqual(await none.upsert('AvenueInvoices', 'InvoiceId', 'in_1', {}, 'guest@b.com'), { id: 4, granted: false });
});

test('errors: status >= 300 throws without the signed URL or the body; unconfigured list says so', async () => {
  const { bridge } = flows(() => ({ status: 403, body: { error: { message: { value: 'PRIVATE DETAIL' } } } }));
  await assert.rejects(bridge.query('AvenueMembers', 'x', ['Id']), e => /403/.test(e.message) && !/SECRETSIG|PRIVATE|flow\.example/.test(e.message));
  const flowDown = createBridge({ urls: URLS, fetch: async () => ({ ok: false, status: 502 }), sleep: async () => {} });
  await assert.rejects(flowDown.query('AvenueMembers', 'x', ['Id']), e => /502/.test(e.message) && !/SECRETSIG/.test(e.message));
  const partial = createBridge({ urls: { AvenueMembers: URLS.AvenueMembers }, fetch: async () => { throw new Error('must not be called'); } });
  await assert.rejects(partial.query('AvenueApplicants', 'f', ['Id']), /not configured/);
  await assert.rejects(partial.upsert('AvenueInvoices', 'InvoiceId', 'i', {}), /not configured/);
});

test('retry: one retry after 500 ms on network error, 429 or 5xx; no retry on 4xx', async () => {
  const pauses = []; let calls = 0;
  const flaky = createBridge({ urls: URLS, sleep: async (ms) => { pauses.push(ms); }, fetch: async () => {
    calls++; if (calls === 1) throw new Error('ECONNRESET');
    return { ok: true, json: async () => (calls === 2 ? { status: 429 } : { status: 200, body: { value: [{ Id: 1 }] } }) };
  } });
  await assert.rejects(flaky.query('AvenueMembers', 'x', ['Id']), /429/);   // network error retried, then 429 is the second and last attempt
  assert.deepEqual(pauses, [500]); assert.equal(calls, 2);
  let c2 = 0;
  const recover = createBridge({ urls: URLS, sleep: async () => {}, fetch: async () => { c2++; return { ok: true, json: async () => (c2 === 1 ? { status: 503 } : { status: 200, body: { value: [{ Id: 3 }] } }) }; } });
  assert.deepEqual(await recover.query('AvenueMembers', 'x', ['Id']), [{ Id: 3 }]);
  let c3 = 0;
  const no = createBridge({ urls: URLS, sleep: async () => {}, fetch: async () => { c3++; return { ok: true, json: async () => ({ status: 404 }) }; } });
  await assert.rejects(no.query('AvenueMembers', 'x', ['Id']), /404/); assert.equal(c3, 1);
});

test('bridgeFromEnv: complete only when all four list flows and the grant flow are set', () => {
  const env = { SP_BRIDGE_APPLICANTS: 'a', SP_BRIDGE_MEMBERS: 'm', SP_BRIDGE_INVOICES: 'i', SP_BRIDGE_LEDGER: 'l', SP_BRIDGE_GRANT: 'g' };
  assert.equal(bridgeFromEnv(env, fetch).complete, true);
  assert.equal(bridgeFromEnv({ ...env, SP_BRIDGE_GRANT: '' }, fetch).complete, false);
  assert.equal(bridgeFromEnv({ ...env, SP_BRIDGE_LEDGER: '' }, fetch).complete, false);
  const none = bridgeFromEnv({}, fetch); assert.equal(none.bridge, undefined); assert.equal(none.complete, false);
});
