// 0.40.2 "Armful" (agreed with the user 2026-11-19 after the AI test game on 0.40.1): one "buildIn" or "upgrade" builds in every piece he holds that is next (game/game `moreWork`),
// a plan of up to 12 steps is asked for (game/actions PLAN_STEPS; 0.43.1: not refused over it), "pickup" takes the piece named (input.take since 0.41.0, input.pickWant before), a pile of logs gives a dry log first (game/wood take),
// the trunk in the hut's way is named by its id and is always on the menu (game/actor), a refused "use" says why (game/actor `useWhy`), "1 log" not "1 logs", and the rules ask for
// plain words in his thought and his lessons (ai/actPrompt). Seed 1337.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame, REACH } from '../src/game/game.js';
import { createActor } from '../src/game/actor.js';
import { branchesOfTile } from '../src/game/branches.js';
import { frondsOfTile } from '../src/game/fronds.js';
import { stonesOfTile } from '../src/game/stones.js';
import { PIECE_TIME, built, nextKind } from '../src/game/leanto.js';
import { checkPlan, PLAN_STEPS } from '../src/game/actions.js';
import { actFixed, buildLessonMessages } from '../src/ai/actPrompt.js';
import { walkFirstDay } from './helpers/scene.js';

if (!globalThis.window) globalThis.window = new EventTarget();
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
const run = (g, input, s, dt = 1 / 30) => { for (let t = 0; t < s; t += dt) g.update(input, dt); };
let used = 0;
const SRC = { driftwood: () => drift, branch: () => branches, frond: () => fronds };
const give = (g, kind, n = 1) => { for (let i = 0; i < n; i++) g.wood.carried.push({ ...SRC[kind]()[used++ % 40 + 3] }); };
const press = (g, input) => { const o = bigOf(g); expect(o).not.toBeNull(); g.act(o); run(g, input, 0.2); return o; };
const lean = () => {   // a lean-to begun where he stands (one driftwood in), as tests/site (0.43.0 "Hearth": its ring first, one stone, then finished at once)
  const g = createGame(w, spawn, { sleep: { awake: 0.1 } }), input = makeInput({ yaw: 0.8 });
  g.wood.stones.push({ ...stones[3] }); press(g, input); run(g, input, PIECE_TIME + 0.5);
  expect(g.leantos.list.length).toBe(1); g.leantos.list[0].up = { ring: 1 };
  give(g, 'driftwood'); press(g, input); run(g, input, PIECE_TIME + 0.5);
  return { g, input, l: g.leantos.list[0] };
};

describe('one "buildIn" builds in every piece he holds that is next (game/game)', () => {
  it('three pieces of driftwood in one press, each in PIECE_TIME; then nothing is left and nothing more is offered for them', () => {
    const { g, input, l } = lean();
    give(g, 'driftwood', 3); expect(press(g, input)).toMatchObject({ kind: 'buildIn' });
    for (let i = 0; i < 600 && built(l) < 2; i++) run(g, input, 1 / 30);
    expect(built(l)).toBe(2); expect(g.player.work).toMatchObject({ kind: 'build' });   // the next piece goes in at once
    run(g, input, 2 * PIECE_TIME + 0.5); expect(built(l)).toBe(4); expect(g.player.work).toBeNull(); expect(g.wood.carried.length).toBe(0);
  });
  it('stops when the next part needs a kind he does not hold: two branches go in, the frond stays', () => {
    const { g, input, l } = lean();
    give(g, 'driftwood', 3); press(g, input); run(g, input, 3 * PIECE_TIME + 0.5); expect(nextKind(l)).toBe('branch');
    give(g, 'branch', 2); give(g, 'frond'); press(g, input); run(g, input, 3 * PIECE_TIME + 0.5);
    expect(built(l)).toBe(6); expect(g.wood.carried.length).toBe(1); expect(g.wood.carried[0].frond).toBe(true); expect(g.player.work).toBeNull();
  });
  it('a "buildIn" stops when the lean-to is finished: the fronds left over are not built into the walls', () => {
    const { g, input, l } = lean();
    l.progress = 14 / 15; g.leantos.version++;
    give(g, 'frond', 3); press(g, input); run(g, input, 3 * PIECE_TIME + 0.5);
    expect(l.progress).toBe(1); expect(g.wood.carried.length).toBe(2); expect(l.up && l.up.walls).toBeFalsy();
  });
  it('walking off stops it after the pieces built so far, and keeps the rest', () => {
    const { g, input, l } = lean();
    give(g, 'driftwood', 3); press(g, input); run(g, input, PIECE_TIME + 0.5);
    input.up = true; g.update(input, 1 / 30); input.up = false; run(g, input, 2 * PIECE_TIME);
    expect(built(l)).toBe(2); expect(g.wood.carried.length).toBe(2);
  });
  it('an "upgrade" goes on with the next upgrade that wants what he holds (walls, then the bed)', () => {
    const { g, input, l } = lean();
    l.progress = 1; l.up = { ring: 1, walls: 4 / 6 }; g.leantos.version++;
    give(g, 'frond', 3); expect(press(g, input)).toMatchObject({ kind: 'upgrade' }); run(g, input, 3 * PIECE_TIME + 0.5);
    expect(l.up.walls).toBe(1); expect(g.wood.carried.length).toBe(1);   // the bed wants its four branches before its fronds
  });
});

