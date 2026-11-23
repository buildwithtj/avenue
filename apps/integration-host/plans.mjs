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
export const planById = (id) => PLANS.find(p => p.planId === String(id || '').trim().toLowerCase());

export const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** Stripe price lookup key. Legacy plans have only the bank price, used for every method. */
export const lookupKey = (planId, method) => `avenue-${slug(planId)}-${planById(planId)?.group === 'Legacy' || method !== 'Card' ? 'bank' : 'card'}`;

// Private events, dining room (sheet "Dining & Event Pricing"). $500 refundable deposit; balance due 30 days before (Q8/Q9 open).
export const DEPOSIT_CENTS = 50000;
export const EVENT_PACKAGES = [
  { name: 'Simplicity', hours: 4, memberCents: 95000, guestCents: 110000 },
  { name: 'Opulence', hours: 6, memberCents: 120000, guestCents: 150000 },
  { name: 'Elevation', hours: 8, memberCents: 140000, guestCents: 190000 },
  { name: 'Platinum', hours: 12, memberCents: 185000, guestCents: 260000 }
];
