/**
 * game/input — keyboard and pointer to a movement input, plus the view
 * controls (zoom, turn, tilt) that main hands on to the view.
 *
 *   W A S D / arrow keys   walk (relative to the screen)
 *   Shift                  run
 *   click or tap          walk to that spot (touch: drag to steer); on a piece
 *                          of driftwood, a pile, a coconut, a fire or a torch: walk
 *                          to beside it and stand there. Clicking and tapping
 *                          never do anything else; that is the action button's job
 *   Space, action button   (render/actionButton) a press does the obvious small
 *                          thing for what he stands beside (the game decides,
 *                          see game/game `action`); there is no long press (0.27.4)
 *   1, 2, 3                do the first, second or third icon of the arc above the
 *                          action button (left to right; the icons are clicked or
 *                          tapped as well, render/actionButton)
 *   Z                      lie down to sleep
 *   F                      light the pile beside the castaway (or build)
 *   left click, tap, WASD, the action button   while asleep: wake up (the game
 *                          decides); turning, tilting or zooming the view does not wake him
 *   double tap             run to that spot (touch: hold and drag to steer
 *                          while running)
 *   thumb stick            (touch screens only, render/thumbStick) drag from
 *                          the centre to walk in that direction relative to
 *                          the screen; to the rim to run; release to stop;
 *                          wakes him like a walking key. A finger on the
 *                          stick is no tap or steering and does not
 *                          count towards two fingers; neither is a finger (or
 *                          the mouse) on the action button
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
 * QUIET (30): seconds without any input of the player before his habit takes over (0.28 "Habit", game/mind)
 * createTakeover(after?) -> takeover   pure: the timer that hands the game to game/mind and back. main calls poke(t) for every input that acts on the castaway (a key, a
 *   click, a tap, the stick, the action button, an icon, a drawing of the row; also a held key or a walk target he is still following), NOT for the camera (0.29.1: turn,
 *   tilt, zoom, pinch, twist leave him to his habit; see createActing)
 * createActing() -> { event(e) -> boolean }   pure: whether a DOM event of the player counts as acting on the castaway (CAMERA_CODES: Q, E, + and - do not) and update(t, blocked?) once per frame; t is in seconds (any clock that only goes forward)
 *   takeover.poke(t)           the player did something at t: the mind lets go at once
 *   takeover.update(t, blocked?) -> true while the mind is in charge: no poke for `after` seconds and not `blocked` (the name question is open)
 *   takeover.active()          the last answer of update
 *   takeover.quietFor(t)       seconds since the last poke
 *
 * createInput(element, pickGround, now?) -> input
 *   input: { up, down, left, right, run, stick, target, yaw }  read by game/game
 *     stick: { x, z } unit direction while the thumb stick is held (follows
 *     the current yaw), else null; moveIntent prefers it to keys and target.
 *     run is true for Shift or the stick pushed to its rim
 *     target: { x, z, run?, tap?, touch? }; run is set by a double tap;
 *     tap marks the spot of a click or tap itself (not of steering after it),
 *     touch that it was a finger
 *     each frame; yaw is the current view angle, set by main from the view,
 *     so the keys walk relative to the screen
 *   input.takeZoom() -> zoom steps since the last call (positive = further
 *     away), then resets; main passes them to the view
 *   input.takeTurn(dt) -> { yaw, pitch } in radians since the last call
 *     (held Q/E plus mouse drag), then resets; main passes it to the view
 *   pickGround(clientX, clientY, touch) -> { x, z } | null   supplied by
 *     the renderer
 *   now() -> milliseconds, for telling a double tap (defaults to performance.now)
 *   input.takeSleep() -> true once when Z was pressed
 *   input.takeWake() -> true once when a walking key went down (not a held
 *     key repeating), or the left mouse button or a finger was pressed on the
 *     world, or the action button went down, since the last call (not the
 *     right mouse button, a second finger or the view keys)
 *   input.takeLight() -> true once when F was pressed
 *   input.takeAction() -> 'tap' once when the action button (or Space) was
 *     released, otherwise null (however long it was held)
 *   input.takeChoice() -> 0, 1 or 2 once when key 1, 2 or 3 was pressed or choose(i) was
 *     called (a click on an icon of the arc), otherwise null; the game looks it up in game.action().options
 *   input.choose(i)   called by render/actionButton for an icon of the arc
 *   input.pressing() -> true while the action button is held
 *   input.actionStart(id), actionEnd(id)   called by render/actionButton for the
 *     finger or mouse `id` on the button (Space does the same with the id 'key')
 *   input.cancelAction()   called by the game when the press woke him: that
 *     press then does nothing
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
const CHOICE_KEYS = { Digit1: 0, Numpad1: 0, Digit2: 1, Numpad2: 1, Digit3: 2, Numpad3: 2 };   // the icons of the arc, left to right
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

export const QUIET = 30;

export function createTakeover(after = QUIET, start = 0) {
  let last = start, on = false;
  return {
    poke(t) { if (t > last) last = t; on = false; },
    update(t, blocked = false) { on = !blocked && t - last >= after; return on; },
    active: () => on,
    quietFor: t => Math.max(0, t - last),
  };
}

export const CAMERA_CODES = new Set(['KeyQ', 'KeyE', ...Object.keys(ZOOM_KEYS)]);

/**
 * 0.29.1: which events of the player are for the castaway and so take the game back from his habit (a poke of the takeover); turning, tilting and zooming the view are not.
 * event(e) takes a DOM-like event ({ type, code?, button?, buttons?, pointerType?, pointerId? }) in order and answers true when it counts.
 * Keys count except the camera keys (Q, E, + and -); the left mouse button and a single finger count; the right button (a drag turns and tilts the view), the wheel,
 * and everything of a two-finger gesture (pinch, twist) do not; a finger counts when it is released or moves, if it was alone on the screen all along (a tap or a walk);
 * focus coming back counts.
 */