describe('a plan of up to 12 steps is asked for (game/actions)', () => {
  it('12 steps are followed, and 0.43.1 "Loose": 13 too (the number is only asked for)', () => {
    expect(PLAN_STEPS).toBe(12);
    const places = [];
    expect(checkPlan(Array.from({ length: 12 }, () => ({ wait: 1 })), places).ok).toBe(true);
    expect(checkPlan(Array.from({ length: 13 }, () => ({ wait: 1 })), places).ok).toBe(true);
  });
});

describe('"pickup" takes the piece named (input.take, 0.41.0; input.pickWant in 0.40.2)', () => {
  const pair = () => {   // two fallen branches and a spot from which both are within REACH, the first nearer
    const g = createGame(w, spawn);
    for (let i = 0; i < 1500; i++) for (let j = i + 1; j < Math.min(1500, i + 40); j++) {
      const a = branches[i], b = branches[j];
      if (Math.hypot(a.x - b.x, a.z - b.z) > 2) continue;
      for (const f of [0.35, 0.45, 0.55, 0.65]) {
        const x = a.x * (1 - f) + b.x * f, z = a.z * (1 - f) + b.z * f;
        const fa = g.wood.find(x, z, REACH, 'log', l => l.id === a.id), fb = g.wood.find(x, z, REACH, 'log', l => l.id === b.id);
        if (fa && fb && Math.abs(fa.d - fb.d) > 0.02) return { a, b, x, z };
      }
    }
    return null;
  };
  it('a nearer piece is offered without it; with it, the wanted one and nothing else', () => {
    const q = pair(); expect(q).toBeTruthy();
    const { a, b, x, z } = q;
    const g = createGame(w, { x, z, y: w.H(x, z) }, { sleep: { awake: 0.1 } });
    const pick = () => g.actions().find(o => o.kind === 'pickup');
    const near = pick(); expect(near).toBeTruthy();
    const other = near.thing.log.id === a.id ? b : a;
    expect(g.wood.find(x, z, REACH, 'log', l => l.id === other.id)).toBeTruthy();   // the other one is within reach too
    const input = makeInput({ take: { id: other.id } }); g.update(input, 0);
    expect(pick().thing.log.id).toBe(other.id);
    expect(g.actions().filter(o => o.kind === 'pickup')).toHaveLength(1);
    g.update(makeInput(), 0); expect(pick().thing.log.id).toBe(near.thing.log.id);   // gone with the next step
  });
  it('the actor sets it on a "take" of a loose piece', () => {
    const g = createGame(w, spawn, { sleep: { awake: 0.1 } }); walkFirstDay(w, g, spawn); g.known.visit(spawn.x, spawn.z);
    let n = 0, target = null;
    const a = createActor(w, g, { chooser: m => { if (n++) return null; target = m.places.find(q => q.kind === 'driftwood' || q.kind === 'branch'); return [{ take: target.id }]; } });
    let seen = null;
    for (let i = 0; i < 1500 && !seen; i++) { a.step(0.1); g.update(a.input, 0.1); if (a.input.take && Number.isFinite(a.input.take.id)) seen = a.input.take.id; }
    expect(seen).toBe(target.ref.id);
  });
});

