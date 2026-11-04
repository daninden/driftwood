/**
 * audio/mix — what should be heard (0.20 "Sound"): pure maths, no DOM, no Web Audio.
 *
 * From the state of the world and the game this decides, every frame, the target loudness and tone of
 * each layer of the island's sound; audio/sound builds the Web Audio graph and follows these numbers
 * with smoothing. Nothing here makes a sound or touches the browser, so it runs in Node (tests/sound.test.js).
 *
 *   Layers: surf (swelling and falling back with the breath of the water, render/water `breath`, loud at
 *   the water's edge, fading with the distance to the sea), river (near running water, more at fords and
 *   falls), wind (the gusts and the strength per height of render/wind), rustle (leaves and fronds near,
 *   in the wind), howl (summit), fire (flames, embers and torches near, game/fire), crickets (forest at
 *   night), gulls (birds near, game/wildlife) and rain (0.21: a hiss that follows the intensity of the shower, muffled
 *   under a lean-to). Events: footsteps (twice per walk cycle, by what is underfoot), work sounds (game player.work)
 *   and the hiss of a fire the rain puts out (game/fire `hissed`, `hissAt`).
 *
 * LEVELS         the loudness table: the peak of each layer before the master gain (all quiet)
 * MASTER         the master gain; the limiter in audio/sound catches the rest
 * coastDistance(world, x, z, sea) -> metres to the nearest sea (0 in it), looked for along 16 rays
 * riverNear(world, x, z) -> null | { edge, ford, fall }   metres to the water's edge (0 in it), how much of a
 *   ford (0..1) and of a fall (0..1) the nearest river point is; null beyond 12 m of a river's axis
 * leavesNear(world, x, z) -> { leaves, forest } 0..1: palms, trees and pines round him weighted by distance
 *   (leaves: for the rustle, forest: broadleaf and pines only, for the crickets)
 * senseAround(world, x, z, sea) -> { coast, river, leaves, forest }
 * surfLevel(coast) -> 0..1, riverLevel(near) -> 0..1, fireLevel(fire, x, z, held) -> 0..1
 * groundOf(terrain, sea) -> 'water' | 'wet' | 'dry' | 'grass'   what is underfoot
 * stepsCrossed(prev, phase) -> how many steps the figure took between two walk phases (one per PI)
 * stepOf(ground, player, carried) -> { ground, gain, heavy, run }   one footstep
 * gullLevel(birds, x, z) -> 0..1
 * rainLevel(rain, covered) -> 0..1 the rain layer's share of LEVELS.rain: the intensity, less than half of it under a roof
 * hissLevel(d) -> 0..1 how loud a fire put out by the rain d metres away is heard (0 beyond HISS_REACH)
 * mixOf(s) -> { surf, river, wind, rustle, howl, fire, crickets, gulls, rain }   the targets, each { gain, ... }
 *   (s.rain: the intensity 0..1, s.covered: standing under a lean-to; both optional)
 * createMixer(world) -> { update(s, dt) -> { levels, steps, work, hisses }, reset() }   remembers the walk phase and
 *   looks round him only about four times a second (or when he has gone a few metres); hisses: [gain] for each fire the
 *   rain put out since the last call (s.fire.hissed counted up, heard from s.fire.hissAt; none on the first call)
 *
 * Depends on: core/math, render/wind, render/water (breath), world/constants
 */
import { ss, clamp } from '../core/math.js';
import { windLevel, tierStrength } from '../render/wind.js';
import { breath } from '../render/water.js';
import { HALF, T, NT } from '../world/constants.js';

export const MASTER = 0.5;
export const LEVELS = { surf: 0.34, river: 0.17, wind: 0.14, rustle: 0.07, howl: 0.05, fire: 0.15, crickets: 0.06, gulls: 0.08, steps: 0.2, work: 0.22, rain: 0.16, hiss: 0.3 };

export const COAST_REACH = 100, RIVER_REACH = 12, FIRE_REACH = 15, GULL_REACH = 30, HISS_REACH = 30;
export const ROOF_MUFFLE = 0.45;   // under a lean-to the rain is this much of its loudness, and darker
const RAYS = 16, RAY_STEPS = [1.5, 3, 5, 8, 12, 18, 26, 36, 48, 64, 84, 100];
export const SWELL_MAX = 0.045;   // metres: the most `breath` swings (0.03 + 0.015)
export const WET_BAND = 0.3;      // sand lower than this above the sea is wet
const SENSE_EVERY = 0.25, SENSE_MOVED = 3;

