/**
 * render/aiPanel — the AI panel (0.36 "Mind", log made clear in 0.36.1 "Clear log"): a developer panel, separate from the dev panel, to switch the language-model chooser on, enter the player's own key and FOLLOW what it does. Toggled with the I key.
 * DOM only: it reads the client's status (ai/client) and the chooser's log and tally (ai/chooser) and shows them; it decides nothing.
 *
 * Content, top to bottom: on/off, the key field (a password field: the key is saved to localStorage by the client when the field changes and the field is emptied; it is never shown again) and "clear key", "list models"
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
 *   tallyLine(t) -> string        "Since the page was loaded: 5 by the AI, 3 by the rules, 2 different from the rules"
 *   statusLine(status, nowMs) -> string       on or off, asking, all-paused, the last error
 *   modelLines(status, nowMs) -> [string]     one plain line per model
 *   pendingLine(waiting, inFlight) -> string
 *   requestText(messages, raw) -> string   the full exchange of an entry, for the expanded view
 *   createAiPanel(el, { client, ai, now? }) -> { toggle(), visible(), update() }   el: the #ai element (index.html); update() is called every frame and touches the DOM only when something changed; listens for I on window
 *
 * Depends on: ai/config (AI_WAIT, a constant); main hands it the client of ai/client and the chooser of ai/chooser)
 */

import { AI_WAIT, AI_MODES } from '../ai/config.js';

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
      kind: 'plan', id: p.id, real: p.real || (note && note.real) || 0, head: `New plan, ${atText({ day: p.day, time: p.time })} — asked because: ${triggerText(p.trigger)}${p.late ? ' (it came late and is used from then on)' : ''}`, reason: p.reason ? `"${p.reason}"` : '', late: !!p.late, n: note ? note.n : null,
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
    items.push({ kind: 'rules', real: e.real || 0, n: e.n, head: `${atText(e)} — Rules chose: ${what(e, e.rules)}`, why: e.override ? `Overruled: ${e.override}` : `Why not the AI: ${whyText(e)}`, entry: e });
  }
  return items.sort((a, b) => (b.real || 0) - (a.real || 0));
}

export function createAiPanel(el, { client, ai, now = () => Date.now() } = {}) {
  let byPlan = true, shown = false, seen = -1, lastStatus = '', lastModels = null, lastPending = '', lastOn = null;
  const open = new Set();
  const mk = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const st = client.status();

  el.textContent = '';
  const title = mk('div', 'ai-title', `AI · ${st.models.map(m => m.model).join(' > ')}`);
  const row = mk('div', 'ai-row');
  const onLabel = mk('label'); const on = mk('input'); on.type = 'checkbox'; on.checked = client.on(); onLabel.append(on, ' on');
  const key = mk('input', 'ai-key'); key.type = 'password'; key.autocomplete = 'off'; key.spellcheck = false; key.setAttribute('aria-label', 'API key');
  const clear = mk('button', null, 'clear key'); clear.type = 'button';
  const list = mk('button', null, 'list models'); list.type = 'button';
  row.append(onLabel, key, clear, list);
  const addr = mk('div', 'ai-dim', st.url);
  const modeRow = mk('div', 'ai-modes'), modeNote = mk('div', 'ai-dim'), planBox = mk('div', 'ai-plan');
  const modeBtn = {}; for (const m of AI_MODES) { const b = mk('button', null, m); b.type = 'button'; b.dataset.mode = m; modeBtn[m] = b; modeRow.append(b); }
  const viewBtn = mk('button', 'ai-view'); viewBtn.type = 'button';
  const status = mk('div', 'ai-status'), tally = mk('div', 'ai-tally'), perModel = mk('div', 'ai-models-status'), pend = mk('div', 'ai-pending'), models = mk('div', 'ai-models'), log = mk('div', 'ai-log');
  models.hidden = true;
  el.append(title, row, modeRow, modeNote, addr, status, perModel, pend, planBox, models, tally, viewBtn, log);
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
    if (client.on() && client.hasKey()) {
      planBox.append(mk('div', 'ai-plan-head', asking ? `Asking for a new plan (${asking})...` : planHead(pl)));
      for (const l of planLines(pl)) planBox.append(mk('div', `ai-step ${l.state}`, `${l.marker} ${l.text}`));
      if (pl && pl.reason) planBox.append(mk('div', 'ai-sub dim', `"${pl.reason}"`));
    }
    tally.textContent = client.on() && client.hasKey() ? tallyLine(ai.tally()) : '';
    if (!(client.on() && client.hasKey())) log.append(mk('div', 'ai-off', 'The AI is off.'));
    if (byPlan && client.on() && client.hasKey()) {
      for (const it of groupByPlan(ai.entries, ai.plans())) {
        if (it.kind === 'note') { log.append(mk('div', 'ai-entry note', it.text)); continue; }
        if (it.kind === 'rules') {
          const g = mk('div', 'ai-entry rules'); if (it.n != null) g.dataset.n = String(it.n);
          g.append(mk('div', 'ai-line', it.head), mk('div', 'ai-sub', it.why));
          if (it.n != null && open.has(String(it.n))) g.append(mk('pre', 'ai-full', requestText(it.entry.messages, it.entry.raw)));
          log.append(g); continue;
        }
        const g = mk('div', 'ai-plangroup'), h = mk('div', 'ai-entry plannote'); if (it.n != null) h.dataset.n = String(it.n);
        h.append(mk('b', null, it.head)); if (it.reason) h.append(mk('div', 'ai-sub dim', it.reason));
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
    if (s !== lastStatus) { lastStatus = s; status.textContent = s; }
    const mt = ml.join('\n'); if (mt !== lastModels) { lastModels = mt; perModel.textContent = mt; }
    const p = pendingLine(ai.waiting(), ai.inFlight());
    if (p !== lastPending) { lastPending = p; pend.textContent = p; }
    const isOn = client.on() && client.hasKey();
    if (ai.version !== seen || isOn !== lastOn) { seen = ai.version; lastOn = isOn; renderLog(); }
  }
  function toggle() { shown = !shown; el.hidden = !shown; if (shown) { seen = -1; update(); } }
  el.hidden = true;
  return { toggle, visible: () => shown, update };
}
