// Plans loader for the REAL Avenue site. Paste schema/testkit.browser.js FIRST (defines window.AV), then set
//   window.__plans = <JSON of buildPlans(): node -e "import('./schema/plans.seed.mjs').then(m=>console.log(JSON.stringify(m.buildPlans())))">
// then paste this file on a signed-in tab of the Avenue site (site owner). Run reconcile.browser.js first so the new AvenuePlans fields exist.
// APPLY=false (default) only REPORTS. APPLY=true adds missing plans and updates existing ones by PlanId (sheet values win). Never deletes.
window.plansLoad = async () => {
  const APPLY = window.APPLY === true;
  const out = [];
  for (const { key, fields } of window.__plans) {
    const found = await AV.query('AvenuePlans', `PlanId eq '${key.replace(/'/g, "''")}'`, 'Id,PlanId', 1);
    if (!APPLY) { out.push(`${found.length ? 'exists ' : 'MISSING'} ${key} (would ${found.length ? 'update' : 'add'})`); continue; }
    if (found.length) { await AV.merge('AvenuePlans', found[0].Id, fields); out.push(`updated AvenuePlans/${found[0].Id} ${key}`); }
    else { const j = await AV.add('AvenuePlans', fields); out.push(`added   AvenuePlans/${j.Id} ${key}`); }
  }
  AV.made.length = 0; // real catalogue rows: never in the cleanup tracker
  return { site: AV.web, apply: APPLY, rows: out };
};
