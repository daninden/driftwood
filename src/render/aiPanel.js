/**
 * render/aiPanel — the AI panel (0.36 "Mind", log made clear in 0.36.1 "Clear log"): a developer panel, separate from the dev panel, to switch the language-model chooser on, enter the player's own key and FOLLOW what it does. Toggled with the I key.
 * DOM only: it reads the client's status (ai/client) and the chooser's log and tally (ai/chooser) and shows them; it decides nothing.
 *
 * 0.36.6 "One menu": the top of the panel is COMPACT. Collapsed (the default) it is one line: the on/off checkbox, "AI on · loose · 3.5-flash-lite 6/480 · not asking" (`summaryLine`), any problem in red in the same line (an error, a model paused or not available, all budgets spent, no key, Dave waiting) and a small "⚙" button that expands the settings (the key field, clear key, list models, the leash buttons with their note, the address, the status line, one line per model, the pending line, the tally). The choice is kept per browser in localStorage (wrapped in try/catch; no game save).
 *   Under it the log by plan: in the per-step view (the default) there is NO separate plan box any more: the newest plan group in the log is the current plan (a clear border, a "current plan" tag; while a new plan is being asked a grey line says so); in "show every decision" the plan box above the log stays.
 *
 * Content of the expanded settings and the log, top to bottom: on/off, the key field (a password field: the key is saved to localStorage by the client when the field changes and the field is emptied; it is never shown again) and "clear key", "list models"
 * (the model names the key can use; the model itself is fixed in ai/config), the models in order of preference and the address as text, a status line, one plain line per model ("gemini-x: 12 of 900 today, 1 of 12 this minute", "paused until 14:05",
 * "not available (model not found)", "last error: ..."), whether Dave is waiting for an answer now ("Dave is waiting for the AI...", "Not asking now"), a tally (since the page was loaded: N by the AI, M by the rules, K different from the rules)
 * 0.36.3 "Plans": under the models a row of three buttons for the LEASH (strict, loose, free: ai/chooser MODES; kept by the client), the current plan with a marker at the current step and the reason it was asked, and "overruled" (orange tag, the plain reason) on every block where the rules overruled the AI.
 * and the log of decisions (0.36.3: goal decisions and free-time (pastime) decisions, each block marked with a small chip, "goal" or "free time"), newest first, one block each, in plain words with the options' `what` texts:
 *   AI blocks: a coloured left border, a bold label, `Day 3, 14:20 — AI chose: fetch wood for the fire` with a tag "different from the rules" when the rules would have chosen otherwise, the AI's reason in quotes,
 *   "The rules would have chosen: ...", "Options were: ...", and "model · answered in 1.2 s" (how long Dave waited).
 *   Rules blocks (grey): `Day 3, 14:35 — Rules chose: fill the store` and "Why not the AI: no answer in 10 s" (AI_WAIT) (reasons in plain words; if the AI had an answer that was not used, what it chose).
 * While the AI is off no decision is logged (ai/chooser) and the log says only "The AI is off." A click on a block shows the full request and the raw answer (closed by default). A failed or unusable request is a small red-ish note between the blocks.
 * The meta line says "step i of n of the plan" (0.36.4: i is the step being taken, 1-based, never above n) or, for a short way on to a step (free time first, onward, linger), "on the way to step i of n of the plan".
 * 0.36.5 point 10: a step is 'running' ("▶", bold blue, "busy" in the log view) from when it is taken until the next is taken, 'done' ("✓", grey) after that, the first step not yet taken is 'next' ("(next)" after it, plain), the rest plain, 'skipped' "✗" struck through with its reason (ai/chooser plan states).
 * 0.36.5 "Reach": the default view of the log is BY PLAN (`groupByPlan`): each plan is a header ("New plan, Day 3 07:31 — asked because ...") with its one-sentence reason, then one block per plan step IN PLAN ORDER: the step (with its destination, `to`), the model's reason in quotes, when it was taken and how it stands
 * (done, next, not reached, skipped with the plain reason, or overruled by the rules: an orange tag, the reason and what the rules did instead); the decisions that belong to a step (a short way on to it: free time, onward, linger) fold into one small grey line ("via: free time, go on with the day"). Decisions the rules made with no plan or when the AI
 * could not answer (no answer, waiting, busy, budget, an error, a note about a failed request) are grey blocks between the plans in time order, with the plain why. A toggle ("show every decision" / "show the plan steps") switches to the old view, one block per decision, unchanged. A click on a plan header, a step or a grey block shows the full request and the raw answer where there is one.
 * 0.36.7 "Memory": under the top line a collapsible "Memory" block (`memoryParts`): his own notes (the model writes them, at most 20 lines) and the journal (one line a day from sunset, newest day first; all are kept in the save); the collapsed state is kept in localStorage like the settings (`driftwood.aiMemoryOpen`, try/catch). It shows what the chooser has (`ai.notes()`, `ai.journal()`), with the AI on or off.
 * Small, monospace, on a light box, scrollable. It is out of the way of the game: a pointer in the panel never walks Dave or takes him back from his habit (isAiPanelEvent; main skips those events), and typing in the
 * key field reaches no game key (game/input isTyping).
 *
 * Exports:
 *   isAiKey(e) -> bool            a plain I (no modifier, not repeating, not typed into a field). Pure.
 *   isAiPanelEvent(e) -> bool     the event came from inside the panel (#ai)
 *   whyText(e) -> string          the reason the rules decided, in plain words ('' when the AI chose). Pure.
 *   blockParts(e) -> { source: 'ai'|'rules', kind: 'goal'|'pastime', kindLabel: 'goal'|'free time', head, tag, reason, rulesLine, optionsLine, meta, why }   the texts of one decision block (strings or ''). Pure.
 *   groupByPlan(entries, plans) -> [item]   (0.36.5, pure) the log by plan, newest first: { kind: 'plan', id, head, reason, late, steps: [{ i, label, to, toNote, reason, state, stateText, when, tag, overrides: [{ text, n }], via, n }], n (the entry that asked: for the full request) } | { kind: 'rules', n, head, why, entry } (a grey block) | { kind: 'note', text }
 *   stepWhy(entry) / planWhen(plan)   small texts of the above
 *   planLines(plan) -> [{ marker ('▶' running, '✓' done, '✗' skipped, ' '), state, text }], planHead(plan), modeLine(mode)   the plan with a marker at the current step, why it was asked, and what the leash means. Pure.
 *   memoryParts(notes, journal) -> { head, notes: [text], journal: [{ day, text }] }   (0.36.7, pure) the Memory block: its head ("Memory: 3 notes, 2 journal lines"), the notes in order, the journal newest day first
 *   logText({ items, tally, state, model, mode, models, days }) -> string   (0.36.7, pure) the plain-text log of the last 2 game days for the "copy log" button: the version, model and leash, the tally, the situation now with the "not now" reasons, then each plan (why asked, its steps with reason and outcome, via, overruled) and the rules' own decisions with why not the AI, oldest first; never the key, never the full requests
 *   nowParts(info, plan, entries) -> { text, mismatch, why }   (0.36.7, pure) the "Now" line at the top of the panel (also with the AI off): what Dave is actually doing (mind.now), "waiting for a plan (4 s of 10)", and in quiet ink with the reason when it is not the plan's running step
 *   tallyLine(t) -> string        "Since the page was loaded: 5 by the AI, 3 by the rules, 2 different from the rules"
 *   statusLine(status, nowMs) -> string       on or off, asking, all-paused, the last error
 *   modelLines(status, nowMs) -> [string]     one plain line per model
 *   pendingLine(waiting, inFlight) -> string
 *   summaryLine(status, { mode, waiting, inFlight }, nowMs) -> { text, problem }, shortModel(name)   (0.36.6, pure) the one line of the collapsed panel after the checkbox, and the problem text shown in red in it
 *   requestText(messages, raw) -> string   the full exchange of an entry, for the expanded view
 *   createAiPanel(el, { client, ai, now? }) -> { toggle(), visible(), update() }   el: the #ai element (index.html); update() is called every frame and touches the DOM only when something changed; listens for I on window
 *
 * Depends on: ai/config (AI_WAIT, a constant); main hands it the client of ai/client and the chooser of ai/chooser)
 */

