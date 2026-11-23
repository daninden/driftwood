// 0.44.4 "Switch" (agreed with the user 2026-11-23): AI errors and a model of his own choice.
//   A. the player chooses the model asked first (ai/client setChoice, kept in storage); the others stay as backup; null is "auto"
//   B. a 5xx ("high demand") or no answer pauses that model for BUSY_PAUSE, so the next request goes to another
//   C. the panel's model lines (and "copy log") say why a model is skipped: paused and why, spent for today, full this minute
//   D. a step whose key is an action ({"buildIn": ""}) or a thing he uses ({"nut": 1}) is read as {"do": ...} / {"use": ...}
//   and Gemma's budget is 2 a minute (its 16K tokens a minute; AI Studio showed 21.6K of 16K).
// Depends on: ai/client, ai/config, render/aiPanel (pure parts), game/actions.
import { describe, it, expect } from 'vitest';
import { createClient } from '../src/ai/client.js';
import { AI_MODELS, AI_BUDGET, KEY_NAME, CHOICE_NAME, BUSY_PAUSE } from '../src/ai/config.js';
import { modelLines, playLogText, summaryLine } from '../src/render/aiPanel.js';
import { checkPlan, repairStep, stepText } from '../src/game/actions.js';

const fakeStorage = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: k => { m.delete(k); } }; };
const ok = () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ choices: [{ message: { content: 'ok' } }] }), text: async () => 'ok' });
const err = s => ({ ok: false, status: s, headers: { get: () => null }, json: async () => ({}), text: async () => 'busy' });
const T0 = Date.UTC(2026, 10, 23, 20, 0, 0);
function make(fetchImpl, o = {}) {
  const st = o.storage || fakeStorage({ [KEY_NAME]: 'k' }), t = { ms: T0 }, calls = [];
  const c = createClient({ fetch: async (u, init) => { calls.push(JSON.parse(init.body).model); return fetchImpl(JSON.parse(init.body).model, init); }, storage: st, now: () => t.ms, timeout: o.timeout ?? 15000 });
  return { c, t, calls, st };
}

describe('0.44.4 "Switch": the model chosen first (A)', () => {
  it('auto asks in the order of ai/config; a chosen model is asked first, the others are backup', async () => {
    const a = make(async () => ok()); await a.c.send([]); expect(a.calls).toEqual([AI_MODELS[0]]); expect(a.c.choice()).toBeNull();
    a.c.setChoice(AI_MODELS[1]); expect(a.c.choice()).toBe(AI_MODELS[1]); expect(a.c.status().choice).toBe(AI_MODELS[1]);
    await a.c.send([]); expect(a.calls[1]).toBe(AI_MODELS[1]);
    const b = make(async m => (m === AI_MODELS[2] ? err(503) : ok())); b.c.setChoice(AI_MODELS[2]);
    expect((await b.c.send([])).model).toBe(AI_MODELS[0]); expect(b.calls).toEqual([AI_MODELS[2], AI_MODELS[0]]);
    b.c.setChoice(null); expect(b.c.choice()).toBeNull();
  });
  it('the choice is kept in storage; an unknown model is auto', () => {
    const st = fakeStorage({ [KEY_NAME]: 'k', [CHOICE_NAME]: AI_MODELS[2] });
    expect(make(async () => ok(), { storage: st }).c.choice()).toBe(AI_MODELS[2]);
    const st2 = fakeStorage({ [KEY_NAME]: 'k' }), c2 = make(async () => ok(), { storage: st2 }).c; c2.setChoice('no-such-model'); expect(c2.choice()).toBeNull();
  });
});

describe('0.44.4 "Switch": an overloaded model rests (B)', () => {
  it('a 503 pauses that model for BUSY_PAUSE and says why; the request went on to the next', async () => {
    const { c, t, calls } = make(async m => (m === AI_MODELS[0] ? err(503) : ok()));
    expect((await c.send([])).model).toBe(AI_MODELS[1]);
    const row = c.status().models[0]; expect(row.pausedUntil).toBe(T0 + BUSY_PAUSE); expect(row.pauseWhy).toBe('busy (503)');
    await c.send([]); expect(calls.slice(-1)[0]).toBe(AI_MODELS[1]);   // not asked again while it rests
    t.ms += BUSY_PAUSE + 1; await c.send([]); expect(calls.slice(-2)).toEqual([AI_MODELS[0], AI_MODELS[1]]);   // back after its rest (and busy again)
  });
  it('no answer in the timeout pauses it too', async () => {
    const { c } = make((m, init) => (m === AI_MODELS[0] ? new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(new Error('aborted')))) : Promise.resolve(ok())), { timeout: 20 });
    expect((await c.send([])).model).toBe(AI_MODELS[1]);
    expect(c.status().models[0].pauseWhy).toBe('no answer');
  });
  it('Gemma is asked at most 2 times a minute (its tokens a minute)', () => {
    expect(AI_BUDGET['gemma-4-31b-it'].perMin).toBe(2);
  });
});

describe('0.44.4 "Switch": why a model is skipped (C)', () => {
  const now = T0, s = { hasKey: true, choice: 'b', models: [
    { model: 'a', today: 480, perDay: 480, lastMinute: 0, perMin: 14, pausedUntil: 0, dead: false },
    { model: 'b', today: 3, perDay: 480, lastMinute: 1, perMin: 14, pausedUntil: now + 60000, pauseWhy: 'busy (503)', dead: false },
    { model: 'c', today: 5, perDay: 9, lastMinute: 2, perMin: 2, pausedUntil: 0, dead: false }] };
  it('the model lines say spent, paused and why, full this minute, and the chosen one', () => {
    const l = modelLines(s, now);
    expect(l[0]).toContain('spent for today'); expect(l[1]).toMatch(/^b \(chosen\):/); expect(l[1]).toContain(': busy (503)'); expect(l[2]).toContain('full this minute');
  });
  it('"copy log" has them; the summary names the chosen model first when it is free', () => {
    expect(playLogText({ entries: [], models: modelLines(s, now) })).toContain('Models now:\n- a: 480 of 480 today');
    const free = { ...s, models: s.models.map(m => ({ ...m, pausedUntil: 0 })) };
    expect(summaryLine(free, {}, now).text).toMatch(/^b 3\/480/);
  });
});

describe('0.44.4 "Switch": an action written as the key is read as "do" (D)', () => {
  const places = [{ id: 'leanto1', kind: 'leanto', what: 'his lean-to', minutes: 1 }];
  it('{"buildIn": ""} is {"do": "buildIn"}, {"nut": 1} is {"use": "nut"}, {"fish": 20} keeps its minutes', () => {
    expect(repairStep({ buildIn: '' })).toEqual({ do: 'buildIn' });
    expect(repairStep({ nut: 1, say: 'hm' })).toEqual({ use: 'nut', say: 'hm' });
    expect(repairStep({ fish: 20 })).toEqual({ do: 'fish', minutes: 20 });
    expect(repairStep({ go: 'x' })).toEqual({ go: 'x' });
    expect(repairStep({ pickup: 'stone1' })).toEqual({ pickup: 'stone1' });   // not an action: still refused, with its hint
    const c = checkPlan([{ go: 'leanto1' }, { buildIn: '' }], places);
    expect(c.ok).toBe(true); expect(c.steps[1]).toEqual({ do: 'buildIn' });
    expect(stepText({ buildIn: '' }, places)).not.toMatch(/unknown/);
    expect(checkPlan([{ pickup: 'stone1' }], places).ok).toBe(false);
  });
});
