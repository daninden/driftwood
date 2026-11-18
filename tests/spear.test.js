// 0.30.17 "Spear": the spear he makes (a branch in his arms, a stone beside him, 10 s), holds like a torch (no wood with it), lays down and takes up again; fishing with it in shallow sea water (3 s a try, about one in
// three, at most two fish carried, fixed by the seed and the number of tries); the fish roasted at a fire like a crab and spoiling like one; the save; the icons and the row; and Dave: he fetches the spear that lies at the
// camp to fish, fishes when hungry with the fish as the cheapest food, lays the spear back at the camp afterwards, makes a spear once, and fishes now and then on a calm afternoon. Each test fails without its part.
// Depends on: game/game, game/spear, game/fish, save, render/carryMark, tests/helpers/scene.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { createSpear, MAKE_TIME } from '../src/game/spear.js';
import { createFish, fishableAt, FISH_TIME, FISH_CHANCE, FISH_TOP, CARRY_FISH, FISH_FOOD, FISH_DEPTH } from '../src/game/fish.js';
import { ROAST_TIME, SPOIL_AFTER, CRAB_FOOD } from '../src/game/crabs.js';
import { stonesOfTile } from '../src/game/stones.js';
import { branchesOfTile } from '../src/game/branches.js';
import { terrainAt, canStand } from '../src/game/movement.js';
import { gapFree, CAMP_GAP } from '../src/game/obstacles.js';
import { createPath } from '../src/game/path.js';
import { BURN, EMBERS } from '../src/game/fire.js';
import { serialise, parseSave, momentKey } from '../src/save.js';
import { carryItems, carryState, DRAWINGS, ITEMS, isUsable } from '../src/render/carryMark.js';
import { campGame } from './helpers/scene.js';

let w, spawn, stone, shallow, deep, calmSpot;
beforeAll(async () => {
  w = await generateWorld(1337); spawn = startSpot(w);
  const g0 = createGame(w, spawn, { time: 0.3, day: 1 }), sea = g0.sea;
  const dry = (x, z) => { const t = terrainAt(w, x, z, sea); return canStand(w, x, z, sea) && !t.inRiver && t.y > sea + 0.5 && t.s < 0.3 && t.depth === 0; };
  // a loose stone on open dry ground near the start (and room beside it)
  stone = w.tiles.flatMap(t => stonesOfTile(w, t)).filter(s => Math.hypot(s.x - spawn.x, s.z - spawn.z) < 80 && [[0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]].every(([dx, dz]) => dry(s.x + dx, s.z + dz))).sort((a, b) => Math.hypot(a.x - spawn.x, a.z - spawn.z) - Math.hypot(b.x - spawn.x, b.z - spawn.z))[0];
  for (let r = 2; r < 120 && !(shallow && deep); r++) for (let i = 0; i < 72 && !(shallow && deep); i++) {
    const a = i * Math.PI / 36, x = spawn.x + Math.sin(a) * r, z = spawn.z + Math.cos(a) * r, t = terrainAt(w, x, z, sea);
    if (!shallow && fishableAt(t) && canStand(w, x, z, sea)) shallow = { x, z };
    if (!deep && !t.inRiver && t.depth > FISH_DEPTH[1] + 0.05 && t.depth < 0.55 && canStand(w, x, z, sea)) deep = { x, z };
  }
  calmSpot = spawn;
}, 120000);

const makeInput = (o = {}) => {
  const i = { up: false, down: false, left: false, right: false, run: false, target: null, action: null, hold: null, sleep: false, ...o };
  i.clearTarget = () => { i.target = null; };
  i.takeAction = () => { const a = i.action; i.action = null; return a; };
  i.takeLight = () => { const h = i.hold; i.hold = null; return h; };
  i.takeSleep = () => { const s = i.sleep; i.sleep = false; return s; };
  i.pressing = () => false;
  return i;
};
const run = (g, input, s, dt = 1 / 30) => { for (let t = 0; t < s - 1e-9; t += dt) g.update(input, dt); };
const put = (g, x, z) => { g.player.x = x; g.player.z = z; g.player.y = w.H(x, z); };
const branch = (g, i = 0) => { const b = g.branches.groundBranches(w.tiles.find(t => g.branches.groundBranches(t).length)).slice(i)[0]; return b; };
const kinds = g => { const a = g.action(); return [a.tap, ...a.options].filter(Boolean).map(o => o.kind); };
const fireAt = (x, z, fuel = 4 * BURN) => ({ id: 0, x, z, fuel, embers: EMBERS, lit: 0, fed: 4 });

