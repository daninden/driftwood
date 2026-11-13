// The optional language-model chooser (src/ai, 0.36 "Mind"): the prompt and the answer parser (pure), the client (fake fetch and fake storage, no network ever), the chooser (fake `ask`), the typing guard of the
// keyboard, the panel's pure helpers, and lives of the mind with the AI chooser wired to a fake ask. The key of the player is never in any string that leaves the client.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { createMind, chooseGoal, VERY_AT, VERY_HUNGER_AT } from '../src/game/mind.js';
import { WAIT, goalMenu, makeMenu, option, pastimeMenu, eventMenu, rulesChooser, choiceId, validChoice, isValid, PASTIMES } from '../src/game/intent.js';
import { FIXED, MODE_TEXT, PLAN_STEPS, hoursOpen, stepLabel, buildPlanMessages, parsePlan, hhmm, snapshotOf, stateText, recentText, optionsOf, buildMessages, parseAnswer, describeOption, GOAL_TEXT, GOAL_LABEL, PASTIME_TEXT } from '../src/ai/prompt.js';
import { createClient, pacificDay } from '../src/ai/client.js';
import { createAiChooser, OVERRIDES, MODES, CRITICAL, overridesFor } from '../src/ai/chooser.js';
import { AI_PER_MIN, AI_PER_DAY, AI_WAIT, AI_MODELS, AI_URL, AI_MODES, AI_MODE_DEFAULT, AI_AWAKE_MARGIN, KEY_NAME, ON_NAME, MODE_NAME, COUNT_NAME } from '../src/ai/config.js';
import { THIRST_GO, HUNGER_GO } from '../src/game/mind.js';
import { DUSK, AWAKE_MAX } from '../src/game/sleep.js';
import { REVIVE_AT, COLLAPSE_AT } from '../src/game/thirst.js';
import { STARVING_AT } from '../src/game/hunger.js';
import { isAiKey, whyText, blockParts, planLines, planHead, modeLine, tallyLine, statusLine, modelLines, pendingLine, requestText } from '../src/render/aiPanel.js';
import { isTyping, createActing, PASSIVE_CODES } from '../src/game/input.js';
import { runMind, walkFirstDay } from './helpers/mindSim.js';

const KEY = 'AIza-SECRET-KEY-1234567890';
const calm = (o = {}) => ({ asleep: false, time: 0.4, thirst: 0.1, hunger: 0.1, awake: 0.3, canLie: false, water: true, waterNear: false, shellsEmpty: 0, shellsFull: 0, nuts: 2, fibre: 2, torch: false,
  fireLit: false, fireFuel: 0, stock: 99, spare: 0, canLight: false, cool: {}, ...o });
const limits = { thirst: VERY_AT, hunger: VERY_HUNGER_AT };
const hungryMenu = () => goalMenu(calm({ thirst: 0.5, hunger: 0.8 }), chooseGoal, limits);   // drink, eat, stores, idle
const quietMenu = () => goalMenu(calm({ nuts: 0 }), chooseGoal, limits);   // stores, idle: the rules pick stores, no need
const emergencyMenu = () => goalMenu(calm({ thirst: 1.05, hunger: 0.8 }), chooseGoal, limits);   // drink forced
const rigged = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };
const ctxOf = () => ({ rand: rigged(0.5), ex: rigged(0.5), fish: rigged(0.5) });
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };

const fakeStorage = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: k => { m.delete(k); }, dump: () => Object.fromEntries(m) }; };
const okResponse = text => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ choices: [{ message: { content: text } }] }), text: async () => text });
const errResponse = (status, headers = {}, body = '') => ({ ok: false, status, headers: { get: k => headers[k] ?? null }, json: async () => ({}), text: async () => body });

describe('prompt', () => {
  const state = { day: 3, time: 0.6, raining: false, thirst: 0.4, hunger: 1.2, awake: 0.7, carries: { driftwood: 2, nuts: 1, fibre: 0, spear: true }, home: { leanto: 100, walls: 50, bed: 0, ring: 0, hut: 0 }, journey: false, doing: 'the goal stores' };
  const recent = [{ t: 2.5, day: 2, kind: 'goal', what: 'drink', outcome: 'done' }, { t: 3.55, day: 3, kind: 'stuck', what: 'eat', outcome: 'seen' }, { t: 3.58, day: 3, kind: 'goal', what: 'stores', outcome: null }];

  it('builds a fixed system message and a user message with the state, the memory and the options', () => {
    const m = buildMessages({ state, recent, options: optionsOf(hungryMenu()) });
    expect(m.map(x => x.role)).toEqual(['system', 'user']);
    expect(m[0].content).toBe(FIXED);
    expect(FIXED).toContain('"plan"'); expect(FIXED).toContain('thirst'); expect(FIXED).toContain('tide');
    expect(m[1].content).toContain('Day 3, 14:24'); expect(m[1].content).toContain('Thirst: 0.4 days'); expect(m[1].content).toContain('2 driftwood'); expect(m[1].content).toContain('a spear');
    expect(m[1].content).toContain('walls 50%'); expect(m[1].content).toContain('day 2 12:00 goal: drink -> done'); expect(m[1].content).toContain('goal: stores -> under way');
    for (const id of ['drink', 'eat', 'stores', 'idle']) expect(m[1].content).toContain(`- ${id}:`);
    expect(m[0].content.length + m[1].content.length).toBeLessThan(12000);   // about 3,000 tokens at the most
  });
  it('marks a forced option, shows the cost when there is one and puts in nothing of the key', () => {
    const o = optionsOf(emergencyMenu());
    expect(o[0]).toMatchObject({ id: 'drink', forced: true });
    expect(buildMessages({ state, recent, options: o })[1].content).toContain('[FORCED]');
    const withCost = buildMessages({ state, recent: [], options: [{ id: 'drink', what: 'drink', why: 'thirst', cost: 42, forced: false }] })[1].content;
    expect(withCost).toContain('walk about 42 s'); expect(withCost).toContain('(nothing yet)');
  });
  it('reads a cost that throws as none, and the clock as hh:mm', () => {
    const menu = { options: [{ id: 'x', what: 'x', why: 'y', get cost() { throw new Error('no'); }, forced: false }] };
    expect(optionsOf(menu)[0].cost).toBeNull();
    expect(hhmm(0)).toBe('00:00'); expect(hhmm(0.5)).toBe('12:00'); expect(hhmm(0.999)).toBe('23:58'); expect(hhmm(1.25)).toBe('06:00');
  });
  it('snapshotOf reads a plain game and survives a bare one', () => {
    const game = { clock: { day: 4, time: 0.3 }, thirst: { days: 0.2 }, hunger: { days: 1 }, sleep: { awake: 0.5 }, rain: 0.4, wood: { carried: [{}, { branch: true }, { frond: true }], stones: [1] }, fibre: { carried: 2 }, shells: { nuts: 3, empty: () => 1, full: () => 0 },
      crabs: { carried: [] }, fish: { carried: [1] }, berries: { carried: [] }, bananas: { carried: [] }, spear: { has: () => true }, player: { axe: false }, fire: { torch: null }, leantos: { list: [{ progress: 1, up: { walls: 1 }, hut: 0 }] } };
    const s = snapshotOf(game, { goal: 'drink' });
    expect(s).toMatchObject({ day: 4, raining: true, thirst: 0.2, hunger: 1, doing: GOAL_TEXT.drink });
    expect(s.carries).toMatchObject({ driftwood: 1, branches: 1, fronds: 1, stones: 1, fibre: 2, nuts: 3, spear: true }); expect(s.home).toMatchObject({ leanto: 100, walls: 100, bed: 0 });
    expect(stateText(s)).toContain('raining');
    const bare = snapshotOf({}, {}); expect(bare.home).toBeNull(); expect(stateText(bare)).toContain('no shelter yet');
    expect(recentText(undefined)).toBe('(nothing yet)');
  });
});

describe('parseAnswer', () => {
  const ids = ['drink', 'eat', 'idle'];
  it('reads a plain object, fenced JSON and JSON inside talk', () => {
    expect(parseAnswer('{"choice":"eat","reason":"I am hungry."}', ids)).toEqual({ ok: true, id: 'eat', reason: 'I am hungry.', error: null });
    expect(parseAnswer('```json\n{"choice": "drink", "reason": "Dry throat."}\n```', ids)).toMatchObject({ ok: true, id: 'drink', reason: 'Dry throat.' });
    expect(parseAnswer('Sure! Here it is: {"choice":"idle","reason":"a {brace} in text"} done', ids)).toMatchObject({ ok: true, id: 'idle', reason: 'a {brace} in text' });
    expect(parseAnswer('{"nope":1} {"choice":"eat"}', ids)).toMatchObject({ ok: false, error: 'no choice' });   // (the first object counts)
    expect(parseAnswer('{"choice":"eat"} {"choice":"drink"}', ids)).toMatchObject({ ok: true, id: 'eat', reason: '' });
  });
  it('refuses garbage, an empty answer, no choice and an id that is not on the menu', () => {
    for (const t of ['', '   ', null, undefined, 42, 'I think he should eat.', '{broken', '[1,2]', '{"reason":"x"}', '{"choice":3}']) expect(parseAnswer(t, ids).ok, String(t)).toBe(false);
    const r = parseAnswer('{"choice":"swim","reason":"cool"}', ids);
    expect(r).toMatchObject({ ok: false, id: 'swim', error: 'choice not on the menu' });
    expect(parseAnswer('{"choice":"eat"}', undefined).ok).toBe(false);
  });
});

