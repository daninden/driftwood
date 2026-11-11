/**
 * game/movement — how the castaway moves over the island.
 *
 * Rules
 *   - Open sea (ground more than 0.6 below the sea level, which goes up and
 *     down with the tide, game/tide) blocks, and so does river water deeper
 *     than WADE_MAX (waist deep, 0.35): narrow upstream brooks and the fords
 *     can be waded, the wide deep reaches cannot. When the flood comes in
 *     round you, or you stand in deep water, you can always wade back out:
 *     only going deeper is blocked.
 *   - Gentle ground (steepness < 0.85) is walked at full speed, up to 1.25
 *     at 70 %.
 *   - Anything steeper is a wall and blocks, unless it is a natural passage
 *     (scree, ravine, bench, beside a waterfall, roots) where you scramble
 *     at 42 % up to steepness 3.2. The short steps of a bench and a root
 *     wall can be steeper (up to 4.8); you haul yourself up at 30 %.
 *   - Wading slows you down, and so does pushing through a bush (more in its
 *     middle than at its edge; not on a climbing route), and so does a load.
 *   - Tree trunks (broadleaf, rain forest, pine, palm; thicker on taller
 *     trees), boulders of at least
 *     STONE_MIN and crags block; you collide with the trunk, not the crown.
 *     Bushes, grass, roots, small stones and beach finds do not block, nor do
 *     stones lying on a climbing route (you scramble over them).
 *     Standing inside an obstacle (never on purpose) you can always walk out.
 *   - When the way ahead is blocked, a few deflected directions are tried
 *     so you slide along walls instead of sticking to them.
 *
 * Pure functions on a world (see world/world); no DOM, no Three.js.
 *
 * terrainAt(world, x, z, sea?) -> { y, L, s, rv, inRiver, depth, pa, fr, climb }
 *   sea: the current sea level (default 0, high water); depth is the depth
 *   of the river or the sea at (x, z)
 * stepFactor(world, from, x, z, sea?, bushes?) -> 0 (blocked) or a speed factor 0..1 (bushes false leaves the bushes out, the dear part, for game/path). The steepness rule is symmetric: a step
 *   is allowed when it would be allowed onto the ground at either end (each judged by its own slope, the step's grade,
 *   and the climbing route there), so a step you took up into a steep pocket can always be taken back out. Water is
 *   not symmetric on purpose (only going deeper is blocked).
 * obstaclesNear(world, x, z, opts?) -> [{ x, z, r }] blocking circles from the tiles (0.31: not the trunks of felled trees, game/felled; a tree circle carries its `tree` id)
 *   around (x, z); r already includes the castaway's own radius (BODY)
 * bushFactor(world, x, z) -> speed factor 0..1 from bushes at (x, z)
 * pushOut(world, from, x, z, opts?) -> { x, z } moved back onto the rim of any
 *   obstacle that stepping from `from` to (x, z) would enter
 * canStand(world, x, z, sea?, opts?) -> true when the castaway can be put at (x, z):
 *   on the island, not in open sea or river water deeper than WADE_MAX, not
 *   on a wall (unless a passage) and not inside a trunk, boulder or crag
 * nearestStandable(world, x, z, sea?, maxR?, opts?) -> { x, z } | null   (x, z) itself
 *   when he can stand there, else the nearest such spot on rings of 0.5 m
 *   steps out to maxR (15 m), or null
 * PROBE (0.25), stepAhead(w, here, dx, dz, base, sea?, probe?, bushes?) -> 0 | factor   (0.30.3) stepPlayer's own test of one straight step, also asked by game/walk along a planned line
 * createPlayer(spot) -> player state { x, y, z, heading, moving, speed, phase, stoop, sitting } (sitting: 0..1, game/game)
 * PACE (0.65), PACE_STRIDE (0.5), paceOf(input) -> 0.3..1 (1 without input.pace), paceStride(pace): the slower amble of the habit (0.29.2 "Amble"); the player's input has no pace
 * moveIntent(input, player) -> unit direction { x, z } or null, from the thumb
 *   stick (input.stick, already a direction on the island), keys or target;
 *   keys walk relative to the screen, so they use input.yaw (the current
 *   view angle, see core/view; the starting view when missing)
 * stepPlayer(world, player, dir, dt, run, load?, sea?, stride?, opts?) -> { moved, distance, blocked }
 *   Mutates player. run: the run speed (RUN_SPEED), asked for by game/game only while he has breath (game/breath). load (default 1) scales the speed, for carrying
 *   (game/wood) and tiredness (game/sleep); sea is the sea level. `phase` advances with distance (for the walk cycle);
 *   stride (default 1) is the length of his step: a load makes it shorter
 *   (game/wood CARRY_STRIDE) and so does weariness (weariStride(needsSpeed) =
 *   1 - WEARY_STRIDE * (1 - needsSpeed), WEARY_STRIDE 0.4), so the phase
 *   advances faster per metre.
 *
 * An ejection by pushOut (from inside a solid) never carries him farther than the step he took, where pushOut's own rule allows that point.
 *
 * Depends on: core/view, world/constants, world/vegetation, game/felled
 */
