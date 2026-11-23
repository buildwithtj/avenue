import { equipmentImage, heroImage } from './index';

describe('bundled images', () => {
  it('hero is an inlined JPEG data URI', () => {
    expect(heroImage.indexOf('data:image/jpeg;base64,')).toBe(0);
    expect(heroImage.length).toBeLessThan(130000);
  });
  it('unknown ids resolve to undefined, never a made-up image', () => {
    expect(equipmentImage('stove-1', 'Stove')).toBeUndefined();
    expect(equipmentImage('nope')).toBeUndefined();
  });
});
