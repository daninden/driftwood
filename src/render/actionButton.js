/**
 * render/actionButton — the action button: an ink ring, drawn like the
 * thumb stick, with an ink icon of what a press would do, and (0.27.4
 * "Choices") a small arc of up to three smaller icons above it for the other
 * things that can be done. Readable on any ground (0.13.3): a soft glow in the
 * opposite colour behind ring and icon (`--halo` in index.html, a drop-shadow
 * of `--ink-glow`), a faint paper disc inside the ring (fill `--ink-glow` at
 * 0.29, pale by day, dark at night), icon strokes of 2.2 px that keep their
 * width at any icon scale (non-scaling-stroke).
 *
 * Space on the keyboard does the same as the ring (game/input). On touch-only
 * devices (the thumb stick's test, render/thumbStick `touchOnly`) it sits bottom
 * right just above the thumb stick, inside the safe area; on a desktop it
 * sits in the bottom right corner and can also be clicked (positions in
 * index.html). In the ink of the other marks (`--ink`, pale at night, render/ink).
 * Faint (0.45) and empty when there is no small action to do, clear (0.95) with an icon
 * when there is, fully opaque under a finger. There is no long press: the ring only
 * ever does the small actions (pick up, lay down, eat, drink, feed the fire ...); the big
 * ones (light a pile, build here, build in, upgrade, sleep) are icons of the arc.
 *
 * The arc: the other options of game.action() (`options`, at most 3) as smaller ink
 * icons (same ink, stroke and glow as the ring, no frame, no text), left to right in the
 * order of the keys 1, 2, 3 (small actions nearest first, then big ones). Faint (0.75), clear under the
 * pointer; a click or tap (on release) on one calls input.choose(i). Each has a hit area of
 * OPT_SIZE (44) px and an aria-label with plain words (LABEL_OF). On a desktop the fan leans to
 * the left (the button sits in the corner), on touch it is centred above the ring (clear of the
 * thumb stick below and the screen edge). A press on an icon never reaches the world.
 *
 * The icons (strokes like the moon and the drop): wood with an arrow up (pickup), wood with an arrow down
 * (lay), the half coconut (husk), a flame over a piece of wood (feed), a torch (torch), a
 * torch with a stroke of ground (plant), the drop (drink), a flame (light), a small lean-to (buildHere: start a lean-to where he stands), a stick with an arrow down into a small lean-to (buildIn: 0.32, build a piece into a half-built one), the
 * crescent moon (sleep) and, since 0.22, a hand with claws over a
 * hole (dig) and a crab over a flame (roast), and since 0.25 a half shell with a drop over it
 * (fill) and a tilted half shell with water in it (sip). Since 0.31 "Axe" an axe (makeAxe), the same lying with an arrow up (takeAxe) or down (layAxe), a trunk with a notch cut in it (fell), and a log showing its cut end with an arrow up (pickupLog) or down (layLog). Since 0.30.17 "Spear" a spear (makeSpear), a spear lying with an arrow up (takeSpear) or down (laySpear), a fish over a line of water (fish) and a fish over a flame (the roast of a fish, `roastFish`, chosen by the option's `food`). Eating a carried nut uses the half coconut (husk). Since 0.26 (game/forage) a cluster of berries with an arrow up (berries: picks them, or eats them on the spot when he is hungry), a bunch with an arrow up (bananas), and the plain cluster or bunch for eating a carried one (eatBerries, eatBanana). Since 0.27 "Home" (game/leanto): an upgrade (kind 'upgrade', `what`) shows what will be built: a roof with fronds hanging down its side (walls), a low frame with a frond laid on it (bed) or a ring of stones round a small flame (ring).
 *
 * The pointer handling is the button's own: a finger or the mouse on it goes
 * to input.actionStart/actionEnd and never reaches the world (no walk tap, no
 * steering, no part of a two-finger gesture) nor the thumb stick.
 *
 * MAIN_ALONE       the icon scale of the ring (1.8)
 * OPT_SIZE, ARC_R, ARC_STEP, ARC_LEAN, ARC_BOX   the arc's geometry (px, px, degrees, degrees, px)
 * ICONS            { key: inner SVG } in a -12..12 box, stroked with the ink
 * ICON_OF          the icon key of each action kind of game/game `action`
 * LABEL_OF         the plain words (aria-label) of each action kind (and of the upgrades' `what`)
 * buttonIcons(action, log?) -> { main, options: [{ key, label }] }   the icon key of the ring (null when empty) and
 *   the icons of the arc for what game.action() returned: { tap, options }. Pure. 0.31: log true (a log on his shoulder, game/wood `log`) turns the lay icon into `layLog`; picking up a log or a pile of logs is `pickupLog`.
 * buttonOpacity(icons, down) -> 0.45 | 0.95 | 1   Pure.
 * arcSpots(n, touch) -> [{ x, y }]   where the n icons of the arc sit, in px from the ring's middle (y down). Pure.
 * createActionButton(el, input, arc?, touch?) -> { update(action, log?), dispose() }
 *   el: the #action element (index.html), holding an <svg> with a .main group; null when el is
 *   missing. arc: the #arc element (an empty box over the ring, pointer events off) the icons are put in.
 *   update(action) is called each frame and touches the DOM only when something changed.
 *
 * Depends on: render/carryMark, render/thirstMark, render/hungerMark
 */
