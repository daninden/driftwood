// 0.36.9 "Voice": longer AI thoughts on two lines, nearly no fixed phrases with the AI on, the castaway's name in the request, the fire in hours, feeding at any hour for the AI and fewer rests.
// Covers: SAID_MAX / cutAtWord / showTime / the two-line wrap (render/voice, index.html), ai/said (intentVoice), the name in FIXED / the journal / the request (ai/prompt), game/fire fireOutlook, the fire lines and the system text,
//   the fire goal on the menu at any hour but the rules' habit only in the evening (game/mind, game/intent), the chooser passing the name and giving no linger bridge.
// Depends on: render/voice, ai/said, ai/prompt, ai/chooser, ai/config, game/fire, game/mind, game/intent, tests/helpers/mindCamp.
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { SAID_MAX, cleanSaid, cutAtWord, showTime, isFixedLine, SHOW_FIXED, SHOW_OWN, SHOW_READ, PHRASES, createVoice } from '../src/render/voice.js';
import { intentVoice, isEmergency, LACK_TEXT } from '../src/ai/said.js';
import { SAID_LEN } from '../src/ai/config.js';
import { FIXED, fixedText, whoName, journalSystem, JOURNAL_SYSTEM, buildPlanMessages, buildMessages, buildJournalMessages, stateText, hoursTo } from '../src/ai/prompt.js';
import { createAiChooser } from '../src/ai/chooser.js';
import { fireOutlook, BURN, BRANCH_BURN, FUEL_MAX, RING_BURN } from '../src/game/fire.js';
import { createMind, fireStepAny, fireStepMenu, chooseGoal, chooseGoalMenu, FEED_ANY, FEED_BELOW, DAWN, VERY_HUNGER_AT } from '../src/game/mind.js';
import { goalMenu, pastimeMenu, rulesChooser, firstChooser } from '../src/game/intent.js';
import { VERY_AT } from '../src/game/thirst.js';
import { campGame } from './helpers/mindCamp.js';

afterEach(() => vi.unstubAllGlobals());

describe('point 1: a longer thought on at most two lines, shown longer', () => {
  it('SAID_MAX is 140, the same number as the request asks for; a longer text is cut at a word boundary with an ellipsis, never back to the fixed phrase', () => {
    expect(SAID_MAX).toBe(140); expect(SAID_LEN).toBe(SAID_MAX);
    const words = 'The fire is nearly out and the night is long so I will bring in a few branches before the dark comes down over the shore again tonight and the stars come out one by one'.split(' ');
    const long = words.join(' '); expect(long.length).toBeGreaterThan(SAID_MAX);
    const c = cleanSaid(long); expect(c.length).toBeLessThanOrEqual(SAID_MAX); expect(c.endsWith('…')).toBe(true); expect(long.startsWith(c.slice(0, -1).trimEnd())).toBe(true);
    expect(long.slice(c.length - 1, c.length)).toBe(' ');   // the cut is between words
    expect(cleanSaid(long.slice(0, 140))).toBe(long.slice(0, 140));
    expect(cutAtWord('one two three four', 10)).toBe('one two…'); expect(cutAtWord('short', 10)).toBe('short'); expect(cutAtWord('x'.repeat(30), 10).length).toBe(10);
  });
  it('the request asks for one or two short sentences of at most SAID_LEN characters in his own voice', () => {
    expect(FIXED).toContain(`at most ${SAID_LEN} characters`); expect(FIXED).toContain('one or two short sentences'); expect(FIXED).toContain('own voice');
  });
  it('the AI\'s own words stay about 4 s plus reading time by their length; a fixed phrase keeps its 3 s', () => {
    expect(showTime('I need some wood.')).toBe(SHOW_FIXED); expect(isFixedLine(PHRASES.fireLow[1])).toBe(true); expect(isFixedLine('I will bring in a few branches.')).toBe(false);
    const short = 'Wood first.', long = 'x'.repeat(140);
    expect(showTime(short)).toBeCloseTo(SHOW_OWN + SHOW_READ * short.length, 6); expect(showTime(long)).toBeCloseTo(SHOW_OWN + SHOW_READ * 140, 6);
    expect(showTime(long)).toBeGreaterThan(showTime(short)); expect(showTime(long)).toBeGreaterThan(7.5); expect(showTime(long)).toBeLessThan(10);
  });
  it('the line above him is wide enough for 140 characters on two lines (index.html), and balanced', () => {
    const css = readFileSync(new URL('../index.html', import.meta.url), 'utf8'), rule = css.match(/\.voice \{[^}]*\}/)[0];
    const m = rule.match(/max-width:\s*min\((\d+)px,\s*(\d+)vw\)/); expect(m).not.toBeNull();
    const px = +m[1], font = +rule.match(/font:\s*italic (\d+)px/)[1];
    expect(2 * px).toBeGreaterThanOrEqual(SAID_MAX * font * 0.46);   // a serif italic is about 0.46 em a character: two lines hold 140
    expect(rule).toContain('text-wrap:balance');
  });
  it('on a screen too narrow for two lines the line is cut at a word boundary until it fits, and is shown for its own time (createVoice)', () => {
    const el = () => ({ children: [], style: {}, setAttribute() {}, appendChild(c) { this.children.push(c); }, getBoundingClientRect: () => ({ width: 400, height: 600 }), _t: '',
      get textContent() { return this._t; }, set textContent(v) { this._t = v; }, get offsetHeight() { return 20 * Math.ceil(Math.max(1, this._t.length) / 40); } });   // 40 characters a line of 20 px
    vi.stubGlobal('document', { createElement: el }); vi.stubGlobal('getComputedStyle', () => ({ lineHeight: '20px' }));
    const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 2, 5); camera.updateMatrixWorld();
    const container = el(), voice = createVoice(container), line = container.children[0], player = { x: 0, y: 0, z: 0 };
    const said = 'The fire is nearly out and the night is long: I will bring in a few branches before the dark.';   // 94 characters: three lines of 40
    voice.update(20, player, camera, 20); expect(voice.announceStep(0.5, said, null)).toBe(said);
    expect(line.textContent.length).toBeLessThan(said.length); expect(line.textContent.endsWith('…')).toBe(true); expect(line.offsetHeight).toBeLessThanOrEqual(40);
    expect(said.startsWith(line.textContent.slice(0, -1).trimEnd())).toBe(true);
    voice.update(4.5, player, camera, 24.5); expect(Number(line.style.opacity)).toBeGreaterThan(0.5);   // still there after the old 3 s
    voice.update(6, player, camera, 30.5); expect(Number(line.style.opacity)).toBe(0);
  });
});

