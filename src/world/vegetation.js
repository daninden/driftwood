/**
 * world/vegetation — what grows and lies where, per 40 × 40 tile.
 *
 * Each tile gets its own PRNG from (seed, tx, tz), so a tile always looks
 * the same no matter in which order tiles are built. The result is plain
 * data (positions and a few parameters); world/… never creates meshes.
 *
 * scatterTiles(world) -> tiles[]
 *   tile: { tx, tz, x0, z0, hmax, trees, pines, palms, crags, rocks, bushes, roots }
 *     trees  [{ x, y, z, jungle }]   broadleaf (jungle = tier 2 rain forest)
 *     pines  [{ x, y, z }]           plateau and top
 *     palms  [{ x, y, z }]           beach
 *     crags  [{ x, y, z, s }]        rocks set into steep walls
 *     rocks  [{ x, y, z, s, moss? }] loose boulders (also mark passages)
 *     bushes [{ x, y, z, k }]        k = tier; size from bushSize
 *     roots  [{ x, y, z }]           spots where roots drape over a wall
 *
 * treeHeight(tree, kind) -> height in metres for kind 'tree', 'jungle',
 *   'pine' or 'palm'; most are middling, a few young and small, a few old
 *   giants (TREE_SIZE). Fixed by the tree's place, so near and far agree.
 * treeScale(tree, kind) -> treeHeight relative to that kind's usual height
 * bushSize(bush) -> radius in metres, a fixed function of the bush's place
 *   and tier, so drawing (render/props) and walking (game/movement) agree
 *
 * Depends on: core/noise, world/constants; reads world queries
 */
import { mulberry32, hashInt } from '../core/noise.js';
import { HALF, T, NT } from './constants.js';

// per kind: usual height, then [chance, from, to] as factors of it for young trees and giants, and the middling range
export const TREE_SIZE = Object.freeze({
  tree: { base: 2.0, young: [0.12, 0.55, 0.75], giant: [0.1, 1.6, 2.2], mid: [0.85, 1.25] },
  jungle: { base: 3.4, young: [0.1, 0.6, 0.75], giant: [0.08, 1.6, 2.05], mid: [0.85, 1.2] },
  pine: { base: 2.2, young: [0.15, 0.45, 0.7], giant: [0.1, 1.5, 2.0], mid: [0.85, 1.3] },
  palm: { base: 3.1, young: [0.12, 0.55, 0.75], giant: [0.1, 1.35, 1.6], mid: [0.8, 1.2] },
});
const SALT = { tree: 31, jungle: 37, pine: 41, palm: 43 };
export function treeScale(t, kind) {
  const S = TREE_SIZE[kind], ix = Math.round(t.x * 64), iz = Math.round(t.z * 64);
  const u = hashInt(ix, iz, SALT[kind]) / 4294967296, v = hashInt(iz, ix, SALT[kind] + 1) / 4294967296;
  if (u < S.young[0]) return S.young[1] + v * (S.young[2] - S.young[1]);
  if (u > 1 - S.giant[0]) return S.giant[1] + v * (S.giant[2] - S.giant[1]);
  return S.mid[0] + v * (S.mid[1] - S.mid[0]);
}
export const treeHeight = (t, kind) => TREE_SIZE[kind].base * treeScale(t, kind);

const BUSH_R = [[0.35, 0.3], [0.3, 0.28], [0.38, 0.3], [0.3, 0.25], [0.24, 0.16]];   // per tier: smallest radius, extra range
export function bushSize(b) {
  const u = hashInt(Math.round(b.x * 64), Math.round(b.z * 64), 17) / 4294967296, [r0, dr] = BUSH_R[b.k] || BUSH_R[1];
  return r0 + u * dr;
}

