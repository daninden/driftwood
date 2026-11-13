// The camp store by day (0.36.10 "Store"): the stores goal fetches wood when the store is too small for the night (the husk goes first only without fibre to light a fire with or without food), not beside a fire that still burns (embers too),
// and the pile that stood at his OLD fire place is not left behind when the lean-to is finished and the fire spot moves to the ring (it still counts as his stock until it is carried into the store).
// Covers: game/mind `storesStep` (pure), `mind.camp()`, `centreStrays` (the idle pastime `strays` and `lightFire`) with a finished lean-to without and with a stone ring.
// Depends on: world/world, world/spots, game/mind, game/leanto, tests/helpers/mindCamp.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createMind, storesStep, chooseGoal, WOOD_WANT } from '../src/game/mind.js';
import { ringCentre, RING_R } from '../src/game/leanto.js';
import { campGame } from './helpers/mindCamp.js';

const calm = (o = {}) => ({ asleep: false, time: 0.4, thirst: 0.1, hunger: 0.1, awake: 0.3, canLie: false, water: true, waterNear: false, shellsEmpty: 0, shellsFull: 0, nuts: 2, fibre: 2, torch: false,
  fireLit: false, fireFuel: 0, stock: WOOD_WANT, spare: 0, canLight: false, cool: {}, ...o });

describe('storesStep: wood first when the store is too small for the night', () => {
  it('fetches wood with an empty store although a nut or a tuft of fibre could be wanted', () => {
    expect(storesStep(calm({ stock: 0, nuts: 1 }))).toBe('wood');   // one nut: the husk could be wanted (fewer than 2), the wood comes first
    expect(storesStep(calm({ stock: 0, fibre: 2, hunger: 0.4 }))).toBe('wood');   // hungry but a nut is in the bag, fibre enough to light
    expect(storesStep(calm({ stock: 3, nuts: 0, hunger: 0.1 }))).toBe('wood');
    expect(chooseGoal(calm({ stock: 0, nuts: 1 }))).toBe('stores');
  });
  it('husks first only without fibre to light a fire with, or hungry with no nut', () => {
    expect(storesStep(calm({ stock: 0, fibre: 0 }))).toBe('husk');
    expect(storesStep(calm({ stock: 0, hunger: 0.4, nuts: 0 }))).toBe('husk');
    expect(storesStep(calm({ stock: 0, fibre: 0, cool: { husk: true } }))).toBe('wood');   // the husk cools: the wood still comes
    expect(storesStep(calm({ stock: 0, fibre: 0, fireLit: true }))).toBe('husk');   // a fire burns: no fibre needed to light one, so the husk is an ordinary one (the wood waits for the fire to be out)
  });
  it('husks after the wood is there, and tops up the pile only while no fire burns', () => {
    expect(storesStep(calm({ nuts: 1 }))).toBe('husk'); expect(storesStep(calm({ fibre: 1, hunger: 0.4 }))).toBe('husk');
    expect(storesStep(calm({ pileLogs: 8 }))).toBe('wood'); expect(storesStep(calm({ pileLogs: 8, fireLit: true }))).toBeNull();
  });
  it('leaves a burning fire alone (embers too): the wood waits until it is out', () => {
    expect(storesStep(calm({ stock: 1, fireLit: true }))).toBeNull();   // wood laid beside a burning fire is nobody's stock
    expect(storesStep(calm({ stock: 1, fireLit: true, nuts: 1 }))).toBe('husk');
    expect(storesStep(calm({ stock: 6, pileLogs: 6, fireLit: true }))).toBeNull();   // the top-up of the pile is not done beside a burning fire either
    expect(storesStep(calm({ stock: 0, cool: { gather: true } }))).toBeNull();
    expect(storesStep(calm({ stock: 0, time: 0.1 }))).toBeNull(); expect(storesStep(calm({ stock: 0, time: 0.7 }))).toBeNull();
  });
});

describe('the pile at his old fire place when the lean-to is finished (seed 1337)', () => {
  let w, spawn, site;
  beforeAll(async () => {
    w = await generateWorld(1337); spawn = startSpot(w);
    site = createMind(w, campGame(w, spawn, { day: 2, time: 0.22 })).leantoSites({ x: spawn.x, z: spawn.z })[0];
  }, 120000);
  const home = up => ({ list: [{ id: 0, x: site.x, z: site.z, heading: site.heading, progress: 1, up }], nextId: 1 });
  const oldPile = { id: 9, kind: 'driftwood', n: 4, x: 0, z: 0 };
  const game = up => {
    const rc = ringCentre(home(up).list[0]);
    return { g: campGame(w, spawn, { day: 4, time: 0.5, leantos: home(up), stocked: false, extra: { fibre: { carried: 3 }, shells: { full: [], nuts: 2 } }, piles: [{ ...oldPile, x: spawn.x + 0.4, z: spawn.z }] }), rc };
  };
  const at = (g, c, r) => g.wood.piles.filter(q => (q.kind === 'driftwood' || q.kind === 'branch') && Math.hypot(q.x - c.x, q.z - c.z) <= r).reduce((n, q) => n + q.logs.length, 0);

  for (const [name, up] of [['no ring yet', {}], ['a finished ring', { ring: 1 }]]) {
    it(`counts it as his stock until it is moved, and carries all of it to the store (${name})`, () => {
      const { g, rc } = game(up), m = createMind(w, g); m.engage();
      expect(Math.hypot(spawn.x - rc.x, spawn.z - rc.z)).toBeGreaterThan(3.5);   // the old place is not the new one
      expect(at(g, rc, 2.4)).toBe(0); expect(at(g, spawn, 2.4)).toBe(4);
      expect(m.camp().store.dry).toBe(4);   // still his: the camp's figure does not drop when the fire spot moves
      const t0 = g.clock.total;
      while (g.clock.total < t0 + 0.45 && at(g, spawn, 2.4) > 0) { m.step(0.1); g.update(m.input, 0.1); }   // until the old place is empty (the evening's fire would burn the wood later)
      for (let i = 0; i < 20; i++) { m.step(0.1); g.update(m.input, 0.1); }   // (the last piece is laid down)
      expect(at(g, spawn, 2.4)).toBe(0);   // nothing stays behind
      expect(at(g, rc, up.ring ? RING_R : 2.4)).toBeGreaterThanOrEqual(4);   // all of it stands in the store (the ring's middle with a ring)
      expect(m.stats.strayTrips || 0).toBeGreaterThanOrEqual(1);
      expect(m.camp().store.dry).toBeGreaterThanOrEqual(4);
    }, 300000);
  }
  it('does not count or fetch a pile far from any old fire place', () => {
    const { g, rc } = game({}); g.wood.piles.length = 0;
    g.wood.piles.push({ x: spawn.x + 60, z: spawn.z, kind: 'driftwood', logs: Array.from({ length: 4 }, (_, i) => ({ id: 800000 + i, x: spawn.x + 60, y: w.H(spawn.x + 60, spawn.z), z: spawn.z, len: 2, a: 0, rad: 0.1 })) });
    const m = createMind(w, g); m.engage();
    expect(m.camp().store.dry).toBe(0); expect(Math.hypot(spawn.x + 60 - rc.x, spawn.z - rc.z)).toBeGreaterThan(10);
  });
});
