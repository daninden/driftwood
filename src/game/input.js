/**
 * game/input — keyboard and pointer to a movement input.
 *
 *   W A S D / arrow keys   walk (relative to the screen)
 *   Shift                  run
 *   click or tap           walk to that spot (touch: drag to steer)
 *   mouse wheel, + / -     zoom out and in (with Ctrl or Cmd the browser's
 *                          own page zoom is left alone)
 *
 * createInput(element, pickGround) -> input
 *   input: { up, down, left, right, run, target }  read by game/game each frame
 *   input.takeZoom() -> zoom steps since the last call (positive = further
 *     away), then resets; main passes them to the view
 *   pickGround(clientX, clientY) -> { x, z } | null   supplied by the renderer
 *   input.clearTarget()   called by the game when the target is reached
 *   input.dispose()
 *
 * Depends on: nothing
 */

const ZOOM_KEYS = { Equal: -1, NumpadAdd: -1, Minus: 1, NumpadSubtract: 1 };
const KEYS = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' };

export function createInput(element, pickGround) {
  let pointerDown = false, zoom = 0;
  const takeZoom = () => { const z = zoom; zoom = 0; return z; };
  const input = { up: false, down: false, left: false, right: false, run: false, target: null, clearTarget() { input.target = null; }, takeZoom, dispose };

  const onKey = down => e => {
    const k = KEYS[e.code];
    if (k) { input[k] = down; if (down) input.target = null; e.preventDefault(); }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.run = down;
    if (down && ZOOM_KEYS[e.code] && !e.ctrlKey && !e.metaKey) { zoom += ZOOM_KEYS[e.code]; e.preventDefault(); }
  };
  const wheel = e => {
    if (e.ctrlKey || e.metaKey) return;
    zoom += e.deltaY / (e.deltaMode === 1 ? 3 : e.deltaMode === 2 ? 1 : 100); e.preventDefault();
  };
  const keydown = onKey(true), keyup = onKey(false);
  const blur = () => { input.up = input.down = input.left = input.right = input.run = false; };
  const setTarget = e => { const g = pickGround(e.clientX, e.clientY); if (g) input.target = g; };
  const pdown = e => { pointerDown = true; setTarget(e); };
  const pmove = e => { if (pointerDown && e.pointerType !== 'mouse') setTarget(e); };
  const pup = () => { pointerDown = false; };

  window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', blur);
  element.addEventListener('pointerdown', pdown); element.addEventListener('pointermove', pmove); window.addEventListener('pointerup', pup);
  element.addEventListener('wheel', wheel, { passive: false });
  function dispose() {
    window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur);
    element.removeEventListener('pointerdown', pdown); element.removeEventListener('pointermove', pmove); window.removeEventListener('pointerup', pup);
    element.removeEventListener('wheel', wheel);
  }
  return input;
}
