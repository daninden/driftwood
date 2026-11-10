// 0.30.12 "Kindling" (game/mind): the evening fire is lit with 4 pieces (WOOD_WANT, was 6; lighting still needs FIRE_MIN) and in the evening it is fed only when nearly out (below 0.25 of FUEL_MAX, was 0.6). Each test fails without its part.
// Depends on: game/mind, game/fire, tests/helpers/mindCamp.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createMind, fireStep, WOOD_WANT, FEED_BELOW, EVENING, LIGHT_FROM } from '../src/game/mind.js';
import { FIRE_MIN, FUEL_MAX } from '../src/game/fire.js';
import { campGame } from './helpers/mindCamp.js';

let w, spawn;
beforeAll(async () => { w = await generateWorld(1337); spawn = startSpot(w); }, 120000);

const tick = (g, m) => { m.step(0.1); g.update(m.input, 0.1); };
const base = { asleep: false, thirst: 0.1, hunger: 0.1, awake: 0.3, canLie: false, water: true, waterNear: false, shellsEmpty: 0, shellsFull: 0, nuts: 2, fibre: 2, torch: false, spare: 0, cool: {} };

describe('the evening stock is 4 pieces (0.30.12)', () => {
  it('four pieces are enough: no gathering at 4, gathering below, light from the lighting time on', () => {
    expect(WOOD_WANT).toBe(4); expect(FIRE_MIN).toBe(4);
    const eve = o => ({ ...base, time: EVENING + 0.02, fireLit: false, fireFuel: 0, stock: 4, canLight: true, ...o });
    expect(fireStep(eve({}))).toBeNull(); expect(fireStep(eve({ stock: 3, canLight: false }))).toBe('gather');
    expect(fireStep(eve({ time: LIGHT_FROM }))).toBe('light');
  });
  it('in a real evening, with four dry pieces at the fire and fibre, he fetches no more wood and lights the fire', () => {
    const g = campGame(w, spawn, { day: 1, time: 0.62, stocked: false, piles: [{ id: 9, kind: 'driftwood', n: 4, x: spawn.x + 0.4, z: spawn.z }], extra: { shells: { full: [], nuts: 2 }, fibre: { carried: 3 } } });
    const m = createMind(w, g); m.engage();
    for (let i = 0; i < 4500 && g.clock.time < 0.8 && !g.fire.fires.some(f => g.fire.strength(f) > 0); i++) tick(g, m);
    expect(m.stats.events.filter(e => e.type === 'collect' && e.src === 'drift').length, 'no wood fetched while four are there').toBe(0);
    expect(g.fire.fires.some(f => g.fire.strength(f) > 0), 'the fire is lit').toBe(true);
  });
});

describe('the evening fire is fed only when nearly out (0.30.12)', () => {
  it('fireStep feeds below 0.25 of FUEL_MAX and not above', () => {
    expect(FEED_BELOW).toBe(0.25);
    const lit = o => ({ ...base, time: LIGHT_FROM + 0.02, fireLit: true, canLight: false, stock: 4, ...o });
    expect(fireStep(lit({ fireFuel: 0.4 }))).toBeNull(); expect(fireStep(lit({ fireFuel: 0.24 }))).toBe('feed');
  });
  it('a fire at 0.4 of its fuel is left alone in the evening, one at 0.2 is fed', () => {
    const run = frac => {
      const time = 0.76, fire = { fires: [{ id: 0, x: spawn.x, z: spawn.z, fuel: frac * FUEL_MAX, embers: 0.1, emberAge: 0, lit: 1 + time - 0.01, fed: 3 }], burnt: [], attempts: 1, nextId: 1 };
      const g = campGame(w, spawn, { day: 1, time, extra: { fire } }), m = createMind(w, g); m.engage();
      for (let i = 0; i < 1500 && g.clock.time < 0.84; i++) tick(g, m);
      return g.fire.fires[0].fed;
    };
    expect(run(0.4)).toBe(3); expect(run(0.2)).toBeGreaterThan(3);
  });
});
