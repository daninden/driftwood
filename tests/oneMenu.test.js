// 0.36.6 "One menu": what is possible is one set of real conditions for every chooser; the rules' habits (hour windows, the crab trip first, a trip home by EXPLORE_BACK) are the rules chooser's preference.
// Covers: habitOk (pure), the habit and back of an option in game/intent's rulesChooser, the same menu for two choosers, and a rules life that keeps its habits.
// Depends on: game/mind, game/intent, tests/helpers/mindCamp.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createMind, habitOk, HABIT_HOURS, HABIT_CRAB_FIRST, HOME_FROM, HOME_TO, AXE_TO, EXPLORE_FROM, EXPLORE_TO, EXPLORE_EARLY, EXPLORE_BACK, TIDE_ROUND_FROM, TIDE_ROUND_TO, FISH_FROM, FISH_TO, DAY_FROM, EVENING } from '../src/game/mind.js';
import { pastimeMenu, rulesChooser, firstChooser, isValid, choiceId } from '../src/game/intent.js';
import { campGame } from './helpers/mindCamp.js';

let w, spawn;
beforeAll(async () => { w = await generateWorld(1337); spawn = startSpot(w); }, 120000);

describe('habitOk (pure): the rules\' windows and the crab trip first', () => {
  it('each pastime has the window it always had', () => {
    expect(HABIT_HOURS.home).toEqual([HOME_FROM, HOME_TO]); expect(HABIT_HOURS.axe).toEqual([HOME_FROM, AXE_TO]); expect(HABIT_HOURS.tide).toEqual([TIDE_ROUND_FROM, TIDE_ROUND_TO]);
    expect(HABIT_HOURS.fish).toEqual([FISH_FROM, FISH_TO]); expect(HABIT_HOURS.spear).toEqual([DAY_FROM, EVENING]); expect(HABIT_HOURS.strays).toEqual([DAY_FROM, EVENING]); expect(HABIT_HOURS.explore).toEqual([EXPLORE_FROM, EXPLORE_TO]);
    for (const id of Object.keys(HABIT_HOURS)) { const [a, b] = HABIT_HOURS[id]; const f = id === 'explore' ? EXPLORE_FROM : a; expect(habitOk(id, { time: f }), id).toBe(true); expect(habitOk(id, { time: a - 0.01 }), id).toBe(false); expect(habitOk(id, { time: b }), id).toBe(false); expect(habitOk(id, { time: b - 0.01 }), id).toBe(true); }
  });
  it('the tide round is not taken after noon-ish (TIDE_ROUND_TO), exploring starts early only when calm, the crab trip holds back home, axe, tide, explore and fish but not the spear or the strays', () => {
    expect(habitOk('tide', { time: 0.55 })).toBe(false); expect(habitOk('tide', { time: 0.4 })).toBe(true);
    expect(habitOk('explore', { time: 0.19 })).toBe(false); expect(habitOk('explore', { time: 0.19, calm: true })).toBe(true); expect(habitOk('explore', { time: EXPLORE_EARLY - 0.001, calm: true })).toBe(false);
    expect(HABIT_CRAB_FIRST).toEqual(['home', 'axe', 'tide', 'explore', 'fish']);
    for (const id of HABIT_CRAB_FIRST) expect(habitOk(id, { time: id === 'fish' ? 0.45 : 0.3, crab: true }), id).toBe(false);
    expect(habitOk('spear', { time: 0.3, crab: true })).toBe(true); expect(habitOk('strays', { time: 0.3, crab: true })).toBe(true);
    expect(habitOk('stroll', { time: 0.99, crab: true })).toBe(true);   // no habit: always
    expect(EXPLORE_BACK).toBe(0.6);
  });
});

describe('the rules chooser applies the habit, the others do not see it (game/intent)', () => {
  const ctx = (drawn = []) => ({ rand: () => (drawn.push('rand'), 0.5), ex: () => (drawn.push('ex'), 0.0), fish: () => (drawn.push('fish'), 0.0) });
  it('an option on the menu that the rules\' habit refuses is passed over with no draw; the next one is taken', () => {
    const drawn = [];
    const m = pastimeMenu('day', { tide: { ok: true, habit: false }, explore: { ok: true, chance: () => 1, habit: false }, fish: { ok: true, chance: () => 1, habit: true, back: 0.6 } });
    expect(rulesChooser('pastime', m, ctx(drawn))).toEqual({ id: 'fish', back: 0.6 }); expect(drawn).toEqual(['fish']);   // (no draw for the explore the habit refused; the trip carries its return time)
    expect(isValid(m.options.find(o => o.id === 'tide'))).toBe(true); expect(isValid(m.options.find(o => o.id === 'explore'))).toBe(true);   // both are on the menu and possible
    expect(firstChooser('pastime', m)).toBe('tide');   // a chooser that does not know the habit takes the first possible option
  });
  it('a habit given as a function is lazy and read only by the rules; a plain option carries no back', () => {
    let n = 0;
    const m = pastimeMenu('day', { home: { ok: true, habit: () => (n++, true) } });
    expect(n).toBe(0); expect(isValid(m.options[0])).toBe(true); expect(firstChooser('pastime', m)).toBe('home'); expect(n).toBe(0);
    expect(rulesChooser('pastime', m, ctx())).toBe('home'); expect(n).toBe(1);
  });
});

