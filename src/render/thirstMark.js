/**
 * render/thirstMark — the drop: a need mark next to the moon that shows how
 * thirsty the castaway is.
 *
 * A drop drawn in outline, in the ink of the moon (`--ink`, pale at night,
 * render/ink). Its filling empties as he gets thirsty: full just after a
 * drink, half full when he goes to drink himself (0.35 day), a quarter when thirsty, empty when he is about to
 * collapse (game/thirst `fill`, thirstFill: a curve in three pieces, 0.31.1 "Milk"). Always
 * shown, faint like the moon (REST_OPACITY) when the drop is full, and clearer as it empties: the opacity follows the filling (0.33.2 "Mend"), halfway
 * between REST_OPACITY and PEAK_OPACITY when it is half full (the day he goes to drink himself) and PEAK_OPACITY when it is empty; and clear for a few
 * seconds after drinking (the curve of render/carryMark). No numbers. Rim 2 px with the glow `--halo` (index.html, 0.13.3). It
 * sits in #needs (index.html) between the moon and the row of what he
 * carries; the half coconut of hunger (render/hungerMark) comes right after it.
 *
 * DROP_PATH                  the outline of the drop in its 16 × 24 box
 * dropClip(fill) -> { y, h }   the part of the drop's 16 × 24 box that is filled,
 *   from the bottom, fill 0..1 in steps of 1/FILL_STEPS. Pure.
 * fillOpacity(fill) -> 0..1   opacity from the filling: REST_OPACITY full, PEAK_OPACITY empty, linear in between. Pure.
 * thirstOpacity(days, since) -> 0..1   opacity from the filling at the days of thirst (thirstFill), at least the carry flash for the
 *   seconds since the last drink. Pure.
 * drank(prev, days) -> bool   true when thirst fell (he drank). Pure.
 * createThirstMark(el) -> { update(days, now) }   el: the #thirst svg
 *   (index.html), holding a <clipPath> with a <rect> and a .lit path; days: game/thirst
 *   `days`; now: seconds (any steady clock). Only touches the DOM when the
 *   filling or the opacity step changed.
 *
 * Depends on: render/carryMark, game/thirst (thirstFill)
 */
import { carryOpacity, REST_OPACITY, PEAK_OPACITY } from './carryMark.js';
import { thirstFill } from '../game/thirst.js';

export const FILL_STEPS = 48;
const H = 24;
export const DROP_PATH = 'M8 1C10 5 14 10 14 15.5A6 6 0 0 1 2 15.5C2 10 6 5 8 1Z';   // the drop in a 0 0 16 24 box (the action button reuses it)

export function dropClip(fill) {
  const f = Math.round(Math.min(1, Math.max(0, fill)) * FILL_STEPS) / FILL_STEPS;
  return { y: +(H * (1 - f)).toFixed(3), h: +(H * f).toFixed(3) };
}

// 0.33.2 "Mend": the opacity follows the filling, not the days: REST_OPACITY when full, halfway to PEAK_OPACITY at half full (where he goes to drink himself), PEAK_OPACITY when empty
export const fillOpacity = fill => { const e = 1 - Math.min(1, Math.max(0, fill)); return REST_OPACITY + (PEAK_OPACITY - REST_OPACITY) * e; };
export const thirstOpacity = (days, since = Infinity) => Math.max(fillOpacity(thirstFill(days)), carryOpacity(since));

export const drank = (prev, days) => prev !== null && days < prev - 0.05;

export function createThirstMark(el) {
  const rect = el && el.querySelector('rect');
  let prev = null, drankAt = -Infinity, shownClip = '', shownOpacity = '';
  function update(days, now) {
    if (!el) return;
    if (drank(prev, days)) drankAt = now;
    prev = days;
    const c = dropClip(thirstFill(days)), key = c.y + ',' + c.h;
    if (key !== shownClip) { shownClip = key; rect.setAttribute('y', c.y); rect.setAttribute('height', c.h); }
    const o = thirstOpacity(days, now - drankAt).toFixed(2);
    if (o !== shownOpacity) { shownOpacity = o; el.style.opacity = o; }
  }
  return { update };
}
