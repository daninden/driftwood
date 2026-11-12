/**
 * game/fronds — the dead palm fronds that lie under some palms (0.27 "Home"), and grow back after he has taken them.
 *
 * Rules
 *   - Under about one palm in three (FROND_SHARE, world/vegetation `tile.palms`) one fallen frond
 *     lies. Which palms is fixed by the seed: a hash of the seed, the tile and the palm's index
 *     (the same trick as the coconuts, game/fibre `nutsOfTile`, and the branches), so nothing is drawn
 *     in the world's generation and the generated island does not change. They are worked out per
 *     tile when first asked for and kept.
 *   - A frond is a piece like a log (game/wood): { id, x, y, z, len, a, rad, frond: true }, a long thin
 *     flat piece (FROND_LEN), always dry (no `t`), with an id from FROND_ID0 up that never meets a
 *     driftwood or branch id. The id tells where it lay (tile and number), so a saved pile of fronds is
 *     read back by `piece(id)`. It does not burn as fuel (game/game offers it to no fire).
 *   - Taking a frond leaves its spot empty; REGROW to REGROW + REGROW_SPREAD (4 to 6) days later (fixed
 *     per spot and per time it was taken) a new one lies there. A frond laid in a pile or carried is a copy
 *     of the spot's piece: the same id can be carried while a new one has fallen.
 *
 * Pure data on a world; no DOM, no Three.js.
 *
 * FROND_ID0, EXTRA_ID0, FROND_SHARE, REGROW, REGROW_SPREAD, FROND_LEN
 * frondsOfTile(world, tile) -> [frond]   all the fronds of a tile (taken or not)
 * createFronds(world, saved?, felled?, ground?) -> fronds   felled: game/felled; a frond under a felled palm is not grown again once it is taken; ground: game/ground (0.36.2 "Ground": nor one taken from a cleared region)
 *   fronds.version          goes up with every change, for the renderer
 *   fronds.dirty            a Set of the indices of the tiles (world.tiles) whose pieces changed since the view last looked (taken, grown back), so the view
 *                           rebuilds just those; the view empties it. Not saved
 *   fronds.groundFronds(tile)   the fronds lying under the palms of a tile
 *   fronds.near(x, z, reach)    the fronds lying on the ground within reach of (x, z)
 *   fronds.onGround(f)      true while the frond lies there
 *   fronds.piece(id)        the frond with that id (taken or not), or null
 *   fronds.take(f, total)   -> true when it was taken off the ground (false: gone already); total: the days on the clock
 *   fronds.update(total)    lets taken fronds fall again when their time has come
 *   fronds.move(f, x, z, a?, total?) -> the piece now at (x, z) | null   (0.36.2 "Ground") as game/branches `move`
 *   fronds.addExtra({ x, z, len, a, rad? }) -> frond   (0.31 "Axe") a loose frond a felled palm leaves: an id from EXTRA_ID0 up, `extra: true`, never grows back once taken
 *   fronds.state() -> { taken: [[id, total]], extra?: [[id, x, z, len, a, rad]] }   plain, for saving
 *   saved: such a state, to start from
 *
 * Depends on: core/noise, world/constants, game/felled (treeId), game/ground (read only)
 */
import { mulberry32, hashInt } from '../core/noise.js';
import { HALF, T, NT } from '../world/constants.js';
import { treeId } from './felled.js';

export const FROND_ID0 = 2 << 24;          // frond ids start here, above the branch ids
const TILE_SPAN = 4096;
const tileOfId = id => Math.floor((id - FROND_ID0) / TILE_SPAN);   // the index in world.tiles that a frond's id points to
export const EXTRA_ID0 = FROND_ID0 + NT * NT * TILE_SPAN;   // 0.31 "Axe": the fronds a felled palm leaves get ids from here
export const FROND_SHARE = 1 / 3;
export const REGROW = 4, REGROW_SPREAD = 2;   // days before a taken frond lies there again
export const FROND_LEN = [1.4, 1.8];

const cache = new WeakMap();   // tile -> [frond]

/** The fronds under the palms of a tile: about a third of the palms have one. Deterministic in the seed, the tile and the palm. */
export function frondsOfTile(w, tile) {
  let list = cache.get(tile); if (list) return list;
  list = []; cache.set(tile, list);
  const base = FROND_ID0 + (tile.tz * NT + tile.tx) * TILE_SPAN;
  (tile.palms || []).forEach((p, k) => {
    if (hashInt(w.seed + 601, tile.tz * NT + tile.tx, k) / 4294967296 >= FROND_SHARE) return;
    const r = mulberry32(hashInt(w.seed + 603, tile.tz * NT + tile.tx, k)), ang = r() * Math.PI * 2, d = 0.9 + r() * 1.0, len = FROND_LEN[0] + r() * (FROND_LEN[1] - FROND_LEN[0]), a = r() * Math.PI;
    const x = p.x + Math.cos(ang) * d, z = p.z + Math.sin(ang) * d, y = w.H(x, z);
    if (!(y > 0.55) || list.length >= TILE_SPAN) return;   // on dry ground
    list.push({ id: base + list.length, x, y, z, len, a, rad: 0.03, frond: true, palm: k });   // palm: the index of the palm in tile.palms
  });
  return list;
}

