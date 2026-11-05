/**
 * game/mind — Dave's head (0.28 "Habit", 0.28.2 "Pastime", the rhythm of 0.29 "Daily bread", crab trips of 0.29.1 "Low water"): what the castaway does by himself when the player leaves him alone.
 *
 * After QUIET (30 s, game/input `createTakeover`) without any input main hands the game this mind's input instead of the player's;
 * any input of the player takes it back at once (`release`). The mind adds NO game rule: it fills an input object like the player's
 * (a walk target, a press of the action button, a click on an icon of the arc, Z, a click on the row) and so can do only what a
 * player could do. It looks at the island only where the castaway has been (game/known): its targets and its paths stay inside the
 * known cells and 1.5 m away from their edge (`inside`), so he never explores. It never builds and never upgrades (those kinds are never chosen), never wakes him from sleep
 * and never starts a sleep before he could choose to.
 *
 * What he does, in this order of priority (`chooseGoal`, pure, on a plain snapshot of the needs and the time of day):
 *   1 drink   thirst >= THIRST_GO (0.35 days; BED_THIRST 0.25 from SUPPER_FROM 0.64 to LIGHT_FROM 0.74): a full shell is drunk, else he walks to the nearest known fresh river water and kneels (knowing none, he searches, below);
 *             when empty shells are with him and the river is near (NEAR_WATER 40 m) and thirst >= THIRST_TOPUP (0.2), he goes to fill them too
 *   2 eat     (0.29.1: a crab carried is roasted first, at a fire with flames, from hunger CRAB_ROAST_HUNGER 0.2) hunger >= HUNGER_GO (0.4 days; BED_HUNGER 0.3 in the supper window; knowing no food and carrying none, he searches, below): berries, a banana bunch, a carried nut (the row), else the nearest known food by the way
 *             there (nut on the ground, bearing berry bush, banana plant), a carried crab roasted beside a fire, a crab dug for when he happens to stand at a hole it fled into
 *   3 sleep   every night: once he may lie down (game/sleep canLie(time)) and it is night (from BED_FROM 0.87, an hour after dusk and with the fire lit, to DAWN 0.17) or he has been awake TIRED_GO (a whole day: a nap by day):
 *             he walks home (his lean-to; else his fire; else where he last slept; else where he was when the mind took over) and lies down
 *   4 fire    in the evening (EVENING 0.6 to BED_FROM): dry driftwood (else branches) to a pile at the fire spot at home, enough for WOOD_WANT (6) pieces of
 *             burning (a branch counts half), the pile lit from LIGHT_FROM (0.74) when it holds at least FIRE_MIN pieces and LIGHT_MIN_FUEL (3) pieces' worth and he has
 *             fibre (or a torch in hand), and the fire fed from the piles when its fuel is below FEED_BELOW (0.6 of the most it holds)
 *   5 stores  by day (DAY_FROM 0.2 to EVENING): a nut husked to carry (NUT_WANT 2, game limits) and for fibre (the first tuft always, up to FIBRE_WANT 3 tufts when he is hungry
 *             enough to eat the nut, `huskWanted`), and wood to the pile at the fire spot, as above, then topped up to PILE_FULL (12) pieces, with the pile's own kind only.
 *             Driftwood and branches are never both piled there in piles of 6 or more (the arc would offer to build and not to light)
 *   6 idle    (0.28.2) by day (STROLL_FROM to STROLL_TO, `strollNow`, 9 times in 10) a STROLL on known ground instead of standing about: `strollKind` picks one of shore (the waterline:
 *             one to three stretches along it; dry washed-up driftwood within 8 m is picked up when an arm is free and the pile has room), river (to the water, fills empty shells,
 *             a drink if thirsty), palms (a round past a palm or two; husks a nut on the ground if the stores want one) or forest (a berry bush or two; a handful from one that bears
 *             when hunger is EAT_AT, a third of a day, or more), never the same kind twice in a row; places drawn from the PRNG among the known ones (`strollCands`: inside the known ground, standable,
 *             within STROLL_RANGE 80 m of home, a way of at most STROLL_MAX_COST), pauses of 2 to 6 s on the way (PAUSE_CHANCE), wood carried is laid on the pile at home (`deliver`).
 *             Otherwise (night, nothing to walk to) he walks back to within IDLE_NEAR (8 m) of home and lingers 5 to 12 s. Once a day around sunset (GAZE_FROM 0.76 to 0.83) he walks
 *             to the shore (or the fire) and stands a while looking out. No pose, no line of text. After each task he stands 3 to 8 s, now and then (1 in 5) 15 to 30 s (`restSeconds`, from the seed)
 *   0.29.1 a sixth pastime, the CRAB TRIP (`crabTripOk`: a stroll kind 'crabs', and food when hungry with flames and no near nut, `crabFoodOk`): at low water (CRAB_TIDE), CRAB_FROM 0.42 to CRAB_TO 0.66, to a colony he knows
 *             (`crabCands`), the crabs flee into holes as he nears, he presses dig beside one that hides (at most CRAB_DIGS 4 a trip, until CRAB_WANT 1 crab is carried), and roasts it at the evening fire as supper
 * The one exception to staying on known ground (0.28, decided later the same day): SEARCH. Thirsty with no fresh water known, or hungry with no food known and none
 * carried, he walks out from home into the unknown, ring after ring, to the nearest unknown spot that borders what he knows (downhill for water, the low coast for
 * food before the inland), learning what he walks past (`input.learns` true; `mind.searching`), until water he can walk to over known ground, or food, is known; then he is back on known ground only (0.29: water that is known but out of reach does not end a search).
 * A higher need breaks into a lower goal (checked every CHECK seconds); a goal keeps going otherwise and a failing one is left alone for a while (`cool`; 0.28.2: 10 to 40 s, a failed
 * light 100 s, or 300 s when one tuft of fibre is left; a failed try keeps the last tuft).
 * Walking a path: he heads for the next waypoint and moves on at 0.45 m; he cuts a corner (moves on at up to 1.1 m) only when path.clear says the line to the one after is open
 * (0.28.1: a climbing route is a narrow band). He walks; only very thirsty (thirst >= 0.95) and far (20 m or more) does he run.
 *
 * chooseGoal(s) -> 'drink' | 'eat' | 'sleep' | 'fire' | 'stores' | 'idle' | 'none'   pure; s: { asleep, time, thirst, hunger, awake, canLie, water, waterNear,
 *   shellsEmpty, shellsFull, nuts, fibre, torch, fireLit, fireFuel (0..1), stock (pieces' worth of wood in the biggest pile at the fire spot), spare (in the other piles there), cool: {name: true}, canLight }
 * fireStep(s) -> 'light' | 'feed' | 'gather' | null,  storesStep(s) -> 'husk' | 'wood' | null   pure; what the fire / stores goal does now (s.pileLogs: pieces in the biggest pile there)
 * crabTripOk(s), crabFoodOk(s)   pure (0.29.1): may he go for crabs now (s.sea, time, crabs carried, flames, canLight, fibre, pileDry, cool)
 * huskWanted(s), restSeconds(r1, r2), strollKind(avail, last, r), strollNow(s, r)   pure; the choices of the pastimes (0.28.2), tested in tests/mind.test.js
 * RANK   the priority of each goal (lower wins)
 * createMind(world, game, opts?) -> mind
 *   mind.input        the input-like object main passes to game.update while the mind is in charge: up, down, left, right false, run, stick null, target, yaw (main sets
 *                     it from the view), learns false except while searching (the game then learns no new ground from his steps), takeWake always false, takeAction / takeChoice / takeSleep /
 *                     takeLight, pressing(), clearTarget(), cancelAction()
 *   mind.engage()     the mind takes over (remembers where he stands as the last home); mind.release() the player takes over: the goal is dropped, the input cleared.
 *                     A kneeling job already begun is left to finish (the player's own input stops it as usual)
 *   mind.step(dt)     once per game.update while in charge, before it: decides and fills mind.input
 *   mind.active, mind.goal (name or null), mind.resting (true while standing still after a task), mind.walking (a walk target is set)
 *   mind.stats        { goals: {name: n}, stuck, nopath, idleSecs, lightRefused, gazes, strolls, strollKinds: {kind: n}, crabTrips, crabDigs, crabTripDigsMax, crabsCaught, events: [..] } for tests and the playtest bot (searches: how many searches he began)
 *   mind.chose()      true while a sleep he chose himself is being started (the tests tell it from a collapse); mind.lastKind() the kind of the last button he used; mind.path the path finder
 *   opts.stream       a number to vary the chance (default 0)
 *   mind.home()       { kind: 'leanto' | 'fire' | 'bed' | 'here', x, z }
 *   mind.strollCands(centre?, range?)  { shore, river, palms, forest, crabs: [{x, z}] } the places a stroll may go to (all on known ground; for the tests)
 *
 * Everything he decides from comes from the game objects; the only chance is a PRNG seeded from the island (core/noise), so a run is repeatable.
 *
 * Depends on: game/path, game/movement, game/wildlife and game/crabs (through game), game/water, game/wood, game/fire, game/leanto, game/shells, game/sleep, game/known (through game.known), world/constants, core/noise
 */
