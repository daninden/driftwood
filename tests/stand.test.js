// Standing points (0.30.3 "Routes", game/stand), real movement: for every action kind the castaway walks, with the real game.update and the follower of game/route, to the spot the module chose, from
// 8 directions, with piles of 1, 3, 6 and 12 pieces, alone and with a lean-to wall or a small neighbouring pile beside the object. On arrival the game must offer the action FOR THE INTENDED OBJECT
// (the pile wood joins, the pile the arc takes from, the fire a feed goes on ...) and doing it must succeed: wood joins the intended pile and makes no new one, the intended pile gives its pieces, the fire
// is fed, the pile is lit, the lean-to is begun, the upgrade progresses. Where no spot exists (a full pile takes no more wood, 3 pieces cannot be lit) the answer is an honest null.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { createPath } from '../src/game/path.js';
import { createRoute } from '../src/game/route.js';
import { branchesOfTile } from '../src/game/branches.js';
import { frondsOfTile } from '../src/game/fronds.js';
import { BURN, EMBERS, TORCH_DAYS } from '../src/game/fire.js';
import { findSpots } from './helpers/spots.js';

let w, spawn, C, logs, branches, fronds;
beforeAll(async () => {
  w = await generateWorld(1337); spawn = startSpot(w);
  C = findSpots(w, spawn).open;
  const d = o => Math.hypot(o.x - spawn.x, o.z - spawn.z), by = list => list.sort((a, b) => d(a) - d(b));
  logs = by(w.tiles.flatMap(t => t.drift)); branches = by(w.tiles.flatMap(t => t.trees.length ? branchesOfTile(w, t) : [])); fronds = by(w.tiles.flatMap(t => frondsOfTile(w, t)));
}, 120000);

const DT = 1 / 20;
const makeInput = () => {
  const i = { up: false, down: false, left: false, right: false, run: false, target: null, action: null, hold: null, sleep: false };
  i.clearTarget = () => { i.target = null; };
  i.takeAction = () => { const a = i.action; i.action = null; return a; };
  i.takeLight = () => { const h = i.hold; i.hold = null; return h; };
  i.takeSleep = () => { const s = i.sleep; i.sleep = false; return s; };
  i.pressing = () => false;
  return i;
};
const ids = (list, from, n) => list.slice(from, from + n).map(o => o.id);
const at = (x, z) => ({ x, z, y: w.H(x, z) });

// the world of one case: the object at C (a pile at the middle, a fire 2 m east ...), the extras beside it, the castaway 9 m away in direction `dir`
function scene({ pile = 0, kind = 'driftwood', fire, carried = [], fragment = 0, side = null, lean = false, leanto, dir = 0, torch = false, fibre = 0, partner = 0, fronds: fr = 0, time } = {}) {
  const piles = [], R = 9, a = dir * Math.PI / 4;
  const pileList = kind === 'branch' ? branches : kind === 'frond' ? fronds : logs;
  if (pile) piles.push({ x: C.x, z: C.z, kind, logs: ids(pileList, 0, pile) });
  if (partner) piles.push({ x: C.x + 1.3, z: C.z, kind: 'branch', logs: ids(branches, 20, partner) });   // the other kind within 2 m: a site
  if (fr) piles.push({ x: C.x + 2.1, z: C.z, kind: 'frond', logs: ids(fronds, 0, fr) });
  if (fragment) piles.push({ x: C.x - 0.95, z: C.z, kind: 'driftwood', logs: ids(logs, 60, fragment) });
  if (side) piles.push({ x: C.x + side.dx, z: C.z + side.dz, kind: 'driftwood', logs: ids(logs, 30, side.n) });
  const lts = [];
  if (lean) lts.push({ id: 0, x: C.x - 1.9, z: C.z, heading: Math.PI / 2, progress: 1 });   // its open side faces +x: the pile stands 1.9 m from its middle, 0.95 m beyond the front tips; its side wall at r = 0.92 is the near one
  if (leanto) lts.push(leanto);
  const g = createGame(w, at(C.x + Math.sin(a) * R, C.z + Math.cos(a) * R), {
    wood: { carried, piles }, fibre: { carried: fibre },
    fire: { fires: fire ? [{ id: 0, x: C.x, z: C.z, fed: 1, ...fire }] : [], torch: torch ? { left: TORCH_DAYS } : null, torches: [], attempts: 0, nextId: 5 },
    leantos: { list: lts, nextId: 5 }, sleep: { awake: 0.05 }, ...(time === undefined ? {} : { time }),
  });
  return g;
}

