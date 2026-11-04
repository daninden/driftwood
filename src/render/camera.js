/**
 * render/camera — the orthographic isometric camera that follows the player.
 *
 * The camera eases towards the player; zoom and view angles ease too, so
 * turning starts and stops softly. The player can turn the view freely
 * around and tilt it between PITCH_MIN and PITCH_MAX (core/view). The player can zoom between MIN_ZOOM and MAX_ZOOM (it starts at
 * GAME_ZOOM); never closer, because a close camera shrinks the loneliness.
 * On the summits it zooms out a further 1.6x, up to SUMMIT_MAX, as a reward
 * for the climb.
 *
 * stepZoom(level, steps, max?) -> the new zoom level after some zoom steps
 *   (positive = further away), clamped to MIN_ZOOM..max (default MAX_ZOOM). Pure.
 * setZoomMax(max) sets the furthest zoom (main: core/view `zoomMax`, 25 while
 *   the dev panel is visible, else 10); a level beyond it eases back to it.
 * turnView(angles, turn) -> new { yaw, pitch } after a turn { yaw, pitch }
 *   (radians), with the pitch clamped to PITCH_MIN..PITCH_MAX. Pure.
 * createCamera() -> { camera, follow(target, dt, onSummit), zoomBy(steps),
 *   turn({ yaw, pitch }), pose, setPose(pose), setZoomMax(max), zoom, yaw, pitch, target, settling, pick(ndcX, ndcY, H) }
 *   pose is the view the player has chosen, { yaw, tilt, zoom } (the goals
 *   the camera eases towards, the turn wrapped into 0..2π, the zoom the player's
 *   level without the summit's extra), for the save (0.10). setPose(pose) puts
 *   the camera straight into such a pose, clamped, without easing (start-up).
 *   settling is true while position, zoom and angles are still easing towards
 *   their goals (main uses it to tell a quiet scene from a moving one).
 *   yaw and pitch are the current (eased) angles, for everything else that
 *   depends on the view.
 *   pick returns the ground point under a screen position (normalised
 *   device coordinates), or null, by marching the view ray over the
 *   heightfield.
 *
 * depthRange(dist?, zoomMax?, pitchMin?) -> { near, far }   pure: the camera's depth range for its distance (0.22.2: 30 to 760 instead of 1 to 4000, so a 16-bit depth buffer resolves 1 cm, not 6)
 * Depends on: three, core/view
 */
import * as THREE from 'three';
import { PITCH, YAW, PITCH_MIN, PITCH_MAX, ZOOM_START, ZOOM_MIN, ZOOM_MAX, ZOOM_DEV_MAX, clampView } from '../core/view.js';

export const GAME_ZOOM = ZOOM_START, MIN_ZOOM = ZOOM_MIN, MAX_ZOOM = ZOOM_MAX, SUMMIT_FACTOR = 1.6, SUMMIT_MAX = 14;
const R = 400, STEP = 1.1;
// The depth range (0.22.2). Anything seen along a view ray lies between the lowest bed and the tallest thing above the summit; with the
// widest view (ZOOM_DEV_MAX, a summit does not add to the dev zoom) and the flattest tilt that stretches it along the ray by (height range) / sin(tilt).
// A range of 1 to 4000 gave a 16-bit depth buffer a step of 6 cm: shallow fish and layered fronds flickered or vanished on some phones.
export const WORLD_Y = { low: -40, high: 100 }, TARGET_Y = { low: -5, high: 60 }, DEPTH_MARGIN = 60;   // metres: the world (bed, birds over the summit), where the camera may look at
/** The camera's near and far for a camera R from its target: { near, far } enclosing every visible point of the world, with a margin; pure. */
export function depthRange(dist = R, zoomMax = ZOOM_DEV_MAX, pitchMin = PITCH_MIN) {
  const sin = Math.sin(pitchMin), cos = Math.cos(pitchMin);
  const nearest = (zoomMax * cos + WORLD_Y.high - TARGET_Y.low) / sin, furthest = (zoomMax * cos + TARGET_Y.high - WORLD_Y.low) / sin;
  return { near: Math.max(1, Math.floor((dist - nearest - DEPTH_MARGIN) / 10) * 10), far: Math.ceil((dist + furthest + DEPTH_MARGIN) / 10) * 10 };
}

