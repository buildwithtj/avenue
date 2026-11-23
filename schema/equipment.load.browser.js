// Equipment catalogue loader for the REAL Avenue site. Paste schema/testkit.browser.js FIRST (defines window.AV), then set
//   window.__equipment = <JSON of buildEquipment(), e.g. node -e "import('./schema/equipment.seed.mjs').then(m=>console.log(JSON.stringify(m.buildEquipment())))">
// then paste this file on a signed-in tab of the Avenue site (site owner). The list is PARTIAL / counts UNCONFIRMED (see equipment.seed.mjs).
// APPLY=false (default) only REPORTS which rows exist. APPLY=true ADDS the missing rows by EquipmentId; it never updates or deletes
// an existing row (staff edit them in the Setup screen). Run the report first, read it, then set window.APPLY = true and run again.
window.equipmentLoad = async () => {
  const APPLY = window.APPLY === true;
  const out = [];
  for (const { key, fields } of window.__equipment) {
    const found = await AV.query('AvenueEquipment', `EquipmentId eq '${key}'`, 'Id,EquipmentId', 1);
    if (found.length) { out.push(`exists  AvenueEquipment/${found[0].Id} ${key}`); continue; }
    if (!APPLY) { out.push(`MISSING ${key} (would add)`); continue; }
    const j = await AV.add('AvenueEquipment', fields);
    out.push(`added   AvenueEquipment/${j.Id} ${key}`);
  }
  AV.made.length = 0; // loaded rows are real catalogue data, not test rows: never leave them in the cleanup tracker
  return { site: AV.web, apply: APPLY, rows: out };
};