import { AI_WAIT, AI_MODES } from '../ai/config.js';
import { VERSION, NAME } from '../version.js';

export const isAiKey = e => !!e && e.code === 'KeyI' && !e.repeat && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey
  && !(e.target && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || '')));

export function isAiPanelEvent(e) {
  const path = e && e.composedPath && e.composedPath();
  if (Array.isArray(path) && path.some(n => n && n.id === 'ai')) return true;
  const t = e && e.target;
  return !!(t && (t.id === 'ai' || (t.closest && t.closest('#ai'))));
}

const what = (e, id) => { const o = (e.options || []).find(x => x.id === id); return o ? o.what : id; };
const clock = ms => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const secs = ms => `${(ms / 1000).toFixed(1)} s`;

export function whyText(e) {
  const w = e.why || '';
  if (!w) return '';
  if (w === 'off') return 'the AI is off';
  if (w === 'no answer') return `no answer in ${AI_WAIT} s`;
  if (w === 'busy') return 'the earlier request is still running';
  if (w === 'need') return 'a need: the rules decide';
  if (w === 'safety') return 'a safety matter (the fire): the rules decide';
  if (w === 'critical') return 'at the brink: the rules decide';
  if (w === 'waiting') return 'a new plan was asked a moment ago';
  if (w === 'plan-hold') return 'the plan\'s next step has to wait for a later moment';
  if (w === 'not on menu') return `the AI's choice is not possible now${e.ai ? ' (it chose: ' + what(e, e.ai) + ')' : ''}`;
  if (w === 'budget') return 'the budget is spent';
  if (w === 'forced') return 'an emergency: the rules decide';
  if (/^error:/.test(w)) return 'the request failed:' + w.slice(6);
  return w;
}

