// 0.33 "Hut" (part 2, Dave's own rule): the last step of his home project. When his home is complete (lean-to, walls, ring, bed), no standing tree he can reach touches the hut's footprint and twelve logs lie in the log piles or about,
// he rebuilds the lean-to into a hut piece by piece, like the home itself: a log at a time on his shoulder, then loads of three branches and three fronds, as long as he finds material, in the home's window, needs first. Before the first
// part his own piles in the footprint are carried out (fuel back to the stock at the ring, a log to a log pile, fronds and stones to a spot outside), a burnt place is waited out, a trunk or ground that does not fit means no hut there.
// The lean-to vanishes when the roof is closed, he sleeps in the hut, the axe stays at the camp. Scripted setups on island 1337 (a finished home at the first sites he would choose beside the start). Each test fails without its part.
// Depends on: game/game, game/mind, game/leanto, game/felled, game/logs, game/wood, tests/helpers/mindCamp.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createMind, homeNext, HOME_FROM, HOME_TO, HUT_LOGS, HUT_TREE_R } from '../src/game/mind.js';
import { LISTS, treeId, trunkRadius, sizeKind } from '../src/game/felled.js';
import { PILE_MAX } from '../src/game/wood.js';
import { PARTS, built, hutDone, hutBegun, inHutBox, solid } from '../src/game/leanto.js';
import { leantoPoint, HUT_R } from '../src/game/obstacles.js';
import { campGame } from './helpers/mindCamp.js';

let w, spawn, sites, fit;   // fit: a site where the hut fits once the trees are felled and no pile lies there
beforeAll(async () => {
  w = await generateWorld(1337); spawn = startSpot(w);
  sites = createMind(w, campGame(w, spawn, { day: 2, time: 0.22 })).leantoSites({ x: spawn.x, z: spawn.z });
  fit = sites.slice(0, 12).find(c => { const g = homeGame(c, { stocked: false }); return g.hutFits(g.leantos.list[0]); });
}, 120000);

const UP = { walls: 1, ring: 1, bed: 1 };
const treesAround = (c, r1) => {   // every tree whose trunk stands within r1 of c
  const out = [];
  for (const tile of w.tiles) for (const list of LISTS) tile[list].forEach((t, index) => { const d = Math.hypot(t.x - c.x, t.z - c.z); if (d <= r1) out.push({ id: treeId(tile, list, index), x: t.x, z: t.z, r: trunkRadius(t, sizeKind(list, t)), d }); });
  return out.sort((a, b) => a.d - b.d);
};
// a finished home at site c: the trees within 10 m felled except those in `keep` (ids), the axe lying at the camp; stocked: the firewood stock at the ring and the nuts of campGame
function homeGame(c, { day = 4, time = 0.2, stocked = true, keep = [], extra = {} } = {}) {
  const felled = { list: treesAround(c, 10).filter(t => !keep.includes(t.id)).map(t => ({ id: t.id, h: 0, at: 0 })) };
  return campGame(w, spawn, { day, time, stocked, leantos: { list: [{ id: 0, x: c.x, z: c.z, heading: c.heading, progress: 1, up: { ...UP } }], nextId: 1 }, extra: { axe: { hand: false, at: { x: spawn.x + 1.5, z: spawn.z + 4 } }, felled, ...extra } });
}
const logPiles = g => g.wood.piles.filter(q => q.kind === 'log');
const logCount = g => logPiles(g).reduce((n, q) => n + q.logs.length, 0) + [...g.logs.all.values()].filter(l => g.logs.onGround(l)).length;
function stockLogs(g, n) {   // n logs in log piles at the clearing's edge, where the axe's rule puts them
  const d = createMind(w, g).logDest();
  for (let i = 0, pile = null; i < n; i++) {
    const l = g.logs.add({ x: d.x, z: d.z, len: 2, a: 0, rad: 0.12 }); g.logs.take(l);
    if (!pile || pile.logs.length >= PILE_MAX) { pile = { x: d.x + logPiles(g).length * 3, z: d.z, kind: 'log', logs: [] }; g.wood.piles.push(pile); }
    pile.logs.push(l);
  }
}

