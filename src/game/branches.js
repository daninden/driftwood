/**
 * game/branches — the branches that lie under the broadleaf and rain forest
 * trees, and grow back after he has taken them.
 *
 * createBranches puts the lists back as an earlier game on the same world object left them (no `g`, no `t`).
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
 *     the same id can be carried while a new one has grown back. The regrown branch is a new
 *     object, without the wetness of the old one (no `t`), and carries `g`, the day it grew
 *     (game/wood: rain that fell before g did not wet it); g is saved for GROWN_KEEP days.
 *
 * Pure data on a world; no DOM, no Three.js.
 *
 * BRANCH_ID0, EXTRA_ID0, GROWN_KEEP, REGROW, REGROW_SPREAD, BRANCH_LEN, BRANCH_RAD
 * branchesOfTile(world, tile) -> [branch]   all the branches of a tile (taken or not)
 * createBranches(world, saved?, felled?) -> branches   felled: game/felled; a branch under a felled tree is not grown again once it is taken
 *   branches.version          goes up with every change, for the renderer
 *   branches.dirty                 a Set of the indices of the tiles (world.tiles) whose pieces changed since the view last looked (take, regrowth), for
 *                           the renderer to rebuild just those; the view empties it. Plain data, nothing is saved from it
 *   branches.groundBranches(tile)  the branches lying under the trees of a tile
 *   branches.near(x, z, reach)     the branches lying on the ground within reach (and a log's width) of (x, z)
 *   branches.onGround(b)      true while the branch lies there
 *   branches.piece(id)        the branch with that id (taken or not), or null
 *   branches.take(b, total)   -> true when it was taken off the ground (false: gone
 *                             already); total: the days on the clock, for when it grows back
 *   branches.update(total)    lets taken branches grow again when their time has come
 *   branches.addExtra({ x, z, len, a, rad }) -> branch   (0.31 "Axe") a loose branch a felled crown leaves: an id from EXTRA_ID0 up, `extra: true`, never grows back once taken
 *   branches.state() -> { taken: [[id, total]], grown?: [[id, g]], extra?: [[id, x, z, len, a, rad]] }   plain, for saving
 *   saved: such a state, to start from
 *
 * Depends on: core/noise, world/constants, game/felled (treeId)
 */
import { mulberry32, hashInt } from '../core/noise.js';
import { HALF, T, NT } from '../world/constants.js';
import { treeId } from './felled.js';

export const GROWN_KEEP = 3;               // days a regrown branch's day of growth is kept for the rain check (a shower older than a drying time no longer counts)
export const BRANCH_ID0 = 1 << 24;         // branch ids start here, far above any driftwood id
const TILE_SPAN = 4096;                    // ids per tile (a tile has far fewer than 4096 trees)
export const REGROW = 4, REGROW_SPREAD = 4;   // days before a taken branch lies there again
export const EXTRA_ID0 = BRANCH_ID0 + NT * NT * TILE_SPAN;   // 0.31 "Axe": the branches a felled crown leaves get ids from here, above every tile's own
export const BRANCH_LEN = [0.8, 1.2], BRANCH_RAD = [0.04, 0.056];

const cache = new WeakMap();   // tile -> [branch]

const tileOfId = id => Math.floor((id - BRANCH_ID0) / TILE_SPAN);   // the index of the tile in world.tiles that a branch's id points to
const tileOf = (x, z) => Math.floor((z + HALF) / T) * NT + Math.floor((x + HALF) / T);

/** The branches under the trees of a tile: about half of the trees have one or two. Deterministic in the tree's place. */
export function branchesOfTile(w, tile) {
  let list = cache.get(tile); if (list) return list;
  list = []; cache.set(tile, list);
  const base = BRANCH_ID0 + (tile.tz * NT + tile.tx) * TILE_SPAN;
  tile.trees.forEach((t, tk) => {
    const ix = Math.round(t.x * 64), iz = Math.round(t.z * 64);
    if (hashInt(ix, iz, 71) / 4294967296 >= 0.5) return;
    const r = mulberry32(hashInt(ix, iz, 73)), n = 1 + (r() < 0.45 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const ang = r() * Math.PI * 2, d = 0.7 + r() * 1.1, len = BRANCH_LEN[0] + r() * (BRANCH_LEN[1] - BRANCH_LEN[0]), a = r() * Math.PI, rad = BRANCH_RAD[0] + r() * (BRANCH_RAD[1] - BRANCH_RAD[0]);
      const x = t.x + Math.cos(ang) * d, z = t.z + Math.sin(ang) * d, y = w.H(x, z);
      if (!(y > 0.6 && w.slope(x, z) < 0.7 && w.dryOfRiver(x, z, 0.6))) continue;   // on dry, gentle ground
      if (list.length >= TILE_SPAN) break;
      list.push({ id: base + list.length, x, y, z, len, a, rad, branch: true, tk });   // tk: the index of the tree in tile.trees (a felled tree's branches do not grow back)
    }
  });
  return list;
}

const regrownOf = new WeakMap();   // world -> Set of the pieces a game put in the shared lists when a branch grew back

