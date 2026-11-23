// 0.43.6 "Stock" (agreed with the user 2026-11-23, "ja"): he gathered about 35 fronds onto three piles while his hut needed 8 branches first and only 12 fronds after,
// and said "I'll gather branches" while he took fronds: no branch was on the menu, fronds lay everywhere, and nothing said how many fronds lay ready.
// Now: NOW says the building material on his piles; what a home still needs says how many of each kind lie on his piles (and, with none there and none known, that a
// wander finds new ones); when his piles hold every frond his homes still need, only the nearest few loose fronds are on the menu, each "not needed now"; the fixed part
// says a note that is no longer true is dropped or rewritten. Facts only.
// Covers: materialText alone; game/actor's lean-to line, menu().material and the loose fronds on seed 1337; the request.
// Depends on: world/world, world/spots, game/game, game/actor, game/actions (PER_KIND), ai/actPrompt, tests/helpers/scene. Seed 1337.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { createActor } from '../src/game/actor.js';
import { PER_KIND } from '../src/game/actions.js';
import { actFixed, materialText, buildActMessages } from '../src/ai/actPrompt.js';
import { SITES_1337 } from './helpers/scene.js';

if (!globalThis.window) globalThis.window = new EventTarget();

describe('the words (ai/actPrompt materialText)', () => {
  it('fronds, stones and logs on his piles; nothing said with none', () => {
    expect(materialText({ fronds: 35, stones: 0, logs: 1, dryLogs: 0 })).toBe('Building material on his piles: 35 fronds, 1 log (green).');
    expect(materialText({ fronds: 1, stones: 2, logs: 3, dryLogs: 1 })).toBe('Building material on his piles: 1 frond, 2 stones, 3 logs (1 dry for the hut, 2 green).');
    expect(materialText({ fronds: 0, stones: 0, logs: 2, dryLogs: 2 })).toBe('Building material on his piles: 2 logs (dry for the hut).');
    expect(materialText({ fronds: 0, stones: 0, logs: 0, dryLogs: 0 })).toBe('');
    expect(materialText(null)).toBe('');
  });
  it('the fixed part: the lean-to line counts his piles; a note no longer true goes', () => {
    const f = actFixed('Dave');
    expect(f).toContain('every lean-to with what it still needs (and how many of each kind lie on his piles already)');
    expect(f).toContain('A note that is no longer true (a job done, a thing no longer in the way) is dropped or rewritten.');
  });
});

describe('the facts (game/actor)', () => {
  let w, spawn;
  beforeAll(async () => { w = await generateWorld(1337); spawn = startSpot(w); }, 120000);
  let id = 994000;
  const lg = (x, z, o = {}) => ({ id: id++, x, y: w.H(x, z), z, len: 1.6, a: 0, rad: 0.1, ...o });
  const pile = (x, z, kind, n, o = {}) => ({ x, z, kind, logs: Array.from({ length: n }, () => lg(x, z, o)) });
  const hutHome = () => { const s = SITES_1337[0]; return { id: 0, x: s.x, z: s.z, heading: s.heading, progress: 1, up: { ring: 1, walls: 1, bed: 1 }, hut: 12 / 32 }; };

  it('the hut line says what lies on his piles; NOW says the material; loose fronds are not needed', () => {
    const l = hutHome();
    const g = createGame(w, spawn, { time: 0.6, leantos: { list: [l], nextId: 1 }, wood: { carried: [], piles: [] } });
    g.wood.piles.push(pile(l.x + 4, l.z + 4, 'frond', 12, { frond: true }), pile(l.x - 4, l.z + 4, 'frond', 12, { frond: true }), pile(l.x + 4, l.z - 4, 'frond', 11, { frond: true }));
    g.wood.version++;
    const m = createActor(w, g, { chooser: () => null }).menu();
    const lt = m.places.find(q => q.kind === 'leanto');
    expect(lt.what).toMatch(/it still needs 8 branches \(none on his piles[^)]*\), then 12 fronds \(35 on his piles: enough\)/);
    expect(m.material).toEqual({ fronds: 35, stones: 0, logs: 0, dryLogs: 0 });
    const loose = m.places.filter(q => q.kind === 'frond');
    expect(loose.length).toBeGreaterThan(0); expect(loose.length).toBeLessThanOrEqual(PER_KIND);
    for (const q of loose) expect(q.what).toBe('a fallen palm frond (not needed now: 35 fronds on his piles, his home needs 12 more)');
    const user = buildActMessages({ state: {}, menu: m })[1].content;
    expect(user).toContain('Building material on his piles: 35 fronds.');
  });

  it('too few fronds on his piles: they are counted, loose fronds stay as before', () => {
    const l = hutHome();
    const g = createGame(w, spawn, { time: 0.6, leantos: { list: [l], nextId: 1 }, wood: { carried: [], piles: [] } });
    g.wood.piles.push(pile(l.x + 4, l.z + 4, 'frond', 5, { frond: true }), pile(l.x - 4, l.z - 4, 'branch', 3, { branch: true }));
    g.wood.version++;
    const m = createActor(w, g, { chooser: () => null }).menu();
    const lt = m.places.find(q => q.kind === 'leanto');
    expect(lt.what).toMatch(/it still needs 8 branches \(3 on his piles\), then 12 fronds \(5 on his piles\)/);
    for (const q of m.places.filter(p => p.kind === 'frond')) expect(q.what).toBe('a fallen palm frond');
  });

  it('no home yet: fronds are never "not needed"', () => {
    const g = createGame(w, spawn, { time: 0.6, wood: { carried: [], piles: [] } });
    const m = createActor(w, g, { chooser: () => null }).menu();
    for (const q of m.places.filter(p => p.kind === 'frond')) expect(q.what).toBe('a fallen palm frond');
    expect(buildActMessages({ state: {}, menu: m })[1].content).not.toContain('Building material on his piles');
  });
});
