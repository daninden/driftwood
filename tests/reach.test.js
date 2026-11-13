// 0.36.5 "Reach", 0.36.6 "One menu": the hours of the menu (daylight and the real conditions: the same for every chooser; the rules' old windows are the rules chooser's habit, tests/oneMenu.test.js), the spear and the axe fetching their own materials,
// the destinations of a stroll and of exploring, and the plan request that says all this.
// Depends on: game/mind, game/intent, game/game, ai/prompt, ai/chooser, tests/helpers/mindCamp.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { createMind, spearMakeOk, homeNext, axeNext, exploreChance, fishChance, exploreLate, habitOk, EXPLORE_BACK, AI_BACK, AI_FROM, AI_WORK_TO, AI_TRIP_TO, SPEAR_RANGE, SPEAR_DAY, HOME_DAY, EXPLORE_WHERE } from '../src/game/mind.js';
import { isValid, rulesChooser, firstChooser } from '../src/game/intent.js';
import { stonesOfTile } from '../src/game/stones.js';
import { branchesOfTile } from '../src/game/branches.js';
import { createPath } from '../src/game/path.js';
import { campGame } from './helpers/mindCamp.js';
import { parsePlan, buildPlanMessages, stateText, FIXED, STEP_WHEN, hoursOpen, STEP_TO, PLAN_PASTIMES } from '../src/ai/prompt.js';
import { createAiChooser } from '../src/ai/chooser.js';
import { groupByPlan, planLines } from '../src/render/aiPanel.js';

let w, spawn;
beforeAll(async () => { w = await generateWorld(1337); spawn = startSpot(w); }, 120000);

const calm = { thirst: 0, hunger: 0, cool: {}, spear: false };
describe('the menu\'s hours (pure, 0.36.6: the same for every chooser)', () => {
  it('the pastimes run by day, from dawn to AI_WORK_TO or AI_TRIP_TO, whoever chooses', () => {
    // 16:48 (0.7): past every habit window of the rules, inside the menu's hours
    expect(spearMakeOk({ ...calm, time: 0.7, day: 7 })).toBe(true);
    expect(spearMakeOk({ ...calm, time: 0.82, day: 7 })).toBe(false);   // after AI_WORK_TO
    const home = { day: HOME_DAY, time: 0.7, lean: 'done', up: { walls: 0 }, cool: {} };
    expect(homeNext(home)).toBe('walls');
    expect(homeNext({ ...home, day: 0 })).toBe(null);   // the day-number gate stays
    const axe = { day: HOME_DAY, time: 0.5, done: true, builtDay: -1, axeDay: -1, thirst: 0, hunger: 0, cool: {} };
    expect(axeNext(axe)).toBe(true); expect(axeNext({ ...axe, axeDay: HOME_DAY })).toBe(false);   // one piece of work a day stays
    const ex = { time: 0.6, day: 7, thirst: 0, hunger: 0, last: 1, missing: 0, cool: {} };
    expect(exploreChance(ex)).toBeGreaterThan(0);
    expect(exploreChance({ ...ex, last: 6 })).toBe(0);   // not every day
    expect(exploreChance({ ...ex, time: 0.7 })).toBe(0);   // a trip is not started after AI_TRIP_TO
    expect(exploreChance({ ...ex, thirst: 0.3 })).toBe(0);   // the real conditions stay
    const fi = { time: 0.3, day: 7, last: 6, spear: true, crabs: 0, fish: 0, thirst: 0, hunger: 0, cool: {} };
    expect(fishChance(fi)).toBeGreaterThan(0); expect(fishChance({ ...fi, spear: false })).toBe(0); expect(fishChance({ ...fi, day: 6 })).toBe(0);
    expect(AI_FROM).toBeLessThan(0.2); expect(AI_TRIP_TO).toBeLessThan(AI_BACK); expect(AI_WORK_TO).toBeLessThanOrEqual(AI_BACK);
  });
  it('a trip is late against AI_BACK instead of EXPLORE_BACK', () => {
    expect(exploreLate(0.65, 30)).toBe(true); expect(exploreLate(0.65, 30, 1, AI_BACK)).toBe(false);
    expect(exploreLate(0.78, 100, 1, AI_BACK)).toBe(true);
    expect(EXPLORE_BACK).toBeLessThan(AI_BACK);
  });
});

