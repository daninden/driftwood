// 0.36.9 "Voice", the second round (from a downloaded log): an honest fire outcome, the tide round never declined silently, one limit for the pastimes and for drink and eat, a plan on waking in the night,
// plain numbers and days in the request, the drill and tiredness in the text.
// Depends on: game/mind, game/intent, ai/chooser, ai/prompt, tests/helpers/mindCamp.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createMind, exploreChance, spearMakeOk, fishChance, journeyOk, axeNext, habitOk, HABIT_CALM, CALM_THIRST, CALM_HUNGER, THIRST_GO, HUNGER_GO, EXPLORE_THIRST, EXPLORE_HUNGER, FISH_THIRST, FISH_HUNGER, AXE_THIRST, AXE_HUNGER } from '../src/game/mind.js';
import { FIRE_MIN } from '../src/game/fire.js';
import { pastimeMenu, rulesChooser, firstChooser, goalMenu } from '../src/game/intent.js';
import { createAiChooser } from '../src/ai/chooser.js';
import { FIXED, noNumber, notesText, parsePlan, stateText, buildJournalMessages, JOURNAL_SYSTEM } from '../src/ai/prompt.js';
import { campGame } from './helpers/mindCamp.js';

describe('point 3: no band between the pastimes and drink or eat', () => {
  it('the menu\'s limits are where drink and eat open; the rules\' own lower limits are their habit', () => {
    expect(CALM_THIRST).toBe(THIRST_GO); expect(CALM_HUNGER).toBe(HUNGER_GO);
    const base = { time: 0.3, day: 5, last: 0, missing: 1, cool: {} };
    expect(exploreChance({ ...base, thirst: 0.1, hunger: 0.35 })).toBeGreaterThan(0);   // 0.35 hunger: the menu still allows it (the rules' limit is 0.3)
    expect(exploreChance({ ...base, thirst: 0.1, hunger: HUNGER_GO })).toBe(0); expect(exploreChance({ ...base, thirst: THIRST_GO, hunger: 0.1 })).toBe(0);
    expect(spearMakeOk({ time: 0.3, day: 9, lean: 'done', spear: false, thirst: 0.3, hunger: 0.35, cool: {} })).toBe(true); expect(spearMakeOk({ time: 0.3, day: 9, lean: 'done', spear: false, thirst: 0.1, hunger: HUNGER_GO, cool: {} })).toBe(false);
    expect(fishChance({ time: 0.45, day: 5, last: 0, spear: true, thirst: 0.32, hunger: 0.1, cool: {} })).toBeGreaterThan(0);
    expect(axeNext({ done: true, time: 0.3, day: 9, builtDay: 0, axeDay: 0, thirst: 0.3, hunger: 0.35, cool: {} })).toBe(true);
    expect(journeyOk({ day: 20, time: 0.3, due: 5, lean: 'done', raining: false, rainSoon: false, thirst: 0.3, hunger: 0.35, cool: {} })).toBe(true);
  });
  it('habitOk keeps the rules\' old limits: from them on the rules pass the pastime over, with no draw', () => {
    for (const [id, [t, h]] of Object.entries(HABIT_CALM)) { expect(habitOk(id, { time: 0.3, thirst: t - 0.01, hunger: 0 }), id).toBe(id === 'fish' ? false : habitOk(id, { time: 0.3 })); expect(habitOk(id, { time: 0.3, thirst: t, hunger: 0 }), id).toBe(false); expect(habitOk(id, { time: 0.3, thirst: 0, hunger: h }), id).toBe(false); }
    expect(HABIT_CALM.explore).toEqual([EXPLORE_THIRST, EXPLORE_HUNGER]); expect(HABIT_CALM.fish).toEqual([FISH_THIRST, FISH_HUNGER]); expect(HABIT_CALM.axe).toEqual([AXE_THIRST, AXE_HUNGER]);
    const drawn = [], ctx = { rand: () => (drawn.push('r'), 0.5), ex: () => (drawn.push('ex'), 0), fish: () => (drawn.push('f'), 0) };
    const m = pastimeMenu('day', { explore: { ok: true, chance: () => 1, habit: () => habitOk('explore', { time: 0.3, thirst: 0.1, hunger: 0.35 }) }, stroll: { ok: false, chance: () => 0, kind: () => null } });
    expect(rulesChooser('pastime', m, ctx)).not.toBe('explore'); expect(drawn).not.toContain('ex'); expect(firstChooser('pastime', m)).toBe('explore');
  });
  it('the request says the one limit', () => { expect(FIXED).toContain(`thirst under ${CALM_THIRST} days, hunger under ${CALM_HUNGER}`); });
});