import { YAW, basis } from '../core/view.js';
import { HALF, T, NT } from '../world/constants.js';
import { bushSize } from '../world/vegetation.js';
import { felledOf, treeId, trunkRadius, sizeKind } from './felled.js';

export const WALK_SPEED = 2.9;
export const RUN_SPEED = 5.5;   // a run is short: game/breath limits it
export const BODY = 0.2;        // the castaway's radius
export const STONE_MIN = 0.35;  // smaller stones are stepped over
export const WADE_MAX = 0.35;   // rivers deeper than this (waist deep) cannot be waded
export const WEARY_STRIDE = 0.4;  // his step shortens by this share of what needs take off his speed
export const BUSH_SLOW = 0.45;  // in the middle of a bush you go at 55 %
export const PACE = 0.65;       // 0.29.2 "Amble": the share of his walking speed (and of the length of his step: PACE_STRIDE) at which the habit strolls and idles; only game/mind asks for it (input.pace)
export const PACE_STRIDE = 0.5; // his step shortens by this share of what the pace takes off his speed (the cadence slows too, but less than the speed)

/** Stride factor from the needs' combined walking speed (sleep x thirst x hunger):
 *  1 - WEARY_STRIDE * (1 - needsSpeed); at the worst (0.29) about 0.72. */
export function weariStride(needsSpeed) { return 1 - WEARY_STRIDE * (1 - Math.min(1, Math.max(0, needsSpeed))); }

/** 0.29.2: the pace the mind asks for (input.pace) as a speed factor: only 0.3..1 counts, anything else (the player's input has none) is full pace. */
export function paceOf(input) { const v = input && input.pace; return typeof v === 'number' && v > 0 && v < 1 ? Math.max(0.3, v) : 1; }
/** The stride factor of a pace: 1 - PACE_STRIDE * (1 - pace); 0.825 at PACE. */
export function paceStride(pace) { return 1 - PACE_STRIDE * (1 - Math.min(1, Math.max(0, pace))); }

// A step is judged at two points ahead (stepFactor) but he lands somewhere between, and sliding round a trunk moves him
// again: the slope where he ends can be a good deal steeper than at the points judged (the ground is rough), and a flood
// can leave him deeper in a river than he could wade in. canOccupy forgives that much.
const OCCUPY_SLOPE = 3.2;   // steepness he may rest on anywhere (a step is judged at 1.25, a scramble at 3.2)
const OCCUPY_CLIMB = 0.5;   // more than the haul limit on a climbing route
const OCCUPY_DEPTH = 0.6;   // river depth (the same as the sea's)

const cache = new WeakMap();
function tileObstacles(w, tile) {
  let list = cache.get(tile);
  if (list) return list;
  list = [];
  const onRoute = t => terrainAt(w, t.x, t.z).climb > 0.25;   // stones on a climbing route are scrambled over
  for (const ln of ['trees', 'pines', 'palms']) tile[ln].forEach((t, i) => list.push({ x: t.x, z: t.z, r: trunkRadius(t, sizeKind(ln, t)) + BODY, tree: treeId(tile, ln, i) }));   // 0.31: `tree` is the stable id a felled tree is known by (game/felled)
  for (const t of tile.rocks) if (t.s >= STONE_MIN && !onRoute(t)) list.push({ x: t.x, z: t.z, r: t.s * 0.9 + BODY });
  for (const t of tile.crags) if (!onRoute(t)) list.push({ x: t.x, z: t.z, r: t.s * 1.1 + BODY });
  cache.set(tile, list);
  return list;
}

