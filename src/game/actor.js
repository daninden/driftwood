/**
 * game/actor — Dave's hands in full AI play (0.37.0 "Actions"): it follows a plan of single actions (game/actions) and reports back how each step went.
 * Pure: no DOM, no WebGL, no network, no random numbers of its own. Since 0.38.0 "Only him" it is the only thing that plays Dave (the old rules mind is gone); the tests drive it with a fixed fake chooser.
 *
 * It adds no game rule: it fills an input object like the player's (a walk target, a press of the action button or an icon of the arc, a click on the inventory
 * row, sitting) and so can do only what a player could do. Walks to a place stay on ground he knows (game/known); a wander may go into ground he does not know.
 * Everything he walks past is learned (the input never says `learns: false`).
 *
 * createActor(world, game, { chooser, onEvent?, dayNo? }) -> actor   (dayNo(clock day) -> the day as the request counts it, 0.38.2; default as the clock)
 *   chooser(menu, ask) -> plan | null | WAIT     asked when there is no plan: at the start, when a plan is done, when a step failed, on an interruption (rain begins, he
 *                                                 collapsed) and after he wakes. ask = { why: 'start' | 'done' | 'failed' | 'rejected' | 'rain' | 'collapsed' | 'woke', last }
 *                                                 (last: the last step's record, or the reason a plan was rejected). null or WAIT: no plan yet; he stands still
 *                                                 (`actor.waiting`) and the chooser is asked again on the next step. A plan that `checkPlan` refuses is not followed:
 *                                                 it is remembered as rejected, with the reason, and the chooser is asked again.
 *   actor.input                                   the input object for game.update
 *   actor.step(dt)                                one step of the hands (call before game.update(actor.input, dt))
 *   actor.menu() -> menu                          what he could do now (pure but for the path searches; no state changes):
 *                                                   { here: [{ id, what }], uses: [{ id, what }], places: [place], fires: [fire], dirs, carries, light, minutes: PLAN_MINUTES }
 *                                                   (carries.dryDriftwood, 0.41.0: how much of the driftwood he carries is dry enough to burn)
 *                                                   (a pile place has `fuel`, 0.42.1 "Kindling": its dry pieces that burn, for ai/actPrompt `kindlingText`)
 *                                                   fire (0.37.10 "Body"): { id, state: 'burning' | 'embers' | 'cold', hours (left while burning), ring, dist, dir }: every fire of his on the menu
 *                                                   place: { id, kind, what, x, z, dist, dir, minutes, nearby, offers: [kind], notNow? } (offers: what the action button would offer standing there, with what he holds now, a pickup of it as 'take' (0.41.0); 0.40.0 notNow: why what lies there cannot be taken up with what he holds, `holdWhy`)
 *   actor.plan -> { steps, minutes, at, menu, say, why } | null      the plan being followed (menu: the menu it was chosen from; its place ids hold for the whole plan; say: the chooser's thought for it)
 *   actor.stepIndex, actor.waiting, actor.why             the running step, whether he waits for a plan, why the next plan is (or was last) asked
 *   actor.recent -> [record]                      the last RECENT_MAX records { day, time, kind ('step' | 'plan' | 'rejected' | 'interrupt'), what, outcome ('done' | 'failed' | ...), reason }
 *   UNREACHED_HOURS (6)                           0.43.4: how long a loose thing he could not get to stays off the menu
 *   actor.stats                                   { plans, rejected, steps, done, failed, interrupts, waits (steps with no plan) }
 *
 * The steps (game/actions): `go` walks to a place of the plan's menu: a pile or a fire to a standing spot where the game offers its action (game/stand), river water until
 * drinking is offered, a loose thing (a coconut, a piece of wood, a stone, a bush, the spear, a log) until it is offered, a lean-to to its front, a tree beside its
 * trunk, crab holes to their colony; it fails when the thing is gone, there is no way, or the walk stalls (with that reason). `wander` walks out that way for its minutes
 * (it fails only when there is no ground to go to that way). `do` presses that action when the action button or its arc offers it where he stands (else it fails: "not
 * offered here", with what is missing when the game knows, game/lack) and waits until the work is done; it fails when nothing changed (a dig whose crab got away, a drill that
 * did not catch). `use` eats or drinks a carried thing (game/game `use`). `wait` sits for its minutes. A sleep ends when he wakes; then a new plan is asked.
 * 0.40.3 "Weary": a sleep step's record (its note) says whether it was a nap, how long he slept and how long he is awake now (`sleepNote`); the request after waking tells it.
 *
 * 0.37.2 "Torch": a `go` or `wander` that starts in the dark (or would end after dusk) is allowed only with a burning torch in his hand or, for a `go`, with both where he stands and the place
 * in the light of a burning fire or a torch in the ground (game/dark `walkLight`); else the step fails with the plain reason ("it is dark and he has no torch ...") and a new plan is asked.
 * It is checked when the step starts; a torch that burns out on the way does not stop the walk. A walk of under 1.5 m (the place he stands at) is no walk. A sleep and a fishing are plans
 * of their own (game/actions `checkPlan`): `do: 'fish'` with minutes strikes at fish again and again (a step into the shallows first when he does not stand in them, within FISH_WALK m
 * on ground he knows) until a fish is caught (done) or the minutes run out (done, with the note "no fish in N minutes": a normal end, the next plan is asked).
 * 0.39.0 "Landfall": until he has begun a lean-to, the menu has the places for a home he has seen (kind 'homespot': a point of a HOME_GRID m grid on known ground within HOME_R where
 * game `homeFits` for one of the eight ways, spaced HOME_APART apart, nearest first; `what` says the fresh water he knows nearest, the shore, the trees within 20 m and those where the hut will go;
 * cached until a lean-to or a felled tree changes the ground); a `go` to one stands where its lean-to would be started and sets input.siteYaw (its way) until the next walk or the plan's end,
 * so "buildHere" opens it that way; a refused "buildHere" says why ("no home fits here: ...").
 * 0.40.1 "Clear": the places for a home are looked at again whenever the camp changes (a pile or a fire laid, taken or burnt out: the camp's key), so a place that a pile now blocks
 * leaves the menu; a "go" to a place that no longer fits says what is in the way and where (`homeWay`, game `siteBlock` then `homeBlock`): "his pile of 4 stones (laid 09:45) (pile1) right
 * there lies where the lean-to would go; carry it away, or choose another place".
 * 0.38.3 "Steady": when rain stops a plan, the work he is doing stops too (input.stopWork for one frame, as walking off stops it): the interrupt's record says what stopped
 * ("stopped felling the tree: the chopping done so far is kept", else "nothing was used up; it would start over").
 * 0.38.2 "True": a step is done only when the action itself changed something (`changed`: thirst and hunger only when they went down, a fire only with more fuel or a new
 * fire burning; time alone changed them, so a dig that caught nothing was "done"); the lay-downs the game makes on its own (before a drink, a fill, a fell or a torch, when he lies down
 * to sleep, when he collapses) are told in that step's record ("he laid down what he carried first: ..."); "crab" roasts a carried fish when he has no crab, and says so when he carries
 * neither; a pile in the hut's way is named by its id; driftwood is "wet" only when too wet to burn (under TORCH_DRY, was 0.95); a pile's lay day is the request's (`dayNo`).
 * 0.38.1 "Trace": a place keeps its id as long as it exists (`placeId`: the n-th thing of its kind he came to know, by the thing's own id where it has one; fires and lean-tos too), so branch4
 * is the same branch in every request (not kept across a reload); his piles say "his pile of ..." with when he last laid on it (pile.laid, set by game/game: "laid 08:44", "laid day 2 08:44" on
 * another day); a done "take" or "lay" step's record (0.41.0; "pickup" and "lay" before) says what it took or laid and what he carries after it ("picked up 1 branch; now under his arm: 1 driftwood, 1 branch, 1 frond (3 of 3)",
 * "laid 3 pieces down: 2 branches on a new pile here (pile7); a frond on his pile of fronds here (pile2, now 4)"), in the record's reason.
 * 0.37.9 "Far": the menu's `island` { across (metres), seen (% of the island's land cells of game/known) }; a pile of driftwood says how many pieces are dry and how many wet.
 * 0.37.8 "Firelight": no walk in the dark without light again (game/dark; the half pace of 0.37.6 is gone); a walk's minutes are at the pace he has now (`paceNow`: his load,
 * tired, thirsty, hungry, as game/game; WALK_SLACK 1.1, was 1.25 for the load); his fires and lean-tos stay on the menu when no route to them is found (the straight line x LEG_DETOUR);
 * reasons for a refused sleep (in water, too soon after waking at night, by day before half a day awake) and take up the spear (already in hand, none lying, a log, stones, a torch
 * with wood, too far).
 * 0.40.0 "Belt": the axe is at his belt once made (game/axe): no axe on the menu, no take or lay; a refused "fell" says why (no axe, a log, stones, the spear, a torch, water, no trunk).
 * 0.37.7 "Reasons": a `do` waits while the game has an action queued (player.queued: the bend that lays the wood down before a fell, a drink or a fill), so a "fell" with wood
 * under his arm lasts the whole felling (it ended after the bend before); a hut with no room says what is in its way and where (`hutWay`, game `hutBlock`); a refused "feed" says
 * why (no wood, no fire beside him, the wood too wet, the fire full, a fire within RING_NOFIRE of his stone ring).
 * 0.37.5 "Ways": a place's minutes come from the length of the route (`walkMinutes`: metres / WALK_SPEED with WALK_SLACK; the path's paced cost was about four times the real walk);
 * more reasons (`whyNot`: dig, drink when not thirsty, lay, the tool not in hand, the hut's next part or no room for it); a lean-to with walls, bed and ring tells the hut's parts
 * and whether it has room; `use` waits until he stands still and says a torch or water stands in the way.
 * 0.37.4 "Lessons": a failed action says why in plain words where the game knows (`whyNot`: the lack of the fire or the spear only for 'light' and 'fish'; for 'pickup' (a take) the
 * spear in hand, a log, a torch with other wood, taking from a pile with something under his arm, full arms; for 'buildIn' / 'upgrade' the kind the lean-to needs next).
 * 'light' is done only when a fire burns within 3 m afterwards (the drill uses the fibre either way). Fires and lean-tos keep their number on the menu (fire<n>, leanto<n>; since 0.38.1 every place keeps its id); a fire says its pieces and hours left, a lean-to its parts and what it needs next. The menu's `count` is { claimed, minutes } of the last plan
 * followed when the chooser counted it itself.
 * The menu also has `light`: { dark, hours (until dusk by day, until dawn in the dark), torch: { minutes left } | null, planted: [{ dist, dir, minutes }] (torches in the ground within 40 m), lit (he stands in firelight) }.
 *
 * 0.41.1 "Straight": a `lay` `at` a place for a home lays the new pile beside the room the whole home keeps free (`homeAside`), never on it.
 * 0.41.0 "Hands": the steps `take` and `lay` (game/actions; "pickup" and "lay" are no `do` actions any more). A `take` fails at once when the thing is gone or his hands are no room for it
 * (`holdWhy`), keeps the dark rule of a walk, sets input.take ({ id } of a loose piece, { pile, count? } of a pile) for that step, walks there (a pile's 'take' standing spot of game/stand) and
 * presses the pickup the game then offers for that thing alone. A `lay` fails at once when he carries nothing of that kind (saying what he carries) or the pile named is full; it sets input.lay
 * ({ kind, count?, pile? | toward? }) and lays down there: on a pile of that kind from its 'layOn' standing spot (what does not fit stays with him, and the record says so), beside any other place
 * of the menu (he walks to about 1.6 m of it and a NEW pile goes down on its side), or where he stands ("here"). A count above what he carries lays what he carries (the record says so).
 * The record of a done take or lay says what was taken or laid where and what he carries after it, as before. The lay-downs the game makes on its own still lay everything.
 * 0.40.2 "Armful" (input.pickWant, the piece a "go" led to, is gone in 0.41.0: a `take` names it); a trunk in the hut's way (or where a lean-to would go) is named by its id ("a tree trunk (tree12)"), and the trunks in a hut's way are always on the menu
 * (`hutTreeBlocks`); a refused "use" says why (`useWhy`: lying down, busy, a torch, water, nothing of that kind carried, no fire for a crab), after waiting up to 20 s for a bend to end;
 * a pile of one piece is "1 log", "1 branch".
 * 0.40.0 "Belt": a felled log says whether it is still green or dry for the hut (game/logs `seasoned`), a log pile how many of its logs are; a refused hut part with a green log says when it is dry.
 * 0.43.5 "Enough": the menu's `firewood` (`firewoodInfo`): the dry firewood on all his piles and the hours of fire it makes, and what the coming night takes (the night's hours,
 * the hours his burning fire still covers, the pieces of dry driftwood for the rest), for ai/actPrompt `firewoodText`.
 * 0.43.4 "Give up": a loose thing (or a felled log) that a `go` or a `take` could not get to (stuck, no way, far too long, could not reach it: REACH_FAIL) is left off the menu for
 * UNREACHED_HOURS game hours (`giveUp`, `unreachedAt`; not saved), and the failed step's reason says so.
 * 0.43.3 "Feed": a `lay` of firewood "at" his fire, or at a ring whose fire burns or glows (`fireOf`), goes on the fire (`layOnFire`: one `feed` a piece, `input.feed` the kind; the rest beside it);
 * the menu says how wood goes on a fire and that no second fire is lit in a ring with one in it.
 * 0.43.2 "One fire": a pile in a finished stone ring counts all the firewood in the ring (`ringPiles`, `ringWood`; its `fuel` is the ring's dry pieces and it is marked `inRing`), and the lean-to says
 * which piles its ring holds and how many pieces they make together.
 * 0.40.4 "Ring": a pile of driftwood or branches on the menu says when it lies in a lean-to's finished stone ring ("in the stone ring of leanto1: ready to light where it lies",
 * or how many pieces it still needs) or within RING_NOFIRE of it but not in it (it cannot be lit); a lean-to with a finished ring says what the ring holds (his fire, a pile by its id,
 * or nothing); a refused "light" says why (`lightWhy`: water, no fibre or torch, no pile beside him (and which pile lies in the ring), a pile beside the ring, a pile under FIRE_MIN
 * pieces and the wood he holds for it); a refused "lay" with nothing to lay says so; the walk to a standing spot (`goStand`) has the time limit of the other walks, and a step waits
 * at most IDLE_MAX real seconds for him to finish his work (else it fails: "it took far too long").
 * Depends on: game/actions (also WAIT), game/dark, game/logs, game/fish, game/path, game/route, game/movement, game/water, game/wood, game/felled, game/leanto, game/clock, world/constants
 */
