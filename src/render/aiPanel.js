/**
 * render/aiPanel — the AI panel (0.36 "Mind"; since 0.38.0 "Only him" for full AI play only): a developer panel, separate from the dev panel, to FOLLOW what the language model
 * does with Dave, and to change or remove the player's key. Toggled with the I key. DOM only: it reads the client's status (ai/client), game/actor's plan and the planner's
 * requests (ai/planner) and shows them; it decides nothing.
 *
 * Top, one line (`summaryLine`): "3.5-flash-lite 6/480 · not asking", any problem in red (an error, a model paused or not available, all budgets spent, Dave waiting), the
 * "copy log" and "download log" buttons and a small "⚙" that expands the settings: the key field (a password field: a new key is saved when the field changes; it is never shown
 * again), "remove key" (0.38.0: the game cannot go on without a key: `onKeyRemoved`, main reloads the page to the start screen), "list models", the models in order and the
 * address, a status line and one line per model. The expanded state is kept in localStorage (`driftwood.aiPanelOpen`, try/catch).
 * Under it: the "Now" line (the running step, or "waiting for a plan"), the collapsible "Memory" block (his notes and his lessons; `driftwood.aiMemoryOpen`), the current plan
 * with its thought and a marker at the running step (`actPlanLines`), and the planner's requests, newest first (`actEntryParts`); a click on one shows the full request and the
 * raw answer. "copy log" copies `playLogText` (the last request as the model saw it, then the requests of the last 2 game days); "download log" saves the whole logbook
 * (ai/logbook) as `driftwood-log-<seed>-day<N>.jsonl`.
 * Small, monospace, on a light box, scrollable; a pointer in the panel never reaches the view (isAiPanelEvent), and typing in the key field reaches no game key (game/input isTyping).
 *
 * Exports:
 *   isAiKey(e) -> bool            a plain I (no modifier, not repeating, not typed into a field). Pure.
 *   isAiPanelEvent(e) -> bool     the event came from inside the panel (#ai)
 *   memoryParts(notes, journal, lessons?) -> { head, notes, journal, lessons }   (pure) the Memory block
 *   statusLine(status, nowMs) -> string, modelLines(status, nowMs) -> [string], shortModel(name)   (pure) the status, one plain line per model, a model's short name
 *   summaryLine(status, { waiting, inFlight }, nowMs) -> { text, problem }   (pure) the one line of the collapsed panel and the problem text shown in red in it
 *   requestText(messages, raw) -> string   the full exchange of a request, for the expanded view
 *   actPlanLines(plan, index, recent), actEntryParts(entry)   (pure) the plan as marked lines; one request as { n, head, lines, ok }
 *   playLogText({ entries, model, days }) -> string   (pure) the "copy log" text
 *   saveTextFile(name, text, { doc?, url? })   gives a text to the browser as a file (a Blob and a link with `download`)
 *   createAiPanel(el, { client, play: { actor, planner }, now?, logbook?, onKeyRemoved? }) -> { toggle(), visible(), update() }   el: the #ai element (index.html); update() is called every frame and touches the DOM only when something changed; listens for I on window
 *
 * Depends on: game/actions (stepText), ai/actPrompt (WHY_ASKED), ai/prompt (hhmm), src/version
 */

import { stepText } from '../game/actions.js';
import { WHY_ASKED } from '../ai/actPrompt.js';
import { hhmm } from '../ai/prompt.js';
import { VERSION, NAME } from '../version.js';

export const isAiKey = e => !!e && e.code === 'KeyI' && !e.repeat && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey
  && !(e.target && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || '')));

export function isAiPanelEvent(e) {
  const path = e && e.composedPath && e.composedPath();
  if (Array.isArray(path) && path.some(n => n && n.id === 'ai')) return true;
  const t = e && e.target;
  return !!(t && (t.id === 'ai' || (t.closest && t.closest('#ai'))));
}

const clock = ms => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

