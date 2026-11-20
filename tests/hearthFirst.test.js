// 0.43.0 "Hearth" (agreed with the user 2026-11-20, "akkoord, 6 stenen, Hearth eerst en daarna Mouth", after an AI log on 0.42.1 in which the model took the stone ring for a step of
// the fire and never made one): a home begins with its stone ring (6 stones), then the lean-to behind it, then walls and bed, then the hut. A finished ring holds a fire with or
// without its lean-to; a fire needs no ring. The request tells the order, what a begun home still needs, and what goes into an empty ring for a fire.
// Covers: game/leanto `stageOf` and `build` in order; game/game: a stone starts a home, driftwood starts nothing, driftwood waits for the finished ring, the ring's stones are built
// from beside it; the ring's effects (leantos.ring, noFire, fire.update) before the lean-to; game/actor's menu lines and refusal; ai/actPrompt and ai/prompt texts.
// Depends on: world/world, world/spots, game/game, game/leanto, game/actor, game/fire, game/stones, ai/actPrompt, ai/prompt, tests/helpers/scene. Seed 1337.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { createActor } from '../src/game/actor.js';
import { createLeantos, stageOf, ringDone, hutReady, PARTS, PIECE_TIME, RING_REACH, ringCentre, standFor } from '../src/game/leanto.js';
import { FIRE_MIN, BURN, RING_BURN } from '../src/game/fire.js';
import { stonesOfTile } from '../src/game/stones.js';
import { branchesOfTile } from '../src/game/branches.js';
import { actFixed } from '../src/ai/actPrompt.js';
import { stateText } from '../src/ai/prompt.js';
import { DO } from '../src/game/actions.js';
import { walkFirstDay } from './helpers/scene.js';

if (!globalThis.window) globalThis.window = new EventTarget();

let w, spawn, drift, stones, branches;
beforeAll(async () => {
  w = await generateWorld(1337); spawn = startSpot(w);
  const d = o => Math.hypot(o.x - spawn.x, o.z - spawn.z), by = (a, b) => d(a) - d(b);
  drift = w.tiles.flatMap(t => t.drift).sort(by);
  stones = w.tiles.flatMap(t => stonesOfTile(w, t)).sort(by);
  branches = w.tiles.flatMap(t => t.trees.length ? branchesOfTile(w, t) : []).sort(by);
}, 120000);

const makeInput = (o = {}) => {
  const i = { up: false, down: false, left: false, right: false, run: false, target: null, hold: null, action: null, sleep: false, ...o };
  i.clearTarget = () => { i.target = null; };
  i.takeLight = () => { const h = i.hold; i.hold = null; return h; };
  i.takeAction = () => { const a = i.action; i.action = null; return a; };
  i.takeSleep = () => { const s = i.sleep; i.sleep = false; return s; };
  i.pressing = () => false;
  return i;
};
const bigOf = g => g.action().options.find(o => o.big) || null;
const run = (g, input, s, dt = 1 / 30) => { for (let t = 0; t < s; t += dt) g.update(input, dt); };
let used = 0;
const stone = () => ({ ...stones[used++ % 60 + 3] });
const press = (g, input) => { const o = bigOf(g); expect(o).not.toBeNull(); g.act(o); run(g, input, PIECE_TIME + 0.5); for (let i = 0; i < 20 && g.player.work; i++) run(g, input, PIECE_TIME); return o; };
const fresh = () => ({ g: createGame(w, spawn, { sleep: { awake: 0.1 } }), input: makeInput({ yaw: 0.8 }) });

describe('the order of a home (game/leanto, pure)', () => {
  it('the ring first (6 stones), then the lean-to, then the upgrades; the hut needs all of them', () => {
    expect(PARTS.ring).toEqual(Array(6).fill('stone'));
    const lt = createLeantos(w), l = lt.start(0, 0, 0);
    expect(stageOf(l)).toBe('ring'); expect(lt.build(l)).toBeNull(); expect(lt.build(l, 'walls')).toBeNull();
    for (let k = 0; k < 6; k++) { expect(ringDone(l)).toBe(false); expect(lt.build(l, 'ring')).toBe('stone'); }
    expect(ringDone(l)).toBe(true); expect(stageOf(l)).toBe('leanto'); expect(lt.build(l, 'ring')).toBeNull(); expect(lt.build(l, 'walls')).toBeNull();
    for (let k = 0; k < 15; k++) lt.build(l);
    expect(stageOf(l)).toBeNull(); expect(lt.build(l, 'walls')).toBe('frond');
    expect(hutReady({ progress: 1, up: { walls: 1, bed: 1 } })).toBe(false); expect(hutReady({ progress: 1, up: { walls: 1, bed: 1, ring: 1 } })).toBe(true);
  });
  it('a finished ring holds the fire before its lean-to is built: the ring, and no other fire within 8 m', () => {
    const lt = createLeantos(w, { list: [{ id: 0, x: 0, z: 0, heading: 0, progress: 0, up: { ring: 5 / 6 } }], nextId: 1 }), l = lt.list[0], c = ringCentre(l);
    expect(lt.ring(c.x, c.z)).toBe(false); expect(lt.noFire(c.x + 3, c.z)).toBe(false);
    lt.build(l, 'ring');
    expect(lt.ring(c.x, c.z)).toBe(true); expect(lt.noFire(c.x + 3, c.z)).toBe(true); expect(lt.noFire(c.x, c.z)).toBe(false);
    expect(lt.ringMiddle(c.x + 0.3, c.z)).toEqual(c);
  });
});