describe('client', () => {
  const T0 = Date.UTC(2026, 10, 12, 20, 0, 0);
  const make = (fetchImpl, o = {}) => {
    const st = fakeStorage(o.storage || { [KEY_NAME]: KEY, [ON_NAME]: '1' }), t = { ms: o.t0 ?? T0 }, calls = [];
    const fetch = async (url, init) => { calls.push({ url, init }); return fetchImpl(url, init, calls.length); };
    const c = createClient({ fetch, storage: st, now: () => t.ms, timeout: o.timeout ?? 15000, ...o.cfg });
    return { c, st, t, calls };
  };
  const ONE = { models: ['m1'] };
  const leaks = (...vals) => vals.every(v => !JSON.stringify(v).includes(KEY));

  it('posts the messages with the bearer key and the fixed model, and answers { text, ms }', async () => {
    const { c, calls, t } = make(async () => { t.ms += 1200; return okResponse('{"choice":"eat"}'); });
    const r = await c.send([{ role: 'user', content: 'hi' }]);
    expect(r).toEqual({ text: '{"choice":"eat"}', ms: 1200, model: AI_MODELS[0] });
    expect(calls[0].url).toBe(AI_URL); expect(calls[0].init.method).toBe('POST'); expect(calls[0].init.headers.Authorization).toBe('Bearer ' + KEY);
    expect(JSON.parse(calls[0].init.body)).toEqual({ model: AI_MODELS[0], messages: [{ role: 'user', content: 'hi' }], temperature: 0.7 });
    expect(c.status()).toMatchObject({ on: true, hasKey: true, today: 1, perDay: AI_PER_DAY * 3, lastError: null, pausedUntil: 0, inFlight: false });
    expect(c.status().models.map(m => m.model)).toEqual(AI_MODELS); expect(c.status().models[0]).toMatchObject({ today: 1, perDay: AI_PER_DAY, lastMinute: 1, perMin: AI_PER_MIN, pausedUntil: 0, dead: false });
    expect(c.status().models[1].today).toBe(0);
    expect(leaks(c.status())).toBe(true);
  });
  it('does not send without a key, and the key never shows in status', async () => {
    const { c, calls } = make(async () => okResponse('x'), { storage: {} });
    expect(c.canSend()).toBe(false); await expect(c.send([])).rejects.toMatchObject({ code: 'nokey' }); expect(calls.length).toBe(0);
    expect(c.status().hasKey).toBe(false); expect(c.on()).toBe(false);
    c.setKey('  ' + KEY + ' '); expect(c.hasKey()).toBe(true); expect(leaks(c.status())).toBe(true);
    c.setOn(true); expect(c.on()).toBe(true); c.clearKey(); expect(c.hasKey()).toBe(false);
  });
  it('keeps the key only under its own storage name', async () => {
    const { c, st } = make(async () => okResponse('ok'), { storage: {} });
    c.setKey(KEY); await c.send([]);
    expect(Object.keys(st.dump()).sort()).toEqual([COUNT_NAME + '.' + AI_MODELS[0], KEY_NAME].sort());
    expect(st.dump()[COUNT_NAME + '.' + AI_MODELS[0]]).not.toContain(KEY);
  });
  it('allows AI_PER_MIN requests in a minute, then refuses until the window moves on', async () => {
    const { c, t, calls } = make(async () => okResponse('ok'), { cfg: ONE });
    for (let i = 0; i < AI_PER_MIN; i++) { t.ms += 1000; await c.send([]); }
    expect(c.canSend()).toBe(false); await expect(c.send([])).rejects.toMatchObject({ code: 'budget' }); expect(calls.length).toBe(AI_PER_MIN);
    t.ms += 60000; expect(c.canSend()).toBe(true); await c.send([]); expect(calls.length).toBe(AI_PER_MIN + 1);
  });
  it('allows AI_PER_DAY a day and starts a new count at midnight Pacific time', async () => {
    const st = { [KEY_NAME]: KEY, [COUNT_NAME + '.m1']: JSON.stringify({ day: pacificDay(T0), n: AI_PER_DAY - 1 }) };
    const { c, t } = make(async () => okResponse('ok'), { storage: st, cfg: ONE });
    await c.send([]); expect(c.status().today).toBe(AI_PER_DAY);
    t.ms += 120000; await expect(c.send([])).rejects.toMatchObject({ code: 'budget' });
    expect(pacificDay(Date.UTC(2026, 10, 12, 7, 59))).toBe('2026-11-11'); expect(pacificDay(Date.UTC(2026, 10, 12, 8, 1))).toBe('2026-11-12');   // (PST in November: midnight is 08:00 UTC)
    t.ms = Date.UTC(2026, 10, 13, 9, 0); expect(c.status().today).toBe(0); expect(c.canSend()).toBe(true);
    await c.send([]); expect(c.status().today).toBe(1);
  });
  it('a 429 pauses everything until Retry-After (else 60 s)', async () => {
    let n = 0;
    const { c, t, calls } = make(async () => (++n === 1 ? errResponse(429, { 'Retry-After': '30' }) : n === 2 ? errResponse(429) : okResponse('ok')), { cfg: ONE });
    await expect(c.send([])).rejects.toMatchObject({ code: 'http', message: expect.stringContaining('429') });
    expect(c.status().pausedUntil).toBe(T0 + 30000); expect(c.canSend()).toBe(false);
    await expect(c.send([])).rejects.toMatchObject({ code: 'budget' }); expect(calls.length).toBe(1);
    t.ms += 30001; expect(c.canSend()).toBe(true);
    await expect(c.send([])).rejects.toThrow(); expect(c.status().pausedUntil).toBe(t.ms + 60000);
    t.ms += 60001; t.ms += 0; expect(c.status().pausedUntil).toBe(0); await c.send([]); expect(c.status().lastError).toBeNull();
  });
  it('records an error, a bad body and a timeout, and never puts the key in them', async () => {
    const a = make(async () => errResponse(500, {}, 'oops ' + KEY + ' oops'));
    const e = await a.c.send([]).catch(x => x);
    expect(e.code).toBe('http'); expect(e.message).toContain('500'); expect(leaks(e.message, a.c.status())).toBe(true); expect(a.c.status().lastError).toContain('500');
    const b = make(async () => { throw new Error('network down for ' + KEY); });
    const e2 = await b.c.send([]).catch(x => x); expect(e2.code).toBe('net'); expect(leaks(e2.message, b.c.status())).toBe(true);
    const c2 = make(async () => ({ ok: true, status: 200, json: async () => ({ choices: [] }) })); await expect(c2.c.send([])).rejects.toMatchObject({ code: 'bad' });
    const d = make((url, init) => new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(new Error('aborted')))), { timeout: 20 });
    await expect(d.c.send([])).rejects.toMatchObject({ code: 'timeout' }); expect(d.c.status().inFlight).toBe(false); expect(d.c.status().lastError).toContain('no answer');
  });
  const bodyModel = init => JSON.parse(init.body).model;
  it('goes to the first model whose budget allows, then the next, in order; all spent gives budget', async () => {
    const { c, t, calls } = make(async () => okResponse('ok'));
    for (let i = 0; i < AI_PER_MIN * 3; i++) { t.ms += 100; await c.send([]); }
    const order = calls.map(x => bodyModel(x.init));
    expect(order.slice(0, AI_PER_MIN).every(m => m === AI_MODELS[0])).toBe(true); expect(order.slice(AI_PER_MIN, AI_PER_MIN * 2).every(m => m === AI_MODELS[1])).toBe(true); expect(order.slice(AI_PER_MIN * 2).every(m => m === AI_MODELS[2])).toBe(true);
    expect(c.canSend()).toBe(false); await expect(c.send([])).rejects.toMatchObject({ code: 'budget' });
    t.ms += 61000; expect(c.canSend()).toBe(true); await c.send([]); expect(bodyModel(calls.at(-1).init)).toBe(AI_MODELS[0]);   // the first is back with its minute
  });
  it('a 429 on the first model pauses it and the same request goes once to the second', async () => {
    const { c, calls, t } = make(async (u, init, n) => (n === 1 ? errResponse(429, { 'Retry-After': '45' }) : okResponse('{"choice":"eat"}')));
    const r = await c.send([{ role: 'user', content: 'same' }]);
    expect(r).toMatchObject({ text: '{"choice":"eat"}', model: AI_MODELS[1] });
    expect(calls.map(x => bodyModel(x.init))).toEqual([AI_MODELS[0], AI_MODELS[1]]); expect(calls[1].init.body.includes('same')).toBe(true);
    const st = c.status(); expect(st.models[0]).toMatchObject({ today: 1, pausedUntil: T0 + 45000 }); expect(st.models[1]).toMatchObject({ today: 1, pausedUntil: 0 }); expect(st.lastError).toBeNull();
    await c.send([]); expect(bodyModel(calls[2].init)).toBe(AI_MODELS[1]);   // the first stays paused
    t.ms += 46000; await c.send([]); expect(bodyModel(calls[3].init)).toBe(AI_MODELS[0]);
  });
  it('a 404 kills a model for the session; only one retry, and when no model is left the error goes up', async () => {
    const a = make(async (u, init) => (bodyModel(init) === AI_MODELS[0] ? errResponse(404, {}, 'model not found') : okResponse('ok')));
    expect((await a.c.send([])).model).toBe(AI_MODELS[1]); expect(a.c.status().models[0].dead).toBe(true);
    a.t.ms += 10 * 3600 * 1000; await a.c.send([]); expect(a.calls.filter(x => bodyModel(x.init) === AI_MODELS[0]).length).toBe(1);
    const b = make(async () => errResponse(429)); const e = await b.c.send([]).catch(x => x);
    expect(e.code).toBe('http'); expect(b.calls.length).toBe(2);   // the first and one retry, not the third
    const one = make(async () => errResponse(429), { cfg: ONE }); await expect(one.c.send([])).rejects.toMatchObject({ code: 'http' }); expect(one.calls.length).toBe(1);
  });
  it('one request at a time, and counts every attempt that is sent', async () => {
    let release; const { c } = make(() => new Promise(r => { release = () => r(okResponse('ok')); }));
    const first = c.send([]); await flush();
    expect(c.status().inFlight).toBe(true); expect(c.canSend()).toBe(false); await expect(c.send([])).rejects.toMatchObject({ code: 'busy' });
    release(); await first; expect(c.status().today).toBe(1);
  });
  it('lists the models of the key without counting them', async () => {
    const { c, calls } = make(async () => ({ ok: true, status: 200, json: async () => ({ data: [{ id: 'models/gemini-2.5-flash-lite' }, { id: 'models/gemma-3-27b-it' }] }) }));
    expect(await c.listModels()).toEqual(['gemini-2.5-flash-lite', 'gemma-3-27b-it']);
    expect(calls[0].init.method).toBe('GET'); expect(c.status().today).toBe(0);
    const bad = make(async () => { throw new Error('x ' + KEY); }); const e = await bad.c.listModels().catch(x => x); expect(leaks(e.message)).toBe(true);
  });
  it('works without storage (the key is then kept in memory only)', async () => {
    const c = createClient({ fetch: async () => okResponse('ok'), storage: null, now: () => T0 });
    c.setKey(KEY); expect(c.hasKey()).toBe(true); await c.send([]); expect(c.status().today).toBe(0);
  });
});

