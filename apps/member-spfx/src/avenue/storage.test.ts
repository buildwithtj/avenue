import { estimateCents, offerFor, OFFERS, toStorageItem, validateStorage } from './storage';
import { STORAGE_ITEMS } from './contracts';

describe('storage', () => {
  it('has an offer for every item and prices only what the sheet states', () => {
    expect(OFFERS.map(o => o.item)).toEqual(STORAGE_ITEMS);
    expect(offerFor('Half-door fridge')?.cents).toBe(25000);
    expect(offerFor('Daily cold shelf')?.cents).toBe(7500);
    expect(offerFor('Dry shelf single')?.cents).toBeUndefined();
    expect(offerFor('Dry shelf double')?.cents).toBeUndefined();
  });
  it('estimates priced items and says nothing for price on request', () => {
    expect(estimateCents('Full-door freezer', 2)).toBe(80000);
    expect(estimateCents('Dry shelf double', 1)).toBeUndefined();
    expect(estimateCents('nonsense', 1)).toBeUndefined();
  });
  it('validates item and quantity', () => {
    expect(validateStorage({ facilityId: 'f', item: 'Half-door fridge', quantity: 1, notes: '' })).toEqual([]);
    expect(validateStorage({ facilityId: 'f', item: '', quantity: 0, notes: '' }).length).toBe(2);
    expect(validateStorage({ facilityId: 'f', item: 'Daily dry shelf', quantity: 21, notes: '' }).length).toBe(1);
    expect(validateStorage({ facilityId: 'f', item: 'Daily dry shelf', quantity: 1.5, notes: '' }).length).toBe(1);
  });
  it('builds the intake item', () => {
    expect(toStorageItem({ facilityId: 'f', item: 'Half-door fridge', quantity: 2, notes: ' ok ' }, 'r1')).toMatchObject({ RequestId: 'r1', Item: 'Half-door fridge', Quantity: 2, Notes: 'ok' });
  });
});
