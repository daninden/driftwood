// One hearth (0.33.4): beside a finished stone ring the fire is the one in the ring. The no-fire zone round a finished ring is RING_NOFIRE (8 m) from its middle, and a fire that already
// burns in that zone (an old one from before the ring was built: Dave's site is 5 to 7.5 m from his fire, so the ring stands 5.46 to 7.82 m from it) is not fed: the arc offers no 'feed' for
// it (game/game), for the player and for Dave alike, and Dave's mind does not know it as his fire (game/mind `fireAt`).
// Covers: the geometry of Dave's site (the old fire always inside the zone), the player's arc (feed refused for a fire 5 m and 7.5 m from a finished ring, offered for a fire in the ring, for a fire
// beyond the zone and for any fire when the ring is not finished; light refused), and a scripted evening of Dave with an old fire burning 5.5 m from his finished ring: he never feeds it, it burns out,
// and he lights and keeps the fire in the ring.
// Depends on: world/world, world/spots, game/game, game/leanto, game/mind, game/fire, tests/helpers/mindCamp.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { ringCentre, RING_R, RING_NOFIRE, RING_AT } from '../src/game/leanto.js';
import { SITE_RINGS, createMind } from '../src/game/mind.js';
import { FUEL_MAX } from '../src/game/fire.js';
import { campGame } from './helpers/mindCamp.js';

let w, spawn, logs;
beforeAll(async () => {
  w = await generateWorld(1337); spawn = startSpot(w);
  logs = w.tiles.flatMap(t => t.drift).sort((a, b) => Math.hypot(a.x - spawn.x, a.z - spawn.z) - Math.hypot(b.x - spawn.x, b.z - spawn.z) || a.id - b.id);
}, 120000);

describe('the zone covers the old fire of every site Dave can choose', () => {
  it('the ring is sqrt(r^2 + RING_AT^2) from the old fire, at most 7.82 m, inside RING_NOFIRE', () => {
    expect(RING_NOFIRE).toBe(8);
    for (const r of SITE_RINGS) { const d = Math.hypot(r, RING_AT); expect(d).toBeGreaterThan(RING_R); expect(d).toBeLessThan(RING_NOFIRE); }
    expect(Math.hypot(Math.max(...SITE_RINGS), RING_AT)).toBeCloseTo(7.82, 2);
  });
  it('holds for real sites on seed 1337', () => {
    const g0 = campGame(w, spawn, { day: 2, time: 0.22 }), sites = createMind(w, g0).leantoSites({ x: spawn.x, z: spawn.z });
    expect(sites.length).toBeGreaterThan(0);
    for (const c of sites.slice(0, 20)) { const rc = ringCentre({ x: c.x, z: c.z, heading: c.heading }); expect(Math.hypot(rc.x - spawn.x, rc.z - spawn.z)).toBeLessThan(RING_NOFIRE); }
  });
});

describe('the arc beside a finished ring (the player)', () => {
  const lt = (up = { ring: 1 }) => ({ id: 0, x: spawn.x + 30, z: spawn.z + 30, heading: 0.7, progress: 1, up });
  // a fire d metres from the ring's middle with a dry load in the player's arm beside it
  const scene = (d, up) => {
    const l = lt(up), rc = ringCentre(l), fx = rc.x + d, fz = rc.z, at = { x: fx + 0.9, z: fz, y: w.H(fx + 0.9, fz) };
    return createGame(w, at, { time: 0.5, leantos: { list: [l], nextId: 1 }, wood: { carried: logs.slice(0, 2).map(q => q.id), piles: [] }, fire: { fires: [{ id: 0, x: fx, z: fz, fuel: FUEL_MAX / 2, embers: 0.2, emberAge: 0, lit: 0.4, fed: 2 }], burnt: [], attempts: 0, nextId: 1 } });
  };
  const feeds = g => g.actions().some(o => o.kind === 'feed');
  it('does not offer to feed a fire 1.5, 5 or 7.5 m from the ring, offers it in the ring and beyond the zone', () => {
    expect(feeds(scene(0.3))).toBe(true);                                  // in the ring
    for (const d of [1.5, 5, 7.5]) expect(feeds(scene(d)), 'd ' + d).toBe(false);
    expect(feeds(scene(8.5))).toBe(true);                                  // beyond the zone: as ever
    expect(feeds(scene(5, {}))).toBe(true);                                // no ring built: as before
  });
  it('has no feed in the arc at all for a fire 5 m from the ring', () => {
    const g = scene(5), f = g.fire.fires[0];
    expect(g.actions().find(o => o.kind === 'feed')).toBeUndefined();
    expect(f.fed).toBe(2);
  });
});

describe('Dave with an old fire beside his finished ring (seed 1337, one evening)', () => {
  it('lets the old fire burn out without feeding it and keeps the fire in the ring', () => {
    const g0 = campGame(w, spawn, { day: 2, time: 0.22 }), c = createMind(w, g0).leantoSites({ x: spawn.x, z: spawn.z })[0];
    const l = { id: 0, x: c.x, z: c.z, heading: c.heading, progress: 1, up: { walls: 1, ring: 1, bed: 1 } }, rc = ringCentre(l);
    const old = { id: 0, x: spawn.x, z: spawn.z, fuel: 0.6, embers: 0.5, emberAge: 0, lit: 2.6, fed: 4 };
    const g = campGame(w, spawn, { day: 4, time: 0.55, leantos: { list: [l], nextId: 1 }, extra: { fire: { fires: [old], burnt: [], attempts: 6, nextId: 1 } } });
    expect(Math.hypot(rc.x - old.x, rc.z - old.z)).toBeGreaterThan(5); expect(g.leantos.noFire(old.x, old.z)).toBe(true);
    const f0 = g.fire.fires[0], m = createMind(w, g); m.engage();
    const feedOld = g.fire.feed.bind(g.fire); let fedOld = 0; g.fire.feed = (f, ...a) => { if (f === f0) fedOld++; return feedOld(f, ...a); };
    const t0 = g.clock.total; let ringLit = false, oldLitAfter = 0, otherZone = 0;
    while (g.clock.total < t0 + 0.9) {
      m.step(0.1); g.update(m.input, 0.1);
      if (g.fire.fires.some(f => Math.hypot(f.x - rc.x, f.z - rc.z) <= RING_R + 0.3 && f.fuel > 0.005)) ringLit = true;
      if (g.fire.fires.some(f => f !== f0 && g.leantos.noFire(f.x, f.z))) otherZone++;   // no second fire is ever lit beside the ring
    }
    expect(fedOld).toBe(0);
    expect(g.fire.fires.includes(f0) && f0.fuel > 0.005).toBe(false);      // the old fire is out
    expect(ringLit).toBe(true); expect(otherZone).toBe(0);
    expect(m.stats.errors || 0).toBe(0);
  }, 300000);
});