const bushCache = new WeakMap();
function tileBushes(tile) {
  let list = bushCache.get(tile);
  if (!list) { list = tile.bushes.map(b => ({ x: b.x, z: b.z, r: bushSize(b) + BODY * 0.5 })); bushCache.set(tile, list); }
  return list;
}
export function bushFactor(w, x, z) {
  const tile = w.tiles[Math.floor((z + HALF) / T) * NT + Math.floor((x + HALF) / T)];
  let f = 1;
  if (!tile) return f;
  for (const t of [tile, ...neighbours(w, tile, x, z)]) for (const b of tileBushes(t)) {
    const d = Math.hypot(x - b.x, z - b.z); if (d >= b.r) continue;
    const p = Math.min(1, Math.max(0, (1 - d / b.r - 0.25) / 0.5)), e = p * p * (3 - 2 * p);   // eases in: brushing the edge costs (almost) nothing
    f = Math.min(f, 1 - BUSH_SLOW * e);
  }
  return f;
}
function neighbours(w, tile, x, z) {
  const out = [], fx = (x + HALF) / T - tile.tx, fz = (z + HALF) / T - tile.tz, m = 1 / T;   // within a metre of an edge
  const dx = fx < m ? -1 : fx > 1 - m ? 1 : 0, dz = fz < m ? -1 : fz > 1 - m ? 1 : 0;
  for (const [ax, az] of [[dx, 0], [0, dz], [dx, dz]]) {
    if (!ax && !az) continue;
    const t = w.tiles[(tile.tz + az) * NT + tile.tx + ax]; if (t && Math.abs(t.tx - tile.tx) <= 1) out.push(t);
  }
  return out;
}

const REACH = 1.6;   // larger than any obstacle radius
export function obstaclesNear(w, x, z, opts = null) {
  const fo = felledOf(w), fel = fo && fo.ids;   // 0.31 "Axe": a felled trunk is no obstacle (the tile lists are shared by every game on the world; the overlay of the game made last is asked)
  const out = [], t0x = Math.floor((x - REACH + HALF) / T), t1x = Math.floor((x + REACH + HALF) / T);
  const t0z = Math.floor((z - REACH + HALF) / T), t1z = Math.floor((z + REACH + HALF) / T);
  for (let tz = Math.max(0, t0z); tz <= Math.min(NT - 1, t1z); tz++) for (let tx = Math.max(0, t0x); tx <= Math.min(NT - 1, t1x); tx++) {
    const tile = w.tiles[tz * NT + tx];
    if (tile) for (const o of tileObstacles(w, tile)) if (Math.abs(o.x - x) < REACH && Math.abs(o.z - z) < REACH && !(fel && fel.size && o.tree !== undefined && fel.has(o.tree))) out.push(o);
  }
  if (opts && typeof opts.obstacles === 'function') out.push(...opts.obstacles(x, z, REACH));
  return out;
}

/** Push (x, z) out of any obstacle it entered from `a`, onto its rim: that makes you slide round trunks and boulders. */
export function pushOut(w, a, x, z, opts = null) {
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const o of obstaclesNear(w, x, z, opts)) {
      const dx = x - o.x, dz = z - o.z, d = Math.hypot(dx, dz);
      if (d >= o.r || d >= Math.hypot(a.x - o.x, a.z - o.z)) continue;   // outside, or already inside and walking out
      const k = d > 1e-6 ? o.r / d : 0; x = o.x + (k ? dx * k : o.r); z = o.z + (k ? dz * k : 0); moved = true;
    }
    if (!moved) break;
  }
  return { x, z };
}

export function terrainAt(w, x, z, sea = 0) {
  const y = w.H(x, z), L = w.Lat(x, z), s = w.slope(x, z);
  const rv = w.riverAt(x, z), inRiver = !!(rv && rv.d < rv.hw + 0.1 && y < rv.lw);
  const pa = w.passAt(x, z, L), fr = rv ? w.fallRouteAt(x, z) : 0, climb = Math.max(pa.any, fr);
  return { y, L, s, rv, inRiver, depth: inRiver ? rv.lw - y : (y < sea ? sea - y : 0), pa, fr, climb };
}

/** Speed factor for a step of steepness `steep` onto ground `b` (terrainAt), or 0 when it is a wall. */
function climbFactor(b, steep) {
  if (steep < 0.85) return 1;
  if (steep < 1.25) return 0.7;
  if (b.climb <= 0.25) return 0;
  // benches and root walls are short steep steps you haul yourself up
  const limit = 3.2 + 1.6 * Math.max(b.pa.bench, b.pa.roots);
  return steep < 3.2 ? 0.42 : steep < limit ? 0.3 : 0;
}