export function blockParts(e) {
  const when = `Day ${e.day == null ? '?' : e.day}, ${e.time || '--:--'}`;
  const isAi = e.used === 'ai';
  const chosen = isAi ? e.ai : e.rules;
  const head = `${when} — ${isAi ? 'AI' : 'Rules'} chose: ${what(e, chosen)}`;
  const ids = (e.options && e.options.length ? e.options.map(o => o.id) : e.menu) || [];
  const meta = [];
  if (isAi && e.plan) { const i = Math.max(1, Math.min(+e.plan.i || 1, +e.plan.n || 1)); meta.push(e.plan.via ? `on the way to step ${i} of ${e.plan.n} of the plan` : `step ${i} of ${e.plan.n} of the plan`); }   // 0.36.4: the step being taken (1-based, never above the plan's length); a short way first (free time, onward, linger) is only "on the way to" the step
  if (isAi) {
    if (e.model) meta.push(e.model);
    if (e.ms != null) meta.push(`answered in ${secs(e.ms)}`);
  }
  const kind = e.point === 'pastime' ? 'pastime' : 'goal';
  const overruled = !isAi && !!e.override;
  return {
    source: isAi ? 'ai' : 'rules',
    kind, kindLabel: kind === 'pastime' ? 'free time' : 'goal',
    head,
    tag: overruled ? 'overruled' : isAi && e.ai !== e.rules ? 'different from the rules' : '',
    reason: isAi && e.reason ? `"${e.reason}"` : '',
    rulesLine: isAi ? `The rules would have chosen: ${what(e, e.rules)}` : overruled && e.planned ? `The plan's next step was: ${e.planned}` : '',
    optionsLine: isAi && ids.length ? `Options were: ${ids.map(id => what(e, id)).join(', ')}` : '',
    meta: meta.join(' · '),
    why: isAi ? '' : overruled ? `Overruled: ${e.override}` : `Why not the AI: ${whyText(e)}`,
  };
}

/** The plan as lines for the panel (0.36.5): "▶" the step that is busy now (the last one taken), "✓" done, "✗" skipped, none for the rest; the first step not yet taken says "(next)" after it. Pure. */
const MARK = { running: '▶', done: '✓', skipped: '✗' };
export function memoryParts(notes, journal) {
  const n = Array.isArray(notes) ? notes.filter(x => typeof x === 'string' && x) : [], j = (Array.isArray(journal) ? journal : []).filter(x => x && typeof x.line === 'string' && x.line).sort((a, b) => b.day - a.day).map(x => ({ day: x.day, text: `Day ${x.day}: ${x.line}` }));
  return { head: `Memory: ${n.length} note${n.length === 1 ? '' : 's'}, ${j.length} journal line${j.length === 1 ? '' : 's'}`, notes: n, journal: j };
}
export function planLines(plan) {
  if (!plan) return [];
  return plan.steps.map((s, k) => ({ marker: MARK[s.state] || ' ', state: s.state, text: `${k + 1}. ${s.label}${s.toUsed || s.to ? ' (' + (s.toUsed || s.to) + ')' : ''}${s.state === 'next' ? ' (next)' : ''}${s.reason ? ' — ' + s.reason : ''}` }));
}
export const planHead = plan => (plan ? `Plan from day ${plan.day == null ? '?' : plan.day}, ${plan.time || '--:--'} (asked because: ${plan.trigger})${plan.late ? ' · it came late and is used from now on' : ''}` : 'No plan yet.');
export const MODE_LINE = {
  strict: 'Strict: the rules keep his needs, the fire and anything critical.',
  loose: 'Loose: the AI also plans drink, eat and sleep; the rules step in only at the brink of collapse.',
  free: 'Free: nothing overrules the AI; the game\'s own consequences happen.',
};
export const modeLine = m => MODE_LINE[m] || '';

export const tallyLine = t => `Since the page was loaded: ${t.ai} by the AI, ${t.rules} by the rules, ${t.differ} different from the rules`;

export function statusLine(s, nowMs = Date.now()) {
  const parts = [s.on ? (s.hasKey ? 'The AI is on' : 'The AI is on, but there is no key') : 'The AI is off'];
  if (s.inFlight) parts.push('asking...');
  if (s.pausedUntil && s.pausedUntil > nowMs) parts.push(`all models are paused, the next is back in ${Math.ceil((s.pausedUntil - nowMs) / 1000)} s`);
  if (s.lastError) parts.push('last error: ' + s.lastError);
  return parts.join(' · ');
}