// a mind that asks a spy chooser at every pastime menu (it records what was valid, then answers as the rules)
const spy = g => {
  const seen = [], f = (point, menu, ctx) => { if (point === 'pastime') seen.push({ t: g.clock.day + g.clock.time, opts: menu.options.map(o => [o.id, isValid(o)]) }); return rulesChooser(point, menu, ctx); };
  return { f, seen };
};
const tickMind = (g, m, secs, until = null) => { for (let t = 0; t < secs; t += 0.1) { m.step(0.1); g.update(m.input, 0.1); if (until && until()) break; } };
const knowRoute = (g, to) => { const f = createPath(w); const r = f.find(spawn, to); for (const q of (r ? r.pts : [])) g.known.visit(q.x, q.z); for (let dx = -12; dx <= 12; dx += 6) for (let dz = -12; dz <= 12; dz += 6) g.known.visit(to.x + dx, to.z + dz); };
const d0 = o => Math.hypot(o.x - spawn.x, o.z - spawn.z);

describe('the spear fetches its materials while the AI chooses', () => {
  // a branch and a stone that lie beyond SPEAR_RANGE of the camp (and only those: the nearer ones are taken out of the game)
  const scene = ({ time = 0.3 } = {}) => {
    const g = campGame(w, spawn, { day: SPEAR_DAY, time, stocked: true });
    const far = (o, a, b) => d0(o) > a && d0(o) < b;
    const branches = w.tiles.flatMap(t => g.branches.groundBranches(t)).filter(b => far(b, SPEAR_RANGE + 5, 150)).sort((a, b) => d0(a) - d0(b));
    const stones = w.tiles.flatMap(t => g.stones.groundStones(t)).filter(s => far(s, SPEAR_RANGE + 5, 160)).sort((a, b) => d0(a) - d0(b));
    expect(branches.length && stones.length, 'a branch and a stone beyond the near range').toBeTruthy();
    const ids = new Set([...branches, ...stones].map(o => o.id)), ob = g.branches.groundBranches, os = g.stones.groundStones;
    g.branches.groundBranches = t => ob(t).filter(o => ids.has(o.id)); g.stones.groundStones = t => os(t).filter(o => ids.has(o.id));
    knowRoute(g, branches[0]); knowRoute(g, stones[0]);
    return g;
  };
  it('the spear is possible for both choosers (fetched from home), blockers say nothing, and he makes it when the chooser takes it', () => {
    const mr = createMind(w, scene()); mr.engage(); expect(mr.blockers().spear).toBeUndefined();   // 0.36.6: the rules see the same menu
    const g = scene(), s = spy(g), m = createMind(w, g, { chooser: (p, me, c) => { if (p === 'pastime') { const o = me.options.find(x => x.id === 'spear'); if (o && isValid(o)) return 'spear'; } return s.f(p, me, c); } });
    m.engage();
    expect(m.blockers().spear).toBeUndefined();
    tickMind(g, m, 6000, () => m.stats.spearsMade > 0 && !g.spear.hand && !!g.spear.at);
    expect(m.stats.spearsMade).toBe(1); expect(g.spear.at && Math.hypot(g.spear.at.x - m.home().x, g.spear.at.z - m.home().z)).toBeLessThan(8);   // made, and laid at the camp
    expect(m.stats.errors || 0).toBe(0);
  });
  it('with the rules chooser the same island makes no spear: the rules prefer a spear only when its materials lie near (a habit; the menu offers it)', () => {
    const g = scene(), m = createMind(w, g); m.engage();
    tickMind(g, m, 3000);
    expect(m.stats.spearsMade).toBe(0);
  });
  it('is blocked for a plain reason when no branch and stone are known at all, for either chooser', () => {
    const g = scene(); g.stones.groundStones = () => [];
    const m = createMind(w, g, { chooser: (p, me, c) => rulesChooser(p, me, c) }); m.engage();
    expect(m.blockers().spear).toBe('no branch and stone known to fetch');
    const m2 = createMind(w, g); m2.engage(); expect(m2.blockers().spear).toBe('no branch and stone known to fetch');
  });
  it('offers the spear after the rules\' hours to every chooser; the rules do not take it then (habit)', () => {
    const near = () => { const g = campGame(w, spawn, { day: SPEAR_DAY, time: 0.68, stocked: true }); const s = w.tiles.flatMap(t => stonesOfTile(w, t)).filter(x => d0(x) < SPEAR_RANGE).sort((a, b) => d0(a) - d0(b))[0], b = w.tiles.flatMap(t => branchesOfTile(w, t)).filter(x => d0(x) < SPEAR_RANGE)[0]; if (s) knowRoute(g, s); if (b) knowRoute(g, b); return g; };
    const ga = near(), gb = near(), a = spy(ga), b = spy(gb);
    const ma = createMind(w, ga, { chooser: (p, me, c) => { if (p === 'pastime') { const o = me.options.find(x => x.id === 'spear'); if (o && isValid(o)) return 'spear'; } return a.f(p, me, c); } }), mb = createMind(w, gb, { chooser: (p, me, c) => b.f(p, me, c) });
    ma.engage(); mb.engage(); tickMind(ga, ma, 400, () => ma.stats.spearsMade > 0); tickMind(gb, mb, 400);
    const late = x => x % 1 >= 0.6 && x % 1 < 0.8, valid = sp => sp.seen.filter(m => late(m.t)).some(m => m.opts.some(([id, ok]) => id === 'spear' && ok));
    expect(b.seen.some(m => late(m.t)), 'a pastime menu in the afternoon').toBe(true);
    expect(valid(b)).toBe(true);   // the rules chooser sees it on its menu ...
    expect(habitOk('spear', { time: 0.68 })).toBe(false); expect(mb.stats.spearsMade).toBe(0);   // ... and passes it over
    expect(ma.stats.spearsMade).toBeGreaterThan(0);   // another chooser takes it
  });
});

