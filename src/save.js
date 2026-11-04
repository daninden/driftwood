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
 * Since 0.10 a save may also carry `view: { yaw, tilt, zoom }`, the camera's turn,
 * tilt and zoom (radians, radians, zoom level), restored silently at start-up. It
 * is made safe on reading (core/view `clampView`: the turn wrapped into 0..2π,
 * tilt and zoom clamped to their limits; a zoom beyond 10 is kept up to 25 here
 * and clamped to 10 by the camera unless the dev panel is visible); a `view` that is not three numbers is
 * dropped, the rest of the save still loads (default view). Nothing else changes.
 * Since 0.11 a save may also carry `thirst: { days }` (number, days since he drank;
 * clamped to 0..2 by game/thirst; missing in older saves: not thirsty) and
 * `fire.burnt: [{ id, x, z, left, n }]` (the burnt places of game/fire; missing:
 * none). A wrong type makes the save unusable like any other broken field.
 * Since 0.15 a save may also carry `hunger: { days }` (days since he ate; clamped
 * to 0..4 by game/hunger; missing in older saves: not hungry).
 * Since 0.16 a save may also carry `branches: { taken: [[id, day]] }` (the branches taken
 * and when, for their regrowing) and `leantos: { list: [{ id, x, z, heading, progress }], nextId }`
 * (the lean-tos, finished or half built); the branches in piles are part of `wood.piles`
 * (kind 'branch', ids from game/branches BRANCH_ID0). Both optional: older saves have none.
 * Since 0.27.3 `branches` may also carry `grown: [[id, day]]` (regrown branches and the day they grew, for 3 days, so rain from
 * before they grew stays off them after a load).
 * Since 0.22 a save may also carry `crabs: { carried: [total], gone: [[crabId, back]], digs }` (the crabs he carries with the
 * moment each was caught, the caught crabs with the day they return to their colony, and the number of digs); optional, older saves have none.
 * Since 0.25 a save may also carry `shells: { full: [boolean], nuts }` (the half shells he keeps, at most 2, each full of water or not, and the
 * whole coconuts he carries, 0 to 2); optional, older saves have none (no shells, no nuts).
 * Since 0.26 a save may also carry `berries` and `bananas`, each `{ carried: [total], picked: [[plantId, total]] }` (the handfuls / the bunch he carries with the moment
 * each was picked, and the plants picked with the day, for their regrowing, game/forage); optional, older saves have none (nothing carried, nothing picked).
 * Since 0.27 a save may also carry `fronds: { taken: [[id, day]] }` (the fallen palm fronds taken, for their regrowing, game/fronds),
 * `stones: { taken: [id] }` (the stones taken, game/stones), `wood.stones: [id]` (the stones he carries, at most 2), piles of kind 'frond' or 'stone'
 * (ids from game/fronds FROND_ID0 and game/stones STONE_ID0), and for each lean-to an optional `up: { walls, bed, ring }` (progress 0..1 of the
 * upgrades, game/leanto); all optional, older saves have none.
 * Since 0.28 a save may also carry `known: { cell: 10, cells: [index] }`, the part of the island he has been to (game/known: cells of 10 m, index = row * 72 + column).
 * It is checked on reading (`cleanKnown`): the right cell size and a list of whole numbers within the island; anything else is dropped (the rest of the save
 * still loads) and the game then treats the ground round him as known. Older saves have none.
 * saveKey(seed) -> 'driftwood-save-<seed>'
 * serialise(state) -> string          state: game.state() (plus name, startDay); adds the format number `v`
 * parseSave(text, seed) -> state | null
 *   The state for createGame, or null for anything else: not JSON, another
 *   format number, another seed, or a shape the game parts cannot read.
 *   Never throws.
 * createViewSaver(settle?) -> { update(pose, dt) -> bool }   true once when the view
 *   (camera.pose) has changed and then stayed still for `settle` seconds (default
 *   VIEW_SETTLE, 1.5): the moment to save, so a save does not happen every frame
 *   while turning or zooming. The first pose it sees is the baseline.
 * momentKey(game) -> string           changes when something worth saving
 *   happens: wood laid down or taken from a pile, a lean-to started or finished, a fire lit or gone out, a
 *   torch stuck in the ground or taken up, falling asleep or waking up, a crab caught or eaten or gone bad, a shell kept, filled or drunk, a coconut picked up or eaten, berries or a banana bunch picked, eaten or gone bad
 * MOMENT_EVERY (0.5), createMomentWatcher(game, every?) -> { update(dt) -> bool }   true when momentKey changed since the last look; it only looks every `every` seconds (0.27.7), not every frame
 * parseHash(hash) -> { seed, fresh }  from `#seed-<n>` and/or `new`, joined
 *   with `&` (`#new`, `#seed-2024`, `#seed-2024&new`); seed defaults to 1337
 * withoutNew(hash) -> string          the hash with `new` removed
 * isResetKey(e) -> bool               Shift + backtick (not repeating, no Ctrl/Cmd/Alt)
 * createSaveStore(seed, getStorage?) -> { load(), save(state), clear() }
 *   getStorage returns a Storage (default: window.localStorage). load gives
 *   the parsed state or null; save and clear return true when they worked.
 *
 * Depends on: core/view (clampView), game/known (CELL, MAX_CELLS)
 */
import { clampView, ZOOM_DEV_MAX } from './core/view.js';
import { CELL, MAX_CELLS } from './game/known.js';