// Dave alone on the game for `days` days; ends at `until` of the last day. The tick callback sees every step.
function live(g, days, { onTick = null, until = 0.7, onIntent = undefined, stream = 0 } = {}) {
  const m = createMind(w, g, { stream, onIntent }); m.engage();
  const end = g.clock.day + days, p = g.player, rep = { maxThirst: 0, maxHunger: 0, errors: [], collapses: 0 };
  const sl = g.sleep, so = sl.start.bind(sl);
  sl.start = (...a) => { const was = sl.asleep; so(...a); if (!was && sl.asleep && !m.chose()) rep.collapses++; };
  while (g.clock.day < end || (g.clock.day === end && g.clock.time < until)) {
    try { m.step(0.1); g.update(m.input, 0.1); } catch (e) { rep.errors.push(String(e && e.stack || e)); break; }
    rep.maxThirst = Math.max(rep.maxThirst, g.thirst.days); rep.maxHunger = Math.max(rep.maxHunger, g.hunger.days);
    if (onTick) onTick(g, m, p);
  }
  return { m, rep };
}

describe('homeNext (pure): the hut is the last step of the home', () => {
  const base = { day: 5, time: 0.3, fire: true, lean: 'done', up: { walls: 1, ring: 1, bed: 1 }, hut: true, cool: {} };
  it('comes after the walls, the ring and the bed, only when the hut has its turn, in the home\'s window, and not while the project is cooling', () => {
    expect(homeNext(base)).toBe('hut');
    expect(homeNext({ ...base, hut: false })).toBeNull();
    expect(homeNext({ ...base, up: { walls: 1, ring: 1, bed: 0.5 } })).toBe('bed');          // the upgrades first
    expect(homeNext({ ...base, up: { walls: 0, ring: 1, bed: 1 }, hut: true })).toBe('walls');
    expect(homeNext({ ...base, time: HOME_FROM - 0.01 })).toBeNull();
    expect(homeNext({ ...base, time: HOME_TO })).toBeNull();
    expect(homeNext({ ...base, cool: { home: true } })).toBeNull();
    expect(homeNext({ ...base, lean: 'half', hut: true })).toBe('leanto');
  });
});

describe('Dave and the hut: when it starts', () => {
  it('needs a finished home, then trees that touch the footprint felled and twelve logs ready; each reason is told apart', () => {
    expect(fit, 'a site where the hut fits').toBeTruthy();
    const lt0 = { x: fit.x, z: fit.z, heading: fit.heading };
    const touching = treesAround(fit, HUT_TREE_R).filter(t => inHutBox(lt0, t.x, t.z, -(HUT_R + t.r)));
    const g0 = homeGame(fit, { stocked: false });
    for (const up of [{ walls: 1, ring: 1 }, {}]) { const g = campGame(w, spawn, { day: 4, time: 0.2, stocked: false, leantos: { list: [{ id: 0, x: fit.x, z: fit.z, heading: fit.heading, progress: 1, up }], nextId: 1 } }); expect(createMind(w, g).hutPlan()).toMatchObject({ go: false, why: 'none' }); }
    expect(createMind(w, g0).hutPlan()).toMatchObject({ go: false, why: 'logs' });                       // trees are felled, no logs
    stockLogs(g0, HUT_LOGS - 1); expect(createMind(w, g0).hutPlan()).toMatchObject({ go: false, why: 'logs' });
    stockLogs(g0, 1);            expect(createMind(w, g0).hutPlan()).toMatchObject({ go: true, why: 'fits' });
    // a standing tree in the footprint: he waits for the axe; the same site with the tree felled starts at once
    const ids = touching.map(t => t.id);
    if (ids.length) {
      const g = homeGame(fit, { stocked: false, keep: ids }); stockLogs(g, HUT_LOGS);
      expect(createMind(w, g).hutPlan()).toMatchObject({ go: false, why: 'trees' });
    }
  });
  it('counts logs lying about, and a log on his shoulder, as ready', () => {
    const g = homeGame(fit, { stocked: false }), d = createMind(w, g).logDest();
    stockLogs(g, HUT_LOGS - 2);
    g.logs.add({ x: d.x + 4, z: d.z, len: 2, a: 0, rad: 0.12 });
    expect(createMind(w, g).hutPlan().go).toBe(false);
    g.logs.add({ x: d.x + 5, z: d.z, len: 2, a: 0, rad: 0.12 });
    expect(createMind(w, g).logsAvail()).toBe(HUT_LOGS);
    expect(createMind(w, g).hutPlan()).toMatchObject({ go: true });
  });
  it('is never started where the footprint cannot fit (here: a second site within 4.8 m; as well a boulder, a tree he cannot reach, ground): he gives it up, once, and the home stays a lean-to', () => {
    const a = fit.heading + Math.PI / 2;
    const near = { id: 1, x: fit.x + Math.sin(a) * 4.2, z: fit.z + Math.cos(a) * 4.2, heading: fit.heading, progress: 0.2 };
    const g = campGame(w, spawn, { day: 4, time: 0.2, stocked: false, leantos: { list: [{ id: 0, x: fit.x, z: fit.z, heading: fit.heading, progress: 1, up: { ...UP } }, near], nextId: 2 }, extra: { axe: { hand: false, at: { x: spawn.x + 1.5, z: spawn.z + 4 } }, felled: { list: treesAround(fit, 10).map(t => ({ id: t.id, h: 0, at: 0 })) } } });
    stockLogs(g, HUT_LOGS);
    const m = createMind(w, g);
    expect(g.hutFits(g.leantos.list[0])).toBe(false);
    expect(m.hutPlan()).toMatchObject({ go: false, why: 'never' });
    expect(m.stats.hut.never).toBe(1);
    expect(m.hutPlan().why).toBe('never'); expect(m.stats.hut.never).toBe(1);   // once
    expect(homeNext({ day: 4, time: 0.3, fire: true, lean: 'done', up: UP, hut: m.hutPlan().go, cool: {} })).toBeNull();
  });
});

