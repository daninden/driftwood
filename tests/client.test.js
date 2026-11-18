// The connection to the language model (ai/client): fake fetch and fake storage, no network ever. The key of the player is never in any string that leaves the client.
// 0.38.0 "Only him": from the old tests/ai.test.js (the old chooser, its prompt and its leash are gone); the key check of the start screen (`listModels(key)`) is new.
import { describe, it, expect } from 'vitest';
import { createClient, pacificDay, forModel } from '../src/ai/client.js';
import { AI_BUDGET, AI_BUDGET_DEFAULT, AI_TIMEOUT, AI_MODELS, AI_URL, KEY_NAME, COUNT_NAME } from '../src/ai/config.js';

const KEY = 'AIza-SECRET-KEY-1234567890';
const fakeStorage = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: k => { m.delete(k); }, dump: () => Object.fromEntries(m) }; };
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
const okResponse = text => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ choices: [{ message: { content: text } }] }), text: async () => text });
const errResponse = (status, headers = {}, body = '') => ({ ok: false, status, headers: { get: k => headers[k] ?? null }, json: async () => ({}), text: async () => body });

describe('client', () => {
  const T0 = Date.UTC(2026, 10, 12, 20, 0, 0);
  const make = (fetchImpl, o = {}) => {
    const st = fakeStorage(o.storage || { [KEY_NAME]: KEY }), t = { ms: o.t0 ?? T0 }, calls = [];
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
    expect(c.status()).toMatchObject({ hasKey: true, today: 1, perDay: AI_MODELS.reduce((a, m) => a + AI_BUDGET[m].perDay, 0), lastError: null, pausedUntil: 0, inFlight: false });
    expect(c.status().models.map(m => m.model)).toEqual(AI_MODELS); expect(c.status().models[0]).toMatchObject({ today: 1, perDay: AI_BUDGET[AI_MODELS[0]].perDay, lastMinute: 1, perMin: AI_BUDGET[AI_MODELS[0]].perMin, pausedUntil: 0, dead: false });
    expect(c.status().models[1].today).toBe(0);
    expect(leaks(c.status())).toBe(true);
  });
  it('does not send without a key, and the key never shows in status', async () => {
    const { c, calls } = make(async () => okResponse('x'), { storage: {} });
    expect(c.canSend()).toBe(false); await expect(c.send([])).rejects.toMatchObject({ code: 'nokey' }); expect(calls.length).toBe(0);
    expect(c.status().hasKey).toBe(false);
    c.setKey('  ' + KEY + ' '); expect(c.hasKey()).toBe(true); expect(leaks(c.status())).toBe(true);
    c.clearKey(); expect(c.hasKey()).toBe(false);
  });
  it('keeps the key only under its own storage name', async () => {
    const { c, st } = make(async () => okResponse('ok'), { storage: {} });
    c.setKey(KEY); await c.send([]);
    expect(Object.keys(st.dump()).sort()).toEqual([COUNT_NAME + '.' + AI_MODELS[0], KEY_NAME].sort());
    expect(st.dump()[COUNT_NAME + '.' + AI_MODELS[0]]).not.toContain(KEY);
  });
  it('allows the default budget\'s requests in a minute, then refuses until the window moves on', async () => {
    const { c, t, calls } = make(async () => okResponse('ok'), { cfg: ONE });
    const N = AI_BUDGET_DEFAULT.perMin;
    for (let i = 0; i < N; i++) { t.ms += 1000; await c.send([]); }
    expect(c.canSend()).toBe(false); await expect(c.send([])).rejects.toMatchObject({ code: 'budget' }); expect(calls.length).toBe(N);
    t.ms += 60000; expect(c.canSend()).toBe(true); await c.send([]); expect(calls.length).toBe(N + 1);
  });
  it('allows the default budget\'s requests a day and starts a new count at midnight Pacific time', async () => {
    const st = { [KEY_NAME]: KEY, [COUNT_NAME + '.m1']: JSON.stringify({ day: pacificDay(T0), n: AI_BUDGET_DEFAULT.perDay - 1 }) };
    const { c, t } = make(async () => okResponse('ok'), { storage: st, cfg: ONE });
    await c.send([]); expect(c.status().today).toBe(AI_BUDGET_DEFAULT.perDay);
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
    const [a, b, g] = AI_MODELS.map(m => AI_BUDGET[m].perMin);
    for (let i = 0; i < a + b + g; i++) { t.ms += 100; await c.send([]); }
    const order = calls.map(x => bodyModel(x.init));
    expect(order.slice(0, a).every(m => m === AI_MODELS[0])).toBe(true); expect(order.slice(a, a + b).every(m => m === AI_MODELS[1])).toBe(true); expect(order.slice(a + b).every(m => m === AI_MODELS[2])).toBe(true); expect(g).toBeGreaterThan(a);   // each model has its own minute budget
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
    c.setKey(KEY); expect(c.hasKey()).toBe(true); await c.send([]); expect(c.status().today).toBe(1);   // 0.38.3: counted in memory
  });
});

