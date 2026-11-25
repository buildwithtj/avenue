// Plans and event packages from the client's sheet (docs/CLIENT_SHEET_BOOKING_DATA.md §2, §4). planId = lower-case sheet name,
// the same keys as PLAN_PRICES in apps/member-spfx/src/avenue/payments.ts (keep both in step when the sheet changes).
// Card price = list + 3% (Q-M1 default, docs/CLIENT_REVIEW_DEFAULTS.md). Legacy prices already include the fee: one price.
const CURRENT = [
  ['Emerging-10', 'Emerging', 800, 10, 75], ['Emerging-20', 'Emerging', 1400, 20, 65], ['Emerging-40', 'Emerging', 2400, 40, 55], ['Emerging-80', 'Emerging', 4000, 80, 45],
  ['Mobile Kitchen-10', 'Mobile Kitchen', 600, 10, 55], ['Mobile Kitchen-20', 'Mobile Kitchen', 1100, 20, 50], ['Mobile Kitchen-40', 'Mobile Kitchen', 1600, 40, 35], ['Mobile Kitchen-80', 'Mobile Kitchen', 2400, 80, 25]
];
const LEGACY = [
  ['Legacy-Launch', 424, 5], ['Legacy: Emerging-10A', 742, 10], ['Legacy: Emerging-10B', 515, 10], ['Legacy: Emerging-10C', 530, 10], ['Legacy: Emerging-10D', 721, 10], ['Legacy: Emerging-10E', 550, 10],
  ['Legacy-Mobile Kitchen -10A', 550, 10], ['Legacy-Mobile Kitchen -10B', 636, 10], ['Legacy-Mobile Kitchen -10C', 530, 10], ['Legacy-Mobile Kitchen -10D', 515, 10]
];
export const CARD_FEE = 0.03;

export const PLANS = [
  ...CURRENT.map(([name, group, price, hours, rate]) => ({ planId: name.toLowerCase(), name, group, priceCents: price * 100, cardPriceCents: Math.round(price * 100 * (1 + CARD_FEE)), hours, extraRate: rate, openToNew: true })),
  ...LEGACY.map(([name, price, hours]) => ({ planId: name.toLowerCase(), name, group: 'Legacy', priceCents: price * 100, cardPriceCents: price * 100, hours, extraRate: 35, openToNew: false }))
];
export const planById = (id, plans = PLANS) => plans.find(p => p.planId === String(id || '').trim().toLowerCase());

/** [PROPOSED] Plans from SharePoint AvenuePlans (staff edit them in Setup > Plans) in the same shape as PLANS. Rows without a plan id, a price
 *  or hours are skipped. Legacy plans have one price and are never open to new members. Card price defaults to bank + CARD_FEE. */
export function plansFromRows(rows = []) {
  const out = [];
  for (const r of rows) {
    const id = String(r?.PlanId ?? '').trim(), price = Number(r?.PriceCents), hours = Number(r?.MonthlyHours);
    if (!id || r?.Active === false || !(price > 0) || !(hours > 0)) continue;
    const group = typeof r.PlanGroup === 'object' ? r.PlanGroup?.Value : r.PlanGroup;
    const legacy = group === 'Legacy', card = Number(r.CardPriceCents);
    out.push({ planId: id.toLowerCase(), name: id, group: group || 'Emerging', priceCents: Math.round(price), cardPriceCents: legacy ? Math.round(price) : (card > 0 ? Math.round(card) : Math.round(price * (1 + CARD_FEE))),
      hours, extraRate: r.ExtraHourRate == null || r.ExtraHourRate === '' ? null : Number(r.ExtraHourRate), openToNew: !legacy && r.OpenToNew !== false });
  }
  return out;
}

/** [PROPOSED] Cached plan source for /join and the Join request: reads AvenuePlans through the read-only 'plans' bridge flow (SP_BRIDGE_PLANS)
 *  at most once per `ttlSec`. Falls back to the last good list, else to the hard-coded PLANS, when the read fails or has no plan open to new members. */
export function createPlanSource({ bridge, nowSec, ttlSec = 600, log = () => {} }) {
  let cache;
  return async function plans() {
    if (cache && nowSec() - cache.at < ttlSec) return cache.plans;
    try {
      const rows = await bridge.query('AvenuePlans', "FacilityId eq 'flavors-hyattsville' and Active eq 1",
        ['PlanId', 'PlanGroup', 'PriceCents', 'CardPriceCents', 'MonthlyHours', 'ExtraHourRate', 'OpenToNew', 'Active'], 500);
      const list = plansFromRows(rows);
      if (!list.some(p => p.openToNew)) throw new Error('plans: no plan open to new members');
      cache = { at: nowSec(), plans: list };
    } catch (e) {
      log(`plans: using ${cache ? 'the last good list' : 'the built-in list'} (${String(e?.message || e).slice(0, 80)})`);
      cache = { at: nowSec(), plans: cache?.plans || PLANS };   // retry after ttlSec, not on every request
    }
    return cache.plans;
  };
}

export const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** Stripe price lookup key. Legacy plans have only the bank price, used for every method. */
export const lookupKey = (planId, method, plans = PLANS) => `avenue-${slug(planId)}-${planById(planId, plans)?.group === 'Legacy' || method !== 'Card' ? 'bank' : 'card'}`;

// Private events, dining room (sheet "Dining & Event Pricing"). $500 refundable deposit; balance due 30 days before (Q8/Q9 open).
export const DEPOSIT_CENTS = 50000;
export const EVENT_PACKAGES = [
  { name: 'Simplicity', hours: 4, memberCents: 95000, guestCents: 110000 },
  { name: 'Opulence', hours: 6, memberCents: 120000, guestCents: 150000 },
  { name: 'Elevation', hours: 8, memberCents: 140000, guestCents: 190000 },
  { name: 'Platinum', hours: 12, memberCents: 185000, guestCents: 260000 }
];
