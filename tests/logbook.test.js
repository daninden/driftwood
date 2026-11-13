// 0.36.8 "Logbook": the long record of a game for the AI panel's "download log" button (src/ai/logbook, src/ai/logStore, the mind's `onEvent`).
// Pure: a fake store and a fake clock, no browser. The mind tests prove that a life with the logbook listening is identical to one without.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { createMind } from '../src/game/mind.js';
import { rulesChooser, goalMenu, makeMenu, option, WAIT } from '../src/game/intent.js';
import { chooseGoal, VERY_AT, VERY_HUNGER_AT } from '../src/game/mind.js';
import { FIXED, fixedText, buildPlanMessages } from '../src/ai/prompt.js';
import { createLogbook, wrapChooser, snapshotEntry, hashText, dayLabel, slotOf, fileName, scrubSecrets, LOG_MAX_BYTES, SNAP_EVERY } from '../src/ai/logbook.js';
import { openLogStore, LOG_DB } from '../src/ai/logStore.js';
import { saveTextFile } from '../src/render/aiPanel.js';
import { VERSION, NAME } from '../src/version.js';

const KEY = 'AIza-SECRET-KEY-1234567890';
let tot = 0.5, day = 3;
const clock = () => ({ day, time: tot % 1, total: tot });
const fakeStore = (initial = null) => {
  const s = { lines: new Map(), meta: initial && initial.meta || null, writes: 0, cleared: 0, fail: false };
  if (initial) for (const e of initial.entries || []) s.lines.set(e.n, e);
  s.load = async () => ({ meta: s.meta, entries: [...s.lines.values()].map(e => ({ ...e })) });
  s.write = async ({ add = [], remove = [], meta = null }) => { if (s.fail) throw new Error('boom'); s.writes++; for (const e of add) s.lines.set(e.n, e); for (const n of remove) s.lines.delete(n); if (meta) s.meta = meta; };
  s.setMeta = async m => { s.meta = m; };
  s.clear = async () => { s.cleared++; s.lines.clear(); s.meta = null; };
  return s;
};
const make = (o = {}) => createLogbook({ version: '9.9.9', name: 'Test', seed: 1337, clock, secrets: () => [KEY], info: () => ({ ai: true, model: 'gemini-x', models: ['gemini-x', 'gemma-y'], leash: 'loose' }), now: () => 1700000000000, ...o });
const linesOf = lb => lb.text().trim().split('\n').map(l => JSON.parse(l));
const msgs = (user, sys = FIXED) => [{ role: 'system', content: sys }, { role: 'user', content: user }];