import { DRAWINGS, CRAB_PATHS, FISH_PATHS } from './carryMark.js';
import { DROP_PATH } from './thirstMark.js';
import { SHELL_PATH, RIM_PATH } from './hungerMark.js';

export const FAINT = 0.45, CLEAR = 0.95, HELD = 1;
export const MAIN_ALONE = 1.8;   // the icon scale of the ring (icons are drawn in a -12..12 box)
export const OPT_SIZE = 44, ARC_R = 70, ARC_STEP = 42, ARC_LEAN = -18, ARC_BOX = 84;   // px, px, degrees, degrees, px (the arc's box is as large as the ring's)

const LOG = '<path d="M-9.56 7.08L7.44 2.08A2 2 0 0 1 8.56 5.92L-8.44 10.92A2 2 0 0 1 -9.56 7.08Z"/>';
const FLAME = '<path d="M0 -11C1 -7 5 -5 5 -0.5A5 5 0 0 1 -5 -0.5C-5 -3 -3 -4.5 -2 -7C-1 -5.5 -0.5 -4 0 -4C1 -6 1 -8.5 0 -11Z"/>';
const SPEAR = '<path d="M-9.5 10.5L6.6 -6.4"/><path d="M4.4 -4.6C5.4 -8 7.6 -10.6 11 -11.8C10.8 -8.2 9.2 -5.6 6.6 -4Z"/><path d="M2.6 -2.8L5 -1.2"/>';
const SPEAR_LYING = '<path d="M-11 6.5L5 3.8"/><path d="M4.2 3.9C6.2 1.6 8.6 0.8 11.4 1.4C10.8 4 9.2 5.8 6.6 6.4Z"/><path d="M1.2 4.4L1.8 6.6"/>';
// 0.31 "Axe": an axe (haft and a flat stone blade lashed on), the same lying, a trunk with a notch cut in it (fell) and a log with its cut end showing
const AXE = '<path d="M-9.5 10.5L5.4 -4.8"/><path d="M3.2 -6.6L8.4 -11.6Q13.6 -8 12.2 -3.2L5.8 -3.4Z"/><path d="M0.6 -2.6L4.2 -6.2"/>';
const AXE_LYING = '<path d="M-11 4.8L4.6 3.4"/><path d="M3.4 2.2L10.4 -2.8Q13.4 2.6 11.4 7.8L3.6 4.8Z"/><path d="M1.2 2.4L1.6 5.4"/>';
const FELL_NOTCH = '<path d="M-3 11V-11M3 11V-11"/><path d="M-3 -1.5L1.4 1.2L-3 3.8"/><path d="M5.8 -2.5L7.6 -4.4M6.4 1.2H9M5.8 4.8L7.6 6.6"/>';
const LOG_END = '<path d="M-10 3.5H6M-10 10.5H6"/><ellipse cx="6" cy="7" rx="2.4" ry="3.5"/><path d="M-10 3.5A2.4 3.5 0 0 0 -10 10.5"/><ellipse cx="6" cy="7" rx="0.7" ry="1.1"/>';
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
  // 0.32 "Piece by piece": a stick with an arrow down into a small lean-to frame (build the piece in)
  buildIn: '<g transform="translate(0 6.4) scale(0.62)"><path d="M-11 11H11"/><path d="M-7 -6V11M6 6.3V11"/><path d="M-11 -9L11 4V8L-11 -5Z"/></g><path d="M-8 -10.6L8 -12.6"/><path d="M0 -7V-1.5M-3.4 -4.6L0 -1.2L3.4 -4.6"/>',
  dig: '<ellipse cx="0" cy="9" rx="9.5" ry="2.8"/><path d="M-5.5 -4C-5 -7 -4.5 -9 -4.5 -10.5M-2 -5C-1.8 -8 -1.6 -10.5 -1.6 -12M1.8 -5C2 -8 2.2 -10.5 2.2 -12M5.5 -4C5.2 -7 5 -9 5 -10.5"/><path d="M-5.5 -4C-6 0 -4 4 0 4.5C4 4 6 0 5.5 -4"/><path d="M-12 1L-9.5 3.2M12 1L9.5 3.2M-10 -3L-8 -2M10 -3L8 -2"/>',
  roast: `<g transform="translate(0 -5.5) scale(0.9)">${CRAB_PATHS}</g><g transform="translate(0 8.5) scale(0.58)">${FLAME}</g><path d="M-8 11.5H8"/>`,
  // 0.30.17 "Spear": a spear (make it), the same lying with an arrow up (take it up) or down (lay it down), a fish over a line of water (fish) and a fish over a flame (roast the fish)
  spear: SPEAR,
  takeSpear: `<g transform="translate(0 4)">${SPEAR_LYING}</g><path d="M0 1V-11M-3.5 -7.5L0 -11L3.5 -7.5"/>`,
  laySpear: `<g transform="translate(0 4)">${SPEAR_LYING}</g><path d="M0 -11V0M-3.5 -3.5L0 0L3.5 -3.5"/>`,
  fish: `<g transform="translate(0 -2) scale(1.1)">${FISH_PATHS}</g><path d="M-10.5 9.5C-8 8 -5.5 11 -3 9.5C-0.5 8 2 11 4.5 9.5C6.5 8.4 8.5 10.4 10.5 9.5"/>`,
  roastFish: `<g transform="translate(0 -5.5) scale(0.9)">${FISH_PATHS}</g><g transform="translate(0 8.5) scale(0.58)">${FLAME}</g><path d="M-8 11.5H8"/>`,
  fill: `<g transform="translate(-9.5 -8.5) scale(0.95)">${DRAWINGS.shell}</g><g transform="translate(-3.2 -12.4) scale(0.45)"><path d="${DROP_PATH}"/></g>`,
  sip: `<g transform="rotate(-38) translate(-10 -13.5)">${DRAWINGS.water}</g>`,
  berries: `<g transform="translate(-7.2 -5.5) scale(0.72)">${DRAWINGS.berries}</g><path d="M0 -3V-11M-3.5 -7.5L0 -11L3.5 -7.5"/>`,
  bananas: `<g transform="translate(-7.2 -5.5) scale(0.72)">${DRAWINGS.banana}</g><path d="M0 -3V-11M-3.5 -7.5L0 -11L3.5 -7.5"/>`,
  eatBerries: `<g transform="translate(-10 -13)">${DRAWINGS.berries}</g>`,
  eatBanana: `<g transform="translate(-10 -13)">${DRAWINGS.banana}</g>`,
  walls: '<path d="M-11 11H11"/><path d="M-10 -9L10 3"/><path d="M-7 -7.5C-8.5 -2 -8 4 -6 10.5M-2 -5C-3.5 0 -3 6 -1 10.5M3 -2.5C1.5 2.5 2 7 4 10.5M8 0C7 3.5 7.5 7 9 10.5"/>',
  bed: '<path d="M-11 3H11"/><path d="M-9 3V11M9 3V11M0 3V11"/><path d="M-10 -1C-5 -6.5 5 -6.5 10 -1"/><path d="M-6 -4.2L-7 -0.8M-2 -5.6L-2.4 -1.6M2 -5.6L2.4 -1.6M6 -4.2L7 -0.8"/>',
  ring: '<g transform="translate(0 -3.5) scale(0.62)">' + FLAME + '</g><circle cx="-8.4" cy="6" r="2.5"/><circle cx="-4.4" cy="9.4" r="2.5"/><circle cx="2.4" cy="9.8" r="2.5"/><circle cx="8.2" cy="6.6" r="2.5"/><circle cx="7" cy="1" r="2.2"/><circle cx="-7.6" cy="0.6" r="2.2"/>',
  // 0.31 "Axe": an axe (make it), the same lying with an arrow up (take it up) or down (lay it down), a trunk with a notch (fell it), and a log with its end showing, an arrow up (pick it up) or down (lay it on the pile)
  axe: AXE,
  takeAxe: `<g transform="translate(0 4)">${AXE_LYING}</g><path d="M0 1V-11M-3.5 -7.5L0 -11L3.5 -7.5"/>`,
  layAxe: `<g transform="translate(0 4)">${AXE_LYING}</g><path d="M0 -11V0M-3.5 -3.5L0 0L3.5 -3.5"/>`,
  fell: FELL_NOTCH,
  pickupLog: LOG_END + '<path d="M0 1V-11M-3.5 -7.5L0 -11L3.5 -7.5"/>',
  layLog: LOG_END + '<path d="M0 -11V0M-3.5 -3.5L0 0L3.5 -3.5"/>',
  moon: '<path d="M3 -10.5A10 10 0 1 0 10.5 3A7.5 7.5 0 0 1 3 -10.5Z"/>',
};
export const ICON_OF = { pickup: 'pickup', lay: 'lay', fill: 'fill', sip: 'sip', husk: 'coconut', feed: 'feed', torch: 'torch', plant: 'plant', drink: 'drop', light: 'flame', buildHere: 'leanto', buildIn: 'buildIn', sleep: 'moon', dig: 'dig', roast: 'roast', berries: 'berries', bananas: 'bananas', eatBerries: 'eatBerries', eatBanana: 'eatBanana', makeSpear: 'spear', takeSpear: 'takeSpear', laySpear: 'laySpear', fish: 'fish', makeAxe: 'axe', takeAxe: 'takeAxe', layAxe: 'layAxe', fell: 'fell' };
export const LABEL_OF = { pickup: 'Pick up', lay: 'Lay down', fill: 'Fill the shell', sip: 'Sip water', husk: 'Husk and eat the coconut', feed: 'Feed the fire', torch: 'Take the torch', plant: 'Plant the torch', drink: 'Drink', light: 'Light the fire', buildHere: 'Build a lean-to here', buildIn: 'Build the piece in', sleep: 'Sleep', dig: 'Dig for the crab', roast: 'Roast the crab', berries: 'Pick berries', bananas: 'Pick bananas', eatBerries: 'Eat berries', eatBanana: 'Eat the banana', makeSpear: 'Make a spear', takeSpear: 'Take up the spear', laySpear: 'Lay the spear down', fish: 'Fish with the spear', roastFish: 'Roast the fish', makeAxe: 'Make an axe', takeAxe: 'Take up the axe', layAxe: 'Lay the axe down', fell: 'Chop the tree down', pickupLog: 'Lift the log onto the shoulder', layLog: 'Lay the log on the pile', walls: 'Build the side walls', bed: 'Build a bed', ring: 'Build a stone ring' };