describe('point 2: with the AI on nearly nothing fixed is said (ai/said)', () => {
  const calm = { thirst: 0.2, hunger: 0.2, awake: 0.3 };
  it('a phrase that restates the running step is silent, the rules\' own phrases are silent too, and every lack becomes an event for the model', () => {
    expect(intentVoice({ on: true, kind: 'drinkIntent', restated: true, vitals: calm })).toEqual({ say: null, remember: null });
    expect(intentVoice({ on: true, kind: 'drinkIntent', restated: false, vitals: calm })).toEqual({ say: null, remember: null });   // the rules decided: nothing
    for (const k of ['fibreIntent', 'fireLow', 'fireOut', 'wetwood', 'foodReserve', 'torchIntent', 'woodIntent']) {
      const r = intentVoice({ on: true, kind: k, restated: false, vitals: calm }); expect(r.say, k).toBeNull(); expect(r.remember, k).toBe(LACK_TEXT[k]); expect(LACK_TEXT[k].length).toBeGreaterThan(5);
    }
    expect(intentVoice({ on: true, kind: 'fibreIntent', restated: true, vitals: calm }).remember).toBeNull();
    for (const k of ['spearIntent', 'roastIntent', 'journeyIntent', 'campIntent', 'homeIntent', 'buildIntent']) expect(intentVoice({ on: true, kind: k, vitals: calm }), k).toEqual({ say: null, remember: null });
  });
  it('an emergency has its short fixed phrase: acute thirst, very hungry, about to fall asleep', () => {
    expect(isEmergency('drinkIntent', { thirst: VERY_AT })).toBe(true); expect(isEmergency('drinkIntent', { thirst: VERY_AT - 0.01 })).toBe(false);
    expect(isEmergency('foodIntent', { hunger: VERY_HUNGER_AT })).toBe(true); expect(isEmergency('foodIntent', { hunger: 1.9 })).toBe(false);
    expect(isEmergency('sleepIntent', { awake: 1.3 })).toBe(true); expect(isEmergency('sleepIntent', { awake: 0.9 })).toBe(false); expect(isEmergency('woodIntent', { thirst: 5, hunger: 5, awake: 5 })).toBe(false);
    expect(intentVoice({ on: true, kind: 'drinkIntent', restated: false, vitals: { ...calm, thirst: 1.1 } })).toEqual({ say: 'drinkIntent', remember: null });
    expect(intentVoice({ on: true, kind: 'foodIntent', restated: false, vitals: { ...calm, hunger: 2.1 } })).toEqual({ say: 'foodIntent', remember: null });
    expect(PHRASES.drinkIntent.length).toBeGreaterThan(2);
  });
  it('with the AI off the mind\'s phrase is said as ever (the kind itself), and nothing is remembered', () => {
    for (const k of ['drinkIntent', 'fibreIntent', 'fireLow', 'spearIntent']) expect(intentVoice({ on: false, kind: k, restated: true, vitals: calm }), k).toEqual({ say: k, remember: null });
  });
});

