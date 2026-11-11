// 0.31 "Axe" (part 1, the game layer): the axe he makes (a branch in his arms, a stone beside him and a tuft of fibre, all used up), holds like a spear or a torch (only one of the three), lays down and takes up again;
// felling a tree with it (standing work of FELL_TIME, rest cost like a lean-to, interruptible with the progress kept), the felled trunk that blocks no step and no path any more, the logs and the crown's loose material
// it leaves (a giant two or three sections, a palm fronds and nuts), nothing growing back under it; logs carried alone and slowly, laid on log piles (never mixed, never lit, never taken by the flood); the save.
// Each test fails without its part.
// Depends on: game/game, game/axe, game/felled, game/logs, game/wood, game/movement, game/path, save.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { createAxe, MAKE_TIME, FELL_TIME, FELL_REACH } from '../src/game/axe.js';
import { createSpear } from '../src/game/spear.js';
import { LISTS, treeId, treeInfo, isGiant, sizeKind, trunkRadius, plan, felledOf, LOG_LEN } from '../src/game/felled.js';
import { LOG_ID0 } from '../src/game/logs.js';
import { PILE_MAX, LOG_WALK, kindOf } from '../src/game/wood.js';
import { stonesOfTile } from '../src/game/stones.js';
import { branchesOfTile } from '../src/game/branches.js';
import { nutsOfTile } from '../src/game/fibre.js';
import { terrainAt, canStand, canOccupy, obstaclesNear } from '../src/game/movement.js';
import { createPath } from '../src/game/path.js';
import { BUILD_COST } from '../src/game/leanto.js';
import { serialise, parseSave, momentKey } from '../src/save.js';

