#!/usr/bin/env node
// Provisions the Avenue lists from lists.v2.json using the CLI for Microsoft 365 (`m365`).
// Safe to re-run: it skips groups, lists and fields that already exist.
// Nothing here has been run against a tenant. Use a TEST site with synthetic data only.
//
//   npm i -g @pnp/cli-microsoft365 && m365 login          (interactive; no secrets in this repo)
//   node schema/provision.mjs --web https://<tenant>.sharepoint.com/sites/<test-site> --dry-run
//   node schema/provision.mjs --web <same url>
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
export const defs = JSON.parse(readFileSync(join(here, 'lists.v2.json'), 'utf8'));

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

export function fieldXml(f) {
  const a = `Name="${f.name}" StaticName="${f.name}" DisplayName="${f.name}"` +
    (f.indexed ? ' Indexed="TRUE"' : '') + (f.unique ? ' EnforceUniqueValues="TRUE"' : '');
  switch (f.type) {
    case 'Text': return `<Field Type="Text" ${a} />`;
    case 'Number': return `<Field Type="Number" ${a} />`;
    case 'Note': return `<Field Type="Note" ${a} />`;
    case 'DateTime': return `<Field Type="DateTime" Format="${f.dateOnly ? 'DateOnly' : 'DateTime'}" ${a} />`;
    case 'Boolean': return `<Field Type="Boolean" ${a}><Default>${f.default === false ? 0 : 1}</Default></Field>`;
    case 'Choice': return `<Field Type="Choice" ${a}><CHOICES>${f.choices.map(c => `<CHOICE>${esc(c)}</CHOICE>`).join('')}</CHOICES></Field>`;
    default: throw new Error(`Unknown field type ${f.type}`);
  }
}

// Each step: { desc, check?: argv that exits 0 when the thing already exists, run: argv }
export function plan(web) {
  const steps = [];
  for (const g of defs.groups) {
    steps.push({ desc: `group ${g.name}`, check: ['spo', 'group', 'get', '--webUrl', web, '--name', g.name],
      run: ['spo', 'group', 'add', '--webUrl', web, '--name', g.name, '--description', g.description] });
  }
  for (const l of defs.lists) {
    steps.push({ desc: `list ${l.title}`, check: ['spo', 'list', 'get', '--webUrl', web, '--title', l.title],
      run: ['spo', 'list', 'add', '--webUrl', web, '--title', l.title, '--baseTemplate', l.library ? 'DocumentLibrary' : 'GenericList', '--enableVersioning', 'true', ...(l.itemLevel ? ['--readSecurity', '2', '--writeSecurity', '2'] : [])] });
    for (const f of l.fields) {
      steps.push({ desc: `field ${l.title}.${f.name}`,
        check: ['spo', 'field', 'get', '--webUrl', web, '--listTitle', l.title, '--internalName', f.name],
        run: ['spo', 'field', 'add', '--webUrl', web, '--listTitle', l.title, '--xml', fieldXml(f), '--options', 'AddToDefaultView'] });
    }
    // Remove inherited permissions, then grant only the groups this list's access class allows.
    steps.push({ desc: `permissions ${l.title}: break inheritance`,
      run: ['spo', 'list', 'roleinheritance', 'break', '--webUrl', web, '--listTitle', l.title, '--clearExistingPermissions', '--force'] });
    for (const [group, role] of Object.entries(defs.access[l.access])) {
      steps.push({ desc: `permissions ${l.title}: ${group} = ${role}`,
        run: ['spo', 'list', 'roleassignment', 'add', '--webUrl', web, '--listTitle', l.title, '--groupName', group, '--roleDefinitionName', role] });
    }
  }
  return steps;
}

function main() {
  const args = process.argv.slice(2);
  const web = args[args.indexOf('--web') + 1];
  const dry = args.includes('--dry-run');
  if (!args.includes('--web') || !web || !/^https:\/\/[^/]+\.sharepoint\.com\/sites\/[^/]+\/?$/.test(web)) {
    console.error('Usage: node schema/provision.mjs --web https://<tenant>.sharepoint.com/sites/<site> [--dry-run]');
    process.exit(2);
  }
  const bin = process.env.M365 || 'm365';
  const run = argv => spawnSync(bin, argv, { encoding: 'utf8' });
  let created = 0, skipped = 0;
  for (const s of plan(web.replace(/\/$/, ''))) {
    if (dry) { console.log(`[dry-run] ${s.desc}`); continue; }
    if (s.check && run([...s.check, '--output', 'none']).status === 0) { console.log(`skip    ${s.desc}`); skipped++; continue; }
    const r = run(s.run);
    if (r.status !== 0) { console.error(`FAILED  ${s.desc}\n${r.stderr || r.stdout}`); process.exit(1); }
    console.log(`done    ${s.desc}`); created++;
  }
  if (!dry) console.log(`\n${created} created or applied, ${skipped} already present.`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main();