describe('point 3: the castaway\'s name in the request', () => {
  it('the fixed part names him, "the castaway" when none was given, and no word of the request but those carries it', () => {
    const named = fixedText('Robin');
    expect(named).toContain('You are the mind of Robin,'); expect(named).toContain("in Robin's own voice"); expect(named).not.toContain('Dave');
    expect(FIXED).toBe(fixedText('')); expect(FIXED).toContain('You are the mind of the castaway'); expect(FIXED).toContain("in the castaway's own voice"); expect(FIXED).not.toContain('Dave');
    expect(named.split('Robin').length - 1).toBe(2);   // exactly the two places
    expect(fixedText(null)).toBe(FIXED); expect(fixedText('   ')).toBe(FIXED);
  });
  it('the name is cleaned: 20 characters, no quotes, braces or control characters', () => {
    expect(whoName('  Robin  ')).toBe('Robin'); expect(whoName('Ro"b{i}n\n`x`')).toBe('Ro b i n x');
    expect(whoName('x'.repeat(40)).length).toBe(20); expect(whoName(5)).toBe(''); expect(whoName(undefined)).toBe('');
  });
  it('the journal request uses the same name; the plan request and the single-choice request carry it only in the system text', () => {
    expect(journalSystem('Robin')).toContain('You are Robin, a lone castaway'); expect(journalSystem('')).toContain('You are a lone castaway'); expect(JOURNAL_SYSTEM).toBe(journalSystem('')); expect(JOURNAL_SYSTEM).not.toContain('Dave');
    const state = { day: 2, time: 0.5, raining: false, daylight: 5, thirst: 0.2, hunger: 0.2, awake: 0.2, carries: {}, home: null, journey: false, doing: 'free time' };
    const j = buildJournalMessages({ state, recent: [], journal: [], notes: ['a note'], name: 'Robin' }); expect(j[0].content).toBe(journalSystem('Robin')); expect(j[1].content).not.toContain('Robin');
    const p = buildPlanMessages({ state, recent: [], trigger: 'no plan yet', previous: [], possible: {}, mode: 'loose', notes: [], journal: [], name: 'Robin' });
    expect(p[0].content).toBe(named()); expect(p[1].content).not.toContain('Robin');
    const g = buildMessages({ state, recent: [], options: [], name: 'Robin' }); expect(g[0].content).toBe(named()); expect(g[1].content).not.toContain('Robin');
    expect(buildPlanMessages({ state, recent: [], trigger: 'x', previous: [], possible: {}, mode: 'loose' })[0].content).toBe(FIXED);
    function named() { return fixedText('Robin'); }
  });
  it('the chooser puts the name main hands it into the plan request and the journal request', async () => {
    const asks = [], t = { s: 1000 }, clock = { day: 3, time: 0.5, total: 3.5 };
    const reply = async () => ({ text: JSON.stringify({ plan: [{ step: 'stores', reason: 'Wood.' }, { step: 'home', reason: 'Home.' }, { step: 'stroll', reason: 'Stroll.' }], reason: 'x' }), ms: 5, model: 'm' });
    let nm = '';
    const ai = createAiChooser({ rulesChooser, ask: m => { asks.push(m); return reply(); }, now: () => t.s, canSend: () => true, enabled: () => true, name: () => nm, clock: () => clock, mode: () => 'loose' });
    ai.attach({ recent: [], goal: 'idle', menu: () => ({ options: [] }) }, { clock, thirst: { days: 0.2 }, hunger: { days: 0.2 }, sleep: { awake: 0.3 } });
    const menu = goalMenu({ asleep: false, time: 0.4, thirst: 0.1, hunger: 0.1, awake: 0.3, canLie: false, water: true, nuts: 0, fibre: 2, fireLit: false, fireFuel: 0, stock: 0, spare: 0, canLight: false, cool: {} }, chooseGoal);
    nm = 'Robin'; ai.chooser('goal', menu, { rand: () => 0.5, ex: () => 0.5, fish: () => 0.5 });
    expect(asks.length).toBe(1); expect(asks[0][0].content).toBe(fixedText('Robin')); expect(asks[0][1].content).not.toContain('Robin');
  });
});

