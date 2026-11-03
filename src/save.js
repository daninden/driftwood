/**
 * save — keeping the game between visits: one automatic save per island in the
 * browser's localStorage (see docs/architecture.md, "Saving").
 *
 * Browser glue next to main, not part of game/ or world/ (it only reads
 * game.state() and hands a saved state back to createGame). The pure parts run
 * in Node and are tested; every storage access is wrapped in try/catch, so
 * blocked or full storage (private mode) just means nothing is saved.
 *
 * SAVE_VERSION (1), SAVE_EVERY (10 seconds of play between saves)
 * The format stays v: 1. Since 0.9 a save may also carry two optional fields
 * beside game.state(): `name` (string, at most 40 characters; '' is an answer:
 * "the castaway") and `startDay` (whole number, the clock's day on which the
 * game started, so that day is day 1). Saves from before 0.9 have neither: no
 * `name` means the name is asked once (game/castaway shouldAsk), no `startDay`
 * means 0. Optional fields need no migration and no new format number; a wrong
 * type makes the whole save unusable like any other broken field.
 * saveKey(seed) -> 'driftwood-save-<seed>'
 * serialise(state) -> string          state: game.state() (plus name, startDay); adds the format number `v`
 * parseSave(text, seed) -> state | null
 *   The state for createGame, or null for anything else: not JSON, another
 *   format number, another seed, or a shape the game parts cannot read.
 *   Never throws.
 * momentKey(game) -> string           changes when something worth saving
 *   happens: wood laid down or taken from a pile, a fire lit or gone out, a
 *   torch stuck in the ground or taken up, falling asleep or waking up
 * parseHash(hash) -> { seed, fresh }  from `#seed-<n>` and/or `new`, joined
 *   with `&` (`#new`, `#seed-2024`, `#seed-2024&new`); seed defaults to 1337
 * withoutNew(hash) -> string          the hash with `new` removed
 * isResetKey(e) -> bool               Shift + backtick (not repeating, no Ctrl/Cmd/Alt)
 * createSaveStore(seed, getStorage?) -> { load(), save(state), clear() }
 *   getStorage returns a Storage (default: window.localStorage). load gives
 *   the parsed state or null; save and clear return true when they worked.
 *
 * Depends on: nothing
 */
export const SAVE_VERSION = 1;
export const SAVE_EVERY = 10;
export const DEFAULT_SEED = 1337;

export const saveKey = seed => `driftwood-save-${seed}`;

export const serialise = state => JSON.stringify({ v: SAVE_VERSION, ...state });

const num = v => typeof v === 'number' && Number.isFinite(v);
const obj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const arr = v => Array.isArray(v);
const optArr = (o, k) => o[k] === undefined || arr(o[k]);

function valid(s, seed) {
  if (!obj(s) || s.v !== SAVE_VERSION || s.seed !== seed) return false;
  if (!num(s.time) || s.time < 0 || s.time >= 1 || !Number.isInteger(s.day) || s.day < 0) return false;
  const p = s.player; if (!obj(p) || !num(p.x) || !num(p.z) || !num(p.heading)) return false;
  const sl = s.sleep; if (!obj(sl) || !num(sl.awake) || typeof sl.asleep !== 'boolean' || !num(sl.left) || !num(sl.slept)) return false;
  if (s.name !== undefined && (typeof s.name !== 'string' || s.name.length > 40)) return false;
  if (s.startDay !== undefined && (!Number.isInteger(s.startDay) || s.startDay < 0)) return false;
  const w = s.wood; if (!obj(w) || !arr(w.carried) || !arr(w.piles) || !optArr(w, 'washed') || !optArr(w, 'lost')) return false;
  if (!w.carried.every(Number.isInteger) || !w.piles.every(q => obj(q) && num(q.x) && num(q.z) && arr(q.logs) && q.logs.every(Number.isInteger))) return false;
  if (w.washed && !w.washed.every(l => obj(l) && [l.id, l.x, l.y, l.z, l.len, l.a, l.rad].every(num) && (l.t === undefined || num(l.t)))) return false;
  const f = s.fibre; if (!obj(f) || !num(f.carried) || !optArr(f, 'taken') || (f.taken && !f.taken.every(t => arr(t) && t.length === 2 && num(t[0]) && num(t[1])))) return false;
  const fi = s.fire; if (!obj(fi) || !arr(fi.fires) || !optArr(fi, 'torches') || !num(fi.attempts)) return false;
  if (!fi.fires.every(q => obj(q) && [q.id, q.x, q.z, q.fuel, q.embers, q.lit, q.fed].every(num))) return false;
  if (fi.torch !== null && fi.torch !== undefined && !(obj(fi.torch) && num(fi.torch.left))) return false;
  return !fi.torches || fi.torches.every(t => obj(t) && [t.id, t.x, t.z, t.left].every(num));
}

export function parseSave(text, seed) {
  try {
    const s = JSON.parse(text);
    return valid(s, seed) ? s : null;
  } catch (e) { return null; }
}

export function momentKey(game) {
  const f = game.fire;
  return [game.wood.piles.length, game.wood.piles.reduce((n, p) => n + p.logs.length, 0), f.fires.length, f.torches.length, game.sleep.asleep ? 1 : 0].join(',');
}

export function parseHash(hash) {
  const parts = String(hash || '').replace(/^#/, '').split('&');
  const m = parts.map(p => p.match(/^seed-(\d+)$/)).find(Boolean);
  return { seed: m ? parseInt(m[1], 10) : DEFAULT_SEED, fresh: parts.includes('new') };
}

export const withoutNew = hash => {
  const rest = String(hash || '').replace(/^#/, '').split('&').filter(p => p !== 'new' && p !== '');
  return rest.length ? '#' + rest.join('&') : '';
};

export const isResetKey = e => e.code === 'Backquote' && !!e.shiftKey && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey;

export function createSaveStore(seed, getStorage = () => window.localStorage) {
  const key = saveKey(seed);
  return {
    load() { try { const t = getStorage().getItem(key); return t === null ? null : parseSave(t, seed); } catch (e) { return null; } },
    save(state) { try { getStorage().setItem(key, serialise(state)); return true; } catch (e) { return false; } },
    clear() { try { getStorage().removeItem(key); return true; } catch (e) { return false; } },
  };
}
