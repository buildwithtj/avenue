// Public join page (door B, Q-M2 default: on in test mode). GET/POST /join, GET /join/done. Off (404) unless JOIN_PUBLIC=1.
// No documents are collected here (ONB-04). Honeypot + per-IP rate limit; every value written into HTML is escaped.
import { PLANS } from './plans.mjs';
import { startJoin } from './bridge.mjs';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const usd = (c) => `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const ord = (n) => n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');

const CSS = `*{box-sizing:border-box}body{margin:0;font:16px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;background:#F4F5F7;color:#1F1F1F}
header{background:#0B3A47;color:#fff;padding:14px 16px;display:flex;gap:8px;align-items:center}header b{color:#C9A24D}
main{max-width:720px;margin:0 auto;padding:16px}h1{color:#0F4C5C;font-size:26px;margin:8px 0 4px}h2{color:#0F4C5C;font-size:18px;margin:24px 0 8px}
fieldset{border:0;padding:0;margin:0}.plans{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.plan{display:block;background:#fff;border:1.5px solid #E1E4E9;border-radius:12px;padding:12px;cursor:pointer;transition:border-color .15s,box-shadow .15s}
.plan input{position:absolute;opacity:0}.plan:has(input:checked){border-color:#0F4C5C;box-shadow:0 0 0 3px rgba(15,76,92,.15)}.plan:has(input:focus-visible){outline:3px solid #C9A24D}
.plan strong{display:block;color:#0F4C5C}.muted{color:#5B6370;font-size:14px}label.f{display:block;margin:12px 0 4px;font-weight:600}
input[type=text],input[type=email],input[type=tel],input[type=number],select{width:100%;padding:10px 12px;border:1.5px solid #CDD2D9;border-radius:8px;font:inherit;background:#fff}
input:focus,select:focus{outline:3px solid #C9A24D;border-color:#0F4C5C}.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:560px){.row{grid-template-columns:1fr}}
.method label{display:flex;gap:8px;align-items:center;margin:6px 0}button{margin-top:20px;width:100%;padding:14px;border:0;border-radius:10px;background:#0F4C5C;color:#fff;font:600 17px system-ui;cursor:pointer}
button:hover{background:#0B3A47}.err{background:#FDECEA;border:1px solid #F5C2BD;color:#8A1C12;border-radius:8px;padding:10px 12px}.hp{position:absolute;left:-9999px}
.note{background:#FFF8E6;border:1px solid #F0DDA8;border-radius:8px;padding:10px 12px;font-size:14px}`;

const page = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${CSS}</style></head>
<body><header><b aria-hidden="true">◆</b><span>Avenue · Flavors Culinary Hub</span></header><main>${body}</main></body></html>`;

export function joinForm(values = {}, errors = [], plans = PLANS) {
  const v = (k) => esc(values[k]);
  const group = (g) => plans.filter(p => p.openToNew && p.group === g).map(p => `<label class="plan"><input type="radio" name="planId" value="${esc(p.planId)}"${values.planId === p.planId ? ' checked' : ''} required>
<strong>${esc(p.name)}</strong><span>${usd(p.priceCents)}/mo by bank</span><br><span class="muted">${usd(p.cardPriceCents)} by card · ${p.hours} h/month · extra $${p.extraRate}/h</span></label>`).join('');
  const days = Array.from({ length: 15 }, (_, i) => i + 1).map(d => `<option value="${d}"${Number(values.collectionDay) === d ? ' selected' : ''}>${ord(d)} of the month</option>`).join('');
  return page('Become a member · Flavors', `<h1>Become a member</h1><p class="muted">Choose a plan, tell us about your business and pay securely with Stripe. After payment Flavors sends your Avenue sign-in invitation; you then upload your compliance documents.</p>
${errors.length ? `<div class="err" role="alert"><strong>Please check:</strong><ul>${errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul></div>` : ''}
<form method="post" action="/join" novalidate>
<fieldset><legend><h2>1. Plan · Emerging</h2></legend><div class="plans">${group('Emerging')}</div></fieldset>
<fieldset><legend><h2>Mobile Kitchen</h2></legend><div class="plans">${group('Mobile Kitchen')}</div></fieldset>
<h2>2. Your business</h2>
<label class="f" for="b">Business name</label><input id="b" type="text" name="businessName" value="${v('businessName')}" required maxlength="120" autocomplete="organization">
<div class="row"><div><label class="f" for="c">Contact name</label><input id="c" type="text" name="contactName" value="${v('contactName')}" required maxlength="120" autocomplete="name"></div>
<div><label class="f" for="e">E-mail (your sign-in)</label><input id="e" type="email" name="email" value="${v('email')}" required autocomplete="email"></div></div>
<div class="row"><div><label class="f" for="p">Phone</label><input id="p" type="tel" name="phone" value="${v('phone')}" maxlength="40" autocomplete="tel"></div>
<div><label class="f" for="t">Team size</label><input id="t" type="number" name="teamSize" min="1" max="50" value="${v('teamSize') || 1}"></div></div>
<h2>3. Payment</h2><label class="f" for="d">Monthly payment day</label><select id="d" name="collectionDay">${days}</select>
<div class="method" role="radiogroup" aria-label="Payment method"><label><input type="radio" name="payMethod" value="Bank"${values.payMethod !== 'Card' ? ' checked' : ''}> Bank account (ACH), plan price</label>
<label><input type="radio" name="payMethod" value="Card"${values.payMethod === 'Card' ? ' checked' : ''}> Card, Apple Pay or Google Pay (+3% card fee)</label></div>
<p class="note">Today you pay a prorated amount up to your payment day; then the plan price on that day each month. Test mode: no real money moves.</p>
<div class="hp" aria-hidden="true"><label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
<button type="submit">Continue to secure payment</button></form>`);
}

export const donePage = () => page('Payment received · Flavors', `<h1>Thank you</h1><p>Your payment is being confirmed by Stripe. Flavors will e-mail your Avenue sign-in invitation; after signing in you upload your compliance documents and Flavors approves your membership.</p><p class="muted">Bank payments can take a few business days to confirm.</p>`);

/** Rate limit: `max` posts per IP per `windowSec`. */
export function rateLimiter(max = 5, windowSec = 600) {
  const hits = new Map();
  return (ip, nowSec) => {
    const list = (hits.get(ip) || []).filter(t => t > nowSec - windowSec);
    if (hits.size > 10000) hits.clear();   // ponytail: crude memory cap; fine for one small host
    list.push(nowSec); hits.set(ip, list);
    return list.length <= max;
  };
}

/** POST /join body (urlencoded). Returns {status, html} or {status: 303, location}. */
export async function joinPost(rawBody, ip, deps) {
  const f = Object.fromEntries(new URLSearchParams(rawBody));
  if (f.website) return { status: 303, location: '/join/done' };   // honeypot: pretend success
  if (!deps.allow(ip, deps.nowSec())) return { status: 429, html: page('Too many attempts', '<h1>Too many attempts</h1><p>Please wait a few minutes and try again.</p>') };
  let r;
  try { r = await startJoin({ email: f.email, input: { ...f, teamSize: Number(f.teamSize || 1), collectionDay: Number(f.collectionDay) }, source: 'Public' }, deps); }
  catch (e) { deps.log?.(`join failed: ${e.message}`); return { status: 503, html: page('Try again later', '<h1>Sorry, something went wrong</h1><p>Nothing was charged. Please try again later.</p>') }; }
  if (r.link) return { status: 303, location: r.link };
  return { status: 400, html: joinForm(f, r.errors || [r.outcome.replace(/^Refused: /, '')], deps.plans ? await deps.plans() : undefined) };
}
