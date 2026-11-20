// 0.42.1 "Kindling" (agreed with the user 2026-11-20, after an AI log on 0.42.0: soaked at landfall he still chose the lean-to over a fire): the request makes the fire as
// concrete as the lean-to. With no fire burning, the fire line says what a new one still needs (a pile of FIRE_MIN dry pieces, his best pile with its dry pieces; a tuft
// of fibre, or the nearest coconut to husk for it; then "light"); "Carrying" says "no fibre" when he has none; a planning rule says a fire before dusk, of branches if need be.
// Depends on: world/world, world/spots, game/game, game/actor, game/fire, ai/actPrompt, ai/prompt, tests/helpers/scene. Seed 1337.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { createActor } from '../src/game/actor.js';
import { FIRE_MIN } from '../src/game/fire.js';
import { actFixed, fireText, kindlingText, buildActMessages } from '../src/ai/actPrompt.js';
import { stateText } from '../src/ai/prompt.js';
import { walkFirstDay } from './helpers/scene.js';

if (!globalThis.window) globalThis.window = new EventTarget();

describe('the fire line says what a new fire still needs', () => {
  const coco = { id: 'coconut1', kind: 'coconut', dist: 19, dir: 'west' };
  it('no pile, no fibre: the nearest coconut to husk', () => {
    const t = fireText([], { carries: {}, places: [coco, { id: 'coconut2', kind: 'coconut', dist: 25, dir: 'south' }] });
    expect(t).toBe(`Fire: he has no fire. To light one he needs a pile of at least ${FIRE_MIN} pieces of dry driftwood or branches (he has no pile of firewood yet) and a tuft of fibre (he has no fibre: husk a coconut on the ground for it (coconut1, 19 m west, is nearest)); then "light" standing beside the pile.`);
  });
  it('his best pile with its dry pieces, and the fibre he carries', () => {
    const places = [{ id: 'pile1', kind: 'pile', fuel: 2, dist: 3, dir: 'north' }, { id: 'pile2', kind: 'pile', fuel: 0, dist: 1, dir: 'east' }];
    expect(kindlingText({ carries: { fibre: 1 }, places })).toMatch(/his pile pile1 \(3 m north\) has 2 of 4 dry pieces\) and a tuft of fibre \(he carries 1 tuft of fibre\)/);
    expect(kindlingText({ carries: { fibre: 2 }, places: [{ id: 'pile3', kind: 'pile', fuel: 5, dist: 2, dir: 'south' }] })).toMatch(/pile3 \(2 m south\) has 5 dry pieces: enough.*he carries 2 tufts of fibre/);
    expect(kindlingText({ carries: { torch: true }, places: [] })).toMatch(/his burning torch lights it/);
    expect(kindlingText({ carries: {}, places: [] })).toMatch(/he has no fibre: husk a coconut on the ground for it \(he knows none now\)/);
  });
  it('a burning fire or embers: no recipe; without the menu the old line', () => {
    const m = { carries: {}, places: [coco] };
    expect(fireText([{ id: 'fire1', state: 'burning', hours: 2, dist: 1, dir: 'north' }], m)).toBe('Fire: fire1, 1 m north, burns about 2 more hours.');
    expect(fireText([{ id: 'fire1', state: 'embers', dist: 1, dir: 'north' }], m)).toBe('Fire: none of his burns; embers only at fire1, 1 m north.');
    expect(fireText([{ id: 'fire1', state: 'cold', dist: 1, dir: 'north' }], m)).toMatch(/^Fire: none of his burns \(one cold fire place\)\. To light one/);
    expect(fireText([])).toBe('Fire: he has no fire.');
  });
  it('the request carries it, and "Carrying" says when he has no fibre', () => {
    const user = buildActMessages({ state: { carries: { driftwood: 1 } }, menu: { carries: { driftwood: 1 }, places: [coco], fires: [] } })[1].content;
    expect(user).toMatch(/Carrying: 1 driftwood, no fibre\./);
    expect(user).toMatch(/To light one he needs .*coconut1, 19 m west, is nearest/);
    expect(stateText({ carries: {} })).toMatch(/Carrying: nothing \(no fibre\)\./);
    expect(stateText({ carries: { fibre: 1 } })).toMatch(/Carrying: 1 fibre\./);
  });
  it('the planning rule: a fire before dusk, of branches if need be', () => {
    expect(actFixed()).toMatch(/Before dusk he wants a fire: it gives him a whole night of sleep, dries him and roasts his food\. Branches burn too \(a pile of 4 branches lights as well as driftwood\), so a first fire can be made of branches and the driftwood can go to the lean-to\./);
  });
});

describe('the menu gives each pile its dry pieces that burn (game/actor)', () => {
  let w, spawn;
  beforeAll(async () => { w = await generateWorld(1337); spawn = startSpot(w); }, 120000);
  it('a pile of branches and a pile of fronds', () => {
    let id = 960000;
    const pc = (kind, x, z) => ({ id: id++, x, y: w.H(x, z), z, len: 1.6, a: 0, rad: 0.1, ...(kind === 'driftwood' ? {} : { [kind]: true }) });
    const pile = (kind, n, x, z) => ({ x, z, kind, logs: Array.from({ length: n }, () => pc(kind, x, z)) });
    const g = createGame(w, spawn, { sleep: { awake: 0.1 }, time: 0.35, wood: { carried: [], piles: [] } });
    walkFirstDay(w, g, spawn); g.known.visit(spawn.x, spawn.z);
    const spots = [];
    for (let i = 0; i < 48 && spots.length < 2; i++) { const a = i * Math.PI / 24, x = spawn.x + Math.sin(a) * 4, z = spawn.z + Math.cos(a) * 4; if (g.canPileAt(x, z) && w.H(x, z) > 0.5 && !spots.some(o => Math.hypot(o.x - x, o.z - z) < 3)) spots.push({ x, z }); }
    g.wood.piles.push(pile('branch', 3, spots[0].x, spots[0].z), pile('frond', 2, spots[1].x, spots[1].z));
    const piles = createActor(w, g, {}).menu().places.filter(q => q.kind === 'pile');
    expect(piles.map(q => q.fuel).sort()).toEqual([0, 3]);
  });
});
