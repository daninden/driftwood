/**
 * game/dark — walking in the dark in full AI play (0.37.2 "Torch"): the one rule, as a pure helper that game/actor checks when a walk starts and ai/actPrompt tells the model.
 * Pure: no DOM, no WebGL, no random numbers. It reads only the plain data it is handed.
 *
 * The rule (agreed with the user 2026-11-17; 0.37.6 "Free hands" 2026-11-18): a walk (a `go` or a `wander` step) that has to be walked in the dark goes at full pace with light:
 *   (a) he holds a burning torch, or
 *   (b) both where he stands and the place he walks to lie in the light of a burning fire (FIRE_LIGHT, 14 m) or of a torch stuck in the ground (TORCH_LIGHT, 9 m);
 *   (c) a walk that starts in daylight and ends before dusk (its estimate in game minutes) is free.
 *   Without light a `go` (always to a place he knows, over ground he knows) is still allowed, at half pace (`slow`, DARK_PACE): he feels his way. A wander may go over ground he does not
 *   know, so without a torch it is refused in the dark.
 * "Dark" is the night of game/sleep (isNight: from DUSK to DAWN); a walk that starts by day but would end at or after DUSK counts as a walk in the dark. It is decided when the walk
 * starts: a torch that burns out on the way does not stop it.
 *
 * FIRE_LIGHT and TORCH_LIGHT are the ranges of the point lights of render/fire (LIGHT_RANGE 14, TORCH_RANGE 9); game cannot import render, so the numbers are repeated here.
 * Only a fire with flames lights the ground (embers do not): the caller passes those.
 *
 * Exports:
 *   FIRE_LIGHT (14), TORCH_LIGHT (9)                       metres
 *   isDark(time) -> bool                                   time: the fraction of the day (game/clock); the night
 *   hoursToDusk(time) -> hours | 0                         by day: hours until dusk; 0 in the dark
 *   hoursToDawn(time) -> hours | 0                         in the dark: hours until it gets light; 0 by day
 *   litAt(x, z, lights) -> bool                            lights: { fires: [{ x, z }] (with flames), torches: [{ x, z }] (in the ground) }
 *   DARK_PACE (0.5)                                        the share of his pace for a walk in the dark without light
 *   walkLight({ time, minutes, torch, from, to, lights }) -> { ok, reason, slow }
 *                                                           time now, minutes the walk's estimate (at full pace), torch: he holds a burning one, from: { x, z }, to: { x, z } | null (a wander), reason a plain sentence or null,
 *                                                           slow: true when the walk goes at DARK_PACE (its minutes double)
 *
 * Depends on: game/sleep (DUSK, DAWN, isNight)
 */
import { DUSK, DAWN, isNight } from './sleep.js';

export const FIRE_LIGHT = 14, TORCH_LIGHT = 9;
export const DARK_PACE = 0.5;   // 0.37.6 "Free hands": the user (2026-11-18): in the dark without light he walks over known ground at half pace

export const isDark = time => isNight(time);
export const hoursToDusk = time => (isNight(time) ? 0 : (DUSK - time) * 24);
export const hoursToDawn = time => (isNight(time) ? (((DAWN - time) % 1 + 1) % 1) * 24 : 0);

export function litAt(x, z, lights) {
  const l = lights || {};
  for (const f of l.fires || []) if (Math.hypot(x - f.x, z - f.z) <= FIRE_LIGHT) return true;
  for (const t of l.torches || []) if (Math.hypot(x - t.x, z - t.z) <= TORCH_LIGHT) return true;
  return false;
}

export function walkLight({ time, minutes, torch, from, to, lights }) {
  const dark = isDark(time);
  if (!dark && time + (Number.isFinite(minutes) ? minutes : 0) / 1440 < DUSK) return { ok: true, reason: null, slow: false };   // (c) it ends before dark
  if (torch) return { ok: true, reason: null, slow: false };                                                                       // (a)
  const when = dark ? 'it is dark' : 'it will be dark before the walk ends';
  if (!to) return { ok: false, reason: `${when} and he has no torch (a wander over ground he may not know needs one)`, slow: false };
  if (litAt(from.x, from.z, lights) && litAt(to.x, to.z, lights)) return { ok: true, reason: null, slow: false };                // (b)
  return { ok: true, reason: null, slow: true };                                                                                   // known ground, feeling his way
}
