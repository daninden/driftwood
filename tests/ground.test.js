// 0.36.2 "Ground": building clears the ground, and the fire sits in the middle of the stone ring.
// The first piece of a lean-to, and the first part of a hut, clear the region of the building (game/ground, game/leanto keepFree): bushes (berry bushes and banana plants too), small rocks and the ground cover are gone for
// good, saved and kept; a cleared bush slows no step; loose pieces (stones, driftwood, branches, fronds, coconuts, felled logs) are moved just outside, none lost. The same for Dave (he builds through the game).
// A new fuel pile laid in a finished stone ring lies in the ring's exact middle (game/wood drop, game/game lay).
// Covers: the overlay (covers, bushGone, rockGone, coversPiece, state, findSpot); the moves of each module (branches, fronds, stones, fibre, wood, logs) and their saves; regrowth never in a cleared region;
// the player's first lean-to piece and first hut part on island 1337; Dave's lean-to; the ring pile by the player and by Dave. The island itself is untouched (the seed 1337 fixture is tests/world.test.js).
// Depends on: world/world, world/spots, game/game, game/ground, game/leanto, game/movement, game/forage, game/branches, game/fronds, game/stones, game/fibre, game/wood, game/logs, game/mind, save, tests/helpers/mindCamp.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { createGround, findSpot, groundOf, groundStamp } from '../src/game/ground.js';
import { keepFree, standFor, ringCentre, built, hutBegun, PIECE_TIME, RING_R } from '../src/game/leanto.js';
import { bushFactor } from '../src/game/movement.js';
import { createForage, BERRIES, BANANAS } from '../src/game/forage.js';
import { createBranches, EXTRA_ID0 as BRANCH_X, branchesOfTile } from '../src/game/branches.js';
import { createFronds, EXTRA_ID0 as FROND_X, frondsOfTile } from '../src/game/fronds.js';
import { createStones, EXTRA_ID0 as STONE_X, stonesOfTile, STONE_ID0 } from '../src/game/stones.js';
import { createFibre, nutsOfTile, EXTRA_ID0 as COCO_X } from '../src/game/fibre.js';
import { createWood } from '../src/game/wood.js';
import { createLogs, LOG_ID0 } from '../src/game/logs.js';
import { createMind } from '../src/game/mind.js';
import { bushSize } from '../src/world/vegetation.js';
import { serialise, parseSave } from '../src/save.js';
import { campGame } from './helpers/mindCamp.js';

let w, spawn;
beforeAll(async () => { w = await generateWorld(1337); spawn = startSpot(w); }, 120000);

const S1 = { x: -32.2, z: 105.5, heading: 0.8 };   // a lean-to site with a berry bush and two stones under it (found by scan on seed 1337; see `sites` below, which checks it still holds)
const S2 = { x: -37.7, z: 120.5, heading: 0.8 };   // two berry bushes
const HUT_SITE = { x: -122.54, z: 43.85, heading: 0.3 };   // the hut fits here, and a bush lies in the hut's region but not the lean-to's
const BANANA_SITE = { x: -1.18, z: 9.78, heading: 0.3 };   // a banana plant stands at (-1.29, 9.4)
const UP = { walls: 1, bed: 1, ring: 1 };
const at = (c, f, r) => ({ x: c.x + f * Math.sin(c.heading) + r * Math.cos(c.heading), z: c.z + f * Math.cos(c.heading) - r * Math.sin(c.heading) });   // a point in the lean-to's frame (f along the heading, r across)

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
const buildNext = (g, input) => { const o = bigOf(g); expect(o).not.toBeNull(); g.act(o); run(g, input, PIECE_TIME + 0.5); return o; };
const piece = (n, o = {}) => ({ id: 800000 + n, x: spawn.x, y: 1, z: spawn.z, len: 1.5, a: 0, rad: 0.08, ...o });
const give = (g, kind, n = 1) => { for (let i = 0; i < n; i++) (kind === 'stone' ? g.wood.stones : g.wood.carried).push(piece(900 + i + g.wood.carried.length * 7, kind === 'branch' ? { branch: true } : kind === 'frond' ? { frond: true } : kind === 'stone' ? { stone: true, len: 0.26 } : {})); };
const siteGame = (c, opts = {}) => { const s = standFor(c), g = createGame(w, spawn, { sleep: { awake: 0.1 }, player: { x: s.x, z: s.z, heading: c.heading }, ...opts }); return { g, input: makeInput({ yaw: c.heading }) }; };
const tilesAround = (x, z, m = 8) => { const out = new Set(); for (const dx of [-m, 0, m]) for (const dz of [-m, 0, m]) { const t = w.tiles[Math.floor((z + dz + 360) / 40) * 18 + Math.floor((x + dx + 360) / 40)]; if (t) out.add(t); } return [...out]; };
const bushesIn = (c, hut = 0) => { const k = keepFree({ ...c, hut }); return tilesAround(c.x, c.z).flatMap(t => t.bushes).filter(b => Math.hypot(b.x - c.x, b.z - c.z) < 4 && k.touches(b.x, b.z, bushSize(b))); };
const rocksIn = c => { const k = keepFree(c); return tilesAround(c.x, c.z).flatMap(t => t.rocks).filter(r => r.s < 0.35 && Math.hypot(r.x - c.x, r.z - c.z) < 4 && k.touches(r.x, r.z, r.s)); };
const loose = (g, c, m = 12) => ({
  stones: g.stones.near(c.x, c.z, m).filter(s => Math.hypot(s.x - c.x, s.z - c.z) <= m).length,
  branches: g.branches.near(c.x, c.z, m).filter(s => Math.hypot(s.x - c.x, s.z - c.z) <= m).length,
  fronds: g.fronds.near(c.x, c.z, m).filter(s => Math.hypot(s.x - c.x, s.z - c.z) <= m).length,
  drift: g.wood.near(c.x, c.z, m).filter(l => !l.branch && !l.frond && !l.stone && !l.timber && g.wood.onBeach(l) && Math.hypot(l.x - c.x, l.z - c.z) <= m).length,
  logs: g.logs.near(c.x, c.z, m).filter(l => Math.hypot(l.x - c.x, l.z - c.z) <= m).length,
  cocos: tilesAround(c.x, c.z, m).flatMap(t => g.fibre.groundCocos(t)).filter(l => Math.hypot(l.x - c.x, l.z - c.z) <= m).length,
});
const allLoose = (g, c) => [...g.stones.near(c.x, c.z, 8), ...g.branches.near(c.x, c.z, 8), ...g.fronds.near(c.x, c.z, 8), ...g.wood.near(c.x, c.z, 8).filter(l => !l.branch && !l.frond && !l.stone && !l.timber && g.wood.onBeach(l)), ...g.logs.near(c.x, c.z, 8)];

