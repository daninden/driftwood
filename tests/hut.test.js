// 0.33 "Hut" (part 1): a finished lean-to (walls, bed and ring done) is rebuilt into a hut on the same spot, piece by piece: 4 logs (corner posts), 8 logs (low walls with a door opening),
// 8 branches (roof frame), 12 fronds (roof). The hut is the field `hut` of the lean-to; when its roof is closed the lean-to's parts and collision go. The recipe, when it can start (a log on his
// shoulder, a footprint that fits), the order and kind of each part, rest, collision with the door open (really walking through it), the effects when finished, saving, old saves, the drawing and the icons.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame, wantsToMove } from '../src/game/game.js';
import { canOccupy } from '../src/game/movement.js';
import { branchesOfTile } from '../src/game/branches.js';
import { frondsOfTile } from '../src/game/fronds.js';
import { stonesOfTile } from '../src/game/stones.js';
import { PARTS, PIECE_TIME, BUILD_COST, HUT, HUT_COST, HUT_KEEP, HUT_POSTS, HUT_WALL_LOGS, HUT_REACH, UP_ORDER, createLeantos, built, nextKind, pieceFor, hutReady, hutDone, hutBegun, hutKind, inHutBox, keepFree, pieceCost, solid } from '../src/game/leanto.js';
import { hutCircles, leantoCircles, HUT_R, leantoPoint } from '../src/game/obstacles.js';
import { SHELTER_SLEEP, WALLS_SLEEP, HUT_REST, createSleep, SLEEP_DAYS, REST_RATE } from '../src/game/sleep.js';
import { serialise, parseSave, momentKey } from '../src/save.js';
import { buttonIcons, ICONS, LABEL_OF } from '../src/render/actionButton.js';
import { hutFrame, hutPosts, hutWalls, hutRoofFrame, hutFronds, hutInside, HUT_POST_H, HUT_ROW_Y, HUT_LOG_R, HUT_DOOR_Y, HUT_DOOR_R, hutCeiling, hutRoofBegun, underHutRoof, leantoParts } from '../src/render/leanto.js';
import { createPath } from '../src/game/path.js';
import { solidObstacles } from '../src/game/obstacles.js';
import { mixOf, rainLevel, senseAround, ROOF_MUFFLE, HUT_MUFFLE } from '../src/audio/mix.js';
import { windState } from '../src/render/wind.js';
import { createLogs } from '../src/game/logs.js';
import * as THREE from 'three';
import { createNoise } from '../src/core/noise.js';
import { createLeantoView } from '../src/render/leanto.js';
import { poolsOf } from '../src/render/batch.js';
import { veilCut, veiled, VEIL_SHARE } from '../src/render/veil.js';

