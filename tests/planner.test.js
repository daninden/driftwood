// Full AI play with the language model (0.37.1 "Half hour"): ai/actPrompt (the request and the answer), ai/planner (asking, retrying, the journal, the memory),
// render/thinkingMark and the panel's helpers, and the actor and the planner together with a fake model while the game pauses. No network ever.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { createActor } from '../src/game/actor.js';
import { WAIT } from '../src/game/intent.js';
import { DO, DIRS, PLAN_MINUTES } from '../src/game/actions.js';
import { actFixed, buildActMessages, parseActPlan, parseLessons, menuText, WHY_ASKED } from '../src/ai/actPrompt.js';
import { createPlanner, RETRY_SECS, REJECTS_MAX } from '../src/ai/planner.js';
import { snapshotOf } from '../src/ai/prompt.js';
import { thinkingText } from '../src/render/thinkingMark.js';
import { actPlanLines, actEntryParts, playLogText } from '../src/render/aiPanel.js';
import { DUSK } from '../src/game/sleep.js';
import { walkFirstDay } from './helpers/mindSim.js';

const MENU = { here: [{ id: 'drink', what: DO.drink.what }], uses: [{ id: 'nut', what: 'eat a carried coconut' }], dirs: DIRS, carries: {}, minutes: PLAN_MINUTES,
  places: [{ id: 'water1', kind: 'water', what: 'fresh river water', dist: 12, dir: 'north', minutes: 6, nearby: true, offers: ['drink'] }, { id: 'coconut1', kind: 'coconut', what: 'a coconut on the ground', dist: 40, dir: 'east', minutes: 20, nearby: false, offers: ['husk'] }] };
const tick = () => new Promise(r => setTimeout(r, 0));