// a game on open dry ground beside the stone, with one branch under his arm
function stoneScene(opts = {}) {
  expect(stone, 'a stone to stand beside').toBeTruthy();
  const g = createGame(w, { x: stone.x + 0.3, z: stone.z, y: w.H(stone.x + 0.3, stone.z) }, { time: 0.3, day: 1, sleep: { awake: 0.2 }, ...opts });
  const b = branch(g); g.wood.take({ kind: 'log', log: b }, g.clock.total);
  return { g, b };
}

describe('making a spear', () => {
  it('is offered with a branch in his arms beside a stone, in the arc and not as the main action, with its own icon', () => {
    expect(MAKE_TIME).toBe(10);
    const { g } = stoneScene();
    expect(g.wood.carried.length).toBe(1);
    const a = g.action();
    expect(a.options.map(o => o.kind)).toContain('makeSpear');
    expect(a.tap && a.tap.kind).not.toBe('makeSpear');   // the ring still lays the branch down (or picks the stone up)
  });
  it('is not offered without the branch, away from a stone, in the water or when a spear exists; with other wood too it is (0.37.6), the rest laid down first', () => {
    const none = createGame(w, { x: stone.x + 0.3, z: stone.z, y: w.H(stone.x + 0.3, stone.z) }, { time: 0.3, day: 1 });
    expect(kinds(none)).not.toContain('makeSpear');                                                    // no branch
    const { g } = stoneScene();
    g.wood.carried.push({ id: 800001, x: g.player.x, y: g.player.y, z: g.player.z, len: 1.4, a: 0.3, rad: 0.1 });   // a piece of driftwood too
    expect(kinds(g)).toContain('makeSpear');
    g.act({ kind: 'makeSpear' }); run(g, makeInput(), 0.5);
    expect(g.player.work && g.player.work.kind).toBe('make'); expect(g.wood.carried.length).toBe(1); expect(g.wood.carried[0].branch).toBe(true);   // the driftwood lies on a pile
    const drift = stoneScene().g; drift.wood.carried.length = 0; drift.wood.carried.push({ id: 800002, x: 0, y: 0, z: 0, len: 1.4, a: 0.3, rad: 0.1 });   // driftwood, not a branch
    expect(kinds(drift)).not.toContain('makeSpear');
    const far = stoneScene().g; put(far, stone.x + 4, stone.z + 1.5);
    expect(kinds(far)).not.toContain('makeSpear');                                                    // not beside a stone
    const wet = stoneScene().g; put(wet, shallow.x, shallow.z);
    expect(kinds(wet)).not.toContain('makeSpear');                                                    // in the water
    const has = stoneScene({ spear: { hand: false, at: { x: stone.x + 9, z: stone.z } } }).g;
    expect(kinds(has)).not.toContain('makeSpear');                                                    // one spear is all there is
  });
  it('kneels 10 seconds, uses the branch up, keeps the stone, and the spear is in his hand', () => {
    const { g } = stoneScene(), stones0 = g.stones.near(stone.x, stone.z, 1).length;
    g.act({ kind: 'makeSpear' }); run(g, makeInput(), 0.2);
    expect(g.player.work && g.player.work.kind).toBe('make');
    run(g, makeInput(), 9.3); expect(g.spear.hand).toBe(false); expect(g.player.work && g.player.work.kind).toBe('make');
    run(g, makeInput(), 1);
    expect(g.player.work).toBeNull(); expect(g.spear.hand).toBe(true); expect(g.player.spear).toBe(true);
    expect(g.wood.carried.length).toBe(0);                                          // the branch is used up
    expect(g.stones.near(stone.x, stone.z, 1).length).toBe(stones0);                // the stone stays where it lay
    expect(kinds(g)).not.toContain('makeSpear');
  });
  it('is stopped by walking off: no spear, the branch stays under his arm', () => {
    const { g } = stoneScene();
    g.act({ kind: 'makeSpear' }); run(g, makeInput(), 3);
    run(g, makeInput({ right: true }), 0.3);
    expect(g.player.work).toBeNull(); expect(g.spear.hand).toBe(false); expect(g.wood.carried.length).toBe(1);
  });
  it('works beside a pile of stones too', () => {
    const { g } = stoneScene();
    put(g, stone.x + 2.2, stone.z);   // out of reach of the loose stone
    g.wood.piles.push({ x: g.player.x + 0.9, z: g.player.z, kind: 'stone', logs: [{ ...stone, id: 810001 }, { ...stone, id: 810002 }] });
    expect(g.wood.findAll(g.player.x, g.player.z, 0.55, 'log').some(c => c.log.stone)).toBe(false);
    expect(kinds(g)).toContain('makeSpear');
  });
});

