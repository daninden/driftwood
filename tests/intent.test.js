// Intentions (game/intent, 0.35): the menu of what Dave could do now, the chooser that picks, and the check of a choice; plus lives run through them.
// The behaviour of the island must not change in 0.35 (the chooser is the present rules): the proof is a fingerprint of 38 lives before and after (docs/versions.md); here a half-day life is run with the default
// chooser and with `rulesChooser` named, and must give the same events, and a two-day life driven by `firstChooser` (no random numbers, no network) must run without an error and only ever pick what was on the menu.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { createMind, chooseGoal, VERY_AT, VERY_HUNGER_AT } from '../src/game/mind.js';
import { POINTS, STAGES, option, makeMenu, goalMenu, pastimeMenu, eventMenu, validChoice, choiceId, rulesChooser, firstChooser, isValid } from '../src/game/intent.js';
import { walkFirstDay } from './helpers/mindSim.js';

const calm = (o = {}) => ({ asleep: false, time: 0.4, thirst: 0.1, hunger: 0.1, awake: 0.3, canLie: false, water: true, waterNear: false, shellsEmpty: 0, shellsFull: 0, nuts: 2, fibre: 2, torch: false,
  fireLit: false, fireFuel: 0, stock: 99, spare: 0, canLight: false, cool: {}, ...o });
const limits = { thirst: VERY_AT, hunger: VERY_HUNGER_AT };
const ids = m => m.options.map(o => o.id);
const rigged = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };   // a stream of chosen numbers
const ctxOf = (o = {}) => ({ rand: rigged(0.5), ex: rigged(0.5), fish: rigged(0.5), ...o });

describe('options and menus', () => {
  it('an option has the whole shape, with the rule hidden', () => {
    const o = option({ id: 'x', goal: 'idle', what: 'do x', why: 'because' }, { ok: () => true });
    expect(o).toEqual({ id: 'x', goal: 'idle', what: 'do x', at: null, cost: null, est: null, why: 'because', forced: false });
    expect(Object.keys(o)).not.toContain('rule');
    expect(POINTS).toEqual(['goal', 'pastime', 'event']);
  });

  it('the goal menu lists the goals in the order of chooseGoal, and its first is what chooseGoal says', () => {
    expect(ids(goalMenu(calm(), chooseGoal, limits))).toEqual(['idle']);
    expect(ids(goalMenu(calm({ thirst: 0.5, hunger: 0.8 }), chooseGoal, limits))).toEqual(['drink', 'eat', 'stores', 'idle']);   // (a hungry man with nuts to husk: the stores goal too)
    expect(ids(goalMenu(calm({ time: 0.7, canLie: true, awake: 1.1, thirst: 0.5, fireLit: false, canLight: true, stock: 0 }), chooseGoal, limits))).toEqual(['drink', 'sleep', 'fire', 'idle']);
    expect(goalMenu(calm({ asleep: true }), chooseGoal, limits).options).toEqual([]);
    expect(ids(goalMenu(calm({ thirst: 0.5, cool: { drink: true } }), chooseGoal, limits))).toEqual(['idle']);   // a goal on cooldown is not on the menu
    let n = 0;   // many snapshots: the first option is always chooseGoal's answer
    for (const time of [0.05, 0.2, 0.4, 0.66, 0.8, 0.9]) for (const thirst of [0.1, 0.4, 1.1]) for (const hunger of [0.1, 0.9, 2.1]) for (const canLie of [false, true]) for (const cool of [{}, { drink: true, eat: true }]) {
      const s = calm({ time, thirst, hunger, canLie, cool, awake: 0.9, stock: 0, fireLit: time > 0.7, fireFuel: 0.1, spare: 1, shellsEmpty: 1, waterNear: true, crabs: time > 0.7 ? 1 : 0, flames: true });
      expect(ids(goalMenu(s, chooseGoal, limits))[0], JSON.stringify(s)).toBe(chooseGoal(s)); n++;
    }
    expect(n).toBe(6 * 3 * 3 * 2 * 2);
  });

  it('an emergency is a forced option: when one is on the menu the others are not valid choices', () => {
    const m = goalMenu(calm({ thirst: 1.05, hunger: 0.8 }), chooseGoal, limits);
    expect(m.options.map(o => [o.id, o.forced])).toEqual([['drink', true], ['eat', false], ['stores', false], ['idle', false]]);
    expect(validChoice(m, 'drink')).toBe(true); expect(validChoice(m, 'eat')).toBe(false); expect(validChoice(m, 'idle')).toBe(false);
    expect(firstChooser('goal', m)).toBe('drink');
    const m2 = goalMenu(calm({ thirst: 0.5, hunger: 0.8 }), chooseGoal, limits);
    expect(m2.options.some(o => o.forced)).toBe(false); expect(validChoice(m2, 'eat')).toBe(true);
  });

  it('the event menu has the one option continue; the rules and the fake both take it', () => {
    const m = eventMenu('stuck', 'drink');
    expect(m.options).toEqual([{ id: 'continue', goal: 'drink', what: 'carry on', at: null, cost: null, est: null, why: 'stuck', forced: false }]);
    expect(rulesChooser('event', m, ctxOf())).toBe('continue'); expect(firstChooser('event', m)).toBe('continue');
    expect(validChoice(m, 'continue')).toBe(true); expect(validChoice(m, 'sleep')).toBe(false);
  });

  it('a pastime menu leaves out what has no facts and keeps the rules\' order; the facts are read lazily', () => {
    const read = []; const f = id => () => { read.push(id); return true; };
    const m = pastimeMenu('day', { home: f('home'), tide: f('tide'), explore: { ok: f('explore'), chance: () => 0.5 } });
    expect(ids(m)).toEqual(['home', 'tide', 'explore', 'stroll', 'linger']);   // the stroll and the linger are always there (the stroll's number is always drawn)
    expect(read).toEqual([]);
    expect(isValid(m.options[0])).toBe(true); expect(read).toEqual(['home']);
    expect(ids(pastimeMenu('before', {}))).toEqual(['onward']);
    expect(STAGES.before.at(-1)).toBe('onward'); expect(STAGES.day.at(-1)).toBe('linger');
  });

  it('validChoice: unknown ids, impossible options and null are refused', () => {
    const m = pastimeMenu('day', { home: false, tide: true });
    expect(validChoice(m, 'tide')).toBe(true); expect(validChoice(m, { id: 'tide' })).toBe(true);
    expect(validChoice(m, 'home')).toBe(false); expect(validChoice(m, 'nonsense')).toBe(false); expect(validChoice(m, null)).toBe(false); expect(choiceId({ id: 'a', kind: 'shore' })).toBe('a'); expect(choiceId(null)).toBeNull();
  });
});

