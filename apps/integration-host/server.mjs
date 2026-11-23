// Plain Node HTTP host (no framework, no dependency). [PROPOSED, Q-01] Runs on the AWS Ubuntu instance the client supplied. TEST MODE ONLY (STR-06).
// Routes: GET /api/health, POST /api/stripe/webhook, POST /api/bridge/request, GET|POST /join, GET /join/done (join only when JOIN_PUBLIC=1).
// my-invoices stays 501 (members read AvenueInvoices in SharePoint instead). Never logs bodies, headers or secrets; secrets come from the environment.
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { health } from './handlers.mjs';
import { processEvent } from './events.mjs';
import { bridgeRequest, bridgeFromEnv } from './bridge.mjs';
import { joinForm, joinPost, donePage, rateLimiter } from './join.mjs';
import { createStripeClient } from './stripeClient.mjs';
import { createTableStore } from './store.mjs';
import { createSqliteTable } from './sqliteTable.mjs';
import { createSwiftClient } from './swiftClient.mjs';
import { createSensorJob } from './sensorJob.mjs';

const MAX_BODY = 256 * 1024;
const send = (res, status, body) => { const s = JSON.stringify(body); res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(s), 'cache-control': 'no-store' }); res.end(s); };
const html = (res, status, s) => { res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-frame-options': 'DENY', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https://checkout.stripe.com" }); res.end(s); };

function readBody(req) {
  return new Promise((resolve, reject) => {
    const parts = []; let n = 0;
    req.on('data', c => { n += c.length; if (n > MAX_BODY) { reject(Object.assign(new Error('too large'), { status: 413 })); req.destroy(); } else parts.push(c); });
    req.on('end', () => resolve(Buffer.concat(parts).toString('utf8')));
    req.on('error', reject);
  });
}

/** Builds the request listener. `deps`: store, webhookSecret(), nowSec(), allowedAccounts, version, secretConfigured(), and optionally
 *  bridge, stripe, account, bridgeKey, portalUrl, publicBaseUrl, joinPublic, applicationDays, state {chargesEnabled}. */
export function createApp(deps, log = () => {}) {
  let lastWebhookAt = null;
  const d = { ...deps, log, state: deps.state || {}, allow: deps.allow || rateLimiter(), lastWebhookAt: () => lastWebhookAt };
  return async (req, res) => {
    const path = new URL(req.url, 'http://x').pathname;
    let status = 500;
    const only = (m) => { if (req.method === m) return true; status = 405; send(res, 405, { error: 'method' }); return false; };
    try {
      if (path === '/api/health') {
        if (only('GET')) {
          const r = await health(d); status = r.status;
          send(res, status, { ...r.body, webhookSecretConfigured: !!deps.secretConfigured?.(), stripeKeyConfigured: !!deps.stripe, bridgeConfigured: (deps.bridgeComplete ?? !!deps.bridge) && !!deps.bridgeKey, joinPublic: !!deps.joinPublic, paymentsRequired: deps.paymentsRequired !== false, chargesEnabled: d.state.chargesEnabled ?? null,
            sensorsConfigured: !!deps.sensors, sensorsReporting: deps.sensors?.status().reporting ?? 0, sensorsNotFound: deps.sensors?.status().unmatched ?? [], callsThisMonth: deps.sensors?.status().callsThisMonth ?? null });
        }
      } else if (path === '/api/stripe/webhook') {
        if (only('POST')) {
          const r = await processEvent({ rawBody: await readBody(req), headers: req.headers }, d);
          if (r.status === 200 && r.body.status === 'processed') lastWebhookAt = new Date(d.nowSec() * 1000).toISOString();
          status = r.status; send(res, status, r.body);
        }
      } else if (path === '/api/bridge/request') {
        if (only('POST')) { const r = await bridgeRequest({ headers: req.headers, rawBody: await readBody(req) }, d); status = r.status; send(res, status, r.body); }
      } else if ((path === '/join' || path === '/join/done') && deps.joinPublic) {
        if (path === '/join/done') { if (only('GET')) html(res, status = 200, donePage()); }
        else if (req.method === 'GET') html(res, status = 200, joinForm());
        else if (only('POST')) {
          const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
          const r = await joinPost(await readBody(req), ip, d); status = r.status;
          if (r.location) { res.writeHead(303, { location: r.location, 'cache-control': 'no-store' }); res.end(); } else html(res, status, r.html);
        }
      } else if (path === '/api/billing/my-invoices') { status = 501; send(res, 501, { error: 'not available: members read AvenueInvoices in SharePoint' }); }
      else { status = 404; send(res, 404, { error: 'not found' }); }
    } catch (e) {
      status = e.status === 413 ? 413 : 500; log(`error ${path}: ${e.message}`);
      if (!res.headersSent) send(res, status, { error: status === 413 ? 'too large' : 'server error' });
    }
    log(`${req.method} ${path} ${status}`);
  };
}

/** Builds deps from the environment (systemd EnvironmentFile, mode 600). Missing Stripe key or bridge = those features answer "not configured". */
export function depsFromEnv(env, { fetchImpl = fetch } = {}) {
  const table = createSqliteTable(env.DB_PATH || './avenue-host.db');
  const bridgeEnv = bridgeFromEnv(env, fetchImpl);
  const allowedAccounts = (env.ALLOWED_ACCOUNTS || '').split(',').map(s => s.trim()).filter(Boolean);
  const store = createTableStore(table), nowSec = () => Math.floor(Date.now() / 1000);
  // Sensors are optional: on only when the Swift credentials AND all four sensor flow URLs are set (docs/ENVIRONMENT_PLAN.md).
  const swift = env.SWIFT_API_KEY && env.SWIFT_USER && env.SWIFT_PASSWORD && bridgeEnv.bridge && bridgeEnv.sensorsComplete
    ? createSwiftClient({ baseUrl: env.SWIFT_BASE_URL || undefined, apiKey: env.SWIFT_API_KEY, user: env.SWIFT_USER, password: env.SWIFT_PASSWORD, valueUnit: ['F', 'C'].includes(env.SWIFT_VALUE_UNIT) ? env.SWIFT_VALUE_UNIT : undefined, fetch: fetchImpl, nowSec }) : undefined;
  const sensors = swift && createSensorJob({ swift, bridge: bridgeEnv.bridge, store, nowSec, budget: Number(env.SWIFT_MONTHLY_BUDGET) || 100000, log: line => console.log(line) });
  return {
    table, store, nowSec, version: env.HOST_VERSION || 'dev', sensors, lastSensorSyncAt: () => sensors?.status().lastSyncAt ?? null,
    webhookSecret: () => { if (!env.STRIPE_WEBHOOK_SECRET) throw new Error('webhook secret not configured'); return env.STRIPE_WEBHOOK_SECRET; },
    secretConfigured: () => !!env.STRIPE_WEBHOOK_SECRET, allowedAccounts,
    stripe: env.STRIPE_SECRET_KEY ? createStripeClient({ secretKey: env.STRIPE_SECRET_KEY, fetch: fetchImpl }) : undefined,
    account: env.STRIPE_ACCOUNT || allowedAccounts[0],
    bridge: bridgeEnv.bridge, bridgeComplete: bridgeEnv.complete,
    bridgeKey: env.BRIDGE_KEY || '', portalUrl: env.PORTAL_URL || '', publicBaseUrl: (env.PUBLIC_BASE_URL || '').replace(/\/$/, ''),
    joinPublic: env.JOIN_PUBLIC === '1', applicationDays: Number(env.APPLICATION_DAYS || 14),
    paymentsRequired: !(env.PAYMENTS_REQUIRED === '0' && /^(sk|rk)_test_/.test(env.STRIPE_SECRET_KEY || ''))   // only a test key can switch payment off
  };
}

/** Production entry: reads the environment, opens the database, listens. */
export function main(env = process.env) {
  const deps = depsFromEnv(env);
  const server = http.createServer(createApp(deps, line => console.log(line)));
  if (deps.sensors) {   // first poll 30 s after start, then every SWIFT_POLL_MINUTES (default 10); a failed poll is logged with its status/code only and retried next time
    const tick = () => deps.sensors.run().catch(e => console.log(`sensor poll failed${/^(swift|bridge): [^\n]{1,160}$/.test(String(e?.message)) ? `: ${e.message}` : ''}`));   // swift:/bridge: messages carry only a status and a Swift error code
    setTimeout(tick, 30000).unref(); setInterval(tick, (Number(env.SWIFT_POLL_MINUTES) || 10) * 60000).unref();
  } else console.log('sensors off (Swift credentials or the four sensor flow URLs are not set)');
  server.listen(Number(env.PORT || 8080), env.HOST || '0.0.0.0', () => console.log(`avenue host listening on ${env.PORT || 8080}; accounts allowed: ${deps.allowedAccounts.length}; stripe ${deps.stripe ? 'on' : 'off'}; bridge ${deps.bridge ? 'on' : 'off'}; join ${deps.joinPublic ? 'on' : 'off'}`));
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
