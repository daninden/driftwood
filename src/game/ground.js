/**
 * game/ground — the ground a building has cleared (0.36.2 "Ground"): an overlay on the generated island, so the world itself (and the seed 1337 fixture) never changes.
 *
 * Rules
 *   - When the FIRST piece of a lean-to is built in, and again when the FIRST part of a hut is built (its footprint is larger), for the player and for Dave alike
 *     (game/game `finish`), the region of the building (game/leanto `keepFree`: the walls, the inside and the apron in front of the opening; from the hut's first part the hut's
 *     region) is added here as a cleared region. Everything that is only scenery under a cleared region is gone for good: every bush (berry bushes and banana plants too: their food is
 *     lost), every grass tuft, fern, reed, pebble and shell of the ground cover, and every small rock (a world rock below game/movement `STONE_MIN`; boulders block a site anyway).
 *     It is saved with the island, kept across a reload, and never grows back (what grows is only ever asked here: game/forage, and the regrowth of game/branches, fronds and fibre).
 *   - Nothing of the generated island is removed: a bush or rock is gone when `bushGone`, `rockGone` or `plantGone` say so, and the ground cover (which render/nearTile works out tuft by tuft
 *     when the tile is drawn, it is not world data) asks `covers(x, z, rad)`. The grass and ferns are real 3D objects standing in the ground, so they are left out when a tile is drawn;
 *     the painted ground texture is not changed.
 *   - Loose pieces under a region (stones, driftwood, branches, fronds, coconuts lying on the ground) are not removed: game/game moves them to just outside it (`findSpot`). Piles are not touched.
 *   - The overlay is registered per world object (`groundOf(world)`), the way game/felled is: the bushes of game/movement are cached per tile and shared by every game on the world, so
 *     the game that clears is asked through the registry. `createGround` makes this game's overlay the world's. `groundStamp(world)` changes with every clearing and every new overlay;
 *     game/path compares it to throw away its cached standability and edge factors (a bush slows a step).
 *
 * Pure data; no DOM, no Three.js.
 *
 * createGround(world, saved?) -> ground
 *   ground.list                [{ x, z, heading, hut, k, tiles }]   the cleared regions in the order they were made (hut: 0 or 1, k: game/leanto `keepFree`, tiles: the indices of the tiles of world.tiles it can touch)
 *   ground.version             goes up with every clearing, for the renderer      ground.dirty   a Set of the indices of the tiles (world.tiles) whose scenery changed since the view last looked (the view empties it)
 *   ground.stamp               a number that changes with every clearing and every new overlay
 *   ground.last                the summary of the latest clearing made by game/game ({ x, z, hut, moved, stuck }) or null
 *   ground.add(l) -> region    clear the region of lean-to l ({ x, z, heading, hut? }); hut > 0 clears the hut's larger region
 *   ground.covers(x, z, rad = 0) -> true when the disc of radius rad at (x, z) touches a cleared region
 *   ground.coversPiece(p) -> true when a loose piece ({ x, z, len, a, rad }, len 0 for a nut) touches a cleared region anywhere along its axis
 *   ground.bushGone(b) -> true for a bush of world/vegetation `tile.bushes` under a cleared region (its drawn radius `bushSize` counts)
 *   ground.rockGone(t, min) -> true for a rock of `tile.rocks` smaller than min (`s` below game/movement STONE_MIN) under a cleared region
 *   ground.state() -> { list: [{ x, z, heading, hut }] }   plain, for saving; saved: such a state (a bad entry is dropped)
 * groundOf(world) -> ground | undefined      groundStamp(world) -> number (0 without an overlay)
 * findSpot(ground, p, oks, others) -> { x, z, a } | null   where loose piece p ({ x, z, len, a, rad }) lies when it is moved out: the nearest spot outside every cleared region (searching outwards from the
 *   middle of the latest region, starting in the direction the piece lies in), at its angle or turned a quarter, that satisfies the first of the functions in `oks` ((x, z) -> boolean, tried one after the
 *   other: the strict rule, then a looser one) and keeps a gap from `others` ([{ x, z, len }] other loose pieces)
 * REGION_BOUND, MOVE_FAR
 *
 * Depends on: game/leanto (keepFree), world/vegetation (bushSize), world/constants
 */
import { keepFree } from './leanto.js';
import { bushSize } from '../world/vegetation.js';
import { HALF, T, NT } from '../world/constants.js';

export const REGION_BOUND = 3.1;   // no cleared region reaches further than this from the lean-to's middle (the hut's: sqrt(2.05^2 + 1.9^2) = 2.8)
export const MOVE_FAR = 6;         // a loose piece is looked a place for up to this far from the middle of the region
const PAD = 0.1;                   // a moved piece keeps this much clear of the region (besides its own radius)

