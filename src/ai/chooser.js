/**
 * ai/chooser — the language-model chooser of Dave's goals and pastimes (0.36 "Mind"; 0.36.1 "Clear log": asked AT the decision, he waits briefly; 0.36.3 "Plans": the model makes a PLAN and the chooser follows it). Pure apart from the `ask` function it is handed
 * (the client's `send` in the game, a fake in the tests).
 *
 * THE PLAN. One request returns a plan: an ordered list of 3 to 8 steps (ai/prompt parsePlan), each a goal id (drink, eat, sleep, fire, stores) or a pastime id (home, spear, axe, tide, explore, fish, stroll, journey, gaze, strays, linger), each with a short reason.
 * The chooser keeps it. At every decision point, goal or pastime, with the AI on and a menu of two or more POSSIBLE options (at the pastime point only what is possible now, game/intent `isValid`; fewer than two: the rules at once, nothing logged):
 *   1. FOLLOW (no request, no wait). The next step is taken when it is on the current menu and possible.
 *      goal point:     a goal step on the menu is taken; a goal step NOT on the menu is SKIPPED (the rules' menu offers a goal only when it is needed: he is not thirsty, the fire is lit, the stores are full: the step is done or pointless; shown "skipped" in the panel);
 *                      a pastime step is reached through free time: 'idle' is taken (the step stays); if 'idle' is not on the menu the rules decide this one point and the step stays ('plan-hold').
 *      pastime point:  a pastime step on the menu and possible is taken (and done). A day pastime while the first stage (sunset, ember, strays, onward) is asked: 'onward' is taken (the step stays). A goal step while he is in free time: 'onward' when the first stage is asked, else the rules decide for the moment (0.36.9: no `linger` as a short way on; the step stays).
 *                      A pastime step that is NOT possible (wrong hours, no spear, done today: the option is on the menu but not valid, or its stage has passed) makes the plan useless: a new plan is asked, with the reason ("the next step was fish, but it is not possible now (...)"); if a request was made less than AI_REPLAN_GAP seconds ago, or none can be sent, the step is skipped instead.
 *   2. ASK for a NEW plan when: there is none, the plan is used up (every step done or skipped), a new day has begun (the plan's morning differs from the clock's: before dawn still counts as the day before), an EVENT point was reached since (stuck, no path, no place to stand, a goal failed or was dropped: the reason is told to the model), or the next step is not possible (above).
 *      The request is sent THEN, with the state and the menu of that moment, and the chooser answers WAIT: Dave stands still for at most AI_WAIT real seconds. A plan that lands in time is used at once (this decision takes its first step). On a timeout (`no answer`), an error or an unusable answer the rules decide this one point; a plan that lands later is installed all the same and used at the next decisions
 *      ("a late plan"). One request at a time ('busy'), at most one per AI_REPLAN_GAP seconds ('waiting'), a spent budget ('budget'): the rules decide meanwhile. An answer {"choice": "<id>"} is read as a plan of one step.
 *   3. OVERRIDES (below) come first: where one holds, the rules decide and the plan is left alone (a step the rules happen to take is done).
 * The rules' chooser is ALWAYS called (at the pastime point it draws from the mind's streams, once per decision: its answer is kept while Dave waits), and the log says what it would have picked.
 *
 * 0.36.4 "Hindsight": (a) AI_WAIT is 10 s. (b) The request tells what is really possible: `possibleNow` adds `blocked` ({ id: reason } from `mind.blockers()`, game/mind) so a pastime with open hours but another condition that fails is marked with the plain reason. (c) A step that is skipped (a goal not needed, a pastime not possible) or that makes a new plan wanted is remembered with its reason in the chooser's own short-term `memory` (8, not saved) and merged by time into the request's recent list; the step keeps its `note` for "Your previous plan". (d) The log entry's `plan` is { i, n, via }: i the step being taken (1-based, at most n), via true for a short way on to it. (e) `stepReason(goal, kind)`: the model's own reason for the step taken from the plan, offered ONCE, to the Voice, when the mind's onIntent names the step's goal and an intent kind that starts it (STEP_INTENTS); never the `why` made up here for a short way on; null with the AI off.
 *
 * 0.36.5 "Reach" (point 6): `onStep({ id, goal, reason, fallback })` is called when the AI takes a plan step (not a short way on, not a rules decision), for EVERY step kind, with the model's reason ('' if none) and the step's usual fixed phrase kind (the first of STEP_INTENTS, or null): main gives it to voice.announceStep, so the reason is said when the step starts; the old once-on-the-first-matching-intent `stepReason` is gone. While the step runs `restates(goal, kind)` is true for the intent kinds of STEP_INTENTS of that step, so main skips the fixed phrases that only restate it; a rules decision ends that.
 * 0.36.5 "Reach": (a) (0.36.6: `chooser.wide()` is gone: the menu is the same for every chooser, game/mind "One menu".) (b) A plan step may carry a destination `to` (ai/prompt parsePlan: stroll: shore, river, palms, forest, crabs; explore: coast, forest): when the step is taken the chooser checks it against `mind.destinations()` (what is possible now) and answers { id, kind } or { id, where }; an impossible one is ignored (`toIgnored`, the game picks). (c) Every log entry carries `planId`, `step` (0-based, the plan step it belongs to or null) and `to`; every plan has `id` and `real`; `ai.plans()` returns the last 12 plans newest first (each step with state, note, time and destination) for the panel's by-plan view (render/aiPanel groupByPlan). The request carries `possible.destinations`.
 *
 * 0.36.5 (point 11): (a) at the GOAL point, before bridging through free time (idle) to a pastime step, the step is checked: its hours (prompt hoursOpen) must be open and `mind.blockers()` must have no entry for it; if not, the step is skipped with the reason, or, when a request is allowed, a new plan is asked ("the next step, watch the sunset, was not possible now (...)"), as at the pastime point; a step that cannot happen is never bridged to (seen live: at night the gaze step was bridged to at every goal decision, drink and eat were never taken, and no pastime point ever came to find it impossible). (b) Waking is a reason for a new plan: `game.sleep.wakes` (counted by game/sleep `wake()`, any sleep: the night, a cold sleep cut short, a nap, a collapse) going up between two decisions asks for a new plan with the trigger "he woke up" (unless one was asked meanwhile: the trigger is used up by the request).
 *
 * 0.36.9 "Voice": (a) `name()` (an option; main: the name the player gave) goes into the plan and journal requests (ai/prompt `fixedText(name)`); the fixed part may differ per game, `ai/logbook` stores each system text once by its hash. (b) No `linger` as a short way on to a goal step (`follow`): `onward` when the first stage is asked, else `hold` (the rules decide for the moment and the plan stays at that step); a rest only when the plan names it. (c) The fire goal may be on the menu at any hour (game/mind `chooseGoalMenu`): a fire step is possible whenever a fire of his burns and dry wood lies ready.
 * 0.36.9 (more): (d) `quietAsk`: a decision with one option is the rules' at once but a wanted plan (he woke up in the night, a new day, none yet) is still asked for, without waiting. (e) The days in the request are the player's own (`dayOffset`: `clock()` minus the game's clock). (f) A tide step the AI takes carries `ai: true` in the choice (no dice for the round, game/mind `tideRound(byAi)`).
 * 0.36.7 "Memory": (a) ONE short-term list: game/mind's `recent` (the last 20 events and decisions with their outcomes); a plan step that is skipped or not possible goes into it (`mind.remember`; the old separate list of 8 is gone) and it is what the request calls "What he did lately". (b) His own notes (`notes`, at most NOTES_MAX lines of NOTE_LEN characters) change only when a plan answer carries `notes`. (c) The journal [{ day, line }]: `tick()` (main calls it every frame) asks ONE extra request a day, after sunset (DUSK) when the AI is on, the budget allows and no other request runs; it is not a decision and Dave never waits for it; the answer is stored when it comes back; the day is marked asked before the answer, so a failed request is not repeated that day, also across a reload; with the AI off, no key or no budget there is no line (the rules never write one). While it runs the plan request waits (the client runs one request at a time: the rules decide, why 'busy'). `memory()` / `restore(m)` are the saved form (`recent`, `notes`, `journal`, `asked`; main saves it as `memory` next to `habit`, src/save). (d) The crab fix: a destination the model named that is not possible now (`toBlock`: the game's `destinations()` does not offer it; for the crabs the reason of `blockers().crabs`) makes the step NOT POSSIBLE like any other impossible pastime step (remembered with the reason, a new plan when one can be asked, else skipped); the game never substitutes another place and the step's reason is not spoken (`onStep` comes only for a step that starts as planned).
 *
 * 0.36.7 (point 3): when a new plan is wanted (the plan is used up, a new day, an event, a step not possible) but one cannot be asked yet (asked less than AI_REPLAN_GAP ago, a request running, no budget) and there is a current plan, the chooser follows THAT plan as usual (a step that is not possible is skipped with its reason) and keeps the trigger, so the new plan is asked as soon as the gap allows; only when the plan has no usable step left do the rules decide (why 'busy', 'waiting' or 'budget' as before).
 *
 * THE OVERRIDES: every case where the rules decide and the AI is not asked is one entry of the named list OVERRIDES { id, points, test, reason }, and a MODE (the leash, `mode()`: 'strict' | 'loose' | 'free') says which entries are in force (MODES):
 *   strict   forced, safety, need   (the behaviour of 0.36.1 and 0.36.3's first cut)
 *   loose    forced, critical       (the default)
 *   free     none
 *   forced    a forced option is on the menu (an emergency at the goal menu: thirst from 1 day, hunger from 2 days; game/mind)
 *   safety    a passing ember at a fire that has gone out (game/intent PASTIMES `safety`; pastime point); not in loose: the fire going out is a consequence the AI should feel, and a plan with a fire goal can keep it
 *   need      the rules' own pick is drink, eat or sleep (goal point)
 *   critical  at either point: thirst at CRITICAL.thirst (REVIVE_AT 1.25: a quarter of a day before the collapse at 1.5), hunger at STARVING_AT (3), awake CRITICAL.awake (AWAKE_MAX 1.5 less AI_AWAKE_MARGIN 0.25: six hours before he falls asleep where he stands)
 * Each override is logged: `why` is its id, `override` its plain reason, `planned` the label of the step the plan was on; the panel shows "overruled". With forced not in force (free) a forced option is just an option. (Passing `overrides` hands a list of your own.)
 * Every decision with a choice goes in the log (newest first, AI_LOG_MAX, memory only): { n, real, day, time, point: 'goal' | 'pastime', menu, options: [{ id, what }], rules, ai, used: 'ai' | 'rules', why, override, planned, plan: { i, n, via } | null, reason, ms, model, messages, raw }; for a step taken from the plan `ai` is the step, `plan` says which of how many, `reason` is the step's reason,
 * and the request and the wait (`ms`, `messages`) are on the decision that asked. why of a rules decision: an override id, 'no answer', 'busy', 'waiting', 'budget', 'plan-hold', 'not on menu', 'error: ...'. While the AI is off nothing is logged. Notes (a new plan and why, steps left out, a failed request) go in as { note } lines. The tally counts the logged decisions { ai, rules, differ }.
 *
 * Exports:
 *   OVERRIDES, MODES, CRITICAL, overridesFor(mode)
 *   createAiChooser({ rulesChooser, ask, onStep?, now?, canSend?, enabled?, name?, clock?, log?, wait?, mode?, overrides?, replanGap? }) -> ai
 *     rulesChooser(point, menu, ctx)   the present rules (game/intent rulesChooser)
 *     ask(messages) -> Promise<{ text, ms, model? }>
 *     now() -> real seconds (default: Date.now() / 1000)       canSend() -> bool   the budget allows a request       enabled() -> bool   the AI is on and has a key
 *     clock() -> { day, time } | null  the game time for the log and the plan's morning (default: read from the game handed to attach)       log(entry)   called with each entry       wait   seconds to wait for an answer (default AI_WAIT)
 *     mode() -> 'strict' | 'loose' | 'free'   the leash (default AI_MODE_DEFAULT)
 *   ai.chooser(point, menu, ctx) -> choice | WAIT      for createMind (the event point only notes that something went wrong); ai.chooser.allowPreempt(current, want) -> bool: the mind asks it before a higher want stops the running goal (strict: yes; free: no; loose: only at the brink)
 *   ai.tick()      (0.36.7) the sunset journal line, see above        ai.memory() / ai.restore(m)   what is saved with the island        ai.notes() / ai.journal()   his notes and the journal (copies)       ai.memoryVersion   counts the changes of the notes, the journal and the restored memory (main saves at once)
 *   ai.stateNow()  (0.36.7) { text, blocked } the situation now in words and the "not now" reasons, for the panel's copy log (null when not known)
 *   ai.nowInfo() / ai.nowLog()   (0.36.7) what he is doing now ({ n, text, step, matches, waited }) and the last 30 changes of it with the game time; `tick` records the changes (needs `mind.now`)
 *   ai.attach(mind, game)            hands the mind and the game over (the state, the short-term memory, the blockers and the vitals are read from them)
 *   ai.restates(goal, kind) -> bool   (0.36.5, replaces 0.36.4's stepReason) the fixed intent phrase `kind` of the goal `goal` only restates the plan step that is running (STEP_INTENTS): main does not say it;   STEP_INTENTS   the intent kinds that start each step
 *   ai.entries       the log, newest first (array, kept in place)       ai.version   counts the changes of the log, the plan or the request state
 *   ai.plans()       (0.36.5) the last 12 plans, newest first, as ai.plan() (each plan also { id, real }, each step also { to, toUsed, toIgnored, note, at }; an old plan's steps not reached say 'not reached')
 *   ai.plan()        the plan now { steps: [{ id, label, reason, state: 'running' | 'done' | 'skipped' | 'next' | 'later' (0.36.5; was 'now' | 'next'; an old plan's steps not reached: 'not reached') }], i, reason, trigger, day, time, late } or null       ai.asking()   why a plan is being asked now (Dave is waiting), or null
 *   ai.tally()       { ai, rules, differ }       ai.inFlight()   a request is running       ai.waiting()   Dave is waiting for an answer now
 *
 * Depends on: ai/config, ai/prompt, game/intent (pure), the constants of game/thirst, game/hunger and game/sleep
 */
