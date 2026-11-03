/**
 * render/wind — the wind of the island (0.19 "Wind"): pure maths, no DOM, no WebGL.
 *
 * The wind is a calm base plus gusts that roll over the island as waves. Everything here is a
 * function of the seed, the wind time (seconds, kept by render/islandView) and the game clock;
 * render/windShader turns the state into uniforms for the vertex shaders of the swaying plants
 * and repeats tierStrength and gustLevel in GLSL (the same constants, written out from here).
 *
 *   Direction: fixed per island (seed) and turning slowly: a swing of +-TURN radians (about 26 degrees)
 *   once round per game day.
 *   Gusts: gust n starts at n * GUST_PERIOD (+- GUST_JITTER s), at the upwind edge (-GUST_RANGE metres
 *   along the wind direction), and moves with GUST_SPEED m/s; its strength is fixed by (seed, n), some
 *   gusts are weak or nothing. A gust is a bump GUST_WIDTH wide, so trees further upwind move first and
 *   the ones near him a few seconds later. At most GUST_SLOTS gusts are alive at once (slot n mod 3).
 *   Strength per height tier (tierStrength(y), smooth between the terraces): moderate on the coast,
 *   hardly any in the rain forest, strongest on the plateau and the summit. Calmer at night.
 *
 * KINDS: for each swaying kind of plant the sizes in metres (push downwind, side, lift, flutter, bend
 *   of a palm's top) at wind level 1, and how its phase is spread; WIND_MAX is the highest level.
 * TIER_EDGES, TIER_FADE, TIER_STRENGTH, BASE_LEVEL, GUST_GAIN, GUST_PERIOD, GUST_JITTER, GUST_SPEED,
 *   GUST_RANGE, GUST_WIDTH, GUST_SLOTS, GUST_QUIET, TURN, NIGHT_CALM, WIND_MAX
 * tierStrength(y) -> strength factor of the terrace at height y (0.12 .. 1.8)
 * windAngle(seed, total) -> direction in radians (total: days since day 0, so it turns with the day)
 * gustOf(seed, n) -> { start, amp }   gust number n
 * calmOfDay(day) -> 0.4 .. 1   (day: 1 by day .. 0 at night, render/sky)
 * windState(seed, t, total, day) -> { dx, dz, calm, gusts: [{ pos, amp } x GUST_SLOTS] }
 * gustLevel(state, x, z) -> 0..1   gust strength at a place
 * windLevel(state, x, y, z) -> 0 .. WIND_MAX   base plus gusts, times tier and calm
 * maxOffset(kind, level = WIND_MAX) -> the most (metres) a point of that kind can be displaced at a wind level
 *
 * Depends on: core/noise, core/math
 */
import { hashInt } from '../core/noise.js';
import { ss, clamp } from '../core/math.js';

export const TIER_EDGES = [4.5, 10.5, 16.5, 22.8];   // heights between coast, lowland, highland (rain forest), plateau and summit
export const TIER_FADE = 1.5;                          // metres each side of an edge over which the strength blends
export const TIER_STRENGTH = [1.0, 0.75, 0.12, 1.5, 1.8];
export const BASE_LEVEL = 0.22, GUST_GAIN = 0.9;
export const GUST_PERIOD = 32, GUST_JITTER = 8, GUST_SPEED = 12, GUST_RANGE = 420, GUST_WIDTH = 40, GUST_SLOTS = 3, GUST_QUIET = 0.2;
export const TURN = 0.45, NIGHT_CALM = 0.4;
export const WIND_MAX = (BASE_LEVEL + GUST_GAIN) * TIER_STRENGTH[4];
const LIFE = 2 * GUST_RANGE / GUST_SPEED;   // seconds a gust takes to cross (70 s: slots n and n + 3 never overlap)

