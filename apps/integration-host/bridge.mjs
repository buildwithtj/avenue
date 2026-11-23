// SharePoint bridge (docs/MODULES_PLAN.md §11.2). Host -> SharePoint goes through NARROW per-list flows, one URL each (its signature is the
// secret): SP_BRIDGE_APPLICANTS / _MEMBERS / _INVOICES / _LEDGER (read only) and SP_BRIDGE_GRANT. SharePoint -> host arrives at
// POST /api/bridge/request from the flow "Avenue - Host requests" with header x-avenue-bridge-key. Identity is the item author the flow passes.
import { randomUUID, timingSafeEqual, createHash } from 'node:crypto';
import { planById, lookupKey, EVENT_PACKAGES, DEPOSIT_CENTS } from './plans.mjs';

export const FACILITY = 'flavors-hyattsville';
const DAY = 86400;
const OPEN_STAGES = ['PaymentPending', 'Paid', 'InviteNeeded', 'Onboarding'];

const WRITABLE = new Set(['AvenueApplicants', 'AvenueInvoices', 'AvenueMembers', 'AvenueSensorLatest', 'AvenueSensorHourly', 'AvenueTempExcursions']);
const READABLE = new Set([...WRITABLE, 'AvenueHoursLedger', 'AvenueSensors']);   // ledger and the sensor catalogue are read only
export const BRIDGE_ENV = { AvenueApplicants: 'SP_BRIDGE_APPLICANTS', AvenueMembers: 'SP_BRIDGE_MEMBERS', AvenueInvoices: 'SP_BRIDGE_INVOICES', AvenueHoursLedger: 'SP_BRIDGE_LEDGER' };
/** Sensors are optional (docs/ENVIRONMENT_PLAN.md): one narrow flow per list, not part of `complete`. */
export const SENSOR_ENV = { AvenueSensors: 'SP_BRIDGE_SENSORS', AvenueSensorLatest: 'SP_BRIDGE_SENSOR_LATEST', AvenueSensorHourly: 'SP_BRIDGE_SENSOR_HOURLY', AvenueTempExcursions: 'SP_BRIDGE_EXCURSIONS' };
const NAME = /^[A-Za-z][A-Za-z0-9_]*$/;
const lit = (s) => String(s).replace(/'/g, "''");   // OData string literal body
const JSON_H = { 'content-type': 'application/json;odata=nometadata', accept: 'application/json;odata=nometadata' };

/** Host -> SharePoint over narrow flows. Each list flow hard-codes its list: the host POSTs {method, suffix, headers, body} (suffix always starts with /items)
 *  and gets HTTP 200 {status, body}. The ledger flow only reads. status >= 300 is an error with a generic message (no URL, no body);
 *  one retry after 500 ms on network error, 429 or 5xx. `grantUrl` flow: POST {itemId, email} -> {status}; it only touches AvenueInvoices. */
export function createBridge({ urls = {}, grantUrl, fetch, sleep = (ms) => new Promise(r => setTimeout(r, ms)) }) {
  async function call(url, payload, label) {
    if (!url) throw new Error('bridge: not configured');
    for (let attempt = 0; ; attempt++) {
      let status = 0, out;
      try {
        const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
        if (res.ok) { const j = await res.json().catch(() => ({})); status = Number(j.status) || 502; out = j.body; } else status = res.status;
      } catch { status = 0; }
      if ((status === 0 || status === 429 || status >= 500) && attempt === 0) { await sleep(500); continue; }
      if (status === 0 || status >= 300) throw new Error(`bridge: ${label} returned ${status}`);   // never the URL, never the body
      return out;
    }
  }
  const check = (name, write) => { if (!(write ? WRITABLE : READABLE).has(name)) throw new Error(`bridge: list ${name} not allowed`); };
  const relay = (name, method, suffix, headers, body) => {
    if ((name === 'AvenueHoursLedger' || name === 'AvenueSensors') && method !== 'GET') throw new Error(`bridge: ${name} is read only`);
    return call(urls[name], { method, suffix, headers, ...(body !== undefined ? { body } : {}) }, `${method} ${name}${suffix.split('?')[0]}`);
  };
  const names = (a) => { for (const n of a) if (!NAME.test(n)) throw new Error('bridge: bad field name'); return a; };
  const rows = async (name, filter, select, top, write) => {
    check(name, write); names(select);
    if (!Number.isInteger(top) || top < 1 || top > 5000) throw new Error('bridge: bad top');
    return (await relay(name, 'GET', `/items?$filter=${encodeURIComponent(filter)}&$select=${select.join(',')}&$top=${top}`, { accept: JSON_H.accept }))?.value || [];
  };
  return {
    query: (name, filter, select, top = 50) => rows(name, filter, select, top, false),
    /** Update-or-create by `keyField`. `grantTo` (e-mail, string or {grantTo}; AvenueInvoices only) gives that member read on the item. Returns {id, granted?}. */
    async upsert(name, keyField, key, fields, grantArg) {
      check(name, true); names([keyField, ...Object.keys(fields)]);
      const grantTo = typeof grantArg === 'string' ? grantArg : grantArg?.grantTo;
      if (grantTo && (name !== 'AvenueInvoices' || grantTo.length > 254 || !EMAIL.test(grantTo))) throw new Error('bridge: bad grantTo');
      const [hit] = await rows(name, `${keyField} eq '${lit(key)}'`, ['Id'], 1, true);
      const body = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v]));
      let id = hit?.Id;
      if (id) await relay(name, 'POST', `/items(${id})`, { ...JSON_H, 'X-HTTP-Method': 'MERGE', 'IF-MATCH': '*' }, body);
      else id = (await relay(name, 'POST', '/items', JSON_H, body))?.Id;
      if (!grantTo) return { id };
      try { await call(grantUrl, { itemId: id, email: grantTo }, 'grant'); return { id, granted: true }; } catch { return { id, granted: false }; }   // guest not in the site yet: not fatal
    }
  };
}

