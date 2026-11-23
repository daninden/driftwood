/**
 * ai/client — the connection to the language model (0.36 "Mind"): one POST in the OpenAI chat format, with a budget per model. The only module of the AI that talks to the network and to localStorage, and both are handed in
 * (`fetch`, `storage`, `now`), so it runs in tests without either.
 *
 * The player's key lives only under its own storage name (config KEY_NAME): never in the save, never logged, never in `status()`, never in an error text (every text that leaves the client has the key scrubbed out).
 *
 * Models: config AI_MODELS, in order of preference. Each has its own budget (at most its AI_BUDGET perMin requests in any 60 seconds, a sliding window in memory, and its perDay a day, a counter in storage per model name, reset when the
 * Pacific-time date changes, as Google's free quota does) and its own pause. A request goes to the first model that is not dead, not paused and within its budget. HTTP 429 pauses that model until Retry-After (else 60 s);
 * 404 (model not found) marks it dead for the rest of the session; either way the SAME request is retried once on the next available model; 0.37.1: so is every other error (a 5xx, a timeout, the network), except a refused key (401, 403). Every attempt that is sent counts for its model, whatever the answer.
 *
 * 0.44.4 "Switch": the player may choose a model (`setChoice`, kept under config CHOICE_NAME): it is asked first, the others in their order as backup; null is "auto" (the order of AI_MODELS).
 *   A 5xx ("high demand") or no answer in the timeout pauses that model for BUSY_PAUSE (2 minutes), as a 429 pauses it, so the next request goes to another model; `status()` says why
 *   each model is paused (`pauseWhy`: 'quota (429)', 'busy (503)', 'no answer') and the chosen one (`choice`).
 * 0.38.3 "Steady": the count of the day is kept in memory too (the daily budget holds when storage fails, within the session); listModels is bounded by the timeout; an error text is
 * scrubbed of the key its request was sent with as well (a key changed meanwhile); `blocked()` says why nothing can be sent.
 * 0.38.0 "Only him": the AI is no longer switched on or off and has no leash: it is the only way to play, so `on`, `setOn`, `mode` and `setMode` are gone.
 *
 * Exports:
 *   pacificDay(ms) -> 'YYYY-MM-DD'     the date in America/Los_Angeles
 *   forModel(model, messages) -> messages   what is sent to that model: unchanged for Gemini, the system message folded into the first user message for a 'gemma-' model (0.36.4)
 *   createClient({ fetch, storage, now?, url?, modelsUrl?, models?, timeout?, budget?, perMin?, perDay? })   (budget: { model: { perMin, perDay } }, default AI_BUDGET; perMin / perDay give every model the same budget) -> client
 *     client.hasKey() / setKey(s) / clearKey()
 *     client.choice() -> model | null, client.setChoice(model | null)   (0.44.4) the model asked first (null: auto)
 *     client.canSend() -> bool       the key is set, nothing is in flight and some model is available
 *     client.send(messages) -> Promise<{ text, ms, model }>   rejects with an Error (message scrubbed; .code 'nokey' | 'busy' | 'budget' | 'http' | 'timeout' | 'bad' | 'net')
 *     client.listModels(key?) -> Promise<string[]>    the model names the key can use (not counted in the budget); 0.38.0: with `key`, that key instead of the saved one (the start screen checks a key before it is saved; a refused key rejects with .status 400, 401 or 403)
 *     client.blocked() -> null | { kind: 'nokey' | 'dead' } | { kind: 'paused', secs } | { kind: 'spent', at: 'HH:MM' }   0.38.3: why nothing can be sent now (the "thinking…" line says so)
 *     client.status() -> { hasKey, models: [{ model, today, perDay, lastMinute, perMin, pausedUntil, pauseWhy, dead, lastError }], choice, today (all models), perDay (all), lastError, pausedUntil (0, or when the first model is back if none is available), inFlight, url }
 *
 * Depends on: ai/config
 */
