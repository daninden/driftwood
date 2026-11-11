// Branches and the lean-to (0.16): branches under the trees (deterministic per
// seed, the generated world untouched), picking up and carrying them with
// driftwood, piles of their own, burning half as long, lighting a branch pile;
// the lean-to as a site (0.32: no building piles any more; the building itself is in tests/site.test.js): its drawing by progress, its walls, sleeping under it,
// the flood, and saving.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { branchesOfTile, createBranches, BRANCH_ID0, REGROW, REGROW_SPREAD, BRANCH_LEN } from '../src/game/branches.js';
import { createWood, CARRY_MAX, CARRY_SLOW, PILE_MAX, kindOf } from '../src/game/wood.js';
import { createFire, fuelOf, BURN, BRANCH_BURN, FIRE_MIN, DRILL_COST } from '../src/game/fire.js';
import { createLeantos, PIECE_TIME, BUILD_COST, SLEEP_R, PARTS } from '../src/game/leanto.js';
import { createSleep, COLD_SLEEP, SHELTER_SLEEP, SHELTER_REST, SLEEP_DAYS } from '../src/game/sleep.js';
import { DAY_SECONDS } from '../src/game/clock.js';
import { FIRST_HIGH, PERIOD } from '../src/game/tide.js';
import { serialise, parseSave, momentKey } from '../src/save.js';
import { carryItems } from '../src/render/carryMark.js';
import { leantoParts, leantoFronds, roofLine, frondProfile, ROOF_N, FROND_N } from '../src/render/leanto.js';
import { YAW } from '../src/core/view.js';

