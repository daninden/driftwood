/**
 * render/stage — renderer, scene and the two lights.
 *
 * A hemisphere sky fill plus one directional light (the sun by day, the
 * moon by night) with a 2048 px shadow map. Where that light stands, and its
 * colour, come from render/sky; it stands still in the world while you turn
 * the view, so shadows stay on the ground. The shadow camera follows the
 * view and is snapped to shadow texels so shadows do not shimmer while
 * walking.
 *
 * createStage(container) -> { renderer, scene, hemi, sun, resize(), followSun(target, half, dir) }
 *   dir: unit vector { x, y, z } towards the light
 *
 * Depends on: three
 */
import * as THREE from 'three';

export function createStage(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const hemi = new THREE.HemisphereLight(0xe2ebf0, 0x8a7458, 0.6); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe6c4, 1.0);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
  scene.add(sun); scene.add(sun.target);

  function resize() { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); renderer.setSize(window.innerWidth, window.innerHeight); }
  resize();

  const st = new THREE.Vector3(), dir = new THREE.Vector3();
  function followSun(target, half, d) {
    dir.set(d.x, d.y, d.z).normalize();
    const texel = half * 2 / sun.shadow.mapSize.x;
    st.set(Math.round(target.x / texel) * texel, target.y, Math.round(target.z / texel) * texel);
    sun.target.position.copy(st); const dist = half * 3 + 200;   // far enough that a low light still stands above the summits
    sun.position.copy(st).addScaledVector(dir, dist); sun.target.updateMatrixWorld();
    Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 1, far: dist * 2 + half * 2 });
    sun.shadow.camera.updateProjectionMatrix();
  }
  return { renderer, scene, hemi, sun, resize, followSun };
}
