/**
 * game/fire — making fire, and keeping it going.
 *
 * Rules
 *   - A fire is laid as a pile of at least FIRE_MIN pieces of driftwood
 *     (game/wood), on dry ground.
 *   - Lighting it takes a tuft of coconut fibre (game/fibre) and DRILL_TIME
 *     seconds of kneeling and twirling the staff as a fire drill (game/game).
 *     It is hard work: a whole attempt costs DRILL_COST days of rest
 *     (game/sleep). Stopping before the end keeps the fibre.
 *   - At the end the fibre is used up, and the fire catches or it does not.
 *     The chance is CATCH at best, falls steeply with wet wood (the mean
 *     dryness of the pile, game/wood `dryness`, squared) and with tiredness
 *     (down to TIRED_CATCH of it at the limit). Wet wood never catches. A
 *     failed attempt leaves only a puff of smoke.
 *   - Each piece burns BURN days (wet wood half as long); a branch (a log with
 *     `branch: true`, game/branches) burns BRANCH_BURN (half) as long as a piece of driftwood; a fire holds at
 *     most FUEL_MAX of fuel. When the wood is gone the fire sinks to embers
 *     for EMBERS days and goes out. Wood laid on a fire or on its embers,
 *     one piece at a time, keeps it going.
 *   - The flood puts out a fire it reaches (on the wet sand of low water).
 *   - A torch: a burning brand taken out of a fire that has flames, which
 *     costs the fire TORCH_COST of fuel. It burns TORCH_DAYS (two hours)
 *     and lights the way at night. It can be stuck in the ground, where it
 *     burns on, and taken up again. Wading deeper than DOUSE_DEPTH puts out a
 *     carried torch; the flood puts out one stuck in the sand.
 *   - A torch lights a pile of at least FIRE_MIN pieces without fibre or
 *     drilling: it always catches when the wood is dry enough (mean dryness
 *     at least TORCH_DRY), and the torch goes into the fire. Wetter wood only
 *     smokes, and the torch is kept.
 *   - When a fire goes out (its embers die) it leaves its burnt place: ash and
 *     charred ends, no light and no warmth, nothing that blocks. It stays
 *     BURNT_DAYS (two days) and fades slowly (render/fire). The flood washes it
 *     away sooner, as it puts fires out (and a fire put out by the flood leaves
 *     none); a new fire lit on it replaces it.
 *   - A full fire (FUEL_MAX) takes no more wood: `full(f)`.
 *   - A fire, or its embers, within WARM_R warms a sleeper (game/sleep).
 *   - Whether a fire catches is fixed by the seed and how many attempts
 *     there have been, so a game plays the same way twice.
 *
 * Pure data; no DOM, no Three.js.
 *
 * FIRE_MIN, DRILL_TIME, DRILL_COST, CATCH, TIRED_CATCH, BURN, FUEL_MAX, EMBERS,
 * BRANCH_BURN, fuelOf(logs) -> the fuel in days of a list of pieces (a branch counts BRANCH_BURN of a piece)
 * TORCH_DAYS, TORCH_COST, TORCH_DRY, DOUSE_DEPTH, WARM_R, BURNT_DAYS
 * full(f) -> true when fire f holds as much as it can (FUEL_MAX)
 * catchChance(dry, tired) -> 0..CATCH   dry: mean dryness 0..1, tired 0..1 (game/sleep)
 * createFire(world, saved?) -> fire
 *   fire.fires             [{ id, x, z, fuel, embers, lit, fed }]  fuel and embers in
 *                          days left; lit: the day it was lit; fed: pieces laid on
 *   fire.burnt             [{ id, x, z, left, n }]  burnt places: left: days to go (BURNT_DAYS
 *                          at first, then counting down), n: how many charred ends
 *   fire.puffs             [{ x, z, at }]  the latest failed attempts (at: the day), for the renderer
 *   fire.attempts          how many attempts there have been
 *   fire.version           goes up with every change that shows (not with burning)
 *   fire.torch             null, or { left } the torch carried (days left)
 *   fire.torches           [{ id, x, z, left }]  torches stuck in the ground
 *   fire.find(x, z, reach, only?) -> { kind: 'fire', fire, x, z, d } | { kind: 'torch', torch, x, z, d } | null
 *     the nearest fire or torch stuck in the ground (d: distance to its edge);
 *     only: 'fire' or 'torch' to look for that kind alone
 *   fire.takeTorch(f) -> true when a torch was taken out of fire f
 *   fire.plant(x, z) -> true when the torch carried was stuck in the ground there
 *   fire.pickTorch(t) -> true when torch t was taken up again (hands free of a torch)
 *   fire.douse() -> true when the torch carried went out (in the water)
 *   fire.warm(x, z) -> true when a fire or its embers are within WARM_R
 *   fire.attempt(x, z, logs, dry, tired, total) -> the new fire, or null when it did
 *     not catch (logs: the pile's pieces, dry: their mean dryness)
 *   fire.kindle(x, z, logs, dry, total) -> the new fire lit with the torch carried,
 *     or null (no torch, or the wood too wet: a puff of smoke)
 *   fire.feed(f, dry, burn?) -> true when a piece of dryness dry went on fire f (false: not a fire of ours, or it is full);
 *     burn: 1 for driftwood, BRANCH_BURN for a branch
 *   fire.update(days)      burns down by days of game time; embers and torches go out
 *   fire.flood(sea) -> number of fires (and torches in the sand) the sea put out
 *   fire.strength(f) -> 0..1 how big the flames are (0 for embers)
 *   fire.state() -> { fires, attempts, nextId, torch, torches, burnt }   plain, for saving
 *   saved: such a state, to start from
 *
 * Depends on: core/noise
 */
