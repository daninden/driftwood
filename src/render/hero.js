/**
 * render/hero — the castaway: a small blocky figure with a straw hat and
 * a staff, outlined like everything else, with hips and shoulders so the
 * legs and arms can swing while walking.
 *
 * createHero(scene) -> { group, update(player, wadeDepth) }
 *   update copies position and heading from the player state
 *   (game/movement) and animates the walk cycle from player.phase.
 *
 * Depends on: three, render/materials
 */
import * as THREE from 'three';
import { toon, outlineMat } from './materials.js';

export function createHero(scene) {
  const group = new THREE.Group(), body = new THREE.Group(); group.add(body); body.scale.setScalar(0.62);
  const shirt = toon(0xf1ece0), trousers = toon(0x5b4a36), skin = toon(0xd6a07c), hair = toon(0x4a3222), hatM = toon(0xc9b07a);
  const part = (parent, geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); const o = new THREE.Mesh(geo, outlineMat); o.scale.setScalar(1.12); m.add(o); return m; };
  const joint = (x, y, z) => { const j = new THREE.Group(); j.position.set(x, y, z); body.add(j); return j; };
  const hipL = joint(-0.08, 0.48, 0), hipR = joint(0.08, 0.48, 0), shL = joint(-0.21, 0.88, 0), shR = joint(0.21, 0.88, 0), torso = joint(0, 0, 0);
  part(hipL, new THREE.BoxGeometry(0.12, 0.48, 0.13), trousers, 0, -0.24, 0); part(hipR, new THREE.BoxGeometry(0.12, 0.48, 0.13), trousers, 0, -0.24, 0);
  part(shL, new THREE.BoxGeometry(0.09, 0.42, 0.09), shirt, 0, -0.2, 0); part(shR, new THREE.BoxGeometry(0.09, 0.42, 0.09), shirt, 0, -0.2, 0);
  part(torso, new THREE.BoxGeometry(0.33, 0.44, 0.2), shirt, 0, 0.7, 0);
  part(torso, new THREE.SphereGeometry(0.12, 14, 10), skin, 0, 1.04, 0);
  const hr = new THREE.Mesh(new THREE.SphereGeometry(0.126, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hair); hr.position.set(0, 1.055, -0.01); torso.add(hr);
  part(torso, new THREE.CylinderGeometry(0.24, 0.24, 0.025, 18), hatM, 0, 1.13, 0);
  part(torso, new THREE.CylinderGeometry(0.12, 0.14, 0.13, 16), hatM, 0, 1.2, 0);
  part(shR, new THREE.CylinderGeometry(0.018, 0.022, 1.35, 6), toon(0x7a5a3a), 0.06, -0.3, 0.1);
  scene.add(group);

  function update(p, wade = 0) {
    group.position.set(p.x, p.y - Math.min(0.35, wade * 0.6), p.z); group.rotation.y = p.heading;
    const sw = p.moving ? Math.sin(p.phase) * Math.min(0.75, 0.3 + p.speed * 0.1) : 0;
    hipL.rotation.x += (sw - hipL.rotation.x) * 0.4; hipR.rotation.x += (-sw - hipR.rotation.x) * 0.4;
    shL.rotation.x += (-sw * 0.8 - shL.rotation.x) * 0.4; shR.rotation.x += (sw * 0.5 - 0.15 - shR.rotation.x) * 0.4;
    body.position.y = p.moving ? Math.abs(Math.cos(p.phase)) * 0.03 : 0;
  }
  return { group, update };
}
