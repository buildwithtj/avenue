// Table-storage adapter for billing-core's atomic webhook store. [PROPOSED, Q-01: host not approved]
// `table` is any client with: insert(row) -> false if the key exists; get(key) -> row|undefined; replace(key, row, etag) -> false on ETag mismatch;
// upsert(key, row). The real host passes a thin wrapper over @azure/data-tables; tests pass createMemoryTable().
export function createTableStore(table) {
  const clean = ({ etag, ...r }) => r;
  return {
    async has(id) { return !!(await table.get(id)); },
    async get(id) { const r = await table.get(id); return r ? { ...clean(r), version: r.version } : undefined; },
    async del(id) { await table.del?.(id); },
    async put(record) {
      if (!record || !record.id) throw new Error('record.id is required');
      await table.upsert(record.id, { ...record });
    },
    async putIfAbsent(record) {
      if (!record || !record.id) throw new Error('record.id is required');
      return table.insert(record.id, { ...record, version: record.version ?? 1 });
    },
    async compareAndSet(id, expectedVersion, newRecord) {
      if (!id) throw new Error('id is required');
      const cur = await table.get(id);
      const curVersion = cur ? (cur.version ?? 0) : 0;
      if (curVersion !== (expectedVersion ?? 0)) return false;
      const next = { ...newRecord, id, version: curVersion + 1 };
      if (!cur) return table.insert(id, next);
      return table.replace(id, next, cur.etag);
    }
  };
}

/** In-memory table with real ETag semantics, for tests and local runs. */
export function createMemoryTable() {
  const m = new Map(); let n = 0;
  return {
    async insert(k, row) { if (m.has(k)) return false; m.set(k, { ...row, etag: ++n }); return true; },
    async get(k) { const r = m.get(k); return r ? { ...r } : undefined; },
    async replace(k, row, etag) { const c = m.get(k); if (!c || c.etag !== etag) return false; m.set(k, { ...row, etag: ++n }); return true; },
    async upsert(k, row) { m.set(k, { ...row, etag: ++n }); },
    async del(k) { m.delete(k); }
  };
}
