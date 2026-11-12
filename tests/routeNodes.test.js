// Route nodes and start connections (0.33.3 "Routes"): the planner finds a way where it found none, and does not join a start across a wall. Real cases found by measuring the climbing routes of
// islands 1337 and 2024 (docs/versions.md 0.33.3); real movement: the walks are made with the real stepPlayer and the follower of game/route (tests/helpers/routeWalk.js), at the amble.
//   - a steep stretch of 1 to 2 m between two cell middles that cannot be stood on had no node and no edge: no plan at all (island 1337 near (52, 88), island 2024 near (24, -85));
//   - the river gorge of island 2024 (the stranded journey of the 60-day life, day 58) was cut off from the rest of the island on the cell grid;
//   - a start with no open line to any cell used to be joined to the two nearest cells whatever lay between (a wall, a rim): the walk then stalled at the wall; now there is no plan (or a real one).
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { canStand, terrainAt } from '../src/game/movement.js';
import { createPath } from '../src/game/path.js';
import { createRoute } from '../src/game/route.js';
import { routeWalk } from './helpers/routeWalk.js';

let w1, w2, g1, g2;
beforeAll(async () => {
  w1 = await generateWorld(1337); w2 = await generateWorld(2024);
  g1 = createGame(w1, startSpot(w1), {}); g2 = createGame(w2, startSpot(w2), {});
}, 240000);

const finder = (w, g, allow) => createPath(w, { obstacles: g.movement.obstacles, allow });
const walk = (w, g, f, a, b, o = {}) => routeWalk(w, f, a, b, { movement: g.movement, ...o });

describe('route nodes: a narrow climbing route between cells that cannot be stood on', () => {
  const cases = [
    ['island 1337, up the route near (52, 88)', 1337, { x: 46.74, z: 89.77 }, { x: 56.72, z: 86.22 }],
    ['island 1337, and back down', 1337, { x: 57.56, z: 88.73 }, { x: 47.32, z: 90.41 }],
    ['island 2024, up the route near (24, -85)', 2024, { x: 27.64, z: -87.49 }, { x: 20.21, z: -82.27 }],
    ['island 2024, and back down', 2024, { x: 20.21, z: -82.27 }, { x: 27.64, z: -87.49 }],
  ];
  for (const [name, seed, a, b] of cases) {
    it(`${name}: a plan over route nodes, walked with the real stepper`, () => {
      const w = seed === 1337 ? w1 : w2, g = seed === 1337 ? g1 : g2, f = finder(w, g);
      const plan = f.find(a, b); expect(plan).not.toBeNull();
      expect(plan.pts.some(p => p.id >= f.route.base)).toBe(true);   // (the cell grid alone has no way: 0.33.2 found none)
      expect(plan.pts.every(p => canStand(w, p.x, p.z, 0))).toBe(true);
      const r = walk(w, g, finder(w, g), a, b, { dt: 0.1 });
      expect(r.arrived).toBe(true); expect(r.stall).toBeLessThan(3);
    });
  }

  it('makes the nodes only where the grid has none: a cell whose middle can be stood on keeps its middle, and no node lies where he cannot stand', () => {
    const f = finder(w2, g2);
    f.find({ x: 27.64, z: -87.49 }, { x: 20.21, z: -82.27 });
    const rn = f.route; expect(rn.count).toBeGreaterThan(0);
    for (const n of rn.byId.values()) {
      expect(canStand(w2, n.x, n.z, 0)).toBe(true);
      expect(f.isStand(f.cell(n.x), f.cell(n.z))).toBe(false);   // (only on cells whose middle is no place to stand)
    }
    for (let ix = 150; ix < 160; ix++) for (let iz = 150; iz < 160; iz++) expect(f.isStand(ix, iz)).toBe(canStand(w2, f.centre(ix), f.centre(iz), 0));   // (what counts as standable on the grid is as before)
  });
});

describe('the river gorge of island 2024 (the stranded journey, day 58)', () => {
  const start = { x: 29.37, z: -87.76 }, home = { x: -136.3, z: -175.3 };
  // the journey's ground: ordinary ground, and route ground up to slope 3.2 (game/mind journeyGround)
  const allow = (x, z) => { const t = terrainAt(w2, x, z, 0); return t.climb <= 0.12 ? t.s < 0.45 : t.s < 3.2; };
  it('has a way home from the gorge (0.33.2: none, the gorge was cut off on the cell grid)', () => {
    const plan = finder(w2, g2, allow).find(start, home, 60000);
    expect(plan).not.toBeNull(); expect(plan.cost).toBeGreaterThan(150);
  });
  it('walks the first stretch of it with the real stepper', () => {
    const f = finder(w2, g2, allow), plan = f.find(start, home, 60000), mid = plan.pts[Math.min(plan.pts.length - 1, 40)];
    const r = walk(w2, g2, finder(w2, g2, allow), start, mid, { secs: 200 });
    expect(r.arrived).toBe(true);
  }, 120000);
});

describe('a start is not joined to a cell across a wall', () => {
  it('island 1337, a pocket by the cliff (cluster near (-96, 99)): a plan that can be walked, or none; never a plan that stalls at the wall', () => {
    const a = { x: -96.1, z: 98.93 }, b = { x: -103.45, z: 92.66 }, f = finder(w1, g1);
    const plan = f.find(a, b);   // (0.33.2 joined the start to the two nearest cells across the wall and the walk stalled four times: unreachable)
    if (plan) { const r = walk(w1, g1, finder(w1, g1), a, b, { secs: 120 }); expect(r.arrived).toBe(true); }
    else expect(plan).toBeNull();
  });
  it('island 2024, a thin strip at (-47.9, -83.1): the same for a long walk', () => {
    const a = { x: -47.88, z: -83.12 }, b = { x: -167.78, z: 51.77 }, f = finder(w2, g2);
    const plan = f.find(a, b);
    if (plan) { const r = walk(w2, g2, finder(w2, g2), a, b, { secs: 600 }); expect(r.arrived).toBe(true); }
    else expect(plan).toBeNull();
  }, 300000);
  it('island 2024, on the cliff rim at (-107, -147.2) (stroll stall of the 60-day life): the stroll to the palms (-115.7, -163.4) from the rim top is walked at the amble with no stall', () => {
    // the stepper's own test along a plan line was made on the line itself only; a band he could pass only on that exact line (here a face of 4.4 steepness, a few cm wide) stalled the follower half way down at (-107.0, -147.2)
    const goal = { x: -115.7, z: -163.4 }, a = { x: -89.3, z: -154.1 };
    for (const dt of [1 / 60, 0.1]) {
      const game = createGame(w2, a, {}), p = game.player; p.x = a.x; p.z = a.z; p.y = w2.H(a.x, a.z);
      const route = createRoute(finder(w2, game), p, goal, { stop: 1 });
      const inp = { up: false, down: false, left: false, right: false, run: false, stick: null, target: null, yaw: undefined, learns: false, pace: 0.65, sit: false, takeWake: () => false, takeLight: () => false, pressing: () => false, cancelAction() {}, clearTarget() { inp.target = null; }, takeAction: () => null, takeChoice: () => null, takeSleep: () => false };
      for (let t = 0; t < 120; t += dt) { const u = route.update(p, dt, false); if (u.state !== 'going') break; inp.target = u.final ? { ...goal, routed: true } : { x: u.target.x, z: u.target.z, routed: true }; game.update(inp, dt); }
      expect(route.state).toBe('arrived'); expect(route.stalls).toBe(0);
    }
  });
});