const go = (ai, menu = quietMenu()) => ai.chooser('goal', menu, ctxOf());
describe('chooser: plans (0.36.3)', () => {
  const planOf = (...ids) => async () => ({ text: JSON.stringify({ plan: ids.map(step => ({ step, reason: 'because ' + step })), reason: 'A plan.' }), ms: 700, model: 'gemini-x' });
  const setup = (o = {}) => {
    const t = { s: 1000 }, clock = { day: 3, time: 0.5 }, asks = [], rulesCalls = [], st = { on: true, can: true, mode: o.mode || 'strict', vit: { thirst: 0.2, hunger: 0.3, awake: 0.3 } };
    let answer = o.reply || planOf('stores', 'home', 'stroll', 'linger', 'fire');
    const rules = (point, menu, ctx) => { rulesCalls.push(point); return rulesChooser(point, menu, ctx); };
    const ai = createAiChooser({ rulesChooser: rules, ask: m => { asks.push(m); return answer(m); }, now: () => t.s, canSend: () => st.can, enabled: () => st.on, clock: () => clock, mode: () => st.mode, replanGap: o.gap ?? 20 });
    ai.attach({ recent: [{ t: 1.5, day: 1, kind: 'goal', what: 'stores', outcome: 'done' }], goal: 'idle', menu: () => quietMenu() }, { clock, thirst: { get days() { return st.vit.thirst; } }, hunger: { get days() { return st.vit.hunger; } }, sleep: { get awake() { return st.vit.awake; } } });
    return { ai, t, asks, rulesCalls, st, clock, setReply: f => { answer = f; } };
  };
  const go = (ai, menu = quietMenu()) => ai.chooser('goal', menu, ctxOf());
  const dayMenu = (facts = {}) => pastimeMenu('day', { home: { ok: true }, spear: { ok: false }, stroll: { ok: true, chance: 0.9, kind: () => 'shore' }, ...facts });
  const beforeMenu = (facts = {}) => pastimeMenu('before', { gaze: { ok: false }, ember: { ok: false }, strays: { ok: false }, ...facts });
  const pm = (ai, menu) => ai.chooser('pastime', menu, ctxOf());
  const planned = async (s, menu = quietMenu()) => { expect(go(s.ai, menu)).toBe(WAIT); await flush(); s.t.s += 0.6; return go(s.ai, menu); };   // asked, answered, the first step taken

  it('always calls the rules first; the event point and a pastime menu with nothing to choose are the rules\' at once, never WAIT', () => {
    const { ai, rulesCalls, asks } = setup();
    expect(pm(ai, beforeMenu())).toBe('onward'); expect(ai.chooser('event', eventMenu('stuck', 'drink'), ctxOf())).toBe('continue');
    expect(rulesCalls).toEqual(['pastime', 'event']); expect(ai.entries.length).toBe(0); expect(asks.length).toBe(0); expect(ai.chooser.selfChecked).toBe(true);
  });
  it('off, a menu of one option: the rules at once; a forced option, a need and a spent budget as the leash says', () => {
    const off = setup(); off.st.on = false; expect(go(off.ai)).toBe('stores'); expect(off.asks.length).toBe(0); expect(off.ai.entries.length).toBe(0); expect(off.ai.tally()).toEqual({ ai: 0, rules: 0, differ: 0 });
    const one = setup(); expect(go(one.ai, goalMenu(calm(), chooseGoal, limits))).toBe('idle'); expect(one.asks.length).toBe(0); expect(one.ai.entries.length).toBe(0);
    const f = setup(); expect(go(f.ai, emergencyMenu())).toBe('drink'); expect(f.ai.entries[0]).toMatchObject({ used: 'rules', why: 'forced', override: expect.any(String) }); expect(f.asks.length).toBe(0);
    const n = setup(); expect(go(n.ai, hungryMenu())).toBe('drink'); expect(n.ai.entries[0]).toMatchObject({ used: 'rules', why: 'need', rules: 'drink' }); expect(n.asks.length).toBe(0); expect(n.ai.waiting()).toBe(false);
    const b = setup(); b.st.can = false; expect(go(b.ai)).toBe('stores'); expect(b.ai.entries[0]).toMatchObject({ used: 'rules', why: 'budget' }); expect(b.asks.length).toBe(0);
  });
  it('with no plan it asks at the decision, waits (WAIT), and uses the plan when it lands: the first step is taken, the entry says which step, the wait and the model', async () => {
    const { ai, t, asks } = setup();
    expect(go(ai)).toBe(WAIT); expect(asks.length).toBe(1); expect(ai.waiting()).toBe(true); expect(ai.inFlight()).toBe(true); expect(ai.entries.length).toBe(0); expect(ai.asking()).toBe('no plan yet');
    t.s += 0.4; expect(go(ai)).toBe(WAIT); expect(asks.length).toBe(1);
    const q = asks[0][1].content; expect(q).toContain('Why you are asked for a new plan: no plan yet.'); expect(q).toContain('- stores:'); expect(q).toContain('- fish:'); expect(q).toContain('How much leash: STRICT'); expect(asks[0][0].role).toBe('system');
    await flush(); t.s += 0.2;
    expect(go(ai)).toBe('stores'); expect(ai.waiting()).toBe(false); expect(ai.asking()).toBeNull();
    expect(ai.entries.find(e => !e.note)).toMatchObject({ used: 'ai', ai: 'stores', rules: 'stores', point: 'goal', reason: 'because stores', ms: 600, model: 'gemini-x', plan: { i: 1, n: 5 }, menu: ['stores', 'idle'] });
    expect(ai.entries.find(e => !e.note).messages.length).toBe(2); expect(ai.entries.some(e => e.planNote && /New plan \(no plan yet\): stores, home, stroll, linger, fire/.test(e.note))).toBe(true);
    expect(ai.plan().steps.map(s => s.state)).toEqual(['done', 'now', 'next', 'next', 'next']); expect(ai.plan()).toMatchObject({ trigger: 'no plan yet', reason: 'A plan.', late: false });
  });
  it('follows the plan with no request: a goal step, free time as the way to a pastime step, the steps the pastime point takes, a short pastime on the way to a goal step', async () => {
    const s = setup(); await planned(s);   // stores taken
    s.t.s += 1; expect(go(s.ai)).toBe('idle'); expect(s.ai.entries[0]).toMatchObject({ used: 'ai', ai: 'idle', plan: { i: 2, n: 5 }, reason: expect.stringContaining('Free time first') });
    expect(pm(s.ai, dayMenu())).toBe('home'); expect(s.ai.entries[0]).toMatchObject({ used: 'ai', point: 'pastime', ai: 'home', rules: 'home', plan: { i: 2, n: 5 }, menu: ['home', 'stroll', 'linger'] });
    expect(pm(s.ai, dayMenu())).toBe('stroll'); expect(s.ai.entries[0]).toMatchObject({ ai: 'stroll', rules: 'home', plan: { i: 3, n: 5 } });   // (the AI's stroll against the rules' home)
    expect(pm(s.ai, dayMenu({ home: { ok: false } }))).toBe('linger'); expect(s.ai.entries[0]).toMatchObject({ ai: 'linger', rules: 'stroll', reason: 'because linger' });
    expect(pm(s.ai, dayMenu())).toBe('linger'); expect(s.ai.entries[0].reason).toContain('A short one first');   // the next step is a goal (fire): the short pastime first
    expect(s.ai.plan().steps[4].state).toBe('now'); expect(s.asks.length).toBe(1);
    s.t.s += 30; expect(go(s.ai)).toBe(WAIT); expect(s.asks.length).toBe(2); expect(s.ai.asking()).toBe('the plan is used up');   // fire is not on the goal menu: skipped; nothing is left
  });
  it('a goal step that is not on the menu is skipped (done or pointless), a pastime step is reached through free time, a day pastime waits through the first stage and a goal step through a short pastime', async () => {
    const s = setup({ reply: planOf('drink', 'home', 'stroll', 'drink', 'stores', 'linger') }); const m = quietMenu();   // no drink on this menu
    expect(go(s.ai, m)).toBe(WAIT); await flush(); s.t.s += 0.6;
    expect(go(s.ai, m)).toBe('idle'); expect(s.ai.entries[0]).toMatchObject({ ai: 'idle', reason: expect.stringContaining('on the way to') }); expect(s.ai.plan().steps[0].state).toBe('skipped'); expect(s.ai.plan().steps[1].state).toBe('now');
    expect(pm(s.ai, beforeMenu({ gaze: { ok: true } }))).toBe('onward'); expect(s.ai.entries[0].reason).toContain('On the way to'); expect(s.ai.entries[0].rules).toBe('gaze');   // 'home' is a day pastime: not the sunset
    expect(pm(s.ai, dayMenu())).toBe('home'); expect(pm(s.ai, dayMenu())).toBe('stroll');
    expect(pm(s.ai, dayMenu())).toBe('linger'); expect(s.ai.entries[0].reason).toContain('A short one first');   // the next step is a goal (drink): the short pastime first
    expect(s.ai.plan().steps[3].state).toBe('now'); expect(s.asks.length).toBe(1);
    expect(go(s.ai, hungryMenu())).toBe('drink'); expect(s.ai.plan().steps[3].state).toBe('done');   // strict: a need is the rules'; it is also the plan's step
  });
  it('a short way on to the step, asked again every step while he rests, is answered the same and logged once', async () => {
    const s = setup({ reply: planOf('home', 'stroll', 'linger') }); await planned(s);   // free time first, on the way to home
    const n = s.ai.entries.filter(e => !e.note).length;
    for (let i = 0; i < 20; i++) { s.t.s += 0.1; expect(go(s.ai)).toBe('idle'); }
    expect(s.ai.entries.filter(e => !e.note).length).toBe(n); expect(s.ai.tally().ai).toBe(1); expect(s.asks.length).toBe(1);
    s.t.s += 2; expect(go(s.ai)).toBe('idle'); expect(s.ai.entries.filter(e => !e.note).length).toBe(n + 1);   // a new moment: logged again
  });
  it('the next step cannot be taken at this point and there is no free time on the goal menu: the rules decide this one point and the step stays', async () => {
    const s = setup({ reply: planOf('home', 'stroll', 'linger') }); const m = goalMenu(calm({ nuts: 0 }), c => (c.cool && c.cool.stores ? 'fire' : 'stores'), limits);   // stores, fire: no idle
    expect(m.options.some(o => o.id === 'idle')).toBe(false);
    expect(go(s.ai, m)).toBe(WAIT); await flush(); s.t.s += 0.6; expect(go(s.ai, m)).toBe('stores'); expect(s.ai.entries[0]).toMatchObject({ used: 'rules', why: 'plan-hold' }); expect(s.ai.plan().steps[0].state).toBe('now');
  });
  it('asks for a new plan when the plan is used up, naming why', async () => {
    const s = setup({ reply: planOf('stores') }); await planned(s); s.t.s += 30;
    expect(go(s.ai)).toBe(WAIT); expect(s.asks.length).toBe(2); expect(s.asks[1][1].content).toContain('Why you are asked for a new plan: the plan is used up.'); expect(s.asks[1][1].content).toContain('Your previous plan: 1. stores (done)');
  });
  it('asks for a new plan when a new day begins (before dawn still counts as the day before)', async () => {
    const s = setup(); await planned(s); s.t.s += 30;
    s.clock.day = 4; s.clock.time = 0.1; expect(go(s.ai)).toBe('idle'); expect(s.asks.length).toBe(1);   // the same waking day: no new plan
    s.clock.time = 0.3; expect(go(s.ai)).toBe(WAIT); expect(s.asks[1][1].content).toContain('Why you are asked for a new plan: a new day begins.');
  });
  it('asks for a new plan after an event (stuck, no path, a goal dropped), telling the reason', async () => {
    const s = setup(); await planned(s); s.t.s += 30; go(s.ai);
    s.ai.chooser('event', eventMenu('stuck', 'drink'), ctxOf()); expect(go(s.ai)).toBe(WAIT); expect(s.asks[1][1].content).toContain('Why you are asked for a new plan: an event: he got stuck (drink).');
    const d = setup(); d.ai.chooser('event', eventMenu('dropped', 'idle'), ctxOf()); go(d.ai); expect(d.asks[0][1].content).toContain('Why you are asked for a new plan: an event: a goal was dropped (idle).');   // (no plan yet: the event is the reason it is told)
    const o = setup(); o.st.on = false; o.ai.chooser('event', eventMenu('stuck', 'drink'), ctxOf()); o.st.on = true; go(o.ai); expect(o.asks[0][1].content).toContain('no plan yet');   // (an event while the AI is off is not kept)
  });
  it('asks for a new plan when the next pastime step is not possible, telling what went wrong; within the gap the step is skipped instead', async () => {
    const s = setup({ reply: planOf('fish', 'stroll', 'linger') }); await planned(s, quietMenu());   // 'fish' is a pastime: free time first
    s.t.s += 30; const m = dayMenu({ fish: { ok: false } });
    expect(pm(s.ai, m)).toBe(WAIT); expect(s.asks.length).toBe(2); const q = s.asks[1][1].content;
    expect(q).toContain('Why you are asked for a new plan: the next step, fish, was not possible now (10:04 to 14:24, once a day, only with a spear).'); expect(q).toContain('Your previous plan: 1. fish (not reached)');
    const g = setup({ reply: planOf('fish', 'stroll', 'linger') }); await planned(g, quietMenu()); g.t.s += 2;   // asked 2.6 s ago: inside AI_REPLAN_GAP
    expect(pm(g.ai, dayMenu({ fish: { ok: false } }))).toBe('stroll'); expect(g.asks.length).toBe(1); expect(g.ai.plan().steps[0].state).toBe('skipped');
  });
  it('a new plan is not asked twice in AI_REPLAN_GAP seconds (the rules decide meanwhile), nor while a request runs (busy), nor past the budget', async () => {
    const s = setup({ reply: planOf('stores') }); await planned(s); s.ai.chooser('event', eventMenu('stuck', 'drink'), ctxOf());   // asked just now; an event wants a new plan
    expect(go(s.ai)).toBe('stores'); expect(s.ai.entries[0]).toMatchObject({ used: 'rules', why: 'waiting' }); expect(s.asks.length).toBe(1);
    s.t.s += 25; s.st.can = false; expect(go(s.ai)).toBe('stores'); expect(s.ai.entries[0].why).toBe('budget'); s.st.can = true; expect(go(s.ai)).toBe(WAIT); expect(s.asks.length).toBe(2);
    s.t.s += 0.1; const never = setup({ reply: () => new Promise(() => {}) }); go(never.ai); never.t.s += AI_WAIT + 0.1; expect(go(never.ai)).toBe('stores'); never.t.s += 25; expect(go(never.ai)).toBe('stores'); expect(never.ai.entries[0].why).toBe('busy'); expect(never.asks.length).toBe(1);
  });
  it('no answer within AI_WAIT seconds: the rules decide that one point; the plan that lands later is used for the next points', async () => {
    let resolve; const s = setup({ reply: () => new Promise(r => { resolve = r; }) });
    expect(go(s.ai)).toBe(WAIT); for (let i = 0; i < 5; i++) { s.t.s += 0.5; expect(go(s.ai)).toBe(WAIT); } s.t.s += AI_WAIT - 2.5 - 0.1; expect(go(s.ai)).toBe(WAIT); s.t.s += 0.2;
    expect(go(s.ai)).toBe('stores'); expect(s.ai.entries[0]).toMatchObject({ point: 'goal', used: 'rules', why: 'no answer', ai: null, ms: Math.round(AI_WAIT * 1000 + 100) }); expect(s.ai.waiting()).toBe(false); expect(s.ai.inFlight()).toBe(true);
    expect(whyText({ why: 'no answer' })).toBe(`no answer in ${AI_WAIT} s`);
    resolve({ text: JSON.stringify({ plan: [{ step: 'stores', reason: 'late but good' }, { step: 'home' }, { step: 'linger' }] }), ms: 5 }); await flush(); expect(s.ai.inFlight()).toBe(false); expect(s.ai.plan()).toMatchObject({ late: true });
    s.t.s += 0.1; expect(go(s.ai)).toBe('stores'); expect(s.ai.entries[0]).toMatchObject({ used: 'ai', reason: 'late but good', plan: { i: 1, n: 3 } }); expect(s.asks.length).toBe(1);
  });
  it('an error, an unusable answer, a plan with nothing usable: the rules decide, with the reason, and a note is logged', async () => {
    const e = setup({ reply: async () => { throw new Error('HTTP 500'); } }); go(e.ai); await flush(); expect(e.ai.entries[0].note).toContain('HTTP 500'); expect(go(e.ai)).toBe('stores'); expect(e.ai.entries[0]).toMatchObject({ used: 'rules', why: 'error: HTTP 500' });
    const g = setup({ reply: async () => ({ text: 'I would rest.', ms: 5 }) }); go(g.ai); await flush(); expect(g.ai.entries[0].note).toContain('could not be used'); expect(go(g.ai)).toBe('stores'); expect(g.ai.entries[0]).toMatchObject({ used: 'rules', why: 'error: no JSON object' });
    const w = setup({ reply: planOf('swim', 'dance') }); go(w.ai); await flush(); expect(go(w.ai)).toBe('stores'); expect(w.ai.entries[0].why).toMatch(/^error: no usable step/);
  });
  it('invalid plan parts are left out (and told in the note), a long plan is cut to 8, a bare choice is a plan of one step', async () => {
    const s = setup({ reply: planOf('swim', 'stores', 'idle', 'home', 'stroll', 'linger', 'fish', 'tide', 'axe', 'gaze', 'drink') }); await planned(s);
    expect(s.ai.plan().steps.length).toBe(8); expect(s.ai.entries.find(e => e.planNote).note).toContain('left out: swim, idle, drink');   // (an unknown step, and the ninth valid one cut)
    const c = setup({ reply: async () => ({ text: '{"choice":"stores","reason":"ok"}', ms: 5 }) }); expect(go(c.ai)).toBe(WAIT); await flush(); expect(go(c.ai)).toBe('stores'); expect(c.ai.plan().steps.length).toBe(1);
    expect(parsePlan('{"plan":[{"step":"drink"},{"step":"nope"}],"reason":"r"}')).toMatchObject({ ok: true, steps: [{ id: 'drink', reason: '' }], dropped: ['nope'], reason: 'r' });
    expect(parsePlan('{"plan":"x"}').ok).toBe(false); expect(parsePlan('').ok).toBe(false); expect(parsePlan('{"plan":["drink","eat"]}').steps.length).toBe(2);
    expect(parsePlan('```json\n{"plan":[{"step":"fish","reason":"r"}]}\n```').steps[0].id).toBe('fish');
  });
  it('a decision abandoned while waiting starts afresh, but its request goes on and its plan is kept', async () => {
    const s = setup(); expect(go(s.ai)).toBe(WAIT); s.t.s += 5; await flush(); expect(go(s.ai)).toBe('stores'); expect(s.asks.length).toBe(1); expect(s.ai.plan().steps.length).toBe(5);
  });
  it('a pastime decision: the rules (they draw from the streams) are asked once while he waits; a plan step that is the rules\' own stroll keeps its kind', async () => {
    const s = setup({ reply: planOf('stroll', 'linger', 'home') }); const m = dayMenu({ home: { ok: false } });
    expect(pm(s.ai, m)).toBe(WAIT); expect(s.rulesCalls.length).toBe(1); s.t.s += 0.3; expect(pm(s.ai, m)).toBe(WAIT); expect(s.rulesCalls.length).toBe(1);
    await flush(); s.t.s += 0.4; expect(pm(s.ai, m)).toEqual({ id: 'stroll', kind: 'shore' }); expect(s.ai.entries.find(e => !e.note)).toMatchObject({ point: 'pastime', used: 'ai', ai: 'stroll', rules: 'stroll', menu: ['stroll', 'linger'] });
    expect(s.asks[0][1].content).toContain('[possible now]'); expect(s.asks[0][1].content).toContain('- home: ');
  });
  it('a plan step the AI took that is no longer possible is never returned: the rules decide again if their own answer is gone', async () => {
    let up = true; const s = setup({ reply: async () => ({ text: 'nonsense', ms: 5 }) }), m = dayMenu({ home: { ok: () => up } });
    pm(s.ai, m); await flush(); up = false; expect(pm(s.ai, m)).toEqual({ id: 'stroll', kind: 'shore' }); expect(s.ai.entries[0]).toMatchObject({ rules: 'home', used: 'rules' });
  });
  it('option texts are plain words, for the prompt and the log; "Now" says what he is doing', () => {
    expect(describeOption(hungryMenu().options[0]).what).toBe(GOAL_TEXT.drink); expect(describeOption({ id: 'home', goal: 'idle', what: 'work on his home', why: 'home-next' })).toEqual({ what: PASTIME_TEXT.home, label: 'work on his home', why: 'a part of the home is next' });
    const o = optionsOf(hungryMenu()); expect(o.map(x => x.what)).toEqual(hungryMenu().options.map(x => GOAL_TEXT[x.id])); expect(o.find(x => x.id === 'idle').why).toBe('nothing is pressing');
    expect(snapshotOf({}, { goal: 'idle', recent: [{ kind: 'pastime', what: 'work on his home', outcome: null }] }).doing).toBe('free time, work on his home'); expect(snapshotOf({}, { goal: 'drink', recent: [] }).doing).toBe(GOAL_TEXT.drink);
  });
  it('keeps the newest 100 entries, newest first, and counts changes in version', () => {
    const { ai } = setup(); const v = ai.version;
    for (let i = 0; i < 130; i++) go(ai, hungryMenu());
    expect(ai.entries.length).toBe(100); expect(ai.entries[0].n).toBe(130); expect(ai.entries[99].n).toBe(31); expect(ai.version).toBeGreaterThan(v);
  });
});

