// 0.30.10 "Walls": Dave must never get boxed in by his own camp. Things keep a walking gap (CAMP_GAP, game/obstacles).
//   1. the enclosure itself, in a minimal camp built from the trap found in a ten-day life (seed 2024 walked, stream 2, fire stock of 6): a lean-to, a pile of fronds laid beside it, and the second pile of
//      fronds laid while he stands between the first pile and the lean-to: before, the pile landed on top of the first one and closed a pocket round him (no way out, thirst 1.5, collapse); now it lands
//      apart and a way leads out;
//   2. the gap rule (`gapFree`): the edge to edge distance, the fire place it replaces, the walls it ignores;
//   3. every placement path keeps the gap: a pile laid by hand or by his habit (`wood.drop`, kinds that differ in size), the leftovers of a build, the pile places of the upgrades (the tideline spot is tested in tests/tideline.test.js),
//      and the building pair stays within the 2 m of the arc's build rule.
// Depends on: game/game, game/obstacles, game/path, game/mind, game/leanto, tests/helpers/spots.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { createPath } from '../src/game/path.js';
import { createMind, UP_AT } from '../src/game/mind.js';
import { siteFor, NEAR, UP_NEAR } from '../src/game/leanto.js';
import { BODY } from '../src/game/movement.js';
import { pileSolidRadius } from '../src/game/wood.js';
import * as OB from '../src/game/obstacles.js';
import { branchesOfTile } from '../src/game/branches.js';
import { findSpots } from './helpers/spots.js';

let w, spawn, C, logs, branches;
beforeAll(async () => {
  w = await generateWorld(1337); spawn = startSpot(w); C = findSpots(w, spawn).open;
  const d = o => Math.hypot(o.x - spawn.x, o.z - spawn.z), by = l => l.sort((a, b) => d(a) - d(b));
  logs = by(w.tiles.flatMap(t => t.drift)); branches = by(w.tiles.flatMap(t => t.trees.length ? branchesOfTile(w, t) : []));
}, 120000);
const ids = (l, from, n) => l.slice(from, from + n).map(o => o.id), at = (x, z) => ({ x, z, y: w.H(x, z) });
const makeInput = (o = {}) => { const i = { up: false, down: false, left: false, right: false, run: false, target: null, action: null, hold: null, sleep: false, ...o }; i.clearTarget = () => { i.target = null; }; i.takeAction = () => { const a = i.action; i.action = null; return a; }; return i; };
const run = (g, i, s, dt = 1 / 30) => { for (let t = 0; t < s; t += dt) g.update(i, dt); };
const frond = (i, x, z) => ({ id: 880000 + i, x, y: w.H(x, z), z, len: 1, a: 0, rad: 0.05, frond: true });
const GAP = OB.CAMP_GAP ?? 0;
// the edge to edge gap between every pair of piles, fire places and burnt places (the lean-to's walls are exempt, see game/obstacles)
const gaps = g => {
  const cs = [...g.wood.piles.map(p => ({ x: p.x, z: p.z, r: pileSolidRadius(p) + BODY, f: false })), ...g.fire.fires.map(f => ({ x: f.x, z: f.z, r: OB.FIRE_R, f: true })), ...g.fire.burnt.map(f => ({ x: f.x, z: f.z, r: OB.FIRE_R, f: true }))], out = [];
  for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) { if (cs[i].f && cs[j].f) continue; out.push(Math.hypot(cs[i].x - cs[j].x, cs[i].z - cs[j].z) - cs[i].r - cs[j].r); }
  return out;
};
const lean = (x = C.x, z = C.z, heading = 0) => ({ id: 0, x, z, heading, progress: 1 });

