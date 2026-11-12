/**
 * ai/chooser — the language-model chooser of the mind's top-level goal (0.36 "Mind"). Pure apart from the `ask` function it is handed (the client's `send` in the game, a fake in the tests).
 *
 * `chooser(point, menu, ctx)` is what game/mind calls: it is synchronous (the mind cannot wait), so the AI is asked AHEAD, while Dave is busy with his present errand: `tick(mind, game)` (every frame, from main) builds the
 * menu he would have if his errand ended now, asks "which next?" and keeps the parsed answer as the PENDING answer. When the errand ends, the chooser takes the pending answer if it is fresh (under AI_FRESH real seconds)
 * and its id is on the menu then; else the rules pick, whatever the reason. The rules' chooser is ALWAYS called first (so its random streams are drawn exactly as without the AI, and the log can say what the rules would have
 * picked). Only the 'goal' point is the AI's; pastimes and events stay with the rules, and so does a menu with a FORCED option (a matter of life and death) and everything while the AI is off.
 *
 * Ask-ahead pace: one request when there is no pending answer (at once after one was used, else at most one every AI_ASK_EVERY seconds), one more when the pending answer is about to go stale (AI_FRESH - AI_ASK_EVERY seconds old).
 * Nothing is asked for a menu of fewer than two options or one with a forced option, nor when the budget or a pause forbids (the client's canSend: some model is available).
 *
 * Every goal decision goes in the log (newest first, AI_LOG_MAX, memory only): { n, real, day, time, point, menu, rules, ai, used: 'ai' | 'rules', why, reason, ms, model, age, messages, raw }; why is why the rules took over:
 * 'off', 'forced', 'no answer yet', 'answer stale', 'not on menu', 'budget', 'error: ...'. Errors of a request go in as { note } lines.
 *
 * Exports:
 *   createAiChooser({ rulesChooser, ask, now?, canSend?, enabled?, clock?, log? }) -> ai
 *     rulesChooser(point, menu, ctx)   the present rules (game/intent rulesChooser)
 *     ask(messages) -> Promise<{ text, ms, model? }>
 *     now() -> real seconds (default: Date.now() / 1000)
 *     canSend() -> bool                the budget allows a request (default: true)
 *     enabled() -> bool                the AI is on and has a key (default: true)
 *     clock() -> { day, time } | null  the game time for the log (default: read from the game handed to tick)
 *     log(entry)                       called with each entry as it is made
 *   ai.chooser(point, menu, ctx) -> choice      for createMind
 *   ai.tick(mind, game)                          every frame while the habit drives: asks ahead when it is due
 *   ai.entries       the log, newest first (array, kept in place)       ai.version   counts the changes of the log or the pending answer
 *   ai.pending()     the pending answer { id, reason, at, ms, messages, raw } or null     ai.inFlight()    a request is running
 *
 * Depends on: ai/config, ai/prompt, game/intent (validChoice, choiceId, pure)
 */
import { AI_FRESH, AI_ASK_EVERY, AI_LOG_MAX } from './config.js';
import { buildMessages, optionsOf, parseAnswer, snapshotOf, hhmm } from './prompt.js';
import { validChoice, choiceId } from '../game/intent.js';

export function createAiChooser({ rulesChooser, ask, now = () => Date.now() / 1000, canSend = () => true, enabled = () => true, clock = null, log = null } = {}) {
  const entries = [];
  let version = 0, pending = null, flying = false, lastAskAt = -Infinity, askNow = true, failure = null, refs = null, seq = 0;

  const bump = () => { version++; };
  const push = e => { entries.unshift(e); if (entries.length > AI_LOG_MAX) entries.length = AI_LOG_MAX; bump(); if (log) { try { log(e); } catch (x) { /* a log that throws is its own problem */ } } };
  const gameTime = () => {
    try {
      const c = clock ? clock() : refs && refs.game && refs.game.clock;
      return c ? { day: c.day, time: hhmm(c.time) } : { day: null, time: null };
    } catch (e) { return { day: null, time: null }; }
  };

  function chooser(point, menu, ctx) {
    const rules = rulesChooser(point, menu, ctx);   // always: the rules' streams are drawn as without the AI
    if (point !== 'goal') return rules;
    const ids = menu.options.map(o => o.id), rid = choiceId(rules);
    const t = now();
    let used = 'rules', why = null, ans = null;
    if (!enabled()) why = 'off';
    else if (menu.options.some(o => o.forced)) why = 'forced';
    else if (!pending) why = flying ? 'no answer yet' : failure ? failure : !canSend() ? 'budget' : 'no answer yet';
    else if (t - pending.at >= AI_FRESH) { why = 'answer stale'; ans = pending; pending = null; }
    else if (!validChoice(menu, pending.id) || !ids.includes(pending.id)) { why = 'not on menu'; ans = pending; pending = null; }
    else { used = 'ai'; ans = pending; pending = null; }
    {
      const g = gameTime();
      push({ n: ++seq, real: t, day: g.day, time: g.time, point, menu: ids, rules: rid, ai: ans ? ans.id : null, used, why, reason: ans ? ans.reason : '', ms: ans ? ans.ms : null, model: ans ? ans.model : null, age: ans ? Math.round(t - ans.at) : null, messages: ans ? ans.messages : null, raw: ans ? ans.raw : null });
    }
    askNow = true;   // a new goal starts: the next one is asked about at once
    return used === 'ai' ? ans.id : rules;
  }

  function tick(mind, game) {
    refs = { mind, game };
    if (flying || !enabled() || !canSend()) return;
    const t = now();
    const stale = pending && t - pending.at >= AI_FRESH - AI_ASK_EVERY;
    if (pending && !stale) return;
    if (!askNow && t - lastAskAt < AI_ASK_EVERY) return;
    let menu; try { menu = mind.menu(); } catch (e) { return; }
    if (!menu || menu.options.length < 2 || menu.options.some(o => o.forced)) return;
    const ids = menu.options.map(o => o.id);
    const messages = buildMessages({ state: snapshotOf(game, mind), recent: mind.recent, options: optionsOf(menu) });
    flying = true; lastAskAt = t; askNow = false; bump();
    let call; try { call = Promise.resolve(ask(messages)); } catch (e) { call = Promise.reject(e); }
    call.then(r => {
      const p = parseAnswer(r && r.text, ids);
      if (p.ok) { pending = { id: p.id, reason: p.reason, at: now(), ms: r.ms, model: r.model || null, messages, raw: r.text }; failure = null; }
      else { failure = 'error: ' + p.error; push({ note: 'answer not usable: ' + p.error + ' (' + String(r && r.text).slice(0, 80).replace(/\s+/g, ' ') + ')', real: now(), messages, raw: r && r.text }); }
    }, e => {
      failure = 'error: ' + (e && e.message || e);
      push({ note: 'request failed: ' + (e && e.message || e), real: now() });
    }).then(() => { flying = false; bump(); });
  }

  chooser.selfChecked = true;   // game/mind need not check the answer again (and draw the rules' streams a second time): the rules' answer is returned as it is, and an AI answer is checked here
  return { chooser, tick, entries, get version() { return version; }, pending: () => pending, inFlight: () => flying };
}