export function createActing() {
  const down = new Set(); let multi = false;
  return {
    event(e) {
      const type = e.type, touch = e.pointerType === 'touch';
      if (type === 'keydown' || type === 'keyup') return !CAMERA_CODES.has(e.code);
      if (type === 'visibilitychange' || type === 'focus') return true;
      if (!touch) {
        if (type === 'pointerdown' || type === 'pointerup') return e.button === 0;
        if (type === 'pointermove') return (e.buttons & 1) === 1;
        return false;
      }
      if (type === 'pointerdown') { down.add(e.pointerId); if (down.size >= 2) multi = true; return false; }
      if (type === 'pointermove') return down.size === 1 && !multi;
      if (type === 'pointerup' || type === 'pointercancel') {
        const alone = down.has(e.pointerId) && down.size === 1 && !multi;
        down.delete(e.pointerId); if (!down.size) multi = false;
        return alone && type === 'pointerup';
      }
      return false;
    },
  };
}

export function createInput(element, pickGround, now = () => performance.now()) {
  const touches = new Map();   // pointerId -> { x, y } for fingers on the screen
  let pinch = null, lastTap = null, running = false, downAt = null, steering = false;
  let sleepKey = false, lightKey = false, woke = false, choice = null;
  let press = null, pressed = null;   // press: { id, cancelled } while the action button is held; pressed: 'tap' waiting to be taken
  let pointerDown = false, dragging = false, zoom = 0, dragYaw = 0, dragPitch = 0, turnL = false, turnR = false;
  let stickId = null, stickVec = null, keyRun = false;   // stickVec: { dx, dy, radius } of the thumb on the stick
  const takeZoom = () => { const z = zoom; zoom = 0; return z; };
  const takeTurn = dt => {
    const t = { yaw: ((turnL ? 1 : 0) - (turnR ? 1 : 0)) * TURN_RATE * dt + dragYaw, pitch: dragPitch };
    dragYaw = dragPitch = 0; return t;
  };
  const takeSleep = () => { const k = sleepKey; sleepKey = false; return k; };
  const takeLight = () => { const k = lightKey; lightKey = false; return k; };
  const takeAction = () => { const k = pressed; pressed = null; return k; };
  const takeChoice = () => { const k = choice; choice = null; return k; };
  const pressing = () => !!press;
  const takeWake = () => { const k = woke; woke = false; return k; };
  const stickNow = () => stickVec && stickIntent(stickVec.dx, stickVec.dy, stickVec.radius, input.yaw);
  const input = { up: false, down: false, left: false, right: false, target: null, yaw: undefined,
    get run() { const s = stickNow(); return keyRun || !!(s && s.run); }, set run(v) { keyRun = !!v; },
    get stick() { const s = stickNow(); return s ? { x: s.x, z: s.z } : null; },
    stickStart(id) { if (stickId === null) { stickId = id; stickVec = null; } },
    stickMove(id, dx, dy, radius) {
      if (id !== stickId) return;
      const was = !!stickVec && !!stickNow();
      stickVec = { dx, dy, radius };
      if (stickNow()) { input.target = null; if (!was) woke = true; }
    },
    stickEnd(id) { if (id === stickId) { stickId = null; stickVec = null; } },
    actionStart(id) { if (!press) { press = { id, cancelled: false }; woke = true; } },
    actionEnd(id) {
      if (!press || press.id !== id) return;
      if (!press.cancelled) pressed = 'tap';
      press = null;
    },
    cancelAction() { if (press) press.cancelled = true; pressed = null; },
    choose(i) { if (Number.isInteger(i) && i >= 0 && i < 3) choice = i; },
    clearTarget() { input.target = null; }, takeZoom, takeTurn, takeSleep, takeWake, takeLight, takeAction, takeChoice, pressing, dispose };

  const onKey = down => e => {
    const k = KEYS[e.code];
    if (down && !e.repeat && k) woke = true;
    if (down && !e.repeat && e.code === 'KeyZ' && !e.ctrlKey && !e.metaKey) sleepKey = true;
    if (down && !e.repeat && e.code === 'KeyF' && !e.ctrlKey && !e.metaKey) lightKey = true;
    if (down && !e.repeat && e.code in CHOICE_KEYS && !e.ctrlKey && !e.metaKey && !e.altKey && !(e.target && e.target.tagName === 'INPUT')) choice = CHOICE_KEYS[e.code];
    if (e.code === 'Space' && !e.ctrlKey && !e.metaKey) { if (down && !e.repeat) input.actionStart('key'); else if (!down) input.actionEnd('key'); e.preventDefault(); }
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
  const blur = () => { press = null; choice = null; input.up = input.down = input.left = input.right = keyRun = turnL = turnR = dragging = pointerDown = false; touches.clear(); pinch = null; stickId = null; stickVec = null; };
  const setTarget = (e, tap) => {
    const touch = e.pointerType === 'touch', g = pickGround(e.clientX, e.clientY, touch); if (!g) return;
    const t = { x: g.x, z: g.z }; if (running) t.run = true;
    if (tap) { t.tap = true; if (touch) t.touch = true; }
    input.target = t;
  };
  const twoFingers = () => {
    const [a, b] = [...touches.values()];
    return { d: Math.hypot(b.x - a.x, b.y - a.y) || 1, a: Math.atan2(b.y - a.y, b.x - a.x) };
  };
  const pdown = e => {
    if (e.button === 0 && (e.pointerType !== 'touch' || touches.size === 0)) woke = true;
    if (e.button === 2) { dragging = true; e.preventDefault(); return; }
    if (e.pointerType === 'touch') {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size >= 2) { pointerDown = false; input.target = null; pinch = twoFingers(); return; }
      const t = now();
      running = !!lastTap && t - lastTap.t < DOUBLE_TAP_MS && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < DOUBLE_TAP_PX;
      lastTap = running ? null : { t, x: e.clientX, y: e.clientY };
      pointerDown = true; downAt = { x: e.clientX, y: e.clientY }; steering = false; setTarget(e, true); return;
    }
    if (e.button === 0) { running = false; pointerDown = true; setTarget(e, true); }
  };
  const pmove = e => {
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
