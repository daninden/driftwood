/**
 * render/farTiles — a cheap version of every tile, always present.
 *
 * 40 × 40 grid, 128 px texture, low-poly crowns and rocks. These fill the
 * view wherever no detailed tile is ready yet, and everything beyond.
 *
 * buildFarTiles(world, colorAt, kit, scene, progress?, first?, onMake?) -> Promise<far>
 *   far: { map: Map<tile, Group>, rest: tiles still to build }
 *   Only the tiles for which first(tile) is true (those in view at the
 *   start) are built before the game starts (onMake(group) is called for every tile built, before it is added: islandView sets its shadow casting); the rest wait in far.rest.
 * pumpFarTiles(far, inView(tile), ms) -> number of tiles made; builds waiting tiles within about ms,
 *   tiles in view first, otherwise in order (nearest the start first)
 * updateFarTiles(far, isVisible(tile)) sets group visibility each frame. The crowns, rocks and bushes of a far tile live in the shared
 *   instanced pools of the scene (render/batch, 0.27.8) only while the tile is visible: they are made again (cheap, from the tile's own
 *   seed, so the same) when it comes into view and given back when it goes out of view; a hidden tile holds only its ground mesh.
 *
 * 0.31 "Axe": the crowns of felled trees (game/felled, through `felledOf(world)`) are left out when the tile is filled; render/islandView fills a visible tile again after a felling.
 *
 * Depends on: three, core/noise, core/slicer, render/*, game/felled (read only)
 */
import * as THREE from 'three';
import { mulberry32, hashInt, pick } from '../core/noise.js';
import { drain } from '../core/slicer.js';
import { P, BUSHC } from './palette.js';
import { terrainMat, outlineMat } from './materials.js';
import { Batch, poolsOf, releaseGroup } from './batch.js';
import { mat4 } from './geometry.js';
import { rockColor } from './props.js';
import { treeHeight, treeScale } from '../world/vegetation.js';
import { tileGeometry, tileTexture } from './terrainTile.js';
import { felledOf, treeId } from '../game/felled.js';

const NOTHING = { add() {} };

/** The crowns, rocks and bushes of a far tile into the pools of the scene, slots kept in grp.userData.slots. */
function fillFarTile(w, kit, tile, grp, pools) {
  const r = mulberry32(hashInt(w.seed + 9, tile.tx, tile.tz));
  const B = new Batch(outlineMat, pools), felled = felledOf(w);
  const into = (list, i) => felled && felled.has(treeId(tile, list, i)) ? NOTHING : B;   // a felled tree is not drawn, but its random numbers are used up all the same
  tile.trees.forEach((t, i) => { const k = t.jungle ? 'jungle' : 'tree', h = treeHeight(t, k), cs = (t.jungle ? 1.5 : 1.05) * Math.pow(treeScale(t, k), 0.7); into('trees', i).add('c', kit.canopyLod, kit.farCanopyMat, mat4(t.x, t.y + h + 0.2, t.z, cs, cs * 0.8, cs, r() * 6), new THREE.Color(pick(r, t.jungle ? P.jungle : P.canopy)).getHex(), { outline: 1.05 }); });
  tile.pines.forEach((t, i) => into('pines', i).add('p', kit.pineLod, kit.farCanopyMat, mat4(t.x, t.y + treeHeight(t, 'pine') * 0.6, t.z, 0.6 * Math.pow(treeScale(t, 'pine'), 0.6), treeHeight(t, 'pine') * 1.1, 0.6 * Math.pow(treeScale(t, 'pine'), 0.6), r() * 6), pick(r, P.pine), { outline: 1.06 }));
  tile.palms.forEach((t, i) => into('palms', i).add('pa', kit.canopyLod, kit.farCanopyMat, mat4(t.x, t.y + treeHeight(t, 'palm') * 0.93, t.z, 1.1 * Math.sqrt(treeScale(t, 'palm')), 0.35, 1.1 * Math.sqrt(treeScale(t, 'palm')), r() * 6), 0x7f9c48, {}));
  tile.crags.forEach(t => B.add('k', kit.rockLod, kit.rockMat, mat4(t.x, t.y - t.s * 0.35, t.z, t.s * 1.3, t.s * 0.55, t.s, r() * 6), rockColor(r), {}));
  tile.rocks.forEach(t => B.add('k', kit.rockLod, kit.rockMat, mat4(t.x, t.y - t.s * 0.2, t.z, t.s, t.s * 0.7, t.s, r() * 6), t.moss ? 0x7b8456 : rockColor(r), {}));
  tile.bushes.forEach(t => B.add('b', kit.bushLod, kit.farCanopyMat, mat4(t.x, t.y + 0.1, t.z, 0.35, 0.25, 0.35, r() * 6), pick(r, BUSHC[t.k]), {}));
  B.build(grp);
}

function buildFarTile(w, colorAt, kit, tile) {
  const grp = new THREE.Group();
  const mesh = new THREE.Mesh(drain(tileGeometry(w, tile, 40)), terrainMat(drain(tileTexture(w, colorAt, tile, 128))));
  mesh.receiveShadow = true; mesh.castShadow = true; mesh.userData.terrain = true; grp.add(mesh);
  return grp;
}

export async function buildFarTiles(w, colorAt, kit, scene, progress, first = () => true, onMake = () => {}) {
  const pools = poolsOf(scene), map = new Map(), all = w.tiles.filter(t => t.hmax > -6.5), now = all.filter(first), rest = all.filter(t => !first(t));
  const make = tile => { const grp = buildFarTile(w, colorAt, kit, tile); grp.userData.fill = () => fillFarTile(w, kit, tile, grp, pools); onMake(grp); scene.add(grp); map.set(tile, grp); };
  for (let i = 0; i < now.length; i++) {
    make(now[i]);
    if (progress && i % 6 === 0) await progress('far tiles', i / now.length);
  }
  return { map, rest, make };
}

export function pumpFarTiles(far, inView, ms) {
  const t0 = performance.now();
  let made = 0;
  while (far.rest.length && performance.now() - t0 < ms) {
    let i = far.rest.findIndex(inView); if (i < 0) i = 0;
    far.make(far.rest.splice(i, 1)[0]); made++;
  }
  return made;
}

export function updateFarTiles(far, isVisible) {
  far.map.forEach((g, tile) => {
    const want = isVisible(tile), has = !!g.userData.slots;
    if (want && !has) g.userData.fill(); else if (!want && has) releaseGroup(g);
    g.visible = want;
  });
}