describe('Dave and the hut: the build', () => {
  let run;   // the one run the checks below look at: a finished home, the clearing open, twelve logs in a pile, from the morning of day 4
  beforeAll(() => {
    const g = homeGame(fit); stockLogs(g, HUT_LOGS);
    const lt = g.leantos.list[0], rec = { parts: [], unitsByDay: {}, kinds: [], hutAt: null, nightsIn: 0, nightsOut: 0, hutDay: null, shoulderNight: 0, axeHand: 0, stuckStart: 0, leanto: [] };
    let last = 0, was = false, thought = [];
    const { m, rep } = live(g, 9, { until: 0.7, onIntent: e => { if (e.kind === 'hutIntent') thought.push(e); }, onTick: (g2, m2, p) => {
      const c = g2.clock, n = built(lt, 'hut');
      if (n !== last) { rec.parts.push({ n, day: c.day, time: c.time, kind: PARTS.hut[n - 1], solidLeanto: solid(lt) }); last = n; if (hutDone(lt) && rec.hutDay === null) rec.hutDay = c.day; }
      if (g2.sleep.asleep && !was && !m2.journeying) { if (Math.hypot(p.x - lt.x, p.z - lt.z) > 3) rec.nightsOut++; if (hutDone(lt)) { rec.sleptAfter = (rec.sleptAfter || 0) + 1; if (!g2.leantos.inHut(p.x, p.z)) rec.sleptOutAfter = (rec.sleptOutAfter || 0) + 1; } }
      was = g2.sleep.asleep;
      if (g2.wood.log && !(c.time >= 0.2 && c.time < 0.7)) rec.shoulderNight++;
      if (g2.axe.hand && !(c.time >= 0.2 && c.time < 0.7)) rec.axeHand++;
    } });
    for (const e of m.stats.events) if (e.type === 'home' && e.what === 'hut') rec.unitsByDay[e.day] = (rec.unitsByDay[e.day] || 0) + 1;
    run = { g, m, rep, rec, lt, thought, logs0: HUT_LOGS };
  }, 600000);

  it('builds all 32 parts in order, one at a time: 12 logs, then 8 branches, then 12 fronds, over a few days', () => {
    const { rec, m, lt } = run;
    expect(hutDone(lt)).toBe(true);
    expect(rec.parts.map(q => q.n)).toEqual(Array.from({ length: PARTS.hut.length }, (_, i) => i + 1));   // never two parts in one tick, none skipped
    expect(rec.parts.map(q => q.kind)).toEqual(PARTS.hut);
    expect(m.stats.hut.parts).toBe(32);
    expect(rec.parts[0].day).toBeGreaterThanOrEqual(4);
    expect(rec.parts.every((q, i) => i === 0 || q.day >= rec.parts[i - 1].day)).toBe(true);
    expect(new Set(rec.parts.map(q => q.day)).size).toBeGreaterThanOrEqual(2);       // not in one morning: the window ends and needs come between
    expect(rec.parts.every(q => q.time >= HOME_FROM - 0.02 && q.time < HOME_TO + 0.12)).toBe(true);   // in the home's window (the last kneel ends a little later)
  });
  it('keeps going while he finds material: several units in a day, loads of one log, three branches, three fronds', () => {
    const { rec, m } = run;
    expect(Math.max(...Object.values(rec.unitsByDay))).toBeGreaterThanOrEqual(4);
    const loads = m.stats.events.filter(e => e.type === 'home' && e.what === 'hut').map(e => e.load);
    expect(loads.filter(l => l === 'log').length).toBeGreaterThanOrEqual(12);
    expect(loads.every(l => l.split(',').length === 1 ? l === 'log' || l === 'branch' || l === 'frond' : l.split(',').length <= 3)).toBe(true);
    expect(loads.some(l => l === 'branch,branch,branch')).toBe(true);
    expect(loads.some(l => l === 'frond,frond,frond')).toBe(true);
    expect(m.stats.hut.units).toBeGreaterThanOrEqual(19);
  });
  it('uses up twelve logs from the log piles (the axe may bring new ones afterwards), thinks of the hut once, and counts the first part as a piece of the home built that day', () => {
    const { g, m, thought, rec } = run;
    expect(m.stats.hut.logsFetched).toBeGreaterThanOrEqual(12);
    expect(thought).toHaveLength(1);
    expect(thought[0].goal).toBe('idle');
    expect(rec.parts[0].day).toBe(m.stats.hut.startDay);
    expect(m.stats.hut.doneDay).toBe(rec.hutDay);
    expect(m.stats.hut.never).toBe(0); expect(m.stats.hut.refused).toBe(0);
  });
  it('lets the lean-to go when the roof is closed, and he sleeps in the hut afterwards; before that he slept in the lean-to', () => {
    const { rec, lt, g } = run;
    expect(rec.parts.slice(0, -1).every(q => q.solidLeanto === true)).toBe(true);       // the lean-to stands (solid) until the last frond
    expect(rec.sleptAfter).toBeGreaterThanOrEqual(1);
    expect(rec.sleptOutAfter || 0).toBe(0);                                              // every night after the roof is closed was in the hut
    expect(rec.nightsOut).toBe(0);                                                       // and the nights before it in the lean-to, which is inside the hut's walls
    expect(g.leantos.inHut(lt.x, lt.z)).toBe(lt);
    expect(g.movement.obstacles.camp.groups.filter(q => q.kind === 'leanto')).toHaveLength(1);
  });
  it('lays the axe down at the camp and carries no log or axe at night; needs first: no collapse, no thirst or hunger beyond the bounds, no stuck walk, no error', () => {
    const { rep, m, rec, g } = run;
    expect(rep.errors).toEqual([]);
    expect(rec.shoulderNight).toBe(0); expect(rec.axeHand).toBe(0);
    expect(g.axe.hand).toBe(false); expect(g.axe.at).toBeTruthy();
    expect(rep.collapses).toBe(0);
    expect(rep.maxThirst).toBeLessThan(1.125); expect(rep.maxHunger).toBeLessThan(1.5);
    expect(m.stats.stuck, m.stats.events.filter(e => e.type === 'stuck').map(e => JSON.stringify(e)).join(' ')).toBeLessThan(10); expect(m.stats.nopath).toBe(0);
    expect(m.stats.axe.stuck).toBe(0);
  });
});

