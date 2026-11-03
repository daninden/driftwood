/**
 * render/nameLines — the two lines of writing in the game, both in the ink of
 * the marks (render/ink), no boxes:
 *
 *   #who   top left, always: `Dave, day 3` (`The castaway, day 3` without a
 *          name; texts from game/castaway). Faint like the moon most of the
 *          time, clearer for a few seconds when it first appears and when a
 *          new day begins, then easing back (the same curve as the carry row,
 *          render/carryMark).
 *   #wake  in the middle of the screen, about 22 px: `Dave wakes. Day 3.`, fading in and
 *          out over WAKE_TIME seconds whenever a sleep ends, however it ends.
 *
 * WAKE_TIME (5), WAKE_IN (1), WAKE_OUT (1.4), WAKE_PEAK (0.95), DAY_REST (0.55), DAY_PEAK (0.9)
dayOpacity(since) -> 0..1   opacity of the day line `since` seconds after its text changed. Pure.
 * wakeOpacity(since) -> 0..1   opacity `since` seconds after the wake line was shown. Pure.
 * createDayLine(el) -> { update(text, now) }   el: #who (index.html). The text
 *   changes only when the day does; each change (and the first text) makes
 *   it clear again. Touches the DOM when the text or the opacity step changed.
 * createWakeLine(el) -> { show(text, now), update(now) }   el: #wake.
 *   show starts the fade; update (every frame) sets the opacity.
 * now: seconds on any steady clock.
 *
 * Depends on: core/math, render/carryMark
 */
import { ss } from '../core/math.js';
import { carryOpacity, HOLD, EASE, REST_OPACITY, PEAK_OPACITY } from './carryMark.js';

export const WAKE_TIME = 5, WAKE_IN = 1, WAKE_OUT = 1.4, WAKE_PEAK = 0.95;
export const DAY_REST = 0.55, DAY_PEAK = 0.9;   // the day line rests at DAY_REST and goes to DAY_PEAK when it first shows and when a day turns

/** Opacity of the day line `since` seconds after its text changed: the curve of the carry row, between DAY_PEAK and DAY_REST. */
export function dayOpacity(since) {
  if (!(since >= 0) || since >= HOLD + EASE) return DAY_REST;
  return DAY_REST + (DAY_PEAK - DAY_REST) * (carryOpacity(since) - REST_OPACITY) / (PEAK_OPACITY - REST_OPACITY);
}

export function wakeOpacity(since) {
  if (!(since > 0) || since >= WAKE_TIME) return 0;
  return WAKE_PEAK * Math.min(ss(0, WAKE_IN, since), 1 - ss(WAKE_TIME - WAKE_OUT, WAKE_TIME, since));
}

export function createDayLine(el) {
  let text = null, changedAt = -Infinity, shown = '';
  function update(next, now) {
    if (!el) return;
    if (next !== text) { changedAt = now; text = next; el.textContent = next; }
    const o = dayOpacity(now - changedAt).toFixed(2);
    if (o !== shown) { shown = o; el.style.opacity = o; }
  }
  return { update };
}

export function createWakeLine(el) {
  let at = -Infinity, shown = '';
  const show = (text, now) => { if (!el) return; el.textContent = text; at = now; };
  function update(now) {
    if (!el) return;
    const o = wakeOpacity(now - at).toFixed(2);
    if (o !== shown) { shown = o; el.style.opacity = o; }
  }
  return { show, update };
}
