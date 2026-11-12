/**
 * ai/chooser — the language-model chooser of the mind's top-level goal (0.36 "Mind"; 0.36.1 "Clear log": asked AT the decision, he waits briefly). Pure apart from the `ask` function it is handed (the client's `send` in the game, a fake in the tests).
 *
 * `chooser(point, menu, ctx)` is what game/mind calls. At the GOAL point, when a decision comes up and the AI is on, the request is sent THEN, with the state and the menu of that moment, and the chooser answers WAIT (game/intent):
 * Dave stands still (thinking) and the mind asks again on its next step with a menu built anew. It goes on until the answer lands (valid on the current menu: used), or AI_WAIT real seconds have gone (timeout: the rules decide), or the request fails
 * (the rules decide). A request still running after the timeout is ignored when it lands: it is never applied to a later decision. The same call asks nothing and waits for nothing (the rules answer at once) when: the AI is off (nothing is logged),
 * the menu has fewer than two options (nothing is logged), a FORCED option is on it ('forced'), the rules' own pick is a need - drink, eat or sleep ('need': so the AI decides only when the rules' pick is fire, stores or idle),
 * the budget or a pause forbids ('budget') or an earlier request is still running ('busy'). Pastime and event points are the rules' (a WAIT would be treated as invalid there). The rules' chooser is ALWAYS called first (it draws no random numbers at the goal point,
 * and so its streams are drawn exactly as without the AI), and the log says what it would have picked. A decision abandoned while waiting (the chooser is not called for a second) starts afresh at the next call.
 *
 * Every goal decision with a choice (two or more options) goes in the log (newest first, AI_LOG_MAX, memory only): { n, real, day, time, point, menu, options, rules, ai, used: 'ai' | 'rules', why, reason, ms, model, messages, raw };
 * `menu` is the option ids, `options` the same as [{ id, what }] (the short plain labels of ai/prompt describeOption, for the panel), day is whatever the clock says (main hands the player-facing day number), ms is how long Dave waited (real ms, null when no request was made);
 * why is why the rules decided: 'forced', 'need', 'no answer' (timeout), 'not on menu', 'budget', 'busy', 'error: ...'. While the AI is off ('off') nothing is logged and nothing is counted. Errors of a request go in as { note } lines.
 * The tally (since the page was loaded) counts the logged decisions: { ai, rules, differ } (differ: an AI answer arrived and is not what the rules chose, used or not).
 *
 * Exports:
 *   createAiChooser({ rulesChooser, ask, now?, canSend?, enabled?, clock?, log?, wait? }) -> ai
 *     rulesChooser(point, menu, ctx)   the present rules (game/intent rulesChooser)
 *     ask(messages) -> Promise<{ text, ms, model? }>
 *     now() -> real seconds (default: Date.now() / 1000)
 *     canSend() -> bool                the budget allows a request (default: true)
 *     enabled() -> bool                the AI is on and has a key (default: true)
 *     clock() -> { day, time } | null  the game time for the log (default: read from the game handed to attach)
 *     log(entry)                       called with each entry as it is made
 *     wait                             seconds to wait for an answer (default AI_WAIT)
 *   ai.chooser(point, menu, ctx) -> choice | WAIT      for createMind
 *   ai.attach(mind, game)            hands the mind and the game over (the state and the short-term memory of a request are read from them)
 *   ai.entries       the log, newest first (array, kept in place)       ai.version   counts the changes of the log or of the request state
 *   ai.tally()       { ai, rules, differ }       ai.inFlight()   a request is running       ai.waiting()   Dave is waiting for an answer now
 *
 * Depends on: ai/config, ai/prompt, game/intent (validChoice, choiceId, WAIT, pure)
 */
import { AI_WAIT, AI_LOG_MAX } from './config.js';
import { buildMessages, optionsOf, parseAnswer, snapshotOf, hhmm, describeOption } from './prompt.js';
import { validChoice, choiceId, WAIT } from '../game/intent.js';

const NEEDS = new Set(['drink', 'eat', 'sleep']);
const ABANDONED = 1;   // seconds without a call: the decision it was waiting for is gone