export function createBranches(w, saved, felled = null) {
  let regrown = regrownOf.get(w); if (!regrown) regrownOf.set(w, regrown = new Set());
  for (const b of regrown) { delete b.g; delete b.t; }   // another game on this world object grew these back: they are the original branches again
  regrown.clear();
  const taken = new Map();   // id -> the day it was taken
  const grown = new Map();   // id -> the day a regrown branch grew, kept for GROWN_KEEP days (saved, so the rain of before it grew stays off it)
  const extras = new Map();   // id -> a branch a felled crown left (never grows back)
  const branches = { version: 0, dirty: new Set(), groundBranches, near, onGround, piece, take, update, addExtra, state };
  if (saved) {
    for (const e of saved.extra || []) if (Array.isArray(e) && e.length === 6 && e.every(Number.isFinite) && e[0] >= EXTRA_ID0 && !extras.has(e[0])) extras.set(e[0], { id: e[0], x: e[1], y: w.H(e[1], e[2]), z: e[2], len: e[3], a: e[4], rad: e[5], branch: true, extra: true });
    for (const [id, at] of saved.taken || []) if (piece(id)) taken.set(id, at);
    for (const [id, g] of saved.grown || []) if (!taken.has(id) && Number.isFinite(g)) regrow(id, g);
  }
  function regrow(id, when) {
    const s = id - BRANCH_ID0, tile = w.tiles[Math.floor(s / TILE_SPAN)]; if (!tile || !piece(id)) return;
    const list = branchesOfTile(w, tile), old = list[s % TILE_SPAN], { t, ...fresh } = old;   // a new piece: it starts dry, whatever the old one (maybe still carried) was
    list[s % TILE_SPAN] = { ...fresh, g: when }; regrown.add(list[s % TILE_SPAN]); grown.set(id, when);
  }
  const back = (id, at) => at + REGROW + REGROW_SPREAD * (hashInt(id, Math.floor(at * 1000), 79) / 4294967296);

  const treeFelled = id => {   // the tree this branch lay under is gone
    if (!felled || id >= EXTRA_ID0) return false;
    const s = id - BRANCH_ID0, tile = w.tiles[Math.floor(s / TILE_SPAN)], b = tile && branchesOfTile(w, tile)[s % TILE_SPAN];
    return !!b && b.tk !== undefined && felled.has(treeId(tile, 'trees', b.tk));
  };
  const tileIdx = b => b.extra ? tileOf(b.x, b.z) : tileOfId(b.id);
  /** A loose branch a felled crown leaves at (x, z): a new piece with an id of its own, never growing back. */
  function addExtra(s) {
    const id = EXTRA_ID0 + extras.size, b = { id, x: s.x, y: w.H(s.x, s.z), z: s.z, len: s.len, a: s.a, rad: s.rad, branch: true, extra: true };
    extras.set(id, b); branches.dirty.add(tileOf(b.x, b.z)); branches.version++; return b;
  }
  function piece(id) {
    if (id >= EXTRA_ID0) return extras.get(id) || null;
    const s = id - BRANCH_ID0; if (!Number.isInteger(s) || s < 0) return null;
    const k = Math.floor(s / TILE_SPAN), tile = w.tiles[k]; if (!tile) return null;
    return branchesOfTile(w, tile)[s % TILE_SPAN] || null;
  }
  function onGround(b) { return !taken.has(b.id); }
  function groundBranches(tile) {
    const out = branchesOfTile(w, tile).filter(onGround), k = tile.tz * NT + tile.tx;
    for (const b of extras.values()) if (!taken.has(b.id) && tileOf(b.x, b.z) === k) out.push(b);
    return out;
  }
  function near(x, z, reach) {
    const out = [], m = reach + 1.1;   // a branch reaches at most 0.6 from its centre, and lies up to 1.8 from its tree
    const t0x = Math.max(0, Math.floor((x - m + HALF) / T)), t1x = Math.min(NT - 1, Math.floor((x + m + HALF) / T));
    const t0z = Math.max(0, Math.floor((z - m + HALF) / T)), t1z = Math.min(NT - 1, Math.floor((z + m + HALF) / T));
    for (let tz = t0z; tz <= t1z; tz++) for (let tx = t0x; tx <= t1x; tx++) { const t = w.tiles[tz * NT + tx]; if (t && t.trees.length) for (const b of branchesOfTile(w, t)) if (!taken.has(b.id)) out.push(b); }
    for (const b of extras.values()) if (!taken.has(b.id) && Math.abs(b.x - x) <= m && Math.abs(b.z - z) <= m) out.push(b);
    return out;
  }
  function take(b, total = 0) {
    if (!b || !b.branch || taken.has(b.id) || !piece(b.id)) return false;
    taken.set(b.id, total); branches.dirty.add(tileIdx(b)); branches.version++; return true;
  }
  function update(total) {
    let n = 0;
    taken.forEach((at, id) => {
      const when = back(id, at);
      if (total < when || id >= EXTRA_ID0 || treeFelled(id)) return;   // a branch of a felled crown, or one under a felled tree, stays gone
      taken.delete(id); n++; branches.dirty.add(tileOfId(id)); regrow(id, when);
    });
    for (const [id, g] of grown) if (total - g > GROWN_KEEP) grown.delete(id);
    if (n) branches.version++;
  }
  function state() { return { taken: [...taken], ...(grown.size ? { grown: [...grown] } : {}), ...(extras.size ? { extra: [...extras.values()].map(b => [b.id, b.x, b.z, b.len, b.a, b.rad]) } : {}) }; }
  return branches;
}

export { tileOf };