/** One plain line per model. */
export function modelLines(s, nowMs = Date.now()) {
  return (s.models || []).map(m => {
    const parts = [`${m.model}: ${m.today} of ${m.perDay} today, ${m.lastMinute} of ${m.perMin} this minute`];
    if (m.dead) parts.push('not available (model not found)');
    else if (m.pausedUntil && m.pausedUntil > nowMs) parts.push(`paused until ${clock(m.pausedUntil)}`);
    if (m.lastError) parts.push('last error: ' + m.lastError);
    return parts.join(' · ');
  });
}

/** 0.36.6: the model's name without the family prefix ("gemini-3.5-flash-lite" -> "3.5-flash-lite"). */
export const shortModel = m => String(m || '').replace(/^gemini-/, '');

/**
 * 0.36.6: the ONE line of the collapsed panel (pure), after the on/off checkbox: { text, problem }.
 *   "AI on · loose · 3.5-flash-lite 6/480 · not asking"  (the leash, the first model that is available now with its count today of the day's budget, and the pending state: "not asking", "asking…" or "Dave is waiting")
 *   problem: short plain text that the panel shows in red in the same line ('' when all is well): an error, a model paused or not available, all budgets spent, no key, or Dave waiting for an answer.
 *   s: the client's status, o: { mode, waiting, inFlight }.
 */
export function summaryLine(s, o = {}, nowMs = Date.now()) {
  if (!s.on) return { text: 'AI off', problem: '' };
  const models = s.models || [], paused = m => !!m.pausedUntil && m.pausedUntil > nowMs;
  const free = models.find(m => !m.dead && !paused(m) && m.today < m.perDay);
  const pending = o.waiting ? 'Dave is waiting' : o.inFlight ? 'asking…' : 'not asking';
  const parts = ['AI on'];
  if (o.mode) parts.push(o.mode);
  parts.push(free ? `${shortModel(free.model)} ${free.today}/${free.perDay}` : 'no model free');
  parts.push(pending);
  const bad = [];
  if (!s.hasKey) bad.push('no key');
  const alive = models.filter(m => !m.dead);
  if (models.length && !alive.length) bad.push('no model available');
  else if (!free && alive.length) bad.push(alive.every(m => m.today >= m.perDay) ? 'all budgets spent' : 'all models paused');
  else for (const m of models) { if (m.dead) bad.push(`${shortModel(m.model)} not available`); else if (paused(m)) bad.push(`${shortModel(m.model)} paused until ${clock(m.pausedUntil)}`); }
  if (s.lastError) bad.push('error: ' + String(s.lastError).slice(0, 48));
  if (o.waiting) bad.push('waiting for an answer');
  return { text: parts.join(' · '), problem: bad.join(' · ') };
}

export function pendingLine(waiting, inFlight = false) {
  if (waiting) return 'Dave is waiting for the AI...';
  return inFlight ? 'An earlier request is still running' : 'Not asking now';
}

export function requestText(messages, raw) {
  const m = (messages || []).map(x => `[${x.role}]\n${x.content}`).join('\n\n');
  return (m || '(no request kept)') + '\n\n[answer]\n' + (raw == null ? '(none)' : raw);
}

/** 0.36.5: how a trigger of ai/chooser reads in a plan header ("no plan yet" stays as it is). */
const triggerText = t => (t ? String(t) : 'no plan yet');
const stateWords = { running: 'busy', done: 'done', next: 'next up', later: 'not reached', 'not reached': 'not reached', skipped: 'skipped' };   // 0.36.5
const atText = at => (at && at.day != null ? `Day ${at.day}, ${at.time || '--:--'}` : '');
const optionWhat = (e, id) => what(e, id);

/**
 * The log by plan (0.36.5). `entries`: the chooser's log, newest first (ai.entries); `plans`: ai.plans() (newest first, each with its steps' states). Entries carry planId and step (0-based) (ai/chooser).
 *   - an AI decision with `plan.via` is a short way on to its step and folds into the step's grey `via` line; the AI decision without `via` is the step itself (when it was taken);
 *   - a rules decision with an `override` belongs to the step the plan was on and makes it "overruled" (its tag, the reason, what the rules did);
 *   - every other rules decision, and a note that is not the new-plan note, stands alone as a grey block, in time order among the plans.
 * Returns the items newest first (a plan counts at the time it was installed, a decision at its own time).
 */