describe('0.38.3 "Steady": the client when things fail', () => {
  const T0 = Date.UTC(2026, 10, 12, 20, 0, 0);
  it('the daily budget holds without storage, and when writing fails', async () => {
    const t = { ms: T0 }, c = createClient({ fetch: async () => okResponse('ok'), storage: null, now: () => t.ms, models: ['m1'], perDay: 2, perMin: 100 });
    c.setKey(KEY); await c.send([]); t.ms += 61000; await c.send([]); t.ms += 61000;
    expect(c.canSend()).toBe(false); await expect(c.send([])).rejects.toMatchObject({ code: 'budget' });
    expect(c.blocked()).toMatchObject({ kind: 'spent' }); expect(c.blocked().at).toMatch(/^\d\d:\d\d$/);
    t.ms += 86400000; expect(c.canSend()).toBe(true); expect(c.blocked()).toBe(null);   // the next day
    const broken = { getItem: k => (k === KEY_NAME ? KEY : null), setItem: () => { throw new Error('full'); }, removeItem: () => {} };
    const b = createClient({ fetch: async () => okResponse('ok'), storage: broken, now: () => T0, models: ['m1'], perDay: 1, perMin: 100 });
    await b.send([]); expect(b.canSend()).toBe(false);
  });
  it('blocked() says a model is paused and for how long, and no key', async () => {
    const t = { ms: T0 }, c = createClient({ fetch: async () => errResponse(429, { 'Retry-After': '30' }), storage: fakeStorage({ [KEY_NAME]: KEY }), now: () => t.ms, models: ['m1'] });
    await c.send([]).catch(() => {});
    expect(c.blocked()).toEqual({ kind: 'paused', secs: 30 });
    t.ms += 31000; expect(c.blocked()).toBe(null);
    expect(createClient({ fetch: async () => okResponse(''), storage: null, now: () => T0 }).blocked()).toEqual({ kind: 'nokey' });
    const d = createClient({ fetch: async () => errResponse(404), storage: fakeStorage({ [KEY_NAME]: KEY }), now: () => T0, models: ['m1'] });
    await d.send([]).catch(() => {}); expect(d.blocked()).toEqual({ kind: 'dead' });
  });
  it('the key check gives up after the timeout', async () => {
    const c = createClient({ fetch: () => new Promise(() => {}), storage: null, now: () => T0, timeout: 30 });
    await expect(c.listModels(KEY)).rejects.toMatchObject({ code: 'timeout' });
  });
  it('an error is scrubbed of the key its request was sent with, also after the key changed', async () => {
    let release; const gate = new Promise(r => { release = r; });
    const st = fakeStorage({ [KEY_NAME]: KEY }), c = createClient({ fetch: async () => { await gate; throw new Error('bad key ' + KEY); }, storage: st, now: () => T0, models: ['m1'] });
    const p = c.send([]).catch(e => e);
    c.setKey('ANOTHER-KEY-999'); release();
    const e = await p; expect(e.message).not.toContain(KEY); expect(e.message).toContain('***');
  });
});

