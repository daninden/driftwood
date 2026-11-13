// 0.36.7 "Memory": the short-term list saved with the island, his own notes (written only by the model), the sunset journal line, the AI panel's Memory block, and the crab fix
// (a destination the model named that is not possible makes the step not possible: no silent substitution, no reason spoken, the real reason told). No network ever: a fake ask.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { createMind, crabTripOk, crabHabitOk, crabTripBlock, CRAB_TIDE, CRAB_FROM, CRAB_TO, AI_FROM, AI_TRIP_TO } from '../src/game/mind.js';
import { WAIT, goalMenu, pastimeMenu, rulesChooser } from '../src/game/intent.js';
import { chooseGoal, VERY_AT, VERY_HUNGER_AT } from '../src/game/mind.js';
import { DUSK } from '../src/game/sleep.js';
import { createAiChooser } from '../src/ai/chooser.js';
import { parsePlan, buildPlanMessages, buildJournalMessages, parseJournal, stateText, snapshotOf, journalLines, FIXED, nowText } from '../src/ai/prompt.js';
import { NOTES_MAX, NOTE_LEN, JOURNAL_LEN, JOURNAL_DAYS } from '../src/ai/config.js';
import { memoryParts, logText, groupByPlan, nowParts } from '../src/render/aiPanel.js';
import { VERSION, NAME } from '../src/version.js';
import { serialise, parseSave } from '../src/save.js';
import { runMind, walkFirstDay } from './helpers/mindSim.js';

const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const calm = (o = {}) => ({ asleep: false, time: 0.4, thirst: 0.1, hunger: 0.1, awake: 0.3, canLie: false, water: true, waterNear: false, shellsEmpty: 0, shellsFull: 0, nuts: 2, fibre: 2, torch: false, fireLit: false, fireFuel: 0, stock: 99, spare: 0, canLight: false, cool: {}, ...o });
const quietMenu = () => goalMenu(calm({ nuts: 0 }), chooseGoal, { thirst: VERY_AT, hunger: VERY_HUNGER_AT });
const ctxOf = () => { const r = () => 0.5; return { rand: r, ex: r, fish: r }; };
const dayMenu = () => pastimeMenu('day', { home: { ok: true }, spear: { ok: false }, stroll: { ok: true, chance: 0.9, kind: () => 'shore' } });
const textOf = (o = {}) => async () => ({ text: JSON.stringify(o), ms: 500, model: 'gemini-x' });

describe('his notes: the plan answer', () => {
  const plan = extra => JSON.stringify({ plan: [{ step: 'stores', reason: 'r' }], reason: 'x', ...extra });
  it('a list of lines is read: trimmed, whitespace collapsed, cut to 80 characters, empty lines dropped', () => {
    const p = parsePlan(plan({ notes: ['  the spring  is\nnorth ', '', '   ', 'x'.repeat(200), 5, null] }));
    expect(p.ok).toBe(true); expect(p.notes).toEqual(['the spring is north', 'x'.repeat(NOTE_LEN)]);
  });
  it('at most 20 lines: the newest 20 stay', () => {
    const many = Array.from({ length: 25 }, (_, i) => 'note ' + i);
    expect(parsePlan(plan({ notes: many })).notes).toEqual(many.slice(-NOTES_MAX)); expect(NOTES_MAX).toBe(20); expect(NOTE_LEN).toBe(80);
  });
  it('an empty list clears the notes; a missing or unusable one changes nothing (null)', () => {
    expect(parsePlan(plan({ notes: [] })).notes).toEqual([]);
    for (const bad of [undefined, 'a note', 5, { a: 1 }, null, [5, null, {}]]) expect(parsePlan(plan({ notes: bad })).notes, JSON.stringify(bad)).toBeNull();
    expect(parsePlan('{"choice":"stores"}').notes).toBeNull();
  });
  it('the request shows the notes (or none yet), explains how to change them, and only the last 3 days of the journal', () => {
    const journal = [1, 2, 3, 4, 5].map(day => ({ day, line: 'line of day ' + day }));
    const m = buildPlanMessages({ state: { day: 6, time: 0.5, carries: {} }, recent: [], trigger: 't', previous: [], possible: {}, mode: 'loose', notes: ['the spring is north', 'the spear needs fibre'], journal })[1].content;
    expect(m).toContain('Your notes (you keep these yourself; return the full list in "notes" to change them, leave it out to keep them)');
    expect(m).toContain('1. the spring is north'); expect(m).toContain('2. the spear needs fibre');
    expect(m).toContain('day 3: line of day 3'); expect(m).toContain('day 5: line of day 5'); expect(m).not.toContain('day 2: line'); expect(JOURNAL_DAYS).toBe(3);
    expect(buildPlanMessages({ state: {}, recent: [], trigger: 't', previous: [], possible: {}, mode: 'loose' })[1].content).toContain('(none yet)');
    expect(FIXED).toContain('"notes"'); expect(journalLines([])).toEqual([]);
  });
  it('the chooser keeps the new notes of an answer, and the old ones when the answer has none', async () => {
    const t = { s: 100 }, clock = { day: 0, time: 0.5 };
    let reply = textOf({ plan: [{ step: 'stores', reason: 'r' }], reason: 'x', notes: ['first note'] });
    const ai = createAiChooser({ rulesChooser, ask: m => reply(m), now: () => t.s, enabled: () => true, clock: () => clock, mode: () => 'strict' });
    ai.attach({ recent: [], goal: 'idle', menu: () => quietMenu() }, { clock });
    expect(ai.chooser('goal', quietMenu(), ctxOf())).toBe(WAIT); await flush(); t.s += 1; ai.chooser('goal', quietMenu(), ctxOf());
    expect(ai.notes()).toEqual(['first note']); expect(ai.memoryVersion).toBeGreaterThan(0);
    reply = textOf({ plan: [{ step: 'stores', reason: 'r' }], reason: 'x' });
    t.s += 100; clock.day = 1; ai.chooser('goal', quietMenu(), ctxOf()); await flush(); t.s += 1; ai.chooser('goal', quietMenu(), ctxOf());
    expect(ai.notes()).toEqual(['first note']);
  });
});

