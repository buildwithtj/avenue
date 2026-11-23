// Writes list items to SharePoint through Microsoft Graph (app-only, Sites.Selected). `fetch` and `getToken` are injected.
// Retries twice on 429/503 honouring Retry-After. Never logs the token.
export function createGraphWriter({ fetch, getToken, siteId, sleep = (ms) => new Promise(r => setTimeout(r, ms)) }) {
  const base = `https://graph.microsoft.com/v1.0/sites/${encodeURIComponent(siteId)}`;
  async function call(method, path, body) {
    for (let n = 0; ; n++) {
      const res = await fetch(base + path, { method, headers: { authorization: `Bearer ${await getToken()}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      if ((res.status === 429 || res.status === 503) && n < 2) { await sleep(Math.min(10, Number(res.headers?.get?.('retry-after')) || 2 * (n + 1)) * 1000); continue; }
      if (!res.ok) throw new Error(`graph: ${method} ${path.split('?')[0]} returned ${res.status}`);
      return res.status === 204 ? undefined : res.json();
    }
  }
  return {
    addItem: (list, fields) => call('POST', `/lists/${encodeURIComponent(list)}/items`, { fields }),
    updateItem: (list, id, fields) => call('PATCH', `/lists/${encodeURIComponent(list)}/items/${encodeURIComponent(id)}/fields`, fields),
    async findItems(list, filter, top = 100) {
      const r = await call('GET', `/lists/${encodeURIComponent(list)}/items?$expand=fields&$filter=${encodeURIComponent(filter)}&$top=${top}`);
      return (r?.value || []).map(i => ({ id: i.id, ...i.fields }));
    }
  };
}
