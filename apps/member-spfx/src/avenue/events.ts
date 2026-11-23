// Private event request (dining room). Prices and rules are the client sheet's "Dining & Event Pricing" tab (member rates only; non-members are staff-entered).
// Pure: nothing here charges anyone. The $500 deposit is separate from the package price and refundable; the balance is due 30 days before the event,
// or at once when the event is closer (the sheet's rule). Refund rules for 8-14 days and boundaries are open (Q8/Q9), so no refund maths exists here.
import { EVENT_PACKAGES, type EventPackage } from './contracts';

export const DEPOSIT_CENTS: number = 50000;
export const DINING_SEATS: number = 50;
export const MAX_GUESTS: number = 60;

export const PACKAGES: Record<EventPackage, { hours: number; priceCents: number }> = {
  Simplicity: { hours: 4, priceCents: 95000 }, Opulence: { hours: 6, priceCents: 120000 },
  Elevation: { hours: 8, priceCents: 140000 }, Platinum: { hours: 12, priceCents: 185000 }
};
export const EXTRA_HOUR_CENTS: number = 10000;

const DAY_MS: number = 24 * 60 * 60 * 1000;
const pad = (n: number): string => (n < 10 ? '0' : '') + n;
const toMs = (ymd: string): number => Date.parse(`${ymd}T00:00:00Z`);
const toYmd = (ms: number): string => { const d: Date = new Date(ms); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };

export interface IEventInput { facilityId: string; pkg: EventPackage | ''; eventDate: string; guests: number; notes: string }

/** `todayYmd` is the facility-local date. The earliest date is tomorrow: Flavors must approve first. */
export function validateEvent(i: IEventInput, todayYmd: string): string[] {
  const e: string[] = [];
  if (EVENT_PACKAGES.indexOf(i.pkg as EventPackage) < 0) { e.push('Choose a package.'); }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.eventDate) || isNaN(toMs(i.eventDate))) { e.push('Choose the event date.'); }
  else if (i.eventDate <= todayYmd) { e.push('The event date must be after today.'); }
  if (!Number.isInteger(i.guests) || i.guests < 1 || i.guests > MAX_GUESTS) { e.push(`Guests must be a whole number from 1 to ${MAX_GUESTS}.`); }
  if (i.notes.length > 1000) { e.push('Notes can be up to 1000 characters.'); }
  return e;
}

export function toEventItem(i: IEventInput, requestId: string): Record<string, unknown> {
  return { Title: `${i.pkg} ${i.eventDate}`, FacilityId: i.facilityId, RequestId: requestId, Package: i.pkg, EventDate: `${i.eventDate}T12:00:00Z`, Guests: i.guests, Notes: i.notes.trim() };
}

export interface IEventQuote { packageCents: number; depositCents: number; hours: number; balanceDueYmd: string; balanceDueNow: boolean; overSeats: boolean }

/** Balance due date = 30 days before the event; when that is today or earlier the balance is due at once (`balanceDueNow`). */
export function eventQuote(pkg: EventPackage, eventYmd: string, todayYmd: string, guests: number): IEventQuote {
  const p = PACKAGES[pkg];
  const due: string = toYmd(toMs(eventYmd) - 30 * DAY_MS);
  const now: boolean = due <= todayYmd;
  return { packageCents: p.priceCents, depositCents: DEPOSIT_CENTS, hours: p.hours, balanceDueYmd: now ? todayYmd : due, balanceDueNow: now, overSeats: guests > DINING_SEATS };
}
