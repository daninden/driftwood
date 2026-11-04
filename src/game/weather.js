/**
 * game/weather — the showers of rain (0.21 "Rain"): a schedule that follows from the seed and the clock.
 *
 * Rules
 *   - About once a week. The first shower starts FIRST_MIN to FIRST_MAX (5 to 9) days after the start
 *     of the game (day 0, midnight), each next one GAP_MIN to GAP_MAX (5 to 9) days after the start of
 *     the last. The gaps are fixed per island by the seed, so there is never a shower in the first two
 *     days, whatever he does, and nothing needs saving.
 *   - A shower lasts LEN_MIN to LEN_MAX (one to two hours of game time). Its intensity rises and falls
 *     softly over RAMP (ten game minutes) at either end, to its own strength (STRENGTH_MIN to 1).
 *   - The rain is "falling" (it wets wood and puts out fires) while its intensity is at least FALLING.
 *
 * Pure: no DOM, no Three.js, no state but a cache of the showers worked out so far.
 *
 * FIRST_MIN, FIRST_MAX, GAP_MIN, GAP_MAX, LEN_MIN, LEN_MAX, RAMP, STRENGTH_MIN, FALLING
 * WOOD_SHELTER (1.5 m), FIRE_SHELTER (2 m)   how close to a finished lean-to wood, and fires and torches, stay dry
 * createWeather(seed) -> weather
 *   weather.showers(upTo)       [{ start, end, strength }]  every shower that starts before day upTo (days on the clock)
 *   weather.intensity(total)    0..1, soft at both ends (total: days on the clock, game/clock)
 *   weather.raining(total)      true while the intensity is at least FALLING
 *   weather.shower(total)       the shower under way at total, or null
 *   weather.next(total)         the shower under way, or the next one to come
 *   weather.lastFall(total)     the latest moment at or before total that rain fell (total itself while it falls,
 *                               else the end of the latest shower), or null when it has not rained yet (for wood that
 *                               was out of reach or asleep, game/wood rain)
 *
 * Depends on: core/noise, core/math
 */
import { mulberry32, hashInt } from '../core/noise.js';
import { ss } from '../core/math.js';

export const FIRST_MIN = 5, FIRST_MAX = 9, GAP_MIN = 5, GAP_MAX = 9;
export const LEN_MIN = 1 / 24, LEN_MAX = 2 / 24;
export const RAMP = 10 / 1440;
export const STRENGTH_MIN = 0.75;
export const FALLING = 0.25;
export const WOOD_SHELTER = 1.5, FIRE_SHELTER = 2;

export function createWeather(seed) {
  const r = mulberry32(hashInt(seed + 211, 21, 5)), list = [];
  let at = 0;   // the start of the latest shower worked out
  const upTo = day => {
    while (!list.length || at < day) {
      at += list.length ? GAP_MIN + (GAP_MAX - GAP_MIN) * r() : FIRST_MIN + (FIRST_MAX - FIRST_MIN) * r();
      const len = LEN_MIN + (LEN_MAX - LEN_MIN) * r(), strength = STRENGTH_MIN + (1 - STRENGTH_MIN) * r();
      list.push({ start: at, end: at + len, strength });
    }
  };
  const showers = day => { upTo(day); return list.filter(s => s.start < day); };
  function shower(total) {
    if (!(total >= 0)) return null;
    upTo(total + 1);
    for (const s of list) { if (s.start > total) break; if (total < s.end) return s; }
    return null;
  }
  function next(total) {
    upTo(Math.max(0, total) + 12);
    return list.find(s => s.end > total) || null;
  }
  function intensity(total) {
    const s = shower(total);
    return s ? s.strength * ss(0, RAMP, total - s.start) * ss(0, RAMP, s.end - total) : 0;
  }
  function lastFall(total) {
    if (!(total >= 0)) return null;
    upTo(total + 1);
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i]; if (s.start > total) continue;
      if (total >= s.end) return s.end;
      if (intensity(total) >= FALLING) return total;
      if (total > (s.start + s.end) / 2) return s.end;   // easing off: it fell until just now
    }
    return null;
  }
  return { showers, shower, next, intensity, lastFall, raining: total => intensity(total) >= FALLING };
}