describe('the sites of these tests still hold what they were chosen for', () => {
  it('S1 has a berry bush and two stones in its region, S2 two berry bushes, the hut site a bush only the hut region touches, the banana site a banana plant', () => {
    const g = createGame(w, spawn, {}), n = (c, f) => tilesAround(c.x, c.z).flatMap(t => f.plantsIn(t)).filter(p => keepFree(c).touches(p.x, p.z, p.r)).length;
    expect(g.siteFits(S1)).toBe(true); expect(g.siteFits(S2)).toBe(true); expect(g.siteFits(BANANA_SITE)).toBe(true);
    expect(bushesIn(S1).length).toBeGreaterThanOrEqual(1); expect(n(S1, g.berries)).toBeGreaterThanOrEqual(1);
    expect(tilesAround(S1.x, S1.z).flatMap(t => stonesOfTile(w, t)).filter(s => keepFree(S1).touches(s.x, s.z, 0.1)).length).toBe(2);
    expect(n(S2, g.berries)).toBe(2); expect(n(BANANA_SITE, g.bananas)).toBe(1);
    expect(g.hutFits({ id: 9, ...HUT_SITE, progress: 1, up: UP })).toBe(true);
    expect(bushesIn(HUT_SITE, 1).length).toBeGreaterThan(bushesIn(HUT_SITE, 0).length);
  });
});

describe('game/ground: the overlay', () => {
  it('covers what touches a cleared region, says which bushes and small rocks are gone, and nothing without a region', () => {
    const g = createGround(w), b = bushesIn(S1)[0];
    expect(g.covers(S1.x, S1.z)).toBe(false); expect(g.bushGone(b)).toBe(false); expect(g.coversPiece({ x: S1.x, z: S1.z, len: 1, a: 0, rad: 0.1 })).toBe(false);
    const v0 = g.version, s0 = groundStamp(w); g.add(S1);
    expect(g.version).toBe(v0 + 1); expect(groundStamp(w)).not.toBe(s0); expect(groundOf(w)).toBe(g);
    expect(g.covers(S1.x, S1.z)).toBe(true); expect(g.covers(at(S1, 0.2, 0.9).x, at(S1, 0.2, 0.9).z)).toBe(true);
    expect(g.covers(at(S1, 0, 3).x, at(S1, 0, 3).z)).toBe(false); expect(g.covers(at(S1, 0, 1.4).x, at(S1, 0, 1.4).z, 0.2)).toBe(true); expect(g.covers(at(S1, 0, 1.6).x, at(S1, 0, 1.6).z, 0.2)).toBe(false);
    expect(g.bushGone(b)).toBe(true);
    expect(g.rockGone({ x: S1.x, z: S1.z, s: 0.2 }, 0.35)).toBe(true); expect(g.rockGone({ x: S1.x, z: S1.z, s: 0.5 }, 0.35)).toBe(false);   // a boulder is no small rock
    const p = at(S1, 0, 2.4); expect(g.coversPiece({ x: p.x, z: p.z, len: 0, a: 0, rad: 0.05 })).toBe(false);
    expect(g.coversPiece({ x: p.x, z: p.z, len: 3.6, a: Math.atan2(-Math.sin(S1.heading), Math.cos(S1.heading)) + 0.0, rad: 0.05 })).toBeTypeOf('boolean');
    expect(g.dirty.size).toBeGreaterThan(0);
    for (const k of g.dirty) expect(k).toBeGreaterThanOrEqual(0);
  });
  it('the hut region is larger than the lean-to region, and the state round-trips', () => {
    const g = createGround(w), q = at(HUT_SITE, -1.7, 0);
    g.add(HUT_SITE); expect(g.covers(q.x, q.z)).toBe(false);
    g.add({ ...HUT_SITE, hut: 1 }); expect(g.covers(q.x, q.z)).toBe(true);
    const st = JSON.parse(JSON.stringify(g.state())), h = createGround(w, st);
    expect(h.list.length).toBe(2); expect(h.covers(q.x, q.z)).toBe(true); expect(h.list[1].hut).toBe(1); expect(h.state()).toEqual(st);
    expect(createGround(w, { list: [{ x: 'a' }, null, { x: 1, z: 2, heading: 0 }] }).list.length).toBe(1);   // a bad entry is dropped
  });
  it('findSpot gives a spot outside every region, at the piece\'s angle or a quarter turn, that the first rule that fits accepts', () => {
    const g = createGround(w); g.add(S1);
    const p = { x: S1.x, z: S1.z, len: 1.6, a: 0.4, rad: 0.08 }, s = findSpot(g, p, [() => true]);
    expect(s).not.toBeNull();
    const ca = Math.cos(s.a), sa = Math.sin(s.a);
    for (const u of [-0.8, 0, 0.8]) expect(g.covers(s.x + ca * u, s.z + sa * u, 0.08)).toBe(false);
    expect(Math.hypot(s.x - S1.x, s.z - S1.z)).toBeLessThan(4);
    expect(findSpot(g, p, [() => true])).toEqual(s);   // deterministic
    const only = findSpot(g, p, [() => false, (x, z) => Math.hypot(x - s.x, z - s.z) < 1.5]);   // the first rule refuses everything: the second one decides
    expect(only).not.toBeNull(); expect(Math.hypot(only.x - s.x, only.z - s.z)).toBeLessThan(2.5);
    expect(findSpot(g, p, [() => false])).toBeNull();
    const crowded = findSpot(g, { x: S1.x, z: S1.z, len: 0, a: 0, rad: 0.1 }, [() => true], [{ x: s.x, z: s.z, len: 0 }]);
    expect(crowded).not.toBeNull();
  });
});