describe('the standing points of the hut', () => {
  it('are never inside the hut\'s walls or within a body of them (a part that rose there would wall him in: seed 7, found by the long run)', () => {
    const g = homeGame(fit, { stocked: false }), lt = g.leantos.list[0]; g.wood.log = g.logs.add({ x: lt.x, z: lt.z, len: 2, a: 0, rad: 0.12 }); g.logs.take(g.wood.log);   // a log on his shoulder: the first part is offered
    const pts = g.stand.points('upgrade', lt);
    expect(pts.length).toBeGreaterThan(0);
    for (const q of pts) expect(inHutBox(lt, q.x, q.z, -(HUT_R + 0.2 + 0.1)), `a standing point at ${q.x.toFixed(2)}, ${q.z.toFixed(2)} lies in the hut's walls`).toBe(false);
  });
});

describe('Dave and the hut: needs come first', () => {
  it('a thirst that comes while the hut is under way sends him to drink before the next part, the log on his shoulder goes to a pile and the hut goes on afterwards', () => {
    const g = homeGame(fit); stockLogs(g, HUT_LOGS);
    const lt = g.leantos.list[0], m = createMind(w, g); m.engage();
    let n = 0;
    while (built(lt, 'hut') < 3 && n++ < 60000) { m.step(0.1); g.update(m.input, 0.1); }
    expect(built(lt, 'hut')).toBeGreaterThanOrEqual(3);
    const parts = built(lt, 'hut'); g.thirst.days = 0.6; n = 0;
    while (m.goal !== 'drink' && n++ < 300) { m.step(0.1); g.update(m.input, 0.1); }
    expect(m.goal).toBe('drink');
    n = 0; while (m.goal === 'drink' && n++ < 6000) { m.step(0.1); g.update(m.input, 0.1); }
    expect(g.thirst.days).toBeLessThan(0.4);
    expect(built(lt, 'hut')).toBe(parts);                                       // nothing was built while he drank
    n = 0; while (built(lt, 'hut') <= parts && n++ < 80000) { m.step(0.1); g.update(m.input, 0.1); if (g.clock.time > 0.95) break; }
    expect(built(lt, 'hut')).toBeGreaterThan(parts);                            // and the hut went on
    expect(logCount(g) + (g.wood.log ? 1 : 0) + Math.min(HUT_LOGS, built(lt, 'hut'))).toBeGreaterThanOrEqual(HUT_LOGS);   // no log was lost on the way (the axe may have brought more)
  });
});