describe('the spear in his hand', () => {
  const armed = (extra = {}) => createGame(w, { x: stone.x + 0.3, z: stone.z, y: w.H(stone.x + 0.3, stone.z) }, { time: 0.3, day: 1, sleep: { awake: 0.2 }, spear: { hand: true, at: null }, ...extra });
  it('fills one hand (0.37.6 "Free hands"): wood under the other arm, no stone, and a torch only with no wood', () => {
    const g = armed();
    g.wood.piles.push({ x: g.player.x + 1.0, z: g.player.z, kind: 'driftwood', logs: [{ id: 820001, x: 0, y: 0, z: 0, len: 1.4, a: 0.3, rad: 0.1 }] });
    expect(g.wood.find(g.player.x, g.player.z, 1.2, 'pile')).toBeTruthy();
    expect(g.actions().filter(a => a.kind === 'pickup').every(a => a.thing.kind === 'pile')).toBe(true);
    expect(kinds(g)).toContain('pickup');                                              // the pile of driftwood
    expect(g.wood.find(g.player.x, g.player.z, 0.55, 'log')).toBeTruthy();           // the stone is right there, and is not offered
    g.act(g.actions().find(a => a.kind === 'pickup')); run(g, makeInput(), 0.7); expect(g.wood.carried.length).toBe(1); expect(g.wood.stones.length).toBe(0); expect(g.spear.hand).toBe(true);
    const t = createGame(w, { x: spawn.x, z: spawn.z, y: w.H(spawn.x, spawn.z) }, { time: 0.3, day: 1, spear: { hand: true, at: null }, fire: { fires: [fireAt(spawn.x + 0.5, spawn.z)], burnt: [], torch: null, torches: [], attempts: 0, nextId: 3 } });
    expect(kinds(t)).toContain('torch');                                               // the other hand is free for a torch
    t.wood.carried.push({ id: 820002, x: 0, y: 0, z: 0, len: 1.4, a: 0.3, rad: 0.1 }); expect(kinds(t)).not.toContain('torch');   // not with wood under the arm too
  });
  it('can be laid down with the action button, at his feet, and taken up again from within reach', () => {
    const g = armed(), x = g.player.x, z = g.player.z;
    expect(g.action().tap.kind).toMatch(/laySpear|pickup/);
    expect(kinds(g)).toContain('laySpear');
    g.act({ kind: 'laySpear' }); run(g, makeInput(), 1);
    expect(g.spear.hand).toBe(false); expect(g.player.spear).toBe(false);
    expect(g.spear.at.x).toBeCloseTo(x, 3); expect(g.spear.at.z).toBeCloseTo(z, 3);
    expect(kinds(g)).toContain('takeSpear'); expect(g.action().tap.kind).toBe('takeSpear');   // lying at his feet: the ring takes it up
    expect(kinds(g)).toContain('pickup');                                                      // and his hands are free for wood again
    put(g, x + 2, z); expect(kinds(g)).not.toContain('takeSpear');                             // out of reach
    put(g, x + 0.4, z);
    expect(kinds(g)).toContain('takeSpear');
    g.act(g.actions().find(o => o.kind === 'takeSpear')); run(g, makeInput(), 1);
    expect(g.spear.hand).toBe(true); expect(g.spear.at).toBeNull();
  });
  it('is not laid down in the water, and is laid beside him when he lies down to sleep', () => {
    const g = armed(); put(g, shallow.x, shallow.z);
    expect(kinds(g)).not.toContain('laySpear');
    const s = armed({ sleep: { awake: 1.2 }, time: 0.9 });
    s.act({ kind: 'sleep' }); run(s, makeInput(), 2);
    expect(s.spear.hand).toBe(false); expect(s.spear.at).toBeTruthy();
  });
  it('keeps a new pile away from the spear that lies on the ground', () => {
    const g = createGame(w, { x: spawn.x + 6, z: spawn.z, y: w.H(spawn.x + 6, spawn.z) }, { time: 0.3, day: 1 });
    put(g, spawn.x + 6, spawn.z); g.spear.at = { x: g.player.x + Math.sin(g.player.heading) * 0.45, z: g.player.z + Math.cos(g.player.heading) * 0.45 };   // where the first pile would go
    g.wood.carried.push({ id: 830001, x: 0, y: 0, z: 0, len: 1.4, a: 0.3, rad: 0.1 });
    g.act({ kind: 'lay' }); run(g, makeInput(), 1);
    expect(g.wood.piles.length).toBe(1);
    expect(Math.hypot(g.wood.piles[0].x - g.spear.at.x, g.wood.piles[0].z - g.spear.at.z)).toBeGreaterThan(1.1);
  });
});

