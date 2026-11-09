/**
 * game/walk — the one traversability rule for a straight segment (0.30.3 "Routes").
 *
 * Whether the castaway can walk a straight line from a to b is decided here and nowhere else: the grid edges and the fine edges of game/path and
 * game/fine, the connections of a start and a goal point, `path.clear`, the visibility tests of the follower (game/route) and the tests all call it.
 * Three things close or make dear a line:
 *   - the terrain, in short steps of STEP (0.25 m) exactly as game/movement `stepPlayer` probes it (`stepFactor`): a wall or deep water anywhere on
 *     the line closes it, else its pace is the harmonic mean of the steps (the bushes only where the line ends);
 *   - every dynamic circle of the camp view (game/obstacles): the line is closed when it comes nearer to a circle's middle than `r + margin`. A
 *     point that already lies inside a circle may only leave it: a line that does not get nearer to that circle's middle is
 *     open (movement's `pushOut` escape rule), no other; a start or a goal in the margin zone of a circle (outside the circle itself) is usable as long as the line does not get nearer than that end. The margin is PLAN_MARGIN (0.05) for planning and FOLLOW_MARGIN (0.04) for the follower's
 *     corner cutting, so a planned line is always visible to the follower (and the nodes of game/fine lie 0.06 outside a circle);
 *   - the natural circles (trunks, boulders, crags from the tiles): dear (x0.25, he slides round them and can stick between two) when planning,
 *     closed ('block') for corner cutting.
 * The circle geometry is the one `pushOut` enforces, so every planned segment can be walked.
 *
 * STEP, PLAN_MARGIN, FOLLOW_MARGIN, NATURAL_DEAR
 * terrainPace(world, a, b) -> 0 | pace   the terrain part: 0 when any step is a wall, else the harmonic mean of the steps' speed factors
 * naturalHit(world, a, b) -> the natural circle the line meets, or null
 * staticFactor(world, a, b, natural?) -> terrainPace x (1 | NATURAL_DEAR | 0 for a natural hit: 'dear' (default) or 'block'); depends on the island only, so it may be cached
 * campOpen(camp, a, b, margin?, escape?) -> true when no dynamic circle closes the line (camp: the view of game/obstacles, or a plain callback wrapped by `asCamp`); escape (true) applies the leaving rule to the start a
 * edgeFactor(world, a, b, camp, { margin?, natural?, escape?, sf? }) -> 0 | 0..1   the rule: 0 when closed, else the pace (sf: a staticFactor already known, which skips the terrain steps)
 * segmentClear(world, a, b, camp, margin?) -> true when the line can be walked at once at a decent pace: open, pace above 0.3, no natural circle on it
 * asCamp(obstacles) -> camp | null   the camp view behind an `obstacles` callback (`.camp`), or a view of a plain callback (no circle list, no key), or null
 *
 * Pure functions on a world; no DOM, no Three.js.
 *
 * Depends on: game/movement
 */
import { stepFactor, obstaclesNear } from './movement.js';

export const STEP = 0.25;            // the length of the short steps a line is checked in (the probe of stepPlayer)
export const PLAN_MARGIN = 0.05;     // clearance a planned line keeps from a camp circle
export const FOLLOW_MARGIN = 0.04;   // clearance the follower keeps when it cuts a corner
export const NATURAL_DEAR = 0.25;
const EPS = 1e-6;

/** The camp view for an `obstacles` option: a campSolids view (`fn.camp`), a plain callback wrapped, or null. */
export function asCamp(obstacles) {
  if (typeof obstacles !== 'function') return null;
  if (obstacles.camp) return obstacles.camp;
  return { key: null, circles: null, groups: null, count: 1, refresh() { return this; }, nearNow: (x, z, r) => obstacles(x, z, r), near: (x, z, r) => obstacles(x, z, r), inside(x, z, m = 0) { for (const o of obstacles(x, z, m)) if (Math.hypot(x - o.x, z - o.z) < o.r + m) return o; return null; }, plain: true };
}