describe('bushes: a cleared bush slows no step', () => {
  it('bushFactor is below 1 in the middle of a bush and 1 once a building cleared it; the world\'s own bushes are untouched', () => {
    const b = bushesIn(S1)[0], n0 = w.tiles.reduce((n, t) => n + t.bushes.length, 0);
    createGame(w, spawn, {});   // a game with no cleared ground: the registry holds its empty overlay
    expect(bushFactor(w, b.x, b.z)).toBeLessThan(1);
    const g = createGame(w, spawn, { ground: { list: [{ x: S1.x, z: S1.z, heading: S1.heading, hut: 0 }] } });
    expect(g.ground.list.length).toBe(1);
    for (const q of bushesIn(S1)) expect(bushFactor(w, q.x, q.z), 'a bush under the region').toBe(1);
    expect(w.tiles.reduce((n, t) => n + t.bushes.length, 0)).toBe(n0);
    const far = w.tiles.flatMap(t => t.bushes).find(q => Math.hypot(q.x - S1.x, q.z - S1.z) > 10 && Math.hypot(q.x - S1.x, q.z - S1.z) < 40 && bushFactor(w, q.x, q.z) < 1);
    if (far) expect(bushFactor(w, far.x, far.z)).toBeLessThan(1);   // a bush elsewhere still slows
    createGame(w, spawn, {});
    expect(bushFactor(w, b.x, b.z)).toBeLessThan(1);   // a new game on the same world has its own (empty) overlay
  });
});

