/**
 * game/actions — the actions of full AI play (0.37.0 "Actions"): what Dave can be told to do, one thing at a time, and how long each takes in game minutes.
 * Pure: no DOM, no WebGL, no random numbers, no network. The executor is game/actor; the chooser that writes the plans is a language model (0.37.1) or a fixed fake (the tests).
 *
 * A plan is a short list of steps. A step is one of:
 *   { go: id }                 walk to a place of the menu (game/actor lists them: what he knows, nearest first, `nearby` within NEARBY metres)
 *   { wander: dir, minutes }   walk out that way for some minutes, also over ground he does not know yet (dir one of DIRS; north is -z, east is +x)
 *   { do: kind }               one action of the action button where he stands (DO: the game's own kinds, game/game `actionsAt`)
 *   { use: kind }              one thing he carries, eaten or drunk (USE: game/game `use`, the inventory row)
 *   { wait: minutes }          he sits (or stands) where he is
 * The game does the walking and the work and reports back whether the step worked (game/actor). A plan fits in PLAN_MINUTES of game time (the estimates of its steps added
 * up); a plan of ONE step may be longer (a far walk, a long wander, a sleep). A sleep is always the last step: the plan ends when he wakes.
 *
 * Exports:
 *   PLAN_MINUTES (30), PLAN_STEPS (8), NEARBY (15 m), PER_KIND (3), WANDER_MAX (60), WAIT_MAX (60)
 *   DIRS                         the eight directions of a wander, and of the places' bearings
 *   DO, USE                      kind -> { what, secs }: the plain words of an action and its seconds of real time (null: it lasts until it ends by itself, the sleep)
 *   gameMinutes(secs) -> number  real seconds (a game day is DAY_SECONDS) as game minutes; realSecs(minutes) the other way round
 *   dirOf(dx, dz) -> one of DIRS
 *   stepMinutes(step, places) -> number | null   the estimate of one step (null: no estimate, unknown place or kind)
 *   stepText(step, places) -> string             a step in plain words, for logs and the panel
 *   checkPlan(plan, places) -> { ok, steps, minutes, reason }   plan: [step] or { steps: [step] }; ok false with a plain reason when it cannot be followed
 *
 * Depends on: game/clock, game/game (action times), game/shells, game/fire, game/leanto, game/crabs, game/spear, game/axe, game/fish
 */
import { DAY_SECONDS } from './clock.js';
import { DRINK_TIME, HUSK_TIME, PICK_TIME, STOOP } from './game.js';
import { FILL_TIME, SIP_TIME, EAT_TIME } from './shells.js';
import { DRILL_TIME } from './fire.js';
import { PIECE_TIME } from './leanto.js';
import { DIG_TIME, ROAST_TIME } from './crabs.js';
import { MAKE_TIME as SPEAR_TIME } from './spear.js';
import { MAKE_TIME as AXE_TIME, FELL_TIME } from './axe.js';
import { FISH_TIME } from './fish.js';

export const PLAN_MINUTES = 30;   // the user (2026-11-17): a plan covers at most half an hour of game time
export const PLAN_STEPS = 8;
export const NEARBY = 15;         // metres: a place this close is `nearby` (no real walk)
export const PER_KIND = 3;        // the nearest places of each kind on the menu (all the nearby ones too, up to NEARBY_MAX)
export const NEARBY_MAX = 5;
export const WANDER_MAX = 60, WAIT_MAX = 60;   // game minutes a wander or a wait may last

export const DIRS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];

/** The game's actions (game/game `actionsAt` kinds) in plain words, with their seconds of work (the walk to it is a `go` step of its own). */
export const DO = Object.freeze({
  pickup:    { what: 'pick up what lies here (a piece, or from a pile)', secs: PICK_TIME },
  lay:       { what: 'lay down what he carries (on a pile here, or a new pile)', secs: PICK_TIME },
  feed:      { what: 'put a piece of dry wood on the fire', secs: PICK_TIME },
  husk:      { what: 'husk the coconut here (eaten when hungry, else carried)', secs: HUSK_TIME },
  berries:   { what: 'pick berries (eaten when hungry, else carried)', secs: PICK_TIME },
  bananas:   { what: 'pick bananas (eaten when hungry, else carried)', secs: PICK_TIME },
  drink:     { what: 'drink at the river', secs: DRINK_TIME },
  fill:      { what: 'fill an empty shell at the river', secs: FILL_TIME },
  dig:       { what: 'dig for the crab in its hole', secs: DIG_TIME },
  roast:     { what: 'roast and eat a crab or fish at the fire', secs: ROAST_TIME },
  torch:     { what: 'take a burning torch', secs: STOOP },
  plant:     { what: 'stick the torch in the ground', secs: STOOP },
  light:     { what: 'light the pile beside him (fire drill, uses fibre)', secs: DRILL_TIME },
  sleep:     { what: 'lie down to sleep (until he wakes)', secs: null },
  buildHere: { what: 'start a lean-to here with the driftwood he carries', secs: PIECE_TIME },
  buildIn:   { what: 'build a piece he carries into the lean-to', secs: PIECE_TIME },
  upgrade:   { what: 'build a piece he carries into his home (walls, bed, ring, hut)', secs: PIECE_TIME },
  makeSpear: { what: 'make a spear (the branch he carries, a stone beside him)', secs: SPEAR_TIME },
  takeSpear: { what: 'take up the spear', secs: STOOP },
  laySpear:  { what: 'lay the spear down', secs: STOOP },
  fish:      { what: 'strike at a fish with the spear', secs: FISH_TIME },
  makeAxe:   { what: 'make an axe (the branch he carries, a stone beside him, a tuft of fibre)', secs: AXE_TIME },
  takeAxe:   { what: 'take up the axe', secs: STOOP },
  layAxe:    { what: 'lay the axe down', secs: STOOP },
  fell:      { what: 'fell the tree beside him (an hour of chopping)', secs: FELL_TIME },
});