describe('the logbook: entries', () => {
  it('the first line is a header with the version, the name, the seed, the model, the leash, whether the AI is on and the start time', () => {
    const lb = make(), h = linesOf(lb)[0];
    expect(h).toMatchObject({ k: 'header', version: '9.9.9', name: 'Test', seed: 1337, ai: true, model: 'gemini-x', models: ['gemini-x', 'gemma-y'], leash: 'loose', started: '2023-11-14T22:13:20.000Z', day: 3, t: '12:00' });
  });
  it('a mind event keeps its type, its data and where he was, with the game day and time', () => {
    const lb = make(); tot = 3.25;
    lb.event({ type: 'walk', day: 2, time: 0.2, x: 1.5, z: -2, to: [10, 4], dist: 8.2, goal: 'drink' });
    const e = linesOf(lb)[1];
    expect(e).toMatchObject({ k: 'ev', type: 'walk', to: [10, 4], dist: 8.2, goal: 'drink', x: 1.5, z: -2, day: 3, t: '06:00' });
    expect(typeof e.n).toBe('number'); tot = 0.5;
  });
  it('the Now changes are logged once per change', () => {
    const lb = make(), n = { goal: 'drink', pastime: null, kind: null, phase: 'walking', detail: '12', trouble: '' };
    lb.tick({ now: n }); lb.tick({ now: { ...n } }); lb.tick({ now: { ...n, phase: 'working', detail: 'drink' } });
    const rows = linesOf(lb).filter(x => x.k === 'now');
    expect(rows.length).toBe(2); expect(rows[0]).toMatchObject({ goal: 'drink', phase: 'walking' }); expect(typeof rows[0].text).toBe('string');
  });
  it('a decision of the chooser keeps the point, the menu ids, the AI choice, the rules choice, why not the AI and the request that was asked', () => {
    const lb = make(), m = msgs('hello'); lb.request(m);
    lb.decision({ n: 1, point: 'goal', menu: ['fire', 'idle'], options: [], rules: 'idle', ai: 'fire', used: 'ai', why: null, reason: 'cold', ms: 1200, model: 'gemini-x', messages: m, raw: 'x', plan: { i: 1, n: 3, via: false }, planId: 4, step: 0 });
    lb.decision({ n: 2, point: 'goal', menu: ['fire', 'idle'], rules: 'idle', ai: null, used: 'rules', why: 'no answer', override: null, messages: null });
    const d = linesOf(lb).filter(x => x.k === 'decision');
    expect(d[0]).toMatchObject({ point: 'goal', menu: ['fire', 'idle'], rules: 'idle', ai: 'fire', used: 'ai', reason: 'cold', ms: 1200, model: 'gemini-x', planId: 4, req: 'r2' });
    expect(d[1]).toMatchObject({ used: 'rules', why: 'no answer', ai: null, req: null });
    expect(d[0].raw).toBeUndefined(); expect(d[0].messages).toBeUndefined();   // the full request and answer are their own lines
  });
  it('a plan keeps why it was asked, its steps with reason and outcome, and the raw answer', () => {
    const lb = make(), m = msgs('plan please'); lb.request(m);
    lb.decision({ note: 'New plan (no plan yet): stores', planNote: true, planId: 1, messages: m, raw: '{"plan":[]}' });
    const plans = [{ id: 1, trigger: 'no plan yet', reason: 'a calm day', model: 'gemini-x', i: 1, late: false, steps: [{ id: 'stores', label: 'x', to: null, toUsed: null, reason: 'wood', state: 'running', note: '', at: { day: 3, time: '12:00' } }, { id: 'drink', reason: 'thirsty', state: 'next', note: '' }] }];
    lb.planState(plans); lb.planState(plans);   // an unchanged plan is not logged twice
    plans[0].steps[0].state = 'done'; plans[0].steps[1].state = 'skipped'; plans[0].steps[1].note = 'no water known'; lb.planState(plans);
    const rows = linesOf(lb), p = rows.find(x => x.k === 'plan'), st = rows.filter(x => x.k === 'plan-state');
    expect(p).toMatchObject({ planId: 1, raw: '{"plan":[]}', req: 'r2' });
    expect(st.length).toBe(2); expect(st[0]).toMatchObject({ trigger: 'no plan yet', reason: 'a calm day' });
    expect(st[1].steps[1]).toMatchObject({ id: 'drink', reason: 'thirsty', state: 'skipped', note: 'no water known' });
  });
  it('0.36.9: with the castaway\'s name the fixed part is still stored once (its hash is of the text of that game)', () => {
    const lb = make(), named = fixedText('Robin');
    lb.request(msgs('state one', named)); lb.request(msgs('state two', named));
    const sys = linesOf(lb).filter(x => x.k === 'sys'); expect(sys.length).toBe(1); expect(sys[0]).toMatchObject({ id: 'sys-' + hashText(named), text: named }); expect(named).not.toBe(FIXED);
  });
  it('a request keeps the fixed system text once, then only the rest; an answer is its own line', () => {
    const lb = make();
    const a = lb.request(msgs('state one')), b = lb.request(msgs('state two')), c = lb.request([{ role: 'system', content: 'another system' }, { role: 'user', content: 'journal' }]);
    lb.answer(a, { text: '{"ok":1}', ms: 900, model: 'gemini-x' }); lb.answer(b, new Error('http 500'));
    const rows = linesOf(lb), sys = rows.filter(x => x.k === 'sys'), req = rows.filter(x => x.k === 'req'), ans = rows.filter(x => x.k === 'answer');
    expect(sys.length).toBe(2); expect(sys[0]).toMatchObject({ id: 'sys-' + hashText(FIXED), text: FIXED });
    expect(req.length).toBe(3); expect(req[0].sys).toBe(sys[0].id); expect(req[1].sys).toBe(sys[0].id); expect(req[2].sys).toBe(sys[1].id);
    expect(req[0].user).toEqual([{ role: 'user', content: 'state one' }]); expect(JSON.stringify(req[1])).not.toContain(FIXED.slice(0, 40));
    expect(ans[0]).toMatchObject({ req: a, ok: true, ms: 900, raw: '{"ok":1}' }); expect(ans[1]).toMatchObject({ req: b, ok: false, error: 'http 500' });
    expect(c).not.toBe(a);
  });
  it('a real plan request is stored with the system text once', () => {
    const lb = make(), st = { day: 1, time: 0.4, thirst: 0.1, hunger: 0.1, awake: 0.1, carries: {}, home: null, doing: 'free time' };
    const m = buildPlanMessages({ state: st, recent: [], trigger: 'no plan yet', previous: [], possible: null, notes: [], journal: [], mode: 'loose' });
    lb.request(m); lb.request(m);
    expect(linesOf(lb).filter(x => x.k === 'sys').length).toBe(1);
  });
  it('the API key is in no line: not in a request, an answer, an error, a decision or the header', () => {
    const lb = make();
    const id = lb.request(msgs('the key is ' + KEY)); lb.answer(id, { text: 'echo ' + KEY, ms: 1, model: 'm' }); lb.answer(id, new Error('failed with ' + KEY));
    lb.event({ type: 'x', note: KEY }); lb.decision({ point: 'goal', menu: [], reason: KEY, used: 'ai' });
    expect(lb.text()).not.toContain(KEY); expect(lb.text()).toContain('***');
    expect(scrubSecrets('a ' + KEY + ' b', [KEY, 'ab'])).toBe('a *** b');
  });
  it('every line is JSON with its own number, and the numbers rise', () => {
    const lb = make(); lb.event({ type: 'a' }); lb.event({ type: 'b' }); lb.request(msgs('x'));
    const ns = linesOf(lb).slice(1).map(x => x.n); expect(ns).toEqual([...ns].sort((a, b) => a - b)); expect(new Set(ns).size).toBe(ns.length);
  });
  it('the file name has the seed and the day', () => { expect(fileName(1337, 12)).toBe('driftwood-log-1337-day12.jsonl'); expect(make().fileName()).toBe('driftwood-log-1337-day3.jsonl'); });
  it('time helpers', () => { expect(dayLabel(0.5)).toBe('12:00'); expect(dayLabel(0.999)).toBe('23:58'); expect(dayLabel(0)).toBe('00:00'); expect(slotOf(1 + SNAP_EVERY * 3 + 0.0001)).toBe(51); });
});

