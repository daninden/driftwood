/**
 * render/carryMark — the quiet row of small ink drawings next to the moon
 * mark that shows what the castaway carries loose. For now only the tufts
 * of coconut fibre (game/fibre `carried`, 0..3) and, since 0.16, one twig with a
 * leaf for each branch carried (`branch`) and, since 0.22, one small crab for each crab carried (`crab`, at most two, game/crabs); since 0.26 (game/forage) a little cluster of berries for each handful carried (`berries`, at most two) and a bunch of bananas (`banana`, at most one); since 0.25 (game/shells) one whole coconut for each nut carried (`nut`, at most two), an empty half shell (`shell`) and a half shell with water in it (`water`), both at most two together; one weathered
 * log for each piece of driftwood carried (`driftwood`, wood that is not a branch; wet or dry it looks the same), drawn before the branches. The torch
 * is in his hand and never in the row. Later items (nails, a
 * knife, ...) add a key to ITEMS and a drawing to DRAWINGS.
 *
 * Same ink as the moon (`--ink`, render/ink), strokes 2 px with the glow `--halo` behind them (index.html, 0.13.3), journal-style strokes, no boxes, frames,
 * numbers or labels, and no placeholders: with nothing carried the row is
 * empty. It is faint most of the time, clear for a few seconds after
 * something is added or used up, then fades back.
 *
 * ITEMS                       the item keys in the order they are drawn
 * DRAWINGS                    the inner SVG of each item, in a 0 0 20 26 box (the action button reuses the fibre)
 * REST_OPACITY, PEAK_OPACITY, HOLD, EASE   the opacity curve (seconds)
 * carryItems(state) -> [key]  one key per thing carried, e.g. { fibre: 2 } -> ['fibre', 'fibre']. Pure.
 * carryChanged(a, b) -> bool  true when the counts differ. Pure.
 * carryOpacity(since) -> 0..1 opacity `since` seconds after the last change. Pure.
 * createCarryMark(el) -> { update(state, now) }   el: the #carry element
 *   (index.html); state: e.g. { fibre: n }; now: seconds (any steady clock).
 *   Only touches the DOM when the drawings or the opacity step changed.
 *
 * Depends on: core/math
 */
import { ss } from '../core/math.js';

export const ITEMS = ['fibre', 'driftwood', 'branch', 'crab', 'berries', 'banana', 'nut', 'shell', 'water'];
export const REST_OPACITY = 0.5, PEAK_OPACITY = 0.95;
export const HOLD = 3, EASE = 2;   // seconds held clear, then easing back

export function carryItems(state) {
  const out = [];
  for (const key of ITEMS) {
    const n = Math.max(0, Math.floor((state && state[key]) || 0));
    for (let i = 0; i < n; i++) out.push(key);
  }
  return out;
}

export const carryChanged = (a, b) => ITEMS.some(k => ((a && a[k]) || 0) !== ((b && b[k]) || 0));

export function carryOpacity(since) {
  if (!(since >= 0) || since >= HOLD + EASE) return REST_OPACITY;
  if (since <= HOLD) return PEAK_OPACITY;
  return PEAK_OPACITY + (REST_OPACITY - PEAK_OPACITY) * ss(0, 1, (since - HOLD) / EASE);
}

// a crab seen from above in a -10..10 box: round body, two eye stalks, two claws and three legs a side (the action button reuses it)
export const CRAB_PATHS = '<ellipse cx="0" cy="1" rx="6.3" ry="4.3"/><path d="M-2.4 -3V-6M2.4 -3V-6"/><path d="M-5.2 -1.6C-8.6 -2.6 -9.6 -5.6 -8 -8.2C-6.4 -7.4 -5.6 -5.4 -4.6 -3.4M5.2 -1.6C8.6 -2.6 9.6 -5.6 8 -8.2C6.4 -7.4 5.6 -5.4 4.6 -3.4"/><path d="M-6 0.2L-9.8 -0.2M-5.8 2.4L-9.6 3.6M-4.4 4.8L-7.4 7.8M6 0.2L9.8 -0.2M5.8 2.4L9.6 3.6M4.4 4.8L7.4 7.8"/>';