describe('the leash: overrides and modes (0.36.3)', () => {
  const planOf = (...ids) => async () => ({ text: JSON.stringify({ plan: ids.map(step => ({ step })) }), ms: 50 });
  const make = (mode, vit = {}) => {
    const t = { s: 1000 }, asks = [], st = { thirst: 0.2, hunger: 0.3, awake: 0.3, ...vit };
    const ai = createAiChooser({ rulesChooser, ask: m => { asks.push(m); return planOf('stores', 'home', 'linger')(); }, now: () => t.s, clock: () => ({ day: 3, time: 0.5 }), mode: () => mode });
    ai.attach({ recent: [], menu: () => quietMenu() }, { clock: { day: 3, time: 0.5 }, thirst: { days: st.thirst }, hunger: { days: st.hunger }, sleep: { awake: st.awake } });
    return { ai, t, asks };
  };
  it('the modes are subsets of one named list, in force in order: strict all but critical, loose forced and critical, free none', () => {
    expect(OVERRIDES.map(o => o.id)).toEqual(['forced', 'safety', 'need', 'critical']); for (const o of OVERRIDES) { expect(typeof o.test).toBe('function'); expect(o.points.length).toBeGreaterThan(0); }
    expect(overridesFor('strict').map(o => o.id)).toEqual(['forced', 'safety', 'need']); expect(overridesFor('loose').map(o => o.id)).toEqual(['forced', 'critical']); expect(overridesFor('free')).toEqual([]);
    expect(overridesFor('nonsense').map(o => o.id)).toEqual(['forced', 'critical']); expect(MODES.loose).toEqual(['forced', 'critical']);
    expect(AI_MODES).toEqual(['strict', 'loose', 'free']); expect(AI_MODE_DEFAULT).toBe('loose');
  });
  it('the critical levels are the game\'s own constants near the collapse', () => {
    expect(CRITICAL).toEqual({ thirst: REVIVE_AT, hunger: STARVING_AT, awake: AWAKE_MAX - AI_AWAKE_MARGIN }); expect(CRITICAL.thirst).toBeLessThan(COLLAPSE_AT); expect(CRITICAL.thirst).toBeGreaterThan(VERY_AT); expect(CRITICAL.awake).toBeLessThan(AWAKE_MAX);
  });
  it('strict: a need is the rules\' (no request), as before', () => {
    const s = make('strict'); expect(go(s.ai, hungryMenu())).toBe('drink'); expect(s.ai.entries[0]).toMatchObject({ why: 'need', used: 'rules' }); expect(s.asks.length).toBe(0);
  });
  it('loose: the AI is asked even when the rules\' pick is a need; at the brink (thirst, hunger, tiredness) the rules overrule, logged with the plain reason', () => {
    const s = make('loose'); expect(go(s.ai, hungryMenu())).toBe(WAIT); expect(s.asks.length).toBe(1);
    for (const [vit, word] of [[{ thirst: 1.3 }, 'just before the collapse'], [{ hunger: 3 }, 'starving'], [{ awake: 1.3 }, 'exhausted']]) {
      const b = make('loose', vit); expect(go(b.ai, hungryMenu())).toBe('drink'); expect(b.asks.length).toBe(0);
      expect(b.ai.entries[0]).toMatchObject({ used: 'rules', why: 'critical' }); expect(b.ai.entries[0].override).toContain(word);
      const p = b.ai.chooser('pastime', pastimeMenu('day', { home: { ok: true } }), ctxOf()); expect(p).toBe('home'); expect(b.ai.entries[0]).toMatchObject({ point: 'pastime', why: 'critical' });   // at the pastime point too
    }
    const ok = make('loose', { thirst: 1.2, hunger: 2.9, awake: 1.24 }); expect(go(ok.ai, hungryMenu())).toBe(WAIT);   // just under the levels
  });
  it('loose: a forced option (an emergency at the goal menu) is still the rules\'; the ember is not (the fire going out is a consequence)', () => {
    const f = make('loose'); expect(go(f.ai, emergencyMenu())).toBe('drink'); expect(f.ai.entries[0]).toMatchObject({ why: 'forced' }); expect(f.asks.length).toBe(0);
    const e = make('loose'); expect(e.ai.chooser('pastime', pastimeMenu('before', { gaze: { ok: true }, ember: { ok: true } }), ctxOf())).toBe(WAIT); expect(e.asks.length).toBe(1);
    const st = make('strict'); expect(st.ai.chooser('pastime', pastimeMenu('before', { gaze: { ok: true }, ember: { ok: true } }), ctxOf())).toBe('gaze'); expect(st.ai.entries[0]).toMatchObject({ why: 'safety' });
  });
  it('the leash also says whether a higher want may stop the goal that is running: strict yes, free no, loose only at the brink, the AI off yes', () => {
    const at = (mode, vit = {}, on = true) => { const s = make(mode, vit); return s.ai.chooser.allowPreempt('idle', 'drink'); };
    expect(at('strict')).toBe(true); expect(at('free')).toBe(false); expect(at('free', { thirst: 1.5 })).toBe(false); expect(at('loose')).toBe(false); expect(at('loose', { thirst: 1.3 })).toBe(true); expect(at('loose', { awake: 1.3 })).toBe(true); expect(at('loose', { thirst: 1.0, hunger: 2 })).toBe(false);
    const off = createAiChooser({ rulesChooser, ask: async () => ({}), enabled: () => false, mode: () => 'free' }); expect(off.chooser.allowPreempt('idle', 'drink')).toBe(true);
  });
  it('free: nothing overrules, a forced option is just an option, even at the brink', async () => {
    const s = make('free', { thirst: 1.45, hunger: 3, awake: 1.49 }); const m = emergencyMenu();
    expect(go(s.ai, m)).toBe(WAIT); await flush(); s.t.s += 0.1; expect(go(s.ai, m)).not.toBe('drink');   // the plan's own step, not the forced drink
    expect(s.ai.entries.find(e => !e.note)).toMatchObject({ used: 'ai', rules: 'drink' });
  });
  it('an overruled entry says what the plan was on, and the panel shows it as overruled', async () => {
    const s = make('loose'); go(s.ai); await flush(); s.t.s += 0.1; go(s.ai);   // 'stores' taken, 'idle' is next
    s.ai.attach({ recent: [], menu: () => quietMenu() }, { clock: { day: 3, time: 0.5 }, thirst: { days: 1.3 }, hunger: { days: 0 }, sleep: { awake: 0 } });
    go(s.ai, hungryMenu()); const e = s.ai.entries[0]; expect(e).toMatchObject({ why: 'critical', planned: 'work on his home' });
    expect(blockParts(e)).toMatchObject({ tag: 'overruled', why: expect.stringMatching(/^Overruled: just before the collapse/), rulesLine: "The plan's next step was: work on his home" });
  });
  it('the leash is kept by the client in storage (not in the save), default loose, a bad name ignored', () => {
    const st = fakeStorage(), c = createClient({ fetch: async () => okResponse('x'), storage: st });
    expect(c.mode()).toBe('loose'); c.setMode('free'); expect(c.mode()).toBe('free'); expect(st.dump()[MODE_NAME]).toBe('free'); c.setMode('wild'); expect(c.mode()).toBe('free');
    expect(createClient({ fetch: async () => okResponse('x'), storage: fakeStorage({ [MODE_NAME]: 'strict' }) }).mode()).toBe('strict'); expect(createClient({ fetch: async () => okResponse('x'), storage: fakeStorage({ [MODE_NAME]: 'zzz' }) }).mode()).toBe('loose');
  });
  it('the request: the plan menu with what is possible now and not yet, the previous plan, the leash and the consequences', () => {
    const m = buildPlanMessages({ state: { day: 3, time: 0.5, carries: {} }, recent: [], trigger: 'the plan is used up', previous: [{ id: 'fish', state: 'done' }, { id: 'home', state: 'not reached' }], possible: { goals: new Set(['stores']), pastimes: null }, mode: 'free' });
    const u = m[1].content; expect(m[0].content).toBe(FIXED);
    expect(u).toContain('Why you are asked for a new plan: the plan is used up.'); expect(u).toContain('Your previous plan: 1. fish (done), 2. home (not reached)'); expect(u).toContain('How much leash: FREE.');
    expect(u).toMatch(/- stores: .*\[possible now\]/); expect(u).toMatch(/- drink: .*\[not possible now, maybe later\]/); expect(u).toMatch(/- gaze: .*\[not now: outside its hours\]/); expect(u).toMatch(/- stroll: .*\[its hours are open now\]/); expect(u).toContain('Make a plan of 3 to 8 steps');
    for (const id of PLAN_STEPS) expect(u).toContain(`- ${id}: `);
    for (const [mode, w] of [['strict', 'STRICT'], ['loose', 'LOOSE']]) expect(buildPlanMessages({ state: {}, recent: [], mode })[1].content).toContain(w);
    expect(MODE_TEXT.loose).toContain(String(CRITICAL.thirst)); expect(MODE_TEXT.strict).toContain('whatever you plan');
    for (const w of ['collapses where he stands', 'cold; he wakes after 3 hours', 'burns out', 'falls asleep where he stands', 'never dies', '"plan"']) expect(FIXED).toContain(w);
    expect(FIXED).toContain(`At ${COLLAPSE_AT} days without a drink`); expect(FIXED).toContain('His habit is to go and drink at 0.35'); expect(FIXED).toContain('20:52'); expect(FIXED).toContain('at 2 it is an emergency');
    expect(hoursOpen('gaze', 0.8)).toBe(true); expect(hoursOpen('gaze', 0.5)).toBe(false); expect(hoursOpen('drink', 0.5)).toBe(true); expect(stepLabel('fish')).toBe('fish'); expect(stepLabel('idle')).toBe('free time');
    expect(m[0].content.length + u.length).toBeLessThan(14000);
  });
  it('the prompt: the daylight and the distance from home, the plain pastime texts', () => {
    const s = snapshotOf({ clock: { day: 2, time: 0.5 }, player: { x: 13, z: 14 } }, { home: () => ({ x: 10, z: 10 }), goal: 'idle', recent: [] });
    expect(s.fromHome).toBeCloseTo(5, 5); expect(s.daylight).toBeCloseTo((DUSK - 0.5) * 24, 5);
    expect(stateText(s)).toContain('hours of daylight left'); expect(stateText(s)).toContain('5 m from his camp'); expect(stateText({ ...s, time: 0.95, daylight: 0 })).toContain('It is dark.'); expect(snapshotOf({ clock: { day: 1, time: 0.9 } }, {}).daylight).toBe(0);
    for (const id of Object.keys(PASTIMES)) expect(PASTIME_TEXT[id], id).toBeTruthy();
  });
});