describe('moving loose pieces (each module), nothing lost', () => {
  const c = S1, inside = at(c, 0, 0), spot = at(c, -3.5, 0);
  it('branches: an extra moves itself, a tree\'s branch is taken for good and an extra lies at the new place; neither grows back in a cleared region; saved', () => {
    const t = w.tiles.find(q => q.trees.length && branchesOfTile(w, q).length), orig = branchesOfTile(w, t)[0];
    const b = createBranches(w, null), x = b.addExtra({ x: inside.x, z: inside.z, len: 1, a: 0.5, rad: 0.05 });
    const m = b.move(x, spot.x, spot.z, 1.1); expect(m).toBe(x); expect(m).toMatchObject({ x: spot.x, z: spot.z, a: 1.1, extra: true });
    expect(b.groundBranches(w.tiles[Math.floor((spot.z + 360) / 40) * 18 + Math.floor((spot.x + 360) / 40)])).toContain(x);
    const n = b.move(orig, spot.x + 1, spot.z, undefined, 0.3); expect(n.extra).toBe(true); expect(b.onGround(orig)).toBe(false); expect(n).toMatchObject({ x: spot.x + 1, len: orig.len, rad: orig.rad });
    expect(b.move(orig, 0, 0)).toBeNull();   // gone from where it lay
    const r = createBranches(w, JSON.parse(JSON.stringify(b.state())));
    expect([...(r.state().extra || [])].length).toBe(2); expect(r.onGround(orig)).toBe(false);
    // regrowth: a taken branch comes back after its days, unless its spot lies under a cleared region
    const g = createGround(w), free = createBranches(w, null, null, g), blocked = createBranches(w, null, null, g);
    free.take(orig, 0); blocked.take(orig, 0); g.add({ x: orig.x, z: orig.z, heading: 0 });
    free.update(30); expect(free.onGround(orig)).toBe(false);   // (this overlay holds the region now: it stays gone)
    const plain = createBranches(w, null); plain.take(orig, 0); plain.update(30); expect(plain.onGround(plain.piece(orig.id))).toBe(true);
  });
  it('fronds: the same', () => {
    const t = w.tiles.find(q => q.palms.length && frondsOfTile(w, q).length), orig = frondsOfTile(w, t)[0];
    const f = createFronds(w, null), x = f.addExtra({ x: inside.x, z: inside.z, len: 1.4, a: 0.2 });
    expect(f.move(x, spot.x, spot.z)).toBe(x); expect(x).toMatchObject({ x: spot.x, z: spot.z });
    const n = f.move(orig, spot.x + 1, spot.z, 0.7, 0.1); expect(n.extra).toBe(true); expect(f.onGround(orig)).toBe(false);
    const r = createFronds(w, JSON.parse(JSON.stringify(f.state()))); expect(r.state().extra.length).toBe(2); expect(r.onGround(orig)).toBe(false);
    const g = createGround(w), kept = createFronds(w, null, null, g); kept.take(orig, 0); g.add({ x: orig.x, z: orig.z, heading: 0 }); kept.update(30); expect(kept.onGround(orig)).toBe(false);
    const plain = createFronds(w, null); plain.take(orig, 0); plain.update(30); expect(plain.onGround(orig)).toBe(true);
  });
  it('stones: a generated stone is taken for good and an extra (a new id above every tile\'s) lies at the new place, an extra moves itself; saved and restored; counts unchanged', () => {
    const t = w.tiles.find(q => stonesOfTile(w, q).length), orig = stonesOfTile(w, t)[0], s = createStones(w, null);
    const n0 = s.near(orig.x, orig.z, 6).length;
    const m = s.move(orig, orig.x + 1.2, orig.z + 1.2, 2.2); expect(m.extra).toBe(true); expect(m.id).toBeGreaterThanOrEqual(STONE_X); expect(STONE_X).toBeGreaterThan(STONE_ID0); expect(m).toMatchObject({ len: orig.len, rad: orig.rad, a: 2.2, stone: true });
    expect(s.onGround(orig)).toBe(false); expect(s.version).toBeGreaterThan(0); expect(s.dirty.size).toBeGreaterThan(0);
    expect(s.near(orig.x, orig.z, 6).length).toBe(n0);
    const m2 = s.move(m, m.x + 0.5, m.z); expect(m2).toBe(m);
    expect(s.move(orig, 0, 0)).toBeNull();
    const r = createStones(w, JSON.parse(JSON.stringify(s.state())));
    expect(r.piece(m.id)).toMatchObject({ x: m.x, z: m.z, stone: true, extra: true }); expect(r.onGround(orig)).toBe(false); expect(r.near(orig.x, orig.z, 6).length).toBe(n0);
    expect(r.take(r.piece(m.id))).toBe(true); expect(r.near(orig.x, orig.z, 6).length).toBe(n0 - 1);
    expect(createStones(w, { taken: [], extra: [[5, 1, 2, 3, 4, 5], [STONE_X, 'x', 2, 3, 4, 5]] }).piece(STONE_X)).toBeNull();   // a bad entry is dropped
  });
  it('coconuts: a nut of a palm is taken for good and an extra lies at the new place; a taken nut under a cleared region does not fall again; saved', () => {
    const t = w.tiles.find(q => nutsOfTile(w, q).length), orig = nutsOfTile(w, t)[0], f = createFibre(w, null);
    const m = f.move(orig, inside.x, inside.z, 0.4); expect(m.extra).toBe(true); expect(m.id).toBeGreaterThanOrEqual(COCO_X); expect(f.onGround(orig)).toBe(false); expect(f.carried).toBe(0);
    const m2 = f.move(m, spot.x, spot.z); expect(m2).toBe(m); expect(m).toMatchObject({ x: spot.x, z: spot.z });
    const r = createFibre(w, JSON.parse(JSON.stringify(f.state()))); expect(r.state().extra.length).toBe(1); expect(r.onGround(orig)).toBe(false);
    const g = createGround(w), kept = createFibre(w, null, null, g); kept.take(orig, 0); g.add({ x: orig.x, z: orig.z, heading: 0 }); kept.update(60); expect(kept.onGround(orig)).toBe(false);
    const plain = createFibre(w, null); plain.take(orig, 0); plain.update(60); expect(plain.onGround(orig)).toBe(true);
  });
  it('driftwood: a washed-up log moves itself; a first log of the world is lost for good and a new washed-up log (new id, same shape and wetness) lies at the new place; saved and restored', () => {
    const tile = w.tiles.find(q => q.drift && q.drift.length > 1), l = tile.drift[0], wd = createWood(w, null);
    const k = Math.floor((l.z + 360) / 40) * 18 + Math.floor((l.x + 360) / 40), n0 = wd.beachLogs(tile).length;
    const nx = l.x + 3, nz = l.z + 3, m = wd.relocate(l, nx, nz, 1.3);
    expect(m.id).not.toBe(l.id); expect(m).toMatchObject({ x: nx, z: nz, len: l.len, rad: l.rad, a: 1.3 }); expect(wd.onBeach(l)).toBe(false);
    expect(wd.dirty.has(k)).toBe(true); expect(wd.state().lost).toContain(l.id);
    const moved = wd.relocate(m, nx + 1, nz);   // washed-up: moves itself (a copy that keeps the id)
    expect(moved.id).toBe(m.id); expect(moved).toMatchObject({ x: nx + 1, z: nz, len: l.len });
    const r = createWood(w, JSON.parse(JSON.stringify(wd.state())));
    expect(r.onBeach(l)).toBe(false); expect(r.state().washed.find(q => q.id === m.id)).toMatchObject({ x: nx + 1, z: nz, len: l.len });
    expect(wd.relocate(l, 0, 0)).toBeNull();
    expect(wd.relocate({ id: 5, branch: true, x: 0, z: 0 }, 1, 1)).toBeNull();   // not driftwood
    expect(wd.beachLogs(tile).length + w.tiles.reduce((s, q) => s + wd.beachLogs(q).length, 0) - wd.beachLogs(tile).length).toBeGreaterThan(0);
    expect(n0).toBeGreaterThan(0);
  });
  it('felled logs: a lying log is moved in place and saved', () => {
    const lg = createLogs(w, null), l = lg.add({ x: inside.x, z: inside.z, len: 2, a: 0, rad: 0.12 });
    expect(l.id).toBeGreaterThanOrEqual(LOG_ID0);
    expect(lg.move(l, spot.x, spot.z, 0.9)).toBe(l); expect(l).toMatchObject({ x: spot.x, z: spot.z, a: 0.9 });
    expect(lg.near(spot.x, spot.z, 1)).toContain(l); expect(lg.near(inside.x, inside.z, 1)).not.toContain(l);
    expect(createLogs(w, JSON.parse(JSON.stringify(lg.state()))).piece(l.id)).toMatchObject({ x: spot.x, z: spot.z });
    lg.take(l); expect(lg.move(l, 0, 0)).toBeNull();
  });
});

