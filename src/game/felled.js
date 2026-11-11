/**
 * game/felled — the trees he has cut down (0.31 "Axe"): an overlay on the generated island, so the world itself (and the seed 1337 fixture) never changes.
 *
 * Rules
 *   - Every standing tree of the world has a stable id: `treeId(tile, list, index)`, where `list` is 'trees' (broadleaf and rain forest), 'pines' or 'palms' (the lists of
 *     world/vegetation) and `index` the place in that list. The ids are whole numbers below `TREE_ID_END`.
 *   - A felled tree is gone for good: nothing grows in its place, it blocks no step and no path, and the branches, fronds and coconuts that used to regrow under it do not
 *     (game/branches, game/fronds and game/fibre ask `felled.has(id)`). What already lay there stays.
 *   - A giant (`isGiant`: a size of the old-tree range of world/vegetation `TREE_SIZE`) gives 2 or 3 logs, any other tree one (game/logs); `plan` works out where the logs and the crown's
 *     material lie, from the fall heading, deterministic in the tree's id.
 *   - The overlay is registered per world object (`felledOf(world)`), the way game/wood treats the shared start logs: the trunk circles of game/movement are cached per tile and shared by every game on
 *     the world, so the one game that fells trees is asked through the registry. `createFelled` makes this game's overlay the world's. `felledStamp(world)` is a number that changes with every felling and
 *     every new overlay; game/path compares it to throw away its cached standability and edge factors.
 *
 * Pure data; no DOM, no Three.js.
 *
 * LISTS, TREE_ID_END, FALL_REACH, LOG_LEN, CROWN_BRANCHES, CROWN_NUTS
 * treeId(tile, list, index) -> id           listOf(id) -> 'trees' | 'pines' | 'palms'
 * sizeKind(list, tree) -> 'tree' | 'jungle' | 'pine' | 'palm'   the kind world/vegetation measures the tree by (treeScale, TREE_SIZE)
 * isGiant(tree, kind) -> true for an old giant (its scale is in the giant range of TREE_SIZE)
 * trunkRadius(tree, kind) -> metres   the radius of the trunk as game/movement blocks it (without BODY); one definition for walking and felling
 * treeInfo(world, id) -> { id, list, index, tile, tree, kind, scale, giant, x, z, r } | null   the tree behind an id (felled or not), null for an id the island does not have
 * felledOf(world) -> felled | undefined      felledStamp(world) -> number (0 without an overlay)
 * createFelled(world, saved?) -> felled
 *   felled.ids              Set of the felled ids (read by game/movement through the registry)
 *   felled.list             [{ id, x, y, z, kind, list, giant, scale, h, at }]   the felled trees in the order they fell: h is the fall heading (radians, the castaway's heading convention:
 *                           the tree went down towards (sin h, cos h)), at the clock `total` when it fell, y the ground height at the foot
 *   felled.has(id)          true when the tree is felled
 *   felled.version          goes up with every felling, for the renderer      felled.dirty   a Set of the indices of the tiles (world.tiles) whose trees changed since the view last looked (the view empties it)
 *   felled.last             the record of the latest felling (null before the first), felled.falls the number of fellings this game; the renderer plays the fall for a new `last`
 *   felled.standing(tile, list, index) -> true when the tree is not felled
 *   felled.nearest(x, z, reach) -> { id, list, index, tile, tree, kind, scale, giant, x, z, r, d } | null   the nearest standing tree whose trunk edge is within `reach` of (x, z); d is the distance to the edge
 *   felled.fell(found, heading, total) -> record | null   fell the tree `found` (a result of nearest or treeInfo) so that it falls towards heading; null when it is felled already
 *   felled.chopped(id) -> 0..1   how far an interrupted felling got (kept like a lean-to's progress); felled.setChopped(id, p) writes it (game/game does, every frame of the work)
 *   felled.state() -> { list: [{ id, h, at }], chop?: [[id, progress]] }   plain, for saving; saved: such a state (an id the island has not got is dropped)
 * plan(world, rec) -> { logs: [{ x, z, len, a, rad }], branches: [{ x, z, len, a, rad }], fronds: [{ x, z, len, a, rad }], nuts: [{ x, z, a }] }
 *   where the felled tree's pieces lie: the trunk's sections in a row from its foot along the fall heading, the crown's material beyond them
 *
 * Depends on: core/noise, world/constants, world/vegetation
 */
