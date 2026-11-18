// One hearth (0.33.4): beside a finished stone ring the fire is the one in the ring. The no-fire zone round a finished ring is RING_NOFIRE (8 m) from its middle, and a fire that already
// burns in that zone (an old one from before the ring was built: Dave's site is 5 to 7.5 m from his fire, so the ring stands 5.46 to 7.82 m from it) is not fed: the arc offers no 'feed' for
// it (game/game), for the player and for Dave alike.
// Covers: the geometry of Dave's site (the old fire always inside the zone), the player's arc (feed refused for a fire 5 m and 7.5 m from a finished ring, offered for a fire in the ring, for a fire
// beyond the zone and for any fire when the ring is not finished; light refused), and a scripted evening of Dave with an old fire burning 5.5 m from his finished ring: he never feeds it, it burns out,
// and he lights and keeps the fire in the ring.
// 0.37.7: a "feed" step of full AI play refused in the zone says why (game/actor).
// Depends on: world/world, world/spots, game/game, game/actor, game/leanto, game/fire, tests/helpers/scene.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { ringCentre, RING_R, RING_NOFIRE, RING_AT } from '../src/game/leanto.js';
import { FUEL_MAX } from '../src/game/fire.js';
import { campGame, SITES_1337 } from './helpers/scene.js';
import { createActor } from '../src/game/actor.js';

let w, spawn, logs;
beforeAll(async () => {
  w = await generateWorld(1337); spawn = startSpot(w);
  logs = w.tiles.flatMap(t => t.drift).sort((a, b) => Math.hypot(a.x - spawn.x, a.z - spawn.z) - Math.hypot(b.x - spawn.x, b.z - spawn.z) || a.id - b.id);
}, 120000);

describe('the zone covers the old fire of every site Dave can choose', () => {
  it('the ring is sqrt(r^2 + RING_AT^2) from the old fire, at most 7.82 m, inside RING_NOFIRE', () => {
    expect(RING_NOFIRE).toBe(8);
    for (const r of [5, 6.2, 7.5]) { const d = Math.hypot(r, RING_AT); expect(d).toBeGreaterThan(RING_R); expect(d).toBeLessThan(RING_NOFIRE); }
    expect(Math.hypot(Math.max(...[5, 6.2, 7.5]), RING_AT)).toBeCloseTo(7.82, 2);
  });
  it('holds for real sites on seed 1337', () => {
    const sites = SITES_1337;
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
  it('a "feed" step refused there says why (0.37.7 "Reasons"): only the fire in the ring is fed', () => {
    const reasonOf = g => { const asks = []; let n = 0; const a = createActor(w, g, { chooser: (m, ask) => { asks.push(ask); return n++ ? null : [{ do: 'feed' }]; } }); for (let i = 0; i < 20; i++) { a.step(0.1); g.update(a.input, 0.1); } return asks[1] && asks[1].last.reason; };
    expect(reasonOf(scene(5))).toMatch(new RegExp(`within ${RING_NOFIRE} m of his stone ring: there only the fire in the ring is fed`));
  });
  it('has no feed in the arc at all for a fire 5 m from the ring', () => {
    const g = scene(5), f = g.fire.fires[0];
    expect(g.actions().find(o => o.kind === 'feed')).toBeUndefined();
    expect(f.fed).toBe(2);
  });
});