const roastsFish = a => a.kind === 'roast' && a.food === 'fish';   // 0.30.17: the roast of a fish has its own drawing
const takesLog = a => a.kind === 'pickup' && !!a.thing && ((a.thing.kind === 'log' && !!a.thing.log && !!a.thing.log.timber) || (a.thing.kind === 'pile' && !!a.thing.pile && a.thing.pile.kind === 'log'));   // 0.31: a log (or a pile of logs) has its own drawing
const kindOf = (a, log) => a.kind === 'upgrade' ? a.what : roastsFish(a) ? 'roastFish' : takesLog(a) ? 'pickupLog' : log && a.kind === 'lay' ? 'layLog' : a.kind;
const iconKey = (a, log) => a ? (a.kind === 'upgrade' ? a.what : roastsFish(a) ? 'roastFish' : (takesLog(a) || (log && a.kind === 'lay')) ? kindOf(a, log) : ICON_OF[a.kind]) || null : null;   // an upgrade shows what it builds
const labelOf = (a, log) => LABEL_OF[kindOf(a, log)] || '';

export function buttonIcons(action, log = false) {
  const options = action && action.options ? action.options.map(o => ({ key: iconKey(o, log), label: labelOf(o, log) })).filter(o => o.key) : [];
  return { main: action ? iconKey(action.tap, log) : null, options };
}