describe('the half-hour snapshot', () => {
  it('one at the start, then one per half game hour, only calling the snapshot when it is due', () => {
    const lb = make(); let calls = 0; const snap = () => { calls++; return { thirst: 0.2 }; };
    tot = 2.5; lb.tick({ snapshot: snap });                       // at the start
    tot = 2.5 + 0.01; lb.tick({ snapshot: snap });                // 14 minutes later: none
    tot = 2.5 + SNAP_EVERY + 0.0001; lb.tick({ snapshot: snap }); // half an hour: one
    tot = 2.5 + SNAP_EVERY + 0.01; lb.tick({ snapshot: snap });   // none
    tot = 2.5 + SNAP_EVERY * 2 + 0.0001; lb.tick({ snapshot: snap });
    expect(calls).toBe(3); const rows = linesOf(lb).filter(x => x.k === 'snap');
    expect(rows.length).toBe(3); expect(rows[0]).toMatchObject({ thirst: 0.2, ai: true, leash: 'loose' }); expect(rows[1].t).toBe('12:30'); expect(rows[2].t).toBe('13:00');
    tot = 0.5;
  });
  it('a snapshot with a game and a mind has the vitals, the fire, the store, what he carries, the tide, the weather and where he is', () => {
    const world = { }; void world;
    const snap = snapshotEntry({ clock: { day: 2, time: 0.5, total: 2.5 }, thirst: { days: 0.31 }, hunger: { days: 0.12 }, sleep: { awake: 0.4, asleep: false }, player: { x: 3.14159, z: -7 }, fire: { fires: [{ x: 3, z: -7, fuel: 2.456, embers: 1, fed: 3 }, { x: 900, z: 0, fuel: 1, embers: 1 }], torch: null }, rain: 0.5, wood: { carried: [{}, {}], stones: [] } },
      { recent: [], camp: () => ({ fire: 'low', store: { dry: 3, wet: 1, branches: 0, fronds: 0, stones: 0, logs: 0 } }), home: () => ({ x: 0, z: 0 }), blockers: () => { throw new Error('must not be asked'); }, stripWood: () => { throw new Error('must not be asked'); } });
    expect(snap).toMatchObject({ thirst: 0.31, hunger: 0.12, awake: 0.4, asleep: false, x: 3.14, z: -7, fire: 'low', camp: { dry: 3, wet: 1 }, rain: 0.5, raining: true });
    expect(snap.fires).toEqual([{ fuel: 2.46, embers: 1, fed: 3 }]); expect(snap.carries.driftwood).toBe(2); expect(snap.tide).toMatchObject({ name: expect.any(String) });
  });
});

