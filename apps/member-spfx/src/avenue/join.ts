// Joining Flavors (ONB-01..03). Pure: validation, prices and the first-payment estimate shown before the member goes to
// Stripe's own checkout page. Nothing here is trusted: the host re-validates the plan and price from its own table and
// Stripe computes the real amount (Q-M5 default: prorated payment now up to the chosen day, then the full price on it).

import type { IPlan, PayMethod } from './contracts';
import { CARD_FEE_RATE, PLAN_PRICES } from './payments';

export interface IJoinInput {
  planId: string;
  businessName: string;
  contactName: string;
  phone: string;
  teamSize: number;
  collectionDay: number;
  payMethod: PayMethod | '';
}

export type JoinField = keyof IJoinInput;
/** Which fields each of the four steps owns (1 plan, 2 business, 3 collection day, 4 review and pay). */
export const STEP_FIELDS: JoinField[][] = [['planId'], ['businessName', 'contactName', 'phone', 'teamSize'], ['collectionDay'], ['payMethod']];

const DAY_MS: number = 24 * 60 * 60 * 1000;

/** Field -> message for every problem; empty object when valid. `plans` are the plans the member may choose. */
export function joinErrors(input: IJoinInput, plans: IPlan[]): Partial<Record<JoinField, string>> {
  const e: Partial<Record<JoinField, string>> = {};
  if (!plans.some(p => p.planId === input.planId && p.openToNew)) { e.planId = 'Choose one of the plans shown.'; }
  const len = (v: string): number => (v || '').trim().length;
  if (len(input.businessName) < 2 || len(input.businessName) > 120) { e.businessName = 'Enter your business name (2 to 120 characters).'; }
  if (len(input.contactName) < 2 || len(input.contactName) > 120) { e.contactName = 'Enter the contact person (2 to 120 characters).'; }
  const digits: string = (input.phone || '').replace(/[\s()+.-]/g, '');
  if (!/^\d{10,15}$/.test(digits)) { e.phone = 'Enter a phone number with 10 to 15 digits.'; }
  if (!Number.isInteger(input.teamSize) || input.teamSize < 1 || input.teamSize > 50) { e.teamSize = 'Team size must be a whole number from 1 to 50.'; }
  if (!Number.isInteger(input.collectionDay) || input.collectionDay < 1 || input.collectionDay > 15) { e.collectionDay = 'Choose a payment day from the 1st to the 15th.'; }
  if (input.payMethod !== 'Bank' && input.payMethod !== 'Card') { e.payMethod = 'Choose bank account or card.'; }
  return e;
}

/** Problems that block leaving step `step` (0-based). */
export function stepErrors(step: number, input: IJoinInput, plans: IPlan[]): string[] {
  const e = joinErrors(input, plans);
  return (STEP_FIELDS[step] || []).map(f => e[f]).filter((m): m is string => !!m);
}

/** What the host receives (trimmed). Identity is NOT in it: the host takes the item author. */
export function toJoinPayload(input: IJoinInput): Record<string, unknown> {
  return {
    planId: input.planId, businessName: input.businessName.trim(), contactName: input.contactName.trim(), phone: input.phone.trim(),
    teamSize: input.teamSize, collectionDay: input.collectionDay, payMethod: input.payMethod
  };
}

/** Monthly price for the chosen method: bank = list price, card = list + 3% (legacy: fee already included). */
export function planPriceCents(plan: IPlan, method: PayMethod | ''): number | undefined {
  return method === 'Bank' ? plan.priceCents : plan.cardPriceCents;
}

/** Plan rows from AvenuePlans, falling back to the client sheet for empty price fields. Unknown plans keep undefined prices. */
export function planFromSheet(planId: string, name: string): Pick<IPlan, 'group' | 'monthlyHours' | 'extraHourRate' | 'priceCents' | 'cardPriceCents' | 'openToNew'> {
  const key: string = planId.trim().toLowerCase();
  const p = PLAN_PRICES[key] || PLAN_PRICES[name.trim().toLowerCase()];
  const legacy: boolean = /^legacy/i.test(key) || /^legacy/i.test(name);
  const group = legacy ? 'Legacy' : /mobile kitchen/i.test(key + ' ' + name) ? 'Mobile Kitchen' : 'Emerging';
  if (!p) { return { group, openToNew: !legacy }; }
  const cents: number = Math.round(p.price * 100);
  return { group, monthlyHours: p.hours, extraHourRate: p.rate, priceCents: cents, cardPriceCents: p.feeIncluded ? cents : Math.round(cents * (1 + CARD_FEE_RATE)), openToNew: !legacy };
}

/** The open plans from the sheet, for when AvenuePlans has none yet. */
export function sheetPlans(): IPlan[] {
  return Object.keys(PLAN_PRICES).map(k => {
    const name: string = k.replace(/(^|[\s-])([a-z])/g, (_m, a: string, b: string) => a + b.toUpperCase());
    return { planId: k, name, ...planFromSheet(k, k) };
  }).filter(p => p.openToNew);
}

const pad = (n: number): string => (n < 10 ? '0' : '') + n;
const ms = (ymd: string): number => Date.parse(`${ymd}T00:00:00Z`);

/** Same day `n` months later (day is at most 15, so it always exists). */
export function addMonths(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const t: number = (m - 1) + n;
  return `${y + Math.floor(t / 12)}-${pad((((t % 12) + 12) % 12) + 1)}-${pad(d)}`;
}

/** First renewal: the next `day` strictly after today (Stripe needs the anchor in the future). */
export function anchorYmd(day: number, todayYmd: string): string {
  const [y, m, d] = todayYmd.split('-').map(Number);
  const thisMonth: string = `${y}-${pad(m)}-${pad(day)}`;
  return d < day ? thisMonth : addMonths(thisMonth, 1);
}

export interface IFirstPayment { anchorYmd: string; prorationCents: number; charges: string[] }

/** ESTIMATE of today's prorated payment (days to the anchor over the month ending at it) and the next three full charge dates. */
export function firstPaymentPreview(monthlyCents: number, day: number, todayYmd: string): IFirstPayment {
  const anchor: string = anchorYmd(day, todayYmd);
  const periodDays: number = Math.round((ms(anchor) - ms(addMonths(anchor, -1))) / DAY_MS);
  const untilDays: number = Math.round((ms(anchor) - ms(todayYmd)) / DAY_MS);
  return { anchorYmd: anchor, prorationCents: Math.round(monthlyCents * Math.min(1, untilDays / periodDays)), charges: [anchor, addMonths(anchor, 1), addMonths(anchor, 2)] };
}
