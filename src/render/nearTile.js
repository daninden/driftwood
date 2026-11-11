/**
 * render/nearTile — the full-detail version of one tile.
 *
 * 160-cell ground with a 1024 px painted texture, detailed trees, palms,
 * rocks, roots and lianas, the tide line, and ground cover
 * (grass, ferns, reeds, pebbles, shells).
 *
 * Plants sway in the wind (0.19, render/wind): the near tile uses the swaying materials of the kit, the far tiles do not.
 *
 * The ground mesh is tagged userData.terrain, so render/stage can stop or start its shadows (render/quality).
 *
 * (The driftwood and coconuts that can be picked up are drawn by
 * render/driftwood and render/coconuts.)
 *
 * 0.31 "Axe": the trees of a tile are a group of their own (`group.userData.treeGroup`, its own Batch, drawn first so the tile's PRNG sequence is the same as ever) because
 * a felled tree (game/felled, found through `felledOf(world)`) leaves the tile without rebuilding the ground: `rebuildTrees(world, kit, tile, group, pools)` gives the tree
 * group's pool slots back and draws the standing trees again (and the flat cut marks of the felled ones). A felled tree still consumes its share of the PRNG, so every other tree
 * keeps its look. `treeParts(world, kit, tile, list, index)` -> Batch | null draws one tree again, alone, in a Batch of its own (own meshes, no pools): the falling tree of render/felling.
 *
 * buildNearTile(world, colorAt, kit, tile, slicer, anisotropy, pools?) — generator; returns { group, fv } (fv: the felled version the trees were drawn at)
 *   pools (0.27.8, render/batch poolsOf): the tile's trees, rocks and ground cover go into the shared instanced pools of the scene
 *   (the group then holds only the ground mesh); disposeGroup(group) gives the slots back. Without pools the group holds its own meshes.
 * disposeGroup(group) — releases the pool slots of a group and of its tree group (render/batch releaseGroup), disposes its own meshes, removes it
 *
 * Depends on: three, core/noise, render/*, game/felled (felledOf, treeId; read only)
 */
import * as THREE from 'three';
import { mulberry32, hashInt, pick } from '../core/noise.js';
import { T } from '../world/constants.js';
import { terrainMat, outlineMat } from './materials.js';
import { Batch, releaseGroup } from './batch.js';
import { mat4 } from './geometry.js';
import { tileGeometry, tileTexture } from './terrainTile.js';
import { addTree, addPine, addPalm, addBush, addRoots, addTideLine, rockColor } from './props.js';
import { addCutMarks } from './timber.js';
import { felledOf, treeId } from '../game/felled.js';

const GRASS = [[0xa9b062, 0x98a356], null, [0x6a8a3c, 0x7a9446], [0xb3ab6c, 0xa39d62, 0xbfb47a], [0xa8a272, 0x9a9468]];

export function* buildNearTile(w, colorAt, kit, tile, slicer, anisotropy, pools) {
  const own = [];   // what a cancelled build must dispose
  let finished = false;
  try {
    const group = yield* buildBody(w, colorAt, kit, tile, slicer, anisotropy, own, pools);
    finished = true; return { group, fv: group.userData.fv };
  } finally {
    if (!finished) own.forEach(d => d.dispose());
  }
}

function* buildBody(w, colorAt, kit, tile, slicer, anisotropy, own, pools) {
  const { H, Lat, slope, tierAt, riverAt, forestB, forestF } = w;
  const group = new THREE.Group(), B = new Batch(outlineMat, pools), BT = new Batch(outlineMat, pools);
  const geo = yield* tileGeometry(w, tile, 160, slicer); own.push(geo);
  const tex = yield* tileTexture(w, colorAt, tile, 1024, slicer, anisotropy); own.push(tex);
  const mesh = new THREE.Mesh(geo, terrainMat(tex)); own.push(mesh.material); mesh.receiveShadow = true; mesh.castShadow = true; mesh.userData.terrain = true; group.add(mesh);
  const r = mulberry32(hashInt(w.seed + 11, tile.tx, tile.tz));

  const felled = felledOf(w); group.userData.fv = felled ? felled.version : 0;
  yield* addTrees(w, kit, tile, r, BT, felled, slicer);
  const treeGroup = new THREE.Group(); BT.build(treeGroup); group.add(treeGroup); group.userData.treeGroup = treeGroup;
  tile.crags.forEach(t => B.add('crag', kit.rock, kit.rockMat, mat4(t.x, t.y - t.s * 0.35, t.z, t.s * 1.3, t.s * 0.55, t.s, r() * 6, (r() - 0.5) * 0.5, (r() - 0.5) * 0.5), rockColor(r), { outline: 1.06 }));
  tile.rocks.forEach(t => B.add('rock', kit.rock, kit.rockMat, mat4(t.x, t.y - t.s * 0.2, t.z, t.s, t.s * 0.7, t.s, r() * 6, r() * 0.4), t.moss ? pick(r, [0x7b8456, 0x6e7a4c, 0x87885c]) : rockColor(r), { outline: 1.08 }));
  for (const t of tile.roots) { addRoots(B, kit, w, t, r); if (slicer.over()) yield; }
  yield* addTideLine(B, kit, w, tile, r, slicer);
  tile.bushes.forEach(t => addBush(B, kit, t, r));

  // ground cover
  const n = 89;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = tile.x0 + (i + r()) * T / n, z = tile.z0 + (j + r()) * T / n, u = r(), v = r(), y = H(x, z), L = Lat(x, z);
      if (L < -0.1) continue;
      const k = tierAt(L), s = slope(x, z), rv = riverAt(x, z), wet = rv && rv.d < rv.hw + 0.15;
      if (rv && rv.d > rv.hw - 0.25 && rv.d < rv.hw + 0.9 && y < rv.lw + 0.45 && y > rv.lw - 0.25 && rv.lw > 0.1 && u < 0.5) { const sc = 0.8 + v * 0.6; B.add('reed', kit.reed, kit.grassMat, mat4(x, Math.max(y, rv.lw - 0.05), z, sc, sc, sc, v * 6), pick(r, [0x9a9a52, 0x8a8f4a, 0xb0a868, 0x7f8a44]), { cast: false }); continue; }
      if (wet || s > 0.9) continue;
      const F = forestF(k, forestB(x, z));
      if (k === 0 && y < 1.2 && y > -0.3) {
        if (u < 0.025) B.add('pebble', kit.pebble, kit.smallMat, mat4(x, y + 0.01, z, 0.04 + v * 0.05, 0.03, 0.05, v * 6), pick(r, [0x8e877c, 0xa59d90, 0x6f6a62, 0xb7ab96]), { cast: false });
        else if (u < 0.045 && y > 0.05) B.add('shell', kit.shell, kit.smallMat, mat4(x, y + 0.01, z, 0.04, 0.016, 0.05, v * 6), pick(r, [0xf6f0e4, 0xeedccd, 0xf2e2d0]), { cast: false });
        continue;
      }
      if (k === 2 && u < 0.3 * F + 0.06) { const sc = 0.8 + v * 0.7; B.add('fern', kit.fern, kit.fernMat, mat4(x, y, z, sc, sc, sc, v * 6), pick(r, [0x5c7a36, 0x4f6c30, 0x6a8a3c]), { cast: false }); continue; }
      const pg = [y > 0.9 ? 0.22 : 0, 0.5 - F * 0.35, 0.1, 0.5, 0.07][k];
      if (u < pg) { const sc = 0.6 + v * 0.5, cols = k === 1 ? (F > 0.4 ? [0x7f9446, 0x8a9a4c] : [0x98a356, 0x8e9c50, 0xa9b062]) : GRASS[k]; B.add('grass', kit.grass, kit.grassMat, mat4(x, y - 0.02, z, sc, sc * (0.75 + r() * 0.5), sc, v * 6), pick(r, cols), { cast: false }); }
    }
    if (slicer.over()) yield;
  }
  B.build(group);

  return group;
}

