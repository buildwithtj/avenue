// Builds the STAGING package (solution/member-spfx-staging.sppkg) from the same source, beside the live one in the tenant app catalog.
// Usage: node scripts/build-staging.mjs   (live: npm run build, unchanged). Never run while `npm start` is running.
// It temporarily rewrites config/package-solution.json and the web part manifest with staging ids/names, runs the normal build,
// then restores both files byte for byte (also on failure). Nothing is uploaded or deployed.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const SOLUTION = new URL('../config/package-solution.json', import.meta.url);
const MANIFEST = new URL('../src/webparts/avenuePortal/AvenuePortalWebPart.manifest.json', import.meta.url);
// Staging uses the real Join path (host request; the server skips Stripe in test mode) instead of the UI-only mock payment.
const BILLING = new URL('../src/avenue/billing.ts', import.meta.url);
const SUPPORT = new URL('../src/avenue/support.ts', import.meta.url);
const STAGING = {
  solutionId: 'd5270044-328c-4f85-a99d-5e985562c6a9',
  featureId: '3536ace4-8cb5-41b7-b17b-a190ea119886',
  webPartId: 'b7cbec8a-2b76-4c3d-82ce-a8a3448b8e4f',
  version: '1.15.10.0'
};

const origSolution = readFileSync(SOLUTION, 'utf8');
const origManifest = readFileSync(MANIFEST, 'utf8');
const origBilling = readFileSync(BILLING, 'utf8');
const origSupport = readFileSync(SUPPORT, 'utf8');
let status = 1;
try {
  const sol = JSON.parse(origSolution);
  sol.solution.name = 'Avenue member portal staging';
  sol.solution.id = STAGING.solutionId;
  sol.solution.version = STAGING.version;
  sol.solution.metadata.shortDescription.default = 'Avenue member portal (staging build for client review)';
  sol.solution.metadata.longDescription.default = 'Avenue member portal (staging build for client review). Not the live portal.';
  sol.solution.features[0].title = 'member-spfx staging Feature';
  sol.solution.features[0].id = STAGING.featureId;
  sol.solution.features[0].version = STAGING.version;
  sol.paths.zippedPackage = 'solution/member-spfx-staging.sppkg';
  writeFileSync(SOLUTION, JSON.stringify(sol, null, 2));
  // The manifest has comments, so edit it as text.
  const man = origManifest
    .replace('"id": "b292e3a9-7ad0-45e8-a4a3-20c131737313"', `"id": "${STAGING.webPartId}"`)
    // The component manifest version is part of the browser's manifest cache key: keep it equal to the solution version (3 parts),
    // otherwise a browser that has seen the old build keeps loading the old bundle after an upgrade.
    .replace('"version": "*"', `"version": "${STAGING.version.split('.').slice(0, 3).join('.')}"`)
    .replace('"alias": "AvenuePortalWebPart"', '"alias": "AvenuePortalStagingWebPart"')
    .replace('"title": { "default": "Avenue member portal" }', '"title": { "default": "Avenue Portal (Staging)" }')
    .replace('"description": { "default": "Avenue member portal" }', '"description": { "default": "Avenue member portal (staging build)" }');
  if (man === origManifest || !man.includes(STAGING.webPartId)) { throw new Error('manifest patterns did not match; staging build aborted'); }
  writeFileSync(MANIFEST, man);
  const bill = origBilling.replace('export const MOCK_PAYMENTS: boolean = true;', 'export const MOCK_PAYMENTS: boolean = false;');
  if (bill === origBilling) { throw new Error('MOCK_PAYMENTS pattern did not match; staging build aborted'); }
  writeFileSync(BILLING, bill);
  // R2 (support attachments) is live on the flow since 27 Nov; staging shows the attach button, the client's live build stays off until approved.
  const sup = origSupport.replace('export const SUPPORT_ATTACHMENTS_ENABLED: boolean = false;', 'export const SUPPORT_ATTACHMENTS_ENABLED: boolean = true;');
  if (sup === origSupport) { throw new Error('SUPPORT_ATTACHMENTS_ENABLED pattern did not match; staging build aborted'); }
  writeFileSync(SUPPORT, sup);
  status = spawnSync('npm', ['run', 'build'], { stdio: 'inherit', shell: process.platform === 'win32' }).status ?? 1;
} finally {
  writeFileSync(SOLUTION, origSolution);
  writeFileSync(MANIFEST, origManifest);
  writeFileSync(BILLING, origBilling);
  writeFileSync(SUPPORT, origSupport);
}
process.exit(status);