describe('the cap', () => {
  it('drops the oldest requests first, then the oldest snapshots, then the oldest of the rest; the system text stays', () => {
    const lb = make({ max: 3000 });
    lb.request(msgs('sys holder', 'S'));
    for (let i = 0; i < 4; i++) lb.event({ type: 'ev' + i });
    for (let i = 0; i < 4; i++) { tot = 1 + i * 0.1; lb.tick({ snapshot: () => ({ pad: 'x'.repeat(100) }) }); }
    for (let i = 0; i < 6; i++) lb.request(msgs('user ' + i + ' ' + 'r'.repeat(300), 'S'));
    const rows = () => linesOf(lb).slice(1), count = k => rows().filter(x => x.k === k).length;
    expect(lb.size()).toBeLessThanOrEqual(3000);
    expect(count('sys')).toBe(1); expect(count('ev')).toBe(4);
    const before = lb.dropped(); expect(before.req).toBeGreaterThan(0); expect(before.snap).toBe(0);
    const left = rows().filter(x => x.k === 'req').map(x => x.user[0].content.slice(0, 7)); expect(left[left.length - 1]).toBe('user 5 ');   // the newest request is kept
    // more requests than fit: all go, then the snapshots
    for (let i = 0; i < 8; i++) lb.request(msgs('big ' + 'q'.repeat(900), 'S'));
    for (let i = 0; i < 12; i++) { tot = 2 + i * 0.1; lb.tick({ snapshot: () => ({ pad: 'y'.repeat(150) }) }); }
    expect(lb.size()).toBeLessThanOrEqual(3000); expect(count('ev')).toBe(4); expect(lb.dropped().snap).toBeGreaterThan(0);
    expect(linesOf(lb)[0].dropped).toMatchObject({ req: lb.dropped().req, snap: lb.dropped().snap });
    tot = 0.5;
  });
  it('when requests and snapshots are gone the oldest events go, never the system text', () => {
    const lb = make({ max: 2500 });
    lb.request(msgs('x', 'S')); for (let i = 0; i < 40; i++) lb.event({ type: 'e' + i, pad: 'z'.repeat(150) });
    const rows = linesOf(lb).slice(1), ev = rows.filter(x => x.k === 'ev');
    expect(lb.size()).toBeLessThanOrEqual(2500); expect(rows.filter(x => x.k === 'sys').length).toBe(1); expect(ev[ev.length - 1].type).toBe('e39'); expect(ev[0].type).not.toBe('e0'); expect(lb.dropped().other).toBeGreaterThan(0);
  });
  it('the default cap is about 20 MB', () => { expect(LOG_MAX_BYTES).toBe(20000000); });
});

