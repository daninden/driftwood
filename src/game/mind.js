/**
 * game/mind — Dave's head (0.28 "Habit" through 0.29.15 "Dry stock"): what the castaway does by himself when the player leaves him alone.
 *
 * After QUIET (30 s, game/input `createTakeover`) without any input main hands the game this mind's input instead of the player's;
 * any input of the player takes it back at once (`release`). The mind adds NO game rule: it fills an input object like the player's
 * (a walk target, a press of the action button, a click on an icon of the arc, Z, a click on the row) and so can do only what a
 * player could do. It looks at the island only where the castaway has been (game/known): its targets and its paths stay inside the
 * known cells and 1.5 m away from their edge (`inside`), so he does not wander off into land he has not seen, except on a search (below) and on an exploring trip (0.29.4). Since 0.29.9 a target at a dynamic solid's centre is approached at its rim, so the same actions still work. It never wakes him from sleep and never starts a sleep before he could choose to.
 * It builds only one thing: his home (0.29.3 "Homestead", below); every other kind of the arc it never chooses.
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
 *             fibre (or a torch in hand), and the fire fed from the piles when its fuel is below FEED_BELOW (0.6 of the most it holds). An ember still counts as a fire: he feeds it through the same player action and drills only when it has truly died. Since 0.29.12, while idle by day he also wakes a home ember he passes with one dry piece already carried; he never fetches wood or feeds flames by day.
 *   5 stores  by day (DAY_FROM 0.2 to EVENING): a nut husked to carry (NUT_WANT 2, game limits) and for fibre (the first tuft always, up to FIBRE_WANT 3 tufts when he is hungry
 *             enough to eat the nut, `huskWanted`), and wood to the pile at the fire spot, as above, then topped up to PILE_FULL (12) pieces, with the pile's own kind only.
 *             Driftwood and branches are never both piled there in piles of 6 or more (the arc would offer to build and not to light)
 *   6 idle    (0.28.2) by day (STROLL_FROM to STROLL_TO, `strollNow`, 9 times in 10) a STROLL on known ground instead of standing about: `strollKind` picks one of shore (the waterline:
 *             one to three stretches along it; dry washed-up driftwood within 8 m is picked up when an arm is free and the pile has room), river (to the water, fills empty shells,
 *             a drink if thirsty), palms (a round past a palm or two; husks a nut on the ground if the stores want one) or forest (a berry bush or two; a handful from one that bears
 *             when hunger is BERRY_PICK 0.2 days or more, 0.29.2; was a third), never the same kind twice in a row; places drawn from the PRNG among the known ones (`strollCands`: inside the known ground, standable,
 *             within STROLL_RANGE 80 m of home, a way of at most STROLL_MAX_COST), pauses of 2 to 6 s on the way (PAUSE_CHANCE), wood carried is laid on the pile at home (`deliver`).
 *             Otherwise (night, nothing to walk to) he walks back to within IDLE_NEAR (8 m) of home and lingers 5 to 12 s. Once a day around sunset (GAZE_FROM 0.76 to 0.83) he walks
 *             to the shore (or the fire) and sits a while looking out. No line of text. After each task he stands 3 to 8 s, now and then (1 in 5) 15 to 30 s (`restSeconds`, from the seed)
 *   0.29.1 a sixth pastime, the CRAB TRIP (`crabTripOk`: a stroll kind 'crabs', and food when hungry with flames and no near nut, `crabFoodOk`): at low water (CRAB_TIDE), CRAB_FROM 0.38 (0.29.2, was 0.42) to CRAB_TO 0.66, to a colony he knows
 *             (`crabCands`), the crabs flee into holes as he nears, he presses dig beside one that hides (at most CRAB_DIGS 4 a trip, until CRAB_WANT 1 crab is carried), and roasts it at the evening fire as supper
 *   0.29.2 "Amble": PACE. While 'idle' is the goal (the strolls, the walk home to rest, the gaze walk, the five kinds) he walks at PACE (0.65) of his walking speed with shorter, slower steps (input.pace, game/game);
 *   errands (drink, eat, sleep, fire, stores, a search, a crab trip for food) go at the normal pace, and a run is never slowed. SITTING (input.sit, `sitKind`): on the ground, facing what he looks at (the fire within SIT_FIRE,
 *   else out to sea where the ground falls away, else the way he faces), in the sunset gaze, on an evening at the fire (EVENING to BED_FROM, with flames within SIT_FIRE: he walks to SIT_AT_FIRE m from it) and in the long rests by day (STROLL_FROM to GAZE_FROM).
 *   Any task but idling (and a walk) first gets him up (game/game: half a second). The game refuses a seat in water, on steep ground or a climbing route, with a torch or wood: he then stands. At night, once he may lie down, no rest comes first.
 * 0.29.3 "Homestead": HOME, a project that takes the morning's idle moments (`homeNext`, pure; part of the idle goal, at the amble): from the third day (HOME_DAY 2, two nights lived) with a camp (a fire of his, lit or burnt out, or the place he sleeps) he builds ONE lean-to and then
 *   its upgrades, walls (6 fronds), stone ring (8 stones), bed (4 branches and 4 fronds), through the very actions a player has (the arc's build / upgrade icon). A step of the project (a trip for up to three pieces,
 *   or the building) is what he does at an idle moment of the morning, between HOME_FROM 0.21 and HOME_TO 0.44 (0.29.4, was 0.38: mornings are for the house, a crab trip at low water comes first, the afternoon belongs to the tide and the crabs, the evening to the fire; every need
 *   and every errand comes first), and at most one piece of the home is finished a day (`builtDay`). The site (`leantoSites`, chosen once and kept): on known, dry, level ground at least SITE_HIGH (0.8 m) above the high-water line, 5 to 7.5 m from his home fire, the open side across
 *   from the fire (so the stone ring comes to stand about 5 m from it, not on it), preferring ground near fresh water he knows; the piles for the building (6 driftwood and 6 branches, within 2 m of each other) are laid there.
 *   Never a second lean-to: with one (also a player's) the project only adds the upgrades to it, and a half-built one is built on. Materials only from known ground, within HOME_MAX_COST of walking; piles for the upgrades lie
 *   beside the lean-to (fronds on one side, stones on the other, branches behind).
 * 0.29.4 "Wander": EXPLORING, a pastime of the idle goal. Now and then (`exploreChance`, pure: by day, EXPLORE_FROM 0.2 to EXPLORE_TO 0.52, thirst and hunger well below the point where he goes for them, no crab trip to make; at most one trip a day, one in
 *   EXPLORE_GAP 2 days when nothing is missing, every day with chance 0.8 when wood (fewer than 6 loose logs known within 70 m of home), branches (fewer than 4) or nuts (fewer than 2) are short, or a lately failed search for them left a mark (`lack`)) he walks to the edge of what he knows
 *   (`exploreTarget`: the farthest unknown spot within `exploreReach(day)` of home (80 m on day 0, 15 m more a day, at most 220 m) that borders known ground, which he can reach and be home from before EXPLORE_BACK 0.6, preferably on the coast (wood and coconuts) or at a forest edge (branches, berries),
 *   `exploreWhere`; the PRNG of its own, `rngEx`), at the amble, learning what he walks past (`input.learns` true; `mind.exploring`, not `mind.searching`), looks about, picks up what is within reach of the far end (the arrive kinds shore, palms, forest), (also straight from the stores goal, `exploreForLack`: wood or a nut he went for and could not find on known ground sends him out at once when a trip is allowed, without waiting for an idle moment that the stores and the fire may never leave him) and turns back in time (`exploreLate`: the walk home, measured by the finder every 10 m,
 *   and the margin, against EXPLORE_BACK; at the normal pace when it is late) to lay down what he carries at home. His own terrace and ordinary ground only: the finder `pathExplore` closes climbing routes (climb above EXPLORE_ROUTE) and steep ground (slope 0.45 and more), and a trip is only made from a place from which home can be reached that way.
 * 0.29.5 "Drying" / 0.29.15 "Dry stock": DRYING WOOD. Wood in the strip between the tides never dries (game/wood: the sea covers it again and again), and the fire and his strolls take dry wood only. On a shore stroll (not at the far end of an exploring trip), with
 *   nothing but wet driftwood (or nothing) under his arm, he also takes up to two pieces of such wet wood from the strip within 8 m of where the leg ends (`pickUpWet`, `SRC.strip`) and lays them on a DRYING PILE of his own (`deliverWet`, `deliver` for any wood that is not
 *   dry enough, DRY_AT = the 0.75 the fire and the torch ask for): above the high-water line at his camp (`dryingSite`, worked out again from the fire and the known ground, so nothing is saved), DRY_RINGS (3.6, 4.6) m from the fire place, clear of the fire's pile,
 *   of other driftwood piles and of the lean-to's site; or, with a finished lean-to, DRY_LT (1.9) m from its middle straight behind it (beside its keep-free region, rule (a); inside the 2.5 m where the rain does not reach once it has walls). It holds at most DRY_MAX (5) pieces (never a pair of 6 and 6: the arc would offer to build).
 *   Once the top pieces of a drying pile are dry enough (`readyPile`) the stores and the evening wood goal fetch them for the fire's pile (`fetchDried`, in `gatherWood`) before they go to the beach for more. In the ordinary daytime idle rhythm, one small stock errand first does the same dry transfer when fire stock has room, then fetches up to two wet, above-water strip logs from known ground to refill a drying pile only while it is below DRY_MAX. It cannot become beach cleanup: it stops at that five-piece reserve. The fire's piles never count a drying pile (`isDrying`), wet wood never goes on the fire's pile, and the lean-to project still takes wet logs as before. The same actions as a player's: pick up, lay down.
 * The other exception to staying on known ground (0.28, decided later the same day): SEARCH. Thirsty with no fresh water known, or hungry with no food known and none
 * carried, he walks out from home into the unknown, ring after ring, to the nearest unknown spot that borders what he knows (downhill for water, the low coast for
 * food before the inland), learning what he walks past (`input.learns` true; `mind.searching`), until water he can walk to over known ground, or food, is known; then he is back on known ground only (0.29: water that is known but out of reach does not end a search).
 * A higher need breaks into a lower goal (checked every CHECK seconds), except while an actual material errand is under way: it delivers first. Very thirsty or very hungry needs still break in; a goal keeps going otherwise and a failing one is left alone for a while (`cool`; 0.28.2: 10 to 40 s, a failed
 * light 100 s, or 300 s when one tuft of fibre is left; a failed try keeps the last tuft).
 * Walking a path (0.30.3 "Routes"): `walk` is a thin wrapper over game/route, the one follower: it pulls the string over the next route points (he heads for the furthest of the next four he can see by the rule of game/walk),
 * closes a segment he made no progress on for 0.7 s and plans again (at most three times: then `stats.stuck` counts each such stall, an event 'stuck' names it, and the walk fails), and reports no way at all as `stats.nopath` and an event 'nopath'.
 * There are no bans and no hand steering. He walks; only very thirsty (thirst >= 0.95) and far (20 m or more) does he run.
 *
 * chooseGoal(s) -> 'drink' | 'eat' | 'sleep' | 'fire' | 'stores' | 'idle' | 'none'   pure; s: { asleep, time, thirst, hunger, awake, canLie, water, waterNear,
 *   shellsEmpty, shellsFull, nuts, fibre, torch, fireLit, fireFuel (0..1), stock (pieces' worth of wood in the biggest pile at the fire spot), spare (in the other piles there), cool: {name: true}, canLight }
 * fireStep(s) -> 'light' | 'feed' | 'gather' | null,  storesStep(s) -> 'husk' | 'wood' | null   pure; what the fire / stores goal does now (s.pileLogs: pieces in the biggest pile there)
 * exploreChance(s), exploreReach(day), exploreWhere(missing, trips), exploreLate(time, secs, speed?)   pure (0.29.4): whether, how far, where to and when to turn back, tested in tests/mind.test.js
 * crabTripOk(s), crabFoodOk(s)   pure (0.29.1): may he go for crabs now (s.sea, time, crabs carried, flames, canLight, fibre, pileDry, cool)
 * huskWanted(s), restSeconds(r1, r2), strollKind(avail, last, r), strollNow(s, r)   pure; the choices of the pastimes (0.28.2), tested in tests/mind.test.js
 * sitKind(s) -> 'gaze' | 'fire' | 'rest' | null   pure (0.29.2): whether he sits while he rests (s: time, long, fireNear, gazing)
 * DRY_AT, DRY_MAX, DRY_NEAR, DRY_RINGS, DRY_FIRE, DRY_CLEAR, DRY_LT, STOCK_MAX_COST   (0.29.5 / 0.29.15) the numbers of the drying pile and small stock errand
 * homeNext(s) -> 'leanto' | 'walls' | 'ring' | 'bed' | null   pure (0.29.3): the next piece of his home now (s: day, time, fire (he has a camp), lean ('none' | 'half' | 'done' | 'other'), up {walls, ring, bed: 0..1}, builtDay, cool)
 * RANK   the priority of each goal (lower wins)
 * errandPreempts(current, next, errand, thirst, hunger) -> bool  0.29.8 preemption rule, pure
 * exactPileDrop(from, to) -> { x, z, heading } the approach for an ordinary first-pile drop that lands exactly at to
 * createMind(world, game, opts?) -> mind
 *   mind.input        the input-like object main passes to game.update while the mind is in charge: up, down, left, right false, run, stick null, target, yaw (main sets
 *                     it from the view; the mind sets it itself while it starts the building of a lean-to, as a player turns the view), pace (1, or PACE while idling) and sit (false, true or a point to look at; 0.29.2), learns false except while searching (the game then learns no new ground from his steps), takeWake always false, takeAction / takeChoice / takeSleep /
 *                     takeLight, pressing(), clearTarget(), cancelAction()
 *   mind.engage()     the mind takes over (remembers where he stands as the last home); mind.release() the player takes over: the goal is dropped, the input cleared.
 *                     A kneeling job already begun is left to finish (the player's own input stops it as usual)
 *   mind.step(dt)     once per game.update while in charge, before it: decides and fills mind.input
 *   mind.active, mind.goal (name or null), mind.resting (true while standing still after a task), mind.walking (a walk target is set), mind.searching (learning on a search for water or food), mind.exploring (on an exploring trip, 0.29.4)
 *   mind.stats        { goals: {name: n}, home, stuck, nopath, idleSecs, sitSecs (seconds he sat), sits: {gaze, fire, rest: how often he sat down}, lightRefused, gazes, strolls, strollKinds: {kind: n}, explores (trips made), exploreSecs, drying: { sites, wetTaken, laid, moved } (0.29.5), crabTrips, crabDigs, crabTripDigsMax, crabsCaught, events: [..] } for tests and the playtest bot (searches: how many searches he began)
 *   mind.chose()      true while a sleep he chose himself is being started (the tests tell it from a collapse); mind.lastKind() the kind of the last button he used; mind.path the path finder
 *   opts.stream       a number to vary the chance (default 0)
 *   opts.onIntent     optional presentation callback before a situation-led errand, once per thought kind per goal; it changes no game state or decisions (0.30.1)
 *   mind.home()       { kind: 'leanto' | 'fire' | 'bed' | 'here', x, z }
 *   mind.dryingSite()  the place of the drying pile for his camp as it is (or null), { x, z, ux, uz, lean, of }; mind.dryPiles() the piles of wood on drying sites (for the tests)
 *   mind.strollCands(centre?, range?)  { shore, river, palms, forest, crabs: [{x, z}] } the places a stroll may go to (all on known ground; for the tests)
 *   mind.homePlan()   { step (homeNext without the time window), need (what the next unit does: { kind, want } a trip for pieces of that kind, { build } the building, or null), site } for the tests
 *   mind.leantoSites(fire)  the places for the lean-to round a fire, best first: [{ x, z, heading, score, r }]; mind.stats.home { units, trips, builds, refused, noMaterial }
 *   mind.materialFind(kind, range?)  nearest eligible loose material or abandoned pile by path cost (test helper)
 *
 * Everything he decides from comes from the game objects; the only chance is a PRNG seeded from the island (core/noise), so a run is repeatable.
 *
 * Depends on: game/path, game/route, game/movement, game/clock (DAY_SECONDS), game/wildlife and game/crabs (through game), game/water, game/wood (dryness, inStripY), game/fire (TORCH_DRY), game/leanto (siteFor, UPGRADES), game/shells, game/sleep, game/known (through game.known), world/constants, core/noise
 */
