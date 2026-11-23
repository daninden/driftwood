/**
 * game/actions — the actions of full AI play (0.37.0 "Actions"): what Dave can be told to do, one thing at a time, and how long each takes in game minutes.
 * Pure: no DOM, no WebGL, no random numbers, no network. The executor is game/actor; the chooser that writes the plans is a language model (0.37.1) or a fixed fake (the tests).
 *
 * A plan is a short list of steps. A step is one of:
 *   { go: id }                 walk to a place of the menu (game/actor lists them: what he knows, nearest first, `nearby` within NEARBY metres)
 *   { take: id, count? }       (0.41.0 "Hands") walk to that loose piece or pile of the menu and pick up exactly that (from a pile at most count pieces, else as many as he has room for)
 *   { lay: kind, count?, at? } (0.41.0 "Hands") lay down count pieces of one kind he carries (LAY_KINDS; all of that kind without count): at a pile of that kind (on it), at another place of
 *                              the menu (a new pile beside it), or "here" (the default: on a pile of that kind beside him, or a new pile where he stands)
 *   { wander: dir, minutes }   walk out that way for some minutes, also over ground he does not know yet (dir one of DIRS; north is -z, east is +x)
 *   { do: kind }               one action of the action button where he stands (DO: the game's own kinds, game/game `actionsAt`)
 *   { do: 'fish', minutes }    fishing for FISH_MIN to FISH_MAX minutes (0.37.2): he strikes again and again until he catches a fish or the minutes run out
 *   { use: kind }              one thing he carries, eaten or drunk (USE: game/game `use`, the inventory row)
 *   { wait: minutes }          he sits (or stands) where he is
 * 0.41.0 "Hands": "pickup" and "lay" are no `do` actions any more (a "go" then "pickup" took whatever lay nearest, a "lay" laid everything down at his feet): `take` and `lay` name the thing and the place.
 * The game does the walking and the work and reports back whether the step worked (game/actor). A plan fits in PLAN_MINUTES of game time (the estimates of its steps added
 * up); a plan of ONE step may be longer (a far walk, a long wander). Since 0.37.2 a sleep and a fishing are plans of their own: each must be the ONLY step of its plan (the sleep
 * lasts until he wakes, the fishing until a fish is caught or its minutes are up; its estimate is its minutes). Walking in the dark needs light (game/dark): checked by game/actor
 * when a step starts, not here.
 *
 * Exports:
 *   PLAN_MINUTES (60, 0.37.6; was 30), PLAN_STEPS (12, 0.40.2; was 8), NEARBY (15 m), PER_KIND (3), WANDER_MAX (60), WAIT_MAX (60), FISH_MIN (5), FISH_MAX (60), PLAN_GRACE (80, 0.37.6; was 40)
 *   DIRS                         the eight directions of a wander, and of the places' bearings
 *   DO, USE                      kind -> { what, secs }: the plain words of an action and its seconds of real time (null: it lasts until it ends by itself, the sleep)
 *   TAKE_KINDS, LAY_KINDS, layKind(word) -> kind | null   (0.41.0) the kinds of place a `take` may name, the kinds a `lay` lays ('branches' etc. read as 'branch'); LAY_SECS, the seconds of a take or a lay
 *   gameMinutes(secs) -> number  real seconds (a game day is DAY_SECONDS) as game minutes; realSecs(minutes) the other way round
 *   dirOf(dx, dz) -> one of DIRS
 *   stepMinutes(step, places, from?) -> number | null   the estimate of one step (null: no estimate, unknown place or kind); 0.37.5: a `go` from `from` (the place of the go before it in the plan) is legMinutes(from, place)
 *   legMinutes(a, b), METRES_PER_MINUTE, LEG_DETOUR, LEG_SLACK   (0.37.5 "Ways") a walk between two places of a plan: the straight line x 1.3 at the walking pace with the menu's slack; about 1.9 m a game minute
 *   stepText(step, places) -> string             a step in plain words, for logs and the panel (0.40.5: an unknown step shows what was written)
 *   shortStep(step), notAStep(step, n)           (0.40.5 "Form") a step as written, short; the reason a step is not a step: what was written, the five forms, the right form when its key is an action ({"sleep": true}: write {"do": "sleep"})
 *   checkPlan(plan, places) -> { ok, steps, minutes, claimed, reason }   plan: [step] or { steps: [step], minutes? }; ok false with a plain reason when it cannot be followed (0.37.2: a sleep or a fishing not alone, fishing without 5 to 60 minutes)
 *     0.40.5 "Form": a refused sleep says to answer with {"do": "sleep"} alone.
 *     0.41.0 "Hands": a `take` names a loose piece or a pile on the menu (count 1 to PILE_MAX, for a pile), a `lay` a kind of LAY_KINDS (count 1 to CARRY_MAX) and "here" or a place on the menu;
 *     {"do": "pickup"} and {"do": "lay"} are refused with the right form.
 *     0.44.2 "One step": a `go` straight before a `take` of that place or a `lay` "at" it is dropped (the take or lay walks there itself).
 *     0.37.4 "Lessons": `minutes` is the chooser's own count of the plan (claimed). 0.37.8 "Firelight": PLAN_MINUTES is the size a plan is asked to have; a plan of several
 *     steps is refused only when the chooser's count or the game's is over PLAN_GRACE (so a walk and an hour of felling fit). 0.43.1 "Loose": not refused at all any more (the size is only asked for).
 *
 * WAIT (0.38.0)          the chooser's "not yet"
 *
 * Depends on: game/clock, game/movement (WALK_SPEED), game/wood (CARRY_MAX, PILE_MAX), game/game (action times), game/shells, game/fire, game/leanto, game/crabs, game/spear, game/axe, game/fish
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
import { CARRY_MAX, PILE_MAX } from './wood.js';

/** The answer "not yet" of a chooser (game/actor): no plan is ready, he waits and the chooser is asked again on the next step (0.38.0: was in game/intent, which is gone). */
export const WAIT = Object.freeze({ wait: true });
export const PLAN_MINUTES = 60;   // the user (2026-11-17): a plan covers at most half an hour of game time; 0.37.6 "Free hands" (the user, 2026-11-18): an hour
export const PLAN_STEPS = 12;   // 0.40.2 "Armful" (the user, 2026-11-19): was 8; three loose pieces fetched and built in take 10 steps. 0.43.1 "Loose": only asked for, never refused
export const NEARBY = 15;         // metres: a place this close is `nearby` (no real walk)
export const PER_KIND = 3;        // the nearest places of each kind on the menu (all the nearby ones too, up to NEARBY_MAX)
export const NEARBY_MAX = 5;
export const WANDER_MAX = 60, WAIT_MAX = 60;   // game minutes a wander or a wait may last
export const FISH_MIN = 5, FISH_MAX = 60;       // game minutes a fishing may last (chosen by the model, 0.37.2)
export const LEG_DETOUR = 1.3, LEG_SLACK = 1.25;   // 0.37.5 "Ways": a walk from one place of the plan to the next: the straight line made a little longer for the way round, and the slack of the menu's walks
export const PLAN_GRACE = 80;     // 0.37.8 "Firelight": a plan of several steps is followed up to this, by the chooser's count or the game's (0.37.4 "Lessons": only the game's count, when the chooser counted PLAN_MINUTES or less) (the user, 2026-11-17: 40 for 30; 0.37.6: 80 for 60)   // 0.43.1 "Loose" (the user, 2026-11-20): only asked for in the request, a longer plan is followed

