// The two camp rules of 0.30.3 "Routes", for the player and for Dave:
//  (a) the inside of a lean-to and the area just in front of its opening (game/leanto keepFree) stay free of wood: a pile that would touch it is laid beside it, and what is left of the building
//      piles is laid as one pile per kind beside the lean-to; piles already there (an older save) are not moved;
//  (b) (gone in 0.32 "Piece by piece": a pile pair no longer builds; the tests check that none does).
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { keepFree, KEEP } from '../src/game/leanto.js';
import { branchesOfTile } from '../src/game/branches.js';
import { findSpots } from './helpers/spots.js';

let w, spawn, C, logs, branches;
beforeAll(async () => {
  w = await generateWorld(1337); spawn = startSpot(w); C = findSpots(w, spawn).open;
  const d = o => Math.hypot(o.x - spawn.x, o.z - spawn.z), by = l => l.sort((a, b) => d(a) - d(b));
  logs = by(w.tiles.flatMap(t => t.drift)); branches = by(w.tiles.flatMap(t => t.trees.length ? branchesOfTile(w, t) : []));
}, 120000);
const ids = (l, from, n) => l.slice(from, from + n).map(o => o.id), at = (x, z) => ({ x, z, y: w.H(x, z) });
const makeInput = (o = {}) => { const i = { up: false, down: false, left: false, right: false, run: false, target: null, action: null, hold: null, sleep: false, ...o }; i.clearTarget = () => { i.target = null; }; i.takeAction = () => { const a = i.action; i.action = null; return a; }; i.takeLight = () => { const h = i.hold; i.hold = null; return h; }; i.takeSleep = () => { const s = i.sleep; i.sleep = false; return s; }; i.pressing = () => false; return i; };
const run = (g, i, s, dt = 1 / 30) => { for (let t = 0; t < s; t += dt) g.update(i, dt); };
const lean = () => ({ id: 0, x: C.x, z: C.z, heading: 0, progress: 1 });
const clearOfK = (g, lt = g.leantos.list[0]) => g.wood.piles.every(p => !keepFree(lt).touches(p.x, p.z, 0.65));

describe('rule (a): the inside and the front of a lean-to stay free of wood', () => {
  it('has the region of the design: the footprint and an apron that ends before the fire ring pile', () => {
    expect([KEEP.back, KEEP.front, KEEP.side, KEEP.apron, KEEP.apronSide]).toEqual([-1.1, 0.95, 1.25, 1.5, 1.0]);
    const k = keepFree({ x: 0, z: 0, heading: 0 });
    expect(k.touches(0, 0, 0.65)).toBe(true); expect(k.touches(0, 1.4, 0.65)).toBe(true); expect(k.touches(1.0, -0.5, 0.65)).toBe(true);
    expect(k.touches(0, 2.2, 0.65)).toBe(false);   // the pile of the fire ring (RING_AT 2.2) stays legal
    expect(k.touches(0, -1.8, 0.65)).toBe(false); expect(k.touches(1.95, 0, 0.65)).toBe(false);
  });
  it('wood laid from the inside, from the doorway or from the apron lands beside the lean-to, outside the walls and the opening', () => {
    for (const [f, r] of [[0, 0], [0.7, 0.2], [1.2, 0], [-0.6, -0.5]]) {
      const g = createGame(w, at(C.x + r, C.z + f), { wood: { carried: ids(logs, 0, 3), piles: [] }, leantos: { list: [lean()], nextId: 1 } });
      run(g, makeInput({ action: 'tap' }), 1.5);
      expect(g.wood.carried.length, `${f},${r}`).toBe(0); expect(g.wood.piles.length).toBe(1);
      expect(clearOfK(g), `${f},${r}`).toBe(true);
    }
  });
  it('keeps the wood in his arm when there is no legal spot within 3 m (as with wet ground), and does not move or refuse a pile that was there before', () => {
    const old = { x: C.x, z: C.z + 0.3, kind: 'driftwood', logs: ids(logs, 40, 2) }, before = { x: old.x, z: old.z };
    const g = createGame(w, at(C.x, C.z - 0.5), { wood: { carried: ids(logs, 0, 2), piles: [old] }, leantos: { list: [lean()], nextId: 1 } });
    run(g, makeInput({ action: 'tap' }), 1.5);   // within PILE_JOIN of the old pile in the lean-to: it joins that pile (nothing new is made)
    expect(g.wood.piles.length).toBe(1); expect(g.wood.piles[0].logs.length).toBe(4); expect(g.wood.piles[0].x).toBe(before.x); expect(g.wood.piles[0].z).toBe(before.z);
    const wet = createGame(w, at(C.x, C.z), { wood: { carried: ids(logs, 0, 2), piles: [] }, leantos: { list: [lean()], nextId: 1 } });
    expect(wet.wood.drop(C.x, C.z, 0, false, null, () => true)).toBe(false); expect(wet.wood.carried.length).toBe(2);   // every spot refused: nothing is laid
  });
  it('a lean-to that is only begun keeps the region free too (0.32: no building piles, the keep-free region holds from the first part)', () => {
    const half = { id: 0, x: C.x, z: C.z, heading: 0, progress: 1 / 15 }, g = createGame(w, at(C.x, C.z + 0.3), { leantos: { list: [half], nextId: 1 } });
    g.wood.carried.push(...logs.slice(0, 3).map(l => ({ ...l }))); g.wood.carried.forEach(l => { delete l.t; });
    g.player.heading = 0; run(g, makeInput({ action: 'tap' }), 1.5);
    expect(g.wood.piles.length).toBe(1); expect(clearOfK(g, half)).toBe(true);
  });
});

describe('rule (b) is gone (0.32 "Piece by piece"): piles, however big, no longer build a lean-to', () => {
  const site = () => createGame(w, at(C.x - 0.2, C.z - 0.3), { wood: { carried: [], piles: [{ x: C.x, z: C.z, kind: 'driftwood', logs: ids(logs, 0, 6) }, { x: C.x + 1.3, z: C.z, kind: 'branch', logs: ids(branches, 0, 6) }] }, fibre: { carried: 1 } });
  const offers = (g, kind) => g.offersAt(g.player.x, g.player.z).some(o => o.kind === kind);
  it('two piles of 6 within 2 m of each other offer no building, only the fire', () => {
    const g = site();
    for (const k of ['build', 'buildHere', 'buildIn', 'upgrade']) expect(offers(g, k), k).toBe(false);
    expect(offers(g, 'light')).toBe(true);
  });
  it('the lean-to is begun with a piece of driftwood in his arms instead', () => {
    const g = createGame(w, at(C.x, C.z), { wood: { carried: [], piles: [] } }); g.wood.carried.push({ ...logs[40] }); delete g.wood.carried[0].t;
    expect(offers(g, 'buildHere')).toBe(true);
  });
});