describe('the short-term list and the notes are saved with the island', () => {
  const mk = () => {
    const clock = { day: 3, time: 0.5, total: 3.5 }, mind = { recent: [], goal: 'idle', menu: () => quietMenu() };
    const ai = createAiChooser({ rulesChooser, ask: textOf(), now: () => 1, enabled: () => false, clock: () => clock });
    ai.attach(mind, { clock }); return { ai, mind, clock };
  };
  it('memory() -> save -> parse -> restore gives the same list, notes and journal; entries under way come back interrupted', async () => {
    const a = mk();
    a.mind.recent.push({ t: 3.1, day: 3, kind: 'goal', what: 'drink', outcome: 'done' }, { t: 3.2, day: 3, kind: 'pastime', what: 'stroll', outcome: null });
    a.ai.restore({ notes: ['a', 'b'], journal: [{ day: 1, line: 'One.' }, { day: 2, line: 'Two.' }], asked: 2 });
    const w = await generateWorld(1337), g = createGame(w, startSpot(w));
    const saved = parseSave(serialise({ ...g.state(), memory: a.ai.memory() }), 1337);
    expect(saved).not.toBeNull(); expect(saved.memory.notes).toEqual(['a', 'b']);
    const b = mk(); b.ai.restore(saved.memory);
    expect(b.ai.notes()).toEqual(['a', 'b']); expect(b.ai.journal()).toEqual([{ day: 1, line: 'One.' }, { day: 2, line: 'Two.' }]);
    expect(b.mind.recent).toEqual([{ t: 3.1, day: 3, kind: 'goal', what: 'drink', outcome: 'done' }, { t: 3.2, day: 3, kind: 'pastime', what: 'stroll', outcome: 'interrupted' }]);
    expect(b.ai.memory().asked).toBe(2);
  });
  it('a game without memory starts empty; a bad memory field is refused like the other fields', async () => {
    const w = await generateWorld(1337), g = createGame(w, startSpot(w)), good = () => JSON.parse(serialise(g.state()));
    expect(parseSave(JSON.stringify(good()), 1337).memory).toBeUndefined();
    const b = mk(); b.ai.restore(undefined); expect(b.ai.notes()).toEqual([]); expect(b.ai.journal()).toEqual([]); expect(b.mind.recent).toEqual([]);
    for (const bad of [5, 'x', [1], { notes: 'a' }, { notes: new Array(21).fill('a') }, { journal: [{ day: 1.5, line: 'x' }] }, { journal: [{ day: 1 }] }, { recent: new Array(21).fill({ t: 1, day: 1, kind: 'goal' }) }, { recent: [{ t: 'a', day: 1, kind: 'goal' }] }, { asked: 'x' }])
      expect(parseSave(JSON.stringify({ ...good(), memory: bad }), 1337), JSON.stringify(bad)).toBeNull();
  });
  it('a skipped plan step goes into the ONE list (the mind\'s recent, at most 20) and is what the request shows as "What he did lately"', () => {
    const w = { recent: [] };
    const clock = { day: 1, time: 0.5, total: 1.5 }, t = { s: 1 };
    const ai = createAiChooser({ rulesChooser, ask: async () => ({ text: JSON.stringify({ plan: [{ step: 'spear', reason: 'r' }, { step: 'linger', reason: 'r' }], reason: 'x' }) }), now: () => t.s, enabled: () => true, clock: () => clock, mode: () => 'strict' });
    ai.attach({ ...w, goal: 'idle', menu: () => quietMenu(), blockers: () => ({ spear: 'no branch and stone near' }) }, { clock });
    expect(ai.chooser('goal', quietMenu(), ctxOf())).toBe(WAIT);
    return flush().then(() => {
      t.s += 1; ai.chooser('goal', quietMenu(), ctxOf());   // the spear step is not possible: skipped (the gap since the request forbids a new one)
      const m = ai.memory();
      expect(m.recent.some(r => r.kind === 'plan step' && r.what === 'spear' && /skipped: not possible \(no branch and stone near\)/.test(r.outcome))).toBe(true);
    });
  });
  it('the real mind: remember() adds to recent, which stays at 20; nothing else reads it (a life is the same with it)', async () => {
    const w = await generateWorld(1337), spawn = startSpot(w), g = createGame(w, spawn, {}), m = createMind(w, g);
    for (let i = 0; i < 30; i++) m.remember('plan step', 'x' + i, 'skipped');
    expect(m.recent.length).toBe(20); expect(m.recent[19]).toMatchObject({ kind: 'plan step', what: 'x29', outcome: 'skipped' });
  });
});

