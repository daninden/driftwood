/**
 * game/tide — ebb and flow.
 *
 * Two high waters a day, as on a real coast: the tide comes round every
 * PERIOD days (12 h 25 min of a 24-hour day), so high water falls a little
 * later each day. At high water the sea stands at 0, where it always stood
 * (the tide line of seaweed marks it); at low water RANGE lower, and a strip
 * of wet sand and the sandbanks of the lagoons fall dry.
 *
 * PERIOD, RANGE, FIRST_HIGH
 * seaLevel(total) -> sea level (0 at high water .. -RANGE at low water)
 *   total: days since the start of day 0 (game/clock `total`)
 * highWaters(total) -> how many high waters there have been since FIRST_HIGH
 *   (it goes up by one at each high water; negative before the first)
 *
 * Pure; no DOM, no Three.js.
 *
 * Depends on: nothing
 */

export const PERIOD = 12.42 / 24;
export const RANGE = 0.4;
export const FIRST_HIGH = 0.2;   // high water early on the first morning: the game starts on a falling tide

export const seaLevel = total => -RANGE * (1 - Math.cos(2 * Math.PI * (total - FIRST_HIGH) / PERIOD)) / 2;
export const highWaters = total => Math.floor((total - FIRST_HIGH) / PERIOD);