describe('the first piece of a lean-to clears the ground (the player)', () => {
  let before, g, input, b0, plants0, stonesIn;
  beforeAll(() => {
    ({ g, input } = siteGame(S1));
    b0 = bushesIn(S1); plants0 = tilesAround(S1.x, S1.z).flatMap(t => g.berries.plantsIn(t)).filter(p => keepFree(S1).touches(p.x, p.z, p.r));
    stonesIn = tilesAround(S1.x, S1.z).flatMap(t => stonesOfTile(w, t)).filter(s => keepFree(S1).touches(s.x, s.z, 0.1));
    expect(b0.length).toBeGreaterThanOrEqual(1); expect(plants0.length).toBeGreaterThanOrEqual(1); expect(stonesIn.length).toBe(2);
    for (const q of b0) expect(bushFactor(w, q.x, q.z)).toBeLessThan(1);   // slows him now
    expect(g.berries.find(plants0[0].x, plants0[0].z, 0.5)).not.toBeNull();
    // loose pieces of every kind lie in the region: they are moved, not lost
    const P = (f, r) => at(S1, f, r);
    g.stones.move(stonesIn[0], P(0, 0.6).x, P(0, 0.6).z);
    g.branches.addExtra({ ...P(-0.5, 0), len: 1, a: 0.3, rad: 0.05 }); g.fronds.addExtra({ ...P(0.3, -0.6), len: 1.4, a: 1.2 }); g.fibre.addExtra({ ...P(0.2, 0.2), a: 0 });
    g.logs.add({ ...P(0.7, 0.2), len: 2, a: 0.5, rad: 0.12 });
    const dr = { id: 800500, x: P(0, 0).x, y: w.H(P(0, 0).x, P(0, 0).z), z: P(0, 0).z, len: 1.6, a: S1.heading + Math.PI / 2, rad: 0.09 }, st = g.wood.state(); st.washed.push(dr);
    // the washed-up log is put in through a fresh wood state: the game is rebuilt with it, the other pieces as placed
    const gs = g.state(); gs.wood = st;
    ({ g, input } = siteGame(S1, gs));
    before = loose(g, S1);
    give(g, 'driftwood'); expect(bigOf(g)).toMatchObject({ kind: 'buildHere', what: 'leanto' });
    expect(g.ground.list.length).toBe(0);
    buildNext(g, input);
  });
  it('adds one region and records what it moved', () => {
    expect(g.leantos.list.length).toBe(1); expect(built(g.leantos.list[0])).toBe(1);
    expect(g.ground.list.length).toBe(1); expect(g.ground.list[0]).toMatchObject({ x: S1.x, z: S1.z, hut: 0 });
    expect(g.ground.last).toMatchObject({ x: S1.x, z: S1.z, hut: 0, stuck: 0 }); expect(g.ground.last.moved).toBeGreaterThanOrEqual(6);
  });
  it('removes the bushes under it (their slowing, their berries) and keeps the island itself unchanged', () => {
    for (const q of b0) { expect(g.ground.bushGone(q)).toBe(true); expect(bushFactor(w, q.x, q.z)).toBe(1); }
    for (const p of plants0) { expect(g.berries.bearing(p)).toBe(false); expect(g.berries.gone(p)).toBe(true); expect(g.berries.find(p.x, p.z, 0.5)).toBeNull(); expect(g.berries.picked.has(p.id)).toBe(false); }
    expect(g.berries.dirty.size).toBeGreaterThan(0); expect(g.ground.dirty.size).toBeGreaterThan(0);
    expect(bushesIn(S1).length).toBe(b0.length);   // the world's lists still hold them
  });
  it('moves every loose piece out (none lies in the region), the counts of every kind unchanged', () => {
    const after = loose(g, S1); expect(after).toEqual(before);
    for (const l of allLoose(g, S1)) expect(g.ground.coversPiece(l), JSON.stringify(l)).toBe(false);
    for (const t of tilesAround(S1.x, S1.z)) for (const c of g.fibre.groundCocos(t)) expect(g.ground.covers(c.x, c.z, 0.12)).toBe(false);
  });
  it('is not done again by the second piece, and a building elsewhere adds a second region', () => {
    const v = g.ground.version; give(g, 'driftwood'); buildNext(g, input);
    expect(built(g.leantos.list[0])).toBe(2); expect(g.ground.version).toBe(v); expect(g.ground.list.length).toBe(1);
  });
  it('is saved with the island and kept across a reload: the same bushes gone, the same stones where they were put, never grown back', () => {
    const text = serialise(g.state()), s = parseSave(text, 1337); expect(s).not.toBeNull(); expect(s.ground.list.length).toBe(1);
    const h = createGame(w, spawn, s);
    expect(h.ground.state()).toEqual(g.ground.state());
    for (const q of b0) expect(bushFactor(w, q.x, q.z)).toBe(1);
    for (const p of plants0) expect(h.berries.bearing(p)).toBe(false);
    expect(loose(h, S1)).toEqual(loose(g, S1));
    for (const l of allLoose(h, S1)) expect(h.ground.coversPiece(l)).toBe(false);
    expect(h.stones.state()).toEqual(g.stones.state()); expect(h.wood.state().washed).toEqual(g.wood.state().washed);
    const later = createGame(w, spawn, { ...s, day: s.day + 20 }); for (let i = 0; i < 20; i++) later.update(makeInput(), 0.05);   // twenty days later: what grows back has grown, the cleared plants never bear again
    for (const p of plants0) expect(later.berries.bearing(p)).toBe(false);
    for (const q of b0) expect(bushFactor(w, q.x, q.z)).toBe(1);
    expect(createGame(w, spawn, {}) && bushFactor(w, b0[0].x, b0[0].z)).toBeLessThan(1);   // (a new game with no cleared ground)
  });
});

