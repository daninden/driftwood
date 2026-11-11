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
 * clearer as hunger grows from the half of the way to hungry on, and clear for
 * a few seconds after eating (the same curve as render/thirstMark and
 * render/carryMark). No numbers. It sits in #needs (index.html) right after
 * the drop.
 *
 * SHELL_PATH, RIM_PATH       the outlines in the 24 × 24 box
 * hungerClip(fill) -> { y, h }   the part of the box that is filled: from the
 *   bottom of the shell up to the rim, fill 0..1 in steps of 1/FILL_STEPS. Pure.
 * hungerOpacity(days, since) -> 0..1   opacity from the days of hunger and the
 *   seconds since the last meal. Pure.
 * ate(prev, days) -> bool   true when hunger fell (he ate). Pure.
 * createHungerMark(el) -> { update(days, now) }   el: the #hunger svg
 *   (index.html), holding a <clipPath> with a <rect> and a .lit path; days:
 *   game/hunger `days`; now: seconds (any steady clock). Only touches the DOM
 *   when the filling or the opacity step changed.
 *
 * Depends on: core/math, render/carryMark, game/hunger (STARVING_AT, hungerFill)
 */
import { ss } from '../core/math.js';
import { carryOpacity, REST_OPACITY, PEAK_OPACITY } from './carryMark.js';
import { STARVING_AT, hungerFill } from '../game/hunger.js';

export const FILL_STEPS = 48;
export const CLEAR_FROM = 0.25, CLEAR_TO = STARVING_AT;   // days of hunger: starts getting clearer (half of the way to hungry, as for the drop), fully clear
const TOP = 8, BOTTOM = 22;                            // the rim line and the bottom of the shell in the 0 0 24 24 box
export const SHELL_PATH = 'M2 8C2 16.5 6.5 22 12 22C17.5 22 22 16.5 22 8Z';
export const RIM_PATH = 'M2 8A10 3 0 1 1 22 8A10 3 0 1 1 2 8Z';

export function hungerClip(fill) {
  const f = Math.round(Math.min(1, Math.max(0, fill)) * FILL_STEPS) / FILL_STEPS, span = BOTTOM - TOP;
  return { y: +(TOP + span * (1 - f)).toFixed(3), h: +(span * f).toFixed(3) };
}

export const hungerOpacity = (days, since = Infinity) =>
  Math.max(REST_OPACITY + (PEAK_OPACITY - REST_OPACITY) * ss(CLEAR_FROM, CLEAR_TO, days), carryOpacity(since));

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