/** What he carries, eaten or drunk anywhere (game/game `use`). */
export const USE = Object.freeze({
  nut:     { what: 'eat a carried coconut', secs: EAT_TIME },
  water:   { what: 'drink a full shell', secs: SIP_TIME },
  berries: { what: 'eat carried berries', secs: PICK_TIME },
  banana:  { what: 'eat a carried banana', secs: PICK_TIME },
  crab:    { what: 'roast and eat a carried crab or fish (beside a fire with flames)', secs: ROAST_TIME },
});

export const gameMinutes = secs => secs / DAY_SECONDS * 1440;
export const realSecs = minutes => minutes / 1440 * DAY_SECONDS;

/** The direction from a point to another (dx east, dz south): north is -z. */
export function dirOf(dx, dz) {
  const a = Math.atan2(dx, -dz);   // 0 north, PI/2 east
  return DIRS[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
}

const placeOf = (places, id) => (places || []).find(q => q.id === id) || null;
const whole = n => Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;

/** The kind of a step: 'go' | 'wander' | 'do' | 'use' | 'wait' | null. */
export function stepKind(s) {
  if (!s || typeof s !== 'object') return null;
  for (const k of ['go', 'wander', 'do', 'use', 'wait']) if (s[k] !== undefined) return k;
  return null;
}

export function stepMinutes(s, places) {
  const k = stepKind(s);
  if (k === 'go') { const q = placeOf(places, s.go); return q ? q.minutes : null; }
  if (k === 'wander') return Number.isFinite(s.minutes) ? s.minutes : null;
  if (k === 'wait') return Number.isFinite(s.wait) ? s.wait : null;
  if (k === 'do') { const d = DO[s.do]; return d ? (d.secs === null ? 0 : gameMinutes(d.secs)) : null; }
  if (k === 'use') { const d = USE[s.use]; return d ? gameMinutes(d.secs) : null; }
  return null;
}

export function stepText(s, places) {
  const k = stepKind(s);
  if (k === 'go') { const q = placeOf(places, s.go); return 'walk to ' + (q ? q.what : s.go); }
  if (k === 'wander') return `wander ${s.wander} for ${s.minutes} minutes`;
  if (k === 'wait') return `rest for ${s.wait} minutes`;
  if (k === 'do') return DO[s.do] ? DO[s.do].what : String(s.do);
  if (k === 'use') return USE[s.use] ? USE[s.use].what : String(s.use);
  return 'an unknown step';
}

/** Can the plan be followed? It checks the steps (known kinds and places, sensible minutes), the sleep last, and the time: at most PLAN_MINUTES unless it is one step alone.
 *  Whether an action is possible is not known beforehand (it depends on where he stands then): that is checked when the step starts (game/actor). */
export function checkPlan(plan, places) {
  const list = Array.isArray(plan) ? plan : plan && Array.isArray(plan.steps) ? plan.steps : null;
  if (!list || !list.length) return { ok: false, steps: [], minutes: 0, reason: 'the plan has no steps' };
  if (list.length > PLAN_STEPS) return { ok: false, steps: [], minutes: 0, reason: `the plan has ${list.length} steps, at most ${PLAN_STEPS}` };
  const steps = [];
  let minutes = 0;
  for (let i = 0; i < list.length; i++) {
    const s = list[i], k = stepKind(s), n = i + 1;
    if (!k) return { ok: false, steps: [], minutes: 0, reason: `step ${n} is not a step` };
    let step;
    if (k === 'go') { if (!placeOf(places, s.go)) return { ok: false, steps: [], minutes: 0, reason: `step ${n}: no place "${s.go}" on the menu` }; step = { go: s.go }; }
    else if (k === 'wander') {
      const m = whole(Number(s.minutes));
      if (!DIRS.includes(s.wander)) return { ok: false, steps: [], minutes: 0, reason: `step ${n}: "${s.wander}" is not a direction` };
      if (!m || m > WANDER_MAX) return { ok: false, steps: [], minutes: 0, reason: `step ${n}: a wander lasts 1 to ${WANDER_MAX} minutes` };
      step = { wander: s.wander, minutes: m };
    } else if (k === 'wait') {
      const m = whole(Number(s.wait));
      if (!m || m > WAIT_MAX) return { ok: false, steps: [], minutes: 0, reason: `step ${n}: a rest lasts 1 to ${WAIT_MAX} minutes` };
      step = { wait: m };
    } else if (k === 'do') { if (!DO[s.do]) return { ok: false, steps: [], minutes: 0, reason: `step ${n}: "${s.do}" is not an action` }; step = { do: s.do }; }
    else { if (!USE[s.use]) return { ok: false, steps: [], minutes: 0, reason: `step ${n}: "${s.use}" is not something to eat or drink` }; step = { use: s.use }; }
    if (step.do === 'sleep' && i < list.length - 1) return { ok: false, steps: [], minutes: 0, reason: 'sleep must be the last step' };
    if (typeof s.say === 'string' && s.say.trim()) step.say = s.say.trim();
    minutes += stepMinutes(step, places);
    steps.push(step);
  }
  minutes = Math.round(minutes * 10) / 10;
  if (steps.length > 1 && minutes > PLAN_MINUTES) return { ok: false, steps: [], minutes, reason: `the plan takes about ${Math.round(minutes)} minutes, at most ${PLAN_MINUTES} (a longer step must be a plan of its own)` };
  return { ok: true, steps, minutes, reason: null };
}
