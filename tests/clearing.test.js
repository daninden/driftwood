// 0.31 "Axe" (part 3, Dave's own rule): only after his shelter is quite finished (lean-to, walls, ring and bed) he makes ONE axe and then fells at most one tree a morning: first every tree whose trunk stands within 10 m of the
// lean-to's middle, nearest first, then (while fewer than 12 logs are stored) the nearest just beyond it; the logs go to log piles of twelve 11 to 13 m from the lean-to's middle; a giant is carried one section a morning;
// the axe is never lost; needs keep priority; nothing is felled for firewood. Scripted setups on island 1337: a finished home (lean-to and its three upgrades) beside the palms of the start. Each test fails without its part.
// Depends on: game/game, game/mind, game/felled, game/logs, game/wood, tests/helpers/mindCamp.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { createMind, axeNext, HOME_FROM, AXE_TO, AXE_CLEAR_R, AXE_OUT_R, AXE_LOGS, AXE_THIRST, AXE_HUNGER, LOG_RING } from '../src/game/mind.js';
import { LISTS, treeId, trunkRadius, sizeKind, isGiant } from '../src/game/felled.js';
import { PILE_MAX } from '../src/game/wood.js';
import { campGame } from './helpers/mindCamp.js';

let w, spawn, site;
beforeAll(async () => {
  w = await generateWorld(1337); spawn = startSpot(w);
  site = createMind(w, campGame(w, spawn, { day: 2, time: 0.22 })).leantoSites({ x: spawn.x, z: spawn.z })[0];
}, 120000);

const UP = { walls: 1, ring: 1, bed: 1 };
// a game on `day` at `time` with a finished home (the first site he would choose beside the start); up: the upgrades finished; extra: game options (axe, felled, logs, wood ...)
const homeGame = ({ day = 2, time = 0.22, up = UP, extra = {} } = {}) => campGame(w, spawn, { day, time, leantos: { list: [{ id: 0, x: site.x, z: site.z, heading: site.heading, progress: 1, up }], nextId: 1 }, extra });
const treesAround = (c, r0, r1) => {   // the trees whose trunk stands more than r0 and at most r1 from c, nearest first
  const out = [];
  for (const tile of w.tiles) for (const list of LISTS) tile[list].forEach((t, index) => { const d = Math.hypot(t.x - c.x, t.z - c.z); if (d > r0 && d <= r1) { const kind = sizeKind(list, t); out.push({ id: treeId(tile, list, index), x: t.x, z: t.z, d, list, giant: isGiant(t, kind), r: trunkRadius(t, kind) }); } });
  return out.sort((a, b) => a.d - b.d);
};
const logPiles = g => g.wood.piles.filter(q => q.kind === 'log');
const lying = g => [...g.logs.all.values()].filter(l => g.logs.onGround(l)).length;
const dayOf = total => Math.floor(total + 1e-9);

// Dave alone on a finished home for `days` days; the tick callback sees every step. Ends at the given time of the last day.
function live(g, days, { onTick = null, until = 0.7, stream = 0, onIntent = undefined } = {}) {
  const m = createMind(w, g, { stream, onIntent }); m.engage();
  const end = g.clock.day + days, p = g.player, rep = { maxThirst: 0, maxHunger: 0, errors: [], collapses: 0, handLog: 0 };
  const sl = g.sleep, so = sl.start.bind(sl);
  sl.start = (...a) => { const was = sl.asleep; so(...a); if (!was && sl.asleep && !m.chose()) rep.collapses++; };
  while (g.clock.day < end || (g.clock.day === end && g.clock.time < until)) {
    try { m.step(0.1); g.update(m.input, 0.1); } catch (e) { rep.errors.push(String(e && e.stack || e)); break; }
    rep.maxThirst = Math.max(rep.maxThirst, g.thirst.days); rep.maxHunger = Math.max(rep.maxHunger, g.hunger.days);
    if (onTick) onTick(g, m, p);
  }
  return { m, rep };
}