let w, spawn, logs, all;
beforeAll(async () => {
  w = await generateWorld(1337); spawn = startSpot(w);
  logs = w.tiles.flatMap(t => t.drift).sort((a, b) => Math.hypot(a.x - spawn.x, a.z - spawn.z) - Math.hypot(b.x - spawn.x, b.z - spawn.z));
  all = w.tiles.flatMap(t => branchesOfTile(w, t));
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
const at = (x, z) => ({ x, z, y: w.H(x, z) });
const nearestBranch = (x, z) => all.slice().sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];
const bids = (from, n) => all.slice(from, from + n).map(b => b.id);
const dids = (from, n) => logs.slice(from, from + n).map(l => l.id);
// a game standing by a pile of nd driftwood and a pile of nb branches, 1.2 m apart
const P1 = () => ({ x: spawn.x + 0.4, z: spawn.z }), P2 = () => ({ x: spawn.x + 0.4, z: spawn.z + 1.2 });
const withPiles = (nd = 8, nb = 7, o = {}) => createGame(w, spawn, { wood: { carried: [], piles: [{ ...P1(), kind: 'driftwood', logs: dids(0, nd) }, { ...P2(), kind: 'branch', logs: bids(0, nb) }] }, fibre: { carried: 2 }, ...o });

describe('branches under the trees', () => {
  it('lie under about half of the broadleaf and rain forest trees, 0 to 2 each, thinner and shorter than driftwood', () => {
    const trees = w.tiles.flatMap(t => t.trees);
    expect(all.length).toBeGreaterThan(trees.length * 0.3); expect(all.length).toBeLessThan(trees.length * 1.2);
    expect(new Set(all.map(b => b.id)).size).toBe(all.length);
    for (const b of all) { expect(b.id).toBeGreaterThanOrEqual(BRANCH_ID0); expect(b.branch).toBe(true); expect(b.t).toBeUndefined(); expect(b.len).toBeGreaterThanOrEqual(BRANCH_LEN[0]); expect(b.len).toBeLessThanOrEqual(BRANCH_LEN[1]); expect(b.rad).toBeLessThan(0.06); }
    for (const t of w.tiles) for (const b of branchesOfTile(w, t)) expect(t.trees.some(tr => Math.hypot(tr.x - b.x, tr.z - b.z) < 2)).toBe(true);
    const perTree = trees.map(tr => all.filter(b => Math.hypot(tr.x - b.x, tr.z - b.z) < 1.9).length);
    expect(perTree.some(n => n === 0)).toBe(true);
  });
  it('are fixed by the seed, and add nothing to the generated world', async () => {
    const again = await generateWorld(1337), list = again.tiles.flatMap(t => branchesOfTile(again, t));
    expect(list).toEqual(all);
    for (const t of again.tiles) expect(Object.keys(t).sort()).toEqual(['bushes', 'cocos', 'crags', 'drift', 'hmax', 'palms', 'pines', 'roots', 'rocks', 'tx', 'tz', 'trees', 'x0', 'z0'].sort());
    const other = await generateWorld(77);
    expect(other.tiles.flatMap(t => branchesOfTile(other, t)).map(b => b.x)).not.toEqual(all.map(b => b.x));
  }, 120000);
  it('ids lead back to the branch', () => {
    const br = createBranches(w);
    for (const b of all.slice(0, 50)) expect(br.piece(b.id)).toBe(b);
    expect(br.piece(5)).toBeNull(); expect(br.piece(BRANCH_ID0 + 4095)).toBeNull();
  });
  it('grow back at the same spot 4 to 8 days after they were taken', () => {
    const br = createBranches(w), b = all[3];
    expect(br.take(b, 10)).toBe(true); expect(br.take(b, 10)).toBe(false); expect(br.onGround(b)).toBe(false);
    br.update(10 + REGROW - 0.01); expect(br.onGround(b)).toBe(false);
    br.update(10 + REGROW + REGROW_SPREAD + 0.01); expect(br.onGround(b)).toBe(true);
    expect(REGROW).toBe(4); expect(REGROW + REGROW_SPREAD).toBe(8);
    expect(br.state().taken).toEqual([]);
    br.take(b, 3); expect(createBranches(w, br.state()).onGround(b)).toBe(false);
  });
});

describe('carrying and piling branches', () => {
  it('are picked up with the button like driftwood; wood and branches together at most three', () => {
    const b = nearestBranch(spawn.x, spawn.z), g = createGame(w, at(b.x + 0.3, b.z));
    expect(g.action().tap).toMatchObject({ kind: 'pickup' });
    run(g, makeInput({ action: 'tap' }), 1);
    expect(g.wood.carried.length).toBe(1); expect(kindOf(g.wood.carried[0])).toBe('branch'); expect(g.branches.onGround(b)).toBe(false);
    const wood = createWood(w, undefined, createBranches(w));
    wood.take({ kind: 'log', log: logs[0] }); wood.take({ kind: 'log', log: all[0] }); wood.take({ kind: 'log', log: all[1] });
    expect(wood.take({ kind: 'log', log: all[2] })).toBe(0); expect(wood.carried.length).toBe(CARRY_MAX);
  });
  it('slow him per piece as driftwood does', () => {
    const walk = carried => { const g = createGame(w, spawn, { wood: { carried } }), i = makeInput({ up: true }), a = { x: g.player.x, z: g.player.z }; run(g, i, 1); return Math.hypot(g.player.x - a.x, g.player.z - a.z); };
    const d3 = walk(dids(0, 3)), mixed = walk([logs[0].id, all[0].id, all[1].id]), none = walk([]);
    expect(mixed).toBeCloseTo(d3, 6); expect(d3 / none).toBeCloseTo(1 - CARRY_SLOW * 3, 1);
  });
  it('lie in piles of their own: never mixed with driftwood, at most 12, each kind laid on its own', () => {
    const wood = createWood(w, undefined, createBranches(w));
    wood.take({ kind: 'log', log: logs[0] }); wood.take({ kind: 'log', log: all[0] });
    expect(wood.drop(spawn.x, spawn.z, 0)).toBe(true);
    expect(wood.carried.length).toBe(0); expect(wood.piles.map(p => p.kind).sort()).toEqual(['branch', 'driftwood']);
    const bp = wood.piles.find(p => p.kind === 'branch');
    wood.take({ kind: 'log', log: all[1] }); wood.drop(bp.x, bp.z, 0);   // joins the branch pile, not the driftwood one
    expect(wood.piles.find(p => p.kind === 'branch').logs.length).toBe(2); expect(wood.piles.find(p => p.kind === 'driftwood').logs.length).toBe(1);
    const g = createGame(w, spawn, { wood: { carried: [], piles: [{ ...P1(), kind: 'branch', logs: bids(0, PILE_MAX) }] } });
    g.wood.carried.push(all[20]); g.wood.drop(spawn.x + 0.4, spawn.z, 0);
    expect(g.wood.piles.length).toBe(2); expect(g.wood.piles.every(p => p.logs.length <= PILE_MAX)).toBe(true);
  });
  it('are always dry', () => { expect(all.every(b => b.t === undefined)).toBe(true); });
  it('show in the carry row, one for each, beside the fibre', () => {
    expect(carryItems({ fibre: 1, branch: 2 })).toEqual(['fibre', 'branch', 'branch']);
  });
});

describe('burning branches', () => {
  it('a branch burns half as long as a piece of driftwood', () => {
    expect(BRANCH_BURN).toBe(0.5); expect(fuelOf([all[0], all[1]])).toBeCloseTo(BURN); expect(fuelOf([logs[0], all[0]])).toBeCloseTo(1.5 * BURN);
  });
  it('can feed a fire for half a piece', () => {
    const f0 = { id: 0, x: spawn.x + 1, z: spawn.z, fuel: 2 * BURN, embers: 0.06, lit: 0, fed: 4 };
    const g = createGame(w, spawn, { wood: { carried: [all[0].id], piles: [] }, fire: { fires: [f0], attempts: 0, nextId: 1 } });
    expect(g.action().tap).toMatchObject({ kind: 'feed' });
    g.update(makeInput({ action: 'tap' }), 0.01);
    expect(g.fire.fires[0].fuel).toBeCloseTo(2.5 * BURN, 3); expect(g.wood.carried.length).toBe(0);
  });
  it('a pile of branches is lit with a torch like a driftwood pile, and burns half as long', () => {
    const g = createGame(w, spawn, { wood: { carried: [], piles: [{ ...P1(), kind: 'branch', logs: bids(0, 6) }] }, fire: { torch: { left: 0.05 } } });
    expect(bigOf(g)).toMatchObject({ kind: 'light' });
    run(g, makeInput({ hold: { key: true } }), 4);
    expect(g.fire.fires.length).toBe(1); expect(g.fire.fires[0].fuel).toBeCloseTo(3 * BURN, 2); expect(g.wood.piles.length).toBe(0);
  });
  it('a pile of branches is lit with the fire drill like any other pile', () => {
    let lit = null; for (let k = 0; k < 40 && !lit; k++) lit = createFire(w, { attempts: k }).attempt(0, 0, all.slice(0, 4), 1, 0, 0);
    expect(lit.fuel).toBeCloseTo(2 * BURN); expect(FIRE_MIN).toBe(4);
  });
});

describe('the drawing of a lean-to', () => {
  it('rises part by part: two posts, a ridge pole, a sill, then the roof branches, then the fronds (the parts of game/leanto, 15 in all)', () => {
    const l = { x: spawn.x, z: spawn.z, heading: 0.5, progress: 0 }, keys = k => new Set(leantoParts(w.H, l, k / 15).map(s => s.key));
    expect(keys(0).size).toBe(0); expect([...keys(1)].sort()).toEqual(['fork', 'post']);
    expect(keys(2).has('ridge')).toBe(false); expect(keys(3).has('ridge')).toBe(true); expect(keys(3).has('sill')).toBe(false); expect(keys(4).has('sill')).toBe(true); expect(keys(4).has('roof')).toBe(false); expect(keys(5).has('roof')).toBe(true);
    expect(leantoParts(w.H, l, 1).filter(s => s.key === 'roof').length).toBe(ROOF_N);
    expect(leantoParts(w.H, l, 9 / 15).filter(s => s.key === 'roof').length).toBeLessThan(ROOF_N);
    expect(leantoFronds(w.H, l, 10 / 15).length).toBe(0);   // the palm fronds come last
    const n = [11, 12, 13, 14, 15].map(k => leantoFronds(w.H, l, k / 15).length);
    expect(n).toEqual([1, 2, 3, 4, FROND_N]);   // one by one, never fewer
    expect(PARTS.leanto.length).toBe(4 + ROOF_N + FROND_N);
  });
  it('lays the fronds on the roof, not above it (0.22.2), at every stage and heading, on flat and on real ground', () => {
    const flat = () => 0.3;
    for (const H of [flat, w.H]) for (const heading of [0, 0.5, 2.1, 4]) {
      const l = { id: 1, x: spawn.x, z: spawn.z, heading, progress: 1 };
      const fr = leantoFronds(H, l);
      expect(fr.length).toBe(FROND_N);
      for (const f of fr) {
        expect(leantoFronds(H, l, (11 + f.k) / 15).some(g => g.k === f.k && g.pos.equals(f.pos) && g.pitch === f.pitch)).toBe(true);   // a frond does not move while the others are added
        const r = (f.pos.x - l.x) * Math.cos(heading) - (f.pos.z - l.z) * Math.sin(heading), line = roofLine(H, l, r), prof = frondProfile(f.sx, -f.pitch);
        const gaps = prof.map(([u, v]) => v + f.slope * u);   // height above the slope line through the frond's base (the base is on the roof line, plus the gap and the layer lift)
        const lowest = Math.min(...gaps), highest = Math.max(...gaps);
        expect(lowest).toBeGreaterThan(-0.03);   // never sunk into the roof
        expect(highest).toBeLessThan(0.11);      // never floating (the arch of a frond bulges a few cm above the line)
        expect(f.pos.y - line.a.y).toBeLessThan(0.08);   // starts on the ridge top
        expect(f.pitch).toBeLessThan(-0.3);      // follows the slope (the roof is about 0.7 rad)
      }
    }
  });
  it('is solid at the back and sides but open at the front: he cannot walk through it, he can walk in', () => {
    const lean = () => ({ leantos: { list: [{ id: 0, x: spawn.x, z: spawn.z, heading: 0, progress: 1 }], nextId: 1 } });
    // from the open front straight on to the far side (walking by the stick, a straight line): the back stops him, he does not pass it
    const through = createGame(w, at(spawn.x, spawn.z + 1.5), lean());
    run(through, makeInput({ stick: { x: 0, z: -1 } }), 4);
    expect(through.player.z).toBeGreaterThan(spawn.z - 0.8);
    // from the side, across the side wall: he does not get inside
    const side = createGame(w, at(spawn.x - 1.5, spawn.z), lean());
    run(side, makeInput({ stick: { x: 1, z: 0 } }), 3);
    expect(side.player.x).toBeLessThan(spawn.x - 0.8);
    // through the front he reaches the middle
    const inside = createGame(w, at(spawn.x, spawn.z + 1.5), lean());
    run(inside, makeInput({ target: { x: spawn.x, z: spawn.z } }), 4);
    expect(Math.hypot(inside.player.x - spawn.x, inside.player.z - spawn.z)).toBeLessThan(0.5);
  });
  it('a click on the ground behind it walks round it (0.30.3: a click whose straight line a solid closes follows a route) and never through it', () => {
    const lean = { leantos: { list: [{ id: 0, x: spawn.x, z: spawn.z, heading: 0, progress: 1 }], nextId: 1 } };
    const g = createGame(w, at(spawn.x, spawn.z + 2.5), lean), goal = { x: spawn.x, z: spawn.z - 3 }, i = makeInput({ target: { ...goal } });
    let inWall = false; for (let t = 0; t < 12 && i.target; t += 1 / 30) { g.update(i, 1 / 30); const dz = g.player.z - spawn.z, dx = Math.abs(g.player.x - spawn.x); if (dx < 0.6 && dz > -0.75 && dz < 0.6 && dz < -0.1) inWall = true; }
    expect(Math.hypot(g.player.x - goal.x, g.player.z - goal.z)).toBeLessThan(0.3); expect(inWall).toBe(false);
  });
});

describe('sleeping under a lean-to', () => {
  const shelterGame = (o = {}) => createGame(w, spawn, { sleep: { awake: 1.5 }, leantos: { list: [{ id: 0, x: spawn.x + 0.5, z: spawn.z, heading: 0, progress: 1 }], nextId: 1 }, ...o });
  const sleepOut = g => { const i = makeInput(); let n = 0; run(g, i, 3); while ((g.sleep.asleep || g.sleep.lie > 0) && n++ < 6000) g.update(i, 1 / 30); return g; };
  it('counts only within a metre of the centre of a finished one', () => {
    const l = createLeantos(w, { list: [{ id: 0, x: 0, z: 0, heading: 0, progress: 1 }, { id: 1, x: 10, z: 0, heading: 0, progress: 0.5 }] });
    expect(l.shelter(0.9, 0)).toBe(true); expect(l.shelter(SLEEP_R + 0.05, 0)).toBe(false); expect(l.shelter(10, 0)).toBe(false);
  });
  it('without a fire the cold sleep lasts six hours and he wakes three quarters rested', () => {
    const g = sleepOut(shelterGame());
    expect(g.sleep.slept * 24).toBeCloseTo(6, 0); expect(g.sleep.slept).toBeCloseTo(SHELTER_SLEEP, 1); expect(g.sleep.rest()).toBeGreaterThan(0.72); expect(g.sleep.rest()).toBeLessThan(0.8);
  });
  it('outside it the cold sleep is three hours, about 33 % rested from empty (it takes off half a day)', () => {
    const g = sleepOut(createGame(w, spawn, { sleep: { awake: 1.5 }, leantos: { list: [{ id: 0, x: spawn.x + 3, z: spawn.z, heading: 0, progress: 1 }], nextId: 1 } }));
    expect(g.sleep.slept).toBeCloseTo(COLD_SLEEP, 1); expect(g.sleep.rest()).toBeGreaterThan(0.32); expect(g.sleep.rest()).toBeLessThan(0.35);
  });
  it('a half-built one gives nothing', () => {
    const g = sleepOut(shelterGame({ leantos: { list: [{ id: 0, x: spawn.x + 0.5, z: spawn.z, heading: 0, progress: 0.9 }], nextId: 1 } }));
    expect(g.sleep.slept).toBeCloseTo(COLD_SLEEP, 1);
  });
  it('by a fire he sleeps the whole night and rests 1.25 times as fast as by a fire alone', () => {
    const rested = shelter => { const s = createSleep({ awake: 1.5 }); s.start(); let days = 0; while (days < 3 / 24) days += s.update(1 / 30, true, true, {}, shelter) / DAY_SECONDS; return 1.5 - s.awake; };
    expect(rested(true) / rested(false)).toBeCloseTo(SHELTER_REST, 2);
    const f = { id: 0, x: spawn.x + 1.5, z: spawn.z, fuel: 3, embers: 0.06, lit: 0, fed: 8 };
    const g = sleepOut(shelterGame({ fire: { fires: [f], attempts: 0, nextId: 1 } }));
    expect(g.sleep.slept).toBeGreaterThan(SLEEP_DAYS - 0.02); expect(g.sleep.rest()).toBeGreaterThan(0.99);
  });
  it('if the fire goes out the cold wakes him after six hours under it', () => {
    const f = { id: 0, x: spawn.x + 1.5, z: spawn.z, fuel: 0.01, embers: 0.01, lit: 0, fed: 1 };
    const g = sleepOut(shelterGame({ fire: { fires: [f], attempts: 0, nextId: 1 } }));
    expect(g.sleep.slept).toBeCloseTo(SHELTER_SLEEP, 1);
  });
});

describe('the flood and saving', () => {
  const findSpot = (lo, hi) => {
    for (let r = 1; r < 200; r += 0.25) for (let k = 0; k < 32; k++) { const a = k / 32 * Math.PI * 2, x = spawn.x + Math.cos(a) * r, z = spawn.z + Math.sin(a) * r; if (w.H(x, z) < hi && w.H(x, z) > lo) return { x, z, y: w.H(x, z) }; }
    return null;
  };
  it('takes a lean-to on the wet sand of low water, also a half-built one, but not one on dry ground', () => {
    const p = findSpot(-0.3, -0.2), low = FIRST_HIGH + PERIOD / 2, high = FIRST_HIGH + PERIOD;
    expect(p).not.toBe(null);
    const lt = { list: [{ id: 0, x: p.x, z: p.z, heading: 0, progress: 1 }, { id: 1, x: p.x + 0.3, z: p.z, heading: 0, progress: 0.3 }, { id: 2, x: spawn.x, z: spawn.z, heading: 0, progress: 1 }], nextId: 3 };
    const at0 = t => createGame(w, spawn, { day: Math.floor(t), time: t % 1, leantos: lt });
    const g = at0(low); g.update(makeInput(), 0.1); expect(g.leantos.list.length).toBe(3);
    const h = at0(high); h.update(makeInput(), 0.1); expect(h.leantos.list.map(l => l.id)).toEqual([2]);
  });
  it('is saved: branches taken, branch piles, lean-tos with position, heading and progress', () => {
    const g = createGame(w, spawn, { wood: { carried: [], piles: [{ ...P2(), kind: 'branch', logs: bids(0, 3) }] }, leantos: { list: [{ id: 0, x: spawn.x - 4, z: spawn.z, heading: 0.7, progress: 5 / 15 }], nextId: 1 } });
    g.wood.carried.push(all[30]); g.branches.take(all[30], g.clock.total);
    const s = JSON.parse(serialise(g.state()));
    expect(s.branches.taken.length).toBe(1); expect(s.leantos.list[0]).toMatchObject({ heading: 0.7 }); expect(s.leantos.list[0].progress).toBeCloseTo(5 / 15, 9);
    expect(s.wood.piles.some(p => p.kind === 'branch')).toBe(true);
    const back = parseSave(serialise(g.state()), 1337), g2 = createGame(w, spawn, back);
    expect(g2.state()).toEqual(g.state());
    expect(g2.branches.onGround(all[30])).toBe(false);
  });
  it('loads an older save without branches or lean-tos, and rejects wrong types', () => {
    const s = createGame(w, spawn).state(); delete s.branches; delete s.leantos;
    const back = parseSave(serialise(s), 1337); expect(back).not.toBeNull();
    const g = createGame(w, spawn, back); expect(g.leantos.list).toEqual([]); expect(g.branches.state().taken).toEqual([]);
    expect(parseSave(serialise({ ...s, leantos: { list: 'x' } }), 1337)).toBeNull();
    expect(parseSave(serialise({ ...s, branches: { taken: [[1]] } }), 1337)).toBeNull();
  });
});
