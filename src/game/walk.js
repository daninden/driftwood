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
 *     0.33.2: a line that cuts between two natural circles that overlap (a wall of trunks, `naturalWall`) is closed in planning too.
 * The circle geometry is the one `pushOut` enforces, so every planned segment can be walked.
 *
 * stepperOpen(world, a, b, lateral?) -> true when stepPlayer's own test (movement stepAhead) passes at a place every DENSE along the line, and (0.33.3) along the lines LATERAL (0.12 m) to either side of it too (he never keeps exactly to a line: a
 *   band he could pass only on the line itself stalled the follower, seed 2024 near (-107.0, -147.2)); terrainPace asks it where the ground along the line is at least STEEP
 * STEP, STEEP, DENSE, LATERAL, PLAN_MARGIN, FOLLOW_MARGIN, NATURAL_DEAR
 * terrainPace(world, a, b) -> 0 | pace   the terrain part: 0 when any step is a wall, else the harmonic mean of the steps' speed factors
 * naturalHit(world, a, b) -> the natural circle the line meets, or null
 * naturalWall(world, a, b) -> true when the line cuts between two overlapping natural circles (0.33.2: closed in staticFactor)
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
import { stepFactor, stepAhead, obstaclesNear } from './movement.js';

export const STEP = 0.25;            // the length of the short steps a line is checked in (the probe of stepPlayer)
export const PLAN_MARGIN = 0.05;     // clearance a planned line keeps from a camp circle
export const FOLLOW_MARGIN = 0.04;   // clearance the follower keeps when it cuts a corner
export const NATURAL_DEAR = 0.25;
export const STEEP = 0.85;           // ground at least this steep along a line makes `terrainPace` ask the stepper's own test (a gentler line has no band for the lattice to miss)
export const LATERAL = 0.12;     // how far to either side of a steep line the stepper must pass too
export const DENSE = 0.05;           // the spacing of the places along a line where the stepper's own test is made (about one step at 60 frames a second)
const EPS = 1e-6;

/** The camp view for an `obstacles` option: a campSolids view (`fn.camp`), a plain callback wrapped, or null. */
export function asCamp(obstacles) {
  if (typeof obstacles !== 'function') return null;
  if (obstacles.camp) return obstacles.camp;
  return { key: null, circles: null, groups: null, count: 1, refresh() { return this; }, nearNow: (x, z, r) => obstacles(x, z, r), near: (x, z, r) => obstacles(x, z, r), inside(x, z, m = 0) { for (const o of obstacles(x, z, m)) if (Math.hypot(x - o.x, z - o.z) < o.r + m) return o; return null; }, plain: true };
}

/**
 * True when stepPlayer could walk the line a -> b step by step: at a place every DENSE (0.05 m) along it, game/movement `stepAhead` (the stepper's own test: the point 0.25 m
 * ahead and the point one step ahead must both be walkable, with the symmetric steepness rule) is made in the direction of the line, the look-ahead cut short at the end
 * of the line. The lattice of 0.25 m steps in `terrainPace` alone let a thin steep band between two of its places through, and the stepper then refused a step into it.
 */
export function stepperOpen(world, a, b, lateral = LATERAL) {
  const len = Math.hypot(b.x - a.x, b.z - a.z); if (len < 1e-6) return true;
  if (lateral > 0) {   // the follower never keeps exactly to a line: the lines a little to either side must be open too (a band the stepper could pass only on the line itself is no way)
    const nx = -(b.z - a.z) / len * lateral, nz = (b.x - a.x) / len * lateral;
    return stepperOpen(world, a, b, 0) && stepperOpen(world, { x: a.x + nx, z: a.z + nz }, { x: b.x + nx, z: b.z + nz }, 0) && stepperOpen(world, { x: a.x - nx, z: a.z - nz }, { x: b.x - nx, z: b.z - nz }, 0);
  }
  const n = Math.max(1, Math.ceil(len / DENSE)), d = len / n, ux = (b.x - a.x) / len, uz = (b.z - a.z) / len, here = { x: a.x, y: 0, z: a.z };
  for (let i = 0; i < n; i++) {
    here.x = a.x + ux * d * i; here.z = a.z + uz * d * i; here.y = world.H(here.x, here.z);
    if (!stepAhead(world, here, ux, uz, d, 0, Math.min(STEP, len - d * i), false)) return false;
  }
  return true;
}

/** 0 when a step of the line is a wall (or water too deep), else the harmonic mean of the speed factors of the 0.25 m steps; 0 too when the stepper itself could not walk it (`stepperOpen`). */
export function terrainPace(world, a, b) {
  const len = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(len / STEP));
  let prev = { x: a.x, z: a.z, y: world.H(a.x, a.z) }, inv = 0, steep = world.slope(a.x, a.z) >= STEEP;
  for (let i = 1; i <= n; i++) {
    const x = a.x + (b.x - a.x) * i / n, z = a.z + (b.z - a.z) * i / n, f = stepFactor(world, prev, x, z, 0, i === n);   // the bushes only where the line ends (they are dear to look up)
    if (f <= 0) return 0;
    inv += 1 / f; prev = { x, z, y: world.H(x, z) }; if (!steep && world.slope(x, z) >= STEEP) steep = true;
  }
  return !steep || stepperOpen(world, a, b) ? n / inv : 0;   // (only where the ground along the line is steep can a band hide between the places of the lattice)
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

/**
 * 0.33.2 "Mend": true when the line a -> b runs through a wall of trunks: two natural circles that overlap (their radii already include his body, so a point cannot pass between them) and that the line cuts between their
 * middles. He can slide round one circle (that is what NATURAL_DEAR prices), but a line through such a pair has no way past it along itself: he wedged between the two (seed 1337, a journey route near (-14.0, 36.4)),
 * stalled and the follower had to close the edge and plan again.
 */
export function naturalWall(world, a, b) {
  if (!world.tiles) return false;
  const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz), l2 = dx * dx + dz * dz || 1e-9, n = Math.max(1, Math.ceil(len / 1.4));
  const hit = new Set();
  for (let i = 0; i <= n; i++) {
    for (const o of obstaclesNear(world, a.x + dx * i / n, a.z + dz * i / n)) {
      if (hit.has(o)) continue;
      const u = Math.min(1, Math.max(0, ((o.x - a.x) * dx + (o.z - a.z) * dz) / l2));
      if (Math.hypot(a.x + dx * u - o.x, a.z + dz * u - o.z) < o.r) hit.add(o);
    }
  }
  if (hit.size < 2) return false;
  const list = [...hit];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const p = list[i], q = list[j], ex = q.x - p.x, ez = q.z - p.z;
    if (Math.hypot(ex, ez) >= p.r + q.r) continue;   // a gap between them: the line may pass through it
    // do the line a -> b and the segment p -> q cross?
    const den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) continue;
    const t = ((p.x - a.x) * ez - (p.z - a.z) * ex) / den, v = ((p.x - a.x) * dz - (p.z - a.z) * dx) / den;
    if (t >= 0 && t <= 1 && v >= 0 && v <= 1) return true;
  }
  return false;
}

/** The part of the rule that depends on the island only: the terrain pace, times NATURAL_DEAR (or closed with 'block') when a natural circle is on the line; closed too for a wall of trunks (`naturalWall`). */
export function staticFactor(world, a, b, natural = 'dear') {
  const f = terrainPace(world, a, b);
  if (f <= 0) return 0;
  if (naturalHit(world, a, b)) return natural === 'block' || naturalWall(world, a, b) ? 0 : f * NATURAL_DEAR;
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