/**
 * Metres of movement at wind level 1. push: along the wind, side: across it, lift: up and down, flutter: fast
 * small shaking over the shape; bend: how far the top of a palm leans per metre of its height (0.012 m).
 * spread: how much the phase differs between neighbours (radians; the whole 2PI for single blades and fronds,
 * little for the clumps of one crown, so a tree rocks as a whole); single: the instance's own turn is mixed
 * into the phase (fronds of one palm, blades of grass).
 */
export const KINDS = {
  frond:     { push: 0.07,  side: 0.05,  lift: 0.20,  flutter: 0.015, bend: 0.012, spread: 6.3, single: true },
  palmtrunk: { push: 0,     side: 0,     lift: 0,     flutter: 0,     bend: 0.012, spread: 0,   single: false },
  crown:     { push: 0.11,  side: 0.04,  lift: 0.03,  flutter: 0.025, bend: 0,     spread: 0.7, single: false },
  pine:      { push: 0.06,  side: 0.03,  lift: 0.0,   flutter: 0.01,  bend: 0,     spread: 0.3, single: false },
  bush:      { push: 0.045, side: 0.02,  lift: 0.015, flutter: 0.015, bend: 0,     spread: 1.5, single: false },
  grass:     { push: 0.09,  side: 0.05,  lift: 0.0,   flutter: 0.01,  bend: 0,     spread: 6.3, single: true },
  leaf:      { push: 0.05,  side: 0.03,  lift: 0.05,  flutter: 0.01,  bend: 0,     spread: 3.0, single: false },
};
export const PALM_MAX_HEIGHT = 5;   // metres (render/props, world/vegetation)

const unit = (a, b, c) => hashInt(a | 0, b | 0, c | 0) / 4294967296;
const mod = (n, m) => ((n % m) + m) % m;

export function tierStrength(y) {
  let s = TIER_STRENGTH[0];
  for (let i = 0; i < TIER_EDGES.length; i++) s += (TIER_STRENGTH[i + 1] - TIER_STRENGTH[i]) * ss(TIER_EDGES[i] - TIER_FADE, TIER_EDGES[i] + TIER_FADE, y);
  return s;
}

export function windAngle(seed, total) {
  return unit(seed, 1, 7) * Math.PI * 2 + TURN * Math.sin(Math.PI * 2 * total + unit(seed, 2, 7) * Math.PI * 2);
}

export function gustOf(seed, n) {
  return { start: n * GUST_PERIOD + (unit(seed, n, 11) - 0.5) * 2 * GUST_JITTER, amp: clamp((unit(seed, n, 13) - GUST_QUIET) / (1 - GUST_QUIET), 0, 1) };
}

export const calmOfDay = day => NIGHT_CALM + (1 - NIGHT_CALM) * clamp(day, 0, 1);

export function windState(seed, t, total, day) {
  const a = windAngle(seed, total), gusts = [];
  for (let i = 0; i < GUST_SLOTS; i++) gusts.push({ pos: 0, amp: 0 });
  for (let n = Math.floor((t - LIFE) / GUST_PERIOD) - 1; n <= Math.ceil(t / GUST_PERIOD) + 1; n++) {
    const g = gustOf(seed, n), age = t - g.start;
    if (age < 0 || age > LIFE) continue;
    gusts[mod(n, GUST_SLOTS)] = { pos: -GUST_RANGE + GUST_SPEED * age, amp: g.amp };
  }
  return { dx: Math.cos(a), dz: Math.sin(a), calm: calmOfDay(day), gusts };
}

export function gustLevel(state, x, z) {
  const s = x * state.dx + z * state.dz;
  let g = 0;
  for (const q of state.gusts) { const d = (s - q.pos) / GUST_WIDTH; g += q.amp * Math.exp(-d * d); }
  return Math.min(1, g);
}

export const windLevel = (state, x, y, z) => state.calm * tierStrength(y) * (BASE_LEVEL + GUST_GAIN * gustLevel(state, x, z));

export function maxOffset(kind, level = WIND_MAX) {
  const k = KINDS[kind];
  return (k.push + k.side + k.lift + k.flutter + k.bend * PALM_MAX_HEIGHT) * level;
}