describe('destinations', () => {
  it('the mind lists where a stroll and exploring may go, without drawing random numbers', () => {
    const g = campGame(w, spawn, { day: 3, time: 0.4, stocked: true }), m = createMind(w, g); m.engage();
    const d = m.destinations();
    expect(Array.isArray(d.stroll)).toBe(true); expect(d.explore).toEqual(EXPLORE_WHERE); expect(EXPLORE_WHERE).toEqual(['coast', 'forest']);
    for (const k of d.stroll) expect(['shore', 'river', 'palms', 'forest', 'crabs']).toContain(k);
  });
  it('parsePlan keeps a destination only from the known values and only for stroll and explore', () => {
    const p = parsePlan(JSON.stringify({ plan: [{ step: 'stroll', to: 'River', reason: 'a drink' }, { step: 'stroll', to: 'moon' }, { step: 'explore', to: 'coast' }, { step: 'fish', to: 'shore' }, { step: 'explore', to: 'forest' }], reason: 'x' }));
    expect(p.steps.map(s => s.to)).toEqual(['river', null, 'coast', null, 'forest']);
    expect(STEP_TO.stroll).toContain('crabs');
  });
  it('the request lists the allowed values and describes the answer format', () => {
    const m = buildPlanMessages({ state: { time: 0.5 }, recent: [], trigger: 'no plan yet', previous: [], possible: { goals: new Set(['stores']), pastimes: new Set(['stroll', 'linger']), destinations: { stroll: ['shore', 'river'], explore: ['coast', 'forest'] } }, mode: 'loose' });
    expect(m[1].content).toContain('stroll to shore, river'); expect(m[1].content).toContain('explore to coast, forest');
    expect(FIXED).toContain('"to"');
  });
  const clockAt = () => ({ day: 3, time: 0.4, total: 3.4 });
  const mk = (reply, dests) => {
    const game = { clock: clockAt() }, mind = { recent: [], blockers: () => ({}), menu: () => ({ options: [] }), destinations: () => dests };
    const ai = createAiChooser({ rulesChooser, ask: async () => ({ text: reply, ms: 5 }), now: () => 100, clock: () => game.clock });
    ai.attach(mind, game); return ai;
  };
  const dayMenu = ids => ({ point: 'pastime', options: ids.map(id => ({ id, goal: 'idle', what: id, why: '', forced: false, rule: { ok: () => true } })) });
  it('the chooser hands a valid destination to the execution, ignores an unknown one, and the plan shows it', async () => {
    const reply = JSON.stringify({ plan: [{ step: 'stroll', to: 'river', reason: 'water' }, { step: 'stroll', to: 'palms', reason: 'nuts' }, { step: 'explore', to: 'forest', reason: 'berries' }], reason: 'r' });
    const ai = mk(reply, { stroll: ['shore', 'river'], explore: ['coast', 'forest'] });
    const m = dayMenu(['stroll', 'explore', 'linger']);
    expect(ai.chooser('pastime', m, { rand: () => 0.5, ex: () => 0.5, fish: () => 0.5 })).toBeTruthy();   // WAIT: the plan is asked
    await new Promise(r => setTimeout(r, 20));
    const c1 = ai.chooser('pastime', m, { rand: () => 0.5, ex: () => 0.5, fish: () => 0.5 });
    expect(c1).toEqual({ id: 'stroll', kind: 'river' });
    const c2 = ai.chooser('pastime', m, { rand: () => 0.5, ex: () => 0.5, fish: () => 0.5 });
    expect(c2).toEqual({ id: 'explore', where: 'forest' });   // 0.36.7: 'palms' is not known now: that step is NOT possible (skipped with the reason), never swapped for another place
    const st = ai.plan().steps; expect(st[0].toUsed).toBe('river'); expect(st[1].state).toBe('skipped'); expect(st[1].note).toMatch(/no palms place to stroll to now/);
    const c3 = ai.chooser('pastime', m, { rand: () => 0.5, ex: () => 0.5, fish: () => 0.5 });
    expect(c3).toBeTruthy();   // the plan is used up
  });
});

