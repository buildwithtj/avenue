// Brings a live Avenue site in line with schema/lists.v2.json from a signed-in browser tab on the site
// (site owner). Paste into the console after defining `DEFS` (the JSON file's contents) and `APPLY`.
// APPLY = false only reports. Safe to re-run. It touches only lists named in DEFS and only the three
// Avenue groups' list-level roles; other role assignments and item-level sharing are left alone.
async function reconcileAvenue(DEFS, APPLY) {
  const web = _spPageContextInfo.webAbsoluteUrl;
  const digest = (await (await fetch(web + '/_api/contextinfo', { method: 'POST', headers: { Accept: 'application/json;odata=nometadata' } })).json()).FormDigestValue;
  const H = { Accept: 'application/json;odata=nometadata', 'Content-Type': 'application/json;odata=verbose', 'X-RequestDigest': digest };
  const get = async u => { const r = await fetch(web + u, { headers: H }); if (!r.ok) throw new Error(`${r.status} GET ${u}`); return r.json(); };
  const post = async (u, body, extra = {}) => { const r = await fetch(web + u, { method: 'POST', headers: { ...H, ...extra }, body: body ? JSON.stringify(body) : undefined }); if (!r.ok) throw new Error(`${r.status} POST ${u}: ${(await r.text()).slice(0, 200)}`); };
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const xml = f => { const a = `Name="${f.name}" StaticName="${f.name}" DisplayName="${f.name}"` + (f.indexed ? ' Indexed="TRUE"' : '') + (f.unique ? ' EnforceUniqueValues="TRUE"' : '');
    return ({ Text: `<Field Type="Text" ${a} />`, Number: `<Field Type="Number" ${a} />`, Note: `<Field Type="Note" ${a} />`,
      DateTime: `<Field Type="DateTime" Format="${f.dateOnly ? 'DateOnly' : 'DateTime'}" ${a} />`, Boolean: `<Field Type="Boolean" ${a}><Default>1</Default></Field>`,
      Choice: `<Field Type="Choice" ${a}><CHOICES>${(f.choices || []).map(c => `<CHOICE>${esc(c)}</CHOICE>`).join('')}</CHOICES></Field>` })[f.type]; };
  const log = [];
  const act = async (desc, fn) => { log.push((APPLY ? 'do   ' : 'plan ') + desc); if (APPLY) await fn(); };
  const roleId = {}; for (const r of ['Read', 'Contribute', 'Edit']) roleId[r] = (await get(`/_api/web/roledefinitions/getbyname('${r}')?$select=Id`)).Id;
  const groupId = {}; for (const g of DEFS.groups) groupId[g.name] = (await get(`/_api/web/sitegroups/getbyname('${encodeURIComponent(g.name)}')?$select=Id`)).Id;
  const existing = new Set((await get(`/_api/web/lists?$select=Title&$top=500`)).value.map(l => l.Title));
  for (const l of DEFS.lists) {
    const L = `/_api/web/lists/getbytitle('${l.title}')`;
    if (!existing.has(l.title)) {
      await act(`create list ${l.title}`, async () => {
        await post('/_api/web/lists', { __metadata: { type: 'SP.List' }, Title: l.title, BaseTemplate: l.library ? 101 : 100, EnableVersioning: true, Description: l.description || '' });
        if (l.itemLevel) await post(L, { __metadata: { type: 'SP.List' }, ReadSecurity: 2, WriteSecurity: 2 }, { 'X-HTTP-Method': 'MERGE', 'IF-MATCH': '*' });
        await post(`${L}/breakroleinheritance(copyRoleAssignments=false,clearSubscopes=true)`);
      });
    }
    const info = existing.has(l.title) ? await get(`${L}?$select=EnableVersioning,HasUniqueRoleAssignments`) : { EnableVersioning: true, HasUniqueRoleAssignments: true };
    if (!info.EnableVersioning) await act(`versioning on ${l.title}`, () => post(L, { __metadata: { type: 'SP.List' }, EnableVersioning: true }, { 'X-HTTP-Method': 'MERGE', 'IF-MATCH': '*' }));
    if (!info.HasUniqueRoleAssignments) { log.push(`WARN ${l.title} inherits permissions; not changed by this script`); continue; }
    const fields = existing.has(l.title) ? (await get(`${L}/fields?$select=InternalName,Choices,TypeAsString&$top=500`)).value : [];
    for (const f of l.fields) {
      const cur = fields.find(x => x.InternalName === f.name);
      if (!cur) await act(`field ${l.title}.${f.name}`, () => post(`${L}/fields/createfieldasxml`, { parameters: { __metadata: { type: 'SP.XmlSchemaFieldCreationInformation' }, SchemaXml: xml(f), Options: 16 } }));
      else if (f.type === 'Choice') {
        const missing = f.choices.filter(c => !(cur.Choices || []).includes(c));
        if (missing.length) await act(`choices ${l.title}.${f.name} += ${missing.join(', ')}`, () => post(`${L}/fields/getbyinternalnameortitle('${f.name}')`,
          { __metadata: { type: 'SP.FieldChoice' }, Choices: { __metadata: { type: 'Collection(Edm.String)' }, results: [...(cur.Choices || []), ...missing] } }, { 'X-HTTP-Method': 'MERGE', 'IF-MATCH': '*' }));
      }
    }
    const want = DEFS.access[l.access];
    const ras = existing.has(l.title) ? (await get(`${L}/roleassignments?$expand=RoleDefinitionBindings&$select=PrincipalId,RoleDefinitionBindings/Name,RoleDefinitionBindings/Id`)).value : [];
    for (const g of DEFS.groups) {
      const have = (ras.find(r => r.PrincipalId === groupId[g.name])?.RoleDefinitionBindings || []).filter(b => b.Name !== 'Limited Access');
      const desired = want[g.name];
      for (const b of have) if (b.Name !== desired) await act(`${l.title}: remove ${g.name} ${b.Name}`, () => post(`${L}/roleassignments/removeroleassignment(principalid=${groupId[g.name]},roledefid=${b.Id})`));
      if (desired && !have.some(b => b.Name === desired)) await act(`${l.title}: grant ${g.name} ${desired}`, () => post(`${L}/roleassignments/addroleassignment(principalid=${groupId[g.name]},roledefid=${roleId[desired]})`));
    }
  }
  return log;
}