/** Builds the bridge from env. `complete` is true only when all four list flows and the grant flow are configured. */
export function bridgeFromEnv(env, fetch) {
  const pick = (m) => Object.fromEntries(Object.entries(m).map(([list, v]) => [list, env[v] || '']));
  const urls = pick(BRIDGE_ENV), sensorUrls = pick(SENSOR_ENV);
  const grantUrl = env.SP_BRIDGE_GRANT || '';
  const any = grantUrl || Object.values({ ...urls, ...sensorUrls }).some(Boolean);
  return { bridge: any ? createBridge({ urls: { ...urls, ...sensorUrls }, grantUrl, fetch }) : undefined, complete: !!grantUrl && Object.values(urls).every(Boolean),
    sensorsComplete: Object.values(sensorUrls).every(Boolean) };
}

export const q = (s) => `'${String(s).replace(/'/g, "''")}'`;   // OData string literal
const iso = (sec) => new Date(sec * 1000).toISOString();
const usd = (c) => `$${(c / 100).toFixed(2)}`;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = (v, min, max) => { const s = String(v ?? '').trim(); return s.length >= min && s.length <= max ? s : undefined; };

/** Validates join input; returns {value} or {errors}. */
export function validateJoin(p) {
  const errors = [];
  const plan = planById(p?.planId);
  if (!plan || !plan.openToNew) errors.push('Choose a current membership plan.');
  const businessName = str(p?.businessName, 2, 120); if (!businessName) errors.push('Business name is required (2–120 characters).');
  const contactName = str(p?.contactName, 2, 120); if (!contactName) errors.push('Contact name is required (2–120 characters).');
  const phone = String(p?.phone ?? '').trim(); if (phone.length > 40 || !/^[0-9+()\-.\s]*$/.test(phone)) errors.push('Phone number is not valid.');
  const teamSize = Number(p?.teamSize ?? 1); if (!Number.isInteger(teamSize) || teamSize < 1 || teamSize > 50) errors.push('Team size must be 1 to 50.');
  const collectionDay = Number(p?.collectionDay); if (!Number.isInteger(collectionDay) || collectionDay < 1 || collectionDay > 15) errors.push('Payment day must be the 1st to the 15th.');
  const payMethod = p?.payMethod; if (payMethod !== 'Bank' && payMethod !== 'Card') errors.push('Choose bank account or card.');
  return errors.length ? { errors } : { value: { planId: plan.planId, businessName, contactName, phone, teamSize, collectionDay, payMethod } };
}

