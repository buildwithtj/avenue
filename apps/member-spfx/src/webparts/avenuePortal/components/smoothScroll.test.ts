/** @jest-environment jsdom */
import { startSmoothScroll } from './smoothScroll';

describe('startSmoothScroll guard', () => {
  it('returns null without matchMedia (jsdom)', () => { expect(startSmoothScroll(document.body)).toBeNull(); });
  it('returns null under reduced motion', () => {
    const mm = window.matchMedia;
    window.matchMedia = ((q: string) => ({ matches: q.indexOf('reduced-motion') >= 0, addEventListener: () => undefined, removeEventListener: () => undefined })) as unknown as typeof window.matchMedia;
    try { expect(startSmoothScroll(document.body)).toBeNull(); } finally { window.matchMedia = mm; }
  });
});