describe('the request and the answer (ai/actPrompt)', () => {
  it('the fixed part names him, tells the island, the kinds of step, the half hour and the answer format', () => {
    const f = actFixed('Robin');
    expect(f).toContain('Robin'); expect(actFixed('')).toContain('the castaway');
    for (const k of Object.keys(DO)) expect(f).toContain(`"${k}"`);
    expect(f).toContain(`${PLAN_MINUTES} game minutes`); expect(f).toMatch(/"say"/); expect(f).toMatch(/"sleep" is a plan of its own/);
    expect(f).toMatch(/Walking in the dark/); expect(f).toMatch(/burning torch/); expect(f).toMatch(/"plant"/); expect(f).toMatch(/Fishing is a plan of its own/); expect(f).toMatch(/"minutes": n/);
  });
  it('the rules name what the AI test game of 0.37.6 found missing (0.37.7 "Reasons"): the fibre cap, the nap, where a fire is fed, the hut\'s room', () => {
    const f = actFixed('');
    expect(f).toContain('he carries at most 3 tufts'); expect(f).toMatch(/a sleep begun before dusk \(19:5\d\) is a nap: he wakes after 2 hours/);
    expect(f).toContain('(or its glowing embers) with "feed", standing right at it; within 8 m of a finished stone ring only the fire in the ring can be fed');
    expect(f).toContain('about 3 m wide and 2.5 m deep'); expect(f).toContain('the menu names what is in the way');
  });
  it('the user part says why it is asked, how the last step went, and the menu with ids and minutes', () => {
    const m = buildActMessages({ name: 'Robin', state: { day: 2, time: 0.4, thirst: 0.2, hunger: 0.1, awake: 0.3, carries: {} }, menu: MENU, ask: { why: 'failed', last: { what: 'husk the coconut here', reason: 'the coconut is gone' } }, recent: [{ day: 2, time: 0.39, kind: 'step', what: 'walk to a coconut', outcome: 'done' }], notes: ['the river is north'], journal: [] });
    expect(m).toHaveLength(2); expect(m[0].role).toBe('system'); expect(m[1].role).toBe('user');
    const u = m[1].content;
    expect(u).toContain(WHY_ASKED.failed); expect(u).toContain('the coconut is gone');
    expect(u).toContain('- water1: fresh river water, 12 m north, 6 min (nearby); can do there: drink');
    expect(u).toContain('coconut1'); expect(u).toContain('the river is north'); expect(u).toContain('walk to a coconut -> done');
    expect(u).toContain('Where he stands he can: drink.');
    expect(menuText({})).toContain('(none)');
  });
  it('a number n in the notes keeps his old note n (0.37.8 "Firelight": a model wrote [1, ..., 9, "new"] and lost nine notes)', () => {
    const old = ['the river is north', 'fire1 is in the ring', 'logs by the lean-to'];
    const p = parseActPlan('{"steps": [{"wait": 5}], "notes": [1, 3, "Day 2: the hut is begun", 7, 2.5]}', old);
    expect(p.notes).toEqual(['the river is north', 'logs by the lean-to', 'Day 2: the hut is begun']);
    expect(parseActPlan('{"steps": [{"wait": 5}], "notes": [1, "x"]}').notes).toEqual(['x']);   // no old notes: a number keeps nothing
    expect(actFixed('')).toContain('a number n keeps your note n as it is');
  });
  it('"copy log" with the AI on is the log of full AI play: the last request as the model saw it, then the requests (0.37.8 "Firelight")', () => {
    const e = (n, day, time, extra) => ({ n, day, time, why: 'done', ok: true, say: 'thought ' + n, steps: [{ wait: 5 }], model: 'm1', ms: 1200, messages: [{ role: 'system', content: 'S' }, { role: 'user', content: 'USER TEXT ' + n }], ...extra });
    const entries = [e(3, 4, 0.5), e(2, 3, 0.4, { rejected: 'you counted 85 minutes, at most 80' }), e(1, 1, 0.3)];   // newest first, as the planner keeps them
    const t = playLogText({ entries, model: 'm1' });
    expect(t).toMatch(/AI log \(full AI play\), the last 2 game days/); expect(t).toContain('Model: m1');
    expect(t).toContain('USER TEXT 3'); expect(t).not.toContain('USER TEXT 2');   // only the last request in full
    expect(t.indexOf('thought 2')).toBeLessThan(t.indexOf('thought 3')); expect(t).not.toContain('thought 1');   // oldest first, the last 2 days
    expect(t).toContain('not followed: you counted 85 minutes, at most 80');
    expect(t).not.toMatch(/by the rules|Camp store|Not now/);
    expect(playLogText({})).toContain('(none yet)');
  });
  it('reads the first JSON object, also in a code fence, with his thought and notes', () => {
    const p = parseActPlan('Sure!\n```json\n{"say": "Water first.", "steps": [{"go": "water1"}, {"do": "drink"}], "notes": ["river north", 5]}\n```');
    expect(p.ok).toBe(true); expect(p.steps).toEqual([{ go: 'water1' }, { do: 'drink' }]); expect(p.say).toBe('Water first.'); expect(p.notes).toEqual(['river north']);
    expect(parseActPlan('{"steps": [{"wait": 5}]}').notes).toBeNull();
    expect(parseActPlan('{"say": "' + 'x'.repeat(300) + '", "steps": [{"wait": 5}]}').say.length).toBeLessThanOrEqual(140);
    expect(parseActPlan('no json here').ok).toBe(false);
    expect(parseActPlan('{"say": "hm"}').error).toMatch(/no steps/);
    expect(parseActPlan('{"a": "}"} {"steps": [{"wait": 3}]}').ok).toBe(true);
  });
});

const makePlanner = (o = {}) => {
  const t = { s: 100 }, calls = [], answers = o.answers || [];
  const ask = m => { calls.push(m); const a = answers.length ? answers.shift() : { text: '{"say":"ok","steps":[{"wait":5}]}' }; return a instanceof Error ? Promise.reject(a) : Promise.resolve({ model: 'fake', ms: 10, ...a }); };
  const pl = createPlanner({ ask, enabled: () => o.enabled !== false, now: () => t.s, state: () => ({ day: 1, time: o.time ?? 0.4, carries: {} }), clock: () => ({ day: 1, time: o.time ?? 0.4 }), recent: () => [] });
  return { pl, t, calls };
};

