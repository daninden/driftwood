// 0.30.13 "Tideline" (game/mind): no drying pile at the camp any more. Wet wood in the strip between the tides is carried a few metres higher and laid just above the high-water line (a small pile at the beach edge), where it dries
// where it lies; later he fetches it as dry firewood like any pile that is not his own; wet wood is never burned. Each test fails without its part.
// Everything runs with real movement (mind.step + game.update); the logs are put where the test says (tests/helpers/timber.js).
// Depends on: game/mind, game/wood, game/obstacles, tests/helpers/timber.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createMind, TIDE_LAND, TIDE_CAMP, TIDE_APART, TIDE_BONUS, DRY_AT } from '../src/game/mind.js';
import { CARRY_MAX, dryness, inStripY } from '../src/game/wood.js';
import { gapFree, PILE_R } from '../src/game/obstacles.js';
import { timberGame, places, tick } from './helpers/timber.js';

let w, spawn;
beforeAll(async () => { w = await generateWorld(1337); spawn = startSpot(w); }, 120000);

const ids = list => list.map(l => l.id);
const near = (a, b, r) => Math.hypot(a.x - b.x, a.z - b.z) <= r;
// wet logs in the strip close to each place a shore stroll may go to (up to three round each)
const stripWet = (time = 0.42) => {
  const probe = timberGame(w, spawn, { time }), shore = createMind(w, probe).strollCands().shore, wet = [];
  for (const c of shore) for (let r = 1, k = 0; r <= 7 && k < 3; r++) for (let i = 0; i < 16; i++) {
    const a = i * Math.PI / 8, x = c.x + Math.sin(a) * r, z = c.z + Math.cos(a) * r, y = w.H(x, z);
    if (inStripY(y) && w.slope(x, z) < 0.3 && !w.riverAt(x, z) && probe.known.has(x, z) && !wet.some(q => Math.hypot(q.x - x, q.z - z) < 2)) { k++; wet.push({ x, z }); break; }
  }
  return wet;
};

describe('a wet piece in the strip is carried above the high-water line and laid there (0.30.13)', () => {
  it('on a shore stroll he takes up to three wet logs, lays them on a pile above the strip, away from the camp, and they dry where they lie', () => {
    const time = 0.42, wet = stripWet(time); expect(wet.length).toBeGreaterThanOrEqual(3);
    let done = null;
    for (let stream = 0; stream < 10 && !done; stream++) {
      const g = timberGame(w, spawn, { day: 1, time, wet }), m = createMind(w, g, { stream }); m.engage();
      let maxCarried = 0, mixed = 0;
      for (let i = 0; i < 12000 && g.clock.time < 0.78; i++) {
        tick(g, m); maxCarried = Math.max(maxCarried, g.wood.carried.length);
        if (g.wood.carried.some(l => dryness(l, g.clock.total) < DRY_AT) && g.wood.carried.some(l => dryness(l, g.clock.total) >= DRY_AT)) mixed++;
        if (m.stats.tide.laid >= 1 && !g.wood.load()) break;
      }
      if (m.stats.tide.laid >= 1) done = { g, m, maxCarried, mixed, wet };
    }
    expect(done).not.toBeNull();
    const { g, m, maxCarried, mixed } = done, camp = m.home();
    expect(maxCarried).toBeLessThanOrEqual(CARRY_MAX); expect(mixed).toBe(0);
    const mine = l => l.id >= 700100 && l.id < 700200, piles = g.wood.piles.filter(q => q.logs.some(mine));
    expect(piles.length).toBeGreaterThanOrEqual(1);
    for (const q of piles) {
      expect(inStripY(w.H(q.x, q.z)), 'not in the strip, where the sea takes a pile').toBe(false);
      expect(w.H(q.x, q.z)).toBeGreaterThanOrEqual(TIDE_LAND[0] - 1e-6);
      expect(near(q, camp, TIDE_CAMP - 0.01), 'not at the fire').toBe(false);
      for (const l of q.logs.filter(mine)) expect(w.H(q.x, q.z), 'higher than where it lay').toBeGreaterThan(l.y + 0.1);
    }
    expect(m.stats.tide.laid).toBe(piles.reduce((n, q) => n + q.logs.filter(mine).length, 0));
    expect(m.stats.timber.wetLoads[1] + m.stats.timber.wetLoads[2] + m.stats.timber.wetLoads[3]).toBeGreaterThanOrEqual(1);
    // it dries where it lies: no tide reaches it, the wet time stays, a day later it is dry
    const laid = piles.flatMap(q => q.logs.filter(mine)), t0 = laid.map(l => l.t);
    for (let i = 0; i < 1500; i++) tick(g, m);
    expect(laid.every((l, k) => l.t === t0[k] && g.wood.piles.some(q => q.logs.includes(l)))).toBe(true);
    for (const l of laid) { expect(dryness(l, g.clock.total)).toBeLessThan(1); expect(dryness(l, g.clock.total + 1.1)).toBe(1); }
  });
  it('the spot keeps its distance from other piles and the camp gap, and is found only above the strip', () => {
    const wet = stripWet(); const g = timberGame(w, spawn, { day: 1, time: 0.42, wet }), m = createMind(w, g); m.engage();
    let found = null;
    for (const q of wet) { g.player.x = q.x; g.player.z = q.z; g.player.y = w.H(q.x, q.z); g.known.visit(q.x, q.z, 12); const s = m.tideSpot(); if (s) { found = { s, q }; break; } }
    expect(found).not.toBeNull();
    const { s } = found;
    expect(w.H(s.x, s.z)).toBeGreaterThanOrEqual(TIDE_LAND[0]); expect(w.H(s.x, s.z)).toBeLessThanOrEqual(TIDE_LAND[1]); expect(inStripY(w.H(s.x, s.z))).toBe(false);
    expect(gapFree(g.movement.obstacles.camp, s.x, s.z, PILE_R)).toBe(true);
    g.wood.piles.push({ x: s.x, z: s.z, kind: 'branch', logs: [{ id: 706000, x: s.x, y: w.H(s.x, s.z), z: s.z, len: 1, a: 0, rad: 0.08, branch: true }] });
    const s2 = m.tideSpot(); if (s2) expect(Math.hypot(s2.x - s.x, s2.z - s.z)).toBeGreaterThanOrEqual(TIDE_APART);
  });
});