describe('the sunset journal line', () => {
  const setup = (o = {}) => {
    const clock = { day: 4, time: DUSK + 0.01, total: 4.84 }, st = { on: true, send: true }, asks = [];
    const ai = createAiChooser({ rulesChooser, ask: m => { asks.push(m); return o.reply ? o.reply(m) : textOf({ line: 'A quiet day; the crab got away.' })(m); }, now: () => 1, enabled: () => st.on, canSend: () => st.send, clock: () => clock });
    ai.attach({ recent: [{ t: 4.4, day: 4, kind: 'goal', what: 'drink', outcome: 'done' }], goal: 'idle', menu: () => quietMenu() }, { clock });
    return { ai, clock, st, asks };
  };
  it('one extra request at sunset, stored when it comes back; not asked again the same day, also not after a reload', async () => {
    const s = setup(); s.ai.tick(); expect(s.asks.length).toBe(1); await flush();
    expect(s.ai.journal()).toEqual([{ day: 4, line: 'A quiet day; the crab got away.' }]);
    s.ai.tick(); s.ai.tick(); expect(s.asks.length).toBe(1);
    const r = setup(); r.ai.restore(s.ai.memory()); r.ai.tick(); expect(r.asks.length).toBe(0);   // a reload the same evening
    r.clock.day = 5; r.ai.tick(); expect(r.asks.length).toBe(1);   // the next day's sunset
  });
  it('the request holds the day\'s list and the state, and asks for one line of at most 140 characters', async () => {
    const s = setup(); s.ai.tick();
    const m = s.asks[0]; expect(m[0].content).toContain('ONE line'); expect(m[0].content).toContain(String(JOURNAL_LEN)); expect(m[1].content).toContain('goal: drink -> done'); expect(m[1].content).toContain('Day 4');
    expect(parseJournal('{"line":"' + 'y'.repeat(300) + '"}').line.length).toBe(JOURNAL_LEN);
    expect(parseJournal('nonsense').ok).toBe(false); expect(parseJournal('{"line":"  "}').ok).toBe(false);
    expect(buildJournalMessages({ state: {}, recent: [], journal: [{ day: 1, line: 'Old.' }] })[1].content).toContain('day 1: Old.');
  });
  it('no line before sunset, with the AI off, without budget or while another request runs: the rules never make one up', async () => {
    const early = setup(); early.clock.time = DUSK - 0.01; early.ai.tick(); expect(early.asks.length).toBe(0);
    const off = setup(); off.st.on = false; off.ai.tick(); expect(off.asks.length).toBe(0); expect(off.ai.journal()).toEqual([]);
    const poor = setup(); poor.st.send = false; poor.ai.tick(); expect(poor.asks.length).toBe(0);
    const night = setup(); night.clock.time = 0.05; night.ai.tick(); expect(night.asks.length).toBe(0);   // after midnight the day is not the one that set
  });
  it('a failed or unusable answer leaves no line and is not repeated that day; it does not make Dave wait', async () => {
    const bad = setup({ reply: async () => { throw new Error('boom'); } }); bad.ai.tick(); await flush(); bad.ai.tick(); expect(bad.asks.length).toBe(1); expect(bad.ai.journal()).toEqual([]);
    const junk = setup({ reply: textOf({ other: 1 }) }); junk.ai.tick(); await flush(); expect(junk.ai.journal()).toEqual([]);
    const s = setup({ reply: () => new Promise(() => {}) }); s.ai.tick();   // never answers: the decisions go on at once (the rules answer while the plan is not possible to ask)
    expect(s.ai.chooser('goal', quietMenu(), ctxOf())).not.toBe(WAIT);
  });
});