describe('keeping it in the store', () => {
  it('writes the new lines in one batch and the dropped ones as removals', async () => {
    const st = fakeStore(), lb = make({ store: st, max: 1500 });
    await lb.open(); lb.event({ type: 'a' }); lb.event({ type: 'b' }); await lb.flush();
    expect(st.writes).toBe(1); expect(st.lines.size).toBe(2); expect(st.meta.seed).toBe(1337);
    await lb.flush(); expect(st.writes).toBe(1);   // nothing new: nothing written
    for (let i = 0; i < 12; i++) lb.event({ type: 'e' + i, pad: 'z'.repeat(150) });
    await lb.flush(); expect(st.writes).toBe(2); expect(st.lines.size).toBe(linesOf(lb).length - 1);
  });
  it('runs on across a reload: the lines come back, the numbers go on, the system text is not stored again', async () => {
    const st = fakeStore(), a = make({ store: st }); await a.open();
    a.request(msgs('one')); a.event({ type: 'first' }); await a.flush();
    const b = make({ store: st }); await b.open({ clear: false });
    b.request(msgs('two')); b.event({ type: 'second' });
    const rows = linesOf(b).slice(1), ns = rows.map(x => x.n);
    expect(rows.filter(x => x.k === 'sys').length).toBe(1); expect(rows.filter(x => x.k === 'req').length).toBe(2); expect(rows.map(x => x.type).filter(Boolean)).toEqual(['first', 'second']);
    expect(ns).toEqual([...ns].sort((p, q) => p - q)); expect(new Set(ns).size).toBe(ns.length);
    expect(rows.find(x => x.k === 'req' && x.user[0].content === 'two').id).not.toBe(rows.find(x => x.k === 'req' && x.user[0].content === 'one').id);
  });
  it('is cleared when a new game starts: a clear, a new seed or an explicit clear()', async () => {
    const st = fakeStore(), a = make({ store: st }); await a.open(); a.event({ type: 'old' }); await a.flush();
    const b = make({ store: st }); await b.open({ clear: true }); expect(st.lines.size).toBe(0); expect(linesOf(b).length).toBe(1);
    b.event({ type: 'mine' }); await b.flush();
    const c = make({ store: st, seed: 2024 }); await c.open(); expect(linesOf(c).length).toBe(1); expect(st.lines.size).toBe(0);   // another island
    c.event({ type: 'x' }); await c.flush(); expect(st.lines.size).toBe(1);
    await c.clear(); expect(st.lines.size).toBe(0); expect(linesOf(c).length).toBe(1); expect(c.count()).toBe(0);
    const d = make({ store: st, seed: 2024 }); await d.open(); expect(linesOf(d).length).toBe(1);   // still empty after a reload
  });
  it('without IndexedDB, or when it fails, the log goes on in memory', async () => {
    const lb = make({ store: null }); await lb.open(); lb.event({ type: 'a' }); await lb.flush(); expect(lb.persistent()).toBe(false); expect(linesOf(lb).length).toBe(2);
    const st = fakeStore(), b = make({ store: st }); await b.open(); st.fail = true; b.event({ type: 'a' }); await b.flush(); expect(b.persistent()).toBe(false);
    b.event({ type: 'b' }); await b.flush(); expect(linesOf(b).filter(x => x.k === 'ev').length).toBe(2);
  });
  it('openLogStore rejects without indexedDB or when it does not answer', async () => {
    await expect(openLogStore(null)).rejects.toThrow();
    await expect(openLogStore({ open: () => ({}) }, { timeout: 20 })).rejects.toThrow();
    await expect(openLogStore({ open: () => { throw new Error('denied'); } })).rejects.toThrow('denied');
    expect(LOG_DB).toBe('driftwood-log');
  });
});

describe('with the AI off', () => {
  it('the rules\' own decisions are recorded while the AI is off, and not when it is on or the answer is WAIT', () => {
    let on = false; const lb = make();
    const menu = makeMenu('goal', [option({ id: 'fire', goal: 'fire', what: 'tend the fire' }), option({ id: 'idle', goal: 'idle', what: 'rest' })]);
    const chooser = () => 'idle'; chooser.selfChecked = true; chooser.allowPreempt = () => true;
    const w = wrapChooser(chooser, { on: () => on, record: (p, m, c) => lb.rulesDecision(p, m, c) });
    expect(w('goal', menu, {})).toBe('idle'); expect(w.selfChecked).toBe(true); expect(w.allowPreempt()).toBe(true);
    on = true; w('goal', menu, {}); on = false;
    w('event', makeMenu('event', [option({ id: 'continue' })]), {}); w('goal', makeMenu('goal', [option({ id: 'idle', goal: 'idle', what: 'rest' })]), {});
    const wait = wrapChooser(() => WAIT, { on: () => false, record: () => { throw new Error('no'); } }); expect(wait('goal', menu, {})).toBe(WAIT);
    const d = linesOf(lb).filter(x => x.k === 'decision'); expect(d.length).toBe(1);
    expect(d[0]).toMatchObject({ point: 'goal', menu: ['fire', 'idle'], rules: 'idle', ai: null, used: 'rules', why: 'off' });
  });
  it('a recorder that throws does not change the answer', () => {
    const menu = makeMenu('goal', [option({ id: 'a', goal: 'a', what: 'a' }), option({ id: 'b', goal: 'b', what: 'b' })]);
    expect(wrapChooser(() => 'b', { record: () => { throw new Error('x'); } })('goal', menu, {})).toBe('b');
  });
});