import { mulberry32, hashInt } from '../core/noise.js';
import { HALF, T, NT } from '../world/constants.js';
import { createPath } from './path.js';
import { canStand, PACE } from './movement.js';
import { freshWater } from './water.js';
import { dryness, logTop } from './wood.js';
import { FIRE_MIN, FUEL_MAX } from './fire.js';
import { ringCentre } from './leanto.js';
import { DAWN as SLEEP_DAWN } from './sleep.js';
import { EAT_AT } from './shells.js';

export const THIRST_GO = 0.35, THIRST_TOPUP = 0.2, THIRST_SIP = 0.15, NEAR_WATER = 40;   // 0.29 "Daily bread": a drink every 8 hours or so (thirsty is 12), three or four times a day with the shells and the evening's
export const HUNGER_GO = 0.4, TIRED_GO = 1;   // a meal at hunger 0.4 (a coconut takes 0.5 off); a nap by day only when he has been awake a whole day
export const BED_THIRST = 0.25, BED_HUNGER = 0.3, SUPPER_FROM = 0.64;   // from SUPPER_FROM to LIGHT_FROM (supper, a drink before the night) he goes for a need a little earlier, so that he does not wake parched or hungry and is free to light the fire
export const EVENING = 0.6, LIGHT_FROM = 0.74, BED_FROM = 0.87, DAWN = SLEEP_DAWN, DAY_FROM = 0.2, GAZE_FROM = 0.76, GAZE_TO = 0.83;
export const WOOD_WANT = 6, NUT_WANT = 2, FIBRE_WANT = 3, PILE_FULL = 12, FEED_BELOW = 0.6, LIGHT_MIN_FUEL = 3, IDLE_NEAR = 8;   // 0.28.2: stores up to a full pile (PILE_MAX of game/wood) and 3 tufts (FIBRE_MAX of game/fibre)
export const SEARCH_LIMIT = 900;   // seconds a goal may take while it is searching for water or food
export const REST_MIN = 3, REST_MAX = 8, REST_LONG_MIN = 15, REST_LONG_MAX = 30, REST_LONG_CHANCE = 0.2, CHECK = 1.5;   // 0.28.2: mostly a short rest, now and then a long one
export const STROLL_FROM = 0.19, STROLL_TO = 0.8, STROLL_CHANCE = 0.9, STROLL_LIMIT = 300, STROLL_RANGE = 80, STROLL_MAX_COST = 150;   // pastimes on known ground, by day (0.28.2)
export const SIT_FIRE = 3.5, SIT_AT_FIRE = 1.8;   // 0.29.2 "Amble": he sits at a fire with flames within SIT_FIRE m; to sit by one he walks to SIT_AT_FIRE m from it
export const LINGER_MIN = 5, LINGER_MAX = 12, PAUSE_CHANCE = 0.45, PAUSE_MIN = 2, PAUSE_MAX = 6;
export const STROLL_KINDS = ['shore', 'river', 'palms', 'forest', 'crabs'], STROLL_WEIGHT = { shore: 3, river: 2, palms: 2, forest: 2, crabs: 6 };   // 0.29.1: crabs, only at low water in the afternoon, so when it is possible it is the usual choice
export const CRAB_TIDE = -0.2, CRAB_FROM = 0.42, CRAB_TO = 0.66, CRAB_FOOD_TO = 0.8, CRAB_DIGS = 4, CRAB_WANT = 1, CRAB_ROAST_HUNGER = 0.2, CRAB_SEEK = 10, NUT_FAR = 50, CRAB_LIMIT = 420;   // 0.29.1 "Low water": crab trips
export const RANK = { drink: 0, eat: 1, sleep: 2, fire: 3, stores: 4, idle: 5 };
const LIMIT = { drink: 160, eat: 220, sleep: 420, fire: 240, stores: 240, idle: 90 };   // seconds a goal may take before it is dropped
const COOL = { crabs: 240, drink: 20, eat: 30, sleep: 20, light: 100, gather: 30, husk: 40, fire: 10, stores: 10 };   // seconds a failed goal is left alone (0.28.2: about a third of before; a failed light waits 3 times as long when only one tuft of fibre is left)
const ALLOWED = ['drink', 'fill', 'pickup', 'lay', 'feed', 'husk', 'berries', 'bananas', 'roast', 'dig', 'plant', 'light'];   // the kinds of the arc / ring he ever chooses (never build, upgrade, torch)

export function fireStep(s) {
  const t = s.time;
  if (!(t >= EVENING && t < BED_FROM)) return null;
  if (!s.fireLit) {
    if (s.canLight && t >= LIGHT_FROM && !s.cool.light) return 'light';
    if (s.stock < WOOD_WANT && !s.cool.gather) return 'gather';
    return null;
  }
  if (s.fireFuel < FEED_BELOW) { if (s.spare > 0 || s.stock > 0) return 'feed'; if (!s.cool.gather) return 'gather'; }
  return null;
}

// a nut to husk: for the fibre of the first tuft always; to carry up to NUT_WANT; for fibre up to FIBRE_WANT only when he is hungry enough to eat the nut that the husking gives him (with two carried he eats it)
export function huskWanted(s) { return s.nuts < NUT_WANT || s.fibre < 1 || (s.fibre < FIBRE_WANT && s.hunger >= EAT_AT); }

/** 0.29.1: may he go after crabs now? Low water (all crabs are out), none carried yet, and a crab dug today must be roasted today: as a pastime (food false) in the afternoon or early evening with a fire at home
 *  that burns or that he can light (dry wood enough and two tufts of fibre: one try may fail; and the wood dry enough to catch, s.pileDry); as food (food true: hungry, no near nut) only with flames now, until CRAB_FOOD_TO. s: { sea, time, crabs (carried), flames, fireLit, canLight, cool } */
export function crabTripOk(s) { return crabTripWhy(s, false); }
export function crabFoodOk(s) { return crabTripWhy(s, true); }
function crabTripWhy(s, food) {
  if (!(s.sea <= CRAB_TIDE) || (s.crabs || 0) >= CRAB_WANT || (s.cool && s.cool.crabs)) return false;
  if (food) return !!s.flames && s.time >= DAY_FROM && s.time < CRAB_FOOD_TO;
  return s.time >= CRAB_FROM && s.time < CRAB_TO && (!!s.flames || (!!s.canLight && s.fibre >= 2 && s.pileDry !== false));
}

export function storesStep(s) {
  const t = s.time;
  if (!(t >= DAY_FROM && t < EVENING)) return null;
  if (huskWanted(s) && !s.cool.husk) return 'husk';
  // a fire still burning by day is not fed: the wood waits for the evening; a pile is topped up to PILE_FULL pieces once the evening's 6 are there (s.pileLogs: pieces in the biggest pile at the fire spot)
  if ((s.stock < WOOD_WANT || (s.pileLogs ?? PILE_FULL) < PILE_FULL) && !s.fireLit && !s.cool.gather) return 'wood';
  return null;
}

/** How long he stands after a task (seconds): r1 in [0,1) decides short or long, r2 in [0,1) where in the range. */
export function restSeconds(r1, r2) { return r1 < REST_LONG_CHANCE ? REST_LONG_MIN + (REST_LONG_MAX - REST_LONG_MIN) * r2 : REST_MIN + (REST_MAX - REST_MIN) * r2; }

/** Which stroll: avail {shore, river, palms, forest} (true where he knows a place for it), last = the kind of the one before (not twice in a row if there is another), r in [0,1). null when there is none. */
export function strollKind(avail, last, r) {
  let ks = STROLL_KINDS.filter(k => avail[k]); if (ks.length > 1) ks = ks.filter(k => k !== last);
  if (!ks.length) return null;
  let x = r * ks.reduce((n, k) => n + STROLL_WEIGHT[k], 0);
  for (const k of ks) { x -= STROLL_WEIGHT[k]; if (x < 0) return k; }
  return ks.at(-1);
}

/** Does he go for a stroll now (by day; a need that comes due breaks into the stroll like into any lowest goal), given r in [0,1)? */
export function strollNow(s, r) { return s.time >= STROLL_FROM && s.time < STROLL_TO && r < STROLL_CHANCE; }

/** 0.29.2 "Amble": does he sit while he rests (pure)? s: { time, long (this rest is one of the long ones, 15 to 30 s), fireNear (a fire with flames within SIT_FIRE m), gazing }.
 *  Returns 'fire' (evenings at home by the fire, EVENING to BED_FROM), 'gaze' (the sunset gaze, in `gaze`), 'rest' (a long rest by day, STROLL_FROM to GAZE_FROM) or null (he stands). */
export function sitKind(s) {
  if (s.gazing) return 'gaze';
  if (s.time >= EVENING && s.time < BED_FROM && s.fireNear) return 'fire';
  if (s.long && s.time >= STROLL_FROM && s.time < GAZE_FROM) return 'rest';
  return null;
}

