// Storage rental request. Only prices the client sheet states clearly are shown; the rest say "price on request" (see docs/doubts/A-portal.md).
// Not booking, and no Stripe object is created: staff approve and bill by hand.
import { STORAGE_ITEMS, type StorageItem } from './contracts';

export interface IStorageOffer { item: StorageItem; label: string; /** Cents, or undefined = price on request. */ cents?: number; per: string; note?: string }

export const OFFERS: IStorageOffer[] = [
  { item: 'Half-door fridge', label: 'Half-door fridge', cents: 25000, per: 'door per month' },
  { item: 'Half-door freezer', label: 'Half-door freezer', cents: 25000, per: 'door per month' },
  { item: 'Full-door fridge', label: 'Full-door fridge', cents: 40000, per: 'door per month', note: 'The sheet also lists $700 per unit; Flavors confirms which applies.' },
  { item: 'Full-door freezer', label: 'Full-door freezer', cents: 40000, per: 'door per month', note: 'The sheet also lists $700 per unit; Flavors confirms which applies.' },
  { item: 'Dry shelf single', label: 'Dry storage shelf, single unit', per: 'month' },
  { item: 'Dry shelf double', label: 'Dry storage shelf, double unit', per: 'month' },
  { item: 'Daily dry shelf', label: 'Daily dry storage', cents: 5000, per: 'shelf per day' },
  { item: 'Daily cold shelf', label: 'Daily cold storage', cents: 7500, per: 'shelf per day' }
];

export const offerFor = (item: string): IStorageOffer | undefined => OFFERS.filter(o => o.item === item)[0];

export interface IStorageInput { facilityId: string; item: StorageItem | ''; quantity: number; notes: string }

export function validateStorage(i: IStorageInput): string[] {
  const e: string[] = [];
  if (STORAGE_ITEMS.indexOf(i.item as StorageItem) < 0) { e.push('Choose what you need.'); }
  if (!Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 20) { e.push('Quantity must be a whole number from 1 to 20.'); }
  if (i.notes.length > 1000) { e.push('Notes can be up to 1000 characters.'); }
  return e;
}

export function toStorageItem(i: IStorageInput, requestId: string): Record<string, unknown> {
  return { Title: `${i.item} x${i.quantity}`, FacilityId: i.facilityId, RequestId: requestId, Item: i.item, Quantity: i.quantity, Notes: i.notes.trim() };
}

/** Estimated cost in cents for a priced item (quantity x price), or undefined when the price is on request. Daily items are per day. */
export function estimateCents(item: string, quantity: number): number | undefined {
  const o: IStorageOffer | undefined = offerFor(item);
  return o && o.cents !== undefined ? o.cents * quantity : undefined;
}