export function groupByPlan(entries, plans) {
  const list = Array.isArray(entries) ? entries : [], ps = Array.isArray(plans) ? plans : [], byId = new Map();
  const items = [];
  for (const p of ps) {
    const note = list.find(e => e.note && e.planNote && e.planId === p.id);
    const item = {
      kind: 'plan', day: p.day, id: p.id, real: p.real || (note && note.real) || 0, head: `New plan, ${atText({ day: p.day, time: p.time })} — asked because: ${triggerText(p.trigger)}${p.late ? ' (it came late and is used from then on)' : ''}`, reason: p.reason ? `"${p.reason}"` : '', late: !!p.late, n: note ? note.n : null,
      steps: p.steps.map((s, i) => ({
        i, label: s.label, to: s.toUsed || s.to || null,
        toNote: s.toUsed ? `to: ${s.toUsed}` : s.to ? `to: ${s.to} (ignored: not possible now, the game picked)` : '',
        reason: s.reason ? `"${s.reason}"` : '', state: s.state, stateText: stateWords[s.state] || s.state, when: atText(s.at), note: s.state === 'skipped' && s.note ? s.note : '',
        tag: '', overrides: [], via: [], n: null,
      })),
    };
    byId.set(p.id, item); items.push(item);
  }
  for (const e of list.slice().reverse()) {   // oldest first, so a step's lines come in time order
    if (e.note) { if (!e.planNote) items.push({ kind: 'note', real: e.real || 0, text: e.note, n: e.n }); continue; }
    const plan = e.planId != null ? byId.get(e.planId) : null, step = plan && e.step != null ? plan.steps[e.step] : null;
    if (step && e.used === 'ai') {
      if (e.plan && e.plan.via) step.via.push(what(e, e.ai));
      else { step.n = e.n; if (!step.when) step.when = atText(e); }
      continue;
    }
    if (step && e.override) {
      step.tag = 'overruled';
      step.overrides.push({ text: `Overruled: ${e.override}. The rules chose: ${what(e, e.rules)}`, n: e.n });
      continue;
    }
    items.push({ kind: 'rules', day: e.day, real: e.real || 0, n: e.n, head: `${atText(e)} — Rules chose: ${what(e, e.rules)}`, why: e.override ? `Overruled: ${e.override}` : `Why not the AI: ${whyText(e)}`, entry: e });
  }
  return items.sort((a, b) => (b.real || 0) - (a.real || 0));
}

/**
 * 0.36.7: the plain-text log for the "copy log" button (pure). `items` is `groupByPlan(...)` (newest first), `days` how many game days back from the newest (2). Never holds the key or a full request.
 * o: { items, tally: {ai, rules, differ}, state: { text, blocked } | null, model, mode, models: [names] }
 */
export function logText({ items = [], tally = null, state = null, model = null, mode = null, models = [], days = 2, nowLog = [] } = {}) {
  const dayOf = it => (Number.isFinite(it.day) ? it.day : null), top = Math.max(-Infinity, ...items.map(dayOf).filter(d => d !== null));
  const keep = items.filter(it => it.kind !== 'note' && (dayOf(it) === null || top === -Infinity || dayOf(it) > top - days));
  const from = Math.min(Infinity, ...keep.map(it => it.real || 0).filter(Boolean));
  const notes = items.filter(it => it.kind === 'note' && (it.real || 0) >= from);
  const out = [`Driftwood ${VERSION} "${NAME}" · AI log, the last ${days} game days`, `Model: ${model || (models[0] || 'none yet')} · leash: ${mode || '?'}`];
  if (tally) out.push(tallyLine(tally));
  if (state && state.text) {
    out.push('', 'The situation now', state.text);
    const b = Object.entries(state.blocked || {}); if (b.length) out.push('Not now: ' + b.map(([k, v]) => `${k} (${v})`).join('; ') + '.');
  }
  if (nowLog.length) { out.push('', 'What he did, by change (Now)'); for (const x of nowLog) out.push(`  Day ${x.day} ${x.time} — ${x.text}`); }
  out.push('');
  for (const it of [...keep, ...notes].sort((a, b) => (a.real || 0) - (b.real || 0))) {
    if (it.kind === 'note') { out.push(`(note) ${it.text}`); continue; }
    if (it.kind === 'rules') { out.push(`${it.head}. ${it.why}`); continue; }
    out.push(it.head); if (it.reason) out.push('  ' + it.reason);
    for (const st of it.steps) {
      out.push(`  ${st.i + 1}. ${st.label}${st.to ? ' (' + st.to + ')' : ''}: ${[st.stateText, st.when].filter(Boolean).join(', ')}${st.reason ? ' ' + st.reason : ''}${st.note ? ' [' + st.note + ']' : ''}${st.tag ? ' [' + st.tag + ']' : ''}`);
      for (const o of st.overrides) out.push('     ' + o.text);
      if (st.via.length) out.push('     via: ' + st.via.join(', '));
    }
  }
  return out.join('\n');
}

/**
 * 0.36.7: the "Now" line (pure): { text, mismatch (bool), why }. `info` is `ai.nowInfo()`, `plan` `ai.plan()`, `entries` `ai.entries`. While Dave waits for a plan the text says how long ("waiting for a plan (4 s of 10)"). When what he does is not the plan's running step the line is marked (mismatch) and says why when known: the plan's last skipped step, else the newest decision the rules made.
 */
