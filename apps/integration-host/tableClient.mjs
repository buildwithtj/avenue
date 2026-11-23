// Adapts an @azure/data-tables TableClient (passed in) to the table interface store.mjs expects.
// Keys are base64url-encoded because row keys cannot contain some characters; the record travels as JSON.
const rk = (k) => Buffer.from(String(k)).toString('base64url');
const PK = 'avenue';
const status = (e) => e?.statusCode ?? e?.status;

export function createAzureTable(client) {
  const toRow = (e) => ({ ...JSON.parse(e.data), etag: e.etag });
  return {
    async insert(key, row) {
      try { await client.createEntity({ partitionKey: PK, rowKey: rk(key), data: JSON.stringify(row) }); return true; }
      catch (e) { if (status(e) === 409) return false; throw e; }
    },
    async get(key) {
      try { return toRow(await client.getEntity(PK, rk(key))); }
      catch (e) { if (status(e) === 404) return undefined; throw e; }
    },
    async replace(key, row, etag) {
      try { await client.updateEntity({ partitionKey: PK, rowKey: rk(key), data: JSON.stringify(row) }, 'Replace', { etag }); return true; }
      catch (e) { if (status(e) === 412 || status(e) === 404) return false; throw e; }
    },
    async upsert(key, row) { await client.upsertEntity({ partitionKey: PK, rowKey: rk(key), data: JSON.stringify(row) }, 'Replace'); }
  };
}