describe('axeNext (pure): the axe project has its turn', () => {
  const base = { day: 5, time: 0.3, done: true, builtDay: 4, axeDay: 4, thirst: 0.05, hunger: 0.05, cool: {} };
  it('only in the home\'s morning window, on a day with no piece of the home or unit of the axe work done, when the home is complete and nothing presses', () => {
    expect(axeNext(base)).toBe(true);
    expect(axeNext({ ...base, done: false })).toBe(false);                       // the home is not finished: lean-to, walls, ring and bed
    expect(axeNext({ ...base, time: HOME_FROM - 0.01 })).toBe(false);
    expect(axeNext({ ...base, time: AXE_TO })).toBe(false);
    expect(axeNext({ ...base, axeDay: 5 })).toBe(false);                         // one unit a day
    expect(axeNext({ ...base, builtDay: 5 })).toBe(false);                       // the last piece of the home was finished today
    expect(axeNext({ ...base, day: 1 })).toBe(false);
    expect(axeNext({ ...base, thirst: AXE_THIRST })).toBe(false);
    expect(axeNext({ ...base, hunger: AXE_HUNGER })).toBe(false);
    expect(axeNext({ ...base, cool: { axe: true } })).toBe(false);
  });
});

describe('Dave and the axe: the plan', () => {
  it('has no plan before the home is complete (no bed, no walls, no lean-to), and starts with the axe once it is', () => {
    for (const up of [{ walls: 1, ring: 1 }, { ring: 1, bed: 1 }, {}]) expect(createMind(w, homeGame({ up })).axePlan()).toBeNull();
    expect(createMind(w, homeGame()).axePlan()).toEqual({ what: 'make' });
    const withAxe = createMind(w, homeGame({ extra: { axe: { hand: false, at: { x: spawn.x, z: spawn.z + 3 } } } })).axePlan();
    expect(withAxe.what).toBe('fell');
    expect(withAxe.tree.inner).toBe(true);
    expect(withAxe.tree.d).toBeLessThanOrEqual(AXE_CLEAR_R);
  });
  it('plans the nearest tree within 10 m of the lean-to\'s middle first (palms and giants too), and only a tree on ground he knows', () => {
    const g = homeGame({ extra: { axe: { hand: false, at: { x: spawn.x, z: spawn.z + 3 } } } }), lt = g.leantos.list[0], plan = createMind(w, g).axePlan();
    const near = treesAround(lt, -1, AXE_CLEAR_R);
    expect(near.length).toBeGreaterThan(3);
    expect(near.some(t => t.list === 'palms')).toBe(true);
    const ok = near.filter(t => g.known.has(t.x, t.z));
    expect(plan.tree.id).toBe(ok[0].id);   // the nearest of those he knows (all that are reachable)
    expect(g.known.has(plan.tree.x, plan.tree.z)).toBe(true);
  });
});

