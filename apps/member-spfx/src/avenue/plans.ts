// Membership plans for the member's own pages (My membership, Billing). Pure. Nothing here charges anyone or changes a plan:
// a plan change is a support message Flavors acts on (no proration or start date is invented; Q-R2).
import type { IMyMembership, IMyRequest, IPlan, PlanGroup } from './contracts';
import { planFromSheet } from './join';
import { localDay } from './calendar';
import { formatCents } from './billing';
import type { ISupportInput } from './support';

/**
 * The member's plan as a plan record: the AvenuePlans row from listPlans when it is there, otherwise the membership's plan
 * row (name, hours, rate) with prices from the client sheet (PLAN_PRICES fallback, e.g. legacy plans listPlans never returns).
 */
export function memberPlan(m: IMyMembership | undefined, plans: IPlan[]): IPlan | undefined {
  if (!m || !m.planId) { return undefined; }
  const found: IPlan | undefined = plans.filter(p => p.planId === m.planId)[0];
  const name: string = found?.name || m.planName || m.planId;
  const base: IPlan = found || { planId: m.planId, name, ...planFromSheet(m.planId, name) };
  return { ...base, monthlyHours: base.monthlyHours ?? m.monthlyHours, extraHourRate: base.extraHourRate ?? m.extraHourRate };
}

/** The group a member may move within. A legacy plan offers the current plans of its kind; legacy plans are never offered. */
export function offerGroup(p: IPlan): PlanGroup {
  return p.group !== 'Legacy' ? p.group : /mobile kitchen/i.test(`${p.planId} ${p.name}`) ? 'Mobile Kitchen' : 'Emerging';
}

/** Plans open to new members in the current plan's group, smallest first. */
export function planChoices(current: IPlan, plans: IPlan[]): IPlan[] {
  const g: PlanGroup = offerGroup(current);
  return plans.filter(p => p.openToNew && p.group === g && p.group !== 'Legacy' && p.monthlyHours !== undefined)
    .sort((a, b) => (a.monthlyHours as number) - (b.monthlyHours as number));
}

/** [PROPOSED] The smallest plan whose hours cover this month's usage; undefined when none does. */
export function recommendPlan(choices: IPlan[], usedHours: number): IPlan | undefined {
  return choices.filter(p => (p.monthlyHours as number) >= usedHours)[0];
}

export type UsageLevel = 'ok' | 'high' | 'over';

/** Meter colour (amber from 80%, red over the plan) and the extra so far: hours over × rate, before any card fee. */
export function usageState(used: number, allowance: number | undefined, rate: number | undefined): { level: UsageLevel; overHours: number; extraCents: number } {
  if (allowance === undefined || allowance <= 0) { return { level: 'ok', overHours: 0, extraCents: 0 }; }
  const overHours: number = Math.max(0, Math.round((used - allowance) * 10) / 10);
  const extraCents: number = rate !== undefined ? Math.round(overHours * rate * 100) : 0;
  return { level: overHours > 0 ? 'over' : used / allowance >= 0.8 ? 'high' : 'ok', overHours, extraCents };
}

export interface IExtraLine { ymd: string; hours: number; cents: number }

/**
 * Extra-hour lines by booking date: the member's approved bookings this month (same rule as hoursThisMonth), in start
 * order, and the part of each that falls over the allowance. Estimate only; the hours ledger is the record (A5).
 */
export function extraHourLines(requests: IMyRequest[], allowance: number | undefined, rate: number | undefined, timeZone: string, now: Date): IExtraLine[] {
  if (allowance === undefined || rate === undefined) { return []; }
  const month: string = localDay(now, timeZone).slice(0, 7);
  const by: Record<string, number> = {};
  const days: string[] = [];
  let used: number = 0;
  requests.filter(r => (r.status === 'Approved' || r.hoursKept) && localDay(r.startUtc, timeZone).slice(0, 7) === month)
    .sort((a, b) => a.startUtc.localeCompare(b.startUtc))
    .forEach(r => {
      const h: number = Math.max(0, Date.parse(r.endUtc) - Date.parse(r.startUtc)) / 3600000;
      const over: number = Math.min(h, Math.max(0, used + h - allowance));
      used += h;
      if (over > 0) {
        const d: string = localDay(r.startUtc, timeZone);
        if (by[d] === undefined) { days.push(d); by[d] = 0; }
        by[d] += over;
      }
    });
  return days.map(ymd => { const hours: number = Math.round(by[ymd] * 10) / 10; return { ymd, hours, cents: Math.round(hours * rate * 100) }; });
}

/** "1 Dec" style reset day: the 1st of the next month (sheet: hours reset on the 1st, no rollover; Q10 still open for other pay days). */
export function firstOfNextMonth(todayYmd: string): string {
  const [y, m] = todayYmd.split('-').map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${m < 9 ? '0' : ''}${m + 1}-01`;
}

/** "$800.00/month · 10 h · $75.00 per extra hour" (bank price). */
export function planLine(p: IPlan): string {
  const price: string = p.priceCents !== undefined ? `${formatCents(p.priceCents)}/month` : 'price not set';
  const hours: string = p.monthlyHours !== undefined ? `${p.monthlyHours} h` : 'hours not set';
  const rate: string = p.extraHourRate !== undefined ? `${formatCents(Math.round(p.extraHourRate * 100))} per extra hour` : 'extra-hour rate not set';
  return `${price} · ${hours} · ${rate}`;
}

/** The support message for a plan change. Flavors confirms the change and when it starts; nothing is charged by it. */
export function planChangeMessage(facilityId: string, from: IPlan, to: IPlan, note: string): ISupportInput {
  const n: string = note.trim().slice(0, 1000);
  return {
    facilityId, category: 'Billing',
    subject: `Plan change request: ${from.name} → ${to.name}`.slice(0, 120),
    body: [`Please change my plan.`, `Current: ${from.name} (${planLine(from)})`, `Requested: ${to.name} (${planLine(to)})`, n ? `Note: ${n}` : ''].filter(Boolean).join('\n')
  };
}