import { mulberry32, hashInt } from '../core/noise.js';
import { HALF, T, NT } from '../world/constants.js';
import { TREE_SIZE, treeScale } from '../world/vegetation.js';

export const LISTS = ['trees', 'pines', 'palms'];
const SPAN = 4096;                                  // ids per list of a tile
export const TREE_ID_END = NT * NT * LISTS.length * SPAN;
export const LOG_LEN = [1.9, 2.2];                  // a section of trunk
export const CROWN_BRANCHES = [2, 3];               // branches a broadleaf or pine crown leaves (a palm leaves fronds and nuts)
export const CROWN_NUTS = [1, 2];
export const FALL_REACH = 0.3;                      // the first log starts this far from the foot

export const treeId = (tile, list, index) => ((tile.tz * NT + tile.tx) * LISTS.length + LISTS.indexOf(list)) * SPAN + index;
export const listOf = id => LISTS[Math.floor(id / SPAN) % LISTS.length];
export const sizeKind = (list, t) => list === 'pines' ? 'pine' : list === 'palms' ? 'palm' : t.jungle ? 'jungle' : 'tree';
export const isGiant = (t, kind) => treeScale(t, kind) >= TREE_SIZE[kind].giant[1] - 1e-9;
export const trunkRadius = (t, kind) => (kind === 'jungle' ? 0.18 : kind === 'tree' ? 0.13 : kind === 'pine' ? 0.09 : 0.1) * Math.sqrt(treeScale(t, kind));

export function treeInfo(w, id) {
  if (!Number.isInteger(id) || id < 0 || id >= TREE_ID_END) return null;
  const index = id % SPAN, k = Math.floor(id / SPAN), list = LISTS[k % LISTS.length], tile = w.tiles[Math.floor(k / LISTS.length)];
  const tree = tile && tile[list] && tile[list][index]; if (!tree) return null;
  const kind = sizeKind(list, tree), scale = treeScale(tree, kind);
  return { id, list, index, tile, tree, kind, scale, giant: isGiant(tree, kind), x: tree.x, z: tree.z, r: trunkRadius(tree, kind) };
}

const registry = new WeakMap();   // world -> the overlay of the game that was made last on it
let STAMP = 0;
export const felledOf = w => registry.get(w);
export const felledStamp = w => { const f = registry.get(w); return f ? f.stamp : 0; };

export function createFelled(w, saved) {
  const ids = new Set(), chop = new Map(), felled = { ids, list: [], version: 0, dirty: new Set(), last: null, falls: 0, stamp: ++STAMP, has: id => ids.has(id), standing, nearest, fell, chopped, setChopped, state };
  registry.set(w, felled);
  const tileIndex = id => Math.floor(Math.floor(id / SPAN) / LISTS.length);
  for (const e of (saved && saved.chop) || []) if (Array.isArray(e) && e.length === 2 && Number.isFinite(e[1]) && e[1] > 0 && e[1] < 1 && treeInfo(w, e[0])) chop.set(e[0], e[1]);
  function add(info, h, at) {
    const y = w.H(info.x, info.z), rec = { id: info.id, x: info.x, y, z: info.z, kind: info.kind, list: info.list, giant: info.giant, scale: info.scale, h, at };
    ids.add(info.id); felled.list.push(rec); felled.dirty.add(tileIndex(info.id)); return rec;
  }
  for (const e of (saved && saved.list) || []) {
    const info = e && treeInfo(w, e.id); if (!info || ids.has(info.id) || !Number.isFinite(e.h)) continue;
    add(info, e.h, Number.isFinite(e.at) ? e.at : 0);
  }
  function chopped(id) { return chop.get(id) || 0; }
  function setChopped(id, p) { if (ids.has(id)) return; if (p > 0) chop.set(id, Math.min(1, p)); else chop.delete(id); }
  function standing(tile, list, index) { return !ids.has(treeId(tile, list, index)); }
  function nearest(x, z, reach) {
    let best = null, bd = reach;
    const m = reach + 1, t0x = Math.max(0, Math.floor((x - m + HALF) / T)), t1x = Math.min(NT - 1, Math.floor((x + m + HALF) / T));
    const t0z = Math.max(0, Math.floor((z - m + HALF) / T)), t1z = Math.min(NT - 1, Math.floor((z + m + HALF) / T));
    for (let tz = t0z; tz <= t1z; tz++) for (let tx = t0x; tx <= t1x; tx++) {
      const tile = w.tiles[tz * NT + tx]; if (!tile) continue;
      for (const list of LISTS) tile[list].forEach((tree, index) => {
        if (Math.abs(tree.x - x) > m || Math.abs(tree.z - z) > m) return;
        const id = treeId(tile, list, index); if (ids.has(id)) return;
        const kind = sizeKind(list, tree), r = trunkRadius(tree, kind), d = Math.max(0, Math.hypot(tree.x - x, tree.z - z) - r);
        if (d < bd || (!best && d <= bd)) { bd = d; best = { id, list, index, tile, tree, kind, scale: treeScale(tree, kind), giant: isGiant(tree, kind), x: tree.x, z: tree.z, r, d }; }
      });
    }
    return best;
  }
  function fell(found, heading, total = 0) {
    const info = found && Number.isInteger(found.id) ? treeInfo(w, found.id) : null;
    if (!info || ids.has(info.id)) return null;
    chop.delete(info.id);
    const rec = add(info, Number.isFinite(heading) ? heading : 0, total);
    felled.last = rec; felled.falls++; felled.version++; felled.stamp = ++STAMP;
    return rec;
  }
  function state() { return { list: felled.list.map(r => ({ id: r.id, h: r.h, at: r.at })), ...(chop.size ? { chop: [...chop] } : {}) }; }
  return felled;
}

