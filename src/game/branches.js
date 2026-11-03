/**
 * game/branches — the branches that lie under the broadleaf and rain forest
 * trees, and grow back after he has taken them.
 *
 * Rules
 *   - About half of the broadleaf and rain forest trees (world/vegetation
 *     `tile.trees`) have 0 to 2 branches lying under them. Where they lie is
 *     fixed by the seed: a PRNG per tree, seeded by the tree's place (the
 *     same trick as the coconuts under the palms), so nothing is drawn in
 *     the world's generation and the generated island does not change. They
 *     are worked out per tile when first asked for and kept.
 *   - A branch is a piece of wood like a log (game/wood): { id, x, y, z, len,
 *     a, rad, branch: true }, thinner and shorter than driftwood (BRANCH_LEN,
 *     BRANCH_RAD), always dry (no `t`), with an id from BRANCH_ID0 up that
 *     never meets a driftwood id. The id tells where it grew (tile and number),
 *     so a saved pile of branches is read back by `piece(id)`.
 *   - Taking a branch leaves its spot empty; REGROW to REGROW + REGROW_SPREAD
 *     days later (fixed per spot and per time it was taken) a new one lies
 *     there. A branch laid in a pile or carried is a copy of the spot's piece:
 *     the same id can be carried while a new one has grown back.
 *
 * Pure data on a world; no DOM, no Three.js.
 *
 * BRANCH_ID0, REGROW, REGROW_SPREAD, BRANCH_LEN, BRANCH_RAD
 * branchesOfTile(world, tile) -> [branch]   all the branches of a tile (taken or not)
 * createBranches(world, saved?) -> branches
 *   branches.version          goes up with every change, for the renderer
 *   branches.groundBranches(tile)  the branches lying under the trees of a tile
 *   branches.near(x, z, reach)     the branches lying on the ground within reach (and a log's width) of (x, z)
 *   branches.onGround(b)      true while the branch lies there
 *   branches.piece(id)        the branch with that id (taken or not), or null
 *   branches.take(b, total)   -> true when it was taken off the ground (false: gone
 *                             already); total: the days on the clock, for when it grows back
 *   branches.update(total)    lets taken branches grow again when their time has come
 *   branches.state() -> { taken: [[id, total]] }   plain, for saving
 *   saved: such a state, to start from
 *
 * Depends on: core/noise, world/constants
 */
import { mulberry32, hashInt } from '../core/noise.js';
import { HALF, T, NT } from '../world/constants.js';

export const BRANCH_ID0 = 1 << 24;         // branch ids start here, far above any driftwood id
const TILE_SPAN = 4096;                    // ids per tile (a tile has far fewer than 4096 trees)
export const REGROW = 4, REGROW_SPREAD = 4;   // days before a taken branch lies there again
export const BRANCH_LEN = [0.8, 1.2], BRANCH_RAD = [0.04, 0.056];

const cache = new WeakMap();   // tile -> [branch]

const tileOf = (x, z) => Math.floor((z + HALF) / T) * NT + Math.floor((x + HALF) / T);

/** The branches under the trees of a tile: about half of the trees have one or two. Deterministic in the tree's place. */
export function branchesOfTile(w, tile) {
  let list = cache.get(tile); if (list) return list;
  list = []; cache.set(tile, list);
  const base = BRANCH_ID0 + (tile.tz * NT + tile.tx) * TILE_SPAN;
  for (const t of tile.trees) {
    const ix = Math.round(t.x * 64), iz = Math.round(t.z * 64);
    if (hashInt(ix, iz, 71) / 4294967296 >= 0.5) continue;
    const r = mulberry32(hashInt(ix, iz, 73)), n = 1 + (r() < 0.45 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const ang = r() * Math.PI * 2, d = 0.7 + r() * 1.1, len = BRANCH_LEN[0] + r() * (BRANCH_LEN[1] - BRANCH_LEN[0]), a = r() * Math.PI, rad = BRANCH_RAD[0] + r() * (BRANCH_RAD[1] - BRANCH_RAD[0]);
      const x = t.x + Math.cos(ang) * d, z = t.z + Math.sin(ang) * d, y = w.H(x, z);
      if (!(y > 0.6 && w.slope(x, z) < 0.7 && w.dryOfRiver(x, z, 0.6))) continue;   // on dry, gentle ground
      if (list.length >= TILE_SPAN) break;
      list.push({ id: base + list.length, x, y, z, len, a, rad, branch: true });
    }
  }
  return list;
}

export function createBranches(w, saved) {
  const taken = new Map();   // id -> the day it was taken
  const branches = { version: 0, groundBranches, near, onGround, piece, take, update, state };
  if (saved) for (const [id, at] of saved.taken || []) if (piece(id)) taken.set(id, at);
  const back = (id, at) => at + REGROW + REGROW_SPREAD * (hashInt(id, Math.floor(at * 1000), 79) / 4294967296);

  function piece(id) {
    const s = id - BRANCH_ID0; if (!Number.isInteger(s) || s < 0) return null;
    const k = Math.floor(s / TILE_SPAN), tile = w.tiles[k]; if (!tile) return null;
    return branchesOfTile(w, tile)[s % TILE_SPAN] || null;
  }
  function onGround(b) { return !taken.has(b.id); }
  function groundBranches(tile) { return branchesOfTile(w, tile).filter(onGround); }
  function near(x, z, reach) {
    const out = [], m = reach + 1.1;   // a branch reaches at most 0.6 from its centre, and lies up to 1.8 from its tree
    const t0x = Math.max(0, Math.floor((x - m + HALF) / T)), t1x = Math.min(NT - 1, Math.floor((x + m + HALF) / T));
    const t0z = Math.max(0, Math.floor((z - m + HALF) / T)), t1z = Math.min(NT - 1, Math.floor((z + m + HALF) / T));
    for (let tz = t0z; tz <= t1z; tz++) for (let tx = t0x; tx <= t1x; tx++) { const t = w.tiles[tz * NT + tx]; if (t && t.trees.length) for (const b of branchesOfTile(w, t)) if (!taken.has(b.id)) out.push(b); }
    return out;
  }
  function take(b, total = 0) {
    if (!b || !b.branch || taken.has(b.id) || !piece(b.id)) return false;
    taken.set(b.id, total); branches.version++; return true;
  }
  function update(total) {
    let n = 0;
    taken.forEach((at, id) => { if (total >= back(id, at)) { taken.delete(id); n++; } });
    if (n) branches.version++;
  }
  function state() { return { taken: [...taken] }; }
  return branches;
}

export { tileOf };