describe('point 1: the fire goal is done only with a real fire (label only)', () => {
  let w, spawn;
  beforeAll(async () => { w = await generateWorld(1337); spawn = startSpot(w); }, 120000);
  const pile = (n, extra = {}) => ({ extra: { ...extra }, piles: [{ id: 5, kind: 'driftwood', n, x: spawn.x + 0.3, z: spawn.z }] });
  const mind = (time, n, o = {}) => { const { piles } = pile(n); const g = campGame(w, spawn, { day: 3, time, stocked: o.stocked ?? true, piles: o.stocked === false ? piles : [] }); return { g, m: createMind(w, g) }; };
  it('too few pieces, no fire, an unlit fire after the hour and a lit fire', () => {
    const a = mind(0.5, 3, { stocked: false }); a.m.engage(); expect(a.m.fireShort()).toBe(`only 3 of ${FIRE_MIN} pieces laid, no fire`);
    const b = mind(0.5, 12); b.m.engage(); expect(b.m.fireShort()).toBeNull();   // enough laid, not the hour to light it
    const c = mind(0.8, 12); c.m.engage(); expect(c.m.fireShort()).toBe('the fire is not burning: the drill did not catch');   // fibre in his pack
    const d = mind(0.8, 12); d.g.fibre.carried = 0; d.m.engage(); expect(d.m.fireShort()).toBe('the fire is not burning: no fibre or torch to light it');
    const fire = { fires: [{ id: 0, x: spawn.x, z: spawn.z, fuel: 0.3, embers: 0.5, emberAge: 0, lit: 0, fed: 3 }], burnt: [], attempts: 0, nextId: 1 };
    const e = campGame(w, spawn, { day: 3, time: 0.8, stocked: true, extra: { fire } }), me = createMind(w, e); me.engage(); expect(me.fireShort()).toBeNull();
  });
});

describe('point 2: the AI\'s tide round has no dice, and a round that cannot run says why', () => {
  let w, spawn;
  beforeAll(async () => { w = await generateWorld(1337); spawn = startSpot(w); }, 120000);
  it('a chooser that takes the tide round with ai: true gets a reason and the day is not used up', () => {
    const g = campGame(w, spawn, { day: 4, time: 0.3, stocked: true });
    const takeTide = (point, menu) => { if (point !== 'pastime') return 'idle' === menu.options[0].id ? 'idle' : menu.options[0].id; const o = menu.options.find(x => x.id === 'tide' && (!x.rule || !x.rule.ok || x.rule.ok())); return o ? { id: 'tide', ai: true } : firstChooser(point, menu); };
    const m = createMind(w, g, { chooser: takeTide }); m.engage();
    let reason = null;
    for (let t = 0; t < 900 && !reason; t += 0.1) { m.step(0.1); g.update(m.input, 0.1); const b = m.blockers(); if (b.tide && b.tide !== 'already done today') reason = b.tide; }
    expect(reason).toBe('no wet driftwood known on the strip within reach');   // no dice, no silent decline: the reason, and the day is not used up
    expect(m.blockers().tide).not.toBe('already done today');
  }, 120000);
});

