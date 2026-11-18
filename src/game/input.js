/**
 * game/input — the view controls of the player (0.38.0 "Only him": he plays no part in Dave's life any more; walking, the action button, the thumb stick and the
 * game keys are gone). What is left is watching: zoom, turn and tilt, handed on by main to the view.
 *
 *   mouse wheel, + / -     zoom out and in (with Ctrl or Cmd the browser's own page zoom is left alone)
 *   Q / E (hold)           turn the view around
 *   right mouse drag       left/right turns the view, up/down tilts it
 *   two fingers            pinch to zoom, twist to turn the view
 *
 * isTyping(e) -> bool    (0.36) the key event comes from an input, a textarea or a select: it is for the field, so the view keys and the page's own handlers ignore it
 * CAMERA_CODES           the key codes of the view
 *
 * createInput(element) -> input
 *   input.yaw              the current view angle, set by main from the view
 *   input.takeZoom() -> zoom steps since the last call (positive = further away), then resets; main passes them to the view
 *   input.takeTurn(dt) -> { yaw, pitch } in radians since the last call (held Q/E, the right mouse drag, a twist), then resets; main passes it to the view
 *   input.dispose()
 *
 * Depends on: nothing
 */

const TURN_RATE = 1.0, DRAG_YAW = 0.005, DRAG_PITCH = 0.002;   // rad/s for Q/E, rad per pixel for dragging
const PINCH = 1 / Math.log(1.1);   // zoom steps per e-fold of finger distance (render/camera zooms 1.1x per step)
const ZOOM_KEYS = { Equal: -1, NumpadAdd: -1, Minus: 1, NumpadSubtract: 1 };

/** 0.36: a key event typed into a field (the AI panel's key field, the start screen) is for the field, never for the view. */
export const isTyping = e => !!(e && e.target && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || '')));

export const CAMERA_CODES = new Set(['KeyQ', 'KeyE', ...Object.keys(ZOOM_KEYS)]);

export function createInput(element) {
  const touches = new Map();   // pointerId -> { x, y } for fingers on the screen
  let pinch = null, dragging = false, zoom = 0, dragYaw = 0, dragPitch = 0, turnL = false, turnR = false;
  const takeZoom = () => { const z = zoom; zoom = 0; return z; };
  const takeTurn = dt => {
    const t = { yaw: ((turnL ? 1 : 0) - (turnR ? 1 : 0)) * TURN_RATE * dt + dragYaw, pitch: dragPitch };
    dragYaw = dragPitch = 0; return t;
  };
  const input = { yaw: undefined, takeZoom, takeTurn, dispose };
  const onKey = down => e => {
    if (down && isTyping(e)) return;
    if (e.code === 'KeyQ') turnL = down;
    if (e.code === 'KeyE') turnR = down;
    if (down && ZOOM_KEYS[e.code] && !e.ctrlKey && !e.metaKey) { zoom += ZOOM_KEYS[e.code]; e.preventDefault(); }
  };
  const wheel = e => {
    if (e.ctrlKey || e.metaKey) return;
    zoom += e.deltaY / (e.deltaMode === 1 ? 3 : e.deltaMode === 2 ? 1 : 100); e.preventDefault();
  };
  const keydown = onKey(true), keyup = onKey(false);
  const blur = () => { turnL = turnR = dragging = false; touches.clear(); pinch = null; };
  const twoFingers = () => {
    const [a, b] = [...touches.values()];
    return { d: Math.hypot(b.x - a.x, b.y - a.y) || 1, a: Math.atan2(b.y - a.y, b.x - a.x) };
  };
  const pdown = e => {
    if (e.button === 2) { dragging = true; e.preventDefault(); return; }
    if (e.pointerType === 'touch') { touches.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (touches.size >= 2) pinch = twoFingers(); }
  };
  const pmove = e => {
    if (e.pointerType === 'touch' && touches.has(e.pointerId)) {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && touches.size >= 2) {
        const g = twoFingers(); let da = g.a - pinch.a; da = Math.atan2(Math.sin(da), Math.cos(da));
        zoom += Math.log(pinch.d / g.d) * PINCH; dragYaw += da; pinch = g;   // the island follows the fingers
      }
    }
  };
  const drag = e => { if (dragging) { dragYaw -= (e.movementX || 0) * DRAG_YAW; dragPitch += (e.movementY || 0) * DRAG_PITCH; } };
  const pup = e => {
    if (e.pointerType === 'touch') { touches.delete(e.pointerId); if (touches.size < 2) pinch = null; return; }
    if (e.button === 2) dragging = false;
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
