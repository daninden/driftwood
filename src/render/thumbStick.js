/**
 * render/thumbStick — the thumb stick: a thin ink ring with a dot, fixed
 * bottom right, on touch-only devices, to walk and steer with one thumb.
 *
 * In the style of the moon mark, in its ink (`--ink`, render/ink): a ring and a dot, no fills,
 * arrows or labels. Since 0.13.3 readable on any ground: ring 2.2 px with the glow `--halo` (index.html, `--ink-glow` behind the strokes). Faint (0.55) most of the time, clearer (0.95) while a thumb is on it;
 * the dot follows the thumb inside the ring and springs back on release.
 * The touch area is a little larger than the ring. The finger's offset from
 * the centre goes to game/input (stickStart, stickMove, stickEnd), which
 * turns it into walking and running; the stick never reaches the world.
 *
 * STICK_R (55): radius of the ring in px; KNOB_R (6): radius of the dot
 * touchOnly(matchMedia) -> true where the primary pointer is coarse and no
 *   fine pointer exists (not on a desktop, nor a laptop with a touch screen)
 * knobOffset(dx, dy, max) -> { x, y } the thumb offset limited to max, pure
 * createThumbStick(el, input, matchMedia?) -> { dispose() } | null
 *   el: the #stick element (index.html), holding an <svg> with a .ring circle
 *   and a .knob circle; null (and nothing attached) when not touch-only
 *
 * Depends on: nothing (the input object it is given)
 */
export const STICK_R = 55, KNOB_R = 6;
const REACH = STICK_R - KNOB_R;   // the dot's centre travels this far; input maps the same radius

export const touchOnly = mm => !!mm && mm('(pointer: coarse)').matches && !mm('(any-pointer: fine)').matches;

export function knobOffset(dx, dy, max) {
  const l = Math.hypot(dx, dy);
  return l > max ? { x: dx / l * max, y: dy / l * max } : { x: dx, y: dy };
}

export function createThumbStick(el, input, mm = typeof window !== 'undefined' && window.matchMedia ? q => window.matchMedia(q) : null) {
  if (!el || !touchOnly(mm)) return null;
  const knob = el.querySelector('.knob');
  let id = null;
  const place = (x, y) => { knob.style.transform = `translate(${x}px, ${y}px)`; };
  const move = e => {
    if (e.pointerId !== id) return;
    const r = el.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const k = knobOffset(dx, dy, REACH); place(k.x, k.y);
    input.stickMove(id, dx, dy, REACH);
  };
  const down = e => {
    e.preventDefault(); e.stopPropagation();
    if (id !== null) return;
    id = e.pointerId; try { el.setPointerCapture(id); } catch (_) { /* not capturable: window events still arrive */ }
    el.classList.add('active'); knob.classList.add('held'); input.stickStart(id); move(e);
  };
  const up = e => {
    if (e.pointerId !== id) return;
    input.stickEnd(id); id = null; el.classList.remove('active'); knob.classList.remove('held'); place(0, 0);
  };
  el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
  const menu = e => e.preventDefault(); el.addEventListener('contextmenu', menu);
  return { dispose() { el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); el.removeEventListener('lostpointercapture', up); el.removeEventListener('contextmenu', menu); } };
}