describe('a lean-to site with two berry bushes, and a banana plant', () => {
  it('berry bushes: their handfuls are gone with the bushes, a nearby bush outside the region still bears', () => {
    const { g, input } = siteGame(S2), ps = tilesAround(S2.x, S2.z).flatMap(t => g.berries.plantsIn(t)).filter(p => keepFree(S2).touches(p.x, p.z, p.r)), out = tilesAround(S2.x, S2.z).flatMap(t => g.berries.plantsIn(t)).filter(p => !keepFree(S2).touches(p.x, p.z, p.r));
    expect(ps.length).toBe(2); for (const p of ps) expect(g.berries.bearing(p)).toBe(true);
    give(g, 'driftwood'); buildNext(g, input);
    for (const p of ps) { expect(g.berries.bearing(p)).toBe(false); expect(g.berries.pick(p, 1)).toBe(false); }
    for (const p of out.filter(q => !g.ground.bushGone(q.bush))) expect(g.berries.bearing(p)).toBe(true);
  });
  it('banana plants: the plant is gone for good (not even a bare one is drawn), its bunch lost', () => {
    const { g, input } = siteGame(BANANA_SITE), ps = tilesAround(BANANA_SITE.x, BANANA_SITE.z).flatMap(t => g.bananas.plantsIn(t)).filter(p => keepFree(BANANA_SITE).touches(p.x, p.z, p.r));
    expect(ps.length).toBe(1); expect(g.bananas.bearing(ps[0])).toBe(true); expect(g.bananas.gone(ps[0])).toBe(false);
    give(g, 'driftwood'); buildNext(g, input);
    expect(g.bananas.gone(ps[0])).toBe(true); expect(g.bananas.bearing(ps[0])).toBe(false); expect(g.bananas.find(ps[0].x, ps[0].z, 0.5)).toBeNull();
    const h = createGame(w, spawn, parseSave(serialise(g.state()), 1337)); expect(h.bananas.gone(ps[0])).toBe(true);
  });
});