describe('the enclosure found in a ten-day life (a minimal camp: lean-to, a pile of fronds, a second pile laid beside him)', () => {
  // positions relative to the lean-to, as in the trap (seed 2024 walked, stream 2): the lean-to heading 0.64; the first frond pile at (1.95, -1.26); he stood about (0.6, -1.5) between it and the lean-to's back wall
  let L, A, P;
  beforeAll(() => { L = lean(C.x, C.z, 0.64); A = { x: C.x + 1.95, z: C.z - 1.26 }; P = { x: C.x + 0.6, z: C.z - 1.5 }; });
  const trapped = g => { const f = createPath(w, { obstacles: g.movement.obstacles }); return [[0, -7], [0, 7], [7, 0], [-7, 0]].every(([dx, dz]) => !f.find({ x: g.player.x, z: g.player.z }, { x: g.player.x + dx, z: g.player.z + dz })); };
  it('the second pile of fronds, laid where he stands between the first pile and the lean-to, leaves him a way out', () => {
    const g = createGame(w, at(P.x, P.z), { leantos: { list: [L], nextId: 1 } });
    g.wood.piles.push({ x: A.x, z: A.z, kind: 'frond', logs: [frond(1, A.x, A.z), frond(2, A.x, A.z), frond(3, A.x, A.z)] });
    g.wood.carried.push(frond(4, P.x, P.z), frond(5, P.x, P.z), frond(6, P.x, P.z));
    g.player.heading = Math.PI;   // facing away from the lean-to (south), the way he walked in the life
    run(g, makeInput({ action: 'tap' }), 1.5);
    expect(g.wood.carried.length).toBe(0); expect(g.wood.piles.length).toBe(2);
    expect(trapped(g), 'he is shut in').toBe(false);
    for (const q of gaps(g)) expect(q).toBeGreaterThanOrEqual(GAP - 1e-9);
  });
  it('(the fixture itself) two frond piles that overlap each other and the walls shut the pocket: this is what the life had', () => {
    const B = { x: C.x + 0.6, z: C.z - 2.55 };   // where the old drop put it (0.45 ahead of him is blocked by nothing; the pile landed 1.05 m on, over the first pile's circle)
    const g = createGame(w, at(P.x, P.z), { leantos: { list: [L], nextId: 1 } });
    for (const [i, q] of [A, B].entries()) g.wood.piles.push({ x: q.x, z: q.z, kind: 'frond', logs: [frond(10 + i, q.x, q.z)] });
    expect(trapped(g)).toBe(true);
  });
});

describe('the gap rule', () => {
  const camp = (piles, extra = {}) => createGame(w, at(C.x, C.z + 9), { wood: { carried: [], piles: piles.map((q, i) => ({ x: q.x, z: q.z, kind: q.kind || 'driftwood', logs: ids(logs, i * 12, q.n || 3) })) }, ...extra }).movement.obstacles.camp;
  it('is one constant: a body width and the planning clearance on both sides of a gap', () => {
    expect(OB.CAMP_GAP).toBeCloseTo(2 * BODY + 2 * 0.05, 10);
    expect(OB.CAMP_GAP).toBeGreaterThanOrEqual(0.5 - 1e-9);
  });
  it('measures from solid edge to solid edge (the radii hold the body): refused just inside, allowed at the gap', () => {
    const cp = camp([{ x: C.x, z: C.z }]), r = OB.PILE_R, d = r + r + OB.CAMP_GAP;
    expect(OB.gapFree(cp, C.x + d - 0.01, C.z, r)).toBe(false);
    expect(OB.gapFree(cp, C.x + d + 0.01, C.z, r)).toBe(true);
    expect(OB.gapFree(cp, C.x, C.z, r)).toBe(false);
    expect(OB.gapFree(cp, C.x + 1.2 + r + OB.CAMP_GAP - 0.01 + r, C.z, r)).toBe(true);   // a bigger neighbour (a frond pile, 1.2) needs more room
    const big = camp([{ x: C.x, z: C.z, kind: 'frond' }]);
    expect(OB.gapFree(big, C.x + 1.2 + r + OB.CAMP_GAP - 0.01, C.z, r)).toBe(false);
    expect(OB.gapFree(big, C.x + 1.2 + r + OB.CAMP_GAP + 0.01, C.z, r)).toBe(true);
  });
  it('lets a pile stand on the burnt place or fire it replaces (the fire\'s own stock), not 1 m beside it; and ignores the walls of a lean-to', () => {
    const fire = { fire: { fires: [], burnt: [{ id: 0, x: C.x, z: C.z, left: 2, n: 3 }], attempts: 0, nextId: 1 } }, cp = camp([], fire);
    expect(OB.gapFree(cp, C.x, C.z, OB.PILE_R, OB.sameFirePlace(C.x, C.z))).toBe(true);
    expect(OB.gapFree(cp, C.x + 1, C.z, OB.PILE_R, OB.sameFirePlace(C.x + 1, C.z))).toBe(false);
    const lt = camp([], { leantos: { list: [lean(C.x, C.z + 9)], nextId: 1 } });
    expect(OB.gapFree(lt, C.x + OB.LEANTO_SIDE, C.z + 9, OB.PILE_R)).toBe(true);   // keepFree (rule (a)) holds the inside; the walls need no gap
  });
});

