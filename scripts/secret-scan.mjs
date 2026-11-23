// Fails (exit 1) if source, docs or config contain something that looks like a real secret. Run: node scripts/secret-scan.mjs
// Fake values in tests are allowed only when they say so (contain "test_not_real", "abc123", "example" or "REDACTED").
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SKIP = new Set(['node_modules', '.git', 'lib', 'lib-commonjs', 'lib-amd', 'dist', 'temp', 'solution', 'references', '.heft', 'release']);
const TEXT = /\.(mjs|js|ts|tsx|json|md|py|yml|yaml|txt|html|svg|scss|css|toml|env)$/i;
const RULES = [
  ['Stripe live key', /\b(sk|rk|pk)_live_[A-Za-z0-9]{8,}/],
  ['Stripe test key with a real-looking body', /\b(sk|rk)_test_(?!.*(abc123|not_real|example|REDACTED))[A-Za-z0-9]{16,}/],
  ['Stripe webhook secret', /\bwhsec_(?!.*(test_not_real|abc123|example|REDACTED))[A-Za-z0-9]{16,}/],
  ['Private key block', /-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['JWT-looking token', /\beyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/],
  ['Password assignment', /\b(password|passwd|client_secret|api[_-]?key|secret[_-]?key)\b["']?\s*[:=]\s*["'](?!.*(example|REDACTED|abc123|test_not_real|<|\$\{|process\.env|your-|xxx|\*\*\*))[^"'\s]{8,}["']/i],
  ['Connection string with key', /AccountKey=[A-Za-z0-9+/=]{20,}/]
];

const hits = []; let files = 0;
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name); const st = statSync(p);
    if (st.isDirectory()) { walk(p); continue; }
    if (!TEXT.test(name) || st.size > 2_000_000) continue;
    files++;
    readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
      for (const [what, re] of RULES) if (re.test(line)) hits.push(`${relative(process.cwd(), p)}:${i + 1}  ${what}`);
    });
  }
})(process.cwd());

if (hits.length) { console.error(`Possible secrets (${hits.length}):\n` + hits.join('\n')); process.exit(1); }
console.log(`OK: no secrets found in ${files} files.`);