describe('typing and the panel', () => {
  it('a key typed into a field is not for the game', () => {
    const field = { tagName: 'INPUT' };
    expect(isTyping({ target: field })).toBe(true); expect(isTyping({ target: { tagName: 'CANVAS' } })).toBe(false); expect(isTyping({})).toBe(false);
    const a = createActing();
    expect(a.event({ type: 'keydown', code: 'KeyW' })).toBe(true); expect(a.event({ type: 'keydown', code: 'KeyW', target: field })).toBe(false);
    expect(a.event({ type: 'keydown', code: 'Space', target: field })).toBe(false);
  });
  it('I is a plain, passive key that the field does not feed', () => {
    expect(PASSIVE_CODES.has('KeyI')).toBe(true);
    expect(isAiKey({ code: 'KeyI' })).toBe(true); expect(isAiKey({ code: 'KeyI', repeat: true })).toBe(false); expect(isAiKey({ code: 'KeyI', ctrlKey: true })).toBe(false);
    expect(isAiKey({ code: 'KeyI', target: { tagName: 'INPUT' } })).toBe(false); expect(isAiKey({ code: 'KeyO' })).toBe(false);
    expect(createActing().event({ type: 'keydown', code: 'KeyI' })).toBe(false);
  });
  it('0.36.3: the plan with a marker at the current step, why it was asked, the overruled block and the leash text', () => {
    const plan = { day: 3, time: '14:20', trigger: 'the plan is used up', late: false, reason: 'A calm afternoon.', steps: [{ id: 'stores', label: 'gather supplies', reason: 'low on nuts', state: 'done' }, { id: 'home', label: 'work on his home', reason: '', state: 'now' }, { id: 'drink', label: 'drink', reason: 'before dusk', state: 'next' }, { id: 'fish', label: 'fish', reason: '', state: 'skipped' }] };
    expect(planLines(plan)).toEqual([{ marker: 'x', state: 'done', text: '1. gather supplies — low on nuts' }, { marker: '>', state: 'now', text: '2. work on his home' }, { marker: ' ', state: 'next', text: '3. drink — before dusk' }, { marker: '-', state: 'skipped', text: '4. fish' }]);
    expect(planHead(plan)).toBe('Plan from day 3, 14:20 (asked because: the plan is used up)'); expect(planHead({ ...plan, late: true })).toContain('came late'); expect(planHead(null)).toBe('No plan yet.'); expect(planLines(null)).toEqual([]);
    const o = { day: 3, time: '15:00', used: 'rules', why: 'critical', override: 'just before the collapse: thirst has reached 1.30 days (it collapses at 1.5)', planned: 'fish', rules: 'drink', options: [{ id: 'drink', what: 'drink' }, { id: 'stores', what: 'gather supplies' }], point: 'goal' };
    expect(blockParts(o)).toMatchObject({ source: 'rules', tag: 'overruled', head: 'Day 3, 15:00 — Rules chose: drink', why: 'Overruled: just before the collapse: thirst has reached 1.30 days (it collapses at 1.5)', rulesLine: "The plan's next step was: fish" });
    expect(blockParts({ ...o, override: null, why: 'no answer' })).toMatchObject({ tag: '', why: `Why not the AI: no answer in ${AI_WAIT} s` });
    expect(blockParts({ day: 3, time: '15:00', used: 'ai', ai: 'home', rules: 'home', plan: { i: 2, n: 5 }, model: 'm', ms: null, options: [{ id: 'home', what: 'work on his home' }] }).meta).toBe('step 2 of 5 of the plan · m');
    expect(whyText({ why: 'waiting' })).toContain('a moment ago'); expect(whyText({ why: 'critical' })).toContain('brink'); expect(whyText({ why: 'plan-hold' })).toContain('later');
    expect(modeLine('strict')).toContain('needs, the fire'); expect(modeLine('loose')).toContain('brink'); expect(modeLine('free')).toContain('nothing overrules'); expect(modeLine('x')).toBe('');
  });
  it('plain text for a decision block, the reasons, the tally, the status, the models and the pending answer', () => {
    const options = [{ id: 'drink', what: 'drink' }, { id: 'wood', what: 'fetch wood for the fire' }, { id: 'stores', what: 'fill the store' }];
    const ai = { day: 3, time: '14:20', used: 'ai', ai: 'wood', rules: 'drink', reason: 'The fire is low.', ms: 1234, model: 'gemini-x', options, menu: ['drink', 'wood', 'stores'] };
    expect(blockParts(ai)).toEqual({ source: 'ai', kind: 'goal', kindLabel: 'goal', head: 'Day 3, 14:20 — AI chose: fetch wood for the fire', tag: 'different from the rules', reason: '"The fire is low."',
      rulesLine: 'The rules would have chosen: drink', optionsLine: 'Options were: drink, fetch wood for the fire, fill the store', meta: 'gemini-x · answered in 1.2 s', why: '' });
    expect(blockParts({ ...ai, rules: 'wood' }).tag).toBe('');
    expect(blockParts({ day: 3, time: '14:35', used: 'rules', why: 'no answer', ai: null, rules: 'stores', options })).toMatchObject({ source: 'rules', head: 'Day 3, 14:35 — Rules chose: fill the store', tag: '', why: `Why not the AI: no answer in ${AI_WAIT} s`, rulesLine: '', optionsLine: '' });
    expect(blockParts({ used: 'rules', rules: 'x', why: 'forced' }).head).toBe('Day ?, --:-- — Rules chose: x');
    expect(whyText({ why: 'off' })).toBe('the AI is off'); expect(whyText({ why: 'busy' })).toBe('the earlier request is still running'); expect(whyText({ why: 'budget' })).toBe('the budget is spent');
    expect(whyText({ why: 'forced' })).toBe('an emergency: the rules decide'); expect(whyText({ why: 'error: HTTP 500' })).toBe('the request failed: HTTP 500');
    expect(whyText({ why: 'not on menu', ai: 'wood', options })).toBe("the AI's choice is not possible now (it chose: fetch wood for the fire)");
    expect(tallyLine({ ai: 5, rules: 3, differ: 2 })).toBe('Since the page was loaded: 5 by the AI, 3 by the rules, 2 different from the rules');
    const s = { on: true, hasKey: true, inFlight: true, pausedUntil: 10000, lastError: 'HTTP 500', models: [{ model: 'a', today: 5, perDay: 900, lastMinute: 2, perMin: 12, pausedUntil: 10000, dead: false, lastError: 'HTTP 429' }, { model: 'b', today: 0, perDay: 900, lastMinute: 0, perMin: 12, pausedUntil: 0, dead: true, lastError: null }] };
    expect(statusLine(s, 0)).toBe('The AI is on · asking... · all models are paused, the next is back in 10 s · last error: HTTP 500');
    expect(statusLine({ ...s, on: false, inFlight: false, pausedUntil: 0, lastError: null }, 0)).toBe('The AI is off');
    const ml = modelLines(s, 0);
    expect(ml[0]).toMatch(/^a: 5 of 900 today, 2 of 12 this minute · paused until \d\d:\d\d · last error: HTTP 429$/); expect(ml[1]).toBe('b: 0 of 900 today, 0 of 12 this minute · not available (model not found)');
    expect(pendingLine(true, true)).toBe('Dave is waiting for the AI...'); expect(pendingLine(false, true)).toBe('An earlier request is still running'); expect(pendingLine(false, false)).toBe('Not asking now');
    expect(requestText([{ role: 'system', content: 'S' }, { role: 'user', content: 'U' }], '{"choice":"eat"}')).toBe('[system]\nS\n\n[user]\nU\n\n[answer]\n{"choice":"eat"}');
  });

});