export function chooseGoal(s) {
  if (s.asleep) return 'none';
  const t = s.time, cool = s.cool || {};
  const late = t >= SUPPER_FROM && t < LIGHT_FROM;   // supper and a drink before the night
  if (!cool.drink && (s.thirst >= (late ? BED_THIRST : THIRST_GO) || (s.shellsEmpty > 0 && s.waterNear && s.thirst >= THIRST_TOPUP))) return 'drink';
  if (!cool.eat && (s.hunger >= (late && !s.crabs ? BED_HUNGER : HUNGER_GO) || (s.crabs > 0 && s.flames && s.hunger >= CRAB_ROAST_HUNGER))) return 'eat';   // 0.29.1: with a crab carried he waits for the fire's flames to have it for supper
  if (!cool.sleep && s.canLie && (t >= BED_FROM || t < DAWN || s.awake >= TIRED_GO)) return 'sleep';
  if (!cool.fire && fireStep({ ...s, cool })) return 'fire';
  if (!cool.stores && storesStep({ ...s, cool })) return 'stores';
  return 'idle';
}

export function createMind(world, game, opts = {}) {
  const p = game.player, clock = game.clock, W = game.wood, known = game.known;
  const rng = mulberry32(hashInt(world.seed + 28, opts.stream || 0, 1));
  // ground he may be taken over: known all round, MARGIN (1.5 m) inside the edge of what he knows, so that sliding past a trunk or a bush never carries him into a cell he has not been to
  const MARGIN = 1.5, DIAG = MARGIN * 0.75;
  const inside = (x, z) => known.has(x, z) && known.has(x + MARGIN, z) && known.has(x - MARGIN, z) && known.has(x, z + MARGIN) && known.has(x, z - MARGIN)
    && known.has(x + DIAG, z + DIAG) && known.has(x - DIAG, z - DIAG) && known.has(x + DIAG, z - DIAG) && known.has(x - DIAG, z + DIAG);
  const path = createPath(world, { allow: inside }), pathFree = createPath(world);   // pathFree: only for a search for water or food (the one time he goes into unknown ground)
  const stats = { goals: {}, stuck: 0, nopath: 0, idleSecs: 0, lightRefused: 0, gazes: 0, sitSecs: 0, searches: 0, strolls: 0, strollKinds: {}, crabTrips: 0, crabDigs: 0, crabTripDigsMax: 0, crabsCaught: 0, events: [] };
  const mind = { input: null, active: false, get searching() { return inp.learns === true; }, goal: null, resting: false, stats, step, engage, release, home: homeSpot, get walking() { return !!inp.target; } };
  let now = 0, cur = null, restUntil = 0, restLong = false, anchor = { x: p.x, z: p.z }, slept = null, gazedDay = -1, chose = false, lastKind = null;
  let pressed = null, choice = null, sleepKey = false, sinceCheck = 0;
  const coolUntil = {}, bad = new Map();
  const inp = mind.input = {
    up: false, down: false, left: false, right: false, run: false, stick: null, target: null, yaw: undefined, learns: false, pace: 1, sit: false,
    takeWake: () => false, takeLight: () => false, pressing: () => false, cancelAction() { pressed = null; }, clearTarget() { inp.target = null; },
    takeAction: () => { const k = pressed; pressed = null; return k; }, takeChoice: () => { const k = choice; choice = null; return k; }, takeSleep: () => { const k = sleepKey; sleepKey = false; return k; },
  };
  const ev = (type, data) => { if (stats.events.length < 400) stats.events.push({ type, day: clock.day, time: +clock.time.toFixed(3), x: +p.x.toFixed(1), z: +p.z.toFixed(1), ...data }); };
  const idleInput = () => { inp.target = null; inp.run = false; };
  const busy = () => game.sleep.asleep || p.lie > 0 || !!p.work || p.stoop > 0 || (p.sitting > 0 && !inp.sit);   // (0.29.2: getting up is not done until he stands)
  const cool = (name, secs = COOL[name] || 60) => { coolUntil[name] = now + secs; };
  const isCool = name => (coolUntil[name] || 0) > now;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const rand = () => rng();

  // ---------- looking at the island (only where he has been) ----------
  const tilesNear = (x, z, r) => {
    const out = [], tx0 = Math.max(0, Math.floor((x - r + HALF) / T)), tx1 = Math.min(NT - 1, Math.floor((x + r + HALF) / T)), tz0 = Math.max(0, Math.floor((z - r + HALF) / T)), tz1 = Math.min(NT - 1, Math.floor((z + r + HALF) / T));
    for (let tz = tz0; tz <= tz1; tz++) for (let tx = tx0; tx <= tx1; tx++) { const t = world.tiles[tz * NT + tx]; if (t) out.push(t); }
    return out;
  };
  const isBad = (kind, o) => (bad.get(kind + ':' + o.id) || 0) > now;
  const markBad = (kind, o, secs = 400) => { bad.set(kind + ':' + o.id, now + secs); };
  const SRC = {
    coco: t => game.fibre.groundCocos(t),
    berry: t => game.berries.bearingIn(t),
    banana: t => game.bananas.bearingIn(t),
    drift: t => W.beachLogs(t).filter(l => dryness(l, clock.total) >= 0.95 && logTop(l) > game.sea + 0.02),
    branch: t => game.branches.groundBranches(t),
  };
  const scan = (kind, x, z, r) => {
    const out = [];
    for (const t of tilesNear(x, z, r)) for (const o of SRC[kind](t)) { const d = Math.hypot(o.x - x, o.z - z); if (d <= r && inside(o.x, o.z) && !isBad(kind, o)) out.push({ o, d, x: o.x, z: o.z, id: o.id }); }
    return out.sort((a, b) => a.d - b.d);
  };
  const nearestBy = (kind, r = 45, k = 4) => {   // the nearest by walking cost among the closest few, widening the circle until something is found
    let best = null;
    for (let rr = r; rr <= 200 && !best; rr *= 2.5) for (const c of scan(kind, p.x, p.z, rr).slice(0, k)) {
      const cost = path.cost(p, c);
      if (cost < Infinity && (!best || cost < best.cost)) best = { ...c, cost }; else if (cost === Infinity) markBad(kind, c.o, 300);
    }
    return best;
  };
  const waterAll = (() => {   // fresh river water he could stand beside: sampled points of the rivers
    const out = [];
    for (const rv of world.rivers) for (let i = 0; i < rv.pts.length; i += 2) { const q = rv.pts[i]; if (freshWater(world, q.x, q.z, 0) && canStand(world, q.x, q.z, 0)) out.push({ x: q.x, z: q.z }); }
    return out;
  })();
  let waterKnown = [], waterAt = -1;
  const waterPts = () => { if (waterAt !== known.count) { waterAt = known.count; waterKnown = waterAll.filter(q => inside(q.x, q.z)); } return waterKnown; };
  const standNear = (x, z, r = 1.2) => {   // a spot he can stand on, known and dry, at the point itself or on rings of 0.5 m round it
    const ok = (a, b) => inside(a, b) && canStand(world, a, b, 0) && world.H(a, b) > 0.4;
    if (ok(x, z)) return { x, z };
    for (let rr = 0.5; rr <= Math.max(r, 3); rr += 0.5) for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6, px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr; if (ok(px, pz)) return { x: px, z: pz }; }
    return null;
  };

  // ---------- home ----------
  function homeSpot() {
    let lt = null, bd = Infinity;
    for (const l of game.leantos.list) if (l.progress >= 1 && inside(l.x, l.z)) { const d = dist(l, p); if (d < bd) { bd = d; lt = l; } }
    if (lt) return { kind: 'leanto', x: lt.x, z: lt.z, lt };
    const fires = game.fire.fires.filter(f => inside(f.x, f.z));
    if (fires.length) { const f = fires.reduce((a, b) => (b.lit > a.lit ? b : a)); return { kind: 'fire', x: f.x, z: f.z }; }
    const burnt = game.fire.burnt.filter(b => inside(b.x, b.z));
    if (burnt.length) { const b = burnt.reduce((a, c) => (c.id > a.id ? c : a)); return { kind: 'fire', x: b.x, z: b.z }; }
    if (slept && inside(slept.x, slept.z)) return { kind: 'bed', x: slept.x, z: slept.z };
    return { kind: 'here', x: anchor.x, z: anchor.z };
  }
  const fireSpot = h => { h = h || homeSpot(); const q = h.kind === 'leanto' ? ringCentre(h.lt) : h.kind === 'fire' ? h : { x: h.x + 1.8, z: h.z }; return standNear(q.x, q.z) || standNear(h.x, h.z) || { x: p.x, z: p.z }; };
  const sleepSpot = h => { h = h || homeSpot(); if (h.kind === 'leanto') return { x: h.x, z: h.z }; if (h.kind === 'fire') { const s = standNear(h.x + 1.4, h.z) || standNear(h.x, h.z - 1.4); return s || { x: h.x, z: h.z }; } return { x: h.x, z: h.z }; };
  const pilesNear = (kind, x, z, r) => W.piles.filter(q => q.kind === kind && Math.hypot(q.x - x, q.z - z) <= r);
  const fuelOfPile = q => q.logs.reduce((n, l) => n + (l.branch ? 0.5 : 1), 0);   // in pieces of driftwood (a branch burns half as long)
  const firePiles = fs => W.piles.filter(q => (q.kind === 'driftwood' || q.kind === 'branch') && Math.hypot(q.x - fs.x, q.z - fs.z) <= 2.4);
  const bestPile = fs => firePiles(fs).sort((a, b) => fuelOfPile(b) - fuelOfPile(a))[0] || null;
  const fireAt = fs => game.fire.fires.find(f => dist(f, fs) < 3.5 && (f.fuel > 0.005 || f.embers > 0.005)) || null;

  const flameFire = () => game.fire.fires.find(q => game.fire.strength(q) > 0 && inside(q.x, q.z)) || null;   // a fire with flames on known ground (a crab is roasted only at one)

  // ---------- where he looks when he sits (0.29.2 "Amble") ----------
  const nearFlame = r => game.fire.fires.filter(q => game.fire.strength(q) > 0 && dist(q, p) <= r).sort((a, b) => dist(a, p) - dist(b, p))[0] || null;
  function seaward(x = p.x, z = p.z) {   // a point out towards the sea (the way the ground falls away most within 12 m), else null: he then looks the way he faces
    const y = world.H(x, z); let best = null, by = y - 0.3;
    for (let r = 4; r <= 12; r += 4) for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, qx = x + Math.sin(a) * r, qz = z + Math.cos(a) * r, qy = world.H(qx, qz); if (qy < by) { by = qy; best = { x: x + Math.sin(a) * 10, z: z + Math.cos(a) * 10 }; } }
    return best;
  }
  const lookAt = () => { const f = nearFlame(SIT_FIRE); return f ? { x: f.x, z: f.z } : seaward() || true; };
  // sits or stands while he rests (set every step in the rest between two tasks); the kind of the sit is sitKind
  function restSit() {
    const kind = sitKind({ time: clock.time, long: restLong, fireNear: !!nearFlame(SIT_FIRE), gazing: false });
    inp.sit = kind === 'fire' ? lookAt() : kind === 'rest' ? lookAt() : false;
  }

  // ---------- what he senses, for chooseGoal ----------
  function senses() {
    const h = homeSpot(), fs = fireSpot(h), f = fireAt(fs), piles = firePiles(fs), best = bestPile(fs), st = best ? fuelOfPile(best) : 0, wp = waterPts();
    let near = false; for (const q of wp) if (Math.hypot(q.x - p.x, q.z - p.z) < NEAR_WATER) { near = true; break; }
    const cool = {}; for (const k of Object.keys(COOL)) cool[k] = isCool(k);
    return {
      sea: game.sea, crabs: game.crabs.carried.length, flames: !!flameFire(),
      asleep: game.sleep.asleep || p.lie > 0, time: clock.time, thirst: game.thirst.days, hunger: game.hunger.days, awake: game.sleep.awake, canLie: game.sleep.canLie(clock.time),
      water: wp.length > 0, waterNear: near, shellsEmpty: game.shells.empty(), shellsFull: game.shells.full(), nuts: game.shells.nuts, fibre: game.fibre.carried, torch: !!game.fire.torch,
      fireLit: !!f, fireFuel: f ? f.fuel / FUEL_MAX : 0, stock: st, pileLogs: best ? best.logs.length : 0, spare: piles.reduce((n, q) => n + fuelOfPile(q), 0) - st,
      pileDry: !best || best.logs.reduce((n, l) => n + dryness(l, clock.total), 0) / best.logs.length >= 0.6,
      canLight: !!best && best.logs.length >= FIRE_MIN && fuelOfPile(best) >= LIGHT_MIN_FUEL && (game.fibre.carried > 0 || !!game.fire.torch), cool,
    };
  }

  // ---------- the buttons (what a player's hands do) ----------
  function pressKind(kinds) {   // a small action of one of kinds: the ring if it is the main one, else its icon in the arc; returns the kind or null
    const a = game.action(), want = kinds.filter(k => ALLOWED.includes(k));
    inp.sit = false;
    if (a.tap && want.includes(a.tap.kind)) { lastKind = a.tap.kind; pressed = 'tap'; return a.tap.kind; }
    const i = a.options.findIndex(o => want.includes(o.kind));
    if (i >= 0) { lastKind = a.options[i].kind; choice = i; return lastKind; }
    return null;
  }
  const useRow = kind => { lastKind = 'use:' + kind; idleInput(); inp.sit = false; return game.use(kind, inp); };

  // ---------- walking ----------
  function* walk(x, z, o = {}) {   // to (x, z): true when he got there (or until() is true), false when there is no way; inside known ground (o.free: anywhere, for a search)
    const tap = !!o.tap, stop = o.stop ?? 1.0, fd = o.free ? pathFree : path;
    let plan = null, pi = 0, finalSet = false, replans = 0, chk = { x: p.x, z: p.z, t: now }, stuckN = 0, seen = now;
    for (;;) {
      if (o.until && o.until()) { idleInput(); return true; }
      if (p.sitting > 0) { inp.sit = false; idleInput(); yield; continue; }   // 0.29.2: he gets up first, then walks
      const d = Math.hypot(x - p.x, z - p.z);
      if (!tap && d <= stop) { idleInput(); return true; }
      if (!plan) {
        plan = fd.find(p, { x, z }); pi = 0;
        if (!plan) { stats.nopath++; ev('nopath', { to: [+x.toFixed(1), +z.toFixed(1)], goal: cur && cur.name }); idleInput(); return false; }
        if (d < 3.5 && plan.pts.length <= 3) plan.direct = true;
      }
      { let bj = pi, bd = 1e9; for (let j = pi; j < Math.min(plan.pts.length, pi + 8); j++) { const dd = Math.hypot(plan.pts[j].x - p.x, plan.pts[j].z - p.z); if (dd < bd) { bd = dd; bj = j; } } pi = bj; if (bd > 5) { plan = null; finalSet = false; if (++replans > 6) { idleInput(); return false; } yield; continue; } }
      while (pi < plan.pts.length - 1 && (Math.hypot(plan.pts[pi].x - p.x, plan.pts[pi].z - p.z) < 0.45   // reached: on to the next (tight, a climbing route can be a narrow band) ...
        || (Math.hypot(plan.pts[pi].x - p.x, plan.pts[pi].z - p.z) < 1.1 && fd.clear(p, plan.pts[pi + 1])))) pi++;   // ... or passed: he cuts the corner only on a line that is clear (open ground)
      const last = pi >= plan.pts.length - 1 || plan.direct || Math.hypot(plan.pts.at(-1).x - p.x, plan.pts.at(-1).z - p.z) < 2.2;
      let remaining = d;
      if (last) {
        if (tap) { if (!finalSet) { inp.target = { x, z, tap: true }; finalSet = true; } else if (!inp.target) return true; }
        else inp.target = { x, z };
      } else { const w = plan.pts[pi]; inp.target = { x: w.x, z: w.z }; remaining = (plan.pts.length - pi) * 1.5; }
      inp.run = !!o.hurry && remaining > 20 && !p.winded;
      if (now - seen > 0.5) chk = { x: p.x, z: p.z, t: now };   // he was busy (kneeling, sleeping): count again
      seen = now;
      if (now - chk.t >= 4) {   // stuck check every 4 seconds
        const moved = Math.hypot(p.x - chk.x, p.z - chk.z);
        if (moved < 0.3 && !busy() && tap && d < 1.3) { idleInput(); return true; }   // beside a thing that lies against a trunk: close enough
        if (moved < 0.3 && !busy()) {
          stuckN++; stats.stuck++; ev('stuck', { goal: cur && cur.name, to: [+x.toFixed(1), +z.toFixed(1)], dist: +d.toFixed(1), n: stuckN });
          const ahead = plan.pts[Math.min(pi + 1, plan.pts.length - 1)]; if (ahead) fd.ban(ahead.x, ahead.z);
          if (fd.banned.size > 40) fd.banned.clear();
          for (const t0 = now; now - t0 < 1.5;) {   // steer by hand for a moment: the free direction closest to the goal, over known ground
            const gx = x - p.x, gz = z - p.z, gl = Math.hypot(gx, gz) || 1; let bu = null, bs = -2;
            for (let a = 0; a < 24; a++) {
              const ang = a * Math.PI / 12, ux = Math.sin(ang), uz = Math.cos(ang);
              if ((!o.free && !inside(p.x + ux * 1.5, p.z + uz * 1.5)) || !canStand(world, p.x + ux * 0.6, p.z + uz * 0.6, game.sea)) continue;
              const sc = (ux * gx + uz * gz) / gl; if (sc > bs) { bs = sc; bu = { ux, uz }; }
            }
            inp.target = bu ? { x: p.x + bu.ux * 2.5, z: p.z + bu.uz * 2.5 } : null; yield;
          }
          chk = { x: p.x, z: p.z, t: now };
          plan = null; finalSet = false; if (stuckN >= 3 || ++replans > 4) { idleInput(); return false; }
        }
        chk = { x: p.x, z: p.z, t: now };
      }
      yield;
    }
  }
  function* waitIdle() { while (busy()) yield; yield; }
  function* waitActs(max = 25) { const t0 = now; yield; while (inp.target && inp.target.act && now - t0 < max) yield; yield; }
  const hurry = () => game.thirst.days >= 0.95;

  // ---------- searching (the one exception to staying on known ground) ----------
  // Thirsty with no fresh water known, or hungry with no food known and none carried: he walks out from home over the unknown, ring by ring (rings of 12 m,
  // 24 points each) to the nearest unknown spot that borders what he knows, leaning downhill for water (rivers run to the sea) and to the low coast for food
  // (palms) before the inland (berries), and learns what he walks past (inp.learns). Seeded by nothing: the same island gives the same search. When it is found he
  // is back to known ground only.
  let foodAt = -1, foodSeen = false, foodT = -9;   // food he knows and can walk to over known ground; looked at again when he knows more, at most every 2 s
  const foodKnown = () => { if (foodAt !== known.count && now - foodT >= 2) { foodAt = known.count; foodT = now; foodSeen = !!(nearestBy('coco', 60) || nearestBy('berry', 60) || nearestBy('banana', 60, 2)); } return foodSeen; };
  function frontier(kind, h, tried) {
    const cands = [];
    for (let r = 15; r <= 250; r += 12) for (let i = 0; i < 24; i++) {
      const a = i * Math.PI / 12 + (r / 12 % 2) * Math.PI / 24, x = h.x + Math.sin(a) * r, z = h.z + Math.cos(a) * r;
      if (!(Math.abs(x) < HALF - 8 && Math.abs(z) < HALF - 8) || known.has(x, z) || !known.near(x, z, 18) || !canStand(world, x, z, 0)) continue;
      if (tried.some(q => Math.hypot(q.x - x, q.z - z) < 14)) continue;
      const y = world.H(x, z), bias = kind === 'water' ? y * 2 : (y > 5 ? 15 : 0);
      cands.push({ x, z, bias, score: Math.hypot(x - p.x, z - p.z) + bias });
    }
    cands.sort((u, v) => u.score - v.score);
    let best = null;
    for (const c of cands.slice(0, 5)) { const r = pathFree.find(p, c, 30000, false); if (!r) { tried.push(c); continue; } const sc = r.cost * 2.9 + c.bias; if (!best || sc < best.sc) best = { ...c, sc }; }
    return best;
  }
  let waterOkAt = -1, waterOkT = -9, waterOk = false;   // fresh water he knows AND can reach over known ground (0.29: seed 7 showed water in view above a wall: known, but no way to it); looked at again when he knows more, at most every 2 s
  const waterReachable = () => {
    if (waterOkAt !== known.count && now - waterOkT >= 2) {
      waterOkAt = known.count; waterOkT = now;
      waterOk = waterPts().map(q => ({ ...q, d: Math.hypot(q.x - p.x, q.z - p.z) })).sort((a, b) => a.d - b.d).slice(0, 4).some(c => path.cost(p, c) < Infinity);
    }
    return waterOk;
  };
  function* searchFor(kind) {
    foodAt = -1; foodT = -9; waterOkAt = -1; waterOkT = -9;
    const found = () => kind === 'water' ? waterReachable() : foodKnown();
    if (found()) return true;
    stats.searches++; ev('search', { kind, thirst: +game.thirst.days.toFixed(2), hunger: +game.hunger.days.toFixed(2) });
    if (cur) cur.limit = SEARCH_LIMIT;
    inp.learns = true;
    try {
      const h = homeSpot(), tried = [];
      for (let hop = 0; hop < 60 && !found(); hop++) {
        const f = frontier(kind, h, tried); if (!f) return false;
        tried.push(f);
        yield* walk(f.x, f.z, { stop: 2, free: true, until: found });
      }
      if (found()) ev('search-found', { kind });
      return found();
    } finally { inp.learns = false; idleInput(); }
  }

  // ---------- goals ----------
  function* drinkGoal() {
    if (game.shells.full() > 0 && game.thirst.days > THIRST_SIP && !game.fire.torch && game.thirst.days >= BED_THIRST) { if (useRow('water')) { yield* waitIdle(); return true; } }
    if (!waterPts().length) { if (!(yield* searchFor('water'))) { ev('no-water'); return false; } }   // thirsty and knows no fresh water: he goes looking
    const badWater = [];
    for (let tries = 0; tries < 4; tries++) {
      const cand = waterPts().filter(q => !badWater.some(w => Math.hypot(w.x - q.x, w.z - q.z) < 2)).map(q => ({ ...q, d: Math.hypot(q.x - p.x, q.z - p.z) })).sort((a, b) => a.d - b.d).slice(0, 4);
      let best = null; for (const c of cand) { const cost = path.cost(p, c); if (cost < Infinity && (!best || cost < best.cost)) best = { ...c, cost }; }
      if (!best) { ev('no-water'); return false; }
      const near = () => { const a = game.action(); return [a.tap, ...a.options].some(o => o && (o.kind === 'drink' || o.kind === 'fill')); };
      yield* walk(best.x, best.z, { stop: 0.3, until: near, hurry: hurry() });
      let presses = 0, did = 0;
      while (presses++ < 6 && (game.thirst.days > 0.08 || game.shells.empty() > 0)) {
        const k = pressKind(['drink', 'fill']); if (!k) break;
        did++; yield* waitIdle();
      }
      if (did) return true;
      ev('drink-not-offered'); badWater.push({ x: best.x, z: best.z }, { x: p.x, z: p.z });
    }
    return false;
  }

  function* eatGoal() {
    if (pressKind(['dig'])) { yield* waitIdle(); }   // standing at a hole a crab fled into: dig
    if (game.crabs.carried.length && game.hunger.days >= CRAB_ROAST_HUNGER && flameFire() && (yield* roastCrab())) return true;   // 0.29.1: supper from the crab he dug, before any nut: a raw crab spoils
    if (game.hunger.days < (clock.time >= SUPPER_FROM && clock.time < LIGHT_FROM && !game.crabs.carried.length ? BED_HUNGER : HUNGER_GO)) return true;
    if (game.berries.carried.length && game.hunger.days > EAT_AT && useRow('berries')) { yield* waitIdle(); return true; }
    if (game.bananas.carried.length && game.hunger.days > EAT_AT && useRow('banana')) { yield* waitIdle(); return true; }
    if (game.shells.nuts > 0 && useRow('nut')) { yield* waitIdle(); return true; }
    const foods = () => {
      const cs = [], c = nearestBy('coco', 60), b = nearestBy('berry', 60), bn = nearestBy('banana', 60, 2);
      if (c) cs.push({ kind: 'coco', t: c, w: c.cost }); if (b) cs.push({ kind: 'berry', t: b, w: b.cost * 3 }); if (bn) cs.push({ kind: 'banana', t: bn, w: bn.cost * 0.8 });
      return cs;
    };
    let cs = foods();
    // 0.29.1: no near nut (none known, or a far one) and a fire burning at home: a crab trip at low water, then the roast at the fire, before the long walk for a nut
    if (crabFoodOk(senses())) {
      const best = crabCands(p, STROLL_RANGE).map(c => ({ c, cost: path.cost(p, c) })).filter(q => q.cost < STROLL_MAX_COST).sort((a, q) => a.cost - q.cost)[0];
      if (best && (!cs.length || best.cost < Math.min(...cs.map(q => q.t.cost)) && cs.every(q => q.t.cost > NUT_FAR))) {
        yield* crabTrip(best.c);
        if (game.crabs.carried.length && flameFire() && (yield* roastCrab())) return true;
        cs = foods();
      }
    }
    if (!cs.length) { if (yield* searchFor('food')) cs = foods(); }   // hungry, nothing carried and no food known: he goes looking
    if (!cs.length) { ev('no-food'); return false; }
    cs.sort((a, q) => a.w - q.w); const pick = cs[0], t = pick.t, want = pick.kind === 'coco' ? ['husk'] : pick.kind === 'berry' ? ['berries'] : ['bananas'];
    const near = () => { const a = game.action().tap; return !!a && want.includes(a.kind) && !!a.thing && Math.hypot((a.thing.x ?? t.x) - t.x, (a.thing.z ?? t.z) - t.z) < 3; };
    yield* walk(t.x, t.z, { tap: pick.kind === 'coco', stop: 0.4, until: near, hurry: hurry() });
    let k = pressKind(want); if (k) yield* waitIdle();
    if (!k) { yield* walk(t.x, t.z, { stop: 0.2 }); k = pressKind(want); if (k) yield* waitIdle(); }
    if (!k) { markBad(pick.kind, t.o, 600); ev('food-not-offered', { kind: pick.kind }); return false; }
    return true;
  }

  function* roastCrab() {   // to the fire with flames and the row's crab: kneels ROAST_TIME and eats it
    const f = flameFire(); if (!f) return false;
    yield* walk(f.x + 0.8, f.z + 0.4, { stop: 0.7 });
    if (useRow('crab')) { yield* waitIdle(); return true; }
    return false;
  }

  // ---------- crab trips (0.29.1 "Low water") ----------
  // Colonies he knows (a dry hole on known ground; not one whose crabs are all caught and gone). Walking up scares the crabs into their holes (game/wildlife SCARE 3 m); beside a hole one hides in he presses dig
  // (the player's own action, half a chance, fixed by the seed and the dig count); a failed dig lets the crab escape. At most CRAB_DIGS digs a trip, until CRAB_WANT crab is carried; then home. Raw crabs go bad after a day: they are roasted at the evening fire.
  function crabCands(centre, range) {
    const out = [];
    for (const col of game.wildlife.coloniesNear(centre.x, centre.z, range)) {
      if (!col.crabs.some(q => !game.crabs.isGone(q.id))) continue;
      const hole = col.holes.filter(h => h.y > CRAB_TIDE + 0.1 && inside(h.x, h.z) && canStand(world, h.x, h.z, 0)).sort((a, b) => dist(a, centre) - dist(b, centre))[0];
      if (hole) out.push({ x: hole.x, z: hole.z, col });
    }
    return out;
  }
  const digOffered = () => { const a = game.action(); return [a.tap, ...a.options].some(o => o && o.kind === 'dig'); };
  function* crabTrip(c) {
    if (cur) cur.limit = CRAB_LIMIT;
    stats.crabTrips++; ev('crab-trip', { to: [+c.x.toFixed(1), +c.z.toFixed(1)] });
    const hid = () => { const h = game.wildlife.hiding(p.x, p.z, CRAB_SEEK); return h && inside(h.x, h.z) ? h : null; };
    const got0 = game.crabs.carried.length; let digs = 0;
    yield* walk(c.x, c.z, { stop: 1, until: () => !!hid() });   // the crabs flee into their holes as he comes near
    for (let round = 0; round < 12 && digs < CRAB_DIGS && game.crabs.carried.length < CRAB_WANT && game.sea <= CRAB_TIDE + 0.1; round++) {
      const h = hid();
      if (!h) {   // a crab still out: walk up to it (it flees), else none is out and the trip is over
        const out = game.wildlife.crabs().filter(q => inside(q.x, q.z) && Math.hypot(q.x - c.x, q.z - c.z) < 14).sort((a, b) => dist(a, p) - dist(b, p))[0];
        if (!out) break;
        yield* walk(out.x, out.z, { stop: 1.6 });
        for (const t0 = now; now - t0 < 2.5;) yield;   // it runs to its hole
        continue;
      }
      yield* walk(h.x, h.z, { stop: 0.3, until: digOffered });
      if (!digOffered()) yield* walk(h.x, h.z, { stop: 0.1 });
      if (!pressKind(['dig'])) break;
      digs++; stats.crabDigs++; yield* waitIdle(); yield;
    }
    stats.crabTripDigsMax = Math.max(stats.crabTripDigsMax, digs);
    const caught = game.crabs.carried.length - got0; stats.crabsCaught += Math.max(0, caught);
    ev('crab-trip-end', { digs, caught });
    if (caught <= 0) cool('crabs');
    return true;
  }

  function* huskGoal() {   // a nut for fibre and to carry
    const c = nearestBy('coco', 60); if (!c) { cool('husk'); return false; }
    const near = () => { const a = game.action().tap; return !!a && a.kind === 'husk' && !a.carried; };
    yield* walk(c.x, c.z, { tap: true, stop: 0.4, until: near });
    let k = pressKind(['husk']); if (k) yield* waitIdle();
    if (!k) { yield* walk(c.x, c.z, { stop: 0.2 }); k = pressKind(['husk']); if (k) yield* waitIdle(); }
    if (!k) { markBad('coco', c.o, 600); return false; }
    return true;
  }

  const carriedKind = () => W.carried.length ? (W.carried[0].branch ? 'branch' : W.carried[0].frond ? 'frond' : 'drift') : (W.stones.length ? 'stone' : null);
  function* layDown() { for (let n = 0; n < 3 && (W.carried.length || W.stones.length); n++) { if (!pressKind(['feed', 'lay'])) break; yield* waitIdle(); } }
  // fetch up to three pieces of one kind and bring them to dest (fire: feed it first, then lay down)
  function* gather(kind, dest, want) {
    let got = 0; const ck = carriedKind();
    if (ck && ck !== kind) { if (pressKind(['lay'])) yield* waitIdle(); } else if (ck === kind) got = W.carried.length;
    while (got < Math.min(3, want)) {
      const t = nearestBy(kind, 45, 4); if (!t) break;
      const before = W.carried.length;
      yield* walk(t.x, t.z, { tap: true, stop: 0.4, until: () => { const a = game.action().tap; return !!a && a.kind === 'pickup' && !!a.thing && a.thing.kind === 'log' && Math.hypot(a.thing.x - t.x, a.thing.z - t.z) < 1.5; } });
      let k = pressKind(['pickup']); if (k) yield* waitIdle();
      if (!k) { yield* walk(t.x, t.z, { stop: 0.2 }); k = pressKind(['pickup']); if (k) yield* waitIdle(); }
      yield;
      if (W.carried.length > before) got++; else markBad(kind, t.o, 600);
    }
    if (!W.carried.length) return got > 0;
    const d = dest(); if (!d) return false;
    const ok = yield* walk(d.x, d.z, { stop: 0.35 });
    if (!ok) return false;
    yield* layDown();
    return true;
  }
  // wood for the fire: onto the biggest pile of the same kind at the fire spot (laying down within a metre joins a pile), else a new pile there. The kind of the biggest pile
  // goes first, so a pile of branches and a pile of driftwood do not both grow to 6 (the arc would then offer to build, not to light)
  function* gatherWood() {
    const fs = fireSpot(), best = bestPile(fs), st = best ? fuelOfPile(best) : 0;
    const topUp = !!best && st >= WOOD_WANT;   // the evening's wood is there: only fill the pile up, and only with its own kind (two piles of 6 or more would make the arc offer to build)
    const order = best && best.kind === 'branch' ? ['branch', 'drift'] : ['drift', 'branch'];
    for (const kind of topUp ? order.slice(0, 1) : order) {
      if (!nearestBy(kind, 45, 4)) continue;
      const dest = () => { const q = firePiles(fs).filter(x => x.kind === (kind === 'branch' ? 'branch' : 'driftwood') && x.logs.length < 12).sort((a, b) => b.logs.length - a.logs.length)[0]; return q ? standNear(q.x, q.z, 1) || fs : fs; };
      return yield* gather(kind, dest, topUp ? Math.max(1, PILE_FULL - best.logs.length) : Math.max(1, Math.ceil((WOOD_WANT - st) / (kind === 'branch' ? 0.5 : 1))));
    }
    return false;
  }

  function* lightFire() {
    const fs = fireSpot(), h = homeSpot();
    if (fireAt(fs)) return true;
    const pile = firePiles(fs).sort((a, b) => fuelOfPile(b) - fuelOfPile(a))[0];
    if (!pile || pile.logs.length < FIRE_MIN || !(game.fibre.carried || game.fire.torch)) return false;
    const mean = pile.logs.reduce((s, l) => s + dryness(l, clock.total), 0) / pile.logs.length;
    if (mean < 0.6) { ev('fire-skipped-wet', { mean: +mean.toFixed(2) }); cool('light'); return false; }
    for (let k = 0; k < 3 && (game.fibre.carried || game.fire.torch) && !fireAt(fs); k++) {
      // the lean-to's side gets the upgrade icon: stand on the far side of the pile so the arc offers to light
      const dx = h.kind === 'leanto' ? pile.x - h.x : 0.9, dz = h.kind === 'leanto' ? pile.z - h.z : 0, l = Math.hypot(dx, dz) || 1;
      const side = standNear(pile.x + dx / l * 0.9, pile.z + dz / l * 0.9) || fs;
      yield* walk(side.x, side.z, { stop: 0.5 });
      if (!pressKind(['light'])) {
        // try the other sides before giving up
        let done = false;
        for (let i = 1; i <= 3 && !done; i++) { const a = i * Math.PI / 2, s2 = standNear(pile.x + Math.sin(a) * 0.9, pile.z + Math.cos(a) * 0.9); if (!s2) continue; yield* walk(s2.x, s2.z, { stop: 0.5 }); done = !!pressKind(['light']); }
        if (!done) { stats.lightRefused++; ev('light-not-offered', { arc: game.action().options.map(o => o.kind).join() }); cool('light'); return false; }
      }
      yield* waitActs(30); yield* waitIdle();
      if (!fireAt(fs) && !game.fire.torch && game.fibre.carried <= 1) break;   // a try that failed: the last tuft is kept for another time
    }
    if (!fireAt(fs)) cool('light', game.fibre.carried <= 1 ? COOL.light * 3 : COOL.light);
    return !!fireAt(fs);
  }

  function* feedFire() {   // from a pile at home (or what is carried): lay dry wood on the fire until it is full
    const fs = fireSpot(), f = fireAt(fs); if (!f) return false;
    if (!W.load()) {
      const pile = [...pilesNear('driftwood', fs.x, fs.z, 8), ...pilesNear('branch', fs.x, fs.z, 8)].filter(q => q.logs.length).sort((a, b) => dist(a, f) - dist(b, f))[0];
      if (!pile) return false;
      yield* walk(pile.x, pile.z, { tap: true, stop: 0.4, until: () => { const a = game.action(); return [a.tap, ...a.options].some(o => o && o.kind === 'pickup' && o.thing && o.thing.kind === 'pile'); } });
      if (pressKind(['pickup'])) yield* waitIdle();
    }
    yield* walk(f.x + 0.8, f.z + 0.4, { stop: 0.7 });
    for (let i = 0; i < 4; i++) { if (!pressKind(['feed'])) break; yield* waitIdle(); }
    yield* layDown();
    return true;
  }

  function* sleepGoal() {
    const s = sleepSpot();
    const ok = yield* walk(s.x, s.z, { stop: 0.5 });
    if (!ok && dist(p, s) > 6) return false;
    for (let i = 0; i < 3; i++) {
      if (!game.sleep.canLie(clock.time)) return false;
      chose = true; sleepKey = true; yield; yield;
      if (game.sleep.asleep || p.lie > 0) return true;
      chose = false; const ang = i * 2.1 + 0.5, s2 = standNear(s.x + Math.sin(ang) * (1 + i), s.z + Math.cos(ang) * (1 + i)); if (s2) yield* walk(s2.x, s2.z, { stop: 0.3 });
    }
    chose = false; ev('sleep-refused'); return false;
  }

  function* gaze() {   // around sunset: stand a while at the shore (or the fire) looking out; no pose
    const h = homeSpot(), fs = fireSpot(h), f = fireAt(fs);
    let spot = null;
    for (let r = 6; r <= 60 && !spot; r += 6) for (let i = 0; i < 24 && !spot; i++) {
      const a = i * Math.PI / 12, x = h.x + Math.sin(a) * r, z = h.z + Math.cos(a) * r, y = world.H(x, z);
      if (y > 0.3 && y < 1.2 && world.H(x + Math.sin(a) * 3, z + Math.cos(a) * 3) < y - 0.15 && inside(x, z) && canStand(world, x, z, 0) && path.cost(p, { x, z }) < 90) spot = { x, z, look: { x: x + Math.sin(a) * 10, z: z + Math.cos(a) * 10 } };
    }
    if (f && !spot) spot = { x: f.x + (p.x - f.x) * 0.4 / Math.max(0.4, dist(p, f)) * 3, z: f.z + (p.z - f.z) * 0.4 / Math.max(0.4, dist(p, f)) * 3, look: { x: f.x, z: f.z } };
    if (!spot) return true;
    yield* walk(spot.x, spot.z, { stop: 0.6 });
    stats.gazes++;
    const until = now + 18 + 12 * rand();
    try { while (now < until && clock.time < GAZE_TO + 0.03) { inp.sit = spot.look; yield; } } finally { inp.sit = false; }   // 0.29.2: he sits and looks out to sea (or into the fire) while he gazes
    return true;
  }

  // ---------- pastimes (0.28.2 "Pastime"): strolls on known ground instead of standing about ----------
  // Places for a stroll, all inside the known ground (`inside`), standable, and within STROLL_RANGE of home: shore (the waterline, where wood washes up), river (fresh water),
  // palms (a round past a palm), forest (a berry bush at a forest edge). Lists of { x, z, ... }; computed when a stroll is chosen, the pick is the PRNG's.
  function strollCands(centre = homeSpot(), range = STROLL_RANGE) {
    const out = { shore: [], river: [], palms: [], forest: [], crabs: crabCands(centre, range) }, tiles = tilesNear(centre.x, centre.z, range);
    for (let r = 8; r <= range; r += 8) for (let i = 0; i < 24; i++) {
      const a = (i + (r / 8 % 2) * 0.5) * Math.PI / 12, x = centre.x + Math.sin(a) * r, z = centre.z + Math.cos(a) * r, y = world.H(x, z);
      if (y > 0.3 && y < 1.2 && world.H(x + Math.sin(a) * 3, z + Math.cos(a) * 3) < y - 0.15 && inside(x, z) && canStand(world, x, z, 0)) out.shore.push({ x, z });
    }
    for (const q of waterPts()) if (Math.hypot(q.x - centre.x, q.z - centre.z) <= range) { const st = standNear(q.x, q.z); if (st) out.river.push({ x: st.x, z: st.z, wx: q.x, wz: q.z }); }
    const around = (o, d) => { const a = rand() * Math.PI * 2; return standNear(o.x + Math.sin(a) * d, o.z + Math.cos(a) * d, 1.5); };
    for (const t of tiles) {
      for (const o of t.palms) if (Math.hypot(o.x - centre.x, o.z - centre.z) <= range && inside(o.x, o.z)) { const st = around(o, 2.4); if (st) out.palms.push({ x: st.x, z: st.z, px: o.x, pz: o.z }); }
      for (const o of game.berries.plantsIn(t)) if (Math.hypot(o.x - centre.x, o.z - centre.z) <= range && inside(o.x, o.z)) { const st = around(o, 1.8); if (st) out.forest.push({ x: st.x, z: st.z, px: o.x, pz: o.z }); }
    }
    return out;
  }
  const pauseHere = function* (chance = PAUSE_CHANCE) { if (rand() >= chance) return; const until = now + PAUSE_MIN + (PAUSE_MAX - PAUSE_MIN) * rand(); while (now < until) yield; };   // stands a moment, looking about
  const pickCand = (list, from, minD = 6) => {   // a random place at least minD from where he stands that he can reach by a way of reasonable length (tries a few)
    const far = list.filter(c => Math.hypot(c.x - from.x, c.z - from.z) >= minD);
    for (let k = 0; k < 4 && far.length; k++) { const c = far.splice(rand() * far.length | 0, 1)[0]; if (path.cost(p, c) < STROLL_MAX_COST) return c; }
    return null;
  };
  // washed-up dry driftwood within a few metres: picked up when he has an arm free and the pile at home has room; brought to the pile on the way home (carried wood is laid down by `deliver`)
  function* pickUpDrift() {
    for (let n = 0; n < 2; n++) {
      const best = bestPile(fireSpot());
      if (W.carried.length >= 2 || (carriedKind() && carriedKind() !== 'drift') || (best && best.kind === 'driftwood' && best.logs.length >= PILE_FULL) || (best && best.kind === 'branch' && fuelOfPile(best) >= WOOD_WANT)) return;
      const t = scan('drift', p.x, p.z, 8)[0]; if (!t) return;
      const before = W.carried.length;
      yield* walk(t.x, t.z, { tap: true, stop: 0.4, until: () => { const a = game.action().tap; return !!a && a.kind === 'pickup' && !!a.thing && a.thing.kind === 'log' && Math.hypot(a.thing.x - t.x, a.thing.z - t.z) < 1.5; } });
      let k = pressKind(['pickup']); if (k) yield* waitIdle();
      yield;
      if (W.carried.length <= before) { markBad('drift', t.o, 600); return; }
    }
  }
  function* deliver() {   // wood under his arm from a stroll goes to the pile at the fire spot (a pile of its own kind within a metre, else a new one there)
    if (!W.carried.length || (carriedKind() !== 'drift' && carriedKind() !== 'branch')) return;
    const fs = fireSpot(), kind = carriedKind() === 'branch' ? 'branch' : 'driftwood';
    const q = firePiles(fs).filter(x => x.kind === kind && x.logs.length < PILE_FULL).sort((a, b) => b.logs.length - a.logs.length)[0], d = q ? standNear(q.x, q.z, 1) || fs : fs;
    if (!(yield* walk(d.x, d.z, { stop: 0.35 }))) return;
    for (let n = 0; n < 3 && W.carried.length; n++) { if (!pressKind(['lay'])) break; yield* waitIdle(); }
  }
  function* arrive(kind, c) {   // what he does at the end of a leg
    if (kind === 'shore') { yield* pauseHere(); yield* pickUpDrift(); return; }
    if (kind === 'river') {
      const empty = game.shells.empty() > 0 || game.thirst.days >= THIRST_TOPUP;
      if (empty) {
        const kinds = game.thirst.days >= THIRST_TOPUP ? ['drink', 'fill'] : ['fill'];
        for (let n = 0; n < 4 && (game.shells.empty() > 0 || game.thirst.days >= THIRST_TOPUP); n++) { if (!pressKind(kinds)) break; yield* waitIdle(); }
      }
      yield* pauseHere(0.7); return;
    }
    if (kind === 'palms') {
      yield* pauseHere(0.7);   // a look up at the crown
      const s = senses(); if (huskWanted(s) && !s.cool.husk && scan('coco', p.x, p.z, 8).length) yield* huskGoal();
      return;
    }
    if (kind === 'forest') {
      yield* pauseHere(0.7);
      const t = game.hunger.days >= EAT_AT ? scan('berry', p.x, p.z, 6)[0] : null;   // a handful from a bush that bears, when he is a little hungry
      if (t) {
        const near = () => { const a = game.action().tap; return !!a && a.kind === 'berries'; };
        yield* walk(t.x, t.z, { stop: 0.4, until: near });
        const k = pressKind(['berries']); if (k) yield* waitIdle(); else markBad('berry', t.o, 600);
      }
    }
  }
  function* stroll(kind, cands) {   // one to three legs (the shore: along the waterline), pauses on the way, then home with what he found
    if (kind === 'crabs') {   // 0.29.1: a crab trip to a colony he knows
      const c = pickCand(cands.crabs, p, 0); if (!c) { cool('crabs'); return true; }
      return yield* crabTrip(c);
    }
    if (cur) cur.limit = STROLL_LIMIT;
    const legs = 1 + (rand() * (kind === 'shore' ? 3 : 2) | 0);
    let list = cands[kind], from = homeSpot();
    for (let leg = 0; leg < legs; leg++) {
      const c = pickCand(list, leg ? p : from, leg ? 8 : 6); if (!c) break;
      ev('stroll', { kind, leg, to: [+c.x.toFixed(1), +c.z.toFixed(1)] });
      const near = kind === 'river' ? () => { const a = game.action(); return [a.tap, ...a.options].some(o => o && (o.kind === 'drink' || o.kind === 'fill')); } : null;
      const ok = yield* walk(c.x, c.z, { stop: kind === 'river' ? 0.3 : 1.2, until: near });
      if (!ok) break;
      yield* arrive(kind, c);
      if (leg + 1 < legs) list = list.filter(q => Math.hypot(q.x - p.x, q.z - p.z) < 35);   // the next stretch (of shore, or the next palm or bush) lies near this one
    }
    yield* deliver();
    return true;
  }

  let lastStroll = null;
  function* idleGoal() {
    const h = homeSpot(), t = clock.time;
    if (t >= GAZE_FROM && t < GAZE_TO && gazedDay !== clock.day) { gazedDay = clock.day; return yield* gaze(); }
    if (W.carried.length) yield* deliver();
    const s = senses();
    if (strollNow(s, rand())) {
      const cands = strollCands(h), kind = strollKind({ shore: cands.shore.length > 0, river: cands.river.length > 0, palms: cands.palms.length > 0, forest: cands.forest.length > 0, crabs: cands.crabs.length > 0 && crabTripOk(s) }, lastStroll, rand());
      if (kind) { lastStroll = kind; stats.strolls = (stats.strolls || 0) + 1; stats.strollKinds[kind] = (stats.strollKinds[kind] || 0) + 1; return yield* stroll(kind, cands); }
    }
    const bf = t >= EVENING && t < BED_FROM ? nearFlame(IDLE_NEAR + SIT_FIRE) : null;   // 0.29.2: an evening with the fire burning: he spends it sitting by it
    if (bf && dist(p, bf) > SIT_FIRE) { const a = Math.atan2(p.x - bf.x, p.z - bf.z), q = standNear(bf.x + Math.sin(a) * SIT_AT_FIRE, bf.z + Math.cos(a) * SIT_AT_FIRE, 1); if (q) yield* walk(q.x, q.z, { stop: 0.5 }); }
    const sp = h.kind === 'leanto' ? fireSpot(h) : { x: h.x, z: h.z };   // else: back to within IDLE_NEAR of home and stands a while
    if (dist(p, sp) > IDLE_NEAR) { const q = standNear(sp.x, sp.z, 3); if (q) yield* walk(q.x, q.z, { stop: 3 }); }
    const until = now + LINGER_MIN + (LINGER_MAX - LINGER_MIN) * rand();
    while (now < until) {
      if (sitKind({ time: clock.time, long: false, fireNear: !!nearFlame(SIT_FIRE), gazing: false }) === 'fire') inp.sit = lookAt(); else inp.sit = false;
      yield;
    }
    return true;
  }

  function* stuffGoal(kind) {
    const s = senses();
    const plan = kind === 'fire' ? fireStep(s) : storesStep(s);
    if (kind === 'fire') {
      if (plan === 'light') return yield* lightFire();
      if (plan === 'feed') { const ok = yield* feedFire(); if (!ok) cool('gather'); return ok; }
      if (plan === 'gather') { const ok = yield* gatherWood(); if (!ok) cool('gather'); return ok; }
      return true;
    }
    if (plan === 'husk') return yield* huskGoal();
    if (plan === 'wood') { const ok = yield* gatherWood(); if (!ok) cool('gather'); return ok; }
    return true;
  }

  const GOALS = { drink: drinkGoal, eat: eatGoal, sleep: sleepGoal, idle: idleGoal, fire: () => stuffGoal('fire'), stores: () => stuffGoal('stores') };

  function startGoal(name) {
    if (name !== 'idle') inp.sit = false;   // 0.29.2: any task but idling needs him on his feet
    cur = { name, t0: now, it: GOALS[name](), rank: RANK[name] }; mind.goal = name; stats.goals[name] = (stats.goals[name] || 0) + 1; ev('goal', { goal: name, thirst: +game.thirst.days.toFixed(2), hunger: +game.hunger.days.toFixed(2) });
    // a torch left in his hand is stuck in the ground first (it cannot be carried with wood)
    if (game.fire.torch && name !== 'fire' && pressKind(['plant'])) { /* the press is done in the next update */ }
  }
  function endGoal(why, failed) {
    if (cur && why) { ev('goal-dropped', { goal: cur.name, why }); }
    if (cur && (failed || why === 'timeout') && cur.name !== 'idle') cool(cur.name);
    try { if (cur) cur.it.return(); } catch (e) { /* the generator is gone anyway */ }
    cur = null; mind.goal = null; idleInput(); chose = false;
  }

  function engage() {
    if (mind.active) return;
    mind.active = true; anchor = { x: p.x, z: p.z }; restUntil = now + 1 + 2 * rand(); mind.resting = true;
  }
  function release() {
    if (!mind.active) return;
    endGoal(); mind.active = false; mind.resting = false; pressed = null; choice = null; sleepKey = false; inp.up = inp.down = inp.left = inp.right = false; idleInput(); inp.sit = false; inp.pace = 1;
  }

  function step(dt) {
    if (!mind.active) return;
    now += dt;
    if (p.sitting > 0.5) stats.sitSecs += dt;
    if (game.sleep.asleep || p.lie > 0) {   // never wakes him, never acts in his sleep
      if (cur) endGoal(); idleInput(); inp.sit = false; pressed = null; choice = null; sleepKey = false;
      if (game.sleep.asleep && p.lie >= 1) slept = { x: p.x, z: p.z };
      return;
    }
    if (busy()) return;   // kneeling or bending: the game finishes it
    sinceCheck += dt;
    if (cur && sinceCheck >= CHECK) {   // a higher need breaks into a lower goal
      sinceCheck = 0;
      const want = chooseGoal(senses());
      if (want in RANK && RANK[want] < cur.rank) endGoal('preempted by ' + want);
      else if (now - cur.t0 > (cur.limit || LIMIT[cur.name])) endGoal('timeout', true);
    }
    if (!cur) {
      const crit = game.thirst.days >= 1 || game.hunger.days >= 2;
      if (now < restUntil && !crit) { mind.resting = true; restSit(); if (!p.moving) stats.idleSecs += dt; return; }
      mind.resting = false;
      const name = chooseGoal(senses());
      if (name === 'idle' && now < restUntil) { mind.resting = true; restSit(); if (!p.moving) stats.idleSecs += dt; return; }   // nothing he can do about a need: no spinning
      if (name === 'none') return;
      startGoal(name);
      if (p.sitting > 0 && !inp.sit) return;   // 0.29.2: he gets up first
    }
    inp.pace = cur && cur.name === 'idle' ? PACE : 1;   // 0.29.2 "Amble": strolls and idling at an amble, errands at the normal walking pace
    if (cur) {
      if (cur.name === 'idle' && !p.moving) stats.idleSecs += dt;
      let r; try { r = cur.it.next(); } catch (e) { ev('error', { goal: cur.name, msg: String(e && e.stack || e).slice(0, 300) }); stats.errors = (stats.errors || 0) + 1; r = { done: true, value: false }; }
      if (r.done) {
        const name = cur.name, failed = r.value === false;
        endGoal(null, failed);
        const rest = restSeconds(rand(), rand());
        restUntil = now + rest; restLong = rest >= REST_LONG_MIN;
      }
    }
  }
  mind.chose = () => chose;
  mind.lastKind = () => lastKind;
  mind.path = path; mind.strollCands = strollCands;
  return mind;
}
