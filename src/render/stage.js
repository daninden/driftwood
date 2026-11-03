/**
 * render/stage — renderer, scene and the two lights.
 *
 * A hemisphere sky fill plus one directional light (the sun by day, the
 * moon by night) with a 2048 px shadow map. Where that light stands, and its
 * colour, come from render/sky; it stands still in the world while you turn
 * the view, so shadows stay on the ground. The shadow camera follows the
 * view and is snapped to shadow texels, in light space (along the light's own
 * right and up axes, see snapToTexels), so shadows do not shimmer while
 * walking; render/sky holds the light direction still between small steps so
 * that grid stays put. The depth bias is set in metres (BIAS), not as a fraction of the
 * shadow camera depth, so shadows start right at the foot of a trunk or
 * the castaway instead of a few decimetres away.
 *
 * createStage(container) -> { renderer, scene, hemi, sun, resize(), followSun(target, half, dir) }
 * snapToTexels(p, dir, texel) -> { x, y, z }: p moved onto the texel grid of a light shining along dir
 * shadowBias(far) -> depth bias worth BIAS metres for a shadow camera reaching to far
 *   dir: unit vector { x, y, z } towards the light
 *
 * Depends on: three
 */
import * as THREE from 'three';

export const BIAS = 0.04;   // metres along the light
/** Depth bias for a shadow camera from near 1 to `far`: always BIAS metres. */
export const shadowBias = far => -BIAS / (far - 1);
/** Snap p to the shadow texel grid of a light standing in direction `dir` (unit, towards the light):
 *  round its coordinates across the light (right, up) to whole texels, keep the one along it. */
export function snapToTexels(p, dir, texel) {
  let rx = dir.z, rz = -dir.x; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;   // up (0,1,0) x dir, normalised: the shadow camera's right
  const ux = dir.y * rz, uy = dir.z * rx - dir.x * rz, uz = -dir.y * rx;                 // dir x right: its up
  const a = p.x * rx + p.z * rz, b = p.x * ux + p.y * uy + p.z * uz, c = p.x * dir.x + p.y * dir.y + p.z * dir.z;
  const sa = Math.round(a / texel) * texel, sb = Math.round(b / texel) * texel;
  return { x: sa * rx + sb * ux + c * dir.x, y: sb * uy + c * dir.y, z: sa * rz + sb * uz + c * dir.z };
}

export function createStage(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const hemi = new THREE.HemisphereLight(0xe2ebf0, 0x8a7458, 0.6); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe6c4, 1.0);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.normalBias = 0.03;
  scene.add(sun); scene.add(sun.target);

  function resize() { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); renderer.setSize(window.innerWidth, window.innerHeight); }
  resize();

  const st = new THREE.Vector3(), dir = new THREE.Vector3();
  function followSun(target, half, d) {
    dir.set(d.x, d.y, d.z).normalize();
    const texel = half * 2 / sun.shadow.mapSize.x;
    const q = snapToTexels(target, dir, texel); st.set(q.x, q.y, q.z);
    sun.target.position.copy(st); const dist = half * 3 + 200;   // far enough that a low light still stands above the summits
    sun.position.copy(st).addScaledVector(dir, dist); sun.target.updateMatrixWorld();
    const far = dist * 2 + half * 2;
    Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 1, far });
    sun.shadow.bias = shadowBias(far);
    sun.shadow.camera.updateProjectionMatrix();
  }
  return { renderer, scene, hemi, sun, resize, followSun };
}
