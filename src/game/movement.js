/**
 * game/movement — how the castaway moves over the island.
 *
 * Rules
 *   - Open sea (ground below -0.6) and deep river water (> 0.85) block.
 *   - Gentle ground (steepness < 0.85) is walked at full speed, up to 1.25
 *     at 70 %.
 *   - Anything steeper is a wall and blocks, unless it is a natural passage
 *     (scree, ravine, bench, beside a waterfall, roots) where you scramble
 *     at 42 % up to steepness 3.2. The short steps of a bench and a root
 *     wall can be steeper (up to 4.8); you haul yourself up at 30 %.
 *   - Wading slows you down.
 *   - Tree trunks (broadleaf, rain forest, pine, palm), boulders of at least
 *     STONE_MIN and crags block; you collide with the trunk, not the crown.
 *     Bushes, grass, roots, small stones and beach finds do not block, nor do
 *     stones lying on a climbing route (you scramble over them).
 *     Standing inside an obstacle (never on purpose) you can always walk out.
 *   - When the way ahead is blocked, a few deflected directions are tried
 *     so you slide along walls instead of sticking to them.
 *
 * Pure functions on a world (see world/world); no DOM, no Three.js.
 *
 * terrainAt(world, x, z) -> { y, L, s, rv, inRiver, depth, pa, fr, climb }
 * stepFactor(world, from, x, z) -> 0 (blocked) or a speed factor 0..1
 * obstaclesNear(world, x, z) -> [{ x, z, r }] blocking circles from the tiles
 *   around (x, z); r already includes the castaway's own radius (BODY)
 * pushOut(world, from, x, z) -> { x, z } moved back onto the rim of any
 *   obstacle that stepping from `from` to (x, z) would enter
 * createPlayer(spot) -> player state { x, y, z, heading, moving, speed, phase }
 * moveIntent(input, player) -> unit direction { x, z } or null, from keys/target;
 *   keys walk relative to the screen, so they use input.yaw (the current
 *   view angle, see core/view; the starting view when missing)
 * stepPlayer(world, player, dir, dt, run) -> { moved, distance, blocked }
 *   Mutates player. `phase` advances with distance (for the walk cycle).
 *
 * Depends on: core/view, world/constants
 */
import { YAW, basis } from '../core/view.js';
import { HALF, T, NT } from '../world/constants.js';

export const WALK_SPEED = 2.9;
export const RUN_SPEED = 3.9;
export const BODY = 0.2;        // the castaway's radius
export const STONE_MIN = 0.35;  // smaller stones are stepped over

const cache = new WeakMap();
function tileObstacles(w, tile) {
  let list = cache.get(tile);
  if (list) return list;
  list = [];
  const onRoute = t => terrainAt(w, t.x, t.z).climb > 0.25;   // stones on a climbing route are scrambled over
  for (const t of tile.trees) list.push({ x: t.x, z: t.z, r: (t.jungle ? 0.18 : 0.13) + BODY });
  for (const t of tile.pines) list.push({ x: t.x, z: t.z, r: 0.09 + BODY });
  for (const t of tile.palms) list.push({ x: t.x, z: t.z, r: 0.1 + BODY });
  for (const t of tile.rocks) if (t.s >= STONE_MIN && !onRoute(t)) list.push({ x: t.x, z: t.z, r: t.s * 0.9 + BODY });
  for (const t of tile.crags) if (!onRoute(t)) list.push({ x: t.x, z: t.z, r: t.s * 1.1 + BODY });
  cache.set(tile, list);
  return list;
}

const REACH = 1.6;   // larger than any obstacle radius
export function obstaclesNear(w, x, z) {
  const out = [], t0x = Math.floor((x - REACH + HALF) / T), t1x = Math.floor((x + REACH + HALF) / T);
  const t0z = Math.floor((z - REACH + HALF) / T), t1z = Math.floor((z + REACH + HALF) / T);
  for (let tz = Math.max(0, t0z); tz <= Math.min(NT - 1, t1z); tz++) for (let tx = Math.max(0, t0x); tx <= Math.min(NT - 1, t1x); tx++) {
    const tile = w.tiles[tz * NT + tx];
    if (tile) for (const o of tileObstacles(w, tile)) if (Math.abs(o.x - x) < REACH && Math.abs(o.z - z) < REACH) out.push(o);
  }
  return out;
}

/** Push (x, z) out of any obstacle it entered from `a`, onto its rim: that makes you slide round trunks and boulders. */
export function pushOut(w, a, x, z) {
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const o of obstaclesNear(w, x, z)) {
      const dx = x - o.x, dz = z - o.z, d = Math.hypot(dx, dz);
      if (d >= o.r || d >= Math.hypot(a.x - o.x, a.z - o.z)) continue;   // outside, or already inside and walking out
      const k = d > 1e-6 ? o.r / d : 0; x = o.x + (k ? dx * k : o.r); z = o.z + (k ? dz * k : 0); moved = true;
    }
    if (!moved) break;
  }
  return { x, z };
}