describe('Dave and the hut: a footprint that is not clear (an old save, a camp fire place)', () => {
  const inFoot = (g, f, r) => { const l = g.leantos.list[0]; return leantoPoint(l, f, r); };
  it('carries his own piles out of the footprint before the first part: fuel and fronds to a spot behind the hut, none back in the way; then builds', () => {
    const g = homeGame(fit); stockLogs(g, HUT_LOGS);
    const lt = g.leantos.list[0], mk = (kind, n, f, r) => { const q = inFoot(g, f, r), pile = { x: q.x, z: q.z, kind, logs: [] }; for (let i = 0; i < n; i++) pile.logs.push({ id: 700000 + g.wood.piles.length * 40 + i, x: q.x, y: w.H(q.x, q.z), z: q.z, len: 1, a: 0, rad: 0.1, ...(kind === 'frond' ? { frond: true } : kind === 'stone' ? { stone: true } : kind === 'branch' ? { branch: true } : {}) }); g.wood.piles.push(pile); return pile; };
    const fuel = mk('driftwood', 4, 0.1, -0.7), fronds = mk('frond', 3, -0.9, 0.6), frondIds = fronds.logs.map(l => l.id);
    g.update({ up: false, down: false, left: false, right: false, run: false, target: null, hold: null, action: null, sleep: false, clearTarget() {}, takeLight: () => null, takeAction: () => null, takeSleep: () => false, pressing: () => false }, 0.01);
    expect(g.hutFits(lt)).toBe(false);
    const plan = createMind(w, g).hutPlan();
    expect(plan).toMatchObject({ go: true, why: 'clear' });
    const { m, rep } = live(g, 4, { until: 0.7 });
    expect(rep.errors).toEqual([]);
    expect(m.stats.hut.cleared).toBeGreaterThanOrEqual(3);                  // the stock pile of the camp, the four pieces and the three fronds were in the way
    expect(hutBegun(lt)).toBe(true);
    expect(g.wood.piles.includes(fuel) || g.wood.piles.includes(fronds)).toBe(false);
    for (const q of g.wood.piles) if (q.kind !== 'log') expect(inHutBox(lt, q.x, q.z, -(HUT_R + 0.6)), `a ${q.kind} pile of ${q.logs.length} lies in the footprint`).toBe(false);
    const alive = frondIds.filter(id => g.wood.piles.some(q => q.logs.some(l => l.id === id)) || g.wood.carried.some(l => l.id === id));
    expect(alive.length === frondIds.length || built(lt, 'hut') >= 21, `${alive.length} of the three fronds are left in piles, the hut has ${built(lt, 'hut')} parts`).toBe(true);   // none lost: still in a pile, or built into the roof
  });
  it('waits for a burnt place in the footprint to fade (two days), then builds', () => {
    const g = homeGame(fit); stockLogs(g, HUT_LOGS);
    const q = inFoot(g, 0.3, 0.3), lt = g.leantos.list[0];
    g.fire.burnt.push({ id: 90, x: q.x, z: q.z, left: 1.2, n: 3 });
    g.update({ up: false, down: false, left: false, right: false, run: false, target: null, hold: null, action: null, sleep: false, clearTarget() {}, takeLight: () => null, takeAction: () => null, takeSleep: () => false, pressing: () => false }, 0.01);
    expect(createMind(w, g).hutPlan()).toMatchObject({ go: false, why: 'fire' });
    const { m, rep } = live(g, 3, { until: 0.7 });
    expect(rep.errors).toEqual([]);
    expect(g.fire.burnt.some(b => b.id === 90)).toBe(false);
    expect(m.stats.hut.startDay).toBeGreaterThanOrEqual(5);        // not before the place had faded (day 4 + 1.2 days)
    expect(hutBegun(lt)).toBe(true);
  });
});