describe('a pile at the beach edge is fetched as firewood (0.30.13)', () => {
  it('with no stock at the fire in the evening he takes the dry logs of a pile that is not his own and lays them on the fire\'s pile', () => {
    const probe = timberGame(w, spawn, { time: 0.62 }), at = places(w, probe, createMind(w, probe), { n: 1, min: 14, max: 40 })[0]; expect(at).toBeDefined();
    const logs = Array.from({ length: 4 }, (_, i) => ({ id: 705000 + i, x: at.x, y: w.H(at.x, at.z), z: at.z, len: 1.4, a: 0.3, rad: 0.1, t: -3 }));   // washed up long ago: dry
    const g = timberGame(w, spawn, { day: 1, time: 0.62 }); g.wood.piles.splice(0, 1); g.wood.piles.push({ x: at.x, z: at.z, kind: 'driftwood', logs });
    const m = createMind(w, g); m.engage();
    let atFire = 0;
    for (let i = 0; i < 9000 && g.clock.time < 0.8; i++) { tick(g, m); const camp = m.home(); atFire = Math.max(atFire, g.wood.piles.filter(q => near(q, camp, 3)).flatMap(q => q.logs).filter(l => l.id >= 705000 && l.id < 705004).length); }
    expect(m.stats.events.some(e => e.type === 'collect' && e.src === 'drift' && e.ids.includes('pile')), 'the pile was a find').toBe(true);
    expect(atFire, 'its logs reached the fire\'s pile').toBeGreaterThanOrEqual(3);
    expect(g.fire.fires.some(f => g.fire.strength(f) > 0), 'and burned in the fire he lit').toBe(true);
  });
  it('but not a wet one: the top pieces must be dry', () => {
    const probe = timberGame(w, spawn, { time: 0.62 }), at = places(w, probe, createMind(w, probe), { n: 1, min: 14, max: 40 })[0];
    const g = timberGame(w, spawn, { day: 1, time: 0.62 }); g.wood.piles.splice(0, 1);
    const logs = Array.from({ length: 4 }, (_, i) => ({ id: 705100 + i, x: at.x, y: w.H(at.x, at.z), z: at.z, len: 1.4, a: 0.3, rad: 0.1, t: g.clock.total - 0.1 }));
    g.wood.piles.push({ x: at.x, z: at.z, kind: 'driftwood', logs });
    const m = createMind(w, g); m.engage(); const camp = m.home();
    for (let i = 0; i < 3000 && g.clock.time < 0.7; i++) tick(g, m);
    expect(g.wood.piles.some(q => near(q, camp, 4) && q.logs.some(l => l.id >= 705100 && l.id < 705104))).toBe(false);
  });
});