const NOTHING = { add() {} };   // where the trees that are felled are drawn: nowhere, but their random numbers are used up as before
const DRAW = { trees: (B, kit, t, r) => addTree(B, kit, t, r), pines: (B, kit, t, r) => addPine(B, kit, t, r), palms: (B, kit, t, r, tile) => addPalm(B, kit, t, r, tile.palms) };
const LISTS = ['trees', 'pines', 'palms'];

/** The trees of a tile (felled ones skipped, still drawing their random numbers) and the cut marks where they stood, into the batch B. A generator when a slicer is given. */
function* addTrees(w, kit, tile, r, B, felled, slicer) {
  for (const list of LISTS) {
    const trees = tile[list];
    for (let i = 0; i < trees.length; i++) {
      DRAW[list](felled && felled.has(treeId(tile, list, i)) ? NOTHING : B, kit, trees[i], r, tile);
      if (slicer && slicer.over()) yield;
    }
  }
  if (felled && felled.ids.size) addCutMarks(B, kit, w, tile, felled);
}

/** The trees of a tile drawn again after a felling: its tree group is replaced. */
export function rebuildTrees(w, kit, tile, group, pools) {
  const old = group.userData.treeGroup; if (old) disposeGroup(old);
  const r = mulberry32(hashInt(w.seed + 11, tile.tx, tile.tz)), BT = new Batch(outlineMat, pools), felled = felledOf(w);
  for (const _ of addTrees(w, kit, tile, r, BT, felled, null)) { /* no slicer: runs through */ }
  const treeGroup = new THREE.Group(); BT.build(treeGroup); group.add(treeGroup); group.userData.treeGroup = treeGroup; group.userData.fv = felled ? felled.version : 0;
}

/** One tree of a tile on its own, as it was drawn (a Batch of own meshes; the caller builds it into a group), or null for an index the tile has not got. Used by the falling tree. */
export function treeParts(w, kit, tile, list, index) {
  const r = mulberry32(hashInt(w.seed + 11, tile.tx, tile.tz)), scratch = new Batch(outlineMat, null), felled = felledOf(w);
  for (const name of LISTS) {
    const trees = tile[name];
    for (let i = 0; i < trees.length; i++) {
      if (name === list && i === index) {
        const mk = scratch.mark(); DRAW[name](scratch, kit, trees[i], r, tile);
        const out = new Batch(outlineMat, null);
        for (const [key, a, b] of scratch.since(mk)) { const e = scratch.map.get(key); for (const it of e.list.slice(a, b)) out.add(key, e.geo, e.mat, it.m, it.c, e.opts, it.aw); }
        return out;
      }
      DRAW[name](felled && felled.has(treeId(tile, name, i)) ? NOTHING : scratch, kit, trees[i], r, tile);
    }
  }
  return null;
}

export function disposeGroup(group) {
  group.traverse(o => { if (o.userData && o.userData.slots) releaseGroup(o); });
  group.traverse(o => {
    if (o.isInstancedMesh) { o.dispose(); if (o.userData.ownGeometry) o.geometry.dispose(); }
    else if (o.isMesh) { o.geometry.dispose(); if (!o.material.userData.shared) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }   // a shared material (userData.shared) outlives the group
  });
  if (group.parent) group.parent.remove(group);
}
