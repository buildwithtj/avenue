// Validates the client's check-in questions (Entry / Exit / Wellness) before they are loaded into AvenueChecklistQuestions.
// NO questions are invented here: the client's lists were in an e-mail attachment that has not been received (Q-10). Empty input yields no rows.
// Input: an array of {Kind, Question, SortOrder?, Active?} or CSV text with a header row (Kind,Question,SortOrder,Active).
export const KINDS = ['Entry', 'Exit', 'Wellness'];
export const MAX_QUESTION = 500;

function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some(x => x.trim())) rows.push(row); row = []; }
    else cell += c;
  }
  row.push(cell); if (row.some(x => x.trim())) rows.push(row);
  if (!rows.length) return [];
  const head = rows[0].map(h => h.trim());
  return rows.slice(1).map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}

/** Returns {rows:[{Kind, Question, SortOrder, Active}], errors:[string]}. rows is empty whenever errors is not. */
export function parseChecklist(input) {
  let items;
  if (typeof input === 'string') { const t = input.trim(); if (!t) return { rows: [], errors: [] }; items = t.startsWith('[') ? JSON.parse(t) : parseCsv(t); }
  else items = input || [];
  if (!Array.isArray(items)) return { rows: [], errors: ['input must be an array or CSV text'] };
  const errors = [], rows = [], seen = new Set(), next = {};
  items.forEach((it, i) => {
    const at = `row ${i + 1}`;
    const kind = String(it?.Kind ?? '').trim(), question = String(it?.Question ?? '').trim();
    if (!KINDS.includes(kind)) { errors.push(`${at}: Kind must be one of ${KINDS.join(', ')}`); return; }
    if (!question) { errors.push(`${at}: Question is empty`); return; }
    if (question.length > MAX_QUESTION) { errors.push(`${at}: Question is longer than ${MAX_QUESTION} characters`); return; }
    next[kind] = (next[kind] || 0) + 1;
    const hasOrder = it.SortOrder !== undefined && String(it.SortOrder).trim() !== '';
    const order = hasOrder ? Number(it.SortOrder) : next[kind];
    if (!Number.isInteger(order) || order < 1) { errors.push(`${at}: SortOrder must be a whole number from 1`); return; }
    if (seen.has(`${kind}:${order}`)) { errors.push(`${at}: SortOrder ${order} is used twice for ${kind}`); return; }
    seen.add(`${kind}:${order}`);
    const a = String(it.Active ?? 'true').trim().toLowerCase();
    rows.push({ Kind: kind, Question: question, SortOrder: order, Active: !['false', 'no', '0'].includes(a) });
  });
  return errors.length ? { rows: [], errors } : { rows, errors };
}