describe('a pile of logs gives a dry log first (game/wood take)', () => {
  it('the dry one under a green one; the top one when all are green', () => {
    const g = createGame(w, spawn), t = g.clock.total;
    const log = (id, cut) => ({ id, x: spawn.x + 0.5, z: spawn.z, y: 0, len: 2, a: 0, rad: 0.12, timber: true, cut });
    const dry = log(90001, t - 3), green = log(90002, t);
    const pile = { x: spawn.x + 0.5, z: spawn.z, kind: 'log', logs: [dry, green] }; g.wood.piles.push(pile);
    expect(g.wood.take({ kind: 'pile', pile }, t)).toBe(1); expect(g.wood.log).toBe(dry); expect(pile.logs).toEqual([green]);
    const g2 = createGame(w, spawn), p2 = { x: spawn.x + 0.5, z: spawn.z, kind: 'log', logs: [log(90003, t), log(90004, t)] }; g2.wood.piles.push(p2);
    g2.wood.take({ kind: 'pile', pile: p2 }, t); expect(g2.wood.log.id).toBe(90004);
  });
});

describe('the trunk in the hut\'s way, by its id (game/actor)', () => {
  it('the lean-to says "a tree trunk (treeN)" and that tree is on the menu, also without an axe', () => {
    let g = null, l = null;
    const trees = w.tiles.flatMap(t => t.trees).filter(q => Math.hypot(q.x - spawn.x, q.z - spawn.z) < 90);
    for (const tree of trees) {
      for (const [dx, dz] of [[0, 2.2], [2.2, 0], [0, -2.2], [-2.2, 0]]) {   // a finished lean-to with walls, bed and ring beside a trunk
        const cand = { id: 0, x: tree.x + dx, z: tree.z + dz, heading: 0, progress: 1, up: { walls: 1, bed: 1, ring: 1 } };
        const h = createGame(w, { x: cand.x, z: cand.z + 1.4, y: w.H(cand.x, cand.z + 1.4) }, { leantos: { list: [cand], nextId: 1 }, sleep: { awake: 0.1 } });
        const b = h.hutBlock(h.leantos.list[0]);
        if (b && b.what === 'tree' && Number.isInteger(b.tree)) { g = h; l = h.leantos.list[0]; break; }
      }
      if (g) break;
    }
    expect(g).toBeTruthy();
    for (let dx = -40; dx <= 40; dx += 8) for (let dz = -40; dz <= 40; dz += 8) g.known.visit(l.x + dx, l.z + dz);
    const a = createActor(w, g, { chooser: () => null });
    const m = a.menu(), home = m.places.find(q => q.kind === 'leanto');
    expect(home.what).toMatch(/the hut has no room here: a tree trunk \(tree\d+\) .* stands in its way; fell it/);
    const id = home.what.match(/\((tree\d+)\)/)[1], tree = m.places.find(q => q.id === id);
    expect(tree).toBeTruthy(); expect(tree.kind).toBe('tree'); expect(tree.ref.id).toBe(g.hutBlock(l).tree);
    expect(g.axe.has()).toBe(false);
  });
});

describe('a refused "use" says why (game/actor)', () => {
  it('a coconut he does not carry', () => {
    const g = createGame(w, spawn, { sleep: { awake: 0.1 } }); g.known.visit(spawn.x, spawn.z);
    const asks = []; let n = 0;
    const a = createActor(w, g, { chooser: (m, ask) => { asks.push(ask); return n++ ? null : [{ use: 'nut' }]; } });
    for (let i = 0; i < 50; i++) { a.step(0.1); g.update(a.input, 0.1); }
    expect(asks[1].why).toBe('failed'); expect(asks[1].last.reason).toBe('he carries no coconut');
  });
});

describe('the rules (ai/actPrompt)', () => {
  it('say what one "buildIn" builds, the 12 steps, and plain words in his thought and his lessons', () => {
    const f = actFixed('Dave');
    expect(f).toMatch(/One "buildIn" or "upgrade" builds in every piece he carries that is next, one after another/);
    expect(f).toMatch(/At most 12 steps\./);
    expect(f).toMatch(/in plain words: never an id of the menu such as driftwood1 or pile3/);
    const sys = buildLessonMessages({ name: 'Dave', state: {}, recent: [], lessons: [], notes: [] })[0].content;
    expect(sys).toMatch(/in plain words \(never an id of the menu such as driftwood1 or pile3\)/);
  });
});

