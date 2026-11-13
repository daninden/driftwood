/**
 * ai/chooser — the language-model chooser of Dave's goals and pastimes (0.36 "Mind"; 0.36.1 "Clear log": asked AT the decision, he waits briefly; 0.36.3 "Plans": the model makes a PLAN and the chooser follows it). Pure apart from the `ask` function it is handed
 * (the client's `send` in the game, a fake in the tests).
 *
 * THE PLAN. One request returns a plan: an ordered list of 3 to 8 steps (ai/prompt parsePlan), each a goal id (drink, eat, sleep, fire, stores) or a pastime id (home, spear, axe, tide, explore, fish, stroll, journey, gaze, strays, linger), each with a short reason.
 * The chooser keeps it. At every decision point, goal or pastime, with the AI on and a menu of two or more POSSIBLE options (at the pastime point only what is possible now, game/intent `isValid`; fewer than two: the rules at once, nothing logged):
 *   1. FOLLOW (no request, no wait). The next step is taken when it is on the current menu and possible.
 *      goal point:     a goal step on the menu is taken; a goal step NOT on the menu is SKIPPED (the rules' menu offers a goal only when it is needed: he is not thirsty, the fire is lit, the stores are full: the step is done or pointless; shown "skipped" in the panel);
 *                      a pastime step is reached through free time: 'idle' is taken (the step stays); if 'idle' is not on the menu the rules decide this one point and the step stays ('plan-hold').
 *      pastime point:  a pastime step on the menu and possible is taken (and done). A day pastime while the first stage (sunset, ember, strays, onward) is asked: 'onward' is taken (the step stays). A goal step while he is in free time: the shortest option ('onward', then 'linger') is taken, so the goal point comes soon (the step stays).
 *                      A pastime step that is NOT possible (wrong hours, no spear, done today: the option is on the menu but not valid, or its stage has passed) makes the plan useless: a new plan is asked, with the reason ("the next step was fish, but it is not possible now (...)"); if a request was made less than AI_REPLAN_GAP seconds ago, or none can be sent, the step is skipped instead.
 *   2. ASK for a NEW plan when: there is none, the plan is used up (every step done or skipped), a new day has begun (the plan's morning differs from the clock's: before dawn still counts as the day before), an EVENT point was reached since (stuck, no path, no place to stand, a goal failed or was dropped: the reason is told to the model), or the next step is not possible (above).
 *      The request is sent THEN, with the state and the menu of that moment, and the chooser answers WAIT: Dave stands still for at most AI_WAIT real seconds. A plan that lands in time is used at once (this decision takes its first step). On a timeout (`no answer`), an error or an unusable answer the rules decide this one point; a plan that lands later is installed all the same and used at the next decisions
 *      ("a late plan"). One request at a time ('busy'), at most one per AI_REPLAN_GAP seconds ('waiting'), a spent budget ('budget'): the rules decide meanwhile. An answer {"choice": "<id>"} is read as a plan of one step.
 *   3. OVERRIDES (below) come first: where one holds, the rules decide and the plan is left alone (a step the rules happen to take is done).
 * The rules' chooser is ALWAYS called (at the pastime point it draws from the mind's streams, once per decision: its answer is kept while Dave waits), and the log says what it would have picked.
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
 * Every decision with a choice goes in the log (newest first, AI_LOG_MAX, memory only): { n, real, day, time, point: 'goal' | 'pastime', menu, options: [{ id, what }], rules, ai, used: 'ai' | 'rules', why, override, planned, plan: { i, n } | null, reason, ms, model, messages, raw }; for a step taken from the plan `ai` is the step, `plan` says which of how many, `reason` is the step's reason,
 * and the request and the wait (`ms`, `messages`) are on the decision that asked. why of a rules decision: an override id, 'no answer', 'busy', 'waiting', 'budget', 'plan-hold', 'not on menu', 'error: ...'. While the AI is off nothing is logged. Notes (a new plan and why, steps left out, a failed request) go in as { note } lines. The tally counts the logged decisions { ai, rules, differ }.
 *
 * Exports:
 *   OVERRIDES, MODES, CRITICAL, overridesFor(mode)
 *   createAiChooser({ rulesChooser, ask, now?, canSend?, enabled?, clock?, log?, wait?, mode?, overrides?, replanGap? }) -> ai
 *     rulesChooser(point, menu, ctx)   the present rules (game/intent rulesChooser)
 *     ask(messages) -> Promise<{ text, ms, model? }>
 *     now() -> real seconds (default: Date.now() / 1000)       canSend() -> bool   the budget allows a request       enabled() -> bool   the AI is on and has a key
 *     clock() -> { day, time } | null  the game time for the log and the plan's morning (default: read from the game handed to attach)       log(entry)   called with each entry       wait   seconds to wait for an answer (default AI_WAIT)
 *     mode() -> 'strict' | 'loose' | 'free'   the leash (default AI_MODE_DEFAULT)
 *   ai.chooser(point, menu, ctx) -> choice | WAIT      for createMind (the event point only notes that something went wrong); ai.chooser.allowPreempt(current, want) -> bool: the mind asks it before a higher want stops the running goal (strict: yes; free: no; loose: only at the brink)
 *   ai.attach(mind, game)            hands the mind and the game over (the state, the short-term memory and the vitals are read from them)
 *   ai.entries       the log, newest first (array, kept in place)       ai.version   counts the changes of the log, the plan or the request state
 *   ai.plan()        the plan now { steps: [{ id, label, reason, state: 'done' | 'skipped' | 'now' | 'next' }], i, reason, trigger, day, time, late } or null       ai.asking()   why a plan is being asked now (Dave is waiting), or null
 *   ai.tally()       { ai, rules, differ }       ai.inFlight()   a request is running       ai.waiting()   Dave is waiting for an answer now
 *
 * Depends on: ai/config, ai/prompt, game/intent (pure), the constants of game/thirst, game/hunger and game/sleep
 */
