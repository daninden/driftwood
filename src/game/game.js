/**
 * game/game — the game state and its update step.
 *
 * For now the whole game is: one castaway walking over the island while
 * the day goes round and the tide comes and goes (game/tide), gathering the
 * driftwood each high water brings (game/wood), husking coconuts for fibre
 * (game/fibre), making fire and keeping it going (game/fire), drinking at
 * the rivers (game/thirst, game/water), and sleeping now and then (game/sleep). The state is kept small and plain so it can be saved later
 * (see docs/architecture.md, "Saving").
 *
 * createGame(world, spawn, { time, day, player, wood, sleep, fibre, fire, thirst, hunger, branches, fronds, stones, leantos, crabs, spear, axe, felled, logs, fish, shells, berries, bananas, known }?) -> game
 *   The options are what state() returns, so restoring a save is
 *   createGame(world, spawn, saved) (see save.js): each part starts from its
 *   saved state. A saved player { x, z, heading } stays exactly where he
 *   was when walking can leave him there (movement canOccupy: against a trunk, on a steep step of a climbing
 *   route); one who cannot be there any more (the island changed) is moved to the nearest spot he can stand
 *   (movement nearestStandable), else he starts at spawn. Kneeling work and
 *   a pending tap are not saved.
 *   wantsToMove(input) -> true while keys, the thumb stick or a target ask to walk;
 *   it stops kneeling work and drops a queued action (a resting stick is null)
 *   REACH (0.55), BESIDE (1.2), OPTIONS (3), AIM, HUSK_TIME, NUT_DRINK, DRINK_TIME, STOOP: reaches, times and what a nut gives
 *   game.player                 { x, y, z, heading, moving, speed, phase, stoop, sitting, lie, tired, work }
 *     sitting: 0..1 sitting on the ground (0.29.2 "Amble"), eased by render/hero; goes up over SIT_TIME while input.sit holds and down again when it stops. Not saved
 *     stoop: 1..0 while bending down to pick up or lay down wood (counts
 *     down over STOOP seconds); the castaway stands still meanwhile
 *     lie: 0..1 lying down to sleep (game/sleep); tired: 0..1;
     thirsty: 0..1 how thirsty (game/thirst level)
 *     hungry: 0..1 how hungry (game/hunger level)
 *     running: true while he runs this frame; winded: true while he is out of breath (game/breath; for the footsteps and the panting)
 *     work: null, or { kind: 'husk' | 'drill', f: 0..1 } (0.25: 'fill' FILL_TIME and 'sip' SIP_TIME too) while kneeling to
 *     husk a coconut (HUSK_TIME) or to drill fire (game/fire DRILL_TIME); 0.22: 'dig' (DIG_TIME) and 'roast' (ROAST_TIME) too
 *     torch: true while he carries a burning torch (game/fire); spear: true while the spear is in his hand (0.30.17; work kinds 'make' MAKE_TIME and 'fish' FISH_TIME too)
 *   game.clock                  { time, day, total } (game/clock)
 *   game.wood                   carried pieces, piles, washed-up wood (game/wood)
 *   game.sleep                  awake, asleep, rest (game/sleep)
 *   game.fibre                  coconuts and the fibre carried (game/fibre)
 *   game.branches               the branches under the trees and their regrowing (game/branches)
 *   game.fronds                 the fallen palm fronds under the palms and their regrowing (game/fronds, 0.27)
 *   game.stones                 the stones along the rivers and at the foot of rocks (game/stones, 0.27)
 *   game.leantos                the lean-tos, finished or half built, with their upgrades (game/leanto)
 *   game.fire                   fires, burnt places and failed attempts (game/fire)
 *   game.thirst                 days since he drank (game/thirst)
 *   game.hunger                 days since he ate (game/hunger)
 *   game.breath                 how long he can still run (game/breath); out of breath he walks even when run is asked
 *   game.spear                  the one spear: in his hand or lying where he laid it (game/spear, 0.30.17 "Spear")
 *   game.axe                    the one axe: in his hand or lying where he laid it (game/axe, 0.31 "Axe"); player.axe is true while it is in his hand
 *   game.felled                 the trees he has cut down and the progress of an interrupted felling (game/felled); game.logs the logs they left (game/logs); wood.log is the log on his shoulder
 *   game.fish                   the fish he carries and the tries made (game/fish, 0.30.17)
 *   game.shells                 the half shells he keeps (empty or full of water) and the coconuts he carries (game/shells, 0.25)
 *   game.crabs                  the crabs he carries and the caught ones missing from their colonies (game/crabs, 0.22)
 *   game.berries                the berry bushes picked and the handfuls he carries (game/forage, 0.26)
 *   game.bananas                the banana plants picked and the bunch he carries (game/forage, 0.26)
 *   game.known                  the part of the island he has been to: cells of 10 m marked within 40 m of where he walked (game/known, 0.28 "Habit"). update() marks
 *                               the cells round him in every frame in which he moves, unless the input says `learns: false` (game/mind walks him only over ground he knows; then only his own cell). A game
 *                               without a saved memory starts with the area round where he stands known
 *   game.wildlife               crabs, fish and birds within 30 m of him: atmosphere only, not saved (game/wildlife)
 *   game.fireflies              the fireflies within 30 m of him, from dusk to an hour before sunrise: atmosphere only, not saved (game/fireflies)
 *   game.canPileAt(x, z, rs?)   0.33.1 "Hearth": may a new pile (walk-blocking radius rs, default a driftwood pile's) be laid with its middle at (x, z)? The `blockedAt` check of `lay` as a pure question (wet ground included); the middle of a finished stone ring is always free but for a solid that really overlaps it
 *   game.siteFits(c)            0.32: does a lean-to fit at c = { x, z, heading } (dry ground, no other site within SITE_APART, nothing in its walls or in the region that stays free); game.yaw(y?) reads (and with a number sets) the camera yaw a new lean-to opens towards (update reads input.yaw into it)
 *   game.hutFits(l)             0.33 "Hut": does a hut fit round finished lean-to l (`hutReady`): dry, standable, level (HUT_SLOPE 0.5 m) ground at its corners, door and middle, no other site within HUT_APART 4.8 m, no trunk, boulder, pile, fire place or burnt place touching its walls or inside it (the stone ring and the lean-to are no hindrance); pure. Not asked once the first part is built
 *   game.lackAt(x?, z?)         0.30.20: what is missing for an action that is almost possible there (default: where he stands): 'needSpear' | 'spearAway' | 'needFibre' | 'needMoreWood' | null (pure, game/lack; the voice says it)
 *   game.onAction(listener)     optional presentation notification when a deliberate action is accepted; listeners receive { kind, x, z }, alter no game state and are not saved
 *   game.weather                the schedule of showers (game/weather); game.rain: the intensity of the rain now, 0..1 (0.21:
 *                               wet wood in the open, fires and torches burning down faster, see game/wood rain and game/fire update)
 *   game.sea                    the current sea level (game/tide)
 *   0.29.2 "Amble": two fields only game/mind sets on its input (the player's input has neither). input.pace (0.3..1, movement paceOf): the share of his walking speed, and, shortened
 *   by paceStride, of his step, at which he walks (a run is never slowed; needs and load still multiply on top). input.sit (true, or a look point { x, z }): he sits down on the ground
 *   and looks that way, and stays down while it holds. It does nothing, and he gets up (SIT_TIME), when he sleeps or lies, kneels, stoops, holds a torch, carries wood, a frond or
 *   a stone, stands in water, on steep ground (SIT_SLOPE) or a climbing route, when a key, the stick or a target asks to walk, or on any press of the action button, an icon,
 *   a row drawing, F or Z; a walk starts at once while he is still getting up (the get-up takes half the time then). Sitting is only resting: no rule, no faster recovery.
 *   game.update(input, dt) -> { distance, terrain, time, total, sea, rest }
 *     dt is real time. Moves the player from the input (game/input; Shift
 *     or a double-tapped target runs, a load and tiredness slow down),
 *     clears a reached or blocked click target, advances the clock (faster
 *     while asleep), lets the tide wash up wood at each high water and take
 *     piles it covers, and reports what is under the player's feet, the
 *     time of day, total game-clock days, the sea level and how rested the
 *     castaway is.
 *     Clicking and tapping only walk. A tapped target (target.tap) is looked
 *     at once: on or near a piece of driftwood, a pile, a coconut, a fire or a
 *     torch in the ground (closer for a mouse than for a finger, target.touch)
 *     the castaway walks to beside it and stands there, doing nothing; river
 *     water, its bank and the castaway himself are just ground.
 *     Everything he does goes through the action button (input.takeAction(),
 *     Space or render/actionButton) or the icons above it (input.takeChoice(), keys 1 to 3): game.action() says what they would do now.
 *   0.25 "Shell": tap kinds 'husk' (a coconut within REACH: always husked, HUSK_TIME, a tuft of fibre when there is room; when it is done he eats it if hunger is above EAT_AT or he
 *   carries two already, else he carries the husked nut, 0.27.1 "Husk"; or, with `carried: true` and no `thing`, a carried nut eaten anywhere when hunger is above EAT_AT: EAT_TIME, no tuft, he keeps the shell), 'fill' (river water within 0.8 m,
 *   thirst not above DRINK_AT, an empty shell: kneels FILL_TIME and fills it; otherwise the water offers 'drink') and 'sip' (a full shell drunk
 *   anywhere: SIP_DRINK off the thirst). The order of priority is written out in `action` and in docs/design.md, "The action button".
 *   0.26 "Inland": tap kinds 'berries' and 'bananas' (a bearing bush or banana plant within REACH of its edge, game/forage: hungry, hunger above EAT_AT, he picks and eats at once
 *   (`eat: true`; BERRY_FOOD 1/6 day, BANANA_FOOD a whole day); otherwise the pick is carried, if there is room: 2 handfuls, 1 bunch; with no room nothing is offered) compete by distance with
 *   the nut, wood and the rest. With empty hands and nothing near, after the full-shell sip: 'eatBerries' (a carried handful, when hunger is above EAT_AT), then 'eatBanana', then the carried nut:
 *   what spoils first is eaten first. Carried berries spoil after a day, a bunch after 3 days (game/forage).
 *   Finishing a husk (on the ground or carried) also keeps the empty half shell (game/shells keep, at most 2).
 *   game.use(kind, input?) -> bool   0.27.2 "Row": a click on a drawing in the inventory row (render/carryMark) uses it at once. kind 'nut' (eaten, EAT_TIME kneeling),
 *     'water' (a full shell drunk, SIP_TIME), 'berries' / 'banana' (the oldest eaten at once) and 'crab' (roasted and eaten, only beside a fire with flames): all also
 *     when not hungry or thirsty (never below 0). false and nothing changes when asleep or lying down, already kneeling or stooping, with a torch in hand, in water, with
 *     nothing of that kind, or a crab without a fire. Wood under his arm stays where it is (eating and drinking need no free hands, unlike the action button's sip).
 *   game.actions() -> [option]   pure (0.27.4 "Choices"): everything he could do now, each { kind, ... }; the small actions first, nearest first (one of each kind), then the
 *     big ones marked `big: true`. Empty while he sleeps, lies down or kneels. The first, when it is not big, is the main action. Small kinds, in the order
 *     of priority for the main one: 'feed' (dry wood in his arm beside a fire that is not full:
 *     lays one piece on it, also on embers; wet wood stays with him), then the
 *     nearest of 'dig' (0.22: a crab hiding in a hole within DIG_REACH that it fled into, fewer than 2 crabs carried, no torch in hand, not in water: kneels
 *     DIG_TIME, about half the time he catches it, game/crabs), 'roast' (0.22: a crab carried, a fire with flames within BESIDE, no torch in hand: kneels
 *     ROAST_TIME and eats one, hunger.eat(CRAB_FOOD); a nearer coconut or hole wins, and it beats 'torch' at the same fire) and 'pickup' (a piece within REACH, or a pile within BESIDE when
 *     his arm is empty; no hand free with a torch; room for CARRY_MAX), 'husk'
 *     (a coconut within REACH: kneels HUSK_TIME, one tuft of fibre when there is room; then he eats the nut, hunger.eat(), thirst.sip(NUT_DRINK), when hungry, else carries it), 'torch'
 *     (empty-handed: a burning brand out of a fire within BESIDE, not from
 *     embers, or a torch in the ground within REACH) and 'drink' (fresh river
 *     water within 0.8 m, game/water; wood is laid down and a torch stuck in
 *     the ground first, then he kneels DRINK_TIME and is no longer thirsty),
 *     and only when none of those is near 'plant' (a torch in his hand is stuck in the ground in front of
 *     him) or 'lay' (everything carried goes down at his feet, on a pile close
 *     by or as a new pile; not in water) or the carried bites. A full fire (game/fire FUEL_MAX) takes
 *     no more wood: nothing is offered to lay on it. Big kinds, never the main one: 'light' (a
 *     pile of at least FIRE_MIN beside him, on dry ground, with a torch in
 *     his hand or fibre carried: he walks to its side and kneels to drill fire,
 *     costing rest and the fibre, or pushes the torch in, game/fire kindle) and
 *     'sleep' (on dry, walkable ground, and only once he may: from dusk on after about 3½ hours awake, by day after half a day awake, sleep.canLie(time)). F lights the pile beside
 *     him the same way (or builds), Z lies down to sleep (same rule).
 *   game.actionsAt(px, pz) / actionAt(px, pz) / offersAt(px, pz)   (0.30.3 "Routes") the same as actions() / action() / their flat list if he stood at (px, pz): the one rule of what is offered where, which game/stand asks (game.stand)
 *   game.action() -> { tap, options }   pure: the main small action (or null: the ring and Space do it) and up to OPTIONS (3) others for the arc above the ring and the keys 1 to 3: the
 *     other small actions nearest first, then the big ones (a big one is never dropped for a small one). Nothing at all while he sleeps, lies down or kneels.
 *   game.act(option) -> bool   do one of them at the next update (looked up again by kind among what can be done then, so a stale one does nothing). input.takeChoice() (keys 1 to 3,
 *     a click on an icon of the arc) picks options[i] the same way. The big actions are never done by the ring or Space.
 *     Thirst makes him a
 *     little slower, very thirsty makes rest run out twice as fast, and after
 *     a day and a half he collapses and sleeps like exhaustion (game/thirst). Hunger
 *     (game/hunger) slows him a little, makes drilling cost more rest and,
 *     starving, makes rest run out faster (multiplied with thirst's drain).
 *     Walking off or a click elsewhere stops kneeling work early (the fibre
 *     is kept). Wading deep puts the torch out. Lying down to sleep, he lays
 *     down what he carries and sticks a torch in the ground first; the sleep
 *     is cold and short without a fire close by (game/fire warm, game/sleep
 *     COLD_SLEEP). input.takeWake() (any key, click or tap, the action button)
 *     wakes early; the flood wakes him when it reaches him (he can lie down
 *     on the wet sand of low water); worn out in the water, he wades on and
 *     only falls asleep once he is on dry ground. Fires burn down (faster
 *     while asleep) and the flood puts out those it reaches; palms drop new
 *     coconuts. Every input method is optional.
 *   game.state() -> plain object with what would need saving
 *
 *   Branches (0.16) are picked up, carried and laid down like driftwood (wood and branches
 *   together at most CARRY_MAX), feed a fire for half a piece (game/fire BRANCH_BURN).
 *   0.32 "Piece by piece": nothing is built from piles any more. A piece in his arms (driftwood, branch, frond) or hands (stone) is built into a site (game/leanto): big kind 'buildHere' (driftwood under his
 *   arm, a place where a lean-to fits, `siteFits`: the middle SITE_AT behind him, the open side towards the camera's yaw), big kind 'buildIn' (`what` 'leanto': beside a half-built lean-to, within LEANTO_REACH,
 *   whose next part is of a kind he holds) and big kind 'upgrade' (`what`: 'walls', 'bed' or 'ring': beside a finished lean-to, within UP_REACH, whose next part of that upgrade is of a kind he holds; walls before bed before ring).
 *   Each wins over 'light'. The icon builds at once where he stands ('buildHere') or after a walk to beside the lean-to; he kneels PIECE_TIME seconds (work kind 'build' for the lean-to, 'upgrade' for an upgrade), then the
 *   piece is used up and the next part of the site appears (`leantos.build`); the rest cost is `pieceCost` a piece. Walking off before the end builds nothing and keeps the piece. A new site is started at the end of the first piece's kneeling (it must still fit).
 *   A coconut is always offered for 'husk'; the tuft comes only when there is room for it (game/fibre husk).
 *
 *   0.27 "Home": fronds (under the arm with the wood, never fuel) and stones (in his hands, at most 2, apart from the wood) are picked up and
 *   laid down like wood, each piece slows him (wood.load()); the upgrades of 0.27 are built from them piece by piece since 0.32 (above).
 *   In the sleep a lean-to's upgrades count (walls: a longer cold sleep, bed: faster rest, game/sleep); the walls widen where wood and fires stay dry
 *   (leantos.dry) and a stone ring holds a fire and keeps the rain off it (fire.update).
 *
 * 0.30.17 "Spear" (game/spear, game/fish): `makeSpear` (a small kind, after 'lay', so the arc and not the ring: no spear exists, exactly one branch under his arm and nothing else carried, a stone loose within REACH or a pile of stones within BESIDE, on dry ground; MAKE_TIME of kneeling, the branch is used up, the stone stays; the spear is in his hand), `fish` (the spear in his hand, standing in shallow sea water, `fishableAt`, fewer than 2 fish carried: the ring; FISH_TIME standing, a fish with the seed's chance),
 *   `takeSpear` (empty arms and hands, the lying spear within REACH, nearest first with the other small kinds) and `laySpear` (the spear in his hand, on dry ground; always offered after the nearer things, so the arc keeps it within reach; it lies at his feet). A spear in his hand fills it like a torch: no pickup of wood, fronds or stones, no torch taken, no sitting; it goes down beside him when he sleeps. 'roast' takes a crab or a fish (`food`: whichever was caught first), game.use('fish') roasts a fish from the row. A new pile keeps 0.55 m + its own radius + BODY from a lying spear.
 *
 * 0.33 "Hut" (part 1): the hut is built into a finished lean-to (walls, bed and ring done) with the big kind 'upgrade' and `what: 'hut'` (`piece`: the kind of the next part, `start: true` for the first part), within HUT_REACH (2.6 m)
 *   of its middle: a log on his shoulder (wood.log; `piecesHeld` has 'log'; `wood.giveLog` uses it up) for the first 12 parts, then branches, then fronds; the first part only where `hutFits(l)`. Work kind 'upgrade', PIECE_TIME a piece,
 *   `pieceCost('hut')` rest a piece. In a finished hut (`hutDone`) the sleep gets `hut: true` (game/sleep), no fire can be lit in or within half a metre of its walls (`leantos.noFire`), no torch is planted there and a burning torch
 *   is doused when he walks in.
 * 0.33.1 "Hearth": the middle of a finished stone ring takes a fuel pile despite the keep-free apron of the lean-to or hut (tested against the pile's own circle only) and CAMP_GAP (`blockedAt`: otherwise only a solid that really overlaps refuses it).
 * 0.33.4 "One hearth": the no-fire zone round a finished stone ring is RING_NOFIRE (8 m, was 3.5) from the ring's middle, and 'feed' is not offered for a fire that lies in it (leantos.noFire): a fire beside the ring that burned before the ring was built is not fed and burns out, for the player and for Dave; the fire in the ring itself (and any fire away from the ring) is fed as before. Torches are unchanged (a torch can still be taken from such a fire while it burns).
 * 0.31.1 "Milk": 'light' (and 'kindle') is not offered for a pile that lies more than RING_R but at most RING_NOFIRE (3.5 m) from the middle of a finished lean-to's finished stone ring (leantos.noFire): beside a ring a fire is lit only in the ring itself; a pile elsewhere is unaffected. It is not started either when the pile moved there meanwhile (no fibre is used).
 * 0.31 "Axe" (game/axe, game/felled, game/logs): small kinds `makeAxe` (no axe exists, no spear or torch in hand, exactly one branch under his arm and nothing else, a loose stone within REACH or a pile of stones within BESIDE, a tuft of fibre,
 *   dry ground: work kind 'makeAxe', AXE MAKE_TIME of kneeling; the branch, the stone and the tuft are all used up; after 'lay', before `makeSpear`, so the arc), `takeAxe` (empty arms and hands, the lying axe within REACH) and `layAxe` (the axe in his hand, dry
 *   ground; always offered after the nearer things) and `fell` ({ kind: 'fell', tree } with the nearest standing trunk of game/felled `nearest` within FELL_REACH (0.7 m from its edge), the axe in his hand, dry ground; nearest-wins with the other small actions, so it is
 *   the ring's action when nothing is nearer). Felling is standing work (work kind 'fell', FELL_TIME 50 s = an hour of game time, rest cost FELL_COST = BUILD_COST like the lean-to, progress kept in `felled.chopped(id)`, so walking off keeps it); at the end
 *   `fellTree`: the tree is felled away from him (heading atan2(tree - player)), its logs lie loose (`logs.add`), the crown leaves loose branches / fronds / nuts (`addExtra` of branches, fronds, fibre) where game/felled `plan` puts them, and nothing regrows
 *   under it. Only one of spear, axe and torch is in hand (`hand` in actionsAt; no pickup of anything while it is full). A log (kind 'pickup' of a lying log or of a pile of logs) is taken only with nothing at all in his arms, hands or on the shoulder and carried alone
 *   (wood.log); he walks at LOG_WALK and cannot run; 'lay' puts it on a log pile (kind 'log': never mixed, never lit, never fed, never offered for a lean-to or an upgrade, never taken by the flood). The axe lies down beside him when he sleeps.
 *
 * 0.30.3 "Routes": a click on a pile or fire, and the walk of a light, build or upgrade, go to a standing point (game/stand) by a route of game/route; a plain click walks round a camp solid that closes the straight line. Rule (b): `buildable` takes any pile within BESIDE. Rule (a): wood is not laid where a pile would touch the keep-free region of a lean-to (game/leanto keepFree), and the leftovers of the building piles are laid beside the new lean-to.
 *
 * 0.30.10 "Walls": a new pile keeps CAMP_GAP (game/obstacles) of walking room from every other pile, fire place and burnt place (a lean-to's walls excepted): `blockedAt(x, z, rs)` holds the rule for `wood.drop` and for the leftovers of a build (`layLeftovers`). With no such spot within 3.45 m the wood stays in his arms, as on wet ground.
 *
 * Depends on: game/felled, game/logs, game/axe, game/path, game/route, game/stand, game/known, game/forage, game/shells, game/movement, game/clock, game/wood, game/branches, game/fronds, game/stones, game/leanto, game/tide, game/sleep,
 *   game/fibre, game/fire, game/lack, game/thirst, game/hunger, game/breath, game/crabs, game/spear, game/fish, game/water, game/wildlife, game/fireflies, game/weather
 */
