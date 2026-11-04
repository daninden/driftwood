/**
 * render/finds — the dead palm fronds and the stones that lie on the ground (0.27 "Home"), and the look of
 * their piles and of a carried one.
 *
 * Where they lie comes from game/fronds and game/stones; which are still there comes from the same places
 * (`fronds.version` and `stones.version` go up when one is taken or a frond falls again). A frond is a flat,
 * dead palm frond, the palms' own frond shape (render/geometry) lying on the ground, drier than the live ones:
 * most in the tan of the dry frond texture, some the green texture gone brown. A stone is a small rounded
 * grey stone, a flattened lump of the rock shape, half sunk in the ground, with the dark outline of the other
 * things. Their look is fixed by their id. Piles of fronds are a stack of folded fronds turned a little against
 * each other, piles of stones a small heap (render/driftwood addPile calls these).
 *
 * frondMatrix(H, f) -> Matrix4   a frond lying on the ground
 * stoneMatrix(H, s) -> Matrix4         a stone half sunk in the ground
 * frondColor(f) / stoneColor(s) -> colour, fixed by the id (carried and in piles too)
 * addFrond(B, kit, H, f), addStone(B, kit, H, s)       one into a Batch
 * addFrondPile(B, kit, H, pile), addStonePile(B, kit, H, pile)   the pieces of a pile into a Batch
 * createFindsView(scene, world, kit, fronds, stones) -> { addTile, dropTile, update }
 *   addTile(tile), dropTile(tile)   with the detailed tiles
 *   update()   rebuilds the tiles when a frond or stone was taken or a frond fell again: only the tiles in fronds.dirty and stones.dirty (render/tileRebuild)
 *
 * Depends on: three, core/noise, render/batch, render/geometry, render/materials, render/nearTile (disposeGroup), render/tileRebuild, render/palette
 */
import * as THREE from 'three';
import { hashInt } from '../core/noise.js';
import { Batch } from './batch.js';
import { mat4 } from './geometry.js';
import { outlineMat } from './materials.js';
import { disposeGroup } from './nearTile.js';
import { rebuildTiles } from './tileRebuild.js';
import { FROND, STONE } from './palette.js';

const FROND_SY = 0.16, FROND_LIFT = 0.04;   // the arch squeezed flat, a hair above the ground

const pickBy = (id, salt, list) => list[hashInt(id, salt, 811) % list.length];
const greenOne = f => hashInt(f.id, 5, 813) % 3 === 0;   // one in three is the green texture gone brown

export const frondColor = f => greenOne(f) ? pickBy(f.id, 7, FROND.green) : pickBy(f.id, 9, FROND.dry);
export const stoneColor = s => pickBy(s.id, 11, STONE);


export function frondMatrix(H, f) {
  const ca = Math.cos(f.a), sa = Math.sin(f.a), bx = f.x - ca * f.len / 2, bz = f.z - sa * f.len / 2;
  return mat4(bx, H(f.x, f.z) + FROND_LIFT, bz, f.len / 2, FROND_SY, 1.1, -f.a);
}

export function stoneMatrix(H, s) {
  const r = hashInt(s.id, 13, 815) / 4294967296;
  return mat4(s.x, H(s.x, s.z) + s.rad * 0.3, s.z, s.rad * 1.2, s.rad * 0.78, s.rad * (0.9 + r * 0.3), s.a * 2);
}

function addFrondOf(B, kit, f, m) {
  if (greenOne(f)) B.add('fgrd', kit.frond, kit.frondStillMat, m, frondColor(f), { depthMat: kit.frondStillDepth, receive: false });
  else B.add('fdry', kit.frond, kit.dryFrondStillMat, m, frondColor(f), { depthMat: kit.dryFrondStillDepth, receive: false });
}

export function addFrond(B, kit, H, f) { addFrondOf(B, kit, f, frondMatrix(H, f)); }

export function addStone(B, kit, H, s) { B.add('stone', kit.rock, kit.smallMat, stoneMatrix(H, s), stoneColor(s), { outline: 1.16 }); }

export function addFrondPile(B, kit, H, pile) {
  const g = H(pile.x, pile.z), a0 = (hashInt(Math.round(pile.x * 64), Math.round(pile.z * 64), 59) / 4294967296) * Math.PI;
  pile.logs.forEach((f, i) => {
    const turn = a0 + i * 0.55 + ((i * 0.37) % 0.2 - 0.1), len = 1.0;
    const ca = Math.cos(turn), sa = Math.sin(turn), m = mat4(pile.x - ca * len / 2, g + 0.03 + i * 0.032, pile.z - sa * len / 2, len / 2, FROND_SY, 0.95, -turn);
    addFrondOf(B, kit, f, m);
  });
}

export function addStonePile(B, kit, H, pile) {
  const g = H(pile.x, pile.z);
  pile.logs.forEach((s, i) => {
    const layer = Math.floor(i / 4), k = i % 4, ang = k / 4 * Math.PI * 2 + layer * 0.8 + hashInt(s.id, 17, 817) / 4294967296 * 0.4, rr = 0.2 * (1 - layer * 0.28), r = s.rad;
    B.add('spile', kit.rock, kit.smallMat, mat4(pile.x + Math.cos(ang) * rr, g + r * 0.55 + layer * 0.1, pile.z + Math.sin(ang) * rr, r * 1.25, r * 0.85, r * 1.1, ang * 3), stoneColor(s), { outline: 1.16 });
  });
}

export function createFindsView(scene, w, kit, fronds, stones) {
  const tiles = new Map();   // tile -> group of its fronds and stones
  let seen = fronds.version + ':' + stones.version;
  const tileGroup = tile => {
    const list = fronds.groundFronds(tile), rocks = stones.groundStones(tile); if (!list.length && !rocks.length) return null;
    const g = new THREE.Group(), B = new Batch(outlineMat);
    for (const f of list) addFrond(B, kit, w.H, f);
    for (const s of rocks) addStone(B, kit, w.H, s);
    B.build(g); scene.add(g); return g;
  };
  function addTile(tile) { if (!tiles.has(tile)) tiles.set(tile, tileGroup(tile)); }
  function dropTile(tile) { const g = tiles.get(tile); if (g) disposeGroup(g); tiles.delete(tile); }
  function update() {
    const key = fronds.version + ':' + stones.version; if (key === seen) return;
    seen = key;
    const redo = (tile, g) => { if (g) disposeGroup(g); tiles.set(tile, tileGroup(tile)); };
    rebuildTiles(tiles, fronds.dirty, w.tiles, redo); rebuildTiles(tiles, stones.dirty, w.tiles, redo);
  }
  return { addTile, dropTile, update };
}