describe('the AI panel\'s Memory block', () => {
  it('shows the notes in order and the journal newest day first, with plain counts', () => {
    const m = memoryParts(['a', '', 'b'], [{ day: 1, line: 'One' }, { day: 3, line: 'Three' }, { day: 2, line: 'Two' }, { day: 4 }]);
    expect(m.notes).toEqual(['a', 'b']); expect(m.journal.map(j => j.text)).toEqual(['Day 3: Three', 'Day 2: Two', 'Day 1: One']); expect(m.head).toBe('Memory: 2 notes, 3 journal lines');
    expect(memoryParts(undefined, undefined)).toEqual({ head: 'Memory: 0 notes, 0 journal lines', notes: [], journal: [] });
    expect(memoryParts(['x'], []).head).toBe('Memory: 1 note, 0 journal lines');
  });
});

describe('the crab fix: a destination that is not possible', () => {
  const NOFIRE = 'no fire burning and no fibre to light one';
  const setup = (to = 'crabs', o = {}) => {
    const t = { s: 1000 }, clock = { day: 0, time: 0.5 }, said = [], st = { crabsOk: !!o.ok };
    const reply = textOf({ plan: [{ step: 'stores', reason: 'wood' }, { step: 'stroll', to, reason: 'the crabs, at low water' }, { step: 'linger', reason: 'rest' }], reason: 'A plan.' });
    const ai = createAiChooser({ rulesChooser, onStep: x => said.push(x), ask: reply, now: () => t.s, enabled: () => true, clock: () => clock, mode: () => 'strict' });
    ai.attach({ recent: [], goal: 'idle', menu: () => quietMenu(), blockers: () => (st.crabsOk ? {} : { crabs: NOFIRE }), destinations: () => ({ stroll: st.crabsOk ? ['shore', 'crabs'] : ['shore'], explore: ['coast', 'forest'] }) }, { clock });
    return { ai, t, said, st, clock };
  };
  const planned = async s => { expect(s.ai.chooser('goal', quietMenu(), ctxOf())).toBe(WAIT); await flush(); s.t.s += 0.6; return s.ai.chooser('goal', quietMenu(), ctxOf()); };

  it('the stroll to the crabs is skipped with the real reason, never spoken; the game never gets another stroll kind', async () => {
    const s = setup(); await planned(s);   // stores taken
    expect(s.said.map(x => x.id)).toEqual(['stores']);
    s.t.s += 1; const c = s.ai.chooser('goal', quietMenu(), ctxOf());
    const st = s.ai.plan().steps[1];
    expect(st.state).toBe('skipped'); expect(st.note).toBe(`not possible (no stroll to the crabs now: ${NOFIRE})`);
    expect(s.said.map(x => x.id)).toEqual(['stores']);   // the model's words about the crabs were never said
    expect(c).toBe('idle');   // the plan went on to its next step (linger) through free time
    expect(s.ai.memory().recent.some(r => r.what === 'stroll' && r.outcome === `skipped: not possible (no stroll to the crabs now: ${NOFIRE})`)).toBe(true);
  });
  it('at the pastime point too: no step taken, no reason said, the stroll is not returned', async () => {
    const s = setup(); await planned(s); s.t.s += 1; s.ai.chooser('goal', quietMenu(), ctxOf());   // a short way on, then the pastime point
    const c = s.ai.chooser('pastime', dayMenu(), ctxOf());
    expect(c).toBe('linger'); expect(s.said.some(x => x.id === 'stroll')).toBe(false);
  });
  it('when a new plan can be asked, the reason goes into the request as why', async () => {
    const s = setup(); await planned(s); s.t.s += 60;   // the gap since the last request has passed
    expect(s.ai.chooser('goal', quietMenu(), ctxOf())).toBe(WAIT);
    expect(s.ai.asking()).toBe(`the next step, stroll, was not possible now (no stroll to the crabs now: ${NOFIRE})`);
  });
  it('when the crab trip IS possible the step runs as planned and its reason is said', async () => {
    const s = setup('crabs', { ok: true }); await planned(s); s.t.s += 1; s.ai.chooser('goal', quietMenu(), ctxOf());
    const c = s.ai.chooser('pastime', dayMenu(), ctxOf());
    expect(c).toEqual({ id: 'stroll', kind: 'crabs' }); expect(s.said.map(x => x.reason)).toEqual(['wood', 'the crabs, at low water']);
  });
  it('another place that is not offered is not possible either (no shore: no stroll to it)', async () => {
    const s = setup('river'); await planned(s); s.t.s += 1; s.ai.chooser('goal', quietMenu(), ctxOf());
    expect(s.ai.plan().steps[1].note).toMatch(/no river place to stroll to now/); expect(s.said.some(x => x.id === 'stroll')).toBe(false);
  });
});

