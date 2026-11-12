// 0.33.2 "Mend": three small stalls of Dave's days, found by measuring the long lives (see docs/versions.md).
//   - a wall of trunks (game/walk naturalWall) is closed for planning: tests/walk.test.js;
//   - a loose piece inside a boulder is not a thing to fetch (game/mind reachablePiece): seed 2024 near (179.6, 77.7) and seed 7 near (-248.9, -8.8) lay a log there and he stalled four times a day at the same spot;
//   - the fire is fed from a pile that has a piece it takes: a pile of damp branches beside it was taken, carried to the fire, not fed (`no-stand: feed`) and laid back, again and again all evening.
// Depends on: world/world, world/spots, game/game, game/leanto, game/mind, tests/helpers/mindCamp.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { ringCentre } from '../src/game/leanto.js';
import { createMind, reachablePiece } from '../src/game/mind.js';
import { FUEL_MAX, EMBERS } from '../src/game/fire.js';
import { dryness } from '../src/game/wood.js';
import { campGame } from './helpers/mindCamp.js';

describe('a loose piece he can get his hands on (reachablePiece)', () => {
  it('is false for a log inside a boulder, true for open ground and for a piece beside a trunk', async () => {
    const w24 = await generateWorld(2024), w7 = await generateWorld(7), w13 = await generateWorld(1337);
    expect(reachablePiece(w24, 179.64, 77.73)).toBe(false);
    expect(reachablePiece(w7, -248.9, -8.8)).toBe(false);
    const sp = startSpot(w13); expect(reachablePiece(w13, sp.x, sp.z)).toBe(true);
    expect(reachablePiece(w24, 180.8, 79.6)).toBe(true);
  }, 240000);
});

let w, spawn, site;
beforeAll(async () => {
  w = await generateWorld(1337); spawn = startSpot(w);
  const g0 = campGame(w, spawn, { day: 2, time: 0.22 }); site = createMind(w, g0).leantoSites({ x: spawn.x, z: spawn.z })[0];
}, 120000);
const home = () => ({ list: [{ id: 0, x: site.x, z: site.z, heading: site.heading, progress: 1, up: { walls: 1, ring: 1, bed: 1 } }], nextId: 1 });

describe('feeding the fire from a pile of damp branches', () => {
  it('leaves the damp pile alone and feeds the burning fire from the dry pile (no no-stand: feed)', () => {
    const leantos = home(), g0 = campGame(w, spawn, { day: 2, time: 0.22, leantos }), rc = ringCentre(g0.leantos.list[0]);
    const g = campGame(w, spawn, {
      day: 4, time: 0.62, leantos, stocked: false,
      extra: { fibre: { carried: 3 }, shells: { full: [], nuts: 2 }, fire: { fires: [{ id: 0, x: rc.x, z: rc.z, fuel: 0.1, embers: EMBERS, emberAge: 0, lit: 0.4, fed: 2 }], burnt: [], attempts: 1, nextId: 1 } },
      piles: [{ id: 9, kind: 'branch', n: 3, x: rc.x, z: rc.z + 0.75 }, { id: 10, kind: 'driftwood', n: 4, x: rc.x + 1.7, z: rc.z }],
    });
    const damp = g.wood.piles.find(q => q.kind === 'branch'), dry = g.wood.piles.find(q => q.kind === 'driftwood');
    for (const l of damp.logs) l.t = g.clock.total;   // just gathered: dryness 0
    expect(damp.logs.every(l => dryness(l, g.clock.total) < 0.1)).toBe(true);
    const m = createMind(w, g); m.engage();
    const t0 = g.clock.total, fuel0 = dry.logs.length; let dryLeft = fuel0;
    while (g.clock.total < t0 + 0.2) { m.step(0.1); g.update(m.input, 0.1); const d = g.wood.piles.find(q => q === dry); dryLeft = d ? d.logs.length : 0; }
    expect(m.stats.events.filter(e => e.type === 'no-stand' && e.kind === 'feed').length).toBe(0);
    expect(dryLeft).toBeLessThan(fuel0);   // the fire was fed from the dry pile
    expect(damp.logs.length).toBe(3);      // the damp branches stayed where they lay
  }, 300000);
});