describe('estimates (0.35.1 "Bearings")', () => {
  it('at, cost and est are worked out only when read, once per option, and the rules never read them', () => {
    let n = 0;
    const est = () => { n++; return { at: { x: 1, z: 2 }, cost: 3, est: 'line' }; };
    const m = pastimeMenu('day', { home: { ok: true, estimate: est }, tide: { ok: false, estimate: est }, explore: { ok: true, chance: 1, draw: 'ex', estimate: () => { n++; return { at: null, cost: null, est: null, note: 'chosen on the way' }; } } });
    expect(rulesChooser('pastime', m, ctxOf({ ex: () => 0 }))).toBe('home');
    expect(isValid(m.options[0])).toBe(true); expect(n).toBe(0);
    const o = m.options[0];
    expect(o.at).toEqual({ x: 1, z: 2 }); expect(o.cost).toBe(3); expect(o.est).toBe('line'); expect(n).toBe(1);   // (one computation for the three fields)
    const e = m.options.find(x => x.id === 'explore'); expect([e.at, e.cost, e.est, e.note]).toEqual([null, null, null, 'chosen on the way']);
    const l = m.options.find(x => x.id === 'linger'); expect([l.at, l.cost, l.est]).toEqual([null, null, null]);
    const g = goalMenu(calm({ thirst: 0.5 }), chooseGoal, limits, { drink: est });
    expect(rulesChooser('goal', g, {})).toBe('drink');
    const before = n; expect(g.options[0].cost).toBe(3); expect(n).toBe(before + 1);
  });
});

