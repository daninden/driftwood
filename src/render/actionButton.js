/**
 * render/actionButton — the action button: an ink ring, drawn like the
 * thumb stick, with an ink icon of what a press would do. Readable on any
 * ground (0.13.3): a soft glow in the opposite colour behind ring and icon
 * (`--halo` in index.html, a drop-shadow of `--ink-glow`), a faint paper disc
 * inside the ring (fill `--ink-glow` at 0.29, pale by day, dark at night),
 * icon strokes of 2.2 px that keep their width at any icon scale
 * (non-scaling-stroke).
 *
 * Space on the keyboard does the same (game/input). On touch-only devices
 * (the thumb stick's test, render/thumbStick `touchOnly`) it sits bottom
 * right just above the thumb stick, inside the safe area; on a desktop it
 * sits in the bottom right corner and can also be clicked (positions in
 * index.html). In the ink of the other marks (`--ink`, pale at night, render/ink).
 * Faint (0.45) and empty when there is nothing to do, clear (0.95) with an icon
 * when there is, fully opaque under a finger. Beside something he
 * could light or when a hold is the only thing to do, a ring round the icon
 * fills while the button is held (game/input HOLD_MS).
 *
 * A short press and a hold: when both do something the icon of the short
 * press is large and that of the hold small beside it; when only a hold does
 * something, its icon is large. The icons (strokes like the moon and the
 * drop): wood with an arrow up (pickup), wood with an arrow down (lay), the
 * half coconut (husk), a flame over a piece of wood (feed), a torch (torch), a
 * torch with a stroke of ground (plant), the drop (drink), a flame (light, hold)
 * a small lean-to (build, hold), the crescent moon (sleep, hold) and, since 0.22, a hand with claws over a
 * hole (dig) and a crab over a flame (roast), and since 0.25 a half shell with a drop over it
 * (fill) and a tilted half shell with water in it (sip). Eating a carried nut uses the half coconut (husk). Since 0.26 (game/forage) a cluster of berries with an arrow up (berries: picks them, or eats them on the spot when he is hungry), a bunch with an arrow up (bananas), and the plain cluster or bunch for eating a carried one (eatBerries, eatBanana). Since 0.27 "Home" (game/leanto): the hold of an upgrade (kind 'upgrade', `what`) shows what will be built: a roof with fronds hanging down its side (walls), a low frame with a frond laid on it (bed) or a ring of stones round a small flame (ring).
 *
 * The pointer handling is the button's own: a finger or the mouse on it goes
 * to input.actionStart/actionEnd and never reaches the world (no walk tap, no
 * steering, no part of a two-finger gesture) nor the thumb stick.
 *
 * MAIN_ALONE, MAIN_WITH_SIDE, SIDE   the icon scales (1.8, 1.25, 0.6)
 * ICONS            { key: inner SVG } in a -12..12 box, stroked with the ink
 * ICON_OF          the icon key of each action kind of game/game `action`
 * buttonIcons(action) -> { main, side }   the icon keys (null when empty) for what
 *   game.action() returned: { tap, hold }. Pure.
 * buttonOpacity(icons, down) -> 0.45 | 0.95 | 1   Pure.
 * ringOffset(fill) -> stroke-dashoffset of the filling ring, fill 0..1 in steps of 1/FILL_STEPS. Pure.
 * createActionButton(el, input) -> { update(action, fill), dispose() }
 *   el: the #action element (index.html), holding an <svg> with .fill, .main
 *   and .side groups; null when el is missing. update(action, fill) is
 *   called each frame (fill from input.actionFill()) and touches the DOM only
 *   when something changed.
 *
 * Depends on: render/carryMark, render/thirstMark
 */
import { DRAWINGS, CRAB_PATHS } from './carryMark.js';
import { DROP_PATH } from './thirstMark.js';
import { SHELL_PATH, RIM_PATH } from './hungerMark.js';

export const FILL_STEPS = 40;
export const RING_R = 36, CIRC = +(2 * Math.PI * RING_R).toFixed(2);   // the filling ring round the icon
export const FAINT = 0.45, CLEAR = 0.95, HELD = 1;
export const MAIN_ALONE = 1.8, MAIN_WITH_SIDE = 1.25, SIDE = 0.6;   // icon scales (icons are drawn in a -12..12 box)