describe('the crab reason, from the same checks as the crab trip', () => {
  const base = { sea: CRAB_TIDE - 0.05, time: 0.5, crabs: 0, flames: true, canLight: false, fibre: 0, pileDry: true, cool: {} };
  it('every way the trip is not possible has a plain reason; it is null exactly when crabTripOk holds', () => {
    expect(crabTripBlock(base)).toBeNull(); expect(crabTripOk(base)).toBe(true);
    const cases = [
      [{ sea: CRAB_TIDE + 0.1 }, /not low water/], [{ crabs: 1 }, 'he already carries a crab'], [{ cool: { crabs: true } }, 'a crab trip failed a moment ago'],
      [{ time: AI_FROM - 0.02 }, 'outside 04:19 to 15:50'], [{ time: AI_TRIP_TO + 0.01 }, 'outside 04:19 to 15:50'],
      [{ flames: false }, 'no fire burning and he cannot light one'], [{ flames: false, canLight: true, fibre: 1 }, 'no fire burning and no fibre to light one'],
      [{ flames: false, canLight: true, fibre: 2, pileDry: false }, 'no fire burning and no dry wood to light one'],
    ];
    for (const [d, why] of cases) { const s = { ...base, ...d }, r = crabTripBlock(s); expect(r, JSON.stringify(d)).toEqual(why instanceof RegExp ? expect.stringMatching(why) : why); expect(crabTripOk(s)).toBe(false); }
    expect(crabTripBlock({ ...base, flames: false, canLight: true, fibre: 2 })).toBeNull();   // he can light one
    for (const sea of [-0.3, -0.1, 0]) for (const time of [0.3, 0.4, 0.6, 0.7]) for (const flames of [true, false]) for (const crabs of [0, 1]) { const s = { ...base, sea, time, flames, crabs }; expect(crabTripBlock(s) === null).toBe(crabTripOk(s)); }
    expect(crabTripOk({ ...base, time: 0.25 })).toBe(true); expect(crabHabitOk({ ...base, time: 0.25 })).toBe(false); expect(crabHabitOk({ ...base, time: CRAB_FROM })).toBe(true);   // the hours of 09:07 to 15:50 are the rules' habit, not a condition
  });
  it('mind.blockers() says why a stroll to the crabs is not possible, and mind.destinations() agrees', async () => {
    const w = await generateWorld(1337), spawn = startSpot(w), g = createGame(w, spawn, {}); walkFirstDay(w, g, spawn, {}); g.known.visit(spawn.x, spawn.z);
    const m = createMind(w, g), b = m.blockers(), d = m.destinations();
    expect(d.stroll.includes('crabs')).toBe(b.crabs === undefined);
    if (b.crabs !== undefined) expect(typeof b.crabs).toBe('string');
    expect(Object.keys(b).includes('crabs') ? b.crabs.length > 0 : true).toBe(true);
  });
});

