// Shelter upgrades (0.27 "Home"): the fallen palm fronds and the stones (derived from the world, the generated island
// untouched), carrying and piles of their own, building the upgrades of a finished lean-to (side walls, a bed, a stone
// fire ring) with their icon, what each does (dry radius, cold sleep, rest rate, fire ring), the save and the pictures' pure parts.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { frondsOfTile, createFronds, FROND_ID0, FROND_SHARE, REGROW as F_REGROW, REGROW_SPREAD as F_SPREAD } from '../src/game/fronds.js';
import { stonesOfTile, createStones, STONE_ID0, STONE_MAX } from '../src/game/stones.js';
import { branchesOfTile } from '../src/game/branches.js';
import { createWood, CARRY_MAX, CARRY_SLOW, PILE_MAX, kindOf } from '../src/game/wood.js';
import { createFire, FUEL_MAX, BURN, RAIN_OUT, RING_BURN, EMBERS } from '../src/game/fire.js';
import { createLeantos, upgradeFor, paidSteps, UPGRADES, UP_TIME, UP_COST, UP_NEAR, UP_REACH, WALLS_WOOD, WALLS_FIRE, RING_AT, RING_R, ringCentre } from '../src/game/leanto.js';
import { WOOD_SHELTER, FIRE_SHELTER } from '../src/game/weather.js';
import { createSleep, COLD_SLEEP, SHELTER_SLEEP, WALLS_SLEEP, BED_REST, SHELTER_REST, REST_RATE } from '../src/game/sleep.js';
import { DAY_SECONDS } from '../src/game/clock.js';
import { serialise, parseSave, momentKey } from '../src/save.js';
import { carryItems } from '../src/render/carryMark.js';
import { buttonIcons, ICONS } from '../src/render/actionButton.js';
import { wallFronds, bedParts, ringStones, WALL_N, BED_N, RING_N } from '../src/render/leanto.js';
import { pileTally } from '../src/render/tallyMarks.js';

