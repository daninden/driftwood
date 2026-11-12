/**
 * render/hungerMark — the half coconut: a need mark next to the drop that
 * shows how hungry the castaway is.
 *
 * A half coconut seen from the side, drawn in outline: the round shell below
 * and the oval rim on top, in the ink of the moon and the drop (`--ink`, pale
 * at night, render/ink; rim 2 px with the glow `--halo`, index.html). Its
 * white flesh is the filling and empties from the top down as he gets hungry:
 * full just after eating, half full when he goes to eat himself (0.4 day), a quarter when hungry, empty when he is starving
 * (game/hunger `fill`, hungerFill: a curve in three pieces, 0.31.1 "Milk").
 * Always shown, faint like the moon (REST_OPACITY) while he is not hungry,
 * clearer as the shell empties: the opacity follows the filling (0.33.2 "Mend"), halfway between REST_OPACITY and PEAK_OPACITY when it is half full (the day he goes
 * to eat himself) and PEAK_OPACITY when it is empty; and clear for a few seconds after eating (the same curve as render/thirstMark and
 * render/carryMark). No numbers. It sits in #needs (index.html) right after
 * the drop.
 *
 * SHELL_PATH, RIM_PATH       the outlines in the 24 × 24 box
 * hungerClip(fill) -> { y, h }   the part of the box that is filled: from the
 *   bottom of the shell up to the rim, fill 0..1 in steps of 1/FILL_STEPS. Pure.
 * fillOpacity(fill) -> 0..1   opacity from the filling: REST_OPACITY full, PEAK_OPACITY empty, linear in between. Pure.
 * hungerOpacity(days, since) -> 0..1   opacity from the filling at the days of hunger (hungerFill), at least the carry flash for the
 *   seconds since the last meal. Pure.
 * ate(prev, days) -> bool   true when hunger fell (he ate). Pure.
 * createHungerMark(el) -> { update(days, now) }   el: the #hunger svg
 *   (index.html), holding a <clipPath> with a <rect> and a .lit path; days:
 *   game/hunger `days`; now: seconds (any steady clock). Only touches the DOM
 *   when the filling or the opacity step changed.
 *
 * Depends on: render/carryMark, game/hunger (hungerFill)
 */
import { carryOpacity, REST_OPACITY, PEAK_OPACITY } from './carryMark.js';
import { hungerFill } from '../game/hunger.js';

export const FILL_STEPS = 48;
const TOP = 8, BOTTOM = 22;                            // the rim line and the bottom of the shell in the 0 0 24 24 box
export const SHELL_PATH = 'M2 8C2 16.5 6.5 22 12 22C17.5 22 22 16.5 22 8Z';
export const RIM_PATH = 'M2 8A10 3 0 1 1 22 8A10 3 0 1 1 2 8Z';

export function hungerClip(fill) {
  const f = Math.round(Math.min(1, Math.max(0, fill)) * FILL_STEPS) / FILL_STEPS, span = BOTTOM - TOP;
  return { y: +(TOP + span * (1 - f)).toFixed(3), h: +(span * f).toFixed(3) };
}

// 0.33.2 "Mend": the opacity follows the filling, not the days: REST_OPACITY when full, halfway to PEAK_OPACITY at half full (where he goes to eat himself), PEAK_OPACITY when empty
export const fillOpacity = fill => { const e = 1 - Math.min(1, Math.max(0, fill)); return REST_OPACITY + (PEAK_OPACITY - REST_OPACITY) * e; };
export const hungerOpacity = (days, since = Infinity) => Math.max(fillOpacity(hungerFill(days)), carryOpacity(since));

export const ate = (prev, days) => prev !== null && days < prev - 0.05;

export function createHungerMark(el) {
  const rect = el && el.querySelector('rect');
  let prev = null, ateAt = -Infinity, shownClip = '', shownOpacity = '';
  function update(days, now) {
    if (!el) return;
    if (ate(prev, days)) ateAt = now;
    prev = days;
    const c = hungerClip(hungerFill(days)), key = c.y + ',' + c.h;
    if (key !== shownClip) { shownClip = key; rect.setAttribute('y', c.y); rect.setAttribute('height', c.h); }
    const o = hungerOpacity(days, now - ateAt).toFixed(2);
    if (o !== shownOpacity) { shownOpacity = o; el.style.opacity = o; }
  }
  return { update };
}