describe('building a home (game/game)', () => {
  it('a stone starts it and driftwood does not; the stones go in from beside the ring, then the driftwood behind it', () => {
    const { g, input } = fresh();
    g.wood.carried.push({ ...drift[5] }); expect(bigOf(g) && bigOf(g).kind).not.toBe('buildHere');
    g.wood.carried.length = 0; g.wood.stones.push(stone());
    const o = bigOf(g); expect(o).toMatchObject({ kind: 'buildHere', what: 'ring', piece: 'stone' });
    expect(Math.hypot(o.x - ringCentre(o.site).x, o.z - ringCentre(o.site).z)).toBeLessThan(1e-9);   // the offer is at the ring's middle
    const px = g.player.x, pz = g.player.z; press(g, input);
    const l = g.leantos.list[0], c = ringCentre(l), st = standFor(l);
    expect(st.x).toBeCloseTo(px, 5); expect(st.z).toBeCloseTo(pz, 5);   // the lean-to's place is fixed at once: its middle a step behind him
    expect(Math.hypot(c.x - px, c.z - pz)).toBeLessThan(RING_REACH); expect(stageOf(l)).toBe('ring');
    g.wood.carried.push({ ...drift[6] }); expect(bigOf(g)).toBeNull();   // no driftwood into the lean-to before the ring is finished
    g.wood.carried.length = 0;
    for (let k = 1; k < 6; k += 2) { g.wood.stones.push(stone(), ...(k + 1 < 6 ? [stone()] : [])); expect(bigOf(g)).toMatchObject({ kind: 'buildIn', what: 'ring' }); press(g, input); }
    expect(ringDone(l)).toBe(true); expect(g.wood.stones.length).toBe(0); expect(l.progress).toBe(0);
    g.wood.stones.push(stone()); expect(bigOf(g)).toBeNull(); g.wood.stones.length = 0;   // the ring is done: a stone fits nowhere
    g.wood.carried.push({ ...drift[7] }); expect(bigOf(g)).toMatchObject({ kind: 'buildIn', what: 'leanto', piece: 'driftwood' });
    press(g, input); expect(l.progress).toBeCloseTo(1 / 15, 9);
  });
  it('a fire in the finished ring burns longer before the lean-to stands', () => {
    const lt = { id: 0, x: spawn.x, z: spawn.z, heading: 0.4, progress: 0, up: { ring: 1 } }, c = ringCentre(lt), far = { x: c.x + 20, z: c.z };
    const g = createGame(w, spawn, { leantos: { list: [lt], nextId: 1 } });
    g.fire.fires.push({ id: 1, x: c.x, z: c.z, fuel: BURN, embers: 0.5, lit: g.clock.total, fed: 1 }, { id: 2, x: far.x, z: far.z, fuel: BURN, embers: 0.5, lit: g.clock.total, fed: 1 });
    g.fire.update(BURN / 2, null, null, g.clock.total, g.leantos.ring);
    expect(g.fire.fires[0].fuel).toBeCloseTo(BURN - BURN / 2 / RING_BURN, 6); expect(g.fire.fires[1].fuel).toBeCloseTo(BURN / 2, 6);
  });
});

