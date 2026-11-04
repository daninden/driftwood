/**
 * render/restMark — the one mark on screen: a small moon that shows how
 * long the castaway can still go without sleep.
 *
 * Full when he is rested, it wanes like the moon to a thin sickle and then
 * to nothing as the day and a half runs out (game/sleep `rest`), and waxes again
 * while he sleeps. It is quiet (faint) most of the time and grows clearer
 * in the last half day of it (CLEAR_BELOW); resting opacity 0.5, up to 0.95. Thicker rim (1.8) and a glow behind it (`--halo`, index.html) so it reads on any ground (0.13.3). Ink (`--ink`, dark brown by day, pale at
 * night, see render/ink); no numbers.
 *
 * moonPath(f, r) -> SVG path of the lit part of a moon of radius r centred
 *   on (r, r), lit fraction f 0..1 (lit from the right); '' when dark. Pure.
 * markOpacity(rest, asleep) -> opacity of the mark, pure
 * createRestMark(el) -> { update(rest, asleep) }   el: the #rest element
 *   (index.html), holding an <svg> with a .rim circle and a .lit path
 *
 * Depends on: core/math
 */
import { ss } from '../core/math.js';

export const CLEAR_BELOW = 1 / 3;   // rest left in the last half day of a day and a half
const R = 12;

export function moonPath(f, r = R) {
  if (f <= 0.001) return '';
  const k = Math.min(1, f), rx = r * Math.abs(2 * k - 1), n = v => +v.toFixed(3);
  return `M${r} 0A${r} ${r} 0 0 1 ${r} ${2 * r}A${n(rx)} ${r} 0 0 ${k > 0.5 ? 1 : 0} ${r} 0Z`;
}

export const markOpacity = (rest, asleep) => Math.max(asleep ? 0.65 : 0, 0.5 + 0.45 * (1 - ss(0, CLEAR_BELOW, rest)));

export function createRestMark(el) {
  const lit = el && el.querySelector('.lit');
  let last = '';
  function update(rest, asleep) {
    if (!el) return;
    const d = moonPath(rest), o = markOpacity(rest, asleep).toFixed(2), key = d + o;
    if (key === last) return;
    last = key; lit.setAttribute('d', d); el.style.opacity = o;
  }
  return { update };
}