import { AI_WAIT, AI_LOG_MAX, AI_REPLAN_GAP, AI_MODE_DEFAULT, AI_AWAKE_MARGIN, NOTES_MAX, NOTE_LEN, JOURNAL_LEN, JOURNAL_MAX } from './config.js';
import { buildPlanMessages, parsePlan, snapshotOf, stateText, hhmm, describeOption, stepLabel, STEP_WHEN, STEP_TO, PLAN_GOALS, hoursOpen, buildJournalMessages, parseJournal, clipLine, nowText } from './prompt.js';
import { WAIT, isValid, makeMenu, PASTIMES, STAGES, choiceId } from '../game/intent.js';
import { REVIVE_AT } from '../game/thirst.js';
import { STARVING_AT } from '../game/hunger.js';
import { AWAKE_MAX, DAWN, DUSK } from '../game/sleep.js';

const NEEDS = new Set(['drink', 'eat', 'sleep']);
const RECENT_MAX = 20, PLANS_MAX = 12;   // RECENT_MAX: the short-term list is game/mind's `recent` (its ring of 20); a step the chooser skipped goes into the same list
const ABANDONED = 1;   // seconds without a call: the decision it was waiting for is gone
/** For each step of the plan the intent kinds (game/mind `onIntent`) that START it: the AI's own reason for the step is shown instead of their fixed phrase (0.36.4). What he lacks inside the step (fibre, a low fire, wet wood, a torch) keeps its fixed phrases. */
export const STEP_INTENTS = { drink: ['drinkIntent'], eat: ['foodIntent'], sleep: ['sleepIntent'], stores: ['woodIntent'], fire: ['woodIntent'], home: ['homeWoodIntent', 'buildIntent', 'upgradeIntent', 'hutIntent'], spear: ['spearIntent'], fish: ['fishIntent'], axe: ['axeIntent'], explore: ['explore'], journey: ['journeyIntent'] };
export const CRITICAL = { thirst: REVIVE_AT, hunger: STARVING_AT, awake: +(AWAKE_MAX - AI_AWAKE_MARGIN).toFixed(2) };

