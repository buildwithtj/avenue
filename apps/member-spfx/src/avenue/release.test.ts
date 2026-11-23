import { tabInRelease } from './release';

describe('release', () => {
  it('has everything when no release file exists', () => {
    expect(tabInRelease('billing', undefined)).toBe(true);
  });
  it('always includes home', () => {
    expect(tabInRelease('home', [])).toBe(true);
  });
  it('drops screens of modules not listed', () => {
    expect(tabInRelease('book', ['booking'])).toBe(true);
    expect(tabInRelease('bookings', ['calendar'])).toBe(false);
    expect(tabInRelease('membership', ['booking'])).toBe(false);
    expect(tabInRelease('membership', ['billing'])).toBe(true);
  });
  it('new modules (support, events, storage, team) are off in a real release until listed, on in demo and with no release file', () => {
    ['support', 'events', 'storage', 'team'].forEach(t => {
      expect(tabInRelease(t as never, ['booking', 'documents'])).toBe(false);
      expect(tabInRelease(t as never, ['booking', 'documents'], true)).toBe(true);
      expect(tabInRelease(t as never, [t])).toBe(true);
      expect(tabInRelease(t as never, undefined)).toBe(true);
    });
    expect(tabInRelease('bookings', ['calendar'], true)).toBe(false);
  });
});