/** Next collection day at 12:00 UTC strictly after now (+1 h margin); within one month, as Stripe requires. */
export function nextAnchor(day, nowSec) {
  const d = new Date(nowSec * 1000);
  let t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), day, 12) / 1000;
  if (t <= nowSec + 3600) t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, day, 12) / 1000;
  return t;
}

/** Shared by the portal (Source Portal) and the public page (Source Public). Returns {outcome, link?}. */
export async function startJoin({ email, input, source }, deps) {
  email = String(email || '').trim().toLowerCase();
  if (!EMAIL.test(email)) return { outcome: 'Refused: a valid e-mail address is needed.' };
  const v = validateJoin(input);
  if (v.errors) return { outcome: `Refused: ${v.errors.join(' ')}`, errors: v.errors };
  const j = v.value;
  if ((await deps.bridge.query('AvenueMembers', `MemberId eq ${q(email)} and Status eq 'Active'`, ['MemberId'], 1)).length)
    return { outcome: 'Refused: this e-mail already has an active membership.' };
  const open = await deps.bridge.query('AvenueApplicants', `Email eq ${q(email)} and (${OPEN_STAGES.map(s => `Stage eq '${s}'`).join(' or ')})`, ['ApplicantId', 'Stage'], 5);
  const pending = open.find(a => a.Stage === 'PaymentPending');
  if (open.length && !pending) return { outcome: 'Refused: an application for this e-mail is already being processed.' };
  const applicantId = pending?.ApplicantId || `app-${randomUUID()}`;
  const now = deps.nowSec();
  if (deps.paymentsRequired === false) {   // TEST MODE ONLY (PAYMENTS_REQUIRED=0, refused unless the Stripe key is a test key): no Checkout, applicant goes straight to Onboarding. Default is payment required.
    const portal = source === 'Portal';
    await deps.bridge.upsert('AvenueApplicants', 'ApplicantId', applicantId, {
      FacilityId: FACILITY, ApplicantId: applicantId, Email: email, BusinessName: j.businessName, ContactName: j.contactName, Phone: j.phone,
      PlanId: j.planId, CollectionDay: j.collectionDay, TeamSize: j.teamSize, PayMethod: j.payMethod, Stage: portal ? 'Onboarding' : 'InviteNeeded', Source: source,
      Note: 'Test mode: payment skipped (PAYMENTS_REQUIRED=0). No money was charged.'
    });
    await deps.bridge.upsert('AvenueMembers', 'MemberId', email, {
      FacilityId: FACILITY, MemberId: email, BusinessName: j.businessName, PlanId: j.planId, CollectionDay: j.collectionDay, Status: 'Onboarding', PayMethod: j.payMethod, PaymentStatus: 'Current'
    });
    return { outcome: 'Test mode: payment skipped, nothing was charged. Refresh this page to open your account.', ...(portal ? {} : { link: `${deps.publicBaseUrl}/join/done` }) };
  }
  const [price] = await deps.stripe.pricesByLookupKeys(deps.account, [lookupKey(j.planId, j.payMethod)]);
  if (!price) throw new Error(`stripe: no price for ${j.planId}`);
  await deps.bridge.upsert('AvenueApplicants', 'ApplicantId', applicantId, {
    FacilityId: FACILITY, ApplicantId: applicantId, Email: email, BusinessName: j.businessName, ContactName: j.contactName, Phone: j.phone,
    PlanId: j.planId, CollectionDay: j.collectionDay, TeamSize: j.teamSize, PayMethod: j.payMethod, Stage: 'PaymentPending', Source: source,
    ExpiresAt: iso(now + (deps.applicationDays || 14) * DAY)
  });
  const meta = { applicantId, planId: j.planId, payMethod: j.payMethod, collectionDay: j.collectionDay, source };
  const portal = source === 'Portal';
  const pmConfig = await methodConfig(deps, j.payMethod);
  const session = await deps.stripe.createCheckoutSession(deps.account, {
    mode: 'subscription', line_items: [{ price: price.id, quantity: 1 }], customer_email: email, client_reference_id: applicantId,
    metadata: meta, subscription_data: { metadata: meta, billing_cycle_anchor: nextAnchor(j.collectionDay, now) },   // Q-M5: prorated first payment (Stripe default)
    ...(pmConfig ? { payment_method_configuration: pmConfig } : {}),   // Bank/Card choice: see pmconfig.mjs (Stripe no longer takes payment_method_types)
    expires_at: now + DAY - 600,
    success_url: portal ? `${deps.portalUrl}#welcome` : `${deps.publicBaseUrl}/join/done`,
    cancel_url: portal ? `${deps.portalUrl}#join` : `${deps.publicBaseUrl}/join`,
    ...(j.payMethod === 'Card' ? { custom_text: { submit: { message: 'Card payments include a 3% card processing fee. Choose bank account (ACH) on the previous page to avoid it.' } } } : {})
  });
  return { outcome: 'Payment link ready', link: session.url };
}