/** THE RULE OVERRIDES: see the header. `test({ point, menu, aiMenu, rid, s })` (s: { thirst, hunger, awake }) -> bool; `reason`: a plain sentence or a function of the same argument. */
export const OVERRIDES = [
  { id: 'forced', points: ['goal', 'pastime'], test: ({ aiMenu }) => aiMenu.options.some(o => o.forced), reason: 'an emergency: a forced option is on the menu' },
  { id: 'safety', points: ['pastime'], test: ({ aiMenu }) => aiMenu.options.some(o => PASTIMES[o.id] && PASTIMES[o.id].safety), reason: 'a safety matter: the fire that has gone out is fed by the rules' },
  { id: 'need', points: ['goal'], test: ({ rid }) => NEEDS.has(rid), reason: 'a need (drink, eat or sleep): the rules pick it' },
  { id: 'critical', points: ['goal', 'pastime'], test: ({ s }) => s.thirst >= CRITICAL.thirst || s.hunger >= CRITICAL.hunger || s.awake >= CRITICAL.awake,
    reason: ({ s }) => s.thirst >= CRITICAL.thirst ? `just before the collapse: thirst has reached ${s.thirst.toFixed(2)} days (it collapses at 1.5)` : s.hunger >= CRITICAL.hunger ? `starving: hunger has reached ${s.hunger.toFixed(2)} days` : `exhausted: awake ${s.awake.toFixed(2)} days (he falls asleep where he stands at ${AWAKE_MAX})` },
];
export const MODES = { strict: ['forced', 'safety', 'need'], loose: ['forced', 'critical'], free: [] };
export const overridesFor = mode => { const ids = MODES[mode] || MODES[AI_MODE_DEFAULT]; return OVERRIDES.filter(o => ids.includes(o.id)); };

