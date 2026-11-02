/**
 * render/ghosts — tree crowns between the camera and the castaway turn
 * see-through, so you never lose the little figure in the forest.
 *
 * occludes(tree, player, yaw?, pitch?) -> boolean   pure: does this crown
 *   cover the player on screen, for the given view angles (core/view)?
 *   tree: { x, z, cy (crown centre height), R (crown radius) }
 * createGhosts(scene, kit) -> { update(trees, player, yaw?, pitch?), forget(trees) }
 *   Hides the solid instances of occluding trees (scale 0) and draws them
 *   instead in shared transparent InstancedMeshes.
 *
 * Depends on: three, core/view, render/materials
 */
import * as THREE from 'three';
import { YAW, PITCH, toView, screenUp } from '../core/view.js';
import { ghostMat } from './materials.js';

export function occludes(tr, p, yaw = YAW, pitch = PITCH) {
  const v = toView(tr.x - p.x, tr.z - p.z, yaw), u = screenUp(tr.cy - p.y - 0.45, v.dc, pitch);
  return v.dc > 0.15 && Math.abs(v.dr) < tr.R + 0.35 && Math.abs(u) < tr.R * 0.95 + 0.6;
}

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export function createGhosts(scene, kit) {
  const layer = (geo, n) => { const im = new THREE.InstancedMesh(geo, ghostMat, n); im.setColorAt(0, new THREE.Color(1, 1, 1)); im.count = 0; im.frustumCulled = false; im.renderOrder = 5; im.castShadow = false; scene.add(im); return im; };
  const layers = { trunk: layer(kit.trunk, 300), canopy: layer(kit.canopy, 900), pine: layer(kit.pine, 400) };
  let shown = new Set();
  const col = new THREE.Color();

  function setHidden(tr, hide) {
    for (const p of tr.parts) {
      const { im, ol, list, olM } = p.entry; if (!im) continue;
      for (let i = p.a; i < p.b; i++) { im.setMatrixAt(i, hide ? ZERO : list[i].m); if (ol) ol.setMatrixAt(i, hide ? ZERO : olM[i]); }
      im.instanceMatrix.needsUpdate = true; if (ol) ol.instanceMatrix.needsUpdate = true;
    }
  }

  /** trees: iterable of tree records near the player (render/nearTile). */
  function update(trees, p, yaw = YAW, pitch = PITCH) {
    const want = new Set();
    for (const tr of trees) { if (Math.abs(tr.x - p.x) > 16 || Math.abs(tr.z - p.z) > 16) continue; if (occludes(tr, p, yaw, pitch)) want.add(tr); }
    shown.forEach(tr => { if (!want.has(tr)) setHidden(tr, false); });
    want.forEach(tr => { if (!shown.has(tr)) setHidden(tr, true); });
    shown = want;
    const cnt = { trunk: 0, canopy: 0, pine: 0 };
    want.forEach(tr => tr.parts.forEach(pt => {
      const L = layers[pt.key]; if (!L) return;
      for (let i = pt.a; i < pt.b && cnt[pt.key] < L.instanceMatrix.count; i++) { L.setMatrixAt(cnt[pt.key], pt.entry.list[i].m); L.setColorAt(cnt[pt.key], col.setHex(pt.entry.list[i].c)); cnt[pt.key]++; }
    }));
    for (const k in layers) { layers[k].count = cnt[k]; layers[k].instanceMatrix.needsUpdate = true; if (layers[k].instanceColor) layers[k].instanceColor.needsUpdate = true; }
  }
  /** Forget trees of a tile that is being removed. */
  function forget(trees) { for (const tr of trees) shown.delete(tr); }
  return { update, forget };
}
