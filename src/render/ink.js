/**
 * render/ink — the colour of the ink marks, which turns pale at night.
 *
 * All ink on screen (the moon #rest, the drop #thirst, the row #carry, the thumb stick #stick, the action button #action, the tally marks (render/tallyMarks),
 * the dev panel #dev, the name line #who and the waking line #wake) takes its
 * colour from the CSS custom property `--ink`: dark brown by day, pale warm
 * paper at night, blending through dusk and dawn on the same curve as the
 * light of the world (render/sky `day`). The dev panel's faint backing
 * (`--ink-back`) turns the other way, from light sand to dark brown, so its
 * text stays readable. The day line and the waking line, and since 0.13.3 every
 * mark (action button, thumb stick, moon, drop, fibre, tally marks), also get a soft glow
 * behind the letters or strokes in the opposite colour (`--ink-glow`: pale paper by day, dark brown
 * at night), no frame. The loading screen keeps its own dark brown.
 *
 * INK_DAY (0x2e2418), INK_NIGHT (0xefe0c2), BACK_ALPHA (0.4), GLOW_ALPHA (0.85)
 * STEPS (24)                   the day factor is rounded to 1/STEPS, so the
 *                              style is written only when it changes noticeably
 * inkStep(day) -> int          the day factor 1 (day) .. 0 (night) as a step 0..STEPS. Pure.
 * inkColor(step) -> '#rrggbb'  the ink at that step. Pure.
 * inkBack(step) -> 'rgba(...)' the dev panel backing at that step. Pure.
 * inkGlow(step) -> 'rgba(...)' the glow behind the day and waking lines. Pure.
 * createInk(root) -> { update(day) }   root: the element that carries the
 *   properties (document.documentElement); update(day) takes sky.day and
 *   touches the DOM only when the step changed.
 *
 * Depends on: core/math
 */
import { hex, mix } from '../core/math.js';

export const INK_DAY = 0x2e2418, INK_NIGHT = 0xefe0c2, BACK_ALPHA = 0.4, GLOW_ALPHA = 0.85;
export const STEPS = 24;

export const inkStep = day => Math.round(Math.min(1, Math.max(0, Number.isFinite(day) ? day : 1)) * STEPS);

const rgb = (from, to, step) => mix(hex(from), hex(to), 1 - step / STEPS).map(v => Math.round(v * 255));
const two = n => n.toString(16).padStart(2, '0');

export const inkColor = step => '#' + rgb(INK_DAY, INK_NIGHT, step).map(two).join('');
export const inkBack = step => `rgba(${rgb(INK_NIGHT, INK_DAY, step).join(', ')}, ${BACK_ALPHA})`;

export const inkGlow = step => `rgba(${rgb(INK_NIGHT, INK_DAY, step).join(', ')}, ${GLOW_ALPHA})`;

export function createInk(root) {
  let last = -1;
  function update(day) {
    if (!root) return;
    const s = inkStep(day);
    if (s === last) return;
    last = s;
    root.style.setProperty('--ink', inkColor(s));
    root.style.setProperty('--ink-back', inkBack(s));
    root.style.setProperty('--ink-glow', inkGlow(s));
  }
  return { update };
}
