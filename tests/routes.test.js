// Routes (0.30.3 "Routes"): real movement. A lean-to at several headings and sub-grid offsets, on a flat open spot and among trees of island 1337 (found by a search, no
// coordinates written here), is walked in, out and round with the real stepPlayer and the follower of game/route: no route failure, no stall of 3 s, no clipping into a wall,
// no oscillation, and the camp growing under a plan. The phase-1 evidence (docs/architecture.md "Routes") measured 5 to 13 % no route and stalls of 4.5 to 19 s on the same cases.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { canStand, terrainAt, obstaclesNear, WALK_SPEED } from '../src/game/movement.js';
import { createPath } from '../src/game/path.js';
import { solidObstacles } from '../src/game/obstacles.js';
import { routeWalk } from './helpers/routeWalk.js';

let w, spawn, open, trees;
const state = () => ({ wood: { piles: [] }, fire: { fires: [], burnt: [] }, leantos: { list: [] } });
const pile = (x, z, n = 6) => ({ x, z, kind: 'driftwood', logs: Array.from({ length: n }, (_, i) => ({ id: i, x, z, len: 1.5, a: 0, rad: 0.1 })) });

// a flat, dry spot (12 m round) with the fewest trunks and boulders within 8 m (open) and the one with the most (trees)
function findSpots(world, near) {
  let best = null, busy = null;
  for (let r = 0; r < 160; r += 4) for (let i = 0; i < 24; i++) {
    const ang = i * Math.PI / 12, x = near.x + Math.cos(ang) * r, z = near.z + Math.sin(ang) * r;
    let flat = true, natural = 0;
    for (let dx = -12; dx <= 12 && flat; dx += 3) for (let dz = -12; dz <= 12; dz += 3) {
      if (Math.hypot(dx, dz) > 12) continue;
      const px = x + dx, pz = z + dz;
      if (!canStand(world, px, pz, 0) || world.H(px, pz) < 0.7 || terrainAt(world, px, pz, 0).s > 0.3) { flat = false; break; }
      if (Math.hypot(dx, dz) <= 8) natural += obstaclesNear(world, px, pz).length;
    }
    if (!flat) continue;
    if (!best || natural < best.natural) best = { x, z, natural };
    if (natural && (!busy || natural > busy.natural)) busy = { x, z, natural };
  }
  return { open: best, trees: busy };
}

beforeAll(async () => {
  w = await generateWorld(1337); spawn = startSpot(w);
  const s = findSpots(w, spawn); open = s.open; trees = s.trees;
}, 120000);

const HEADINGS = [0, Math.PI / 4, Math.PI / 2, Math.PI, 3 * Math.PI / 4];
const OFFSETS = [[0, 0], [0.4, 0.7], [0.75, 0.3], [1.1, 1.2], [-0.5, 0.2]];

// the walks of one lean-to: [name, from, to, stop] in its frame (f along the heading, the open side; r across)
function cases(C, h) {
  const f = { x: Math.sin(h), z: Math.cos(h) }, r = { x: f.z, z: -f.x }, P = (a, b) => ({ x: C.x + f.x * a + r.x * b, z: C.z + f.z * a + r.z * b });
  return [
    ['inside to behind', P(0, 0), P(-3, 0), 0.5],
    ['behind to inside (the sleep point)', P(-3, 0), P(0, 0), 0.3],
    ['8 m behind to inside', P(-8, 1), P(0, 0), 0.3],
    ['beside to front', P(0, 3), P(3, 0), 0.5],
    ['round the corner', P(-2, 2.2), P(2, -2.2), 0.5],
    ['inside to the front', P(0, 0), P(6, 0), 0.5],
    ['front to inside', P(6, 0), P(0, 0), 0.3],
    ['inside to the side', P(0, 0), P(0, 5), 0.5],
  ];
}