/** Where the pieces of a felled tree lie (see the header). Deterministic in the tree's id; the ground there is looked at: a piece never lies in the sea or a river. */
export function plan(w, rec) {
  const r = mulberry32(hashInt(w.seed + 811, rec.id, 5)), dx = Math.sin(rec.h), dz = Math.cos(rec.h), a = Math.atan2(dz, dx);
  const dry = (x, z) => w.H(x, z) > 0.3 && !w.riverAt(x, z);
  const rad = Math.min(0.2, Math.max(0.11, 0.1 + 0.05 * rec.scale));
  const n = rec.giant ? 2 + (r() < 0.5 ? 1 : 0) : 1, logs = [];
  let at = FALL_REACH;
  for (let i = 0; i < n; i++) {
    const len = LOG_LEN[0] + r() * (LOG_LEN[1] - LOG_LEN[0]);
    logs.push({ x: rec.x + dx * (at + len / 2), z: rec.z + dz * (at + len / 2), len, a, rad });
    at += len + 0.05;
  }
  // the crown beyond the last section (nearer when that ground is wet), the pieces scattered round its middle
  let cd = at + 0.6; while (cd > 0.6 && !dry(rec.x + dx * cd, rec.z + dz * cd)) cd -= 0.4;
  const cx = rec.x + dx * cd, cz = rec.z + dz * cd, put = (len, rr) => {
    for (let k = 0; k < 8; k++) {
      const ang = r() * Math.PI * 2, d = 0.2 + r() * 0.8, x = cx + Math.cos(ang) * d, z = cz + Math.sin(ang) * d;
      if (dry(x, z) || k === 7) return { x: dry(x, z) ? x : cx, z: dry(x, z) ? z : cz, len, a: r() * Math.PI, rad: rr };
    }
  };
  const out = { logs, branches: [], fronds: [], nuts: [] };
  if (rec.list === 'palms') {
    for (let k = 0; k < 2; k++) out.fronds.push(put(1.4 + r() * 0.4, 0.03));
    const nn = CROWN_NUTS[0] + (r() < 0.5 ? 1 : 0);
    for (let k = 0; k < nn; k++) { const p = put(0, 0); out.nuts.push({ x: p.x, z: p.z, a: r() * 6 }); }
  } else {
    const nb = CROWN_BRANCHES[0] + (r() < 0.5 ? 1 : 0);
    for (let k = 0; k < nb; k++) out.branches.push(put(0.8 + r() * 0.4, 0.04 + r() * 0.016));
  }
  return out;
}
