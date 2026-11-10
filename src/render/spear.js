/**
 * render/spear — the fishing spear (0.30.17 "Spear"): a straight pole with a leaf-shaped stone head, lashed on.
 *
 * makeSpear() -> Group   a spear with its grip at the origin, standing along +y (the pole runs from -0.55 to +1.35 m, the head on top); render/hero holds one in his hand
 * createSpearView(scene, spear, H) -> { update() }   draws the spear that lies on the ground (game/spear `at`): flat on the ground, turned by its place; nothing while it is in his hand or does not exist
 *
 * Depends on: three, render/materials, render/palette
 */
import * as THREE from 'three';
import { toon, outlineMat } from './materials.js';
import { HERO, STONE } from './palette.js';

const poleGeo = new THREE.CylinderGeometry(0.016, 0.02, 1.9, 6), headGeo = new THREE.ConeGeometry(0.045, 0.2, 4);
const poleMat = toon(HERO.staff), headMat = toon(STONE[2]), lashMat = toon(0x5a4631);

export function makeSpear() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(poleGeo, poleMat); pole.position.y = 0.4; pole.castShadow = true;
  const o = new THREE.Mesh(poleGeo, outlineMat); o.scale.set(1.5, 1.01, 1.5); pole.add(o); g.add(pole);
  const head = new THREE.Mesh(headGeo, headMat); head.position.y = 1.45; head.scale.set(1, 1, 0.45); head.castShadow = true;
  const ho = new THREE.Mesh(headGeo, outlineMat); ho.scale.set(1.3, 1.08, 1.3); head.add(ho); g.add(head);
  const lash = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.05, 6), lashMat); lash.position.y = 1.33; g.add(lash);
  return g;
}

export function createSpearView(scene, spear, H) {
  const g = makeSpear(); g.visible = false; scene.add(g);
  let at = null;
  return {
    update() {
      const a = spear.at;
      if (!a) { g.visible = false; at = null; return; }
      if (at !== a) {   // laid somewhere new: flat on the ground, along a direction fixed by its place
        at = a; const yaw = (Math.sin(a.x * 12.9898 + a.z * 78.233) * 43758.5453 % 1) * Math.PI;
        g.position.set(a.x, H(a.x, a.z) + 0.05, a.z); g.rotation.set(Math.PI / 2, 0, 0); g.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), yaw);
      }
      g.visible = true;
    },
  };
}