for (const [label, where] of [['a flat open spot', () => open], ['a spot among trees', () => trees]]) {
  describe(`walking in, out and round a lean-to on ${label}`, () => {
    it('finds a way every time and walks it without a stall, clipping, oscillation or more than one replan', () => {
      const C0 = where(); expect(C0).toBeTruthy();
      let n = 0;
      for (const [ox, oz] of OFFSETS) for (const h of HEADINGS) {
        const C = { x: C0.x + ox, z: C0.z + oz };
        for (const [name, from, to, stop] of cases(C, h)) {
          const s = state(); s.leantos.list.push({ id: 0, x: C.x, z: C.z, heading: h, progress: 1 });
          const movement = { obstacles: solidObstacles(s.wood, s.fire, s.leantos) }, finder = createPath(w, movement);
          const r = routeWalk(w, finder, from, to, { secs: 40, stop, movement });
          const at = `${name}, heading ${h.toFixed(2)}, offset ${ox},${oz}`; n++;
          expect(r.nopath, `no route: ${at}`).toBe(false);
          expect(r.unreachable, `unreachable (${r.reason}): ${at}`).toBe(false);
          expect(r.arrived, `did not arrive (${r.finalDistance.toFixed(2)} m short after ${r.secs.toFixed(1)} s): ${at}`).toBe(true);
          expect(r.stall, `stall of ${r.stall.toFixed(1)} s: ${at}`).toBeLessThan(1.5);
          expect(r.replans, `replans: ${at}`).toBeLessThanOrEqual(1);
          expect(r.clip, `clipped ${r.clip.toFixed(2)} m into a wall: ${at}`).toBeLessThan(0.06);
          expect(r.reversals, `turned back: ${at}`).toBeLessThanOrEqual(1);
          const plan = finder.find(from, to), planned = plan.pts.reduce((a, q, i) => a + Math.hypot(q.x - (i ? plan.pts[i - 1].x : from.x), q.z - (i ? plan.pts[i - 1].z : from.z)), 0);
          expect(r.secs, `slow (${r.secs.toFixed(1)} s for ${planned.toFixed(1)} m planned): ${at}`).toBeLessThan(1.3 * planned / WALK_SPEED + 1.5);
        }
      }
      expect(n).toBe(OFFSETS.length * HEADINGS.length * 8);
    });
  });
}

describe('a camp that grows under a plan', () => {
  // walks 16 m across the open spot; at 1.5 s `change` adds to the camp
  const grow = (change, stop = 0.5) => {
    const results = [];
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4 + 0.15, u = { x: Math.cos(a), z: Math.sin(a) };
      const from = { x: open.x - u.x * 8, z: open.z - u.z * 8 }, to = { x: open.x + u.x * 8, z: open.z + u.z * 8 };
      const s = state(), movement = { obstacles: solidObstacles(s.wood, s.fire, s.leantos) }, finder = createPath(w, movement);
      let done = false;
      const r = routeWalk(w, finder, from, to, { secs: 40, stop, movement, onTick: (t, p) => { if (!done && t >= 1.5) { done = true; change(s, p, u); } } });
      results.push(r);
    }
    return results;
  };
  const expectFine = (rs, what) => rs.forEach((r, k) => {
    expect(r.arrived, `${what}: direction ${k} did not arrive (${r.reason}, ${r.finalDistance.toFixed(2)} m short)`).toBe(true);
    expect(r.stall, `${what}: stall of ${r.stall.toFixed(1)} s in direction ${k}`).toBeLessThan(3);
    expect(r.clip, `${what}: clipped ${r.clip.toFixed(2)} m`).toBeLessThan(0.06);
    expect(r.replans, `${what}: replans`).toBeLessThanOrEqual(3);
  });
  it('walks round a pile laid 3 m and 1.2 m ahead on the line', () => {
    expectFine(grow((s, p, u) => s.wood.piles.push(pile(p.x + u.x * 3, p.z + u.z * 3))), 'pile 3 m ahead');
    expectFine(grow((s, p, u) => s.wood.piles.push(pile(p.x + u.x * 1.2, p.z + u.z * 1.2))), 'pile 1.2 m ahead');
  });
  it('walks out of a pile laid under his feet', () => { expectFine(grow((s, p, u) => s.wood.piles.push(pile(p.x + u.x * 0.3, p.z + u.z * 0.3))), 'pile under him'); });
  it('finds the way round two piles 1.4 m apart across the line', () => {
    expectFine(grow((s, p, u) => { s.wood.piles.push(pile(p.x + u.x * 3 + u.z * 0.7, p.z + u.z * 3 - u.x * 0.7)); s.wood.piles.push(pile(p.x + u.x * 3 - u.z * 0.7, p.z + u.z * 3 + u.x * 0.7)); }), 'two piles');
  });
  it('walks round a lean-to started on the line, and out of one started round him', () => {
    expectFine(grow((s, p, u) => s.leantos.list.push({ id: 0, x: p.x + u.x * 3.5, z: p.z + u.z * 3.5, heading: Math.atan2(u.x, u.z) + 1, progress: 0 })), 'lean-to ahead');
    expectFine(grow((s, p, u) => s.leantos.list.push({ id: 0, x: p.x + u.x * 0.9, z: p.z + u.z * 0.9, heading: Math.atan2(u.x, u.z), progress: 0 })), 'lean-to started round him');
  });
});

describe('a camp that shuts him in', () => {
  it('reports no route at all, quickly, instead of walking into the wall', () => {
    const s = state(); for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; s.wood.piles.push(pile(open.x + Math.cos(a) * 1.3, open.z + Math.sin(a) * 1.3)); }
    const movement = { obstacles: solidObstacles(s.wood, s.fire, s.leantos) }, finder = createPath(w, movement);
    const r = routeWalk(w, finder, { x: open.x, z: open.z }, { x: open.x + 8, z: open.z }, { secs: 20, movement });
    expect(r.unreachable).toBe(true); expect(r.secs).toBeLessThan(5); expect(r.clip).toBeLessThan(0.06);
  });
});
