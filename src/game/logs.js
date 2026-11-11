/**
 * game/logs — the logs of felled trees (0.31 "Axe"): timber, lying where a tree went down until he shoulders one.
 *
 * Rules
 *   - A log is a piece like a driftwood log (game/wood): { id, x, y, z, len, a, rad, timber: true }, about 2 m long (game/felled LOG_LEN) and a hand thick or more. It is always dry, never
 *     rots, never burns and is never taken by the sea. Lying logs block no step (nothing loose is solid).
 *   - Logs exist only where a tree was felled (`add`); there are none in a new world. A log is lying, carried (one at a time, game/wood `log`) or on a log pile (kind 'log'); it never lies loose
 *     again once it was picked up. Ids start at LOG_ID0, above the stone ids, so a saved pile or a carried log is read back by `piece(id)`.
 *
 * Pure data on a world; no DOM, no Three.js.
 *
 * LOG_ID0
 * createLogs(world, saved?) -> logs
 *   logs.all                  every log there is, lying or not (a Map id -> log)
 *   logs.version              goes up with every change, for the renderer      logs.dirty   a Set of the indices of the tiles (world.tiles) whose lying logs changed (the view empties it); not saved
 *   logs.add({ x, z, len, a, rad }) -> log      a new log lying there (y is the ground)
 *   logs.near(x, z, reach)    the logs lying within reach (and a log's half length) of (x, z)
 *   logs.lying(tile)          the logs lying on a tile (for the renderer)
 *   logs.onGround(l)          true while the log lies where it was made
 *   logs.piece(id)            the log with that id (lying or not), or null
 *   logs.take(l) -> true when it was lifted off the ground (false: gone already)
 *   logs.state() -> { list: [{ id, x, y, z, len, a, rad }], taken: [id] }   plain, for saving; saved: such a state
 *
 * Depends on: world/constants
 */
import { HALF, T, NT } from '../world/constants.js';

export const LOG_ID0 = 4 << 24;
const tileOf = (x, z) => Math.floor((z + HALF) / T) * NT + Math.floor((x + HALF) / T);

export function createLogs(w, saved) {
  const all = new Map(), taken = new Set();
  let next = LOG_ID0;
  const logs = { all, version: 0, dirty: new Set(), add, near, lying, onGround, piece, take, state };
  if (saved) {
    for (const e of saved.list || []) {
      if (!e || ![e.id, e.x, e.y, e.z, e.len, e.a, e.rad].every(Number.isFinite) || !Number.isInteger(e.id) || e.id < LOG_ID0 || all.has(e.id)) continue;
      all.set(e.id, { id: e.id, x: e.x, y: e.y, z: e.z, len: e.len, a: e.a, rad: e.rad, timber: true }); next = Math.max(next, e.id + 1);
    }
    for (const id of saved.taken || []) if (all.has(id)) taken.add(id);
  }
  function add(s) {
    const l = { id: next++, x: s.x, y: w.H(s.x, s.z), z: s.z, len: s.len, a: s.a, rad: s.rad, timber: true };
    all.set(l.id, l); logs.dirty.add(tileOf(l.x, l.z)); logs.version++; return l;
  }
  function onGround(l) { return !taken.has(l.id); }
  function near(x, z, reach) {
    const out = [], m = reach + 1.2;
    for (const l of all.values()) if (!taken.has(l.id) && Math.abs(l.x - x) <= m && Math.abs(l.z - z) <= m) out.push(l);
    return out;
  }
  function lying(tile) { const k = tile.tz * NT + tile.tx, out = []; for (const l of all.values()) if (!taken.has(l.id) && tileOf(l.x, l.z) === k) out.push(l); return out; }
  function piece(id) { return all.get(id) || null; }
  function take(l) {
    if (!l || !l.timber || taken.has(l.id) || !all.has(l.id)) return false;
    taken.add(l.id); logs.dirty.add(tileOf(l.x, l.z)); logs.version++; return true;
  }
  function state() { return { list: [...all.values()].map(l => ({ id: l.id, x: l.x, y: l.y, z: l.z, len: l.len, a: l.a, rad: l.rad })), taken: [...taken] }; }
  return logs;
}