const EVENT_TEXT = { stuck: 'he got stuck', nopath: 'he found no path', 'no-stand': 'he found no place to stand', failed: 'a goal failed', dropped: 'a goal was dropped' };
const eventText = (kind, goal) => `an event: ${EVENT_TEXT[kind] || kind}${goal ? ` (${goal})` : ''}`;

export function createAiChooser({ rulesChooser, ask, onStep = null, now = () => Date.now() / 1000, canSend = () => true, enabled = () => true, name = () => '', clock = null, log = null, wait = AI_WAIT, mode = () => AI_MODE_DEFAULT, overrides = null, replanGap = AI_REPLAN_GAP } = {}) {
  const entries = [], count = { ai: 0, rules: 0, differ: 0 };
  const plans = [];   // 0.36.5: the plans of this page, newest first (PLANS_MAX), kept with their steps' states for the panel's plan view
  let planSeq = 0;
  const nameNow = () => { try { return name() || ''; } catch (e) { return ''; } };   // 0.36.9: the name the player gave the castaway (main hands a getter: it is asked after the island is loaded)
  let wakes = null, version = 0, call = null, req = null, refs = null, seq = 0, plan = null, stale = null, lastAsk = -Infinity, bridged = null, running = null;   // running (0.36.5): the plan step that was last taken, { goal, id }, while the rules have not decided since
  let notes = [], journal = [], asked = null, journalCall = false, memVer = 0;   // 0.36.7 "Memory": his own notes (written only by the model), the journal [{ day, line }] and the day the journal line was last asked (a failed request is not repeated that day); saved with the island (`memory()`, `restore()`)

  const bump = () => { version++; };
  const push = e => { entries.unshift(e); if (entries.length > AI_LOG_MAX) entries.length = AI_LOG_MAX; bump(); if (log) { try { log(e); } catch (x) { /* a log that throws is its own problem */ } } };
  const clk = () => { try { return (clock ? clock() : refs && refs.game && refs.game.clock) || null; } catch (e) { return null; } };
  const gameTime = () => { const c = clk(); return c ? { day: c.day, time: hhmm(c.time) } : { day: null, time: null }; };
  const wakeKey = () => { const c = clk(); return c && c.day != null ? c.day + (c.time >= DAWN ? 0 : -1) : 0;   };   // the day he is in, counted from dawn
  const vitals = () => { const g = refs && refs.game, n = f => { try { return +f() || 0; } catch (e) { return 0; } }; return { thirst: n(() => g.thirst.days), hunger: n(() => g.hunger.days), awake: n(() => g.sleep.awake) }; };
  const active = () => overrides || overridesFor(mode());
  const okChoice = (menu, id) => { const o = menu.options.find(x => x.id === id); return !!o && isValid(o) && (!active().some(v => v.id === 'forced') || !menu.options.some(x => x.forced && isValid(x)) || !!o.forced); };
  // 0.36.7: ONE short-term list, the last 20 events and decisions with their outcomes: game/mind's `recent`; a plan step that was skipped or not possible is put into it with the reason (`mind.remember`; a mind without it: pushed here)
  const remember = (id, outcome) => {
    const m = refs && refs.mind; if (!m) return;
    if (typeof m.remember === 'function') { m.remember('plan step', id, outcome); return; }
    if (Array.isArray(m.recent)) { const c = refs.game && refs.game.clock || {}; m.recent.push({ t: c.total != null ? +c.total : (+c.day || 0) + (+c.time || 0), day: c.day || 0, kind: 'plan step', what: id, outcome }); if (m.recent.length > RECENT_MAX) m.recent.shift(); }
  };
  // 0.36.9: the days the model sees are the player's own (the same as the log and the journal): `clock()` counts from the day the game started, the game's own clock does not; the offset is the difference
  const dayOffset = () => { try { const c = clk(), g = refs && refs.game && refs.game.clock; return c && g && Number.isFinite(c.day) && Number.isFinite(g.day) ? c.day - g.day : 0; } catch (e) { return 0; } };
  const askState = () => { const st = snapshotOf(refs.game, refs.mind); st.day += dayOffset(); return st; };
  const recentNow = () => { const r = refs && refs.mind && Array.isArray(refs.mind.recent) ? refs.mind.recent : [], off = dayOffset(); return [...r].sort((a, b) => (+a.t || 0) - (+b.t || 0)).map(x => (off ? { ...x, day: (+x.day || 0) + off } : x)); };
  const blockersNow = () => { try { return (refs && refs.mind && refs.mind.blockers && refs.mind.blockers()) || {}; } catch (e) { return {}; } };
  const nextStep = () => (plan && plan.i < plan.steps.length ? plan.steps[plan.i] : null);
  const noteDone = id => { const st = nextStep(); if (st && st.id === id) { st.state = 'done'; plan.i++; bump(); } };
  // 0.36.5 (point 10): the states as the panel shows them: 'running' the step taken last (busy now, until the next is taken, the plan is replaced or the rules take over), 'done' a step taken earlier, 'next' the first step not yet taken, 'later' the ones after it ('not reached' in an old plan), 'skipped'; the plan's own logic (plan.i, step.state) is unchanged
  const stateOf = (p, s, k) => (s.state === 'done' ? (p === plan && p.running === k ? 'running' : 'done') : s.state === 'next' ? (p !== plan ? 'not reached' : k === p.i ? 'next' : 'later') : s.state);
  const planSnap = p => ({ id: p.id, real: p.real, model: p.model || null, steps: p.steps.map((s, k) => ({ id: s.id, label: stepLabel(s.id), to: s.to || null, toUsed: s.toUsed || null, toIgnored: s.toIgnored || null, reason: s.reason, note: s.note || '', at: s.at || null, state: stateOf(p, s, k) })), i: p.i, reason: p.reason, trigger: p.trigger, day: p.day, time: p.time, late: p.late });
  const planInfo = () => (plan ? planSnap(plan) : null);
  const destinationsNow = () => { try { return (refs && refs.mind && refs.mind.destinations && refs.mind.destinations()) || null; } catch (e) { return null; } };

  function record(point, menu, rid, g, o) {   // one log entry and the tally
    const used = o.used || 'rules', ans = o.ans || null;
    count[used]++; if (ans && ans.id !== rid) count.differ++;
    push({ n: ++seq, real: now(), day: g.day, time: g.time, point, menu: menu.options.map(x => x.id), options: menu.options.map(x => ({ id: x.id, what: describeOption(x).label })), rules: rid, ai: ans ? ans.id : null, used, why: o.why || null, override: o.override || null, planned: o.planned || null, plan: o.plan || null,
      planId: plan ? plan.id : null, step: o.plan ? o.plan.i - 1 : (o.stepNo == null ? null : o.stepNo), to: o.to || null,   // 0.36.5: which plan and which step (0-based) the decision belongs to, for the panel's plan view
      reason: ans ? ans.reason : '', ms: o.ms == null ? null : o.ms, model: ans ? ans.model : null, messages: ans ? ans.messages : (o.messages || null), raw: ans ? ans.raw : (o.raw === undefined ? null : o.raw) });
  }

  function install(p, r, c) {   // a plan has landed: it is the plan now, whoever was waiting for it
    const g = gameTime();
    plan = { id: ++planSeq, real: now(), steps: p.steps.map(s => ({ ...s, state: 'next' })), i: 0, reason: p.reason, key: wakeKey(), trigger: c.trigger, day: g.day, time: g.time, model: r.model || null, late: !(req && req.call === c), raw: r.text };
    if (p.notes) { notes = p.notes.slice(); memVer++; }   // 0.36.7: the full new list of his notes (a missing or unusable one leaves them as they are)
    stale = null; c.plan = plan; plans.unshift(plan); if (plans.length > PLANS_MAX) plans.length = PLANS_MAX; bump();
    push({ note: `New plan (${c.trigger}): ${p.steps.map(s => s.id).join(', ')}${p.dropped.length ? `; left out: ${p.dropped.join(', ')}` : ''}`, planNote: true, planId: plan.id, real: now(), messages: c.messages, raw: r.text });
  }

  function send(messages, trigger) {
    const c = { trigger, messages, result: null, plan: null, done: false, key: wakeKey() };
    let p; try { p = Promise.resolve(ask(messages)); } catch (e) { p = Promise.reject(e); }
    p.then(r => {
      const q = parsePlan(r && r.text);
      if (q.ok) { install(q, r, c); c.result = { ok: true }; c.raw = r.text; c.model = r.model || null; }
      else { c.result = { ok: false, why: 'error: ' + q.error, raw: r && r.text }; push({ note: 'The answer could not be used: ' + q.error + ' (' + String(r && r.text).slice(0, 80).replace(/\s+/g, ' ') + ')', real: now(), messages, raw: r && r.text }); }
    }, e => {
      c.result = { ok: false, why: 'error: ' + (e && e.message || e) };
      push({ note: 'The request failed: ' + (e && e.message || e), real: now() });
    }).then(() => { c.done = true; if (call === c) call = null; bump(); });
    call = c; bump(); return c;
  }

  /** 0.36.9 (point 4): a decision with nothing to choose (one option: at night, awake in the dark, only 'stand about' is possible) is the rules' at once, but a plan that is wanted (he woke up, a new day, no plan yet) is still ASKED for, without waiting: it is used at the next decision. Seen live: waking at 03:00 he stood about for 1.5 hours with no request, because the only decision he met had one option. */
  function quietAsk(point, aiMenu, menu, t) {
    const trigger = !plan ? (stale || 'no plan yet') : plan.key !== wakeKey() ? 'a new day begins' : stale;
    if (!trigger || call || journalCall || req || t - lastAsk < replanGap || !canSend() || !refs) return;
    let messages;
    try { messages = buildPlanMessages({ state: askState(), recent: recentNow(), trigger, name: nameNow(), previous: plan ? plan.steps.map(x => ({ id: x.id, state: x.state === 'next' ? 'not reached' : x.state, note: x.note || '' })) : [], possible: possibleNow(point, aiMenu, menu), notes, journal: journal.slice(-8), mode: mode() }); } catch (e) { return; }
    lastAsk = t; stale = stale || trigger; send(messages, trigger);
  }
  function chooser(point, menu, ctx) {
    if (point === 'event') { if (enabled()) { const o = menu.options[0] || {}; stale = stale || eventText(o.why, o.goal); } return rulesChooser(point, menu, ctx); }
    if (point !== 'goal' && point !== 'pastime') return rulesChooser(point, menu, ctx);
    const t = now(), g = gameTime(), pastime = point === 'pastime';
    if (req && (t - req.last > ABANDONED || req.point !== point)) req = null;   // the decision it was for is gone (the request goes on and its plan will be used all the same)
    const rules = pastime && req && req.rules !== undefined ? req.rules : rulesChooser(point, menu, ctx), rid = choiceId(rules);   // always first; at the pastime point they draw from the streams, so once per decision
    const drop = () => { if (req) { req = null; bump(); } };
    if (!enabled()) { drop(); return rules; }
    const wk = refs && refs.game && refs.game.sleep ? refs.game.sleep.wakes : undefined;   // 0.36.5 (point 11): waking from any sleep is a reason for a new plan
    if (typeof wk === 'number') { if (wakes !== null && wk > wakes) stale = stale || 'he woke up'; wakes = wk; }
    const aiMenu = pastime ? makeMenu('pastime', menu.options.filter(isValid)) : menu;
    if (aiMenu.options.length < 2) { quietAsk(point, aiMenu, menu, t); drop(); noteDone(rid); return rules; }
    const planned = () => { const st = nextStep(); return st ? stepLabel(st.id) : null; };
    const finish = (o, c = rules) => {   // the rules decide
      if (o.used !== 'ai') { running = null; if (plan) plan.running = null; }   // (0.36.5: a step the rules took over is no longer the AI's: its intent phrases speak again)
      const sn = plan && plan.i < plan.steps.length ? plan.i : null;   // the step the plan was on before this decision (0.36.5)
      req = null; bump();
      if (c === rules && pastime && !okChoice(menu, rid)) c = rulesChooser(point, menu, ctx);   // (what the rules chose a few seconds ago is no longer possible: they decide again)
      if (o.used !== 'ai') noteDone(choiceId(c));
      record(point, aiMenu, rid, g, { planned: o.override ? planned() : null, stepNo: sn, ...o }); return c;
    };
    const s = vitals(), arg = { point, menu, aiMenu, rid, s };
    const ov = active().find(x => x.points.includes(point) && x.test(arg));
    if (ov) return finish({ why: ov.id, override: typeof ov.reason === 'function' ? ov.reason(arg) : ov.reason });

    let asked = null, trigger = null;
    if (req) {   // Dave is waiting for a plan
      req.last = t; const c = req.call, waited = Math.round((t - req.at) * 1000);
      if (!c.result) { if (t - req.at >= wait) return finish({ why: 'no answer', ms: waited, messages: c.messages }); return WAIT; }
      if (!c.result.ok) { stale = stale || req.trigger; return finish({ why: c.result.why, ms: waited, messages: c.messages, raw: c.result.raw }); }
      asked = { ms: waited, messages: c.messages, raw: c.raw, model: c.model }; req = null; bump();
    }
    const canAsk = () => !call && !journalCall && t - lastAsk >= replanGap && canSend() && !!refs;
    if (!asked) {
      if (!plan) trigger = stale || 'no plan yet';
      else if (plan.key !== wakeKey()) trigger = 'a new day begins';
      else if (stale) trigger = stale;
    }
    let r = null;
    // 0.36.7: a new plan is wanted but cannot be asked yet (one was asked a moment ago, a request is running, no budget): the CURRENT plan goes on (its next step through `follow`; an impossible step is skipped with its reason) and the trigger stays, so the new plan is asked as soon as the gap allows; the rules decide only when the plan has no usable step left
    const held = !!trigger && !!plan && !canAsk();
    if (held) stale = stale || trigger;
    if (!trigger || held) {
      r = follow(point, menu, aiMenu, canAsk);
      if (r.take) {
        const st = plan.steps[r.step]; let ch = rid === r.take ? rules : r.take, to = null;
        if (pastime && !r.bridge && st.to) {   // 0.36.5: a destination of the step was checked by `follow` (`toBlock`): it is used when the game knows such a place now; only when the game cannot say (no `destinations`) it is ignored and the game picks
          const d = destinationsNow();
          if (d && Array.isArray(d[r.take]) && d[r.take].includes(st.to)) { to = st.to; st.toUsed = to; ch = r.take === 'stroll' ? { id: 'stroll', kind: to } : { id: r.take, where: to }; }
          else st.toIgnored = st.to;
        }
        if (pastime && !r.bridge && r.take === 'tide') ch = { ...(ch && typeof ch === 'object' ? ch : { id: ch }), ai: true };   // 0.36.9: the AI's round is not rolled for (game/mind `tideRound(byAi)`)
        if (!r.bridge) st.at = gameTime();
        if (r.bridge) {   // a short way on to the step (free time first, onward, linger): the mind may ask again every step while he rests, so the same answer within half a second is given silently
          if (bridged && bridged.point === point && bridged.id === r.take && t - bridged.t < 0.5) { bridged.t = t; return ch; }
          bridged = { point, id: r.take, t };
        }
        if (!r.bridge) {   // 0.36.5: the step starts now: its reason is said at once (onStep: the Voice), whatever the kind of step; the fixed phrases that only restate it are held back while it runs (`restates`)
          running = { goal: pastime ? 'idle' : r.take, id: r.take }; plan.running = r.step;
          if (onStep) { try { onStep({ id: r.take, goal: running.goal, reason: st.reason || '', fallback: (STEP_INTENTS[r.take] || [])[0] || null }); } catch (x) { /* the voice is not the chooser's business */ } }
        }
        return finish({ used: 'ai', ans: { id: r.take, reason: r.why || st.reason || plan.reason, model: plan.model, messages: asked ? asked.messages : null, raw: asked ? asked.raw : null }, to, ms: asked ? asked.ms : null, plan: { i: Math.min(r.step + 1, plan.steps.length), n: plan.steps.length, via: !!r.bridge } }, ch);
      }
      if (r.hold && !(held && r.used)) return finish({ why: 'plan-hold' });   // (a plan with no usable step left while a new one cannot be asked: the usual reasons below, busy, waiting or budget)
      if (!held) trigger = r.replan;
    }
    // a new plan is wanted
    if (call || journalCall) return finish({ why: 'busy' });   // (0.36.7: the client runs one request at a time, the sunset journal line included)
    if (t - lastAsk < replanGap) return finish({ why: 'waiting' });
    if (!canSend() || !refs) return finish({ why: 'budget' });
    let messages;
    try { messages = buildPlanMessages({ state: askState(), recent: recentNow(), trigger, name: nameNow(), previous: plan ? plan.steps.map(x => ({ id: x.id, state: x.state === 'next' ? 'not reached' : x.state, note: x.note || '' })) : [], possible: possibleNow(point, aiMenu, menu), notes, journal: journal.slice(-8), mode: mode() }); }
    catch (e) { return finish({ why: 'error: ' + (e && e.message || e) }); }
    lastAsk = t; stale = stale || trigger;
    const c = send(messages, trigger);
    req = { at: t, last: t, point, rules: pastime ? rules : undefined, trigger, call: c };
    return WAIT;
  }

  /** 0.36.7: the sunset journal line. Called often by main (every frame); does nothing unless the AI is on, it is after sunset (DUSK) of a day not yet written or asked about, no other request runs and the budget allows. One extra request, never waited for: the line is stored when it comes back; no line when the AI is off, there is no key or no budget (the rules never make one up). */
  const nowLog = []; let nowKey = null;   // 0.36.7: the last 30 changes of what he is doing (mind.now), with the game time, for the panel's copy log
  function trackNow() {
    const m = refs && refs.mind; if (!m || typeof m.now !== 'function') return;
    let n; try { n = m.now(); } catch (e) { return; }
    const key = [n.goal, n.pastime, n.kind, n.phase, n.trouble].join('|'); if (key === nowKey) return; nowKey = key;
    const g = gameTime(); nowLog.push({ day: g.day, time: g.time, text: nowText(n) }); if (nowLog.length > 30) nowLog.shift(); bump();
  }
  /** 0.36.7: what he is doing now (`mind.now()` and its text), the plan step that is running (null when none or the AI is off), whether they match (null: not known or in between steps) and how long Dave has waited for a plan (seconds, null when not waiting). Read only. */
  function nowInfo() {
    const m = refs && refs.mind; if (!m || typeof m.now !== 'function') return null;
    let n; try { n = m.now(); } catch (e) { return null; }
    const st = enabled() && plan && plan.running != null ? plan.steps[plan.running] : null;
    let matches = null;
    if (st && n.phase !== 'waiting' && n.goal && !(n.goal === 'idle' && (!n.pastime || n.pastime === 'onward'))) matches = PLAN_GOALS.includes(st.id) ? n.goal === st.id : n.goal === 'idle' && n.pastime === st.id;
    return { n, text: nowText(n), step: st ? { id: st.id, label: stepLabel(st.id) } : null, matches, waited: req ? Math.max(0, now() - req.at) : null };
  }

  function tick() {
    trackNow();
    if (journalCall || call || req || !refs || !enabled()) return;
    const c = clk(); if (!c || c.day == null || !(c.time >= DUSK && c.time < 1)) return;
    if (asked === c.day || journal.some(j => j.day === c.day) || !canSend()) return;
    let messages;
    try { messages = buildJournalMessages({ state: askState(), recent: recentNow(), journal: journal.slice(-8), notes, name: nameNow() }); } catch (e) { return; }
    const day = c.day;
    asked = day; memVer++; journalCall = true; bump();   // asked is kept (and saved) before the answer: a failed or lost request is not repeated the same day, also across a reload
    let p; try { p = Promise.resolve(ask(messages)); } catch (e) { p = Promise.reject(e); }
    p.then(r => {
      const q = parseJournal(r && r.text);
      if (q.ok) { if (!journal.some(j => j.day === day)) { journal.push({ day, line: q.line }); if (journal.length > JOURNAL_MAX) journal.shift(); } memVer++; }
      else push({ note: 'The journal line could not be used: ' + q.error, real: now() });
    }, e => push({ note: 'The journal request failed: ' + (e && e.message || e), real: now() })).then(() => { journalCall = false; bump(); });
  }

  /** 0.36.7: what is saved with the island (`memory` next to `habit`): the short-term list (the mind's `recent`), his notes, the journal and the day the journal line was last asked; plain data. */
  function memory() {
    const r = refs && refs.mind && Array.isArray(refs.mind.recent) ? refs.mind.recent : [];
    return { recent: r.map(x => ({ t: x.t, day: x.day, kind: x.kind, what: x.what == null ? null : String(x.what), outcome: x.outcome == null ? null : String(x.outcome) })), notes: notes.slice(), journal: journal.map(j => ({ day: j.day, line: j.line })), ...(asked != null ? { asked } : {}) };
  }
  /** 0.36.7: hand a saved `memory` back (after `attach`). Anything unusable is skipped; an entry that was under way when the page closed is marked 'interrupted'. */
  function restore(m) {
    if (!m || typeof m !== 'object') return;
    if (Array.isArray(m.notes)) notes = m.notes.map(x => clipLine(x, NOTE_LEN)).filter(Boolean).slice(-NOTES_MAX);
    if (Array.isArray(m.journal)) journal = m.journal.filter(j => j && Number.isFinite(j.day) && typeof j.line === 'string' && j.line).map(j => ({ day: j.day, line: clipLine(j.line, JOURNAL_LEN) })).slice(-JOURNAL_MAX);
    if (Number.isFinite(m.asked)) asked = m.asked;
    const r = refs && refs.mind && Array.isArray(refs.mind.recent) ? refs.mind.recent : null;
    if (r && Array.isArray(m.recent)) r.splice(0, r.length, ...m.recent.filter(x => x && Number.isFinite(x.t) && Number.isFinite(x.day) && typeof x.kind === 'string').slice(-RECENT_MAX).map(x => ({ t: x.t, day: x.day, kind: x.kind, what: x.what == null ? null : String(x.what), outcome: x.outcome == null ? 'interrupted' : String(x.outcome) })));
    memVer++; bump();
  }

  /** 0.36.7: the situation now as the request would tell it, and the pastimes that are not possible now with their reasons (for the panel's "copy log"); null when it cannot be read. */
  function stateNow() { try { return refs && refs.game ? { text: stateText(snapshotOf(refs.game, refs.mind)), blocked: blockersNow() } : null; } catch (e) { return null; } }

  function possibleNow(point, aiMenu) {   // what can be done right now, for the request (null: not known at this point), and (0.36.4) why a pastime cannot be taken now, from the mind's own checks
    const ids = new Set(aiMenu.options.map(o => o.id)), blocked = blockersNow();
    const destinations = destinationsNow();
    if (point === 'goal') return { goals: ids, pastimes: null, blocked, destinations };
    let goals = null; try { goals = new Set(refs.mind.menu().options.map(o => o.id)); } catch (e) { /* not known */ }
    return { goals, pastimes: ids, blocked, destinations };
  }

  /** The next step of the plan against this menu (see the header): { take, step, why } | { hold } | { replan }. Steps that are done or pointless are marked skipped on the way. */
  function follow(point, menu, aiMenu, canAsk) {
    const ids = new Set(aiMenu.options.map(o => o.id)), here = new Set(menu.options.map(o => o.id)), before = here.has('onward');
    // 0.36.7: a destination the model named that is not possible now (a stroll to the crabs without a fire, an explore aim) makes the step NOT POSSIBLE, with the real reason: the game never swaps in another place
    const toBlock = st => {
      if (!st.to || !STEP_TO[st.id]) return null;
      const d = destinationsNow(); if (!d || !Array.isArray(d[st.id]) || d[st.id].includes(st.to)) return null;
      const r = st.id === 'stroll' ? blockersNow()[st.to] : null;
      return st.id === 'stroll' && st.to === 'crabs' ? `no stroll to the crabs now: ${r || 'no crab spot known'}` : `no ${st.to} place to ${st.id === 'stroll' ? 'stroll to' : 'go to'} now${r ? ': ' + r : ''}`;
    };
    const skip = (st, why) => { st.state = 'skipped'; st.note = why; st.at = gameTime(); plan.i++; remember(st.id, 'skipped: ' + why); bump(); };
    while (plan.i < plan.steps.length) {
      const k = plan.i, st = plan.steps[k], id = st.id, goalStep = PLAN_GOALS.includes(id);
      if (point === 'goal') {
        if (goalStep) { if (ids.has(id)) { st.state = 'done'; plan.i++; bump(); return { take: id, step: k }; } skip(st, 'not needed now'); continue; }
        // 0.36.5 (point 11): never bridge through free time to a pastime step that cannot happen now (its hours are closed, or the mind has a reason): skip it, or ask for a new plan, as at the pastime point
        const c = clk(), closed = !!c && c.time != null && !hoursOpen(id, c.time), blocker = blockersNow()[id] || toBlock(st);
        if (closed || blocker) {
          const why = blocker || `outside its hours: ${STEP_WHEN[id]}`;
          if (canAsk()) { remember(id, `skipped: not possible (${why})`); return { replan: `the next step, ${stepLabel(id)}, was not possible now (${why})` }; }
          skip(st, `not possible (${why})`); continue;
        }
        if (ids.has('idle')) return { take: 'idle', bridge: true, step: k, why: `Free time first, on the way to: ${stepLabel(id)}.` };
        return { hold: true };
      }
      if (goalStep) {   // 0.36.9: no `linger` as a bridge to a goal step (a stand about is a rest, taken only when the plan names it): 'onward' when the first stage is asked, else the rules decide for now (`hold`: he goes on with whatever the day offers, the goal comes when its turn is due)
        return before && ids.has('onward') ? { take: 'onward', bridge: true, step: k, why: `On the way to: ${stepLabel(id)}.` } : { hold: true };
      }
      if (ids.has(id) && !toBlock(st)) { st.state = 'done'; plan.i++; bump(); return { take: id, step: k }; }
      if (before && !STAGES.before.includes(id) && ids.has('onward')) return { take: 'onward', bridge: true, step: k, why: `On the way to: ${stepLabel(id)}.` };
      // not possible now
      const why = (ids.has(id) ? toBlock(st) : null) || blockersNow()[id] || STEP_WHEN[id];
      if (canAsk()) { remember(id, `skipped: not possible (${why})`); return { replan: `the next step, ${stepLabel(id)}, was not possible now (${why})` }; }
      skip(st, `not possible (${why})`);
    }
    return canAsk() ? { replan: 'the plan is used up' } : { hold: true, used: true };
  }

  /** 0.36.5: is the fixed intent phrase `kind` (game/mind `onIntent`, for the goal `goal`) one that only restates the plan step that is running (STEP_INTENTS)? Then main does not say it: the step's own reason was said when it started. Only while the AI is on. */
  function restates(goal, kind) { return !!running && enabled() && running.goal === goal && (STEP_INTENTS[running.id] || []).includes(kind); }
  function attach(mind, game) { refs = { mind, game }; }

  chooser.allowPreempt = () => {   // 0.36.3: may a higher want stop the goal that is running? strict: yes (the rules); free: no; loose: only at the brink (the critical override)
    if (!enabled()) return true;
    if (!overrides && mode() === 'strict') return true;
    const crit = active().find(o => o.id === 'critical');
    return !!crit && !!crit.test({ s: vitals() });
  };
  chooser.selfChecked = true;   // game/mind need not check the answer again: the rules' answer is returned as it is, and an AI answer is checked here
  return { chooser, attach, restates, tick, stateNow, nowInfo, nowLog: () => nowLog.map(x => ({ ...x })), memory, restore, notes: () => notes.slice(), journal: () => journal.map(j => ({ ...j })), get memoryVersion() { return memVer; }, entries, get version() { return version; }, plans: () => plans.map(planSnap), tally: () => ({ ...count }), inFlight: () => !!call, waiting: () => !!req, plan: planInfo, asking: () => (req ? req.trigger : null) };
}
