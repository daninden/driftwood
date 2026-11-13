/**
 * ai/logbook — the logbook (0.36.8 "Logbook"): a long, plain record of what Dave really does and what the mind and the model said, for the player to download as a `.jsonl` file (one JSON object per line) and send for analysis. A developer feature (the "download log" button of the AI panel); it works with the AI off too, and it changes NOTHING in his behaviour: it only reads the mind's event stream, the game and the chooser's log, draws no random number and writes nothing back.
 * Pure: no DOM, no IndexedDB, no timers. The storage is handed in (`store`, ai/logStore, or nothing: then the log is kept in memory only), and main calls `flush()` about once a second and on pagehide; the entries are built and capped here (testable in Node).
 *
 * The lines (every line has `k` (its kind) and `n` (its number), except the header; entries of the game have `day` (the number the player sees: day 1 is the day the game started) and `t` ("HH:mm", game time)):
 *   header    first line, made when the file is downloaded: { k: 'header', format, version, name, seed, ai (on and has a key), model, models, leash, started (ISO, real time), downloaded, day, t, lines, dropped: { req, snap, other } (how many were dropped for the cap) }
 *   ev        what he really does: { k: 'ev', type, goal?, ... } the mind's own events (game/mind `onEvent`): 'goal' (started), 'goal-end' (outcome done / failed / stopped / dropped: why), 'walk' (to, dist), 'act' (kind: pick up, lay down, feed, light, build, dig, fish, use:nut ...), 'stuck', 'nopath', 'no-stand', the crab, fish, axe, home, hut, tide and journey events ... with his position x, z
 *   now       the "Now" changes (what mind.now() says): { k: 'now', text, goal, pastime, phase, detail, trouble }
 *   snap      every half game hour (and when the page is loaded): { k: 'snap', thirst, hunger, awake, asleep, x, z, fire, fires: [{ fuel (pieces), embers, fed }] near him, camp (the fire's state and the store), carries, tide, rain, doing, plan step }
 *   decision  every decision with a choice: { k: 'decision', point, menu: [ids], rules, ai, used, why, override, planned, plan, planId, step, to, reason, ms, model, req (the request that was asked for it) }; with the AI off the rules' choice only ({ why: 'off' })
 *   plan      a plan that landed: { k: 'plan', planId, note, raw (the model's raw answer), req }; plan-state: { k: 'plan-state', planId, trigger (why asked), reason, model, i, steps: [{ id, to, reason, state, note, at }] } each time a step's outcome changes
 *   sys       a FIXED system text, stored ONCE: { k: 'sys', id ('sys-' + hash of the text), text }
 *   req       a request to the model: { k: 'req', id, kind ('plan' | 'journal' | 'decision' | the system id), sys: id of its system text, user: [the other messages' content], model? } (never the key: any text holding it is scrubbed)
 *   answer    what came back: { k: 'answer', req, ok, ms, model, raw | error }
 *
 * The cap (default LOG_MAX_BYTES, about 20 MB): when the total of the lines is over it, the oldest `req` lines go first, then the oldest `snap` lines, then the oldest of the others (events, decisions, plans, answers, now); `sys` and the header never. How many were dropped is counted and said in the header.
 * Kept: in the store (IndexedDB) by `flush()`, in small batches; if the store fails the log goes on in memory. `open({ clear })` loads what the store holds (a log runs on across reloads) or clears it first (a new game).
 *
 * Exports:
 *   LOG_MAX_BYTES, SNAP_EVERY (1/48 day: half a game hour), FORMAT
 *   hashText(s) -> '8 hex digits'   (FNV-1a, for the id of a system text)
 *   dayLabel(time) -> 'HH:mm'       slotOf(total) -> int   the half-hour slot of the game time
 *   scrubSecrets(text, secrets) -> string   every secret (4 or more characters) replaced by '***'
 *   snapshotEntry(game, mind) -> object   the data of a snap line (read only; never calls the parts of the mind that look up places: no blockers, no strip scan)
 *   wrapChooser(chooser, { on, record }) -> chooser   the same chooser plus a record of the rules' own decisions while the AI is off (on() is false); keeps `selfChecked` and `allowPreempt`
 *   fileName(seed, day) -> 'driftwood-log-<seed>-day<N>.jsonl'
 *   createLogbook({ store?, version, name, seed, info?, secrets?, clock, now?, max? }) -> logbook
 *     clock() -> { day (the day the player sees), time (0..1), total (days on the game clock) }       info() -> { ai, model, models, leash }       secrets() -> [strings that must never appear]
 *     logbook.open({ clear }) -> Promise      loads (or clears) the store; never rejects     logbook.event(e)   a mind event     logbook.tick({ now, snapshot })   the "Now" changes and the half-hour snapshot (snapshot() is called only when one is due)
 *     logbook.decision(entry)   a chooser log entry (ai/chooser `log`)   logbook.rulesDecision(point, menu, chosen)   logbook.planState(plans)   plans of ai.plans()   logbook.request(messages, kind?) -> id   logbook.answer(id, result | error)
 *     logbook.flush() -> Promise   writes the new lines and removes the dropped ones to the store     logbook.clear() -> Promise     logbook.text() -> string   the whole file (header first)     logbook.fileName() / logbook.size() -> bytes / logbook.count() -> lines / logbook.dropped() -> { req, snap, other } / logbook.persistent() -> bool
 *
 * Depends on: ai/prompt (snapshotOf, nowText, describeOption: pure), game/intent (WAIT, choiceId: pure); the store is ai/logStore (handed in)
 */