describe('one menu for every chooser (a mind)', () => {
  // the first pastime menu of the day stage that each chooser is asked, at the same start: the same options with the same validity
  const firstDayMenu = (choose, o) => {
    const g = campGame(w, spawn, { stocked: true, ...o }); let seen = null;
    const m = createMind(w, g, { chooser: (p, me, c) => { if (p === 'pastime' && !seen && me.options.some(x => x.id === 'linger')) seen = me.options.map(x => [x.id, isValid(x)]); return choose(p, me, c); } });
    m.engage(); for (let i = 0; i < 3000 && !seen; i++) { m.step(0.1); g.update(m.input, 0.1); }
    return seen;
  };
  it('at 16:48 on day 4 the day menu is the same for the rules and for a chooser that takes the first possible option, and offers home, tide and the like (the rules\' windows are past)', () => {
    const a = firstDayMenu(rulesChooser, { day: 4, time: 0.7 }), b = firstDayMenu((p, me) => firstChooser(p, me), { day: 4, time: 0.7 });
    expect(a).not.toBeNull(); expect(a).toEqual(b);
  });
  it('mid-morning: the same, and a pastime outside the rules\' window (tide after TIDE_ROUND_TO) is valid on the menu', () => {
    const a = firstDayMenu(rulesChooser, { day: 4, time: 0.6 }), b = firstDayMenu((p, me) => firstChooser(p, me), { day: 4, time: 0.6 });
    expect(a).toEqual(b);
    const valid = Object.fromEntries(a); expect(valid.stroll).toBe(true);
  });
});

describe('a rules life keeps its habits', () => {
  it('over a day and a half: every pastime the rules chose was inside its habit window, and every trip came back as a choice with the evening\'s return time', () => {
    const g = campGame(w, spawn, { day: 3, time: 0.2, stocked: true }); const picks = [];
    const m = createMind(w, g, { chooser: (p, me, c) => { const r = rulesChooser(p, me, c); if (p === 'pastime') picks.push({ id: choiceId(r), t: g.clock.time, c: r }); return r; } });
    m.engage(); for (let t = 0; t < 4000; t += 0.1) { m.step(0.1); g.update(m.input, 0.1); }
    expect(picks.length).toBeGreaterThan(5);
    for (const k of picks) {
      if (HABIT_HOURS[k.id]) expect(k.t >= (k.id === 'explore' ? EXPLORE_EARLY : HABIT_HOURS[k.id][0]) && k.t < HABIT_HOURS[k.id][1], `${k.id} at ${k.t}`).toBe(true);
      if (['tide', 'explore', 'fish'].includes(k.id)) expect(k.c.back, k.id).toBe(EXPLORE_BACK);
    }
    expect(m.stats.errors || 0).toBe(0);
  }, 120000);
});

// ---------- the situation of the plan request (0.36.6) ----------
import { stateText, snapshotOf, tideNow } from '../src/ai/prompt.js';
import { seaLevel } from '../src/game/tide.js';