describe('the spear state', () => {
  it('is one spear, in his hand or lying, never both and never two', () => {
    const s = createSpear();
    expect(s.has()).toBe(false); expect(s.take()).toBe(false); expect(s.lay(1, 2)).toBe(false);
    expect(s.make()).toBe(true); expect(s.make()).toBe(false); expect(s.hand).toBe(true);
    expect(s.lay(1, 2)).toBe(true); expect(s.at).toEqual({ x: 1, z: 2 }); expect(s.make()).toBe(false); expect(s.take()).toBe(true); expect(s.take()).toBe(false);
    expect(createSpear({ hand: true, at: { x: 1, z: 1 } }).at).toBeNull();
    expect(createSpear({ hand: 'x', at: { x: 'a', z: 1 } }).has()).toBe(false); expect(createSpear(null).has()).toBe(false);
  });
});

describe('fishing', () => {
  const fisher = (extra = {}) => { const g = createGame(w, { x: shallow.x, z: shallow.z, y: w.H(shallow.x, shallow.z) }, { time: 0.3, day: 1, sleep: { awake: 0.2 }, spear: { hand: true, at: null }, ...extra }); return g; };
  it('is offered only in shallow sea water with the spear in his hand, as the ring', () => {
    expect(shallow && deep).toBeTruthy();
    const g = fisher();
    expect(fishableAt(terrainAt(w, g.player.x, g.player.z, g.sea))).toBe(true);
    expect(g.action().tap).toMatchObject({ kind: 'fish' });
    const noSpear = fisher({ spear: { hand: false, at: null } }); expect(kinds(noSpear)).not.toContain('fish');
    const lying = fisher({ spear: { hand: false, at: { x: shallow.x, z: shallow.z } } }); expect(kinds(lying)).not.toContain('fish');
    const d = fisher(); put(d, deep.x, deep.z); expect(kinds(d)).not.toContain('fish');                      // too deep
    const dry = fisher(); put(dry, stone.x + 0.3, stone.z); expect(kinds(dry)).not.toContain('fish');        // on the land
    const full = fisher({ fish: { carried: [0.2, 0.25], tries: 0 } }); expect(kinds(full)).not.toContain('fish');   // two fish are all he carries
  });
  it('is not offered in a river', () => {
    const t = { inRiver: true, depth: 0.2 }; expect(fishableAt(t)).toBe(false);
    expect(fishableAt({ inRiver: false, depth: 0.2 })).toBe(true); expect(fishableAt({ inRiver: false, depth: 0 })).toBe(false); expect(fishableAt({ inRiver: false, depth: FISH_DEPTH[1] + 0.01 })).toBe(false);
    expect(fishableAt(null)).toBe(false);
  });
  it('takes 3 seconds a try, stands still, and a try that fails counts too', () => {
    expect(FISH_TIME).toBe(3);
    const g = fisher(), t0 = g.fish.tries;
    g.act({ kind: 'fish' }); run(g, makeInput(), 0.2);
    expect(g.player.work && g.player.work.kind).toBe('fish');
    run(g, makeInput(), 2.5); expect(g.player.work && g.player.work.kind).toBe('fish'); expect(g.fish.tries).toBe(t0);
    run(g, makeInput(), 0.6);
    expect(g.player.work).toBeNull(); expect(g.fish.tries).toBe(t0 + 1);
    const g2 = fisher(); g2.act({ kind: 'fish' }); run(g2, makeInput(), 1); run(g2, makeInput({ left: true }), 0.2);
    expect(g2.fish.tries).toBe(0);   // walking off stops it
  });
  it('gets better with practice: 0.45 for a beginner, never past FISH_TOP, the rolls stay fixed', () => {
    expect(FISH_TOP).toBeCloseTo(0.75);
    let first = 0, late = 0; for (let s = 1; s <= 600; s++) { first += createFish(s).fishTry(0) ? 1 : 0; late += createFish(s, { carried: [], tries: 60 }).fishTry(0) ? 1 : 0; }
    expect(first / 600).toBeGreaterThan(FISH_CHANCE - 0.08); expect(first / 600).toBeLessThan(FISH_CHANCE + 0.08);
    expect(late / 600).toBeGreaterThan(FISH_TOP - 0.08); expect(late / 600).toBeLessThan(FISH_TOP + 0.05);
    const run = () => { const f = createFish(1337), r = []; for (let i = 0; i < 50; i++) { r.push(f.fishTry(0)); f.carried.length = 0; } return r; };
    expect(run()).toEqual(run());
  });
  it('catches about 45 tries in a hundred at the start, fixed by the seed and the number of tries', () => {
    expect(FISH_CHANCE).toBeCloseTo(0.45);
    const outcome = seed => { const f = createFish(seed), r = []; for (let i = 0; i < 600; i++) { r.push(f.fishTry(0)); f.carried.length = 0; } return r; };
    const a = outcome(1337), b = outcome(1337), o = outcome(7);
    expect(a).toEqual(b); expect(o).not.toEqual(a);
    const n = a.filter(Boolean).length; expect(n).toBeGreaterThan(600 * FISH_CHANCE); expect(n).toBeLessThan(600 * FISH_TOP + 30);   // 0.30.21: rises from FISH_CHANCE to FISH_TOP
    const x = createFish(1337), y = createFish(1337, { carried: [], tries: 0 });
    for (let i = 0; i < 20; i++) { expect(x.fishTry(i)).toBe(y.fishTry(i)); x.carried.length = 0; y.carried.length = 0; }
  });
  it('carries at most two fish and never catches a third; the try still counts', () => {
    expect(CARRY_FISH).toBe(2);
    const f = createFish(1337); let n = 0; while (f.carried.length < CARRY_FISH && n++ < 200) f.fishTry(0);
    expect(f.carried.length).toBe(2); expect(f.full()).toBe(true);
    const tries = f.tries; for (let i = 0; i < 60; i++) expect(f.fishTry(0)).toBe(false);
    expect(f.carried.length).toBe(2); expect(f.tries).toBe(tries + 60);
  });
  it('brings a fish into the row in a game: the try that the seed says is a catch', () => {
    let tries = 0; { const probe = createFish(w.seed, { carried: [], tries: 0 }); while (!probe.fishTry(0)) tries++; }   // the first catch comes at this try
    const g = fisher({ fish: { carried: [], tries } });
    g.act({ kind: 'fish' }); run(g, makeInput(), 3.3);
    expect(g.fish.carried.length).toBe(1); expect(g.fish.carried[0]).toBeCloseTo(g.clock.total, 1);
    expect(carryState(g).fish).toBe(1);
  });
  it('makes bad saved data harmless', () => {
    const f = createFish(1, { carried: ['x', 1, 2, 3], tries: -4 });
    expect(f.carried).toEqual([1, 2]); expect(f.tries).toBe(0); expect(createFish(1, null).carried).toEqual([]);
  });
});