describe('the request says what hours the AI really has, and that drink and eat have none', () => {
  it('the steps are listed with the AI\'s hours, not the rules\' windows', () => {
    expect(STEP_WHEN.tide).toContain('04:19 to 15:50'); expect(STEP_WHEN.spear).toContain('fetches'); expect(STEP_WHEN.home).toContain('19:12');
    expect(hoursOpen('tide', 0.6)).toBe(true); expect(hoursOpen('tide', 0.7)).toBe(false); expect(hoursOpen('spear', 0.7)).toBe(true); expect(hoursOpen('journey', 0.6)).toBe(false);
    expect(FIXED).toContain('no fixed hours');
  });
  it('drinking and eating have no hours, what thirst costs, and what to do on waking in the dark', () => {
    expect(FIXED).toContain('NO hours'); expect(FIXED).toContain('in the dark too'); expect(FIXED).toContain('tend the fire or go back to sleep');
  });
  it('the situation says when he can drink or eat now', () => {
    const base = { day: 3, time: 0.15, raining: false, daylight: 0, awake: 0.2, carries: {}, home: null, journey: false, doing: 'x' };
    expect(stateText({ ...base, thirst: 0.4, hunger: 0.1 })).toContain('Thirst: 0.4 days (he can drink now, at any hour; slower from 0.5)');
    expect(stateText({ ...base, thirst: 0.4, hunger: 0.1 })).not.toContain('he can eat now');
    expect(stateText({ ...base, thirst: 0.1, hunger: 0.6 })).toContain('he can eat now, at any hour');
    expect(stateText({ ...base, thirst: 0.1, hunger: 0.1 })).not.toContain('he can drink now');
  });
});

