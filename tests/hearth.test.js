// The ring's middle is always a place for the fire's wood (0.33.1 "Hearth"): the lean-to's or hut's keep-free apron and the camp's spacing do not refuse a pile there (game/game `blockedAt`, `canPileAt`),
// and Dave no longer carries the same stray pile to the ring and back (game/mind `centreStrays` asks before taking and stops after a failed trip). The walk counts an arrival as no stall (game/route).
// Covers: canPileAt at the ring's middle in an empty camp, with a hut, beside a real solid and with a burnt place in the ring; one scripted evening with a finished home, a stray pile of 12 logs 1.5 m
// from the ring's middle, a one-frond pile 1.2 m away and a burnt place in the ring: at most 2 stray trips, a fuel pile in the ring and a fire lit in it.
// Depends on: world/world, world/spots, game/game, game/leanto, game/mind, tests/helpers/mindCamp.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { ringCentre, RING_R } from '../src/game/leanto.js';
import { createMind } from '../src/game/mind.js';
import { PILE_R } from '../src/game/obstacles.js';
import { campGame } from './helpers/mindCamp.js';

let w, spawn, site;
beforeAll(async () => {
  w = await generateWorld(1337); spawn = startSpot(w);
  const g0 = campGame(w, spawn, { day: 2, time: 0.22 }); site = createMind(w, g0).leantoSites({ x: spawn.x, z: spawn.z })[0];
}, 120000);
const home = extra => ({ list: [{ id: 0, x: site.x, z: site.z, heading: site.heading, progress: 1, up: { walls: 1, ring: 1, bed: 1 }, ...extra }], nextId: 1 });
const lg = (id, x, z, o = {}) => ({ id, x, y: w.H(x, z), z, len: 2, a: 0, rad: 0.1, ...o });

describe('the ring middle takes a pile (game.canPileAt)', () => {
  it('is free in an empty camp with a finished ring, and with a hut round it', () => {
    for (const extra of [{}, { hut: 1 }]) {
      const g = createGame(w, spawn, { leantos: home(extra), fire: { fires: [], burnt: [], attempts: 0, nextId: 0 } }), rc = ringCentre(g.leantos.list[0]);
      expect(g.canPileAt(rc.x, rc.z, PILE_R), JSON.stringify(extra)).toBe(true);
    }
  });
  it('is refused without a ring (the apron of the lean-to still keeps its place free), and by a solid that really overlaps', () => {
    const g0 = createGame(w, spawn, { leantos: home({ up: { walls: 1, bed: 1 } }) }), r0 = ringCentre(g0.leantos.list[0]);
    expect(g0.canPileAt(r0.x, r0.z, PILE_R)).toBe(false);
    const g = createGame(w, spawn, { leantos: home(), wood: { carried: [], piles: [] } }), rc = ringCentre(g.leantos.list[0]);
    g.wood.piles.push({ x: rc.x + 0.5, z: rc.z, kind: 'driftwood', logs: Array.from({ length: 3 }, (_, i) => lg(500 + i, rc.x + 0.5, rc.z)) }); g.wood.version++;
    expect(g.canPileAt(rc.x, rc.z, PILE_R)).toBe(false);
  });
  it('is free with a burnt place in the ring (the same place), and a frond pile 1.2 m away does not refuse it', () => {
    const rc = ringCentre(home().list[0]), g = createGame(w, spawn, { leantos: home(), fire: { fires: [], burnt: [{ id: 0, x: rc.x, z: rc.z, left: 2, n: 3 }], attempts: 0, nextId: 1 } });
    g.wood.piles.push({ x: rc.x + 1.2, z: rc.z, kind: 'frond', logs: [lg(600, rc.x + 1.2, rc.z, { frond: true })] }); g.wood.version++;
    expect(g.canPileAt(rc.x, rc.z, PILE_R)).toBe(true);
  });
});

describe('one evening with a stray pile beside the ring', () => {
  it('moves the wood into the ring at most twice, leaves a fuel pile there and lights the fire in it', () => {
    const g0 = campGame(w, spawn, { day: 2, time: 0.22, leantos: home() }), rc = ringCentre(g0.leantos.list[0]);
    const g = campGame(w, spawn, {
      day: 4, time: 0.62, leantos: home(), stocked: false,
      extra: { fibre: { carried: 3 }, shells: { full: [], nuts: 2 }, fire: { fires: [], burnt: [{ id: 0, x: rc.x, z: rc.z, left: 2, n: 3 }], attempts: 0, nextId: 1 } },
      piles: [{ id: 9, kind: 'driftwood', n: 12, x: rc.x + 1.5, z: rc.z }],
    });
    g.wood.piles.push({ x: rc.x - 1.2, z: rc.z, kind: 'frond', logs: [lg(700, rc.x - 1.2, rc.z, { frond: true })] });
    const m = createMind(w, g); m.engage();
    const t0 = g.clock.total; let lit = false;
    while (g.clock.total < t0 + 0.4) {
      m.step(0.1); g.update(m.input, 0.1);
      if (g.fire.fires.some(f => Math.hypot(f.x - rc.x, f.z - rc.z) <= RING_R + 0.3 && f.fuel > 0.005)) lit = true;
    }
    expect(m.stats.strayTrips || 0).toBeLessThanOrEqual(2);
    expect(lit).toBe(true);
    expect(g.fire.fires.concat(g.wood.piles).some(q => Math.hypot(q.x - rc.x, q.z - rc.z) <= RING_R)).toBe(true);
  }, 300000);
});
