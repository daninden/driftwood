/**
 * render/axe — the stone axe (0.31 "Axe"): a short wooden haft with a flat stone blade lashed on, in the toon style with the dark outline.
 *
 * makeAxe() -> Group   an axe with its grip at the origin, the haft standing along +y (from -0.1 to +0.62 m) and the blade at the top reaching out along +z (the edge forward, away from the
 *   haft); render/hero holds one in his right hand in place of the staff (head up when he walks, along his arm when he chops)
 * createAxeView(scene, axe, H) -> { update() }   draws the axe that lies on the ground (game/axe `at`): flat on the ground, turned by its place, the blade to one side;
 *   nothing while it is in his hand or does not exist
 *
 * Depends on: three, render/materials, render/palette
 */
import * as THREE from 'three';
import { toon, outlineMat } from './materials.js';
import { TIMBER } from './palette.js';

const hafGeo = new THREE.CylinderGeometry(0.017, 0.021, 0.72, 6), lashGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.045, 6), bladeGeo = new THREE.ConeGeometry(0.075, 0.2, 3);
const hafMat = toon(TIMBER.axeShaft), headMat = toon(TIMBER.axeHead), lashMat = toon(TIMBER.lash);

export function makeAxe() {
  const g = new THREE.Group();
  const haf = new THREE.Mesh(hafGeo, hafMat); haf.position.y = 0.26; haf.castShadow = true;
  const o = new THREE.Mesh(hafGeo, outlineMat); o.scale.set(1.5, 1.01, 1.5); haf.add(o); g.add(haf);
  const blade = new THREE.Mesh(bladeGeo, headMat); blade.rotation.set(Math.PI / 2, 0, 0); blade.scale.set(0.45, 1, 1); blade.position.set(0, 0.57, 0.085); blade.castShadow = true;   // a flat wedge: the edge forward (+z)
  const bo = new THREE.Mesh(bladeGeo, outlineMat); bo.scale.set(1.25, 1.07, 1.25); blade.add(bo); g.add(blade);
  const lash = new THREE.Mesh(lashGeo, lashMat); lash.position.y = 0.565; g.add(lash);
  return g;
}

export function createAxeView(scene, axe, H) {
  const g = makeAxe(); g.visible = false; scene.add(g);
  let at = null;
  return {
    update() {
      const a = axe.at;
      if (!a) { g.visible = false; at = null; return; }
      if (at !== a) {   // laid somewhere new: flat on the ground, along a direction fixed by its place
        at = a; const yaw = (Math.sin(a.x * 12.9898 + a.z * 78.233) * 43758.5453 % 1) * Math.PI;
        g.position.set(a.x, H(a.x, a.z) + 0.05, a.z); g.rotation.set(Math.PI / 2, 0, 0); g.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), yaw);
      }
      g.visible = true;
    },
  };
}