describe('Dave and the axe: twelve days in a finished home', () => {
  let run;   // the one long run the checks below look at
  beforeAll(() => {
    const g = homeGame(), lt = g.leantos.list[0], rec = { fellTimes: [], dayStart: {}, lyingAtMorning: {}, felledAtMorning: {}, hands: 0, logsOnShoulder: 0, axeHand: 0, minAxeDist: Infinity };
    const trees0 = treesAround(lt, -1, AXE_CLEAR_R);
    let n0 = 0, day0 = -1;
    const { m, rep } = live(g, 12, { until: 0.7, onTick: (g2, m2) => {
      const c = g2.clock;
      if (c.day !== day0) { day0 = c.day; rec.lyingAtMorning[c.day] = lying(g2); rec.felledAtMorning[c.day] = g2.felled.list.length; }
      if (g2.felled.list.length > n0) { const rc = g2.felled.list[g2.felled.list.length - 1]; rec.fellTimes.push({ day: c.day, time: c.time, id: rc.id, list: rc.list, d: Math.hypot(rc.x - lt.x, rc.z - lt.z), giant: rc.giant, lyingBefore: rec.lyingAtMorning[c.day] }); n0 = g2.felled.list.length; }
      if (g2.axe.hand && !(c.time >= 0.2 && c.time < 0.7)) rec.axeHand++;   // the axe is in his hand only in the day's work, never at night or in the evening
      if (g2.wood.log && !(c.time >= 0.2 && c.time < 0.7)) rec.logsOnShoulder++;
    } });
    run = { g, m, rep, rec, lt, trees0 };
  }, 600000);

  it('makes the axe once, the day after the home is complete at the earliest, and never loses it: it ends lying beside a log pile, not in his hand', () => {
    const { g, m, rec, lt } = run;
    expect(m.stats.axe.made).toBe(1);
    expect(g.axe.has()).toBe(true);
    expect(rec.axeHand).toBe(0);
    expect(g.axe.hand).toBe(false);
    expect(g.axe.at).toBeTruthy();
    const piles = logPiles(g);
    expect(piles.length).toBeGreaterThan(0);
    expect(Math.min(...piles.map(q => Math.hypot(q.x - g.axe.at.x, q.z - g.axe.at.z)))).toBeLessThan(5);   // laid down at the camp, beside the log piles
    expect(Math.hypot(g.axe.at.x - lt.x, g.axe.at.z - lt.z)).toBeLessThan(LOG_RING[2] + 3);
    expect(m.stats.axe.stuck).toBe(0);
  });
  it('fells at most one tree a day, in the home\'s morning, nearest first within 10 m of the lean-to\'s middle', () => {
    const { rec, lt, trees0 } = run;
    expect(rec.fellTimes.length).toBeGreaterThanOrEqual(2);
    const days = rec.fellTimes.map(f => f.day);
    expect(new Set(days).size).toBe(days.length);                         // never two in a day
    for (const f of rec.fellTimes) { expect(f.time).toBeGreaterThanOrEqual(HOME_FROM); expect(f.time).toBeLessThan(AXE_TO + 0.12); }   // started by HOME_TO; the hour of chopping ends a little later
    for (let i = 1; i < rec.fellTimes.length; i++) expect(rec.fellTimes[i].d).toBeGreaterThanOrEqual(rec.fellTimes[i - 1].d - 1e-9);   // nearest first
    const within = trees0.map(t => t.id);
    for (const f of rec.fellTimes) expect(within).toContain(f.id);        // the clearing is not yet open: nothing beyond 10 m
    expect(Math.max(...rec.fellTimes.map(f => f.d))).toBeLessThanOrEqual(AXE_CLEAR_R);
    expect(rec.fellTimes.some(f => f.list === 'palms')).toBe(true);        // palms count: the shelter stands among them
  });
  it('lays the logs on log piles 11 to 13 m from the lean-to\'s middle, none fuller than 12, and never in the lean-to\'s own region; a log lying or on his shoulder at night does not happen', () => {
    const { g, lt, m, rec } = run, piles = logPiles(g);
    expect(piles.length).toBeGreaterThan(0);
    for (const q of piles) { const d = Math.hypot(q.x - lt.x, q.z - lt.z); expect(d).toBeGreaterThanOrEqual(LOG_RING[0] - 0.4); expect(d).toBeLessThanOrEqual(LOG_RING[2] + 0.4); expect(q.logs.length).toBeLessThanOrEqual(PILE_MAX); }
    expect(piles.reduce((n, q) => n + q.logs.length, 0)).toBeGreaterThanOrEqual(m.stats.axe.felled - 1);   // every tree gave a log (a giant more) and they are piled, except the latest ones lying
    expect(rec.logsOnShoulder).toBe(0);
    expect(g.wood.piles.filter(q => q.kind !== 'log').every(q => q.logs.length > 0)).toBe(true);
  });
  it('carries a giant\'s sections one a morning (a log lying about is carried before the next tree is felled), and one unit of work a day', () => {
    const { rec, g } = run;
    for (const f of rec.fellTimes) expect(f.lyingBefore, `a tree felled on day ${f.day} while ${f.lyingBefore} logs lay about`).toBe(0);
    expect(lying(g)).toBeLessThanOrEqual(3);
  });
  it('keeps the needs first: no collapse, no thirst or hunger beyond the bounds, no stuck walk, no error', () => {
    const { rep, m } = run;
    expect(rep.errors).toEqual([]);
    expect(rep.collapses).toBe(0);
    expect(rep.maxThirst).toBeLessThan(1.125);
    expect(rep.maxHunger).toBeLessThan(1.5);
    expect(m.stats.stuck).toBeLessThan(5);
    expect(m.stats.nopath).toBe(0);
  });
  it('never fells for firewood: no log is ever burned (logs are no fuel) and the fire is fed only with wood', () => {
    const { g } = run;
    for (const f of g.fire.fires) expect(f.fuel).toBeGreaterThanOrEqual(0);
    expect(g.wood.piles.filter(q => q.kind === 'log').every(q => q.logs.every(l => l.timber))).toBe(true);
  });
});

describe('Dave and the axe: the reasons he gives (0.30.20 "Words": reasons speak, actions never do)', () => {
  it('thinks of the axe once before he sets out to make it, and of the room once at the start of each felling errand; nothing else is said about the work', () => {
    const g = homeGame(), kinds = [];
    live(g, 1, { until: 0.62, onIntent: e => { if (/axe|clear/i.test(e.kind) || e.work) kinds.push(e.kind); } });
    expect(kinds.filter(k => k === 'axeIntent')).toHaveLength(1);       // the axe is made on the first morning
    expect(kinds.filter(k => k === 'clearIntent')).toHaveLength(1);     // and the first tree falls on the next
    expect(kinds.indexOf('axeIntent')).toBeLessThan(kinds.indexOf('clearIntent'));
  });
});

