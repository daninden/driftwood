/**
 * ai/logStore — the thin IndexedDB adapter of the logbook (0.36.8 "Logbook"). It only stores and returns the lines ai/logbook hands it; the entries, the cap and the order live there (and are tested without a browser).
 * Database `driftwood-log` (LOG_DB), version 1, two object stores: `lines` (key `n`, the line number; values { n, k, line, bytes, id? }) and `meta` (key 'meta': { seed, started, dropped }). One log for the whole browser: a new game or another seed clears it (ai/logbook `open`).
 * Everything is wrapped: `openLogStore` rejects when IndexedDB is missing, blocked or does not answer within `timeout` ms (the logbook then keeps its lines in memory only), and a failing call rejects (the logbook stops using the store and goes on in memory).
 *
 * Exports:
 *   LOG_DB, openLogStore(idb?, { timeout?, name? }) -> Promise<store>     idb defaults to the browser's `indexedDB`
 *   store.load() -> Promise<{ meta, entries }>     store.write({ add, remove, meta }) -> Promise (one transaction)     store.setMeta(meta)     store.clear() -> Promise
 *
 * Depends on: nothing (IndexedDB is handed in)
 */
export const LOG_DB = 'driftwood-log';

const wrap = req => new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error || new Error('indexedDB request failed')); });
const done = tx => new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error || new Error('indexedDB transaction failed')); tx.onabort = () => reject(tx.error || new Error('indexedDB transaction aborted')); });

export function openLogStore(idb = (typeof indexedDB !== 'undefined' ? indexedDB : null), { timeout = 2000, name = LOG_DB } = {}) {
  return new Promise((resolve, reject) => {
    if (!idb) { reject(new Error('no indexedDB')); return; }
    let settled = false;
    const timer = setTimeout(() => { if (!settled) { settled = true; reject(new Error('indexedDB did not answer')); } }, timeout);
    const fail = e => { clearTimeout(timer); if (!settled) { settled = true; reject(e instanceof Error ? e : new Error('indexedDB failed')); } };
    let req;
    try { req = idb.open(name, 1); } catch (e) { fail(e); return; }
    req.onupgradeneeded = () => { try { const db = req.result; if (!db.objectStoreNames.contains('lines')) db.createObjectStore('lines', { keyPath: 'n' }); if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta'); } catch (e) { fail(e); } };
    req.onerror = () => fail(req.error); req.onblocked = () => fail(new Error('indexedDB blocked'));
    req.onsuccess = () => {
      clearTimeout(timer); if (settled) { try { req.result.close(); } catch (e) { /* too late */ } return; }
      settled = true;
      const db = req.result;
      resolve({
        async load() {
          const tx = db.transaction(['lines', 'meta'], 'readonly'), a = wrap(tx.objectStore('lines').getAll()), m = wrap(tx.objectStore('meta').get('meta'));
          const [entries, meta] = await Promise.all([a, m]); return { meta: meta || null, entries: entries || [] };
        },
        async write({ add = [], remove = [], meta = null } = {}) {
          const tx = db.transaction(['lines', 'meta'], 'readwrite'), ls = tx.objectStore('lines');
          for (const e of add) ls.put(e);
          for (const n of remove) ls.delete(n);
          if (meta) tx.objectStore('meta').put(meta, 'meta');
          await done(tx);
        },
        async setMeta(meta) { const tx = db.transaction(['meta'], 'readwrite'); tx.objectStore('meta').put(meta, 'meta'); await done(tx); },
        async clear() { const tx = db.transaction(['lines', 'meta'], 'readwrite'); tx.objectStore('lines').clear(); tx.objectStore('meta').clear(); await done(tx); },
      });
    };
  });
}