const LOG = '<path d="M-9.56 7.08L7.44 2.08A2 2 0 0 1 8.56 5.92L-8.44 10.92A2 2 0 0 1 -9.56 7.08Z"/>';
const FLAME = '<path d="M0 -11C1 -7 5 -5 5 -0.5A5 5 0 0 1 -5 -0.5C-5 -3 -3 -4.5 -2 -7C-1 -5.5 -0.5 -4 0 -4C1 -6 1 -8.5 0 -11Z"/>';
const TORCH_HEAD = '<g transform="translate(0 -6.5) scale(0.8)">' + FLAME + '</g>';

export const ICONS = {
  pickup: LOG + '<path d="M0 1V-11M-3.5 -7.5L0 -11L3.5 -7.5"/>',
  lay: LOG + '<path d="M0 -11V0M-3.5 -3.5L0 0L3.5 -3.5"/>',
  fibre: `<g transform="translate(-9 -11.7) scale(0.9)">${DRAWINGS.fibre}</g>`,
  coconut: `<g transform="translate(-12 -12)"><path d="${SHELL_PATH}"/><path d="${RIM_PATH}"/></g>`,
  feed: '<g transform="translate(0 -1.5) scale(0.8)">' + FLAME + '</g><g transform="translate(0 4.5)">' + LOG + '</g>',
  torch: '<path d="M-5 11.5L2.2 -1"/><g transform="translate(3.2 1)">' + TORCH_HEAD + '</g>',
  plant: '<path d="M0 8V-3"/>' + TORCH_HEAD + '<path d="M-9 8H9M-6 11L-3 8M3 8L6 11"/>',
  drop: `<g transform="translate(-8 -12)"><path d="${DROP_PATH}"/></g>`,
  flame: '<g transform="translate(0 2) scale(1.15)">' + FLAME + '</g>',
  leanto: '<path d="M-11 11H11"/><path d="M-7 -6V11M6 6.3V11"/><path d="M-11 -9L11 4V8L-11 -5Z"/>',
  dig: '<ellipse cx="0" cy="9" rx="9.5" ry="2.8"/><path d="M-5.5 -4C-5 -7 -4.5 -9 -4.5 -10.5M-2 -5C-1.8 -8 -1.6 -10.5 -1.6 -12M1.8 -5C2 -8 2.2 -10.5 2.2 -12M5.5 -4C5.2 -7 5 -9 5 -10.5"/><path d="M-5.5 -4C-6 0 -4 4 0 4.5C4 4 6 0 5.5 -4"/><path d="M-12 1L-9.5 3.2M12 1L9.5 3.2M-10 -3L-8 -2M10 -3L8 -2"/>',
  roast: `<g transform="translate(0 -5.5) scale(0.9)">${CRAB_PATHS}</g><g transform="translate(0 8.5) scale(0.58)">${FLAME}</g><path d="M-8 11.5H8"/>`,
  fill: `<g transform="translate(-9.5 -8.5) scale(0.95)">${DRAWINGS.shell}</g><g transform="translate(-3.2 -12.4) scale(0.45)"><path d="${DROP_PATH}"/></g>`,
  sip: `<g transform="rotate(-38) translate(-10 -13.5)">${DRAWINGS.water}</g>`,
  berries: `<g transform="translate(-7.2 -5.5) scale(0.72)">${DRAWINGS.berries}</g><path d="M0 -3V-11M-3.5 -7.5L0 -11L3.5 -7.5"/>`,
  bananas: `<g transform="translate(-7.2 -5.5) scale(0.72)">${DRAWINGS.banana}</g><path d="M0 -3V-11M-3.5 -7.5L0 -11L3.5 -7.5"/>`,
  eatBerries: `<g transform="translate(-10 -13)">${DRAWINGS.berries}</g>`,
  eatBanana: `<g transform="translate(-10 -13)">${DRAWINGS.banana}</g>`,
  walls: '<path d="M-11 11H11"/><path d="M-10 -9L10 3"/><path d="M-7 -7.5C-8.5 -2 -8 4 -6 10.5M-2 -5C-3.5 0 -3 6 -1 10.5M3 -2.5C1.5 2.5 2 7 4 10.5M8 0C7 3.5 7.5 7 9 10.5"/>',
  bed: '<path d="M-11 3H11"/><path d="M-9 3V11M9 3V11M0 3V11"/><path d="M-10 -1C-5 -6.5 5 -6.5 10 -1"/><path d="M-6 -4.2L-7 -0.8M-2 -5.6L-2.4 -1.6M2 -5.6L2.4 -1.6M6 -4.2L7 -0.8"/>',
  ring: '<g transform="translate(0 -3.5) scale(0.62)">' + FLAME + '</g><circle cx="-8.4" cy="6" r="2.5"/><circle cx="-4.4" cy="9.4" r="2.5"/><circle cx="2.4" cy="9.8" r="2.5"/><circle cx="8.2" cy="6.6" r="2.5"/><circle cx="7" cy="1" r="2.2"/><circle cx="-7.6" cy="0.6" r="2.2"/>',
  moon: '<path d="M3 -10.5A10 10 0 1 0 10.5 3A7.5 7.5 0 0 1 3 -10.5Z"/>',
};
export const ICON_OF = { pickup: 'pickup', lay: 'lay', fill: 'fill', sip: 'sip', husk: 'coconut', feed: 'feed', torch: 'torch', plant: 'plant', drink: 'drop', light: 'flame', build: 'leanto', sleep: 'moon', dig: 'dig', roast: 'roast', berries: 'berries', bananas: 'bananas', eatBerries: 'eatBerries', eatBanana: 'eatBanana' };