describe('Dave and the axe: the end of the work', () => {
  // all trees within 10 m felled before the first morning, the axe lying beside the camp
  const open = (nLogs, extra = {}) => {
    const g0 = homeGame(), lt = g0.leantos.list[0];
    const felled = { list: treesAround(lt, -1, AXE_CLEAR_R).map(t => ({ id: t.id, h: 0, at: 0 })) };
    const g = homeGame({ day: 4, time: 0.2, extra: { axe: { hand: false, at: { x: spawn.x + 1.5, z: spawn.z + 4 } }, felled, ...extra } });
    const m0 = createMind(w, g), d = m0.logDest();
    for (let n = 0, pile = null; n < nLogs; n++) {
      const l = g.logs.add({ x: d.x, z: d.z, len: 2, a: 0, rad: 0.12 }); g.logs.take(l);
      if (!pile || pile.logs.length >= PILE_MAX) { pile = { x: d.x + (g.wood.piles.filter(q => q.kind === 'log').length) * 3, z: d.z, kind: 'log', logs: [] }; g.wood.piles.push(pile); }
      pile.logs.push(l);
    }
    return { g, lt };
  };
  it('stops when the clearing is open and twelve logs are stored: no more felling', () => {
    const { g, lt } = open(AXE_LOGS);
    expect(g.felled.list.length).toBeGreaterThan(3);
    const n0 = g.felled.list.length, { m, rep } = live(g, 3, { until: 0.7 });
    expect(rep.errors).toEqual([]);
    expect(createMind(w, g).axePlan()).toBeNull();
    expect(g.felled.list.length).toBe(n0);
    expect(m.stats.axe.felled).toBe(0);
    expect(g.axe.hand).toBe(false);
  });
  it('with the clearing open and fewer than twelve logs stored he fells the nearest trees just outside 10 m, a day at a time, on known ground, until twelve are there', () => {
    const { g, lt } = open(4);
    const n0 = g.felled.list.length, plan = createMind(w, g).axePlan();
    expect(plan.what).toBe('fell');
    expect(plan.tree.inner).toBe(false);
    expect(plan.tree.d).toBeGreaterThan(AXE_CLEAR_R);
    expect(plan.tree.d).toBeLessThanOrEqual(AXE_OUT_R);
    const outer = treesAround(lt, AXE_CLEAR_R, AXE_OUT_R).filter(t => g.known.has(t.x, t.z));
    expect(plan.tree.d).toBeLessThanOrEqual(outer[Math.min(outer.length - 1, 12)].d);   // among the nearest outside it
    const { m, rep } = live(g, 4, { until: 0.7 });
    expect(rep.errors).toEqual([]);
    expect(g.felled.list.length).toBeGreaterThan(n0);
    expect(g.felled.list.length - n0).toBeLessThanOrEqual(4);          // one a day
    for (const rc of g.felled.list.slice(n0)) { const d = Math.hypot(rc.x - lt.x, rc.z - lt.z); expect(d).toBeGreaterThan(AXE_CLEAR_R); expect(d).toBeLessThanOrEqual(AXE_OUT_R); }
    expect(m.stats.axe.outer).toBe(g.felled.list.length - n0);
    expect(m.stats.axe.inner).toBe(0);
  });
  it('picks up a log that lies about before felling anything new, and lays it on a pile at the clearing\'s edge', () => {
    const { g, lt } = open(AXE_LOGS);
    const lg = g.logs.add({ x: lt.x - 6, z: lt.z + 2, len: 2, a: 0.3, rad: 0.12 });
    const before = logPiles(g).reduce((n, q) => n + q.logs.length, 0);
    const { m, rep } = live(g, 1, { until: 0.5 });
    expect(rep.errors).toEqual([]);
    expect(g.logs.onGround(lg)).toBe(false);
    expect(logPiles(g).reduce((n, q) => n + q.logs.length, 0)).toBe(before + 1);
    expect(g.wood.log).toBeNull();
    expect(g.felled.list.length).toBe(treesAround(lt, -1, AXE_CLEAR_R).length);   // only the clearing's own felled trees: nothing new
  });
});
