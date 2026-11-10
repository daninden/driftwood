/**
 * world/world — builds the whole island from a seed and exposes it as one
 * read-only object with query functions. This is the only entry point the
 * render and game layers use.
 *
 * generateWorld(seed, { progress, heightfield }) -> Promise<World>
 *   progress(label, fraction) is optional and awaited between steps.
 *   heightfield(seed, progress) -> Promise<{ HG, LG }> is optional: a faster
 *   way to build the height grids (main runs them in Web Workers); it must
 *   give exactly what buildHeightfield gives.
 *
 * World
 *   seed, noise, SC, HL, rivers, tiles
 *   H(x, z)            ground height
 *   Lat(x, z)          terrace level L (floor = tier, < 0 = sea)
 *   slope(x, z)        gradient magnitude (rise per unit)
 *   tierAt(L)          0 coast, 1 lowland, 2 highland, 3 plateau, 4 summit
 *   passAt(x, z, L?)   natural passage strengths (see world/terrain)
 *   riverAt(x, z)      null or { d, t, rv, hw, lw } (distance, position, river,
 *                      half width, water level)
 *   riverNear(x, z, r) false when riverAt is null at every point within r of
 *                      (x, z) (0.30.5 "Quicker": a 4 m block mask of the river
 *                      distance grid; true only means "maybe", ask riverAt)
 *   dryOfRiver(x, z, margin)
 *   fallRouteAt(x, z)  0..1 scramble route beside a waterfall
 *   forestB(x, z), forestF(k, b)   forest density field and per-tier mapping
 *   rcAt(x, z)         rocky-coast mask
 *   aoAt(x, z, y)      ambient occlusion 0.5..1
 *
 * Pure data and functions: no DOM, no rendering. Runs in Node for the tests.
 *
 * Depends on: every other world/* module
 */
import { createNoise } from '../core/noise.js';
import { ss } from '../core/math.js';
import { createShape } from './shape.js';
import { createTerrain } from './terrain.js';
import { buildHeightfield, sampleGrid } from './heightfield.js';
import { computeRivers, rockCoast } from './rivers.js';
import { scatterTiles } from './vegetation.js';
import { buildOcclusion } from './occlusion.js';
import { HALF, GR, NG } from './constants.js';

export const tierAt = L => Math.max(0, Math.min(4, Math.floor(L)));

export async function generateWorld(seed, { progress, heightfield } = {}) {
  const p = progress || (async () => {});
  const noise = createNoise(seed);
  const { vnoise } = noise;
  await p('shape', 0);
  const shp = createShape(noise, seed);
  const terrain = createTerrain(noise);
  const hp = (l, f) => p('heights', f);
  const { HG, LG } = heightfield ? await heightfield(seed, hp) : await buildHeightfield(shp, terrain, hp);
  await p('rivers', 0);
  const { rivers, RD, RT, RI } = computeRivers({ HG, LG, noise, HL: shp.HL });

  const H = (x, z) => sampleGrid(HG, x, z);
  const Lat = (x, z) => sampleGrid(LG, x, z);
  function slope(x, z) { const e = 0.3, dx = H(x + e, z) - H(x - e, z), dz = H(x, z + e) - H(x, z - e); return Math.sqrt(dx * dx + dz * dz) / (2 * e); }
  function riverAt(x, z) {
    const fx = Math.round((x + HALF) / GR), fz = Math.round((z + HALF) / GR); if (fx < 0 || fz < 0 || fx >= NG || fz >= NG) return null;
    const id = fz * NG + fx, d = sampleGrid(RD, x, z); if (d > 12 || !rivers.length) return null;
    const rv = rivers[RI[id]], t = RT[id]; return { d, t, rv, hw: rv.W(t) / 2, lw: rv.LW(t) };
  }
  // 0.30.5 "Quicker": riverAt is null where its sampled distance is above 12, and a sample is a weighted mean (weights 0..1) of four grid values. So when every grid value a sample in a
  // square could use is above 12 (with a margin for rounding), riverAt is null everywhere in it. The mask marks the blocks of RB x RB grid values with any value at or below that.
  const RB = 16, NB = Math.ceil(NG / RB), riverBlock = new Uint8Array(NB * NB);
  for (let j = 0; j < NG; j++) for (let i = 0; i < NG; i++) if (RD[j * NG + i] <= 12.001) riverBlock[((j / RB) | 0) * NB + ((i / RB) | 0)] = 1;
  const gridAt = v => Math.max(0, Math.min(NG - 1.001, (v + HALF) / GR));
  function riverNear(x, z, r) {
    if (!rivers.length) return false;
    const i0 = Math.floor(gridAt(x - r)), i1 = Math.floor(gridAt(x + r)) + 1, j0 = Math.floor(gridAt(z - r)), j1 = Math.floor(gridAt(z + r)) + 1;
    for (let bj = (j0 / RB) | 0; bj <= ((j1 / RB) | 0); bj++) for (let bi = (i0 / RB) | 0; bi <= ((i1 / RB) | 0); bi++) if (riverBlock[bj * NB + bi]) return true;
    return false;
  }
  const dryOfRiver = (x, z, m) => { const r = riverAt(x, z); return !r || r.d > r.hw + m; };
  function fallRouteAt(x, z) {
    const r = riverAt(x, z); if (!r) return 0; let b = 0;
    for (const f of r.rv.falls) { const t0 = (f.top - 10) / (r.rv.n - 1), t1 = (f.base + 10) / (r.rv.n - 1); if (r.t < t0 || r.t > t1) continue; b = Math.max(b, ss(r.hw + 0.2, r.hw + 0.8, r.d) * ss(r.hw + 4.2, r.hw + 2.6, r.d)); }
    return b;
  }
  const passAt = (x, z, L) => terrain.passAt(x, z, L === undefined ? Lat(x, z) : L);
  const forestB = (x, z) => vnoise(x * 0.06 + 31, z * 0.06 + 17) * 0.65 + vnoise(x * 0.17 + 5, z * 0.17 + 9) * 0.35;
  const forestF = (k, b) => [ss(0.52, 0.64, b) * 0.5, ss(0.5, 0.63, b), ss(0.36, 0.5, b), ss(0.56, 0.68, b) * 0.6, 0][k];
  const rcAt = (x, z) => rockCoast(vnoise, x, z);

  const world = { seed, noise, SC: shp.SC, HL: shp.HL, rivers, H, Lat, slope, tierAt, passAt, riverAt, riverNear, dryOfRiver, fallRouteAt, forestB, forestF, rcAt };
  await p('vegetation', 0);
  world.tiles = scatterTiles(world);
  world.aoAt = buildOcclusion(world.tiles, H);
  await p('done', 1);
  return Object.freeze(world);
}