describe('his life is the same with the logbook listening', () => {
  let world, spawn;
  beforeAll(async () => { world = await generateWorld(1337); spawn = startSpot(world); }, 120000);
  const live = (listen, secs = 3600) => {
    const game = createGame(world, spawn, { time: 0.3 }); game.known.visit(spawn.x, spawn.z);
    const lb = make({ clock: () => ({ day: game.clock.day + 1, time: game.clock.time, total: game.clock.total }) });
    const base = rulesChooser;
    const mind = createMind(world, game, { chooser: listen ? wrapChooser(base, { on: () => false, record: (p, m, c) => lb.rulesDecision(p, m, c) }) : base, onEvent: listen ? e => lb.event(e) : undefined });
    mind.engage();
    for (let t = 0; t < secs; t += 0.1) {
      mind.step(0.1); game.update(mind.input, 0.1);
      if (listen && Math.round(t * 10) % 10 === 0) { lb.tick({ now: mind.now(), snapshot: () => snapshotEntry(game, mind) }); }
    }
    return { state: JSON.stringify(game.state()), stats: JSON.stringify(mind.stats), recent: JSON.stringify(mind.recent), mind: JSON.stringify(mind.state()), lb };
  };
  it('the island state, the mind\'s stats and short-term list are exactly equal after an hour of play', () => {
    const a = live(false), b = live(true);
    expect(b.state).toBe(a.state); expect(b.stats).toBe(a.stats); expect(b.recent).toBe(a.recent); expect(b.mind).toBe(a.mind);
    const rows = linesOf(b.lb), types = new Set(rows.filter(x => x.k === 'ev').map(x => x.type));
    expect(types.has('goal')).toBe(true); expect(types.has('goal-end')).toBe(true); expect(types.has('walk')).toBe(true); expect(types.has('act')).toBe(true);
    expect(rows.some(x => x.k === 'snap')).toBe(true); expect(rows.some(x => x.k === 'now')).toBe(true); expect(rows.some(x => x.k === 'decision' && x.why === 'off')).toBe(true);
    const goals = rows.filter(x => x.k === 'ev' && x.type === 'goal'); expect(goals[0].goal).toBeTruthy(); expect(goals[0].t).toMatch(/^\d\d:\d\d$/);
  }, 120000);
  it('a listener that throws changes nothing', () => {
    const run = bad => { const game = createGame(world, spawn, { time: 0.3 }); game.known.visit(spawn.x, spawn.z); const mind = createMind(world, game, bad ? { onEvent: () => { throw new Error('x'); } } : {}); mind.engage(); for (let t = 0; t < 600; t += 0.1) { mind.step(0.1); game.update(mind.input, 0.1); } return JSON.stringify(game.state()) + JSON.stringify(mind.stats); };
    expect(run(true)).toBe(run(false));
  }, 60000);
});

describe('the download button', () => {
  it('saveTextFile makes a Blob and a link with `download`, clicks it and removes it', () => {
    const made = []; let clicked = 0, removed = 0, revoked = 0;
    const doc = { createElement: tag => { const a = { tag, style: {}, click() { clicked++; }, remove() { removed++; } }; made.push(a); return a; }, body: { appendChild: a => { a.attached = true; } } };
    const url = { createObjectURL: b => { expect(b).toBeInstanceOf(Blob); expect(b.size).toBe(8); return 'blob:x'; }, revokeObjectURL: () => { revoked++; } };
    saveTextFile('driftwood-log-1-day2.jsonl', '{"a":1}\n', { doc, url });
    expect(made[0]).toMatchObject({ tag: 'a', href: 'blob:x', download: 'driftwood-log-1-day2.jsonl', attached: true }); expect(clicked).toBe(1); expect(removed).toBe(1);
  });
  it('the version is a 0.36 release with a name (the exact one is asserted in tests/devPanel.test.js)', () => { expect(VERSION).toMatch(/^0\.36\.\d+$/); expect(NAME.length).toBeGreaterThan(2); });
});