describe('the choosers', () => {
  it('rulesChooser takes the first possible pastime and draws only where the old chain drew', () => {
    const drawn = []; const ctx = { rand: () => (drawn.push('rand'), 0.5), ex: () => (drawn.push('ex'), 0.5), fish: () => (drawn.push('fish'), 0.5) };
    // nothing before the stroll: no chance for exploring (no draw), a chance for fishing that fails (draw), the stroll's number drawn although it is not the time of day (draw), then the linger
    let m = pastimeMenu('day', { journey: false, home: false, explore: { ok: false, chance: () => 0 }, fish: { ok: true, chance: () => 0.2 }, stroll: { ok: false, chance: () => 0.9, kind: () => 'shore' } });
    expect(rulesChooser('pastime', m, ctx)).toBe('linger'); expect(drawn).toEqual(['fish', 'rand']);
    // a chance that succeeds is taken and nothing after it draws
    drawn.length = 0; m = pastimeMenu('day', { home: false, explore: { ok: true, chance: () => 0.9 }, fish: { ok: true, chance: () => 0.9 } });
    expect(rulesChooser('pastime', m, ctx)).toBe('explore'); expect(drawn).toEqual(['ex']);
    // a stroll: the first number decides, the second picks the kind (the kind function gets the stream); a kind of null passes over the stroll
    drawn.length = 0; m = pastimeMenu('day', { stroll: { ok: true, chance: () => 0.9, kind: r => (r() < 0.6 ? 'river' : null) } });
    expect(rulesChooser('pastime', m, ctx)).toEqual({ id: 'stroll', kind: 'river' }); expect(drawn).toEqual(['rand', 'rand']);
    m = pastimeMenu('day', { stroll: { ok: true, chance: () => 0.9, kind: () => null } });
    expect(rulesChooser('pastime', m, ctx)).toBe('linger');
    // the first possible one wins before any chance
    m = pastimeMenu('day', { home: true, tide: true });
    drawn.length = 0; expect(rulesChooser('pastime', m, ctx)).toBe('home'); expect(drawn).toEqual([]);
  });

  it('firstChooser takes the first possible option, a forced one before any other, and never draws', () => {
    const m = pastimeMenu('day', { journey: false, home: false, spear: true, tide: true, explore: { ok: true, chance: () => 1 } });
    expect(firstChooser('pastime', m)).toBe('spear');
    expect(firstChooser('pastime', pastimeMenu('before', { gaze: true }))).toBe('gaze');
    expect(firstChooser('pastime', pastimeMenu('before', { gaze: false }))).toBe('onward');
    const forced = makeMenu('goal', [option({ id: 'a' }), option({ id: 'b', forced: true })]);
    expect(firstChooser('goal', forced)).toBe('b');
    expect(firstChooser('goal', makeMenu('goal', []))).toBeNull();
  });
});

// --- lives ---
let w, spawn;
beforeAll(async () => { w = await generateWorld(1337); spawn = startSpot(w); }, 120000);

function life(chooser, days, { stream = 0 } = {}) {
  const game = createGame(w, spawn, {});
  walkFirstDay(w, game, spawn, {}); game.known.visit(spawn.x, spawn.z);
  const calls = [];
  const wrapped = chooser && ((point, menu, ctx) => { const c = chooser(point, menu, ctx); calls.push({ point, menu: menu.options.map(o => o.id), chosen: choiceId(c), valid: point === 'event' || validChoice(menu, c) }); return c; });
  const mind = createMind(w, game, { stream, ...(wrapped ? { chooser: wrapped } : {}) });
  mind.engage();
  const end = game.clock.total + days;
  while (game.clock.total < end) { mind.step(0.1); game.update(mind.input, 0.1); }
  return { game, mind, calls };
}

describe('lives through the menu', () => {
  it('a half day with the default chooser and with rulesChooser named gives the same events and the same ending', () => {
    const a = life(null, 0.5), b = life(rulesChooser, 0.5);
    expect(a.mind.stats.events.length).toBeGreaterThan(5);
    expect(JSON.stringify(b.mind.stats)).toBe(JSON.stringify(a.mind.stats));
    expect([b.game.player.x, b.game.player.z, b.game.thirst.days, b.game.hunger.days]).toEqual([a.game.player.x, a.game.player.z, a.game.thirst.days, a.game.hunger.days]);
    expect(b.calls.some(c => c.point === 'goal')).toBe(true);
  }, 60000);

  it('two days driven by firstChooser run without a mind error, and every choice was on its menu and valid', () => {
    const r = life(firstChooser, 2);
    expect(r.mind.stats.errors || 0).toBe(0);
    expect(r.calls.length).toBeGreaterThan(10);
    for (const c of r.calls) { expect(c.menu, JSON.stringify(c)).toContain(c.chosen); expect(c.valid, JSON.stringify(c)).toBe(true); }
    expect(new Set(r.calls.map(c => c.point)).has('goal')).toBe(true); expect(new Set(r.calls.map(c => c.point)).has('pastime')).toBe(true);
    expect(r.mind.lastDecision).toMatchObject({ point: expect.stringMatching(/goal|pastime/), chosen: expect.any(String) });
    expect(r.mind.recent.length).toBeLessThanOrEqual(20);
    expect(r.mind.recent.every(e => e.kind && e.what !== undefined && 'outcome' in e && 'day' in e && 't' in e)).toBe(true);
    expect(ids(r.mind.menu()).at(-1)).toBe('idle');
  }, 60000);

  it('an answer that is not a valid choice is replaced by the rules\' answer, and events are put to the chooser and remembered', () => {
    const r = life(() => 'nonsense', 0.3);
    expect(r.mind.stats.errors || 0).toBe(0); expect(r.mind.stats.goals.idle).toBeGreaterThan(0);
    const calls = []; const q = life((point, menu, ctx) => { if (point === 'event') calls.push(menu.options[0].why); return rulesChooser(point, menu, ctx); }, 1);
    expect(q.mind.recent.length).toBeGreaterThan(0);
    for (const k of calls) expect(['stuck', 'nopath', 'no-stand', 'failed', 'dropped']).toContain(k);
  }, 60000);
});

