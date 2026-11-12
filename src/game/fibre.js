/**
 * game/fibre — coconuts under the palms, and the dry fibre of their husks
 * that a fire needs to catch.
 *
 * Rules
 *   - Fallen coconuts lie under the palms (world/vegetation `tile.cocos`), thinned here (0.24 "Lean times"):
 *     of the palms that have nuts only about a sixth (so about 1 in 10 of all palms) keep one nut,
 *     the first of the palm; chosen by a hash of the seed, tile and palm. The world itself is unchanged.
 *   - Picking one up, the castaway kneels and tears off the husk (game/game):
 *     that gives one tuft of fibre when there is room, hungry or not (0.27.1). The nut itself is eaten or carried (game/game, game/shells).
 *   - He carries at most FIBRE_MAX tufts, kept loose in his shorts
 *     (drawn in the inventory row, render/carryMark). Fibre weighs nothing and does not slow him down.
 *   - A tuft is used up by every attempt to light a fire, whether it
 *     catches or not (game/fire).
 *   - A palm drops a new nut where an old one lay, REGROW to REGROW + REGROW_SPREAD
 *     (10 to 14) days after it was taken (fixed per nut and per time it was taken).
 *
 * Pure data on a world; no DOM, no Three.js.
 *
 * FIBRE_MAX, EXTRA_ID0, REGROW, REGROW_SPREAD, NUT_SHARE
 * nutsOfTile(w, tile) -> [coco]   the nuts that exist at all in a tile (at most one per palm); `onGround` says which lie there now
 * createFibre(world, saved?, felled?, ground?) -> fibre   felled: game/felled; a nut under a felled palm does not fall again once it is taken; ground: game/ground (0.36.2 "Ground": nor one lying under a cleared region)
 *   fibre.carried            tufts carried (0..FIBRE_MAX)
 *   fibre.version            goes up with every change, for the renderer
 *   fibre.dirty            a Set of the indices of the tiles (world.tiles) whose pieces changed since the view last looked (taken, grown back), so the view
 *                           rebuilds just those; the view empties it. Not saved
 *   fibre.onGround(coco)     true while the coconut lies there
 *   fibre.groundCocos(tile)  the coconuts lying under the palms of a tile
 *   fibre.find(x, z, reach) -> { kind: 'coco', coco, x, z, d } | null   the nearest (d: distance)
 *   fibre.take(coco, total) -> true when it gave a tuft (false: hands full or gone)
 *     total: the days on the clock (game/clock), for when it grows back
 *   fibre.husk(coco, total) -> true when the nut was taken off the ground: it gives a tuft only
 *     when there is room (FIBRE_MAX), else none (the nut is still his: eaten or carried; game/game); false: gone already
 *   fibre.tuft() -> true when a tuft was added (room under FIBRE_MAX)
 *   fibre.use() -> true when a tuft was used up
 *   fibre.update(total)      lets taken nuts fall again when their time has come
 *   fibre.move(c, x, z, total?) -> the nut now at (x, z) | null   (0.36.2 "Ground") a nut lying on the ground is moved: a nut of a palm is taken for good (nothing is carried) and a new extra lies at (x, z), an extra moves itself
 *   fibre.addExtra({ x, z, a? }) -> coco   (0.31 "Axe") a whole nut a felled palm leaves: an id from EXTRA_ID0 up, `extra: true`, palm -1, never grows back once taken; groundCocos(tile) and find include it
 *   fibre.state() -> { carried, taken: [[id, total]], extra?: [[id, x, z, a]] }   plain, for saving
 *   saved: such a state, to start from
 *
 * Depends on: core/noise, world/constants, game/felled (treeId), game/ground (read only)
 */
import { hashInt } from '../core/noise.js';
import { HALF, T, NT } from '../world/constants.js';
import { treeId } from './felled.js';

export const FIBRE_MAX = 3;
export const REGROW = 8, REGROW_SPREAD = 4;   // days before a palm drops a new nut
export const EXTRA_ID0 = 1 << 30;             // 0.31 "Axe": the nuts a felled palm leaves get ids from here, above every generated coconut id
export const NUT_SHARE = 1 / 5;               // share of the palms with nuts that keep their (one) nut

const nutCache = new WeakMap();
export function nutsOfTile(w, tile) {
  let list = nutCache.get(tile); if (list) return list;
  list = []; nutCache.set(tile, list);
  const seen = new Set();
  for (const c of tile.cocos || []) {
    if (seen.has(c.palm)) continue; seen.add(c.palm);
    if (hashInt(w.seed + 517, tile.tz * NT + tile.tx, c.palm) / 4294967296 < NUT_SHARE) list.push(c);
  }
  return list;
}

const tileOf = (x, z) => Math.floor((z + HALF) / T) * NT + Math.floor((x + HALF) / T);