import { mulberry32, hashInt } from '../core/noise.js';
import { HALF, T, NT } from '../world/constants.js';
import { createPath } from './path.js';
import { createRoute } from './route.js';
import { canStand, terrainAt, PACE, WALK_SPEED } from './movement.js';
import { DAY_SECONDS } from './clock.js';
import { freshWater } from './water.js';
import { dryness, logTop, kindOf, inStripY, CARRY_MAX, STONE_MAX, PILE_FRONT } from './wood.js';
import { FIRE_MIN, FUEL_MAX, TORCH_DRY } from './fire.js';
import { ringCentre, siteFor, UPGRADES, UP_NEAR, NEED, RING_AT, paidSteps } from './leanto.js';
import { DAWN as SLEEP_DAWN } from './sleep.js';
import { EAT_AT } from './shells.js';

export const THIRST_GO = 0.35, THIRST_TOPUP = 0.2, THIRST_SIP = 0.15, NEAR_WATER = 40;   // 0.29 "Daily bread": a drink every 8 hours or so (thirsty is 12), three or four times a day with the shells and the evening's
export const HUNGER_GO = 0.4, TIRED_GO = 1;   // a meal at hunger 0.4 (a coconut takes 0.5 off); a nap by day only when he has been awake a whole day
export const VERY_AT = 1, VERY_HUNGER_AT = 2;   // 0.29.8 "Errand": the half-day-before-collapse thirst and the two-day hunger emergency still interrupt an errand
export const BED_THIRST = 0.25, BED_HUNGER = 0.3, SUPPER_FROM = 0.64;   // from SUPPER_FROM to LIGHT_FROM (supper, a drink before the night) he goes for a need a little earlier, so that he does not wake parched or hungry and is free to light the fire
export const EVENING = 0.6, LIGHT_FROM = 0.74, BED_FROM = 0.87, DAWN = SLEEP_DAWN, DAY_FROM = 0.2, GAZE_FROM = 0.76, GAZE_TO = 0.83;
export const WOOD_WANT = 6, NUT_WANT = 2, FIBRE_WANT = 3, PILE_FULL = 12, FEED_BELOW = 0.6, LIGHT_MIN_FUEL = 3, IDLE_NEAR = 8;   // 0.28.2: stores up to a full pile (PILE_MAX of game/wood) and 3 tufts (FIBRE_MAX of game/fibre)
export const SEARCH_LIMIT = 900;   // seconds a goal may take while it is searching for water or food
export const REST_MIN = 3, REST_MAX = 8, REST_LONG_MIN = 15, REST_LONG_MAX = 30, REST_LONG_CHANCE = 0.2, CHECK = 1.5;   // 0.28.2: mostly a short rest, now and then a long one
export const STROLL_FROM = 0.19, STROLL_TO = 0.8, STROLL_CHANCE = 0.9, STROLL_LIMIT = 300, STROLL_RANGE = 80, STROLL_MAX_COST = 150;   // pastimes on known ground, by day (0.28.2)
export const BERRY_PICK = 0.2;   // 0.29.2: a stroll through the forest takes a handful from a bush that bears from this hunger (days; was EAT_AT, a third of a day): fewer strolls fit into a day at the amble, and the berries must not vanish from his meals
export const SIT_FIRE = 3.5, SIT_AT_FIRE = 1.8;   // 0.29.2 "Amble": he sits at a fire with flames within SIT_FIRE m; to sit by one he walks to SIT_AT_FIRE m from it
export const LINGER_MIN = 5, LINGER_MAX = 12, PAUSE_CHANCE = 0.45, PAUSE_MIN = 2, PAUSE_MAX = 6;
export const STROLL_KINDS = ['shore', 'river', 'palms', 'forest', 'crabs'], STROLL_WEIGHT = { shore: 3, river: 2, palms: 2, forest: 2, crabs: 12 };   // 0.29.1: crabs, only at low water in the afternoon, so when it is possible it is the usual choice (0.29.2: weight 12, was 6, and the window opens at 0.38, was 0.42: at the amble each stroll takes half as long again, so fewer fitted into the window)
export const CRAB_TIDE = -0.2, CRAB_FROM = 0.38, CRAB_TO = 0.66, CRAB_FOOD_TO = 0.8, CRAB_DIGS = 4, CRAB_WANT = 1, CRAB_ROAST_HUNGER = 0.2, CRAB_SEEK = 10, NUT_FAR = 50, CRAB_LIMIT = 420;   // 0.29.1 "Low water": crab trips
export const HOME_DAY = 2, HOME_FROM = 0.21, HOME_TO = 0.44, HOME_LIMIT = 480, HOME_MAX_COST = 50, HOME_ORDER = ['walls', 'ring', 'bed'];   // 0.29.3 "Homestead": he builds his home from day 2 (the third day), in the morning (0.29.4: until 0.44, was 0.38; a crab trip comes first), one piece a day
export const SITE_RINGS = [5, 6.2, 7.5], SITE_HIGH = 0.8, SITE_LEVEL = 0.3, SITE_SLOPE = 0.25;   // the lean-to's site: 4 to 7 m from the home fire, 0.8 m above the high-water line (the sea stands at 0 at high water), the footprint level within 0.3 m
// 0.29.4 "Wander": now and then, by day and when nothing presses, he goes exploring to the edge of what he knows, on his own terrace, and is home well before dark
export const EXPLORE_FROM = 0.2, EXPLORE_TO = 0.52, EXPLORE_BACK = 0.6, EXPLORE_MARGIN = 0.012, EXPLORE_DETOUR = 1.5, EXPLORE_SPARE = 45, EXPLORE_LIMIT = 900, EXPLORE_ROUTE = 0.12;   // starts between FROM and TO, is home by BACK (where the evening's chores begin), with a margin; ground with a climbing route of more than EXPLORE_ROUTE is closed
export const EXPLORE_THIRST = 0.25, EXPLORE_HUNGER = 0.3, EXPLORE_GAP = 2, EXPLORE_CHANCE = 0.3, EXPLORE_MISSING_CHANCE = 0.8, LACK_DAYS = 2;   // nothing urgent; every EXPLORE_GAP-th day, or every day when something is missing at home
export const EXPLORE_REACH0 = 80, EXPLORE_REACH_DAY = 15, EXPLORE_REACH_MAX = 220, EXPLORE_EDGE = 18, EXPLORE_SLOPE = 0.45;   // how far from home a trip may go: 80 m on the first day, 15 m more each day, at most 220 m
// 0.29.5 "Drying": wet wood from the strip between the tides is laid on a drying pile of its own above the high-water line at his camp (under or beside the lean-to when there is one), and moved to the fire's pile once it is dry enough to burn
export const DRY_AT = TORCH_DRY, DRY_MAX = NEED - 1, DRY_NEAR = 1.6, DRY_RINGS = [3.6, 4.6], DRY_FIRE = 2.6, DRY_CLEAR = 4.5, DRY_LT = 1.9, STOCK_MAX_COST = 90;   // DRY_AT: the dryness the fire and the torch ask for; DRY_MAX: never 6 (a pair of piles of 6 would make the arc offer to build); the pile lies DRY_RINGS m from the fire, or DRY_LT m from the middle of the lean-to, at least DRY_FIRE from the fire's own pile and DRY_CLEAR from the lean-to's site; the active stock errand stays a short known-ground trip
export const UP_AT = 2.1;   // 0.30.3 rule (a): the piles of the upgrades lie this far from the lean-to's middle, beside its keep-free region (a pile's solid is 0.65) and within UP_NEAR (3)
export const RANK = { drink: 0, eat: 1, sleep: 2, fire: 3, stores: 4, idle: 5 };
const LIMIT = { drink: 160, eat: 220, sleep: 420, fire: 240, stores: 240, idle: 90 };   // seconds a goal may take before it is dropped
const COOL = { crabs: 240, drink: 20, eat: 30, sleep: 20, light: 100, gather: 30, husk: 40, fire: 10, stores: 10, home: 300, explore: 600 };   // seconds a failed goal is left alone (0.28.2: about a third of before; a failed light waits 3 times as long when only one tuft of fibre is left)
const ALLOWED = ['drink', 'fill', 'pickup', 'lay', 'feed', 'husk', 'berries', 'bananas', 'roast', 'dig', 'plant', 'light', 'build', 'upgrade'];   // the kinds of the arc / ring he ever chooses (never the torch); build and upgrade only in the home project (0.29.3)

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