describe('the request', () => {
  const actorGame = () => { const g = createGame(w, spawn, { sleep: { awake: 0.1 } }); walkFirstDay(w, g, spawn); g.known.visit(spawn.x, spawn.z); return g; };
  it('a begun home says how many stones its ring has and what it and the lean-to still need; an empty finished ring says what makes a fire in it', () => {
    const g = actorGame(), a = createActor(w, g, { chooser: () => null });
    g.leantos.list.push({ id: 0, x: g.player.x + 3, z: g.player.z, heading: 0, progress: 0, up: { ring: 2 / 6 } }); g.leantos.version++;
    let l = a.menu().places.find(q => q.kind === 'leanto');
    expect(l.what).toBe('his home, begun: its stone ring has 2 of 6 stones; it still needs 4 stones, then the lean-to behind it (4 pieces of driftwood, then 6 branches, then 5 fronds)');
    g.leantos.list[0].up.ring = 1; g.leantos.version++; a.step(0.1);   // (the menu is read again at the next step)
    l = a.menu().places.find(q => q.kind === 'leanto');
    expect(l.what).toMatch(/^his lean-to \(its stone ring is finished, the lean-to not begun\): 0 of 15 parts; it still needs 4 pieces of driftwood, then 6 branches, then 5 fronds; its stone ring is empty/);
    expect(l.what).toContain(`${FIRE_MIN} pieces of dry driftwood or branches there, then "light", make a fire in it`);
  });
  it('a refused "buildHere" without a stone says the home begins with its ring', () => {
    const g = actorGame(), asks = []; let n = 0;
    const a = createActor(w, g, { chooser: (m, ask) => { asks.push(ask); return n++ ? null : [{ do: 'buildHere' }]; } });
    for (let i = 0; i < 200; i++) { a.step(0.1); g.update(a.input, 0.1); }
    expect(asks[1].why).toBe('failed'); expect(asks[1].last.reason).toMatch(/needs a stone in his hands to start a home: its stone ring comes first/);
  });
  it('the rules: a home begins with its ring, a fire needs no ring; the home line is in building order; the actions say it', () => {
    const f = actFixed('');
    expect(f).toContain('It begins with its stone ring for the fire ("buildHere" starts a NEW home with a stone in his hands');
    expect(f).toContain('A fire needs no ring: it is made anywhere else just as well');
    expect(f).toContain('Before a home is begun only a stone for its ring is needed.');
    expect(f).not.toMatch(/a stone ring for the fire \(8 stones\)/);
    expect(stateText({ day: 1, time: 0.4, home: { ring: 50, leanto: 0, walls: 0, bed: 0, hut: 0 }, carries: {} })).toContain('Home: stone ring 50%, lean-to 0%, walls 0%, bed 0%, hut 0%.');
    expect(stateText({ day: 1, time: 0.4, home: null, carries: {} })).toContain('Home: no home yet.');
    expect(DO.buildHere.what).toMatch(/with a stone he carries: its stone ring comes first/); expect(DO.upgrade.what).toMatch(/\(walls, bed, hut\)/);
  });
});

describe('0.43.2 "One fire": in the ring all the firewood is one fire', () => {
  const ringScene = () => {
    const lt = { id: 0, x: spawn.x, z: spawn.z, heading: 0.4, progress: 1, up: { ring: 1 } }, c = ringCentre(lt);
    const g = createGame(w, spawn, { sleep: { awake: 0.1 }, leantos: { list: [lt], nextId: 1 } });
    const side = { x: c.x + Math.cos(0.4) * 0.85, z: c.z - Math.sin(0.4) * 0.85 };   // across the ring, 0.85 m from its middle (within RING_R)
    g.wood.piles.push({ x: c.x, z: c.z, kind: 'driftwood', logs: [{ ...drift[8] }] }, { x: side.x, z: side.z, kind: 'branch', logs: [0, 1, 2].map(i => ({ ...branches[10 + i] })) });
    g.wood.version++;
    return { g, c, side };
  };
  it('one driftwood and three branches in the ring are enough; the fire burns in the middle and takes both piles', () => {
    const { g, c, side } = ringScene();
    g.player.x = side.x + 0.9; g.player.z = side.z; g.player.y = w.H(g.player.x, g.player.z);
    g.fire.torch = { left: 0.1 };   // the torch lights a dry pile at once (no chance as with the drill)
    const o = g.action().options.find(x => x.kind === 'light'); expect(o).toBeTruthy();
    g.act(o); run(g, makeInput(), 6);
    expect(g.fire.fires.length).toBe(1); expect(g.wood.piles.length).toBe(0);
    expect(g.fire.fires[0].x).toBeCloseTo(c.x, 6); expect(g.fire.fires[0].z).toBeCloseTo(c.z, 6); expect(g.fire.fires[0].fed).toBe(4);
  });
  it('outside a ring a pile is a fire of its own: three branches are not enough', () => {
    const g = createGame(w, spawn, { sleep: { awake: 0.1 } });
    g.wood.piles.push({ x: spawn.x + 0.9, z: spawn.z, kind: 'branch', logs: [0, 1, 2].map(i => ({ ...branches[20 + i] })) }); g.wood.version++;
    g.fire.torch = { left: 0.1 };
    expect(g.action().options.find(x => x.kind === 'light')).toBeFalsy();
  });
  it('the menu counts the firewood of the whole ring', () => {
    const { g } = ringScene(); walkFirstDay(w, g, spawn); g.known.visit(spawn.x, spawn.z);
    const m = createActor(w, g, { chooser: () => null }).menu(), piles = m.places.filter(q => q.kind === 'pile');
    expect(piles.length).toBe(2);
    for (const q of piles) { expect(q.inRing).toBe(true); expect(q.fuel).toBe(4); expect(q.what).toMatch(/all the firewood in the ring counts together: 4 pieces\): ready to light/); }
    expect(m.places.find(q => q.kind === 'leanto').what).toMatch(/its stone ring holds his piles pile\d and pile\d \(4 pieces of firewood, ready to light\)/);
  });
  it('the words: buildIn no longer names the ring, and the fire rule says the firewood in the ring counts together', () => {
    expect(DO.buildIn.what).not.toMatch(/stone ring/); expect(DO.buildIn.what).toMatch(/firewood is not built in: it is laid down in the ring/);
    expect(actFixed('')).toContain('all of it counts together');
  });
});