describe('the tide line and the destinations line tell the crab conditions honestly', () => {
  const low = { day: 2, time: 0.45, carries: {}, tide: { name: 'low', falling: true, turn: 0.55, level: -0.3 } };
  it('low water says a stroll to the crabs is possible only when it is; otherwise why not', () => {
    expect(stateText({ ...low, crab: { ok: true } })).toContain('a stroll to the crabs is possible now');
    const no = stateText({ ...low, crab: { ok: false, why: 'no fire burning and no fibre to light one' } });
    expect(no).toContain('no stroll to the crabs now: no fire burning and no fibre to light one'); expect(no).not.toContain('is the crab time');
    expect(stateText(low)).not.toContain('crabs');   // not known: nothing is claimed
    expect(stateText({ ...low, tide: { name: 'half', falling: false, turn: 0.7 }, crab: { ok: false, why: 'x' } })).not.toContain('crabs');   // only at low water
  });
  it('the request lists "crabs: not now" with the reason beside the places that are offered', () => {
    const m = buildPlanMessages({ state: { day: 1, time: 0.5, carries: {} }, recent: [], trigger: 't', previous: [], mode: 'loose', possible: { goals: null, pastimes: null, blocked: { crabs: 'he already carries a crab' }, destinations: { stroll: ['shore'], explore: ['coast'] } } })[1].content;
    expect(m).toContain('stroll to shore; explore to coast. Crabs: not now: he already carries a crab.');
    const ok = buildPlanMessages({ state: { day: 1, time: 0.5, carries: {} }, recent: [], trigger: 't', previous: [], mode: 'loose', possible: { goals: null, pastimes: null, blocked: {}, destinations: { stroll: ['shore', 'crabs'], explore: ['coast'] } } })[1].content;
    expect(ok).toContain('stroll to shore, crabs;'); expect(ok).not.toContain('Crabs: not now');
  });
  it('snapshotOf reads the crab fact from the mind\'s blockers', () => {
    expect(snapshotOf({ clock: { day: 1, time: 0.5 } }, { blockers: () => ({ crabs: 'he already carries a crab' }) }).crab).toEqual({ ok: false, why: 'he already carries a crab' });
    expect(snapshotOf({ clock: { day: 1, time: 0.5 } }, { blockers: () => ({}) }).crab).toEqual({ ok: true });
    expect(snapshotOf({ clock: { day: 1, time: 0.5 } }, {}).crab).toBeNull();
  });
});

describe('with the AI off nothing changes', () => {
  it('a life with the AI chooser off (and a memory restored) is the same as the default chooser\'s', async () => {
    const w = await generateWorld(1337), spawn = startSpot(w);
    const sig = r => JSON.stringify([r.stats && r.stats.goals, r.idleShare, r.mix]);
    const a = runMind(w, spawn, { days: 0.4, know: true });
    const ai = createAiChooser({ rulesChooser, ask: async () => { throw new Error('never'); }, enabled: () => false });
    const b = runMind(w, spawn, { days: 0.4, know: true, chooser: ai.chooser });
    expect(sig(b)).toBe(sig(a));
  }, 120000);
});

