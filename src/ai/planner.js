/**
 * ai/planner — the language model as the chooser of game/actor in full AI play (0.37.1 "Half hour"). Pure apart from the functions it is handed (the client's `send` in the
 * game, a fake in the tests): no DOM, no storage, no random numbers.
 *
 * `planner.chooser(menu, ask)` is game/actor's chooser. With no plan ready it sends ONE request (ai/actPrompt `buildActMessages`: why it is asked, the state, what he did
 * lately, his notes, his lessons and the menu of that moment) and answers WAIT: the actor waits, and main pauses the game meanwhile (the world stands still, so the menu
 * the plan was written for still holds when it comes). When the answer is there the next call returns it: { steps, say }, which game/actor checks (`checkPlan`); a plan it
 * rejects comes back with why 'rejected' and the reason goes into the next request.
 *   Errors (a failed request: any HTTP error, a timeout, the network; the client already tried the next model) and unusable answers (no JSON, no steps) are retried after
 *   RETRY_SECS (2, 5, 10, 30 s of real time); after the last one the planner stops (`failed`) until `retry()` (the "try again" button). Three rejected plans in a row count
 *   as an error too, so a model that cannot write a valid plan does not ask for ever.
 *   With the planner not enabled (the AI off, no key) it answers null: the actor waits, and main does not use the actor then.
 * The plan's `say` travels with it (game/actor keeps it on `actor.plan` and in its 'plan' event; main says it above Dave). `notes`, when the answer has them, are the full new list of his notes (0.37.8: a number n in it keeps his note n, `parseActPlan(text, notes)`).
 * 0.37.4 "Lessons": `tick()` (main calls it every frame) asks ONE extra request a day after sunset (DUSK): the lesson of the day (ai/actPrompt `buildLessonMessages`; the answer is
 * the full new list of his lessons, at most LESSONS_MAX), in place of the journal line of 0.36.7; never while a plan request runs; the day is marked asked before the answer.
 * The plan's `minutes` (the model's own count, when it gives one) travels with it to game/actor `checkPlan`.
 *
 * createPlanner({ ask, enabled, canSend?, now, state, name?, clock, recent, log? }) -> planner
 *   ask(messages) -> Promise<{ text, model, ms }>     the client's send
 *   enabled() -> bool, canSend() -> bool              the AI is on with a key; a model is within its budget
 *   now() -> seconds (real), state() -> ai/prompt state, clock() -> { day (the player's), time }, recent() -> game/actor `recent`
 *   log(entry)                                        each request and its outcome: { n, real, day, time, why, ok, steps, say, error, reason, model, ms, messages, raw }
 *   planner.chooser(menu, ask)                        (above)
 *   planner.status() -> { state: 'off' | 'idle' | 'thinking' | 'retrying' | 'failed', errors, retryIn, error, model }
 *   planner.retry()                                   after `failed`: start again (and at once)
 *   planner.tick()                                    the sunset lesson
 *   planner.entries() -> [entry]                      the log, newest first (at most AI_LOG_MAX)
 *   planner.memory() / restore(m)                     { notes, lessons, asked }: what is saved with the island (`memory` in the save)
 *   planner.notes(), planner.lessons(), planner.memoryVersion, planner.version (changes of the log or the status)
 *
 * Depends on: ai/actPrompt, ai/prompt (clipLine), ai/config, game/intent (WAIT), game/sleep (DUSK)
 */
import { buildActMessages, parseActPlan, buildLessonMessages, parseLessons } from './actPrompt.js';
import { clipLine } from './prompt.js';
import { AI_LOG_MAX, RECENT_SHOWN, NOTES_MAX, NOTE_LEN, LESSONS_MAX, LESSON_LEN } from './config.js';
import { WAIT } from '../game/intent.js';
import { DUSK } from '../game/sleep.js';

export const RETRY_SECS = [2, 5, 10, 30];
export const REJECTS_MAX = 3;