describe('point 4: the fire in the request', () => {
  it('fireOutlook: pieces, hours left, the pieces the night needs until dawn, the store in hours (a branch half, ring 1.5 times)', () => {
    const per = BURN * 24;
    const a = fireOutlook({ fuel: 3 * BURN, ring: false, hoursToDawn: 10, dry: 4, branches: 2 });
    expect(a.pieces).toBeCloseTo(3, 6); expect(a.hoursLeft).toBeCloseTo(3 * per, 6); expect(a.perPiece).toBeCloseTo(per, 6);
    expect(a.need).toBe(Math.max(0, Math.ceil((10 - 3 * per) / per))); expect(a.storeHours).toBeCloseTo((4 + 2 * BRANCH_BURN) * per, 6); expect(a.max).toBe(8); expect(a.maxHours).toBeCloseTo(FUEL_MAX * 24, 6);
    const r = fireOutlook({ fuel: 3 * BURN, ring: true, hoursToDawn: 10, dry: 4, branches: 0 });
    expect(r.hoursLeft).toBeCloseTo(3 * per * RING_BURN, 6); expect(r.perPiece).toBeCloseTo(per * RING_BURN, 6); expect(r.storeHours).toBeCloseTo(4 * per * RING_BURN, 6); expect(r.need).toBe(Math.max(0, Math.ceil((10 - 3 * per * RING_BURN) / (per * RING_BURN))));
    expect(fireOutlook({ fuel: 8 * BURN, hoursToDawn: 5 }).need).toBe(0);   // it lasts until dawn
    expect(fireOutlook({ hoursToDawn: 10 }).need).toBe(Math.ceil(10 / per)); expect(fireOutlook({}).need).toBe(0);   // no fire: all of the night
    expect(hoursTo(0.9, DAWN)).toBeCloseTo((1 - 0.9 + DAWN) * 24, 6); expect(hoursTo(0.1, DAWN)).toBeCloseTo((DAWN - 0.1) * 24, 6);
  });
  const base = { day: 3, time: 0.8, raining: false, daylight: 1, thirst: 0.2, hunger: 0.2, awake: 0.3, carries: {}, home: null, journey: false, doing: 'free time' };
  it('the request says the pieces on the fire, how long it lasts, the pieces more the night needs and the store with its burn time and the wet wood apart', () => {
    const t = stateText({ ...base, camp: { fire: 'low', fuel: 3 * BURN, ring: false, store: { dry: 4, wet: 2, branches: 3, fronds: 1, stones: 0, logs: 0 } } });
    expect(t).toMatch(/Fire: burning low, about 3 pieces on it, about 7\.5 hours left \(it holds at most 8\); for the night until 04:04 it needs about \d+ pieces? more\./);
    expect(t).toContain('Camp store: 4 dry wood, 3 branches (about 14 hours of fire), 2 wet (do not burn until dry), 1 fronds.');
    const none = stateText({ ...base, camp: { fire: 'none', fuel: 0, store: { dry: 0, wet: 0, branches: 0, fronds: 0, stones: 0, logs: 0 } } });
    expect(none).toMatch(/Fire: none yet \(for the night until 04:04 it needs about \d+ pieces\)\./); expect(none).toContain('Camp store: nothing.');
    const full = stateText({ ...base, time: 0.9, camp: { fire: 'well', fuel: 8 * BURN, ring: true, store: { dry: 1, wet: 0, branches: 0, fronds: 0, stones: 0, logs: 0 } } });
    expect(full).toContain('about 8 pieces on it, about 30 hours left'); expect(full).toContain('it will last until dawn (04:04)');
    expect(stateText({ ...base, camp: { fire: 'low', store: { dry: 6, wet: 2 } } })).toContain('Fire: burning low.');   // a camp that does not tell its fuel keeps the short line
  });
  it('the system text explains feeding with the real numbers, and that feeding is possible at any hour', () => {
    expect(FIXED).toContain('Feeding the fire'); expect(FIXED).toContain('burns 2.5 hours and a branch half as long'); expect(FIXED).toContain('3.75 hours'); expect(FIXED).toContain('at most 8 pieces'); expect(FIXED).toContain('Wet wood does not burn until it has dried');
    expect(FIXED).toContain('no store for the night the fire goes out'); expect(FIXED).toContain('at ANY hour'); expect(FIXED).toContain('how many pieces more the night needs');
  });
  const s0 = { asleep: false, time: 0.4, thirst: 0.1, hunger: 0.1, awake: 0.3, canLie: false, water: true, waterNear: false, shellsEmpty: 0, shellsFull: 0, nuts: 2, fibre: 2, torch: false, fireLit: true, fireFuel: 0.6, stock: 6, spare: 6, canLight: false, pileLogs: 6, cool: {}, journey: false };
  it('feeding is a menu condition at any hour (a fire burns, a piece fits, dry wood lies ready); the rules\' evening step is unchanged', () => {
    expect(fireStepAny(s0)).toBe('feed'); expect(fireStepAny({ ...s0, fireFuel: FEED_ANY + 0.01 })).toBeNull(); expect(fireStepAny({ ...s0, stock: 0, spare: 0 })).toBeNull(); expect(fireStepAny({ ...s0, fireLit: false })).toBeNull();
    expect(chooseGoal(s0)).toBe('stores' === chooseGoal(s0) ? 'stores' : chooseGoal(s0));   // the rules' own goal at 09:36 is never the fire
    expect(chooseGoal(s0)).not.toBe('fire'); expect(chooseGoalMenu(s0)).toBe('fire'); expect(chooseGoalMenu({ ...s0, journey: true })).not.toBe('fire'); expect(chooseGoalMenu({ ...s0, cool: { fire: true } })).not.toBe('fire');
    expect(chooseGoalMenu({ ...s0, thirst: 0.5 })).toBe('drink');   // a need still goes first
    const ev = { ...s0, time: 0.7, fireFuel: 0.1 }; expect(chooseGoal(ev)).toBe('fire'); expect(chooseGoalMenu(ev)).toBe('fire'); expect(fireStepMenu(ev)).toBe('feed');
    expect(fireStepMenu({ ...s0, time: 0.4 })).toBe('feed'); expect(fireStepMenu({ ...s0, time: 0.4, fireLit: false })).toBeNull();
  });
  it('the menu has the fire at 09:36 and the AI-ish chooser may take it, but the rules pass it over; in the evening the rules take it as ever', () => {
    const habit = (name, s, cool) => (name === 'fire' ? chooseGoal({ ...s, cool }) === 'fire' : undefined);
    const day = goalMenu(s0, chooseGoalMenu, { thirst: VERY_AT, hunger: VERY_HUNGER_AT }, {}, habit);
    expect(day.options.map(o => o.id)).toEqual(['fire', 'idle']); expect(firstChooser('goal', day)).toBe('fire'); expect(rulesChooser('goal', day, {})).toBe('idle');   // the rules: what they always chose
    expect(goalMenu(s0, chooseGoal, { thirst: VERY_AT, hunger: VERY_HUNGER_AT }).options.map(o => o.id)).toEqual(['idle']);
    const eve = goalMenu({ ...s0, time: 0.7, fireFuel: 0.1 }, chooseGoalMenu, { thirst: VERY_AT, hunger: VERY_HUNGER_AT }, {}, habit);
    expect(eve.options.map(o => o.id)[0]).toBe('fire'); expect(rulesChooser('goal', eve, {})).toBe('fire');
    expect(goalMenu(s0, chooseGoalMenu, { thirst: VERY_AT, hunger: VERY_HUNGER_AT }).options.map(o => o.id)[0]).toBe('fire');   // with no habit given the menu is simply the wide one
  });
});