/** 0.29.3 "Homestead": the next piece of his home (pure). s: { day, time, fire (he has a camp: a fire of his, lit or burnt out, or the place he sleeps), lean ('none': no lean-to at all, 'half': one is half built on ground he knows, 'done': his home is a
 *  finished lean-to, 'other': one exists he cannot use), up ({walls, ring, bed}: progress 0..1 of the finished lean-to's upgrades), builtDay (the day something was last finished), cool }. By day (HOME_FROM to HOME_TO), from day HOME_DAY, at most one
 *  piece finished a day. Returns 'leanto' (build it, or build on), else the first unfinished upgrade in HOME_ORDER (walls, ring, bed), else null. */
export function homeNext(s) {
  if ((s.cool && s.cool.home) || !(s.time >= HOME_FROM && s.time < HOME_TO) || s.day < HOME_DAY || s.builtDay === s.day) return null;
  if (s.lean === 'half') return 'leanto';
  if (s.lean === 'none') return s.fire ? 'leanto' : null;
  if (s.lean !== 'done') return null;
  return HOME_ORDER.find(k => !(s.up && s.up[k] >= 1)) || null;
}

/** 0.29.4 "Wander": the chance, at an idle moment, that he sets out exploring now (pure). s: { time, day, thirst, hunger, last (the day of the last trip), missing (how many of wood, branches, nuts are short at home), cool, crab (a crab trip is possible now) }.
 *  Never when a need is coming up (thirst, hunger), a crab trip is on, or outside EXPLORE_FROM to EXPLORE_TO; at most one trip a day, one in EXPLORE_GAP days when nothing is missing, every day when something is. */
export function exploreChance(s) {
  if (!(s.time >= EXPLORE_FROM && s.time < EXPLORE_TO) || (s.cool && s.cool.explore) || s.crab) return 0;
  if (s.thirst >= EXPLORE_THIRST || s.hunger >= EXPLORE_HUNGER) return 0;
  if (s.day - s.last < (s.missing > 0 ? 1 : EXPLORE_GAP)) return 0;
  return s.missing > 0 ? EXPLORE_MISSING_CHANCE : EXPLORE_CHANCE;
}
/** How far from home a trip may go on this day (metres): grows a little each day. */
export function exploreReach(day) { return Math.min(EXPLORE_REACH_MAX, EXPLORE_REACH0 + EXPLORE_REACH_DAY * Math.max(0, day)); }
/** Where he expects what is missing: 'coast' (driftwood and coconuts wash up and grow there) or 'forest' (branches, berries); nothing missing: the coast and the forest in turn (trips = trips so far). */
export function exploreWhere(missing, trips) {
  if (missing && missing.length) return missing.includes('wood') || missing.includes('nuts') ? (missing.includes('branches') && trips % 2 ? 'forest' : 'coast') : 'forest';
  return trips % 2 ? 'forest' : 'coast';
}
/** Whether it is time to turn back: the walk home (`secs` seconds at full pace; at `speed`, the share of it that he walks) would end after EXPLORE_BACK less the margin (a tenth more for the way). */
export function exploreLate(time, secs, speed = 1) { return time + secs * 1.1 / speed / DAY_SECONDS + EXPLORE_MARGIN >= EXPLORE_BACK; }

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

/** Whether a newly higher-ranked goal may stop the current one. Actual errands finish unless thirst or hunger is an emergency. */
export function errandPreempts(current, next, errand, thirst, hunger) {
  if (!(next in RANK) || RANK[next] >= RANK[current]) return false;
  return !errand || (next === 'drink' && thirst >= VERY_AT) || (next === 'eat' && hunger >= VERY_HUNGER_AT);
}

/** The standing point and facing that make the ordinary first-pile drop land exactly at `to`. */
export function exactPileDrop(from, to) {
  const dx = to.x - from.x, dz = to.z - from.z, len = Math.hypot(dx, dz) || 1, heading = Math.atan2(dx / len, dz / len);
  return { x: to.x - Math.sin(heading) * PILE_FRONT, z: to.z - Math.cos(heading) * PILE_FRONT, heading };
}

