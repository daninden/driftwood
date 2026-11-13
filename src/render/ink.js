/**
 * render/ink — the colour of the ink marks, which turns pale at night.
 *
 * All ink on screen (the moon #rest, the drop #thirst, the row #carry, the thumb stick #stick, the action button #action, the tally marks (render/tallyMarks),
 * the dev panel #dev, the name line #who and the waking line #wake) takes its
 * colour from the CSS custom property `--ink`: dark brown by day, pale warm
 * paper at night. At middle dusk or dawn the ink moves over 0.9 seconds while
 * its opposite glow holds, then the glow changes at the end. Thus one side
 * always remains clear and the two mid tones never meet. The dev panel's faint backing
 * (`--ink-back`) turns the other way, from light sand to dark brown, so its
 * text stays readable. The day line and the waking line, and since 0.13.3 every
 * mark (action button, thumb stick, moon, drop, fibre, tally marks), also get a soft glow
 * behind the letters or strokes in the opposite colour (`--ink-glow`: pale paper by day, dark brown
 * at night), no frame. The loading screen keeps its own dark brown.
 * 0.36.7 (legibility, variant "D, a little stronger", chosen by the user from rendered proposals): the Voice line, the name line and the waking line get a
 * denser outline in the glow colour (`--ink-outline` in index.html: a 1 px edge on four sides and glows of 4, 8 and 14 px), and the gesture marks, the
 * moon, the drop, the hunger mark, the sound mark and the carried row a stronger halo (`--halo-strong`: drop shadows of 1, 1, 3, 6 and 10 px); still no
 * backdrop or frame. Both are built from `--ink-glow`, so they follow this module's day and night switch; nothing changes here in code.
 *
 * INK_DAY (0x2e2418), INK_NIGHT (0xefe0c2), BACK_ALPHA (0.4), GLOW_ALPHA (0.85)
 * SWITCH (0.9 s)               the short real-time ink transition at dusk/dawn
 * inkStep(day) -> int          1 (day) or 0 (night), switching at middle light. Pure.
 * inkColor(step) -> '#rrggbb'  the ink at that step. Pure.
 * inkBack(step) -> 'rgba(...)' the dev panel backing at that step. Pure.
 * inkGlow(step) -> 'rgba(...)' the glow behind the day and waking lines. Pure.
 * createInk(root) -> { update(day, now?) }   root: the element that carries
 *   properties (document.documentElement); `now` is real seconds and only
 *   the brief switch writes per frame.
 *
 * Depends on: core/math
 */
import { hex, mix } from '../core/math.js';

export const INK_DAY = 0x2e2418, INK_NIGHT = 0xefe0c2, BACK_ALPHA = 0.4, GLOW_ALPHA = 0.85;
export const STEPS = 24, SWITCH = 0.9;

export const inkStep = day => (Number.isFinite(day) && day < 0.5 ? 0 : STEPS);

const rgb = (from, to, step) => mix(hex(from), hex(to), 1 - step / STEPS).map(v => Math.round(v * 255));
const two = n => n.toString(16).padStart(2, '0');

export const inkColor = step => '#' + rgb(INK_DAY, INK_NIGHT, step).map(two).join('');
export const inkBack = step => `rgba(${rgb(INK_NIGHT, INK_DAY, step).join(', ')}, ${BACK_ALPHA})`;

export const inkGlow = step => `rgba(${rgb(INK_NIGHT, INK_DAY, step).join(', ')}, ${GLOW_ALPHA})`;

export function createInk(root) {
  let target = -1, ink = 1, from = 1, began = 0, glow = 1, lastInk = -1, lastGlow = -1;
  function write(nextInk, nextGlow) {
    const i = Math.round(nextInk * STEPS), g = Math.round(nextGlow * STEPS);
    if (i !== lastInk) { lastInk = i; root.style.setProperty('--ink', inkColor(i)); root.style.setProperty('--ink-back', inkBack(i)); }
    if (g !== lastGlow) { lastGlow = g; root.style.setProperty('--ink-glow', inkGlow(g)); }
  }
  function update(day, now = 0) {
    if (!root) return;
    const next = inkStep(day) / STEPS;
    if (target < 0) { target = next; ink = glow = next; write(ink, glow); return; }
    if (next !== target) { from = ink; target = next; began = now; }
    const p = Math.max(0, Math.min(1, (now - began) / SWITCH));
    ink = from + (target - from) * p;
    // Hold the opposite glow during the colour change. The final flip avoids
    // a long pale-on-pale or dark-on-dark middle at the transition threshold.
    if (p >= 1) glow = target;
    write(ink, glow);
  }
  return { update };
}