describe('the fish roasted and eaten, and gone bad', () => {
  const E = () => ({ x: spawn.x, z: spawn.z });
  const fireScene = ({ fish = [0.3], crabs = [], hunger = 2, flames = true } = {}) => createGame(w, { x: E().x, z: E().z, y: w.H(E().x, E().z) }, {
    time: 0.3, sleep: { awake: 1 }, hunger: { days: hunger }, fish: { carried: fish, tries: 0 }, crabs: { carried: crabs, gone: [], digs: 0 },
    fire: { fires: flames ? [fireAt(E().x + 1, E().z)] : [], burnt: [], torch: null, torches: [], attempts: 0, nextId: 5 },
  });
  it('is roasted at a fire with flames: 8 seconds of kneeling, a meal like a crab', () => {
    expect(ROAST_TIME).toBe(8); expect(FISH_FOOD).toBe(CRAB_FOOD); expect(FISH_FOOD).toBe(0.5);
    const g = fireScene();
    const o = g.action().tap; expect(o).toMatchObject({ kind: 'roast', food: 'fish' });
    g.act(o); run(g, makeInput(), 0.2); expect(g.player.work && g.player.work.kind).toBe('roast');
    run(g, makeInput(), 7); expect(g.fish.carried.length).toBe(1); run(g, makeInput(), 1.2);
    expect(g.fish.carried.length).toBe(0);
    expect(g.hunger.days).toBeLessThan(1.6); expect(g.hunger.days).toBeGreaterThan(1.4);
  });
  it('is never eaten raw: no fire, a fire without flames (embers) and no roast offered', () => {
    expect(kinds(fireScene({ flames: false }))).not.toContain('roast');
    const g = fireScene(); g.fire.fires[0].fuel = 0; expect(kinds(g)).not.toContain('roast');
  });
  it('is eaten from the row too, and the oldest of a crab and a fish goes first', () => {
    const g = fireScene({ fish: [0.2], crabs: [0.25] });
    expect(g.action().tap).toMatchObject({ kind: 'roast', food: 'fish' });                         // the fish is older
    const h = fireScene({ fish: [0.3], crabs: [0.25] });
    expect(h.action().tap).toMatchObject({ kind: 'roast', food: 'crab' });
    const u = fireScene(); expect(u.use('fish')).toBe(true); run(u, makeInput(), 8.5); expect(u.fish.carried.length).toBe(0); expect(u.hunger.days).toBeLessThan(1.6);
    const none = fireScene({ flames: false }); expect(none.use('fish')).toBe(false);
    const c = fireScene({ fish: [], crabs: [0.3] }); expect(c.use('fish')).toBe(false); expect(c.use('crab')).toBe(true);
  });
  it('goes bad after one day like a crab, and is usable in the row', () => {
    const f = createFish(1337, { carried: [0.2, 0.5], tries: 0 });
    f.update(0.2 + SPOIL_AFTER - 0.01); expect(f.carried).toEqual([0.2, 0.5]);
    f.update(0.2 + SPOIL_AFTER + 0.01); expect(f.carried).toEqual([0.5]);
    expect(f.eat()).toBe(true); expect(f.eat()).toBe(false);
    const stale = createGame(w, spawn, { time: 0.5, day: 1, fish: { carried: [0.4], tries: 0 } });   // caught on day 0 at 0.4, now day 1 at 0.5: more than a day
    run(stale, makeInput(), 0.2); expect(stale.fish.carried.length).toBe(0);
    const fresh = createGame(w, spawn, { time: 0.5, day: 1, fish: { carried: [1.4], tries: 0 } });
    run(fresh, makeInput(), 0.2); expect(fresh.fish.carried.length).toBe(1);
  });
});