const registry = new WeakMap();    // world -> the overlay of the game that was made last on it
let STAMP = 0;
export const groundOf = w => registry.get(w);
export const groundStamp = w => { const g = registry.get(w); return g ? g.stamp : 0; };

export function createGround(w, saved) {
  const ground = { list: [], version: 0, dirty: new Set(), stamp: ++STAMP, last: null, add, covers, coversPiece, bushGone, rockGone, plantGone, state };
  registry.set(w, ground);
  const tilesOf = l => {   // the indices of the tiles within REGION_BOUND of the lean-to's middle
    const out = [], x0 = Math.max(0, Math.floor((l.x - REGION_BOUND + HALF) / T)), x1 = Math.min(NT - 1, Math.floor((l.x + REGION_BOUND + HALF) / T));
    const z0 = Math.max(0, Math.floor((l.z - REGION_BOUND + HALF) / T)), z1 = Math.min(NT - 1, Math.floor((l.z + REGION_BOUND + HALF) / T));
    for (let tz = z0; tz <= z1; tz++) for (let tx = x0; tx <= x1; tx++) out.push(tz * NT + tx);
    return out;
  };
  function make(l) {
    const hut = (l.hut || 0) > 0 ? 1 : 0, r = { x: l.x, z: l.z, heading: l.heading, hut };
    r.k = keepFree({ x: l.x, z: l.z, heading: l.heading, hut }); r.tiles = tilesOf(l); return r;
  }
  function add(l) {
    const r = make(l); ground.list.push(r);
    for (const k of r.tiles) ground.dirty.add(k);
    ground.version++; ground.stamp = ++STAMP; return r;
  }
  if (saved && Array.isArray(saved.list)) for (const e of saved.list) if (e && [e.x, e.z, e.heading].every(Number.isFinite)) { const r = make(e); ground.list.push(r); for (const k of r.tiles) ground.dirty.add(k); }
  function covers(x, z, rad = 0) {
    for (const r of ground.list) if (Math.abs(x - r.x) <= REGION_BOUND + rad && Math.abs(z - r.z) <= REGION_BOUND + rad && r.k.touches(x, z, rad + 1e-6)) return true;   // (touches is a strict `<`: a point exactly in the region needs a hair of radius)
    return false;
  }
  function coversPiece(p) {
    if (!ground.list.length) return false;
    const h = (p.len || 0) / 2, ca = Math.cos(p.a || 0), sa = Math.sin(p.a || 0), n = Math.max(1, Math.ceil(h / 0.2));
    for (let i = -n; i <= n; i++) { const u = h * i / n; if (covers(p.x + ca * u, p.z + sa * u, p.rad || 0)) return true; }
    return false;
  }
  function bushGone(b) { return ground.list.length > 0 && covers(b.x, b.z, bushSize(b)); }
  function rockGone(t, min) { return ground.list.length > 0 && t.s < min && covers(t.x, t.z, t.s); }
  function plantGone(p, berries) { return ground.list.length > 0 && (berries ? bushGone(p.bush) : covers(p.x, p.z, p.r)); }
  function state() { return { list: ground.list.map(r => ({ x: r.x, z: r.z, heading: r.heading, hut: r.hut })) }; }
  return ground;
}

/** See the header. Deterministic; the search order is outwards, so a piece lands just outside the region on the side it lay on. */
export function findSpot(ground, p, oks, others = []) {
  const mid = ground.list[ground.list.length - 1]; if (!mid) return null;
  const half = (p.len || 0) / 2, rad = (p.rad || 0) + PAD, away = Math.atan2(p.x - mid.x, p.z - mid.z) || 0;
  const fits = (q, a, ok) => {
    const ca = Math.cos(a), sa = Math.sin(a), n = Math.max(1, Math.ceil(half / 0.25));
    for (let i = -n; i <= n; i++) { const u = half * i / n, x = q.x + ca * u, z = q.z + sa * u; if (ground.covers(x, z, rad) || !ok(x, z)) return false; }
    return !others.some(o => Math.hypot(o.x - q.x, o.z - q.z) < 0.5 + ((o.len || 0) + (p.len || 0)) / 4);
  };
  for (const ok of oks) {
    for (let R = 1; R <= MOVE_FAR + 1e-9; R += 0.2) {
      for (let k = 0; k < 24; k++) {
        const dir = away + (k % 2 ? -1 : 1) * Math.ceil(k / 2) * Math.PI / 12, q = { x: mid.x + Math.sin(dir) * R, z: mid.z + Math.cos(dir) * R };
        for (const a of half ? [p.a, p.a + Math.PI / 2] : [p.a]) if (fits(q, a, ok)) return { x: q.x, z: q.z, a };
      }
    }
  }
  return null;
}