describe('point 4: waking at night gets a plan request even when the only decision has one option', () => {
  const rigged = v => () => v;
  it('a decision with one option is the rules\' at once, but a wanted plan is asked for without waiting', async () => {
    const asks = [], t = { s: 1000 }, clock = { day: 5, time: 0.13, total: 4.13 }, game = { clock: { day: 4, time: 0.13, total: 4.13 }, sleep: { wakes: 0, awake: 0.1 }, thirst: { days: 0.1 }, hunger: { days: 0.1 } };
    const reply = async () => ({ text: JSON.stringify({ plan: [{ step: 'drink', reason: 'a' }, { step: 'fire', reason: 'b' }, { step: 'gaze', reason: 'c' }], reason: 'x' }), ms: 5, model: 'm' });
    const ai = createAiChooser({ rulesChooser, ask: m => { asks.push(m); return reply(); }, now: () => t.s, canSend: () => true, enabled: () => true, clock: () => clock, mode: () => 'loose', replanGap: 20 });
    ai.attach({ recent: [{ t: 3.9, day: 3, kind: 'goal', what: 'stores', outcome: 'done' }], goal: 'idle', menu: () => ({ options: [] }) }, game);
    const two = () => goalMenu({ asleep: false, time: 0.5, thirst: 0.1, hunger: 0.1, awake: 0.3, canLie: false, water: true, nuts: 0, fibre: 2, fireLit: false, fireFuel: 0, stock: 99, spare: 0, canLight: false, cool: {} }, (s) => (s.cool.stores ? 'idle' : 'stores'));
    const one = () => goalMenu({ asleep: false, time: 0.13, thirst: 0.1, hunger: 0.1, awake: 0.1, canLie: false, water: true, nuts: 2, fibre: 2, fireLit: false, fireFuel: 0, stock: 0, spare: 0, canLight: false, cool: {} }, () => 'idle');
    const ctx = { rand: rigged(0.5), ex: rigged(0.5), fish: rigged(0.5) }, go = m => ai.chooser('goal', m, ctx);
    expect(go(two())).toBe(go(two()) === 'idle' ? 'idle' : go(two()));   // (a plan is wanted: asked with a wait)
    for (let i = 0; i < 8; i++) await Promise.resolve(); t.s += 0.6; go(two()); t.s += 100;   // a plan is installed
    const n0 = asks.length; expect(ai.plan()).not.toBeNull();
    game.sleep.wakes = 1;   // he woke in the night
    expect(go(one())).toBe('idle'); expect(asks.length).toBe(n0 + 1);   // the rules' answer at once, and a plan was asked for
    expect(asks[n0][1].content).toContain('Why you are asked for a new plan: he woke up.');
    expect(asks[n0][1].content).toContain('Day 5,');   // the player's day (the game's own clock says 4)
    expect(asks[n0][1].content).toContain('day 4 ');   // the short-term list uses the same days (the entry was on game day 3)
    expect(go(one())).toBe('idle'); expect(asks.length).toBe(n0 + 1);   // not asked again while that request runs or inside the gap
  });
});

describe('point 5: plain numbers, a journal that does not repeat, an honest last night', () => {
  it('a number kept in a note is dropped, in the answer and in the request', () => {
    expect(noNumber('1. Landed at the cove')).toBe('Landed at the cove'); expect(noNumber('2) 3. x')).toBe('x'); expect(noNumber('Day 4 was long')).toBe('Day 4 was long'); expect(noNumber('12 coconuts left')).toBe('12 coconuts left');
    expect(notesText(['1. Landed', 'Water at the river'])).toBe('1. Landed\n2. Water at the river');
    expect(parsePlan(JSON.stringify({ plan: [{ step: 'drink' }], notes: ['1. Landed', '2. Spear'] })).notes).toEqual(['Landed', 'Spear']);
  });
  it('the journal request says not to repeat and gives the earlier lines', () => {
    expect(JOURNAL_SYSTEM).toContain('Do not repeat or paraphrase an earlier line');
    const m = buildJournalMessages({ state: { day: 3, time: 0.9, daylight: 0, carries: {}, home: null }, recent: [], journal: [{ day: 2, line: 'Landed on the cove.' }], notes: [] });
    expect(m[1].content).toContain('day 2: Landed on the cove.'); expect(m[1].content).toContain('not a repeat of an earlier line');
  });
  it('last night: all of it counted, "cut short" only when he is really not rested', () => {
    const t = n => stateText({ day: 3, time: 0.3, daylight: 5, carries: {}, home: null, lastNight: n });
    expect(t({ hours: 6.3, cold: false, collapse: false, rest: 0.95 })).toContain('a full night (6.3 hours, rested 95 %)');
    expect(t({ hours: 4, cold: false, collapse: false, rest: 0.5 })).toContain('cut short (4.0 hours, rested only 50 %)');
    expect(t({ hours: 8, cold: false, collapse: false })).toContain('a full night (8.0 hours)');
    expect(t({ hours: 3, cold: true, collapse: false, rest: 0.4 })).toContain('a cold sleep');
  });
  it('the system text says a tired drill rarely catches and costs rest', () => { expect(FIXED).toContain('a tired castaway rarely makes it catch'); expect(FIXED).toContain('well before he is tired'); expect(FIXED).toContain("hours' worth of rest each try"); });
});
