// The fire and the stone ring (0.31.1 "Milk"): while a lean-to's stone ring stands, a fire is lit only in the ring itself, never right beside it
// (game rule, game/leanto `noFire`, game/game `lightable`), and Dave keeps his stock in the ring's middle so that every evening fire is lit there
// (game/mind: the aside pile stands clear of the zone, strays are carried in, a safety net before lighting).
// Covers: the zone in the lean-to module, the arc offering 'light' in the ring, nowhere beside it and everywhere else, and a 25-day life of Dave
// with a finished home on seed 1337 (the mind recreated on day 20): every fire he lights off a journey is in the ring and never two fires within 4 m.  0.33.1: and a fire burns in the ring on at least 15 of the 25 days.
// Depends on: world/world, world/spots, game/game, game/leanto, game/mind, game/fire, tests/helpers/mindCamp.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { createLeantos, ringCentre, RING_R, RING_NOFIRE } from '../src/game/leanto.js';
import { createMind } from '../src/game/mind.js';
import { FIRE_MIN } from '../src/game/fire.js';
import { campGame } from './helpers/mindCamp.js';

let w, spawn, logs;
beforeAll(async () => {
  w = await generateWorld(1337); spawn = startSpot(w);
  logs = w.tiles.flatMap(t => t.drift).sort((a, b) => Math.hypot(a.x - spawn.x, a.z - spawn.z) - Math.hypot(a.x - spawn.x, a.z - spawn.z) || a.id - b.id);
}, 120000);

const lt = (x, z, up = { ring: 1 }) => ({ id: 0, x, z, heading: 0.7, progress: 1, up });

describe('the zone where no fire is lit (game/leanto)', () => {
  it('is more than the ring (1 m) and at most 3.5 m from its middle, only for a finished lean-to with a finished ring', () => {
    const l = lt(spawn.x, spawn.z), rc = ringCentre(l), mk = list => { const s = createLeantos(); s.list.push(...list); return s; };
    const s = mk([l]);
    expect(RING_NOFIRE).toBe(3.5);
    expect(s.noFire(rc.x, rc.z)).toBe(false); expect(s.noFire(rc.x + RING_R, rc.z)).toBe(false);          // in the ring itself
    expect(s.noFire(rc.x + RING_R + 0.05, rc.z)).toBe(true); expect(s.noFire(rc.x + 2, rc.z)).toBe(true); expect(s.noFire(rc.x, rc.z + RING_NOFIRE)).toBe(true);
    expect(s.noFire(rc.x + RING_NOFIRE + 0.1, rc.z)).toBe(false);                                           // further out: unaffected
    expect(mk([lt(spawn.x, spawn.z, {})]).noFire(rc.x + 2, rc.z)).toBe(false);                              // no ring yet
    expect(mk([lt(spawn.x, spawn.z, { ring: 0.5 })]).noFire(rc.x + 2, rc.z)).toBe(false);                   // an unfinished ring
    expect(mk([{ ...l, progress: 0.5 }]).noFire(rc.x + 2, rc.z)).toBe(false);                              // an unfinished lean-to
  });
});

describe('lighting beside the ring (game rule, the player and Dave alike)', () => {
  // a pile of FIRE_MIN dry pieces at (dx, dz) from the ring's middle; the player stands 0.9 m beside it with a tuft of fibre
  const scene = (dx, dz, up = { ring: 1 }) => {
    const l = lt(spawn.x + 30, spawn.z + 30, up), rc = ringCentre(l), pile = { x: rc.x + dx, z: rc.z + dz, logs: logs.slice(0, FIRE_MIN).map(q => q.id) };
    const at = { x: pile.x + 0.9, z: pile.z, y: w.H(pile.x + 0.9, pile.z) };
    return createGame(w, at, { time: 0.5, leantos: { list: [l], nextId: 1 }, wood: { carried: [], piles: [pile] }, fibre: { carried: 2 } });
  };
  const offers = g => g.actions().some(o => o.kind === 'light');
  it('offers to light a pile in the ring, not one 1.1 to 3.5 m from its middle, and one further out as ever', () => {
    expect(offers(scene(0.3, 0))).toBe(true);
    for (const d of [1.1, 1.9, 2.4, 3.4]) expect(offers(scene(d, 0)), 'd ' + d).toBe(false);
    expect(offers(scene(4.2, 0))).toBe(true);
    expect(offers(scene(1.9, 0, {}))).toBe(true);                       // no ring built: as before
  });
  it('does not start a fire from a pile beside the ring even when told to (no fibre is used)', () => {
    const g = scene(1.9, 0), pile = g.wood.piles[0];
    g.act({ kind: 'light', pile, torch: false, big: true });
    for (let t = 0; t < 40; t += 1 / 30) g.update({ up: false, down: false, left: false, right: false, run: false, target: null, clearTarget() {}, takeAction: () => null, takeLight: () => null, takeSleep: () => false, pressing: () => false }, 1 / 30);
    expect(g.fire.fires.length).toBe(0); expect(g.fibre.carried).toBe(2);
  });
});

describe('Dave lights his evening fires in the ring (seed 1337, a finished home, 25 days, the mind recreated on day 20)', () => {
  it('every fire off a journey is lit within the ring, and never two fires burn within 4 m', () => {
    const g0 = campGame(w, spawn, { day: 2, time: 0.22 }), m0 = createMind(w, g0), c = m0.leantoSites({ x: spawn.x, z: spawn.z })[0];
    const leantos = { list: [{ id: 0, x: c.x, z: c.z, heading: c.heading, progress: 1, up: { walls: 1, ring: 1, bed: 1 } }], nextId: 1 };
    const g = campGame(w, spawn, { day: 2, time: 0.22, leantos, extra: {} }), rc = ringCentre(g.leantos.list[0]);
    let m = createMind(w, g); m.engage();
    const fires = [];
    const note = how => (x, z, ...a) => { const f = g.fire[how + '0'](x, z, ...a); if (f) fires.push({ day: g.clock.day, d: Math.hypot(rc.x - x, rc.z - z), journey: m.journeying }); return f; };
    g.fire.attempt0 = g.fire.attempt.bind(g.fire); g.fire.kindle0 = g.fire.kindle.bind(g.fire);
    g.fire.attempt = note('attempt'); g.fire.kindle = note('kindle');
    const t0 = g.clock.total; let reset = false, twoClose = 0; const litDays = new Set();
    while (g.clock.total < t0 + 25) {
      if (!reset && g.clock.day >= 20) { reset = true; m = createMind(w, g); m.engage(); }
      const lit = g.fire.fires.filter(f => f.fuel > 0.005);
      for (let i = 0; i < lit.length; i++) for (let j = i + 1; j < lit.length; j++) if (Math.hypot(lit[i].x - lit[j].x, lit[i].z - lit[j].z) < 4) twoClose++;
      if (lit.some(f => Math.hypot(f.x - rc.x, f.z - rc.z) <= RING_R + 0.3)) litDays.add(g.clock.day);
      m.step(0.1); g.update(m.input, 0.1);
    }
    const home = fires.filter(f => !f.journey);
    expect(home.length).toBeGreaterThanOrEqual(3);   // 0.33.1 "Hearth": the stock stands in the ring and the fire is kept (fewer fresh lightings: 4 here, 10 before); what counts is the days with a fire in the ring
    expect(litDays.size).toBeGreaterThanOrEqual(15);
    expect(home.filter(f => f.d > RING_R + 0.3).map(f => `d${f.day}:${f.d.toFixed(1)}`)).toEqual([]);
    expect(twoClose).toBe(0);
  }, 400000);
});