export function nowParts(info, plan = null, entries = []) {
  if (!info) return { text: '', mismatch: false, why: '' };
  let text = info.text;
  if (info.waited != null) text = `waiting for a plan (${Math.min(Math.floor(info.waited), AI_WAIT)} s of ${AI_WAIT})`;
  const mismatch = info.matches === false; let why = '';
  if (mismatch) {
    const sk = plan && plan.steps ? plan.steps.filter(s => s.state === 'skipped' && s.note).pop() : null, r = (entries || []).find(e => !e.note && e.used === 'rules');
    why = sk ? `the plan's step ${sk.label} ended: ${sk.note}` : r ? `the rules decided: ${whyText(r)}` : `the plan's step is ${info.step ? info.step.label : 'over'}`;
    text += ` (${why})`;
  }
  return { text, mismatch, why };
}

export function createAiPanel(el, { client, ai, now = () => Date.now() } = {}) {
  let byPlan = true, shown = false, seen = -1, lastStatus = '', lastModels = null, lastPending = '', lastOn = null;
  const open = new Set();
  const mk = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const st = client.status();

  el.textContent = '';
  const OPEN_KEY = 'driftwood.aiPanelOpen';
  const loadOpen = () => { try { return localStorage.getItem(OPEN_KEY) === '1'; } catch (e) { return false; } };
  const saveOpen = v => { try { localStorage.setItem(OPEN_KEY, v ? '1' : '0'); } catch (e) { /* no storage: it is only a convenience */ } };
  const MEM_KEY = 'driftwood.aiMemoryOpen';
  const loadMem = () => { try { return localStorage.getItem(MEM_KEY) === '1'; } catch (e) { return false; } };
  const saveMem = v => { try { localStorage.setItem(MEM_KEY, v ? '1' : '0'); } catch (e) { /* no storage: it is only a convenience */ } };
  let expanded = loadOpen(), memOpen = loadMem(), lastSummary = '', lastMem = -1, lastNow = '';
  const nowEl = mk('div', 'ai-now');
  const title = mk('div', 'ai-title', `AI · ${st.models.map(m => m.model).join(' > ')}`);
  const top = mk('div', 'ai-top'), sum = mk('span', 'ai-sum'), sumText = mk('span', null), sumBad = mk('span', 'ai-bad'), gear = mk('button', 'ai-gear', '⚙'), copy = mk('button', 'ai-copy', 'copy log'); gear.type = 'button'; copy.type = 'button'; copy.title = 'copy the last two game days of the log as text'; gear.setAttribute('aria-label', 'AI settings'); gear.title = 'settings';
  const settings = mk('div', 'ai-settings');
  const memBox = mk('div', 'ai-memory'), memHead = mk('button', 'ai-mem-head'), memBody = mk('div', 'ai-mem-body'); memHead.type = 'button'; memBox.append(memHead, memBody);
  const row = mk('div', 'ai-row');
  const onLabel = mk('label'); const on = mk('input'); on.type = 'checkbox'; on.checked = client.on(); onLabel.append(on);
  sum.append(sumText, ' ', sumBad); top.append(onLabel, sum, copy, gear);
  const copyBox = mk('div', 'ai-copybox'); copyBox.hidden = true;
  const key = mk('input', 'ai-key'); key.type = 'password'; key.autocomplete = 'off'; key.spellcheck = false; key.setAttribute('aria-label', 'API key');
  const clear = mk('button', null, 'clear key'); clear.type = 'button';
  const list = mk('button', null, 'list models'); list.type = 'button';
  row.append(key, clear, list);
  const addr = mk('div', 'ai-dim', st.url);
  const modeRow = mk('div', 'ai-modes'), modeNote = mk('div', 'ai-dim'), planBox = mk('div', 'ai-plan');
  const modeBtn = {}; for (const m of AI_MODES) { const b = mk('button', null, m); b.type = 'button'; b.dataset.mode = m; modeBtn[m] = b; modeRow.append(b); }
  const viewBtn = mk('button', 'ai-view'); viewBtn.type = 'button';
  const status = mk('div', 'ai-status'), tally = mk('div', 'ai-tally'), perModel = mk('div', 'ai-models-status'), pend = mk('div', 'ai-pending'), models = mk('div', 'ai-models'), log = mk('div', 'ai-log');
  models.hidden = true;
  settings.append(title, row, modeRow, modeNote, addr, status, perModel, pend, models, tally);
  el.append(nowEl, top, copyBox, settings, memBox, planBox, viewBtn, log);
  const showOpen = () => { settings.hidden = !expanded; gear.className = expanded ? 'ai-gear on' : 'ai-gear'; gear.setAttribute('aria-expanded', String(expanded)); };
  showOpen(); gear.addEventListener('click', () => { expanded = !expanded; saveOpen(expanded); showOpen(); });
  const renderMemory = () => {
    const m = memoryParts(ai.notes ? ai.notes() : [], ai.journal ? ai.journal() : []);
    memHead.textContent = `${memOpen ? '▾' : '▸'} ${m.head}`; memHead.setAttribute('aria-expanded', String(memOpen)); memBody.hidden = !memOpen; memBody.textContent = '';
    if (!memOpen) return;
    memBody.append(mk('div', 'ai-sub', 'His notes'));
    if (m.notes.length) m.notes.forEach((x, i) => memBody.append(mk('div', 'ai-note', `${i + 1}. ${x}`))); else memBody.append(mk('div', 'ai-dim', '(none yet)'));
    memBody.append(mk('div', 'ai-sub', 'Journal'));
    if (m.journal.length) m.journal.forEach(x => memBody.append(mk('div', 'ai-note', x.text))); else memBody.append(mk('div', 'ai-dim', '(no line yet)'));
  };
  memHead.addEventListener('click', () => { memOpen = !memOpen; saveMem(memOpen); renderMemory(); });
  copy.addEventListener('click', async () => {
    const s = client.status(), pl = ai.plan(), text = logText({ items: groupByPlan(ai.entries, ai.plans()), tally: ai.tally(), state: ai.stateNow ? ai.stateNow() : null, nowLog: ai.nowLog ? ai.nowLog() : [], model: pl && pl.model, mode: client.mode(), models: s.models.map(m => m.model) });
    let ok = false; try { await navigator.clipboard.writeText(text); ok = true; } catch (e) { ok = false; }
    if (ok) { copyBox.hidden = true; copy.textContent = 'copied'; setTimeout(() => { copy.textContent = 'copy log'; }, 1500); return; }
    copyBox.textContent = '';   // no clipboard: the text in a box, selected, to copy by hand
    const ta = mk('textarea', 'ai-copytext'); ta.readOnly = true; ta.value = text; ta.rows = 8; const close = mk('button', null, 'close'); close.type = 'button'; close.addEventListener('click', () => { copyBox.hidden = true; });
    copyBox.append(ta, close); copyBox.hidden = false; ta.focus(); ta.select();
  });
  const showView = () => { viewBtn.textContent = byPlan ? 'show every decision' : 'show the plan steps'; };
  showView(); viewBtn.addEventListener('click', () => { byPlan = !byPlan; showView(); seen = -1; update(); });
  const showMode = () => { const m = client.mode(); for (const k of AI_MODES) modeBtn[k].className = k === m ? 'on' : ''; modeNote.textContent = modeLine(m); };
  showMode();
  modeRow.addEventListener('click', e => { const m = e.target && e.target.dataset && e.target.dataset.mode; if (m) { client.setMode(m); showMode(); } });

  const hint = () => { key.placeholder = client.hasKey() ? 'key saved (hidden)' : 'paste your Google AI Studio key'; };
  hint();
  on.addEventListener('change', () => { client.setOn(on.checked); lastStatus = ''; });
  key.addEventListener('change', () => { client.setKey(key.value); key.value = ''; hint(); lastStatus = ''; });
  clear.addEventListener('click', () => { client.clearKey(); key.value = ''; hint(); lastStatus = ''; });
  list.addEventListener('click', () => {
    models.hidden = false; models.textContent = 'Asking...';
    client.listModels().then(ids => { models.textContent = ids.length ? 'Models: ' + ids.join(', ') : 'No models listed'; }, e => { models.textContent = 'Listing failed: ' + (e && e.message || e); });
  });
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'wheel']) el.addEventListener(type, e => e.stopPropagation(), { capture: true });
  log.addEventListener('click', e => {
    const row = e.target.closest && e.target.closest('[data-n]'); if (!row) return;
    const n = row.dataset.n; if (open.has(n)) open.delete(n); else open.add(n);
    seen = -1; update();
  });
  window.addEventListener('keydown', e => { if (isAiKey(e)) toggle(); });

  function renderLog() {
    log.textContent = ''; planBox.textContent = '';
    const pl = ai.plan(), asking = ai.asking();
    if (!byPlan && client.on() && client.hasKey()) {   // 0.36.6: the plan box only in the per-decision view; the per-step view has the newest plan group as the current plan
      planBox.append(mk('div', 'ai-plan-head', asking ? `Asking for a new plan (${asking})...` : planHead(pl)));
      for (const l of planLines(pl)) planBox.append(mk('div', `ai-step ${l.state}`, `${l.marker} ${l.text}`));
      if (pl && pl.reason) planBox.append(mk('div', 'ai-sub dim', `"${pl.reason}"`));
    }
    tally.textContent = client.on() && client.hasKey() ? tallyLine(ai.tally()) : '';
    if (!(client.on() && client.hasKey())) log.append(mk('div', 'ai-off', 'The AI is off.'));
    if (byPlan && client.on() && client.hasKey()) {
      if (asking) log.append(mk('div', 'ai-entry note asking', `Asking for a new plan (${asking})...`));
      let current = true;   // the newest plan group is the current plan
      for (const it of groupByPlan(ai.entries, ai.plans())) {
        if (it.kind === 'note') { log.append(mk('div', 'ai-entry note', it.text)); continue; }
        if (it.kind === 'rules') {
          const g = mk('div', 'ai-entry rules'); if (it.n != null) g.dataset.n = String(it.n);
          g.append(mk('div', 'ai-line', it.head), mk('div', 'ai-sub', it.why));
          if (it.n != null && open.has(String(it.n))) g.append(mk('pre', 'ai-full', requestText(it.entry.messages, it.entry.raw)));
          log.append(g); continue;
        }
        const g = mk('div', current ? 'ai-plangroup current' : 'ai-plangroup'), h = mk('div', 'ai-entry plannote'); if (it.n != null) h.dataset.n = String(it.n);
        h.append(mk('b', null, it.head)); if (current) h.append(' ', mk('span', 'ai-current', 'current plan')); current = false; if (it.reason) h.append(mk('div', 'ai-sub dim', it.reason));
        g.append(h);
        const ask = it.n != null ? ai.entries.find(e => e.n === it.n) : null;
        if (ask && open.has(String(it.n))) h.append(mk('pre', 'ai-full', requestText(ask.messages, ask.raw)));
        for (const st of it.steps) {
          const b = mk('div', `ai-entry ai ai-stepblock ${st.state}`);
          const head = mk('div', 'ai-line'); head.append(mk('b', null, `${st.i + 1}. ${st.label}${st.to ? ' (' + st.to + ')' : ''}`), ' ', mk('span', 'ai-sub dim', [st.stateText, st.when].filter(Boolean).join(' · ')));
          if (st.tag) head.append(' ', mk('span', 'ai-tag', st.tag));
          b.append(head);
          if (st.reason) b.append(mk('div', 'ai-reason', st.reason));
          if (st.note) b.append(mk('div', 'ai-sub', st.note));
          if (st.toNote && !st.to) b.append(mk('div', 'ai-sub dim', st.toNote));
          for (const o of st.overrides) b.append(mk('div', 'ai-sub', o.text));
          if (st.via.length) b.append(mk('div', 'ai-sub dim', 'via: ' + st.via.join(', ')));
          g.append(b);
        }
        log.append(g);
      }
      if (!ai.entries.length && !ai.plans().length) log.append(mk('div', 'ai-dim', 'No decisions yet.'));
      return;
    }
    for (const e of ai.entries) {
      if (e.note) { log.append(mk('div', e.planNote ? 'ai-entry plannote' : 'ai-entry note', e.note)); continue; }
      const p = blockParts(e);
      const item = mk('div', `ai-entry ${p.source}`);
      item.dataset.n = String(e.n);
      const head = mk('div', 'ai-line'); head.append(mk('span', `ai-kind ${p.kind}`, p.kindLabel), mk('b', null, p.head));
      if (p.tag) head.append(' ', mk('span', 'ai-tag', p.tag));
      item.append(head);
      for (const [cls, t] of [['ai-reason', p.reason], ['ai-sub', p.rulesLine], ['ai-sub', p.optionsLine], ['ai-sub', p.why], ['ai-sub dim', p.meta]]) if (t) item.append(mk('div', cls, t));
      if (open.has(String(e.n))) item.append(mk('pre', 'ai-full', requestText(e.messages, e.raw)));
      log.append(item);
    }
    if (!ai.entries.length && client.on() && client.hasKey()) log.append(mk('div', 'ai-dim', 'No decisions yet.'));
  }
  function update() {
    if (!shown) return;
    const cs = client.status(), s = statusLine(cs, now()), ml = modelLines(cs, now());
    { const np = nowParts(ai.nowInfo ? ai.nowInfo() : null, ai.plan(), ai.entries), t = np.text ? 'Now: ' + np.text : ''; if (t !== lastNow) { lastNow = t; nowEl.textContent = t; nowEl.classList.toggle('mismatch', np.mismatch); } }
    const sm = summaryLine(cs, { mode: client.mode(), waiting: ai.waiting(), inFlight: ai.inFlight() }, now()), key2 = sm.text + '|' + sm.problem;
    if (key2 !== lastSummary) { lastSummary = key2; sumText.textContent = sm.text; sumBad.textContent = sm.problem; sum.classList.toggle('bad', !!sm.problem); }
    if (s !== lastStatus) { lastStatus = s; status.textContent = s; }
    const mt = ml.join('\n'); if (mt !== lastModels) { lastModels = mt; perModel.textContent = mt; }
    const p = pendingLine(ai.waiting(), ai.inFlight());
    if (p !== lastPending) { lastPending = p; pend.textContent = p; }
    const isOn = client.on() && client.hasKey();
    if (ai.memoryVersion !== lastMem) { lastMem = ai.memoryVersion; renderMemory(); }
    if (ai.version !== seen || isOn !== lastOn) { seen = ai.version; lastOn = isOn; renderLog(); }
  }
  function toggle() { shown = !shown; el.hidden = !shown; if (shown) { seen = -1; lastMem = -1; update(); } }
  el.hidden = true;
  return { toggle, visible: () => shown, update };
}
