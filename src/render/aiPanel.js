/**
 * render/aiPanel — the AI panel (0.36 "Mind"): a developer panel, separate from the dev panel, to switch the language-model chooser on, enter the player's own key and FOLLOW what it does. Toggled with the I key.
 * DOM only: it reads the client's status (ai/client) and the chooser's log (ai/chooser) and shows them; it decides nothing.
 *
 * Content, top to bottom: on/off, the key field (a password field: the key is saved to localStorage by the client when the field changes and the field is emptied; it is never shown again) and "clear key", "list models"
 * (the model names the key can use; the model itself is fixed in ai/config), the models in order of preference and the address as text, a status line (on, asking, last error) and one line per model (requests today and a minute, paused until, last error), the pending answer (id, reason, age),
 * and the running log of goal decisions, newest first: `d3 14:20  chose drink  (AI)  rules: eat  1.2s` or `(rules: no answer yet)`, with the AI's reason under it; a click on an entry shows the full request and the raw answer.
 * Small, monospace, semi-transparent, scrollable. It is out of the way of the game: a pointer in the panel never walks Dave or takes him back from his habit (isAiPanelEvent; main skips those events), and typing in the
 * key field reaches no game key (game/input isTyping).
 *
 * Exports:
 *   isAiKey(e) -> bool            a plain I (no modifier, not repeating, not typed into a field). Pure.
 *   isAiPanelEvent(e) -> bool     the event came from inside the panel (#ai)
 *   entryLine(e) -> string        the one-line text of a log entry
 *   statusLine(status, nowMs) -> string       on or off, all-paused, the last error
 *   modelLines(status, nowMs) -> [string]    one line per model: today/per day, a minute, paused, not found, last error
 *   pendingLine(pending, nowS) -> string
 *   requestText(messages, raw) -> string   the full exchange of an entry, for the expanded view
 *   createAiPanel(el, { client, ai, now? }) -> { toggle(), visible(), update() }   el: the #ai element (index.html); update() is called every frame and touches the DOM only when something changed; listens for I on window
 *
 * Depends on: nothing (main hands it the client of ai/client and the chooser of ai/chooser)
 */

export const isAiKey = e => !!e && e.code === 'KeyI' && !e.repeat && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey
  && !(e.target && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || '')));

export function isAiPanelEvent(e) {
  const path = e && e.composedPath && e.composedPath();
  if (Array.isArray(path) && path.some(n => n && n.id === 'ai')) return true;
  const t = e && e.target;
  return !!(t && (t.id === 'ai' || (t.closest && t.closest('#ai'))));
}

export function entryLine(e) {
  if (e.note) return `-- ${e.note}`;
  const when = `${e.day == null ? '?' : 'd' + e.day} ${e.time || '--:--'}`;
  const who = e.used === 'ai' ? 'AI' : `rules${e.why ? ': ' + e.why : ''}`;
  const ms = e.ms != null ? `  ${(e.ms / 1000).toFixed(1)}s` + (e.model ? ' ' + e.model : '') : '';
  const ai = e.used === 'rules' && e.ai ? `  ai: ${e.ai}` : '';
  return `${when}  chose ${e.used === 'ai' ? e.ai : e.rules}  (${who})  rules: ${e.rules}${ai}${ms}`;
}

export function statusLine(s, nowMs = Date.now()) {
  const parts = [s.on ? (s.hasKey ? 'on' : 'on, no key') : 'off'];
  if (s.inFlight) parts.push('asking...');
  if (s.pausedUntil && s.pausedUntil > nowMs) parts.push(`all models paused, next in ${Math.ceil((s.pausedUntil - nowMs) / 1000)} s`);
  if (s.lastError) parts.push('error: ' + s.lastError);
  return parts.join(' · ');
}