let w, spawn, fronds, stones, near;
beforeAll(async () => {
  w = await generateWorld(1337); spawn = startSpot(w);
  const d = o => Math.hypot(o.x - spawn.x, o.z - spawn.z);
  fronds = w.tiles.flatMap(t => frondsOfTile(w, t)).sort((a, b) => d(a) - d(b));
  stones = w.tiles.flatMap(t => stonesOfTile(w, t)).sort((a, b) => d(a) - d(b));
  near = { fronds: fronds.filter(f => d(f) <= 100).length, stones: stones.filter(s => d(s) <= 100).length };
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
const bigOf = g => g.action().options.find(o => o.big) || null;   // the big option (light, build, upgrade, sleep) the arc would show
const run = (g, input, s, dt = 1 / 30) => { if (input.big) { input.big = false; g.act(bigOf(g)); } for (let t = 0; t < s; t += dt) g.update(input, dt); };
const ids = (list, from, n) => list.slice(from, from + n).map(o => o.id);
const LT = () => ({ id: 0, x: spawn.x + 0.5, z: spawn.z, heading: 0, progress: 1 });
// a game with a finished lean-to beside the start and piles of the given kinds 1.5 m from its centre
const camp = ({ fr = 0, br = 0, st = 0, up, far = 0, o = {} } = {}) => {
  const piles = [];
  const at = (k, list, from, n, dz) => { if (n) piles.push({ x: spawn.x + 0.5 + far, z: spawn.z + dz, kind: k, logs: ids(list, from, n) }); };
  at('frond', fronds, 0, fr, 1.5); at('branch', branchesAll, 0, br, -1.5); at('stone', stones, 0, st, 1.4);
  return createGame(w, spawn, { wood: { carried: [], piles }, leantos: { list: [{ ...LT(), ...(up ? { up } : {}) }], nextId: 1 }, sleep: { awake: 0.1 }, ...o });
};
let branchesAll;
beforeAll(() => { branchesAll = w.tiles.flatMap(t => t.trees.length ? branchesOfTile(w, t) : []).sort((a, b) => Math.hypot(a.x - spawn.x, a.z - spawn.z) - Math.hypot(b.x - spawn.x, b.z - spawn.z)); });

describe('fallen palm fronds', () => {
  it('lie under about one palm in three, one each, and are fixed by the seed without touching the world', async () => {
    const palms = w.tiles.reduce((n, t) => n + t.palms.length, 0);
    expect(fronds.length / palms).toBeGreaterThan(FROND_SHARE - 0.06); expect(fronds.length / palms).toBeLessThan(FROND_SHARE + 0.06);
    expect(new Set(fronds.map(f => f.id)).size).toBe(fronds.length);
    for (const f of fronds) { expect(f.id).toBeGreaterThanOrEqual(FROND_ID0); expect(f.frond).toBe(true); expect(f.t).toBeUndefined(); expect(f.len).toBeGreaterThan(1.3); }
    for (const t of w.tiles) for (const f of frondsOfTile(w, t)) expect(t.palms.some(p => Math.hypot(p.x - f.x, p.z - f.z) < 2.1)).toBe(true);
    const again = await generateWorld(1337);
    expect(again.tiles.flatMap(t => frondsOfTile(again, t))).toEqual(w.tiles.flatMap(t => frondsOfTile(w, t)));
    for (const t of again.tiles) expect(Object.keys(t).sort()).toEqual(['bushes', 'cocos', 'crags', 'drift', 'hmax', 'palms', 'pines', 'roots', 'rocks', 'tx', 'tz', 'trees', 'x0', 'z0'].sort());
  }, 120000);
  it('has some close to the start on seed 1337', () => {
    expect(near.fronds).toBeGreaterThan(30);
    expect(Math.hypot(fronds[0].x - spawn.x, fronds[0].z - spawn.z)).toBeLessThan(15);
  });
  it('grow back 4 to 6 days after they were taken, and the taking is saved', () => {
    const fr = createFronds(w), f = fronds[2];
    expect(fr.take(f, 10)).toBe(true); expect(fr.take(f, 10)).toBe(false); expect(fr.onGround(f)).toBe(false);
    fr.update(10 + F_REGROW - 0.01); expect(fr.onGround(f)).toBe(false);
    fr.update(10 + F_REGROW + F_SPREAD + 0.01); expect(fr.onGround(f)).toBe(true);
    expect(F_REGROW).toBe(4); expect(F_REGROW + F_SPREAD).toBe(6);
    fr.take(f, 3); expect(createFronds(w, fr.state()).onGround(f)).toBe(false);
    expect(fr.piece(f.id)).toBe(f); expect(fr.piece(5)).toBeNull();
  });
});

describe('stones', () => {
  it('lie along the river banks and at the foot of rocks, on dry gentle ground, with plenty within 100 m of the start', () => {
    expect(stones.length).toBeGreaterThan(500); expect(near.stones).toBeGreaterThan(100);
    expect(new Set(stones.map(s => s.id)).size).toBe(stones.length);
    for (const s of stones) { expect(s.id).toBeGreaterThanOrEqual(STONE_ID0); expect(s.stone).toBe(true); expect(s.y).toBeGreaterThan(0.4); expect(w.dryOfRiver(s.x, s.z, 0.3)).toBe(true); }
    expect(stones.some(s => { const q = w.riverAt(s.x, s.z); return q && q.d < q.hw + 2.4; })).toBe(true);
    expect(Math.hypot(stones[0].x - spawn.x, stones[0].z - spawn.z)).toBeLessThan(40);
  });
  it('are fixed by the seed and do not grow back', async () => {
    const again = await generateWorld(1337);
    expect(again.tiles.flatMap(t => stonesOfTile(again, t))).toEqual(w.tiles.flatMap(t => stonesOfTile(w, t)));
    const st = createStones(w), s = stones[1];
    expect(st.take(s)).toBe(true); expect(st.take(s)).toBe(false); expect(st.onGround(s)).toBe(false);
    expect(createStones(w, st.state()).onGround(s)).toBe(false);
    expect(st.piece(s.id)).toBe(s);
  }, 120000);
});

describe('carrying fronds and stones', () => {
  const takeAll = (wood, list) => list.map(o => wood.take({ kind: 'log', log: o }));
  it('fronds count towards the three pieces with wood and branches', () => {
    const fr = createFronds(w), wood = createWood(w, undefined, null, fr);
    expect(takeAll(wood, fronds.slice(0, 4))).toEqual([1, 1, 1, 0]);
    expect(wood.carried.length).toBe(CARRY_MAX); expect(wood.load()).toBe(3);
    expect(carryItems({ frond: 2, stone: 1 })).toEqual(['frond', 'frond', 'stone']);
  });
  it('stones are carried apart, two at most, and every piece slows him', () => {
    const fr = createFronds(w), st = createStones(w), wood = createWood(w, undefined, null, fr, st);
    expect(takeAll(wood, stones.slice(0, 3))).toEqual([1, 1, 0]);
    expect(wood.stones.length).toBe(STONE_MAX); expect(wood.carried.length).toBe(0);
    takeAll(wood, fronds.slice(0, 3)); expect(wood.load()).toBe(5);
    const g = createGame(w, spawn, { sleep: { awake: 0.1 } }), g2 = createGame(w, spawn, { sleep: { awake: 0.1 } });
    g2.wood.take({ kind: 'log', log: stones[0] }); g2.wood.take({ kind: 'log', log: stones[1] });
    const walk = game => { const i = makeInput({ up: true }); const p0 = { x: game.player.x, z: game.player.z }; run(game, i, 2); return Math.hypot(game.player.x - p0.x, game.player.z - p0.z); };
    const free = walk(g), loaded = walk(g2);
    expect(loaded / free).toBeCloseTo(1 - 2 * CARRY_SLOW, 1);
  });
  it('a stone or a frond lying beside him is offered for a pickup and a full hand is not', () => {
    const f = fronds[0], g = createGame(w, { x: f.x, z: f.z, y: w.H(f.x, f.z) }, { sleep: { awake: 0.1 } });
    expect(g.action().tap).toMatchObject({ kind: 'pickup' }); expect(g.action().tap.thing.log.frond).toBe(true);
    const s = stones[0], h = createGame(w, { x: s.x, z: s.z, y: w.H(s.x, s.z) }, { sleep: { awake: 0.1 } });
    expect(h.action().tap.thing.log.stone).toBe(true);
    h.wood.take({ kind: 'log', log: stones[1] }); h.wood.take({ kind: 'log', log: stones[2] });
    expect(h.wood.stones.length).toBe(2);
    const t = h.action().tap; expect(!t || t.kind !== 'pickup' || !t.thing.log || !t.thing.log.stone).toBe(true);   // hands full: no third stone is offered
  });
  it('are laid down on piles of their own kind, never mixed, at most 12, tally marks like the others', () => {
    const fr = createFronds(w), st = createStones(w), wood = createWood(w, undefined, null, fr, st);
    takeAll(wood, [fronds[0], stones[0], stones[1]]);
    expect(wood.drop(spawn.x, spawn.z, 0)).toBe(true);
    expect(wood.piles.map(p => p.kind).sort()).toEqual(['frond', 'stone']);
    expect(wood.carried.length + wood.stones.length).toBe(0);
    const sp = wood.piles.find(p => p.kind === 'stone'); expect(sp.logs.length).toBe(2); expect(pileTally(sp).count).toBe(2);
    expect(kindOf(fronds[0])).toBe('frond'); expect(kindOf(stones[0])).toBe('stone'); expect(kindOf({})).toBe('driftwood');
    // a full pile of 12 takes no more
    const big = createWood(w, { carried: [], piles: [{ x: spawn.x, z: spawn.z, kind: 'stone', logs: ids(stones, 0, PILE_MAX) }] }, null, fr, st);
    big.take({ kind: 'log', log: stones[20] }); expect(big.drop(spawn.x, spawn.z, 0)).toBe(true);
    expect(big.piles.map(p => p.logs.length)).toEqual([PILE_MAX, 1]);
    // taking from a stone pile fills the hands (2) and a pile of fronds the arm (3)
    const t = createWood(w, { carried: [], piles: [{ x: spawn.x, z: spawn.z, kind: 'stone', logs: ids(stones, 0, 5) }, { x: spawn.x + 3, z: spawn.z, kind: 'frond', logs: ids(fronds, 0, 5) }] }, null, fr, st);
    expect(t.take({ kind: 'pile', pile: t.piles[0] })).toBe(2); expect(t.stones.length).toBe(2);
    expect(t.take({ kind: 'pile', pile: t.piles[1] })).toBe(3); expect(t.carried.length).toBe(3);
  });
  it('fronds never feed a fire; stones and fronds are always dry', () => {
    const f = fronds[0], g = createGame(w, { x: f.x, z: f.z, y: w.H(f.x, f.z) }, { sleep: { awake: 0.1 }, fire: { fires: [{ id: 0, x: f.x + 0.6, z: f.z, fuel: BURN, embers: EMBERS, lit: 0, fed: 1 }], attempts: 0, nextId: 1 } });
    g.wood.take({ kind: 'log', log: f });
    expect(g.action().tap && g.action().tap.kind).not.toBe('feed');
  });
  it('carried and piled ones are saved and read back', () => {
    const g = camp({ fr: 3, st: 4 });
    g.wood.take({ kind: 'log', log: stones[10] }); g.wood.take({ kind: 'log', log: fronds[10] });
    const back = createGame(w, spawn, JSON.parse(JSON.stringify(g.state())));
    expect(back.wood.stones.map(s => s.id)).toEqual([stones[10].id]); expect(back.wood.carried.map(s => s.id)).toEqual([fronds[10].id]);
    expect(back.wood.piles.map(p => [p.kind, p.logs.length])).toEqual([['frond', 3], ['stone', 4]]);
    expect(back.stones.onGround(stones[10])).toBe(false); expect(back.fronds.onGround(fronds[10])).toBe(false);
  });
});

describe('the upgrades: when they can be built', () => {
  it('walls need 6 fronds, the bed 4 branches and 4 fronds, the ring 8 stones, in piles within 3 m of a finished lean-to', () => {
    expect(UPGRADES.walls).toEqual({ steps: 6, per: { frond: 1 } });
    expect(UPGRADES.bed).toEqual({ steps: 4, per: { branch: 1, frond: 1 } });
    expect(UPGRADES.ring).toEqual({ steps: 8, per: { stone: 1 } });
    expect(bigOf(camp({ fr: 6 }))).toMatchObject({ kind: 'upgrade', what: 'walls' });
    expect(bigOf(camp({ fr: 5 })) && bigOf(camp({ fr: 5 })).kind).not.toBe('upgrade');
    expect(bigOf(camp({ fr: 4, br: 4, up: { walls: 1 } }))).toMatchObject({ kind: 'upgrade', what: 'bed' });
    expect(bigOf(camp({ fr: 3, br: 4, up: { walls: 1 } })) && bigOf(camp({ fr: 3, br: 4, up: { walls: 1 } })).kind).not.toBe('upgrade');
    expect(bigOf(camp({ st: 8 }))).toMatchObject({ kind: 'upgrade', what: 'ring' });
    expect(bigOf(camp({ st: 7 })) && bigOf(camp({ st: 7 })).kind).not.toBe('upgrade');
  });
  it('the order is free: the first one whose materials are there, walls before bed before ring', () => {
    expect(bigOf(camp({ fr: 10, br: 4, st: 8 })).what).toBe('walls');
    expect(bigOf(camp({ fr: 4, br: 4, st: 8 })).what).toBe('bed');
    expect(bigOf(camp({ st: 8, fr: 3 })).what).toBe('ring');
  });
  it('needs the piles within 3 m of the lean-to and himself beside it, and only once each', () => {
    expect(UP_NEAR).toBe(3); expect(UP_REACH).toBeGreaterThan(1.7);
    const farPiles = camp({ fr: 6, far: 3.1 }); expect(bigOf(farPiles) && bigOf(farPiles).kind).not.toBe('upgrade');
    const g = camp({ fr: 6 }); g.player.x = spawn.x + 4; g.player.z = spawn.z; expect(bigOf(g) && bigOf(g).kind).not.toBe('upgrade');
    expect(upgradeFor({ ...LT(), up: { walls: 1, bed: 1, ring: 1 } }, [{ x: spawn.x, z: spawn.z, kind: 'stone', logs: ids(stones, 0, 12) }])).toBeNull();
    const half = { ...LT(), progress: 0.5 }; expect(upgradeFor(half, [{ x: half.x, z: half.z, kind: 'frond', logs: ids(fronds, 0, 6) }])).toBeNull();
  });
  it('the button shows what will be built', () => {
    for (const [what, fr, br, st] of [['walls', 6, 0, 0], ['bed', 4, 4, 0], ['ring', 0, 0, 8]]) {
      const icons = buttonIcons(camp({ fr, br, st, up: what === 'bed' ? { walls: 1 } : undefined }).action());
      expect(icons.options.map(o => o.key)).toContain(what); expect(ICONS[what]).toMatch(/</);   // a pile beside him is also picked up by a press: that is the ring's icon, the upgrade is in the arc
    }
  });
});

describe('building an upgrade', () => {
  it('its icon builds it in steps: one frond a step, 30 seconds of work, the rest it costs', () => {
    const g = camp({ fr: 7 }), input = makeInput({ big: true }), t0 = g.clock.total, awake0 = g.sleep.awake;
    run(g, input, 3);
    expect(g.player.work).toMatchObject({ kind: 'upgrade' });
    const l = g.leantos.list[0];
    expect(l.up.walls).toBeGreaterThan(0); expect(l.up.walls).toBeLessThan(0.2);
    expect(g.wood.piles[0].logs.length).toBe(6);   // the first step took its frond
    run(g, input, 12); expect(l.up.walls).toBeGreaterThan(0.3); expect(l.up.walls).toBeLessThan(0.6);
    expect(g.wood.piles[0].logs.length).toBeLessThan(6); expect(g.wood.piles[0].logs.length).toBeGreaterThanOrEqual(3);
    run(g, input, UP_TIME);
    expect(g.player.work).toBeNull(); expect(l.up.walls).toBe(1); expect(g.wood.piles.map(p => p.logs.length)).toEqual([1]);
    expect(g.leantos.has(l, 'walls')).toBe(true);
    const days = g.clock.total - t0; expect(g.sleep.awake - awake0 - days).toBeCloseTo(UP_COST, 1);
    expect(bigOf(g) && bigOf(g).kind).not.toBe('upgrade');   // built once
  });
  it('walking off keeps the progress and what was used; choosing it again builds on with only the rest', () => {
    const g = camp({ fr: 6 }), input = makeInput({ big: true });
    run(g, input, 10);
    const l = g.leantos.list[0], p1 = l.up.walls, left = g.wood.piles.reduce((n, p) => n + p.logs.length, 0);
    expect(p1).toBeGreaterThan(0.2); expect(p1).toBeLessThan(0.5);
    expect(paidSteps('walls', p1)).toBe(6 - left);
    input.up = true; g.update(input, 1 / 30); input.up = false;
    expect(g.player.work).toBeNull(); run(g, input, 2); expect(l.up.walls).toBe(p1);
    g.player.x = l.x + 0.8; g.player.z = l.z; g.player.y = w.H(g.player.x, g.player.z);
    expect(bigOf(g)).toMatchObject({ kind: 'upgrade', what: 'walls' });
    input.big = true; run(g, input, UP_TIME + 2);
    expect(l.up.walls).toBe(1); expect(g.wood.piles.length).toBe(0);   // exactly the 6 were used, in all
  });
  it('the bed takes a branch and a frond a step, the ring a stone a step', () => {
    const g = camp({ fr: 4, br: 4, up: { walls: 1 } }), input = makeInput({ big: true });
    run(g, input, UP_TIME + 4); const l = g.leantos.list[0];
    expect(l.up.bed).toBe(1); expect(g.wood.piles.length).toBe(0);
    const r = camp({ st: 9 }), i2 = makeInput({ big: true }); run(r, i2, UP_TIME + 4);
    expect(r.leantos.list[0].up.ring).toBe(1); expect(r.wood.piles.map(p => p.logs.length)).toEqual([1]);
  });
  it('works with F too', () => {
    const g = camp({ st: 8 }); run(g, makeInput({ hold: { key: true } }), 5);
    expect(g.player.work).toMatchObject({ kind: 'upgrade' }); expect(g.leantos.list[0].up.ring).toBeGreaterThan(0);
  });
  it('is stopped when the materials are taken away', () => {
    const g = camp({ fr: 6 }), input = makeInput({ big: true });
    run(g, input, 8); g.wood.piles.length = 0; run(g, input, 8);
    expect(g.player.work).toBeNull(); expect(g.leantos.list[0].up.walls).toBeLessThan(1);
  });
});

describe('what the upgrades do', () => {
  it('walls: wood stays dry within 2.5 m instead of 1.5, a fire within 3 m instead of 2', () => {
    expect(WALLS_WOOD).toBe(2.5); expect(WALLS_FIRE).toBe(3);
    const bare = createLeantos(w, { list: [LT()], nextId: 1 }), walled = createLeantos(w, { list: [{ ...LT(), up: { walls: 1 } }], nextId: 1 }), half = createLeantos(w, { list: [{ ...LT(), up: { walls: 0.5 } }], nextId: 1 });
    const l = LT(), pt = d => [l.x, l.z + d];
    expect(bare.dry(...pt(WOOD_SHELTER - 0.05), 'wood')).toBe(true); expect(bare.dry(...pt(WOOD_SHELTER + 0.1), 'wood')).toBe(false);
    expect(bare.dry(...pt(FIRE_SHELTER - 0.05), 'fire')).toBe(true); expect(bare.dry(...pt(FIRE_SHELTER + 0.1), 'fire')).toBe(false);
    expect(walled.dry(...pt(2.4), 'wood')).toBe(true); expect(walled.dry(...pt(2.6), 'wood')).toBe(false);
    expect(walled.dry(...pt(2.9), 'fire')).toBe(true); expect(walled.dry(...pt(3.1), 'fire')).toBe(false);
    expect(half.dry(...pt(2.4), 'wood')).toBe(false);   // unfinished walls do not count
    const g = createGame(w, spawn, { leantos: { list: [{ ...LT(), up: { walls: 1 } }], nextId: 1 } });
    expect(g.leantos.covers(l.x, l.z + 2.4, WOOD_SHELTER)).toBe(false);
  });
  it('walls: the rain does not wet wood or put out a fire at the edge, and a bare lean-to would not cover it', () => {
    const wetAt = (up, dz) => {
      const l = { id: 0, x: spawn.x + 0.5, z: spawn.z, heading: 0, progress: 1, ...(up ? { up } : {}) };
      const log = logs0[0]; delete log.t;
      const g = createGame(w, spawn, { leantos: { list: [l], nextId: 1 }, wood: { carried: [], piles: [{ x: l.x, z: l.z + dz, kind: 'driftwood', logs: [log.id] }] } });
      g.wood.rain(0.1, true, (x, z) => g.leantos.dry(x, z, 'wood'), { x: 0, z: 0 });
      return g.wood.piles[0].logs[0].t !== undefined;
    };
    expect(wetAt(null, 2.2)).toBe(true); expect(wetAt({ walls: 1 }, 2.2)).toBe(false);
    delete logs0[0].t;
  });
  it('walls: a cold sleep under it lasts seven hours and he wakes 87 % rested, a bare lean-to six hours, none three', () => {
    const cold = shelter => { const s = createSleep({ awake: 2 }); s.start(); let n = 0; while ((s.asleep || s.lie < 1) && n++ < 40000) s.update(1 / 30, true, false, {}, shelter); return s; };
    const a = cold(false), b = cold(true), c = cold({ walls: true, bed: false });
    expect(a.slept).toBeCloseTo(COLD_SLEEP, 1); expect(b.slept).toBeCloseTo(SHELTER_SLEEP, 1); expect(c.slept).toBeCloseTo(WALLS_SLEEP, 1);
    expect(WALLS_SLEEP * 24).toBe(7);
    expect(c.rest()).toBeGreaterThan(0.85); expect(c.rest()).toBeLessThan(0.9); expect(b.rest()).toBeLessThan(c.rest());
  });
  it('bed: he rests 25 % faster, warm or cold', () => {
    const rested = (warm, shelter) => { const s = createSleep({ awake: 2 }); s.start(); let days = 0; while (days < 2 / 24) days += s.update(1 / 30, true, warm, {}, shelter) / DAY_SECONDS; return 2 - s.awake; };
    expect(BED_REST).toBe(1.25);
    expect(rested(false, { bed: true }) / rested(false, true)).toBeCloseTo(1.25, 1);
    expect(rested(true, { bed: true }) / rested(true, true)).toBeCloseTo(1.25, 1);
    expect(rested(true, true) / rested(true, false)).toBeCloseTo(SHELTER_REST, 1);
  });
  it('sleeping in the game uses the upgrades of the lean-to he lies under', () => {
    const sleepOut = o => { const g = createGame(w, spawn, { sleep: { awake: 2 }, leantos: { list: [{ ...LT(), x: spawn.x + 0.5, up: o }], nextId: 1 } }); const i = makeInput(); run(g, i, 3); let n = 0; while ((g.sleep.asleep || g.sleep.lie > 0) && n++ < 9000) g.update(i, 1 / 30); return g; };
    expect(sleepOut(undefined).sleep.slept).toBeCloseTo(SHELTER_SLEEP, 1);
    expect(sleepOut({ walls: 1 }).sleep.slept).toBeCloseTo(WALLS_SLEEP, 1);
    expect(sleepOut({ bed: 1 }).sleep.rest()).toBeGreaterThan(sleepOut(undefined).sleep.rest() + 0.05);
  });
  it('ring: a fire within 1 m of its middle burns 1.5 times as long and the rain does not put it out', () => {
    const l = { ...LT(), up: { ring: 1 } }, c = ringCentre(l);
    expect(RING_AT).toBe(2.2); expect(RING_R).toBe(1); expect(RING_BURN).toBe(1.5);
    expect(c.z - l.z).toBeCloseTo(RING_AT, 5);
    const lt = createLeantos(w, { list: [l, { id: 1, x: spawn.x + 40, z: spawn.z, heading: 0, progress: 1, up: { ring: 0.5 } }], nextId: 2 });
    expect(lt.ring(c.x, c.z)).toBe(true); expect(lt.ring(c.x + 0.9, c.z)).toBe(true); expect(lt.ring(c.x + 1.1, c.z)).toBe(false);
    expect(lt.ring(spawn.x + 40, spawn.z + RING_AT)).toBe(false);   // an unfinished ring is no ring
    const burn = (ring, rain) => {
      const f = createFire(w), at = ring ? c : { x: c.x + 5, z: c.z };
      f.fires.push({ id: 0, x: at.x, z: at.z, fuel: 4 * BURN, embers: EMBERS, lit: 0, fed: 4 }); let t = 0;
      while (f.fires.length && t < 3) { f.update(0.002, rain ? () => true : null, null, t, lt.ring); t += 0.002; }
      return { t, hissed: f.hissed };
    };
    const plain = burn(false, false), ringed = burn(true, false);
    expect(ringed.t / plain.t).toBeCloseTo(1.5, 1);
    const wet = burn(false, true), dryRing = burn(true, true);
    expect(wet.hissed).toBe(1); expect(wet.t).toBeLessThan(RAIN_OUT + 0.003);
    expect(dryRing.hissed).toBe(0); expect(dryRing.t).toBeCloseTo(ringed.t, 1);
    expect(FUEL_MAX).toBeGreaterThan(0);
  });
});

describe('saving the upgrades', () => {
  it('a lean-to keeps its upgrades and their progress, older saves have none', () => {
    const g = camp({ fr: 2, up: { walls: 1, bed: 0.4 } });
    const text = serialise({ ...g.state(), name: '' }), back = parseSave(text, 1337);
    expect(back).not.toBeNull(); expect(back.leantos.list[0].up).toEqual({ walls: 1, bed: 0.4 });
    const g2 = createGame(w, spawn, back); expect(g2.leantos.list[0].up).toEqual({ walls: 1, bed: 0.4 }); expect(g2.leantos.has(g2.leantos.list[0], 'walls')).toBe(true);
    const old = g.state(); delete old.fronds; delete old.stones; old.leantos.list.forEach(l => delete l.up);
    const g3 = createGame(w, spawn, parseSave(serialise({ ...old, name: '' }), 1337)); expect(g3.leantos.list[0].up).toBeUndefined();
    expect(parseSave(serialise({ ...g.state(), leantos: { list: [{ ...LT(), up: { walls: 'x' } }], nextId: 1 } }), 1337)).toBeNull();
  });
  it('the fronds and stones taken are saved, and the moment key follows the upgrades', () => {
    const g = createGame(w, spawn); g.fronds.take(fronds[0], 5); g.stones.take(stones[0]);
    const back = createGame(w, spawn, parseSave(serialise({ ...g.state(), name: '' }), 1337));
    expect(back.fronds.onGround(fronds[0])).toBe(false); expect(back.stones.onGround(stones[0])).toBe(false);
    const c = camp({ fr: 1 }), k0 = momentKey(c); c.leantos.upgraded(c.leantos.list[0], 'walls', 1);
    expect(momentKey(c)).not.toBe(k0);
  });
});

describe('the pictures', () => {
  const l = () => ({ id: 3, x: 10, z: 20, heading: 0.7, progress: 1 });
  it('walls hang one by one on alternating sides, down to the ground from the roof', () => {
    expect(wallFronds(w.H, l(), 0)).toEqual([]);
    expect(wallFronds(w.H, l(), 1).length).toBe(2 * WALL_N);
    const all = wallFronds(w.H, l(), 1), left = all.filter(f => f.k % 2 === 0).length; expect(left).toBe(WALL_N);
    for (const f of all) { expect(f.down.y).toBeLessThan(-0.9); expect(f.len).toBeGreaterThanOrEqual(0.8); expect(f.len).toBeLessThan(1.9); }
    expect(wallFronds(w.H, l(), 0.3).length).toBe(3);
  });
  it('the bed is a frame first, then fronds on it; the ring is eight stones round the ring middle', () => {
    expect(bedParts(w.H, l(), 0).sticks.length).toBe(0);
    const some = bedParts(w.H, l(), 0.3); expect(some.sticks.length).toBeGreaterThan(0); expect(some.fronds.length).toBe(0);
    const full = bedParts(w.H, l(), 1); expect(full.sticks.length).toBe(9); expect(full.fronds.length).toBe(BED_N);
    const ring = ringStones(w.H, l(), 1), c = ringCentre(l());
    expect(ring.length).toBe(RING_N); for (const s of ring) expect(Math.hypot(s.x - c.x, s.z - c.z)).toBeGreaterThan(0.38);
    expect(ringStones(w.H, l(), 0.5).length).toBe(4);
  });
});

let logs0;
beforeAll(() => { logs0 = w.tiles.flatMap(t => t.drift).sort((a, b) => Math.hypot(a.x - spawn.x, a.z - spawn.z) - Math.hypot(b.x - spawn.x, b.z - spawn.z)); });