export function coastDistance(w, x, z, sea) {
  if (w.H(x, z) < sea) return 0;
  let best = COAST_REACH;
  for (let i = 0; i < RAYS; i++) {
    const a = i / RAYS * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    for (const r of RAY_STEPS) { if (r >= best) break; if (w.H(x + c * r, z + s * r) < sea) { best = r; break; } }
  }
  return best;
}

export function riverNear(w, x, z) {
  const r = w.riverAt(x, z); if (!r || r.d > RIVER_REACH) return null;
  const k = r.t * (r.rv.n - 1);
  let fall = 0; for (const f of r.rv.falls) fall = Math.max(fall, ss(f.top - 6, f.top - 1, k) * ss(f.base + 6, f.base + 1, k));
  return { edge: Math.max(0, r.d - r.hw), ford: r.rv.fordAt(k), fall };
}

const tileOf = (w, x, z) => {
  const tx = Math.floor((x + HALF) / T), tz = Math.floor((z + HALF) / T);
  return tx < 0 || tz < 0 || tx >= NT || tz >= NT ? null : w.tiles && w.tiles[tz * NT + tx];
};

export function leavesNear(w, x, z) {
  if (!w.tiles) return { leaves: 0, forest: 0 };
  let leaves = 0, forest = 0;
  const R = 14, add = (list, tree) => { for (const t of list) { const d = Math.hypot(t.x - x, t.z - z); if (d < R) { const q = 1 - d / R; leaves += q; if (tree) forest += q; } } };
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const tile = tileOf(w, x + i * T, z + j * T); if (!tile) continue;
    add(tile.palms, false); add(tile.trees, true); add(tile.pines, true);
  }
  return { leaves: ss(0.3, 3.5, leaves), forest: ss(1.5, 6, forest) };
}

export function senseAround(w, x, z, sea) {
  return { coast: coastDistance(w, x, z, sea), river: riverNear(w, x, z), ...leavesNear(w, x, z) };
}

/** 1 at the water's edge, about a third at 20 m, a fifth at 40 m, a few per cent far inland; gone at COAST_REACH. */
export const surfLevel = coast => (1 / (1 + (coast / 22) ** 1.6)) * (1 - ss(70, COAST_REACH, coast));
/** 1 at the water, fading over about 10 m; a fall carries further and louder; fords are louder. */
export const riverLevel = n => !n ? 0 : (1 / (1 + (n.edge / (4 + 8 * n.fall)) ** 2)) * (0.45 + 0.25 * n.ford + 0.6 * n.fall) * (1 - ss(RIVER_REACH - 3, RIVER_REACH, n.edge));

export function fireLevel(fire, x, z, held = false) {
  let best = held ? 0.3 : 0;
  const near = (px, pz, s) => { const d = Math.hypot(px - x, pz - z); best = Math.max(best, s / (1 + (d / 3.5) ** 2) * (1 - ss(FIRE_REACH - 4, FIRE_REACH, d))); };
  for (const f of fire.fires) near(f.x, f.z, fire.strength(f) || (f.embers > 0 ? 0.1 : 0));
  for (const t of fire.torches) near(t.x, t.z, 0.3);
  return clamp(best, 0, 1);
}

export const rainLevel = (rain, covered = false) => clamp(rain || 0, 0, 1) * (covered ? ROOF_MUFFLE : 1);
export const hissLevel = d => (1 / (1 + (d / 6) ** 2)) * (1 - ss(HISS_REACH - 8, HISS_REACH, d));

export function groundOf(t, sea) {
  if (t.depth > 0.04 || t.inRiver) return 'water';
  if (t.L < 0.4 && t.y < 1.3) return t.y < sea + WET_BAND ? 'wet' : 'dry';
  return 'grass';
}

export const stepsCrossed = (prev, phase) => prev === null ? 0 : Math.min(2, Math.max(0, Math.floor(phase / Math.PI) - Math.floor(prev / Math.PI)));

