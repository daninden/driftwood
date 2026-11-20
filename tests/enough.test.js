// 0.43.5 "Enough" (agreed with the user 2026-11-20, "Ok"): he fetched a great deal of firewood and seemed to have no other aim. Firewood is the only thing gathered ahead,
// and the request never said how much a night takes. Now the fire line says the dry firewood on his piles in pieces and hours of fire, and what the coming night takes
// (the hours, what his burning fire still covers, the pieces of dry driftwood for the rest, in the stone ring when he has one); the plan rule says a night in pieces. Facts only.
// Covers: firewoodText alone; game/actor menu().firewood on seed 1337 (piles in and out of a ring, wet driftwood not counted, a burning fire by day and at night); the request.
// Depends on: world/world, world/spots, game/game, game/actor, game/fire, game/sleep, game/leanto, ai/actPrompt, tests/helpers/scene. Seed 1337.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { createActor } from '../src/game/actor.js';
import { BURN, RING_BURN, BRANCH_BURN } from '../src/game/fire.js';
import { DUSK, DAWN } from '../src/game/sleep.js';
import { ringCentre } from '../src/game/leanto.js';
import { actFixed, firewoodText, fireText, buildActMessages } from '../src/ai/actPrompt.js';
import { SITES_1337 } from './helpers/scene.js';

if (!globalThis.window) globalThis.window = new EventTarget();
const NIGHT = (1 - DUSK + DAWN) * 24;

describe('the words (ai/actPrompt firewoodText)', () => {
  it('by day: what his piles hold and what the night takes', () => {
    expect(firewoodText({ driftwood: 8, branches: 3, hours: 35, ring: true, dark: false, night: 8, covered: 0, need: 3 }))
      .toBe('Firewood on his piles: 8 dry driftwood and 3 branches, about 35 hours of fire. The night (19:55 to 04:04) is about 8 hours: about 3 pieces of dry driftwood in his stone ring (a branch burns half as long).');
  });
  it('at night with a fire burning: the rest of the night and what is left to cover', () => {
    expect(firewoodText({ driftwood: 0, branches: 0, hours: 0, ring: false, dark: true, night: 5.5, covered: 2, need: 2 }))
      .toBe('Firewood on his piles: none dry. The rest of the night (until dawn, 04:04) is about 5.5 hours; his fire burning now has about 2 of those hours: the rest takes about 2 pieces of dry driftwood (a branch burns half as long).');
    expect(firewoodText({ driftwood: 1, branches: 0, hours: 3, ring: false, dark: true, night: 3, covered: 3, need: 0 })).toMatch(/is about 3 hours: his fire burning now lasts it\.$/);
  });
  it('goes into the fire line, also with a fire burning; the plan rule says a night in pieces', () => {
    const fw = { driftwood: 2, branches: 0, hours: 5, ring: false, dark: false, night: 8, covered: 0, need: 4 };
    expect(fireText([{ id: 'fire1', state: 'burning', hours: 2, dist: 1, dir: 'north' }], { firewood: fw })).toMatch(/^Fire: fire1, 1 m north, burns about 2 more hours\. Firewood on his piles: 2 dry driftwood/);
    expect(fireText([], { carries: {}, places: [], firewood: fw })).toMatch(/then "light" standing beside the pile\. Firewood on his piles/);
    expect(actFixed('Dave')).toContain(`A night (19:55 to 04:04, about 8 hours) takes about ${Math.ceil(NIGHT / 24 / BURN)} pieces of dry driftwood, about ${Math.ceil(NIGHT / 24 / (BURN * RING_BURN))} in a stone ring`);
  });
});

describe('the facts (game/actor menu().firewood)', () => {
  let w, spawn;
  beforeAll(async () => { w = await generateWorld(1337); spawn = startSpot(w); }, 120000);
  let id = 993000;
  const lg = (x, z, o = {}) => ({ id: id++, x, y: w.H(x, z), z, len: 1.6, a: 0, rad: 0.1, ...o });
  it('dry pieces on all his piles, in hours (in the ring 1.5 times), wet driftwood not counted; the night and its need', () => {
    const site = SITES_1337[0], l = { id: 0, x: site.x, z: site.z, heading: site.heading, progress: 0, up: { ring: 1 } };
    const g = createGame(w, spawn, { time: 0.4, leantos: { list: [l], nextId: 1 }, wood: { carried: [], piles: [] }, fire: { fires: [], burnt: [], attempts: 0, nextId: 0 } });
    const rc = ringCentre(g.leantos.list[0]), t = g.clock.total;
    g.wood.piles.push({ x: rc.x, z: rc.z, kind: 'driftwood', logs: [lg(rc.x, rc.z), lg(rc.x, rc.z), lg(rc.x, rc.z, { t })] });   // 2 dry, 1 just washed up (wet)
    g.wood.piles.push({ x: spawn.x + 30, z: spawn.z, kind: 'branch', logs: [lg(spawn.x + 30, spawn.z, { branch: true }), lg(spawn.x + 30, spawn.z, { branch: true })] });
    g.wood.version++;
    const fw = createActor(w, g, { chooser: () => null }).menu().firewood;
    expect(fw.driftwood).toBe(2); expect(fw.branches).toBe(2); expect(fw.ring).toBe(true); expect(fw.dark).toBe(false);
    expect(fw.hours).toBe(Math.round(2 * BURN * 24 * RING_BURN + 2 * BURN * 24 * BRANCH_BURN));
    expect(fw.night).toBe(Math.round(NIGHT * 2) / 2); expect(fw.covered).toBe(0);
    expect(fw.need).toBe(Math.ceil(NIGHT / (BURN * 24 * RING_BURN)));
    const user = buildActMessages({ state: {}, menu: { carries: {}, places: [], fires: [], firewood: fw } })[1].content;
    expect(user).toContain('Firewood on his piles: 2 dry driftwood and 2 branches');
  });
  it('a fire burning at night covers part of the rest of the night', () => {
    const g = createGame(w, spawn, { time: 0.9, wood: { carried: [], piles: [] }, fire: { fires: [], burnt: [], attempts: 0, nextId: 0 } });
    g.fire.fires.push({ id: 0, x: spawn.x + 1, z: spawn.z, fuel: 2 * BURN, embers: 0 });
    const fw = createActor(w, g, { chooser: () => null }).menu().firewood;
    expect(fw.dark).toBe(true); expect(fw.ring).toBe(false);
    const rest = ((DAWN - 0.9 + 1) % 1) * 24;
    expect(fw.night).toBe(Math.round(rest * 2) / 2);
    expect(fw.covered).toBeGreaterThan(4); expect(fw.covered).toBeLessThanOrEqual(5);
    expect(fw.need).toBe(Math.ceil((rest - 5) / (BURN * 24) - 0.05));
  });
});
