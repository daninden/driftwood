// game/camp (0.38.0 "Only him"): the plain facts of his home and camp that the request and the logbook read (they were read from the old mind): his home, the fire and the
// store at his fire place, how the last night went, the wet driftwood he knows on the tide strip. Pure: it reads the game and changes nothing in it.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { createCamp, FIRE_PILE, STRIP_RANGE } from '../src/game/camp.js';
import { BURN, EMBERS } from '../src/game/fire.js';
import { campGame, walkFirstDay } from './helpers/scene.js';
import { snapshotOf } from '../src/ai/prompt.js';

let w, spawn;
beforeAll(async () => { w = await generateWorld(1337); spawn = startSpot(w); }, 120000);
const fireAt = (x, z, fuel = 4 * BURN) => ({ id: 0, x, z, fuel, embers: EMBERS, lit: 0, fed: 4 });
const logs = (n, x, z, o = {}) => Array.from({ length: n }, (_, i) => ({ id: 950000 + i, x, y: w.H(x, z), z, len: 2, a: 0, rad: 0.1, ...o }));

describe('his home (game/camp home)', () => {
  it('is none on a new island; his newest burnt place once there is one; a fire burning beats it', () => {
    const g = createGame(w, spawn, {}); g.known.visit(spawn.x, spawn.z);
    expect(createCamp(w, g).home()).toBeNull();
    const h = campGame(w, spawn, {}), c = createCamp(w, h);
    expect(c.home()).toMatchObject({ kind: 'fire', x: spawn.x, z: spawn.z });
    expect(c.camp()).toMatchObject({ fire: 'out', ring: false });
  });
  it('the fire at his home: well, low or embers, with its fuel; only on ground he knows', () => {
    const g = createGame(w, spawn, { fire: { fires: [fireAt(spawn.x, spawn.z, 6 * BURN)], burnt: [], torch: null, torches: [], attempts: 0, nextId: 1 } });
    const c = createCamp(w, g);
    walkFirstDay(w, g, spawn);
    expect(c.home()).toMatchObject({ kind: 'fire' });
    expect(c.camp().fire).toBe('well'); expect(c.camp().fuel).toBeCloseTo(6 * BURN, 9);
    g.fire.fires[0].fuel = 0.5 * BURN; expect(c.camp().fire).toBe('low');
    g.fire.fires[0].fuel = 0; expect(c.camp().fire).toBe('embers');
  });
  it('the store counts his own piles by the fire (dry and wet driftwood, branches), not a pile further off', () => {
    const g = campGame(w, spawn, { stocked: false }), c = createCamp(w, g);
    g.wood.piles.push({ x: spawn.x + 1, z: spawn.z, kind: 'driftwood', logs: logs(3, spawn.x + 1, spawn.z) });
    g.wood.piles.push({ x: spawn.x, z: spawn.z + 1, kind: 'branch', logs: logs(2, spawn.x, spawn.z + 1, { branch: true }) });
    g.wood.piles.push({ x: spawn.x + FIRE_PILE + 3, z: spawn.z, kind: 'driftwood', logs: logs(5, spawn.x + FIRE_PILE + 3, spawn.z) });
    const st = c.camp().store;
    expect(st.dry + st.wet).toBe(3); expect(st.branches).toBe(2); expect(st.logs).toBe(0);
  });
});

describe('the tide strip and the last night', () => {
  it('stripWood counts wet driftwood he knows within STRIP_RANGE, and reads only', () => {
    const g = createGame(w, spawn, {}); walkFirstDay(w, g, spawn);
    const c = createCamp(w, g), before = JSON.stringify(g.state());
    expect(Number.isInteger(c.stripWood())).toBe(true); expect(c.stripWood()).toBeGreaterThanOrEqual(0); expect(STRIP_RANGE).toBe(120);
    c.home(); c.camp();
    expect(JSON.stringify(g.state())).toBe(before);
  });
  it('lastNight: none before a sleep; a cold night he lay down for himself, with its hours; a collapse when he did not', () => {
    const clock = { total: 3.9, day: 3 }, sl = { asleep: false, nap: false, rest: () => 0.6 };   // a plain stand-in for the parts of a game it reads
    const g = { player: { x: 0, z: 0, lie: 1 }, clock, sleep: sl, thirst: { faint: () => false }, fire: { warm: () => false, fires: [], burnt: [] }, leantos: { shelter: () => false, list: [] }, wood: { piles: [] }, known: { hasAround: () => true } };
    const c = createCamp(w, g);
    expect(c.lastNight()).toBeNull();
    sl.asleep = true; c.tick(true); clock.total += 0.25; c.tick(true);
    sl.asleep = false; clock.day = 4; c.tick(true);
    expect(c.lastNight()).toMatchObject({ hours: 6, cold: true, collapse: false, day: 4, rest: 0.6 });
    expect(c.slept).toEqual({ x: 0, z: 0 });
    clock.total += 1; sl.asleep = true; c.tick(false); clock.total += 0.1; sl.asleep = false; c.tick(false);
    expect(c.lastNight().collapse).toBe(true); expect(c.lastNight().hours).toBeCloseTo(2.4, 1);
  });
  it('the request\'s situation reads it: the tide strip, and the distance from home for the logbook', () => {
    const g = campGame(w, spawn, {}), c = createCamp(w, g);
    const s = snapshotOf(g, c);
    expect(s.fromHome).toBeCloseTo(0, 6); expect(s.camp).toMatchObject({ fire: 'out' }); expect(s.strip).toBeGreaterThanOrEqual(0);
  });
});