import { BODY, createPlayer, moveIntent, stepPlayer, terrainAt, canOccupy, canStand, nearestStandable, weariStride, paceOf, paceStride, obstaclesNear } from './movement.js';
import { createClock, DAY_SECONDS } from './clock.js';
import { createKnown } from './known.js';
import { createWood, CARRY_SLOW, CARRY_STRIDE, CARRY_MAX, STONE_MAX, PILE_NEXT, LOG_WALK, LOG_STRIDE, dryness, pileSolidRadius, kindOf } from './wood.js';
import { seaLevel, highWaters } from './tide.js';
import { createSleep, isNight } from './sleep.js';
import { createFibre } from './fibre.js';
import { createShells, FILL_TIME, SIP_TIME, EAT_TIME, SIP_DRINK, DRINK_AT, SIP_AT, EAT_AT, NUT_MAX } from './shells.js';
import { createBranches } from './branches.js';
import { createFronds } from './fronds.js';
import { createStones } from './stones.js';
import { createForage, BERRIES, BANANAS, BERRY_FOOD, BANANA_FOOD } from './forage.js';
import { createLeantos, keepFree, nextKind, siteAt, pieceCost, PARTS, UP_ORDER, UP_REACH, PIECE_TIME, SITE_APART, BUILD_COST, REACH as LEANTO_REACH, hutReady, hutDone, hutBegun, hutKind, inHutBox, HUT, HUT_REACH } from './leanto.js';
import { YAW } from '../core/view.js';
import { createThirst } from './thirst.js';
import { createHunger } from './hunger.js';
import { createBreath } from './breath.js';
import { createCrabs, DIG_TIME, ROAST_TIME, CRAB_FOOD } from './crabs.js';
import { createSpear, MAKE_TIME } from './spear.js';
import { createAxe, MAKE_TIME as AXE_MAKE_TIME, FELL_TIME, FELL_REACH } from './axe.js';
import { createFelled, treeInfo, plan as fallPlan } from './felled.js';
import { createLogs } from './logs.js';
import { createFish, fishableAt, FISH_TIME, FISH_FOOD } from './fish.js';
import { lackOf } from './lack.js';
import { findWater } from './water.js';
import { createWildlife } from './wildlife.js';
import { createFireflies } from './fireflies.js';
import { createWeather, FALLING } from './weather.js';
import { createFire, full, FIRE_MIN, DRILL_TIME, DRILL_COST, DOUSE_DEPTH, TORCH_DRY, TORCH_COST, BRANCH_BURN } from './fire.js';
import { solidObstacles, gapFree, sameFirePlace, leantoCircles, leantoPoint, hutCircles, HUT_R, LEANTO_BACK, LEANTO_SIDE, LEANTO_FRONT } from './obstacles.js';
import { createPath } from './path.js';
import { createRoute } from './route.js';
import { createStand } from './stand.js';