/** One footstep: heavier (lower, longer, louder) with weariness, thirst, hunger and a load; a run is louder. */
export function stepOf(ground, p, carried = 0) {
  const heavy = clamp(Math.max(p.tired || 0, p.thirsty || 0, p.hungry || 0) * 0.8 + 0.07 * carried, 0, 1), run = (p.speed || 0) > 3.3;
  return { ground, gain: LEVELS.steps * (run ? 1.3 : 1) * (1 + 0.5 * heavy), heavy, run };
}

export function gullLevel(birds, x, z) {
  let g = 0;
  for (const b of birds) {
    const d = Math.hypot(b.x - x, b.z - z);
    g = Math.max(g, (b.mode === 'ground' ? 1 : 0.22) * (1 - ss(4, GULL_REACH, d)));
  }
  return g;
}

/**
 * s: { x, y, z, sense, day, wind (render/wind windState), waterTime (render/water clock), fire, birds, held }
 * day 0 (night) .. 1 (noon) as render/sky `day`. Each layer: { gain, ... } with what audio/sound needs for its tone.
 */
export function mixOf(s) {
  const swell = ss(-1, 1, breath(s.waterTime) / SWELL_MAX), prox = surfLevel(s.sense.coast), rn = s.sense.river;
  const lvl = windLevel(s.wind, s.x, s.y, s.z), wn = clamp(lvl / 1.2, 0, 1), summit = ss(1.5, 1.75, tierStrength(s.y));
  const night = 1 - ss(0.08, 0.3, s.day), fl = fireLevel(s.fire, s.x, s.z, s.held), gl = gullLevel(s.birds, s.x, s.z);
  return {
    surf: { gain: LEVELS.surf * prox * (0.3 + 0.7 * swell), cutoff: 260 + 1900 * prox ** 0.6 * (0.45 + 0.55 * swell), hiss: prox * swell * swell },
    river: { gain: LEVELS.river * riverLevel(rn), cutoff: 500 + 1300 * clamp(rn ? 0.35 + 0.35 * rn.ford + 0.5 * rn.fall : 0, 0, 1) },
    wind: { gain: LEVELS.wind * (0.12 + 0.88 * wn ** 1.4), freq: 250 + 650 * wn },
    rustle: { gain: LEVELS.rustle * s.sense.leaves * ss(0.04, 0.8, wn) },
    howl: { gain: LEVELS.howl * summit * (0.25 + 0.75 * wn), freq: 380 + 260 * wn },
    fire: { gain: LEVELS.fire * fl, rate: fl > 0.005 ? 3 + 22 * fl : 0 },
    crickets: { gain: LEVELS.crickets * night * s.sense.forest },
    gulls: { gain: LEVELS.gulls * gl, rate: gl > 0.01 ? 0.06 + 0.5 * gl : 0 },
    rain: { gain: LEVELS.rain * rainLevel(s.rain, s.covered), cutoff: s.covered ? 1900 : 7500 },
  };
}

export function createMixer(world) {
  let prevPhase = null, sense = null, sinceSense = 0, at = { x: 0, z: 0 }, hissedBefore = null;
  function update(s, dt) {
    const p = s.player;
    sinceSense += dt;
    if (!sense || sinceSense >= SENSE_EVERY || Math.hypot(p.x - at.x, p.z - at.z) > SENSE_MOVED) {
      sense = senseAround(world, p.x, p.z, s.sea); at = { x: p.x, z: p.z }; sinceSense = 0;
    }
    const levels = mixOf({ x: p.x, y: p.y, z: p.z, sense, day: s.day, wind: s.wind, waterTime: s.waterTime, fire: s.fire, birds: s.birds, held: !!p.torch, rain: s.rain, covered: s.covered });
    const hisses = [], hissed = s.fire.hissed || 0;
    if (hissedBefore !== null && hissed > hissedBefore && s.fire.hissAt) hisses.push(LEVELS.hiss * hissLevel(Math.hypot(s.fire.hissAt.x - p.x, s.fire.hissAt.z - p.z)));
    hissedBefore = hissed;
    const steps = [], n = p.moving ? stepsCrossed(prevPhase, p.phase) : 0;
    for (let i = 0; i < n; i++) steps.push(stepOf(groundOf(s.terrain, s.sea), p, s.carried || 0));
    prevPhase = p.phase;
    return { levels, steps, work: p.work ? { kind: p.work.kind, f: p.work.f } : null, hisses };
  }
  return { update, reset() { prevPhase = null; sense = null; hissedBefore = null; } };
}