export function createAiChooser({ rulesChooser, ask, now = () => Date.now() / 1000, canSend = () => true, enabled = () => true, clock = null, log = null, wait = AI_WAIT } = {}) {
  const entries = [], count = { ai: 0, rules: 0, differ: 0 };
  let version = 0, flying = false, req = null, refs = null, seq = 0;

  const bump = () => { version++; };
  const push = e => { entries.unshift(e); if (entries.length > AI_LOG_MAX) entries.length = AI_LOG_MAX; bump(); if (log) { try { log(e); } catch (x) { /* a log that throws is its own problem */ } } };
  const gameTime = () => {
    try {
      const c = clock ? clock() : refs && refs.game && refs.game.clock;
      return c ? { day: c.day, time: hhmm(c.time) } : { day: null, time: null };
    } catch (e) { return { day: null, time: null }; }
  };

  function record(menu, rid, rules, g, o) {   // one log entry and the tally
    const used = o.used || 'rules', ans = o.ans || null;
    count[used]++; if (ans && ans.id !== rid) count.differ++;
    push({ n: ++seq, real: now(), day: g.day, time: g.time, point: 'goal', menu: menu.options.map(x => x.id), options: menu.options.map(x => ({ id: x.id, what: describeOption(x).label })), rules: rid, ai: ans ? ans.id : null, used, why: o.why || null,
      reason: ans ? ans.reason : '', ms: o.ms == null ? null : o.ms, model: ans ? ans.model : null, messages: ans ? ans.messages : (o.messages || null), raw: ans ? ans.raw : (o.raw === undefined ? null : o.raw) });
  }

  function chooser(point, menu, ctx) {
    const rules = rulesChooser(point, menu, ctx);   // always: the rules' streams are drawn as without the AI
    if (point !== 'goal') return rules;
    const t = now(), rid = choiceId(rules), g = gameTime();
    if (req && t - req.last > ABANDONED) req = null;   // the decision it was for is gone
    const done = (o, c = rules) => { req = null; bump(); record(menu, rid, rules, g, o); return c; };
    if (!enabled()) { if (req) { req = null; bump(); } return rules; }
    if (menu.options.length < 2) { if (req) { req = null; bump(); } return rules; }
    if (menu.options.some(o => o.forced)) return done({ why: 'forced' });
    if (NEEDS.has(rid)) return done({ why: 'need' });
    if (!req) {
      if (flying) return done({ why: 'busy' });
      if (!canSend() || !refs) return done({ why: 'budget' });
      const ids = menu.options.map(o => o.id), mine = req = { at: t, last: t, result: null };
      let messages;
      try { messages = buildMessages({ state: snapshotOf(refs.game, refs.mind), recent: refs.mind.recent, options: optionsOf(menu) }); } catch (e) { req = null; return done({ why: 'error: ' + (e && e.message || e) }); }
      mine.messages = messages;
      flying = true; bump();
      let call; try { call = Promise.resolve(ask(messages)); } catch (e) { call = Promise.reject(e); }
      call.then(r => {
        const p = parseAnswer(r && r.text, ids);
        if (p.ok) { mine.result = { ok: true, ans: { id: p.id, reason: p.reason, model: r.model || null, messages, raw: r.text } }; }
        else { mine.result = { ok: false, why: 'error: ' + p.error, raw: r && r.text }; push({ note: 'The answer could not be used: ' + p.error + ' (' + String(r && r.text).slice(0, 80).replace(/\s+/g, ' ') + ')', real: now(), messages, raw: r && r.text }); }
      }, e => {
        mine.result = { ok: false, why: 'error: ' + (e && e.message || e) };
        push({ note: 'The request failed: ' + (e && e.message || e), real: now() });
      }).then(() => { flying = false; bump(); });
      return WAIT;
    }
    req.last = t;
    const waited = Math.round((t - req.at) * 1000), r = req.result;
    if (r) {
      if (!r.ok) return done({ why: r.why, ms: waited, messages: req.messages, raw: r.raw });
      if (!validChoice(menu, r.ans.id) || !menu.options.some(o => o.id === r.ans.id)) return done({ why: 'not on menu', ans: r.ans, ms: waited });
      return done({ used: 'ai', ans: r.ans, ms: waited }, r.ans.id);
    }
    if (t - req.at >= wait) return done({ why: 'no answer', ms: waited, messages: req.messages });   // a late answer will find req gone and is ignored
    return WAIT;
  }

  function attach(mind, game) { refs = { mind, game }; }

  chooser.selfChecked = true;   // game/mind need not check the answer again: the rules' answer is returned as it is, and an AI answer is checked here
  return { chooser, attach, entries, get version() { return version; }, tally: () => ({ ...count }), inFlight: () => flying, waiting: () => !!req };
}
