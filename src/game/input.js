/**
 * game/input — keyboard and pointer to a movement input, plus the view
 * controls (zoom, turn, tilt) that main hands on to the view.
 *
 *   W A S D / arrow keys   walk (relative to the screen)
 *   Shift                  run
 *   click or tap           walk to that spot (touch: drag to steer); on a piece
 *                          of driftwood or a pile: walk there and pick it up;
 *                          on the castaway: lay down what is carried (the
 *                          game decides, see game/game)
 *   hold on the castaway   (about HOLD_MS, finger or mouse) lie down to sleep
 *   Z                      lie down to sleep
 *   hold anywhere else     (about HOLD_MS) on a pile: light it (the game decides)
 *   F                      light the pile at the castaway's feet
 *   left click, tap, WASD  while asleep: wake up (the game decides); turning,
 *                          tilting or zooming the view does not wake him
 *   double tap             run to that spot (touch: hold and drag to steer
 *                          while running)
 *   thumb stick            (touch screens only, render/thumbStick) drag from
 *                          the centre to walk in that direction relative to
 *                          the screen; to the rim to run; release to stop;
 *                          wakes him like a walking key. A finger on the
 *                          stick is no tap, hold or steering and does not
 *                          count towards two fingers
 *   two fingers            pinch to zoom, twist to turn the view; walking
 *                          stops while two fingers are down
 *   mouse wheel, + / -     zoom out and in (with Ctrl or Cmd the browser's
 *                          own page zoom is left alone)
 *   Q / E (hold)           turn the view around
 *   right mouse drag       left/right turns the view, up/down tilts it
 *
 * STICK_DEAD (0.12), STICK_RUN (0.85): the dead zone and the run rim, as
 *   fractions of the stick's radius
 * stickIntent(dx, dy, radius, yaw?) -> { x, z, run } | null   pure: the thumb
 *   offset in pixels from the stick's centre (dy down the screen) to a unit
 *   direction on the island, relative to the view like the walking keys; null
 *   inside the dead zone; run past the run rim
 *
 * createInput(element, pickGround, now?) -> input
 *   input: { up, down, left, right, run, stick, target, yaw }  read by game/game
 *     stick: { x, z } unit direction while the thumb stick is held (follows
 *     the current yaw), else null; moveIntent prefers it to keys and target.
 *     run is true for Shift or the stick pushed to its rim
 *     target: { x, z, run?, tap?, touch?, hero? }; run is set by a double tap;
 *     tap marks the spot of a click or tap itself (not of steering after it),
 *     touch that it was a finger, hero that it was on the castaway
 *     each frame; yaw is the current view angle, set by main from the view,
 *     so the keys walk relative to the screen
 *   input.takeZoom() -> zoom steps since the last call (positive = further
 *     away), then resets; main passes them to the view
 *   input.takeTurn(dt) -> { yaw, pitch } in radians since the last call
 *     (held Q/E plus mouse drag), then resets; main passes it to the view
 *   pickGround(clientX, clientY, touch) -> { x, z, hero? } | null   supplied by
 *     the renderer; hero when the point is on (a finger: near) the castaway
 *   now() -> milliseconds, for telling a double tap (defaults to performance.now)
 *   input.takeSleep() -> true once when the castaway was held long enough
 *     (without moving off him) or Z was pressed
 *   input.takeWake() -> true once when a walking key went down (not a held
 *     key repeating), or the left mouse button or a finger was pressed,
 *     since the last call (not the right mouse button, a second finger or
 *     the view keys)
 *   input.takeHold() -> once, when a press somewhere else than on the
 *     castaway was held long enough without moving: { x, z, touch? } (the
 *     pressed spot), or { key: true } when F was pressed; otherwise null
 *   input.pressing() -> true while a press is still being held still (it
 *     may yet become a hold), so the game can wait before picking up
 *   input.stickStart(id), stickMove(id, dx, dy, radius), stickEnd(id)   called
 *     by render/thumbStick for the finger `id` on the stick
 *   input.clearTarget()   called by the game when the target is reached
 *   input.dispose()
 *
 * Depends on: core/view
 */

import { YAW, basis } from '../core/view.js';