export const buttonOpacity = (icons, down = false) => icons.main ? (down ? HELD : CLEAR) : FAINT;

/** Where the n icons of the arc sit, in px from the middle of the ring (y down): on a circle of ARC_R, ARC_STEP degrees apart, leaning left on a desktop. */
export function arcSpots(n, touch = false) {
  return Array.from({ length: n }, (_, i) => {
    const a = ((i - (n - 1) / 2) * ARC_STEP + (touch ? 0 : ARC_LEAN)) * Math.PI / 180;
    return { x: +(ARC_R * Math.sin(a)).toFixed(1), y: +(-ARC_R * Math.cos(a)).toFixed(1) };
  });
}

const placed = (key, x, y, s) => key ? `<g transform="translate(${x} ${y}) scale(${s})">${ICONS[key]}</g>` : '';

export function createActionButton(el, input, arc = null, touch = false) {
  if (!el) return null;
  const main = el.querySelector('.main');
  let id = null, key = '', down = false, shownOpacity = '', arcKey = '', picking = null;
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
  // the icons of the arc: one listener on the box; a press on an icon is its own and never reaches the world
  const optOf = e => { const o = e.target && e.target.closest ? e.target.closest('.opt') : null; return o ? Number(o.dataset.i) : -1; };
  const adn = e => { const i = optOf(e); if (i < 0) return; e.preventDefault(); e.stopPropagation(); if (!picking) picking = { id: e.pointerId, i }; };
  const aup = e => {
    if (!picking || e.pointerId !== picking.id) return;
    e.stopPropagation(); const p = picking; picking = null;
    if (e.type === 'pointerup') input.choose(p.i);
  };
  if (arc) { arc.addEventListener('pointerdown', adn); arc.addEventListener('pointerup', aup); arc.addEventListener('pointercancel', aup); arc.addEventListener('contextmenu', menu); }
  function update(action, log = false) {
    const icons = buttonIcons(action, log);
    if ((icons.main || '') !== key) {
      key = icons.main || '';
      main.innerHTML = placed(icons.main, 0, 0, MAIN_ALONE);
      el.classList.toggle('on', !!icons.main);
    }
    const o = buttonOpacity(icons, down || (input.pressing && input.pressing())).toFixed(2);
    if (o !== shownOpacity) { shownOpacity = o; el.style.opacity = o; }
    if (arc) {
      const k = icons.options.map(x => x.key).join('|');
      if (k !== arcKey) {
        arcKey = k;
        const spots = arcSpots(icons.options.length, touch), c = ARC_BOX / 2 - OPT_SIZE / 2;
        arc.innerHTML = icons.options.map((x, i) => `<div class="opt" role="button" aria-label="${x.label}" data-i="${i}" style="left:${(c + spots[i].x).toFixed(1)}px;top:${(c + spots[i].y).toFixed(1)}px"><svg viewBox="-13.5 -13.5 27 27">${ICONS[x.key]}</svg></div>`).join('');
      }
    }
  }
  return { update, dispose() {
    el.removeEventListener('pointerdown', dn); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); el.removeEventListener('lostpointercapture', up); el.removeEventListener('contextmenu', menu);
    if (arc) { arc.removeEventListener('pointerdown', adn); arc.removeEventListener('pointerup', aup); arc.removeEventListener('pointercancel', aup); arc.removeEventListener('contextmenu', menu); }
  } };
}