const sig = r => JSON.stringify({ ticks: r.ticks, events: r.events, maxThirst: r.maxThirst, maxHunger: r.maxHunger, eaten: r.eaten, sleeps: r.sleeps, errors: r.errors, homeDay: r.homeDay, drinks: r.drinks, fires: r.fires });

describe('lives with the AI chooser (fake ask, no network)', () => {
  let w, spawn;
  beforeAll(async () => { w = await generateWorld(1337); spawn = startSpot(w); }, 120000);

  const makeAi = (pick, calls = [], mode = () => 'loose') => {   // pick(ids) -> the ids of the plan
    const t = { s: 0 };
    const ai = createAiChooser({ rulesChooser, mode, now: () => t.s, ask: async messages => { calls.push(messages); const ids = [...messages[1].content.matchAll(/^- (\w+):/gm)].map(m => m[1]); return { text: JSON.stringify({ plan: pick(ids).map(step => ({ step, reason: 'Fake.' })), reason: 'A fake plan.' }), ms: 5 }; } });
    return { ai, t, calls };
  };
  async function life(chooserOf, days) {
    const game = createGame(w, spawn, {});
    walkFirstDay(w, game, spawn, {}); game.known.visit(spawn.x, spawn.z);
    const { ai, t, calls } = chooserOf;
    const mind = createMind(w, game, { chooser: ai ? ai.chooser : undefined });
    if (ai) ai.attach(mind, game);
    mind.engage();
    const end = game.clock.total + days; let n = 0, waits = 0, still = 0;
    while (game.clock.total < end) {
      const x = game.player.x, z = game.player.z;
      mind.step(0.1); game.update(mind.input, 0.1); t.s += 0.1;
      if (mind.waiting) { waits++; if (Math.hypot(game.player.x - x, game.player.z - z) < 1e-6) still++; }
      if (ai && ++n % 3 === 0) await flush();
    }
    return { game, mind, ai, calls, waits, still };
  }

  it('runs on with a plan of every step in the list order: Dave waits for the plan, follows it and never errors', async () => {
    const r = await life(makeAi(ids => ids.slice(0, 8)), 1);
    expect(r.mind.stats.errors || 0).toBe(0); expect(r.calls.length).toBeGreaterThan(0);
    expect(r.calls[0][1].content).toContain('Day '); expect(r.calls[0][1].content).toContain('The situation now');
    const used = r.ai.entries.filter(e => e.used === 'ai');
    expect(used.length).toBeGreaterThan(0); for (const e of used) expect(e.menu).toContain(e.ai);
    expect(r.ai.entries.filter(e => e.point && e.point !== 'goal' && e.point !== 'pastime').length).toBe(0);
    expect(r.ai.entries.some(e => e.point === 'pastime')).toBe(true); for (const e of r.ai.entries.filter(x => x.point === 'pastime' && x.used === 'ai')) expect(e.menu).toContain(e.ai);
    expect(r.waits).toBeGreaterThan(0); expect(r.still).toBe(r.waits);   // he stood where he was while waiting
    expect(r.game.thirst.days).toBeLessThan(1.6); expect(r.ai.plan()).not.toBeNull(); expect(r.calls.length).toBeLessThan(40);   // a plan lasts: far fewer requests than decisions
  }, 180000);

  it('survives an AI that answers nonsense and one that never answers (he waits AI_WAIT seconds at each decision, then the rules decide)', async () => {
    const g = await life(makeAi(() => ['dance']), 0.4);
    expect(g.mind.stats.errors || 0).toBe(0); expect(g.ai.entries.filter(e => e.point).every(e => e.used === 'rules')).toBe(true);
    const t = { s: 0 }, ai = createAiChooser({ rulesChooser, now: () => t.s, ask: () => new Promise(() => {}) });
    const n = await life({ ai, t, calls: [] }, 0.4);
    expect(n.mind.stats.errors || 0).toBe(0); expect(n.ai.entries.some(e => e.why === 'no answer')).toBe(true); expect(n.ai.entries.every(e => e.used === 'rules')).toBe(true); expect(n.waits).toBeGreaterThan(0);
    for (const e of n.ai.entries.filter(x => x.why === 'no answer')) expect(e.ms).toBeGreaterThanOrEqual(AI_WAIT * 1000);
  }, 180000);

  it('a chooser that says WAIT for some steps: the mind keeps running, no goal starts until it answers, and WAIT at the event point is the rules\'', () => {
    const game = createGame(w, spawn, {}); walkFirstDay(w, game, spawn, {}); game.known.visit(spawn.x, spawn.z);
    let left = 25, calls = 0, eventWaits = 0;
    const chooser = (point, menu, ctx) => {
      if (point === 'goal') { calls++; if (left-- > 0) return WAIT; return rulesChooser(point, menu, ctx); }
      if (point === 'event') { eventWaits++; return WAIT; }   // not allowed: counts as invalid, the rules answer
      return rulesChooser(point, menu, ctx);
    };
    const mind = createMind(w, game, { chooser }); mind.engage();
    let waiting = 0, firstGoal = -1;
    for (let i = 0; i < 6000 && firstGoal < 0; i++) { mind.step(0.1); game.update(mind.input, 0.1); if (mind.waiting) waiting++; if (mind.goal && firstGoal < 0) firstGoal = i; }
    expect(waiting).toBe(25); expect(calls).toBeGreaterThanOrEqual(26); expect(firstGoal).toBeGreaterThan(24); expect(mind.waiting).toBe(false);
    for (let i = 0; i < 6000; i++) { mind.step(0.1); game.update(mind.input, 0.1); }
    expect(mind.stats.errors || 0).toBe(0); expect(eventWaits).toBeGreaterThanOrEqual(0);
  }, 120000);

  it('0.36.3: a chooser that says WAIT at the pastime point: he stands where he is, counts no idle seconds, gets the same menu again, then goes on', () => {
    const game = createGame(w, spawn, {}); walkFirstDay(w, game, spawn, {}); game.known.visit(spawn.x, spawn.z);
    const seen = []; let left = 0, waits = 0, decisions = 0;
    const chooser = (point, menu, ctx) => {
      if (point !== 'pastime') return rulesChooser(point, menu, ctx);
      if (left === 0 && seen.length && seen[seen.length - 1] === menu) { left = -1; return rulesChooser(point, menu, ctx); }   // (answered: the next call is a new decision)
      if (!seen.includes(menu)) { seen.push(menu); left = 15; decisions++; }
      if (left > 0) { left--; waits++; return WAIT; }
      return rulesChooser(point, menu, ctx);
    };
    const mind = createMind(w, game, { chooser }); mind.engage();
    let still = 0, waited = 0, idleWhileWaiting = 0, sawWaiting = 0;
    for (let i = 0; i < 12000; i++) {
      const x = game.player.x, z = game.player.z, was = mind.waiting, idle0 = mind.stats.idleSecs;
      mind.step(0.1); game.update(mind.input, 0.1);
      if (mind.waiting && mind.goal === 'idle') sawWaiting++;
      if (was && mind.waiting) { waited++; if (Math.hypot(game.player.x - x, game.player.z - z) < 1e-6) still++; idleWhileWaiting += mind.stats.idleSecs - idle0; }
    }
    expect(waits).toBeGreaterThan(30); expect(decisions).toBeGreaterThan(3); expect(sawWaiting).toBeGreaterThan(0); expect(waited).toBeGreaterThan(0);
    expect(still).toBe(waited); expect(idleWhileWaiting).toBe(0);
    expect(mind.stats.errors || 0).toBe(0); expect(mind.waiting === true || mind.waiting === false).toBe(true);
    expect(mind.recent.some(r => r.kind === 'pastime')).toBe(true);
  }, 120000);

  it('0.36.3: an AI that makes random plans keeps Dave alive for four days in the default (loose) leash: no error, no collapse, pastime decisions are logged as such, few requests', async () => {
    let seedR = 7; const rnd = () => (seedR = (seedR * 1664525 + 1013904223) >>> 0) / 4294967296;
    const r = await life(makeAi(ids => Array.from({ length: 3 + Math.floor(rnd() * 6) }, () => ids[Math.floor(rnd() * ids.length)])), 4);
    expect(r.mind.stats.errors || 0).toBe(0); expect(r.game.thirst.days).toBeLessThan(1.5); expect(r.game.hunger.days).toBeLessThan(2.5);
    expect(r.game.sleep.asleep || r.game.clock.day >= 4).toBe(true);
    const past = r.ai.entries.filter(e => e.point === 'pastime');
    expect(past.length).toBeGreaterThan(5); expect(past.some(e => e.used === 'ai')).toBe(true);
    for (const e of past) { expect(e.menu.length).toBeGreaterThanOrEqual(2); expect(e.options.length).toBe(e.menu.length); }
    expect(r.calls.length / 4).toBeLessThan(25); expect(r.calls.some(m => m[1].content.includes('Why you are asked for a new plan: a new day begins'))).toBe(true);
    expect(r.still).toBe(r.waits);
  }, 300000);

  it('the AI chooser switched off gives exactly the default chooser\'s life (the rules\' streams are drawn once)', () => {
    const a = runMind(w, spawn, { days: 0.4, know: true });
    const ai = createAiChooser({ rulesChooser, ask: async () => { throw new Error('never'); }, enabled: () => false });
    const b = runMind(w, spawn, { days: 0.4, know: true, chooser: ai.chooser });
    expect(sig(b)).toBe(sig(a));
  }, 120000);
});
