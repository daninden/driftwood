// Full AI play with the language model (0.37.1 "Half hour"): ai/actPrompt (the request and the answer), ai/planner (asking, retrying, the journal, the memory),
// render/thinkingMark and the panel's helpers, and the actor and the planner together with a fake model while the game pauses. No network ever.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { createActor } from '../src/game/actor.js';
import { WAIT } from '../src/game/actions.js';
import { DO, DIRS, PLAN_MINUTES } from '../src/game/actions.js';
import { actFixed, buildActMessages, parseActPlan, parseLessons, menuText, WHY_ASKED, bodyText, fireText } from '../src/ai/actPrompt.js';
import { createPlanner, RETRY_SECS, REJECTS_MAX } from '../src/ai/planner.js';
import { snapshotOf } from '../src/ai/prompt.js';
import { thinkingText } from '../src/render/thinkingMark.js';
import { actPlanLines, actEntryParts, playLogText } from '../src/render/aiPanel.js';
import { DUSK } from '../src/game/sleep.js';
import { walkFirstDay } from './helpers/scene.js';

const MENU = { here: [{ id: 'drink', what: DO.drink.what }], uses: [{ id: 'nut', what: 'eat a carried coconut' }], dirs: DIRS, carries: {}, minutes: PLAN_MINUTES,
  places: [{ id: 'water1', kind: 'water', what: 'fresh river water', dist: 12, dir: 'north', minutes: 6, nearby: true, offers: ['drink'] }, { id: 'coconut1', kind: 'coconut', what: 'a coconut on the ground', dist: 40, dir: 'east', minutes: 20, nearby: false, offers: ['husk'] }] };
const tick = () => new Promise(r => setTimeout(r, 0));

