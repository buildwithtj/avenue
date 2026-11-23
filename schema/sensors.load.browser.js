// Sensors loader for the REAL Avenue site. Paste schema/testkit.browser.js FIRST (defines window.AV), then set
//   window.__sensors = <JSON of buildSensors(): node -e "import('./schema/sensors.seed.mjs').then(m=>console.log(JSON.stringify(m.buildSensors())))">
// then paste this file on a signed-in tab of the Avenue site (site owner). Run reconcile.browser.js first so AvenueSensors exists.
// APPLY=false (default) only REPORTS. APPLY=true adds missing units and updates existing ones by SensorId (sheet values win). Never deletes.
window.sensorsLoad = async () => {
  const APPLY = window.APPLY === true;
  const out = [];
  for (const { key, fields } of window.__sensors) {
    const found = await AV.query('AvenueSensors', `SensorId eq '${key.replace(/'/g, "''")}'`, 'Id,SensorId', 1);
    if (!APPLY) { out.push(`${found.length ? 'exists ' : 'MISSING'} ${key} (would ${found.length ? 'update' : 'add'})`); continue; }
    if (found.length) { await AV.merge('AvenueSensors', found[0].Id, fields); out.push(`updated AvenueSensors/${found[0].Id} ${key}`); }
    else { const j = await AV.add('AvenueSensors', fields); out.push(`added   AvenueSensors/${j.Id} ${key}`); }
  }
  AV.made.length = 0; // real catalogue rows: never in the cleanup tracker
  return { site: AV.web, apply: APPLY, rows: out };
};