import { mulberry32, hashInt } from '../core/noise.js';

export const FIRE_MIN = 4;
export const DRILL_TIME = 14;                 // seconds of twirling
export const DRILL_COST = 0.08;               // days of rest a whole attempt costs
export const CATCH = 0.6, TIRED_CATCH = 0.5;  // the best chance, and how much of it is left worn out
export const BURN = 2.5 / 24;                 // a dry piece burns two and a half hours
export const BRANCH_BURN = 0.5;                // a branch burns half as long as a piece of driftwood
export const fuelOf = logs => logs.reduce((s, l) => s + (l.branch ? BRANCH_BURN : 1), 0) * BURN;
export const FUEL_MAX = 8 * BURN;
export const EMBERS = 1.5 / 24;               // embers glow on for an hour and a half
export const TORCH_DAYS = 2 / 24;             // a torch burns two hours
export const TORCH_COST = BURN / 2;           // and takes half a piece's worth out of the fire
export const TORCH_DRY = 0.75;                // a torch lights a pile this dry, always
export const DOUSE_DEPTH = 0.3;               // wading deeper puts a torch out
export const BURNT_DAYS = 2;                  // a burnt place stays this long
export const WARM_R = 3;                      // a fire this close warms a sleeper
const FIRE_R = 0.5;                           // how far a fire reaches round its centre
const TORCH_R = 0.2;
const PUFFS = 4;
const BURNT_MAX = 32;                         // at most this many burnt places are kept
const BURNT_R = 0.7;                          // a new fire this close to a burnt place replaces it

export const full = f => f.fuel >= FUEL_MAX - 1e-9;
export const catchChance = (dry, tired = 0) => CATCH * Math.max(0, Math.min(1, dry)) ** 2 * (1 - (1 - TIRED_CATCH) * Math.max(0, Math.min(1, tired)));