const iconKey = a => a ? (a.kind === 'upgrade' ? a.what : ICON_OF[a.kind]) || null : null;   // an upgrade shows what it builds

export function buttonIcons(action) {
  const tap = action ? iconKey(action.tap) : null, hold = action ? iconKey(action.hold) : null;
  return tap ? { main: tap, side: hold } : { main: hold, side: null };
}

export const buttonOpacity = (icons, down = false) => icons.main ? (down ? HELD : CLEAR) : FAINT;

export const ringOffset = fill => +(CIRC * (1 - Math.round(Math.min(1, Math.max(0, fill)) * FILL_STEPS) / FILL_STEPS)).toFixed(2);

const placed = (key, x, y, s) => key ? `<g transform="translate(${x} ${y}) scale(${s})">${ICONS[key]}</g>` : '';

export function createActionButton(el, input) {
  if (!el) return null;
  const main = el.querySelector('.main'), side = el.querySelector('.side'), ring = el.querySelector('.fill');
  let id = null, key = '', down = false, shownFill = null, shownOpacity = '';
  const dn = e => {
    e.preventDefault(); e.stopPropagation();
    if (id !== null) return;
    id = e.pointerId; down = true; try { el.setPointerCapture(id); } catch (_) { /* not capturable: window events still arrive */ }
    input.actionStart(id);
  };
  const up = e => {
    if (e.pointerId !== id) return;
    e.stopPropagation(); input.actionEnd(id); id = null; down = false;
  };
  const menu = e => e.preventDefault();
  el.addEventListener('pointerdown', dn); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
  el.addEventListener('contextmenu', menu);
  function update(action, fill = 0) {
    const icons = buttonIcons(action), k = (icons.main || '') + '|' + (icons.side || '');
    if (k !== key) {
      key = k;
      main.innerHTML = icons.side ? placed(icons.main, -6, -3, MAIN_WITH_SIDE) : placed(icons.main, 0, 0, MAIN_ALONE);
      side.innerHTML = placed(icons.side, 16, 13, SIDE);
      el.classList.toggle('on', !!icons.main);
    }
    const f = action && action.hold ? ringOffset(fill) : ringOffset(0);
    if (f !== shownFill) { shownFill = f; ring.setAttribute('stroke-dashoffset', f); }
    const o = buttonOpacity(icons, down || (input.pressing && input.pressing())).toFixed(2);
    if (o !== shownOpacity) { shownOpacity = o; el.style.opacity = o; }
  }
  return { update, dispose() { el.removeEventListener('pointerdown', dn); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); el.removeEventListener('lostpointercapture', up); el.removeEventListener('contextmenu', menu); } };
}
