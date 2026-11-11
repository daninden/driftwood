// 0.30.9 "Errands": fixes found by measuring ten-day lives on 0.30.6 and 0.30.8.
//   1. (the wet-strip stock errand, its limit and its wet load: gone in 0.30.13 "Tideline", with the drying pile)
//   2. (the pile of fronds or stones for an upgrade finding a spot within UP_NEAR of the lean-to: gone in 0.32 "Piece by piece", with the upgrade piles; the pieces are fetched into his arms and built in, tests/mind.test.js)
//   3. a roast that fails (the flames die on the way) ends the eat goal as failed at a hunger too low for other food (so it cools), and at a higher hunger he eats other food he carries.
// Each test fails without its fix. Depends on: game/mind, tests/helpers/mindCamp, tests/helpers/timber.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createMind } from '../src/game/mind.js';
import { DAY_SECONDS } from '../src/game/clock.js';
import { campGame } from './helpers/mindCamp.js';
import { timberGame, places, tick } from './helpers/timber.js';

let w, spawn;
beforeAll(async () => { w = await generateWorld(1337); spawn = startSpot(w); }, 120000);

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