describe('the AI panel by plan (groupByPlan)', () => {
  const step = (id, state, extra = {}) => ({ id, label: id, to: null, toUsed: null, toIgnored: null, reason: 'because ' + id, note: '', at: null, state, ...extra });
  const plan = (id, real, steps, extra = {}) => ({ id, real, day: 3, time: '07:31', trigger: 'no plan yet', reason: 'a calm morning', late: false, i: 0, steps, ...extra });
  const E = (n, real, o) => ({ n, real, day: 3, time: '08:00', point: 'pastime', menu: [], options: [{ id: 'linger', what: 'stand about at home' }, { id: 'stroll', what: 'stroll' }, { id: 'onward', what: 'go on with the day' }], rules: 'linger', ai: null, used: 'rules', why: null, override: null, plan: null, planId: null, step: null, ...o });
  const planNote = (n, real, planId) => ({ n, real, note: 'New plan', planNote: true, planId });

  it('a plan with a short way on: the step is one block, the bridging decisions fold into one "via" line', () => {
    const p = plan(1, 100, [step('stroll', 'done', { toUsed: 'river', at: { day: 3, time: '08:10' } }), step('fish', 'later')]);
    const entries = [
      E(5, 130, { used: 'ai', ai: 'stroll', plan: { i: 1, n: 2, via: false }, planId: 1, step: 0, to: 'river' }),
      E(4, 120, { used: 'ai', ai: 'onward', plan: { i: 1, n: 2, via: true }, planId: 1, step: 0 }),
      E(3, 110, { used: 'ai', ai: 'linger', plan: { i: 1, n: 2, via: true }, planId: 1, step: 0 }),
      planNote(2, 100, 1),
    ];
    const items = groupByPlan(entries, [p]);
    expect(items.length).toBe(1);
    const it = items[0]; expect(it.kind).toBe('plan'); expect(it.head).toContain('New plan, Day 3, 07:31'); expect(it.head).toContain('no plan yet'); expect(it.reason).toBe('"a calm morning"');
    expect(it.steps.map(s => s.label)).toEqual(['stroll', 'fish']);   // in plan order
    expect(it.steps[0].to).toBe('river'); expect(it.steps[0].stateText).toBe('done'); expect(it.steps[0].reason).toBe('"because stroll"');
    expect(it.steps[0].via).toEqual(['stand about at home', 'go on with the day']); expect(it.steps[0].n).toBe(5);
    expect(it.steps[1].stateText).toBe('not reached'); expect(it.steps[0].stateText).toBe('done'); expect(it.steps[1].via).toEqual([]);
    expect(it.n).toBe(2);
  });
  it('a skipped step shows its plain reason; an overruled step is tagged with the reason and what the rules did', () => {
    const p = plan(1, 100, [step('fish', 'skipped', { note: 'not possible (he has no spear)' }), step('drink', 'next')]);
    const items = groupByPlan([E(7, 140, { override: 'thirst has reached 1.25 days', why: 'critical', planId: 1, step: 1, rules: 'linger' }), planNote(2, 100, 1)], [p]);
    const s = items[0].steps;
    expect(s[0].stateText).toBe('skipped'); expect(s[0].note).toContain('he has no spear'); expect(s[0].tag).toBe('');
    expect(s[1].tag).toBe('overruled'); expect(s[1].overrides[0].text).toContain('thirst has reached 1.25 days'); expect(s[1].overrides[0].text).toContain('The rules chose: stand about at home');
    expect(items.length).toBe(1);   // the overruling stays in the step's block
  });
  it('rules decisions with no plan, or while the AI could not answer, are grey blocks in time order between the plans', () => {
    const p1 = plan(1, 100, [step('stroll', 'done')]), p2 = plan(2, 300, [step('linger', 'next')]);
    const entries = [
      E(20, 310, { used: 'ai', ai: 'linger', plan: { i: 1, n: 1, via: false }, planId: 2, step: 0 }), planNote(19, 300, 2),
      E(18, 250, { why: 'no answer', planId: 1, step: 0 }),
      E(17, 200, { why: 'budget' }),
      E(16, 120, { used: 'ai', ai: 'stroll', plan: { i: 1, n: 1, via: false }, planId: 1, step: 0 }), planNote(15, 100, 1),
      E(14, 50, { why: 'busy' }),
      { n: 13, real: 40, note: 'The request failed: boom' },
    ];
    const items = groupByPlan(entries, [p2, p1]);
    expect(items.map(i => i.kind)).toEqual(['plan', 'rules', 'rules', 'plan', 'rules', 'note']);   // newest first
    expect(items[1].why).toBe('Why not the AI: no answer in 10 s'); expect(items[2].why).toBe('Why not the AI: the budget is spent');
    expect(items[4].why).toContain('still running'); expect(items[5].text).toContain('boom');
  });
  it('the plan lines show the destination', () => {
    const l = planLines({ steps: [{ label: 'stroll', toUsed: 'river', reason: 'water', state: 'running' }, { label: 'explore', to: 'coast', reason: '', state: 'next' }] });
    expect(l[0].text).toBe('1. stroll (river) — water'); expect(l[0].marker).toBe('▶'); expect(l[1].text).toBe('2. explore (coast) (next)');
  });
  it('the chooser logs the plan and step on every entry and keeps the plans', async () => {
    const game = { clock: { day: 3, time: 0.4, total: 3.4 } }, mind = { recent: [], blockers: () => ({}), menu: () => ({ options: [] }), destinations: () => ({ stroll: [], explore: [] }) };
    const ai = createAiChooser({ rulesChooser, ask: async () => ({ text: JSON.stringify({ plan: [{ step: 'stroll', reason: 'a' }, { step: 'linger', reason: 'b' }, { step: 'stroll', reason: 'c' }], reason: 'r' }), ms: 5 }), now: () => 100, clock: () => game.clock });
    ai.attach(mind, game);
    const m = { point: 'pastime', options: ['stroll', 'linger'].map(id => ({ id, goal: 'idle', what: id, why: '', forced: false, rule: { ok: () => true } })) };
    const ctx = { rand: () => 0.5, ex: () => 0.5, fish: () => 0.5 };
    ai.chooser('pastime', m, ctx); await new Promise(r => setTimeout(r, 20)); ai.chooser('pastime', m, ctx);
    const e = ai.entries.find(x => x.used === 'ai');
    expect(e.planId).toBe(1); expect(e.step).toBe(0); expect(ai.plans().length).toBe(1); expect(ai.plans()[0].id).toBe(1);
    expect(ai.entries.find(x => x.planNote).planId).toBe(1);
  });
});

