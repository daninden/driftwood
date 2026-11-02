/**
 * render/camera — the orthographic isometric camera that follows the player.
 *
 * Fixed angles (core/view). The camera eases towards the player; zoom eases
 * too. The player can zoom between MIN_ZOOM and MAX_ZOOM (it starts at
 * GAME_ZOOM); never closer, because a close camera shrinks the loneliness.
 * On the summits it zooms out a further 1.6x, up to SUMMIT_MAX, as a reward
 * for the climb.
 *
 * stepZoom(level, steps) -> the new zoom level after some zoom steps
 *   (positive = further away), clamped to MIN_ZOOM..MAX_ZOOM. Pure.
 * createCamera() -> { camera, follow(target, dt, onSummit), zoomBy(steps), zoom, pick(ndcX, ndcY, H) }
 *   pick returns the ground point under a screen position (normalised
 *   device coordinates), or null, by marching the view ray over the
 *   heightfield.
 *
 * Depends on: three, core/view
 */
import * as THREE from 'three';
import { PITCH, YAW } from '../core/view.js';

export const GAME_ZOOM = 7, MIN_ZOOM = 5, MAX_ZOOM = 10, SUMMIT_FACTOR = 1.6, SUMMIT_MAX = 14;
const R = 400, STEP = 1.1;

export const stepZoom = (level, steps) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, level * Math.pow(STEP, steps)));
export const summitZoom = level => Math.min(SUMMIT_MAX, level * SUMMIT_FACTOR);

export function createCamera() {
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 4000);
  const at = new THREE.Vector3(), goal = new THREE.Vector3();
  const state = { zoom: GAME_ZOOM, level: GAME_ZOOM, ready: false };

  function place() {
    const a = window.innerWidth / window.innerHeight, z = state.zoom;
    Object.assign(camera, { left: -z * a, right: z * a, top: z, bottom: -z }); camera.updateProjectionMatrix();
    camera.position.set(at.x + R * Math.cos(PITCH) * Math.sin(YAW), at.y + R * Math.sin(PITCH), at.z + R * Math.cos(PITCH) * Math.cos(YAW));
    camera.lookAt(at); camera.updateMatrixWorld();
  }

  function follow(target, dt, onSummit) {
    goal.set(target.x, target.y + 0.5, target.z);
    if (!state.ready) { at.copy(goal); state.ready = true; } else at.lerp(goal, Math.min(1, dt * 6));
    state.zoom += ((onSummit ? summitZoom(state.level) : state.level) - state.zoom) * Math.min(1, dt * 4);
    place();
  }

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(nx, ny, H) {
    ndc.set(nx, ny); ray.setFromCamera(ndc, camera);
    const o = ray.ray.origin, d = ray.ray.direction, ground = (x, z) => Math.max(H(x, z), -0.6);
    let prev = 0, hit = -1;
    for (let t = 0; t < 1600; t += 0.5) { if (o.y + d.y * t < ground(o.x + d.x * t, o.z + d.z * t)) { hit = t; break; } prev = t; }
    if (hit < 0) return null;
    let a = prev, b = hit;
    for (let k = 0; k < 18; k++) { const m = (a + b) / 2; if (o.y + d.y * m < ground(o.x + d.x * m, o.z + d.z * m)) b = m; else a = m; }
    return { x: o.x + d.x * b, z: o.z + d.z * b };
  }
  function zoomBy(steps) { if (steps) state.level = stepZoom(state.level, steps); }
  return { camera, follow, zoomBy, pick, get zoom() { return state.zoom; }, get target() { return at; } };
}
