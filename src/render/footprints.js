/**
 * render/footprints — prints left in the sand as you walk.
 *
 * A ring buffer of 500 flat instanced ovals; the oldest print is reused.
 *
 * createFootprints(scene, H) -> { step(player, distance, onSand) }
 *   Call every frame with the distance walked; drops a print every 0.21
 *   units, alternating left and right foot.
 *
 * Depends on: three, render/palette, render/geometry
 */
import * as THREE from 'three';
import { P } from './palette.js';
import { mat4 } from './geometry.js';

const N = 500, SPACING = 0.21;

export function createFootprints(scene, H) {
  const geo = new THREE.CircleGeometry(1, 8).rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(P.wet).multiplyScalar(0.78), transparent: true, opacity: 0.75, depthWrite: false });
  const im = new THREE.InstancedMesh(geo, mat, N); im.frustumCulled = false; im.renderOrder = 6;
  const zero = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < N; i++) im.setMatrixAt(i, zero);
  scene.add(im);
  let next = 0, side = 1, acc = 0;
  function step(p, distance, onSand) {
    if (!onSand) { acc = 0; return; }
    acc += distance; if (acc < SPACING) return; acc = 0;
    const px = p.x + Math.cos(p.heading) * 0.05 * side, pz = p.z - Math.sin(p.heading) * 0.05 * side;
    im.setMatrixAt(next, mat4(px, H(px, pz) + 0.012, pz, 0.028, 1, 0.06, p.heading)); im.instanceMatrix.needsUpdate = true;
    next = (next + 1) % N; side = -side;
  }
  return { step };
}
