// Payment rules taken from the client's sheet (tabs "Plans & Rates", "Booking Rules", "Dining & Event Pricing").
// Pure maths only: nothing here charges anyone. Stripe (test mode only until STR-06) is behind the proposed host (Q-01).
// [PROPOSED] where the sheet is silent (grace length, ACH fee, whether late fee follows grace) the open question is in
// booking_questions.md and the function says so.

const DAY_MS: number = 24 * 60 * 60 * 1000;

/** Electronic payments carry 3% to cover the card fee; the member pays it (Stripe fees paid by Member, agreed 11 Nov). */
export const CARD_FEE_RATE: number = 0.03;
/** "$99 late fee for payments not made by their due date." */
export const LATE_FEE_CENTS: number = 9900;
/** "Most are due on the 1st ... pay on or before the 5th." Applies to a 1st-of-month due day. */
export const GRACE_LAST_DAY: number = 5;

/** Plans by lower-case sheet name (= AvenuePlans.PlanId): price $/month, hours, extra $/hour (sheet "Plans & Rates"). Legacy prices already include the card fee. */
export const PLAN_PRICES: Record<string, { price: number; feeIncluded: boolean; hours: number; rate: number }> = {
  'emerging-10': { price: 800, feeIncluded: false, hours: 10, rate: 75 }, 'emerging-20': { price: 1400, feeIncluded: false, hours: 20, rate: 65 },
  'emerging-40': { price: 2400, feeIncluded: false, hours: 40, rate: 55 }, 'emerging-80': { price: 4000, feeIncluded: false, hours: 80, rate: 45 },
  'mobile kitchen-10': { price: 600, feeIncluded: false, hours: 10, rate: 55 }, 'mobile kitchen-20': { price: 1100, feeIncluded: false, hours: 20, rate: 50 },
  'mobile kitchen-40': { price: 1600, feeIncluded: false, hours: 40, rate: 35 }, 'mobile kitchen-80': { price: 2400, feeIncluded: false, hours: 80, rate: 25 },
  'legacy-launch': { price: 424, feeIncluded: true, hours: 5, rate: 35 },
  'legacy: emerging-10a': { price: 742, feeIncluded: true, hours: 10, rate: 35 }, 'legacy: emerging-10b': { price: 515, feeIncluded: true, hours: 10, rate: 35 },
  'legacy: emerging-10c': { price: 530, feeIncluded: true, hours: 10, rate: 35 }, 'legacy: emerging-10d': { price: 721, feeIncluded: true, hours: 10, rate: 35 },
  'legacy: emerging-10e': { price: 550, feeIncluded: true, hours: 10, rate: 35 },
  'legacy-mobile kitchen -10a': { price: 550, feeIncluded: true, hours: 10, rate: 35 }, 'legacy-mobile kitchen -10b': { price: 636, feeIncluded: true, hours: 10, rate: 35 },
  'legacy-mobile kitchen -10c': { price: 530, feeIncluded: true, hours: 10, rate: 35 }, 'legacy-mobile kitchen -10d': { price: 515, feeIncluded: true, hours: 10, rate: 35 }
};

export interface IMonthlyCharge { planCents: number; feeCents: number; totalCents: number; feeIncluded: boolean }

/** Monthly charge. A member paying by bank (ACH) pays no card fee (Q-M1 default); an unknown method shows the card price. */
export function monthlyCharge(planName: string | undefined, payMethod?: 'Bank' | 'Card'): IMonthlyCharge | undefined {
  const p = planName ? PLAN_PRICES[planName.trim().toLowerCase()] : undefined;
  if (!p) { return undefined; }
  const planCents: number = Math.round(p.price * 100);
  const feeCents: number = p.feeIncluded || payMethod === 'Bank' ? 0 : Math.round(planCents * CARD_FEE_RATE);
  return { planCents, feeCents, totalCents: planCents + feeCents, feeIncluded: p.feeIncluded };
}

/** Extra hours (over the plan) at the plan's rate; the card fee is added unless the member pays by bank. */
export function overageCents(overHours: number, ratePerHour: number | undefined, payMethod?: 'Bank' | 'Card'): number | undefined {
  if (ratePerHour === undefined || !(overHours > 0)) { return ratePerHour === undefined ? undefined : 0; }
  return Math.round(Math.round(overHours * ratePerHour * 100) * (payMethod === 'Bank' ? 1 : 1 + CARD_FEE_RATE));
}

const pad = (n: number): string => (n < 10 ? '0' : '') + n;

/** Next due date (YYYY-MM-DD) strictly on/after `todayYmd` for a due day 1–15. */
export function nextDueDate(dueDay: number, todayYmd: string): string {
  const [y, m, d] = todayYmd.split('-').map(Number);
  if (d <= dueDay) { return `${y}-${pad(m)}-${pad(dueDay)}`; }
  return m === 12 ? `${y + 1}-01-${pad(dueDay)}` : `${y}-${pad(m + 1)}-${pad(dueDay)}`;
}

export interface IDueInfo { dueYmd: string; daysLeft: number; graceYmd?: string; lateFeeCents: number }

/** Due date, days left, grace end (only for a 1st due day: the 5th) and the late fee that applies once past the due date. */
export function dueInfo(dueDay: number, todayYmd: string): IDueInfo {
  const dueYmd: string = nextDueDate(dueDay, todayYmd);
  const daysLeft: number = Math.round((Date.parse(`${dueYmd}T00:00:00Z`) - Date.parse(`${todayYmd}T00:00:00Z`)) / DAY_MS);
  return { dueYmd, daysLeft, graceYmd: dueDay === 1 ? `${dueYmd.slice(0, 8)}${pad(GRACE_LAST_DAY)}` : undefined, lateFeeCents: LATE_FEE_CENTS };
}

/** Event refund (sheet): $500 deposit, balance due 30 days before; cancelling under 30 days loses the deposit, earlier returns it. */
export function eventDepositRefundCents(daysBeforeEvent: number, depositCents: number = 50000): number {
  return daysBeforeEvent >= 30 ? depositCents : 0;
}

export interface IPaymentEstimate { planCents: number; extraCents: number; feeCents: number; totalCents: number; feeIncluded: boolean }

/**
 * Next payment estimate (sheet "Plans & Rates"): plan price + extra hours × the plan's rate + 3% on electronic/card payments.
 * Bank (ACH) pays no fee (Q-M1 default); an unknown method shows the card price, like monthlyCharge. A plan whose card price
 * equals its price (legacy) already includes the fee on the plan; extra hours still carry it, as overageCents does.
 * An estimate only: no billing cut-off or proration is applied (none is agreed).
 */
export function paymentEstimate(priceCents: number, cardPriceCents: number | undefined, overHours: number, ratePerHour: number | undefined, payMethod?: 'Bank' | 'Card'): IPaymentEstimate {
  const card: boolean = payMethod !== 'Bank';
  const extraCents: number = overHours > 0 && ratePerHour !== undefined ? Math.round(overHours * ratePerHour * 100) : 0;
  const planFee: number = card ? Math.max(0, (cardPriceCents ?? Math.round(priceCents * (1 + CARD_FEE_RATE))) - priceCents) : 0;
  const feeCents: number = planFee + (card ? Math.round(extraCents * CARD_FEE_RATE) : 0);
  return { planCents: priceCents, extraCents, feeCents, totalCents: priceCents + extraCents + feeCents, feeIncluded: cardPriceCents === priceCents };
}