export function memoryParts(notes, journal, lessons = null) {
  const n = Array.isArray(notes) ? notes.filter(x => typeof x === 'string' && x) : [];
  if (Array.isArray(lessons)) {   // 0.37.4 "Lessons": full AI play keeps lessons in place of the journal
    const l = lessons.filter(x => typeof x === 'string' && x);
    return { head: `Memory: ${n.length} note${n.length === 1 ? '' : 's'}, ${l.length} lesson${l.length === 1 ? '' : 's'}`, notes: n, journal: [], lessons: l };
  }
  const j = (Array.isArray(journal) ? journal : []).filter(x => x && typeof x.line === 'string' && x.line).sort((a, b) => b.day - a.day).map(x => ({ day: x.day, text: `Day ${x.day}: ${x.line}` }));
  return { head: `Memory: ${n.length} note${n.length === 1 ? '' : 's'}, ${j.length} journal line${j.length === 1 ? '' : 's'}`, notes: n, journal: j, lessons: null };
}
export function statusLine(s, nowMs = Date.now()) {
  const parts = [s.hasKey ? 'A key is saved' : 'No key'];
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

/** The ONE line of the collapsed panel (pure): { text, problem }. s: the client's status, o: { waiting, inFlight }. */
export function summaryLine(s, o = {}, nowMs = Date.now()) {
  const models = s.models || [], paused = m => !!m.pausedUntil && m.pausedUntil > nowMs;
  const free = models.find(m => !m.dead && !paused(m) && m.today < m.perDay);
  const pending = o.waiting ? 'Dave is waiting' : o.inFlight ? 'asking…' : 'not asking';
  const parts = [];
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

export function requestText(messages, raw) {
  const m = (messages || []).map(x => `[${x.role}]\n${x.content}`).join('\n\n');
  return (m || '(no request kept)') + '\n\n[answer]\n' + (raw == null ? '(none)' : raw);
}

/** 0.36.8: hands a text to the browser as a file: a Blob and a temporary link with `download`. DOM only. */
export function saveTextFile(name, text, { doc = document, url = URL } = {}) {
  const blob = new Blob([text], { type: 'application/x-ndjson' }), href = url.createObjectURL(blob), a = doc.createElement('a');
  a.href = href; a.download = name; a.style.display = 'none'; doc.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => { try { url.revokeObjectURL(href); } catch (e) { /* nothing to free */ } }, 10000);
}

/** 0.37.1 "Half hour": the current plan of full AI play as lines: [{ marker ('▶' running, '✓' done, '✗' failed, ' ' to come), state, text }] (pure). plan: game/actor `plan`, index: `stepIndex`, recent: `recent`. */
export function actPlanLines(plan, index, recent) {
  if (!plan) return [];
  const rec = (recent || []).slice(), done = [];
  for (let i = rec.length - 1; i >= 0 && rec[i].kind === 'step'; i--) done.unshift(rec[i]);   // the step records since the plan began (newest last)
  return plan.steps.map((st, i) => {
    const text = stepTextOf(st, plan.menu && plan.menu.places);
    const r = i < index ? done[done.length - (index - i)] : null;
    if (i < index) return { marker: r && r.outcome === 'failed' ? '✗' : '✓', state: r && r.outcome === 'failed' ? 'failed' : 'done', text: r && r.reason ? `${text} (${r.reason})` : text };
    if (i === index) return { marker: '▶', state: 'running', text };
    return { marker: ' ', state: 'next', text };
  });
}
/** 0.37.1: one request of the planner as plain lines for the log: { head, lines, n } (pure). */
export function actEntryParts(e) {
  const when = `Day ${e.day} ${hhmm(e.time)}`, why = WHY_ASKED[e.why] || e.why;
  const lines = [];
  if (e.ok) {
    if (e.say) lines.push(`"${e.say}"`);
    for (const st of e.steps || []) lines.push('· ' + stepTextOf(st, null));
    if (e.rejected) lines.push('not followed: ' + e.rejected);
  } else lines.push(e.error || 'failed');
  const meta = [e.model, Number.isFinite(e.ms) ? `${(e.ms / 1000).toFixed(1)} s` : null].filter(Boolean).join(' · ');
  if (meta) lines.push(meta);
  return { n: e.n, head: `${when}: ${why}`, lines, ok: !!e.ok && !e.rejected };
}
const stepTextOf = (st, places) => { try { return stepText(st, places); } catch (e) { return JSON.stringify(st); } };
/**
 * 0.37.8 "Firelight": the plain-text log of full AI play for the "copy log" button (pure; before, the button copied the old mind's log even with the AI on). `entries` are
 * the planner's requests (newest first), `days` how many game days back from the newest. The last request's own text comes first (what the model saw: the situation, what he
 * did lately, the notes, the lessons, the menu), then every request of those days, oldest first, with its plan, its thought and what was not followed. Never holds the key.
 */
export function playLogText({ entries = [], model = null, days = 2 } = {}) {
  const top = Math.max(-Infinity, ...entries.map(e => e.day).filter(Number.isFinite));
  const keep = entries.filter(e => !Number.isFinite(e.day) || top === -Infinity || e.day > top - days).slice().reverse();
  const out = [`Driftwood ${VERSION} "${NAME}" · AI log (full AI play), the last ${days} game days`, `Model: ${model || 'none yet'} · ${entries.length} requests since the page was loaded`];
  const last = entries.find(e => Array.isArray(e.messages) && e.messages.length > 1);
  if (last) out.push('', `The last request (day ${last.day} ${hhmm(last.time)}), as the model saw it`, String(last.messages[1].content || ''));
  out.push('', 'The requests, oldest first');
  for (const e of keep) { const pt = actEntryParts(e); out.push(pt.head); for (const t of pt.lines) out.push('  ' + t); }
  if (!keep.length) out.push('(none yet)');
  return out.join('\n');
}

export function createAiPanel(el, { client, play, now = () => Date.now(), logbook = null, onKeyRemoved = null } = {}) {
  let shown = false, seen = -1, lastStatus = '', lastModels = null;
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
  const top = mk('div', 'ai-top'), sum = mk('span', 'ai-sum'), sumText = mk('span', null), sumBad = mk('span', 'ai-bad'), gear = mk('button', 'ai-gear', '⚙'), copy = mk('button', 'ai-copy', 'copy log'), dl = mk('button', 'ai-copy ai-download', 'download log'); gear.type = 'button'; copy.type = 'button'; dl.type = 'button'; dl.hidden = !logbook; dl.title = 'download the whole logbook (events, snapshots, requests) as a .jsonl file'; copy.title = 'copy the last two game days of the log as text'; gear.setAttribute('aria-label', 'AI settings'); gear.title = 'settings';
  const settings = mk('div', 'ai-settings');
  const memBox = mk('div', 'ai-memory'), memHead = mk('button', 'ai-mem-head'), memBody = mk('div', 'ai-mem-body'); memHead.type = 'button'; memBox.append(memHead, memBody);
  const row = mk('div', 'ai-row');
  sum.append(sumText, ' ', sumBad); top.append(sum, copy, dl, gear);
  const copyBox = mk('div', 'ai-copybox'); copyBox.hidden = true;
  const key = mk('input', 'ai-key'); key.type = 'password'; key.autocomplete = 'off'; key.spellcheck = false; key.setAttribute('aria-label', 'API key');
  const clear = mk('button', null, 'remove key'); clear.type = 'button'; clear.title = 'remove the key: the game stops and asks for a key again';
  const list = mk('button', null, 'list models'); list.type = 'button';
  row.append(key, clear, list);
  const addr = mk('div', 'ai-dim', st.url), planBox = mk('div', 'ai-plan');
  const status = mk('div', 'ai-status'), perModel = mk('div', 'ai-models-status'), models = mk('div', 'ai-models'), log = mk('div', 'ai-log');
  models.hidden = true;
  settings.append(title, row, addr, status, perModel, models);
  el.append(nowEl, top, copyBox, settings, memBox, planBox, log);
  const showOpen = () => { settings.hidden = !expanded; gear.className = expanded ? 'ai-gear on' : 'ai-gear'; gear.setAttribute('aria-expanded', String(expanded)); };
  showOpen(); gear.addEventListener('click', () => { expanded = !expanded; saveOpen(expanded); showOpen(); });
  const renderMemory = () => {
    const pl = play.planner, m = memoryParts(pl.notes(), [], pl.lessons());
    memHead.textContent = `${memOpen ? '▾' : '▸'} ${m.head}`; memHead.setAttribute('aria-expanded', String(memOpen)); memBody.hidden = !memOpen; memBody.textContent = '';
    if (!memOpen) return;
    memBody.append(mk('div', 'ai-sub', 'His notes'));
    if (m.notes.length) m.notes.forEach((x, i) => memBody.append(mk('div', 'ai-note', `${i + 1}. ${x}`))); else memBody.append(mk('div', 'ai-dim', '(none yet)'));
    memBody.append(mk('div', 'ai-sub', 'His lessons'));
    if (m.lessons.length) m.lessons.forEach((x, i) => memBody.append(mk('div', 'ai-note', `${i + 1}. ${x}`))); else memBody.append(mk('div', 'ai-dim', '(none yet)'));
  };
  memHead.addEventListener('click', () => { memOpen = !memOpen; saveMem(memOpen); renderMemory(); });
  copy.addEventListener('click', async () => {
    const last = play.planner.entries().find(e => e.model);
    const text = playLogText({ entries: play.planner.entries(), model: last ? last.model : null });
    let ok = false; try { await navigator.clipboard.writeText(text); ok = true; } catch (e) { ok = false; }
    if (ok) { copyBox.hidden = true; copy.textContent = 'copied'; setTimeout(() => { copy.textContent = 'copy log'; }, 1500); return; }
    copyBox.textContent = '';   // no clipboard: the text in a box, selected, to copy by hand
    const ta = mk('textarea', 'ai-copytext'); ta.readOnly = true; ta.value = text; ta.rows = 8; const close = mk('button', null, 'close'); close.type = 'button'; close.addEventListener('click', () => { copyBox.hidden = true; });
    copyBox.append(ta, close); copyBox.hidden = false; ta.focus(); ta.select();
  });
  dl.addEventListener('click', () => {
    if (!logbook) return;
    try { saveTextFile(logbook.fileName(), logbook.text()); dl.textContent = 'downloaded'; } catch (e) { dl.textContent = 'failed'; }
    setTimeout(() => { dl.textContent = 'download log'; }, 1500);
  });
  const hint = () => { key.placeholder = client.hasKey() ? 'key saved (hidden): paste a new one to change it' : 'paste your Google AI Studio key'; };
  hint();
  key.addEventListener('change', () => { client.setKey(key.value); key.value = ''; hint(); lastStatus = ''; });
  clear.addEventListener('click', () => { client.clearKey(); key.value = ''; hint(); lastStatus = ''; if (onKeyRemoved) onKeyRemoved(); });
  list.addEventListener('click', () => {
    models.hidden = false; models.textContent = 'Asking...';
    client.listModels().then(ids => { models.textContent = ids.length ? 'Models: ' + ids.join(', ') : 'No models listed'; }, e => { models.textContent = 'Listing failed: ' + (e && e.message || e); });
  });
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'wheel']) el.addEventListener(type, e => e.stopPropagation(), { capture: true });
  log.addEventListener('click', e => {
    const r = e.target.closest && e.target.closest('[data-n]'); if (!r) return;
    const n = r.dataset.n; if (open.has(n)) open.delete(n); else open.add(n);
    seen = -1; update();
  });
  window.addEventListener('keydown', e => { if (isAiKey(e)) toggle(); });

  function renderLog() {   // the current plan, then each request (newest first; a click shows the full request)
    log.textContent = ''; planBox.textContent = '';
    const { actor, planner } = play, pl = actor.plan, ps = planner.status();
    planBox.append(mk('div', 'ai-plan-head', pl ? `Plan (${WHY_ASKED[pl.why] || pl.why}), about ${Math.round(pl.minutes)} min` : ps.state === 'thinking' ? 'Asking for a plan…' : ps.state === 'failed' ? 'No plan: ' + (ps.error || 'the AI does not answer') : 'No plan yet.'));
    if (pl && pl.say) planBox.append(mk('div', 'ai-reason', `"${pl.say}"`));
    for (const l of actPlanLines(pl, actor.stepIndex, actor.recent)) planBox.append(mk('div', `ai-step ${l.state}`, `${l.marker} ${l.text}`));
    const items = planner.entries();
    for (const e of items) {
      const p = actEntryParts(e), g = mk('div', p.ok ? 'ai-entry ai' : 'ai-entry note'); g.dataset.n = String(p.n);
      g.append(mk('div', 'ai-line', p.head));
      for (const t of p.lines) g.append(mk('div', 'ai-sub', t));
      if (open.has(String(p.n))) g.append(mk('pre', 'ai-full', requestText(e.messages, e.raw)));
      log.append(g);
    }
    if (!items.length) log.append(mk('div', 'ai-dim', 'No plans yet.'));
  }
  function update() {
    if (!shown) return;
    const cs = client.status(), s = statusLine(cs, now()), ml = modelLines(cs, now()), ac = play.actor, pl = ac.plan;
    const t = 'Now: ' + (ac.waiting || !pl ? 'waiting for a plan' : ac.stepIndex >= 0 ? stepTextOf(pl.steps[ac.stepIndex], pl.menu.places) : 'starting the plan');
    if (t !== lastNow) { lastNow = t; nowEl.textContent = t; }
    const sm = summaryLine(cs, { waiting: ac.waiting, inFlight: play.planner.status().state === 'thinking' }, now()), key2 = sm.text + '|' + sm.problem;
    if (key2 !== lastSummary) { lastSummary = key2; sumText.textContent = sm.text; sumBad.textContent = sm.problem; sum.classList.toggle('bad', !!sm.problem); }
    if (s !== lastStatus) { lastStatus = s; status.textContent = s; }
    const mt = ml.join('\n'); if (mt !== lastModels) { lastModels = mt; perModel.textContent = mt; }
    const memV = play.planner.memoryVersion; if (memV !== lastMem) { lastMem = memV; renderMemory(); }
    const ver = play.planner.version * 1000 + (ac.stepIndex + 1) + ac.stats.steps * 7 + ac.stats.plans * 13; if (ver !== seen) { seen = ver; renderLog(); }
  }
  function toggle() { shown = !shown; el.hidden = !shown; if (shown) { seen = -1; lastMem = -1; update(); } }
  el.hidden = true;
  return { toggle, visible: () => shown, update };
}
