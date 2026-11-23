// Loads the client's check-in questions into AvenueChecklistQuestions on the REAL Avenue site. Paste schema/testkit.browser.js FIRST (defines window.AV),
// then set window.__questions = <the client's questions: an array of {Kind, Question, SortOrder, Active} or CSV text>
// (validate first offline: node -e "import('./schema/checklist.seed.mjs').then(m=>console.log(JSON.stringify(m.parseChecklist(require('fs').readFileSync('questions.csv','utf8')))))"),
// then paste this file on a signed-in tab of the Avenue site (site owner) and run `await checklistLoad()`.
// APPLY=false (default) only REPORTS. APPLY=true adds missing questions and updates existing ones by Kind + SortOrder. Never deletes (retire a question by Active=false).
// No questions are built in: an empty window.__questions does nothing. The same validation as checklist.seed.mjs is repeated below so the script is self-contained.
window.checklistLoad = async () => {
  const APPLY = window.APPLY === true, KINDS = ['Entry', 'Exit', 'Wellness'], out = [];
  const raw = window.__questions;
  if (!raw || (typeof raw === 'string' && !raw.trim()) || (Array.isArray(raw) && !raw.length)) return { site: AV.web, apply: APPLY, rows: ['nothing to load: set window.__questions first'] };
  const items = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const seen = new Set(), rows = [];
  for (const [i, it] of items.entries()) {
    const kind = String(it.Kind || '').trim(), q = String(it.Question || '').trim(), order = Number(it.SortOrder);
    if (!KINDS.includes(kind) || !q || q.length > 500 || !Number.isInteger(order) || order < 1 || seen.has(kind + ':' + order)) throw new Error(`row ${i + 1} is invalid (run parseChecklist offline first)`);
    seen.add(kind + ':' + order); rows.push({ kind, q, order, active: it.Active !== false && String(it.Active).toLowerCase() !== 'false' });
  }
  for (const r of rows) {
    const found = await AV.query('AvenueChecklistQuestions', `Kind eq '${r.kind}' and SortOrder eq ${r.order}`, 'Id,Question,Active', 1);
    const fields = { Title: `${r.kind} ${r.order}`, FacilityId: 'flavors-hyattsville', Kind: r.kind, Question: r.q, SortOrder: r.order, Active: r.active };
    const label = `${r.kind} #${r.order}`;
    if (!APPLY) { out.push(`${found.length ? 'would update' : 'would add   '} ${label}`); continue; }
    if (found.length) { await AV.merge('AvenueChecklistQuestions', found[0].Id, fields); out.push(`updated ${label}`); }
    else { const j = await AV.add('AvenueChecklistQuestions', fields); out.push(`added   ${label} (id ${j.Id})`); }
  }
  AV.made.length = 0; // real catalogue rows: never in the cleanup tracker
  return { site: AV.web, apply: APPLY, rows: out };
};