export function createFibre(w, saved, felled = null, ground = null) {
  const byId = new Map(), tileOfNut = new Map();   // tileOfNut: id -> the index of its tile in world.tiles
  w.tiles.forEach((t, k) => { for (const c of nutsOfTile(w, t)) { byId.set(c.id, c); tileOfNut.set(c.id, k); } });
  const taken = new Map();   // id -> the day it was taken
  const extras = new Map();  // id -> a nut a felled palm left (never grows back): { id, x, y, z, a, palm: -1, extra: true }
  const fibre = { carried: 0, version: 0, dirty: new Set(), onGround, groundCocos, find, take, husk, tuft, use, update, addExtra, move, state };
  const putExtra = (id, x, z, a) => { const c = { id, x, y: w.H(x, z), z, a, palm: -1, extra: true }; extras.set(id, c); byId.set(id, c); tileOfNut.set(id, tileOf(x, z)); return c; };
  if (saved) {
    for (const e of saved.extra || []) if (Array.isArray(e) && e.length === 4 && e.every(Number.isFinite) && e[0] >= EXTRA_ID0 && !extras.has(e[0])) putExtra(e[0], e[1], e[2], e[3]);
    fibre.carried = Math.max(0, Math.min(FIBRE_MAX, saved.carried | 0));
    for (const [id, at] of saved.taken || []) if (byId.has(id)) taken.set(id, at);
  }
  const back = (id, at) => at + REGROW + REGROW_SPREAD * (hashInt(id, Math.floor(at * 1000), 61) / 4294967296);

  const gone = id => {   // a nut of a felled crown, or one under a felled palm, does not grow back
    if (id >= EXTRA_ID0) return true;
    const c = byId.get(id), k = tileOfNut.get(id);
    if (c && ground && ground.list.length && ground.covers(c.x, c.z, 0.12)) return true;   // 0.36.2: under a building's cleared region
    return !!felled && !!c && k !== undefined && c.palm >= 0 && felled.has(treeId(w.tiles[k], 'palms', c.palm));
  };
  function mark(id) { const k = tileOfNut.get(id); if (k !== undefined) fibre.dirty.add(k); }
  function onGround(c) { return !taken.has(c.id); }
  function groundCocos(tile) {
    const out = nutsOfTile(w, tile).filter(onGround), k = tile.tz * NT + tile.tx;
    for (const c of extras.values()) if (!taken.has(c.id) && tileOf(c.x, c.z) === k) out.push(c);
    return out;
  }
  /** A whole coconut a felled palm leaves at (x, z): a new nut with an id of its own, never growing back. */
  function addExtra(s) {
    const c = putExtra(EXTRA_ID0 + extras.size, s.x, s.z, s.a || 0);
    fibre.dirty.add(tileOf(c.x, c.z)); fibre.version++; return c;
  }
  function move(c, x, z, total = 0) {
    if (!c || taken.has(c.id) || !byId.has(c.id)) return null;
    if (c.extra) { mark(c.id); c.x = x; c.z = z; c.y = w.H(x, z); tileOfNut.set(c.id, tileOf(x, z)); mark(c.id); fibre.version++; return c; }
    taken.set(c.id, total); mark(c.id);
    return addExtra({ x, z, a: c.a });
  }
  function find(x, z, reach) {
    let best = null, bd = reach;
    const k0 = tileOf(x, z), seen = new Set();
    for (const dz of [-1, 0, 1]) for (const dx of [-1, 0, 1]) {
      const k = k0 + dz * NT + dx; if (seen.has(k) || k < 0 || k >= w.tiles.length) continue; seen.add(k);
      for (const c of nutsOfTile(w, w.tiles[k])) {
        if (taken.has(c.id)) continue;
        const d = Math.max(0, Math.hypot(c.x - x, c.z - z) - 0.1);
        if (d < bd) { bd = d; best = { kind: 'coco', coco: c, x: c.x, z: c.z, d }; }
      }
    }
    for (const c of extras.values()) {
      if (taken.has(c.id)) continue;
      const d = Math.max(0, Math.hypot(c.x - x, c.z - z) - 0.1);
      if (d < bd) { bd = d; best = { kind: 'coco', coco: c, x: c.x, z: c.z, d }; }
    }
    return best;
  }
  function take(c, total) {
    if (fibre.carried >= FIBRE_MAX || !c || taken.has(c.id)) return false;
    taken.set(c.id, total); fibre.carried++; mark(c.id); fibre.version++; return true;
  }
  function husk(c, total) {
    if (!c || taken.has(c.id)) return false;
    taken.set(c.id, total); if (fibre.carried < FIBRE_MAX) fibre.carried++; mark(c.id); fibre.version++; return true;
  }
  function tuft() { if (fibre.carried >= FIBRE_MAX) return false; fibre.carried++; fibre.version++; return true; }
  function use() { if (fibre.carried <= 0) return false; fibre.carried--; fibre.version++; return true; }
  function update(total) {
    let n = 0;
    taken.forEach((at, id) => { if (total >= back(id, at) && !gone(id)) { taken.delete(id); n++; mark(id); } });
    if (n) fibre.version++;
  }
  function state() { return { carried: fibre.carried, taken: [...taken], ...(extras.size ? { extra: [...extras.values()].map(c => [c.id, c.x, c.z, c.a]) } : {}) }; }
  return fibre;
}