describe('an event shortly after a new plan: the current plan goes on', () => {
  const planOf = (...ids) => textOf({ plan: ids.map(step => ({ step, reason: 'because ' + step })), reason: 'A plan.' });
  const mk = () => {
    const t = { s: 1000 }, clock = { day: 0, time: 0.5 }, asks = [];
    const ai = createAiChooser({ rulesChooser, ask: m => { asks.push(m); return planOf('stores', 'home', 'stroll', 'linger')(m); }, now: () => t.s, enabled: () => true, clock: () => clock, mode: () => 'strict' });
    ai.attach({ recent: [], goal: 'idle', menu: () => quietMenu() }, { clock });
    return { ai, t, clock, asks };
  };
  const go = s => s.ai.chooser('goal', quietMenu(), ctxOf());
  it('with a replan wanted inside the gap the next step is followed, not the rules; the new plan is asked when the gap allows', async () => {
    const s = mk(); expect(go(s)).toBe(WAIT); await flush(); s.t.s += 0.6; go(s);   // stores taken
    s.t.s += 1; s.clock.day = 1;   // a new day begins: a new plan is wanted, but one was asked a moment ago
    expect(go(s)).toBe('idle');   // the next step (home) through free time, an AI decision
    expect(s.ai.entries[0]).toMatchObject({ used: 'ai', ai: 'idle' }); expect(s.ai.entries.some(e => e.why === 'waiting')).toBe(false); expect(s.asks.length).toBe(1);
    s.t.s += 60; expect(go(s)).toBe(WAIT); expect(s.asks.length).toBe(2); expect(s.ai.asking()).toBe('a new day begins');   // the gap has passed: the trigger was kept
  });
  it('with no usable step left the rules decide (waiting for the gap); an impossible step is skipped with its reason on the way', async () => {
    const t = { s: 1000 }, clock = { day: 0, time: 0.5 }, asks = [];
    const ai = createAiChooser({ rulesChooser, ask: m => { asks.push(m); return planOf('stores', 'spear')(m); }, now: () => t.s, enabled: () => true, clock: () => clock, mode: () => 'strict' });
    ai.attach({ recent: [], goal: 'idle', menu: () => quietMenu(), blockers: () => ({ spear: 'no branch and stone near' }) }, { clock });
    expect(ai.chooser('goal', quietMenu(), ctxOf())).toBe(WAIT); await flush(); t.s += 0.6; ai.chooser('goal', quietMenu(), ctxOf());   // stores taken
    t.s += 1; clock.day = 1;   // a new plan is wanted inside the gap: the spear step is not possible: skipped with its reason; nothing is left: the rules
    ai.chooser('goal', quietMenu(), ctxOf());
    expect(ai.plan().steps[1]).toMatchObject({ state: 'skipped', note: 'not possible (no branch and stone near)' });
    expect(ai.entries[0]).toMatchObject({ used: 'rules', why: 'waiting' }); expect(asks.length).toBe(1);
  });
});

describe('the "copy log" text', () => {
  const plan = { id: 1, day: 3, time: '07:31', real: 10, trigger: 'a new day begins', reason: 'A plan.', steps: [
    { id: 'stores', label: 'gather supplies', reason: 'wood', state: 'done', at: { day: 3, time: '07:32' } },
    { id: 'stroll', label: 'a stroll', to: 'crabs', reason: 'crabs', state: 'skipped', note: 'not possible (no stroll to the crabs now: no fire)', at: { day: 3, time: '07:40' } }], model: 'gemini-x' };
  const old = { id: 0, day: 1, time: '07:00', real: 1, trigger: 'no plan yet', reason: 'Old.', steps: [{ id: 'home', label: 'home', reason: 'r', state: 'done', at: { day: 1, time: '07:01' } }] };
  const rules = { n: 5, real: 12, day: 3, time: '08:00', point: 'goal', menu: ['drink', 'idle'], options: [{ id: 'drink', what: 'drink' }, { id: 'idle', what: 'free time' }], rules: 'drink', ai: null, used: 'rules', why: 'need', override: 'a need', messages: [{ role: 'user', content: 'SECRET REQUEST BODY' }], raw: 'RAW' };
  const items = groupByPlan([rules], [plan, old]);
  it('holds the version, model, leash, tally, situation, blockers, the plans of the last 2 days with their steps and the rules\' decisions; not older days, no request, no key', () => {
    const t = logText({ items, tally: { ai: 4, rules: 2, differ: 1 }, state: { text: 'Day 3, 08:00.', blocked: { spear: 'he has no branch' } }, model: 'gemini-x', mode: 'loose', models: ['gemini-x'] });
    expect(t).toContain(`${VERSION} "${NAME}"`); expect(t).toContain('Model: gemini-x · leash: loose'); expect(t).toContain('4 by the AI'); expect(t).toContain('Day 3, 08:00.'); expect(t).toContain('Not now: spear (he has no branch).');
    expect(t).toContain('asked because'); expect(t).toContain('1. gather supplies: done'); expect(t).toContain('2. a stroll (crabs): skipped'); expect(t).toContain('no stroll to the crabs now: no fire');
    expect(t).toContain('Rules chose: drink'); expect(t).toContain('Overruled: a need');
    expect(t).not.toContain('SECRET REQUEST BODY'); expect(t).not.toContain('RAW');
    const withOld = logText({ items: groupByPlan([rules], [plan, { ...old, day: 2 }]) }); expect(withOld).toContain('Old.');   // day 2 is inside the last two days
    expect(t).not.toContain('Old.');   // day 1 is not
    expect(t.indexOf('2. a stroll')).toBeLessThan(t.indexOf('Rules chose'));   // oldest first
  });
  it('an empty log still gives the header', () => { expect(logText()).toContain('AI log'); });
});