export function createFronds(w, saved, felled = null, ground = null) {
  const taken = new Map();   // id -> the day it was taken
  const extras = new Map();   // id -> a frond a felled palm left (never grows back)
  const fronds = { version: 0, dirty: new Set(), groundFronds, near, onGround, piece, take, update, addExtra, move, state };
  const tileOf = (x, z) => Math.floor((z + HALF) / T) * NT + Math.floor((x + HALF) / T);
  if (saved) for (const e of saved.extra || []) if (Array.isArray(e) && e.length === 6 && e.every(Number.isFinite) && e[0] >= EXTRA_ID0 && !extras.has(e[0])) extras.set(e[0], { id: e[0], x: e[1], y: w.H(e[1], e[2]), z: e[2], len: e[3], a: e[4], rad: e[5], frond: true, extra: true });
  if (saved) for (const [id, at] of saved.taken || []) if (piece(id)) taken.set(id, at);
  const back = (id, at) => at + REGROW + REGROW_SPREAD * (hashInt(id, Math.floor(at * 1000), 607) / 4294967296);

  const treeFelled = id => {   // the palm this frond lay under is gone
    if (!felled || id >= EXTRA_ID0) return false;
    const s = id - FROND_ID0, tile = w.tiles[Math.floor(s / TILE_SPAN)], f = tile && frondsOfTile(w, tile)[s % TILE_SPAN];
    return !!f && f.palm !== undefined && felled.has(treeId(tile, 'palms', f.palm));
  };
  const tileIdx = f => f.extra ? tileOf(f.x, f.z) : tileOfId(f.id);
  /** A loose frond a felled palm leaves at (x, z): a new piece with an id of its own, never growing back. */
  function addExtra(s) {
    const id = EXTRA_ID0 + extras.size, f = { id, x: s.x, y: w.H(s.x, s.z), z: s.z, len: s.len, a: s.a, rad: s.rad || 0.03, frond: true, extra: true };
    extras.set(id, f); fronds.dirty.add(tileOf(f.x, f.z)); fronds.version++; return f;
  }
  function piece(id) {
    if (id >= EXTRA_ID0) return extras.get(id) || null;
    const s = id - FROND_ID0; if (!Number.isInteger(s) || s < 0) return null;
    const tile = w.tiles[Math.floor(s / TILE_SPAN)]; if (!tile) return null;
    return frondsOfTile(w, tile)[s % TILE_SPAN] || null;
  }
  const kept = id => { if (!ground || !ground.list.length) return false; const f = piece(id); return !!f && ground.coversPiece(f); };   // 0.36.2: the spot lies under a building's cleared region
  function move(f, x, z, a, total = 0) {
    if (!f || !f.frond || taken.has(f.id) || !piece(f.id)) return null;
    if (f.extra) { fronds.dirty.add(tileOf(f.x, f.z)); f.x = x; f.z = z; f.y = w.H(x, z); if (Number.isFinite(a)) f.a = a; fronds.dirty.add(tileOf(x, z)); fronds.version++; return f; }
    taken.set(f.id, total); fronds.dirty.add(tileOfId(f.id));
    return addExtra({ x, z, len: f.len, a: Number.isFinite(a) ? a : f.a, rad: f.rad });
  }
  function onGround(f) { return !taken.has(f.id); }
  function groundFronds(tile) {
    const out = frondsOfTile(w, tile).filter(onGround), k = tile.tz * NT + tile.tx;
    for (const f of extras.values()) if (!taken.has(f.id) && tileOf(f.x, f.z) === k) out.push(f);
    return out;
  }
  function near(x, z, reach) {
    const out = [], m = reach + 3;   // a frond reaches 0.9 from its centre and lies up to 1.9 from its palm
    const t0x = Math.max(0, Math.floor((x - m + HALF) / T)), t1x = Math.min(NT - 1, Math.floor((x + m + HALF) / T));
    const t0z = Math.max(0, Math.floor((z - m + HALF) / T)), t1z = Math.min(NT - 1, Math.floor((z + m + HALF) / T));
    for (let tz = t0z; tz <= t1z; tz++) for (let tx = t0x; tx <= t1x; tx++) { const t = w.tiles[tz * NT + tx]; if (t && t.palms.length) for (const f of frondsOfTile(w, t)) if (!taken.has(f.id)) out.push(f); }
    for (const f of extras.values()) if (!taken.has(f.id) && Math.abs(f.x - x) <= m && Math.abs(f.z - z) <= m) out.push(f);
    return out;
  }
  function take(f, total = 0) {
    if (!f || !f.frond || taken.has(f.id) || !piece(f.id)) return false;
    taken.set(f.id, total); fronds.dirty.add(tileIdx(f)); fronds.version++; return true;
  }
  function update(total) {
    let n = 0;
    taken.forEach((at, id) => { if (total >= back(id, at) && id < EXTRA_ID0 && !treeFelled(id) && !kept(id)) { taken.delete(id); n++; fronds.dirty.add(tileOfId(id)); } });
    if (n) fronds.version++;
  }
  function state() { return { taken: [...taken], ...(extras.size ? { extra: [...extras.values()].map(f => [f.id, f.x, f.z, f.len, f.a, f.rad]) } : {}) }; }
  return fronds;
}