describe('blockers agree with the menu, for every chooser (0.36.5, 0.36.6)', () => {
  // over a simulated life: every time a pastime is within its hours but not valid on the menu, blockers() says why (no generic fallback). One menu: this holds for the rules chooser and for a chooser that takes the first possible option.
  const rules = (point, menu, ctx) => rulesChooser(point, menu, ctx);
  const first = (point, menu, ctx) => (point === 'pastime' && menu.options.find(o => isValid(o) && o.id !== 'ember') ? firstChooser(point, menu) : rulesChooser(point, menu, ctx));
  const life = (opts, secs, choose) => {
    const g = campGame(w, spawn, { stocked: true, ...opts }); let m, checked = 0; const missing = [];
    const f = (point, menu, ctx) => {
      if (point === 'pastime' && m) {
        const b = m.blockers(), t = g.clock.time;
        for (const o of menu.options) if (PLAN_PASTIMES.includes(o.id) && hoursOpen(o.id, t) && !isValid(o)) { checked++; if (!b[o.id]) missing.push(`${o.id}@${t.toFixed(2)} day ${g.clock.day}`); }
      }
      return choose(point, menu, ctx);
    };
    m = createMind(w, g, { chooser: f }); m.engage(); tickMind(g, m, secs);
    return { missing, checked, m };
  };
  const check = (day, choose) => { const r = life({ day, time: 0.25 }, 3500, choose); expect(r.checked, 'some pastime was in hours and not valid').toBeGreaterThan(0); expect(r.missing).toEqual([]); expect(r.m.stats.errors || 0).toBe(0); };
  it('day 1, the rules chooser', () => check(1, rules));
  it('day 2, the rules chooser', () => check(2, rules));
  it('day 1, a chooser taking the first possible option', () => check(1, first));
  it('day 2, a chooser taking the first possible option', () => check(2, first));
  it('the reasons are plain: a day not yet reached, a failed try that is cooling; the same for both', () => {
    for (const mk of [g => createMind(w, g), g => createMind(w, g, { chooser: rules })]) {
      const g = campGame(w, spawn, { day: 1, time: 0.3, stocked: true }), m = mk(g); m.engage();
      expect(m.blockers().home).toContain('begins on day 2');
      const g2 = campGame(w, spawn, { day: 3, time: 0.3, stocked: true }), m2 = mk(g2); m2.engage();
      expect(m2.blockers().explore === undefined || typeof m2.blockers().explore === 'string').toBe(true);
    }
  });
});