describe('the "Now" line: what Dave is actually doing', () => {
  it('nowText says goal, pastime (with the stroll kind), phase and trouble in words', () => {
    expect(nowText({ goal: 'stores', phase: 'walking', detail: '23' })).toBe('gather supplies — walking, 23 m to go');
    expect(nowText({ goal: 'fire', phase: 'working', detail: 'feed' })).toBe('see to the fire — working (feed)');
    expect(nowText({ goal: 'idle', pastime: 'stroll', kind: 'shore', phase: 'sitting' })).toMatch(/^free time — .* \(shore\) — sitting$/);
    expect(nowText({ goal: null, phase: 'standing' })).toBe('between errands — standing still');
    expect(nowText({ goal: 'stores', phase: 'standing', trouble: 'stuck' })).toBe('gather supplies — standing still — trouble: stuck');
    expect(nowText({ phase: 'player' })).toBe('you have him'); expect(nowText(null)).toBe('');
  });
  it('the real mind: now() is read only and has a phase; walking gives a distance', async () => {
    const w = await generateWorld(1337), spawn = startSpot(w), g = createGame(w, spawn, {}), m = createMind(w, g);
    expect(m.now()).toMatchObject({ phase: 'player', goal: null });   // nobody is in charge yet
    m.engage(); const seen = new Set();
    for (let i = 0; i < 900; i++) { m.step(0.1); g.update(m.input, 0.1); const n = m.now(); seen.add(n.phase); expect(typeof n.trouble).toBe('string'); if (n.phase === 'walking') expect(Number.isFinite(+n.detail)).toBe(true); }
    expect([...seen].every(p => ['standing', 'walking', 'working', 'sitting', 'resting', 'waiting', 'asleep'].includes(p))).toBe(true); expect(seen.has('walking')).toBe(true);
  }, 60000);
  it('the panel line: waiting seconds, a match is plain, a mismatch is marked with the reason', () => {
    expect(nowParts({ text: 'x', waited: 4.7 }).text).toBe('waiting for a plan (4 s of 10)');
    expect(nowParts({ text: 'gather supplies — walking, 5 m to go', matches: true })).toMatchObject({ mismatch: false, text: 'gather supplies — walking, 5 m to go' });
    expect(nowParts({ text: 'free time — standing still', matches: null }).mismatch).toBe(false);
    const plan = { steps: [{ label: 'gather supplies', state: 'skipped', note: 'no wood known' }] };
    const m = nowParts({ text: 'free time — standing still', matches: false, step: { label: 'gather supplies' } }, plan, []);
    expect(m.mismatch).toBe(true); expect(m.text).toBe("free time — standing still (the plan's step gather supplies ended: no wood known)");
    expect(nowParts({ text: 't', matches: false }, null, [{ used: 'rules', why: 'need', override: 'a need' }]).why).toMatch(/^the rules decided/);
    expect(nowParts(null)).toEqual({ text: '', mismatch: false, why: '' });
  });
  it('the chooser records the changes (not the distance) with the game time, the last 30; read only', () => {
    const clock = { day: 2, time: 0.5, total: 2.5 }, n = { goal: 'stores', pastime: null, kind: null, phase: 'walking', detail: '9', trouble: '' };
    const ai = createAiChooser({ rulesChooser, ask: textOf(), now: () => 1, enabled: () => false, clock: () => clock });
    ai.attach({ recent: [], now: () => ({ ...n }) }, { clock });
    ai.tick(); n.detail = '8'; ai.tick(); n.phase = 'working'; n.detail = 'pick'; clock.time = 0.51; ai.tick();
    expect(ai.nowLog().map(x => x.text)).toEqual(['gather supplies — walking, 9 m to go', 'gather supplies — working (pick)']); expect(ai.nowLog()[1]).toMatchObject({ day: 2, time: '12:14' });
    for (let i = 0; i < 40; i++) { n.pastime = 'p' + i; ai.tick(); } expect(ai.nowLog().length).toBe(30);
    expect(ai.nowInfo().text).toContain('gather supplies'); expect(ai.nowInfo().matches).toBeNull();   // the AI is off: no plan step to match
    expect(logText({ nowLog: ai.nowLog().slice(0, 2) })).toContain('Day 2 12:14 — ');
  });
});
