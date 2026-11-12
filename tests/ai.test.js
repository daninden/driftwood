// The optional language-model chooser (src/ai, 0.36 "Mind"): the prompt and the answer parser (pure), the client (fake fetch and fake storage, no network ever), the chooser (fake `ask`), the typing guard of the
// keyboard, the panel's pure helpers, and lives of the mind with the AI chooser wired to a fake ask. The key of the player is never in any string that leaves the client.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { createMind, chooseGoal, VERY_AT, VERY_HUNGER_AT } from '../src/game/mind.js';
import { goalMenu, pastimeMenu, eventMenu, rulesChooser, choiceId, validChoice } from '../src/game/intent.js';
import { FIXED, hhmm, snapshotOf, stateText, recentText, optionsOf, buildMessages, parseAnswer } from '../src/ai/prompt.js';
import { createClient, pacificDay } from '../src/ai/client.js';
import { createAiChooser } from '../src/ai/chooser.js';
import { AI_PER_MIN, AI_PER_DAY, AI_FRESH, AI_ASK_EVERY, AI_MODELS, AI_URL, KEY_NAME, ON_NAME, COUNT_NAME } from '../src/ai/config.js';
import { isAiKey, entryLine, statusLine, modelLines, pendingLine, requestText } from '../src/render/aiPanel.js';
import { isTyping, createActing, PASSIVE_CODES } from '../src/game/input.js';
import { runMind, walkFirstDay } from './helpers/mindSim.js';

const KEY = 'AIza-SECRET-KEY-1234567890';
const calm = (o = {}) => ({ asleep: false, time: 0.4, thirst: 0.1, hunger: 0.1, awake: 0.3, canLie: false, water: true, waterNear: false, shellsEmpty: 0, shellsFull: 0, nuts: 2, fibre: 2, torch: false,
  fireLit: false, fireFuel: 0, stock: 99, spare: 0, canLight: false, cool: {}, ...o });
const limits = { thirst: VERY_AT, hunger: VERY_HUNGER_AT };
const hungryMenu = () => goalMenu(calm({ thirst: 0.5, hunger: 0.8 }), chooseGoal, limits);   // drink, eat, stores, idle
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
    expect(FIXED).toContain('"choice"'); expect(FIXED).toContain('thirst'); expect(FIXED).toContain('tide');
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
    expect(s).toMatchObject({ day: 4, raining: true, thirst: 0.2, hunger: 1, doing: 'the goal drink' });
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