import { AI_URL, AI_MODELS_URL, AI_MODELS, AI_BUDGET, AI_BUDGET_DEFAULT, AI_TIMEOUT, KEY_NAME, COUNT_NAME, CHOICE_NAME, BUSY_PAUSE } from './config.js';

const FMT = (() => { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }); } catch (e) { return null; } })();
export function pacificDay(ms) {
  const d = new Date(ms);
  if (FMT) return FMT.format(d);
  return new Date(ms - 8 * 3600 * 1000).toISOString().slice(0, 10);
}

/** 0.36.4: Gemma on the Gemini API may reject a system instruction: for a 'gemma-' model the system content goes to the start of the first user message (no other option is sent that Gemma might not support: no JSON mode, the chooser reads the JSON from the text). Gemini models get the messages as they are. */
export function forModel(model, messages) {
  if (!/^gemma-/.test(String(model)) || !Array.isArray(messages)) return messages;
  const sys = messages.filter(m => m && m.role === 'system').map(m => m.content).join('\n\n'), rest = messages.filter(m => !(m && m.role === 'system'));
  if (!sys) return rest;
  const i = rest.findIndex(m => m && m.role === 'user');
  if (i < 0) return [{ role: 'user', content: sys }, ...rest];
  return rest.map((m, k) => (k === i ? { ...m, content: sys + '\n\n' + m.content } : m));
}

const fail = (code, message) => { const e = new Error(message); e.code = code; return e; };