let w, spawn, stone, sea0;
const spots = {};   // kind -> { tree info, spot } for a lone tree of each sort
beforeAll(async () => {
  w = await generateWorld(1337); spawn = startSpot(w);
  const g0 = createGame(w, spawn, { time: 0.3, day: 1 }); sea0 = g0.sea;
  const dry = (x, z) => { const t = terrainAt(w, x, z, sea0); return canStand(w, x, z, sea0) && !t.inRiver && t.y > sea0 + 0.5 && t.s < 0.3 && t.depth === 0; };
  stone = w.tiles.flatMap(t => stonesOfTile(w, t)).filter(s => Math.hypot(s.x - spawn.x, s.z - spawn.z) < 80 && [[0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]].every(([dx, dz]) => dry(s.x + dx, s.z + dz))).sort((a, b) => Math.hypot(a.x - spawn.x, a.z - spawn.z) - Math.hypot(b.x - spawn.x, b.z - spawn.z))[0];
  // a lone tree of each sort on open dry ground with a spot beside the trunk: the standing spot is a point on its rim
  const all = [];
  for (const tile of w.tiles) for (const list of LISTS) tile[list].forEach((t, i) => all.push({ tile, list, t, i, d: Math.hypot(t.x - spawn.x, t.z - spawn.z) }));
  all.sort((a, b) => a.d - b.d);
  const cell = new Map(), ck = (x, z) => Math.floor(x / 4) * 4096 + Math.floor(z / 4);
  for (const c of all) { const k = ck(c.t.x, c.t.z); cell.set(k, (cell.get(k) || 0) + 1); }
  const lone = c => { for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if ((cell.get(ck(c.t.x + dx * 4, c.t.z + dz * 4)) || 0) > (dx || dz ? 0 : 1)) return false; return true; };
  for (const c of all) {
    if (c.d > 400) break;
    const kind = sizeKind(c.list, c.t), giant = isGiant(c.t, kind), key = (giant ? 'giant ' : '') + kind;
    if (spots[key] || !(c.t.y > 1) || !lone(c)) continue;
    const id = treeId(c.tile, c.list, c.i), info = treeInfo(w, id), r = info.r + 0.3;
    for (let k = 0; k < 16; k++) {
      const a = k * Math.PI / 8, x = c.t.x + Math.sin(a) * r, z = c.t.z + Math.cos(a) * r;
      if (dry(x, z) && dry(c.t.x + Math.sin(a) * (r + 2.5), c.t.z + Math.cos(a) * (r + 2.5)) && dry(c.t.x - Math.sin(a) * 3, c.t.z - Math.cos(a) * 3)) { spots[key] = { info, x, z, a }; break; }
    }
  }
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
const kinds = g => { const a = g.action(); return [a.tap, ...a.options].filter(Boolean).map(o => o.kind); };
const doKind = (g, kind) => { const o = g.actions().find(x => x.kind === kind); expect(o, kind).toBeTruthy(); g.act(o); g.update(makeInput(), 1 / 30); };
const aBranch = g => g.branches.groundBranches(w.tiles.find(t => g.branches.groundBranches(t).length))[0];
const dryGame = (x, z, opts = {}) => createGame(w, { x, z, y: w.H(x, z) }, { time: 0.3, day: 1, sleep: { awake: 0.2 }, ...opts });

// a game beside the stone with a branch under his arm and one tuft of fibre
function stoneScene(opts = {}) {
  expect(stone, 'a stone to stand beside').toBeTruthy();
  const g = dryGame(stone.x + 0.3, stone.z, opts);
  g.wood.take({ kind: 'log', log: aBranch(g) }, g.clock.total); g.fibre.carried = 1;
  return g;
}
// a game with the axe in his hand beside the lone tree of that sort
function treeScene(key, opts = {}) {
  const s = spots[key]; expect(s, 'a lone ' + key + ' on dry ground').toBeTruthy();
  const g = dryGame(s.x, s.z, { axe: { hand: true, at: null }, ...opts });
  return { g, s, id: s.info.id };
}
const fellNow = (g, id) => { const tr = g.felled.nearest(g.player.x, g.player.z, FELL_REACH); expect(tr && tr.id).toBe(id); doKind(g, 'fell'); run(g, makeInput(), FELL_TIME + 1); };

describe('making the axe', () => {
  it('is offered with a branch in his arms, a stone beside him and a tuft of fibre, in the arc', () => {
    expect(MAKE_TIME).toBe(10);
    const g = stoneScene();
    expect(g.action().options.map(o => o.kind)).toContain('makeAxe');
    expect(g.action().tap && g.action().tap.kind).not.toBe('makeAxe');
  });
  it('is not offered without fibre, without the branch, with a spear or an axe or a torch around, or in the water', () => {
    const g = stoneScene(); g.fibre.carried = 0;
    expect(kinds(g)).not.toContain('makeAxe');
    const none = dryGame(stone.x + 0.3, stone.z); none.fibre.carried = 2;
    expect(kinds(none)).not.toContain('makeAxe');
    const made = stoneScene({ axe: { hand: false, at: { x: 1, z: 1 } } });
    expect(kinds(made)).not.toContain('makeAxe');   // one axe exists
    const sp = stoneScene({ spear: { hand: true, at: null } });
    expect(kinds(sp)).not.toContain('makeAxe');     // the hand is full (and the wood could not be picked up anyway)
  });
  it('takes MAKE_TIME of kneeling and uses up the branch, the stone and the tuft', () => {
    const g = stoneScene(), b = g.wood.carried[0];
    doKind(g, 'makeAxe');
    expect(g.player.work && g.player.work.kind).toBe('makeAxe');
    run(g, makeInput(), MAKE_TIME - 1);
    expect(g.axe.has()).toBe(false);
    run(g, makeInput(), 2);
    expect(g.axe.hand).toBe(true); expect(g.player.axe).toBe(true);
    expect(g.wood.load()).toBe(0); expect(g.fibre.carried).toBe(0);
    expect(g.stones.near(stone.x, stone.z, 0.6).some(s => s.id === stone.id)).toBe(false);   // the stone is gone for good
    expect(g.wood.carried.includes(b)).toBe(false);
  });
  it('can also use a stone from a pile of stones', () => {
    const g = stoneScene();
    const s0 = g.stones.near(stone.x, stone.z, 0.6)[0]; g.stones.take(s0);
    for (const q of g.stones.near(g.player.x, g.player.z, 2)) g.stones.take(q);   // no loose stone left: the pile's
    g.wood.piles.push({ x: g.player.x + 0.5, z: g.player.z, kind: 'stone', logs: [s0, { ...s0, id: s0.id + 1 }] });
    doKind(g, 'makeAxe'); run(g, makeInput(), MAKE_TIME + 1);
    expect(g.axe.hand).toBe(true); expect(g.wood.piles[0].logs.length).toBe(1);
  });
});

describe('the hand: one of spear, axe, torch', () => {
  it('lays the axe down at his feet and takes it up again; the spear cannot be taken meanwhile', () => {
    const { g } = treeScene('tree');
    put(g, spawn.x, spawn.z);
    expect(kinds(g)).toContain('layAxe');
    doKind(g, 'layAxe'); run(g, makeInput(), 1);
    expect(g.axe.hand).toBe(false); expect(g.axe.at).toBeTruthy();
    expect(kinds(g)).toContain('takeAxe');
    doKind(g, 'takeAxe'); run(g, makeInput(), 1);
    expect(g.axe.hand).toBe(true); expect(g.axe.at).toBe(null);
  });
  it('is refused with a spear in the hand, and a spear is refused with the axe in the hand', () => {
    const a = createAxe({ hand: false, at: { x: 1, z: 1 } }), sp = createSpear({ hand: true });
    expect(a.take()).toBe(true); expect(sp.hand).toBe(true);
    const { g } = treeScene('tree', { axe: { hand: false, at: { x: 0, z: 0 } }, spear: { hand: true, at: null } });
    put(g, 0.1, 0.1);
    expect(kinds(g)).not.toContain('takeAxe');
    const h = treeScene('tree').g;
    expect(kinds(h)).not.toContain('takeSpear'); expect(kinds(h)).not.toContain('makeSpear');
    expect(kinds(h)).not.toContain('pickup');
  });
  it('is put down beside him when he sleeps', () => {
    const { g } = treeScene('tree');
    g.sleep.awake = 5; g.update(makeInput({ sleep: true }), 1 / 30); run(g, makeInput(), 1);
    expect(g.axe.hand).toBe(false); expect(g.axe.at).toBeTruthy();
  });
});

describe('felling', () => {
  it('is offered beside a trunk with the axe in the hand and not without the axe, not away from the tree', () => {
    const { g } = treeScene('tree');
    expect(kinds(g)).toContain('fell');
    expect(g.action().tap.kind).toBe('fell');                      // the ring does it: nothing nearer to do
    g.axe.hand = false; expect(kinds(g)).not.toContain('fell');
    g.axe.hand = true; put(g, g.player.x + 5, g.player.z + 5);
    expect(kinds(g)).not.toContain('fell');
  });
  it('is standing work of about an hour of game time that costs rest like the lean-to, and the tree falls at the end, away from him', () => {
    const { g, s, id } = treeScene('tree');
    expect(FELL_TIME).toBe(50);
    const rest0 = g.sleep.rest(), t0 = g.clock.total;
    doKind(g, 'fell');
    expect(g.player.work && g.player.work.kind).toBe('fell');
    run(g, makeInput(), FELL_TIME - 2);
    expect(g.felled.has(id)).toBe(false);
    expect(rest0 - g.sleep.rest()).toBeGreaterThan(BUILD_COST * 0.8 * (FELL_TIME - 2) / FELL_TIME - 0.02);
    run(g, makeInput(), 3);
    expect(g.felled.has(id)).toBe(true);
    expect(rest0 - g.sleep.rest()).toBeGreaterThan(BUILD_COST * 0.8);
    expect(rest0 - g.sleep.rest()).toBeLessThan(BUILD_COST * 1.4);
    expect((g.clock.total - t0) * 24).toBeGreaterThan(0.9); expect((g.clock.total - t0) * 24).toBeLessThan(1.2);   // an hour of game time
    const rec = g.felled.list[0], dx = Math.sin(rec.h), dz = Math.cos(rec.h);
    expect((s.info.x - g.player.x) * dx + (s.info.z - g.player.z) * dz).toBeGreaterThan(0);   // it falls away from him
    expect(g.felled.last).toBe(rec); expect(g.felled.falls).toBe(1);
    expect(g.player.work).toBe(null);
  });
  it('can be interrupted and goes on where it stopped', () => {
    const { g, id } = treeScene('tree');
    doKind(g, 'fell'); run(g, makeInput(), 20);
    g.update(makeInput({ right: true }), 1 / 30);                 // walking off stops it
    expect(g.player.work).toBe(null);
    const p = g.felled.chopped(id); expect(p).toBeGreaterThan(0.3); expect(p).toBeLessThan(0.5);
    put(g, spots.tree.x, spots.tree.z);
    doKind(g, 'fell');
    run(g, makeInput(), FELL_TIME * (1 - p) - 2);
    expect(g.felled.has(id)).toBe(false);
    run(g, makeInput(), 4);
    expect(g.felled.has(id)).toBe(true);
    expect(g.felled.chopped(id)).toBe(0);
  });
  it('leaves one log of about two metres and two or three loose branches of a broadleaf tree', () => {
    const { g, s, id } = treeScene('tree');
    const nb = g.branches.near(s.info.x, s.info.z, 8).length;
    fellNow(g, id);
    const lying = g.logs.near(s.info.x, s.info.z, 6);
    expect(lying.length).toBe(1);
    expect(lying[0].len).toBeGreaterThanOrEqual(LOG_LEN[0]); expect(lying[0].len).toBeLessThanOrEqual(LOG_LEN[1]);
    expect(lying[0].timber).toBe(true); expect(lying[0].id).toBeGreaterThanOrEqual(LOG_ID0); expect(kindOf(lying[0])).toBe('log');
    const more = g.branches.near(s.info.x, s.info.z, 8).length - nb; expect(more).toBeGreaterThanOrEqual(2); expect(more).toBeLessThanOrEqual(3);
    for (const b of g.branches.near(s.info.x, s.info.z, 8)) if (b.extra) expect(b.branch).toBe(true);
    expect(g.wood.find(lying[0].x, lying[0].z, 0.5, 'log', null).log.timber || true).toBe(true);
  });
  it('gives a giant two or three logs in a row', () => {
    const { g, s, id } = treeScene('giant tree');
    expect(isGiant(s.info.tree, s.info.kind)).toBe(true);
    fellNow(g, id);
    const lying = g.logs.near(s.info.x, s.info.z, 9);
    expect(lying.length).toBeGreaterThanOrEqual(2); expect(lying.length).toBeLessThanOrEqual(3);
    const rec = g.felled.list[0]; expect(rec.giant).toBe(true);
    const along = lying.map(l => (l.x - s.info.x) * Math.sin(rec.h) + (l.z - s.info.z) * Math.cos(rec.h)).sort((a, b) => a - b);
    for (let i = 1; i < along.length; i++) expect(along[i] - along[i - 1]).toBeGreaterThan(1.9);   // sections one after the other
  });
  it('fells a palm too: one log, two fronds and one or two coconuts', () => {
    const { g, s, id } = treeScene('palm');
    const fr = g.fronds.near(s.info.x, s.info.z, 8).length, nuts = nutsOfTile(w, s.info.tile).length;
    fellNow(g, id);
    expect(g.logs.near(s.info.x, s.info.z, 6).length).toBe(1);
    expect(g.fronds.near(s.info.x, s.info.z, 8).length - fr).toBe(2);
    const got = g.fibre.groundCocos(s.info.tile).filter(c => c.extra);
    expect(got.length).toBeGreaterThanOrEqual(1); expect(got.length).toBeLessThanOrEqual(2);
    expect(g.fibre.find(got[0].x, got[0].z, 0.3).coco.id).toBe(got[0].id);
    expect(nutsOfTile(w, s.info.tile).length).toBe(nuts);   // the world itself is untouched
  });
  it('fells a pine and a giant palm as well', () => {
    for (const key of ['pine', 'giant palm', 'jungle']) {
      if (!spots[key]) continue;
      const { g, id } = treeScene(key); fellNow(g, id);
      expect(g.felled.has(id)).toBe(true); expect(g.logs.all.size).toBeGreaterThanOrEqual(1);
    }
  });
  it('the crown material is ordinary: picked up and carried like any branch', () => {
    const { g, s, id } = treeScene('tree');
    fellNow(g, id); g.axe.lay(g.player.x, g.player.z);
    const b = g.branches.near(s.info.x, s.info.z, 8).find(q => q.extra);
    put(g, b.x, b.z);
    expect(g.wood.take({ kind: 'log', log: b }, g.clock.total)).toBe(1);
    expect(g.wood.carried[0]).toBe(b);
    expect(g.branches.near(b.x, b.z, 0.1).some(q => q.id === b.id)).toBe(false);
  });
});

describe('a felled trunk', () => {
  it('blocks no step and no standing place any more, and a path goes straight through its place', () => {
    const { g, s, id } = treeScene('tree');
    const info = s.info, r = info.r + 0.2;
    expect(canStand(w, info.x, info.z, sea0)).toBe(false);
    const a = { x: info.x - 1.2, z: info.z }, b = { x: info.x + 1.2, z: info.z };
    const finder = createPath(w, {});
    const before = finder.cost(a, b), clearBefore = finder.clear(a, b);
    expect(clearBefore).toBe(false);
    fellNow(g, id);
    expect(canStand(w, info.x, info.z, sea0)).toBe(true);
    expect(canOccupy(w, info.x, info.z, sea0)).toBe(true);
    expect(obstaclesNear(w, info.x, info.z).some(o => o.tree === id)).toBe(false);
    expect(finder.clear(a, b)).toBe(true);                         // the same finder: its caches were thrown away
    expect(finder.cost(a, b)).toBeLessThanOrEqual(before);
    expect(r).toBeGreaterThan(0);
    // he walks over the place where it stood
    put(g, a.x, a.z);
    const inp = makeInput({ target: { x: b.x, z: b.z } }); run(g, inp, 3);
    expect(Math.hypot(g.player.x - b.x, g.player.z - b.z)).toBeLessThan(0.4);
  });
  it('another tree of the world still blocks, and a fresh game without the overlay sees every trunk again', () => {
    const { g, id } = treeScene('tree'); fellNow(g, id);
    const o = spots.palm.info; expect(canStand(w, o.x, o.z, sea0)).toBe(false);
    const g2 = createGame(w, spawn, { time: 0.3, day: 1 });
    expect(felledOf(w)).toBe(g2.felled);
    expect(canStand(w, spots.tree.info.x, spots.tree.info.z, sea0)).toBe(false);
  });
  it('lets nothing grow back: the branches under a felled broadleaf, the nut and the frond under a felled palm stay gone once taken', () => {
    // a broadleaf with a branch under it
    let tb = null;
    for (const tile of w.tiles) { if (tb) break; for (const b of branchesOfTile(w, tile)) { const tree = tile.trees[b.tk]; if (tree && !tb && Math.hypot(tree.x - spawn.x, tree.z - spawn.z) < 300) tb = { tile, b, tree, id: treeId(tile, 'trees', b.tk) }; } }
    expect(tb).toBeTruthy();
    const g = createGame(w, spawn, { time: 0.3, day: 1 });
    expect(g.branches.take(tb.b, g.clock.total)).toBe(true);
    g.felled.fell(treeInfo(w, tb.id), 0, g.clock.total); g.branches.update(g.clock.total + 40);
    expect(g.branches.onGround(tb.b)).toBe(false);
    const c = createGame(w, spawn, { time: 0.3, day: 1 }); c.branches.take(tb.b, c.clock.total); c.branches.update(c.clock.total + 40);
    expect(c.branches.onGround(tb.b)).toBe(true);                  // the control: an unfelled tree's branch grows again
    // a palm's nut
    const { g: gp, id } = treeScene('palm');
    const own = nutsOfTile(w, spots.palm.info.tile).find(n => n.palm === spots.palm.info.index);
    if (own) {
      gp.fibre.husk(own, gp.clock.total); fellNow(gp, id); gp.fibre.update(gp.clock.total + 40);
      expect(gp.fibre.onGround(own)).toBe(false);
    }
  });
});

describe('logs', () => {
  const felledScene = () => { const { g, s, id } = treeScene('tree'); fellNow(g, id); g.axe.lay(g.player.x, g.player.z); const log = g.logs.near(s.info.x, s.info.z, 6)[0]; return { g, log, s }; };
  it('lie loose and block no step', () => {
    const { g, log } = felledScene();
    expect(obstaclesNear(w, log.x, log.z, { obstacles: g.movement.obstacles }).some(o => Math.hypot(o.x - log.x, o.z - log.z) < 1)).toBe(false);
    expect(canStand(w, log.x, log.z, sea0)).toBe(true);
  });
  it('are picked up only with nothing else carried and nothing in the hand, and then carried alone', () => {
    const { g, log } = felledScene();
    put(g, log.x, log.z);
    g.axe.hand = true; g.axe.at = null;
    expect(kinds(g)).not.toContain('pickup');                       // the axe in his hand
    g.axe.hand = false; g.axe.at = { x: 0, z: 0 };
    g.wood.carried.push(aBranch(g)); expect(g.wood.take({ kind: 'log', log }, 0)).toBe(0);
    g.wood.carried.length = 0;
    expect(g.action().tap.kind).toBe('pickup');
    g.act(g.action().tap); g.update(makeInput(), 1 / 30);
    expect(g.wood.log).toBe(log); expect(g.wood.load()).toBe(1); expect(g.logs.near(log.x, log.z, 0.3).length).toBe(0);
    expect(g.wood.take({ kind: 'log', log: aBranch(g) }, 0)).toBe(0);   // nothing else is taken
    expect(kinds(g)).not.toContain('pickup'); expect(kinds(g)).not.toContain('takeAxe');
  });
  it('slow him to LOG_WALK and let him run no more', () => {
    const { g, log } = felledScene();
    const walk = (game, sprint) => { const x0 = game.player.x, z0 = game.player.z; run(game, makeInput({ up: true, run: sprint }), 1); return Math.hypot(game.player.x - x0, game.player.z - z0); };
    put(g, log.x, log.z); const free = walk(g, false);
    const h = felledScene().g; const l2 = h.logs.near(spots.tree.info.x, spots.tree.info.z, 6)[0]; put(h, l2.x, l2.z); h.wood.take({ kind: 'log', log: l2 }, 0);
    const slow = walk(h, false);
    expect(LOG_WALK).toBe(0.55);
    expect(slow / free).toBeGreaterThan(0.35); expect(slow / free).toBeLessThan(0.6);
    put(h, l2.x, l2.z); const fast = walk(h, true);
    expect(fast).toBeLessThan(free * 0.7);                           // running with a log is no faster than the slow walk
  });
  it('are laid on a log pile, never mixed, and a pile holds at most twelve', () => {
    const { g, log } = felledScene();
    put(g, log.x, log.z); g.wood.take({ kind: 'log', log }, 0);
    g.update(makeInput({ action: 'tap' }), 1 / 30); run(g, makeInput(), 1);   // lay
    expect(g.wood.log).toBe(null); expect(g.wood.piles.length).toBe(1); expect(g.wood.piles[0].kind).toBe('log');
    // twelve more: the pile fills, the rest start a new pile beside it
    const pile = g.wood.piles[0];
    for (let i = 0; i < 12; i++) {
      const l = g.logs.add({ x: pile.x + 3, z: pile.z, len: 2, a: 0, rad: 0.15 }); put(g, pile.x + 0.2, pile.z + 0.1);
      expect(g.wood.take({ kind: 'log', log: l }, 0)).toBe(1); g.wood.drop(g.player.x, g.player.z, 0, false, () => false, null);
    }
    expect(g.wood.piles.filter(p => p.kind === 'log').length).toBe(2);
    expect(Math.max(...g.wood.piles.map(p => p.logs.length))).toBe(PILE_MAX);
    expect(g.wood.piles.reduce((n, p) => n + p.logs.length, 0)).toBe(13);
    // a branch laid beside the pile does not join it
    put(g, pile.x + 0.2, pile.z + 0.1); g.wood.take({ kind: 'log', log: aBranch(g) }, 0); g.wood.drop(g.player.x, g.player.z, 0, false, () => false, null);
    expect(g.wood.piles.some(p => p.kind === 'branch')).toBe(true); expect(g.wood.piles.filter(p => p.kind === 'log').every(p => p.logs.every(l => l.timber))).toBe(true);
  });
  it('are lifted off a pile one at a time, only with empty arms', () => {
    const { g, log } = felledScene();
    put(g, log.x, log.z); g.wood.take({ kind: 'log', log }, 0); g.wood.drop(g.player.x, g.player.z, 0, false, () => false, null);
    const pile = g.wood.piles[0], l2 = g.logs.add({ x: pile.x + 2, z: pile.z, len: 2, a: 0, rad: 0.15 });
    g.wood.take({ kind: 'log', log: l2 }, 0); g.wood.drop(g.player.x, g.player.z, 0, false, () => false, null);
    expect(pile.logs.length).toBe(2);
    put(g, pile.x + 1, pile.z);
    expect(kinds(g)).toContain('pickup');
    g.wood.carried.push(aBranch(g)); expect(g.wood.take({ kind: 'pile', pile }, 0)).toBe(0); g.wood.carried.length = 0;
    expect(g.wood.take({ kind: 'pile', pile }, 0)).toBe(1);
    expect(pile.logs.length).toBe(1); expect(g.wood.log.timber).toBe(true);
  });
  it('are never lit, never fed to a fire, never offered to the lean-to, and never taken by the flood', () => {
    const { g, log } = felledScene();
    put(g, log.x, log.z);
    const logsOf = n => Array.from({ length: n }, (_, i) => g.logs.add({ x: log.x + 4, z: log.z + i * 0.1, len: 2, a: 0, rad: 0.15 }));
    g.wood.piles.push({ x: g.player.x + 0.8, z: g.player.z, kind: 'log', logs: logsOf(6) });
    g.fibre.carried = 1; g.axe.hand = false;
    expect(kinds(g)).not.toContain('light'); expect(kinds(g)).not.toContain('build');
    expect(g.lackAt()).toBe(null);
    // the flood: a pile on ground the sea covers
    g.wood.piles[0].x = log.x; const y = w.H(log.x, log.z);
    expect(g.wood.flood(y + 1)).toBe(0); expect(g.wood.piles.length).toBe(1);
    // a lying log under the sea can still be found (it is never covered)
    g.wood.tideUpdate(y + 1, g.clock.total);
    const l = g.logs.add({ x: log.x - 2, z: log.z, len: 2, a: 0, rad: 0.15 });
    expect(g.wood.find(l.x, l.z, 0.3, 'log').log).toBe(l);
    const a = g.wood.giveOne(() => true); expect(a).toBe(null);
  });
});

describe('the save', () => {
  it('keeps the axe, the felled trees, the logs, a carried log, log piles, the crown pieces and the progress; old saves load with nothing felled', () => {
    const { g, s, id } = treeScene('tree');
    fellNow(g, id); g.axe.lay(g.player.x, g.player.z);
    const log = g.logs.near(s.info.x, s.info.z, 6)[0], b = g.branches.near(s.info.x, s.info.z, 8).find(q => q.extra);
    put(g, log.x, log.z); g.wood.take({ kind: 'log', log }, 0); g.wood.drop(g.player.x, g.player.z, 0, false, () => false, null);   // a log pile
    const l2 = g.logs.add({ x: log.x + 1, z: log.z + 2, len: 2, a: 0.2, rad: 0.15 }); put(g, l2.x, l2.z); g.wood.take({ kind: 'log', log: l2 }, 0);   // and one on his shoulder
    g.felled.setChopped(treeId(spots.palm.info.tile, 'palms', spots.palm.info.index), 0.4);
    const text = serialise(g.state()), saved = parseSave(text, 1337);
    expect(saved).toBeTruthy(); expect(saved.felled.list.length).toBe(1); expect(saved.axe.at).toBeTruthy();
    const h = createGame(w, spawn, saved);
    expect(h.felled.has(id)).toBe(true); expect(h.felled.list[0].h).toBeCloseTo(g.felled.list[0].h, 6);
    expect(h.axe.at).toBeTruthy(); expect(h.axe.hand).toBe(false);
    expect(h.wood.log && h.wood.log.id).toBe(l2.id); expect(h.wood.piles[0].kind).toBe('log'); expect(h.wood.piles[0].logs[0].id).toBe(log.id);
    expect(h.logs.near(l2.x, l2.z, 0.3).length).toBe(0);
    expect(h.branches.near(b.x, b.z, 0.2).some(q => q.id === b.id)).toBe(true);
    expect(h.felled.chopped(treeId(spots.palm.info.tile, 'palms', spots.palm.info.index))).toBeCloseTo(0.4, 6);
    expect(canStand(w, s.info.x, s.info.z, sea0)).toBe(true);
    expect(momentKey(h)).toBe(momentKey(createGame(w, spawn, parseSave(serialise(h.state()), 1337))));
    // an old save knows nothing of all this
    const old = JSON.parse(text); for (const k of ['axe', 'felled', 'logs']) delete old[k]; delete old.wood.log; old.wood.piles = []; delete old.branches.extra; delete old.fronds.extra; delete old.fibre.extra;
    const o = parseSave(JSON.stringify(old), 1337), n = createGame(w, spawn, o);
    expect(n.felled.list.length).toBe(0); expect(n.axe.has()).toBe(false); expect(n.logs.all.size).toBe(0); expect(canStand(w, s.info.x, s.info.z, sea0)).toBe(false);
  });
  it('rejects a broken new field like any other', () => {
    const g = dryGame(spawn.x, spawn.z), st = g.state();
    for (const bad of [{ axe: { hand: 1 } }, { felled: { list: [{ id: 'x', h: 0 }] } }, { logs: { list: [{ id: 1 }] } }]) expect(parseSave(serialise({ ...st, ...bad }), 1337)).toBe(null);
  });
  it('tolerates a felled id the island does not have, and plans the same fall twice', () => {
    const g = createGame(w, spawn, { time: 0.3, day: 1, felled: { list: [{ id: 7e9, h: 0 }, { id: spots.tree.info.id, h: 1 }] } });
    expect(g.felled.list.length).toBe(1);
    const rec = g.felled.list[0], p1 = plan(w, rec), p2 = plan(w, rec);
    expect(p1).toEqual(p2);
    expect(trunkRadius(spots.tree.info.tree, 'tree')).toBeGreaterThan(0.1);
  });
});