import { snapshotOf, nowText, describeOption } from './prompt.js';
import { WAIT, choiceId } from '../game/intent.js';

export const LOG_MAX_BYTES = 20 * 1000 * 1000;
export const SNAP_EVERY = 1 / 48;
export const FORMAT = 1;

export function hashText(s) {
  let h = 0x811c9dc5; const t = String(s);
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
export const dayLabel = time => { const m = Math.floor((((+time || 0) % 1) + 1) % 1 * 1440 + 1e-6); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
export const slotOf = total => Math.floor((+total || 0) * 48 + 1e-9);
export const fileName = (seed, day) => `driftwood-log-${seed}-day${day == null ? 0 : day}.jsonl`;
export function scrubSecrets(text, secrets) {
  let t = String(text);
  for (const k of secrets || []) if (typeof k === 'string' && k.length >= 4 && t.includes(k)) t = t.split(k).join('***');
  return t;
}

const r2 = v => Math.round((+v || 0) * 100) / 100;
/** The data of a snapshot line, read only. It reads the same facts the request to the model does (ai/prompt snapshotOf) but not what looks up places (the blockers, the strip scan), and the fires near him with their fuel in pieces. */
export function snapshotEntry(game, mind) {
  const g = game || {}, m = mind || {};
  const safe = (f, d = null) => { try { const v = f(); return v === undefined ? d : v; } catch (e) { return d; } };
  const light = Object.create(m); light.blockers = undefined; light.stripWood = undefined;   // snapshotOf reads these only when they exist
  const s = safe(() => snapshotOf(g, light), {}) || {};
  const p = safe(() => g.player, null) || {};
  const near = safe(() => g.fire.fires.filter(f => Math.hypot(f.x - p.x, f.z - p.z) < 60).map(f => ({ fuel: r2(f.fuel), embers: r2(f.embers), fed: f.fed == null ? null : f.fed })), []);
  return {
    thirst: r2(s.thirst), hunger: r2(s.hunger), awake: r2(s.awake), asleep: !!safe(() => g.sleep.asleep, false),
    x: r2(p.x), z: r2(p.z), fromHome: s.fromHome == null ? null : r2(s.fromHome),
    fire: s.camp ? s.camp.fire : null, fires: near, torch: !!safe(() => g.fire.torch, false), camp: s.camp ? s.camp.store : null,
    carries: s.carries || null, home: s.home || null, tide: s.tide ? { name: s.tide.name, falling: s.tide.falling, level: r2(s.tide.level) } : null,
    rain: r2(safe(() => g.rain, 0)), raining: !!s.raining, daylight: r2(s.daylight), doing: s.doing || null, journey: !!s.journey,
  };
}

/** The same chooser, plus a record of the rules' own decisions at the goal and the pastime point while `on()` is false (the AI is off; with it on, ai/chooser logs the decision itself). Changes nothing: the answer is handed back as it is. */
export function wrapChooser(chooser, { on = () => false, record = () => {} } = {}) {
  const w = (point, menu, ctx) => {
    const c = chooser(point, menu, ctx);
    if ((point === 'goal' || point === 'pastime') && c !== WAIT && menu && menu.options && menu.options.length >= 2) { try { if (!on()) record(point, menu, c); } catch (e) { /* the log is not the game's business */ } }
    return c;
  };
  w.allowPreempt = chooser.allowPreempt; w.selfChecked = chooser.selfChecked;
  return w;
}

export function createLogbook({ store = null, version = '', name = '', seed = 0, info = () => ({}), secrets = () => [], clock = () => ({ day: 0, time: 0, total: 0 }), now = () => Date.now(), max = LOG_MAX_BYTES } = {}) {
  // lines: { n, k, line, bytes } in three tiers, oldest first (the cap drops from the front of req, then snap, then other)
  const tiers = { sys: [], req: [], snap: [], other: [] }, heads = { sys: 0, req: 0, snap: 0, other: 0 };   // 'sys' is never trimmed
  const dropped = { req: 0, snap: 0, other: 0 };
  let total = 0, count = 0, nextN = 1, pending = [], gone = [], meta = { seed, started: now() }, persistent = !!store, lastSlot = null, nowKey = null;
  const sysSeen = new Set(), reqOf = new WeakMap(), planSig = new Map();
  let metaDirty = true;

  const tierOf = k => (k === 'sys' ? 'sys' : k === 'req' ? 'req' : k === 'snap' ? 'snap' : 'other');
  const clk = () => { try { return clock() || {}; } catch (e) { return {}; } };
  const keep = e => { const t = tiers[tierOf(e.k)]; t.push(e); total += e.bytes; count++; };
  const trim = () => {
    for (const name of ['req', 'snap', 'other']) {
      const t = tiers[name];
      while (total > max && heads[name] < t.length) {
        const e = t[heads[name]]; t[heads[name]++] = null;
        total -= e.bytes; count--; dropped[name]++; gone.push(e.n); metaDirty = true;
      }
      if (heads[name] > 1024 && heads[name] * 2 > t.length) { tiers[name] = t.slice(heads[name]); heads[name] = 0; }
    }
  };
  function add(k, data, game = true) {
    const c = clk(), o = { k, n: nextN++ };
    if (game) { o.day = c.day == null ? null : c.day; o.t = dayLabel(c.time); }
    Object.assign(o, data);
    let line; try { line = scrubSecrets(JSON.stringify(o), safeSecrets()); } catch (e) { return null; }
    const e = { n: o.n, k, line, bytes: line.length + 1 }; if (k === 'sys') e.id = o.id;
    keep(e); pending.push(e); trim();
    return e;
  }
  const safeSecrets = () => { try { return secrets() || []; } catch (e) { return []; } };
  const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);

  const logbook = {
    async open({ clear = false } = {}) {
      if (!store) return;
      try {
        if (clear) { await store.clear(); await store.setMeta(meta); return; }
        const got = await store.load();
        if (got && got.meta && got.meta.seed !== seed) { await store.clear(); await store.setMeta(meta); return; }   // another island: a new game
        if (got && got.meta) meta = { ...meta, ...got.meta, seed };
        if (got && Array.isArray(got.entries)) {
          // what the store holds is older than what was added since this page began: put it first
          const mine = { sys: tiers.sys, req: tiers.req, snap: tiers.snap, other: tiers.other }, mineTotal = total, mineCount = count;
          for (const k of Object.keys(tiers)) { tiers[k] = []; heads[k] = 0; } total = 0; count = 0;
          let top = 0;
          for (const e of got.entries.sort((a, b) => a.n - b.n)) { keep(e); top = Math.max(top, e.n); if (e.k === 'sys' && e.id) sysSeen.add(e.id); }
          for (const name of Object.keys(tiers)) for (const e of mine[name]) { if (e) tiers[name].push(e); }
          total += mineTotal; count += mineCount; nextN = Math.max(nextN, top + 1);
          if (got.meta && got.meta.dropped) for (const k of Object.keys(dropped)) dropped[k] = +got.meta.dropped[k] || 0;
          trim();
        }
      } catch (e) { persistent = false; }
    },
    event(e) {
      if (!e || typeof e.type !== 'string') return;
      const { type, day, time, ...rest } = e;
      add('ev', { type, ...rest });
    },
    /** Called every frame: records a change of what he is doing and, every half game hour, a snapshot. `now` is mind.now(); snapshot() is called only when one is due. */
    tick({ now: n = null, snapshot = null } = {}) {
      if (n) {
        const key = [n.goal, n.pastime, n.kind, n.phase, n.trouble].join('|');
        if (key !== nowKey) { nowKey = key; let text = ''; try { text = nowText(n); } catch (e) { text = ''; } add('now', { text, goal: n.goal || null, pastime: n.pastime || null, phase: n.phase || null, detail: n.detail || '', trouble: n.trouble || '' }); }
      }
      const c = clk(), slot = slotOf(c.total);
      if (lastSlot === null || slot > lastSlot || slot < lastSlot - 1) {
        lastSlot = slot;
        let data = null; try { data = snapshot ? snapshot() : null; } catch (e) { data = null; }
        let cfg = {}; try { cfg = info() || {}; } catch (e) { cfg = {}; }
        add('snap', { ...(data || {}), ai: !!cfg.ai, leash: cfg.leash || null });
      }
    },
    decision(e) {
      if (!e || e.note) { if (e && e.planNote) logbook.plan(e); return; }
      const rq = e.messages ? reqOf.get(e.messages) : undefined;
      add('decision', { point: e.point, menu: e.menu, rules: e.rules, ai: e.ai, used: e.used, why: e.why, override: e.override, planned: e.planned, plan: e.plan, planId: e.planId, step: e.step, to: e.to, reason: e.reason, ms: num(e.ms), model: e.model, req: rq === undefined ? null : rq });
    },
    rulesDecision(point, menu, chosen) {
      add('decision', { point, menu: menu.options.map(o => o.id), options: menu.options.map(o => describeOption(o).label), rules: choiceId(chosen), ai: null, used: 'rules', why: 'off' });
    },
    plan(e) {
      const rq = e.messages ? reqOf.get(e.messages) : undefined;
      add('plan', { planId: e.planId, note: e.note, raw: e.raw === undefined ? null : e.raw, req: rq === undefined ? null : rq });
    },
    /** `plans` is ai.plans() (newest first): a plan-state line for a plan the first time and each time its steps' states or notes change. */
    planState(plans) {
      for (const p of (plans || []).slice(0, 3).reverse()) {
        const steps = p.steps.map(s => ({ id: s.id, to: s.toUsed || s.to || null, reason: s.reason || '', state: s.state, note: s.note || '', at: s.at || null }));
        const sig = JSON.stringify([steps.map(s => [s.state, s.note, s.at]), p.i]);
        if (planSig.get(p.id) === sig) continue;
        planSig.set(p.id, sig); if (planSig.size > 40) planSig.delete(planSig.keys().next().value);
        add('plan-state', { planId: p.id, trigger: p.trigger, reason: p.reason, model: p.model || null, i: p.i, late: !!p.late, steps });
      }
    },
    /** A request that is sent to the model: its FIXED system text is stored once (a `sys` line), the request keeps only the rest. Returns the request's id. */
    request(messages, kind = null) {
      const list = Array.isArray(messages) ? messages : [];
      const sys = list.filter(m => m && m.role === 'system').map(m => String(m.content)).join('\n\n');
      let sid = null;
      if (sys) { sid = 'sys-' + hashText(sys); if (!sysSeen.has(sid)) { sysSeen.add(sid); add('sys', { id: sid, text: sys }, false); } }
      const id = 'r' + nextN;   // the number of its own line: unique across reloads
      add('req', { id, kind: kind || sid, sys: sid, user: list.filter(m => m && m.role !== 'system').map(m => ({ role: m.role, content: String(m.content) })) });
      if (Array.isArray(messages)) reqOf.set(messages, id);
      return id;
    },
    answer(id, r) {
      if (r && typeof r.text === 'string') add('answer', { req: id, ok: true, ms: num(r.ms), model: r.model || null, raw: r.text });
      else add('answer', { req: id, ok: false, error: String(r && r.message || r || 'failed').slice(0, 300) });
    },
    async flush() {
      if (!store || !persistent) { pending = []; gone = []; return; }
      if (!pending.length && !gone.length && !metaDirty) return;
      const add_ = pending, del = gone; pending = []; gone = [];
      try { await store.write({ add: add_.map(e => ({ n: e.n, k: e.k, line: e.line, bytes: e.bytes, id: e.id })), remove: del, meta: { ...meta, seed, dropped: { ...dropped } } }); metaDirty = false; }
      catch (e) { persistent = false; }
    },
    async clear() {
      for (const k of Object.keys(tiers)) { tiers[k] = []; heads[k] = 0; dropped[k] = 0; }
      total = 0; count = 0; pending = []; gone = []; meta = { seed, started: now() }; metaDirty = true;
      if (store && persistent) { try { await store.clear(); await store.setMeta(meta); } catch (e) { persistent = false; } }
      sysSeen.clear(); planSig.clear(); nowKey = null; lastSlot = null;
    },
    header() {
      const c = clk(); let cfg = {}; try { cfg = info() || {}; } catch (e) { cfg = {}; }
      return { k: 'header', format: FORMAT, version, name, seed, ai: !!cfg.ai, model: cfg.model || null, models: cfg.models || [], leash: cfg.leash || null, started: new Date(meta.started).toISOString(), downloaded: new Date(now()).toISOString(), day: c.day == null ? null : c.day, t: dayLabel(c.time), lines: count, dropped: { ...dropped } };
    },
    text() {
      const all = []; for (const name of Object.keys(tiers)) for (let i = heads[name]; i < tiers[name].length; i++) { const e = tiers[name][i]; if (e) all.push(e); }
      all.sort((a, b) => a.n - b.n);
      return scrubSecrets(JSON.stringify(logbook.header()), safeSecrets()) + '\n' + all.map(e => e.line).join('\n') + (all.length ? '\n' : '');
    },
    fileName() { const c = clk(); return fileName(seed, c.day); },
    size: () => total, count: () => count, dropped: () => ({ ...dropped }), persistent: () => persistent,
  };
  return logbook;
}