export function scatterTiles(w) {
  const { seed, H, Lat, slope, tierAt, forestB, forestF, dryOfRiver, passAt, fallRouteAt, rcAt } = w;
  const tiles = [];
  for (let tz = 0; tz < NT; tz++) for (let tx = 0; tx < NT; tx++) {
    const x0 = -HALF + tx * T, z0 = -HALF + tz * T, r = mulberry32(hashInt(seed, tx, tz));
    let hmax = -99; for (let j = 0; j <= 8; j++) for (let i = 0; i <= 8; i++) hmax = Math.max(hmax, H(x0 + i * T / 8, z0 + j * T / 8));
    const tile = { tx, tz, x0, z0, hmax, trees: [], pines: [], palms: [], crags: [], rocks: [], bushes: [], roots: [] };
    tiles.push(tile);
    if (hmax < -8.9) continue;
    const cells = (c, fn) => { const n = Math.round(T / c); for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const x = x0 + (i + r()) * c, z = z0 + (j + r()) * c; fn(x, z, r()); } };
    cells(1.25, (x, z, u) => {
      const y = H(x, z), L = Lat(x, z); if (L < 0 || y < 0.6) return;
      const s = slope(x, z), k = tierAt(L), b = forestB(x, z), F = forestF(k, b);
      if (!dryOfRiver(x, z, 0.9)) return; { const pa = passAt(x, z, L); if (pa.scree + pa.ravine > 0.25) return; }
      if (k === 0 && y > 0.72 && y < 2.8 && L < 0.6 && s < 0.45 && u < 0.07) { tile.palms.push({ x, y, z }); return; }
      if (s > 0.9) return;
      if (k === 2 && u < F * 0.75 + 0.04) tile.trees.push({ x, y, z, jungle: true });
      else if ((k === 1 && u < F * 0.6 + 0.02) || (k === 0 && y > 1.4 && u < F * 0.6 + 0.01)) tile.trees.push({ x, y, z, jungle: false });
      else if ((k === 3 && u < F * 0.35 + 0.03) || (k === 4 && s < 0.7 && u < 0.012) || (k === 2 && L - 2 > 0.7 && u < 0.08)) tile.pines.push({ x, y, z });
    });
    cells(1.4, (x, z, u) => { const y = H(x, z); if (y < 1) return; const s = slope(x, z); if (s > 1.0 && u < 0.75 && passAt(x, z).ravine < 0.3 && fallRouteAt(x, z) < 0.3) tile.crags.push({ x, y, z, s: 0.5 + r() * 0.55 }); });
    cells(1.0, (x, z, u) => {
      const L = Lat(x, z); if (L < 0.4) return; const pa = passAt(x, z, L), fr = fallRouteAt(x, z), y = H(x, z), sl = slope(x, z);
      if (pa.ravine > 0.5 && u < 0.3) tile.rocks.push({ x, y, z, s: 0.3 + r() * 0.45 });
      else if (pa.scree > 0.4 && u < 0.16) tile.rocks.push({ x, y, z, s: 0.15 + r() * 0.35 });
      else if (pa.bench > 0.4 && sl > 0.7 && u < 0.35) tile.rocks.push({ x, y, z, s: 0.4 + r() * 0.4 });
      else if (fr > 0.4 && u < 0.3) tile.rocks.push({ x, y, z, s: 0.3 + r() * 0.5, moss: true });
      else if (pa.roots > 0.4 && sl > 0.5 && u < 0.22) tile.roots.push({ x, y, z });
    });
    cells(2.5, (x, z, u) => {
      const y = H(x, z), L = Lat(x, z), k = tierAt(L), s = slope(x, z);
      const p = L < 0.15 && L > -0.08 && y > -1.6 && rcAt(x, z) > 0.5 ? 0.45 : k === 4 ? 0.35 : k === 3 ? 0.08 : (k >= 1 && s > 0.6) ? 0.05 : 0;
      if (u < p) tile.rocks.push({ x, y, z, s: 0.2 + r() * (k >= 3 ? 0.6 : 0.5) });
    });
    cells(1.6, (x, z, u) => {
      const y = H(x, z), L = Lat(x, z); if (L < 0 || y < 1.0) return; const k = tierAt(L), s = slope(x, z);
      if (s > 1.2 || !dryOfRiver(x, z, 0.4)) return; { const pa = passAt(x, z, L); if (pa.scree + pa.ravine > 0.3) return; }
      const F = forestF(k, forestB(x, z)), p = [0.05, 0.08 + F * 0.2, 0.25, 0.14, 0.05][k];
      if (u < p) tile.bushes.push({ x, y, z, k });
    });
  }
  return tiles;
}