// walk to (x, z) with the follower and the real game.update; true when he is within 0.12 of it
function goTo(g, pt, secs = 60) {
  const finder = createPath(w, { obstacles: g.movement.obstacles }), route = createRoute(finder, g.player, pt, { stop: 0.12 }), input = makeInput();
  for (let t = 0; t < secs; t += DT) {
    const u = route.update(g.player, DT, false);
    if (u.state === 'arrived') return true;
    if (u.state === 'unreachable') return false;
    input.target = { x: u.target.x, z: u.target.z, routed: true };
    g.update(input, DT);
  }
  return false;
}
const settle = (g, secs = 1.2) => { const i = makeInput(); for (let t = 0; t < secs; t += DT) g.update(i, DT); };
// do an option of the arc (as the mind's pressKind does) and let it happen
function press(g, pred, secs = 2) {
  const a = g.action(), o = [a.tap, ...a.options].find(x => x && pred(x)); if (!o) return false;
  g.act(o); const i = makeInput(); for (let t = 0; t < secs; t += DT) g.update(i, DT); return true;
}

// the cases of one kind: for each pile size and each of the 8 approaches, alone, with a lean-to wall beside the object, with a small pile beside it
const SIZES = [1, 3, 6, 12], CONFIGS = [['alone', {}], ['a lean-to wall beside it', { lean: true }], ['a small pile beside it', { fragment: 1 }]];
function eachCase(sizes, make, body) {
  for (const n of sizes) for (const [name, extra] of CONFIGS) {
    it(`${name}, pile of ${n}: from all 8 sides`, () => {
      for (let dir = 0; dir < 8; dir++) body(make(n, extra, dir), n, dir, `${name} ${n} dir ${dir}`);
    }, 120000);
  }
}
const planFor = (g, kind, obj) => g.stand.plan(kind, obj, createPath(w, { obstacles: g.movement.obstacles }), g.player);

describe('taking from a pile (the arc names that pile)', () => {
  eachCase(SIZES, (n, extra, dir) => scene({ pile: n, dir, ...extra }), (g, n, dir, label) => {
    const pile = g.wood.piles[0], p = planFor(g, 'take', pile);
    expect(p, label).not.toBeNull();
    expect(goTo(g, p), label).toBe(true);
    expect(g.stand.offered('take', pile, g.player.x, g.player.z), label).toBe(true);
    const was = pile.logs.length, others = g.wood.piles.filter(q => q !== pile).map(q => q.logs.length);
    expect(press(g, o => o.kind === 'pickup' && o.thing.pile === pile), label).toBe(true);
    expect(g.wood.carried.length, label).toBe(Math.min(3, was)); expect(g.wood.piles.includes(pile) ? pile.logs.length : 0, label).toBe(was - Math.min(3, was));
    expect(g.wood.piles.filter(q => q !== pile).map(q => q.logs.length), label).toEqual(others);
  });
});

describe('adding to a pile (the wood joins that pile and makes no new one)', () => {
  eachCase(SIZES, (n, extra, dir) => scene({ pile: n, dir, carried: ids(logs, 100, 2), ...extra }), (g, n, dir, label) => {
    const pile = g.wood.piles[0], p = planFor(g, 'add', pile);
    if (n >= 12) { expect(p, label + ' (full)').toBeNull(); return; }   // a full pile takes no more wood: honest "no spot"
    expect(p, label).not.toBeNull();
    expect(goTo(g, p), label).toBe(true);
    expect(g.stand.offered('add', pile, g.player.x, g.player.z), label).toBe(true);
    const was = pile.logs.length, count = g.wood.piles.length, others = g.wood.piles.filter(q => q !== pile).map(q => q.logs.length);
    expect(press(g, o => o.kind === 'lay'), label).toBe(true);
    expect(g.wood.carried.length, label).toBe(0); expect(pile.logs.length, label).toBe(was + 2); expect(g.wood.piles.length, label).toBe(count);
    expect(g.wood.piles.filter(q => q !== pile).map(q => q.logs.length), label).toEqual(others);
  });
});

describe('feeding a fire (lit, or only embers) with dry wood in his arm', () => {
  for (const [state, fire] of [['lit', { fuel: 3 * BURN, embers: EMBERS, lit: 0 }], ['embers', { fuel: 0, embers: EMBERS, emberAge: EMBERS / 2, lit: 0 }]]) {
    for (const n of SIZES) for (const [name, extra] of [['alone', {}], ['a lean-to wall beside it', { lean: true }], ['a pile beside it', { fragmentAt: 1.5 }]]) {
      it(`${state}, ${name}, pile of ${n} nearby: from all 8 sides`, () => {
        for (let dir = 0; dir < 8; dir++) {
          const g = scene({ fire, dir, carried: ids(logs, 100, 2), lean: !!extra.lean, side: extra.fragmentAt ? { dx: extra.fragmentAt, dz: 0.4, n } : null });
          const f = g.fire.fires[0], label = `${state} ${name} ${n} dir ${dir}`, p = planFor(g, 'feed', f);
          expect(p, label).not.toBeNull();
          expect(goTo(g, p), label).toBe(true);
          expect(g.stand.offered('feed', f, g.player.x, g.player.z), label).toBe(true);
          const was = state === 'lit' ? f.fuel : f.fed;
          expect(press(g, o => o.kind === 'feed' && o.fire === f), label).toBe(true);
          expect(g.wood.carried.length, label).toBeLessThan(2); expect(state === 'lit' ? f.fuel : f.fed, label).toBeGreaterThan(was);
        }
      }, 120000);
    }
  }
});