export const stepZoom = (level, steps, max = MAX_ZOOM) => Math.min(max, Math.max(MIN_ZOOM, level * Math.pow(STEP, steps)));
export const summitZoom = level => Math.min(SUMMIT_MAX, level * SUMMIT_FACTOR);
export const turnView = (a, t) => ({ yaw: a.yaw + t.yaw, pitch: Math.min(PITCH_MAX, Math.max(PITCH_MIN, a.pitch + t.pitch)) });

export function createCamera() {
  const depth = depthRange(), camera = new THREE.OrthographicCamera(-1, 1, 1, -1, depth.near, depth.far);
  const at = new THREE.Vector3(), goal = new THREE.Vector3();
  const state = { zoom: GAME_ZOOM, level: GAME_ZOOM, yaw: YAW, pitch: PITCH, ready: false, zoomGoal: GAME_ZOOM };
  let aim = { yaw: YAW, pitch: PITCH }, limit = MAX_ZOOM;

  function place() {
    const a = window.innerWidth / window.innerHeight, z = state.zoom;
    Object.assign(camera, { left: -z * a, right: z * a, top: z, bottom: -z }); camera.updateProjectionMatrix();
    const { yaw, pitch } = state;
    camera.position.set(at.x + R * Math.cos(pitch) * Math.sin(yaw), at.y + R * Math.sin(pitch), at.z + R * Math.cos(pitch) * Math.cos(yaw));
    camera.lookAt(at); camera.updateMatrixWorld();
  }

  function follow(target, dt, onSummit) {
    goal.set(target.x, target.y + 0.5, target.z);
    if (!state.ready) { at.copy(goal); state.ready = true; } else at.lerp(goal, Math.min(1, dt * 6));
    state.zoomGoal = onSummit ? Math.max(state.level, summitZoom(state.level)) : state.level;
    state.zoom += (state.zoomGoal - state.zoom) * Math.min(1, dt * 4);
    const k = Math.min(1, dt * 6); state.yaw += (aim.yaw - state.yaw) * k; state.pitch += (aim.pitch - state.pitch) * k;
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
  function zoomBy(steps) { if (steps) state.level = stepZoom(state.level, steps, limit); }
  function setZoomMax(max) { limit = Math.max(MAX_ZOOM, max); state.level = Math.min(state.level, limit); }
  function turn(t) { if (t && (t.yaw || t.pitch)) aim = turnView(aim, t); }
  const pose = () => clampView({ yaw: aim.yaw, tilt: aim.pitch, zoom: state.level }, limit);
  function setPose(p) {
    const v = clampView(p, limit); if (!v) return;
    aim = { yaw: v.yaw, pitch: v.tilt }; state.yaw = v.yaw; state.pitch = v.tilt; state.level = v.zoom; state.zoom = v.zoom; state.zoomGoal = v.zoom;
  }
  /** True while the position, zoom or angles are still easing towards where they are going (or a new goal is set). */
  const settling = () => at.distanceToSquared(goal) > 1e-5 || Math.abs(state.zoomGoal - state.zoom) > 1e-3 || Math.abs(aim.yaw - state.yaw) > 1e-4 || Math.abs(aim.pitch - state.pitch) > 1e-4;
  return { camera, follow, zoomBy, turn, pick, setPose, setZoomMax, get pose() { return pose(); }, get settling() { return settling(); }, get yaw() { return state.yaw; }, get pitch() { return state.pitch; }, get zoom() { return state.zoom; }, get target() { return at; } };
}