describe('the crab trip is a habit of the rules, not a condition of the menu (0.36.6)', () => {
  const run = () => {
    const g = campGame(w, spawn, { day: 2, time: 0.25, stocked: true }); let m; const rows = [];
    const f = (point, menu, ctx) => { if (point === 'pastime' && m) { const o = menu.options.find(x => x.id === 'home'); if (o) rows.push({ t: g.clock.time, ok: isValid(o), habit: o.rule.habit ? o.rule.habit() : true, why: m.blockers().home || '' }); } return rulesChooser(point, menu, ctx); };
    m = createMind(w, g, { chooser: f }); m.engage(); tickMind(g, m, 2500);
    return rows;
  };
  it('home is on the menu in the crab window and never blocked by the crabs; the rules pass it over at low water (habit), the blockers never mention a crab', () => {
    const rows = run();
    expect(rows.some(r => r.t >= 0.4 && r.t < 0.56 && r.ok), 'home valid in the crab window').toBe(true);
    expect(rows.some(r => r.ok && !r.habit && r.t >= 0.38 && r.t < 0.56), 'the rules: home passed over for the crab trip').toBe(true);
    expect(rows.some(r => /crab/.test(r.why))).toBe(false);
  });
});

describe('the by-plan view says busy while a step runs (0.36.5 point 10)', () => {
  it('running reads "busy", done "done", next "next up", later "not reached"', () => {
    const mkp = states => ({ id: 1, real: 1, day: 3, time: '07:00', trigger: 't', reason: 'r', late: false, i: 0, steps: states.map((st, k) => ({ id: 'x' + k, label: 'x' + k, to: null, toUsed: null, toIgnored: null, reason: '', note: '', at: null, state: st })) });
    const it = groupByPlan([], [mkp(['done', 'running', 'next', 'later', 'skipped'])])[0];
    expect(it.steps.map(s => s.stateText)).toEqual(['done', 'busy', 'next up', 'not reached', 'skipped']);
  });
});