export function createMind(world, game, opts = {}) {
  const onIntent = typeof opts.onIntent === 'function' ? opts.onIntent : null;
  const p = game.player, clock = game.clock, W = game.wood, known = game.known;
  const rng = mulberry32(hashInt(world.seed + 28, opts.stream || 0, 1)), rngEx = mulberry32(hashInt(world.seed + 29, opts.stream || 0, 2));   // exploring (0.29.4) draws from a stream of its own, so that the days without a trip stay as they were
  // ground he may be taken over: known all round, MARGIN (1.5 m) inside the edge of what he knows, so that sliding past a trunk or a bush never carries him into a cell he has not been to
  const MARGIN = 1.5, DIAG = MARGIN * 0.75;
  const inside = (x, z) => known.has(x, z) && known.has(x + MARGIN, z) && known.has(x - MARGIN, z) && known.has(x, z + MARGIN) && known.has(x, z - MARGIN)
    && known.has(x + DIAG, z + DIAG) && known.has(x - DIAG, z - DIAG) && known.has(x + DIAG, z - DIAG) && known.has(x - DIAG, z + DIAG);
  const path = createPath(world, { allow: inside, allowVersion: () => known.count, obstacles: game.movement.obstacles }), pathFree = createPath(world, { obstacles: game.movement.obstacles });   // pathFree: only for a search for water or food (the one time he goes into unknown ground)
  const stats = { drying: { sites: 0, wetTaken: 0, laid: 0, moved: 0, stockErrands: 0 }, goals: {}, stuck: 0, nopath: 0, idleSecs: 0, lightRefused: 0, gazes: 0, sitSecs: 0, sits: {}, searches: 0, strolls: 0, strollKinds: {}, home: { units: 0, trips: 0, builds: 0, refused: 0, noMaterial: 0 }, explores: 0, exploreSecs: 0, crabTrips: 0, crabDigs: 0, crabTripDigsMax: 0, crabsCaught: 0, events: [] };
  const mind = { input: null, active: false, get searching() { return inp.learns === true && !exploring; }, get exploring() { return exploring; }, goal: null, resting: false, stats, step, engage, release, home: homeSpot, get walking() { return !!inp.target; } };
  let exploring = false, exploredDay = -9, fullPace = false, now = 0, cur = null, restUntil = 0, restLong = false, anchor = { x: p.x, z: p.z }, slept = null, gazedDay = -1, chose = false, lastKind = null;
  let pressed = null, choice = null, sleepKey = false, sinceCheck = 0, builtDay = -1, headingWanted = null, errands = 0;   // headingWanted: the way a lean-to being started should face (a player turns the view)
  const proj = { site: null, dry: [], dryNo: null, wetIds: new Set(), laidIds: new Set(), movedIds: new Set() };   // 0.29.3: the lean-to's site, chosen once and kept; 0.29.5/15: drying sites (newest last) and the actual log identities counted by the drying trace
  const coolUntil = {}, bad = new Map();
  const inp = mind.input = {
    up: false, down: false, left: false, right: false, run: false, stick: null, target: null, yaw: undefined, learns: false, pace: 1, sit: false,
    takeWake: () => false, takeLight: () => false, pressing: () => false, cancelAction() { pressed = null; }, clearTarget() { inp.target = null; },
    takeAction: () => { const k = pressed; pressed = null; return k; }, takeChoice: () => { const k = choice; choice = null; return k; }, takeSleep: () => { const k = sleepKey; sleepKey = false; return k; },
  };
  const ev = (type, data) => { if (stats.events.length < (type.startsWith('home') ? 900 : 400)) stats.events.push({ type, day: clock.day, time: +clock.time.toFixed(3), x: +p.x.toFixed(1), z: +p.z.toFixed(1), ...data }); };
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
  const pileIds = new WeakMap();   // a pile has no id of its own: an identity for the list of things he gave up on
  const idOf = o => { if (o.id !== undefined) return o.id; let i = pileIds.get(o); if (i === undefined) pileIds.set(o, i = 'pile' + pileIds.size); return i; };
  const isBad = (kind, o) => (bad.get(kind + ':' + idOf(o)) || 0) > now;
  const markBad = (kind, o, secs = 400) => { bad.set(kind + ':' + idOf(o), now + secs); };
  function* errand(run) {   // only the concrete fetch / delivery is protected, never its enclosing idle pastime
    errands++;
    try { return yield* run(); } finally { errands--; }
  }
  const SRC = {
    coco: t => game.fibre.groundCocos(t),
    berry: t => game.berries.bearingIn(t),
    banana: t => game.bananas.bearingIn(t),
    drift: t => W.beachLogs(t).filter(l => dryness(l, clock.total) >= 0.95 && logTop(l) > game.sea + 0.02),
    timber: t => W.beachLogs(t).filter(l => logTop(l) > game.sea + 0.02),   // 0.29.3: for building, wet driftwood will do
    strip: t => W.beachLogs(t).filter(l => inStripY(l.y) && dryness(l, clock.total) < 0.95 && logTop(l) > game.sea + 0.02),   // 0.29.5: wet wood in the strip between the tides (it never dries there)
    branch: t => game.branches.groundBranches(t),
    frond: t => game.fronds.groundFronds(t),   // 0.29.3: the materials of the home
    stone: t => game.stones.groundStones(t),
  };
  const scan = (kind, x, z, r) => {
    const out = [];
    for (const t of tilesNear(x, z, r)) for (const o of SRC[kind](t)) { const d = Math.hypot(o.x - x, o.z - z); if (d <= r && inside(o.x, o.z) && !isBad(kind, o) ) out.push({ o, d, x: o.x, z: o.z, id: o.id }); }
    return out.sort((a, b) => a.d - b.d);
  };
  const nearestBy = (kind, r = 45, k = 4) => {   // nearest loose and pile candidates, each weighed by actual walking cost
    let best = null;
    for (let rr = r; rr <= 200 && !best; rr *= 2.5) for (const c of [...scan(kind, p.x, p.z, rr).slice(0, k), ...pileFinds(kind, p.x, p.z, rr).sort((a, b) => a.d - b.d).slice(0, k)]) {
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

  const openNear = (x, z, r = 1.2) => {   // like standNear, and clear of every solid of the camp (a pile, a fire place, a wall): a spot a walk can end at
    const camp = game.movement.obstacles.camp, ok = (a, b) => inside(a, b) && canStand(world, a, b, 0) && world.H(a, b) > 0.4 && !camp.inside(a, b, 0.1);
    if (ok(x, z)) return { x, z };
    for (let rr = 0.25; rr <= r + 1e-9; rr += 0.25) for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr; if (ok(px, pz)) return { x: px, z: pz }; }
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
  const isDrying = q => !!q && q.kind === 'driftwood' && proj.dry.some(s => s.pile ? s.pile === q : Math.hypot(q.x - s.x, q.z - s.z) <= DRY_NEAR);   // 0.29.15: once a site has laid wood, keep its actual pile identity; position is only the first-pile/load fallback
  const firePiles = fs => W.piles.filter(q => (q.kind === 'driftwood' || q.kind === 'branch') && Math.hypot(q.x - fs.x, q.z - fs.z) <= 2.4 && !isDrying(q));
  const bestPile = fs => firePiles(fs).sort((a, b) => fuelOfPile(b) - fuelOfPile(a))[0] || null;
  const fireAt = fs => game.fire.fires.find(f => dist(f, fs) < 3.5 && (f.fuel > 0.005 || f.embers > 0.005)) || null;
  const pileKind = kind => kind === 'drift' || kind === 'timber' ? 'driftwood' : kind;
  const ownPile = q => {
    const fs = fireSpot();
    return isDrying(q) || firePiles(fs).includes(q) || (proj.site && Math.hypot(q.x - proj.site.x, q.z - proj.site.z) <= 2.2)
      || game.leantos.list.some(l => Math.hypot(q.x - l.x, q.z - l.z) <= UP_NEAR);
  };
  const pileFinds = (kind, x, z, r) => W.piles.filter(q => q.kind === pileKind(kind) && q.logs.length && inside(q.x, q.z) && !ownPile(q) && !isBad(kind, q) && Math.hypot(q.x - x, q.z - z) <= r)
    .map(q => {
      const top = q.logs.slice(-Math.min(kind === 'stone' ? STONE_MAX : CARRY_MAX, q.logs.length));
      const dry = kind !== 'drift' || top.every(l => dryness(l, clock.total) >= 0.95);
      return dry ? { o: q, d: Math.hypot(q.x - x, q.z - z), x: q.x, z: q.z, id: q.id, pile: q } : null;
    }).filter(Boolean);

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
  const setSit = (look, kind) => { if (look && !inp.sit) stats.sits[kind] = (stats.sits[kind] || 0) + 1; inp.sit = look; };   // sits (look: a point to look at, or true) or stands (false); counts each sitting down by its kind
  function restSit() {
    const kind = sitKind({ time: clock.time, long: restLong, fireNear: !!nearFlame(SIT_FIRE), gazing: false });
    setSit(kind ? lookAt() : false, kind);
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
  function pressKind(kinds, ok = null) {   // a small action of one of kinds (and, with ok, one it accepts): the ring if it is the main one, else its icon in the arc; returns the kind or null
    const a = game.action(), want = kinds.filter(k => ALLOWED.includes(k)), fits = o => want.includes(o.kind) && (!ok || ok(o));
    inp.sit = false;
    if (a.tap && fits(a.tap)) { lastKind = a.tap.kind; pressed = 'tap'; return a.tap.kind; }
    const i = a.options.findIndex(fits);
    if (i >= 0) { lastKind = a.options[i].kind; choice = i; return lastKind; }
    return null;
  }
  const useRow = kind => { lastKind = 'use:' + kind; idleInput(); inp.sit = false; return game.use(kind, inp); };

  // ---------- walking ----------
  function* walk(x, z, o = {}) {   // to (x, z): true when he got there (or until() is true), false when there is no way; inside known ground (o.free: anywhere, for a search). 0.30.3: a thin wrapper over game/route
    // A goal inside a solid (a pile, a fire place) cannot be stood on: the nearest free spot takes its place. Action errands never get here: they go to a standing point (goStand).
    if (game.movement.obstacles.camp.inside(x, z, 0.02) && !game.movement.obstacles.camp.inside(p.x, p.z, 0)) { const q = openNear(x, z, 2); if (q) { x = q.x; z = q.z; } }
    const tap = !!o.tap, stop = o.stop ?? 1.0, fd = o.finder || (o.free ? pathFree : path);
    let route = null, finalSet = false, last = now;
    for (;;) {
      if (o.until && o.until()) { idleInput(); return true; }
      if (p.sitting > 0) { inp.sit = false; idleInput(); last = now; yield; continue; }   // 0.29.2: he gets up first, then walks
      const d = Math.hypot(x - p.x, z - p.z);
      if (!tap && d <= stop) { idleInput(); return true; }
      if (!route) {
        route = createRoute(fd, p, { x, z }, { stop, tap, near: tap ? 1.3 : 0 });   // tap: a stall within 1.3 m of the thing ends the walk (it lies against a trunk: close enough)
        if (route.state === 'unreachable') { stats.nopath++; ev('nopath', { to: [+x.toFixed(1), +z.toFixed(1)], goal: cur && cur.name }); idleInput(); return false; }
      }
      const u = route.update(p, now - last, busy()); last = now;
      if (u.stalled) { stats.stuck++; ev('stuck', { goal: cur && cur.name, to: [+x.toFixed(1), +z.toFixed(1)], dist: +d.toFixed(1), n: route.stalls }); }
      if (u.state === 'arrived') { idleInput(); return true; }
      if (u.state === 'unreachable') { if (route.reason === 'nopath') { stats.nopath++; ev('nopath', { to: [+x.toFixed(1), +z.toFixed(1)], goal: cur && cur.name }); } idleInput(); return false; }
      if (u.final) {
        if (tap) { if (!finalSet) { inp.target = { x, z, tap: true, routed: true }; finalSet = true; } else if (!inp.target) return true; }
        else inp.target = { x, z, routed: true };
      } else { finalSet = false; inp.target = { x: u.target.x, z: u.target.z, routed: true }; }
      inp.run = !!o.hurry && u.remaining > 20 && !p.winded;
      yield;
    }
  }
  function* waitIdle() { while (busy()) yield; yield; }
  function* waitActs(max = 25) { const t0 = now; yield; while (inp.target && inp.target.act && now - t0 < max) yield; yield; }
  const hurry = () => game.thirst.days >= 0.95;
  const stand = game.stand;
  const STOP = 0.12;   // the follower ends within this of a standing point (moveIntent takes less than 0.12 m for arrived)
  // 0.30.3 "Routes": to a spot where the game really offers `kind` for `obj` (game/stand: a pile to take from, add to or light, a fire to feed, a site or lean-to to build or upgrade). True when he stands there and the
  // action is offered; false when there is no such spot he can reach (the caller marks the object bad and goes on). A world that changed on the way (the pile is gone, another pile now counts) is looked at once more.
  function* goStand(kind, obj, o = {}) {
    for (let tries = 0; tries < 2; tries++) {
      if (kind === 'take' || kind === 'add' || kind === 'light' ? !W.piles.includes(obj) : kind === 'feed' ? !game.fire.fires.includes(obj) : false) return false;
      if (stand.usable(kind, obj, p.x, p.z, o.free ? null : inside)) { idleInput(); return true; }
      const s = stand.plan(kind, obj, o.free ? pathFree : path, p, { allow: o.free ? null : inside });
      if (!s) { stats.noStand = (stats.noStand || 0) + 1; ev('no-stand', { kind }); return false; }
      if (!(yield* walk(s.x, s.z, { stop: STOP, hurry: o.hurry }))) return false;
      if (stand.offered(kind, obj, p.x, p.z)) return true;
    }
    return false;
  }

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
    if (!(yield* goStand('nearFire', f))) return false;
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
    return yield* errand(function* () {
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
    });
  }

  function* huskGoal() {   // a nut for fibre and to carry
    return yield* errand(function* () {
    const c = nearestBy('coco', 60); if (!c) { cool('husk'); lack.nuts = clock.day; return false; }
    think(game.fibre.carried === 0 || game.shells.nuts >= NUT_WANT ? 'fibreIntent' : 'foodReserve');
    const near = () => { const a = game.action().tap; return !!a && a.kind === 'husk' && !a.carried; };
    yield* walk(c.x, c.z, { tap: true, stop: 0.4, until: near });
    let k = pressKind(['husk']); if (k) yield* waitIdle();
    if (!k) { yield* walk(c.x, c.z, { stop: 0.2 }); k = pressKind(['husk']); if (k) yield* waitIdle(); }
    if (!k) { markBad('coco', c.o, 600); return false; }
    return true;
    });
  }

  const carriedKind = () => W.carried.length ? (W.carried[0].branch ? 'branch' : W.carried[0].frond ? 'frond' : 'drift') : (W.stones.length ? 'stone' : null);
  function* layDown() { for (let n = 0; n < 3 && (W.carried.length || W.stones.length); n++) { if (!pressKind(['feed', 'lay'])) break; yield* waitIdle(); } }
  function* toDest(d) {   // to where wood is laid down: beside the pile that is to take it (a spot where the game's lay joins that very pile), at a fire (where it is fed), else to the point itself (a new pile there)
    if (d.pile && W.piles.includes(d.pile) && (yield* goStand('add', d.pile))) return true;   // (a frond or stone pile is wider than the join distance: none to be had from outside, then a pile of its own beside it)
    const f = game.fire.fires.find(q => dist(q, d) < 1.2);
    if (f && !d.exact) return (yield* goStand('feed', f)) || (yield* goStand('nearFire', f));
    if (d.exact) return true;   // layAt walks the exact approach itself
    const q = openNear(d.x, d.z, 1.5);
    return q ? yield* walk(q.x, q.z, { stop: 0.35 }) : false;
  }
  function* layAt(d) {   // lays what he carries down at d; when something else within reach takes the place of 'lay' in the arc, he steps aside and tries again
    if (d.exact && W.load()) {
      const at = exactPileDrop(p, d);
      if (yield* walk(at.x, at.z, { stop: 0.08 })) { p.heading = at.heading; yield* layDown(); }
      if (!W.load()) return;
    }
    for (let tries = 0; tries < 3 && W.load(); tries++) {
      yield* layDown();
      if (!W.load()) break;
      if (d.pile && W.piles.includes(d.pile) && tries < 2 && (yield* goStand('add', d.pile))) continue;   // the pile is still there: a spot where the lay joins it
      const a = tries * 2.1 + 0.5, q = openNear(d.x + Math.sin(a) * 1.3, d.z + Math.cos(a) * 1.3, 0.5); if (q) yield* walk(q.x, q.z, { stop: 0.3 });
    }
  }
  // fetch up to three pieces of one kind (stones: two) and bring them to dest (fire: feed it first, then lay down); maxCost: only pieces within that walk (0.29.3, the home project)
  function* gather(kind, dest, want, maxCost = Infinity, src = kind) {
    return yield* errand(function* () {
    const cap = kind === 'stone' ? STONE_MAX : CARRY_MAX, pk = kind === 'drift' ? 'driftwood' : kind, mine = () => kind === 'stone' ? W.stones.length : W.carried.filter(l => kindOf(l) === pk).length;   // mine: pieces of the wanted kind in his arms (another piece lying close by may be the one the ring offers)
    const ck = carriedKind(); let got = 0;
    if (ck && ck !== kind) { if (pressKind(['lay'])) yield* waitIdle(); } else if (ck === kind) got = mine();
    while (got < Math.min(cap, want)) {
      const t = nearestBy(src, 45); if (!t || t.cost > maxCost) break;
      if (kind === 'drift' || kind === 'branch') think('woodIntent');
      const before = mine(), wanted = o => !!o.thing && (t.pile ? o.thing.kind === 'pile' && o.thing.pile === t.pile : o.thing.kind === 'log' && kindOf(o.thing.log) === pk);
      let k = null;
      if (t.pile) { if (yield* goStand('take', t.pile)) { k = pressKind(['pickup'], wanted); if (k) yield* waitIdle(); } }   // 0.30.3: a pile is taken from where the arc really offers it for that pile
      else {
        yield* walk(t.x, t.z, { tap: true, stop: 0.4, until: () => { const a = game.action().tap; return !!a && a.kind === 'pickup' && wanted(a) && Math.hypot(a.thing.x - t.x, a.thing.z - t.z) < 1.5; } });
        k = pressKind(['pickup'], wanted); if (k) yield* waitIdle();
        if (!k) { yield* walk(t.x, t.z, { stop: 0.2 }); k = pressKind(['pickup'], wanted); if (k) yield* waitIdle(); }
      }
      yield;
      if (mine() > before) got = mine(); else markBad(src, t.o, 600);
    }
    if (!W.load()) return got > 0;
    const d = dest(); if (!d) return false;
    const ok = yield* toDest(d);
    if (!ok) return false;
    yield* layAt(d);
    return true;
    });
  }
  // wood for the fire: onto the biggest pile of the same kind at the fire spot (laying down within a metre joins a pile), else a new pile there. The kind of the biggest pile
  // goes first, so a pile of branches and a pile of driftwood do not both grow to 6 (the arc would then offer to build, not to light)
  const pairNear = (fs, pk) => firePiles(fs).some(q => q.kind !== pk && q.logs.length >= NEED);   // a pile of the other kind with 6 or more pieces stands at the fire (two such piles within 2 m make the arc offer to build)
  function fireStockDest(fs) {   // one actual dry-driftwood destination: its pile, or an exact first-pile drop at the fire; never a drying site or a second build-sized kind
    const drift = firePiles(fs).filter(q => q.kind === 'driftwood'), pile = drift.filter(q => q.logs.length < PILE_FULL).sort((a, b) => b.logs.length - a.logs.length)[0];
    if (pile) return { x: pile.x, z: pile.z, pile, room: pairNear(fs, 'driftwood') ? Math.max(0, NEED - 1 - pile.logs.length) : PILE_FULL - pile.logs.length };
    if (drift.length || pairNear(fs, 'driftwood') || proj.dry.some(s => Math.hypot(s.x - fs.x, s.z - fs.z) <= DRY_NEAR)) return null;
    return { ...fs, exact: true, pile: null, room: PILE_FULL };
  }
  function* gatherWood() {
    const h = homeSpot(), fs = fireSpot(h), best = bestPile(fs), st = best ? fuelOfPile(best) : 0;
    const topUp = !!best && st >= WOOD_WANT;   // the evening's wood is there: only fill the pile up, and only with its own kind (two piles of 6 or more would make the arc offer to build)
    const order = best && best.kind === 'branch' ? ['branch', 'drift'] : ['drift', 'branch'];
    if (wetCarried()) yield* deliverWet();   // 0.29.5: wet wood from a stroll is not the fire's
    for (const kind of topUp ? order.slice(0, 1) : order) {
      const pk = kind === 'branch' ? 'branch' : 'driftwood', mine = firePiles(fs).filter(x => x.kind === pk).sort((a, b) => b.logs.length - a.logs.length)[0];
      let want = topUp ? Math.max(1, PILE_FULL - best.logs.length) : Math.max(1, Math.ceil((WOOD_WANT - st) / (kind === 'branch' ? 0.5 : 1)));
      if (pairNear(fs, pk)) { want = Math.min(want, NEED - 1 - (mine ? mine.logs.length : 0)); if (want < 1) continue; }   // 0.29.3: the other kind is already 6 or more: this pile stays below 6, else the arc offers to build and not to light
      const dest = () => {
        const q = firePiles(fs).filter(x => x.kind === pk && x.logs.length < 12).sort((a, b) => b.logs.length - a.logs.length)[0];
        if (q) return { x: q.x, z: q.z, pile: q, room: PILE_FULL - q.logs.length };
        return h.kind === 'leanto' && h.lt && game.leantos.has(h.lt, 'ring') ? { ...fs, exact: true, pile: null, room: PILE_FULL } : { ...fs, pile: null, room: PILE_FULL };
      };
      if (kind === 'drift' && (yield* fetchDried(dest, want))) return true;   // 0.29.5: wood that has dried on the drying pile first
      if (!nearestBy(kind, 45, 4)) continue;
      return yield* gather(kind, dest, want);
    }
    return false;
  }

  function* breakPair(pile) {   // takes up to three pieces from the other pile of the pair under his arm (a pile of 6 or more becomes smaller), then lights
    const other = firePiles(fireSpot()).filter(q => q !== pile && q.logs.length >= NEED).sort((a, b) => fuelOfPile(a) - fuelOfPile(b))[0]; if (!other) return false;
    const mine = o => !!o.thing && o.thing.kind === 'pile' && o.thing.pile === other;
    if (!(yield* goStand('take', other)) || !pressKind(['pickup'], mine)) return false;
    yield* waitIdle(); ev('pair-broken');
    return (yield* goStand('light', pile)) && !!pressKind(['light']);
  }
  function* lightFire() {
    const fs = fireSpot(), h = homeSpot();
    if (fireAt(fs)) return true;
    const pile = firePiles(fs).sort((a, b) => fuelOfPile(b) - fuelOfPile(a))[0];
    if (!pile || pile.logs.length < FIRE_MIN || !(game.fibre.carried || game.fire.torch)) return false;
    const mean = pile.logs.reduce((s, l) => s + dryness(l, clock.total), 0) / pile.logs.length;
    if (mean < 0.6) { ev('fire-skipped-wet', { mean: +mean.toFixed(2) }); cool('light'); return false; }
    think('fireOut');
    for (let k = 0; k < 3 && (game.fibre.carried || game.fire.torch) && !fireAt(fs); k++) {
      // 0.30.3: to a spot where the arc really offers to light THIS pile (not a neighbour, not the lean-to's upgrade icon)
      if (!(yield* goStand('light', pile)) || !pressKind(['light'])) {
        let done = false;
        if (siteFor(W.piles, pile)) done = yield* breakPair(pile);   // two piles of 6 or more at the fire (a legacy of the piles): the arc offers to build and not to light
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
    if (wetCarried()) yield* deliverWet();   // 0.29.5: wet wood from a stroll goes to the drying pile first
    if (!W.load()) {
      const pile = [...pilesNear('driftwood', fs.x, fs.z, 8), ...pilesNear('branch', fs.x, fs.z, 8)].filter(q => q.logs.length && !isDrying(q) && !isBad('feedpile', q)).sort((a, b) => dist(a, f) - dist(b, f))[0];
      if (!pile) return false;
      think('fireLow');
      if (yield* goStand('take', pile)) { if (pressKind(['pickup'], o => !!o.thing && o.thing.kind === 'pile' && o.thing.pile === pile)) yield* waitIdle(); } else { markBad('feedpile', pile, 120); return false; }
    }
    think('fireLow');
    if (!(yield* goStand('feed', f))) { yield* layDown(); return false; }   // 0.30.3: where the arc really feeds THIS fire
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
    try { while (now < until && clock.time < GAZE_TO + 0.03) { setSit(spot.look, 'gaze'); yield; } } finally { inp.sit = false; }   // 0.29.2: he sits and looks out to sea (or into the fire) while he gazes
    return true;
  }

  // ---------- his home (0.29.3 "Homestead") ----------
  // One lean-to at his camp, then its upgrades, by day, one piece a day, through the same build / upgrade actions a player has. Materials only from known ground (`scan`).
  const pileSum = (kind, x, z, r) => W.piles.filter(q => q.kind === kind && Math.hypot(q.x - x, q.z - z) <= r).reduce((n, q) => n + q.logs.length, 0);
  const bigPile = (kind, x, z, r) => W.piles.filter(q => q.kind === kind && Math.hypot(q.x - x, q.z - z) <= r).sort((a, b) => b.logs.length - a.logs.length)[0] || null;
  const UP_NAMES = Object.keys(UPGRADES);
  const homeCount = () => game.leantos.list.reduce((n, l) => n + (l.progress >= 1 ? 1 : 0) + UP_NAMES.reduce((m, k) => m + (l.up && l.up[k] >= 1 ? 1 : 0), 0), 0);
  function homeSnap() {
    const h = homeSpot(); let lean = 'none', up = null;
    if (h.kind === 'leanto') { lean = 'done'; up = h.lt.up || {}; }
    else if (game.leantos.list.length) lean = game.leantos.list.some(l => l.progress < 1 && inside(l.x, l.z)) ? 'half' : 'other';
    return { day: clock.day, time: clock.time, fire: h.kind === 'fire' || h.kind === 'bed', lean, up, builtDay, cool: { home: isCool('home') } };
  }
  // Places for the lean-to round the fire f, best first: on ground he knows, dry and level, 0.8 m above the high-water line, its footprint, the two piles for the building, the ring and the piles of the upgrades all standable and
  // clear of the rivers; the open side across from the fire (heading a quarter turn from the line to it), so that the stone ring comes to stand 4 m or more from the old fire; nearer the fire and nearer fresh water he knows is better.
  function leantoSites(f) {
    const wp = waterPts(), out = [];
    for (const r of SITE_RINGS) for (let i = 0; i < 16; i++) for (const side of [1, -1]) {
      const a = (i + (r === SITE_RINGS[1] ? 0.5 : 0)) * Math.PI / 8, c = { x: f.x + Math.sin(a) * r, z: f.z + Math.cos(a) * r, heading: a + side * Math.PI / 2, r };
      const sx = Math.sin(c.heading), sz = Math.cos(c.heading), y0 = world.H(c.x, c.z);
      if (terrainAt(world, c.x, c.z, 0).s >= SITE_SLOPE) continue;
      let ok = true, rise = 0;
      for (const [u, v] of [[0, 0], [1, 0.75], [-1, 0.75], [1, -0.75], [-1, -0.75], [0.9, 0], [-0.9, 0], [0, RING_AT], [UP_AT, 0], [-UP_AT, 0], [0, -UP_AT]]) {   // u across the opening (perpendicular to the heading), v along it
        const qx = c.x + sz * u + sx * v, qz = c.z - sx * u + sz * v, y = world.H(qx, qz), t = terrainAt(world, qx, qz, 0);
        if (!inside(qx, qz) || !canStand(world, qx, qz, 0) || t.inRiver || !world.dryOfRiver(qx, qz, 1.5) || y < SITE_HIGH || Math.abs(y - y0) > SITE_LEVEL) { ok = false; break; }
        rise = Math.max(rise, Math.abs(y - y0));
      }
      if (!ok || proj.dry.some(q => Math.hypot(q.x - c.x, q.z - c.z) < DRY_CLEAR)) continue;   // (0.29.5: and clear of a drying pile, whose wood would be taken for the building's)
      let wd = 120; for (const q of wp) wd = Math.min(wd, Math.hypot(q.x - c.x, q.z - c.z));
      out.push({ ...c, score: r + 0.05 * wd + 3 * rise, water: wd });
    }
    return out.sort((a, b) => a.score - b.score);
  }
  function homeSite(h) {   // kept once chosen (while the fire is the same)
    if (proj.site && dist(proj.site.fire, h) < 4) return proj.site;
    for (const c of leantoSites(h).slice(0, 8)) if (path.cost(h, c) < c.r * 2.5 + 10) return (proj.site = { ...c, fire: { x: h.x, z: h.z } });
    return null;
  }
  const existingSite = h => {   // two piles of 6 near the fire that the player left: the building is there
    for (const q of W.piles) if (q.kind === 'driftwood' && q.logs.length >= NEED && Math.hypot(q.x - h.x, q.z - h.z) <= 30 && inside(q.x, q.z)) { const s = siteFor(W.piles, q); if (s && Math.hypot(s.x - h.x, s.z - h.z) >= 3.5 && inside(s.x, s.z) && canStand(world, s.x, s.z, 0)) return s; }   // (a pair at the fire is its stock, not a site)
    return null;
  };
  const sitePile = (kind, sp) => W.piles.filter(q => q.kind === kind && Math.hypot(q.x - sp.x, q.z - sp.z) <= 2.2 && Math.hypot(q.x - sp.fire.x, q.z - sp.fire.z) > 2.6 && !isDrying(q)).sort((a, b) => b.logs.length - a.logs.length)[0] || null;   // the piles for the building: close to the site, and not the fire's stock
  function* doBuild(kind, obj, face) {   // walks to a spot where the arc offers `kind` for obj (a lean-to being built or upgraded, { site } of two piles), presses build / upgrade and kneels until it is done (or he is called away); face: the way a new lean-to is to open
    if (!(yield* goStand(kind, obj))) { stats.home.refused++; ev('home-not-offered', { kind, arc: game.action().options.map(o => o.kind).join(), stand: false }); cool('home', 300); return false; }
    if (face !== undefined) headingWanted = face;
    if (!pressKind([kind])) { headingWanted = null; stats.home.refused++; ev('home-not-offered', { kind, arc: game.action().options.map(o => o.kind).join() }); cool('home', 300); return false; }
    stats.home.builds++;
    yield* waitActs(40); yield* waitIdle(); headingWanted = null;
    return true;
  }
  function siteDest(sp, kind, other) {   // where the pieces of `kind` ('driftwood' | 'branch') are laid for the building: on the pile there, else across the opening from the pile of the other kind (a metre and a bit apart), else at the site
    const sx = Math.sin(sp.heading), sz = Math.cos(sp.heading), mine = sitePile(kind, sp), twin = sitePile(other, sp);
    if (mine) return standNear(mine.x, mine.z, 1) || { x: mine.x, z: mine.z };
    for (const sg of twin ? [1, -1] : [kind === 'driftwood' ? -1 : 1]) { const q = twin ? { x: twin.x + sz * 1.3 * sg, z: twin.z - sx * 1.3 * sg } : { x: sp.x + sz * 0.7 * sg, z: sp.z - sx * 0.7 * sg }; const st = standNear(q.x, q.z, 0.5); if (st && Math.hypot(st.x - q.x, st.z - q.z) < 1) return st; }
    return standNear(sp.x, sp.z, 2);
  }
  // what the next unit of the project is, for `what` ('leanto' | 'walls' | 'ring' | 'bed'): { kind, want, dest } a trip for pieces of that kind to dest(), { build, run } the building, null when there is nothing he can do now
  function homeNeed(what, h) {
    if (what === 'leanto') {
      const half = game.leantos.list.filter(l => l.progress < 1 && inside(l.x, l.z)).sort((a, b) => dist(a, p) - dist(b, p))[0];
      if (half) return { build: true, run: () => doBuild('build', { leanto: half }, undefined) };
      let s = existingSite(h);
      if (!s) {
        const sp = homeSite(h); if (!sp) { ev('home-no-site'); cool('home', 900); return null; }
        const dest = (kind, other) => () => siteDest(sp, kind, other);
        const d = sitePile('driftwood', sp), b = sitePile('branch', sp), nd = d ? d.logs.length : 0, nb = b ? b.logs.length : 0;
        if (nd < NEED) return { kind: 'drift', src: 'timber', want: NEED - nd, dest: dest('driftwood', 'branch') };
        if (nb < NEED) return { kind: 'branch', want: NEED - nb, dest: dest('branch', 'driftwood') };
        s = siteFor(W.piles, d);
        if (!s) { ev('home-site-bad'); cool('home', 600); return null; }
      }
      // 0.29.4: he builds at the pile that has its partner within 2 m (a second pile of 6 nearby, with no partner, offered 'light' only); the open side towards the fire
      return { build: true, run: () => doBuild('build', { site: s }, Math.atan2(h.x - s.x, h.z - s.z)) };
    }
    if (h.kind !== 'leanto') return null;
    const lt = h.lt, per = UPGRADES[what].per, p0 = (lt.up && lt.up[what]) || 0, left = UPGRADES[what].steps - paidSteps(what, p0), hx = Math.sin(lt.heading), hz = Math.cos(lt.heading);
    const spot = { frond: [hz, -hx], stone: [-hz, hx], branch: [-hx, -hz] };   // fronds on one side, stones on the other, branches behind the lean-to (UP_AT m from its middle: beside the keep-free region, within UP_NEAR)
    for (const [kind, n] of Object.entries(per)) {
      const need = n * left - pileSum(kind, lt.x, lt.z, UP_NEAR);
      if (need <= 0) continue;
      const [ux, uz] = spot[kind], at = { x: lt.x + ux * UP_AT, z: lt.z + uz * UP_AT };
      return { kind: kind === 'branch' ? 'branch' : kind, want: need, dest: () => { const q = bigPile(kind, at.x, at.z, 1.5); return q ? { x: q.x, z: q.z, pile: q } : { x: at.x, z: at.z, exact: true }; } };
    }
    return { build: true, run: () => doBuild('upgrade', lt, undefined) };
  }
  function* homeGoal(what, need) {
    if (cur) cur.limit = HOME_LIMIT;
    const n0 = homeCount(); stats.home.units++;
    ev('home', { what, need: need.kind || 'build' });
    let ok;
    if (need.kind) { stats.home.trips++; ok = yield* gather(need.kind, need.dest, need.want, HOME_MAX_COST, need.src || need.kind); if (!ok) { stats.home.noMaterial++; lack[need.kind === 'drift' ? 'wood' : need.kind === 'branch' ? 'branches' : need.kind === 'stone' ? 'wood' : 'nuts'] = clock.day; ev('home-no-material', { kind: need.kind }); cool('home', 600); } }
    else ok = yield* need.run();
    if (homeCount() > n0) { builtDay = clock.day; ev('home-built', { what }); }
    return ok;
  }

  // ---------- drying wood (0.29.5 "Drying", 0.29.15 "Dry stock") ----------
  // Wet wood from the strip between the tides never dries there (the sea covers it again and again). On a shore stroll, with an arm free, he takes up to two such pieces to a drying pile of its own: above the high-water line at his camp,
  // DRY_RINGS m from the fire (clear of the fire's own pile, `isDrying`), or, with a finished lean-to, DRY_LT m from its middle at the back (outside the keep-free region of the lean-to). A pile holds at most DRY_MAX pieces (never 6: with a pile
  // of branches within 2 m the arc would offer to build). When the pieces on top are dry enough to burn (DRY_AT) the stores, evening wood and one low-priority daytime stock errand move them to the fire's pile before wet strip wood is fetched. Nothing is saved:
  // sites are worked out again from the fire and known ground, while each live mind keeps their pile classification stable as the fire moves. The same actions as a player's: pick up, lay down.
  const wetPiece = l => dryness(l, clock.total) < DRY_AT;
  const wetCarried = () => carriedKind() === 'drift' && W.carried.some(wetPiece);
  const dryPileAt = s => {
    const q = s.pile && W.piles.includes(s.pile) ? s.pile : W.piles.filter(q => q.kind === 'driftwood' && Math.hypot(q.x - s.x, q.z - s.z) <= DRY_NEAR).sort((a, b) => dist(a, s) - dist(b, s))[0] || null;
    if (q) s.pile = q;
    return q;
  };
  function dryingSite() {   // the place of the drying pile for his camp as it is now; kept while the camp is the same (a new one when the lean-to is finished), null when there is none
    const h = homeSpot(), lean = h.kind === 'leanto', fs = fireSpot(h), of = lean ? { x: h.x, z: h.z } : { x: fs.x, z: fs.z };
    const cur = proj.dry.at(-1), clear = (x, z) => !W.piles.some(q => q.kind === 'driftwood' && !isDrying(q) && Math.hypot(q.x - x, q.z - z) < 2.5);   // no other pile of driftwood near: a wet piece laid there would join it
    if (cur && cur.lean === lean && dist(cur.of, of) < 3 && clear(cur.x, cur.z)) return cur;
    const no = proj.dryNo; if (no && no.lean === lean && dist(no.of, of) < 1 && no.count === known.count) return null;
    const okAt = (x, z) => {
      const st = standNear(x, z, 0.5), t = terrainAt(world, x, z, 0);
      return !!st && Math.hypot(st.x - x, st.z - z) < 0.6 && inside(x, z) && canStand(world, x, z, 0) && world.H(x, z) >= SITE_HIGH && t.s < 0.3 && !t.inRiver && world.dryOfRiver(x, z, 1.5)
        && Math.hypot(x - fs.x, z - fs.z) >= DRY_FIRE && clear(x, z) && !proj.dry.some(q => Math.hypot(q.x - x, q.z - z) < 2.5) && !game.fire.fires.some(f => Math.hypot(f.x - x, f.z - z) < 3.2) && !(proj.site && Math.hypot(x - proj.site.x, z - proj.site.z) < DRY_CLEAR) && path.cost(fs, { x, z }) < 40;
    };
    let found = null;
    if (lean) for (const sg of [1, -1]) {   // at the back of the lean-to, either side
      const a = h.lt.heading + Math.PI + sg * 0.3, x = h.x + Math.sin(a) * DRY_LT, z = h.z + Math.cos(a) * DRY_LT;
      if (!found && okAt(x, z)) found = { x, z, ux: Math.sin(a), uz: Math.cos(a) };
    }
    for (const r of DRY_RINGS) for (let i = 0; i < 16 && !found; i++) {   // else beside the camp, nearest ring first
      const a = (i + (r === DRY_RINGS[1] ? 0.5 : 0)) * Math.PI / 8, x = fs.x + Math.sin(a) * r, z = fs.z + Math.cos(a) * r;
      if (okAt(x, z)) found = { x, z, ux: Math.sin(a), uz: Math.cos(a) };
    }
    if (!found) { proj.dryNo = { lean, of, count: known.count }; return null; }
    proj.dry.push({ ...found, lean, of }); stats.drying.sites++; ev('dry-site', { at: [+found.x.toFixed(1), +found.z.toFixed(1)], lean });
    return proj.dry.at(-1);
  }
  function* toDrying(s) {   // to the drying pile (beside it), or, with none yet, to where a first pile is laid: he comes from outside and faces the site, so the pile lands on it
    const q = dryPileAt(s);
    if (q) return yield* goStand('add', q);
    const out = standNear(s.x + s.ux * 1.4, s.z + s.uz * 1.4, 0.5);
    if (out && Math.hypot(out.x - s.x, out.z - s.z) > 0.8 && !(yield* walk(out.x, out.z, { stop: 0.4 }))) return false;
    return yield* walk(s.x, s.z, { stop: 0.5 });
  }
  function* deliverWet() {   // wood under his arm that is not dry enough to burn goes to the drying pile (never to the fire's); with no site it is laid down where he stands, as wet timber always was
    const s = dryingSite();
    if (!s || !(yield* toDrying(s))) { yield* layAt(p); return; }
    const ids = W.carried.map(l => l.id);
    yield* layAt({ ...s, exact: !dryPileAt(s) });
    const q = dryPileAt(s), laid = q ? ids.filter(id => q.logs.some(l => l.id === id)) : [];
    if (laid.length) { for (const id of laid) if (!proj.laidIds.has(id)) { proj.laidIds.add(id); stats.drying.laid++; } ev('dry-laid', { n: laid.length }); }
  }
  // wet wood in the strip within a few metres of a shore stroll's stopping place: up to two pieces, only with an arm free, only when nothing else is in his arms (dry wood or branches would mix with it), only while the drying pile has room
  function* pickUpWet() {
    const s = dryingSite(); if (!s) return;
    for (let n = 0; n < 2; n++) {
      const ck = carriedKind(), q = dryPileAt(s);
      if (W.carried.length >= 2 || (ck && ck !== 'drift') || W.carried.some(l => !wetPiece(l)) || W.carried.length + (q ? q.logs.length : 0) >= DRY_MAX) return;
      const t = scan('strip', p.x, p.z, 8)[0]; if (!t) return;
      const before = W.carried.length, wanted = o => !!o.thing && o.thing.kind === 'log' && kindOf(o.thing.log) === 'driftwood' && inStripY(o.thing.log.y) && dryness(o.thing.log, clock.total) < 0.95;
      think('wetwood');
      yield* walk(t.x, t.z, { tap: true, stop: 0.4, until: () => { const a = game.action().tap; return !!a && a.kind === 'pickup' && wanted(a) && Math.hypot(a.thing.x - t.x, a.thing.z - t.z) < 1.5; } });
      const k = pressKind(['pickup'], wanted); if (k) yield* waitIdle();
      yield;
      if (W.carried.length <= before) { markBad('strip', t.o, 600); return; }
      const id = W.carried.at(-1).id; if (!proj.wetIds.has(id)) { proj.wetIds.add(id); stats.drying.wetTaken++; }
    }
  }
  // pieces on a drying pile that are dry enough to burn: the top pieces he would pick up (a pile gives its top ones first) must all be
  const readyPile = () => W.piles.filter(q => isDrying(q) && q.logs.length).find(q => q.logs.slice(-Math.min(CARRY_MAX, q.logs.length)).every(l => !wetPiece(l))) || null;
  function* fetchDried(dest, want) {   // from the drying pile to the fire's pile; true only when those exact log ids reached that non-drying pile
    return yield* errand(function* () {
    if (W.load()) return false;
    const d0 = dest(), q = readyPile(); if (process.env.DBGFD) console.error('fetchDried', clock.day, clock.time.toFixed(3), 'd0', !!d0, 'q', !!q, d0 && d0.room, want, d0 && d0.pile && isDrying(d0.pile)); if (!d0 || !q) return false;
    const take = Math.min(CARRY_MAX, q.logs.length);
    if (want < take || d0.room < take || isDrying(d0.pile)) return false;
    think('drytransfer');
    const mine = o => !!o.thing && o.thing.kind === 'pile' && o.thing.pile === q;
    const gs = yield* goStand('take', q); if (process.env.DBGFD) console.error('  goStand', gs, 'offered now', JSON.stringify(game.action().options.map(o => o.kind)), game.action().tap && game.action().tap.kind); if (!gs || !pressKind(['pickup'], mine)) return false;
    yield* waitIdle();
    const ids = W.carried.map(l => l.id); if (!ids.length) return false;
    const d = dest(); if (!d || d.room < ids.length || isDrying(d.pile)) return false;
    const ok = yield* toDest(d);
    if (process.env.DBGFD) console.error('  toDest', ok, JSON.stringify({ x: d.x, z: d.z, pile: !!d.pile, exact: d.exact }), 'at', p.x.toFixed(2), p.z.toFixed(2));
    if (ok) {
      yield* layAt(d);
      if (process.env.DBGFD) console.error('  after layAt carried', W.carried.length, 'piles', JSON.stringify(W.piles.map(q => [+q.x.toFixed(1), +q.z.toFixed(1), q.kind, q.logs.length])), 'fs', JSON.stringify(fireSpot()));
      const landed = firePiles(fireSpot()).find(pile => !isDrying(pile) && ids.every(id => pile.logs.some(l => l.id === id)));
      if (landed) { let n = 0; for (const id of ids) if (!proj.movedIds.has(id)) { proj.movedIds.add(id); stats.drying.moved++; n++; } ev('dry-moved', { n, ids, from: [+q.x.toFixed(2), +q.z.toFixed(2)], to: [+landed.x.toFixed(2), +landed.z.toFixed(2)], destination: 'fire', drying: isDrying(landed) }); return true; }
    }
    return false;
    });
  }
  function* stockDrying() {   // one small daytime reserve errand: dry stock first, then at most two wet strip logs, all on known reachable ground
    if (!(clock.time >= DAY_FROM && clock.time < EVENING) || W.load()) return false;
    const h = homeSpot(), fs = fireSpot(h), dest = () => fireStockDest(fs);
    const d = dest();
    if (!d) return false;   // a full fire stock waits; the drying reserve is not a second store
    if (d && (yield* fetchDried(dest, Math.min(CARRY_MAX, d.room)))) { stats.drying.stockErrands++; return true; }
    const s = dryingSite(), q = s && dryPileAt(s), room = DRY_MAX - (q ? q.logs.length : 0);
    if (!s || room <= 0) return false;
    return yield* errand(function* () {
      let taken = 0;
      while (taken < Math.min(2, room) && W.carried.length < CARRY_MAX) {
        const t = nearestBy('strip', 45, 4); if (!t || t.cost > STOCK_MAX_COST) break;
        think('wetwood');
        const before = W.carried.length, wanted = o => !!o.thing && o.thing.kind === 'log' && kindOf(o.thing.log) === 'driftwood' && inStripY(o.thing.log.y) && wetPiece(o.thing.log);
        yield* walk(t.x, t.z, { tap: true, stop: 0.4, until: () => { const a = game.action().tap; return !!a && a.kind === 'pickup' && wanted(a) && Math.hypot(a.thing.x - t.x, a.thing.z - t.z) < 1.5; } });
        if (!pressKind(['pickup'], wanted)) break;
        yield* waitIdle(); yield;
        if (W.carried.length <= before || W.carried.some(l => !wetPiece(l))) { markBad('strip', t.o, 600); break; }
        const id = W.carried.at(-1).id; if (!proj.wetIds.has(id)) { proj.wetIds.add(id); stats.drying.wetTaken++; }
        taken++;
      }
      if (!taken) return false;
      yield* deliverWet();
      stats.drying.stockErrands++;
      return true;
    });
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
      if (W.carried.length >= 2 || (carriedKind() && carriedKind() !== 'drift') || wetCarried() || (best && best.kind === 'driftwood' && best.logs.length >= PILE_FULL) || (best && best.kind === 'branch' && fuelOfPile(best) >= WOOD_WANT)) return;
      const t = scan('drift', p.x, p.z, 8)[0]; if (!t) return;
      const before = W.carried.length;
      yield* walk(t.x, t.z, { tap: true, stop: 0.4, until: () => { const a = game.action().tap; return !!a && a.kind === 'pickup' && !!a.thing && a.thing.kind === 'log' && Math.hypot(a.thing.x - t.x, a.thing.z - t.z) < 1.5; } });
      let k = pressKind(['pickup']); if (k) yield* waitIdle();
      yield;
      if (W.carried.length <= before) { markBad('drift', t.o, 600); return; }
    }
  }
  function* deliver() {   // wood under his arm from a stroll goes to the pile at the fire spot (a pile of its own kind within a metre, else a new one there)
    return yield* errand(function* () {
    if (!W.carried.length || (carriedKind() !== 'drift' && carriedKind() !== 'branch')) return;
    if (wetCarried()) { yield* deliverWet(); return; }   // 0.29.5: wood that is not dry enough to burn never goes to the fire's pile
    const fs = fireSpot(), kind = carriedKind() === 'branch' ? 'branch' : 'driftwood';
    const q = firePiles(fs).filter(x => x.kind === kind && x.logs.length < PILE_FULL).sort((a, b) => b.logs.length - a.logs.length)[0], d = q ? { x: q.x, z: q.z, pile: q } : fs;
    if (pairNear(fs, kind) && (q ? q.logs.length : 0) + W.carried.length >= NEED) { yield* layAt(p); return; }   // it would make a second pile of 6 or more at the fire: laid down where he stands
    if (d.pile) { if (!(yield* goStand('add', d.pile))) return; }
    else { const o = openNear(d.x, d.z, 1.5); if (!o || !(yield* walk(o.x, o.z, { stop: 0.35 }))) return; }
    for (let n = 0; n < 3 && W.carried.length; n++) { if (!pressKind(['lay'])) break; yield* waitIdle(); }   // (lay only: by day he never feeds the flames with it)
    });
  }
  function* arrive(kind, c, stroll = false) {   // what he does at the end of a leg (stroll: on a stroll of his own, not at the far end of an exploring trip)
    if (kind === 'shore') { yield* pauseHere(); yield* pickUpDrift(); if (stroll) yield* pickUpWet(); return; }
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
      const t = game.hunger.days >= BERRY_PICK ? scan('berry', p.x, p.z, 6)[0] : null;   // a handful from a bush that bears, when he is a little hungry (eaten at once above a third of a day, else carried to the next meal)
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
      yield* arrive(kind, c, true);
      if (leg + 1 < legs) list = list.filter(q => Math.hypot(q.x - p.x, q.z - p.z) < 35);   // the next stretch (of shore, or the next palm or bush) lies near this one
    }
    yield* deliver();
    return true;
  }

  // ---------- exploring (0.29.4 "Wander") ----------
  // Now and then, by day, when nothing presses, he walks to the edge of what he knows (the farthest edge within `exploreReach(day)` of home that he can do and be home from before EXPLORE_BACK), preferring
  // the coast (driftwood, coconuts) or the forest (branches, berries) as `exploreWhere` says, learning what he walks past (inp.learns). His own terrace and ordinary ground only: a climbing route and steep ground are
  // closed to the finder (`pathExplore`). He turns back in time (exploreLate), at the normal pace when it is late.
  const exo = { x: 0, z: 0, reach: 0 }, okMemo = new Map(), lack = {};   // lack[kind] = the day something he looked for (wood, branches, nuts) was not to be had on ground he knows
  const ordinary = (x, z) => { const k = Math.round(x * 2) * 100003 + Math.round(z * 2); let v = okMemo.get(k); if (v === undefined) { const t = terrainAt(world, x, z, 0); v = t.climb <= EXPLORE_ROUTE && t.s < EXPLORE_SLOPE; okMemo.set(k, v); } return v; };
  const pathExplore = createPath(world, { allow: (x, z) => ordinary(x, z) && Math.hypot(x - exo.x, z - exo.z) <= exo.reach + 20, obstacles: game.movement.obstacles });
  const exploreMissing = h => {   // what is short at home: wood (loose driftwood known within 70 m of home: fewer than 6), branches (fewer than 4), nuts (fewer than 2, for fibre and for food)
    const out = [];
    if (scan('timber', h.x, h.z, 70).length < 6) out.push('wood');
    if (scan('branch', h.x, h.z, 70).length < 4) out.push('branches');
    if (scan('coco', h.x, h.z, 70).length < 2) out.push('nuts');
    for (const k of ['wood', 'branches', 'nuts']) if (!out.includes(k) && clock.day - (lack[k] ?? -9) <= LACK_DAYS) out.push(k);   // also what he went for lately and could not get
    return out;
  };
  const exploredPts = [];
  function exploreTarget(home, reach, where, avail) {
    const cands = [];
    for (let r = 24; r <= reach; r += 12) for (let i = 0; i < 24; i++) {
      const a = i * Math.PI / 12 + (r / 12 % 2) * Math.PI / 24, x = home.x + Math.sin(a) * r, z = home.z + Math.cos(a) * r;
      if (!(Math.abs(x) < HALF - 8 && Math.abs(z) < HALF - 8) || known.has(x, z) || !known.near(x, z, EXPLORE_EDGE) || !canStand(world, x, z, 0) || !ordinary(x, z)) continue;
      if (exploredPts.some(q => Math.hypot(q.x - x, q.z - z) < 14)) continue;
      const y = world.H(x, z);
      let bias = 0;
      if (where === 'coast') { if (y < 3) for (let k = 0; k < 8; k++) if (world.H(x + Math.sin(k * Math.PI / 4) * 15, z + Math.cos(k * Math.PI / 4) * 15) < 0.2) { bias = 30; break; } }
      else if (y >= 1 && world.forestB(x, z) >= 0.55) bias = 30;
      cands.push({ x, z, score: r + bias + 8 * rngEx() });
    }
    cands.sort((u, v) => v.score - u.score);
    const cheap = c => { const t = dist(p, c) * EXPLORE_DETOUR / WALK_SPEED; return t / PACE + t + EXPLORE_SPARE <= avail; };   // a first look at the straight line, then the way itself for the best few
    for (const c of cands.filter(cheap).slice(0, 12)) {
      const f = pathExplore.find(p, c, 30000, false);
      if (f && f.cost / PACE + f.cost + EXPLORE_SPARE <= avail) return c;
    }
    return null;
  }
  function* exploreTrip(missing) {
    const h = homeSpot(), home = fireSpot(h), reach = exploreReach(clock.day), where = exploreWhere(missing, stats.explores);
    const avail = (EXPLORE_BACK - clock.time) * DAY_SECONDS;
    exo.x = home.x; exo.z = home.z; exo.reach = Math.max(reach, dist(p, home) + 20);
    // he stands where home cannot be reached without a climbing route (another terrace), or on ground the trip may not use at all (0.30.3: the finder would take him off it at once, but those ticks would still be on a route): no trip from here
    if (!pathExplore.allow(p.x, p.z) || !pathExplore.find(p, home, 20000, false)) { cool('explore', 300); ev('explore-none', { why: 'terrace' }); return true; }
    const c = exploreTarget(home, reach, where, avail);
    if (!c) { cool('explore', 600); ev('explore-none', { why: 'no-target', reach, where }); return true; }
    if (cur) cur.limit = EXPLORE_LIMIT;
    exploredDay = clock.day; exploredPts.push(c); stats.explores++; ev('explore', { where, to: [+c.x.toFixed(1), +c.z.toFixed(1)], reach, missing: missing.join('+') }); think('explore');
    const t0 = now;
    exploring = true; inp.learns = true; fullPace = false;
    let hc = null;   // the way home in seconds, looked at again after every 10 m
    const homeSecs = () => { if (!hc || dist(p, hc.at) > 10) { exo.reach = Math.max(exo.reach, dist(home, p) + 20); const f = pathExplore.find(p, home, 20000, false); hc = { at: { x: p.x, z: p.z }, secs: f ? f.cost : dist(p, home) * EXPLORE_DETOUR * 2 / WALK_SPEED }; } return hc.secs; };
    const late = () => exploreLate(clock.time, homeSecs());
    try {
      const there = yield* walk(c.x, c.z, { stop: 2, finder: pathExplore, until: late });
      if (there && !late()) {
        yield* pauseHere(0.7);
        yield* arrive('shore', c); yield* arrive('palms', c); yield* arrive('forest', c);   // what is within reach of the far end: driftwood, a nut to husk, a handful of berries
      }
      fullPace = exploreLate(clock.time, homeSecs(), PACE);
      exo.reach = Math.max(exo.reach, dist(home, p) + 20);
      if (!(yield* walk(home.x, home.z, { stop: 3, finder: pathExplore }))) yield* walk(home.x, home.z, { stop: 3 });
      yield* deliver();
    } finally { exploring = false; fullPace = false; inp.learns = false; stats.exploreSecs += now - t0; idleInput(); }
    return true;
  }

  // 0.29.4: what he went for by day and could not find on ground he knows (wood, a nut to husk) sends him exploring at once, when a trip is allowed (exploreChance > 0), without waiting for an idle moment (which the stores and the fire may never leave him)
  function* exploreForLack() {
    const missing = exploreMissing(homeSpot());
    if (missing.length && exploreChance({ time: clock.time, day: clock.day, thirst: game.thirst.days, hunger: game.hunger.days, last: exploredDay, missing: missing.length, cool: { explore: isCool('explore') }, crab: crabTripOk(senses()) }) > 0) yield* exploreTrip(missing);
  }
  let lastStroll = null;
  // Embers are a small exception to the daytime fire rule: while idle, Dave
  // uses a dry piece already under his arm if he passes his own home fire.
  // He never fetches wood or maintains flames by day, so it cannot become a
  // permanent daytime fire goal or interrupt an errand.
  function feedPassingEmber() {
    const f = fireAt(fireSpot(homeSpot()));
    return !!f && f.fuel <= 0 && W.load() > 0 && dist(p, f) <= 1.2 && !!pressKind(['feed']);
  }
  function* idleGoal() {
    const h = homeSpot(), t = clock.time;
    if (t >= GAZE_FROM && t < GAZE_TO && gazedDay !== clock.day) { gazedDay = clock.day; return yield* gaze(); }
    const step = homeNext(homeSnap()), need = step ? homeNeed(step, h) : null;   // 0.29.3: the next piece of his home
    if (feedPassingEmber()) { yield; return true; }
    if (W.load() && !(need && need.kind && need.kind === carriedKind())) {   // wood goes to the fire's pile (wet building timber, left over from a trip, to the site, never to the fire: it would not catch); fronds and stones he does not need now are laid down
      const ck = carriedKind(), wet = ck === 'drift' && W.carried.reduce((n, l) => n + dryness(l, clock.total), 0) / W.carried.length < 0.6, d = wet && proj.site && !game.leantos.list.length ? siteDest(proj.site, 'driftwood', 'branch') : null;
      if (d) { if (yield* walk(d.x, d.z, { stop: 0.35 })) yield* layAt(d); } else if (ck === 'drift' || ck === 'branch') yield* deliver(); else yield* layAt(p);   // (0.29.5: deliver lays wet wood on the drying pile)
    }
    const s = senses();
    if (need && !crabTripOk(s)) return yield* homeGoal(step, need);
    if (yield* stockDrying()) return true;   // 0.29.15: a finite reserve job, below needs, evening fire, stores and the morning home work
    if (clock.day > exploredDay && clock.time >= EXPLORE_FROM && clock.time < EXPLORE_TO) {   // 0.29.4: now and then he goes exploring
      const missing = exploreMissing(h), chance = exploreChance({ time: clock.time, day: clock.day, thirst: s.thirst, hunger: s.hunger, last: exploredDay, missing: missing.length, cool: s.cool, crab: crabTripOk(s) });
      if (chance > 0 && rngEx() < chance) return yield* exploreTrip(missing);
    }
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
      if (sitKind({ time: clock.time, long: false, fireNear: !!nearFlame(SIT_FIRE), gazing: false }) === 'fire') setSit(lookAt(), 'fire'); else inp.sit = false;
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
      if (plan === 'gather') { const ok = yield* gatherWood(); if (!ok) { cool('gather'); lack.wood = clock.day; } return ok; }
      return true;
    }
    if (plan === 'husk') { const ok = yield* huskGoal(); if (!ok) yield* exploreForLack(); return ok; }
    if (plan === 'wood') { const ok = yield* gatherWood(); if (!ok) { cool('gather'); lack.wood = clock.day; yield* exploreForLack(); } return ok; }
    return true;
  }

  const GOALS = { drink: drinkGoal, eat: eatGoal, sleep: sleepGoal, idle: idleGoal, fire: () => stuffGoal('fire'), stores: () => stuffGoal('stores') };

  function think(kind) {
    if (!cur || cur.thoughts.has(kind)) return;
    cur.thoughts.add(kind);
    if (onIntent) onIntent({ kind, goal: cur.name });
  }
  function startGoal(name) {
    if (name !== 'idle') inp.sit = false;   // 0.29.2: any task but idling needs him on his feet
    cur = { name, t0: now, it: GOALS[name](), rank: RANK[name], thoughts: new Set() }; mind.goal = name; stats.goals[name] = (stats.goals[name] || 0) + 1; ev('goal', { goal: name, thirst: +game.thirst.days.toFixed(2), hunger: +game.hunger.days.toFixed(2) });
    const intent = { drink: 'drinkIntent', eat: 'foodIntent', sleep: 'sleepIntent' }[name];
    if (intent) think(intent);
    // a torch left in his hand is stuck in the ground first (it cannot be carried with wood)
    if (game.fire.torch && name !== 'fire' && pressKind(['plant'])) { /* the press is done in the next update */ }
  }
  function endGoal(why, failed) {
    if (cur && why) { ev('goal-dropped', { goal: cur.name, why }); }
    if (cur && (failed || why === 'timeout') && cur.name !== 'idle') cool(cur.name);
    try { if (cur) cur.it.return(); } catch (e) { /* the generator is gone anyway */ }
    cur = null; mind.goal = null; idleInput(); chose = false; fullPace = false;
  }

  function engage() {
    if (mind.active) return;
    mind.active = true; anchor = { x: p.x, z: p.z }; restUntil = now + 1 + 2 * rand(); mind.resting = true;
  }
  function release() {
    if (!mind.active) return;
    endGoal(); headingWanted = null; mind.active = false; mind.resting = false; pressed = null; choice = null; sleepKey = false; inp.up = inp.down = inp.left = inp.right = false; idleInput(); inp.sit = false; inp.pace = 1;
  }

  function step(dt) {
    if (!mind.active) return;
    now += dt;
    if (headingWanted !== null) inp.yaw = headingWanted;   // a lean-to being started opens towards the fire (main sets the view's yaw each frame, before this)
    if (p.sitting > 0.5) stats.sitSecs += dt;
    if (game.sleep.asleep || p.lie > 0) {   // never wakes him, never acts in his sleep
      if (cur) endGoal(); idleInput(); inp.sit = false; pressed = null; choice = null; sleepKey = false;
      if (game.sleep.asleep && p.lie >= 1) slept = { x: p.x, z: p.z };
      return;
    }
    if (busy()) return;   // kneeling or bending: the game finishes it
    sinceCheck += dt;
    if (cur && sinceCheck >= CHECK) {   // a higher need breaks into a lower goal, except an errand that must first deliver
      sinceCheck = 0;
      const want = chooseGoal(senses());
      if (errandPreempts(cur.name, want, errands > 0, game.thirst.days, game.hunger.days)) endGoal('preempted by ' + want);
      else if (now - cur.t0 > (cur.limit || LIMIT[cur.name])) endGoal('timeout', true);
    }
    if (!cur) {
      const crit = game.thirst.days >= 1 || game.hunger.days >= 2 || (game.sleep.canLie(clock.time) && (clock.time >= BED_FROM || clock.time < DAWN));   // 0.29.2: at night, once he may lie down, he does not stand about first (a cold night is two sleeps and the second has little time)
      if (now < restUntil && !crit) { mind.resting = true; restSit(); if (!p.moving) stats.idleSecs += dt; return; }
      mind.resting = false;
      const name = chooseGoal(senses());
      if (name === 'idle' && now < restUntil) { mind.resting = true; restSit(); if (!p.moving) stats.idleSecs += dt; return; }   // nothing he can do about a need: no spinning
      if (name === 'none') return;
      startGoal(name);
      if (p.sitting > 0 && !inp.sit) return;   // 0.29.2: he gets up first
    }
    inp.pace = cur && (cur.name === 'idle' || exploring) && !fullPace ? PACE : 1;   // 0.29.2 "Amble": strolls and idling at an amble, errands at the normal walking pace
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
  mind.path = path; mind.strollCands = strollCands; mind.leantoSites = leantoSites; mind.dryingSite = dryingSite; mind.dryPiles = () => W.piles.filter(isDrying); mind.materialFind = (kind, range) => nearestBy(kind, range);
  mind.homePlan = () => { const h = homeSpot(), sn = { ...homeSnap(), time: HOME_FROM, day: Math.max(clock.day, HOME_DAY), builtDay: -1, cool: {} }, step = homeNext(sn); return { step, need: step ? homeNeed(step, h) : null, site: proj.site, snap: sn }; };
  return mind;
}
