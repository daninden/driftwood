/**
 * game/forage — food away from the coast (0.26 "Inland"): berry bushes in the
 * lowland and wild banana plants in the rain forest, and what he carries of
 * them.
 *
 * Rules
 *   - Nothing is added to the generated island. The plants are picked out of the
 *     bushes the world already has (world/vegetation `tile.bushes`), like the
 *     branches are derived from the trees (game/branches): which bush bears is
 *     fixed by a hash of its place.
 *   - Berries: about 1 in 8 of the lowland bushes (tier 1: the dense shrubs of
 *     the forest edges and clearings; never the dune scrub of the beach) bear
 *     berries. A short press beside a bearing bush picks a handful (game/game).
 *     The bush bears again BERRIES.regrow days later (2 to 4, fixed per bush and
 *     per time it was picked). A handful takes BERRY_FOOD (1/6 day: a snack) off the hunger;
 *     carried, it spoils after BERRIES.keep (one day) and is gone. At most 2 handfuls.
 *   - Bananas: rare. About 1 in 180 of the rain forest bushes (tier 2) has a wild
 *     banana plant growing beside it (BANANA_SHARE; on seed 1337 about a dozen on
 *     the whole island). A bunch takes BANANA_FOOD (a whole day) off the hunger, grows
 *     back 7 to 8 days after it was picked and keeps 3 days when carried. At most one bunch.
 *   - Whether he eats it on the spot or carries it, and which food is eaten first
 *     (what spoils first), is the action button's business (game/game `action`).
 *
 * Pure data on a world; no DOM, no Three.js.
 *
 * BERRIES, BANANAS         the two kinds: { name, tier, share, max, food, regrow, spread, keep, salt }
 * BERRY_FOOD, BANANA_FOOD  days of hunger one handful or one bunch takes away
 * plantsOfTile(w, tile, kind) -> [plant]   the plants of a tile (picked or not): { id, x, y, z, r, k, bush }
 *   (kind: BERRIES or BANANAS; r: the reach radius; bush: the world bush it belongs to; the banana plant stands beside it)
 * createForage(w, kind, saved?) -> forage
 *   forage.carried          [total]  the game clock (days) at which each handful or bunch was picked, oldest first
 *   forage.picked           Map plantId -> total at which it was picked
 *   forage.version          goes up with every change, for the renderer
 *   forage.dirty            a Set of the indices of the tiles (world.tiles) whose pieces changed since the view last looked (taken, grown back), so the view
 *                           rebuilds just those; the view empties it. Not saved
 *   forage.plantsIn(tile)   the plants of a tile, picked or not
 *   forage.bearing(p)       true while the plant has its berries or bunch
 *   forage.bearingIn(tile)  the plants of a tile that bear now
 *   forage.find(x, z, reach) -> { kind: 'berries' | 'bananas', plant, x, z, d } | null   the nearest bearing plant (d: distance from its edge)
 *   forage.full()           true when he carries the most he can
 *   forage.pick(p, total)   true when it was picked (false: not bearing); it is then gone until it regrows
 *   forage.stow(total)      true when a handful or bunch was put in the row (false: full)
 *   forage.eat()            true when the oldest carried one was eaten (it leaves the row)
 *   forage.update(total)    spoiled ones leave the row, plants bear again when their time has come
 *   forage.state() -> { carried, picked: [[id, total]] }   plain, for saving
 *   saved: such a state, to start from (missing or bad parts are dropped)
 *
 * Depends on: core/noise, world/constants, world/vegetation
 */
import { hashInt } from '../core/noise.js';
import { HALF, T, NT } from '../world/constants.js';
import { bushSize } from '../world/vegetation.js';

export const BERRY_FOOD = 1 / 6, BANANA_FOOD = 1;
export const BERRY_SHARE = 1 / 5, BANANA_SHARE = 1 / 180;
export const BERRIES = Object.freeze({ name: 'berries', tier: 1, share: BERRY_SHARE, max: 2, food: BERRY_FOOD, regrow: 2, spread: 2, keep: 1, salt: 101 });
export const BANANAS = Object.freeze({ name: 'bananas', tier: 2, share: BANANA_SHARE, max: 1, food: BANANA_FOOD, regrow: 7, spread: 1, keep: 3, salt: 103 });
const TILE_SPAN = 4096;   // ids per tile (a tile has far fewer bushes)

const caches = { berries: new WeakMap(), bananas: new WeakMap() };
const tileOf = (x, z) => Math.floor((z + HALF) / T) * NT + Math.floor((x + HALF) / T);

