/**
 * render/branches — the branches that lie under the broadleaf and rain forest
 * trees (game/branches), drawn with the detailed tiles.
 *
 * Where they lie comes from game/branches; which ones are still there comes
 * from the same place (`branches.version` goes up when one is taken or grows
 * back). A branch is a thin dark stick, 0.8 to 1.2 m long, with one or two
 * side twigs and a few dry leaves on the ground beside it, in the same toon
 * style with outlines as the driftwood. Its look is fixed by its id.
 *
 * branchParts(H, b) -> { sticks: [{ a, b, r }], leaves: [{ x, y, z, s, turn }] }   pure
 *   the stick of the branch itself first (a to b, radius r), then its twigs
 * addBranch(B, kit, H, b)   one branch, into a Batch
 * createBranchView(scene, world, kit, branches) -> branchView
 *   branchView.addTile(tile), branchView.dropTile(tile)   with the detailed tiles
 *   branchView.update()   rebuilds the tiles when a branch was taken or grew
 *     back (branches.version), and only the tiles in branches.dirty (render/tileRebuild)
 *
 * Depends on: three, core/noise, render/batch, render/geometry, render/materials,
 *   render/nearTile (disposeGroup), render/tileRebuild, render/palette
 */
import * as THREE from 'three';
import { mulberry32, hashInt, pick } from '../core/noise.js';
import { Batch, poolsOf } from './batch.js';
import { mat4, stickMatrix } from './geometry.js';
import { outlineMat } from './materials.js';
import { disposeGroup } from './nearTile.js';
import { rebuildTiles } from './tileRebuild.js';
import { BRANCH } from './palette.js';
import { driftColor } from './driftwood.js';

export function branchParts(H, b) {
  const r = mulberry32(hashInt(b.id, 7, 89)), ca = Math.cos(b.a), sa = Math.sin(b.a), h = b.len / 2;
  const A = new THREE.Vector3(b.x - ca * h, 0, b.z - sa * h), Bv = new THREE.Vector3(b.x + ca * h, 0, b.z + sa * h);
  A.y = H(A.x, A.z) + b.rad * 0.9; Bv.y = H(Bv.x, Bv.z) + b.rad * 0.9 + 0.02;
  const sticks = [{ a: A, b: Bv, r: b.rad }], leaves = [];
  const twigs = 1 + (r() < 0.5 ? 1 : 0);
  for (let k = 0; k < twigs; k++) {
    const u = 0.3 + r() * 0.5, side = k % 2 ? -1 : 1, tl = 0.22 + r() * 0.25, P = new THREE.Vector3().lerpVectors(A, Bv, u);
    const Q = P.clone().add(new THREE.Vector3((ca * 0.55 - sa * side) * tl, 0.05 + r() * 0.1, (sa * 0.55 + ca * side) * tl));
    sticks.push({ a: P, b: Q, r: b.rad * 0.45 });
    leaves.push({ x: Q.x, y: Q.y + 0.01, z: Q.z, s: 0.8 + r() * 0.4, turn: r() * 6 });
  }
  for (let k = 0; k < 2; k++) {   // a couple of dry leaves lying beside it
    const u = r(), P = new THREE.Vector3().lerpVectors(A, Bv, u), off = (r() < 0.5 ? -1 : 1) * (0.06 + r() * 0.1);
    leaves.push({ x: P.x - sa * off, y: P.y - b.rad * 0.5, z: P.z + ca * off, s: 0.7 + r() * 0.4, turn: r() * 6 });
  }
  return { sticks, leaves };
}

export function addBranch(B, kit, H, b) {
  const { sticks, leaves } = branchParts(H, b), col = driftColor(b);
  sticks.forEach((s, i) => B.add(i ? 'brt' : 'br', kit.driftwood, kit.smallMat, stickMatrix(s.a, s.b, s.r / 0.09), col, { outline: i ? 1.2 : 1.18 }));
  const r = mulberry32(hashInt(b.id, 9, 97));
  for (const l of leaves) B.add('brl', kit.shell, kit.smallMat, mat4(l.x, l.y, l.z, 0.05 * l.s, 0.012, 0.03 * l.s, l.turn), pick(r, BRANCH.leaf), { outline: 1.25, cast: false });
}

export function createBranchView(scene, w, kit, branches) {
  const tiles = new Map();   // tile -> group of its branches
  let seen = branches.version;
  const tileGroup = tile => { const g = new THREE.Group(), B = new Batch(outlineMat, poolsOf(scene)); for (const b of branches.groundBranches(tile)) addBranch(B, kit, w.H, b); B.build(g); scene.add(g); return g; };
  function addTile(tile) { if (!tiles.has(tile)) tiles.set(tile, tileGroup(tile)); }   // (0.31: every tile: a felled crown may leave branches on a tile without trees)
  function dropTile(tile) { const g = tiles.get(tile); if (g) { disposeGroup(g); tiles.delete(tile); } }
  function update() {
    if (branches.version === seen) return;
    seen = branches.version;
    rebuildTiles(tiles, branches.dirty, w.tiles, (tile, g) => { disposeGroup(g); tiles.set(tile, tileGroup(tile)); });
  }
  return { addTile, dropTile, update };
}