describe('the request and the answer (ai/actPrompt)', () => {
  it('the fixed part names him, tells the island, the kinds of step, the half hour and the answer format', () => {
    const f = actFixed('Robin');
    expect(f).toContain('Robin'); expect(actFixed('')).toContain('the castaway');
    for (const k of Object.keys(DO)) expect(f).toContain(`"${k}"`);
    expect(f).toContain(`${PLAN_MINUTES} game minutes`); expect(f).toMatch(/"say"/); expect(f).toMatch(/Sleep is a plan of its own: \{"do": "sleep"\}/);
    expect(f).toMatch(/Walking in the dark/); expect(f).toMatch(/burning torch/); expect(f).toMatch(/"plant"/); expect(f).toMatch(/Fishing is a plan of its own/); expect(f).toMatch(/"minutes": n/);
  });
  it('the rules name what the AI test game of 0.37.6 found missing (0.37.7 "Reasons"): the fibre cap, the nap, where a fire is fed, the hut\'s room', () => {
    const f = actFixed('');
    expect(f).toContain('he carries at most 3 tufts'); expect(f).toMatch(/a sleep begun before dusk \(19:5\d\) is a nap: he wakes after 2 hours/);
    expect(f).toContain('(or its glowing embers, which flame up again without the drill) with "feed", standing right at it;'); expect(f).toContain('within 8 m of a finished stone ring a fire is lit and fed only in the ring');   // 0.40.4 "Ring": lit too (0.43.3: the embers' words)
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
  it('the rules tell what the home gives, that a hut part takes about 15 minutes, the nap\'s share and that he can go far (0.37.9 "Far")', () => {
    const f = actFixed('');
    expect(f).toMatch(/What his home gives.*the lean-to: a night without a fire close by lasts 4 hours instead of 3.*the bed: he rests 1.25 times as fast; the ring: a fire in it burns 1.5 times as long.*the hut: he sleeps the whole night even without a fire/);
    expect(f).toContain('a part of the hut takes three times as long, about 15 min');
    expect(f).toMatch(/it takes only about 0.2 day off his awake count; a whole night of sleep by a fire takes it to 0/);
    expect(f).toContain('He can sleep, drink at any river and make a fire anywhere, far from home too.');
    expect(menuText({ island: { across: 500, seen: 7 } })).toContain('The island is about 500 m across; he has seen about 7% of it.');
  });
  it('NOW says where thirst and hunger stand, what they do now and when the next point comes, and his fires also when none burns (0.37.10 "Body")', () => {
    const b = bodyText({ thirst: 0.8, hunger: 0.8, awake: 0.3 });   // the user's Gemini game: day 2 04:04, never drunk on day 1
    expect(b).toContain('Thirst: 0.8 days since he drank: thirsty (he walks about 11% slower). Very thirsty at 1 day (his rest runs out twice as fast), in about 5 hours; he collapses at 1.5 days, in about 17 hours.');
    expect(b).toContain('Hunger: 0.8 days since he ate: hungry (he walks about 3% slower, the fire drill tires him 1.5 times as much); starving at 3 days');
    expect(b).toContain('Awake for 0.3 days: not tired.');   // 0.40.3 "Weary": with what it does to him
    expect(bodyText({ thirst: 0.2, hunger: 0.1, awake: 0 })).toMatch(/not thirsty\. Thirsty at 0\.5 \(he walks slower\), in about 7 hours; he collapses at 1\.5 days, in about 31 hours/);
    expect(bodyText({ thirst: 1.2, hunger: 0, awake: 0 })).toMatch(/very thirsty \(he walks about 24% slower, his rest runs out twice as fast\); he collapses at 1\.5 days, in about 7 hours/);
    expect(bodyText({ thirst: 1.5, hunger: 3, awake: 0 })).toMatch(/at the point of collapse[\s\S]*starving \(he walks about 25% slower/);
    expect(fireText([])).toBe('Fire: he has no fire.');
    expect(fireText([{ id: 'fire1', state: 'cold', dist: 4, dir: 'south' }])).toBe('Fire: none of his burns (one cold fire place).');
    expect(fireText([{ id: 'fire1', state: 'embers', ring: false, dist: 4, dir: 'south' }])).toBe('Fire: none of his burns; embers only at fire1, 4 m south.');
    expect(fireText([{ id: 'fire2', state: 'burning', hours: 3, ring: true, dist: 4, dir: 'south' }, { id: 'fire1', state: 'cold', dist: 9, dir: 'east' }])).toBe('Fire: fire2 in the stone ring, 4 m south, burns about 3 more hours.');
    const u = buildActMessages({ name: '', state: { day: 2, time: 0.17, thirst: 0.8, hunger: 0.8, awake: 0, carries: {}, home: { leanto: 100, walls: 100, bed: 100, ring: 0, hut: 0 } }, menu: { ...MENU, fires: [] }, ask: { why: 'done' }, recent: [], notes: [] })[1].content;
    expect(u).toContain('Very thirsty at 1 day'); expect(u).not.toContain('he can drink now');
    expect(u).toMatch(/Home: stone ring 0%, lean-to 100%.*\nFire: he has no fire\./);   // 0.43.0: in building order
    const f = actFixed('');
    expect(f).toContain('very thirsty from 1: his rest runs out twice as fast'); expect(f).toContain('the fire drill tires him 1.5 times as much'); expect(f).toContain('hunger has no collapse of its own');
  });
  it('the rules say what the notes are for: the request already tells what he did, his home and his fires; the game never updates a note (0.37.10 "Body")', () => {
    const f = actFixed('');
    expect(f).toContain('Your notes are the only memory the game does not keep for you.');
    expect(f).toContain('his last 12 steps and plans'); expect(f).toContain('The game never updates a note');
    expect(f).toContain('What only the notes keep: places that are not on the menu now, what did not work and where, and what he means to do and why.');
    expect(f).not.toContain('The notes are yours for facts and intentions');
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
  const pl = createPlanner({ ask, enabled: () => o.enabled !== false, ...(o.canSend ? { canSend: o.canSend, blocked: o.blocked } : {}), now: () => t.s, state: () => ({ day: 1, time: o.time ?? 0.4, carries: {} }), clock: () => ({ day: 1, time: o.time ?? 0.4 }), recent: () => [] });
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
  it('an unusable answer counts as an error; a good plan that is followed clears the errors', async () => {
    const { pl, t } = makePlanner({ answers: [{ text: 'I think he should rest.' }, { text: '{"steps":[{"wait":2}]}' }] });
    pl.chooser(MENU, {}); await tick();
    expect(pl.status().state).toBe('retrying'); expect(pl.entries()[0].error).toMatch(/could not be used/);
    t.s += 2; pl.chooser(MENU, {}); await tick();
    expect(pl.chooser(MENU, {})).toEqual({ steps: [{ wait: 2 }], say: '' }); expect(pl.status().errors).toBe(1);
    pl.chooser(MENU, { why: 'done' }); expect(pl.status().errors).toBe(0);   // 0.38.3: cleared once the game followed the plan
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
  it('0.38.3: plans that parse but are refused again and again end in "failed"; a followed plan clears the count', async () => {
    const { pl, t, calls } = makePlanner();
    let why = 'start', last = null, i = 0;
    for (; i < 200 && pl.status().state !== 'failed'; i++) {
      const c = pl.chooser(MENU, { why, last });
      if (c && c !== WAIT && c.steps) { why = 'rejected'; last = { kind: 'rejected', reason: 'step 1: no place "x" on the menu ' + i }; }
      else { await tick(); t.s += 60; }
    }
    expect(pl.status().state).toBe('failed'); expect(calls.length).toBe((RETRY_SECS.length + 1) * REJECTS_MAX);
    pl.retry();
    const b = makePlanner(); b.pl.chooser(MENU, { why: 'start' }); await tick();
    b.pl.chooser(MENU, { why: 'start' });   // handed over
    b.pl.chooser(MENU, { why: 'rejected', last: { kind: 'rejected', reason: 'r1' } }); await tick();
    b.pl.chooser(MENU, { why: 'rejected', last: { kind: 'rejected', reason: 'r1b' } });   // the second plan, handed over
    b.pl.chooser(MENU, { why: 'done' });   // followed: the count starts over
    expect(b.pl.status().errors).toBe(0);
  });
  it('0.38.3: with no model to ask the status is "blocked" with the reason, and the line says it', () => {
    const spent = makePlanner({ canSend: () => false, blocked: () => ({ kind: 'spent', at: '09:00' }) }).pl;
    expect(spent.chooser(MENU, { why: 'start' })).toBe(WAIT);
    expect(spent.status()).toMatchObject({ state: 'blocked', wait: { kind: 'spent', at: '09:00' }, error: 'every model is spent for today' });
    expect(thinkingText(true, spent.status())).toEqual({ text: 'He cannot think: every model is spent for today (it resets at 09:00).', retry: false });
    const paused = makePlanner({ canSend: () => false, blocked: () => ({ kind: 'paused', secs: 12 }) }).pl; paused.chooser(MENU, { why: 'start' });
    expect(thinkingText(true, paused.status())).toEqual({ text: 'thinking… (a model is paused, trying again in 12 s)', retry: false });
    const dead = makePlanner({ canSend: () => false, blocked: () => ({ kind: 'dead' }) }).pl; dead.chooser(MENU, { why: 'start' });
    expect(thinkingText(true, dead.status()).text).toMatch(/no model answers/);
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
