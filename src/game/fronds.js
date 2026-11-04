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
 * FROND_ID0, FROND_SHARE, REGROW, REGROW_SPREAD, FROND_LEN
 * frondsOfTile(world, tile) -> [frond]   all the fronds of a tile (taken or not)
 * createFronds(world, saved?) -> fronds
 *   fronds.version          goes up with every change, for the renderer
 *   fronds.dirty            a Set of the indices of the tiles (world.tiles) whose pieces changed since the view last looked (taken, grown back), so the view
 *                           rebuilds just those; the view empties it. Not saved
 *   fronds.groundFronds(tile)   the fronds lying under the palms of a tile
 *   fronds.near(x, z, reach)    the fronds lying on the ground within reach of (x, z)
 *   fronds.onGround(f)      true while the frond lies there
 *   fronds.piece(id)        the frond with that id (taken or not), or null
 *   fronds.take(f, total)   -> true when it was taken off the ground (false: gone already); total: the days on the clock
 *   fronds.update(total)    lets taken fronds fall again when their time has come
 *   fronds.state() -> { taken: [[id, total]] }   plain, for saving
 *   saved: such a state, to start from
 *
 * Depends on: core/noise, world/constants
 */
import { mulberry32, hashInt } from '../core/noise.js';
import { HALF, T, NT } from '../world/constants.js';

export const FROND_ID0 = 2 << 24;          // frond ids start here, above the branch ids
const TILE_SPAN = 4096;
const tileOfId = id => Math.floor((id - FROND_ID0) / TILE_SPAN);   // the index in world.tiles that a frond's id points to
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
    list.push({ id: base + list.length, x, y, z, len, a, rad: 0.03, frond: true });
  });
  return list;
}

export function createFronds(w, saved) {
  const taken = new Map();   // id -> the day it was taken
  const fronds = { version: 0, dirty: new Set(), groundFronds, near, onGround, piece, take, update, state };
  if (saved) for (const [id, at] of saved.taken || []) if (piece(id)) taken.set(id, at);
  const back = (id, at) => at + REGROW + REGROW_SPREAD * (hashInt(id, Math.floor(at * 1000), 607) / 4294967296);

  function piece(id) {
    const s = id - FROND_ID0; if (!Number.isInteger(s) || s < 0) return null;
    const tile = w.tiles[Math.floor(s / TILE_SPAN)]; if (!tile) return null;
    return frondsOfTile(w, tile)[s % TILE_SPAN] || null;
  }
  function onGround(f) { return !taken.has(f.id); }
  function groundFronds(tile) { return frondsOfTile(w, tile).filter(onGround); }
  function near(x, z, reach) {
    const out = [], m = reach + 3;   // a frond reaches 0.9 from its centre and lies up to 1.9 from its palm
    const t0x = Math.max(0, Math.floor((x - m + HALF) / T)), t1x = Math.min(NT - 1, Math.floor((x + m + HALF) / T));
    const t0z = Math.max(0, Math.floor((z - m + HALF) / T)), t1z = Math.min(NT - 1, Math.floor((z + m + HALF) / T));
    for (let tz = t0z; tz <= t1z; tz++) for (let tx = t0x; tx <= t1x; tx++) { const t = w.tiles[tz * NT + tx]; if (t && t.palms.length) for (const f of frondsOfTile(w, t)) if (!taken.has(f.id)) out.push(f); }
    return out;
  }
  function take(f, total = 0) {
    if (!f || !f.frond || taken.has(f.id) || !piece(f.id)) return false;
    taken.set(f.id, total); fronds.dirty.add(tileOfId(f.id)); fronds.version++; return true;
  }
  function update(total) {
    let n = 0;
    taken.forEach((at, id) => { if (total >= back(id, at)) { taken.delete(id); n++; fronds.dirty.add(tileOfId(id)); } });
    if (n) fronds.version++;
  }
  function state() { return { taken: [...taken] }; }
  return fronds;
}
