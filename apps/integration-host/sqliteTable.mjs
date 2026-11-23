// Persistent table for billing-core's atomic webhook store, on the host's own disk (node:sqlite, no dependency).
// Same contract as createMemoryTable / the Azure Table wrapper: insert -> false if the key exists; replace -> false on ETag mismatch.
// SQLite statements run synchronously in one process, so each call is atomic. Run ONE host process per database file.
import { DatabaseSync } from 'node:sqlite';

export function createSqliteTable(path) {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; CREATE TABLE IF NOT EXISTS rows (k TEXT PRIMARY KEY, v TEXT NOT NULL, etag INTEGER NOT NULL)');
  const sel = db.prepare('SELECT v, etag FROM rows WHERE k = ?');
  const ins = db.prepare('INSERT OR IGNORE INTO rows (k, v, etag) VALUES (?, ?, 1)');
  const upd = db.prepare('UPDATE rows SET v = ?, etag = etag + 1 WHERE k = ? AND etag = ?');
  const ups = db.prepare('INSERT INTO rows (k, v, etag) VALUES (?, ?, 1) ON CONFLICT(k) DO UPDATE SET v = excluded.v, etag = etag + 1');
  const dele = db.prepare('DELETE FROM rows WHERE k = ?');
  return {
    async del(k) { dele.run(k); },
    async insert(k, row) { return ins.run(k, JSON.stringify(row)).changes === 1; },
    async get(k) { const r = sel.get(k); return r ? { ...JSON.parse(r.v), etag: r.etag } : undefined; },
    async replace(k, row, etag) { return upd.run(JSON.stringify(row), k, etag).changes === 1; },
    async upsert(k, row) { ups.run(k, JSON.stringify(row)); },
    close() { db.close(); }
  };
}