export const STOOP = 0.55;         // seconds to bend down and up again
export const SIT_TIME = 0.5;       // 0.29.2 "Amble": seconds to sit down or get up (a get-up that makes way for a walk takes SIT_TIME / 2)
export const SIT_SLOPE = 0.45;     // the ground he sits on is no steeper than this (the walking limit is 0.85)
export const REACH = 0.55;         // a piece of wood, a coconut or a torch in the ground within this distance of the feet can be reached
export const BESIDE = 1.2;         // a pile or a fire within this distance (from its edge) is beside him: F and the icons above the action button reach it
const RAIN_EVERY = 0.4 / DAY_SECONDS;   // the rain wets wood about every 0.4 s of game time
export const AIM = { mouse: 0.4, touch: 0.8 };   // how close to a piece a click or tap has to be to walk to it
export const HUSK_TIME = 4;        // seconds of kneeling to tear the husk off a coconut and eat it
export const NUT_DRINK = 0.15;     // days of thirst the milk of a coconut takes away
export const DRINK_TIME = 4;       // seconds of kneeling to drink
const DIG_REACH = 0.8;             // a crab hole this close to the feet can be dug at
const DRINK_REACH = 0.8;           // fresh water this close to the feet can be drunk (the bank of a brook counts)
export { FELL_REACH, FELL_TIME };
export const FELL_COST = BUILD_COST;   // rest the hour of chopping costs: as much as a lean-to
export const OPTIONS = 3;          // at most this many icons in the arc above the ring
const SIDE = 0.75;                 // kneeling this far from the middle of a pile or a fire

// true while the input asks to walk: keys, the thumb stick (null at rest, see game/input) or a target
export const wantsToMove = input => !!(input.up || input.down || input.left || input.right || input.stick || input.target);