import { AI_WAIT, AI_LOG_MAX, AI_REPLAN_GAP, AI_MODE_DEFAULT, AI_AWAKE_MARGIN } from './config.js';
import { buildPlanMessages, parsePlan, snapshotOf, hhmm, describeOption, stepLabel, STEP_WHEN, PLAN_GOALS } from './prompt.js';
import { WAIT, isValid, makeMenu, PASTIMES, STAGES, choiceId } from '../game/intent.js';
import { REVIVE_AT } from '../game/thirst.js';
import { STARVING_AT } from '../game/hunger.js';
import { AWAKE_MAX, DAWN } from '../game/sleep.js';

const NEEDS = new Set(['drink', 'eat', 'sleep']);
const ABANDONED = 1;   // seconds without a call: the decision it was waiting for is gone
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

export function createAiChooser({ rulesChooser, ask, now = () => Date.now() / 1000, canSend = () => true, enabled = () => true, clock = null, log = null, wait = AI_WAIT, mode = () => AI_MODE_DEFAULT, overrides = null, replanGap = AI_REPLAN_GAP } = {}) {
  const entries = [], count = { ai: 0, rules: 0, differ: 0 };
  let version = 0, call = null, req = null, refs = null, seq = 0, plan = null, stale = null, lastAsk = -Infinity, bridged = null;

  const bump = () => { version++; };
  const push = e => { entries.unshift(e); if (entries.length > AI_LOG_MAX) entries.length = AI_LOG_MAX; bump(); if (log) { try { log(e); } catch (x) { /* a log that throws is its own problem */ } } };
  const clk = () => { try { return (clock ? clock() : refs && refs.game && refs.game.clock) || null; } catch (e) { return null; } };
  const gameTime = () => { const c = clk(); return c ? { day: c.day, time: hhmm(c.time) } : { day: null, time: null }; };
  const wakeKey = () => { const c = clk(); return c && c.day != null ? c.day + (c.time >= DAWN ? 0 : -1) : 0;   };   // the day he is in, counted from dawn
  const vitals = () => { const g = refs && refs.game, n = f => { try { return +f() || 0; } catch (e) { return 0; } }; return { thirst: n(() => g.thirst.days), hunger: n(() => g.hunger.days), awake: n(() => g.sleep.awake) }; };
  const active = () => overrides || overridesFor(mode());
  const okChoice = (menu, id) => { const o = menu.options.find(x => x.id === id); return !!o && isValid(o) && (!active().some(v => v.id === 'forced') || !menu.options.some(x => x.forced && isValid(x)) || !!o.forced); };
  const nextStep = () => (plan && plan.i < plan.steps.length ? plan.steps[plan.i] : null);
  const noteDone = id => { const st = nextStep(); if (st && st.id === id) { st.state = 'done'; plan.i++; bump(); } };
  const planInfo = () => (plan ? { steps: plan.steps.map((s, k) => ({ id: s.id, label: stepLabel(s.id), reason: s.reason, state: s.state === 'next' && k === plan.i ? 'now' : s.state })), i: plan.i, reason: plan.reason, trigger: plan.trigger, day: plan.day, time: plan.time, late: plan.late } : null);

  function record(point, menu, rid, g, o) {   // one log entry and the tally
    const used = o.used || 'rules', ans = o.ans || null;
    count[used]++; if (ans && ans.id !== rid) count.differ++;
    push({ n: ++seq, real: now(), day: g.day, time: g.time, point, menu: menu.options.map(x => x.id), options: menu.options.map(x => ({ id: x.id, what: describeOption(x).label })), rules: rid, ai: ans ? ans.id : null, used, why: o.why || null, override: o.override || null, planned: o.planned || null, plan: o.plan || null,
      reason: ans ? ans.reason : '', ms: o.ms == null ? null : o.ms, model: ans ? ans.model : null, messages: ans ? ans.messages : (o.messages || null), raw: ans ? ans.raw : (o.raw === undefined ? null : o.raw) });
  }

  function install(p, r, c) {   // a plan has landed: it is the plan now, whoever was waiting for it
    const g = gameTime();
    plan = { steps: p.steps.map(s => ({ ...s, state: 'next' })), i: 0, reason: p.reason, key: wakeKey(), trigger: c.trigger, day: g.day, time: g.time, model: r.model || null, late: !(req && req.call === c), raw: r.text };
    stale = null; c.plan = plan; bump();
    push({ note: `New plan (${c.trigger}): ${p.steps.map(s => s.id).join(', ')}${p.dropped.length ? `; left out: ${p.dropped.join(', ')}` : ''}`, planNote: true, real: now(), messages: c.messages, raw: r.text });
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

  function chooser(point, menu, ctx) {
    if (point === 'event') { if (enabled()) { const o = menu.options[0] || {}; stale = stale || eventText(o.why, o.goal); } return rulesChooser(point, menu, ctx); }
    if (point !== 'goal' && point !== 'pastime') return rulesChooser(point, menu, ctx);
    const t = now(), g = gameTime(), pastime = point === 'pastime';
    if (req && (t - req.last > ABANDONED || req.point !== point)) req = null;   // the decision it was for is gone (the request goes on and its plan will be used all the same)
    const rules = pastime && req && req.rules !== undefined ? req.rules : rulesChooser(point, menu, ctx), rid = choiceId(rules);   // always first; at the pastime point they draw from the streams, so once per decision
    const drop = () => { if (req) { req = null; bump(); } };
    if (!enabled()) { drop(); return rules; }
    const aiMenu = pastime ? makeMenu('pastime', menu.options.filter(isValid)) : menu;
    if (aiMenu.options.length < 2) { drop(); noteDone(rid); return rules; }
    const planned = () => { const st = nextStep(); return st ? stepLabel(st.id) : null; };
    const finish = (o, c = rules) => {   // the rules decide
      req = null; bump();
      if (c === rules && pastime && !okChoice(menu, rid)) c = rulesChooser(point, menu, ctx);   // (what the rules chose a few seconds ago is no longer possible: they decide again)
      if (o.used !== 'ai') noteDone(choiceId(c));
      record(point, aiMenu, rid, g, { planned: o.override ? planned() : null, ...o }); return c;
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
    const canAsk = () => !call && t - lastAsk >= replanGap && canSend() && !!refs;
    if (!asked) {
      if (!plan) trigger = stale || 'no plan yet';
      else if (plan.key !== wakeKey()) trigger = 'a new day begins';
      else if (stale) trigger = stale;
    }
    let r = null;
    if (!trigger) {
      r = follow(point, menu, aiMenu, canAsk);
      if (r.take) {
        const st = plan.steps[r.step], ch = rid === r.take ? rules : r.take;
        if (r.bridge) {   // a short way on to the step (free time first, onward, linger): the mind may ask again every step while he rests, so the same answer within half a second is given silently
          if (bridged && bridged.point === point && bridged.id === r.take && t - bridged.t < 0.5) { bridged.t = t; return ch; }
          bridged = { point, id: r.take, t };
        }
        return finish({ used: 'ai', ans: { id: r.take, reason: r.why || st.reason || plan.reason, model: plan.model, messages: asked ? asked.messages : null, raw: asked ? asked.raw : null }, ms: asked ? asked.ms : null, plan: { i: r.step + 1, n: plan.steps.length } }, ch);
      }
      if (r.hold) return finish({ why: 'plan-hold' });
      trigger = r.replan;
    }
    // a new plan is wanted
    if (call) return finish({ why: 'busy' });
    if (t - lastAsk < replanGap) return finish({ why: 'waiting' });
    if (!canSend() || !refs) return finish({ why: 'budget' });
    let messages;
    try { messages = buildPlanMessages({ state: snapshotOf(refs.game, refs.mind), recent: refs.mind.recent, trigger, previous: plan ? plan.steps.map(x => ({ id: x.id, state: x.state === 'next' ? 'not reached' : x.state })) : [], possible: possibleNow(point, aiMenu), mode: mode() }); }
    catch (e) { return finish({ why: 'error: ' + (e && e.message || e) }); }
    lastAsk = t; stale = stale || trigger;
    const c = send(messages, trigger);
    req = { at: t, last: t, point, rules: pastime ? rules : undefined, trigger, call: c };
    return WAIT;
  }

  function possibleNow(point, aiMenu) {   // what can be done right now, for the request (null: not known at this point)
    const ids = new Set(aiMenu.options.map(o => o.id));
    if (point === 'goal') return { goals: ids, pastimes: null };
    let goals = null; try { goals = new Set(refs.mind.menu().options.map(o => o.id)); } catch (e) { /* not known */ }
    return { goals, pastimes: ids };
  }

  /** The next step of the plan against this menu (see the header): { take, step, why } | { hold } | { replan }. Steps that are done or pointless are marked skipped on the way. */
  function follow(point, menu, aiMenu, canAsk) {
    const ids = new Set(aiMenu.options.map(o => o.id)), here = new Set(menu.options.map(o => o.id)), before = here.has('onward');
    const skip = (st, why) => { st.state = 'skipped'; plan.i++; bump(); };
    while (plan.i < plan.steps.length) {
      const k = plan.i, st = plan.steps[k], id = st.id, goalStep = PLAN_GOALS.includes(id);
      if (point === 'goal') {
        if (goalStep) { if (ids.has(id)) { st.state = 'done'; plan.i++; bump(); return { take: id, step: k }; } skip(st); continue; }
        if (ids.has('idle')) return { take: 'idle', bridge: true, step: k, why: `Free time first, on the way to: ${stepLabel(id)}.` };
        return { hold: true };
      }
      if (goalStep) {
        const short = before ? 'onward' : 'linger';
        return ids.has(short) ? { take: short, bridge: true, step: k, why: `A short one first: the plan's next step is ${stepLabel(id)}.` } : { hold: true };
      }
      if (ids.has(id)) { st.state = 'done'; plan.i++; bump(); return { take: id, step: k }; }
      if (before && !STAGES.before.includes(id) && ids.has('onward')) return { take: 'onward', bridge: true, step: k, why: `On the way to: ${stepLabel(id)}.` };
      // not possible now
      if (canAsk()) return { replan: `the next step, ${stepLabel(id)}, was not possible now (${STEP_WHEN[id]})` };
      skip(st);
    }
    return canAsk() ? { replan: 'the plan is used up' } : { hold: true, used: true };
  }

  function attach(mind, game) { refs = { mind, game }; }

  chooser.allowPreempt = () => {   // 0.36.3: may a higher want stop the goal that is running? strict: yes (the rules); free: no; loose: only at the brink (the critical override)
    if (!enabled()) return true;
    if (!overrides && mode() === 'strict') return true;
    const crit = active().find(o => o.id === 'critical');
    return !!crit && !!crit.test({ s: vitals() });
  };
  chooser.selfChecked = true;   // game/mind need not check the answer again: the rules' answer is returned as it is, and an AI answer is checked here
  return { chooser, attach, entries, get version() { return version; }, tally: () => ({ ...count }), inFlight: () => !!call, waiting: () => !!req, plan: planInfo, asking: () => (req ? req.trigger : null) };
}