export function createFire(w, saved) {
  const fire = { fires: [], puffs: [], attempts: 0, version: 0, torch: null, torches: [], burnt: [], find, attempt, kindle, feed, takeTorch, plant, pickTorch, douse, warm, update, flood, strength, state };
  let nextId = 0;
  if (saved) {
    fire.fires = (saved.fires || []).map(f => ({ ...f }));
    fire.attempts = saved.attempts || 0;
    fire.torch = saved.torch ? { ...saved.torch } : null;
    fire.torches = (saved.torches || []).map(t => ({ ...t }));
    fire.burnt = (saved.burnt || []).slice(0, BURNT_MAX).map(b => ({ ...b }));
    nextId = saved.nextId || [...fire.fires, ...fire.torches, ...fire.burnt].reduce((m, f) => Math.max(m, f.id + 1), 0);
  }

  function find(x, z, reach, only) {
    let best = null, bd = reach;
    if (only !== 'torch') for (const f of fire.fires) {
      const d = Math.max(0, Math.hypot(x - f.x, z - f.z) - FIRE_R);
      if (d < bd) { bd = d; best = { kind: 'fire', fire: f, x: f.x, z: f.z, d }; }
    }
    if (only !== 'fire') for (const t of fire.torches) {
      const d = Math.max(0, Math.hypot(x - t.x, z - t.z) - TORCH_R);
      if (d < bd) { bd = d; best = { kind: 'torch', torch: t, x: t.x, z: t.z, d }; }
    }
    return best;
  }
  function takeTorch(f) {
    if (fire.torch || !fire.fires.includes(f) || f.fuel <= TORCH_COST) return false;
    f.fuel -= TORCH_COST; fire.torch = { left: TORCH_DAYS }; fire.version++; return true;
  }
  function plant(x, z) {
    if (!fire.torch) return false;
    fire.torches.push({ id: nextId++, x, z, left: fire.torch.left }); fire.torch = null; fire.version++; return true;
  }
  function pickTorch(t) {
    const i = fire.torches.indexOf(t); if (fire.torch || i < 0) return false;
    fire.torches.splice(i, 1); fire.torch = { left: t.left }; fire.version++; return true;
  }
  function douse() { if (!fire.torch) return false; fire.torch = null; fire.version++; return true; }
  function warm(x, z) { return fire.fires.some(f => Math.hypot(f.x - x, f.z - z) < WARM_R); }
  function attempt(x, z, logs, dry, tired, total) {
    const r = mulberry32(hashInt(w.seed + 71, fire.attempts, 7)); r();
    fire.attempts++;
    if (r() >= catchChance(dry, tired)) {
      fire.puffs.push({ x, z, at: total }); if (fire.puffs.length > PUFFS) fire.puffs.shift();
      fire.version++; return null;
    }
    const f = { id: nextId++, x, z, fuel: Math.min(FUEL_MAX, fuelOf(logs)), embers: EMBERS, lit: total, fed: logs.length };
    fire.fires.push(f); clearBurnt(x, z); fire.version++; return f;
  }
  function kindle(x, z, logs, dry, total) {
    if (!fire.torch) return null;
    if (dry < TORCH_DRY) { fire.puffs.push({ x, z, at: total }); if (fire.puffs.length > PUFFS) fire.puffs.shift(); fire.version++; return null; }
    const f = { id: nextId++, x, z, fuel: Math.min(FUEL_MAX, fuelOf(logs)), embers: EMBERS, lit: total, fed: logs.length };
    fire.fires.push(f); clearBurnt(x, z); fire.torch = null; fire.version++; return f;
  }
  function clearBurnt(x, z) { fire.burnt = fire.burnt.filter(b => Math.hypot(b.x - x, b.z - z) >= BURNT_R); }
  function feed(f, dry = 1, burn = 1) {
    if (!fire.fires.includes(f) || full(f)) return false;
    f.fuel = Math.min(FUEL_MAX, f.fuel + BURN * burn * (0.5 + 0.5 * dry)); f.embers = EMBERS; f.fed++;
    fire.version++; return true;
  }
  function update(days) {
    if (!(days > 0)) return;
    for (let i = fire.burnt.length - 1; i >= 0; i--) { const b = fire.burnt[i]; b.left -= days; if (b.left <= 0) { fire.burnt.splice(i, 1); fire.version++; } }
    for (let i = fire.fires.length - 1; i >= 0; i--) {
      const f = fire.fires[i];
      if (f.fuel > 0) { const was = f.fuel; f.fuel = Math.max(0, f.fuel - days); if (was > 0 && f.fuel === 0) fire.version++; }
      else { f.embers -= days; if (f.embers <= 0) { fire.fires.splice(i, 1); leaveBurnt(f); fire.version++; } }
    }
    if (fire.torch) { fire.torch.left -= days; if (fire.torch.left <= 0) { fire.torch = null; fire.version++; } }
    for (let i = fire.torches.length - 1; i >= 0; i--) { const t = fire.torches[i]; t.left -= days; if (t.left <= 0) { fire.torches.splice(i, 1); fire.version++; } }
  }
  function leaveBurnt(f) {
    fire.burnt.push({ id: f.id, x: f.x, z: f.z, left: BURNT_DAYS, n: Math.max(3, Math.min(6, f.fed)) });
    if (fire.burnt.length > BURNT_MAX) fire.burnt.shift();
  }
  function flood(sea) {
    let n = 0;
    for (const list of [fire.fires, fire.torches, fire.burnt]) for (let i = list.length - 1; i >= 0; i--) if (w.H(list[i].x, list[i].z) < sea) { list.splice(i, 1); n++; }
    if (n) fire.version++;
    return n;
  }
  function strength(f) { return f.fuel > 0 ? Math.min(1, 0.35 + f.fuel / (3 * BURN) * 0.65) : 0; }
  function state() { return { fires: fire.fires.map(f => ({ ...f })), attempts: fire.attempts, nextId, torch: fire.torch ? { ...fire.torch } : null, torches: fire.torches.map(t => ({ ...t })), burnt: fire.burnt.map(b => ({ ...b })) }; }
  return fire;
}
