// The client's plans (sheet "Plans & Rates", read 19 Nov 2026; docs/CLIENT_SHEET_BOOKING_DATA.md section 2).
// PlanId = sheet name in lower case, the same keys as PLAN_PRICES in apps/member-spfx/src/avenue/payments.ts.
// Current plans: card price = list + 3% (Q-M1 default, docs/CLIENT_REVIEW_DEFAULTS.md). Legacy plans already include the fee.
const CURRENT = [['Emerging-10', 800, 10, 75], ['Emerging-20', 1400, 20, 65], ['Emerging-40', 2400, 40, 55], ['Emerging-80', 4000, 80, 45],
  ['Mobile Kitchen-10', 600, 10, 55], ['Mobile Kitchen-20', 1100, 20, 50], ['Mobile Kitchen-40', 1600, 40, 35], ['Mobile Kitchen-80', 2400, 80, 25]];
const LEGACY = [['Legacy-Launch', 424, 5], ['Legacy: Emerging-10A', 742, 10], ['Legacy: Emerging-10B', 515, 10], ['Legacy: Emerging-10C', 530, 10],
  ['Legacy: Emerging-10D', 721, 10], ['Legacy: Emerging-10E', 550, 10], ['Legacy-Mobile Kitchen -10A', 550, 10], ['Legacy-Mobile Kitchen -10B', 636, 10],
  ['Legacy-Mobile Kitchen -10C', 530, 10], ['Legacy-Mobile Kitchen -10D', 515, 10]];

export function buildPlans() {
  const row = (name, price, hours, rate, group, open, cardCents) => ({ key: name.toLowerCase(), fields: {
    Title: name, FacilityId: 'flavors-hyattsville', PlanId: name.toLowerCase(), MonthlyHours: hours, ExtraHourRate: rate,
    PriceCents: price * 100, CardPriceCents: cardCents, PlanGroup: group, OpenToNew: open, Active: true } });
  return [
    ...CURRENT.map(([n, p, h, r]) => row(n, p, h, r, n.startsWith('Mobile') ? 'Mobile Kitchen' : 'Emerging', true, Math.round(p * 100 * 1.03))),
    ...LEGACY.map(([n, p, h]) => row(n, p, h, 35, 'Legacy', false, p * 100))
  ];
}