export function stepFactor(w, a, x, z, sea = 0, bushes = true) {
  const b = terrainAt(w, x, z, sea), dist = Math.hypot(x - a.x, z - a.z) || 1e-6, grade = (b.y - a.y) / dist;
  const deep = sea - 0.6;   // a rising tide may have overtaken you down to RANGE deeper: from there you can wade back
  if ((b.y < deep && (b.y <= a.y || a.y < deep - 0.5)) || (b.inRiver && b.depth > WADE_MAX && (b.y <= a.y || terrainAt(w, a.x, a.z, sea).depth <= WADE_MAX))) return 0;
  const steep = Math.max(b.s, Math.abs(grade));
  let f = climbFactor(b, steep);
  // Symmetric: a step you could take from (x, z) to here you can take back, so a steep pocket you walked into is never a trap.
  if (!f) { const t = terrainAt(w, a.x, a.z, sea); f = climbFactor(t, Math.max(t.s, Math.abs(grade))); }
  if (!f) return 0;
  if (b.depth > 0.05) f *= b.depth > 0.25 ? 0.45 : 0.7;
  if (bushes && w.tiles && b.climb <= 0.25) f *= bushFactor(w, x, z);
  return f;
}

export function canStand(w, x, z, sea = 0, opts = null) {
  if (!(Math.abs(x) < HALF - 1 && Math.abs(z) < HALF - 1)) return false;
  const t = terrainAt(w, x, z, sea);
  if (!Number.isFinite(t.y) || t.y < sea - 0.6 || (t.inRiver && t.depth > WADE_MAX)) return false;
  if (!(t.s < 0.85 || (t.climb > 0.25 && t.s < 3.2))) return false;
  return !(w.tiles && obstaclesNear(w, x, z, opts).some(o => Math.hypot(x - o.x, z - o.z) < o.r));
}

/**
 * True when (x, z) is a spot walking can leave him at: on the island, not in open sea or river water deeper than WADE_MAX,
 * not inside a trunk, boulder or crag (resting on its rim is fine, to 5 cm inside where sliding between two left him), and on ground no steeper than he can stand on while
 * climbing: up to 3.2 anywhere, up to the haul limit (3.2, 4.8 on a bench or root wall) plus 0.5 on a climbing route, and wading no deeper than 0.6; the slack is for where a step ends between the points it was judged at. Wider than
 * canStand, which puts him down from outside (a click, a save of an older island); a saved spot he walked to passes this.
 */
export function canOccupy(w, x, z, sea = 0, opts = null) {
  if (!(Math.abs(x) < HALF - 1 && Math.abs(z) < HALF - 1)) return false;
  const t = terrainAt(w, x, z, sea);
  if (!Number.isFinite(t.y) || t.y < sea - 0.6 || (t.inRiver && t.depth > OCCUPY_DEPTH)) return false;
  if (!(t.s < OCCUPY_SLOPE || (t.climb > 0.25 && t.s < 3.2 + 1.6 * Math.max(t.pa.bench, t.pa.roots) + OCCUPY_CLIMB))) return false;
  return !(w.tiles && obstaclesNear(w, x, z, opts).some(o => Math.hypot(x - o.x, z - o.z) < o.r - 0.05));
}

export function nearestStandable(w, x, z, sea = 0, maxR = 15, opts = null) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  if (canStand(w, x, z, sea, opts)) return { x, z };
  for (let r = 0.5; r <= maxR; r += 0.5) {
    const n = Math.max(8, Math.ceil(2 * Math.PI * r / 0.5));
    for (let i = 0; i < n; i++) {
      const a = 2 * Math.PI * i / n, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (canStand(w, px, pz, sea, opts)) return { x: px, z: pz };
    }
  }
  return null;
}

export function createPlayer(spot) {
  return { x: spot.x, y: spot.y, z: spot.z, heading: 2.6, moving: false, speed: 0, phase: 0, stoop: 0, sitting: 0 };
}

/**
 * input: { up, down, left, right } booleans, yaw, and/or target { x, z }, and
 * the player position. The stick wins over keys, keys over a target. Returns null when standing still.
 */
