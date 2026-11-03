/**
 * render/carryMark — the quiet row of small ink drawings next to the moon
 * mark that shows what the castaway carries loose. For now only the tufts
 * of coconut fibre (game/fibre `carried`, 0..3); wood and the torch are in
 * his hands or on the ground and never in the row. Later items (nails, a
 * knife, ...) add a key to ITEMS and a drawing to DRAWINGS.
 *
 * Same ink as the moon (`--ink`, render/ink), journal-style strokes, no boxes, frames,
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

export const ITEMS = ['fibre'];
export const REST_OPACITY = 0.3, PEAK_OPACITY = 0.85;
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

// each drawing is the inner SVG of a 0 0 20 26 box: a few loose curved
// strokes tied together at one end (round caps, no fill)
export const DRAWINGS = {
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
