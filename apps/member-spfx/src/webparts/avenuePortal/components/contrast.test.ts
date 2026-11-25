// WCAG contrast of the colour pairs the portal uses (docs/UI_RESEARCH_NOTES.md). Fails if a token pair drops under its threshold.
const lum = (h: string): number => {
  const c: number[] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: string, b: string): number => { const x: number = Math.max(lum(a), lum(b)); const y: number = Math.min(lum(a), lum(b)); return (x + 0.05) / (y + 0.05); };
const TEXT: [string, string, string][] = [
  ['charcoal on white', '#1F1F1F', '#FFFFFF'], ['muted on white', '#5B6370', '#FFFFFF'], ['muted on page', '#5B6370', '#F4F5F7'], ['muted on teal tint', '#5B6370', '#EAF0F1'],
  ['muted on count pill', '#5B6370', '#DEE8EA'], ['teal on white', '#0F4C5C', '#FFFFFF'], ['white on teal', '#FFFFFF', '#0F4C5C'], ['teal on teal tint', '#0F4C5C', '#EAF0F1'],
  ['gold text on gold tint', '#80601E', '#F5F0E5'], ['bad on bad tint', '#8A2C2C', '#F8E7E9'], ['secondary text on white', '#4B5563', '#FFFFFF']
];
describe('colour contrast', () => {
  for (const [n, f, b] of TEXT) { it(`${n} is at least 4.5:1`, () => expect(ratio(f, b)).toBeGreaterThanOrEqual(4.5)); }
  it('the focus ring (teal) is at least 3:1 on white and on the page', () => { expect(ratio('#0F4C5C', '#FFFFFF')).toBeGreaterThanOrEqual(3); expect(ratio('#0F4C5C', '#F4F5F7')).toBeGreaterThanOrEqual(3); });
});