const TURN_RATE = 1.0, DRAG_YAW = 0.005, DRAG_PITCH = 0.002;   // rad/s for Q/E, rad per pixel for dragging
const PINCH = 1 / Math.log(1.1);   // zoom steps per e-fold of finger distance (render/camera zooms 1.1x per step)
export const HOLD_MS = 550;   // holding the castaway this long lies down to sleep
const DOUBLE_TAP_MS = 300, DOUBLE_TAP_PX = 40, STEER_PX = 12;   // a finger that moves less than STEER_PX still taps
export const STICK_DEAD = 0.12, STICK_RUN = 0.85;
const ZOOM_KEYS = { Equal: -1, NumpadAdd: -1, Minus: 1, NumpadSubtract: 1 };
const KEYS = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' };

export function stickIntent(dx, dy, radius, yaw = YAW) {
  const l = Math.hypot(dx, dy), f = l / radius;
  if (!(f >= STICK_DEAD)) return null;
  const { cam, right } = basis(yaw), u = -dy / l, r = dx / l;   // up on the screen is away from the camera
  return { x: -cam.x * u + right.x * r, z: -cam.z * u + right.z * r, run: f > STICK_RUN };
}

export function createInput(element, pickGround, now = () => performance.now()) {
  const touches = new Map();   // pointerId -> { x, y } for fingers on the screen
  let pinch = null, lastTap = null, running = false, downAt = null, steering = false;
  let hold = null, sleepKey = false, lightKey = false, woke = false;   // hold: { t, x, y, hero, at } while a press is held still
  let pointerDown = false, dragging = false, zoom = 0, dragYaw = 0, dragPitch = 0, turnL = false, turnR = false;
  let stickId = null, stickVec = null, keyRun = false;   // stickVec: { dx, dy, radius } of the thumb on the stick
  const takeZoom = () => { const z = zoom; zoom = 0; return z; };
  const takeTurn = dt => {
    const t = { yaw: ((turnL ? 1 : 0) - (turnR ? 1 : 0)) * TURN_RATE * dt + dragYaw, pitch: dragPitch };
    dragYaw = dragPitch = 0; return t;
  };
  const takeSleep = () => {
    if (hold && hold.hero && now() - hold.t >= HOLD_MS) { hold = null; return true; }
    const k = sleepKey; sleepKey = false; return k;
  };
  const takeHold = () => {
    if (hold && !hold.hero && now() - hold.t >= HOLD_MS) { const h = hold.at; hold = null; return h; }
    if (lightKey) { lightKey = false; return { key: true }; }
    return null;
  };
  const pressing = () => !!hold;
  const takeWake = () => { const k = woke; woke = false; return k; };
  const stickNow = () => stickVec && stickIntent(stickVec.dx, stickVec.dy, stickVec.radius, input.yaw);
  const input = { up: false, down: false, left: false, right: false, target: null, yaw: undefined,
    get run() { const s = stickNow(); return keyRun || !!(s && s.run); }, set run(v) { keyRun = !!v; },
    get stick() { const s = stickNow(); return s ? { x: s.x, z: s.z } : null; },
    stickStart(id) { if (stickId === null) { stickId = id; stickVec = null; hold = null; } },
    stickMove(id, dx, dy, radius) {
      if (id !== stickId) return;
      const was = !!stickVec && !!stickNow();
      stickVec = { dx, dy, radius };
      if (stickNow()) { input.target = null; hold = null; if (!was) woke = true; }
    },
    stickEnd(id) { if (id === stickId) { stickId = null; stickVec = null; } },
    clearTarget() { input.target = null; }, takeZoom, takeTurn, takeSleep, takeWake, takeHold, pressing, dispose };

  const onKey = down => e => {
    const k = KEYS[e.code];
    if (down && !e.repeat && k) woke = true;
    if (down && !e.repeat && e.code === 'KeyZ' && !e.ctrlKey && !e.metaKey) sleepKey = true;
    if (down && !e.repeat && e.code === 'KeyF' && !e.ctrlKey && !e.metaKey) lightKey = true;
    if (k) { input[k] = down; if (down) input.target = null; e.preventDefault(); }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keyRun = down;
    if (e.code === 'KeyQ') turnL = down;
    if (e.code === 'KeyE') turnR = down;
    if (down && ZOOM_KEYS[e.code] && !e.ctrlKey && !e.metaKey) { zoom += ZOOM_KEYS[e.code]; e.preventDefault(); }
  };
  const wheel = e => {
    if (e.ctrlKey || e.metaKey) return;
    zoom += e.deltaY / (e.deltaMode === 1 ? 3 : e.deltaMode === 2 ? 1 : 100); e.preventDefault();
  };
  const keydown = onKey(true), keyup = onKey(false);
  const blur = () => { hold = null; input.up = input.down = input.left = input.right = keyRun = turnL = turnR = dragging = pointerDown = false; touches.clear(); pinch = null; stickId = null; stickVec = null; };
  const setTarget = (e, tap) => {
    const touch = e.pointerType === 'touch', g = pickGround(e.clientX, e.clientY, touch); if (!g) return;
    const t = { x: g.x, z: g.z }; if (running) t.run = true;
    if (tap) {
      t.tap = true; if (touch) t.touch = true; if (g.hero) t.hero = true;
      hold = { t: now(), x: e.clientX, y: e.clientY, hero: !!g.hero, at: touch ? { x: g.x, z: g.z, touch: true } : { x: g.x, z: g.z } };
    }
    input.target = t;
  };
  const twoFingers = () => {
    const [a, b] = [...touches.values()];
    return { d: Math.hypot(b.x - a.x, b.y - a.y) || 1, a: Math.atan2(b.y - a.y, b.x - a.x) };
  };
  const pdown = e => {
    hold = null;
    if (e.button === 0 && (e.pointerType !== 'touch' || touches.size === 0)) woke = true;
    if (e.button === 2) { dragging = true; e.preventDefault(); return; }
    if (e.pointerType === 'touch') {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size >= 2) { hold = null; pointerDown = false; input.target = null; pinch = twoFingers(); return; }
      const t = now();
      running = !!lastTap && t - lastTap.t < DOUBLE_TAP_MS && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < DOUBLE_TAP_PX;
      lastTap = running ? null : { t, x: e.clientX, y: e.clientY };
      pointerDown = true; downAt = { x: e.clientX, y: e.clientY }; steering = false; setTarget(e, true); return;
    }
    if (e.button === 0) { running = false; pointerDown = true; setTarget(e, true); }
  };
  const pmove = e => {
    if (hold && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) >= STEER_PX) hold = null;
    if (e.pointerType === 'touch' && touches.has(e.pointerId)) {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && touches.size >= 2) {
        const g = twoFingers(); let da = g.a - pinch.a; da = Math.atan2(Math.sin(da), Math.cos(da));
        zoom += Math.log(pinch.d / g.d) * PINCH; dragYaw += da; pinch = g;   // the island follows the fingers
        return;
      }
    }
    if (pointerDown && e.pointerType !== 'mouse') {
      if (!steering && downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < STEER_PX) return;
      steering = true; setTarget(e);
    }
  };
  const drag = e => { if (dragging) { dragYaw -= (e.movementX || 0) * DRAG_YAW; dragPitch += (e.movementY || 0) * DRAG_PITCH; } };
  const pup = e => {
    if (e.pointerId !== undefined && e.pointerId === stickId) return;   // the thumb stick has its own end (stickEnd)
    hold = null;
    if (e.pointerType === 'touch') {
      touches.delete(e.pointerId);
      if (touches.size < 2) pinch = null;
      if (touches.size === 0) pointerDown = false;
      return;
    }
    if (e.button === 2) dragging = false; else pointerDown = false;
  };
  const gesture = e => e.preventDefault();   // Safari's own page pinch-zoom
  const menu = e => e.preventDefault();

  window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', blur);
  element.addEventListener('pointerdown', pdown); element.addEventListener('pointermove', pmove); window.addEventListener('pointerup', pup);
  window.addEventListener('pointercancel', pup); window.addEventListener('gesturestart', gesture);
  element.addEventListener('wheel', wheel, { passive: false });
  element.addEventListener('contextmenu', menu); window.addEventListener('pointermove', drag);
  function dispose() {
    window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur);
    element.removeEventListener('pointerdown', pdown); element.removeEventListener('pointermove', pmove); window.removeEventListener('pointerup', pup);
    window.removeEventListener('pointercancel', pup); window.removeEventListener('gesturestart', gesture);
    element.removeEventListener('wheel', wheel);
    element.removeEventListener('contextmenu', menu); window.removeEventListener('pointermove', drag);
  }
  return input;
}