describe('a night with a plan that has the sunset next (0.36.5 point 11)', () => {
  const opt = id => ({ id, goal: id === 'idle' ? 'idle' : id, what: id, why: '', forced: false });
  const goalMenu = ids => ({ point: 'goal', options: ids.map(opt) });
  const ctx = { rand: () => 0.5, ex: () => 0.5, fish: () => 0.5 };
  const setup = (plan, blockers = {}) => {
    const game = { clock: { day: 5, time: 0.76, total: 5.76 }, sleep: { wakes: 0 } }, asks = [], t = { s: 1000 };
    const mind = { recent: [], blockers: () => blockers, menu: () => ({ options: [] }), destinations: () => ({ stroll: [], explore: [] }) };
    const ai = createAiChooser({ rulesChooser, ask: async m => { asks.push(m); return { text: JSON.stringify({ plan: plan.map(step => ({ step, reason: 'because ' + step })), reason: 'r' }), ms: 5 }; }, now: () => t.s, clock: () => game.clock, mode: () => 'loose', replanGap: 20 });
    ai.attach(mind, game);
    return { ai, game, asks, t };
  };
  const flush = () => new Promise(r => setTimeout(r, 20));
  const first = async s => { const m = () => goalMenu(['fire', 'idle']); expect(s.ai.chooser('goal', m(), ctx)).toBeTruthy(); await flush(); s.t.s += 0.6; s.ai.chooser('goal', m(), ctx); };   // (fire is on the menu: the first step, taken)
  it('never bridges through free time to the sunset when its hours are closed: a new plan is asked, telling why', async () => {
    const s = setup(['fire', 'gaze', 'linger']); await first(s);   // 18:14: fire step taken, then gaze is next
    s.game.clock.day = 6; s.game.clock.time = 0.14; s.game.clock.total = 6.14; s.t.s += 30;   // 03:21
    const c = s.ai.chooser('goal', goalMenu(['drink', 'idle']), ctx);
    expect(c).not.toBe('idle'); expect(s.asks.length).toBe(2);
    expect(s.asks[1][1].content).toContain('the next step, watch the sunset, was not possible now (outside its hours: 18:14 to 19:55, once a day)');
  });
  it('within the gap the step is skipped with the reason, not bridged to', async () => {
    const s = setup(['fire', 'gaze', 'drink']); await first(s);
    s.game.clock.day = 6; s.game.clock.time = 0.14; s.game.clock.total = 6.14; s.t.s += 2;   // a plan was asked 2.6 s ago
    const c = s.ai.chooser('goal', goalMenu(['drink', 'idle']), ctx);
    expect(c).toBe('drink');   // gaze skipped, drink is the next step
    const g = s.ai.plan().steps[1]; expect(g.state).toBe('skipped'); expect(g.note).toContain('outside its hours');
  });
  it('a step the mind has a reason against is not bridged to either (already done today)', async () => {
    const s = setup(['fire', 'stroll', 'drink'], { stroll: 'already done today' }); await first(s);
    s.t.s += 2; const c = s.ai.chooser('goal', goalMenu(['drink', 'idle']), ctx);
    expect(c).toBe('drink'); expect(s.ai.plan().steps[1].note).toContain('already done today');
  });
  it('waking up asks a new plan with the trigger "he woke up", once', async () => {
    const s = setup(['fire', 'linger', 'stroll']); await first(s);
    s.t.s += 30; s.game.sleep.wakes = 1;
    expect(s.ai.chooser('goal', goalMenu(['drink', 'idle']), ctx)).toBeTruthy(); expect(s.asks.length).toBe(2);
    expect(s.asks[1][1].content).toContain('Why you are asked for a new plan: he woke up.');
    await flush(); s.t.s += 0.6; s.ai.chooser('goal', goalMenu(['drink', 'idle']), ctx);
    s.t.s += 30; s.ai.chooser('goal', goalMenu(['drink', 'idle']), ctx);
    expect(s.asks.length).toBe(2);   // no second request for the same waking
  });
});