describe('point 4: a real mind offers the fire at any hour and the rules do not take it', () => {
  let w, spawn;
  beforeAll(async () => { w = await generateWorld(1337); spawn = startSpot(w); }, 120000);
  const litGame = time => {
    const fire = { fires: [{ id: 0, x: spawn.x, z: spawn.z, fuel: 0.6 * FUEL_MAX, embers: 0.5, emberAge: 0, lit: 0, fed: 3 }], burnt: [], attempts: 0, nextId: 1 };
    return campGame(w, spawn, { day: 3, time, stocked: true, extra: { fire } });
  };
  it('mind.menu() lists the fire at 09:36 with a fire burning and wood ready, rulesChooser does not take it, and mind.camp tells the fuel', () => {
    const g = litGame(0.4), m = createMind(w, g); m.engage();
    const menu = m.menu(), ids = menu.options.map(o => o.id);
    expect(ids).toContain('fire'); expect(rulesChooser('goal', menu, {})).not.toBe('fire');
    const c = m.camp(); expect(['low', 'well']).toContain(c.fire); expect(c.fuel).toBeCloseTo(0.6 * FUEL_MAX, 6); expect(typeof c.ring).toBe('boolean');
  });
  it('in the evening with a low fire the rules take it as always', () => {
    const g = litGame(0.7); g.fire.fires[0].fuel = 0.1 * FUEL_MAX;
    const m = createMind(w, g); m.engage(); expect(rulesChooser('goal', m.menu(), {})).toBe('fire');
  });
});