describe('asking for plans (ai/planner)', () => {
  it('no plan: one request and WAIT; the answer is handed over on the next call', async () => {
    const { pl, calls } = makePlanner();
    expect(pl.chooser(MENU, { why: 'start' })).toBe(WAIT); expect(calls).toHaveLength(1);
    expect(pl.status().state).toBe('thinking');
    expect(pl.chooser(MENU, { why: 'start' })).toBe(WAIT); expect(calls).toHaveLength(1);   // one at a time
    await tick();
    const plan = pl.chooser(MENU, { why: 'start' });
    expect(plan).toEqual({ steps: [{ wait: 5 }], say: 'ok' });
    expect(pl.status().state).toBe('idle');
    expect(pl.entries()[0]).toMatchObject({ ok: true, why: 'start', model: 'fake' });
  });
  it('the AI off: no request, no plan', () => {
    const { pl, calls } = makePlanner({ enabled: false });
    expect(pl.chooser(MENU, {})).toBeNull(); expect(calls).toHaveLength(0); expect(pl.status().state).toBe('off');
  });
  it('errors are retried after 2, 5, 10 and 30 s; then it stops until "try again"', async () => {
    const { pl, t, calls } = makePlanner({ answers: Array.from({ length: 6 }, () => new Error('HTTP 503')) });
    expect(RETRY_SECS).toEqual([2, 5, 10, 30]);
    for (let i = 0; i < RETRY_SECS.length; i++) {
      pl.chooser(MENU, {}); await tick();
      expect(pl.status()).toMatchObject({ state: 'retrying', retryIn: RETRY_SECS[i] });
      expect(pl.chooser(MENU, {})).toBe(WAIT); expect(calls).toHaveLength(i + 1);   // not before its time
      t.s += RETRY_SECS[i];
    }
    pl.chooser(MENU, {}); await tick();
    expect(pl.status().state).toBe('failed'); expect(pl.status().error).toMatch(/503/);
    t.s += 1000; expect(pl.chooser(MENU, {})).toBe(WAIT); expect(calls).toHaveLength(5);
    pl.retry(); pl.chooser(MENU, {}); expect(calls).toHaveLength(6);
  });
  it('an unusable answer counts as an error; a good one clears the errors', async () => {
    const { pl, t } = makePlanner({ answers: [{ text: 'I think he should rest.' }, { text: '{"steps":[{"wait":2}]}' }] });
    pl.chooser(MENU, {}); await tick();
    expect(pl.status().state).toBe('retrying'); expect(pl.entries()[0].error).toMatch(/could not be used/);
    t.s += 2; pl.chooser(MENU, {}); await tick();
    expect(pl.chooser(MENU, {})).toEqual({ steps: [{ wait: 2 }], say: '' }); expect(pl.status().errors).toBe(0);
  });
  it(`${REJECTS_MAX} rejected plans in a row count as an error`, async () => {
    const { pl } = makePlanner();
    for (let i = 0; i < REJECTS_MAX; i++) {
      pl.chooser(MENU, { why: i ? 'rejected' : 'start', last: i ? { kind: 'rejected', reason: 'too long ' + i } : null }); await tick();
      pl.chooser(MENU, { why: 'rejected', last: { kind: 'rejected', reason: 'too long ' + (i + 1) } });
    }
    pl.chooser(MENU, { why: 'rejected', last: { kind: 'rejected', reason: 'too long ' + REJECTS_MAX } });   // the third plan is refused too
    expect(pl.status().state).toBe('retrying'); expect(pl.status().error).toMatch(/could not be followed/);
  });
  it('notes from the answer are kept, saved and restored', async () => {
    const { pl } = makePlanner({ answers: [{ text: '{"steps":[{"wait":2}],"notes":["palms east"]}' }] });
    const v = pl.memoryVersion; pl.chooser(MENU, {}); await tick();
    expect(pl.notes()).toEqual(['palms east']); expect(pl.memoryVersion).toBeGreaterThan(v);
    const p2 = makePlanner().pl; p2.restore(pl.memory()); expect(p2.notes()).toEqual(['palms east']);
  });
  it('the lesson of the day (0.37.4): one request a day after dusk, the full new list kept and saved', async () => {
    const { pl, calls } = makePlanner({ time: DUSK + 0.01, answers: [{ text: '{"lessons": ["Branches burn fast: a night takes eight pieces."]}' }] });
    pl.tick(); expect(calls).toHaveLength(1); expect(calls[0][0].content).toContain('ONE new lesson'); await tick();
    expect(pl.lessons()).toEqual(['Branches burn fast: a night takes eight pieces.']);
    pl.tick(); expect(calls).toHaveLength(1);
    expect(pl.memory().lessons).toEqual(['Branches burn fast: a night takes eight pieces.']);
    const { pl: again } = makePlanner({}); again.restore(pl.memory()); expect(again.lessons()).toEqual(pl.lessons());
  });
  it('lessons: a single lesson is added to the old list, at most ten kept, numbers taken off', () => {
    expect(parseLessons('{"lesson": "Fill the shells before dusk."}', ['Old one.']).lessons).toEqual(['Old one.', 'Fill the shells before dusk.']);
    const many = Array.from({ length: 14 }, (_, i) => `${i + 1}. Lesson ${i + 1}`);
    const r = parseLessons(JSON.stringify({ lessons: many })); expect(r.lessons).toHaveLength(10); expect(r.lessons[9]).toBe('Lesson 14');
    expect(parseLessons('nothing').ok).toBe(false);
  });
  it('the request carries the lessons and the count of the last plan (0.37.4)', () => {
    const m = buildActMessages({ state: {}, menu: { ...MENU, count: { claimed: 28, minutes: 36 } }, ask: { why: 'done' }, recent: [], notes: [], lessons: ['Wood first.'] });
    expect(m[1].content).toContain('HIS LESSONS'); expect(m[1].content).toContain('1. Wood first.');
    expect(m[1].content).toContain('you counted 28 minutes, the game counted about 36');
    expect(m[0].content).toContain('"minutes": <your sum');
    expect(parseActPlan('{"steps": [{"wait": 5}], "minutes": 5}').minutes).toBe(5);
    expect(parseActPlan('{"steps": [{"wait": 5}]}').minutes).toBeNull();
  });
});