export function moveIntent(input, player) {
  if (input.stick) return { x: input.stick.x, z: input.stick.z };
  const u = (input.up ? 1 : 0) - (input.down ? 1 : 0), r = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let x = 0, z = 0;
  if (u || r) { const { cam, right } = basis(input.yaw === undefined ? YAW : input.yaw); x = -cam.x * u + right.x * r; z = -cam.z * u + right.z * r; }
  else if (input.target) { x = input.target.x - player.x; z = input.target.z - player.z; if (Math.hypot(x, z) < 0.12) return null; }
  const l = Math.hypot(x, z);
  return l < 1e-4 ? null : { x: x / l, z: z / l };
}

const DEFLECT = [0, 0.5, -0.5, 1.0, -1.0, 1.35, -1.35];
export const PROBE = 0.25;   // how far ahead stepPlayer looks before it takes a step

/** 0.30.3 "Routes": stepPlayer's own test of one straight step from `here` ({ x, y, z }) in direction (dx, dz): the point `probe` ahead and the point `base` ahead must both be
 *  walkable (stepFactor); 0 when the probe is not, else the smaller factor (when the short step alone is refused, the probe's). The one place that decides it: stepPlayer calls it for every direction it tries and game/walk calls it
 *  along a planned line, so what the planner accepts is exactly what the stepper would walk (bushes false: only whether it is 0 is asked). */
export function stepAhead(w, here, dx, dz, base, sea = 0, probe = PROBE, bushes = true) {
  const pf = stepFactor(w, here, here.x + dx * probe, here.z + dz * probe, sea, bushes); if (!pf) return 0;
  const f = stepFactor(w, here, here.x + dx * base, here.z + dz * base, sea, bushes);   // (a short step into a thin steep band that the point 0.25 m ahead clears is walked at the pace of that point: the band is narrower than the probe, as the planner's lattice sees it)
  return f ? Math.min(f, pf) : pf;
}

export function stepPlayer(w, p, dir, dt, run = false, load = 1, sea = 0, stride = 1, opts = null) {
  if (!dir) { p.moving = false; p.speed = 0; return { moved: false, distance: 0, blocked: false }; }
  const base = (run ? RUN_SPEED : WALK_SPEED) * load * dt, here = { x: p.x, z: p.z, y: p.y };
  let best = null;
  for (const da of DEFLECT) {
    const c = Math.cos(da), s = Math.sin(da), dx = dir.x * c - dir.z * s, dz = dir.x * s + dir.z * c;
    const f = stepAhead(w, here, dx, dz, base, sea); if (!f) continue;
    best = { dx, dz, f: f * (da === 0 ? 1 : Math.cos(da) * 0.9) }; break;
  }
  if (!best) { p.moving = false; p.speed = 0; return { moved: false, distance: 0, blocked: true }; }
  let step = base * best.f, nx = p.x + best.dx * step, nz = p.z + best.dz * step;
  if (w.tiles) {
    const q = pushOut(w, here, nx, nz, opts);
    if (q.x !== nx || q.z !== nz) {
      const intended = step;
      step = Math.hypot(q.x - p.x, q.z - p.z);
      if (step > intended * (1 + 1e-9) && step > 1e-9) {   // 0.30.3: an ejection from inside a solid (a pile laid under his feet) never carries him farther than the step he took
        const cx = p.x + (q.x - p.x) / step * intended, cz = p.z + (q.z - p.z) / step * intended;
        if (obstaclesNear(w, cx, cz, opts).every(o => { const d = Math.hypot(cx - o.x, cz - o.z); return d >= o.r || d >= Math.hypot(here.x - o.x, here.z - o.z) - 1e-9; })) { q.x = cx; q.z = cz; step = intended; }   // (only where pushOut's own rule allows the point: outside, or not deeper than where he stood)
      }
      nx = q.x; nz = q.z;
      if (step < 1e-4 || !stepFactor(w, here, nx, nz, sea)) { p.moving = false; p.speed = 0; return { moved: false, distance: 0, blocked: true }; }
      best.dx = (nx - p.x) / step; best.dz = (nz - p.z) / step;
    }
  }
  p.x = nx; p.z = nz; p.y = w.H(p.x, p.z);
  p.moving = true; p.speed = dt > 0 ? step / dt : 0;
  const ta = Math.atan2(best.dx, best.dz); let d = ta - p.heading; d = Math.atan2(Math.sin(d), Math.cos(d)); p.heading += d * Math.min(1, dt * 12);
  p.phase += step * 5.2 / Math.max(0.3, stride);
  return { moved: true, distance: step, blocked: false };
}