describe('the first part of a hut clears its larger region', () => {
  it('the bush only the hut\'s region touches is gone after the first part and not before; the lean-to region added nothing for it; saved', () => {
    const l = { id: 0, ...HUT_SITE, progress: 1, up: { ...UP } }, s = at(HUT_SITE, 1.6, 0);
    const g = createGame(w, spawn, { sleep: { awake: 0.1 }, leantos: { list: [l], nextId: 1 }, player: { x: s.x, z: s.z, heading: HUT_SITE.heading + Math.PI } });
    const input = makeInput({ yaw: HUT_SITE.heading }), hb = bushesIn(HUT_SITE, 1).filter(b => !bushesIn(HUT_SITE, 0).includes(b));
    expect(hb.length).toBeGreaterThanOrEqual(1); for (const b of hb) expect(bushFactor(w, b.x, b.z)).toBeLessThan(1);
    g.wood.log = { id: LOG_ID0 + 500, x: s.x, y: 1, z: s.z, len: 2, a: 0, rad: 0.12, timber: true };
    expect(bigOf(g)).toMatchObject({ kind: 'upgrade', what: 'hut' }); expect(g.ground.list.length).toBe(0);
    buildNext(g, input);
    const lt = g.leantos.list[0]; expect(hutBegun(lt)).toBe(true); expect(built(lt, 'hut')).toBe(1);
    expect(g.ground.list.length).toBe(1); expect(g.ground.list[0]).toMatchObject({ hut: 1, x: HUT_SITE.x });
    for (const b of hb) { expect(g.ground.bushGone(b)).toBe(true); expect(bushFactor(w, b.x, b.z)).toBe(1); }
    const q = at(HUT_SITE, -1.8, 0); expect(g.ground.covers(q.x, q.z)).toBe(true);
    const v = g.ground.version; g.wood.log = { id: LOG_ID0 + 501, x: s.x, y: 1, z: s.z, len: 2, a: 0, rad: 0.12, timber: true }; buildNext(g, input);
    expect(built(lt, 'hut')).toBe(2); expect(g.ground.version).toBe(v);   // the second part clears nothing more
    const h = createGame(w, spawn, parseSave(serialise(g.state()), 1337)); expect(h.ground.list[0].hut).toBe(1); for (const b of hb) expect(bushFactor(w, b.x, b.z)).toBe(1);
  });
});

describe('Dave builds through the same game: his first piece clears the ground too', () => {
  it('his lean-to at the site he chose: the region is cleared (bushes gone, a stone and a felled log put there are moved out)', () => {
    const site0 = createMind(w, campGame(w, spawn, {})).homePlan().site, P = (f, r) => at(site0, f, r);
    const st = { taken: [], extra: [[STONE_X, P(0, 0.4).x, P(0, 0.4).z, 0.26, 0.3, 0.1]] }, lg = { list: [{ id: LOG_ID0, x: P(0.3, -0.3).x, y: w.H(P(0.3, -0.3).x, P(0.3, -0.3).z), z: P(0.3, -0.3).z, len: 2, a: 0.4, rad: 0.12 }], taken: [] };
    const g = campGame(w, spawn, { extra: { stones: st, logs: lg } }), m = createMind(w, g); m.engage();
    const site = m.homePlan().site; expect(Math.hypot(site.x - site0.x, site.z - site0.z)).toBeLessThan(0.3);
    expect(g.ground.list.length).toBe(0);
    let t = 0; while (t < 4000 && g.leantos.list.length === 0) { m.step(0.1); g.update(m.input, 0.1); t += 0.1; }
    expect(g.leantos.list.length).toBe(1); const l = g.leantos.list[0];
    expect(g.ground.list.length).toBe(1); expect(g.ground.list[0]).toMatchObject({ x: l.x, z: l.z, hut: 0 });
    for (const b of bushesIn(l)) { expect(g.ground.bushGone(b)).toBe(true); expect(bushFactor(w, b.x, b.z)).toBe(1); }
    for (const q of allLoose(g, l)) expect(g.ground.coversPiece(q), JSON.stringify(q)).toBe(false);
    expect(g.ground.last.moved).toBeGreaterThanOrEqual(2);   // the stone and the log (at least)
    expect(g.logs.piece(LOG_ID0)).toBeTruthy(); expect(g.logs.onGround(g.logs.piece(LOG_ID0))).toBe(true);
  });
});

