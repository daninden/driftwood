/**
 * game/input — keyboard and pointer to a movement input, plus the view
 * controls (zoom, turn, tilt) that main hands on to the view.
 *
 *   W A S D / arrow keys   walk (relative to the screen)
 *   Shift                  run
 *   click or tap           walk to that spot (touch: drag to steer)
 *   double tap             run to that spot (touch: hold and drag to steer
 *                          while running)
 *   two fingers            pinch to zoom, twist to turn the view; walking
 *                          stops while two fingers are down
 *   mouse wheel, + / -     zoom out and in (with Ctrl or Cmd the browser's
 *                          own page zoom is left alone)
 *   Q / E (hold)           turn the view around
 *   right mouse drag       left/right turns the view, up/down tilts it
 *
 * createInput(element, pickGround, now?) -> input
 *   input: { up, down, left, right, run, target, yaw }  read by game/game
 *     target: { x, z, run? }; run is set by a double tap
 *     each frame; yaw is the current view angle, set by main from the view,
 *     so the keys walk relative to the screen
 *   input.takeZoom() -> zoom steps since the last call (positive = further
 *     away), then resets; main passes them to the view
 *   input.takeTurn(dt) -> { yaw, pitch } in radians since the last call
 *     (held Q/E plus mouse drag), then resets; main passes it to the view
 *   pickGround(clientX, clientY) -> { x, z } | null   supplied by the renderer
 *   now() -> milliseconds, for telling a double tap (defaults to performance.now)
 *   input.clearTarget()   called by the game when the target is reached
 *   input.dispose()
 *
 * Depends on: nothing
 */

const TURN_RATE = 1.0, DRAG_YAW = 0.005, DRAG_PITCH = 0.002;   // rad/s for Q/E, rad per pixel for dragging
const PINCH = 1 / Math.log(1.1);   // zoom steps per e-fold of finger distance (render/camera zooms 1.1x per step)
const DOUBLE_TAP_MS = 300, DOUBLE_TAP_PX = 40;
const ZOOM_KEYS = { Equal: -1, NumpadAdd: -1, Minus: 1, NumpadSubtract: 1 };
const KEYS = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' };

export function createInput(element, pickGround, now = () => performance.now()) {
  const touches = new Map();   // pointerId -> { x, y } for fingers on the screen
  let pinch = null, lastTap = null, running = false;
  let pointerDown = false, dragging = false, zoom = 0, dragYaw = 0, dragPitch = 0, turnL = false, turnR = false;
  const takeZoom = () => { const z = zoom; zoom = 0; return z; };
  const takeTurn = dt => {
    const t = { yaw: ((turnL ? 1 : 0) - (turnR ? 1 : 0)) * TURN_RATE * dt + dragYaw, pitch: dragPitch };
    dragYaw = dragPitch = 0; return t;
  };
  const input = { up: false, down: false, left: false, right: false, run: false, target: null, clearTarget() { input.target = null; }, takeZoom, takeTurn, dispose };

  const onKey = down => e => {
    const k = KEYS[e.code];
    if (k) { input[k] = down; if (down) input.target = null; e.preventDefault(); }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.run = down;
    if (e.code === 'KeyQ') turnL = down;
    if (e.code === 'KeyE') turnR = down;
    if (down && ZOOM_KEYS[e.code] && !e.ctrlKey && !e.metaKey) { zoom += ZOOM_KEYS[e.code]; e.preventDefault(); }
  };
  const wheel = e => {
    if (e.ctrlKey || e.metaKey) return;
    zoom += e.deltaY / (e.deltaMode === 1 ? 3 : e.deltaMode === 2 ? 1 : 100); e.preventDefault();
  };
  const keydown = onKey(true), keyup = onKey(false);
  const blur = () => { input.up = input.down = input.left = input.right = input.run = turnL = turnR = dragging = pointerDown = false; touches.clear(); pinch = null; };
  const setTarget = e => { const g = pickGround(e.clientX, e.clientY); if (g) input.target = running ? { ...g, run: true } : g; };
  const twoFingers = () => {
    const [a, b] = [...touches.values()];
    return { d: Math.hypot(b.x - a.x, b.y - a.y) || 1, a: Math.atan2(b.y - a.y, b.x - a.x) };
  };
  const pdown = e => {
    if (e.button === 2) { dragging = true; e.preventDefault(); return; }
    if (e.pointerType === 'touch') {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size >= 2) { pointerDown = false; input.target = null; pinch = twoFingers(); return; }
      const t = now();
      running = !!lastTap && t - lastTap.t < DOUBLE_TAP_MS && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < DOUBLE_TAP_PX;
      lastTap = running ? null : { t, x: e.clientX, y: e.clientY };
      pointerDown = true; setTarget(e); return;
    }
    if (e.button === 0) { running = false; pointerDown = true; setTarget(e); }
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
    if (pointerDown && e.pointerType !== 'mouse') setTarget(e);
  };
  const drag = e => { if (dragging) { dragYaw -= (e.movementX || 0) * DRAG_YAW; dragPitch += (e.movementY || 0) * DRAG_PITCH; } };
  const pup = e => {
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