describe('the row and the save', () => {
  it('draws a fish for each fish carried, after the crabs, and it can be clicked', () => {
    expect(ITEMS.indexOf('fish')).toBe(ITEMS.indexOf('crab') + 1); expect(DRAWINGS.fish).toBeTruthy();
    expect(carryItems({ crab: 1, fish: 2 })).toEqual(['crab', 'fish', 'fish']); expect(isUsable('fish')).toBe(true);
  });
  it('keeps the spear (in his hand, or lying where it lies) and the fish through a save', () => {
    for (const spear of [{ hand: true, at: null }, { hand: false, at: { x: 12.5, z: -3.25 } }, { hand: false, at: null }]) {
      const g = createGame(w, spawn, { time: 0.3, day: 1, spear, fish: { carried: [0.7, 0.9], tries: 17 } });
      const text = serialise({ ...g.state(), name: '', startDay: 0 }), parsed = parseSave(text, w.seed);
      expect(parsed, 'the save is readable').toBeTruthy();
      const h = createGame(w, spawn, parsed);
      expect(h.spear.state()).toEqual(spear); expect(h.fish.carried).toEqual([0.7, 0.9]); expect(h.fish.tries).toBe(17);
      expect(h.player.spear).toBe(spear.hand);
    }
  });
  it('still loads an older save without them, and refuses a broken one', () => {
    const g = createGame(w, spawn, { time: 0.3, day: 1 }), st = g.state();
    const old = { ...st }; delete old.spear; delete old.fish;
    const parsed = parseSave(serialise(old), w.seed); expect(parsed).toBeTruthy();
    const h = createGame(w, spawn, parsed); expect(h.spear.has()).toBe(false); expect(h.fish.carried).toEqual([]);
    expect(parseSave(serialise({ ...st, spear: { hand: 'yes' } }), w.seed)).toBeNull();
    expect(parseSave(serialise({ ...st, spear: { hand: false, at: { x: 'a', z: 1 } } }), w.seed)).toBeNull();
    expect(parseSave(serialise({ ...st, fish: { carried: [1, 2, 3], tries: 0 } }), w.seed)).toBeNull();
  });
  it('is worth a save when a fish is caught or the spear changes hands', () => {
    const g = createGame(w, spawn, { time: 0.3, day: 1 }), k0 = momentKey(g);
    g.fish.carried.push(0.5); const k1 = momentKey(g); expect(k1).not.toBe(k0);
    g.spear.make(); const k2 = momentKey(g); expect(k2).not.toBe(k1);
    g.spear.lay(1, 1); expect(momentKey(g)).not.toBe(k2);
  });
});


// ----- Dave in a scene: a camp at the start, the sea six metres away -----
const noFood = g => { g.fibre.groundCocos = () => []; g.berries.bearingIn = () => []; g.bananas.bearingIn = () => []; g.berries.find = () => null; g.bananas.find = () => null; };
const knowRoute = (g, to) => { const f = createPath(w); const r = f.find(spawn, to); for (const q of (r ? r.pts : [])) g.known.visit(q.x, q.z); for (let dx = -12; dx <= 12; dx += 6) for (let dz = -12; dz <= 12; dz += 6) g.known.visit(to.x + dx, to.z + dz); };
const tickMind = (g, m, secs, until = null) => { let n = 0; for (let t = 0; t < secs; t += 0.1) { m.step(0.1); g.update(m.input, 0.1); n++; if (until && until()) break; } return n; };
const campNow = (g, m) => { const h = m.home(); return Math.hypot(g.spear.at.x - h.x, g.spear.at.z - h.z); };