export function plantsOfTile(w, tile, kind) {
  const cache = caches[kind.name];
  let list = cache.get(tile); if (list) return list;
  list = []; cache.set(tile, list);
  const base = (tile.tz * NT + tile.tx) * TILE_SPAN;
  tile.bushes.forEach((b, i) => {
    if (b.k !== kind.tier) return;
    const ix = Math.round(b.x * 64), iz = Math.round(b.z * 64);
    if (hashInt(ix, iz, kind.salt) / 4294967296 >= kind.share) return;
    if (kind === BERRIES) { list.push({ id: base + i, x: b.x, y: b.y, z: b.z, r: bushSize(b) * 0.9, k: b.k, bush: b }); return; }
    const ang = hashInt(ix, iz, kind.salt + 2) / 4294967296 * Math.PI * 2, d = bushSize(b) + 0.6;   // the banana plant stands beside the bush
    const x = b.x + Math.cos(ang) * d, z = b.z + Math.sin(ang) * d, y = w.H(x, z);
    if (!(y > 0.6 && w.slope(x, z) < 0.7 && w.dryOfRiver(x, z, 0.8))) return;   // on dry, gentle ground
    list.push({ id: base + i, x, y, z, r: 0.35, k: b.k, bush: b });
  });
  return list;
}

export function createForage(w, kind, saved) {
  const byId = new Map(), picked = new Map();   // picked: id -> the day it was picked
  const forage = { carried: [], picked, version: 0, dirty: new Set(), plantsIn, bearing, bearingIn, find, full, pick, stow, eat, update, state };
  const plant = id => {
    if (byId.has(id)) return byId.get(id);
    const tile = w.tiles[Math.floor(id / TILE_SPAN)];
    const p = tile ? plantsOfTile(w, tile, kind).find(q => q.id === id) || null : null;
    byId.set(id, p); return p;
  };
  const back = (id, at) => at + kind.regrow + kind.spread * (hashInt(id, Math.floor(at * 1000), kind.salt + 7) / 4294967296);
  if (saved) {
    const num = Number.isFinite;
    if (Array.isArray(saved.carried)) forage.carried = saved.carried.filter(num).slice(0, kind.max).sort((a, b) => a - b);
    if (Array.isArray(saved.picked)) for (const e of saved.picked) if (Array.isArray(e) && Number.isInteger(e[0]) && num(e[1]) && plant(e[0])) picked.set(e[0], e[1]);
  }

  function plantsIn(tile) { return plantsOfTile(w, tile, kind); }
  function bearing(p) { return !picked.has(p.id); }
  function bearingIn(tile) { return plantsOfTile(w, tile, kind).filter(bearing); }
  function find(x, z, reach) {
    let best = null, bd = reach;
    const k0 = tileOf(x, z), seen = new Set();
    for (const dz of [-1, 0, 1]) for (const dx of [-1, 0, 1]) {
      const k = k0 + dz * NT + dx; if (seen.has(k) || k < 0 || k >= w.tiles.length) continue; seen.add(k);
      for (const p of plantsOfTile(w, w.tiles[k], kind)) {
        if (picked.has(p.id)) continue;
        const d = Math.max(0, Math.hypot(p.x - x, p.z - z) - p.r);
        if (d < bd) { bd = d; best = { kind: kind.name, plant: p, x: p.x, z: p.z, d }; }
      }
    }
    return best;
  }
  function full() { return forage.carried.length >= kind.max; }
  function pick(p, total) {
    if (!p || picked.has(p.id) || !plant(p.id)) return false;
    picked.set(p.id, total); forage.dirty.add(Math.floor(p.id / TILE_SPAN)); forage.version++; return true;
  }
  function stow(total) { if (full()) return false; forage.carried.push(total); forage.version++; return true; }
  function eat() { if (!forage.carried.length) return false; forage.carried.shift(); forage.version++; return true; }
  function update(total) {
    if (forage.carried.some(t => total - t >= kind.keep)) { forage.carried = forage.carried.filter(t => total - t < kind.keep); forage.version++; }
    let n = 0;
    picked.forEach((at, id) => { if (total >= back(id, at)) { picked.delete(id); n++; forage.dirty.add(Math.floor(id / TILE_SPAN)); } });
    if (n) forage.version++;
  }
  function state() { return { carried: forage.carried.slice(), picked: [...picked] }; }
  return forage;
}
