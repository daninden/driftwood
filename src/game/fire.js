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
 *   - Each piece burns BURN days (wet wood half as long); a fire holds at
 *     most FUEL_MAX of fuel. When the wood is gone the fire sinks to embers
 *     for EMBERS days and goes out. Wood laid on a fire or on its embers,
 *     one piece at a time, keeps it going.
 *   - The flood puts out a fire it reaches (on the wet sand of low water).
 *   - Whether a fire catches is fixed by the seed and how many attempts
 *     there have been, so a game plays the same way twice.
 *
 * Pure data; no DOM, no Three.js.
 *
 * FIRE_MIN, DRILL_TIME, DRILL_COST, CATCH, TIRED_CATCH, BURN, FUEL_MAX, EMBERS
 * catchChance(dry, tired) -> 0..CATCH   dry: mean dryness 0..1, tired 0..1 (game/sleep)
 * createFire(world, saved?) -> fire
 *   fire.fires             [{ id, x, z, fuel, embers, lit, fed }]  fuel and embers in
 *                          days left; lit: the day it was lit; fed: pieces laid on
 *   fire.puffs             [{ x, z, at }]  the latest failed attempts (at: the day), for the renderer
 *   fire.attempts          how many attempts there have been
 *   fire.version           goes up with every change that shows (not with burning)
 *   fire.find(x, z, reach) -> { kind: 'fire', fire, x, z } | null   the nearest fire
 *   fire.attempt(x, z, logs, dry, tired, total) -> the new fire, or null when it did
 *     not catch (logs: the pile's pieces, dry: their mean dryness)
 *   fire.feed(f, dry) -> true when a piece of dryness dry went on fire f
 *   fire.update(days)      burns down by days of game time; embers go out
 *   fire.flood(sea) -> number of fires the sea put out
 *   fire.strength(f) -> 0..1 how big the flames are (0 for embers)
 *   fire.state() -> { fires, attempts, nextId }   plain, for saving
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
export const FUEL_MAX = 8 * BURN;
export const EMBERS = 1.5 / 24;               // embers glow on for an hour and a half
const FIRE_R = 0.5;                           // how far a fire reaches round its centre
const PUFFS = 4;

export const catchChance = (dry, tired = 0) => CATCH * Math.max(0, Math.min(1, dry)) ** 2 * (1 - (1 - TIRED_CATCH) * Math.max(0, Math.min(1, tired)));

export function createFire(w, saved) {
  const fire = { fires: [], puffs: [], attempts: 0, version: 0, find, attempt, feed, update, flood, strength, state };
  let nextId = 0;
  if (saved) {
    fire.fires = (saved.fires || []).map(f => ({ ...f }));
    fire.attempts = saved.attempts || 0;
    nextId = saved.nextId || fire.fires.reduce((m, f) => Math.max(m, f.id + 1), 0);
  }

  function find(x, z, reach) {
    let best = null, bd = reach;
    for (const f of fire.fires) {
      const d = Math.max(0, Math.hypot(x - f.x, z - f.z) - FIRE_R);
      if (d < bd) { bd = d; best = { kind: 'fire', fire: f, x: f.x, z: f.z }; }
    }
    return best;
  }
  function attempt(x, z, logs, dry, tired, total) {
    const r = mulberry32(hashInt(w.seed + 71, fire.attempts, 7)); r();
    fire.attempts++;
    if (r() >= catchChance(dry, tired)) {
      fire.puffs.push({ x, z, at: total }); if (fire.puffs.length > PUFFS) fire.puffs.shift();
      fire.version++; return null;
    }
    const f = { id: nextId++, x, z, fuel: Math.min(FUEL_MAX, logs.length * BURN), embers: EMBERS, lit: total, fed: logs.length };
    fire.fires.push(f); fire.version++; return f;
  }
  function feed(f, dry = 1) {
    if (!fire.fires.includes(f)) return false;
    f.fuel = Math.min(FUEL_MAX, f.fuel + BURN * (0.5 + 0.5 * dry)); f.embers = EMBERS; f.fed++;
    fire.version++; return true;
  }
  function update(days) {
    if (!(days > 0)) return;
    for (let i = fire.fires.length - 1; i >= 0; i--) {
      const f = fire.fires[i];
      if (f.fuel > 0) { const was = f.fuel; f.fuel = Math.max(0, f.fuel - days); if (was > 0 && f.fuel === 0) fire.version++; }
      else { f.embers -= days; if (f.embers <= 0) { fire.fires.splice(i, 1); fire.version++; } }
    }
  }
  function flood(sea) {
    let n = 0;
    for (let i = fire.fires.length - 1; i >= 0; i--) if (w.H(fire.fires[i].x, fire.fires[i].z) < sea) { fire.fires.splice(i, 1); n++; }
    if (n) fire.version++;
    return n;
  }
  function strength(f) { return f.fuel > 0 ? Math.min(1, 0.35 + f.fuel / (3 * BURN) * 0.65) : 0; }
  function state() { return { fires: fire.fires.map(f => ({ ...f })), attempts: fire.attempts, nextId }; }
  return fire;
}