/** 0 when a step of the line is a wall (or water too deep), else the harmonic mean of the speed factors of the 0.25 m steps. */
export function terrainPace(world, a, b) {
  const len = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(len / STEP));
  let prev = { x: a.x, z: a.z, y: world.H(a.x, a.z) }, inv = 0;
  for (let i = 1; i <= n; i++) {
    const x = a.x + (b.x - a.x) * i / n, z = a.z + (b.z - a.z) * i / n, f = stepFactor(world, prev, x, z, 0, i === n);   // the bushes only where the line ends (they are dear to look up)
    if (f <= 0) return 0;
    inv += 1 / f; prev = { x, z, y: world.H(x, z) };
  }
  return n / inv;
}

/** The natural circle (trunk, boulder, crag) the line a -> b comes nearer to than its radius, or null. */
export function naturalHit(world, a, b) {
  if (!world.tiles) return null;
  const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz), l2 = dx * dx + dz * dz || 1e-9, n = Math.max(1, Math.ceil(len / 1.4));
  let seen = null;
  for (let i = 0; i <= n; i++) {
    const sx = a.x + dx * i / n, sz = a.z + dz * i / n;
    for (const o of obstaclesNear(world, sx, sz)) {
      if (n > 1) { if (!seen) seen = new Set(); if (seen.has(o)) continue; seen.add(o); }
      const u = Math.min(1, Math.max(0, ((o.x - a.x) * dx + (o.z - a.z) * dz) / l2));
      if (Math.hypot(a.x + dx * u - o.x, a.z + dz * u - o.z) < o.r) return o;
    }
  }
  return null;
}

/** The part of the rule that depends on the island only: the terrain pace, times NATURAL_DEAR (or closed with 'block') when a natural circle is on the line. */
export function staticFactor(world, a, b, natural = 'dear') {
  const f = terrainPace(world, a, b);
  if (f <= 0) return 0;
  if (naturalHit(world, a, b)) return natural === 'block' ? 0 : f * NATURAL_DEAR;
  return f;
}

/**
 * True when no circle of the camp closes the line a -> b (see the header). A line is closed when it comes nearer to a circle's middle than r + margin, with two
 * exceptions that keep a place in the margin zone itself usable: the nearest point of the line is one of its ends and that end is not inside the circle (the line
 * starts or ends in the margin zone and never goes nearer than that), and the start (escape) already lies inside the circle and the line does not get nearer to its middle.
 */
export function campOpen(camp, a, b, margin = PLAN_MARGIN, escape = true) {
  if (!camp || !camp.count) return true;
  const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1e-9, len = Math.sqrt(l2);
  for (const o of camp.nearNow((a.x + b.x) / 2, (a.z + b.z) / 2, len / 2 + margin)) {
    const t = ((o.x - a.x) * dx + (o.z - a.z) * dz) / l2, u = Math.min(1, Math.max(0, t));
    const dmin = Math.hypot(a.x + dx * u - o.x, a.z + dz * u - o.z);
    if (dmin >= o.r + margin - EPS) continue;
    if ((t <= 0 || t >= 1) && dmin >= o.r - EPS) continue;   // the margin zone is entered at an end only
    if (escape) {   // a circle he stands in (or in the margin of): he may leave it ('lenient': by any line, the old rule; movement slides him)
      const d0 = Math.hypot(a.x - o.x, a.z - o.z);
      if (escape === 'lenient' ? d0 < o.r + margin : d0 < o.r && dx * (a.x - o.x) + dz * (a.z - o.z) >= -EPS) continue;
    }
    return false;
  }
  return true;
}

/** The rule: 0 when the line a -> b is closed, else its pace factor (0..1). */
export function edgeFactor(world, a, b, camp, { margin = PLAN_MARGIN, natural = 'dear', escape = true, sf = undefined } = {}) {
  if (camp) { if (camp.refresh) camp.refresh(); if (!campOpen(camp, a, b, margin, escape)) return 0; }
  return sf !== undefined ? sf : staticFactor(world, a, b, natural);
}

/** True when the line can be walked at once: open, a decent pace and no natural circle on it (the follower cuts a corner only then). */
export function segmentClear(world, a, b, camp, margin = FOLLOW_MARGIN) {
  return edgeFactor(world, a, b, camp, { margin, natural: 'block' }) > 0.3;
}