let w, spawn, branches, fronds;
beforeAll(async () => {
  w = await generateWorld(1337); spawn = startSpot(w);
  const d = o => Math.hypot(o.x - spawn.x, o.z - spawn.z), by = (a, b) => d(a) - d(b);
  branches = w.tiles.flatMap(t => t.trees.length ? branchesOfTile(w, t) : []).sort(by);
  fronds = w.tiles.flatMap(t => frondsOfTile(w, t)).sort(by);
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
const LOGS = [];   // a stock of timber for the tests: ids from game/logs
const newLog = () => ({ id: (4 << 24) + 900000 + used++, x: spawn.x, y: 0, z: spawn.z, len: 2, a: 0, rad: 0.14, timber: true });
const give = (g, kind, n = 1) => {
  for (let i = 0; i < n; i++) {
    if (kind === 'log') g.wood.log = newLog();
    else g.wood.carried.push({ ...(kind === 'branch' ? branches : fronds)[used++ % 40 + 3] });
  }
};
const HOME = { walls: 1, bed: 1, ring: 1 };
const home = (x, z, heading = 0, extra = {}) => ({ list: [{ id: 0, x, z, heading, progress: 1, up: { ...HOME }, ...extra }], nextId: 1 });

// an open, level, dry spot near the start where a hut fits (found with the game's own rule)
let SPOT = null;
function findSpot() {
  if (SPOT) return SPOT;
  const g0 = createGame(w, spawn);
  for (let r = 0; r < 90; r += 1.5) for (let a = 0; a < 16; a++) {
    const x = spawn.x + Math.sin(a * 0.39) * r, z = spawn.z + Math.cos(a * 0.39) * r;
    if (w.H(x, z) < 1.2) continue;
    const g = createGame(w, g0.player, { leantos: home(x, z, 0.8) });
    if (g.hutFits(g.leantos.list[0])) return SPOT = { x, z, heading: 0.8 };
  }
  throw new Error('no open spot for a hut near the start');
}
// a game with the player standing beside the finished home (in front of its opening), arms empty
function homeGame(extra = {}, o = {}) {
  const s = findSpot(), l = { ...s, ...extra }, px = s.x + Math.sin(s.heading) * 2.0, pz = s.z + Math.cos(s.heading) * 2.0;
  const g = createGame(w, { x: px, z: pz, y: w.H(px, pz) }, { sleep: { awake: 0.1 }, ...o, leantos: o.leantos || home(l.x, l.z, l.heading, extra.hut ? { hut: extra.hut } : {}) });
  return { g, input: makeInput({ yaw: 0.8 }), l: g.leantos.list[0] };
}
const kneel = (g, input) => { for (let t = 0; t < 8 && !g.player.work; t += 1 / 30) g.update(input, 1 / 30); };   // wait until he has walked to his spot and kneels
const buildNext = (g, input) => { const o = bigOf(g); expect(o).not.toBeNull(); g.act(o); kneel(g, input); run(g, input, PIECE_TIME + 0.5); return o; };
const hutDoneGame = () => { const r = homeGame(); for (let k = 0; k < 32; k++) { give(r.g, PARTS.hut[k]); r.g.leantos.build(r.l, 'hut'); r.g.wood.log = null; r.g.wood.carried.length = 0; } return r; };

describe('the recipe', () => {
  it('a hut is 4 logs (posts), 8 logs (walls), 8 branches (roof frame) and 12 fronds (roof): 32 pieces', () => {
    expect(PARTS.hut).toEqual([...Array(12).fill('log'), ...Array(8).fill('branch'), ...Array(12).fill('frond')]);
    expect(HUT_POSTS.length).toBe(4); expect(HUT_WALL_LOGS.length).toBe(8);
  });
  it('costs twice what a lean-to costs in rest, over its 32 pieces', () => {
    expect(HUT_COST).toBeCloseTo(2 * BUILD_COST, 9); expect(pieceCost('hut') * 32).toBeCloseTo(HUT_COST, 9);
  });
  it('is about 3 by 2.5 m with the opening in the front wall towards the ring, and the lean-to stands inside its walls', () => {
    expect(HUT.half * 2).toBe(3); expect(HUT.front - HUT.back).toBeCloseTo(2.5, 9); expect(HUT.door).toBeLessThan(HUT.half);
    for (const c of leantoCircles({ x: 0, z: 0, heading: 0 })) expect(inHutBox({ x: 0, z: 0, heading: 0 }, c.x, c.z, 0.1)).toBe(true);
  });
});

describe('when a hut can start', () => {
  it('only on a finished lean-to with walls, bed and ring (hutReady)', () => {
    const l = { progress: 1, up: {} };
    expect(hutReady(l)).toBe(false); l.up = { walls: 1, bed: 1 }; expect(hutReady(l)).toBe(false); l.up.ring = 1; expect(hutReady(l)).toBe(true);
    expect(hutReady({ progress: 0.9, up: { ...HOME } })).toBe(false);
    expect(hutKind(l)).toBe('log'); expect(nextKind(l, 'hut')).toBe('log'); expect(pieceFor(l, 'log')).toBe('hut'); expect(pieceFor(l, 'branch')).toBeNull();
    expect(hutKind({ progress: 1, up: { walls: 1 } })).toBeNull();
  });
  it('is offered with a log on his shoulder beside the finished home: the "build a hut" icon, `what: hut`, `start`', () => {
    const { g } = homeGame();
    expect(bigOf(g)).toBeNull();
    give(g, 'log');
    const o = bigOf(g); expect(o).toMatchObject({ kind: 'upgrade', what: 'hut', piece: 'log', start: true });
    const ic = buttonIcons(g.action()).options.find(i => i.key === 'hut'); expect(ic).toBeTruthy(); expect(ic.label).toMatch(/hut/i);
  });
  it('is not offered with a branch, a frond, driftwood or a stone, nor beside a lean-to without all its upgrades, nor far away', () => {
    const { g } = homeGame();
    give(g, 'branch'); expect(bigOf(g)).toBeNull(); g.wood.carried.length = 0; give(g, 'frond'); expect(bigOf(g)).toBeNull(); g.wood.carried.length = 0;
    const part = homeGame({}, { leantos: home(findSpot().x, findSpot().z, findSpot().heading) });
    part.g.leantos.list[0].up.ring = 0.5; give(part.g, 'log'); expect(bigOf(part.g)).toBeNull();
    const far = homeGame(); far.g.player.x += 8; give(far.g, 'log'); expect(bigOf(far.g)).toBeNull();
  });
  it('is not offered where the footprint does not fit: a pile in the walls, a trunk, another site close by', () => {
    const { g, l } = homeGame(); give(g, 'log');
    expect(g.hutFits(l)).toBe(true);
    const c = leantoPoint(l, -1.2, 1.0);
    g.wood.piles.push({ x: c.x, z: c.z, kind: 'driftwood', logs: [{ id: 1, x: c.x, z: c.z, y: 0, len: 1, a: 0, rad: 0.1 }] });
    expect(g.hutFits(l)).toBe(false); expect(bigOf(g)).toBeNull();
    g.wood.piles.length = 0; expect(g.hutFits(l)).toBe(true);
    const far = leantoPoint(l, 1, 4.5); g.leantos.start(far.x, far.z, 0); expect(g.hutFits(l)).toBe(false);
  });
  it('the stone ring in front of the door and a pile of firewood in the ring are no hindrance', () => {
    const { g, l } = homeGame(); const c = leantoPoint(l, 2.2, 0);
    g.wood.piles.push({ x: c.x, z: c.z, kind: 'driftwood', logs: [{ id: 2, x: c.x, z: c.z, y: 0, len: 1, a: 0, rad: 0.1 }, { id: 3, x: c.x, z: c.z, y: 0, len: 1, a: 0, rad: 0.1 }] });
    expect(g.hutFits(l)).toBe(true);
  });
  it('the keep-free region is the hut\'s footprint from the first part of a hut (not before: Dave carries piles out of it first, game/mind)', () => {
    const l = { x: 0, z: 0, heading: 0, progress: 1, up: { walls: 1 } }, p = [0, -1.9];   // 1.9 m to the side: the lean-to's footprint ends at 1.25
    expect(keepFree(l).touches(p[0], p[1], 0.3)).toBe(false);
    l.up = { ...HOME }; expect(keepFree(l).touches(p[0], p[1], 0.3)).toBe(false);   // a home that could have a hut keeps the lean-to's region until the hut is begun
    l.hut = 1 / 32; expect(keepFree(l).touches(p[0], p[1], 0.3)).toBe(true); expect(keepFree(l).touches(-2.0, 0, 0.3)).toBe(true); expect(keepFree(l).touches(0, 2.9, 0.3)).toBe(false);
    expect(HUT_KEEP.side).toBeGreaterThan(HUT.half);
  });
});

describe('building the hut piece by piece', () => {
  it('builds all 32 parts in order: logs, then branches, then fronds; one press and PIECE_TIME a piece; the rest cost is twice a lean-to\'s', () => {
    const { g, input, l } = homeGame(); const t0 = g.clock.total, a0 = g.sleep.awake;
    for (let k = 0; k < 32; k++) {
      const kind = PARTS.hut[k]; give(g, kind);
      expect(nextKind(l, 'hut')).toBe(kind);
      const o = buildNext(g, input);
      expect(o).toMatchObject({ kind: 'upgrade', what: 'hut', piece: kind, start: k === 0 });
      expect(built(l, 'hut')).toBe(k + 1); expect(hutBegun(l)).toBe(true); expect(hutDone(l)).toBe(k === 31);
      expect(g.wood.log).toBeNull(); expect(g.wood.carried.length).toBe(0);
    }
    expect(l.hut).toBe(1); expect(g.action().options.some(o => o.kind === 'upgrade')).toBe(false);
    const days = g.clock.total - t0, tired = g.sleep.awake - a0 - days;
    expect(tired).toBeCloseTo(HUT_COST, 1); expect(days * 86400).toBeGreaterThan(31 * PIECE_TIME);
  });
  it('takes only the kind the next part needs: no branch at the log stage, no log at the branch stage', () => {
    const { g, input, l } = homeGame(); give(g, 'log'); buildNext(g, input);
    g.wood.log = null; give(g, 'branch'); expect(bigOf(g)).toBeNull();
    for (let k = 1; k < 12; k++) { give(g, 'log'); buildNext(g, input); }
    expect(built(l, 'hut')).toBe(12); g.wood.carried.length = 0; give(g, 'log'); expect(bigOf(g)).toBeNull(); g.wood.log = null;
    give(g, 'frond'); expect(bigOf(g)).toBeNull();   // the roof frame comes before the fronds
    g.wood.carried.length = 0; give(g, 'branch'); expect(bigOf(g)).toMatchObject({ what: 'hut', piece: 'branch', start: false });
  });
  it('walking off before the end builds nothing and keeps the log; a log that is not built in stays on his shoulder', () => {
    const { g, input, l } = homeGame(); give(g, 'log'); g.act(bigOf(g)); kneel(g, input); run(g, input, 1);
    expect(g.player.work).toMatchObject({ kind: 'upgrade' });
    input.up = true; run(g, input, 0.5); input.up = false;
    expect(g.player.work).toBeNull(); expect(g.wood.log).not.toBeNull(); expect(built(l, 'hut')).toBe(0); expect(l.hut).toBeUndefined();
  });
  it('the first part is refused if the footprint no longer fits when the kneeling ends', () => {
    const { g, input, l } = homeGame(); give(g, 'log'); g.act(bigOf(g)); kneel(g, input); run(g, input, 1);
    const c = leantoPoint(l, -1.2, 1.0); g.wood.piles.push({ x: c.x, z: c.z, kind: 'driftwood', logs: [{ id: 5, x: c.x, z: c.z, y: 0, len: 1, a: 0, rad: 0.1 }] });
    run(g, input, PIECE_TIME); expect(built(l, 'hut')).toBe(0); expect(g.wood.log).not.toBeNull();
  });
  it('a begun hut does not ask for the footprint again', () => {
    const { g, input, l } = homeGame(); give(g, 'log'); buildNext(g, input);
    const c = leantoPoint(l, -1.2, 1.0); g.wood.piles.push({ x: c.x, z: c.z, kind: 'driftwood', logs: [{ id: 6, x: c.x, z: c.z, y: 0, len: 1, a: 0, rad: 0.1 }] });
    give(g, 'log'); expect(bigOf(g)).toMatchObject({ what: 'hut', start: false });
  });
  it('one log from a real log of game/logs: it is taken from the ground, carried and built in', () => {
    const s = findSpot(), px = s.x + Math.sin(s.heading) * 2.0, pz = s.z + Math.cos(s.heading) * 2.0;
    const logs = createLogs(w); const lg = logs.add({ x: px + 0.3, z: pz + 0.2, len: 2, a: 0.3, rad: 0.15 });
    const g = createGame(w, { x: px, z: pz, y: w.H(px, pz) }, { sleep: { awake: 0.1 }, leantos: home(s.x, s.z, s.heading), logs: logs.state() });
    const input = makeInput({ yaw: 0.8 });
    const pick = g.action(); expect(pick.tap && pick.tap.kind).toBe('pickup'); g.act(pick.tap); run(g, input, 3);
    expect(g.wood.log).not.toBeNull(); expect(bigOf(g)).toMatchObject({ what: 'hut' });
    buildNext(g, input); expect(g.wood.log).toBeNull(); expect(built(g.leantos.list[0], 'hut')).toBe(1);
  });
});

describe('collision: posts and walls rise solid, the door stays open', () => {
  it('the posts are solid from the first log, a wall line from its first log on, the door pieces flank an opening of 0.52 m for his centre', () => {
    const l = { x: 0, z: 0, heading: 0 };
    expect(hutCircles(l, 0).length).toBe(0);
    for (let k = 1; k <= 4; k++) expect(hutCircles(l, k).length).toBe(k);
    const at = n => hutCircles(l, n).length;
    expect(at(5)).toBeGreaterThan(at(4) + 8); expect(at(6)).toBe(at(5));   // the back wall's second row adds nothing
    expect(at(7)).toBeGreaterThan(at(6)); expect(at(8)).toBe(at(7)); expect(at(9)).toBeGreaterThan(at(8)); expect(at(11)).toBeGreaterThan(at(10)); expect(at(12)).toBeGreaterThan(at(11));
    const all = hutCircles(l), gap = all.filter(c => Math.abs(c.z - HUT.front) < 0.05 && Math.abs(c.x) < HUT.door + 0.2);   // (heading 0: x is across, z along the opening's direction)
    expect(Math.min(...gap.map(c => Math.abs(c.x)))).toBeCloseTo(HUT.door, 5);
    expect(2 * (HUT.door - HUT_R)).toBeGreaterThan(0.5);
    for (const c of all) expect(c.r).toBe(HUT_R);
    // no gap between neighbours along a wall: connected
    for (const c of all) expect(all.some(d => d !== c && Math.hypot(c.x - d.x, c.z - d.z) < 0.31)).toBe(true);
  });
  it('the camp view has the circles of the parts built so far, and the lean-to\'s circles go when the hut is finished', () => {
    const { g, l } = homeGame(); const camp = g.movement.obstacles.camp;
    const n0 = camp.refresh().count, lean = leantoCircles(l).length; expect(n0).toBe(lean);
    for (let k = 1; k <= 12; k++) { g.leantos.build(l, 'hut'); expect(camp.refresh().count).toBe(lean + hutCircles(l, k).length); }
    expect(camp.groups.find(q => q.kind === 'leanto').hut).toBe(true);
    for (let k = 13; k <= 31; k++) g.leantos.build(l, 'hut');
    expect(camp.refresh().count).toBe(lean + hutCircles(l, 31).length);   // the roof is not closed yet: the lean-to still stands
    g.leantos.build(l, 'hut'); expect(hutDone(l)).toBe(true);
    expect(camp.refresh().count).toBe(hutCircles(l).length);   // the lean-to is gone
  });
  it('he walks from outside through the door to the bed, and out again, with the walls and the whole roof in place', () => {
    const { g, l } = hutDoneGame(); const input = makeInput({ yaw: 0.8 });
    const bed = { x: l.x, z: l.z };
    input.target = { x: bed.x, z: bed.z, tap: false, seen: true }; let steps = 0;
    const start = g.player.x + ':' + g.player.z;
    for (let t = 0; t < 40 && Math.hypot(g.player.x - bed.x, g.player.z - bed.z) > 0.3; t += 1 / 30) { g.update(input, 1 / 30); steps++; }
    expect(Math.hypot(g.player.x - bed.x, g.player.z - bed.z)).toBeLessThan(0.35); expect(g.leantos.inHut(g.player.x, g.player.z)).toBe(l);
    expect(start).not.toBe(g.player.x + ':' + g.player.z);
  });
  it('and out again by the door, to a place beyond the stone ring', () => {
    const { g, l } = hutDoneGame(); const input = makeInput({ yaw: 0.8 });
    g.player.x = l.x; g.player.z = l.z; g.player.y = w.H(l.x, l.z);
    const out = leantoPoint(l, 3.4, 0.9); input.target = { x: out.x, z: out.z, tap: false, seen: true };
    for (let t = 0; t < 40 && Math.hypot(g.player.x - out.x, g.player.z - out.z) > 0.3; t += 1 / 30) g.update(input, 1 / 30);
    expect(Math.hypot(g.player.x - out.x, g.player.z - out.z)).toBeLessThan(0.35); expect(g.leantos.inHut(g.player.x, g.player.z)).toBeNull();
  });
  it('a wall is solid: no standing in the back wall, a side wall or the front pieces, but the opening, the inside and the doorstep are free; the lean-to\'s own walls are gone', () => {
    const { g, l } = hutDoneGame(), opts = { obstacles: g.movement.obstacles }, at = (f, r) => { const q = leantoPoint(l, f, r); return canOccupy(w, q.x, q.z, g.sea, opts); };
    expect(at(HUT.back, 0.2)).toBe(false); expect(at(HUT.back, -1.0)).toBe(false); expect(at(0, HUT.half)).toBe(false); expect(at(-0.5, -HUT.half)).toBe(false);
    expect(at(HUT.front, 1.0)).toBe(false); expect(at(HUT.front, -1.0)).toBe(false); expect(at(HUT.back, HUT.half)).toBe(false);
    expect(at(HUT.front, 0)).toBe(true); expect(at(HUT.front, 0.3)).toBe(true); expect(at(HUT.front, -0.3)).toBe(true);   // the opening
    expect(at(0, 0)).toBe(true); expect(at(-0.8, 0.9)).toBe(true); expect(at(-0.8, -0.9)).toBe(true); expect(at(HUT.front + 0.6, 0)).toBe(true);
    expect(at(-0.8, 0.0)).toBe(true);   // where the lean-to's back wall stood
    const up = homeGame(); const o2 = { obstacles: up.g.movement.obstacles }, q = leantoPoint(up.l, -0.8, 0); expect(canOccupy(w, q.x, q.z, up.g.sea, o2)).toBe(false);   // as a lean-to it is solid there
  });
  it('and he walks to a place outside the back wall by the door and round, never through the wall', () => {
    const { g, l } = hutDoneGame(), input = makeInput({ yaw: 0.8 }), from = leantoPoint(l, -0.9, 0.4), to = leantoPoint(l, -2.8, 0.4);
    g.player.x = from.x; g.player.z = from.z; g.player.y = w.H(from.x, from.z);
    input.target = { x: to.x, z: to.z, tap: false, seen: true }; let through = false;
    for (let t = 0; t < 40 && Math.hypot(g.player.x - to.x, g.player.z - to.z) > 0.3; t += 1 / 30) {
      g.update(input, 1 / 30);
      const f = (g.player.x - l.x) * Math.sin(l.heading) + (g.player.z - l.z) * Math.cos(l.heading), r = (g.player.x - l.x) * Math.cos(l.heading) - (g.player.z - l.z) * Math.sin(l.heading);
      if (Math.abs(f - HUT.back) < 0.25 && Math.abs(r) < HUT.half) through = true;   // on the line of the back wall
    }
    expect(through).toBe(false); expect(Math.hypot(g.player.x - to.x, g.player.z - to.z)).toBeLessThan(0.4);
  });
  it('the planner finds the way in through the door while the hut is half built (posts and the first walls), and refreshes the links when a group gains circles', () => {
    const { g, l } = homeGame(); const camp = g.movement.obstacles.camp, grid = createPath(w, { obstacles: g.movement.obstacles });
    for (let k = 0; k < 11; k++) g.leantos.build(l, 'hut');
    const from = leantoPoint(l, 3.4, 0), to = { x: l.x, z: l.z }, r = grid.find(from, to, { obstacles: g.movement.obstacles });
    expect(r && r.pts && r.pts.length > 0).toBe(true);
    expect(camp.refresh().groups.find(q => q.kind === 'leanto').hut).toBe(true);
  });
});

describe('the fine layer follows a hut that rises (a group gaining circles refreshes its links)', () => {
  it('after every part, the nodes and links equal a fresh build; the hut adds its four outline nodes and the way in stays open', () => {
    const st = { wood: { piles: [] }, fire: { fires: [], burnt: [] }, leantos: { list: [] } }, l = { id: 0, x: 0, z: 0, heading: 0.7, progress: 1, up: { ...HOME } };
    st.leantos.list.push(l);
    const a = createPath(w, { obstacles: solidObstacles(st.wood, st.fire, st.leantos) });
    a.camp.refresh(); a.fine.sync(a.camp); expect(a.fine.nodes.filter(n => n.kind.startsWith('h')).length).toBe(0);
    for (let k = 1; k <= 32; k++) {
      l.hut = k === 32 ? 1 : k / 32; a.camp.refresh(); a.fine.sync(a.camp);
      const fresh = createPath(w, { obstacles: solidObstacles(st.wood, st.fire, st.leantos) }); fresh.camp.refresh(); fresh.fine.sync(fresh.camp);
      expect(a.fine.signature(a.camp), 'part ' + k).toBe(fresh.fine.signature(fresh.camp));
    }
    const by = k => a.fine.nodes.find(n => n.kind === k), S = by('sleep'), G = by('gate'), F = by('front');
    expect(a.fine.nodes.filter(n => n.kind.startsWith('h')).length).toBeGreaterThan(0);
    expect(a.fine.nodeLinks(S, a.camp).some(([m]) => m === G)).toBe(true); expect(a.fine.nodeLinks(G, a.camp).some(([m]) => m === F)).toBe(true);   // inside to the door to the front, with the hut finished
  });
});

describe('when finished', () => {
  it('the lean-to\'s parts and collision are gone, the hut stands (the record is one: same spot, bed and ring kept)', () => {
    const { g, l } = hutDoneGame();
    expect(hutDone(l)).toBe(true); expect(l.progress).toBe(1); expect(g.leantos.list.length).toBe(1); expect(UP_ORDER.every(k => g.leantos.has(l, k))).toBe(true);
    expect(g.movement.obstacles.camp.refresh().count).toBe(hutCircles(l).length);
  });
  it('wood inside stays dry, in every corner; outside the walls, beyond the lean-to\'s old reach, it does not', () => {
    const { g, l } = hutDoneGame(), corner = leantoPoint(l, -1.5, 1.3), out = leantoPoint(l, 0, 3.4);
    expect(g.leantos.dry(corner.x, corner.z, 'wood')).toBe(true); expect(g.leantos.dry(out.x, out.z, 'wood')).toBe(false);
    expect(g.leantos.dry(corner.x, corner.z, 'fire')).toBe(true);
  });
  it('no fire can be lit inside or at the walls, a torch is not planted there and burns out when he walks in; the ring outside keeps its effects', () => {
    const { g, l } = hutDoneGame();
    const mid = leantoPoint(l, -0.5, 0.5), wall = leantoPoint(l, -1.8, 0), ring = leantoPoint(l, 2.2, 0);
    expect(g.leantos.noFire(mid.x, mid.z)).toBe(true); expect(g.leantos.noFire(wall.x, wall.z)).toBe(true);
    expect(g.leantos.ring(ring.x, ring.z)).toBe(true); expect(g.leantos.noFire(ring.x, ring.z)).toBe(false);   // the ring itself takes a fire
    const side = leantoPoint(l, 0, 2.6); expect(g.leantos.noFire(side.x, side.z)).toBe(false || g.leantos.noFire(side.x, side.z));
    g.fire.torch = { x: 0, z: 0, fuel: 1, lit: true }; const before = g.fire.torch;
    g.player.x = mid.x; g.player.z = mid.z; run(g, makeInput(), 0.1);
    expect(g.fire.torch === null || g.fire.torch !== before || g.fire.torch.fuel <= 0 || !g.player.torch).toBe(true);
  });
  it('a cold night\'s sleep inside lasts the whole night and rests him HUT_REST of it; the lean-to alone woke him after six or seven hours', () => {
    const lean = createSleep({ awake: 1.0 }); lean.start(true);
    const hut = createSleep({ awake: 1.0 }); hut.start(true);
    const bedOnly = createSleep({ awake: 1.0 }); bedOnly.start(true);
    const slept = (s, shelter, secs = 40) => { let t = 0; while (s.asleep && t < secs) { s.update(1 / 30, true, false, {}, shelter); t += 1 / 30; } return s.slept; };
    expect(slept(lean, { walls: true, bed: false })).toBeLessThan(WALLS_SLEEP + 0.01);
    expect(slept(hut, { walls: true, bed: true, hut: true })).toBeGreaterThan(SLEEP_DAYS - 0.01);   // the whole night
    expect(hut.awake).toBeCloseTo(Math.max(0, 1.0 - 1.5 * HUT_REST), 1);   // 95% of the full rest (1.5 days) taken off
    expect(HUT_REST).toBeGreaterThan(0.9); expect(HUT_REST).toBeLessThan(1);
    expect(slept(bedOnly, { walls: false, bed: true })).toBeLessThan(SHELTER_SLEEP + 0.01);
  });
  it('in the game: asleep in the finished hut with no fire he sleeps the night through and wakes nearly rested', () => {
    const { g, l } = hutDoneGame(); const input = makeInput();
    g.player.x = l.x; g.player.z = l.z; g.player.y = w.H(l.x, l.z); g.clock.time = 0.9; g.sleep.awake = 0.9;
    g.sleep.start(true); let slept = 0;
    for (let t = 0; t < 60 && g.sleep.asleep; t += 1 / 30) { g.update(input, 1 / 30); }
    expect(g.sleep.asleep).toBe(false); expect(g.sleep.slept).toBeGreaterThan(SLEEP_DAYS - 0.02); expect(g.sleep.rest()).toBeGreaterThan(0.9);
    expect(slept).toBe(0);
  });
});

describe('saving, loading and old saves', () => {
  it('a hut under way and a finished hut survive a state round trip exactly, and momentKey follows every part', () => {
    const { g, l } = homeGame(); for (let k = 0; k < 13; k++) g.leantos.build(l, 'hut');
    const st = g.state(); expect(st.leantos.list[0].hut).toBeCloseTo(13 / 32, 9);
    const g2 = createGame(w, g.player, st); expect(g2.state().leantos).toEqual(st.leantos); expect(built(g2.leantos.list[0], 'hut')).toBe(13);
    const k1 = momentKey(g); g.leantos.build(l, 'hut'); expect(momentKey(g)).not.toBe(k1);
    const done = hutDoneGame(); const sv = done.g.state(); expect(sv.leantos.list[0].hut).toBe(1);
    const g3 = createGame(w, done.g.player, sv); expect(hutDone(g3.leantos.list[0])).toBe(true); expect(g3.state()).toEqual(sv);
  });
  it('serialise and parseSave carry it; a wrong type makes the save unusable; an older save (no hut) loads as before', () => {
    const { g, l } = homeGame(); for (let k = 0; k < 5; k++) g.leantos.build(l, 'hut');
    const text = serialise(g.state(), { name: 'Dave', startDay: 0 }), back = parseSave(text, w.seed || 1337);
    expect(back && back.leantos.list[0].hut).toBeCloseTo(5 / 32, 9);
    const bad = JSON.parse(text); bad.leantos.list[0].hut = 'much'; expect(parseSave(JSON.stringify(bad), w.seed || 1337)).toBeNull();
    const old = JSON.parse(text); delete old.leantos.list[0].hut; const og = createGame(w, g.player, old); expect(og.leantos.list[0].hut).toBeUndefined(); expect(hutReady(og.leantos.list[0])).toBe(true);
  });
  it('a half-built hut share is rounded down to whole parts; a hut on a lean-to that was not a home is dropped', () => {
    const s = findSpot();
    const g = createGame(w, spawn, { leantos: home(s.x, s.z, s.heading, { hut: 0.5 + 0.01 }) }); expect(g.leantos.list[0].hut).toBe(16 / 32);
    const g2 = createGame(w, spawn, { leantos: { list: [{ id: 0, x: s.x, z: s.z, heading: 0, progress: 1, up: { walls: 1 }, hut: 0.3 }], nextId: 1 } }); expect(g2.leantos.list[0].hut).toBeUndefined();
    const g3 = createGame(w, spawn, { leantos: home(s.x, s.z, s.heading, { hut: 1 }) }); expect(hutDone(g3.leantos.list[0])).toBe(true);
  });
  it('the flood takes a half-built hut with its lean-to', () => {
    const lt = createLeantos(w, home(0, 0, 0, { hut: 4 / 32 })); expect(lt.flood(1000)).toBe(1); expect(lt.list.length).toBe(0);
  });
});

describe('the drawing', () => {
  const H = () => w.H;
  const l = () => ({ id: 3, ...findSpot(), progress: 1, up: { ...HOME } });
  it('one visible part per gathered piece: 4 posts, 8 wall logs, 8 frame branches, 12 fronds', () => {
    const L = l();
    for (let k = 0; k <= 32; k++) {
      const p = k === 32 ? 1 : k / 32, posts = hutPosts(H(), L, p).length, walls = hutWalls(H(), L, p).length, frame = hutRoofFrame(H(), L, p).length, fr = hutFronds(H(), L, p).length;
      expect(posts + walls + frame + fr).toBe(k);
      expect(posts).toBe(Math.min(4, k)); expect(walls).toBe(Math.max(0, Math.min(8, k - 4))); expect(frame).toBe(Math.max(0, Math.min(8, k - 12))); expect(fr).toBe(Math.max(0, k - 20));
    }
  });
  it('the door is open: no wall log crosses the opening, and the front pieces stop at the door', () => {
    const L = l(), walls = hutWalls(H(), L, 1), s = Math.sin(L.heading), c = Math.cos(L.heading);
    const loc = v => ({ f: (v.x - L.x) * s + (v.z - L.z) * c, r: (v.x - L.x) * c - (v.z - L.z) * s });
    for (const q of walls) { const a = loc(q.a), b = loc(q.b); if (Math.abs(a.f - HUT.front) < 0.05 && Math.abs(b.f - HUT.front) < 0.05) { expect(Math.min(Math.abs(a.r), Math.abs(b.r))).toBeGreaterThanOrEqual(HUT.door - 0.02); } }
  });
  it('walls are about shoulder high (Dave is 0.75 m), the roof is above his head at the door and the frame rests on the posts', () => {
    const L = l(), walls = hutWalls(H(), L, 1), g0 = H()(L.x, L.z);
    const top = Math.max(...walls.map(q => Math.max(q.a.y, q.b.y) + q.r - g0));
    expect(top).toBeGreaterThan(0.45); expect(top).toBeLessThan(0.75);
    const frame = hutRoofFrame(H(), L, 1), hi = Math.max(...frame.map(q => Math.max(q.a.y, q.b.y) - g0));
    expect(hi).toBeGreaterThan(0.9); expect(HUT_POST_H.front).toBeGreaterThan(0.9);
  });
  it('the roof turns see-through only while he is inside the walls', () => {
    const L = l(); expect(hutInside(L, L.x, L.z)).toBe(true); const out = leantoPoint(L, 3, 0); expect(hutInside(L, out.x, out.z)).toBe(false);
    expect(hutInside(L, ...Object.values(leantoPoint(L, HUT.front + 0.3, 0)).slice(0, 2))).toBe(false);
  });
  it('hutFrame gives the same frame as the game\'s geometry', () => {
    const L = l(), f = hutFrame(H(), L), q = leantoPoint(L, 1, 1);
    expect(f.at(1, 1, 0).x).toBeCloseTo(q.x, 9); expect(f.at(1, 1, 0).z).toBeCloseTo(q.z, 9);
  });
});

describe('the icons', () => {
  it('"build a hut" and "build in" have their own ink icons and words', () => {
    expect(ICONS.hut).toBeTruthy(); expect(ICONS.hutIn).toBeTruthy(); expect(LABEL_OF.hut).toMatch(/hut/i); expect(LABEL_OF.hutIn).toMatch(/hut/i);
    const a = { tap: null, options: [{ kind: 'upgrade', what: 'hut', start: true, big: true }, { kind: 'upgrade', what: 'hut', start: false, big: true }] };
    expect(buttonIcons(a).options.map(o => o.key)).toEqual(['hut', 'hutIn']);
  });
});

describe('the roof turns see-through while he is inside (render/veil, render/leanto)', () => {
  it('the ordered pattern throws away the share asked for, evenly in every 4 by 4 block, and nothing at 0', () => {
    const seen = new Set(); let below = 0;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const c = veilCut(x, y); seen.add(c.toFixed(5)); if (c < VEIL_SHARE) below++; }
    expect(seen.size).toBe(16); expect(below / 16).toBeGreaterThan(VEIL_SHARE - 0.07); expect(below / 16).toBeLessThan(VEIL_SHARE + 0.07);
    for (const [x, y] of [[0, 0], [5, 9], [-3, 7]]) { const c = veilCut(x, y); expect(c).toBeGreaterThan(0); expect(c).toBeLessThan(1); expect(veilCut(x + 4, y + 4)).toBeCloseTo(c, 9); }
  });
  it('a veiled material discards by the shared share in its fragment shader, keeps the base\'s own patch and leaves the base alone', () => {
    const base = new THREE.MeshToonMaterial({ color: 0xffffff }); let patched = false;
    base.onBeforeCompile = sh => { patched = true; };
    const u = { value: 0 }, m = veiled(base, u), sh = { uniforms: {}, fragmentShader: 'void main() {\n#include <x>\n}' };
    m.onBeforeCompile(sh, null);
    expect(patched).toBe(true); expect(sh.uniforms.uVeil).toBe(u); expect(sh.fragmentShader).toMatch(/discard/); expect(sh.fragmentShader).toMatch(/uniform float uVeil/);
    expect(m).not.toBe(base); expect(m.userData.shared).toBe(true); expect(base.userData.shared).toBeUndefined(); expect(m.customProgramCacheKey()).toMatch(/veil/);
  });
  it('the view draws the hut\'s parts, thins the roof when he is inside and thickens it when he leaves, and drops the lean-to when the roof is closed', async () => {
    const ctx = new Proxy({}, { get: () => () => {}, set: () => true });   // (a canvas that draws nothing: the kit paints its textures)
    globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
    const { createKit } = await import('../src/render/geometry.js');
    const kit = createKit(createNoise(1337)), scene = new THREE.Scene(), pools = poolsOf(scene);
    const lt = createLeantos(w, home(findSpot().x, findSpot().z, findSpot().heading)), l = lt.list[0], view = createLeantoView(scene, w, kit, lt);
    view.update(); const base = pools.stats().instances;
    for (let k = 0; k < 12; k++) lt.build(l, 'hut');
    view.update(); const walls = pools.stats().instances; expect(walls).toBeGreaterThan(base);   // posts and walls are pooled logs
    expect(view.veil(l)).toBe(0);
    for (let k = 0; k < 8; k++) lt.build(l, 'hut');
    const roofMeshes = () => scene.children.filter(o => o !== pools.host && o.isGroup).flatMap(g => g.children).filter(o => o.userData.veil);
    view.update(); expect(roofMeshes().length).toBeGreaterThan(0);   // the frame has its own meshes
    const inside = { x: l.x, z: l.z }, out = leantoPoint(l, 4, 0);
    view.update(inside, 0); expect(view.veil(l)).toBeCloseTo(VEIL_SHARE, 5);   // (dt 0 = at once)
    view.update(out, 1 / 60); expect(view.veil(l)).toBeLessThan(VEIL_SHARE); expect(view.veil(l)).toBeGreaterThan(0);   // eased
    for (let i = 0; i < 60; i++) view.update(out, 1 / 30); expect(view.veil(l)).toBe(0);
    for (let k = 20; k < 31; k++) lt.build(l, 'hut');
    view.update(); const before = pools.stats().instances; const open = roofMeshes().length;
    lt.build(l, 'hut'); expect(hutDone(l)).toBe(true); view.update();
    expect(pools.stats().instances).toBeLessThan(before);   // the lean-to's posts, ridge, roof and fronds are no longer drawn
    expect(roofMeshes().length).toBeGreaterThanOrEqual(open);   // the roof (with its last frond) stays
    const flood = createLeantoView(new THREE.Scene(), w, kit, lt); flood.update(); lt.list.length = 0; flood.update(); expect(flood.veil(l)).toBe(0);
  });
});

describe('the rain is muffled more inside a hut (audio/mix)', () => {
  it('a quarter of its loudness inside, less than under a lean-to roof, and a darker cutoff', () => {
    expect(HUT_MUFFLE).toBeLessThan(ROOF_MUFFLE); expect(rainLevel(1, true, true)).toBeCloseTo(HUT_MUFFLE, 9); expect(rainLevel(1, true)).toBeCloseTo(ROOF_MUFFLE, 9); expect(rainLevel(1)).toBe(1);
    const base = (o = {}) => ({ x: spawn.x, z: spawn.z, y: spawn.y, sense: senseAround(w, spawn.x, spawn.z, 0), day: 1, wind: windState(w.seed, 20, 1, 1), waterTime: 0, fire: { fires: [], torches: [], strength: () => 0, hissed: 0, hissAt: null }, birds: [], held: false, rain: 1, ...o });
    const open = mixOf(base()).rain, roof = mixOf(base({ covered: true })).rain, hut = mixOf(base({ covered: true, hut: true })).rain;
    expect(hut.gain).toBeLessThan(roof.gain); expect(roof.gain).toBeLessThan(open.gain); expect(hut.cutoff).toBeLessThan(roof.cutoff); expect(roof.cutoff).toBeLessThan(open.cutoff);
  });

  it('0.33.2 "Mend": the door pieces top out level with the walls\' top row; the old lean-to is cut under the hut roof once its frame begins', () => {
    expect(HUT_DOOR_Y + HUT_DOOR_R).toBeCloseTo(HUT_ROW_Y[1] + HUT_LOG_R, 10);
    const flat = () => 0, l = { id: 1, x: 0, z: 0, heading: 0, progress: 1, hut: 12 / 32 };
    expect(hutRoofBegun(l)).toBe(false); expect(hutRoofBegun({ ...l, hut: 13 / 32 })).toBe(true);
    const top = Math.max(...hutWalls(flat, l, 12 / 32).filter(s => s.row === 'door').map(s => Math.max(s.a.y, s.b.y) + s.r));
    expect(top).toBeCloseTo(HUT_ROW_Y[1] + HUT_LOG_R, 1);
    const cut = leantoParts(flat, l).map(s => underHutRoof(flat, l, s)).filter(Boolean);
    expect(cut.length).toBeGreaterThan(0);
    for (const s of cut) for (const p of [s.a, s.b]) expect(p.y).toBeLessThanOrEqual(hutCeiling(p.x * Math.sin(l.heading) + p.z * Math.cos(l.heading)) + 1e-6);
  });
});