const SHELL_EMPTY = '<path d="M2.6 10C3 17.6 6.2 22.4 10 22.4C13.8 22.4 17 17.6 17.4 10"/><ellipse cx="10" cy="10" rx="7.4" ry="2.6"/>';
const SHELL_FULL = SHELL_EMPTY + '<path d="M5.4 14.4C7.4 13 9 15.4 10 14.4C11 13.4 12.6 15.8 14.6 14.4"/><path d="M8.4 18.6H11.6"/>';

// each drawing is the inner SVG of a 0 0 20 26 box: a few loose curved
// strokes tied together at one end (round caps, no fill)
export const DRAWINGS = {
  branch: '<path d="M4 23C7 17 11 11 16 3"/><path d="M8.6 17C11 16.5 13.5 17.5 15 19.5"/><path d="M12 10.8C10.5 8.6 8 8 5.5 8.8"/><path d="M13.6 7C15.5 6 17.5 6.5 18.5 8"/>',
  driftwood: '<path d="M5.4 21C7.2 15 10.6 9 14.2 4.8C15.6 3.4 17.6 4.4 17 6.2C14.8 11.4 11.2 17.6 8.4 22.6C7.4 24.4 4.6 23.4 4.8 21.8C4.8 21.5 5.2 21 5.4 21Z"/><path d="M8.2 18.4C10 14.8 12 11.6 14 8.6"/><path d="M10.6 19.2C11.6 17.4 12.6 15.8 13.4 14.4"/>',
  crab: `<g transform="translate(10 13.5) scale(0.95)">${CRAB_PATHS}</g>`,
  // 0.25: a whole coconut with its three eyes, a half shell seen from the side (bowl and oval rim), and the same with water in it (a wavy water line and a ripple stroke)
  nut: '<path d="M10 5.6C14.6 5.6 17.4 9.4 17.4 14C17.4 19 14.2 22.6 10 22.6C5.8 22.6 2.6 19 2.6 14C2.6 9.4 5.4 5.6 10 5.6Z"/><path d="M10 5.6C10.4 4.4 11.4 3.4 12.6 3"/><circle cx="7.8" cy="11.2" r="0.9"/><circle cx="12.2" cy="11.2" r="0.9"/><circle cx="10" cy="14.4" r="0.9"/>',
  // 0.26: a cluster of seven berries hanging from a short stem with a leaf, and a bunch of three bananas on a stalk
  berries: '<path d="M10 7.6V2.8"/><path d="M10 7.6C12.4 4.4 15.6 3.8 17.4 5C16.4 8 13.2 9 10 7.6Z"/><circle cx="6.8" cy="11.4" r="2.5"/><circle cx="13.2" cy="11.4" r="2.5"/><circle cx="4.2" cy="17" r="2.5"/><circle cx="10" cy="16.6" r="2.5"/><circle cx="15.8" cy="17" r="2.5"/><circle cx="7.2" cy="22" r="2.5"/><circle cx="12.8" cy="22" r="2.5"/>',
  banana: '<path d="M9 3V8"/><path d="M9 8C3.6 10 3.2 17.6 8 22.8C7.2 17.2 7.8 12.4 9 8Z"/><path d="M9 8C7.2 13 7.2 18.4 10 23.4C12.6 18.4 11.8 12.6 9 8Z"/><path d="M9 8C14.4 10 16.8 17.4 12.2 22.8C12.4 17.2 10.6 12.4 9 8Z"/>',
  shell: SHELL_EMPTY,
  water: SHELL_FULL,
  fibre: '<path d="M10 20C8 14 4.5 10 3 5.5"/><path d="M10 20C9.5 14 8 9 7.5 3.5"/><path d="M10 20C10.5 13 11.5 9 12.5 3"/><path d="M10 20C12 14 15 10 17 6"/><path d="M10 20C11 16 14 14 16 12.5"/><path d="M8.2 19.6L11.8 21.4M8.4 21.6L11.6 23.4"/>',
};
const svg = key => `<svg viewBox="0 0 20 26" aria-hidden="true">${DRAWINGS[key]}</svg>`;

export function createCarryMark(el) {
  let prev = null, changedAt = -Infinity, html = null, shown = '';
  function update(state, now) {
    if (!el) return;
    if (prev && carryChanged(prev, state)) changedAt = now;
    prev = { ...state };
    const h = carryItems(state).map(svg).join('');
    if (h !== html) { html = h; el.innerHTML = h; }
    const o = carryOpacity(now - changedAt).toFixed(2);
    if (o !== shown) { shown = o; el.style.opacity = o; }
  }
  return { update };
}
