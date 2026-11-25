// DEMO ONLY - REMOVE BEFORE GO-LIVE (developer decision 23 Nov 2026: a way to start a demo member from the beginning).
// Paste schema/testkit.browser.js FIRST (defines window.AV), then this file on a signed-in tab of the Avenue site (site owner).
//   await memberResetReport('someone@example.com')   // counts what would go, changes nothing
//   await memberResetApply('someone@example.com')    // recycles those rows one explicit id at a time (site recycle bin, restorable)
// Guards: refuses staff/owner e-mails; never a bulk delete; never touches plans, config, notices or other members.
// Does NOT remove the Entra guest or the SharePoint site user, and cannot clear the browser key `avenue.mockJoined` (clear it in that browser).
(() => {
  const OWN = [['AvenueMembers', 'MemberId'], ['AvenueBookings', 'MemberId'], ['AvenueHoursLedger', 'MemberId'], ['AvenueMemberDocuments', 'MemberId'],
    ['AvenueComplianceOverrides', 'MemberId'], ['AvenueCheckIns', 'MemberId'], ['AvenueDocumentFiles', 'MemberId'], ['AvenueMyMembership', 'MemberId'],
    ['AvenueComplianceCases', 'MemberId'], ['AvenueApplicants', 'Email'], ['AvenueInvoices', 'MemberId'], ['AvenueSupportCases', 'MemberId'],
    ['AvenueEventCases', 'MemberId'], ['AvenueStorageCases', 'MemberId'], ['AvenueSupportFiles', 'MemberId'], ['AvenueMyDocuments', 'MemberId'],
    ['AvenueMyHours', 'MemberId'], ['AvenueMyBookings', 'MemberId']];
  // Intake lists hold the member's own items: found by author, not by a field.
  const INTAKE = ['AvenueBookingRequests', 'AvenueDocumentSubmissions', 'AvenueCheckInSubmissions', 'AvenueSupportMessages', 'AvenueEventRequests', 'AvenueStorageRequests', 'AvenueNoticeReads'];
  const esc = s => s.replace(/'/g, "''");
  async function isStaff(email) {
    const u = await fetch(`${AV.web}/_api/web/siteusers?$filter=Email eq '${esc(email)}'&$expand=Groups&$select=Id,Groups/Title`, { headers: { Accept: 'application/json;odata=nometadata' } });
    return /Avenue Flavors Staff|Avenue Flavors Owner|Avenue Owners|Owners|Site Owners/.test(JSON.stringify(await u.json()));
  }
  async function find(email) {
    const e = email.toLowerCase().trim(), hits = [];
    for (const [list, f] of OWN) for (const r of await AV.query(list, `${f} eq '${esc(e)}'`, 'Id', 500)) hits.push([list, r.Id]);
    const su = (await (await fetch(`${AV.web}/_api/web/siteusers?$filter=Email eq '${esc(e)}'&$select=Id`, { headers: { Accept: 'application/json;odata=nometadata' } })).json()).value;
    for (const u of su) for (const list of INTAKE) {
      try { for (const r of await AV.query(list, `AuthorId eq ${u.Id}`, 'Id', 500)) hits.push([list, r.Id]); } catch (x) { /* list missing on this site */ }
    }
    return hits;
  }
  window.memberResetReport = async email => {
    if (!/^[^@\s]+@[^@\s]+$/.test(email)) throw new Error('give one e-mail address');
    if (await isStaff(email)) return { refused: 'staff or owner account' };
    const h = await find(email), by = {};
    h.forEach(([l]) => { by[l] = (by[l] || 0) + 1; });
    return { email, total: h.length, byList: by };
  };
  window.memberResetApply = async email => {
    const rep = await window.memberResetReport(email);
    if (rep.refused) return rep;
    const out = [];
    for (const [list, id] of await find(email)) out.push(`${list}/${id}: ${await AV.recycle(list, id)}`);
    return { email, removed: out.length, detail: out };
  };
})();
