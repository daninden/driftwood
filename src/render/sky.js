/**
 * render/sky — the light of the day, worked out from the time of day.
 *
 * The sun rises in the east (+x), climbs over the south (+z) to at most
 * SUN_TOP high and sets in the west. It is up from SUNRISE to SUNSET (13 of
 * the 20 minutes); dusk and dawn each take about a minute around the
 * horizon, the rest is night. At night the moon takes over along a lower
 * arc: dark blue, dim light in which the island is just readable. Low sun
 * gives golden light; around the horizon the sky fill turns rose and lilac.
 *
 * The shadow light never comes from lower than LIGHT_MIN (15 degrees; the sun
 * disc and the sky colours still use the true sun), so shadows of a low sun
 * stay long but never smear across the whole island. The direction of that
 * light moves in tiny steps (DIR_STEP, 1/32 degree), not continuously:
 * the shadow map is snapped to texels in light space, which only holds while
 * the light direction holds still. Steps this small move a shadow by a few
 * centimetres, so shadows glide. Colour and intensity stay smooth.
 *
 * DIR_STEP, LIGHT_MIN   the step (radians) and the sine of the lowest height of the shadow light
 * quantiseDir(d, step = DIR_STEP) -> unit vector with azimuth and elevation rounded to step
 * skyAt(time) -> {
 *   sun, moon        unit vectors towards sun and moon
 *   day              1 by day .. 0 at night
 *   golden, dusk     0..1 amounts of golden hour and of dusk/dawn
 *   light            { dir, color, intensity }  the sun or moon light
 *                    (sun by day, moon by night)
 *   fill             { color, intensity }       the hemisphere sky fill
 *   grade            [r, g, b]  multiply colour over the picture (white = none)
 *   saturation       1 by day, lower at dusk and at night
 *   shadows          0 at night .. 1 by day; the shadow map fades with it
 * }  colours as [r, g, b] in 0..1. Pure: no Three.js, no DOM.
 *
 * Depends on: core/math, render/palette
 */
import { ss, lerp, hex, mix } from '../core/math.js';
import { SKY } from './palette.js';

export const SUNRISE = 0.175, SUNSET = 0.825;
// Build-time comparison knob for optional Moonless review captures. Node exposes
// import.meta but not its Vite `env`, so the pure module keeps the selected 50% default.
const configuredNightLight = Number(import.meta.env?.VITE_NIGHT_LIGHT);
export const NIGHT_LIGHT = Number.isFinite(configuredNightLight) && configuredNightLight > 0 && configuredNightLight <= 1 ? configuredNightLight : 0.5;
const RAD = Math.PI / 180;
export const DIR_STEP = RAD / 32;   // radians: the shadow light turns in steps of this size
export const LIGHT_MIN = Math.sin(15 * RAD);   // sine of the lowest height of the shadow light
const SUN_TOP = 62 * RAD, MOON_TOP = 50 * RAD;
const C = Object.fromEntries(Object.entries(SKY).map(([k, v]) => [k, hex(v)]));
const WHITE = [1, 1, 1];

/** Angle along the arc: 0 at sunrise, PI at sunset, 2PI at the next sunrise. */
function arc(t) {
  const d = SUNSET - SUNRISE, u = ((t - SUNRISE) % 1 + 1) % 1;
  return u < d ? u / d * Math.PI : Math.PI + (u - d) / (1 - d) * Math.PI;
}
const along = (a, top) => ({ x: Math.cos(a), y: Math.sin(a) * Math.sin(top), z: Math.sin(a) * Math.cos(top) });

/** Lift a direction to at least the minimum height of the shadow light. */
function lift(d) {
  const m = LIGHT_MIN;
  if (d.y >= m) return d;
  const h = Math.hypot(d.x, d.z) || 1, k = Math.sqrt(1 - m * m) / h;
  return { x: d.x * k, y: m, z: d.z * k };
}

/** Round a unit direction's azimuth and elevation to multiples of `step` (radians); returns a unit vector. */
export function quantiseDir(d, step = DIR_STEP) {
  const az = Math.round(Math.atan2(d.z, d.x) / step) * step;
  const el = Math.round(Math.asin(Math.max(-1, Math.min(1, d.y))) / step) * step;
  const c = Math.cos(el);
  return { x: Math.cos(az) * c, y: Math.sin(el), z: Math.sin(az) * c };
}

export function skyAt(time) {
  const a = arc(time), sun = along(a, SUN_TOP), moon = along(a - Math.PI, MOON_TOP);
  const day = ss(-0.1, 0.1, sun.y);
  const golden = ss(-0.04, 0.06, sun.y) * (1 - ss(0.12, 0.42, sun.y));
  const dusk = ss(-0.3, -0.02, sun.y) * (1 - ss(-0.02, 0.14, sun.y));
  const sunI = ss(-0.04, 0.16, sun.y), moonI = 0.32 * NIGHT_LIGHT * ss(-0.02, 0.15, moon.y) * (1 - day);
  const light = sunI >= moonI
    ? { dir: quantiseDir(lift(sun)), color: mix(C.sunNoon, C.sunLow, golden), intensity: sunI }
    : { dir: quantiseDir(lift(moon)), color: C.moon, intensity: moonI };
  const shadows = ss(0.01, 0.5, day);
  const fill = { color: mix(mix(C.fillNight, C.fillDay, day), C.fillDusk, dusk * 0.7), intensity: lerp(0.32 * NIGHT_LIGHT, 0.6, day) + dusk * 0.15 + golden * 0.12 };
  let grade = mix(C.gradeNight, WHITE, day);
  grade = mix(grade, C.gradeGolden, golden * 0.5);
  grade = mix(grade, C.gradeDusk, dusk * 0.7);
  const saturation = lerp(0.6, 1, day) - dusk * 0.1;
  return { sun, moon, day, golden, dusk, light, fill, grade, saturation, shadows };
}
