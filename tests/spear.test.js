// 0.30.17 "Spear": the spear he makes (a branch in his arms, a stone beside him, 10 s), holds like a torch (no wood with it), lays down and takes up again; fishing with it in shallow sea water (3 s a try, about one in
// three, at most two fish carried, fixed by the seed and the number of tries); the fish roasted at a fire like a crab and spoiling like one; the save; the icons and the row; and Dave: he fetches the spear that lies at the
// camp to fish, fishes when hungry with the fish as the cheapest food, lays the spear back at the camp afterwards, makes a spear once, and fishes now and then on a calm afternoon. Each test fails without its part.
// Depends on: game/game, game/spear, game/fish, game/mind, save, render/actionButton, render/carryMark, tests/helpers/mindCamp.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { createSpear, MAKE_TIME } from '../src/game/spear.js';
import { createFish, fishableAt, FISH_TIME, FISH_CHANCE, CARRY_FISH, FISH_FOOD, FISH_DEPTH } from '../src/game/fish.js';
import { ROAST_TIME, SPOIL_AFTER, CRAB_FOOD } from '../src/game/crabs.js';
import { createMind, fishChance, fishFoodOk, spearMakeOk, chooseGoal, FISH_FROM, FISH_TO, FISH_IDLE_CHANCE, FISH_TRIES, SPEAR_DAY } from '../src/game/mind.js';
import { stonesOfTile } from '../src/game/stones.js';
import { branchesOfTile } from '../src/game/branches.js';
import { terrainAt, canStand } from '../src/game/movement.js';
import { gapFree, CAMP_GAP } from '../src/game/obstacles.js';
import { createPath } from '../src/game/path.js';
import { BURN, EMBERS } from '../src/game/fire.js';
import { serialise, parseSave, momentKey } from '../src/save.js';
import { buttonIcons, ICONS, ICON_OF, LABEL_OF } from '../src/render/actionButton.js';
import { carryItems, carryState, DRAWINGS, ITEMS, isUsable } from '../src/render/carryMark.js';
import { campGame } from './helpers/mindCamp.js';

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
    expect(buttonIcons(a).options.find(o => o.label === 'Make a spear').key).toBe('spear');
    expect(ICONS.spear).toBeTruthy(); expect(LABEL_OF.makeSpear).toBe('Make a spear');
  });
  it('is not offered without the branch, with other wood too, away from a stone, in the water or when a spear exists', () => {
    const none = createGame(w, { x: stone.x + 0.3, z: stone.z, y: w.H(stone.x + 0.3, stone.z) }, { time: 0.3, day: 1 });
    expect(kinds(none)).not.toContain('makeSpear');                                                    // no branch
    const { g } = stoneScene();
    g.wood.carried.push({ id: 800001, x: g.player.x, y: g.player.y, z: g.player.z, len: 1.4, a: 0.3, rad: 0.1 });   // a piece of driftwood too
    expect(kinds(g)).not.toContain('makeSpear');
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
  it('fills his hand like a torch: no wood, no frond, no stone picked up, no torch taken', () => {
    const g = armed();
    g.wood.piles.push({ x: g.player.x + 1.0, z: g.player.z, kind: 'driftwood', logs: [{ id: 820001, x: 0, y: 0, z: 0, len: 1.4, a: 0.3, rad: 0.1 }] });
    expect(g.wood.find(g.player.x, g.player.z, 1.2, 'pile')).toBeTruthy();
    expect(kinds(g)).not.toContain('pickup');
    expect(g.wood.find(g.player.x, g.player.z, 0.55, 'log')).toBeTruthy();           // the stone is right there, and is not offered
    const free = armed({ spear: undefined }); expect(kinds(free)).toContain('pickup');   // without the spear it is
    g.act({ kind: 'pickup' }); run(g, makeInput({ action: 'tap' }), 0.7); expect(g.wood.load()).toBe(0);
    const t = createGame(w, { x: spawn.x, z: spawn.z, y: w.H(spawn.x, spawn.z) }, { time: 0.3, day: 1, spear: { hand: true, at: null }, fire: { fires: [fireAt(spawn.x + 0.5, spawn.z)], burnt: [], torch: null, torches: [], attempts: 0, nextId: 3 } });
    expect(kinds(t)).not.toContain('torch');
  });
  it('can be laid down with the action button, at his feet, and taken up again from within reach', () => {
    const g = armed(), x = g.player.x, z = g.player.z;
    expect(g.action().tap.kind).toMatch(/laySpear|pickup/);
    expect(kinds(g)).toContain('laySpear');
    expect(buttonIcons({ tap: { kind: 'laySpear' }, options: [] }).main).toBe('laySpear');
    g.act({ kind: 'laySpear' }); run(g, makeInput(), 1);
    expect(g.spear.hand).toBe(false); expect(g.player.spear).toBe(false);
    expect(g.spear.at.x).toBeCloseTo(x, 3); expect(g.spear.at.z).toBeCloseTo(z, 3);
    expect(kinds(g)).toContain('takeSpear'); expect(g.action().tap.kind).toBe('takeSpear');   // lying at his feet: the ring takes it up
    expect(kinds(g)).toContain('pickup');                                                      // and his hands are free for wood again
    put(g, x + 2, z); expect(kinds(g)).not.toContain('takeSpear');                             // out of reach
    put(g, x + 0.4, z); expect(buttonIcons(g.action()).main).toBeTruthy();
    expect(kinds(g)).toContain('takeSpear');
    g.act(g.actions().find(o => o.kind === 'takeSpear')); run(g, makeInput(), 1);
    expect(g.spear.hand).toBe(true); expect(g.spear.at).toBeNull();
    expect(ICON_OF.takeSpear).toBe('takeSpear'); expect(ICON_OF.laySpear).toBe('laySpear');
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
    expect(buttonIcons(g.action()).main).toBe('fish'); expect(ICONS.fish).toBeTruthy(); expect(LABEL_OF.fish).toBe('Fish with the spear');
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
  it('catches about 45 tries in a hundred, fixed by the seed and the number of tries', () => {
    expect(FISH_CHANCE).toBeCloseTo(0.45);
    const outcome = seed => { const f = createFish(seed), r = []; for (let i = 0; i < 600; i++) { r.push(f.fishTry(0)); f.carried.length = 0; } return r; };
    const a = outcome(1337), b = outcome(1337), o = outcome(7);
    expect(a).toEqual(b); expect(o).not.toEqual(a);
    const n = a.filter(Boolean).length; expect(n).toBeGreaterThan(600 * FISH_CHANCE - 60); expect(n).toBeLessThan(600 * FISH_CHANCE + 60);
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
    expect(buttonIcons(g.action()).main).toBe('roastFish'); expect(ICONS.roastFish).toBeTruthy(); expect(LABEL_OF.roastFish).toBe('Roast the fish');
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
    expect(buttonIcons(h.action()).main).toBe('roast');
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

describe('Dave and the spear: the pure rules', () => {
  const calm = (o = {}) => ({ time: 0.5, day: 3, last: 2, spear: true, crabs: 0, fish: 0, thirst: 0.1, hunger: 0.1, flames: true, canLight: false, fibre: 0, pileDry: true, crab: false, cool: {}, ...o });
  it('fishes now and then on a calm afternoon, never when something is urgent', () => {
    expect(fishChance(calm())).toBeGreaterThan(0); expect(fishChance(calm())).toBeLessThan(1);
    expect(FISH_IDLE_CHANCE).toBe(0.5); expect(fishChance(calm())).toBe(0.5);   // 0.30.18 "Catch": half the days, was 0.35
    expect(FISH_FROM).toBeLessThan(FISH_TO);
    for (const o of [{ spear: false }, { time: FISH_FROM - 0.01 }, { time: FISH_TO }, { time: 0.9 }, { thirst: 0.3 }, { hunger: 0.35 }, { last: 3 }, { crab: true }, { crabs: 1 }, { fish: 1 }, { cool: { fish: true } }]) expect(fishChance(calm(o)), JSON.stringify(o)).toBe(0);
    expect(fishChance(calm({ flames: false }))).toBeGreaterThan(0);   // the evening fire is lit later: no fire is asked for now
  });
  it('fishes for food only with a spear, flames to roast at, room for a fish and by day', () => {
    const s = { time: 0.45, spear: true, fish: 0, flames: true, cool: {} };
    expect(fishFoodOk(s)).toBe(true);
    for (const o of [{ spear: false }, { fish: 2 }, { flames: false }, { time: 0.1 }, { time: 0.85 }, { cool: { fish: true } }]) expect(fishFoodOk({ ...s, ...o }), JSON.stringify(o)).toBe(false);
  });
  it('makes the spear only when he has none at all, by day, with nothing urgent, and once the home comes first (his lean-to stands, or from day 6)', () => {
    const s = { time: 0.3, day: 7, lean: 'none', spear: false, thirst: 0.1, hunger: 0.1, cool: {} };
    expect(SPEAR_DAY).toBe(6); expect(spearMakeOk(s)).toBe(true);
    expect(spearMakeOk({ ...s, day: 1, lean: 'done' })).toBe(true);                            // the lean-to stands: any day
    for (const o of [{ spear: true }, { time: 0.1 }, { time: 0.7 }, { thirst: 0.3 }, { hunger: 0.31 }, { cool: { spear: true } }, { day: 1 }, { day: 5, lean: 'half' }]) expect(spearMakeOk({ ...s, ...o }), JSON.stringify(o)).toBe(false);
  });
  it('goes to roast a carried fish like a crab: eat from hunger 0.2 when flames burn', () => {
    const s = { time: 0.5, thirst: 0, hunger: 0.25, awake: 0.1, canLie: false, cool: {}, flames: true, stock: 6, spare: 0, fireLit: true, fireFuel: 1, fibre: 0, shellsEmpty: 0, waterNear: false };
    expect(chooseGoal({ ...s, fish: 0, crabs: 0 })).not.toBe('eat');
    expect(chooseGoal({ ...s, fish: 1, crabs: 0 })).toBe('eat');
    expect(chooseGoal({ ...s, fish: 0, crabs: 1 })).toBe('eat');
    expect(chooseGoal({ ...s, fish: 1, flames: false })).not.toBe('eat');
  });
});

// ----- Dave in a scene: a camp at the start, the sea six metres away -----
const noFood = g => { g.fibre.groundCocos = () => []; g.berries.bearingIn = () => []; g.bananas.bearingIn = () => []; g.berries.find = () => null; g.bananas.find = () => null; };
const knowRoute = (g, to) => { const f = createPath(w); const r = f.find(spawn, to); for (const q of (r ? r.pts : [])) g.known.visit(q.x, q.z); for (let dx = -12; dx <= 12; dx += 6) for (let dz = -12; dz <= 12; dz += 6) g.known.visit(to.x + dx, to.z + dz); };
const tickMind = (g, m, secs, until = null) => { let n = 0; for (let t = 0; t < secs; t += 0.1) { m.step(0.1); g.update(m.input, 0.1); n++; if (until && until()) break; } return n; };
const campNow = (g, m) => { const h = m.home(); return Math.hypot(g.spear.at.x - h.x, g.spear.at.z - h.z); };

describe('Dave and the spear in the world', () => {
  // a first catch at the first try, so that the test does not wait on luck
  const luckyTries = () => { let tries = 0; const probe = createFish(w.seed, { carried: [], tries: 0 }); while (!probe.fishTry(0)) tries++; return tries; };
  const scene = ({ hunger = 0.7, time = 0.45, spear = 'camp', fish = null, stocked = false } = {}) => {
    const fire = { fires: [fireAt(spawn.x + 1.6, spawn.z, 6 * BURN)], burnt: [], torch: null, torches: [], attempts: 1, nextId: 3 };
    const g = campGame(w, spawn, { day: 1, time, stocked, extra: { fire, hunger: { days: hunger }, fish: fish || { carried: [], tries: luckyTries() } } });
    knowRoute(g, shallow); noFood(g);
    const m = createMind(w, g); m.engage();
    put(g, spawn.x, spawn.z);
    if (spear === 'camp') { const sp = { x: spawn.x - 1.0, z: spawn.z + 2.6 }; g.spear.at = sp; }
    return { g, m };
  };
  it('fetches the spear that lies at the camp, fishes when hungry with the fish the only food, roasts it and eats it', () => {
    const { g, m } = scene(), h0 = g.hunger.days; let held = false, inWater = false;
    expect(g.spear.hand).toBe(false);
    tickMind(g, m, 600, () => { if (g.spear.hand) held = true; if (fishableAt(terrainAt(w, g.player.x, g.player.z, g.sea))) inWater = true; return m.stats.fishEaten > 0; });
    expect(held, 'took the spear up').toBe(true); expect(inWater, 'stood in the shallows').toBe(true);
    expect(m.stats.fishTrips).toBe(1); expect(m.stats.fishTries).toBeGreaterThanOrEqual(1); expect(m.stats.fishCaught).toBe(1);
    expect(m.stats.fishEaten).toBe(1); expect(g.fish.carried.length).toBe(0);
    expect(g.hunger.days).toBeLessThan(h0 - 0.3);
    expect(m.stats.errors || 0).toBe(0);
  });
  it('weighs the fish against other food by walking cost: a nut at hand wins over a fish a long way off', () => {
    const { g, m } = scene({ hunger: 0.7 });
    g.shells.nuts = 1;   // a nut carried is eaten first, from the row (the cheapest of all)
    tickMind(g, m, 120, () => g.shells.nuts === 0);
    expect(g.shells.nuts).toBe(0); expect(m.stats.fishTrips).toBe(0);
  });
  it('lays the spear back at the camp afterwards, on a spot that keeps CAMP_GAP, before taking up wood', () => {
    const { g, m } = scene();
    tickMind(g, m, 900, () => m.stats.fishEaten > 0 && !g.spear.hand && !!g.spear.at);
    expect(g.spear.hand).toBe(false); expect(g.spear.at, 'lies at a place').toBeTruthy();
    expect(campNow(g, m)).toBeLessThan(8);
    expect(gapFree(g.movement.obstacles.camp, g.spear.at.x, g.spear.at.z, 0.2)).toBe(true); expect(CAMP_GAP).toBeCloseTo(0.5);
    expect(g.wood.load()).toBe(0);
  });
  it('lays a spear left in his hand at the camp before he takes up wood', () => {
    const { g, m } = scene({ hunger: 0, time: 0.3, spear: 'none', stocked: false });
    put(g, spawn.x + 14, spawn.z + 2); g.spear.hand = true; g.player.spear = true;   // a fishing trip cut short: the spear is still in his hand
    let carriedWithSpear = 0, laidAt = -1;
    tickMind(g, m, 900, () => { if (g.spear.hand && g.wood.load()) carriedWithSpear++; if (!g.spear.hand && laidAt < 0 && g.spear.at) laidAt = g.wood.load(); return g.wood.load() > 0 && !g.spear.hand; });
    expect(carriedWithSpear).toBe(0); expect(g.spear.hand).toBe(false); expect(g.spear.at).toBeTruthy(); expect(laidAt).toBe(0);
  });
  it('does not fish without flames to roast the fish, nor without a spear', () => {
    const a = scene(); a.g.fire.fires.length = 0; tickMind(a.g, a.m, 200); expect(a.m.stats.fishTrips).toBe(0);
    const b = scene({ spear: 'none' }); tickMind(b.g, b.m, 200); expect(b.m.stats.fishTrips).toBe(0);
  });
  it('fishes now and then on a calm afternoon, catches one, and has it for supper', () => {
    const { g, m } = scene({ hunger: 0, time: 0.42 });
    let trips = 0;
    tickMind(g, m, 1400, () => { trips = m.stats.fishTrips; return trips > 0 && !g.spear.hand && !!g.spear.at; });
    expect(trips).toBeGreaterThanOrEqual(1); expect(g.spear.hand).toBe(false);
    expect(m.stats.fishTries).toBeGreaterThanOrEqual(1);
  });
});

describe('Dave makes a spear, once', () => {
  it('makes one from a branch and a stone he knows, lays it at the camp, and never a second', () => {
    expect(stone && Math.hypot(stone.x - spawn.x, stone.z - spawn.z) < 60).toBe(true);
    const g = campGame(w, spawn, { day: SPEAR_DAY, time: 0.3, stocked: true });
    const near = w.tiles.flatMap(t => g.branches.groundBranches(t)).sort((a, b) => Math.hypot(a.x - spawn.x, a.z - spawn.z) - Math.hypot(b.x - spawn.x, b.z - spawn.z))[0];
    knowRoute(g, near); knowRoute(g, stone);
    const m = createMind(w, g); m.engage();
    tickMind(g, m, 1500, () => m.stats.spearsMade > 0 && !g.spear.hand && !!g.spear.at);
    expect(m.stats.spearsMade).toBe(1); expect(g.spear.has()).toBe(true); expect(g.spear.hand).toBe(false); expect(g.spear.at).toBeTruthy();
    expect(g.wood.carried.some(l => l.branch)).toBe(false);                                        // the branch is used up
    expect(Math.hypot(g.spear.at.x - m.home().x, g.spear.at.z - m.home().z)).toBeLessThan(8);   // at the camp
    tickMind(g, m, 3000);
    expect(m.stats.spearsMade).toBe(1);   // it lasts
    expect(m.stats.errors || 0).toBe(0);
  });
  it('makes none before the home stands: on day 1, with a branch and a stone known, the lean-to comes first', () => {
    const g = campGame(w, spawn, { day: 1, time: 0.3, stocked: true });
    const near = w.tiles.flatMap(t => g.branches.groundBranches(t)).sort((a, b) => Math.hypot(a.x - spawn.x, a.z - spawn.z) - Math.hypot(b.x - spawn.x, b.z - spawn.z))[0];
    knowRoute(g, near); knowRoute(g, stone);
    const m = createMind(w, g); m.engage();
    tickMind(g, m, 1500, () => g.clock.time > 0.58);
    expect(m.stats.spearsMade).toBe(0); expect(g.spear.has()).toBe(false);
  });
  it('makes none when no branch or no stone is known on ground he has walked, and none by night', () => {
    const g = campGame(w, spawn, { day: SPEAR_DAY, time: 0.3, stocked: true });
    g.stones.groundStones = () => [];   // no stone anywhere
    const m = createMind(w, g); m.engage();
    tickMind(g, m, 600);
    expect(m.stats.spearsMade).toBe(0); expect(g.spear.has()).toBe(false);
    expect(spearMakeOk({ time: 0.3, day: 7, spear: false, thirst: 0, hunger: 0, cool: {} })).toBe(true); expect(spearMakeOk({ time: 0.95, day: 7, spear: false, thirst: 0, hunger: 0, cool: {} })).toBe(false);
  });
});
