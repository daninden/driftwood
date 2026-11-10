// Dave's habit, the long runs (game/mind): half a game day to two game days of the mind playing a real game, moved unchanged from tests/mind.test.js in 0.30.2 "Checks" so that `npm run test:fast` skips them (they run with `npm run test:sim` and `npm test`).
// Covers: the first two days build nothing, the same start gives the same life, and exploring trips (out by day, home before dark, never on a climbing route, on known ground, not at thirst or hunger time, repeatable).
// Depends on: world/world, world/spots, game/game, game/mind, game/movement, tests/helpers/mindSim, tests/helpers/mindCamp.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { createMind, exploreReach, EXPLORE_FROM, EXPLORE_TO, EXPLORE_BACK } from '../src/game/mind.js';
import { terrainAt, PACE } from '../src/game/movement.js';
import { runMind, walkFirstDay } from './helpers/mindSim.js';
import { campGame } from './helpers/mindCamp.js';

let w, spawn;
beforeAll(async () => { w = await generateWorld(1337); spawn = startSpot(w); }, 120000);
const camp = (o) => campGame(w, spawn, o);

describe('the mind with a game: long runs', () => {
  it('is repeatable: the same island and the same start give the same life', () => {
    const a = runMind(w, spawn, { days: 1.2, know: true }).r, b = runMind(w, spawn, { days: 1.2, know: true }).r;
    expect(a.goals).toEqual(b.goals); expect(a.final).toEqual(b.final); expect(a.events.length).toBe(b.events.length);
  });
});

describe('his home: the project, first days (0.29.3)', () => {
  it('never builds before the third day, and not at all without a camp', () => {
    const { r } = runMind(w, spawn, { days: 2, know: true });
    expect(r.builds).toBe(0); expect(r.final.leantos).toBe(0); expect(r.homeDay).toEqual({});
    const g = createGame(w, spawn, { day: 3, time: 0.25 }); walkFirstDay(w, g, spawn); const m = createMind(w, g); m.engage();
    expect(m.home().kind).toBe('here'); expect(m.homePlan().step).toBeNull();   // never slept, no fire: no camp yet
  });
});