const PM_NAMES = { Bank: 'Avenue bank only', Card: 'Avenue card only' };
/** Id of the connected account's payment-method setting for this choice (cached). Undefined when it was not created: Checkout then offers the account's default methods. */
async function methodConfig(deps, method) {
  if (deps.pmConfigs?.[method]) return deps.pmConfigs[method];
  const list = (await deps.stripe.get('/payment_method_configurations', { limit: 100 }, deps.account).catch(() => ({}))).data || [];
  const found = list.find(c => c.name === PM_NAMES[method] && c.active !== false);
  if (found) { deps.pmConfigs = { ...deps.pmConfigs, [method]: found.id }; return found.id; }
}

const memberRow = async (deps, email) => (await deps.bridge.query('AvenueMembers', `MemberId eq ${q(email)}`, ['MemberId', 'StripeCustomerId', 'SubscriptionId', 'PayMethod'], 1))[0];
const parse = (p) => { if (typeof p !== 'string') return p || {}; try { return JSON.parse(p || '{}'); } catch { return {}; } };

const KINDS = {
  Join: (r, deps) => startJoin({ email: r.author, input: parse(r.payload), source: 'Portal' }, deps),

  async PaymentPortal(r, deps) {
    const m = await memberRow(deps, r.author);
    const customer = m?.StripeCustomerId || (await deps.stripe.customersByEmail(deps.account, r.author))[0]?.id;
    if (!customer) return { outcome: 'Refused: no payment account found for you yet.' };
    const s = await deps.stripe.createPortalSession(deps.account, customer, `${deps.portalUrl}#billing`);
    return { outcome: 'Payment page ready', link: s.url };
  },

  async AccountLink(r, deps) {
    const l = await deps.stripe.createAccountLink(deps.account, deps.portalUrl, deps.portalUrl);
    return { outcome: 'Stripe onboarding link ready (expires in a few minutes)', link: l.url };
  },

  async EventInvoice(r, deps) {
    const p = parse(r.payload);
    const email = String(p.memberEmail || '').trim().toLowerCase();
    const pkg = EVENT_PACKAGES.find(x => x.name === p.packageName);
    const eventSec = /^\d{4}-\d{2}-\d{2}$/.test(p.eventDate || '') ? Date.parse(`${p.eventDate}T12:00:00Z`) / 1000 : NaN;
    const now = deps.nowSec();
    if (!EMAIL.test(email) || !pkg || !(eventSec > now)) return { outcome: 'Refused: need a valid e-mail, package (Simplicity, Opulence, Elevation, Platinum) and a future event date.' };
    const customer = (await deps.stripe.customersByEmail(deps.account, email))[0]?.id
      || (await deps.stripe.createCustomer(deps.account, { email }, `event-${r.requestId}-customer`)).id;
    const amount = p.member === false ? pkg.guestCents : pkg.memberCents;
    const make = async (part, cents, dueSec, description) => {
      const inv = await deps.stripe.createInvoice(deps.account, { customer, collection_method: 'send_invoice', due_date: dueSec, pending_invoice_items_behavior: 'exclude', metadata: { kind: 'Event', requestId: r.requestId, part } }, `event-${r.requestId}-${part}`);
      await deps.stripe.createInvoiceItem(deps.account, { customer, amountCents: cents, description, invoice: inv.id }, `event-${r.requestId}-${part}-item`);
      return deps.stripe.finalizeInvoice(deps.account, inv.id);
    };
    const depositDue = now + DAY, balanceDue = Math.max(eventSec - 30 * DAY, now + DAY);
    const dep = await make('deposit', DEPOSIT_CENTS, depositDue, `Refundable security deposit, ${pkg.name} event on ${p.eventDate}`);
    await make('balance', amount, balanceDue, `${pkg.name} private event (${pkg.hours} h) on ${p.eventDate}`);
    return { outcome: `Event invoices created: deposit ${usd(DEPOSIT_CENTS)} due ${iso(depositDue).slice(0, 10)}, balance ${usd(amount)} due ${iso(balanceDue).slice(0, 10)}`, link: dep.hosted_invoice_url };
  },

  async CancelSubscription(r, deps) {
    const email = String(parse(r.payload).memberEmail || '').trim().toLowerCase();
    const m = email && await memberRow(deps, email);
    if (!m?.SubscriptionId) return { outcome: 'Refused: no subscription found for that member.' };
    const s = await deps.stripe.cancelAtPeriodEnd(deps.account, m.SubscriptionId);
    const end = s.current_period_end ?? s.items?.data?.[0]?.current_period_end;
    return { outcome: `Membership payments end${end ? ` on ${iso(end).slice(0, 10)}` : ' at the end of the paid period'}.` };
  }
};
const STAFF_ONLY = new Set(['AccountLink', 'EventInvoice', 'CancelSubscription']);