describe('the situation tells the fire, the camp store, the tide, last night and the strip, only when known', () => {
  const base = { day: 3, time: 0.4, raining: false, daylight: 6, awake: 0.2, carries: {}, home: null, journey: false, doing: 'x', thirst: 0.1, hunger: 0.1 };
  it('every line is there when the state has it, in the intended words', () => {
    const t = stateText({ ...base, camp: { fire: 'low', store: { dry: 6, wet: 2, branches: 0, fronds: 0, stones: 0, logs: 0 } }, tide: { name: 'low', falling: false, turn: 0.59 }, lastNight: { hours: 3, cold: true, collapse: false }, strip: 4 });
    expect(t).toContain('Fire: burning low.'); expect(t).toContain('Camp store: 6 dry wood, 2 wet.');
    expect(t).toContain('Tide: low, rising, high water about 14:09 (low water is the crab time: a stroll to the crabs).'.replace('rising, high water', 'rising, high water'));
    expect(t).toContain('Last night: a cold sleep, no fire close by (3.0 hours).'); expect(t).toContain('Tide strip: some wet driftwood to rescue.');
    expect(stateText({ ...base, camp: { fire: 'none', store: {} } })).toContain('Fire: none yet.'); expect(stateText({ ...base, camp: { fire: 'none', store: {} } })).toContain('Camp store: nothing.');
    expect(stateText({ ...base, camp: { fire: 'out', store: {} } })).toContain('Fire: out (a burnt place).');
    expect(stateText({ ...base, lastNight: { hours: 8, cold: false, collapse: false } })).toContain('a full night');
    expect(stateText({ ...base, lastNight: { hours: 1, cold: false, collapse: true } })).toContain('a collapse');
    expect(stateText({ ...base, strip: 0 })).toContain('no wet driftwood known there');
  });
  it('a part the game does not know is left out, and the weather forecast is never told', () => {
    const t = stateText(base);
    for (const w of ['Fire:', 'Camp store:', 'Tide:', 'Last night:', 'Tide strip:', 'forecast', 'rain is expected']) expect(t, w).not.toContain(w);
  });
  it('tideNow follows game/tide: low water is the crab time, the next turn is high water when rising', () => {
    const low = 0.2 + 0.5 * 12.42 / 24;   // a low water
    const a = tideNow(low - 0.01); expect(a.name).toBe('low'); expect(a.falling).toBe(true); expect(a.turn).toBeCloseTo(low % 1, 4);
    const b = tideNow(low + 0.03); expect(b.falling).toBe(false); expect(b.turn).toBeCloseTo((0.2 + 12.42 / 24) % 1, 4);
    expect(tideNow(0.2).name).toBe('high'); expect(tideNow(0.2).level).toBeCloseTo(seaLevel(0.2), 6);
  });
  it('a mind tells its camp, the strip and the last night (read only)', () => {
    const g = campGame(w, spawn, { day: 3, time: 0.5, stocked: true }), m = createMind(w, g); m.engage();
    const c = m.camp(); expect(['none', 'out', 'embers', 'low', 'well']).toContain(c.fire); expect(c.store.dry + c.store.wet + c.store.branches).toBeGreaterThanOrEqual(0);
    expect(typeof m.stripWood()).toBe('number'); expect(m.lastNight()).toBeNull();
    const s = snapshotOf(g, m); expect(s.camp.fire).toBe(c.fire); expect(s.tide.name).toMatch(/high|half|low/); expect(s.strip).toBe(m.stripWood());
    expect(stateText(s)).toContain('Camp store:');
  });
  it('after a night the mind knows how it went', () => {
    const g = campGame(w, spawn, { day: 3, time: 0.8, stocked: true }), m = createMind(w, g); m.engage();
    for (let t = 0; t < 12000 && !m.lastNight(); t += 0.1) { m.step(0.1); g.update(m.input, 0.1); }
    const n = m.lastNight(); expect(n).not.toBeNull(); expect(n.hours).toBeGreaterThan(1); expect(typeof n.cold).toBe('boolean'); expect(typeof n.collapse).toBe('boolean');
  }, 120000);
});

// ---------- the compact AI panel (0.36.6) ----------
import { summaryLine, shortModel } from '../src/render/aiPanel.js';

describe('the one line of the collapsed AI panel (summaryLine, pure)', () => {
  const NOW = 1_000_000;
  const model = (o = {}) => ({ model: 'gemini-3.5-flash-lite', today: 6, perDay: 480, lastMinute: 0, perMin: 12, pausedUntil: 0, dead: false, lastError: null, ...o });
  const st = (o = {}) => ({ on: true, hasKey: true, inFlight: false, pausedUntil: 0, lastError: null, models: [model(), model({ model: 'gemini-3.1-flash-lite', today: 0, perDay: 500 })], ...o });
  it('normal: the leash, the first model free with its count, and the pending state; no problem', () => {
    expect(summaryLine(st(), { mode: 'loose' }, NOW)).toEqual({ text: 'AI on · loose · 3.5-flash-lite 6/480 · not asking', problem: '' });
    expect(summaryLine(st({ inFlight: true }), { mode: 'loose', inFlight: true }, NOW).text).toContain('asking…');
    expect(shortModel('gemini-3.1-flash-lite')).toBe('3.1-flash-lite'); expect(shortModel('gemma-4-31b-it')).toBe('gemma-4-31b-it');
  });
  it('the AI off is one short line with no problem', () => { expect(summaryLine(st({ on: false }), { mode: 'loose' }, NOW)).toEqual({ text: 'AI off', problem: '' }); });
  it('an error, a paused model, a dead model, all budgets spent, no key and Dave waiting are all shown as a problem', () => {
    expect(summaryLine(st({ lastError: 'HTTP 429 quota' }), { mode: 'loose' }, NOW).problem).toContain('error: HTTP 429 quota');
    const paused = summaryLine(st({ models: [model({ pausedUntil: NOW + 600000 }), model({ model: 'gemini-3.1-flash-lite', today: 1, perDay: 500 })] }), { mode: 'loose' }, NOW);
    expect(paused.problem).toContain('3.5-flash-lite paused until'); expect(paused.text).toContain('3.1-flash-lite 1/500');   // the first model that is free now
    expect(summaryLine(st({ models: [model({ dead: true }), model({ model: 'b', today: 0, perDay: 5 })] }), {}, NOW).problem).toContain('3.5-flash-lite not available');
    expect(summaryLine(st({ models: [model({ today: 480 }), model({ model: 'b', today: 5, perDay: 5 })] }), {}, NOW).problem).toBe('all budgets spent');
    expect(summaryLine(st({ models: [model({ pausedUntil: NOW + 5 }), model({ model: 'b', pausedUntil: NOW + 5 })] }), {}, NOW).problem).toBe('all models paused');
    expect(summaryLine(st({ hasKey: false }), {}, NOW).problem).toContain('no key');
    const w = summaryLine(st(), { mode: 'free', waiting: true }, NOW); expect(w.text).toContain('Dave is waiting'); expect(w.problem).toContain('waiting for an answer');
  });
});