/** One line per model: today/per day, last minute, paused until, dead, last error. */
export function modelLines(s, nowMs = Date.now()) {
  return (s.models || []).map(m => {
    const parts = [`${m.model}  ${m.today}/${m.perDay} today  ${m.lastMinute}/${m.perMin} min`];
    if (m.dead) parts.push('not found');
    else if (m.pausedUntil && m.pausedUntil > nowMs) parts.push(`paused ${Math.ceil((m.pausedUntil - nowMs) / 1000)} s`);
    if (m.lastError) parts.push('error: ' + m.lastError);
    return parts.join(' · ');
  });
}

export function pendingLine(p, nowS) {
  if (!p) return 'pending answer: none';
  return `pending answer: ${p.id}  (${Math.max(0, Math.round(nowS - p.at))} s old)${p.reason ? '  "' + p.reason + '"' : ''}`;
}

export function requestText(messages, raw) {
  const m = (messages || []).map(x => `[${x.role}]\n${x.content}`).join('\n\n');
  return (m || '(no request kept)') + '\n\n[answer]\n' + (raw == null ? '(none)' : raw);
}

export function createAiPanel(el, { client, ai, now = () => Date.now() } = {}) {
  let shown = false, seen = -1, lastStatus = '', lastModels = null, lastPending = '';
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
  const status = mk('div', 'ai-status'), perModel = mk('div', 'ai-models-status'), pend = mk('div', 'ai-pending'), models = mk('div', 'ai-models'), log = mk('div', 'ai-log');
  models.hidden = true;
  el.append(title, row, addr, status, perModel, pend, models, log);

  const hint = () => { key.placeholder = client.hasKey() ? 'key saved (hidden)' : 'paste your Google AI Studio key'; };
  hint();
  on.addEventListener('change', () => { client.setOn(on.checked); lastStatus = ''; });
  key.addEventListener('change', () => { client.setKey(key.value); key.value = ''; hint(); lastStatus = ''; });
  clear.addEventListener('click', () => { client.clearKey(); key.value = ''; hint(); lastStatus = ''; });
  list.addEventListener('click', () => {
    models.hidden = false; models.textContent = 'asking...';
    client.listModels().then(ids => { models.textContent = ids.length ? 'models: ' + ids.join(', ') : 'no models listed'; }, e => { models.textContent = 'list failed: ' + (e && e.message || e); });
  });
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'wheel']) el.addEventListener(type, e => e.stopPropagation(), { capture: true });
  log.addEventListener('click', e => {
    const row = e.target.closest && e.target.closest('[data-n]'); if (!row) return;
    const n = row.dataset.n; if (open.has(n)) open.delete(n); else open.add(n);
    seen = -1; update();
  });
  window.addEventListener('keydown', e => { if (isAiKey(e)) toggle(); });

  function renderLog() {
    log.textContent = '';
    for (const e of ai.entries) {
      const item = mk('div', e.note ? 'ai-entry note' : 'ai-entry');
      if (!e.note) item.dataset.n = String(e.n);
      item.append(mk('div', 'ai-line', entryLine(e)));
      if (!e.note && e.used === 'ai' && e.reason) item.append(mk('div', 'ai-reason', '"' + e.reason + '"'));
      else if (!e.note && e.reason) item.append(mk('div', 'ai-reason dim', 'AI said ' + e.ai + ': "' + e.reason + '"'));
      if (!e.note && open.has(String(e.n))) item.append(mk('pre', 'ai-full', requestText(e.messages, e.raw)));
      log.append(item);
    }
    if (!ai.entries.length) log.append(mk('div', 'ai-dim', 'no decisions yet'));
  }
  function update() {
    if (!shown) return;
    const cs = client.status(), s = statusLine(cs, now()), ml = modelLines(cs, now());
    if (s !== lastStatus) { lastStatus = s; status.textContent = s; }
    const mt = ml.join('\n'); if (mt !== lastModels) { lastModels = mt; perModel.textContent = mt; }
    const p = pendingLine(ai.pending(), now() / 1000);
    if (p !== lastPending) { lastPending = p; pend.textContent = p; }
    if (ai.version !== seen) { seen = ai.version; renderLog(); }
  }
  function toggle() { shown = !shown; el.hidden = !shown; if (shown) { seen = -1; update(); } }
  el.hidden = true;
  return { toggle, visible: () => shown, update };
}