const sameKey = (a, b) => { const h = s => createHash('sha256').update(String(s ?? '')).digest(); return !!b && timingSafeEqual(h(a), h(b)); };

/** POST /api/bridge/request. {status, body}. Refusals are 200 so the flow echoes them to the member. */
export async function bridgeRequest({ headers, rawBody }, deps) {
  if (!deps.bridgeKey || !sameKey(headers?.['x-avenue-bridge-key'], deps.bridgeKey)) return { status: 401, body: { error: 'unauthorised' } };
  let r; try { r = JSON.parse(rawBody); } catch { return { status: 400, body: { error: 'bad json' } }; }
  const fn = KINDS[r?.kind];
  if (!fn || !r.requestId) return { status: 200, body: { outcome: 'Refused: unknown request.' } };
  if (!EMAIL.test(String(r.author || ''))) return { status: 200, body: { outcome: 'Refused: unknown requester.' } };
  r.author = String(r.author).trim().toLowerCase();
  if (STAFF_ONLY.has(r.kind) && r.isStaff !== true && r.isStaff !== 'true') return { status: 200, body: { outcome: 'Refused: only Flavors staff can do this.' } };
  try {
    const { outcome, link } = await fn(r, deps);
    return { status: 200, body: link ? { outcome, link } : { outcome } };
  } catch (e) {
    deps.log?.(`bridge ${r.kind} failed: ${e.message}`);
    return { status: 200, body: { outcome: 'Error: could not complete the request. Please try again later.' } };
  }
}