export const SAVE_VERSION = 1;
export const SAVE_EVERY = 10;
export const VIEW_SETTLE = 1.5;   // seconds of a still view before it is saved
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
  if (s.thirst !== undefined && !(obj(s.thirst) && num(s.thirst.days))) return false;
  if (s.hunger !== undefined && !(obj(s.hunger) && num(s.hunger.days))) return false;
  if (s.branches !== undefined && !(obj(s.branches) && optArr(s.branches, 'taken') && (!s.branches.taken || s.branches.taken.every(t => arr(t) && t.length === 2 && num(t[0]) && num(t[1]))) && optArr(s.branches, 'grown') && (!s.branches.grown || s.branches.grown.every(t => arr(t) && t.length === 2 && num(t[0]) && num(t[1]))))) return false;
  if (s.fronds !== undefined && !(obj(s.fronds) && optArr(s.fronds, 'taken') && (!s.fronds.taken || (s.fronds.taken.length <= 8192 && s.fronds.taken.every(t => arr(t) && t.length === 2 && num(t[0]) && num(t[1])))))) return false;
  if (s.stones !== undefined && !(obj(s.stones) && optArr(s.stones, 'taken') && (!s.stones.taken || (s.stones.taken.length <= 16384 && s.stones.taken.every(Number.isInteger))))) return false;
  if (w.stones !== undefined && !(arr(w.stones) && w.stones.length <= 2 && w.stones.every(Number.isInteger))) return false;
  if (s.leantos !== undefined && !(obj(s.leantos) && arr(s.leantos.list) && s.leantos.list.length <= 64 && s.leantos.list.every(l => obj(l) && [l.id, l.x, l.z, l.heading, l.progress].every(num) && (l.up === undefined || (obj(l.up) && Object.values(l.up).every(num)))) && (s.leantos.nextId === undefined || num(s.leantos.nextId)))) return false;
  if (s.crabs !== undefined && !(obj(s.crabs) && arr(s.crabs.carried) && s.crabs.carried.length <= 2 && s.crabs.carried.every(num) && arr(s.crabs.gone) && s.crabs.gone.length <= 4096 && s.crabs.gone.every(t => arr(t) && t.length === 2 && num(t[0]) && num(t[1])) && num(s.crabs.digs))) return false;
  if (s.shells !== undefined && !(obj(s.shells) && arr(s.shells.full) && s.shells.full.length <= 2 && s.shells.full.every(f => typeof f === 'boolean') && Number.isInteger(s.shells.nuts) && s.shells.nuts >= 0 && s.shells.nuts <= 2)) return false;
  for (const [key, max] of [['berries', 2], ['bananas', 1]]) {
    const q = s[key];
    if (q !== undefined && !(obj(q) && arr(q.carried) && q.carried.length <= max && q.carried.every(num) && arr(q.picked) && q.picked.length <= 8192 && q.picked.every(t => arr(t) && t.length === 2 && num(t[0]) && num(t[1])))) return false;
  }
  if (fi.burnt !== undefined && !(arr(fi.burnt) && fi.burnt.length <= 64 && fi.burnt.every(b => obj(b) && [b.id, b.x, b.z, b.left, b.n].every(num)))) return false;
  return !fi.torches || fi.torches.every(t => obj(t) && [t.id, t.x, t.z, t.left].every(num));
}

/** The saved memory of known ground made safe: { cell, cells } with whole, distinct cell numbers within the island, or null (dropped) for anything else. */
export function cleanKnown(k) {
  if (!obj(k) || k.cell !== CELL || !arr(k.cells) || k.cells.length > MAX_CELLS) return null;
  if (!k.cells.every(i => Number.isInteger(i) && i >= 0 && i < MAX_CELLS)) return null;
  return { cell: CELL, cells: [...new Set(k.cells)].sort((a, b) => a - b) };
}

export function parseSave(text, seed) {
  try {
    const s = JSON.parse(text);
    if (!valid(s, seed)) return null;
    // the camera clamps the zoom again to what the dev panel allows
    if (s.known !== undefined) { const k = cleanKnown(s.known); if (k) s.known = k; else delete s.known; }
    if (s.view !== undefined) { const v = clampView(s.view, ZOOM_DEV_MAX); if (v) s.view = v; else delete s.view; }
    return s;
  } catch (e) { return null; }
}

export function createViewSaver(settle = VIEW_SETTLE) {
  let key = null, still = 0, dirty = false;
  const keyOf = p => p ? [p.yaw.toFixed(3), p.tilt.toFixed(3), p.zoom.toFixed(2)].join() : '';
  return {
    update(pose, dt) {
      const k = keyOf(pose);
      if (key === null) { key = k; return false; }
      if (k !== key) { key = k; still = 0; dirty = true; return false; }
      if (!dirty) return false;
      still += dt;
      if (still < settle) return false;
      dirty = false; still = 0; return true;
    },
  };
}

export function momentKey(game) {
  const f = game.fire;
  return [game.wood.piles.length, game.wood.piles.reduce((n, p) => n + p.logs.length, 0), f.fires.length, f.torches.length, game.sleep.asleep ? 1 : 0, game.leantos.list.length, game.leantos.list.filter(l => l.progress >= 1).length, game.leantos.list.map(l => Object.keys(l.up || {}).filter(k => l.up[k] >= 1).length).join(''), game.crabs.carried.length, game.crabs.gone.size, game.shells.list.map(f => (f ? 1 : 0)).join(''), game.shells.nuts, game.berries.carried.length, game.berries.picked.size, game.bananas.carried.length, game.bananas.picked.size].join(',');
}

export const MOMENT_EVERY = 0.5;   // seconds between looks at momentKey
/** Watches momentKey: update(dt) is true when it changed since the last look; it only looks every `every` seconds (0.27.7: it was built every frame). */
export function createMomentWatcher(game, every = MOMENT_EVERY) {
  let key = momentKey(game), t = 0;
  return { update(dt) { t += dt; if (t < every) return false; t = 0; const k = momentKey(game); if (k === key) return false; key = k; return true; } };
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