describe('every placement keeps the gap', () => {
  it('a pile laid beside a full pile (wood.drop) stands a gap from it, for every kind of pile', () => {
    for (const kind of ['driftwood', 'branch', 'frond']) {
      const g = createGame(w, at(C.x, C.z), { wood: { carried: [], piles: [{ x: C.x, z: C.z - 1, kind: 'driftwood', logs: ids(logs, 0, 12) }] } });
      if (kind === 'driftwood') g.wood.carried.push(...logs.slice(20, 23).map(l => ({ ...l })));
      else if (kind === 'branch') g.wood.carried.push(...branches.slice(0, 3).map(l => ({ ...l })));
      else g.wood.carried.push(frond(1, C.x, C.z), frond(2, C.x, C.z), frond(3, C.x, C.z));
      g.wood.carried.forEach(l => { delete l.t; });
      run(g, makeInput({ action: 'tap' }), 1.5);
      expect(g.wood.piles.length, kind).toBe(2);
      for (const q of gaps(g)) expect(q, kind).toBeGreaterThanOrEqual(GAP - 1e-9);
    }
  });
  it('piles laid one after another all round him never close a ring: every gap between piles stays', () => {
    const g = createGame(w, at(C.x, C.z), { wood: { carried: [], piles: [] } }), inp = makeInput();
    for (let i = 0; i < 9; i++) {
      g.wood.carried.push(...logs.slice(30 + i * 3, 33 + i * 3).map(l => { const c = { ...l }; delete c.t; return c; }));
      g.player.x = C.x + Math.sin(i * 0.7) * 0.9; g.player.z = C.z + Math.cos(i * 0.7) * 0.9; g.player.heading = i * 0.7;
      inp.action = 'tap'; run(g, inp, 0.5);
      for (const q of g.wood.piles) q.logs.length = Math.min(q.logs.length, 12);
    }
    expect(g.wood.piles.length).toBeGreaterThan(1);
    for (const q of gaps(g)) expect(q).toBeGreaterThanOrEqual(GAP - 1e-9);
  });
  it('what is left of the two building piles is laid a gap from every other solid', () => {
    const g = createGame(w, at(C.x, C.z - 0.9), { wood: { carried: [], piles: [{ x: C.x - 0.6, z: C.z, kind: 'driftwood', logs: ids(logs, 0, 9) }, { x: C.x + 0.6, z: C.z, kind: 'branch', logs: ids(branches, 0, 8) }, { x: C.x + 3.6, z: C.z + 1.5, kind: 'driftwood', logs: ids(logs, 40, 2) }] }, fibre: { carried: 2 } });
    const a = g.action(), b = [a.tap, ...a.options].find(o => o && o.kind === 'build'); expect(b).toBeTruthy();
    g.act(b); run(g, makeInput(), 6);
    expect(g.leantos.list.length).toBe(1); expect(g.wood.piles.length).toBe(3);
    for (const q of gaps(g)) expect(q).toBeGreaterThanOrEqual(GAP - 1e-9);
  });
  it('the second pile of a building pair is laid within the 2 m of the arc\'s build rule, and the pair keeps the gap', () => {
    expect(NEAR).toBe(2); expect(2 * (OB.PILE_R) + GAP).toBeLessThan(NEAR);
    const g = createGame(w, at(C.x, C.z - 0.9), { wood: { carried: [], piles: [{ x: C.x, z: C.z, kind: 'driftwood', logs: ids(logs, 0, 6) }] }, fibre: { carried: 2 } });
    g.wood.carried.push(...branches.slice(0, 6).map(l => ({ ...l }))); g.wood.carried.splice(3);
    g.player.heading = Math.PI; run(g, makeInput({ action: 'tap' }), 1.5);
    g.wood.carried.push(...branches.slice(3, 6).map(l => ({ ...l })));
    g.player.heading = Math.PI; run(g, makeInput({ action: 'tap' }), 1.5);
    const big = g.wood.piles.filter(q => q.logs.length >= 6);
    expect(big.length).toBe(2); expect(siteFor(g.wood.piles, big[0])).toBeTruthy();
    for (const q of gaps(g)) expect(q).toBeGreaterThanOrEqual(GAP - 1e-9);
  });
  it('Dave\'s pile places for the upgrades (fronds on a ring round the lean-to) keep the gap, and stay within UP_NEAR', () => {
    const l = lean(C.x, C.z, 0), base = Math.atan2(Math.cos(0), -Math.sin(0));
    const g = createGame(w, at(C.x + 6, C.z + 2), { leantos: { list: [l], nextId: 1 }, time: 0.3 });
    g.wood.piles.push({ x: C.x + Math.sin(base) * UP_AT, z: C.z + Math.cos(base) * UP_AT, kind: 'frond', logs: [frond(1, C.x, C.z), frond(2, C.x, C.z), frond(3, C.x, C.z)] });
    const m = createMind(w, g); m.engage();
    const need = m.homePlan().need; expect(need.kind).toBe('frond');
    const d = need.dest(), cp = g.movement.obstacles.camp;
    expect(d.pile).toBeUndefined();
    expect(Math.hypot(d.x - l.x, d.z - l.z)).toBeLessThanOrEqual(UP_NEAR);
    expect(OB.gapFree(cp, d.x, d.z, pileSolidRadius({ kind: 'frond', logs: [{}] }) + BODY)).toBe(true);
  });
});