export function createGame(world, spawn, opts = {}) {
  const felled = createFelled(world, opts.felled);   // first: the trunk circles of game/movement ask the world's overlay (game/felled)
  const clock = createClock(opts.time, opts.day);
  const sea0 = seaLevel(clock.total), saved = opts.player && (canOccupy(world, opts.player.x, opts.player.z, sea0) ? { x: opts.player.x, z: opts.player.z } : nearestStandable(world, opts.player.x, opts.player.z, sea0));
  const player = createPlayer(saved ? { x: saved.x, z: saved.z, y: world.H(saved.x, saved.z) } : spawn), logs = createLogs(world, opts.logs), branches = createBranches(world, opts.branches, felled), fronds = createFronds(world, opts.fronds, felled), stones = createStones(world, opts.stones), wood = createWood(world, opts.wood, branches, fronds, stones, logs), leantos = createLeantos(world, opts.leantos), sleep = createSleep(opts.sleep);
  const fibre = createFibre(world, opts.fibre, felled), axe = createAxe(opts.axe), fire = createFire(world, opts.fire), thirst = createThirst(opts.thirst), hunger = createHunger(opts.hunger), breath = createBreath(), crabs = createCrabs(world.seed, opts.crabs), spear = createSpear(opts.spear), fish = createFish(world.seed, opts.fish), shells = createShells(opts.shells), berries = createForage(world, BERRIES, opts.berries), bananas = createForage(world, BANANAS, opts.bananas), known = createKnown(opts.known), movement = { obstacles: solidObstacles(wood, fire, leantos) };
  if (!known.count) known.visit(player.x, player.z);   // no memory saved (a new game, an older save): the ground round him is known
  if (saved && Number.isFinite(opts.player.heading)) player.heading = opts.player.heading;
  if (!Number.isFinite(wood.tide)) wood.tide = highWaters(clock.total);
  player.lie = sleep.lie; player.tired = sleep.tired(); player.work = null; player.torch = !!fire.torch; player.spear = spear.hand; player.axe = axe.hand; player.thirsty = thirst.level(); player.hungry = hunger.level();
  const voiceListeners = new Set();
  const notifyAction = kind => { for (const listener of voiceListeners) listener({ kind, x: player.x, z: player.z }); };
  const wildlife = createWildlife(world), fireflies = createFireflies(world), weather = createWeather(world.seed), game = { player, clock, wood, sleep, fibre, branches, fronds, stones, felled, logs, axe, leantos, fire, thirst, hunger, breath, crabs, spear, fish, shells, berries, bananas, known, wildlife, fireflies, weather, movement, rain: weather.intensity(clock.total), sea: seaLevel(clock.total), update, state, action, actions, actionAt, actionsAt, offersAt, lackAt, siteFits, hutFits, canPileAt, yaw, act, use, onAction(listener) { voiceListeners.add(listener); return () => voiceListeners.delete(listener); } };
  const stand = game.stand = createStand(game, world, { BESIDE });   // 0.30.3 "Routes": standing points (game/stand), asked by the click on a pile or fire and by the walk to the spot of a light, a build or an upgrade
  let rainAt = -Infinity;   // the clock when the rain last wet the wood
  let blockedFor = 0, work = null, slept = sleep.asleep, queued = null, chosen = null;   // work: { kind, t, dur, thing } while kneeling; queued: 'drink' while hands are being freed for it
  const stoop = () => { player.stoop = 1; };
  wood.tideUpdate(game.sea, clock.total);
  const hereAt = (px, pz) => terrainAt(world, px, pz, game.sea);
  const here = () => hereAt(player.x, player.z);
  const wet = t => t.inRiver || t.y < game.sea + 0.05;
  const beside = (x, z) => {   // where to kneel by a pile or a fire: SIDE from its middle, on the castaway's side
    const dx = player.x - x, dz = player.z - z, d = Math.hypot(dx, dz) || 1;
    return { x: x + dx / d * SIDE, z: z + dz / d * SIDE };
  };
  const PILE_SOLID = 0.65;   // the walk-blocking circle of a pile (game/obstacles PILE_R): a pile whose circle touches a lean-to's keep-free region is laid beside it
  // 0.30.10 "Walls": and a new pile (its walk-blocking radius rs, default a driftwood pile's core) keeps CAMP_GAP of walking room from every other solid of the camp (game/obstacles `gapFree`), so no ring of solids closes round him
  // 0.33.1 "Hearth": the middle of a finished stone ring (`leantos.ring`) is always a place for a fuel pile: neither a lean-to's or hut's keep-free apron (it ends 0.7 m short of RING_AT, a pile needs 0.85) nor CAMP_GAP refuses it: the keep-free region is tested with the pile's own solid (not the body's clearance too), which leaves the exact middle free and still keeps the door and the area in front of it free,
  // only a solid that physically overlaps does (this holds for a fuel pile, rs at most a driftwood pile's: a wide frond or stone pile is laid by the old rules, else it could close the ring's middle round him) (a fire place or burnt place there is the same place, `sameFirePlace`)
  const blockedAt = (x, z, rs) => {
    const r = rs === undefined ? PILE_SOLID : rs, rr = rs === undefined ? PILE_SOLID : rs + BODY;
    const inRing = leantos.ring(x, z) && r <= PILE_SOLID + 1e-9, gap = inRing ? 0 : BODY + 0.55;   // in the ring a lying spear or axe only matters when the pile would stand on it
    if ((!!spear.at && Math.hypot(x - spear.at.x, z - spear.at.z) < r + gap) || (!!axe.at && Math.hypot(x - axe.at.x, z - axe.at.z) < r + gap)) return true;
    if (inRing) { const same = sameFirePlace(x, z); return leantos.list.some(l => keepFree(l).touches(x, z, r)) || movement.obstacles.camp.near(x, z, r + BODY).some(c => !same(c) && Math.hypot(c.x - x, c.z - z) < Math.max(c.r, r - BODY)); }   // real overlap: the middle lies inside another solid's circle (or its own core takes the other's middle)
    return leantos.list.some(l => keepFree(l).touches(x, z, rr)) || !gapFree(movement.obstacles.camp, x, z, rr, sameFirePlace(x, z));   // 0.30.3 rule (a): the inside of a lean-to and the area in front of its opening stay free of wood
  };
  function canPileAt(x, z, rs) { return !wet(hereAt(x, z)) && !blockedAt(x, z, rs); }   // 0.33.1: may a new pile (walk-blocking radius rs, default a driftwood pile's) be laid with its middle at (x, z)? Pure; the check `lay` makes
  const lay = heading => wood.drop(player.x, player.z, heading, wet(here()), (x, z) => wet(terrainAt(world, x, z, game.sea)), blockedAt);   // a pile never goes in the water
  const meanDry = logs => logs.reduce((s, l) => s + dryness(l, clock.total), 0) / Math.max(1, logs.length);
  const face = th => { player.heading = Math.atan2(th.x - player.x, th.z - player.z) || player.heading; };
  const fuel = l => !l.frond && dryness(l, clock.total) >= TORCH_DRY;   // a frond never burns
  const dryPiece = () => wood.carried.some(fuel);

  function look(tg) {   // a click or tap on a thing: walk to beside it and stand there; acting is the button's job
    tg.seen = true;
    const aim = tg.touch ? AIM.touch : AIM.mouse, dist = t => t ? Math.hypot(t.x - tg.x, t.z - tg.z) : Infinity;
    const piece = wood.find(tg.x, tg.z, aim), coco = fibre.find(tg.x, tg.z, aim);
    const thing = fire.find(tg.x, tg.z, aim) || (dist(coco) < dist(piece) ? coco : piece);   // a fire first
    if (!thing) return;   // ground, river water, anything else: just walk (wading works as usual)
    const close = thing.kind === 'fire' || thing.kind === 'pile', at = close ? spotBeside(thing.kind === 'fire' ? 'nearFire' : 'nearPile', thing.kind === 'fire' ? thing.fire : thing.pile, beside(thing.x, thing.z)) : thing;
    tg.act = { kind: 'stand', close }; tg.x = at.x; tg.z = at.z;
  }

  // 0.30.3 "Routes": where he walks to and kneels or stands for a thing: the old spot beside it (SIDE from the middle, on his side) when he can stand there and the game offers the action for that very
  // object there, else the cheapest standing point (game/stand), else the old spot. The route to it is followed by the game itself (routeAim).
  function spotBeside(kind, obj, ideal) {
    if (stand.usable(kind, obj, ideal.x, ideal.z, null, 0.02)) return ideal;
    const s = stand.plan(kind, obj, finder(), player);
    return s ? { x: s.x, z: s.z } : ideal;
  }

  // The route the game follows to a target that needs one: a click on a pile or a fire, the walk to the spot of a light, a build or an upgrade (all end at a standing point), and a plain click on the ground
  // only when a solid of the camp closes the straight line. A target marked `routed` (the mind, the tests) walks by its own route. No route at all (unreachable) clears the target.
  let trip = null, finderMemo = null;
  const finder = () => finderMemo || (finderMemo = createPath(world, { obstacles: movement.obstacles }));
  function routeAim(input, dt) {
    const tg = input.target;
    if (!tg || tg.routed) { trip = null; return tg; }
    if (!trip || trip.tg !== tg) {
      const act = tg.act, planned = !!act && (act.close || act.kind === 'light' || act.kind === 'kindle' || act.kind === 'build' || act.kind === 'upgrade'), f = finder();
      trip = { tg, route: planned || !f.open(player, tg) ? createRoute(f, player, { x: tg.x, z: tg.z }, { stop: 0.05, tap: true }) : null };
      if (trip.route && trip.route.state === 'unreachable') { trip = null; input.clearTarget(); return null; }
    }
    if (!trip.route) return tg;
    const u = trip.route.update(player, dt, false);
    if (u.state !== 'going') { trip = null; input.clearTarget(); return null; }
    return u.final ? tg : u.target;
  }

  const inHutWalls = (x, z) => leantos.list.some(l => hutDone(l) && inHutBox(l, x, z, -0.5));   // 0.33: no torch in a finished hut or at its walls
  function plantSpot(px = player.x, pz = player.z) {   // a step in front, in the dry ground
    const x = px + Math.sin(player.heading) * 0.4, z = pz + Math.cos(player.heading) * 0.4;
    return !wet(terrainAt(world, x, z, game.sea)) && !wet(hereAt(px, pz)) && !inHutWalls(x, z) ? { x, z } : null;
  }
  function plantBesideSpot(px = player.x, pz = player.z) {   // for drinking: behind or beside him, on dry ground (he stands at the water)
    for (const r of [0.4, 0.8]) for (const a of [Math.PI, Math.PI / 2, -Math.PI / 2, Math.PI * 0.75, -Math.PI * 0.75, 0]) {
      const x = px + Math.sin(player.heading + a) * r, z = pz + Math.cos(player.heading + a) * r;
      if (!wet(terrainAt(world, x, z, game.sea)) && !inHutWalls(x, z)) return { x, z };
    }
    return null;
  }
  const plantTorch = () => { const s = plantSpot(); return !!s && fire.plant(s.x, s.z); };
  const plantBeside = () => { const s = plantBesideSpot(); return !!s && fire.plant(s.x, s.z); };

  const fuelPile = (px, pz) => wood.findAll(px, pz, BESIDE, 'pile').find(c => c.pile.kind !== 'log') || null;   // 0.31: a pile of logs is timber for later: never lit, never counted for lack
  function lightable(px, pz) {   // the pile beside him he could light now, with the torch or with fibre
    if (wet(hereAt(px, pz)) || (!fire.torch && !fibre.carried)) return null;
    const p = fuelPile(px, pz);
    if (p && leantos.noFire(p.pile.x, p.pile.z)) return null;   // 0.31.1: beside a stone ring a fire is lit only in the ring itself
    return p && p.pile.logs.length >= FIRE_MIN ? { kind: 'light', pile: p.pile, torch: !!fire.torch } : null;
  }
  /** 0.30.20 "Words": what is missing for an action that is almost possible at (px, pz) (pure, game/lack): 'needSpear', 'spearAway', 'needFibre', 'needMoreWood' or null. */
  function lackAt(px = player.x, pz = player.z) {
    if (sleep.asleep || sleep.lie > 0 || work) return null;
    const t = hereAt(px, pz), pile = fuelPile(px, pz);
    if (!fishableAt(t) && pile && (siteIn(px, pz) || siteHere(px, pz))) return null;   // a piece could be built in here: that is the offer
    return lackOf({ fishable: fishableAt(t) && !fish.full(), hand: spear.hand, spear: spear.has(), pileLogs: pile ? pile.pile.logs.length : null, dry: !wet(t), fibre: fibre.carried > 0, torch: !!fire.torch, load: wood.load() });
  }
  // 0.32 "Piece by piece": a site is built piece by piece with what he carries (game/leanto). The kinds he has: driftwood, branches and fronds under his arm, stones in his hands.
  let viewYaw = YAW;   // the camera's yaw at the last update (input.yaw): the way the open side of a new lean-to faces; the mind may write it before it presses
  const piecesHeld = () => { const ks = new Set(wood.carried.map(kindOf)); if (wood.stones.length) ks.add('stone'); if (wood.log) ks.add('log'); return ks; };
  const handsFree = () => !fire.torch && !spear.hand && !axe.hand;   // (0.33: a log on his shoulder is no hindrance: it is a piece of the hut, and no other piece is carried with it)
  const naturalNear = (x, z) => {   // the trunks, boulders and crags within 4.5 m of a point (each once)
    const seen = new Set();
    for (let dx = -3; dx <= 3; dx += 3) for (let dz = -3; dz <= 3; dz += 3) for (const o of obstaclesNear(world, x + dx, z + dz)) if (Math.hypot(o.x - x, o.z - z) < 4.5 + o.r) seen.add(o);
    return [...seen];
  };
  /** Does a lean-to fit at c = { x, z, heading }? The ground at its middle and corners is dry and standable, no other site within SITE_APART, and no trunk, boulder or solid of the camp touches its
   *  walls (leantoCircles) or the region that stays free (keepFree) (pure). */
  function siteFits(c) {
    const dry = (x, z) => !wet(terrainAt(world, x, z, game.sea)) && canStand(world, x, z, game.sea);
    if (!dry(c.x, c.z) || leantos.list.some(l => Math.hypot(l.x - c.x, l.z - c.z) < SITE_APART)) return false;
    for (const [f, r] of [[LEANTO_BACK, -LEANTO_SIDE], [LEANTO_BACK, LEANTO_SIDE], [LEANTO_FRONT, -LEANTO_SIDE], [LEANTO_FRONT, LEANTO_SIDE]]) { const q = leantoPoint(c, f, r); if (wet(terrainAt(world, q.x, q.z, game.sea))) return false; }
    const keep = keepFree(c), hyp = leantoCircles(c);
    for (const o of naturalNear(c.x, c.z)) { for (const h of hyp) if (Math.hypot(h.x - o.x, h.z - o.z) < h.r + o.r) return false; if (keep.touches(o.x, o.z, o.r)) return false; }
    for (const o of movement.obstacles.camp.near(c.x, c.z, 4.5)) { for (const h of hyp) if (Math.hypot(h.x - o.x, h.z - o.z) < h.r + o.r) return false; if (keep.touches(o.x, o.z, o.r)) return false; }
    return true;
  }
  /** 0.33 "Hut": does the hut fit round lean-to l? Its corners and middle are dry, standable ground within HUT_SLOPE of one another in height, no other site within HUT_APART, and no trunk, boulder, pile, fire place or burnt place
   *  touches its walls or its inside (the region of `inHutBox` grown by the clearance of a wall circle); the stone ring and the lean-to itself are no hindrance (pure). */
  const HUT_SLOPE = 0.5, HUT_APART = 4.8;
  function hutFits(l) {
    if (!hutReady(l)) return false;
    const dry = (x, z) => !wet(terrainAt(world, x, z, game.sea)) && canStand(world, x, z, game.sea);
    let lo = Infinity, hi = -Infinity;
    for (const [f, r] of [[0, 0], [HUT.back, -HUT.half], [HUT.back, HUT.half], [HUT.front, -HUT.half], [HUT.front, HUT.half], [(HUT.back + HUT.front) / 2, -HUT.half], [(HUT.back + HUT.front) / 2, HUT.half], [HUT.back, 0], [HUT.front, -HUT.door], [HUT.front, HUT.door]]) {
      const q = leantoPoint(l, f, r); if (!dry(q.x, q.z)) return false;
      const y = world.H(q.x, q.z); if (y < lo) lo = y; if (y > hi) hi = y;
    }
    if (hi - lo > HUT_SLOPE) return false;
    if (leantos.list.some(o => o !== l && Math.hypot(o.x - l.x, o.z - l.z) < HUT_APART)) return false;
    const inBox = (x, z, r) => { const m = -(HUT_R + r); return inHutBox(l, x, z, m); };   // the disc of radius r at (x, z) touches the walls or the inside
    for (const o of naturalNear(l.x, l.z)) if (inBox(o.x, o.z, o.r)) return false;
    for (const o of movement.obstacles.camp.near(l.x, l.z, 4.5)) if (o.g.kind !== 'leanto' && inBox(o.x, o.z, o.r)) return false;
    return true;
  }
  // the kind of hut piece he could build into finished lean-to l with what he holds (the first part also needs the footprint to fit)
  const hutPiece = (l, have) => { const k = hutKind(l); return k && have.has(k) && (hutBegun(l) || hutFits(l)) ? k : null; };
  function siteIn(px, pz) {   // a piece he could build in now: into a half-built lean-to within LEANTO_REACH that needs the kind of a piece he holds, else into an upgrade of a finished one within UP_REACH (nearest first)
    if (wet(hereAt(px, pz)) || !handsFree()) return null;
    const have = piecesHeld(); if (!have.size) return null;
    let best = null, bd = Infinity;
    for (const l of leantos.list) {
      const d = Math.hypot(l.x - px, l.z - pz);
      if (l.progress < 1) { if (d <= LEANTO_REACH && have.has(nextKind(l)) && d < bd) { bd = d; best = { kind: 'buildIn', what: 'leanto', piece: nextKind(l), leanto: l, x: l.x, z: l.z }; } continue; }
      if (d >= bd) continue;
      const what = d <= UP_REACH ? UP_ORDER.find(k => have.has(nextKind(l, k))) : null;
      if (what) { bd = d; best = { kind: 'upgrade', what, piece: nextKind(l, what), leanto: l, x: l.x, z: l.z }; continue; }
      const hk = d <= HUT_REACH ? hutPiece(l, have) : null;   // 0.33: the hut, with a log on his shoulder, then branches, then fronds
      if (hk) { bd = d; best = { kind: 'upgrade', what: 'hut', piece: hk, start: !hutBegun(l), leanto: l, x: l.x, z: l.z }; }
    }
    return best;
  }
  function siteHere(px, pz) {   // a new lean-to he could start now: driftwood under his arm and a place where one fits, the middle a step behind him, the open side to the camera
    if (wet(hereAt(px, pz)) || !handsFree() || !piecesHeld().has(PARTS.leanto[0])) return null;
    const c = siteAt(px, pz, viewYaw);
    return siteFits(c) ? { kind: 'buildHere', what: 'leanto', piece: PARTS.leanto[0], site: c, x: c.x, z: c.z } : null;
  }
  const sleepable = (px = player.x, pz = player.z) => { const t = hereAt(px, pz); return !wet(t) && t.climb <= 0.25; };
  const sitOk = () => { const t = here(); return !wet(t) && t.depth <= 0.05 && t.climb <= 0.25 && t.s < SIT_SLOPE; };   // 0.29.2: level dry ground, no climbing route

  // 0.30.17 "Spear": he can make the spear when no spear exists, one branch is under his arm and nothing else is carried, and a stone (loose, or a pile of stones) lies beside him, on dry ground
  const stoneBeside = (px, pz) => wood.findAll(px, pz, REACH, 'log').some(c => c.log.stone) || wood.findAll(px, pz, BESIDE, 'pile').some(c => c.pile.kind === 'stone');
  const makeable = (px, pz) => !spear.has() && !axe.hand && !fire.torch && wood.load() === 1 && wood.carried.length === 1 && !!wood.carried[0].branch && !wet(hereAt(px, pz)) && stoneBeside(px, pz);
  // 0.31 "Axe": the axe is made like the spear and uses up a stone and a tuft of fibre as well as the branch: no axe exists, nothing in his hands, exactly one branch under his arm and nothing else carried, a loose stone within REACH or a pile of stones
  // within BESIDE, a tuft of fibre, on dry ground
  const makeableAxe = (px, pz) => !axe.has() && !spear.hand && !fire.torch && fibre.carried > 0 && wood.load() === 1 && wood.carried.length === 1 && !!wood.carried[0].branch && !wet(hereAt(px, pz)) && stoneBeside(px, pz);
  const useStone = () => {   // the stone of the axe is used up: the nearest loose one, else one off a pile of stones
    const loose = wood.findAll(player.x, player.z, REACH, 'log').find(c => c.log.stone);
    if (loose) { if (!stones.take(loose.log)) return false; wood.version++; return true; }
    const pile = wood.findAll(player.x, player.z, BESIDE, 'pile').find(c => c.pile.kind === 'stone');
    return !!pile && wood.consume(pile.pile, 1).length === 1;
  };
  const roastFood = () => (fish.carried.length && (!crabs.carried.length || fish.carried[0] < crabs.carried[0]) ? 'fish' : 'crab');   // the one that was caught first goes first

  /** Everything he could do now, as a flat list (pure, changes nothing): the small actions first, nearest first (the first is the main one the ring
   *  and Space do), then the big ones, each marked `big: true` (build, upgrade, light, sleep). See the header for the kinds. */
  function actions() { return actionsAt(player.x, player.z); }
  /** 0.30.3 "Routes": the same list as if he stood at (px, pz) (pure, nothing changes; what he carries, holds and does is as it is now). The one rule of what is offered where:
   *  `actions()` is `actionsAt` at his feet, and game/stand asks it at the spots it considers, so the standing points never disagree with the game. */
  function actionsAt(px, pz) {
    if (sleep.asleep || sleep.lie > 0 || work) return [];
    const load = wood.load(), torch = !!fire.torch, swim = wet(hereAt(px, pz)), hand = spear.hand || axe.hand;   // 0.30.17: a spear in his hand fills it like a torch (no wood, no stone, no torch); 0.31: an axe too (only one of spear, axe and torch)
    const small = [];
    const blaze = load ? fire.find(px, pz, BESIDE, 'fire') : null;
    if (blaze && dryPiece() && !full(blaze.fire) && !leantos.noFire(blaze.fire.x, blaze.fire.z)) small.push({ kind: 'feed', fire: blaze.fire, thing: blaze });   // dry wood beside a fire feeds it, whatever else is near
    const cands = [];   // what else he could do; the nearest first
    if (!torch && !hand) {   // stones go in his hands (at most STONE_MAX), everything else under his arm (at most CARRY_MAX)
      const room = l => wood.log ? false : l.timber ? load === 0 : l.stone ? wood.stones.length < STONE_MAX : wood.carried.length < CARRY_MAX;   // 0.31: a log is carried alone
      const log = wood.find(px, pz, REACH, 'log', room), pile = load ? null : wood.find(px, pz, BESIDE, 'pile');   // with wood in his arm a pile is laid on, not taken from
      if (log) cands.push({ d: log.d, a: { kind: 'pickup', thing: log } });
      if (pile) cands.push({ d: pile.d, a: { kind: 'pickup', thing: pile } });
    }
    const coco = fibre.find(px, pz, REACH);   // 0.27.1: always husked (a tuft when there is room); at the end he eats it when hungry (or with two carried already), else carries it
    if (coco) cands.push({ d: coco.d, a: { kind: 'husk', thing: coco } });
    for (const [f, kind] of [[berries, 'berries'], [bananas, 'bananas']]) {   // 0.26: berry bushes and banana plants; hungry he eats on the spot, else the pick is carried (if there is room)
      const p = f.find(px, pz, REACH), eat = hunger.days > EAT_AT;
      if (p && (eat || !f.full())) cands.push({ d: p.d, a: { kind, eat, thing: p } });
    }
    if (!torch && !swim) {   // 0.22: crabs; the roast comes before the torch at the same fire (equal distances keep their order)
      const f = crabs.carried.length || fish.carried.length ? fire.find(px, pz, BESIDE, 'fire') : null;
      if (f && fire.strength(f.fire) > 0) cands.push({ d: f.d, a: { kind: 'roast', fire: f.fire, thing: f, food: roastFood() } });   // 0.30.17: a crab or a fish, whichever would spoil first
      const h = crabs.full() ? null : wildlife.hiding(px, pz, DIG_REACH);
      if (h) cands.push({ d: h.d, a: { kind: 'dig', thing: h } });
    }
    if (!load && !torch && !hand && spear.at) {   // 0.30.17: the spear lying within reach is taken up (empty arms and hands)
      const d = Math.hypot(spear.at.x - px, spear.at.z - pz);
      if (d <= REACH) cands.push({ d, a: { kind: 'takeSpear', thing: { kind: 'spear', x: spear.at.x, z: spear.at.z } } });
    }
    if (!load && !torch && !hand && axe.at) {   // 0.31: the axe lying within reach is taken up like the spear
      const d = Math.hypot(axe.at.x - px, axe.at.z - pz);
      if (d <= REACH) cands.push({ d, a: { kind: 'takeAxe', thing: { kind: 'axe', x: axe.at.x, z: axe.at.z } } });
    }
    if (axe.hand && !swim) { const tr = felled.nearest(px, pz, FELL_REACH); if (tr) cands.push({ d: tr.d, a: { kind: 'fell', tree: tr } }); }   // 0.31: the axe in his hand, a trunk beside him, dry ground: chop it down
    if (spear.hand && fishableAt(hereAt(px, pz)) && !fish.full()) cands.push({ d: 0, a: { kind: 'fish' } });   // 0.30.17: shallow sea water, the spear in his hand
    if (!load && !torch && !hand) {
      const f = fire.find(px, pz, BESIDE, 'fire'), t = fire.find(px, pz, REACH, 'torch');
      if (f && f.fire.fuel > TORCH_COST) cands.push({ d: f.d, a: { kind: 'torch', fire: f.fire, thing: f } });   // flames, not embers
      if (t) cands.push({ d: t.d, a: { kind: 'torch', torch: t.torch, thing: t } });
    }
    const wp = findWater(world, px, pz, DRINK_REACH, game.sea);
    if (wp && (load ? !swim : torch ? !!plantBesideSpot(px, pz) : true)) cands.push({ d: Math.hypot(wp.x - px, wp.z - pz), a: { kind: thirst.days <= DRINK_AT && shells.empty() ? 'fill' : 'drink', thing: wp } });   // wood is laid down and a torch stuck in the ground first
    cands.sort((p, q) => p.d - q.d);
    for (const c of cands) if (!small.some(x => x.kind === c.a.kind)) small.push(c.a);   // one of each kind (the nearest): two icons alike would say nothing
    if (!small.length) {   // nothing near to do: what is in his hands, then a carried bite
      if (torch) { if (plantSpot(px, pz)) small.push({ kind: 'plant' }); }
      else if (hand) { /* the spear is laid down below */ }
      else if (load) { if (!swim) small.push({ kind: 'lay' }); }
      else if (!swim) {   // empty hands: a full shell when thirsty, else something carried when hungry
        if (shells.full() && thirst.days > SIP_AT) small.push({ kind: 'sip' });
        else if (hunger.days > EAT_AT && berries.carried.length) small.push({ kind: 'eatBerries' });   // 0.26: what spoils first is eaten first
        else if (hunger.days > EAT_AT && bananas.carried.length) small.push({ kind: 'eatBanana' });
        else if (shells.nuts && hunger.days > EAT_AT) small.push({ kind: 'husk', carried: true });
      }
    }
    if (spear.hand && !swim) small.push({ kind: 'laySpear' });
    if (axe.hand && !swim) small.push({ kind: 'layAxe' });   // 0.31: always, after the nearer things, like the spear   // 0.30.17: always, whatever else is near: the arc keeps it within reach
    if (makeableAxe(px, pz)) small.push({ kind: 'makeAxe' });   // 0.31 "Axe": a branch, a stone beside him and a tuft of fibre
    if (makeable(px, pz)) small.push({ kind: 'makeSpear' });   // 0.30.17: a branch in his arms and a stone beside him (after 'lay', so the ring keeps doing what it did)
    const b = siteIn(px, pz) || siteHere(px, pz), l = b ? null : lightable(px, pz), big = b || l;
    if (big) small.push({ ...big, big: true });
    if (sleepable(px, pz) && sleep.canLie(clock.time)) small.push({ kind: 'sleep', big: true });
    return small;
  }

  /** What the action button offers now: { tap, options } (pure). tap: the main small action (the ring and Space do it) or null. options: up to
   *  OPTIONS (3) others in this order: the other small actions nearest first, then the big ones (never dropped for a small one). Keys 1 to 3 and the arc's icons pick from it. */
  function action() { return actionAt(player.x, player.z); }
  function actionAt(px, pz) {
    const list = actionsAt(px, pz), tap = list.length && !list[0].big ? list[0] : null, rest = tap ? list.slice(1) : list;
    const bigs = rest.filter(o => o.big), smalls = rest.filter(o => !o.big);
    return { tap, options: [...smalls.slice(0, Math.max(0, OPTIONS - bigs.length)), ...bigs].slice(0, OPTIONS) };
  }
  /** Everything the action button, its arc and the keys would offer at (px, pz): the ring's action and the arc's options, in one list (pure). */
  function offersAt(px, pz) { const a = actionAt(px, pz); return a.tap ? [a.tap, ...a.options] : a.options; }

  /** Do an option of action() (or its tap) at the next update: it is looked up again among what can be done then (same kind), so a stale one does nothing. */
  function act(o) { if (!o || !o.kind) return false; chosen = o; return true; }
  const same = (a, b) => a.kind === b.kind && a.what === b.what && (a.thing && a.thing.kind) === (b.thing && b.thing.kind);

  function startLight(l, input) {   // walk to the pile's side, kneel there and light it (F or its icon)
    const side = spotBeside('light', l.pile, beside(l.pile.x, l.pile.z));
    input.target = { x: side.x, z: side.z, tap: true, seen: true, act: { kind: l.torch ? 'kindle' : 'light', pile: l.pile, x: l.pile.x, z: l.pile.z } };
  }

  function startBuild(b, input) {   // build a piece in (F, or the icon of the arc): a new site at once where he stands, else walk to beside the lean-to first
    if (b.kind === 'buildHere') { input.clearTarget(); arrive({ kind: 'buildHere', site: b.site, x: b.x, z: b.z }); return; }
    const side = spotBeside(b.kind, b.leanto, beside(b.x, b.z));
    input.target = { x: side.x, z: side.z, tap: true, seen: true, act: { kind: b.kind, leanto: b.leanto, what: b.what, x: b.x, z: b.z } };
  }

  function yaw(y) { if (Number.isFinite(y)) viewYaw = y; return viewYaw; }   // the way a new lean-to opens (the camera's yaw): read, or set with a number
  const takePiece = kind => kind === 'stone' ? !!wood.giveStone() : kind === 'log' ? !!wood.giveLog() : !!wood.giveOne(l => kindOf(l) === kind);   // the piece is used up (a stone is already out of the ground)

  /** 0.27.2 'Row': use a drawing of the inventory row at once. kind: 'nut' | 'water' | 'berries' | 'banana' | 'crab'. Returns true when it was started
   *  (a nut, water and a crab kneel; berries and a banana are eaten at once), false when nothing happened. Hunger and thirst never go below 0,
   *  and it works when not hungry or thirsty (the player chooses). Refused asleep or lying down, kneeling already, stooping, with a torch in hand and in water.
   *  Wood under his arm stays there (eating needs no free hands). A crab needs a fire with flames beside him (BESIDE). */
  function use(kind, input) {
    if (sleep.asleep || sleep.lie > 0 || work || queued || player.stoop > 0 || fire.torch || wet(here())) return false;
    if (kind === 'nut') { if (!shells.nuts) return false; work = { kind: 'husk', t: 0, dur: EAT_TIME, thing: null }; }
    else if (kind === 'water') { if (!shells.full()) return false; work = { kind: 'sip', t: 0, dur: SIP_TIME, thing: null }; }
    else if (kind === 'berries' || kind === 'banana') {
      if (!(kind === 'berries' ? berries : bananas).eat()) return false;
      hunger.eat(kind === 'berries' ? BERRY_FOOD : BANANA_FOOD); stoop();
    } else if (kind === 'crab' || kind === 'fish') {   // 0.30.17: a fish is roasted like a crab
      const f = (kind === 'crab' ? crabs : fish).carried.length ? fire.find(player.x, player.z, BESIDE, 'fire') : null;
      if (!f || !(fire.strength(f.fire) > 0)) return false;
      work = { kind: 'roast', t: 0, dur: ROAST_TIME, thing: f.fire, food: kind }; face(f);
    } else return false;
    notifyAction(kind === 'nut' ? 'eatNut' : kind === 'water' ? 'sip' : kind === 'banana' ? 'eatBanana' : kind === 'berries' ? 'eatBerries' : 'roast'); if (input && input.clearTarget) input.clearTarget();
    return true;
  }

  function press(a, input) {   // a short press of the action button
    input.clearTarget();
    if (a.thing && a.kind !== 'drink' && a.kind !== 'fill') face(a.thing);
    if (a.kind === 'pickup') { if (wood.take(a.thing, clock.total)) { stoop(); notifyAction('pickup'); } }
    else if (a.kind === 'husk') { work = { kind: 'husk', t: 0, dur: a.thing ? HUSK_TIME : EAT_TIME, thing: a.thing ? a.thing.coco : null }; notifyAction(a.thing ? 'husk' : 'eatNut'); }   // no thing: a carried nut (already husked: EAT_TIME)
    else if (a.kind === 'berries' || a.kind === 'bananas') {
      const f = a.kind === 'berries' ? berries : bananas;
      if ((a.eat || !f.full()) && f.pick(a.thing.plant, clock.total)) { if (a.eat) hunger.eat(a.kind === 'berries' ? BERRY_FOOD : BANANA_FOOD); else f.stow(clock.total); stoop(); notifyAction(a.kind); }
    } else if (a.kind === 'eatBerries' || a.kind === 'eatBanana') {
      if ((a.kind === 'eatBerries' ? berries : bananas).eat()) { hunger.eat(a.kind === 'eatBerries' ? BERRY_FOOD : BANANA_FOOD); stoop(); notifyAction(a.kind); }
    }
    else if (a.kind === 'sip') { work = { kind: 'sip', t: 0, dur: SIP_TIME, thing: null }; notifyAction('sip'); }
    else if (a.kind === 'dig') { work = { kind: 'dig', t: 0, dur: DIG_TIME, thing: a.thing.id }; notifyAction('dig'); }
    else if (a.kind === 'roast') { work = { kind: 'roast', t: 0, dur: ROAST_TIME, thing: a.fire, food: a.food || 'crab' }; notifyAction('roast'); }
    else if (a.kind === 'makeSpear') { if (makeable(player.x, player.z)) { work = { kind: 'make', t: 0, dur: MAKE_TIME, thing: null }; notifyAction('makeSpear'); } }
    else if (a.kind === 'makeAxe') { if (makeableAxe(player.x, player.z)) { work = { kind: 'makeAxe', t: 0, dur: AXE_MAKE_TIME, thing: null }; notifyAction('makeAxe'); } }
    else if (a.kind === 'takeAxe') { if (axe.take()) { stoop(); notifyAction('takeAxe'); } }
    else if (a.kind === 'layAxe') { if (!wet(here()) && axe.lay(player.x, player.z)) { stoop(); notifyAction('layAxe'); } }
    else if (a.kind === 'fell') {   // 0.31: he chops standing (no kneeling); the progress of an interrupted felling is kept in game/felled
      const tr = felled.nearest(player.x, player.z, FELL_REACH);
      if (axe.hand && tr && !wet(here())) { const p0 = felled.chopped(tr.id); work = { kind: 'fell', t: 0, dur: Math.max(0.01, FELL_TIME * (1 - p0)), thing: tr.id, p0 }; face(tr); notifyAction('fell'); }
    }
    else if (a.kind === 'fish') { work = { kind: 'fish', t: 0, dur: FISH_TIME, thing: null }; notifyAction('fish'); }
    else if (a.kind === 'takeSpear') { if (spear.take()) { stoop(); notifyAction('takeSpear'); } }
    else if (a.kind === 'laySpear') { if (!wet(here()) && spear.lay(player.x, player.z)) { stoop(); notifyAction('laySpear'); } }
    else if (a.kind === 'feed') {   // only a piece dry enough to burn goes on; wet wood stays in his arm
      const l = wood.giveOne(fuel);
      if (l) { fire.feed(a.fire, dryness(l, clock.total), l.branch ? BRANCH_BURN : 1); stoop(); notifyAction('feed'); }
    } else if (a.kind === 'torch') { if (a.fire ? fire.takeTorch(a.fire) : fire.pickTorch(a.torch)) { stoop(); notifyAction('torch'); } }
    else if (a.kind === 'drink' || a.kind === 'fill') {
      if (wood.load() || fire.torch) { if (fire.torch ? plantBeside() : lay(player.heading + Math.PI)) { stoop(); queued = a.kind; } }   // hands first, then drink or fill
      else drink(a.thing, a.kind);
    } else if (a.kind === 'lay') { if (lay(player.heading)) { stoop(); notifyAction('lay'); } }
    else if (a.kind === 'plant') { if (plantTorch()) { stoop(); notifyAction('plant'); } }
  }

  function drink(wp, kind = 'drink') { work = { kind, t: 0, dur: kind === 'fill' ? FILL_TIME : DRINK_TIME, thing: null }; face(wp); notifyAction(kind); }

  function arrive(a) {   // at the spot he walked to: light the pile, or build
    if (a.kind === 'buildHere' || a.kind === 'buildIn' || a.kind === 'upgrade') {   // 0.32: kneel PIECE_TIME seconds, then the piece is built in (finish)
      const lt = a.leanto && leantos.list.includes(a.leanto) ? a.leanto : null;
      const have = piecesHeld(); let what = null;
      if (a.kind === 'buildHere') what = siteFits(a.site) && have.has(PARTS.leanto[0]) ? 'leanto' : null;
      else if (lt && a.kind === 'buildIn') what = lt.progress < 1 && have.has(nextKind(lt)) ? 'leanto' : null;
      else if (lt && lt.progress >= 1) what = UP_ORDER.find(k => have.has(nextKind(lt, k))) || (hutPiece(lt, have) ? 'hut' : null);
      if (what && !wet(here())) { work = { kind: a.kind === 'upgrade' ? 'upgrade' : 'build', t: 0, dur: PIECE_TIME, thing: lt, site: a.kind === 'buildHere' ? a.site : null, what }; face(a); notifyAction(a.kind === 'upgrade' ? 'upgrade' : 'build'); }
      else stoop();
      return;
    }
    if (a.kind === 'kindle') {
      if (wood.piles.includes(a.pile) && a.pile.logs.length >= FIRE_MIN && !leantos.noFire(a.pile.x, a.pile.z) && !wet(here()) && fire.kindle(a.pile.x, a.pile.z, a.pile.logs, meanDry(a.pile.logs), clock.total)) { wood.takePile(a.pile); notifyAction('kindle'); }
      stoop();
    } else if (a.kind === 'light') {
      if (wood.piles.includes(a.pile) && a.pile.logs.length >= FIRE_MIN && fibre.carried && !leantos.noFire(a.pile.x, a.pile.z) && !wet(here())) { work = { kind: 'drill', t: 0, dur: DRILL_TIME, thing: a.pile }; notifyAction('light'); }
    }
    if (work) face(a);
  }

  function finish(wk) {
    if (wk.kind === 'upgrade' || wk.kind === 'build') {   // 0.32: the next part of the site is built in with the piece that fits (a new site: started first, if the lean-to still fits)
      let lt = wk.thing;
      if (wk.site) {
        if (wet(here()) || !siteFits(wk.site) || !piecesHeld().has(PARTS.leanto[0])) return;
        lt = leantos.start(wk.site.x, wk.site.z, wk.site.heading);
      } else if (!leantos.list.includes(lt)) return;
      const kind = wk.what === 'leanto' ? nextKind(lt) : nextKind(lt, wk.what);
      if (wk.what === 'hut' && !hutBegun(lt) && !hutFits(lt)) return;   // 0.33: the first part of a hut only if it still fits
      if (!kind || (wk.what !== 'leanto' && lt.progress < 1) || !takePiece(kind)) { if (wk.site) leantos.list.splice(leantos.list.indexOf(lt), 1); return; }
      leantos.build(lt, wk.what);
      return;
    }
    if (wk.kind === 'husk') {
      if (wk.thing) {   // a nut from the ground: husked (a tuft when there is room), then eaten when hungry or with two carried already, else carried
        if (!fibre.husk(wk.thing, clock.total)) return;
        if (hunger.days <= EAT_AT && shells.addNut()) return;
      } else if (!shells.eatNut()) return;   // a carried nut is already husked: no tuft
      hunger.eat(); thirst.sip(NUT_DRINK); shells.keep(); return;   // he keeps the empty half shell
    }
    if (wk.kind === 'drink') { thirst.drink(); return; }
    if (wk.kind === 'fill') { shells.fill(); return; }
    if (wk.kind === 'sip') { if (shells.pour()) thirst.sip(SIP_DRINK); return; }
    if (wk.kind === 'dig') { if (wildlife.isHiding(wk.thing) && !crabs.dig(wk.thing, clock.total)) wildlife.escape(wk.thing); return; }   // the crab is caught, or it ran out of the back
    if (wk.kind === 'roast') {
      if (!fire.fires.includes(wk.thing) || !(fire.strength(wk.thing) > 0)) return;
      if (wk.food === 'fish') { if (fish.eat()) hunger.eat(FISH_FOOD); } else if (crabs.eat()) hunger.eat(CRAB_FOOD);
      return;
    }
    if (wk.kind === 'fell') { fellTree(wk.thing); return; }
    if (wk.kind === 'makeAxe') { if (makeableAxe(player.x, player.z) && useStone() && wood.giveOne(l => !!l.branch) && fibre.use()) axe.make(); return; }   // the branch, the stone and the tuft are all used up
    if (wk.kind === 'make') { if (makeable(player.x, player.z) && wood.giveOne(l => !!l.branch)) spear.make(); return; }   // the branch is used up, the stone stays
    if (wk.kind === 'fish') { if (spear.hand && fishableAt(here())) fish.fishTry(clock.total); return; }
    const pile = wk.thing; if (!wood.piles.includes(pile) || leantos.noFire(pile.x, pile.z) || !fibre.use()) return;
    const lit = fire.attempt(pile.x, pile.z, pile.logs, meanDry(pile.logs), sleep.tired(), clock.total);
    if (lit) wood.takePile(pile);
  }

  /** 0.31 "Axe": the tree falls, away from him. Its trunk becomes a log (a giant gives 2 or 3 sections), its crown leaves loose branches (a palm: fronds and nuts), all lying where game/felled `plan` puts them. */
  function fellTree(id) {
    const info = treeInfo(world, id); if (!info || !axe.hand) return;
    const rec = felled.fell(info, Math.atan2(info.x - player.x, info.z - player.z), clock.total); if (!rec) return;
    const pl = fallPlan(world, rec);
    for (const l of pl.logs) logs.add(l);
    for (const b of pl.branches) branches.addExtra(b);
    for (const f of pl.fronds) fronds.addExtra(f);
    for (const n of pl.nuts) fibre.addExtra(n);
    wood.version++;
  }

  function settle() {   // a sleep has ended: if thirst brought him down he wakes still thirsty, not collapsing again at once
    if (sleep.asleep) slept = true;
    else if (slept) { slept = false; thirst.revive(); }
  }

  function canSleep() { return sleepable() && !player.stoop && sleep.canLie(clock.time); }   // collapsing (sleep.update) needs neither

  function update(input, dt) {
    if (Number.isFinite(input.yaw)) viewYaw = input.yaw;   // 0.32: the way a new lean-to opens, read before anything is offered or pressed
    const wantWake = input.takeWake ? input.takeWake() : false, light = input.takeLight ? input.takeLight() : false;
    const pressed = input.takeAction ? input.takeAction() : null, idx = input.takeChoice ? input.takeChoice() : null;
    let pick = null;   // what the button, a key 1 to 3, an icon of the arc or act() chose, looked at before anything changes
    if (pressed || chosen || Number.isInteger(idx)) {
      const doing = action(), all = [doing.tap, ...doing.options].filter(Boolean);
      pick = (chosen && all.find(o => same(o, chosen))) || (Number.isInteger(idx) ? doing.options[idx] : null) || (pressed ? doing.tap : null) || null;
      chosen = null;
    }
    let wantSleep = input.takeSleep ? input.takeSleep() : false;
    if (pick && pick.kind === 'sleep') wantSleep = true;
    if (sleep.asleep) { if (wantWake && sleep.lie > 0.5) { sleep.wake(); if (input.cancelAction) input.cancelAction(); } }   // the press that woke him does nothing more
    else if (wantSleep && canSleep()) { work = null; queued = null; sleep.start(isNight(clock.time)); notifyAction('sleep'); }   // by day only a nap
    if (sleep.asleep && fire.torch && !plantTorch()) fire.douse();   // he sticks the torch in the ground before he lies down
    if (fire.torch && leantos.inHut(player.x, player.z)) fire.douse();   // 0.33: no torch burns inside a finished hut
    if (sleep.asleep && spear.hand) spear.lay(player.x, player.z);   // 0.30.17: and lays the spear down beside him
    if (sleep.asleep && axe.hand) axe.lay(player.x, player.z);   // 0.31: and the axe
    settle();
    const gameDt = sleep.update(dt, !wet(here()), fire.warm(player.x, player.z), { drain: thirst.drain() * hunger.drain(), faint: thirst.faint() }, (lt => lt ? { walls: leantos.has(lt, 'walls'), bed: leantos.has(lt, 'bed'), hut: hutDone(lt) } : false)(leantos.home(player.x, player.z)));
    settle();
    player.lie = sleep.lie; player.tired = sleep.tired(); player.thirsty = thirst.level(); player.hungry = hunger.level();
    if (work && (sleep.asleep || wantsToMove(input))) work = null;   // stopped early
    if (queued && (sleep.asleep || wantsToMove(input))) queued = null;

    // 0.29.2 "Amble": sitting on the ground, only when the mind asks (input.sit); anything he does or the player asks for gets him up
    const sitWant = !!input.sit && !sleep.asleep && !(sleep.lie > 0) && !work && !queued && !(player.stoop > 0) && !fire.torch && !spear.hand && !axe.hand && !wood.load() && !wantsToMove(input) && !pick && !light && !wantSleep && sitOk();
    if (sitWant) { const lk = input.sit; if (lk && Number.isFinite(lk.x) && Number.isFinite(lk.z) && Math.hypot(lk.x - player.x, lk.z - player.z) > 0.2) { let d = Math.atan2(lk.x - player.x, lk.z - player.z) - player.heading; d = Math.atan2(Math.sin(d), Math.cos(d)); player.heading += d * Math.min(1, dt * 6); } }
    const sitDown = dt / SIT_TIME;
    player.sitting = sitWant ? Math.min(1, player.sitting + sitDown) : Math.max(0, player.sitting - (wantsToMove(input) || pick || light ? 2 : 1) * sitDown);
    let res, ran = false, strain = 1;   // ran: he ran this frame (game/breath)
    if (sleep.asleep || sleep.lie > 0) {
      queued = null;
      if (input.target) input.clearTarget();
      if (sleep.asleep && wood.load()) lay(player.heading);
      player.stoop = 0;
      res = stepPlayer(world, player, null, dt);
    } else if (work) {
      work.t += dt;
      if (work.kind === 'drill') sleep.tire(DRILL_COST * hunger.drillCost() * dt / DRILL_TIME);
      else if (work.kind === 'build' || work.kind === 'upgrade') {
        if (work.thing && !leantos.list.includes(work.thing)) work = null;   // the flood took it
        else sleep.tire(pieceCost(work.what) * dt / PIECE_TIME);
      } else if (work.kind === 'fell') {   // standing work: the chopping tires him like building and its progress is kept in the overlay
        if (felled.has(work.thing)) work = null;
        else { sleep.tire(FELL_COST * dt / FELL_TIME); felled.setChopped(work.thing, Math.min(1, work.p0 + work.t / FELL_TIME)); }
      }
      if (work && work.t >= work.dur) { const wk = work; work = null; finish(wk); }
      res = stepPlayer(world, player, null, dt);
    } else {
      if (light) { const b = siteIn(player.x, player.z) || siteHere(player.x, player.z); if (b) startBuild(b, input); else { const l = lightable(player.x, player.z); if (l) startLight(l, input); } }   // F
      else if (pick && (pick.kind === 'buildHere' || pick.kind === 'buildIn' || pick.kind === 'upgrade')) startBuild(pick, input);
      else if (pick && pick.kind === 'light') startLight(pick, input);
      else if (pick && pick.kind !== 'sleep' && !player.stoop && !queued) press(pick, input);
      const tg = input.target;
      if (tg && tg.tap && !tg.seen) look(tg);
      const a = input.target && input.target.act;
      if (player.stoop > 0) {
        player.stoop = Math.max(0, player.stoop - dt / STOOP);
        res = stepPlayer(world, player, null, dt);
      } else if (queued) {   // hands are free now: kneel and drink
        const q = queued; queued = null;
        const wp = findWater(world, player.x, player.z, DRINK_REACH, game.sea);
        if (wp && !wood.load() && !fire.torch) drink(wp, q);
        res = stepPlayer(world, player, null, dt);
      } else if (a && Math.hypot(input.target.x - player.x, input.target.z - player.z) < (a.kind === 'light' || a.kind === 'kindle' || a.kind === 'buildIn' || a.kind === 'upgrade' || a.close ? 0.15 : REACH)) {
        input.clearTarget(); if (a.kind !== 'stand') arrive(a);   // arrived: stand there, or light the pile
        res = stepPlayer(world, player, null, dt);
      } else {
        const aimAt = routeAim(input, dt), dir = moveIntent(aimAt === input.target ? input : { ...input, target: aimAt }, player);
        if (!dir && input.target && aimAt === input.target) input.clearTarget();
        const needs = sleep.speed() * thirst.speed() * hunger.speed();
        const wantRun = !!dir && (input.run || !!(input.target && input.target.run)), run = wantRun && breath.canRun() && !wood.log;   // (a log on the shoulder is no load to run with)   // out of breath he walks
        const pace = run ? 1 : paceOf(input);   // 0.29.2: the habit's amble (the player's input has no pace); a run is never slowed
        const load = (wood.log ? LOG_WALK : 1 - CARRY_SLOW * wood.load()) * needs * pace;   // 0.31: a log is walked with at LOG_WALK, whatever else
        res = stepPlayer(world, player, dir, dt, run, load, game.sea, (wood.log ? LOG_STRIDE : 1 - CARRY_STRIDE * wood.load()) * weariStride(needs) * paceStride(pace) * (run ? breath.stride() : 1), movement);
        ran = run && res.moved; strain = load;
        if (res.blocked && input.target) { blockedFor += dt; if (blockedFor > 0.5) input.clearTarget(); } else blockedFor = 0;
      }
    }
    if (res.moved) known.visit(player.x, player.z, input.learns === false ? 0 : undefined);   // what he walks past he knows (only when he moved: a frame of standing, or a reload, teaches nothing; the mind learns no new ground)
    breath.update(dt, ran, res.moved, strain); player.running = ran; player.winded = breath.winded;
    player.work = work ? { kind: work.kind, f: Math.min(1, work.t / work.dur) } : null;
    if (fire.torch && here().depth > DOUSE_DEPTH) fire.douse();   // wading too deep puts the torch out
    player.torch = !!fire.torch; player.spear = spear.hand; player.axe = axe.hand;

    clock.advance(gameDt);
    game.sea = seaLevel(clock.total);
    const n = highWaters(clock.total);
    if (n > wood.tide) { for (let k = Math.max(wood.tide + 1, n - 2); k <= n; k++) wood.washUp(k, player, clock.total); wood.tide = n; }
    wood.flood(game.sea);
    wood.tideUpdate(game.sea, clock.total);   // wood under the sea cannot be picked up and starts drying again
    thirst.update(gameDt / DAY_SECONDS);
    hunger.update(gameDt / DAY_SECONDS);
    game.rain = weather.intensity(clock.total);
    const falling = game.rain >= FALLING;
    if (!(Math.abs(clock.total - rainAt) < RAIN_EVERY)) { rainAt = clock.total; wood.rain(clock.total, falling, (x, z) => leantos.dry(x, z, 'wood'), player, weather.lastFall(clock.total)); }   // wood in the open gets wet
    fire.update(gameDt / DAY_SECONDS, falling ? (x, z) => !leantos.dry(x, z, 'fire') : null, player, clock.total, leantos.ring);   // fires and torches in the open burn down faster
    fire.flood(game.sea);
    leantos.flood(game.sea);
    fibre.update(clock.total);
    berries.update(clock.total);
    bananas.update(clock.total);
    crabs.update(clock.total);
    fish.update(clock.total);
    branches.update(clock.total);
    fronds.update(clock.total);
    if (sleep.asleep && wet(here())) sleep.wake();   // the flood wakes him
    settle();
    wildlife.update(dt, { gone: crabs.isGone, x: player.x, z: player.z, time: clock.time, sea: game.sea, wading: here().depth > 0.05, asleep: sleep.asleep });   // crabs, fish and birds near him (not saved)
    fireflies.update(dt, { x: player.x, z: player.z, time: clock.time });   // the fireflies near him at night (not saved)
    return { distance: res.distance, terrain: here(), time: clock.time, total: clock.total, sea: game.sea, rest: sleep.rest() };
  }
  function state() {
    return { seed: world.seed, time: clock.time, day: clock.day, player: { x: player.x, z: player.z, heading: player.heading }, sleep: sleep.state(), wood: wood.state(), fibre: fibre.state(), fire: fire.state(), thirst: thirst.state(), hunger: hunger.state(), branches: branches.state(), fronds: fronds.state(), stones: stones.state(), leantos: leantos.state(), crabs: crabs.state(), spear: spear.state(), axe: axe.state(), felled: felled.state(), logs: logs.state(), fish: fish.state(), shells: shells.state(), berries: berries.state(), bananas: bananas.state(), known: known.state() };
  }
  return game;
}