describe('estimates in a life (0.35.1 "Bearings")', () => {
  it('a drink from a full shell is here at cost 0, else the nearest known water; the other goals and pastimes have a bearing or none', () => {
    const game = createGame(w, spawn, {});
    walkFirstDay(w, game, spawn, {}); game.known.visit(spawn.x, spawn.z);
    const mind = createMind(w, game, {});
    game.thirst.days = 0.5; game.shells.list = [false];
    let d = mind.menu().options.find(o => o.id === 'drink');
    expect(d.est).toBe('line'); expect(d.cost).toBeGreaterThanOrEqual(0); expect(Number.isFinite(d.at.x)).toBe(true);
    game.shells.list = [true];
    d = mind.menu().options.find(o => o.id === 'drink');
    expect(d.cost).toBe(0); expect(d.at).toEqual({ x: game.player.x, z: game.player.z }); expect(d.est).toBe('line');
  });

  it('two days through a reading chooser: every estimate is a line or a path or nothing, no draw is made, the run is the same as without reading', () => {
    const seen = {};
    const reader = (point, menu, ctx) => {
      for (const o of menu.options) { const r = { at: o.at, cost: o.cost, est: o.est }; (seen[o.id] ||= []).push(r); }
      return rulesChooser(point, menu, ctx);
    };
    const a = life(reader, 2), b = life(null, 2);
    expect(JSON.stringify(a.mind.stats)).toBe(JSON.stringify(b.mind.stats));   // reading changes nothing (no random number, no state)
    expect([a.game.player.x, a.game.player.z, a.game.thirst.days]).toEqual([b.game.player.x, b.game.player.z, b.game.thirst.days]);
    for (const [id, list] of Object.entries(seen)) for (const r of list) {
      expect(['line', 'path', null], id).toContain(r.est);
      expect(r.est === null, id).toBe(r.at === null && r.cost === null);
      if (r.est) { expect(r.cost, id).toBeGreaterThanOrEqual(0); expect(Number.isFinite(r.at.x) && Number.isFinite(r.at.z), id).toBe(true); }
      if (['explore', 'journey', 'idle', 'linger', 'onward'].includes(id)) expect(r.at, id).toBeNull();
      if (r.est === 'path') expect(['fish', 'tide'], id).toContain(id);
    }
    expect(seen.sleep?.length, 'a sleep option was on a menu').toBeGreaterThan(0);
    for (const r of seen.sleep) expect(r.est).toBe('line');
    expect(seen.stroll?.some(r => r.est === 'line')).toBe(true);
  }, 120000);

  it('rulesChooser never reads at, cost or est', () => {
    const bomb = { get() { throw new Error('read'); }, enumerable: true };
    const mk = (id, rule) => { const o = option({ id }, rule); for (const k of ['at', 'cost', 'est']) Object.defineProperty(o, k, bomb); return o; };
    const m = makeMenu('pastime', [mk('home', { ok: () => false }), mk('explore', { ok: () => true, chance: () => 1, draw: 'ex', always: false }), mk('linger', {})]);
    expect(() => rulesChooser('pastime', m, ctxOf({ ex: () => 0 }))).not.toThrow();
    expect(() => validChoice(m, 'explore')).not.toThrow();
    expect(() => rulesChooser('goal', makeMenu('goal', [mk('idle', null)]), {})).not.toThrow();
    const r = life((point, menu, ctx) => rulesChooser(point, menu, ctx), 0.3);   // (a whole life through it too: reading would be counted in the next test, not here)
    expect(r.mind.stats.errors || 0).toBe(0);
  }, 60000);
});