describe('lighting a pile (with a torch in hand, so the kindling is certain)', () => {
  eachCase(SIZES, (n, extra, dir) => scene({ pile: n, dir, torch: true, ...extra }), (g, n, dir, label) => {
    const pile = g.wood.piles[0], p = planFor(g, 'light', pile);
    if (n < 4) { expect(p, label + ' (too few)').toBeNull(); return; }   // FIRE_MIN: three pieces cannot be lit
    expect(p, label).not.toBeNull();
    expect(goTo(g, p), label).toBe(true);
    expect(g.stand.offered('light', pile, g.player.x, g.player.z), label).toBe(true);
    expect(press(g, o => o.kind === 'light' && o.pile === pile, 4), label).toBe(true);
    expect(g.fire.fires.length, label).toBe(1); expect(g.wood.piles.includes(pile), label).toBe(false);
  });
});

describe('building a lean-to from two piles (any pile within reach counts)', () => {
  eachCase(SIZES, (n, extra, dir) => scene({ pile: n, partner: 6, dir, ...extra }), (g, n, dir, label) => {
    const drift = g.wood.piles[0], site = n >= 6 ? { site: { drift, branch: g.wood.piles[1] } } : null;
    if (!site) { const p = planFor(g, 'build', { site: { drift, branch: g.wood.piles[1] } }); expect(p, label + ' (too few)').toBeNull(); return; }
    const p = planFor(g, 'build', site);
    expect(p, label).not.toBeNull();
    expect(goTo(g, p), label).toBe(true);
    expect(g.stand.offered('build', site, g.player.x, g.player.z), label).toBe(true);
    expect(g.leantos.list.filter(l => l.progress < 1).length, label).toBe(0);
    expect(press(g, o => o.kind === 'build' && o.site && o.site.drift === drift, 3), label).toBe(true);
    expect(g.player.work && g.player.work.kind, label).toBe('build'); expect(g.leantos.list.filter(l => l.progress < 1).length, label).toBe(1);   // the lean-to is begun
  });
});

describe('upgrading a finished lean-to (walls from a pile of fronds beside it)', () => {
  for (const n of SIZES) for (const [name, extra] of [['alone', {}], ['a small pile beside it', { fragment: 1 }]]) {
    it(`${name}, ${n} fronds: from all 8 sides`, () => {
      for (let dir = 0; dir < 8; dir++) {
        const lt = { id: 0, x: C.x, z: C.z, heading: Math.PI / 3, progress: 1 };
        const g = scene({ leanto: lt, fronds: n, dir, fragment: extra.fragment || 0 }), lean = g.leantos.list[0], label = `${name} ${n} dir ${dir}`;
        const p = planFor(g, 'upgrade', lean);
        if (n < 6) { expect(p, label + ' (too few)').toBeNull(); continue; }   // the walls take 6 fronds in all
        expect(p, label).not.toBeNull();
        expect(goTo(g, p), label).toBe(true);
        expect(g.stand.offered('upgrade', lean, g.player.x, g.player.z), label).toBe(true);
        expect(press(g, o => o.kind === 'upgrade' && o.leanto === lean, 6), label).toBe(true);
        expect((lean.up && lean.up.walls) || 0, label).toBeGreaterThan(0);
      }
    }, 120000);
  }
});

describe('no spot at all is an honest null', () => {
  it('a pile inside a closed ring of fire places has spots to take from, none that can be reached: null at once, no walk', () => {
    const ring = Array.from({ length: 16 }, (_, i) => ({ id: i, x: C.x + Math.sin(i * Math.PI / 8) * 2.9, z: C.z + Math.cos(i * Math.PI / 8) * 2.9, fuel: 0, embers: EMBERS, lit: 0, fed: 1 }));
    const g = createGame(w, at(C.x + 9, C.z), { wood: { carried: [], piles: [{ x: C.x, z: C.z, kind: 'driftwood', logs: ids(logs, 0, 6) }] }, fire: { fires: ring, torch: null, torches: [], attempts: 0, nextId: 30 }, sleep: { awake: 0.05 } });
    const pile = g.wood.piles[0], finder = createPath(w, { obstacles: g.movement.obstacles });
    expect(g.stand.points('take', pile).length).toBeGreaterThan(5);   // the game does offer the pickup inside the ring ...
    expect(g.stand.plan('take', pile, finder, g.player)).toBeNull();     // ... but there is no way in
  });
});
