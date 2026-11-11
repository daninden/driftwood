// Building piece by piece (0.32 "Piece by piece", part 1): a lean-to and each upgrade is a site with an ordered list of parts, and one visible part is one gathered piece.
// Starting a site with driftwood in the arms ('buildHere'), building in each part ('buildIn', 'upgrade'), the order and the kind each part takes, interruption, the rest it costs,
// the effects only when finished, the collision from the first roof branch, upgrades and their order, old saves, the flood, saving, and the parts the drawing shows.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { branchesOfTile } from '../src/game/branches.js';
import { frondsOfTile } from '../src/game/fronds.js';
import { stonesOfTile } from '../src/game/stones.js';
import { keepFree, PARTS, PIECE_TIME, BUILD_COST, UP_COST, SITE_AT, SITE_APART, UP_ORDER, UPGRADES, createLeantos, built, nextKind, upgradeFor, pieceFor, solid, siteAt, standFor, pieceCost } from '../src/game/leanto.js';
import { FIRST_HIGH, PERIOD } from '../src/game/tide.js';
import { serialise, parseSave } from '../src/save.js';
import { leantoParts, leantoFronds, wallFronds, bedParts, ringStones, ROOF_N, FROND_N, WALL_N, BED_N, RING_N } from '../src/render/leanto.js';
import { YAW } from '../src/core/view.js';
import { createPath } from '../src/game/path.js';
import { buttonIcons } from '../src/render/actionButton.js';

