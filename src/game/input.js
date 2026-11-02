/**
 * game/input — keyboard and pointer to a movement input.
 *
 *   W A S D / arrow keys   walk (relative to the screen)
 *   Shift                  run
 *   click or tap           walk to that spot (touch: drag to steer)
 *
 * createInput(element, pickGround) -> input
 *   input: { up, down, left, right, run, target }  read by game/game each frame
 *   pickGround(clientX, clientY) -> { x, z } | null   supplied by the renderer
 *   input.clearTarget()   called by the game when the target is reached
 *   input.dispose()
 *
 * Depends on: nothing
 */

const KEYS = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' };

export function createInput(element, pickGround) {
  const input = { up: false, down: false, left: false, right: false, run: false, target: null, clearTarget() { input.target = null; }, dispose };
  let pointerDown = false;

  const onKey = down => e => {
    const k = KEYS[e.code];
    if (k) { input[k] = down; if (down) input.target = null; e.preventDefault(); }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.run = down;
  };
  const keydown = onKey(true), keyup = onKey(false);
  const blur = () => { input.up = input.down = input.left = input.right = input.run = false; };
  const setTarget = e => { const g = pickGround(e.clientX, e.clientY); if (g) input.target = g; };
  const pdown = e => { pointerDown = true; setTarget(e); };
  const pmove = e => { if (pointerDown && e.pointerType !== 'mouse') setTarget(e); };
  const pup = () => { pointerDown = false; };

  window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', blur);
  element.addEventListener('pointerdown', pdown); element.addEventListener('pointermove', pmove); window.addEventListener('pointerup', pup);
  function dispose() {
    window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur);
    element.removeEventListener('pointerdown', pdown); element.removeEventListener('pointermove', pmove); window.removeEventListener('pointerup', pup);
  }
  return input;
}
