/**
 * render/stage — renderer, scene and the two lights.
 *
 * A warm hemisphere light plus one directional sun with a 2048 px shadow
 * map. The sun stands about 30° towards the camera so walls facing the
 * viewer catch light. The shadow camera follows the view and is snapped to
 * shadow texels so shadows do not shimmer while walking.
 *
 * createStage(container) -> { renderer, scene, hemi, sun, SUNDIR, resize(), followSun(target, half) }
 *
 * Depends on: three
 */
import * as THREE from 'three';

const SUNEL = 0.68, SUNAZ = -0.15;
export const SUNDIR = new THREE.Vector3(Math.sin(SUNAZ) * Math.cos(SUNEL), Math.sin(SUNEL), Math.cos(SUNAZ) * Math.cos(SUNEL)).normalize();

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

  const st = new THREE.Vector3();
  function followSun(target, half) {
    const texel = half * 2 / sun.shadow.mapSize.x;
    st.set(Math.round(target.x / texel) * texel, target.y, Math.round(target.z / texel) * texel);
    sun.target.position.copy(st); sun.position.copy(st).addScaledVector(SUNDIR, half * 3 + 60); sun.target.updateMatrixWorld();
    Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 1, far: half * 6 + 200 });
    sun.shadow.camera.updateProjectionMatrix();
  }
  return { renderer, scene, hemi, sun, resize, followSun };
}