let w, spawn, drift, branches, fronds, stones;
beforeAll(async () => {
  w = await generateWorld(1337); spawn = startSpot(w);
  const d = o => Math.hypot(o.x - spawn.x, o.z - spawn.z), by = (a, b) => d(a) - d(b);
  drift = w.tiles.flatMap(t => t.drift).sort(by);
  branches = w.tiles.flatMap(t => t.trees.length ? branchesOfTile(w, t) : []).sort(by);
  fronds = w.tiles.flatMap(t => frondsOfTile(w, t)).sort(by);
  stones = w.tiles.flatMap(t => stonesOfTile(w, t)).sort(by);
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
const run = (g, input, s, dt = 1 / 30) => { if (input.big) { input.big = false; g.act(bigOf(g)); } for (let t = 0; t < s; t += dt) g.update(input, dt); };
const SRC = { driftwood: () => drift, branch: () => branches, frond: () => fronds, stone: () => stones };
let used = 0;
const piece = kind => SRC[kind]()[used++ % 40 + 3];   // a fresh-looking piece of that kind (never two alike in one test run of the helper)
const give = (g, kind, n = 1) => { for (let i = 0; i < n; i++) (kind === 'stone' ? g.wood.stones : g.wood.carried).push({ ...piece(kind) }); };
// build the next piece with the arc's icon and wait for it; returns the option used
const buildNext = (g, input) => { const o = bigOf(g); expect(o).not.toBeNull(); g.act(o); run(g, input, PIECE_TIME + 0.5); return o; };
const FLAT = (yaw = 0.8) => { const g = createGame(w, spawn, { sleep: { awake: 0.1 } }); return { g, input: makeInput({ yaw }) }; };
const finishedAt = (x, z, up) => ({ list: [{ id: 0, x, z, heading: 0, progress: 1, ...(up ? { up } : {}) }], nextId: 1 });

describe('the recipe: one visible part, one gathered piece', () => {
  it('a lean-to is 4 driftwood, 6 branches and 5 fronds (15 pieces); walls 6 fronds; a bed 4 branches then 4 fronds; a ring 8 stones', () => {
    expect(PARTS.leanto).toEqual([...Array(4).fill('driftwood'), ...Array(6).fill('branch'), ...Array(5).fill('frond')]);
    expect(PARTS.walls).toEqual(Array(6).fill('frond'));
    expect(PARTS.bed).toEqual([...Array(4).fill('branch'), ...Array(4).fill('frond')]);
    expect(PARTS.ring).toEqual(Array(8).fill('stone'));
    expect(UPGRADES.walls.steps).toBe(6); expect(UPGRADES.bed.steps).toBe(8); expect(UPGRADES.ring.steps).toBe(8);
  });
  it('the drawing shows exactly the parts: every step of progress adds one visible part, and the counts are the recipe', () => {
    const l = { id: 1, x: spawn.x, z: spawn.z, heading: 0.5, progress: 0 }, H = w.H;
    const count = p => { const parts = leantoParts(H, l, p), keys = k => parts.filter(s => s.key === k).length; return { post: keys('post'), fork: keys('fork'), ridge: keys('ridge'), sill: keys('sill'), roof: keys('roof'), fronds: leantoFronds(H, l, p).length }; };
    const total = c => c.post + c.ridge + c.sill + c.roof + c.fronds;
    let last = 0;
    for (let k = 0; k <= 15; k++) { const c = count(k === 15 ? 1 : k / 15), t = total(c); expect(t).toBe(k); expect(t - last).toBeLessThanOrEqual(1); last = t; expect(c.fork).toBe(c.post); }
    expect(count(1)).toEqual({ post: 2, fork: 2, ridge: 1, sill: 1, roof: ROOF_N, fronds: FROND_N });
    expect(ROOF_N).toBe(6); expect(FROND_N).toBe(5);
    expect(count(1 / 15).post).toBe(1); expect(count(4 / 15).sill).toBe(1); expect(count(3 / 15).sill).toBe(0); expect(count(5 / 15).roof).toBe(1); expect(count(10 / 15).fronds).toBe(0); expect(count(11 / 15).fronds).toBe(1);
    expect(wallFronds(H, l, 1).length).toBe(2 * WALL_N); expect(2 * WALL_N).toBe(PARTS.walls.length);
    for (let k = 0; k <= 6; k++) expect(wallFronds(H, l, k === 6 ? 1 : k / 6).length).toBe(k);
    expect(BED_N + 4).toBe(PARTS.bed.length); expect(RING_N).toBe(PARTS.ring.length);
    for (let k = 0; k <= 8; k++) {
      const p = k === 8 ? 1 : k / 8, b = bedParts(H, l, p);
      expect(new Set(b.sticks.map(s => s.part)).size + b.fronds.length).toBe(k);   // a rail (with its legs) is one part, a slat is one, a frond is one
      expect(ringStones(H, l, p).length).toBe(k);
    }
  });
  it('whole parts only: the rest cost of a lean-to is BUILD_COST in all, of an upgrade UP_COST', () => {
    expect(pieceCost('leanto') * 15).toBeCloseTo(BUILD_COST, 9);
    for (const k of UP_ORDER) expect(pieceCost(k) * PARTS[k].length).toBeCloseTo(UP_COST, 9);
    expect(PIECE_TIME * 15).toBe(60);
  });
});

describe('the rules of a site (pure)', () => {
  it('built, nextKind and pieceFor follow the order', () => {
    const l = { progress: 0 };
    expect(nextKind(l)).toBe('driftwood'); expect(pieceFor(l, 'driftwood')).toBe('leanto'); expect(pieceFor(l, 'branch')).toBeNull();
    l.progress = 4 / 15; expect(built(l)).toBe(4); expect(nextKind(l)).toBe('branch'); expect(pieceFor(l, 'driftwood')).toBeNull(); expect(pieceFor(l, 'branch')).toBe('leanto');
    l.progress = 10 / 15; expect(nextKind(l)).toBe('frond'); l.progress = 14 / 15; expect(built(l)).toBe(14); expect(nextKind(l)).toBe('frond');
    l.progress = 1; expect(nextKind(l)).toBeNull(); expect(pieceFor(l, 'frond')).toBe('walls'); expect(pieceFor(l, 'branch')).toBe('bed'); expect(pieceFor(l, 'stone')).toBe('ring'); expect(pieceFor(l, 'driftwood')).toBeNull();
  });
  it('a frond goes to the walls first, then to the bed once its four branches are in, a branch to the bed', () => {
    const l = { progress: 1, up: {} };
    expect(upgradeFor(l, 'frond')).toBe('walls'); expect(upgradeFor(l, 'branch')).toBe('bed');
    l.up = { bed: 4 / 8 }; expect(upgradeFor(l, 'branch')).toBeNull(); expect(upgradeFor(l, 'frond')).toBe('walls');   // the bed's branches are all in: it wants fronds, but the walls come first
    l.up = { bed: 4 / 8, walls: 1 }; expect(upgradeFor(l, 'frond')).toBe('bed');
    l.up = { bed: 1, walls: 1, ring: 1 }; for (const k of ['driftwood', 'branch', 'frond', 'stone']) expect(upgradeFor(l, k)).toBeNull();
    expect(upgradeFor({ progress: 0.9 }, 'frond')).toBeNull();
  });
  it('a new site lies SITE_AT behind him, the open side to the camera, and he stands in front of it', () => {
    const c = siteAt(10, 20, 0.8); expect(Math.hypot(c.x - 10, c.z - 20)).toBeCloseTo(SITE_AT, 9); expect(c.heading).toBe(0.8);
    const s = standFor(c); expect(s.x).toBeCloseTo(10, 9); expect(s.z).toBeCloseTo(20, 9);
  });
  it('is solid from the first roof branch on', () => {
    expect(solid({ progress: 4 / 15 })).toBe(false); expect(solid({ progress: 5 / 15 })).toBe(true); expect(solid({ progress: 1 })).toBe(true);
  });
  it('build() adds one part at a time, refuses an upgrade of an unfinished lean-to and a finished site', () => {
    const lt = createLeantos(w), l = lt.start(0, 0, 0);
    expect(lt.build(l, 'walls')).toBeNull();
    const kinds = []; for (let i = 0; i < 15; i++) kinds.push(lt.build(l));
    expect(kinds).toEqual(PARTS.leanto); expect(l.progress).toBe(1); expect(lt.build(l)).toBeNull();
    const w6 = []; for (let i = 0; i < 6; i++) w6.push(lt.build(l, 'walls')); expect(w6).toEqual(PARTS.walls); expect(lt.has(l, 'walls')).toBe(true); expect(lt.build(l, 'walls')).toBeNull();
    expect(lt.build(l, 'moat')).toBeNull();
  });
});

describe('starting a site with driftwood in the arms', () => {
  it('offers "build here" (a lean-to icon) with driftwood under his arm, and not with a branch, a frond, a stone or nothing', () => {
    const { g } = FLAT();
    expect(bigOf(g)).toBeNull();
    give(g, 'branch'); expect(bigOf(g) && bigOf(g).kind).not.toBe('buildHere');
    g.wood.carried.length = 0; give(g, 'frond'); expect(bigOf(g) && bigOf(g).kind).not.toBe('buildHere');
    g.wood.carried.length = 0; give(g, 'stone'); expect(bigOf(g) && bigOf(g).kind).not.toBe('buildHere');
    g.wood.stones.length = 0; give(g, 'driftwood');
    const o = bigOf(g); expect(o).toMatchObject({ kind: 'buildHere', what: 'leanto', piece: 'driftwood' });
    expect(buttonIcons(g.action()).options.some(i => i.key === 'leanto' && /lean-to/i.test(i.label))).toBe(true);
  });
  it('builds the first piece at once: the site appears after PIECE_TIME, with the open side to the camera and the middle SITE_AT behind him; the piece is used up', () => {
    const { g, input } = FLAT(1.0); give(g, 'driftwood', 2);
    const px = g.player.x, pz = g.player.z;
    input.big = true; run(g, input, 1);
    expect(g.player.work).toMatchObject({ kind: 'build' }); expect(g.leantos.list.length).toBe(0); expect(g.wood.carried.length).toBe(2);   // kneeling: nothing yet
    run(g, input, PIECE_TIME);
    expect(g.player.work).toBeNull(); expect(g.wood.carried.length).toBe(1); expect(g.leantos.list.length).toBe(1);
    const l = g.leantos.list[0];
    expect(l.heading).toBe(1.0); expect(l.x).toBeCloseTo(px - Math.sin(1.0) * SITE_AT, 5); expect(l.z).toBeCloseTo(pz - Math.cos(1.0) * SITE_AT, 5);
    expect(built(l)).toBe(1); expect(l.progress).toBeCloseTo(1 / 15, 9);
  });
  it('takes the heading from the starting view when the input has none', () => {
    const g = createGame(w, spawn); give(g, 'driftwood'); const input = makeInput({ big: true }); run(g, input, PIECE_TIME + 1);
    expect(g.leantos.list[0].heading).toBe(YAW); expect(g.yaw()).toBe(YAW);
  });
  it('works with F too', () => {
    const { g, input } = FLAT(); give(g, 'driftwood'); input.hold = { key: true }; run(g, input, PIECE_TIME + 1);
    expect(g.leantos.list.length).toBe(1);
  });
  it('is not offered in the water, on wet sand of the flood, or where a pile, a trunk or another site is in the way', () => {
    const { g } = FLAT(); give(g, 'driftwood');
    expect(g.siteFits(siteAt(g.player.x, g.player.z, 0.8))).toBe(true);
    const c = siteAt(g.player.x, g.player.z, 0.8);
    g.wood.piles.push({ x: c.x + 0.2, z: c.z, kind: 'driftwood', logs: [{ ...drift[5] }] });   // a pile of firewood in the walls
    expect(g.siteFits(c)).toBe(false);
    expect(bigOf(g) && bigOf(g).kind).not.toBe('buildHere');
    g.wood.piles.length = 0; expect(g.siteFits(c)).toBe(true);
    g.leantos.start(c.x + SITE_APART - 0.1, c.z, 0); expect(g.siteFits(c)).toBe(false);
    const sea = createGame(w, { x: spawn.x - 400, z: spawn.z, y: 0 }); expect(sea.siteFits({ x: spawn.x - 400, z: spawn.z, heading: 0 })).toBe(false);
  });
  it('building piles no longer build: two piles of 6 beside him offer no lean-to, only the fire', () => {
    const g = createGame(w, spawn, { wood: { carried: [], piles: [{ x: spawn.x + 0.4, z: spawn.z, kind: 'driftwood', logs: drift.slice(0, 8).map(l => l.id) }, { x: spawn.x + 0.4, z: spawn.z + 1.8, kind: 'branch', logs: branches.slice(0, 8).map(l => l.id) }] }, fibre: { carried: 2 } });
    const o = bigOf(g); expect(o && o.kind).toBe('light');
    for (const x of g.actions()) expect(['build', 'buildHere', 'buildIn', 'upgrade']).not.toContain(x.kind);
  });
});

describe('building the lean-to piece by piece', () => {
  it('builds all 15 parts in order: driftwood, then branches, then fronds, each in PIECE_TIME, a part per press', () => {
    const { g, input } = FLAT(0.6); const t0 = g.clock.total, a0 = g.sleep.awake;
    give(g, 'driftwood');
    buildNext(g, input);   // buildHere
    const l = g.leantos.list[0];
    for (let k = 1; k < 15; k++) {
      const kind = PARTS.leanto[k];
      if (!g.wood.carried.some(p => (p.branch ? 'branch' : p.frond ? 'frond' : 'driftwood') === kind)) give(g, kind);
      expect(nextKind(l)).toBe(kind);
      const o = buildNext(g, input); expect(o).toMatchObject({ kind: 'buildIn', what: 'leanto', piece: kind, leanto: l });
      expect(built(l)).toBe(k + 1);
      expect(l.progress < 1 || k === 14).toBe(true);
    }
    expect(l.progress).toBe(1); expect(g.wood.carried.length).toBe(0);
    const days = g.clock.total - t0, tired = g.sleep.awake - a0 - days;
    expect(tired).toBeCloseTo(BUILD_COST, 1);   // all 15 pieces cost what the whole lean-to cost before
    expect(days * 86400).toBeGreaterThan(14 * PIECE_TIME);   // fifteen kneelings
    expect(bigOf(g)).toBeNull();
  });
  it('takes only the kind the next part needs: a branch is not built in at the driftwood stage, driftwood not at the branch stage', () => {
    const { g, input } = FLAT(); give(g, 'driftwood'); buildNext(g, input);
    const l = g.leantos.list[0];
    g.wood.carried.length = 0; give(g, 'branch');
    expect(bigOf(g)).toBeNull();
    g.wood.carried.length = 0; give(g, 'driftwood', 3); for (let i = 0; i < 3; i++) buildNext(g, input);
    expect(built(l)).toBe(4); expect(bigOf(g)).toBeNull();   // driftwood is done
    give(g, 'driftwood'); expect(bigOf(g)).toBeNull();
    g.wood.carried.length = 0; give(g, 'frond'); expect(bigOf(g)).toBeNull();   // the roof branches come before the fronds
    give(g, 'branch'); expect(bigOf(g)).toMatchObject({ kind: 'buildIn', piece: 'branch' });
    run(g, input, 0); const before = g.wood.carried.map(p => !!p.frond);
    buildNext(g, input); expect(g.wood.carried.map(p => !!p.frond)).toEqual(before.filter(f => f));   // the branch went, the frond stayed
  });
  it('builds in from the arm even when a different piece lies on top', () => {
    const { g, input } = FLAT(); give(g, 'driftwood'); buildNext(g, input);
    give(g, 'driftwood'); give(g, 'frond'); give(g, 'branch');   // the frond and the branch are on top
    buildNext(g, input); expect(built(g.leantos.list[0])).toBe(2); expect(g.wood.carried.length).toBe(2); expect(g.wood.carried.every(p => p.frond || p.branch)).toBe(true);
  });
  it('is stopped by walking: nothing is built and the piece is kept; he can start the part again', () => {
    const { g, input } = FLAT(); give(g, 'driftwood'); buildNext(g, input);
    const l = g.leantos.list[0]; give(g, 'driftwood');
    input.big = true; run(g, input, 2); expect(g.player.work).toMatchObject({ kind: 'build' });
    input.up = true; g.update(input, 1 / 30); input.up = false;
    expect(g.player.work).toBeNull(); run(g, input, PIECE_TIME + 1);
    expect(built(l)).toBe(1); expect(g.wood.carried.length).toBe(1);
    g.player.x = l.x + Math.sin(l.heading) * 1.2; g.player.z = l.z + Math.cos(l.heading) * 1.2;
    buildNext(g, input); expect(built(l)).toBe(2); expect(g.wood.carried.length).toBe(0);
    // an interrupted first piece makes no site at all
    const h = FLAT(); give(h.g, 'driftwood'); h.input.big = true; run(h.g, h.input, 2); h.input.up = true; h.g.update(h.input, 1 / 30); h.input.up = false; run(h.g, h.input, PIECE_TIME + 1);
    expect(h.g.leantos.list.length).toBe(0); expect(h.g.wood.carried.length).toBe(1);
  });
  it('builds in from beside the lean-to when he walks to it first: the icon walks to a spot within reach', () => {
    const { g, input } = FLAT(); give(g, 'driftwood'); buildNext(g, input);
    const l = g.leantos.list[0]; give(g, 'driftwood');
    g.player.x = l.x + Math.sin(l.heading) * 1.65; g.player.z = l.z + Math.cos(l.heading) * 1.65;
    expect(bigOf(g)).toMatchObject({ kind: 'buildIn' });
    g.player.x = l.x + Math.sin(l.heading) * 3; g.player.z = l.z + Math.cos(l.heading) * 3; expect(bigOf(g)).toBeNull();
    g.player.x = l.x + Math.sin(l.heading) * 3; g.player.z = l.z + Math.cos(l.heading) * 3;
    const stand = g.stand.plan('buildIn', l, createPath(w, { obstacles: g.movement.obstacles }), g.player);
    expect(stand).toBeTruthy(); expect(Math.hypot(stand.x - l.x, stand.z - l.z)).toBeLessThanOrEqual(1.7);
  });
  it('a route planned before the lean-to turned solid does not go through its walls afterwards (the fine links are made again when the circles appear)', () => {
    const { g, input } = FLAT(); give(g, 'driftwood'); buildNext(g, input);
    const l = g.leantos.list[0], f = (d, r = 0) => ({ x: l.x + Math.sin(l.heading) * d + Math.cos(l.heading) * r, z: l.z + Math.cos(l.heading) * d - Math.sin(l.heading) * r });
    const finder = createPath(w, { obstacles: g.movement.obstacles }), a = f(1.4), b = f(-2.6, 0.3);   // from in front of the opening to a place behind the back wall
    const inside = rt => rt.pts.some(q => { const u = (q.x - l.x) * Math.sin(l.heading) + (q.z - l.z) * Math.cos(l.heading), v = (q.x - l.x) * Math.cos(l.heading) - (q.z - l.z) * Math.sin(l.heading); return u < 1 && u > -1 && Math.abs(v) < 0.9; });
    expect(finder.find(a, b)).toBeTruthy();   // (planned while the site has no walls: the links through the lean-to are made)
    for (let k = 1; k < 5; k++) { give(g, PARTS.leanto[k]); buildNext(g, input); }   // the fifth part: the first roof branch, the walls stand
    const rt = finder.find(a, b), fresh = createPath(w, { obstacles: g.movement.obstacles }).find(a, b);
    expect(rt && fresh).toBeTruthy(); expect(inside(fresh), 'the fresh planner goes round').toBe(false);
    expect(inside(rt), 'the planner that was used before goes round too').toBe(false);
    expect(rt.pts.length).toBe(fresh.pts.length);
  });
  it('has the shelter effects only when finished, and the walls (collision) from the first roof branch', () => {
    const { g, input } = FLAT(); give(g, 'driftwood'); buildNext(g, input);
    const l = g.leantos.list[0], camp = () => g.movement.obstacles.camp.refresh().circles.filter(c => c.g.kind === 'leanto').length;
    for (let k = 1; k < 15; k++) {
      const kind = PARTS.leanto[k]; give(g, kind); buildNext(g, input);
      expect(camp() > 0).toBe(k + 1 >= 5);   // 5th part: the first roof branch
      expect(g.leantos.shelter(l.x, l.z)).toBe(k + 1 === 15);
      expect(g.leantos.dry(l.x, l.z, 'wood')).toBe(k + 1 === 15); expect(g.leantos.covers(l.x, l.z, 1)).toBe(k + 1 === 15); expect(!!g.leantos.home(l.x, l.z)).toBe(k + 1 === 15);
    }
  });
  it('keeps its region free of wood while it grows: a pile is laid beside it, never in its walls or in front of the opening', () => {
    const { g, input } = FLAT(); give(g, 'driftwood'); buildNext(g, input);
    const l = g.leantos.list[0];
    g.player.x = l.x + Math.sin(l.heading) * 1.3; g.player.z = l.z + Math.cos(l.heading) * 1.3; g.player.heading = l.heading + Math.PI;
    g.wood.carried.length = 0; give(g, 'driftwood'); expect(g.wood.drop(g.player.x, g.player.z, g.player.heading, false, null, (x, z, rs) => keepFree(l).touches(x, z, rs === undefined ? 0.65 : rs + 0.3))).toBe(true);
    expect(g.wood.piles.every(p => !keepFree(l).touches(p.x, p.z, 0.65))).toBe(true);
  });
});

describe('upgrades', () => {
  const home = (up) => { const g = createGame(w, { x: spawn.x + 1.7, z: spawn.z, y: w.H(spawn.x + 1.7, spawn.z) }, { leantos: finishedAt(spawn.x, spawn.z, up), sleep: { awake: 0.1 } }); return { g, input: makeInput({ yaw: 0 }), l: g.leantos.list[0] }; };
  it('a frond starts the walls, a branch the bed, a stone the ring; driftwood starts nothing', () => {
    const { g } = home();
    give(g, 'driftwood'); expect(bigOf(g)).toBeNull();
    g.wood.carried.length = 0; give(g, 'frond'); expect(bigOf(g)).toMatchObject({ kind: 'upgrade', what: 'walls', piece: 'frond' });
    g.wood.carried.length = 0; give(g, 'branch'); expect(bigOf(g)).toMatchObject({ kind: 'upgrade', what: 'bed', piece: 'branch' });
    g.wood.carried.length = 0; give(g, 'stone'); expect(bigOf(g)).toMatchObject({ kind: 'upgrade', what: 'ring', piece: 'stone' });
    expect(buttonIcons(g.action()).options.map(o => o.key)).toContain('ring');
    g.wood.stones.length = 0; g.player.x = spawn.x + 2.5; give(g, 'stone'); expect(bigOf(g)).toBeNull();   // beyond UP_REACH
  });
  it('the walls: 6 fronds, 6 presses; wood dries wider only when all are in', () => {
    const { g, input, l } = home();
    for (let k = 0; k < 6; k++) { give(g, 'frond'); expect(g.leantos.has(l, 'walls')).toBe(false); expect(g.leantos.dry(spawn.x + 2.2, spawn.z, 'wood')).toBe(false); buildNext(g, input); expect(l.up.walls).toBeCloseTo((k + 1) / 6, 9); }
    expect(g.leantos.has(l, 'walls')).toBe(true); expect(g.leantos.dry(spawn.x + 2.2, spawn.z, 'wood')).toBe(true);
    give(g, 'frond'); expect(bigOf(g)).toBeNull();
  });
  it('the bed: 4 branches, then 4 fronds; a frond waits for the walls if they are not done', () => {
    const { g, input, l } = home();
    for (let k = 0; k < 4; k++) { give(g, 'branch'); buildNext(g, input); }
    expect(l.up.bed).toBeCloseTo(0.5, 9); give(g, 'frond');
    expect(bigOf(g)).toMatchObject({ what: 'walls' });   // walls come before the bed
    g.wood.carried.length = 0; l.up.walls = 1;
    for (let k = 0; k < 4; k++) { give(g, 'frond'); expect(bigOf(g)).toMatchObject({ what: 'bed', piece: 'frond' }); buildNext(g, input); }
    expect(g.leantos.has(l, 'bed')).toBe(true); give(g, 'branch'); expect(bigOf(g)).toBeNull();
  });
  it('the ring: 8 stones from his hands (two at a time), each used up; the ring holds a fire only when whole', () => {
    const { g, input, l } = home();
    for (let k = 0; k < 8; k++) { if (!g.wood.stones.length) give(g, 'stone', 2); const n = g.wood.stones.length; buildNext(g, input); expect(g.wood.stones.length).toBe(n - 1); expect(g.leantos.has(l, 'ring')).toBe(k === 7); }
    expect(g.leantos.ring(g.leantos.list[0].x + Math.sin(0) * 2.2, g.leantos.list[0].z + 2.2)).toBe(true);
  });
  it('the cost of an upgrade in rest is UP_COST over its parts', () => {
    const { g, input } = home(); const t0 = g.clock.total, a0 = g.sleep.awake;
    for (let k = 0; k < 6; k++) { give(g, 'frond'); buildNext(g, input); }
    expect(g.sleep.awake - a0 - (g.clock.total - t0)).toBeCloseTo(UP_COST, 1);
  });
});

describe('old saves and saving', () => {
  it('a half-built lean-to of an older save keeps its share as whole parts; finished ones stay finished', () => {
    const lt = createLeantos(w, { list: [{ id: 0, x: 0, z: 0, heading: 0, progress: 0.5 }, { id: 1, x: 9, z: 0, heading: 0, progress: 1, up: { walls: 0.5, bed: 0.3, ring: 1 } }, { id: 2, x: 20, z: 0, heading: 0, progress: 0.01 }], nextId: 3 });
    expect(lt.list[0].progress).toBeCloseTo(7 / 15, 9); expect(built(lt.list[0])).toBe(7); expect(nextKind(lt.list[0])).toBe('branch');
    expect(lt.list[1].progress).toBe(1); expect(lt.list[1].up.walls).toBeCloseTo(3 / 6, 9); expect(lt.list[1].up.bed).toBeCloseTo(2 / 8, 9); expect(lt.list[1].up.ring).toBe(1);
    expect(lt.list[2].progress).toBe(0); expect(built(lt.list[2])).toBe(0);   // a sliver is not a part
    expect(lt.state().list.map(l => l.progress)).toEqual(lt.list.map(l => l.progress));
  });
  it('building piles of an older save stay ordinary piles (firewood), and a finished home loads as it was', () => {
    const piles = [{ x: spawn.x + 0.4, z: spawn.z, kind: 'driftwood', logs: drift.slice(0, 6).map(l => l.id) }, { x: spawn.x + 0.4, z: spawn.z + 1.8, kind: 'branch', logs: branches.slice(0, 6).map(l => l.id) }];
    const g = createGame(w, spawn, { wood: { carried: [], piles }, leantos: { list: [{ id: 0, x: spawn.x - 6, z: spawn.z, heading: 0, progress: 0.7 }, { id: 1, x: spawn.x + 8, z: spawn.z + 8, heading: 1, progress: 1, up: { walls: 1, bed: 1, ring: 1 } }], nextId: 2 } });
    expect(g.wood.piles.map(p => [p.kind, p.logs.length])).toEqual([['driftwood', 6], ['branch', 6]]);
    expect(built(g.leantos.list[0])).toBe(10); expect(nextKind(g.leantos.list[0])).toBe('frond'); expect(g.leantos.list[1].progress).toBe(1);
    expect(UP_ORDER.every(k => g.leantos.has(g.leantos.list[1], k))).toBe(true);
  });
  it('a half-built site is saved and loaded again, piece for piece', () => {
    const { g, input } = FLAT(0.7); give(g, 'driftwood'); buildNext(g, input); give(g, 'driftwood', 2); buildNext(g, input); buildNext(g, input);
    const s = JSON.parse(serialise(g.state())); expect(s.leantos.list[0]).toMatchObject({ heading: 0.7 }); expect(s.leantos.list[0].progress).toBeCloseTo(3 / 15, 9);
    const back = parseSave(serialise(g.state()), 1337), g2 = createGame(w, spawn, back);
    expect(g2.state()).toEqual(g.state()); expect(built(g2.leantos.list[0])).toBe(3); expect(nextKind(g2.leantos.list[0])).toBe('driftwood');
  });
});

describe('the flood', () => {
  const findSpot = (lo, hi) => {
    for (let r = 1; r < 200; r += 0.25) for (let k = 0; k < 32; k++) { const a = k / 32 * Math.PI * 2, x = spawn.x + Math.cos(a) * r, z = spawn.z + Math.sin(a) * r; if (w.H(x, z) < hi && w.H(x, z) > lo) return { x, z }; }
    return null;
  };
  it('takes a site on wet sand (and a finished lean-to, and an upgrade of it), not one on dry ground', () => {
    const p = findSpot(-0.3, -0.2), low = FIRST_HIGH + PERIOD / 2, high = FIRST_HIGH + PERIOD;
    expect(p).not.toBe(null);
    const lt = { list: [{ id: 0, x: p.x, z: p.z, heading: 0, progress: 3 / 15 }, { id: 1, x: p.x + 0.3, z: p.z, heading: 0, progress: 1, up: { walls: 0.5 } }, { id: 2, x: spawn.x, z: spawn.z, heading: 0, progress: 6 / 15 }], nextId: 3 };
    const at0 = t => createGame(w, spawn, { day: Math.floor(t), time: t % 1, leantos: lt });
    const g = at0(low); g.update(makeInput(), 0.1); expect(g.leantos.list.length).toBe(3);
    const h = at0(high); h.update(makeInput(), 0.1); expect(h.leantos.list.map(l => l.id)).toEqual([2]);
  });
  it('a site taken by the flood in the middle of kneeling is not built into, and the piece is kept', () => {
    const { g, input } = FLAT(); give(g, 'driftwood'); buildNext(g, input); give(g, 'driftwood');
    input.big = true; run(g, input, 1); expect(g.player.work).toMatchObject({ kind: 'build' });
    g.leantos.list.length = 0; run(g, input, PIECE_TIME);
    expect(g.player.work).toBeNull(); expect(g.wood.carried.length).toBe(1);
  });
});
