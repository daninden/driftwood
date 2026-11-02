/**
 * render/sky — the light of the day, worked out from the time of day.
 *
 * The sun rises in the east (+x), climbs over the south (+z) to at most
 * SUN_TOP high and sets in the west. It is up from SUNRISE to SUNSET (13 of
 * the 20 minutes); dusk and dawn each take about a minute around the
 * horizon, the rest is night. At night the moon takes over along a lower
 * arc: cool, dim light that still shows the island. Low sun gives golden
 * light; around the horizon the sky fill turns rose and lilac.
 *
 * The light never comes from lower than LIGHT_MIN, so shadows of a low sun
 * stay long but never smear across the whole island.
 *
 * skyAt(time) -> {
 *   sun, moon        unit vectors towards sun and moon
 *   day              1 by day .. 0 at night
 *   golden, dusk     0..1 amounts of golden hour and of dusk/dawn
 *   light            { dir, color, intensity }  the one shadow-casting light
 *                    (sun by day, moon by night)
 *   fill             { color, intensity }       the hemisphere sky fill
 *   grade            [r, g, b]  multiply colour over the picture (white = none)
 *   saturation       1 by day, lower at dusk and at night
 * }  colours as [r, g, b] in 0..1. Pure: no Three.js, no DOM.
 *
 * Depends on: core/math, render/palette
 */
import { ss, lerp, hex, mix } from '../core/math.js';
import { SKY } from './palette.js';

export const SUNRISE = 0.175, SUNSET = 0.825;
const SUN_TOP = 62 * Math.PI / 180, MOON_TOP = 50 * Math.PI / 180, LIGHT_MIN = 0.2;
const C = Object.fromEntries(Object.entries(SKY).map(([k, v]) => [k, hex(v)]));
const WHITE = [1, 1, 1];

/** Angle along the arc: 0 at sunrise, PI at sunset, 2PI at the next sunrise. */
function arc(t) {
  const d = SUNSET - SUNRISE, u = ((t - SUNRISE) % 1 + 1) % 1;
  return u < d ? u / d * Math.PI : Math.PI + (u - d) / (1 - d) * Math.PI;
}
const along = (a, top) => ({ x: Math.cos(a), y: Math.sin(a) * Math.sin(top), z: Math.sin(a) * Math.cos(top) });

/** Lift a direction to at least LIGHT_MIN above the horizon. */
function lift(d) {
  if (d.y >= LIGHT_MIN) return d;
  const h = Math.hypot(d.x, d.z) || 1, k = Math.sqrt(1 - LIGHT_MIN * LIGHT_MIN) / h;
  return { x: d.x * k, y: LIGHT_MIN, z: d.z * k };
}

export function skyAt(time) {
  const a = arc(time), sun = along(a, SUN_TOP), moon = along(a - Math.PI, MOON_TOP);
  const day = ss(-0.1, 0.1, sun.y);
  const golden = ss(-0.04, 0.06, sun.y) * (1 - ss(0.12, 0.42, sun.y));
  const dusk = ss(-0.3, -0.02, sun.y) * (1 - ss(-0.02, 0.14, sun.y));
  const sunI = ss(-0.04, 0.16, sun.y), moonI = 0.55 * ss(-0.02, 0.15, moon.y) * (1 - day);
  const light = sunI >= moonI
    ? { dir: lift(sun), color: mix(C.sunNoon, C.sunLow, golden), intensity: sunI }
    : { dir: lift(moon), color: C.moon, intensity: moonI };
  const fill = { color: mix(mix(C.fillNight, C.fillDay, day), C.fillDusk, dusk * 0.7), intensity: lerp(0.55, 0.6, day) + dusk * 0.15 + golden * 0.12 };
  let grade = mix(C.gradeNight, WHITE, day);
  grade = mix(grade, C.gradeGolden, golden * 0.5);
  grade = mix(grade, C.gradeDusk, dusk * 0.7);
  const saturation = lerp(0.7, 1, day) - dusk * 0.1;
  return { sun, moon, day, golden, dusk, light, fill, grade, saturation };
}