const go = (ai, menu = quietMenu()) => ai.chooser('goal', menu, ctxOf());
describe('0.36.4 "Hindsight": the models, a budget per model, Gemma', () => {
  const T0 = Date.UTC(2026, 10, 13, 20, 0, 0);
  const make = (storage = { [KEY_NAME]: KEY }, o = {}) => {
    const st = fakeStorage(storage), t = { ms: T0 }, calls = [];
    const c = createClient({ fetch: async (url, init) => { calls.push({ url, init }); return okResponse('ok'); }, storage: st, now: () => t.ms, ...o });
    return { c, st, t, calls };
  };
  const body = x => JSON.parse(x.init.body);

  it('the list is two Gemini models, then Gemma 4, each with its own budget just under Google\'s free tier', () => {
    expect(AI_MODELS).toEqual(['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemma-4-31b-it']);
    expect(AI_BUDGET).toEqual({ 'gemini-3.5-flash-lite': { perMin: 14, perDay: 480 }, 'gemini-3.1-flash-lite': { perMin: 14, perDay: 480 }, 'gemma-4-31b-it': { perMin: 28, perDay: 14000 } });
  });
  it('the status gives every model its own budget', () => {
    const { c } = make();
    expect(c.status().models.map(m => [m.model, m.perMin, m.perDay])).toEqual([['gemini-3.5-flash-lite', 14, 480], ['gemini-3.1-flash-lite', 14, 480], ['gemma-4-31b-it', 28, 14000]]);
  });
  it('a model whose day is spent is passed over for the next one, which has its own count', async () => {
    const { c, calls } = make({ [KEY_NAME]: KEY, [COUNT_NAME + '.gemini-3.5-flash-lite']: JSON.stringify({ day: pacificDay(T0), n: 480 }) });
    await c.send([]); expect(body(calls[0]).model).toBe('gemini-3.1-flash-lite');
    expect(c.status().models.map(m => m.today)).toEqual([480, 1, 0]);
  });
  it('when both Gemini models are spent for the day the request goes to Gemma', async () => {
    const day = pacificDay(T0), full = JSON.stringify({ day, n: 480 });
    const { c, calls } = make({ [KEY_NAME]: KEY, [COUNT_NAME + '.gemini-3.5-flash-lite']: full, [COUNT_NAME + '.gemini-3.1-flash-lite']: full });
    await c.send([]); expect(body(calls[0]).model).toBe('gemma-4-31b-it');
  });
  it('Gemma gets no system message: its content starts the first user message; no other option is sent; Gemini is unchanged', async () => {
    const msgs = [{ role: 'system', content: 'SYS' }, { role: 'user', content: 'USER' }];
    expect(forModel('gemma-4-31b-it', msgs)).toEqual([{ role: 'user', content: 'SYS\n\nUSER' }]);
    expect(forModel('gemini-3.5-flash-lite', msgs)).toBe(msgs); expect(msgs[0].role).toBe('system');
    expect(forModel('gemma-4-31b-it', [{ role: 'user', content: 'only' }])).toEqual([{ role: 'user', content: 'only' }]);
    const g = make(undefined, { models: ['gemma-4-31b-it'] }); await g.c.send(msgs);
    expect(body(g.calls[0])).toEqual({ model: 'gemma-4-31b-it', messages: [{ role: 'user', content: 'SYS\n\nUSER' }], temperature: 0.7 });
    const m = make(); await m.c.send(msgs); expect(body(m.calls[0]).messages).toEqual(msgs);
  });
});


describe('0.38.0 "Only him": the key check of the start screen', () => {
  const list = ids => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ data: ids.map(id => ({ id: 'models/' + id })) }) });
  it('a key that is not saved yet is checked with the list of models, sent as the bearer, and nothing is saved or counted', async () => {
    const st = fakeStorage(), calls = [];
    const c = createClient({ fetch: async (url, init) => { calls.push({ url, init }); return list(['gemini-3.5-flash-lite']); }, storage: st });
    expect(await c.listModels(' ' + KEY + ' ')).toEqual(['gemini-3.5-flash-lite']);
    expect(calls).toHaveLength(1); expect(calls[0].init.method).toBe('GET'); expect(calls[0].init.headers.Authorization).toBe('Bearer ' + KEY);
    expect(c.hasKey()).toBe(false); expect(st.dump()).toEqual({});
  });
  it('a refused key rejects with its HTTP status, and the key is never in the error', async () => {
    const c = createClient({ fetch: async () => errResponse(400), storage: fakeStorage() });
    const e = await c.listModels(KEY).then(() => null, x => x);
    expect(e.status).toBe(400); expect(String(e.message)).not.toContain(KEY);
    const n = createClient({ fetch: async () => { throw new Error('offline ' + KEY); }, storage: fakeStorage() });
    const e2 = await n.listModels(KEY).then(() => null, x => x);
    expect(e2.code).toBe('net'); expect(String(e2.message)).not.toContain(KEY);
  });
  it('no on/off switch and no leash any more: only the key', () => {
    const c = createClient({ fetch: async () => okResponse('x'), storage: fakeStorage({ [KEY_NAME]: KEY }) });
    expect(c.on).toBeUndefined(); expect(c.mode).toBeUndefined(); expect(c.setMode).toBeUndefined();
    expect(c.status().on).toBeUndefined(); expect(c.hasKey()).toBe(true);
    c.clearKey(); expect(c.hasKey()).toBe(false);
  });
});
