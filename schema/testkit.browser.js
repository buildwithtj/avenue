// Small REST helpers for live tests, pasted into a console on a signed-in Avenue site tab (site owner).
// Every row a test creates is tracked in window.__made; cleanup() recycles exactly those ids (never a filter or "all").
// Test data uses the prefix "gaptest-" in ids. Mail from flows goes only to automations@ / automations+x@ addresses.
window.AV = (() => {
  const web = _spPageContextInfo.webAbsoluteUrl;
  const made = (window.__made = window.__made || []);
  let digest = null;
  const H = async (extra = {}) => {
    if (!digest) digest = (await (await fetch(web + '/_api/contextinfo', { method: 'POST', headers: { Accept: 'application/json;odata=nometadata' } })).json()).FormDigestValue;
    return { Accept: 'application/json;odata=nometadata', 'Content-Type': 'application/json;odata=nometadata', 'X-RequestDigest': digest, ...extra };
  };
  const L = t => `${web}/_api/web/lists/getbytitle('${t}')`;
  const get = async u => { const r = await fetch(u, { headers: await H() }); if (!r.ok) throw new Error(`${r.status} ${u}: ${(await r.text()).slice(0, 200)}`); return r.json(); };
  return {
    web, made,
    async add(list, fields) {
      const r = await fetch(`${L(list)}/items`, { method: 'POST', headers: await H(), body: JSON.stringify(fields) });
      if (!r.ok) throw new Error(`${r.status} add ${list}: ${(await r.text()).slice(0, 300)}`);
      const j = await r.json(); made.push([list, j.Id]); return j;
    },
    async query(list, filter, select = '*', top = 100) { return (await get(`${L(list)}/items?$filter=${encodeURIComponent(filter)}&$select=${select}&$top=${top}&$orderby=Id desc`)).value; },
    async merge(list, id, fields) {
      const r = await fetch(`${L(list)}/items(${id})`, { method: 'POST', headers: await H({ 'IF-MATCH': '*', 'X-HTTP-Method': 'MERGE' }), body: JSON.stringify(fields) });
      if (!r.ok) throw new Error(`${r.status} merge ${list}/${id}: ${(await r.text()).slice(0, 300)}`);
    },
    async attach(list, id, name, text) {
      const r = await fetch(`${L(list)}/items(${id})/AttachmentFiles/add(FileName='${name}')`, { method: 'POST', headers: await H({ 'Content-Type': 'application/octet-stream' }), body: new Blob([text]) });
      if (!r.ok) throw new Error(`${r.status} attach: ${(await r.text()).slice(0, 200)}`);
    },
    async recycle(list, id) { const r = await fetch(`${L(list)}/items(${id})/recycle`, { method: 'POST', headers: await H() }); return r.ok; },
    track(list, id) { made.push([list, id]); },
    async cleanup() { const out = []; for (const [l, id] of [...made]) out.push(`${l}/${id}:${await this.recycle(l, id)}`); made.length = 0; return out; },
    sleep: ms => new Promise(r => setTimeout(r, ms)),
  };
})();