describe('no drying pile at the camp, and wet wood is never burned (0.30.13)', () => {
  it('wet logs in his arms far from camp are laid where he is, never on the fire\'s stock', () => {
    const probe = timberGame(w, spawn, { time: 0.3 }), at = places(w, probe, createMind(w, probe), { n: 6, min: 20, max: 44 })[3];
    const g = timberGame(w, spawn, { time: 0.3 });
    g.player.x = at.x; g.player.z = at.z; g.player.y = w.H(at.x, at.z); g.known.visit(at.x, at.z, 20);
    const held = [0, 1].map(i => ({ id: 700900 + i, x: at.x + 0.3 * i, y: w.H(at.x, at.z), z: at.z, len: 1.4, a: 0.3, rad: 0.1, t: g.clock.total - 0.1 }));
    for (const l of held) g.wood.take({ kind: 'log', log: l });
    g.hunger.days = 0.45;
    const m = createMind(w, g); m.engage(); const camp = m.home();
    expect(typeof m.dryingSite).toBe('undefined');
    const eat0 = g.hunger.days;
    for (let i = 0; i < 7000 && !(g.hunger.days < eat0 - 0.05); i++) tick(g, m);
    const pile = g.wood.piles.find(q => held.every(l => q.logs.includes(l)));
    expect(pile).toBeDefined(); expect(near(pile, camp, TIDE_CAMP), 'not carried to the camp').toBe(false);
    expect(m.stats.events.some(e => e.type === 'dry-site')).toBe(false);
  });
  it('a fire is not lit from a pile of wet wood', () => {
    const g = timberGame(w, spawn, { day: 1, time: 0.8 }); g.wood.piles.splice(0, 1);
    g.wood.piles.push({ x: spawn.x + 0.4, z: spawn.z, kind: 'driftwood', logs: Array.from({ length: 5 }, (_, i) => ({ id: 707000 + i, x: spawn.x + 0.4, y: w.H(spawn.x, spawn.z), z: spawn.z, len: 1.4, a: 0.3, rad: 0.1, t: g.clock.total - 0.1 })) });
    const m = createMind(w, g); m.engage();
    for (let i = 0; i < 1500; i++) tick(g, m);
    expect(g.fire.fires.length).toBe(0); expect(m.stats.events.some(e => e.type === 'fire-skipped-wet')).toBe(true);
  });
});

describe('the daily tideline round (0.30.13)', () => {
  it('once a day, by day, he walks to the nearest strip with wet wood and lays what he takes above the high-water line', () => {
    const probe = timberGame(w, spawn, { day: 1, time: 0.3 }), wet = places(w, probe, createMind(w, probe), { strip: true, n: 5, gapCost: 2, gapDist: 3, max: 60 }); expect(wet.length).toBeGreaterThanOrEqual(3);
    const g = timberGame(w, spawn, { day: 1, time: 0.3, wet }), m = createMind(w, g); m.engage();
    for (let i = 0; i < 9000 && g.clock.time < 0.55; i++) tick(g, m);
    expect(m.stats.tide.rounds, 'one round on that day, not more').toBe(1);
    expect(m.stats.tide.laid).toBeGreaterThanOrEqual(1);
    for (const q of g.wood.piles) if (q.logs.some(l => l.id >= 700100 && l.id < 700200)) { expect(inStripY(w.H(q.x, q.z))).toBe(false); expect(near(q, m.home(), TIDE_CAMP - 0.01)).toBe(false); }
  });
  it('no round at night or in the crab window of a low tide, and none without wet wood he knows', () => {
    const g = timberGame(w, spawn, { day: 1, time: 0.3 }), m = createMind(w, g); m.engage();   // no wet wood anywhere
    for (let i = 0; i < 3000; i++) tick(g, m);
    expect(m.stats.tide.rounds).toBe(0);
    const probe = timberGame(w, spawn, { day: 1, time: 0.7 }), wet = places(w, probe, createMind(w, probe), { strip: true, n: 3, gapCost: 2, gapDist: 3, max: 60 });
    const g2 = timberGame(w, spawn, { day: 1, time: 0.7, wet }), m2 = createMind(w, g2); m2.engage();
    for (let i = 0; i < 1500; i++) tick(g2, m2);
    expect(m2.stats.tide.rounds, 'not in the evening').toBe(0);
  });
});

describe('firewood is fetched from a dry beach-edge pile first when it is a little farther (0.30.13)', () => {
  it('a pile whose cost is within 1/0.7 of a loose log\'s is chosen before the log', () => {
    expect(TIDE_BONUS).toBe(0.7);
    const probe = timberGame(w, spawn, { time: 0.3 }), all = places(w, probe, createMind(w, probe), { n: 12, min: 8, max: 50, gapCost: 1, gapDist: 3 });
    // a loose log at a, a pile at b that is farther by the walking cost of the game that is played (measured there, not in the probe), yet within 1/0.7 of it: without the beach-edge preference the log is chosen
    let done = false;
    for (const a of all) for (const b of all) if (!done && b !== a && b.cost > a.cost) {
      const g = timberGame(w, spawn, { time: 0.3, dry: [a] }); g.wood.piles.splice(0, 1);
      g.wood.piles.push({ x: b.x, z: b.z, kind: 'driftwood', logs: Array.from({ length: 3 }, (_, i) => ({ id: 705200 + i, x: b.x, y: w.H(b.x, b.z), z: b.z, len: 1.4, a: 0.3, rad: 0.1, t: -3 })) });
      const m = createMind(w, g), ca = m.path.cost(g.player, a), cb = m.path.cost(g.player, b);
      if (!(cb > ca * 1.05 && cb * TIDE_BONUS < ca * 0.97)) continue;
      done = true; m.engage();
      const plan = m.timberPlan('drift', 1);
      expect(plan.length).toBe(1); expect(plan[0].pile, `the pile (cost ${cb.toFixed(1)}), not the nearer log (cost ${ca.toFixed(1)})`).toBeTruthy();
    }
    expect(done, 'two places to compare').toBe(true);
  });
});