import { HALF, T, NT } from '../world/constants.js';
import { createPath } from './path.js';
import { createRoute } from './route.js';
import { canStand, terrainAt, WALK_SPEED } from './movement.js';
import { leantoPoint } from './obstacles.js';
import { fishableAt, FISH_DEPTH } from './fish.js';
import { walkLight, litAt, isDark, hoursToDusk, hoursToDawn } from './dark.js';
import { freshWater } from './water.js';
import { dryness, LOG_WALK, CARRY_SLOW, CARRY_MAX, STONE_MAX, PILE_MAX } from './wood.js';
import { LISTS, treeId, sizeKind, trunkRadius } from './felled.js';
import { seasoned, dryAt, SEASON_DAYS } from './logs.js';
import { CELL as KNOWN_CELL, NC as KNOWN_NC } from './known.js';
import { standFor, HUT_KEEP, nextKind, built, partsOf, UP_ORDER, hutKind, hutReady, hutBegun, hutDone, ringCentre, RING_R, RING_NOFIRE, stageOf } from './leanto.js';
import { fireOutlook, full as fireFull, BURN, BRANCH_BURN, RING_BURN, TORCH_DRY, FIRE_MIN } from './fire.js';
import { TIRED_AT, SLEEP_AFTER, NIGHT_AFTER, DUSK, DAWN } from './sleep.js';
import { WAIT, PLAN_MINUTES, NEARBY, NEARBY_MAX, PER_KIND, DIRS, DO, USE, LEG_DETOUR, gameMinutes, realSecs, dirOf, checkPlan, stepKind, stepText, stepMinutes } from './actions.js';

const BESIDE_FIRE = 1.2;          // game BESIDE: a fire this close (from its edge) is beside him
export const RECENT_MAX = 20;
export const UNREACHED_HOURS = 6;   // 0.43.4 "Give up": a loose thing he could not get to stays off the menu this many game hours
const REACH_FAIL = /stuck on the way|took far too long|no way there|could not reach|could not get to it|no spot he can stand/;   // the reasons that mean he could not get to it
export const SCAN_R = 150;          // metres round him in which the menu looks for places he knows
export const FISH_WALK = 40;        // metres: how far from where he stands a fishing looks for the shallows (known ground only)
export const walkMinutes = metres => Math.max(1, Math.ceil(gameMinutes(metres / WALK_SPEED * WALK_SLACK)));   // 0.37.5: a walk of that many metres of route in game minutes (with a little slack)
const ASIDE_GAP = 1.0;   // 0.41.1 "Straight": how far outside the home's free room he stands to lay material beside a place for a home
const STOP = 0.12, SETTLE = 3, WALK_SLACK = 1.1, SETTLE_TICKS = 12, ASIDE = 3, IDLE_MAX = 300;   // IDLE_MAX (0.40.4): real seconds a step waits for him to finish his work (a felling is 50, a drill 14)   // the follower's stop at a standing point (as game/mind), and the walk's estimate made a little longer for the slower pace of a load

