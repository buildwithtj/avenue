// Style rules from docs/MEMBER_PORTAL_AUDIT_AND_UI_PLAN.md (phases 0-1), checked on the source stylesheets.
// ponytail: a regex check, not a CSS parser; good enough for these rules (each :hover rule is written on its media line).
// Jest runs under Node; the project tsconfig has no Node types, so fs and cwd come through the global require.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs: { readFileSync(p: string, enc: string): string } = require('fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cwd: () => string = require('process').cwd;
const dir = cwd() + '/src/webparts/avenuePortal/components/';
const sheets = ['Site.module.scss', 'AvenuePortal.module.scss', 'Ref.module.scss'].map(f => ({ f, css: fs.readFileSync(dir + f, 'utf8') }));

describe('stylesheet rules', () => {
  it('never squeezes the font (no font-stretch)', () => {
    for (const { f, css } of sheets) { expect([f, /font-stretch\s*:/.test(css)]).toEqual([f, false]); }
  });
  it('has no text smaller than 12px', () => {
    for (const { f, css } of sheets) {
      const small = (css.match(/font-size:\s*\d+(\.\d+)?px/g) || []).filter((d: string) => parseFloat(d.replace(/[^\d.]/g, '')) < 12);
      expect([f, small]).toEqual([f, []]);
    }
  });
  it('uses one font family token, not a hard-coded face', () => {
    for (const { f, css } of sheets) { expect([f, /font-family:\s*['"]Avenue /.test(css)]).toEqual([f, false]); }
  });
  it('applies hover styles only where hovering exists', () => {
    for (const { f, css } of sheets) {
      const loose = css.split('\n').filter(l => l.indexOf(':hover') >= 0 && l.indexOf('(hover: hover)') < 0);
      expect([f, loose]).toEqual([f, []]);
    }
  });
});