describe('exploring: the trip (with a game)', () => {
  const trip = (know, { day = 1, time = 0.25, stream = 0 } = {}, seed = w, sp = spawn) => {
    const g = camp({ day, time, know });   // his camp, nuts, fibre and wood in stock: the morning is free
    g.known.visit(sp.x, sp.z);
    const m = createMind(seed, g, { stream }); m.engage();
    const r = { known0: g.known.count, outside: 0, route: 0, paces: new Set(), lateAt: null, started: null, maxDist: 0, homeAt: null, back: null };
    const home = () => m.home();
    for (let i = 0, end = g.clock.total + 0.5; g.clock.total < end && i < 40000; i++) {
      m.step(0.1); g.update(m.input, 0.1);
      if (m.exploring) {
        if (r.started === null) r.started = g.clock.time;
        r.paces.add(m.input.pace); if (!g.known.has(g.player.x, g.player.z)) r.outside++;
        if (terrainAt(seed, g.player.x, g.player.z, 0).climb > 0.25) r.route++;
        r.maxDist = Math.max(r.maxDist, Math.hypot(g.player.x - home().x, g.player.z - home().z)); r.lastExploring = g.clock.time;
      }
    }
    r.m = m; r.g = g; r.known1 = g.known.count; r.reachedHome = Math.hypot(g.player.x - m.home().x, g.player.z - m.home().z);
    return r;
  };
  // whether he sets out is a matter of chance (the PRNG of his stream): the first of a few streams on which he does
  const tripAny = (know, o = {}) => { let r; for (let st = 0; st < 12; st++) { r = trip(know, { ...o, stream: st }); if (r.m.stats.explores > 0) return r; } return r; };
  it('goes out by day to the edge of what he knows, learns what he walks past, and strolls and explores at the amble', () => {
    const r = tripAny(true);
    expect(r.m.stats.explores).toBeGreaterThanOrEqual(1);
    expect(r.known1).toBeGreaterThan(r.known0);          // he knows more ground than before
    expect(r.started).toBeGreaterThanOrEqual(EXPLORE_FROM); expect(r.started).toBeLessThan(EXPLORE_TO);
    expect(r.paces.has(PACE)).toBe(true);                  // ambling while he explores
    expect(r.maxDist).toBeGreaterThan(30);                 // and really out of the home
    expect(r.maxDist).toBeLessThanOrEqual(exploreReach(1) + 60);   // within his reach for the day (and the margin of the last steps)
    expect(r.m.stats.errors || 0).toBe(0);
  });
  it('is home well before dark: the trip is over before EXPLORE_BACK (and long before dusk)', () => {
    for (const sp of [{ day: 1, time: 0.25 }, { day: 1, time: 0.4 }]) {
      const r = tripAny(true, sp);
      if (r.started === null) continue;
      expect(r.lastExploring).toBeLessThan(EXPLORE_BACK + 0.01);
      expect(r.lastExploring).toBeLessThan(0.7);
    }
    const late = tripAny(true, { day: 1, time: 0.5 });   // a late start has little time: either no trip, or a short one that is back in time
    if (late.started !== null) expect(late.lastExploring).toBeLessThan(EXPLORE_BACK + 0.01);
  });
  it('never takes a climbing route and keeps to ordinary ground', () => {
    for (const know of [true, false]) { const r = tripAny(know); expect(r.route).toBe(0); expect(r.m.stats.explores).toBeGreaterThanOrEqual(know ? 1 : 0); }
  });
  it('is on ground he knows except while he explores (the trip is the only exception, with a search)', () => {
    const r = tripAny(true); expect(r.m.stats.explores).toBeGreaterThanOrEqual(1);
    // outside is counted only while exploring: the ground he walked into is known by the next step
    expect(r.outside).toBe(0);
    expect(r.m.exploring).toBe(false);
  });
  it('does not go when it is thirst or hunger time, or the crabs call, or too late in the day', () => {
    const g1 = createGame(w, spawn, { day: 3, time: 0.25, thirst: { days: 0.3 }, hunger: { days: 0.05 }, sleep: { awake: 0.1 } }); walkFirstDay(w, g1, spawn);
    const g2 = createGame(w, spawn, { day: 3, time: 0.56, thirst: { days: 0.05 }, hunger: { days: 0.05 }, sleep: { awake: 0.1 } }); walkFirstDay(w, g2, spawn);
    for (const g of [g1, g2]) { const m = createMind(w, g); m.engage(); for (let i = 0; i < 300; i++) { m.step(0.1); g.update(m.input, 0.1); } expect(m.stats.explores).toBe(0); }
  });
  it('0.30.16: the 220 m cap is gone: a target beyond it is chosen when the reach allows it and home is reachable in time, and not otherwise', () => {
    const aim = (day, time, avail) => { const g = camp({ day, time, know: true }); g.known.visit(spawn.x, spawn.z, 225); const m = createMind(w, g); m.engage(); const c = m.exploreAim(day, time, 'coast', avail); return c && Math.hypot(c.x - m.home().x, c.z - m.home().z); };
    expect(aim(20, 0.25, 2000)).toBeGreaterThan(220);     // day 20: the reach is 380 m, and with the time for it he goes past the old cap
    expect(aim(9, 0.25, 2000)).toBeNull();                // day 9: the reach (215 m) does not go past the known ground (225 m)
    expect(aim(20, 0.25)).toBeNull();                     // the real time to dark is far too short for the way there and back at the amble (home before dark is the limit)
    expect(aim(20, 0.5)).toBeNull();
  });
  it('0.30.16: a trip starts in the early morning (before EXPLORE_FROM) only when home and the crabs have nothing to do', () => {
    const done = { list: [{ id: 0, x: spawn.x + 6, z: spawn.z + 2, heading: 0.7, progress: 1, up: { walls: 1, ring: 1, bed: 1 } }], nextId: 1 };
    // how many of 24 streams set out before EXPLORE_FROM (the chance is 0.3 at each idle moment, so some do when it is allowed)
    const early = o => { let n = 0; for (let st = 0; st < 24; st++) { const g = camp({ day: 3, time: 0.18, know: true, ...o }); const m = createMind(w, g, { stream: st }); m.engage(); for (let i = 0; i < 200 && g.clock.time < EXPLORE_FROM; i++) { m.step(0.1); g.update(m.input, 0.1); if (m.exploring) { n++; break; } } } return n; };
    expect(early({ leantos: done, stocked: false })).toBeGreaterThan(0);   // home finished, no fibre to roast a crab: calm, the morning is open
    expect(early({ stocked: false })).toBe(0);                             // the lean-to is still to build (the project would have its step at HOME_FROM)
    expect(early({ leantos: done })).toBe(0);                              // a crab trip is due later (fibre, dry wood): the morning is not open
  });
  it('is repeatable: the same island and the same start give the same trips', () => {
    const a = trip(true, { stream: 2 }), b = trip(true, { stream: 2 });
    expect(a.m.stats.explores).toBe(b.m.stats.explores); expect(a.known1).toBe(b.known1);
  });
});

describe('a spot to stand at is reached, not swung across (0.30.7 "Clearing")', () => {
  it('seed 1337 from a new game, stream 0: he roasts the crab he carries at the ring fire of his lean-to instead of swinging across the standing point for two days (max hunger 1.39 before)', () => {
    const { r, mind } = runMind(w, startSpot(w), { days: 10, know: false, stream: 0 });
    expect(mind.stats.events.filter(e => e.type === 'goal-dropped' && e.goal === 'eat' && e.why === 'timeout')).toEqual([]);   // no eat goal ran out of time beside the fire
    expect(r.maxHunger).toBeLessThan(1); expect(r.mix.crab).toBeGreaterThan(0); expect(mind.stats.noStand || 0).toBe(0);   // a crab was roasted and eaten; no standing point was lost at the ring
  });
});