export const DIRS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];

/** The game's actions (game/game `actionsAt` kinds) in plain words, with their seconds of work (the walk to it is a `go` step of its own). */
export const DO = Object.freeze({
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
  buildHere: { what: 'start a new home here with a stone he carries: its stone ring comes first, the lean-to behind it later', secs: PIECE_TIME },
  buildIn:   { what: 'build the pieces he carries into the part of his home being built (the menu says what his home still needs), one after another, as long as the next one he carries is the one it needs (the minutes are for each piece); firewood is not built in: it is laid down in the ring', secs: PIECE_TIME },   // 0.43.2: no ring in the words (the model built its firewood into the lean-to, "straight into the ring")
  upgrade:   { what: 'build the pieces he carries into his finished lean-to (walls, bed, hut), one after another, as long as the next one he carries is one it needs (the minutes are for each piece; a part of the hut takes three times as long, about 15 min)', secs: PIECE_TIME },
  makeSpear: { what: 'make a spear (the branch he carries, a stone beside him)', secs: SPEAR_TIME },
  takeSpear: { what: 'take up the spear', secs: STOOP },
  laySpear:  { what: 'lay the spear down', secs: STOOP },
  fish:      { what: 'fish with the spear in shallow sea water, for the minutes you give, until he catches one (a plan of its own, the only step)', secs: FISH_TIME },
  makeAxe:   { what: 'make an axe (the branch he carries, a stone beside him, a tuft of fibre)', secs: AXE_TIME },
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

/** 0.41.0 "Hands": what a `take` may name (a loose piece or a pile of the menu) and what a `lay` lays down (a kind he carries). */
export const TAKE_KINDS = Object.freeze(['driftwood', 'branch', 'frond', 'stone', 'log', 'pile']);
export const LAY_KINDS = Object.freeze(['driftwood', 'branch', 'frond', 'stone', 'log']);
export const LAY_SECS = PICK_TIME;
const KIND_WORDS = { driftwood: 'driftwood', branch: 'branch', branches: 'branch', frond: 'frond', fronds: 'frond', stone: 'stone', stones: 'stone', log: 'log', logs: 'log' };
export const layKind = w => (typeof w === 'string' && KIND_WORDS[w.trim().toLowerCase()]) || null;
const KIND_PLURAL = { driftwood: 'pieces of driftwood', branch: 'branches', frond: 'fronds', stone: 'stones', log: 'logs' };
const KIND_ONE = { driftwood: 'a piece of driftwood', branch: 'a branch', frond: 'a frond', stone: 'a stone', log: 'the log' };
const layWhat = s => (Number.isFinite(s.count) ? (s.count === 1 ? KIND_ONE[s.lay] : `${s.count} ${KIND_PLURAL[s.lay]}`) : s.lay === 'log' ? 'the log' : `all his ${s.lay === 'driftwood' ? 'driftwood' : KIND_PLURAL[s.lay]}`);

const placeOf = (places, id) => (places || []).find(q => q.id === id) || null;
const whole = n => Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;

/** The kind of a step: 'go' | 'take' | 'lay' | 'wander' | 'do' | 'use' | 'wait' | null. */
export function stepKind(s) {
  if (!s || typeof s !== 'object') return null;
  for (const k of ['go', 'take', 'lay', 'wander', 'do', 'use', 'wait']) if (s[k] !== undefined) return k;
  return null;
}

export function stepMinutes(s, places, from = null) {
  const k = stepKind(s);
  if (k === 'go') { const q = placeOf(places, s.go); return !q ? null : from && Number.isFinite(q.x) && Number.isFinite(from.x) ? legMinutes(from, q) : q.minutes; }
  if (k === 'take' || k === 'lay') {   // 0.41.0: the walk to it (none for a lay "here") and the bend
    const id = k === 'take' ? s.take : s.at, here = k === 'lay' && (id === undefined || id === 'here');
    if (here) return gameMinutes(LAY_SECS);
    const walk = stepMinutes({ go: id }, places, from);
    return walk === null ? null : walk + gameMinutes(LAY_SECS);
  }
  if (k === 'wander') return Number.isFinite(s.minutes) ? s.minutes : null;
  if (k === 'wait') return Number.isFinite(s.wait) ? s.wait : null;
  if (k === 'do') { const d = DO[s.do]; if (d && s.do === 'fish' && Number.isFinite(s.minutes)) return s.minutes; return d ? (d.secs === null ? 0 : gameMinutes(d.secs)) : null; }
  if (k === 'use') { const d = USE[s.use]; return d ? gameMinutes(d.secs) : null; }
  return null;
}

export function stepText(s, places) {
  const k = stepKind(s);
  if (k === 'go') { const q = placeOf(places, s.go); return 'walk to ' + (q ? q.what : s.go); }
  if (k === 'take') { const q = placeOf(places, s.take), what = q ? q.what : s.take; return q && q.kind === 'pile' && Number.isFinite(s.count) ? `pick up ${s.count} from ${what} (${s.take})` : `pick up ${what} (${s.take})`; }
  if (k === 'lay') {
    const kind = layKind(s.lay), w = kind ? layWhat({ ...s, lay: kind }) : String(s.lay), at = s.at === undefined || s.at === 'here' ? null : placeOf(places, s.at);
    if (!at) return s.at === undefined || s.at === 'here' ? `lay down ${w} here` : `lay down ${w} at ${s.at}`;
    return at.kind === 'pile' && at.ref && at.ref.kind === kind ? `lay down ${w} on ${at.what} (${s.at})` : `lay down ${w} beside ${at.what} (${s.at})`;
  }
  if (k === 'wander') return `wander ${s.wander} for ${s.minutes} minutes`;
  if (k === 'wait') return `wait for ${s.wait} minutes (awake)`;
  if (k === 'do') return s.do === 'fish' && Number.isFinite(s.minutes) ? `fish with the spear for up to ${s.minutes} minutes` : DO[s.do] ? DO[s.do].what : String(s.do);
  if (k === 'use') return USE[s.use] ? USE[s.use].what : String(s.use);
  return 'an unknown step ' + shortStep(s);
}

/** 0.40.5 "Form": a step as the chooser wrote it, short (for the reason of a refused step and the panel). */
export function shortStep(s) {
  let t; try { t = JSON.stringify(s); } catch (e) { t = String(s); }
  t = t === undefined ? String(s) : t;
  return t.length > 60 ? t.slice(0, 57) + '...' : t;
}

const FORMS = 'a step is {"go": "<place id>"}, {"take": "<place id>", "count": n}, {"lay": "<kind>", "count": n, "at": "<place id>"}, {"wander": "<direction>", "minutes": n}, {"do": "<action>"}, {"use": "<thing>"} or {"wait": n}';
/** 0.40.5 "Form": why a step is not a step: what was written, the five forms, and the right form when its key is an action or a thing he carries ({"sleep": true} -> {"do": "sleep"}). */
export function notAStep(s, n) {
  const keys = s && typeof s === 'object' ? Object.keys(s) : [];
  const act = keys.find(k => DO[k]), thing = keys.find(k => USE[k]), pick = keys.find(k => k === 'pickup' || k === 'pick');
  const hint = pick ? ' (write {"take": "<place id>"})' : act ? ` (write {"do": "${act}"})` : thing ? ` (write {"use": "${thing}"})` : '';
  return `step ${n} ${shortStep(s)} is not a step${hint}: ${FORMS}`;
}

/** Can the plan be followed? It checks the steps (known kinds and places, sensible minutes) and the sleep and the fishing alone. 0.43.1 "Loose" (the user, 2026-11-20): the size of a plan
 *  (PLAN_STEPS steps, PLAN_GRACE minutes) is only asked for, never refused: a longer plan is followed as it is (its `minutes` and `claimed` still go back to the chooser).
 *  Whether an action is possible is not known beforehand (it depends on where he stands then): that is checked when the step starts (game/actor). */
export function checkPlan(plan, places) {
  const list = Array.isArray(plan) ? plan : plan && Array.isArray(plan.steps) ? plan.steps : null;
  if (!list || !list.length) return { ok: false, steps: [], minutes: 0, reason: 'the plan has no steps' };
  const steps = [];
  let minutes = 0, at = null;   // at (0.37.5): the place the last `go` led to (a later walk counts from there); null at the start and after a wander
  for (let i = 0; i < list.length; i++) {
    const s = list[i], k = stepKind(s), n = i + 1;
    if (!k) return { ok: false, steps: [], minutes: 0, reason: notAStep(s, n) };
    let step;
    if (k === 'go') { if (!placeOf(places, s.go)) return { ok: false, steps: [], minutes: 0, reason: `step ${n}: no place "${s.go}" on the menu` }; step = { go: s.go }; }
    else if (k === 'take') {   // 0.41.0 "Hands"
      const q = placeOf(places, s.take);
      if (!q) return { ok: false, steps: [], minutes: 0, reason: `step ${n}: no place "${s.take}" on the menu` };
      if (!TAKE_KINDS.includes(q.kind)) return { ok: false, steps: [], minutes: 0, reason: `step ${n}: "${s.take}" is not something to pick up (a "take" names a piece of driftwood, a branch, a frond, a stone, a log or a pile)` };
      step = { take: s.take };
      if (s.count !== undefined && q.kind === 'pile') { const c = whole(Number(s.count)); if (!c || c > PILE_MAX) return { ok: false, steps: [], minutes: 0, reason: `step ${n}: "count" is 1 to ${PILE_MAX} pieces` }; step.count = c; }
    } else if (k === 'lay') {   // 0.41.0 "Hands"
      const kind = layKind(s.lay);
      if (!kind) return { ok: false, steps: [], minutes: 0, reason: `step ${n}: "${s.lay}" is not a kind to lay down (${LAY_KINDS.join(', ')})` };
      step = { lay: kind };
      if (s.count !== undefined) { const c = whole(Number(s.count)); if (!c || c > CARRY_MAX) return { ok: false, steps: [], minutes: 0, reason: `step ${n}: "count" is 1 to ${CARRY_MAX} pieces` }; step.count = c; }
      if (s.at !== undefined && s.at !== 'here') { if (!placeOf(places, s.at)) return { ok: false, steps: [], minutes: 0, reason: `step ${n}: no place "${s.at}" on the menu ("at" is a place id or "here")` }; step.at = s.at; }
    }
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
      if (s.do === 'pickup' || s.do === 'take') return { ok: false, steps: [], minutes: 0, reason: `step ${n}: picking up is a step of its own: {"take": "<place id>"} (he walks to that piece or pile and picks it up; "count" for a pile)` };
      if (s.do === 'lay') return { ok: false, steps: [], minutes: 0, reason: `step ${n}: laying down is a step of its own: {"lay": "<kind>", "count": n, "at": "<place id>" or "here"}` };
      if (!DO[s.do]) return { ok: false, steps: [], minutes: 0, reason: `step ${n}: "${s.do}" is not an action` };
      step = { do: s.do };
      if (s.do === 'fish') {
        const m = whole(Number(s.minutes));
        if (!m || m < FISH_MIN || m > FISH_MAX) return { ok: false, steps: [], minutes: 0, reason: `step ${n}: fishing lasts ${FISH_MIN} to ${FISH_MAX} minutes ("minutes")` };
        step.minutes = m;
      }
    } else { if (!USE[s.use]) return { ok: false, steps: [], minutes: 0, reason: `step ${n}: "${s.use}" is not something to eat or drink` }; step = { use: s.use }; }
    if (step.do === 'sleep' && list.length > 1) return { ok: false, steps: [], minutes: 0, reason: 'sleep must be the only step of its plan (he sleeps until he wakes; the next plan follows): answer with {"do": "sleep"} as its only step' };
    if (step.do === 'fish' && list.length > 1) return { ok: false, steps: [], minutes: 0, reason: 'fishing must be the only step of its plan (walk to the water in a plan of its own first)' };
    if (typeof s.say === 'string' && s.say.trim()) step.say = s.say.trim();
    minutes += stepMinutes(step, places, at);
    if (step.go || step.take || step.at) at = placeOf(places, step.go || step.take || step.at); else if (step.wander) at = null;
    steps.push(step);
  }
  // 0.44.2 "One step" (the user, 2026-11-23): a "take" or a "lay ... at" walks there itself; a "go" to the same place just before it is dropped (its thought goes to the next step)
  for (let i = steps.length - 2; i >= 0; i--) {
    const g = steps[i], t = steps[i + 1];
    if (g.go === undefined || (t.take !== g.go && t.at !== g.go)) continue;
    if (g.say && !t.say) t.say = g.say;
    steps.splice(i, 1);
  }
  minutes = 0; at = null;
  for (const step of steps) { minutes += stepMinutes(step, places, at); if (step.go || step.take || step.at) at = placeOf(places, step.go || step.take || step.at); else if (step.wander) at = null; }
  minutes = Math.round(minutes * 10) / 10;
  const raw = plan && !Array.isArray(plan) ? Number(plan.minutes) : NaN, claimed = Number.isFinite(raw) && raw >= 0 ? Math.round(raw) : null;   // 0.37.4: the chooser's own count
  return { ok: true, steps, minutes, claimed, reason: null };
}