export function createPlanner(o = {}) {
  const ask = o.ask, enabled = o.enabled || (() => false), canSend = o.canSend || (() => true), now = o.now || (() => 0);
  const stateNow = o.state || (() => ({})), name = o.name || (() => ''), clock = o.clock || (() => ({ day: 0, time: 0 })), recent = o.recent || (() => []), log = o.log || (() => {});
  let call = null, ready = null, lastRej = null, errors = 0, retryAt = 0, failed = false, lastError = null, lastModel = null, rejects = 0, n = 0, version = 0;
  let notes = [], lessons = [], asked = null, lessonCall = false, memVer = 0;
  const items = [];
  const bump = () => { version++; };
  const push = e => { items.unshift(e); if (items.length > AI_LOG_MAX) items.pop(); bump(); try { log(e); } catch (x) { /* the log never disturbs the game */ } };
  const recentNow = () => { try { return (recent() || []).slice(-RECENT_SHOWN); } catch (e) { return []; } };
  const sendNow = messages => { try { return Promise.resolve(ask(messages)); } catch (e) { return Promise.reject(e); } };   // sent at once (a throw is a failed request)

  function fail(entry, message) {
    errors++; lastError = message;
    if (errors >= RETRY_SECS.length + 1) { failed = true; retryAt = 0; }
    else retryAt = now() + RETRY_SECS[errors - 1];
    push({ ...entry, ok: false, error: message });
  }

  function send(menu, why, last) {
    const c = clock(), entry = { n: ++n, real: now(), day: c.day, time: c.time, why, reason: last && last.reason || null };
    let messages;
    try { messages = buildActMessages({ name: name(), state: stateNow(), menu, ask: { why, last }, recent: recentNow(), notes, lessons }); }
    catch (e) { fail(entry, 'the request could not be built: ' + (e && e.message || e)); return; }
    entry.messages = messages;
    const t0 = now();
    call = sendNow(messages).then(r => {
      const text = r && typeof r.text === 'string' ? r.text : '';
      lastModel = r && r.model || lastModel;
      const p = parseActPlan(text, notes), done = { ...entry, model: r && r.model || null, ms: r && Number.isFinite(r.ms) ? r.ms : Math.round((now() - t0) * 1000), raw: text };
      if (!p.ok) { fail(done, 'the answer could not be used: ' + p.error); return; }
      if (p.notes) { notes = p.notes.slice(); memVer++; }
      errors = 0; lastError = null; retryAt = 0;
      ready = { steps: p.steps, say: p.say, ...(p.minutes !== null ? { minutes: p.minutes } : {}) };
      push({ ...done, ok: true, steps: p.steps, say: p.say, minutes: p.minutes });
    }, e => { fail(entry, 'the request failed: ' + (e && e.message || String(e))); })
      .then(() => { call = null; bump(); });
    bump();
  }

  function chooser(menu, a = {}) {
    if (!enabled()) return null;
    const why = a.why || 'start', last = a.last || null;
    if (ready) {
      const plan = ready; ready = null; bump();
      return plan;
    }
    if (why === 'rejected') {   // the plan just handed over was refused by game/actor checkPlan
      if (!call && last && last.kind === 'rejected' && last !== lastRej) {
        lastRej = last; rejects++;
        const e = items.find(x => x.ok);
        if (e && !e.rejected) { e.rejected = last.reason; bump(); }
        if (rejects >= REJECTS_MAX) { rejects = 0; fail({ n: ++n, real: now(), day: clock().day, time: clock().time, why }, `${REJECTS_MAX} plans in a row could not be followed (${last.reason})`); }
      }
    } else rejects = 0;
    if (call || lessonCall || failed) return WAIT;
    if (retryAt && now() < retryAt) return WAIT;
    if (!canSend()) { lastError = 'every model is spent or paused'; return WAIT; }
    send(menu, why, last);
    return WAIT;
  }

  function retry() { failed = false; errors = 0; retryAt = 0; lastError = null; bump(); }

  function status() {
    const t = now();
    if (!enabled()) return { state: 'off', errors, retryIn: 0, error: lastError, model: lastModel };
    return { state: failed ? 'failed' : call ? 'thinking' : retryAt > t ? 'retrying' : 'idle', errors, retryIn: retryAt > t ? Math.ceil(retryAt - t) : 0, error: lastError, model: lastModel };
  }

  function tick() {   // 0.37.4 "Lessons": at sunset one request for the lesson of the day (the full new list of his lessons), in place of the journal line
    if (lessonCall || call || !enabled() || !canSend()) return;
    const c = clock();
    if (!(c.time >= DUSK)) return;
    if (asked === c.day) return;
    let messages;
    try { messages = buildLessonMessages({ state: stateNow(), recent: (() => { try { return (recent() || []).slice(-40); } catch (e) { return []; } })(), lessons, notes, name: name() }); } catch (e) { return; }
    asked = c.day; memVer++; lessonCall = true; bump();
    sendNow(messages).then(r => {
      const q = parseLessons(r && r.text, lessons);
      if (q.ok) { lessons = q.lessons; memVer++; }
    }, () => {}).then(() => { lessonCall = false; bump(); });
  }

  function memory() { return { notes: notes.slice(), lessons: lessons.slice(), ...(asked != null ? { asked } : {}) }; }
  function restore(m) {
    if (!m || typeof m !== 'object') return;
    if (Array.isArray(m.notes)) notes = m.notes.map(x => clipLine(x, NOTE_LEN)).filter(Boolean).slice(-NOTES_MAX);
    if (Array.isArray(m.lessons)) lessons = m.lessons.filter(x => typeof x === 'string').map(x => clipLine(x, LESSON_LEN)).filter(Boolean).slice(-LESSONS_MAX);
    if (Number.isFinite(m.asked)) asked = m.asked;
    memVer++;
  }

  return { chooser, status, retry, tick, memory, restore, entries: () => items.slice(), notes: () => notes.slice(), lessons: () => lessons.slice(), get memoryVersion() { return memVer; }, get version() { return version; } };
}
