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
 * buildNearTile(world, colorAt, kit, tile, slicer) — generator; returns { group }
 *
 * Depends on: three, core/noise, render/*
 */
import * as THREE from 'three';
import { mulberry32, hashInt, pick } from '../core/noise.js';
import { T } from '../world/constants.js';
import { terrainMat, outlineMat } from './materials.js';
import { Batch } from './batch.js';
import { mat4 } from './geometry.js';
import { tileGeometry, tileTexture } from './terrainTile.js';
import { addTree, addPine, addPalm, addBush, addRoots, addTideLine, rockColor } from './props.js';

const GRASS = [[0xa9b062, 0x98a356], null, [0x6a8a3c, 0x7a9446], [0xb3ab6c, 0xa39d62, 0xbfb47a], [0xa8a272, 0x9a9468]];

export function* buildNearTile(w, colorAt, kit, tile, slicer, anisotropy) {
  const own = [];   // what a cancelled build must dispose
  let finished = false;
  try {
    const group = yield* buildBody(w, colorAt, kit, tile, slicer, anisotropy, own);
    finished = true; return { group };
  } finally {
    if (!finished) own.forEach(d => d.dispose());
  }
}

function* buildBody(w, colorAt, kit, tile, slicer, anisotropy, own) {
  const { H, Lat, slope, tierAt, riverAt, forestB, forestF } = w;
  const group = new THREE.Group(), B = new Batch(outlineMat);
  const geo = yield* tileGeometry(w, tile, 160, slicer); own.push(geo);
  const tex = yield* tileTexture(w, colorAt, tile, 1024, slicer, anisotropy); own.push(tex);
  const mesh = new THREE.Mesh(geo, terrainMat(tex)); own.push(mesh.material); mesh.receiveShadow = true; mesh.castShadow = true; mesh.userData.terrain = true; group.add(mesh);
  const r = mulberry32(hashInt(w.seed + 11, tile.tx, tile.tz));

  for (const t of tile.trees) { addTree(B, kit, t, r); if (slicer.over()) yield; }
  for (const t of tile.pines) { addPine(B, kit, t, r); if (slicer.over()) yield; }
  for (const t of tile.palms) { addPalm(B, kit, t, r, tile.palms); if (slicer.over()) yield; }
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

export function disposeGroup(group) {
  group.traverse(o => {
    if (o.isInstancedMesh) { o.dispose(); if (o.userData.ownGeometry) o.geometry.dispose(); }
    else if (o.isMesh) { o.geometry.dispose(); if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
  });
  if (group.parent) group.parent.remove(group);
}