export function createClient({ fetch: doFetch, storage, now = () => Date.now(), url = AI_URL, modelsUrl = AI_MODELS_URL, models = AI_MODELS, timeout = AI_TIMEOUT, budget = AI_BUDGET, perMin = null, perDay = null } = {}) {
  const limits = m => ({ perMin: perMin ?? (budget[m] || AI_BUDGET_DEFAULT).perMin, perDay: perDay ?? (budget[m] || AI_BUDGET_DEFAULT).perDay });   // perMin / perDay: one budget for every model (tests)
  const get = k => { try { return storage ? storage.getItem(k) : null; } catch (e) { return null; } };
  const set = (k, v) => { try { if (storage) { if (v === null) storage.removeItem(k); else storage.setItem(k, v); } } catch (e) { /* storage may be blocked: then nothing is remembered */ } };
  let inFlight = false, lastError = null;
  let memKey = null;   // used when storage is not available
  const M = new Map(models.map(m => [m, { recent: [], pausedUntil: 0, pauseWhy: null, dead: false, lastError: null, mem: null }]));
  let memChoice = null;   // 0.44.4 "Switch": the chosen model when storage is not available
  const choice = () => { const c = get(CHOICE_NAME) || memChoice; return models.includes(c) ? c : null; };
  const order = () => { const c = choice(); return c ? [c, ...models.filter(m => m !== c)] : models; };   // the chosen model first, the others as backup

  const key = () => { const k = get(KEY_NAME); return k || memKey || ''; };
  const scrub = (s, used = null) => { let t = String(s == null ? '' : s); for (const k of [used, key()]) if (k) t = t.split(k).join('***'); return t.slice(0, 400); };   // 0.38.3: also the key the request was sent with (a key changed meanwhile)
  const counter = m => {   // 0.38.3 "Steady": the count of the day is also kept in memory, so the budget holds when storage fails (across reloads it needs storage)
    const today = pacificDay(now()), mem = M.get(m).mem;
    let n = mem && mem.day === today ? mem.n : 0;
    try { const c = JSON.parse(get(COUNT_NAME + '.' + m) || 'null'); if (c && c.day === today && Number.isFinite(c.n)) n = Math.max(n, c.n); } catch (e) { /* a bad counter starts over */ }
    return { day: today, n };
  };
  const windowCount = m => { const t = now(), st = M.get(m); st.recent = st.recent.filter(x => t - x < 60000); return st.recent.length; };
  const paused = m => now() < M.get(m).pausedUntil;
  const available = m => !M.get(m).dead && !paused(m) && counter(m).n < limits(m).perDay && windowCount(m) < limits(m).perMin;
  const next = skip => order().find(m => !skip.includes(m) && available(m)) || null;

  function canSend() { return !!key() && !inFlight && next([]) !== null; }

  async function attempt(model, messages) {
    const k = key(), t0 = now(), c = counter(model), st = M.get(model);
    st.mem = { day: c.day, n: c.n + 1 }; set(COUNT_NAME + '.' + model, JSON.stringify(st.mem)); st.recent.push(t0);
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    let timer = null, timedOut = false;
    try {
      const guard = new Promise((_, rej) => { timer = setTimeout(() => { timedOut = true; if (ctl) ctl.abort(); rej(fail('timeout', 'no answer in ' + Math.round(timeout / 1000) + ' s')); }, timeout); });
      const call = (async () => {
        const res = await doFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + k }, body: JSON.stringify({ model, messages: forModel(model, messages), temperature: 0.7 }), signal: ctl ? ctl.signal : undefined });
        if (!res.ok) {
          let body = ''; try { body = await res.text(); } catch (e) { /* no body */ }
          const err = fail('http', 'HTTP ' + res.status + (body ? ': ' + body.replace(/\s+/g, ' ').slice(0, 160) : ''));
          err.status = res.status;
          if (res.status === 429) { const ra = Number(res.headers && res.headers.get && res.headers.get('Retry-After')); st.pausedUntil = now() + (ra > 0 ? ra * 1000 : 60000); st.pauseWhy = 'quota (429)'; }
          else if (res.status === 404) st.dead = true;
          else if (res.status >= 500) { st.pausedUntil = now() + BUSY_PAUSE; st.pauseWhy = `busy (${res.status})`; }   // 0.44.4 "Switch": an overloaded model rests
          throw err;
        }
        let data; try { data = await res.json(); } catch (e) { throw fail('bad', 'the answer is not JSON'); }
        const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        if (typeof text !== 'string') throw fail('bad', 'no text in the answer');
        return { text, ms: now() - t0, model };
      })();
      call.catch(() => {});   // a call that loses the race to the timeout must not end as an unhandled rejection
      const out = await Promise.race([call, guard]);
      st.lastError = null;
      return out;
    } catch (e) {
      const err = fail(e && e.code || (timedOut ? 'timeout' : 'net'), scrub(model + ': ' + (e && e.message || e), k));
      if (timedOut) { st.pausedUntil = now() + BUSY_PAUSE; st.pauseWhy = 'no answer'; }   // 0.44.4 "Switch": a model that does not answer rests too
      err.status = e && e.status;
      st.lastError = err.message;
      throw err;
    } finally { clearTimeout(timer); }
  }

  async function send(messages) {
    if (!key()) throw fail('nokey', 'no key');
    if (inFlight) throw fail('busy', 'a request is already running');
    const first = next([]);
    if (!first) throw fail('budget', 'every model is spent or paused');
    inFlight = true;
    try {
      try { const out = await attempt(first, messages); lastError = null; return out; }
      catch (e) {
        lastError = e.message;
        if (e.status === 401 || e.status === 403) throw e;   // a key that is refused is refused by every model
        const second = next([first]);   // the same request, once, on the next model (0.37.1: after any error, also a 5xx, a timeout or the network; was only 429 and 404)
        if (!second) throw e;
        const out = await attempt(second, messages); lastError = null; return out;
      }
    } catch (e) { lastError = e.message; throw e; }
    finally { inFlight = false; }
  }

  async function listModels(given = null) {   // 0.38.0: with `given` a key that is not saved yet is checked (the start screen); its text is scrubbed from errors too
    const k = given ? String(given).trim() : key(); if (!k) throw fail('nokey', 'no key');
    const clean = t => scrub(t, k);
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    let timer = null;
    try {   // 0.38.3 "Steady": bounded like a request (a check that never answered kept the start screen waiting)
      const guard = new Promise((_, rej) => { timer = setTimeout(() => { if (ctl) ctl.abort(); rej(fail('timeout', 'no answer in ' + Math.round(timeout / 1000) + ' s')); }, timeout); });
      const call = (async () => {
        const res = await doFetch(modelsUrl, { method: 'GET', headers: { Authorization: 'Bearer ' + k }, signal: ctl ? ctl.signal : undefined });
        if (!res.ok) { const err = fail('http', 'HTTP ' + res.status); err.status = res.status; throw err; }
        const data = await res.json();
        const list = (data && (data.data || data.models)) || [];
        return list.map(m => String(m.id || m.name || '')).filter(Boolean).map(s => s.replace(/^models\//, ''));
      })();
      call.catch(() => {});
      return await Promise.race([call, guard]);
    } catch (e) { const err = fail(e && e.code || 'net', clean(e && e.message || e)); if (e && e.status) err.status = e.status; throw err; }
    finally { clearTimeout(timer); }
  }

  function status() {
    const rows = models.map(m => ({ model: m, today: counter(m).n, perDay: limits(m).perDay, lastMinute: windowCount(m), perMin: limits(m).perMin, pausedUntil: paused(m) ? M.get(m).pausedUntil : 0, pauseWhy: paused(m) ? M.get(m).pauseWhy : null, dead: M.get(m).dead, lastError: M.get(m).lastError }));
    const none = next([]) === null, waits = rows.filter(r => r.pausedUntil && !r.dead).map(r => r.pausedUntil);
    return { hasKey: !!key(), models: rows, today: rows.reduce((a, r) => a + r.today, 0), perDay: rows.reduce((a, r) => a + r.perDay, 0), lastError, pausedUntil: none && waits.length ? Math.min(...waits) : 0, inFlight, url, choice: choice() };
  }

  /** 0.38.3 "Steady": why no request can be sent now: null (one can, or one is running), { kind: 'nokey' }, { kind: 'dead' } (every model was not found), { kind: 'paused', secs }
   *  (a model is paused: the next one free in secs), { kind: 'spent', at: 'HH:MM' } (every model has used its day; the budgets start again at that local time). */
  function blocked() {
    if (!key()) return { kind: 'nokey' };
    if (inFlight || next([]) !== null) return null;
    const live = models.filter(m => !M.get(m).dead);
    if (!live.length) return { kind: 'dead' };
    const t = now(), soon = live.map(m => { const st = M.get(m); if (counter(m).n >= limits(m).perDay) return Infinity; const w = paused(m) ? st.pausedUntil : t; const r = windowCount(m) >= limits(m).perMin ? Math.min(...st.recent) + 60000 : t; return Math.max(w, r); });
    const first = Math.min(...soon);
    if (Number.isFinite(first)) return { kind: 'paused', secs: Math.max(1, Math.ceil((first - t) / 1000)) };
    const day = pacificDay(t); let at = t; while (pacificDay(at) === day && at - t < 2 * 86400000) at += 3600000; at -= 3600000; while (pacificDay(at) === day && at - t < 2 * 86400000) at += 60000;   // the next Pacific midnight, to the minute (by hours, then minutes)
    const d = new Date(at), pad = v => String(v).padStart(2, '0');
    return { kind: 'spent', at: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
  }

  return {
    blocked,
    hasKey: () => !!key(),
    setKey(s) { const v = String(s || '').trim(); if (v) { set(KEY_NAME, v); memKey = v; } },
    clearKey() { set(KEY_NAME, null); memKey = null; lastError = null; },
    choice,   // 0.44.4 "Switch": the chosen model, or null for auto
    setChoice(m) { const v = models.includes(m) ? m : null; set(CHOICE_NAME, v); memChoice = v; },
    canSend, send, listModels, status,   // blocked (0.38.3) above
  };
}
