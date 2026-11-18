/**
 * game/actions — the actions of full AI play (0.37.0 "Actions"): what Dave can be told to do, one thing at a time, and how long each takes in game minutes.
 * Pure: no DOM, no WebGL, no random numbers, no network. The executor is game/actor; the chooser that writes the plans is a language model (0.37.1) or a fixed fake (the tests).
 *
 * A plan is a short list of steps. A step is one of:
 *   { go: id }                 walk to a place of the menu (game/actor lists them: what he knows, nearest first, `nearby` within NEARBY metres)
 *   { wander: dir, minutes }   walk out that way for some minutes, also over ground he does not know yet (dir one of DIRS; north is -z, east is +x)
 *   { do: kind }               one action of the action button where he stands (DO: the game's own kinds, game/game `actionsAt`)
 *   { do: 'fish', minutes }    fishing for FISH_MIN to FISH_MAX minutes (0.37.2): he strikes again and again until he catches a fish or the minutes run out
 *   { use: kind }              one thing he carries, eaten or drunk (USE: game/game `use`, the inventory row)
 *   { wait: minutes }          he sits (or stands) where he is
 * The game does the walking and the work and reports back whether the step worked (game/actor). A plan fits in PLAN_MINUTES of game time (the estimates of its steps added
 * up); a plan of ONE step may be longer (a far walk, a long wander). Since 0.37.2 a sleep and a fishing are plans of their own: each must be the ONLY step of its plan (the sleep
 * lasts until he wakes, the fishing until a fish is caught or its minutes are up; its estimate is its minutes). Walking in the dark needs light (game/dark): checked by game/actor
 * when a step starts, not here.
 *
 * Exports:
 *   PLAN_MINUTES (60, 0.37.6; was 30), PLAN_STEPS (8), NEARBY (15 m), PER_KIND (3), WANDER_MAX (60), WAIT_MAX (60), FISH_MIN (5), FISH_MAX (60), PLAN_GRACE (80, 0.37.6; was 40)
 *   DIRS                         the eight directions of a wander, and of the places' bearings
 *   DO, USE                      kind -> { what, secs }: the plain words of an action and its seconds of real time (null: it lasts until it ends by itself, the sleep)
 *   gameMinutes(secs) -> number  real seconds (a game day is DAY_SECONDS) as game minutes; realSecs(minutes) the other way round
 *   dirOf(dx, dz) -> one of DIRS
 *   stepMinutes(step, places, from?) -> number | null   the estimate of one step (null: no estimate, unknown place or kind); 0.37.5: a `go` from `from` (the place of the go before it in the plan) is legMinutes(from, place)
 *   legMinutes(a, b), METRES_PER_MINUTE, LEG_DETOUR, LEG_SLACK   (0.37.5 "Ways") a walk between two places of a plan: the straight line x 1.3 at the walking pace with the menu's slack; about 1.9 m a game minute
 *   stepText(step, places) -> string             a step in plain words, for logs and the panel
 *   checkPlan(plan, places) -> { ok, steps, minutes, claimed, reason }   plan: [step] or { steps: [step], minutes? }; ok false with a plain reason when it cannot be followed (0.37.2: a sleep or a fishing not alone, fishing without 5 to 60 minutes)
 *     0.37.4 "Lessons": `minutes` is the chooser's own count of the plan (claimed). 0.37.8 "Firelight": PLAN_MINUTES is the size a plan is asked to have; a plan of several
 *     steps is refused only when the chooser's count or the game's is over PLAN_GRACE (so a walk and an hour of felling fit).
 *
 * Depends on: game/clock, game/movement (WALK_SPEED), game/game (action times), game/shells, game/fire, game/leanto, game/crabs, game/spear, game/axe, game/fish
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
import { WALK_SPEED } from './movement.js';

export const PLAN_MINUTES = 60;   // the user (2026-11-17): a plan covers at most half an hour of game time; 0.37.6 "Free hands" (the user, 2026-11-18): an hour
export const PLAN_STEPS = 8;
export const NEARBY = 15;         // metres: a place this close is `nearby` (no real walk)
export const PER_KIND = 3;        // the nearest places of each kind on the menu (all the nearby ones too, up to NEARBY_MAX)
export const NEARBY_MAX = 5;
export const WANDER_MAX = 60, WAIT_MAX = 60;   // game minutes a wander or a wait may last
export const FISH_MIN = 5, FISH_MAX = 60;       // game minutes a fishing may last (chosen by the model, 0.37.2)
export const LEG_DETOUR = 1.3, LEG_SLACK = 1.25;   // 0.37.5 "Ways": a walk from one place of the plan to the next: the straight line made a little longer for the way round, and the slack of the menu's walks
export const PLAN_GRACE = 80;     // 0.37.8 "Firelight": a plan of several steps is followed up to this, by the chooser's count or the game's (0.37.4 "Lessons": only the game's count, when the chooser counted PLAN_MINUTES or less) (the user, 2026-11-17: 40 for 30; 0.37.6: 80 for 60)

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
  sleep:     { what: 'lie down to sleep until he wakes (a plan of its own, the only step)', secs: null },
  buildHere: { what: 'start a lean-to here with the driftwood he carries', secs: PIECE_TIME },
  buildIn:   { what: 'build a piece he carries into the lean-to', secs: PIECE_TIME },
  upgrade:   { what: 'build a piece he carries into his home (walls, bed, ring, hut)', secs: PIECE_TIME },
  makeSpear: { what: 'make a spear (the branch he carries, a stone beside him)', secs: SPEAR_TIME },
  takeSpear: { what: 'take up the spear', secs: STOOP },
  laySpear:  { what: 'lay the spear down', secs: STOOP },
  fish:      { what: 'fish with the spear in shallow sea water, for the minutes you give, until he catches one (a plan of its own, the only step)', secs: FISH_TIME },
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
/** 0.37.5: game minutes of a walk from place a to place b of the same plan (both { x, z }): the menu's minutes count from where he stands, a later walk from the place before. */
export const legMinutes = (a, b) => Math.max(1, Math.ceil(gameMinutes(Math.hypot(b.x - a.x, b.z - a.z) * LEG_DETOUR / WALK_SPEED * LEG_SLACK)));
/** 0.37.5: about how many metres he walks in a game minute on open ground (for the request). */
export const METRES_PER_MINUTE = WALK_SPEED * (DAY_SECONDS / 1440) / LEG_SLACK;

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

