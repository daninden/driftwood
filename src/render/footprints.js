/**
 * render/footprints — prints left in the sand as you walk.
 *
 * At most MAX prints (about 17 m of trail) are kept; the oldest FADE of
 * them fade out gradually, so the trail thins out behind you instead of
 * staying for ever. A ring buffer of flat instanced ovals with a per-print
 * opacity.
 *
 * createFootprints(scene, H) -> { step(player, distance, onSand), wash(sea) }
 *   Call step every frame with the distance walked; drops a print every 0.21
 *   units, alternating left and right foot. wash(sea) wipes out the prints
 *   the rising tide has covered (on the wet sand of low water).
 * printAlpha(age) -> opacity of the print `age` steps old (0 = newest), pure
 * MAX, FADE
 *
 * Depends on: three, render/palette, render/geometry
 */
import * as THREE from 'three';
import { P } from './palette.js';
import { mat4 } from './geometry.js';

export const MAX = 80, FADE = 24;
const SPACING = 0.21, OPACITY = 0.75;

export const printAlpha = age => age >= MAX ? 0 : OPACITY * Math.min(1, (MAX - age) / FADE);

export function createFootprints(scene, H) {
  const geo = new THREE.CircleGeometry(1, 8).rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(P.wet).multiplyScalar(0.78), transparent: true, depthWrite: false });
  mat.onBeforeCompile = sh => {
    sh.vertexShader = 'attribute float aFade;\nvarying float vFade;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvFade = aFade;');
    sh.fragmentShader = 'varying float vFade;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vFade;');
  };
  const fade = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1); geo.setAttribute('aFade', fade);
  const im = new THREE.InstancedMesh(geo, mat, MAX); im.frustumCulled = false; im.renderOrder = 6;
  const zero = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < MAX; i++) im.setMatrixAt(i, zero);
  scene.add(im);
  let next = 0, side = 1, acc = 0, count = 0;
  const ys = new Float32Array(MAX), gone = new Uint8Array(MAX);
  function step(p, distance, onSand) {
    if (!onSand) { acc = 0; return; }
    acc += distance; if (acc < SPACING) return; acc = 0;
    const px = p.x + Math.cos(p.heading) * 0.05 * side, pz = p.z - Math.sin(p.heading) * 0.05 * side;
    const y = H(px, pz); ys[next] = y; gone[next] = 0;
    im.setMatrixAt(next, mat4(px, y + 0.012, pz, 0.028, 1, 0.06, p.heading)); im.instanceMatrix.needsUpdate = true;
    count = Math.min(MAX, count + 1);
    for (let age = 0; age < count; age++) { const i = (next - age + MAX) % MAX; fade.array[i] = gone[i] ? 0 : printAlpha(age); }
    fade.needsUpdate = true;
    next = (next + 1) % MAX; side = -side;
  }
  function wash(sea) {
    let any = false;
    for (let i = 0; i < MAX; i++) if (!gone[i] && fade.array[i] > 0 && ys[i] < sea) { gone[i] = 1; fade.array[i] = 0; any = true; }
    if (any) fade.needsUpdate = true;
  }
  return { step, wash };
}