export function createActor(world, game, opts = {}) {
  const chooser = typeof opts.chooser === 'function' ? opts.chooser : () => null;
  const onEvent = typeof opts.onEvent === 'function' ? opts.onEvent : null;
  const dayNo = typeof opts.dayNo === 'function' ? opts.dayNo : d => d;   // 0.38.2: the clock's day as the player counts it (main: day 1 is the day the game started), for the lay time of a pile
  const p = game.player, clock = game.clock, W = game.wood, known = game.known;
  const MARGIN = 1.5, DIAG = MARGIN * 0.75;
  const inside = (x, z) => known.hasAround(x, z, MARGIN, DIAG);
  const path = createPath(world, { allow: inside, allowVersion: () => known.count, obstacles: game.movement.obstacles });
  const pathFree = createPath(world, { obstacles: game.movement.obstacles });
  const stats = { plans: 0, rejected: 0, steps: 0, done: 0, failed: 0, interrupts: 0, waits: 0 };
  let now = 0, gen = null, why = 'start', last = null, rainWas = game.rain > 0, sleeping = false, pressed = null, choice = null;
  const actor = { input: null, plan: null, stepIndex: -1, waiting: false, recent: [], stats, step, menu, get why() { return why; } };
  const inp = actor.input = {
    up: false, down: false, left: false, right: false, run: false, stick: null, target: null, yaw: undefined, pace: 1, sit: false, stopWork: false,
    takeWake: () => false, takeLight: () => false, pressing: () => false, cancelAction() { pressed = null; }, clearTarget() { inp.target = null; },
    takeAction: () => { const k = pressed; pressed = null; return k; }, takeChoice: () => { const k = choice; choice = null; return k; }, takeSleep: () => false,
  };
  const emit = (type, data) => { if (!onEvent) return; try { onEvent({ type, day: clock.day, time: +clock.time.toFixed(3), x: +p.x.toFixed(1), z: +p.z.toFixed(1), ...data }); } catch (e) { /* not the actor's business */ } };
  const remember = (kind, what, outcome = null, reason = null) => {
    const r = { day: clock.day, time: +clock.time.toFixed(3), kind, what, outcome, reason };
    actor.recent.push(r); if (actor.recent.length > RECENT_MAX) actor.recent.shift();
    return r;
  };
  const idle = () => { inp.target = null; inp.run = false; };
  const busy = () => game.sleep.asleep || p.lie > 0 || !!p.work || !!p.queued || p.stoop > 0 || (p.sitting > 0 && !inp.sit);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  let landCells = null;   // 0.37.9 "Far": the island's land cells of game/known (dry ground at the cell's middle), counted once
  const islandInfo = () => {
    if (!landCells) {
      landCells = []; let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (let iz = 0; iz < KNOWN_NC; iz++) for (let ix = 0; ix < KNOWN_NC; ix++) {
        const x = (ix + 0.5) * KNOWN_CELL - HALF, z = (iz + 0.5) * KNOWN_CELL - HALF;
        if (world.H(x, z) > 0.2) { landCells.push(iz * KNOWN_NC + ix); if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
      }
      landCells.across = Math.round(Math.max(x1 - x0, z1 - z0) / 50) * 50;
    }
    let seen = 0; for (const k of landCells) if (known.hasCell(k)) seen++;
    return { across: landCells.across, seen: Math.round(100 * seen / Math.max(1, landCells.length)) };
  };
  const paceNow = () => Math.max(0.2, (W.log ? LOG_WALK : 1 - CARRY_SLOW * W.load()) * game.sleep.speed() * game.thirst.speed() * game.hunger.speed());   // 0.37.8 "Firelight": the share of his full pace (game/game update)
  const HUT_IN_WAY = { leanto: 'another lean-to', tree: 'a tree trunk', rock: 'a boulder', pile: 'a pile', fire: 'a fire place', burnt: 'a burnt place (old ashes)' };
  function hutWay(l) {   // 0.37.7 "Reasons": what keeps the hut from fitting round finished lean-to l, in words (game `hutBlock`)
    const b = game.hutBlock(l);
    if (!b) return 'the hut has no room here';
    if (b.what === 'ground') return `the hut has no room here: ${b.steep ? 'the ground round the lean-to is not level enough' : 'the ground round the lean-to is wet or will not bear him on one side'}; it can never stand at this lean-to`;
    const d = Math.round(dist(b, l)), where = d < 1 ? 'at the lean-to' : `${d} m ${dirOf(b.x - l.x, b.z - l.z)} of the lean-to`;
    const pile = b.what === 'pile' ? W.piles.filter(q => dist(q, b) < 1).sort((u, v) => dist(u, b) - dist(v, b))[0] : null;   // 0.38.2: which pile, by its id
    const fixed = b.what === 'tree' ? 'fell it' : b.what === 'rock' || b.what === 'leanto' ? 'it cannot be moved' : b.what === 'pile' ? 'carry it away' : b.what === 'burnt' ? 'the ashes fade within two days' : 'once the fire has burnt out, its ashes fade within two days';
    return `the hut has no room here: ${inWay(b, pile)} ${where} stands in its way; ${fixed}`;
  }
  // 0.40.2 "Armful": the thing in the way in words, a pile or a trunk by its id (a trunk 2 m from the lean-to was not on the menu, and the hut stood blocked for two days)
  const inWay = (b, pile) => (pile ? `his ${pileWhat(pile).replace(/^his /, '')} (${placeId('pile', pile)})` : b.what === 'tree' && Number.isInteger(b.tree) ? `a tree trunk (${placeId('tree', { id: b.tree })})` : HUT_IN_WAY[b.what] || 'something');

  function homeWay(site) {   // 0.40.1 "Clear": what keeps a place for a home from fitting now, in words (game `siteBlock`, then `homeBlock`)
    const b = game.siteBlock(site) || game.homeBlock(site);
    if (!b) return 'something now stands in the way';
    if (b.what === 'ground') return b.steep ? 'the ground there is not level enough for the hut' : 'the ground there is wet or will not bear him';
    const d = Math.round(dist(b, site)), where = d < 1 ? 'right there' : `${d} m ${dirOf(b.x - site.x, b.z - site.z)} of it`;
    const pile = b.what === 'pile' ? W.piles.filter(q => dist(q, b) < 1).sort((u, v) => dist(u, b) - dist(v, b))[0] : null;
    const fixed = b.what === 'pile' ? 'carry it away, or choose another place' : b.what === 'fire' || b.what === 'burnt' ? 'ashes fade within two days after a fire burns out; choose another place' : 'choose another place';
    return `${inWay(b, pile)} ${where} ${b.what === 'tree' || b.what === 'rock' ? 'stands' : 'lies'} where the lean-to would go; ${fixed}`;
  }

  // ---------- what he knows round him ----------
  const tilesNear = (x, z, r) => {
    const out = [], tx0 = Math.max(0, Math.floor((x - r + HALF) / T)), tx1 = Math.min(NT - 1, Math.floor((x + r + HALF) / T)), tz0 = Math.max(0, Math.floor((z - r + HALF) / T)), tz1 = Math.min(NT - 1, Math.floor((z + r + HALF) / T));
    for (let tz = tz0; tz <= tz1; tz++) for (let tx = tx0; tx <= tx1; tx++) { const t = world.tiles[tz * NT + tx]; if (t) out.push(t); }
    return out;
  };
  const waterAll = (() => { const out = []; for (const rv of world.rivers) for (let i = 0; i < rv.pts.length; i += 2) { const q = rv.pts[i]; if (freshWater(world, q.x, q.z, 0) && canStand(world, q.x, q.z, 0)) out.push({ x: q.x, z: q.z }); } return out; })();
  const wet = l => dryness(l, clock.total) < TORCH_DRY;   // 0.38.2 "True": wet is too wet to burn (feeding and the torch take wood from TORCH_DRY on; it was 0.95)
  const LOOSE = {   // kind -> (tile) -> things lying there, and the words for one
    coconut:   { list: t => game.fibre.groundCocos(t), what: () => 'a coconut on the ground' },
    driftwood: { list: t => W.beachLogs(t).filter(l => l.y === undefined || l.y > game.sea - 0.05), what: l => wet(l) ? 'a piece of wet driftwood' : 'a piece of dry driftwood' },
    branch:    { list: t => game.branches.groundBranches(t), what: () => 'a fallen branch' },
    frond:     { list: t => game.fronds.groundFronds(t), what: () => 'a fallen palm frond' },
    stone:     { list: t => game.stones.groundStones(t), what: () => 'a loose stone' },
    berries:   { list: t => game.berries.bearingIn(t), what: () => 'a berry bush with berries' },
    bananas:   { list: t => game.bananas.bearingIn(t), what: () => 'a banana plant with a bunch' },
  };
  /** 0.40.0 "Belt": a felled log, green until SEASON_DAYS after its felling (game/logs), and when it is dry for the hut */
  const logWhat = l => (seasoned(l, clock.total) ? 'a felled log, dry for the hut' : `a felled log, still green (dry for the hut about ${dryText(l)})`);
  const dryText = l => { const t = dryAt(l); return `${Math.floor(t) === clock.day ? 'today' : `day ${dayNo(Math.floor(t))}`} ${clockText(t)}`; };
  const clockText = t => { const m = Math.floor(((t % 1) + 1) % 1 * 1440 + 1e-9) % 1440, pad = n => String(n).padStart(2, '0'); return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; };
  const laidText = q => (Number.isFinite(q.laid) ? ` (laid ${Math.floor(q.laid) === clock.day ? '' : `day ${dayNo(Math.floor(q.laid))} `}${clockText(q.laid)})` : '');   // 0.38.1 "Trace": when he last laid on it
  const pileWhat = q => `his pile of ${q.logs.length} ${q.kind === 'driftwood' ? (q.logs.every(l => !wet(l)) ? 'dry driftwood' : q.logs.every(wet) ? 'wet driftwood' : `driftwood (${q.logs.filter(l => !wet(l)).length} dry, ${q.logs.filter(wet).length} wet)`) : q.kind === 'branch' ? (q.logs.length === 1 ? 'branch' : 'branches') : q.kind === 'frond' ? (q.logs.length === 1 ? 'frond' : 'fronds') : q.kind === 'stone' ? (q.logs.length === 1 ? 'stone' : 'stones') : `${q.logs.length === 1 ? 'log' : 'logs'}${logsDry(q)}`}${laidText(q)}`;   // 0.40.2: "1 log", not "1 logs"
  const logsDry = q => { const g = q.logs.filter(l => !seasoned(l, clock.total)); return !g.length ? ', dry for the hut' : g.length === q.logs.length ? `, still green (the first dry for the hut about ${dryText(g.reduce((a, b) => (dryAt(a) <= dryAt(b) ? a : b)))})` : ` (${q.logs.length - g.length} dry for the hut, ${g.length} still green)`; };   // 0.40.0
  const fireWhat = f => {   // 0.37.4: how long it still burns
    const ring = !!game.leantos.ring(f.x, f.z), burning = game.fire.strength(f) > 0;
    const o = burning ? fireOutlook({ fuel: f.fuel, ring }) : null;
    return (burning ? `his fire, burning, about ${Math.max(1, Math.round(o.pieces))} piece${Math.round(o.pieces) === 1 ? '' : 's'} on it, about ${Math.round(o.hoursLeft * 2) / 2} hours left` : f.embers > 0.005 ? 'his fire, embers only (wood put on it flames up again, no drill needed)' : 'his fire place, cold') + (ring ? ' (in the stone ring)' : '')
      + (fireFull(f) ? '; it holds as much as it can' : '; dry driftwood or branches go on it with "feed" standing at it, or with a "lay" at it')   // 0.43.3 "Feed";
  };
  const fireInfo = q => {   // 0.37.10 "Body": a fire on the menu for the request's NOW: { id, state: 'burning' | 'embers' | 'cold', hours (left while burning), ring, dist, dir }
    const f = q.ref, ring = !!game.leantos.ring(f.x, f.z), burning = game.fire.strength(f) > 0;
    return { id: q.id, state: burning ? 'burning' : f.embers > 0.005 ? 'embers' : 'cold', hours: burning ? Math.round(fireOutlook({ fuel: f.fuel, ring }).hoursLeft * 2) / 2 : 0, ring, dist: q.dist, dir: q.dir };
  };
  const kindWord = k => (k === 'branch' ? 'a branch' : k === 'frond' ? 'a frond' : k === 'stone' ? 'a stone' : k === 'log' ? 'a log' : 'a piece of driftwood');
  const kindPlural = (k, n) => (n === 1 ? kindWord(k) : `${n} ${k === 'branch' ? 'branches' : k === 'frond' ? 'fronds' : k === 'stone' ? 'stones' : k === 'log' ? 'logs' : 'pieces of driftwood'}`);
  const stillNeeds = (l, w) => {   // 0.37.6 "Free hands": what a part still needs, in order, the runs of one kind counted: "3 branches, then 5 fronds"
    const rest = partsOf(w).slice(built(l, w)), runs = [];
    for (const k of rest) { const r = runs[runs.length - 1]; if (r && r.k === k) r.n++; else runs.push({ k, n: 1 }); }
    return runs.map(r => kindPlural(r.k, r.n)).join(', then ');
  };
  const leantoWhat = l => {   // 0.37.4: how far it is and what it needs next (0.37.6: all it still needs, counted)
    if (stageOf(l) === 'ring') return `his home, begun: its stone ring has ${built(l, 'ring')} of ${partsOf('ring').length} stones; it still needs ${stillNeeds(l, 'ring')}, then the lean-to behind it (${stillNeeds({ progress: 0 }, 'leanto')})`;   // 0.43.0 "Hearth": the ring first
    const next = nextKind(l, 'leanto');
    if (next) return `his lean-to${built(l, 'leanto') ? ', begun' : ' (its stone ring is finished, the lean-to not begun)'}: ${built(l, 'leanto')} of ${partsOf('leanto').length} parts; it still needs ${stillNeeds(l, 'leanto')}`;
    const up = UP_ORDER.map(w => [w, nextKind(l, w)]).find(([, k]) => k);
    if (up) return `his lean-to, finished; the ${up[0]} still need${up[0] === 'walls' ? '' : 's'} ${stillNeeds(l, up[0])}`;
    if (hutDone(l)) return 'his hut, finished';   // 0.37.5: the hut too
    const hk = hutKind(l);
    if (!hk) return 'his lean-to, finished with walls, bed and ring';
    return `his lean-to with walls, bed and ring; the hut: ${built(l, 'hut')} of ${partsOf('hut').length} parts, it still needs ${stillNeeds(l, 'hut')}${hk === 'log' ? ' (each log carried alone on his shoulder)' : ''}${!hutBegun(l) && !game.hutFits(l) ? ` (but ${hutWay(l)})` : ''}`;
  };
  // ---------- 0.40.4 "Ring": what lies in his stone ring, and the piles beside it that cannot be lit ----------
  const fuelKind = q => q.kind === 'driftwood' || q.kind === 'branch';
  const ringFire = l => { const c = ringCentre(l); return game.fire.fires.find(f => Math.hypot(f.x - c.x, f.z - c.z) <= RING_R) || null; };
  const ringOf = (x, z) => game.leantos.list.find(l => game.leantos.has(l, 'ring') && Math.hypot(ringCentre(l).x - x, ringCentre(l).z - z) <= RING_R) || null;   // the lean-to whose finished ring (x, z) lies in
  const ringPiles = l => { const c = ringCentre(l); return W.piles.filter(q => q.logs.length && fuelKind(q) && Math.hypot(q.x - c.x, q.z - c.z) <= RING_R); };   // 0.43.2 "One fire": every pile of firewood in the ring
  const ringPile = l => ringPiles(l)[0] || null;
  const ringWood = l => ringPiles(l).reduce((n, q) => n + q.logs.length, 0);   // 0.43.2: all the firewood in the ring counts together and burns together
  const ringDry = l => ringPiles(l).reduce((n, q) => n + (q.kind === 'branch' ? q.logs.length : q.logs.filter(x => !wet(x)).length), 0);
  const ringNote = q => {   // a pile on the menu: in the ring (ready to light, or how many it still needs), or beside the ring where no fire can be lit
    if (!fuelKind(q)) return '';
    const l = ringOf(q.x, q.z);
    const lf = l && ringFire(l);
    if (lf) return ` in the stone ring of ${placeId('leanto', l)}, where his fire ${placeId('fire', lf)} ${game.fire.strength(lf) > 0 ? 'burns' : 'glows'}: no second fire is lit there; this wood goes on the fire (take it up, then a "lay" at ${placeId('fire', lf)} or "feed" there)`;   // 0.43.3 "Feed"
    if (l) { const n = ringWood(l), all = ringPiles(l).length > 1 ? ` (all the firewood in the ring counts together: ${n} pieces)` : ''; return ` in the stone ring of ${placeId('leanto', l)}${all}: ${n >= FIRE_MIN ? 'ready to light where it lies ("light" beside it; all the firewood in the ring burns as one fire in its middle; taking wood from it makes it too small)' : `a fire needs at least ${FIRE_MIN} pieces in the ring (lay more here)`}`; }   // 0.43.2 "One fire"
    return game.leantos.noFire(q.x, q.z) ? ` (within ${RING_NOFIRE} m of his stone ring but not in it: it cannot be lit; only the fire in the ring)` : '';
  };
  const ringHolds = l => {   // a lean-to with a finished ring: what the ring holds now
    if (!game.leantos.has(l, 'ring')) return '';
    const c = ringCentre(l), f = game.fire.fires.find(q => Math.hypot(q.x - c.x, q.z - c.z) <= RING_R && (game.fire.strength(q) > 0 || q.embers > 0.005));
    if (f) return `; his fire is in its stone ring (${game.fire.strength(f) > 0 ? 'burning' : 'embers'}; firewood laid at the ring goes on it)`;   // 0.43.3 "Feed"
    const ps = ringPiles(l), n = ringWood(l);   // 0.43.2 "One fire": all its piles of firewood together
    return ps.length ? `; its stone ring holds his ${ps.length === 1 ? `pile ${placeId('pile', ps[0])}` : `piles ${ps.map(q => placeId('pile', q)).join(' and ')}`} (${n} piece${n === 1 ? '' : 's'} of firewood${n >= FIRE_MIN ? ', ready to light' : `, a fire needs ${FIRE_MIN}`})` : `; its stone ring is empty (wood laid down in it lies in its middle: ${FIRE_MIN} pieces of dry driftwood or branches there, then "light", make a fire in it)`;
  };
  // ---------- 0.39.0 "Landfall": the places for a home he has seen (until he has begun one) ----------
  const HOME_GRID = 6, HOME_APART = 15, HOME_R = 120;
  const homeCache = new Map(); let homeVer = '';
  function homeAt(ix, iz) {   // the place for a home at grid point (ix, iz): { id, site, heading, x, z (where he stands to start it) } or null; cached until a lean-to or a felled tree changes the ground
    const key = ix + ',' + iz;
    if (homeCache.has(key)) return homeCache.get(key);
    const x = ix * HOME_GRID, z = iz * HOME_GRID;
    let v = null;
    if (world.H(x, z) > 0.3 && canStand(world, x, z, 0)) for (let i = 0; i < 8 && !v; i++) {
      const site = { x, z, heading: i * Math.PI / 4 };
      if (!game.homeFits(site)) continue;
      const s = standFor(site);
      if (canStand(world, s.x, s.z, 0) && inside(s.x, s.z)) v = { id: 'home:' + key, site, heading: site.heading, x: s.x, z: s.z };
    }
    homeCache.set(key, v);
    return v;
  }
  function homeSpots() {
    if (game.leantos.list.length) return [];
    const ver = game.leantos.version + ':' + game.felled.list.length + ':' + game.movement.obstacles.camp.refresh().key;   // 0.40.1 "Clear": a pile or fire laid there changes the ground too
    if (ver !== homeVer) { homeCache.clear(); homeVer = ver; }
    const out = [], i0 = Math.ceil((p.x - HOME_R) / HOME_GRID), i1 = Math.floor((p.x + HOME_R) / HOME_GRID), j0 = Math.ceil((p.z - HOME_R) / HOME_GRID), j1 = Math.floor((p.z + HOME_R) / HOME_GRID);
    for (let iz = j0; iz <= j1; iz++) for (let ix = i0; ix <= i1; ix++) {
      const x = ix * HOME_GRID, z = iz * HOME_GRID;
      if (Math.hypot(x - p.x, z - p.z) > HOME_R || !known.has(x, z)) continue;
      const h = homeAt(ix, iz); if (h) out.push(h);
    }
    out.sort((a, b) => dist(a, p) - dist(b, p));
    return spaced(out, HOME_APART);
  }
  function homeWhat(h) {   // the facts of a place for a home: fresh water, the shore, the trees round it and in the hut's way
    const c = h.site, water = waterAll.filter(q => known.has(q.x, q.z)).reduce((m, q) => Math.min(m, dist(q, c)), Infinity);
    let shore = Infinity;
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; for (let d = 3; d <= 240 && d < shore; d += 3) if (world.H(c.x + Math.sin(a) * d, c.z + Math.cos(a) * d) < 0) { shore = d; break; } }
    let trees = 0;
    for (const t of tilesNear(c.x, c.z, 20)) for (const list of LISTS) t[list].forEach((tree, index) => { if (!game.felled.has(treeId(t, list, index)) && Math.hypot(tree.x - c.x, tree.z - c.z) <= 20) trees++; });
    const ht = game.hutTrees(c), m = v => `${Math.round(v)} m`;
    return `a place for a home (its stone ring, the lean-to behind it and later the hut fit here): ${Number.isFinite(water) ? `fresh water ${m(water)} away` : 'no fresh water he knows near'}, ${Number.isFinite(shore) ? `the shore ${m(shore)}` : 'the shore far'}, ${trees} tree${trees === 1 ? '' : 's'} within 20 m; ${ht ? `${ht} tree${ht === 1 ? ' stands' : 's stand'} where the hut will go (fell ${ht === 1 ? 'it' : 'them'} for the hut)` : "the hut's ground is clear of trees"}`;
  }
  /** 0.40.2 "Armful": the trunks that keep a hut from being begun (game `hutBlock` of each finished lean-to ready for it): always on the menu, by the id its reason names. */
  function hutTreeBlocks() {
    const ids = new Set();
    for (const l of game.leantos.list) if (hutReady(l) && !hutBegun(l)) { const b = game.hutBlock(l); if (b && b.what === 'tree' && Number.isInteger(b.tree)) ids.add(b.tree); }
    return ids;
  }
  // 0.43.4 "Give up": the loose things (and felled logs) a "go" or a "take" could not get to, with when (clock.total); off the menu for UNREACHED_HOURS, so the next plan chooses another
  const unreachedAt = new WeakMap();
  const unreached = o => { const t = unreachedAt.get(o); return t !== undefined && clock.total - t < UNREACHED_HOURS / 24; };
  function giveUp(pl, r) {
    if (r.ok || !pl || !(LOOSE[pl.kind] || pl.kind === 'log') || !REACH_FAIL.test(r.reason || '')) return r;
    unreachedAt.set(pl.ref, clock.total);
    return { ...r, reason: `${r.reason}; ${pl.id} is left off the menu for ${UNREACHED_HOURS} hours` };
  }
  function candidates() {   // every thing he knows within SCAN_R, by kind: [{ kind, ref, x, z, what }]
    const out = [], R = SCAN_R, near = q => Math.hypot(q.x - p.x, q.z - p.z) <= R && known.has(q.x, q.z), anywhere = q => known.has(q.x, q.z);   // water, fires and lean-tos he knows are on the menu however far
    for (const q of waterAll) if (anywhere(q)) out.push({ kind: 'water', ref: q, x: q.x, z: q.z, what: 'fresh river water' });
    for (const t of tilesNear(p.x, p.z, R)) for (const [kind, L] of Object.entries(LOOSE)) for (const o of L.list(t)) if (near(o) && !unreached(o)) out.push({ kind, ref: o, x: o.x, z: o.z, what: L.what(o) });
    for (const q of W.piles) if (q.logs.length && near(q)) out.push({ kind: 'pile', ref: q, x: q.x, z: q.z, what: pileWhat(q) + ringNote(q) });
    for (const f of game.fire.fires) if (anywhere(f)) out.push({ kind: 'fire', ref: f, x: f.x, z: f.z, what: fireWhat(f) });
    for (const l of game.leantos.list) if (anywhere(l)) out.push({ kind: 'leanto', ref: l, x: l.x, z: l.z, what: leantoWhat(l) + ringHolds(l) });
    for (const l of game.logs.near(p.x, p.z, R)) if (near(l) && !unreached(l)) out.push({ kind: 'log', ref: l, x: l.x, z: l.z, what: logWhat(l) });
    if (game.spear.at && near(game.spear.at)) out.push({ kind: 'spear', ref: game.spear.at, x: game.spear.at.x, z: game.spear.at.z, what: 'his spear, lying' });
    const blocks = hutTreeBlocks();
    if (game.axe.has() || blocks.size) for (const t of tilesNear(p.x, p.z, 60)) for (const list of LISTS) t[list].forEach((tree, index) => {
      const id = treeId(t, list, index); if (game.felled.has(id) || !near(tree) || Math.hypot(tree.x - p.x, tree.z - p.z) > 60 || (!game.axe.has() && !blocks.has(id))) return;
      const k = sizeKind(list, tree); out.push({ kind: 'tree', ref: { id, x: tree.x, z: tree.z, r: trunkRadius(tree, k) }, x: tree.x, z: tree.z, what: `a standing ${k === 'palm' ? 'palm' : k === 'pine' ? 'pine' : 'tree'}` });
    });
    for (const h of homeSpots()) out.push({ kind: 'homespot', ref: h, x: h.x, z: h.z, what: homeWhat(h) });   // 0.39.0
    for (const col of game.wildlife.coloniesNear(p.x, p.z, 120)) {
      if (!col.crabs.some(q => !game.crabs.isGone(q.id))) continue;
      const hole = col.holes.filter(h => known.has(h.x, h.z) && canStand(world, h.x, h.z, 0)).sort((a, b) => dist(a, p) - dist(b, p))[0];
      if (hole) out.push({ kind: 'crabs', ref: { col, hole }, x: hole.x, z: hole.z, what: 'crab holes (crabs come out at low water)' });
    }
    return out;
  }
  // 0.38.1 "Trace": a place keeps its id as long as it exists (the n-th thing of its kind he came to know): the same branch is branch4 in every request
  const idByKey = new Map(), idByRef = new WeakMap(), idNext = {};
  const placeKey = (kind, ref) => (kind === 'tree' ? 'tree:' + ref.id : kind === 'crabs' ? ref.col : kind === 'spear' || kind === 'axe' ? kind : ref && ref.id !== undefined && ref.id !== null ? kind + ':' + ref.id : ref);
  function placeId(kind, ref) {
    const k = placeKey(kind, ref), obj = typeof k === 'object' && k !== null;
    let n = obj ? idByRef.get(k) : idByKey.get(k);
    if (!n) { n = idNext[kind] = (idNext[kind] || 0) + 1; if (obj) idByRef.set(k, n); else idByKey.set(k, n); }
    return kind + n;
  }
  const spaced = (list, apart) => { const out = []; for (const c of list) if (!out.some(o => dist(o, c) < apart)) out.push(c); return out; };

  // ---------- the menu ----------
  let menuMemo = null, lastCount = null;   // lastCount (0.37.4): { claimed, minutes } of the last plan followed, when the chooser gave its own count
  function menu() {
    if (menuMemo && menuMemo.t === now) return menuMemo.m;
    const byKind = new Map();
    for (const c of candidates()) { c.dist = dist(c, p); if (!byKind.has(c.kind)) byKind.set(c.kind, []); byKind.get(c.kind).push(c); }
    const places = [];
    for (const [kind, list] of byKind) {
      list.sort((a, b) => a.dist - b.dist);
      const pool = kind === 'water' ? spaced(list, 20) : list;   // river points lie every few metres: a few spread out
      const close = c => Math.round(c.dist) <= NEARBY, nearby = pool.filter(close).slice(0, NEARBY_MAX), rest = pool.filter(c => !close(c));
      const pick = [...nearby, ...rest].slice(0, Math.max(PER_KIND, nearby.length));
      if (kind === 'tree') { const blocks = hutTreeBlocks(); for (const c of pool) if (blocks.has(c.ref.id) && !pick.includes(c)) pick.push(c); }   // 0.40.2: the trunk in the hut's way, however far down the list
      for (const c of pick) {
        const r = c.dist < 1.5 ? null : path.find(p, c);   // 0.37.5 "Ways": the walk's minutes from the length of its route (the path's cost in paced seconds was about four times the real walk)
        const always = kind === 'fire' || kind === 'leanto';   // 0.37.8 "Firelight": his fires and lean-tos are always on the menu; a route to the middle of a fire in the ring by the hut can fail (a fire vanished from the menu while it burned), then the straight line counts, as a later walk of a plan
        if (c.dist >= 1.5 && !r && !always) continue;
        let len = 0, q0 = p; if (r) for (const q of r.pts) { len += Math.hypot(q.x - q0.x, q.z - q0.z); q0 = q; } else if (c.dist >= 1.5) len = c.dist * LEG_DETOUR;
        const all = game.offersAt(c.x, c.z).map(o => o.kind), takeable = all.includes('pickup');
        const offers = [...new Set(all.map(k => (k === 'pickup' ? 'take' : k)))].filter(k => DO[k] || k === 'take' || k === 'lay');   // 0.41.0 "Hands": a pickup there is a "take" of it
        const mins = walkMinutes(len / paceNow());   // 0.37.8: at the pace he walks with now (his load, tired, thirsty, hungry), as game/game
        const notNow = takeable ? null : holdWhy(kind, c.ref);   // 0.40.0: why what lies there cannot be taken up with what he holds now
        places.push({ id: placeId(kind, c.ref), kind, ref: c.ref, what: c.what, x: c.x, z: c.z, dist: Math.round(c.dist), dir: dirOf(c.x - p.x, c.z - p.z),
          minutes: mins, nearby: Math.round(c.dist) <= NEARBY, offers, ...(notNow ? { notNow } : {}), ...(kind === 'pile' ? { ...(fuelKind(c.ref) && ringOf(c.ref.x, c.ref.z) ? { inRing: true } : {}), fuel: fuelKind(c.ref) && ringOf(c.ref.x, c.ref.z) ? ringDry(ringOf(c.ref.x, c.ref.z)) : c.ref.kind === 'branch' ? c.ref.logs.length : c.ref.kind === 'driftwood' ? c.ref.logs.filter(l => !wet(l)).length : 0 } : {})   /* 0.43.2: a pile in the ring: the dry firewood of the whole ring */ });   // 0.42.1 "Kindling": a pile's dry pieces that burn (ai/actPrompt `fireText`)
      }
    }
    places.sort((a, b) => a.dist - b.dist);
    const here = [], seen = new Set();
    for (const o of game.offersAt(p.x, p.z)) if (DO[o.kind] && !(o.kind === 'husk' && o.carried) && !seen.has(o.kind)) { seen.add(o.kind); here.push({ id: o.kind, what: DO[o.kind].what }); }
    const uses = [];
    if (game.shells.nuts) uses.push('nut');
    if (game.shells.full()) uses.push('water');
    if (game.berries.carried.length) uses.push('berries');
    if (game.bananas.carried.length) uses.push('banana');
    if (game.crabs.carried.length || game.fish.carried.length) uses.push('crab');
    const fires = places.filter(q => q.kind === 'fire').map(q => fireInfo(q));   // 0.37.10 "Body": every fire of his, also when none burns (the request says so)
    const m = { here, uses: uses.map(id => ({ id, what: USE[id].what })), places, fires, dirs: DIRS.slice(), carries: { ...carries(), dryDriftwood: W.carried.filter(l => !l.branch && !l.frond && !wet(l)).length }, light: lightInfo(), firewood: firewoodInfo(), island: islandInfo(), minutes: PLAN_MINUTES, count: lastCount };
    menuMemo = { t: now, m };
    return m;
  }
  /** 0.43.5 "Enough": the firewood on all his piles and what the coming night takes: { driftwood, branches (dry pieces), hours (of fire they make, in a ring where
   *  they lie in one), ring (he has a finished stone ring), dark, night (hours from dusk, or from now in the dark, to dawn), covered (of those, the hours his burning fires still have),
   *  need (pieces of dry driftwood for the rest, in the ring when he has one) }. */
  function firewoodInfo() {
    let driftwood = 0, branches = 0, hours = 0;
    for (const q of W.piles) {
      if (!fuelKind(q)) continue;
      const n = q.kind === 'branch' ? q.logs.length : q.logs.filter(l => !wet(l)).length, per = BURN * 24 * (ringOf(q.x, q.z) ? RING_BURN : 1);
      if (q.kind === 'branch') { branches += n; hours += n * per * BRANCH_BURN; } else { driftwood += n; hours += n * per; }
    }
    const t = clock.time, dark = isDark(t), toDusk = dark ? 0 : hoursToDusk(t), night = dark ? hoursToDawn(t) : (1 - DUSK + DAWN) * 24;
    const left = game.fire.fires.filter(f => game.fire.strength(f) > 0).reduce((h, f) => Math.max(h, fireOutlook({ fuel: f.fuel, ring: !!game.leantos.ring(f.x, f.z) }).hoursLeft), 0);
    const covered = Math.min(night, Math.max(0, left - toDusk)), ring = game.leantos.list.some(l => game.leantos.has(l, 'ring'));
    const need = Math.max(0, Math.ceil((night - covered) / (BURN * 24 * (ring ? RING_BURN : 1)) - 1e-9));
    return { driftwood, branches, hours: Math.round(hours), ring, dark, night: Math.round(night * 2) / 2, covered: Math.round(covered * 2) / 2, need };
  }
  const lightsNow = () => ({ fires: game.fire.fires.filter(f => game.fire.strength(f) > 0), torches: game.fire.torches });
  function lightInfo() {
    const t = clock.time, dark = isDark(t), mins = q => Math.max(0, Math.round(q.left * 1440));
    const planted = game.fire.torches.map(q => ({ dist: Math.round(dist(q, p)), dir: dirOf(q.x - p.x, q.z - p.z), minutes: mins(q) })).filter(q => q.dist <= 40).sort((a, b) => a.dist - b.dist).slice(0, 3);
    return { dark, hours: dark ? hoursToDawn(t) : hoursToDusk(t), torch: game.fire.torch ? { minutes: mins(game.fire.torch) } : null, planted, lit: litAt(p.x, p.z, lightsNow()) };
  }
  const walkOk = (to, minutes) => walkLight({ time: clock.time, minutes, torch: !!game.fire.torch, from: p, to, lights: lightsNow() });   // game/dark: may a walk start now?
  function carries() {
    const n = k => W.carried.filter(l => (k === 'branch' ? l.branch : k === 'frond' ? l.frond : !l.branch && !l.frond)).length;
    return { driftwood: n('driftwood'), branches: n('branch'), fronds: n('frond'), stones: W.stones.length, log: !!W.log, fibre: game.fibre.carried, nuts: game.shells.nuts,
      emptyShells: game.shells.empty(), fullShells: game.shells.full(), berries: game.berries.carried.length, bananas: game.bananas.carried.length, crabs: game.crabs.carried.length, fish: game.fish.carried.length,
      torch: !!game.fire.torch, spear: !!game.spear.hand, axe: game.axe.has(), green: !!W.log && !seasoned(W.log, clock.total) };   // 0.40.0 "Belt": the axe is at his belt once made
  }

  /** 0.40.0 "Belt": why the things of a place (loose wood, a stone, a log, a pile) cannot be taken up with what he holds now, in plain words; null when his hands are no hindrance
   *  (the rules of game/game `actionsAt` `room`: wood under his arm up to CARRY_MAX, not with the spear and a torch both; stones up to STONE_MAX, not with the spear or a torch; a log alone). */
  function holdWhy(kind, ref) {
    const pk = kind === 'pile' ? ref.kind : kind, torch = !!game.fire.torch, spear = !!game.spear.hand;
    const what = pk === 'log' ? 'log' : pk === 'stone' ? 'stone' : pk === 'driftwood' || pk === 'branch' || pk === 'frond' ? 'wood' : null;
    if (!what) return null;
    if (W.log) return 'a log is on his shoulder ("lay" it first)';
    if (what === 'log') return W.load() || torch || spear ? 'a log is carried alone: nothing else in his arms or hands ("lay", "laySpear", "plant" first)' : null;
    if (what === 'stone') {
      if (spear || torch) return `stones take both hands: the ${spear ? 'spear' : 'torch'} is in one ("${spear ? 'laySpear' : 'plant'}" first)`;
      return W.stones.length >= STONE_MAX ? `his hands are full: ${W.stones.length} of ${STONE_MAX} stones ("lay" them first)` : null;
    }
    if (spear && torch) return 'the spear and a torch fill his hands';
    return W.carried.length >= CARRY_MAX ? `his arms are full: ${W.carried.length} of ${CARRY_MAX} under his arm ("lay" first)` : null;
  }

  // ---------- the hands ----------
  const offersNow = () => { const a = game.action(); return a.tap ? [a.tap, ...a.options] : a.options; };
  function press(fits) {   // the ring when it is the main action, else its icon in the arc; the kind, or null when it is not offered
    const a = game.action();
    inp.sit = false;
    if (a.tap && fits(a.tap)) { pressed = 'tap'; emit('act', { kind: a.tap.kind }); return a.tap.kind; }
    const i = a.options.findIndex(fits);
    if (i >= 0) { choice = i; emit('act', { kind: a.options[i].kind }); return a.options[i].kind; }
    return null;
  }
  function* waitIdle(max = IDLE_MAX) { const t0 = now; while (busy()) { if (now - t0 > max) return false; yield; } yield; return true; }   // 0.40.4 "Ring": false when he was still busy after max real seconds
  function* waitActs(max = 25) { const t0 = now; yield; while (inp.target && inp.target.act && now - t0 < max) yield; yield; }

  // ---------- walking ----------
  function openNear(x, z, r = 2) {
    const camp = game.movement.obstacles.camp, ok = (a, b) => canStand(world, a, b, 0) && world.H(a, b) > 0.4 && !camp.inside(a, b, 0.1);
    if (ok(x, z)) return { x, z };
    for (let rr = 0.25; rr <= r + 1e-9; rr += 0.25) for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr; if (ok(px, pz)) return { x: px, z: pz }; }
    return null;
  }
  function* walk(x, z, o = {}) {   // to (x, z): { ok, reason }; o: { stop, tap, until, free, maxSecs }
    if (game.movement.obstacles.camp.inside(x, z, 0.02)) { const q = openNear(x, z, 2.5); if (q) { x = q.x; z = q.z; } }
    const tap = !!o.tap, stop = o.stop ?? 1.0, fd = o.free ? pathFree : path, t0 = now;
    let route = null, finalSet = false, lastT = now;
    for (;;) {
      if (o.until && o.until()) { idle(); return { ok: true }; }
      if (o.maxSecs && now - t0 > o.maxSecs) { idle(); return { ok: false, reason: 'the walk took far too long' }; }
      if (p.sitting > 0) { inp.sit = false; idle(); lastT = now; yield; continue; }
      const d = Math.hypot(x - p.x, z - p.z);
      if (!tap && d <= stop) { idle(); return { ok: true }; }
      if (now - t0 > SETTLE && d <= 0.3) { idle(); return { ok: true }; }
      if (!route) {
        emit('walk', { to: [+x.toFixed(1), +z.toFixed(1)], dist: +d.toFixed(1) });
        route = createRoute(fd, p, { x, z }, { stop, tap, near: tap ? 1.3 : 0 });
        if (route.state === 'unreachable') { idle(); return { ok: false, reason: 'there is no way there' }; }
      }
      const u = route.update(p, now - lastT, busy()); lastT = now;
      if (u.state === 'arrived') { idle(); return { ok: true }; }
      if (u.state === 'unreachable') { idle(); return { ok: false, reason: route.reason === 'nopath' ? 'there is no way there' : 'he got stuck on the way' }; }
      if (u.final) {
        if (tap) { if (!finalSet) { inp.target = { x, z, tap: true, routed: true }; finalSet = true; } else if (!inp.target) return { ok: true }; }
        else inp.target = { x, z, routed: true };
      } else { finalSet = false; inp.target = { x: u.target.x, z: u.target.z, routed: true }; }
      inp.run = false;
      yield;
    }
  }
  function* goStand(kind, obj, limit = 60) {   // to a spot where the game offers `kind` for obj (game/stand); { ok, reason } (0.40.4 "Ring": within limit real seconds, as every walk)
    const stand = game.stand;
    for (let tries = 0; tries < 2; tries++) {
      if (stand.usable(kind, obj, p.x, p.z, inside)) { idle(); return { ok: true }; }
      const s = stand.plan(kind, obj, path, p, { allow: inside });
      if (!s) return { ok: false, reason: 'there is no spot he can stand at to reach it' };
      const r = yield* walk(s.x, s.z, { stop: STOP, maxSecs: limit });
      if (!r.ok) return r;
      if (stand.offered(kind, obj, p.x, p.z)) return { ok: true };
    }
    return { ok: false, reason: 'he could not get to it' };
  }
  const offerFor = (pl, o) => {   // does the offer o concern the place pl?
    const th = o.thing, r = pl.ref;
    if (pl.kind === 'water') return o.kind === 'drink' || o.kind === 'fill';
    if (pl.kind === 'crabs') return o.kind === 'dig';
    if (pl.kind === 'tree') return o.kind === 'fell' && o.tree && o.tree.id === r.id;
    if (pl.kind === 'spear') return o.kind === 'takeSpear';
    return !!th && (th.log === r || th.pile === r || th.coco === r || th.plant === r || th.fire === r);
  };
  const offeredHere = pl => offersNow().some(o => offerFor(pl, o));
  function stillThere(pl) {
    const r = pl.ref;
    if (pl.kind === 'pile') return W.piles.includes(r) && r.logs.length > 0;
    if (pl.kind === 'fire') return game.fire.fires.includes(r);
    if (pl.kind === 'leanto') return game.leantos.list.includes(r);
    if (pl.kind === 'spear') return !!game.spear.at && dist(game.spear.at, r) < 0.05;
    if (pl.kind === 'tree') return !game.felled.has(r.id);
    if (pl.kind === 'homespot') return !game.leantos.list.length && game.homeFits(r.site);
    if (pl.kind === 'log') return game.logs.near(r.x, r.z, 0.5).includes(r);
    if (LOOSE[pl.kind]) return tilesNear(r.x, r.z, 1).some(t => LOOSE[pl.kind].list(t).includes(r));
    return true;
  }
  function* goTo(pl, standKind = null) {   // standKind (0.41.0): the standing spot of a pile for a take ('take') or a lay on it ('layOn')
    if (!stillThere(pl)) return { ok: false, reason: pl.kind === 'homespot' ? (game.leantos.list.length ? 'he has begun a home already' : `that place no longer fits a home: ${homeWay(pl.ref.site)}`) : `${pl.what} is gone` };
    const r = pl.ref, limit = realSecs(pl.minutes) * 3 + 30;
    if (pl.kind === 'pile') {
      const kind = standKind || (W.load() === 0 ? 'take' : 'add');
      const g = yield* goStand(kind, r, limit);
      if (g.ok) return g;
      return yield* walk(r.x, r.z, { stop: 1.4, maxSecs: limit });
    }
    if (pl.kind === 'fire') {
      if (W.carried.length) { const g = yield* goStand('feed', r, limit); if (g.ok) return g; }
      return yield* walk(r.x, r.z, { stop: 1.4, maxSecs: limit });
    }
    if (pl.kind === 'leanto') { const s = standFor(r); return yield* walk(s.x, s.z, { stop: 0.5, maxSecs: limit }); }
    if (pl.kind === 'tree') {
      if (game.axe.has()) { const g = yield* goStand('fell', r, limit); if (g.ok) return g; }
      return yield* walk(r.x, r.z, { stop: r.r + 0.9, maxSecs: limit });
    }
    if (pl.kind === 'water') {
      const w = yield* walk(r.x, r.z, { stop: 0.3, until: () => offeredHere(pl), maxSecs: limit });
      return w.ok && !offeredHere(pl) ? { ok: true, note: 'drinking is not offered here' } : w;
    }
    if (pl.kind === 'crabs') return yield* walk(r.hole.x, r.hole.z, { stop: 1.0, maxSecs: limit });
    if (pl.kind === 'homespot') { const w = yield* walk(r.x, r.z, { stop: 0.3, maxSecs: limit }); if (w.ok) inp.siteYaw = r.heading; return w; }   // 0.39.0: a "buildHere" there opens the lean-to that way
    let w = yield* walk(r.x, r.z, { tap: true, stop: 0.4, until: () => offeredHere(pl), maxSecs: limit });   // a loose thing: until the action button offers it
    if (w.ok && !offeredHere(pl)) w = yield* walk(r.x, r.z, { stop: 0.2, maxSecs: 20 });
    if (!w.ok) return w;
    if (!stillThere(pl)) return { ok: false, reason: `${pl.what} is gone` };
    return { ok: true };
  }
  function* wander(dir, minutes) {
    const a = DIRS.indexOf(dir) * Math.PI / 4, ux = Math.sin(a), uz = -Math.cos(a), secs = realSecs(minutes), far = Math.min(250, secs * WALK_SPEED * 0.85);
    let goal = null;
    for (let d = far; d >= 8 && !goal; d -= 6) {
      const x = p.x + ux * d, z = p.z + uz * d;
      if (Math.abs(x) > HALF - 8 || Math.abs(z) > HALF - 8 || !canStand(world, x, z, 0) || world.H(x, z) < 0.4) continue;
      if (pathFree.find(p, { x, z }, 20000, false)) goal = { x, z };
    }
    if (!goal) return { ok: false, reason: `there is no ground to walk to ${dir} of here` };
    const t0 = clock.total;
    const w = yield* walk(goal.x, goal.z, { free: true, stop: 1.0, until: () => (clock.total - t0) * 1440 >= minutes, maxSecs: secs * 2 + 20 });
    return w.ok ? { ok: true } : w;
  }
  function asideFor(want) {   // the nearest spot within ASIDE m where `want` is offered, on dry standable ground he knows; null when none
    for (let r = 0.5; r <= ASIDE + 1e-9; r += 0.5) for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6, x = p.x + Math.sin(a) * r, z = p.z + Math.cos(a) * r;
      if (!inside(x, z) || !canStand(world, x, z, 0) || game.movement.obstacles.camp.inside(x, z, 0.1)) continue;
      if (game.offersAt(x, z).some(want)) return { x, z };
    }
    return null;
  }
  // 0.38.2 "True": whether an action did anything, from what only an action changes; thirst and hunger count only when they went down, a fire only when it got more fuel or a new fire
  // burns (time alone raises thirst and hunger and burns fuel: a dig that caught nothing was "done" before)
  const snapshot = () => ({ fixed: JSON.stringify([carries(), game.leantos.list.map(l => l.progress + ':' + JSON.stringify(l.parts || l.up || null) + ':' + (l.hut || 0)),
    W.piles.length, W.piles.reduce((n, q) => n + q.logs.length, 0), game.felled.list.length, !!game.spear.at, game.fire.torches.length]),
    thirst: game.thirst.days, hunger: game.hunger.days, fuel: new Map(game.fire.fires.map(f => [f, f.fuel])), burning: game.fire.fires.filter(f => game.fire.strength(f) > 0).length });
  const changed = (a, b) => a.fixed !== b.fixed || b.thirst < a.thirst - 1e-6 || b.hunger < a.hunger - 1e-6 || b.burning > a.burning
    || game.fire.fires.some(f => !a.fuel.has(f) || f.fuel > a.fuel.get(f) + 1e-6);
  // 0.40.4 "Ring": why "light" is not offered where he stands (the tests of game `lightable`, in words, with the pile by its id)
  function lightWhy() {
    if (terrainAt(world, p.x, p.z, game.sea).depth > 0.05) return 'he stands in water';
    if (!game.fire.torch && !game.fibre.carried) return LACK_TEXT.needFibre;
    const q = (W.findAll(p.x, p.z, BESIDE_FIRE, 'pile').find(c => fuelKind(c.pile)) || {}).pile;
    if (!q) {
      const inRing = game.leantos.list.map(l => (game.leantos.has(l, 'ring') ? ringPile(l) : null)).find(Boolean);
      return `no pile of driftwood or branches beside him (within about a metre of its edge)${inRing ? `; the pile in his stone ring is ${placeId('pile', inRing)}` : ''}`;
    }
    const id = placeId('pile', q), held = W.carried.filter(l => (q.kind === 'branch' ? l.branch : !l.branch && !l.frond)).length;   // what would go on this pile
    if (game.leantos.noFire(q.x, q.z)) return `his pile ${id} lies within ${RING_NOFIRE} m of his stone ring but not in it: beside a ring a fire is lit only in the ring`;
    if (q.logs.length < FIRE_MIN) return `his pile ${id} has only ${q.logs.length} piece${q.logs.length === 1 ? '' : 's'}: a fire needs at least ${FIRE_MIN}${held ? ` (he holds ${held} under his arm: "lay" them on it first)` : ''}`;
    return null;
  }
  // 0.37.4 "Lessons": why an action is not offered where he stands, in plain words (null when the game does not say); a lack belongs only to its own action
  function whyNot(kind) {
    const lack = game.lackAt();
    if (kind === 'light') return lightWhy();   // 0.40.4 "Ring": every reason in words (the lack said nothing with wood under his arm)
    if (lack && kind === 'fish' && (lack === 'needSpear' || lack === 'spearAway')) return LACK_TEXT[lack] || lack;
    if (kind === 'pickup') {   // 0.37.6 "Free hands": his two hands
      if (W.log) return 'a log is on his shoulder: he carries it alone';
      const tool = game.spear.hand ? 'spear' : null, torch = !!game.fire.torch;
      if (tool && torch) return `the ${tool} and a torch fill his hands`;
      const pile = W.findAll(p.x, p.z, 1.6, 'pile')[0], k = pile ? pile.pile.kind : null;
      if ((tool || torch) && k === 'stone') return `stones take both hands: the ${tool || 'torch'} is in one`;
      if ((tool || torch || W.load() > 0) && k === 'log') return 'a log is carried alone, with nothing else in his arms or hands';
      if (W.carried.length >= 3) return 'his arms are full';
    }
    if (kind === 'takeSpear') {   // 0.37.8 "Firelight": the tests of game `canHold` and the reach, in words
      const tool = game.spear;
      if (tool.hand) return 'the spear is already in his hand';
      if (!tool.at) return 'there is no spear lying anywhere';
      if (W.log) return 'a log is on his shoulder: he carries it alone';
      if (W.stones && W.stones.length) return 'stones fill both his hands (lay them down first)';
      if (game.fire.torch && W.carried.length) return 'the torch and the wood under his arm fill his hands';
      const d = dist(tool.at, p); if (d > 0.55) return `the spear lies ${Math.round(d)} m ${dirOf(tool.at.x - p.x, tool.at.z - p.z)} of him: he must stand right at it`;
    }
    if (kind === 'fell') {   // 0.40.0 "Belt": the tests of game `canFell`, in words
      if (!game.axe.has()) return 'he has no axe yet ("makeAxe")';
      if (W.log) return 'a log is on his shoulder: felling takes both hands ("lay" it first)';
      if (W.stones && W.stones.length) return 'stones fill his hands: felling takes both hands ("lay" them first)';
      if (game.spear.hand) return 'the spear is in his hand: felling takes both hands ("laySpear" first)';
      if (game.fire.torch) return 'a torch is in his hand: felling takes both hands ("plant" it first)';
      if (terrainAt(world, p.x, p.z, game.sea).depth > 0.05) return 'he stands in water';
      return 'no standing trunk beside him: he must stand right at it';
    }
    if (kind === 'sleep') {   // 0.37.8: the tests of game `sleepable` and sleep `canLie`, in words
      const t = terrainAt(world, p.x, p.z, game.sea), awake = game.sleep.awake, night = isDark(game.clock.time);
      if (t.depth > 0.05 || t.climb > 0.25) return 'he cannot lie down here (water, or a climbing route): a few steps away, on dry ground';
      if (night && awake < NIGHT_AFTER) return `he woke not long ago: at night he can lie down again after about ${Math.round(NIGHT_AFTER * 24 * 2) / 2} hours awake (awake for ${(Math.round(awake * 100) / 100)} day)`;
      if (!night && awake < SLEEP_AFTER) return `by day he can lie down only after half a day awake (awake for ${(Math.round(awake * 100) / 100)} day)`;
    }
    if (kind === 'feed') {   // 0.37.7 "Reasons": the very tests of game `actionsAt` for 'feed', in words
      if (!W.load()) return 'he has no wood under his arm';
      const b = game.fire.find(p.x, p.z, BESIDE_FIRE, 'fire');
      if (!b) return 'no burning fire beside him: he must stand right at it (within about a metre of its edge)';
      if (!W.carried.some(l => !l.frond && dryness(l, game.clock.total) >= TORCH_DRY)) return W.carried.every(l => l.frond) ? 'fronds do not burn' : 'the wood under his arm is too wet to burn';
      if (fireFull(b.fire)) return 'the fire holds as much as it can';
      if (game.leantos.noFire(b.fire.x, b.fire.z)) return `this fire lies within ${RING_NOFIRE} m of his stone ring: there only the fire in the ring is fed`;
    }
    if (kind === 'dig') {   // 0.37.5
      if (game.fire.torch) return 'a torch is in his hand';
      if (game.crabs.full()) return 'he carries as many crabs as he can';
      return 'no crab is hiding in a hole beside him; they hide when he comes near at low water, and the holes may be empty';
    }
    if (kind === 'lay' && W.load() === 0) return 'he carries nothing to lay down: nothing under his arm, no stones in his hands, no log; fibre, coconuts, shells, berries, crabs and fish stay with him';   // 0.40.4 "Ring"
    if (kind === 'lay' && W.load() > 0) return 'there is no room to lay it down here (water, or the camp too close): a few steps away, on open ground';   // 0.37.5; 0.37.6: "lay" is always offered on dry ground
    if (kind === 'fill' && !game.shells.empty()) return 'he has no empty shell';
    if (kind === 'torch' && game.spear.hand && W.carried.length) return 'the spear and the wood under his arm fill his hands';
    if ((kind === 'buildIn' || kind === 'upgrade' || kind === 'buildHere' || kind === 'makeSpear' || kind === 'makeAxe') && (game.spear.hand || game.fire.torch)) return `that needs both hands: the ${game.spear.hand ? 'spear' : 'torch'} is in one ("${game.spear.hand ? 'laySpear' : 'plant'}" first)`;
    if (kind === 'buildHere') {   // 0.39.0 "Landfall"
      if (!W.stones.length) return 'he needs a stone in his hands to start a home: its stone ring comes first, the lean-to is built behind it once the ring is finished';   // 0.43.0 "Hearth"
      if (!(game.spear.hand || game.fire.torch) && !terrainAt(world, p.x, p.z, game.sea).depth) return 'no home fits here: the lean-to and later the hut round it need level ground that stays dry at high water, with no boulder or other lean-to in the hut\'s room and nothing touching the lean-to\'s walls; the menu lists the places for a home he has seen';
    }
    if (kind === 'laySpear' && !game.spear.hand) return 'the spear is not in his hand';
    if (kind === 'buildIn' || kind === 'upgrade') {
      const l = game.leantos.list.filter(q => dist(q, p) < 4).sort((a, b) => dist(a, p) - dist(b, p))[0];
      if (l && hutReady(l) && !hutDone(l) && hutKind(l) === 'log' && W.log && !seasoned(W.log, clock.total)) return `the log on his shoulder is still green: a felled log dries ${SEASON_DAYS} days before it goes into the hut (this one about ${dryText(W.log)})`;   // 0.40.0
      if (l && hutReady(l) && !hutDone(l)) { const hk = hutKind(l); if (hk === 'log' && !hutBegun(l) && !game.hutFits(l)) return hutWay(l); if (hk) return `the hut needs ${hk === 'log' ? 'a log on his shoulder' : kindWord(hk)} next`; }
      if (l) {
        const st = stageOf(l), need = st ? nextKind(l, st) : UP_ORDER.map(w => nextKind(l, w)).find(Boolean);   // 0.43.0 "Hearth": the ring's stones first
        if (need) return `it needs ${need === 'branch' ? 'a branch' : need === 'frond' ? 'a frond' : need === 'stone' ? 'a stone' : need === 'log' ? 'a log' : 'a piece of driftwood'} next`;
      }
    }
    return null;
  }
  function* doAction(kind) {
    const want = x => x.kind === kind && !(kind === 'husk' && x.carried);
    idle();
    for (let t = 0; t < SETTLE_TICKS && (p.moving || !offersNow().some(want)); t++) yield;   // he comes to a stand first (the walk may end a step before the thing is in reach)
    let o = offersNow().find(want);
    if (!o) {   // something nearer may take its place in the arc (lay is offered only when nothing else is near): a step aside, to a spot within ASIDE where the game offers it
      const q = asideFor(want);
      if (q) { const w = yield* walk(q.x, q.z, { stop: STOP, maxSecs: 15 }); if (w.ok) { for (let t = 0; t < SETTLE_TICKS && p.moving; t++) yield; o = offersNow().find(want); } }
    }
    if (!o) {
      const why = whyNot(kind);
      return { ok: false, reason: 'not offered here' + (why ? ` (${why})` : '') };
    }
    const before = snapshot();
    if (!press(x => x.kind === o.kind && sameThing(x.thing, o.thing))) return { ok: false, reason: 'not offered here' };
    if (kind === 'sleep') {
      sleeping = true;   // (from the press on: step() must not take the lying down for a collapse)
      for (let t = 0; t < 40 && !game.sleep.asleep && p.lie <= 0; t++) yield;
      if (!game.sleep.asleep && p.lie <= 0) { sleeping = false; return { ok: false, reason: 'he could not lie down here' }; }
      let nap = false;
      while (game.sleep.asleep || p.lie > 0) { if (game.sleep.asleep && game.sleep.nap) nap = true; yield; }   // (step() keeps him still meanwhile)
      sleeping = false;
      return { ok: true, note: sleepNote(nap, game.sleep.slept, game.sleep.awake) };   // 0.40.3 "Weary": what kind of sleep it was, and how rested he is
    }
    yield* waitActs();
    if (!(yield* waitIdle())) return { ok: false, reason: 'it took far too long: he was still busy with it' };
    if (kind === 'light' && !game.fire.fires.some(f => game.fire.strength(f) > 0 && dist(f, p) <= 3)) return { ok: false, reason: 'the fire did not catch' + (game.sleep.awake >= TIRED_AT ? ' (he is tired: the drill seldom catches)' : '') };   // 0.37.4: the fibre is used up either way; done only with a fire
    if (!changed(before, snapshot())) return { ok: false, reason: kind === 'dig' ? 'the crab got away' : kind === 'light' ? 'the fire did not catch' : kind === 'fish' ? 'he missed the fish' : 'nothing came of it' };
    return { ok: true };
  }
  const isFish = x => x.kind === 'fish';
  function fishSpotNear() {   // the nearest spot within FISH_WALK of him, on known ground, in the middle of the shallows band (a step either way is still shallows); null when none
    for (let r = 2; r <= FISH_WALK; r += 2) for (let i = 0; i < 24; i++) {
      const a = i * Math.PI / 12, x = p.x + Math.sin(a) * r, z = p.z + Math.cos(a) * r;
      if (!(Math.abs(x) < HALF - 8 && Math.abs(z) < HALF - 8) || !inside(x, z)) continue;
      const t = terrainAt(world, x, z, game.sea);
      if (fishableAt(t) && t.depth >= FISH_DEPTH[0] + 0.04 && t.depth <= FISH_DEPTH[1] - 0.04 && canStand(world, x, z, game.sea)) return { x, z };
    }
    return null;
  }
  function* fishFor(minutes) {   // strikes again and again until a fish is caught (done) or the minutes are up (done: "no fish in N minutes"); not offered at all: the reason
    const t0 = clock.total, fish0 = game.fish.carried.length, over = () => (clock.total - t0) * 1440 >= minutes;
    let moves = 0;
    idle();
    while (!over()) {
      if (!offersNow().some(isFish)) {
        const s = moves < 3 && game.spear.hand ? fishSpotNear() : null;   // (no spear in his hand: no point in looking for the shallows; the reason comes from the action)
        if (s) {
          moves++;
          const ok = walkOk(s, Math.max(1, Math.ceil(gameMinutes(Math.hypot(s.x - p.x, s.z - p.z) / WALK_SPEED * WALK_SLACK))));
          if (!ok.ok) return { ok: false, reason: ok.reason };
          const w = yield* walk(s.x, s.z, { stop: 0.3, until: () => offersNow().some(isFish), maxSecs: 60 });
          if (!w.ok) return w;
          continue;
        }
      }
      const tries = game.fish.tries, r = yield* doAction('fish');
      if (game.fish.carried.length > fish0) return { ok: true };
      if (game.fish.tries === tries) return r;   // no strike was made: not offered here (with the reason)
    }
    return { ok: true, note: `no fish in ${minutes} minutes` };
  }
  // 0.40.2 "Armful": why game `use` refused, in words (the tests of `use`; "he cannot do that now" said nothing)
  function useWhy(kind) {
    const berryLike = kind === 'berries' || kind === 'banana';
    if (game.sleep.asleep || p.lie > 0) return 'he is lying down';
    if (p.work || p.queued || p.stoop > 0) return 'he is still busy with something else';
    if (!berryLike && game.fire.torch) return 'a torch is in his hand: plant it first';
    if (!berryLike && terrainAt(world, p.x, p.z, game.sea).depth > 0.05) return 'he stands in water';
    if (kind === 'nut' && !game.shells.nuts) return 'he carries no coconut';
    if (kind === 'water' && !game.shells.full()) return 'he has no full shell';
    if (kind === 'berries' && !game.berries.carried.length) return 'he carries no berries';
    if (kind === 'banana' && !game.bananas.carried.length) return 'he carries no banana';
    if (kind === 'crab') return 'he needs a fire with flames beside him (within about a metre of its edge)';
    return 'he cannot do that now';
  }
  function* useThing(kind) {
    const before = snapshot(), row = kind === 'crab' ? (game.crabs.carried.length || !game.fish.carried.length ? 'crab' : 'fish') : kind;   // 0.38.2: "crab" eats a carried crab, or a fish when he has no crab (game `use` roasts either)
    if (kind === 'crab' && !game.crabs.carried.length && !game.fish.carried.length) return { ok: false, reason: 'he carries no crab or fish' };
    idle(); inp.sit = false;
    for (let t = 0; t < 200 && busy(); t++) yield;   // 0.37.5: he finishes a bend or gets up first (a use while he still stooped failed); 0.40.2: up to 20 s
    if (!game.use(row, inp)) return { ok: false, reason: useWhy(kind) };
    emit('act', { kind: 'use:' + kind });
    yield; yield* waitIdle();
    return changed(before, snapshot()) ? { ok: true } : { ok: false, reason: 'nothing came of it' };
  }
  function* rest(minutes) {
    const t0 = clock.total;
    idle(); inp.sit = true;
    while ((clock.total - t0) * 1440 < minutes) { inp.sit = true; yield; }
    inp.sit = false;
    return { ok: true };
  }
  // ---------- 0.41.0 "Hands": take that thing, lay that down there ----------
  const KIND_HELD = { driftwood: () => W.carried.filter(l => !l.branch && !l.frond).length, branch: () => W.carried.filter(l => l.branch).length, frond: () => W.carried.filter(l => l.frond).length, stone: () => W.stones.length, log: () => (W.log ? 1 : 0) };
  const heldText = () => { const c = carries(); return c.log ? 'a log on his shoulder' : [...ARM, ['stones', 'stone']].filter(([k]) => c[k] > 0).map(([k, w]) => `${c[k]} ${c[k] === 1 ? w : k}`).join(', ') || 'nothing to lay down'; };
  function* walkFor(pl, minutes) {   // the dark rule of a walk to a place (0.37.2), as a `go`
    if (pl && dist(pl, p) >= 1.5) { const ok = walkOk(pl, minutes); if (!ok.ok) return { ok: false, reason: ok.reason }; }
    return { ok: true };
  }
  function* takeStep(s, places) {
    const pl = places.find(q => q.id === s.take);
    if (!pl) return { ok: false, reason: `no place "${s.take}"` };
    if (!stillThere(pl)) return { ok: false, reason: `${pl.what} is gone` };
    const hold = holdWhy(pl.kind, pl.ref); if (hold) return { ok: false, reason: `he cannot take it up now: ${hold}` };
    const d = yield* walkFor(pl, stepMinutes({ go: s.take }, places)); if (!d.ok) return d;
    inp.take = pl.kind === 'pile' ? { pile: pl.ref, ...(Number.isFinite(s.count) ? { count: s.count } : {}) } : { id: pl.ref.id };
    const w = yield* goTo(pl, pl.kind === 'pile' ? 'take' : null);
    if (!w.ok) return giveUp(pl, w);
    const r = yield* doAction('pickup');
    if (!r.ok) return r.reason === 'not offered here' ? giveUp(pl, { ok: false, reason: `he could not reach ${pl.id} to pick it up` }) : r;
    return r;
  }
  /** 0.41.1 "Straight": where he stands to lay material beside a place for a home: just outside the room the whole home keeps free (HUT_KEEP), on a side or
   *  behind it, the standable spot nearest him; `out` is the way outward, so the new pile goes down further from the home. */
  function homeAside(site) {
    const S = HUT_KEEP.side + ASIDE_GAP, B = HUT_KEEP.back - ASIDE_GAP;
    const spots = [[0, -S, 0, -S - 3], [0, S, 0, S + 3], [B, 0, B - 3, 0], [(HUT_KEEP.back) / 2, -S, (HUT_KEEP.back) / 2, -S - 3], [(HUT_KEEP.back) / 2, S, (HUT_KEEP.back) / 2, S + 3]]
      .map(([f, r, fo, ro]) => ({ ...leantoPoint(site, f, r), out: leantoPoint(site, fo, ro) }))
      .filter(q => { const t = terrainAt(world, q.x, q.z, game.sea); return canStand(world, q.x, q.z, game.sea) && !t.inRiver && t.y > game.sea + 0.05; })
      .sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
    return spots[0] || { ...leantoPoint(site, 0, -S), out: leantoPoint(site, 0, -S - 3) };
  }
  // 0.43.3 "Feed": firewood laid "at" his fire, or at the ring (a pile in it, the lean-to) while his fire burns or glows there, goes ON the fire as "feed" does
  const fireOf = pl => {
    if (pl.kind === 'fire') return game.fire.fires.includes(pl.ref) ? pl.ref : null;
    const l = pl.kind === 'leanto' ? (game.leantos.has(pl.ref, 'ring') ? pl.ref : null) : pl.kind === 'pile' ? ringOf(pl.ref.x, pl.ref.z) : null;
    return l ? ringFire(l) : null;
  };
  let fedCount = 0;   // the pieces the running lay step put on a fire (not "laid down" in its record)
  function* layOnFire(f, kind, want, pl, places) {
    const d = yield* walkFor(pl, stepMinutes({ go: pl.id }, places)); if (!d.ok) return d;
    const w = yield* goStand('feed', f); if (!w.ok) return w;
    const fid = placeId('fire', f), notes = [];
    inp.feed = kind;
    while (fedCount < want && offersNow().some(x => x.kind === 'feed')) { const r = yield* doAction('feed'); if (!r.ok) break; fedCount++; }
    inp.feed = undefined;
    if (fedCount) notes.push(`put ${kindPlural(kind, fedCount)} on his fire ${fid}${game.fire.fires.includes(f) && fireFull(f) ? ' (now full)' : ''}`);
    const rest = Math.min(want - fedCount, KIND_HELD[kind]());   // wet wood, or what did not fit on a full fire, goes down beside it
    if (rest > 0) { inp.lay = { kind, count: rest, toward: { x: f.x, z: f.z } }; const r = yield* doAction('lay'); if (r.ok) notes.push(`the rest (${game.fire.fires.includes(f) && fireFull(f) ? 'the fire was full' : 'not dry enough to burn'}) went down beside it`); }
    return fedCount || rest > 0 ? { ok: true, note: notes.join('; ') } : { ok: false, reason: `nothing went on ${fid}` };
  }
  function* layStep(s, places) {
    const kind = s.lay, have = KIND_HELD[kind] ? KIND_HELD[kind]() : 0;
    if (!have) return { ok: false, reason: `he carries no ${kind === 'driftwood' ? 'driftwood' : kind}${kind === 'log' ? ' on his shoulder' : ''} (he carries ${heldText()})` };
    const count = Number.isFinite(s.count) ? Math.min(s.count, have) : null, fewer = Number.isFinite(s.count) && s.count > have ? `he carried only ${have}` : null;
    const pl = s.at === undefined ? null : places.find(q => q.id === s.at);
    if (s.at !== undefined && !pl) return { ok: false, reason: `no place "${s.at}"` };
    if (pl && !stillThere(pl)) return { ok: false, reason: `${pl.what} is gone` };
    const onFire = pl && (kind === 'driftwood' || kind === 'branch') ? fireOf(pl) : null;
    if (onFire) { const r = yield* layOnFire(onFire, kind, count || have, pl, places); if (r.ok && fewer) r.note = join(fewer, r.note); return r; }
    const onPile = pl && pl.kind === 'pile' && pl.ref.kind === kind ? pl.ref : null;
    if (onPile && onPile.logs.length >= PILE_MAX) return { ok: false, reason: `${pl.id} is full (${PILE_MAX} pieces): lay it beside it ("at" another place) or on another pile` };
    if (pl) {
      const d = yield* walkFor(pl, stepMinutes({ go: s.at }, places)); if (!d.ok) return d;
      const limit = realSecs(pl.minutes) * 3 + 30;
      inp.lay = { kind, ...(count ? { count } : {}), ...(onPile ? { pile: onPile } : { toward: { x: pl.x, z: pl.z } }) };
      let w;
      if (onPile) { w = yield* goStand('layOn', onPile, limit); if (!w.ok) w = yield* walk(onPile.x, onPile.z, { stop: 1.0, maxSecs: limit }); }
      else if (pl.kind === 'homespot') {   // 0.41.1 "Straight": beside the home's room, never in it (a pile there would take the place off the menu)
        const a = homeAside(pl.ref.site);
        inp.lay = { ...inp.lay, toward: a.out };
        w = yield* walk(a.x, a.z, { stop: 0.3, maxSecs: limit });
      } else {
        const r = pl.ref, at = pl.kind === 'crabs' ? r.hole : pl.kind === 'leanto' ? standFor(r) : pl;
        w = yield* walk(at.x, at.z, { stop: pl.kind === 'tree' ? r.r + 1.2 : pl.kind === 'leanto' ? 0.5 : 1.6, maxSecs: limit });
      }
      if (!w.ok) return w;
    } else inp.lay = { kind, ...(count ? { count } : {}) };
    const room0 = onPile ? PILE_MAX - onPile.logs.length : Infinity;
    const r = yield* doAction('lay');
    if (!r.ok) return r;
    const left = KIND_HELD[kind](), notes = [];
    if (fewer) notes.push(fewer);
    if (onPile && left > 0 && room0 < (count || have)) notes.push(`${pl.id} had room for only ${room0}: the rest stays with him`);
    return notes.length ? { ok: true, note: notes.join('; ') } : r;
  }
  function* runStep(s, places) {
    const k = stepKind(s);
    if (k === 'go' || k === 'wander' || k === 'take' || k === 'lay') inp.siteYaw = undefined;   // 0.39.0: the way of a place for a home holds only where he stands at it
    inp.take = undefined; inp.lay = undefined; inp.feed = undefined; fedCount = 0;   // 0.41.0 "Hands": what a take or a lay names holds for that step only (0.43.3: the kind a feed puts on, too)
    if (k === 'take') return yield* takeStep(s, places);
    if (k === 'lay') return yield* layStep(s, places);
    if (k === 'go') {
      const pl = places.find(q => q.id === s.go);
      if (pl && dist(pl, p) >= 1.5) { const ok = walkOk(pl, stepMinutes(s, places)); if (!ok.ok) return { ok: false, reason: ok.reason }; }   // 0.37.2: the dark rule, when the walk starts (0.37.8: no walk without light)
      return giveUp(pl, yield* goTo(pl));
    }
    if (k === 'wander') { const ok = walkOk(null, s.minutes); if (!ok.ok) return { ok: false, reason: ok.reason }; return yield* wander(s.wander, s.minutes); }
    if (k === 'do') return s.do === 'fish' ? yield* fishFor(s.minutes) : yield* doAction(s.do);
    if (k === 'use') return yield* useThing(s.use);
    if (k === 'wait') return yield* rest(s.wait);
    return { ok: false, reason: 'not a step' };
  }
  // 0.38.1 "Trace": what a pick-up took and a lay-down laid, with what he carries after it (facts for the records of what he did lately)
  const ARM = [['driftwood', 'driftwood'], ['branches', 'branch'], ['fronds', 'frond']];
  const armNow = c => { const parts = ARM.filter(([k]) => c[k] > 0).map(([k, w]) => `${c[k]} ${c[k] === 1 ? w : k}`), n = ARM.reduce((s, [k]) => s + c[k], 0); return `${parts.length ? parts.join(', ') : 'nothing'} (${n} of ${CARRY_MAX})`; };
  function carryNote(kind, c0, piles0) {
    const c1 = carries();
    if (kind === 'pickup') {
      if (c1.log && !c0.log) return 'picked up a log: it is on his shoulder';
      const got = [...ARM, ['stones', 'stone']].filter(([k]) => c1[k] > c0[k]).map(([k, w]) => (c1[k] - c0[k] === 1 ? `1 ${w}` : `${c1[k] - c0[k]} ${k}`));
      if (!got.length) return null;
      return c1.stones > c0.stones && !(c1.driftwood + c1.branches + c1.fronds) ? `picked up ${got.join(', ')}; now in his hands: ${c1.stones} stone${c1.stones === 1 ? '' : 's'} (${c1.stones} of ${STONE_MAX})` : `picked up ${got.join(', ')}; now under his arm: ${armNow(c1)}`;
    }
    const laid = c0.driftwood + c0.branches + c0.fronds + c0.stones + (c0.log ? 1 : 0) - (c1.driftwood + c1.branches + c1.fronds + c1.stones + (c1.log ? 1 : 0)) - fedCount;   // 0.43.3: what went on a fire is not laid down
    if (laid <= 0) return null;
    const where = layWhere(piles0);
    return `laid ${laid === 1 ? '1 piece' : `${laid} pieces`} down${where.length ? ': ' + where.join('; ') : ''}`;
  }
  function layWhere(piles0) {   // the piles that are new or grew since piles0 (a Map pile -> pieces), in words
    return W.piles.filter(q => !piles0.has(q) || q.logs.length > piles0.get(q)).map(q => {
      const n = piles0.has(q) ? q.logs.length - piles0.get(q) : q.logs.length, d = dist(q, p), at = d < 3 ? 'here' : `${Math.round(d)} m ${dirOf(q.x - p.x, q.z - p.z)}`;
      return piles0.has(q) ? `${kindPlural(pileKind(q), n)} on his pile of ${pileNoun(q)} ${at} (${placeId('pile', q)}, now ${q.logs.length})` : `${kindPlural(pileKind(q), n)} on a new pile ${at} (${placeId('pile', q)})`;
    });
  }
  // 0.38.2 "True": the lay-downs the game makes on its own (before drinking, filling, felling or a torch, when he lies down to sleep or collapses), in the record of that step
  let mark = null;   // { piles0 } at the start of the running step
  const pilesNow = () => new Map(W.piles.map(q => [q, q.logs.length]));
  const autoLaid = piles0 => { const w = piles0 ? layWhere(piles0) : []; return w.length ? `he laid down what he carried first: ${w.join('; ')}` : null; };
  const join = (a, b) => (a && b ? `${a}; ${b}` : a || b || null);
  const pileKind = q => (q.kind === 'driftwood' ? 'driftwood' : q.kind);
  const pileNoun = q => (q.kind === 'branch' ? 'branches' : q.kind === 'frond' ? 'fronds' : q.kind === 'stone' ? 'stones' : q.kind === 'log' ? 'logs' : 'driftwood');
  // 0.40.3 "Weary": the record of a sleep step, so the request after waking says whether it was a nap and how long he is awake now
  const sleepNote = (nap, slept, awake) => {
    const h = Math.max(0, slept) * 24, hours = h < 1 ? `${Math.max(1, Math.round(h * 60))} minutes` : `${Math.round(h * 2) / 2} hours`, aw = `awake for ${(Math.round(awake * 10) / 10).toFixed(1)} days now`;
    return nap ? `it was a nap (he lay down before dusk): he slept about ${hours}, ${aw}` : `he slept about ${hours}, ${aw}`;
  };
  function* runPlan(plan) {
    for (let i = 0; i < plan.steps.length; i++) {
      const s = plan.steps[i], what = stepText(s, plan.menu.places);
      actor.stepIndex = i;
      emit('step', { i, what });
      const tracked = s.take !== undefined || s.lay !== undefined, c0 = carries(), piles0 = pilesNow();
      mark = { piles0 };
      const r = yield* runStep(s, plan.menu.places);
      mark = null;
      if (r.ok && tracked) { const n = carryNote(s.take !== undefined ? 'pickup' : 'lay', c0, piles0); if (n) r.note = join(n, r.note); }
      if (!tracked) { const a = autoLaid(piles0); if (a) { if (r.ok) r.note = join(a, r.note); else r.reason = join(r.reason, a); } }
      stats.steps++;
      if (r.ok && s.do === 'sleep') { stats.done++; last = remember('step', what, 'done', r.note || null); emit('step-end', { i, what, outcome: 'done' }); return 'woke'; }
      if (r.ok) { stats.done++; last = remember('step', what, 'done', r.note || null); emit('step-end', { i, what, outcome: 'done' }); }
      else { stats.failed++; last = remember('step', what, 'failed', r.reason); emit('step-end', { i, what, outcome: 'failed', reason: r.reason }); idle(); inp.sit = false; return 'failed'; }
    }
    return 'done';
  }
  function end(reason) { inp.siteYaw = undefined; inp.take = undefined; inp.lay = undefined; gen = null; actor.plan = null; actor.stepIndex = -1; why = reason; idle(); inp.sit = false; }
  // 0.38.3 "Steady": rain stops the work he is doing (as walking off does), and the record says so
  const WORK_WORDS = { husk: 'husking the coconut', sip: 'drinking from a shell', roast: 'roasting', build: 'building', upgrade: 'building', drill: 'drilling a fire', fell: 'felling the tree', dig: 'digging', fish: 'fishing', make: 'making the tool', drink: 'going to drink', fill: 'going to fill a shell' };
  function stopWork() {
    const k = p.work ? p.work.kind : p.queued ? String(p.queued) : null;
    if (!k) return null;
    inp.stopWork = true;
    return `stopped ${WORK_WORDS[k] || k}: ${k === 'fell' ? 'the chopping done so far is kept' : 'nothing was used up; it would start over'}`;
  }
  function interrupt(reason) { stats.interrupts++; const stopped = reason === 'rain' ? stopWork() : null; last = remember('interrupt', reason, 'interrupted', join(stopped, autoLaid(mark && mark.piles0))); mark = null; emit('interrupt', { reason, ...(stopped ? { stopped } : {}) }); end(reason); }

  // ---------- one step ----------
  function step(dt) {
    now += dt;
    inp.stopWork = false;   // (one frame: game.update reads it right after the step that set it)
    const raining = game.rain > 0, started = raining && !rainWas; rainWas = raining;
    if (game.sleep.asleep || p.lie > 0) {   // never acts in his sleep
      if (gen && !sleeping) interrupt('collapsed');   // asleep without a sleep step: he collapsed
      if (gen) gen.next();
      else { idle(); inp.sit = false; pressed = null; choice = null; if (why !== 'collapsed') why = 'woke'; }
      return;
    }
    if (started && gen && !sleeping) { interrupt('rain'); }
    if (!gen) {
      const m = menu(), c = chooser(m, { why, last });
      if (c === null || c === undefined || c === WAIT) { actor.waiting = true; stats.waits++; idle(); return; }
      actor.waiting = false;
      const chk = checkPlan(c, m.places);
      if (!chk.ok) { stats.rejected++; last = remember('rejected', 'a plan', 'rejected', chk.reason); emit('rejected', { reason: chk.reason }); why = 'rejected'; idle(); return; }
      stats.plans++;
      lastCount = chk.claimed !== null && chk.claimed !== undefined ? { claimed: chk.claimed, minutes: chk.minutes } : null;
      actor.plan = { steps: chk.steps, minutes: chk.minutes, at: clock.total, menu: m, say: c && typeof c.say === 'string' ? c.say : '', why };
      remember('plan', chk.steps.map(s => stepText(s, m.places)).join('; '), 'planned');
      emit('plan', { steps: chk.steps, minutes: chk.minutes, claimed: chk.claimed, why, say: actor.plan.say, what: chk.steps.map(x => stepText(x, m.places)).join('; ') });
      gen = runPlan(actor.plan);
    }
    const r = gen.next();
    if (r.done) end(r.value);
  }
  return actor;
}

const sameThing = (a, b) => (!a && !b) || (!!a && !!b && a.kind === b.kind && ['log', 'pile', 'coco', 'plant', 'fire', 'torch'].every(k => a[k] === b[k]) && Math.hypot((a.x || 0) - (b.x || 0), (a.z || 0) - (b.z || 0)) < 0.05);
const LACK_TEXT = { needSpear: 'he has no spear', spearAway: 'his spear is not in his hand', needFibre: 'he has no fibre to light it', needMoreWood: 'the pile needs more wood' };
