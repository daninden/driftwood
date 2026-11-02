/**
 * render/farTiles — a cheap version of every tile, always present.
 *
 * 40 × 40 grid, 128 px texture, low-poly crowns and rocks. These fill the
 * view wherever no detailed tile is ready yet, and everything beyond.
 *
 * buildFarTiles(world, colorAt, kit, scene, progress?) -> Promise<Map<tile, Group>>
 * updateFarTiles(map, isVisible(tile)) sets group visibility each frame
 *
 * Depends on: three, core/noise, core/slicer, render/*
 */
import * as THREE from 'three';
import { mulberry32, hashInt, pick } from '../core/noise.js';
import { drain } from '../core/slicer.js';
import { P, BUSHC } from './palette.js';
import { terrainMat, outlineMat } from './materials.js';
import { Batch } from './batch.js';
import { mat4 } from './geometry.js';
import { rockColor } from './props.js';
import { tileGeometry, tileTexture } from './terrainTile.js';

function buildFarTile(w, colorAt, kit, tile) {
  const grp = new THREE.Group(), r = mulberry32(hashInt(w.seed + 9, tile.tx, tile.tz));
  const mesh = new THREE.Mesh(drain(tileGeometry(w, tile, 40)), terrainMat(drain(tileTexture(w, colorAt, tile, 128))));
  mesh.receiveShadow = true; mesh.castShadow = true; grp.add(mesh);
  const B = new Batch(outlineMat);
  tile.trees.forEach(t => { const h = t.jungle ? 3.4 : 2.0, cs = t.jungle ? 1.5 : 1.05; B.add('c', kit.canopyLod, kit.canopyMat, mat4(t.x, t.y + h + 0.2, t.z, cs, cs * 0.8, cs, r() * 6), new THREE.Color(pick(r, t.jungle ? P.jungle : P.canopy)).getHex(), { outline: 1.05 }); });
  tile.pines.forEach(t => B.add('p', kit.pineLod, kit.canopyMat, mat4(t.x, t.y + 1.3, t.z, 0.6, 2.4, 0.6, r() * 6), pick(r, P.pine), { outline: 1.06 }));
  tile.palms.forEach(t => B.add('pa', kit.canopyLod, kit.canopyMat, mat4(t.x, t.y + 2.9, t.z, 1.1, 0.35, 1.1, r() * 6), 0x7f9c48, {}));
  tile.crags.forEach(t => B.add('k', kit.rockLod, kit.rockMat, mat4(t.x, t.y - t.s * 0.35, t.z, t.s * 1.3, t.s * 0.55, t.s, r() * 6), rockColor(r), {}));
  tile.rocks.forEach(t => B.add('k', kit.rockLod, kit.rockMat, mat4(t.x, t.y - t.s * 0.2, t.z, t.s, t.s * 0.7, t.s, r() * 6), t.moss ? 0x7b8456 : rockColor(r), {}));
  tile.bushes.forEach(t => B.add('b', kit.bushLod, kit.canopyMat, mat4(t.x, t.y + 0.1, t.z, 0.35, 0.25, 0.35, r() * 6), pick(r, BUSHC[t.k]), {}));
  B.build(grp);
  return grp;
}

export async function buildFarTiles(w, colorAt, kit, scene, progress) {
  const map = new Map(), list = w.tiles.filter(t => t.hmax > -6.5);
  for (let i = 0; i < list.length; i++) {
    const grp = buildFarTile(w, colorAt, kit, list[i]); scene.add(grp); map.set(list[i], grp);
    if (progress && i % 6 === 0) await progress('far tiles', i / list.length);
  }
  return map;
}

export function updateFarTiles(map, isVisible) { map.forEach((g, tile) => { g.visible = isVisible(tile); }); }