describe('point 5: fewer rests; the prompt tells what his days are for', () => {
  it('the system text says what his days are for and that stroll, linger and gaze are rests, at most one or two in a plan', () => {
    expect(FIXED).toContain('What his days are for'); expect(FIXED).toContain('the home'); expect(FIXED).toContain('exploring'); expect(FIXED).toContain('By day he prefers useful work');
    expect(FIXED).toContain('A stroll, standing about (linger) and the sunset gaze are REST'); expect(FIXED).toContain('at most one or two of them in a plan, mostly in the afternoon and evening'); expect(FIXED).toContain('The choice is yours');
  });
  it('the state tells the next part of the home', () => {
    const t = stateText({ day: 3, time: 0.5, raining: false, daylight: 5, thirst: 0.1, hunger: 0.1, awake: 0.1, carries: {}, home: { leanto: 100, walls: 40, bed: 0, ring: 0, hut: 0 }, journey: false, doing: 'free time', nextHome: 'walls' });
    expect(t).toContain('Next part of the home: the walls.'); expect(stateText({ day: 3, time: 0.5, daylight: 5, carries: {}, home: null, nextHome: null })).not.toContain('Next part');
  });
  const rigged = v => () => v, ctxOf = () => ({ rand: rigged(0.5), ex: rigged(0.5), fish: rigged(0.5) });
  const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
  it('a goal step after a pastime is not bridged with linger: onward when the first stage is asked, else the rules decide and the plan stays', async () => {
    const t = { s: 1000 }, clock = { day: 3, time: 0.5, total: 3.5 };
    const reply = async () => ({ text: JSON.stringify({ plan: [{ step: 'stores', reason: 'a' }, { step: 'stroll', reason: 'b' }, { step: 'fire', reason: 'c' }, { step: 'home', reason: 'd' }], reason: 'x' }), ms: 5, model: 'm' });
    const ai = createAiChooser({ rulesChooser, ask: () => reply(), now: () => t.s, canSend: () => true, enabled: () => true, clock: () => clock, mode: () => 'strict' });
    ai.attach({ recent: [], goal: 'idle', menu: () => ({ options: [] }) }, { clock, thirst: { days: 0.2 }, hunger: { days: 0.2 }, sleep: { awake: 0.3 } });
    const quiet = () => goalMenu({ asleep: false, time: 0.5, thirst: 0.1, hunger: 0.1, awake: 0.3, canLie: false, water: true, nuts: 0, fibre: 2, fireLit: false, fireFuel: 0, stock: 99, spare: 0, canLight: false, cool: {} }, chooseGoal);
    const go = (m = quiet()) => ai.chooser('goal', m, ctxOf());
    const pm = m => ai.chooser('pastime', m, ctxOf());
    const day = (f = {}) => pastimeMenu('day', { home: { ok: true }, spear: { ok: false }, stroll: { ok: true, chance: 0.9, kind: () => 'shore' }, ...f });
    const before = (f = {}) => pastimeMenu('before', { gaze: { ok: false }, ember: { ok: false }, strays: { ok: false }, ...f });
    go(); await flush(); t.s += 0.6; expect(go()).toBe('stores');
    t.s += 1; expect(go()).toBe('idle');   // free time first, on the way to the stroll
    expect(pm(day())).toBe('stroll');
    expect(pm(day())).toBe('home'); expect(ai.entries[0]).toMatchObject({ used: 'rules', why: 'plan-hold' });   // the next step is a goal (fire): no linger as a short way on, the rules decide for the moment (they take the home work)
    expect(ai.plan().steps[2].state).toBe('next');
    for (let i = 0; i < 3; i++) expect(pm(day({ home: { ok: false } }))).not.toBe(undefined);
    expect(ai.entries.filter(e => e.ai === 'linger').length).toBe(0);
    expect(pm(before())).toBe('onward');   // the first stage: onward
  });
});
