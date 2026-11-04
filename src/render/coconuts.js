/**
 * render/coconuts — the fallen coconuts under the palms that can be husked
 * for fibre (game/fibre), drawn with the detailed tiles.
 *
 * Where they lie comes from world/vegetation (`tile.cocos`); which of those exist
 * (thinned) and which are still there comes from game/fibre (`groundCocos`). Each nut's colour is fixed by its id.
 *
 * addCoconut(B, kit, H, coco)   one nut, a little flattened, outlined
 * createCocoView(scene, world, kit, fibre) -> cocoView
 *   cocoView.addTile(tile), cocoView.dropTile(tile)   with the detailed tiles
 *   cocoView.update()   rebuilds the tiles when nuts were taken or fell again
 *     (fibre.version)
 *
 * Depends on: three, core/noise, render/batch, render/geometry, render/materials,
 *   render/nearTile (disposeGroup), render/palette
 */
import * as THREE from 'three';
import { hashInt } from '../core/noise.js';
import { Batch } from './batch.js';
import { mat4 } from './geometry.js';
import { outlineMat } from './materials.js';
import { disposeGroup } from './nearTile.js';
import { COCO } from './palette.js';

export function addCoconut(B, kit, H, c) {
  B.add('coco', kit.shell, kit.smallMat, mat4(c.x, H(c.x, c.z) + 0.07, c.z, 0.1, 0.085, 0.09, c.a), COCO[hashInt(c.id, 3, 67) % COCO.length], { outline: 1.15 });
}

export function createCocoView(scene, w, kit, fibre) {
  const tiles = new Map();   // tile -> group of its coconuts
  let seen = fibre.version;
  const tileGroup = tile => { const g = new THREE.Group(), B = new Batch(outlineMat); for (const c of fibre.groundCocos(tile)) addCoconut(B, kit, w.H, c); B.build(g); scene.add(g); return g; };
  function addTile(tile) { if (tile.cocos && tile.cocos.length && !tiles.has(tile)) tiles.set(tile, tileGroup(tile)); }
  function dropTile(tile) { const g = tiles.get(tile); if (g) { disposeGroup(g); tiles.delete(tile); } }
  function update() {
    if (fibre.version === seen) return;
    seen = fibre.version;
    tiles.forEach((g, tile) => { disposeGroup(g); tiles.set(tile, tileGroup(tile)); });
  }
  return { addTile, dropTile, update };
}