export function stepMinutes(s, places, from = null) {
  const k = stepKind(s);
  if (k === 'go') { const q = placeOf(places, s.go); return !q ? null : from && Number.isFinite(q.x) && Number.isFinite(from.x) ? legMinutes(from, q) : q.minutes; }
  if (k === 'wander') return Number.isFinite(s.minutes) ? s.minutes : null;
  if (k === 'wait') return Number.isFinite(s.wait) ? s.wait : null;
  if (k === 'do') { const d = DO[s.do]; if (d && s.do === 'fish' && Number.isFinite(s.minutes)) return s.minutes; return d ? (d.secs === null ? 0 : gameMinutes(d.secs)) : null; }
  if (k === 'use') { const d = USE[s.use]; return d ? gameMinutes(d.secs) : null; }
  return null;
}

export function stepText(s, places) {
  const k = stepKind(s);
  if (k === 'go') { const q = placeOf(places, s.go); return 'walk to ' + (q ? q.what : s.go); }
  if (k === 'wander') return `wander ${s.wander} for ${s.minutes} minutes`;
  if (k === 'wait') return `rest for ${s.wait} minutes`;
  if (k === 'do') return s.do === 'fish' && Number.isFinite(s.minutes) ? `fish with the spear for up to ${s.minutes} minutes` : DO[s.do] ? DO[s.do].what : String(s.do);
  if (k === 'use') return USE[s.use] ? USE[s.use].what : String(s.use);
  return 'an unknown step';
}

/** Can the plan be followed? It checks the steps (known kinds and places, sensible minutes), the sleep and the fishing alone, and the time: at most PLAN_GRACE (0.37.8; PLAN_MINUTES before) unless it is one step alone.
 *  Whether an action is possible is not known beforehand (it depends on where he stands then): that is checked when the step starts (game/actor). */
export function checkPlan(plan, places) {
  const list = Array.isArray(plan) ? plan : plan && Array.isArray(plan.steps) ? plan.steps : null;
  if (!list || !list.length) return { ok: false, steps: [], minutes: 0, reason: 'the plan has no steps' };
  if (list.length > PLAN_STEPS) return { ok: false, steps: [], minutes: 0, reason: `the plan has ${list.length} steps, at most ${PLAN_STEPS}` };
  const steps = [];
  let minutes = 0, at = null;   // at (0.37.5): the place the last `go` led to (a later walk counts from there); null at the start and after a wander
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
    } else if (k === 'do') {
      if (!DO[s.do]) return { ok: false, steps: [], minutes: 0, reason: `step ${n}: "${s.do}" is not an action` };
      step = { do: s.do };
      if (s.do === 'fish') {
        const m = whole(Number(s.minutes));
        if (!m || m < FISH_MIN || m > FISH_MAX) return { ok: false, steps: [], minutes: 0, reason: `step ${n}: fishing lasts ${FISH_MIN} to ${FISH_MAX} minutes ("minutes")` };
        step.minutes = m;
      }
    } else { if (!USE[s.use]) return { ok: false, steps: [], minutes: 0, reason: `step ${n}: "${s.use}" is not something to eat or drink` }; step = { use: s.use }; }
    if (step.do === 'sleep' && list.length > 1) return { ok: false, steps: [], minutes: 0, reason: 'sleep must be the only step of its plan (he sleeps until he wakes; the next plan follows)' };
    if (step.do === 'fish' && list.length > 1) return { ok: false, steps: [], minutes: 0, reason: 'fishing must be the only step of its plan (walk to the water in a plan of its own first)' };
    if (typeof s.say === 'string' && s.say.trim()) step.say = s.say.trim();
    minutes += stepMinutes(step, places, at);
    if (step.go) at = placeOf(places, step.go); else if (step.wander) at = null;
    steps.push(step);
  }
  minutes = Math.round(minutes * 10) / 10;
  const raw = plan && !Array.isArray(plan) ? Number(plan.minutes) : NaN, claimed = Number.isFinite(raw) && raw >= 0 ? Math.round(raw) : null;   // 0.37.4: the chooser's own count
  if (steps.length > 1) {   // 0.37.8 "Firelight": the hour is the size of a plan, not its limit; refused only over PLAN_GRACE, by the chooser's count or the game's
    if (claimed !== null && claimed > PLAN_GRACE) return { ok: false, steps: [], minutes, claimed, reason: `you counted ${claimed} minutes, at most ${PLAN_GRACE} (a longer step must be a plan of its own)` };
    if (minutes > PLAN_GRACE) return { ok: false, steps: [], minutes, claimed, reason: `the game counts about ${Math.round(minutes)} minutes${claimed !== null ? ` (you counted ${claimed})` : ''}, at most ${PLAN_GRACE} (a longer step must be a plan of its own)` };
  }
  return { ok: true, steps, minutes, claimed, reason: null };
}
