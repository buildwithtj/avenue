// DEMO DATA for one tester on the REAL Avenue site (see schema/memberdemo.seed.mjs). Paste schema/testkit.browser.js FIRST (defines window.AV),
// then set window.__md = <JSON of buildMemberDemo({email})> (node -e "import('./schema/memberdemo.seed.mjs').then(m=>console.log(JSON.stringify(m.buildMemberDemo({email:'tester@example.com'}))))"),
// then paste this file on a signed-in tab of the Avenue site (site owner).
//   await mdReport()   // what exists / would be added; changes nothing
//   await mdApply()    // adds the rows that are missing (matched by Title); never edits or deletes an existing row
//   await mdCleanup()  // recycles exactly the rows whose Title (or flow key) starts with "demo-md-", one explicit id at a time
(() => {
  const P = 'demo-md-';
  const CLEAN = { AvenueSupportCases: 'CaseId', AvenueEventCases: 'RequestId', AvenueStorageCases: 'RequestId', AvenueCalendar: 'BookingId', AvenueHoursLedger: 'BookingId' };
  const lists = () => [...new Set(window.__md.map(r => r.list))];
  const exists = (r) => AV.query(r.list, `Title eq '${r.key}'`, 'Id', 1);
  window.mdReport = async () => { const out = []; for (const r of window.__md) out.push(`${(await exists(r)).length ? 'has    ' : 'ADD    '}${r.list} ${r.key}`); return { site: AV.web, rows: out }; };
  window.mdApply = async () => {
    const out = [];
    for (const r of window.__md) {
      if ((await exists(r)).length) { out.push(`skip ${r.list} ${r.key}`); continue; }
      try { const j = await AV.add(r.list, r.fields); out.push(`added ${r.list}/${j.Id} ${r.key}`); } catch (e) { out.push(`FAILED ${r.list} ${r.key}: ${String(e.message).slice(0, 160)}`); }
    }
    AV.made.length = 0; return { site: AV.web, rows: out };
  };
  window.mdCleanup = async () => {
    const out = [], targets = {};
    lists().forEach(l => { targets[l] = 'Title'; }); Object.assign(targets, CLEAN);
    for (const [list, f] of Object.entries(targets)) {
      let rows = []; try { rows = await AV.query(list, `startswith(${f},'${P}')`, 'Id', 200); } catch (e) { out.push(`skip ${list}: ${String(e.message).slice(0, 80)}`); continue; }
      for (const r of rows) out.push(`${list}/${r.Id}: ${await AV.recycle(list, r.Id)}`);
    }
    return { site: AV.web, removed: out };
  };
})();
