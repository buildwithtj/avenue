// Runner. Paste schema/testkit.browser.js FIRST (defines window.AV), set window.__seed = <output of node schema/seed.print.mjs>,
// then paste this file on a signed-in tab of the Avenue site (site owner). seedRun() upserts by Title (re-running updates its own rows);
// Support topics (buildSupportTopics) are real config upserted by their Title and are never removed here.
// seedCleanup() recycles exactly the rows whose Title starts with "demo-", one explicit id at a time, never a bulk delete.
window.seedRun = async () => {
  const out = [];
  for (const { list, key, fields } of window.__seed) {
    const found = await AV.query(list, `Title eq '${key}'`, 'Id', 1);
    if (found.length) { await AV.merge(list, found[0].Id, fields); out.push(`updated ${list}/${found[0].Id} ${key}`); }
    else { const j = await AV.add(list, fields); out.push(`added   ${list}/${j.Id} ${key}`); }
  }
  AV.made.length = 0;
  return { site: AV.web, rows: out };
};
window.seedCleanup = async () => {
  const out = [];
  for (const list of [...new Set(window.__seed.map(r => r.list))]) {
    for (const r of await AV.query(list, "startswith(Title,'demo-')", 'Id,Title', 200)) out.push(`${list}/${r.Id} ${r.Title}: ${await AV.recycle(list, r.Id)}`);
  }
  return { site: AV.web, removed: out };
};