describe('the fire sits in the middle of the stone ring', () => {
  const lt = { id: 0, ...S1, progress: 1, up: { ...UP } }, rc = ringCentre(lt);
  const ringGame = (px, pz, heading, o = {}) => createGame(w, spawn, { sleep: { awake: 0.1 }, leantos: { list: [lt], nextId: 1 }, player: { x: px, z: pz, heading }, fire: { fires: [], burnt: [], attempts: 0, nextId: 0 }, ...o });
  const lay = g => { const i = makeInput(); g.act({ kind: 'lay' }); for (let k = 0; k < 45; k++) g.update(i, 0.05); };   // (the bend down takes PICK_TIME)
  const carry = (g, kind, n) => { for (let i = 0; i < n; i++) g.wood.carried.push({ id: 700000 + i + (kind === 'branch' ? 100 : 0), x: g.player.x, y: 1, z: g.player.z, len: 1, a: 0, rad: 0.08, ...(kind === 'branch' ? { branch: true } : {}) }); };
  it('a driftwood pile laid in the finished ring (its spot, a step in front of him, within the ring) lies exactly at its middle, whatever side he stands and faces', () => {
    for (const [dx, dz, face] of [[0.5, 0, Math.PI], [0, 0.5, 3.5], [-0.4, -0.3, 0.4], [0.3, 0.2, 2]]) {
      const g = ringGame(rc.x + dx, rc.z + dz, face); carry(g, 'driftwood', 3);
      expect(g.leantos.ring(g.player.x, g.player.z)).toBe(true);
      lay(g);
      expect(g.wood.piles.length, `${dx},${dz}`).toBe(1); expect(g.wood.piles[0].x).toBeCloseTo(rc.x, 9); expect(g.wood.piles[0].z).toBeCloseTo(rc.z, 9); expect(g.wood.piles[0].logs.length).toBe(3);
    }
  });
  it('a branch pile too; adding to the pile keeps it there; a pile laid outside the ring is not moved; a ring that is not finished does not pull', () => {
    const g = ringGame(rc.x + 0.5, rc.z, Math.PI); carry(g, 'branch', 2); lay(g);
    expect(g.wood.piles[0]).toMatchObject({ kind: 'branch' }); expect(g.wood.piles[0].x).toBeCloseTo(rc.x, 9);
    g.player.x = rc.x - 0.5; g.player.z = rc.z; carry(g, 'branch', 1); g.wood.carried[0].id = 700555;
    expect(g.wood.drop(g.player.x, g.player.z, 0, false, null, null, g.leantos.ringMiddle)).toBe(true);   // (with a pile beside him the arc offers other things than 'lay'; the wood does the same)
    expect(g.wood.piles.length).toBe(1); expect(g.wood.piles[0].logs.length).toBe(3); expect(g.wood.piles[0].x).toBeCloseTo(rc.x, 9);
    const o = ringGame(rc.x + 4, rc.z + 4, 1); carry(o, 'driftwood', 2); lay(o);
    expect(o.wood.piles.length).toBe(1); expect(Math.hypot(o.wood.piles[0].x - rc.x, o.wood.piles[0].z - rc.z)).toBeGreaterThan(3);
    const half = { ...lt, up: { walls: 1, bed: 1 } }, n = createGame(w, spawn, { sleep: { awake: 0.1 }, leantos: { list: [half], nextId: 1 }, player: { x: rc.x + 0.5, z: rc.z, heading: Math.PI } }); carry(n, 'driftwood', 2); lay(n);
    expect(n.wood.piles.length).toBe(1); expect(Math.hypot(n.wood.piles[0].x - rc.x, n.wood.piles[0].z - rc.z)).toBeGreaterThan(0.2);
  });
  it('a ring with a hut round it takes the pile in its middle too; a full pile there is not moved, the next pile lies beside it', () => {
    const g = ringGame(rc.x + 0.5, rc.z, Math.PI, { leantos: { list: [{ ...lt, hut: 1 }], nextId: 1 } }); carry(g, 'driftwood', 3); lay(g);
    expect(g.wood.piles[0].x).toBeCloseTo(rc.x, 9); expect(g.wood.piles[0].z).toBeCloseTo(rc.z, 9);
    const h = ringGame(rc.x + 0.5, rc.z, Math.PI); carry(h, 'driftwood', 3); h.wood.piles.push({ x: rc.x, z: rc.z, kind: 'driftwood', logs: Array.from({ length: 12 }, (_, i) => piece(300 + i)) }); h.wood.version++;
    lay(h); expect(h.wood.piles.length).toBe(2); expect(h.wood.piles[0].x).toBeCloseTo(rc.x, 9); expect(Math.hypot(h.wood.piles[1].x - rc.x, h.wood.piles[1].z - rc.z)).toBeGreaterThan(0.8);
  });
  it('Dave lays his fuel in the middle of the ring: a stray pile of 12 carried to the ring lights a fire exactly there', () => {
    const g0 = campGame(w, spawn, { day: 2, time: 0.22 }), site = createMind(w, g0).leantoSites({ x: spawn.x, z: spawn.z })[0];
    const hm = { list: [{ id: 0, x: site.x, z: site.z, heading: site.heading, progress: 1, up: { ...UP } }], nextId: 1 }, c = ringCentre(hm.list[0]);
    const g = campGame(w, spawn, { day: 4, time: 0.62, leantos: hm, stocked: false, extra: { fibre: { carried: 3 }, shells: { full: [], nuts: 2 }, fire: { fires: [], burnt: [{ id: 0, x: c.x, z: c.z, left: 2, n: 3 }], attempts: 0, nextId: 1 } }, piles: [{ id: 9, kind: 'driftwood', n: 12, x: c.x + 1.5, z: c.z }] });
    const m = createMind(w, g); m.engage();
    const t0 = g.clock.total, seen = []; let lit = null;
    while (g.clock.total < t0 + 0.4) {
      m.step(0.1); g.update(m.input, 0.1);
      for (const q of g.wood.piles) if (g.leantos.ring(q.x, q.z) && q.kind === 'driftwood') seen.push(Math.hypot(q.x - c.x, q.z - c.z));
      const f = g.fire.fires.find(q => Math.hypot(q.x - c.x, q.z - c.z) <= RING_R + 0.3 && q.fuel > 0.005); if (f && !lit) lit = { x: f.x, z: f.z };
    }
    expect(lit, 'a fire was lit in the ring').not.toBeNull();
    expect(Math.hypot(lit.x - c.x, lit.z - c.z)).toBeLessThan(1e-6);   // exactly in the middle
    for (const d of seen) expect(d === 1.5 || d < 1e-6 || d > 0.5).toBe(true);
  });
});