export function terrainAt(w, x, z) {
  const y = w.H(x, z), L = w.Lat(x, z), s = w.slope(x, z);
  const rv = w.riverAt(x, z), inRiver = !!(rv && rv.d < rv.hw + 0.1 && y < rv.lw);
  const pa = w.passAt(x, z, L), fr = rv ? w.fallRouteAt(x, z) : 0, climb = Math.max(pa.any, fr);
  return { y, L, s, rv, inRiver, depth: inRiver ? rv.lw - y : (y < 0 ? -y : 0), pa, fr, climb };
}

export function stepFactor(w, a, x, z) {
  const b = terrainAt(w, x, z), dist = Math.hypot(x - a.x, z - a.z) || 1e-6, grade = (b.y - a.y) / dist;
  if (b.y < -0.6 || b.depth > 0.85) return 0;
  const steep = Math.max(b.s, Math.abs(grade));
  let f;
  if (steep < 0.85) f = 1;
  else if (steep < 1.25) f = 0.7;
  else if (b.climb > 0.25) {
    // benches and root walls are short steep steps you haul yourself up
    const limit = 3.2 + 1.6 * Math.max(b.pa.bench, b.pa.roots);
    if (steep < 3.2) f = 0.42; else if (steep < limit) f = 0.3; else return 0;
  } else return 0;
  if (b.depth > 0.05) f *= b.depth > 0.4 ? 0.45 : 0.7;
  return f;
}

export function createPlayer(spot) {
  return { x: spot.x, y: spot.y, z: spot.z, heading: 2.6, moving: false, speed: 0, phase: 0 };
}

/**
 * input: { up, down, left, right } booleans, yaw, and/or target { x, z }, and
 * the player position. Keys win over a target. Returns null when standing still.
 */
export function moveIntent(input, player) {
  const u = (input.up ? 1 : 0) - (input.down ? 1 : 0), r = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let x = 0, z = 0;
  if (u || r) { const { cam, right } = basis(input.yaw === undefined ? YAW : input.yaw); x = -cam.x * u + right.x * r; z = -cam.z * u + right.z * r; }
  else if (input.target) { x = input.target.x - player.x; z = input.target.z - player.z; if (Math.hypot(x, z) < 0.12) return null; }
  const l = Math.hypot(x, z);
  return l < 1e-4 ? null : { x: x / l, z: z / l };
}

const DEFLECT = [0, 0.5, -0.5, 1.0, -1.0, 1.35, -1.35];

export function stepPlayer(w, p, dir, dt, run = false) {
  if (!dir) { p.moving = false; p.speed = 0; return { moved: false, distance: 0, blocked: false }; }
  const base = (run ? RUN_SPEED : WALK_SPEED) * dt, here = { x: p.x, z: p.z, y: p.y };
  let best = null;
  for (const da of DEFLECT) {
    const c = Math.cos(da), s = Math.sin(da), dx = dir.x * c - dir.z * s, dz = dir.x * s + dir.z * c;
    const probe = stepFactor(w, here, here.x + dx * 0.25, here.z + dz * 0.25); if (!probe) continue;
    const f = stepFactor(w, here, here.x + dx * base, here.z + dz * base); if (!f) continue;
    best = { dx, dz, f: Math.min(f, probe) * (da === 0 ? 1 : Math.cos(da) * 0.9) }; break;
  }
  if (!best) { p.moving = false; p.speed = 0; return { moved: false, distance: 0, blocked: true }; }
  let step = base * best.f, nx = p.x + best.dx * step, nz = p.z + best.dz * step;
  if (w.tiles) {
    const q = pushOut(w, here, nx, nz);
    if (q.x !== nx || q.z !== nz) {
      step = Math.hypot(q.x - p.x, q.z - p.z); nx = q.x; nz = q.z;
      if (step < 1e-4 || !stepFactor(w, here, nx, nz)) { p.moving = false; p.speed = 0; return { moved: false, distance: 0, blocked: true }; }
      best.dx = (nx - p.x) / step; best.dz = (nz - p.z) / step;
    }
  }
  p.x = nx; p.z = nz; p.y = w.H(p.x, p.z);
  p.moving = true; p.speed = dt > 0 ? step / dt : 0;
  const ta = Math.atan2(best.dx, best.dz); let d = ta - p.heading; d = Math.atan2(Math.sin(d), Math.cos(d)); p.heading += d * Math.min(1, dt * 12);
  p.phase += step * 5.2;
  return { moved: true, distance: step, blocked: false };
}