describe('chooser', () => {
  const clockOf = () => ({ day: 3, time: 0.6 });
  const setup = (o = {}) => {
    const t = { s: 1000 }, asks = [];
    let reply = o.reply || (async () => ({ text: '{"choice":"eat","reason":"Hungry."}', ms: 800 }));
    const rulesCalls = [];
    const rules = (point, menu, ctx) => { rulesCalls.push(point); return rulesChooser(point, menu, ctx); };
    const state = { on: true, can: true };
    const ai = createAiChooser({ rulesChooser: rules, ask: m => { asks.push(m); return reply(m); }, now: () => t.s, canSend: () => state.can, enabled: () => state.on, clock: clockOf });
    const mind = { menu: () => o.menu ? o.menu() : hungryMenu(), recent: [{ t: 1.5, day: 1, kind: 'goal', what: 'drink', outcome: 'done' }], goal: 'stores' };
    return { ai, t, asks, mind, rulesCalls, state, setReply: f => { reply = f; } };
  };
  const game = { clock: { day: 3, time: 0.6 }, thirst: { days: 0.5 }, hunger: { days: 0.8 } };

  it('always calls the rules first, and answers non-goal points with the rules\' answer unchanged', () => {
    const { ai, rulesCalls } = setup();
    const pm = pastimeMenu('before', { gaze: true });
    expect(ai.chooser('pastime', pm, ctxOf())).toBe('gaze'); expect(ai.chooser('event', eventMenu('stuck', 'drink'), ctxOf())).toBe('continue');
    expect(rulesCalls).toEqual(['pastime', 'event']); expect(ai.entries.length).toBe(0);
    expect(ai.chooser.selfChecked).toBe(true);
  });
  it('off: the rules\' pick, logged with why "off"', () => {
    const { ai, rulesCalls, state } = setup(); state.on = false;
    expect(ai.chooser('goal', hungryMenu(), ctxOf())).toBe('drink'); expect(rulesCalls).toEqual(['goal']);
    expect(ai.entries[0]).toMatchObject({ used: 'rules', why: 'off', rules: 'drink', ai: null, day: 3, time: '14:24', menu: ['drink', 'eat', 'stores', 'idle'] });
  });
  it('no answer yet, then a fresh valid answer is used once and consumed', async () => {
    const { ai, mind, t, asks } = setup();
    expect(ai.chooser('goal', hungryMenu(), ctxOf())).toBe('drink'); expect(ai.entries[0]).toMatchObject({ used: 'rules', why: 'no answer yet' });
    ai.tick(mind, game); expect(asks.length).toBe(1); expect(ai.inFlight()).toBe(true);
    await flush(); expect(ai.inFlight()).toBe(false); expect(ai.pending()).toMatchObject({ id: 'eat', reason: 'Hungry.', ms: 800 });
    expect(ai.pending().messages[0].role).toBe('system'); expect(ai.pending().raw).toContain('eat');
    t.s += 10;
    expect(ai.chooser('goal', hungryMenu(), ctxOf())).toBe('eat');
    expect(ai.entries[0]).toMatchObject({ used: 'ai', why: null, ai: 'eat', rules: 'drink', reason: 'Hungry.', ms: 800, age: 10 }); expect(ai.entries[0].messages.length).toBe(2);
    expect(ai.pending()).toBeNull();
    expect(ai.chooser('goal', hungryMenu(), ctxOf())).toBe('drink'); expect(ai.entries[0]).toMatchObject({ used: 'rules', why: 'no answer yet' });
  });
  it('the log says which model answered', async () => {
    const { ai, mind } = setup({ reply: async () => ({ text: '{"choice":"eat","reason":"x"}', ms: 5, model: 'gemini-x' }) });
    ai.tick(mind, game); await flush(); expect(ai.pending().model).toBe('gemini-x');
    ai.chooser('goal', hungryMenu(), ctxOf()); expect(ai.entries[0]).toMatchObject({ used: 'ai', model: 'gemini-x' });
  });
  it('a stale answer, one not on the menu and a forced option all hand over to the rules, and say why', async () => {
    const s = setup(); s.ai.tick(s.mind, game); await flush();
    s.t.s += AI_FRESH + 1; expect(s.ai.chooser('goal', hungryMenu(), ctxOf())).toBe('drink'); expect(s.ai.entries[0]).toMatchObject({ used: 'rules', why: 'answer stale', ai: 'eat' });
    const n = setup(); n.ai.tick(n.mind, game); await flush();
    expect(n.ai.chooser('goal', goalMenu(calm(), chooseGoal, limits), ctxOf())).toBe('idle'); expect(n.ai.entries[0]).toMatchObject({ used: 'rules', why: 'not on menu', ai: 'eat' });
    const f = setup(); f.ai.tick(f.mind, game); await flush();
    expect(f.ai.chooser('goal', emergencyMenu(), ctxOf())).toBe('drink'); expect(f.ai.entries[0]).toMatchObject({ used: 'rules', why: 'forced' }); expect(f.ai.pending()).not.toBeNull();
  });
  it('asks ahead only when due: not for fewer than two options or a forced one, not off, not over budget, not twice while one is running, and about to go stale', async () => {
    const one = setup({ menu: () => goalMenu(calm(), chooseGoal, limits) }); one.ai.tick(one.mind, game); expect(one.asks.length).toBe(0);
    const forced = setup({ menu: emergencyMenu }); forced.ai.tick(forced.mind, game); expect(forced.asks.length).toBe(0);
    const off = setup(); off.state.on = false; off.ai.tick(off.mind, game); expect(off.asks.length).toBe(0);
    const bud = setup(); bud.state.can = false; bud.ai.tick(bud.mind, game); expect(bud.asks.length).toBe(0);
    expect(bud.ai.chooser('goal', hungryMenu(), ctxOf())).toBe('drink'); expect(bud.ai.entries[0].why).toBe('budget');
    const s = setup(); s.ai.tick(s.mind, game); s.ai.tick(s.mind, game); expect(s.asks.length).toBe(1);
    await flush(); s.t.s += AI_ASK_EVERY + 1; s.ai.tick(s.mind, game); expect(s.asks.length).toBe(1);   // a fresh pending answer is kept
    s.t.s += AI_FRESH - AI_ASK_EVERY; s.ai.tick(s.mind, game); expect(s.asks.length).toBe(2);   // about to go stale: asked again
  });
  it('an error or an answer that cannot be used is logged, nothing is pending, and the rules say why', async () => {
    const e = setup({ reply: async () => { throw new Error('HTTP 500'); } }); e.ai.tick(e.mind, game); await flush();
    expect(e.ai.pending()).toBeNull(); expect(e.ai.entries[0].note).toContain('HTTP 500');
    expect(e.ai.chooser('goal', hungryMenu(), ctxOf())).toBe('drink'); expect(e.ai.entries[0]).toMatchObject({ used: 'rules', why: 'error: HTTP 500' });
    const g = setup({ reply: async () => ({ text: 'I would eat.', ms: 5 }) }); g.ai.tick(g.mind, game); await flush();
    expect(g.ai.pending()).toBeNull(); expect(g.ai.entries[0].note).toContain('not usable');
    const w = setup({ reply: async () => ({ text: '{"choice":"swim"}', ms: 5 }) }); w.ai.tick(w.mind, game); await flush(); expect(w.ai.pending()).toBeNull();
  });
  it('keeps the newest 100 entries, newest first, and counts changes in version', () => {
    const { ai } = setup(); const v = ai.version;
    for (let i = 0; i < 130; i++) ai.chooser('goal', hungryMenu(), ctxOf());
    expect(ai.entries.length).toBe(100); expect(ai.entries[0].n).toBe(130); expect(ai.version).toBeGreaterThan(v);
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
  it('lines for the log, the status and the pending answer', () => {
    expect(entryLine({ day: 3, time: '14:24', used: 'ai', ai: 'eat', rules: 'drink', ms: 1234, model: 'gemini-x' })).toBe('d3 14:24  chose eat  (AI)  rules: drink  1.2s gemini-x');
    expect(entryLine({ day: 3, time: '14:24', used: 'rules', why: 'no answer yet', ai: null, rules: 'drink', ms: null })).toBe('d3 14:24  chose drink  (rules: no answer yet)  rules: drink');
    expect(entryLine({ note: 'request failed: x' })).toBe('-- request failed: x');
    const s = { on: true, hasKey: true, inFlight: true, pausedUntil: 10000, lastError: 'HTTP 500', models: [{ model: 'a', today: 5, perDay: 900, lastMinute: 2, perMin: 12, pausedUntil: 10000, dead: false, lastError: 'HTTP 429' }, { model: 'b', today: 0, perDay: 900, lastMinute: 0, perMin: 12, pausedUntil: 0, dead: true, lastError: null }] };
    expect(statusLine(s, 0)).toBe('on · asking... · all models paused, next in 10 s · error: HTTP 500');
    expect(statusLine({ ...s, on: false, inFlight: false, pausedUntil: 0, lastError: null }, 0)).toBe('off');
    expect(modelLines(s, 0)).toEqual(['a  5/900 today  2/12 min · paused 10 s · error: HTTP 429', 'b  0/900 today  0/12 min · not found']);
    expect(pendingLine(null, 0)).toBe('pending answer: none'); expect(pendingLine({ id: 'eat', reason: 'Hungry.', at: 10 }, 25)).toBe('pending answer: eat  (15 s old)  "Hungry."');
    expect(requestText([{ role: 'system', content: 'S' }, { role: 'user', content: 'U' }], '{"choice":"eat"}')).toBe('[system]\nS\n\n[user]\nU\n\n[answer]\n{"choice":"eat"}');
  });
});

const sig = r => JSON.stringify({ ticks: r.ticks, events: r.events, maxThirst: r.maxThirst, maxHunger: r.maxHunger, eaten: r.eaten, sleeps: r.sleeps, errors: r.errors, homeDay: r.homeDay, drinks: r.drinks, fires: r.fires });

describe('lives with the AI chooser (fake ask, no network)', () => {
  let w, spawn;
  beforeAll(async () => { w = await generateWorld(1337); spawn = startSpot(w); }, 120000);

  const makeAi = (pick, calls = []) => {
    const t = { s: 0 };
    const ai = createAiChooser({ rulesChooser, now: () => t.s, ask: async messages => { calls.push(messages); const ids = [...messages[1].content.matchAll(/^- (\w+):/gm)].map(m => m[1]); return { text: JSON.stringify({ choice: pick(ids), reason: 'Fake.' }), ms: 1 }; } });
    return { ai, t, calls };
  };
  async function life(chooserOf, days) {
    const game = createGame(w, spawn, {});
    walkFirstDay(w, game, spawn, {}); game.known.visit(spawn.x, spawn.z);
    const { ai, t, calls } = chooserOf;
    const mind = createMind(w, game, { chooser: ai ? ai.chooser : undefined });
    mind.engage();
    const end = game.clock.total + days; let n = 0;
    while (game.clock.total < end) {
      mind.step(0.1); game.update(mind.input, 0.1); t.s += 0.1;
      if (ai) { ai.tick(mind, game); if (++n % 20 === 0) await flush(); }
    }
    return { game, mind, ai, calls };
  }

  it('runs on with the AI always answering the first menu id, uses its answers and never errors', async () => {
    const r = await life(makeAi(ids => ids[0]), 1);
    expect(r.mind.stats.errors || 0).toBe(0); expect(r.calls.length).toBeGreaterThan(3);
    expect(r.calls[0][1].content).toContain('Day '); expect(r.calls[0][1].content).toContain('The situation now');
    const used = r.ai.entries.filter(e => e.used === 'ai');
    expect(used.length).toBeGreaterThan(0); for (const e of used) expect(e.menu).toContain(e.ai);
    expect(r.ai.entries.filter(e => e.point && e.point !== 'goal').length).toBe(0);
    expect(r.mind.stats.goals.idle).toBeGreaterThan(0);
  }, 120000);

  it('survives an AI that always wants idle (it cannot refuse a need) and one that answers nonsense', async () => {
    const r = await life(makeAi(ids => ids[ids.length - 1]), 1);
    expect(r.mind.stats.errors || 0).toBe(0); expect(r.game.thirst.days).toBeLessThan(1.6);
    for (const e of r.ai.entries.filter(x => x.used === 'ai')) expect(e.menu).toContain(e.ai);
    const g = await life(makeAi(() => 'dance'), 0.4);
    expect(g.mind.stats.errors || 0).toBe(0); expect(g.ai.entries.filter(e => e.point).every(e => e.used === 'rules')).toBe(true);
  }, 180000);

  it('with no answer ever arriving (synchronous run) the lives are exactly the rules\' lives', () => {
    const a = runMind(w, spawn, { days: 0.4, know: true });
    const { ai } = makeAi(ids => ids[0]);
    const b = runMind(w, spawn, { days: 0.4, know: true, chooser: ai.chooser, onTick: (game, mind) => ai.tick(mind, game) });
    expect(sig(b)).toBe(sig(a));
    expect(ai.entries.length).toBeGreaterThan(0); expect(ai.entries.every(e => e.used === 'rules')).toBe(true);
  }, 120000);

  it('the AI chooser switched off gives exactly the default chooser\'s life (the rules\' streams are drawn once)', () => {
    const a = runMind(w, spawn, { days: 0.4, know: true });
    const ai = createAiChooser({ rulesChooser, ask: async () => { throw new Error('never'); }, enabled: () => false });
    const b = runMind(w, spawn, { days: 0.4, know: true, chooser: ai.chooser, onTick: (game, mind) => ai.tick(mind, game) });
    expect(sig(b)).toBe(sig(a));
  }, 120000);
});
