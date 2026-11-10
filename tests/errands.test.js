// 0.30.9 "Errands": three fixes found by measuring ten-day lives on 0.30.6 and 0.30.8.
//   1. (the wet-strip stock errand, its limit and its wet load: gone in 0.30.13 "Tideline", with the drying pile; the lean-to site rule for wet wood in his arms is tested in tests/timber.test.js)
//   2. the pile of fronds (or stones) for an upgrade finds a spot within UP_NEAR of the lean-to when the old coarse search of the ring found none (it used to lay a stray pile outside UP_NEAR that never counted, and fetch it again, over and over; seed 2024);
//   3. a roast that fails (the flames die on the way) ends the eat goal as failed at a hunger too low for other food (so it cools), and at a higher hunger he eats other food he carries.
// Each test fails without its fix. Depends on: game/mind, game/leanto, tests/helpers/mindCamp, tests/helpers/timber.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createMind, HANDOFF_SECS, UP_AT } from '../src/game/mind.js';
import { UP_NEAR } from '../src/game/leanto.js';
import { DAY_SECONDS } from '../src/game/clock.js';
import { campGame } from './helpers/mindCamp.js';
import { timberGame, places, tick } from './helpers/timber.js';

let w, spawn;
beforeAll(async () => { w = await generateWorld(1337); spawn = startSpot(w); }, 120000);

describe('the frond pile of the walls finds a spot within UP_NEAR (a camp whose old ring search is blocked)', () => {
  it('lays a second pile of fronds on the ring, not beside the first one outside UP_NEAR', () => {
    // 0.30.8: the nine spots of the old search (0.55 rad apart on the ring UP_AT from the lean-to) were all taken: the first frond pile covers the first three, other piles the rest.
    // The pile was then laid beside the first one, 3.4 m from the lean-to, outside UP_NEAR, so it never counted; he fetched it again and laid it down again (8 to 20 trips in a row, seed 2024)
    const lt = { list: [{ id: 0, x: spawn.x + 6, z: spawn.z + 2, heading: 0, progress: 1 }], nextId: 1 }, l = lt.list[0];
    const base = Math.atan2(Math.cos(0), -Math.sin(0)), onRing = da => ({ x: l.x + Math.sin(base + da) * UP_AT, z: l.z + Math.cos(base + da) * UP_AT });
    const piles = [{ id: 3, kind: 'frond', n: 3, ...onRing(0) }, ...[1.1, -1.1, 1.65, -1.65, 2.2, -2.2].map((da, i) => ({ id: 20 + i, kind: i % 2 ? 'stone' : 'branch', n: 1, ...onRing(da) }))];
    const g = campGame(w, spawn, { leantos: lt, piles }), m = createMind(w, g); m.engage();
    const need = m.homePlan().need; expect(need.kind).toBe('frond'); expect(need.want).toBe(3);   // six for the walls, three lie there
    const d = need.dest();
    expect(d.pile, 'a spot of its own, not the first pile').toBeUndefined();
    expect(Math.hypot(d.x - l.x, d.z - l.z), 'within UP_NEAR, so that the pile counts').toBeLessThanOrEqual(UP_NEAR);
    for (const q of g.wood.piles) expect(Math.hypot(d.x - q.x, d.z - q.z), 'clear of the other piles').toBeGreaterThanOrEqual(1.5);
  });
});

describe('a roast that fails because the flames die on the way', () => {
  // the fire seems to burn from afar and is out when he stands beside it
  const supper = ({ hunger, berries = 0 }) => {
    const time = 0.7, fire = { fires: [{ id: 0, x: spawn.x, z: spawn.z, fuel: 1, embers: 0.1, emberAge: 0, lit: 1 + time - 0.2, fed: 3 }], burnt: [], attempts: 1, nextId: 1 };
    const g = campGame(w, spawn, { day: 1, time, extra: { fire, hunger: { days: hunger }, crabs: { carried: [1 + time - 0.1], gone: [], digs: 0 }, ...(berries ? { berries: { carried: Array(berries).fill(1 + time - 0.05) } } : {}) } });
    g.player.x = spawn.x + 6; g.player.z = spawn.z; const real = g.fire.strength;
    g.fire.strength = f => (Math.hypot(g.player.x - f.x, g.player.z - f.z) > 2.5 ? real(f) : 0);
    const m = createMind(w, g); m.engage(); return { g, m };
  };
  it('at a hunger too low for other food, the eat goal ends as failed and does not start again at once', () => {
    const { g, m } = supper({ hunger: 0.25 });
    for (let i = 0; i < 1000; i++) tick(g, m);   // 100 s
    expect(m.stats.goals.eat).toBeGreaterThanOrEqual(1);
    expect(m.stats.goals.eat, 'a cool-down between the tries').toBeLessThanOrEqual(4);
  });
  it('at a higher hunger he eats the berries he carries', () => {
    const { g, m } = supper({ hunger: 0.6, berries: 2 });
    const b0 = g.berries.carried.length, h0 = g.hunger.days;
    for (let i = 0; i < 1500 && g.berries.carried.length === b0; i++) tick(g, m);
    expect(g.berries.carried.length).toBeLessThan(b0); expect(g.hunger.days).toBeLessThan(h0);
  });
});