describe('the thinking line and the panel helpers', () => {
  it('says thinking, trying again, or that he cannot think with a button', () => {
    expect(thinkingText(false, { state: 'thinking' })).toBeNull();
    expect(thinkingText(true, { state: 'thinking' })).toEqual({ text: 'thinking…', retry: false });
    expect(thinkingText(true, { state: 'retrying', retryIn: 5 }).text).toContain('5 s');
    expect(thinkingText(true, { state: 'failed', error: 'HTTP 503' })).toEqual({ text: 'He cannot think: HTTP 503.', retry: true });
  });
  it('the plan with a marker at the running step, and a request as lines', () => {
    const plan = { steps: [{ go: 'water1' }, { do: 'drink' }, { do: 'fill' }], menu: MENU };
    const l = actPlanLines(plan, 1, [{ kind: 'plan' }, { kind: 'step', outcome: 'done', what: 'x' }]);
    expect(l.map(x => x.marker)).toEqual(['✓', '▶', ' ']); expect(l[0].text).toBe('walk to fresh river water');
    expect(actPlanLines(null, 0, [])).toEqual([]);
    const e = actEntryParts({ n: 3, day: 2, time: 0.5, why: 'done', ok: true, say: 'Water.', steps: [{ do: 'drink' }], model: 'm', ms: 1200 });
    expect(e.head).toBe('Day 2 12:00: ' + WHY_ASKED.done); expect(e.lines).toContain('"Water."'); expect(e.lines).toContain('m · 1.2 s');
    expect(actEntryParts({ n: 4, day: 2, time: 0.5, why: 'start', ok: false, error: 'HTTP 500' }).ok).toBe(false);
  });
});

describe('the actor and the planner together, the game pausing while there is no plan', () => {
  let w, spawn;
  beforeAll(async () => { w = await generateWorld(1337); spawn = startSpot(w); }, 120000);
  it('the clock stands still while he waits for a plan, and runs while he follows one', async () => {
    const g = createGame(w, spawn, {}); walkFirstDay(w, g, spawn); g.known.visit(spawn.x, spawn.z);
    let release = null, asked = 0;
    const ask = m => { asked++; const u = m[1].content, id = (u.match(/- (coconut\d+):/) || [])[1]; return new Promise(r => { release = () => r({ text: JSON.stringify({ say: 'A nut.', steps: id ? [{ go: id }, { do: 'husk' }] : [{ wait: 5 }] }), model: 'fake' }); }); };
    let actor = null;
    const pl = createPlanner({ ask, enabled: () => true, now: () => 0, state: () => snapshotOf(g, null), clock: () => ({ day: 1, time: g.clock.time }), recent: () => actor.recent });
    actor = createActor(w, g, { chooser: pl.chooser });
    const frame = h => { actor.step(actor.waiting ? 0 : h); if (actor.waiting) g.update(actor.input, 0); else g.update(actor.input, h); };   // as main does
    frame(0.1);
    expect(actor.waiting).toBe(true); expect(asked).toBe(1);
    const t0 = g.clock.total, x0 = g.player.x;
    for (let i = 0; i < 30; i++) { frame(0.1); await tick(); }
    expect(g.clock.total).toBe(t0); expect(g.player.x).toBe(x0);   // paused
    release(); await tick();
    for (let i = 0; i < 400 && actor.stats.steps < 2; i++) frame(0.1);
    expect(g.clock.total).toBeGreaterThan(t0);
    expect(actor.recent.find(r => r.kind === 'plan')).toBeTruthy();
    expect(actor.recent.find(r => r.kind === 'plan').what).toMatch(/coconut/);
    frame(0.1);   // the next frame asks for the next plan
    expect(actor.stats.plans).toBe(1); expect(actor.stats.done).toBe(2);
    expect(actor.waiting).toBe(true); expect(asked).toBe(2);   // the next plan is asked only now
  }, 120000);
});
