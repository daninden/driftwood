/**
 * render/driftwood — the driftwood you can gather: logs on the beach, the
 * piles you lay down, and the look of a piece the castaway carries.
 *
 * The beach logs come from world/vegetation (`tile.drift`); which ones are
 * still there, what is carried and where the piles are comes from game/wood.
 * Each log's look (colour, a side branch, a root plate) is fixed by its
 * place, so it looks the same on the beach, under the arm and on a pile.
 * Only what is on the beach has its branch and root plate drawn.
 *
 * driftLook(log) -> { col, branch, roots }   pure; branch and roots are
 *   null or parameters
 * addBeachLog(B, kit, H, log)       a log as it washed up
 * addPile(B, kit, H, pile)          logs stacked crosswise, two per layer
 * createWoodView(scene, world, kit, wood) -> woodView
 *   woodView.addTile(tile), woodView.dropTile(tile)   with the detailed tiles
 *   woodView.update()   rebuilds what changed since the last call (wood.version)
 *
 * Depends on: three, core/noise, render/geometry, render/nearTile (disposeGroup)
 */
import * as THREE from 'three';
import { mulberry32, hashInt, pick } from '../core/noise.js';
import { stickMatrix } from './geometry.js';
import { Batch } from './batch.js';
import { outlineMat } from './materials.js';
import { disposeGroup } from './nearTile.js';

const COLS = [0xa8987c, 0x9a8a70, 0xb4a68c, 0x8e8068];

export function driftLook(log) {
  const r = mulberry32(hashInt(Math.round(log.x * 64), Math.round(log.z * 64), 53));
  const col = pick(r, COLS);
  const branch = r() < 0.6 ? { u: 0.3 + r() * 0.5, side: r() < 0.5 ? 1 : -1, bl: 0.5 + r() * 0.7, up: 0.15 + r() * 0.3 } : null;
  const roots = r() < 0.35 ? [0, 1, 2, 3, 4].map(() => r()) : null;
  return { col, branch, roots };
}

export function addBeachLog(B, kit, H, log) {
  const { x, z, y, len, rad } = log, ca = Math.cos(log.a), sa = Math.sin(log.a), { col, branch, roots } = driftLook(log);
  const A = new THREE.Vector3(x - ca * len / 2, 0, z - sa * len / 2), Bv = new THREE.Vector3(x + ca * len / 2, 0, z + sa * len / 2);
  A.y = Math.max(H(A.x, A.z), y - 0.2) + rad * 0.7; Bv.y = Math.max(H(Bv.x, Bv.z), y - 0.2) + rad * 0.6;
  B.add('log', kit.driftwood, kit.smallMat, stickMatrix(A, Bv, rad / 0.09), col, { outline: 1.12 });
  if (branch) {
    const { u, side, bl, up } = branch, P0 = new THREE.Vector3().lerpVectors(A, Bv, u);
    const P1 = P0.clone().add(new THREE.Vector3((ca * 0.6 - sa * side) * bl, up, (sa * 0.6 + ca * side) * bl));
    B.add('logb', kit.driftwood, kit.smallMat, stickMatrix(P0, P1, rad * 0.4 / 0.09), col, { outline: 1.15 });
  }
  if (roots) roots.forEach((v, k) => {
    const ang = k / 5 * Math.PI * 2 + v, P1 = A.clone().add(new THREE.Vector3(-ca * 0.15 + Math.cos(ang) * -sa * 0.45, Math.sin(ang) * 0.4 + 0.1, -sa * 0.15 + Math.cos(ang) * ca * 0.45));
    P1.y = Math.max(P1.y, H(P1.x, P1.z) + 0.03);
    B.add('logr', kit.driftwood, kit.smallMat, stickMatrix(A, P1, rad * 0.35 / 0.09), col, { outline: 1.15 });
  });
}

export function addPile(B, kit, H, pile) {
  const a0 = (hashInt(Math.round(pile.x * 64), Math.round(pile.z * 64), 59) / 4294967296) * Math.PI;
  const g = H(pile.x, pile.z);
  pile.logs.forEach((log, i) => {
    const layer = i >> 1, a = a0 + (layer % 2) * Math.PI / 2 + ((i * 0.37) % 0.2 - 0.1), ca = Math.cos(a), sa = Math.sin(a);
    const off = (i % 2 ? 1 : -1) * 0.15, cx = pile.x - sa * off, cz = pile.z + ca * off, cy = g + 0.08 + layer * 0.19, h = log.len / 2;
    const A = new THREE.Vector3(cx - ca * h, cy, cz - sa * h), Bv = new THREE.Vector3(cx + ca * h, cy + 0.02, cz + sa * h);
    B.add('pile', kit.driftwood, kit.smallMat, stickMatrix(A, Bv, log.rad / 0.09), driftLook(log).col, { outline: 1.12 });
  });
}

export function createWoodView(scene, w, kit, wood) {
  const tiles = new Map();   // tile -> group of its beach logs
  let piles = null, seen = -1;
  const build = add => { const grp = new THREE.Group(), B = new Batch(outlineMat); add(B); B.build(grp); scene.add(grp); return grp; };
  const tileGroup = tile => build(B => { for (const l of tile.drift) if (wood.onBeach(l)) addBeachLog(B, kit, w.H, l); });

  function addTile(tile) { if (tile.drift && tile.drift.length && !tiles.has(tile)) tiles.set(tile, tileGroup(tile)); }
  function dropTile(tile) { const g = tiles.get(tile); if (g) { disposeGroup(g); tiles.delete(tile); } }
  function update() {
    if (wood.version === seen) return;
    seen = wood.version;
    tiles.forEach((g, tile) => { disposeGroup(g); tiles.set(tile, tileGroup(tile)); });
    if (piles) disposeGroup(piles);
    piles = build(B => { for (const p of wood.piles) addPile(B, kit, w.H, p); });
  }
  return { addTile, dropTile, update };
}
