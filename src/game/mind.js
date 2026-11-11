/**
 * game/mind — Dave's head (0.28 "Habit" through 0.30.4 "Timber"): what the castaway does by himself when the player leaves him alone.
 *
 * After QUIET (30 s, game/input `createTakeover`) without any input main hands the game this mind's input instead of the player's;
 * any input of the player takes it back at once (`release`). The mind adds NO game rule: it fills an input object like the player's
 * (a walk target, a press of the action button, a click on an icon of the arc, Z, a click on the row) and so can do only what a
 * player could do. It looks at the island only where the castaway has been (game/known): its targets and its paths stay inside the
 * known cells and 1.5 m away from their edge (`inside`), so he does not wander off into land he has not seen, except on a search (below) and on an exploring trip (0.29.4). Since 0.29.9 a target at a dynamic solid's centre is approached at its rim, so the same actions still work. It never wakes him from sleep and never starts a sleep before he could choose to.
 * It builds only one thing: his home (0.29.3 "Homestead", below); every other kind of the arc it never chooses, except (0.31 "Axe", below) making the one axe, felling trees with it and carrying and piling the logs once his home is complete.
 *
 * What he does, in this order of priority (`chooseGoal`, pure, on a plain snapshot of the needs and the time of day):
 *   1 drink   thirst >= THIRST_GO (0.35 days; BED_THIRST 0.25 from SUPPER_FROM 0.64 to LIGHT_FROM 0.74): a full shell is drunk, else he walks to the nearest known fresh river water and kneels (knowing none, he searches, below);
 *             when empty shells are with him and the river is near (NEAR_WATER 40 m) and thirst >= THIRST_TOPUP (0.2), he goes to fill them too
 *   2 eat     (0.29.1: a crab carried is roasted first, at a fire with flames, from hunger CRAB_ROAST_HUNGER 0.2) hunger >= HUNGER_GO (0.4 days; BED_HUNGER 0.3 in the supper window; knowing no food and carrying none, he searches, below): berries, a banana bunch, a carried nut (the row), else the nearest known food by the way
 *             there (nut on the ground, bearing berry bush, banana plant), a carried crab roasted beside a fire, a crab dug for when he happens to stand at a hole it fled into
 *   3 sleep   every night: once he may lie down (game/sleep canLie(time)) and it is night (from BED_FROM 0.87, an hour after dusk and with the fire lit, to DAWN 0.17) or he has been awake TIRED_GO (a whole day: a nap by day):
 *             he walks home (his lean-to; else his fire; else where he last slept; else where he was when the mind took over) and lies down
 *   4 fire    in the evening (EVENING 0.6 to BED_FROM): dry driftwood (else branches) to a pile at the fire spot at home, enough for WOOD_WANT (4, 0.30.12 "Kindling"; was 6) pieces of
 *             burning (a branch counts half), the pile lit from LIGHT_FROM (0.74) when it holds at least FIRE_MIN pieces and LIGHT_MIN_FUEL (3) pieces' worth and he has
 *             fibre (or a torch in hand), and the fire fed from the piles only when its fuel is nearly out, below FEED_BELOW (0.25 of the most it holds; 0.30.12 "Kindling", was 0.6). An ember still counts as a fire: he feeds it through the same player action and drills only when it has truly died. Since 0.29.12, while idle by day he also wakes a home ember he passes with one dry piece already carried; he never fetches wood or feeds flames by day.
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
 *   and every errand comes first), and at most one piece of the home is finished a day (`builtDay`). The site (`leantoSites`, chosen once and kept, checked again when asked for and right before the building; 0.30.7 "Clearing": a lean-to that fits as the real one: its collision circles and keep-free region touch no trunk, boulder, crag or camp solid, the ground rules hold on a grid of 0.3 m, a straight line S-G-F-ring spot is walkable, the ring and the three upgrade piles have room, a way leads there from the fire; none that fits: he waits, `home-no-site`; a player's pair of piles gets the same check, `existingSite`): on known, dry, level ground at least SITE_HIGH (0.8 m) above the high-water line, 5 to 7.5 m from his home fire, the open side across
 *   from the fire (so the stone ring comes to stand about 5 m from it, not on it), preferring ground near fresh water he knows; the piles for the building (6 driftwood and 6 branches, within 2 m of each other) are laid there.
 *   Never a second lean-to: with one (also a player's) the project only adds the upgrades to it, and a half-built one is built on. Materials only from known ground, within HOME_MAX_COST of walking; piles for the upgrades lie
 *   beside the lean-to (fronds on one side, stones on the other, branches behind).
 * 0.30.16 "Reach": the 220 m cap of the exploring reach is gone (`exploreReach`: 80 m + 15 m a day, up to the whole island; the island's edge and the way home before dark are the limits), and a trip may start from EXPLORE_EARLY (just after dawn)
 *   when `calm` (idleGoal: the home project has nothing to do today and no crab trip is possible or due: `crabDue`, pure); otherwise from EXPLORE_FROM as before.
 * 0.30.19 "Journey": now and then (about once every 5 to 7 days from day 4, `journeyGap` / `journeyOk`, pure; the PRNG of its own, `rngJourney`) he goes on a JOURNEY: out in the morning (JOURNEY_FROM to JOURNEY_TO), only when calm at home (the lean-to stands, the day's piece of the home is done, no crab trip
 *   is due, thirst under 0.25 and hunger under 0.3, no rain now and none forecast for today, tonight and the next morning: `journeyRain`, pure on game/weather) to a spot he does not know yet, 200 to 420 m from home, on the coast or at a forest edge (`journeyTarget`: chosen like the exploring goals, and only when
 *   the planner finds a way there and back, `pathJourney`). The finder `pathJourney` is the exploring finder with the climbing routes opened for journeys only: route cells (climb above EXPLORE_ROUTE) of slope under JOURNEY_SLOPE 3.2 are allowed (daily exploring stays on ordinary ground; `mind.exploring` is false on a journey,
 *   `mind.journeying` true). On the way `input.learns` is true, everything he sees is known, and he eats and drinks what he finds by the ordinary goals (drink, eat: the known ground grows with him; the full shells he has are with him). The journey is a state that survives goals and sleep (`journey`: phase 'out', 'camp', 'home');
 *   the fire and stores goals wait while it lasts, the sleep goal sleeps at the camp (`journeyBed`). Before dusk (JOURNEY_CAMP, or on arrival) he picks a camp spot (`journeySpot`: known, standable, JOURNEY_HIGH above the sea, ordinary ground off any route, out of the river, no trunk or boulder near, no drop of
 *   JOURNEY_RIM within 2 m, near known fresh water), husks a nut for fibre if he has none (`journeyHusk`), gathers wood nearby (`journeyWood`: loose driftwood or branches through `gather`, at most JOURNEY_WOOD_COST of walking each way, a pile of JOURNEY_WOOD pieces' fuel) and lights a small fire at LIGHT_FROM with the fibre and the drill
 *   (`journeyLight`: `goStand('light')` and the arc's light, up to the tufts he has); he builds nothing and sleeps on the ground by it. If there is no wood, no fibre or the lighting fails, he sleeps cold. In the morning he walks home by the planner (a fall back to the known ground and then to `pathFree`) and the journey ends when he is home. He turns back at once
 *   at thirst VERY_AT or hunger VERY_HUNGER_AT or when rain comes (`journeyBrake`, pure). `mind.stats.journey` counts them; `mind.journeyAim` is the test hook for the target.
 * 0.30.21: journey beds and the sleep fallback are never on a climbing route (the sleep key is refused there): `journeyBed` takes a spot beside the fire on ordinary ground, and the refusal fallback of `sleepGoal` (`ringSpot`) prefers ordinary ring spots, keeping the old one if none qualifies.
 * 0.29.4 "Wander": EXPLORING, a pastime of the idle goal. Now and then (`exploreChance`, pure: by day, EXPLORE_FROM 0.2 to EXPLORE_TO 0.52, thirst and hunger well below the point where he goes for them, no crab trip to make; at most one trip a day, one in
 *   EXPLORE_GAP 2 days when nothing is missing, every day with chance 0.8 when wood (fewer than 6 loose logs known within 70 m of home), branches (fewer than 4) or nuts (fewer than 2) are short, or a lately failed search for them left a mark (`lack`)) he walks to the edge of what he knows
 *   (`exploreTarget`: the farthest unknown spot within `exploreReach(day)` of home (80 m on day 0, 15 m more a day, no cap since 0.30.16) that borders known ground, which he can reach and be home from before EXPLORE_BACK 0.6, preferably on the coast (wood and coconuts) or at a forest edge (branches, berries),
 *   `exploreWhere`; the PRNG of its own, `rngEx`), at the amble, learning what he walks past (`input.learns` true; `mind.exploring`, not `mind.searching`), looks about, picks up what is within reach of the far end (the arrive kinds shore, palms, forest), (also straight from the stores goal, `exploreForLack`: wood or a nut he went for and could not find on known ground sends him out at once when a trip is allowed, without waiting for an idle moment that the stores and the fire may never leave him) and turns back in time (`exploreLate`: the walk home, measured by the finder every 10 m,
 *   and the margin, against EXPLORE_BACK; at the normal pace when it is late) to lay down what he carries at home. His own terrace and ordinary ground only: the finder `pathExplore` closes climbing routes (climb above EXPLORE_ROUTE) and steep ground (slope 0.45 and more), and a trip is only made from a place from which home can be reached that way.
 * 0.29.5 "Drying" (until 0.30.12; replaced in 0.30.13 "Tideline"): the camp's drying pile, its stock errand and the transfer to the fire's pile are gone. A pile of that time in an old save is an ordinary pile now.
 * 0.30.13 "Tideline": RESCUING WET WOOD. Wood in the strip between the tides never dries (game/wood: the sea covers it again and again) and a pile there is taken by the sea. On a beach he knows (a stroll's shore leg, the far end of an exploring trip, near or far from home), with
 *   nothing but wet driftwood (or nothing) under his arm, he takes up to three pieces of such wet wood from the strip within 8 m of where the leg ends (`pickUpWet`, `SRC.strip`) and carries them a few metres higher (`tideSpot`: ground TIDE_LAND high, 2 to 9 m away, a way of at most TIDE_COST s, TIDE_CAMP (11, so that no pile lands where the lean-to's site, its ring and its upgrade piles may come) m from the fire,
 *   the lean-to and its site, TIDE_APART (3) m from other piles, CAMP_GAP kept by the game's lay) and lays them there (`layTideline`): a small pile at the beach edge, which dries where it lies (rain wets it again in the open). Later the stores and the evening fire fetch it like any pile that is not his own
 *   With no spot at hand (he stands in the camp) wet wood in his arms goes to the nearest known strip (`stripPoint`) and is laid up the beach there, never as a pile at the camp. A pile is a stop of a fetch only with empty arms (`selectStops`: the game offers no pickup from a pile with wood under his arm).
 *   THE DAILY ROUND (`tideRound`, `rngTide`, TIDE_ROUND_*): once a day, by day (TIDE_ROUND_FROM 0.22 to TIDE_ROUND_TO 0.5, chance 0.85), when calm (idle, thirst below EXPLORE_THIRST, hunger below EXPLORE_HUNGER, no crab trip possible, and after the morning's home work, which comes first in `idleGoal`), he walks to the nearest strip he knows (`tideTarget`: wet wood on known ground, a way of at most TIDE_ROUND_COST 150 s) and is home before dark (`exploreLate`, like an exploring trip); up to three pieces, and a second load when more lies there and there is time; to the lean-to site while `wetForSite` holds, else to the beach edge. FIREWOOD: a dry pile at a beach edge that is not his own counts TIDE_BONUS (0.7) times its walking cost against loose wood and other piles (`nearestBy`, `selectStops`).
 *   (`pileFinds`: its top pieces must be dry). While the lean-to still needs driftwood at its site (`wetForSite`) wet wood goes there instead, as timber. Wet wood in his arms at the start of another task is laid at such a spot too (`handoff`, `deliver`), else where he stands (never in the strip); it never goes on the fire's pile.
 * 0.30.17 "Spear": THE SPEAR AND FISHING. He makes ONE spear, once (`spearMakeOk`, `makeSpearTrip`): at an idle moment by day (DAY_FROM to EVENING, thirst and hunger low) when he has none at all, his lean-to stands (or it is day SPEAR_DAY 6: the home comes first, the spear takes a branch the lean-to needs) and a loose branch and a loose stone lie within SPEAR_RANGE (60 m) of home on known ground, he takes the nearest
 *   branch up, goes to the nearest stone and presses the arc's 'makeSpear' (10 s of kneeling); the spear is then laid at the camp. It is KEPT at the camp: `spearSpot`, beside the lean-to (3.2 to 4.8 m round its middle) or round the fire when there is no lean-to (2.6 to 4.2 m), the nearest spot to the fire spot where
 *   a body keeps CAMP_GAP from every solid (`gapFree`), outside the lean-to's keep-free region and on open known ground; the game keeps new piles 1.1 m or more from a lying spear. He fetches it only to fish (`fetchSpear`: walks to where it lies, 'takeSpear') and lays it back (`returnSpear`: 'laySpear')
 *   when the fishing is done, and every goal but eat (and the two emergencies) starts by laying a spear still in his hand at the camp (`withHandoff`), so that no wood task ever meets a full hand. FISHING (`fishTrip`, an errand): to a place in the shallows he knows (`fishSpots`: within FISH_RANGE 80 m of home,
 *   game/fish `fishableAt` at the sea as it is now, a way of at most STROLL_MAX_COST), up to FISH_TRIES (8) presses of the arc's/ring's 'fish' until FISH_WANT (1) fish is carried; the spear goes back and a fish waits for flames like a crab (`chooseGoal`: a fish counts with the crabs). FOOD: fish is an
 *   ordinary option of the eat goal (`fishOption`, `fishFoodOk`: a spear exists, room for a fish, flames burning to roast it at, by day until FISH_FOOD_TO 0.8), weighed like the others by walking cost: the way to the spear if it lies at the camp, on to the water, back to the flames, and FISH_EXTRA (20) seconds for the tries and the roast.
 *   PASTIME (`fishChance`, a stream of its own, `rngFish`): once a day in the afternoon (FISH_FROM 0.42 to FISH_TO 0.6) at an idle moment, chance FISH_IDLE_CHANCE (0.5; 0.35 before 0.30.18 "Catch"), when nothing is urgent (thirst under FISH_THIRST 0.3, hunger under FISH_HUNGER 0.35), nothing is carried to roast and no crab trip is possible now, and he can be home before dark (`exploreLate`); the catch is the evening fire's supper.
 * 0.31 "Axe": THE AXE AND THE CLEARING (`axeNext` pure, `axePlan`, `axeGoal`; the routine and the numbers are in docs/architecture.md, "The axe and the clearing"). Only when his home is complete (lean-to, walls, ring and bed), in the home's morning window (HOME_FROM to HOME_TO), at most one unit of work a day, after the spear and before the tide round and exploring, nothing pressing (AXE_THIRST, AXE_HUNGER): he makes ONE
 *   axe once (`makeAxeTrip`: a branch, a stone, a tuft of fibre from known ground), else carries a log that lies about to a log pile (`carryLog`), else fells a tree (`fellTree`): first every tree whose trunk stands within AXE_CLEAR_R (10 m) of the lean-to's middle, nearest first (palms and giants too; one he cannot reach is skipped and asked again after AXE_RETRY_DAYS), then, while fewer than AXE_LOGS (12) logs are stored,
 *   the nearest just outside it (up to AXE_OUT_R); then no more. He takes the axe, stands where 'fell' is offered, chops, lays the axe down, shoulders the log, lays it on a log pile (`logDest`: piles of twelve on the ring LOG_RING, 11.6 to 12.6 m from the lean-to's middle, behind it first, the next beside the last along the ring), and takes the axe back to lie beside the piles (`axeSpot`). A giant: the first section the day it falls, one more each morning. A log
 *   on his shoulder or the axe in his hand is laid down before any other goal (`handoff`, `returnAxe`): a carried log counts as `W.load()` 1 with an empty `W.carried` (`carriedKind()` is 'log'). Never for firewood. `mind.stats.axe`, events `axe-*`, hooks `mind.axePlan`, `mind.logDest`, `mind.axeSpot`, `mind.axeSnap`.
 * 0.30.4 "Timber": FETCHING AND HANDOFF. Wood is fetched far to near: `selectStops` picks the nearest pieces from where he stands (normally three, fewer when the errand needs fewer; the finder's walking cost, as `nearestBy` weighs it; at most SET_SPAN 45 m of walking beyond the nearest piece),
 *   `collect` fetches the farthest of them first, then the nearer, and chooses again only when a chosen piece is gone or cannot be had (fire stock, home materials, the wet reserve trips and the wet pieces of a shore stroll all use it). Wet wood for the tideline: up to CARRY_MAX (3, was two) per trip, fewer when fewer are in reach. (The drying
 *   pile of 0.30.4 to 0.30.12 is gone.) HANDOFF: before another task (drink, meal, bed, the fire, a nut, the morning at home, a stroll, an exploring walk) with wood in his arms he first lays it on the pile it belongs to (`handoff`: dry firewood on the fire's stock, wet wood at the tideline, building
 *   timber at the site; a full pile means a new one beside it, an unreachable one a spot of its own at camp, the last resort where he stands: nothing lost, one try, `campSpot`), unless the new task uses that wood. The two emergencies (thirst >= VERY_AT, hunger >= VERY_HUNGER_AT) go first with the wood in his arms; wood the game laid down for the drink is fetched afterwards (`fetchOwed`).
 *   `walk` has an option `settle` (seconds): a stop below the 0.12 m the movement takes for arrived can be overshot again and again, so the exact first-pile drop gives up the last centimetres after 4 s.
 * The other exception to staying on known ground (0.28, decided later the same day): SEARCH. Thirsty with no fresh water known, or hungry with no food known and none
 * carried, he walks out from home into the unknown, ring after ring, to the nearest unknown spot that borders what he knows (downhill for water, the low coast for
 * food before the inland), learning what he walks past (`input.learns` true; `mind.searching`), until water he can walk to over known ground, or food, is known; then he is back on known ground only (0.29: water that is known but out of reach does not end a search).
 * A higher need breaks into a lower goal (checked every CHECK seconds), except while an actual material errand is under way: it delivers first. Very thirsty or very hungry needs still break in; a goal keeps going otherwise and a failing one is left alone for a while (`cool`; 0.28.2: 10 to 40 s, a failed
 * light 100 s, or 300 s when one tuft of fibre is left; a failed try keeps the last tuft).
 * 0.30.14 "Torch": after dusk (isNight), standing beside a fire with flames (at least TORCH_FUEL of fuel), empty-handed, a trip of more than TORCH_TRIP (15 m) to drink, to bed or to look for food starts with a torch from the fire (`torchFor`: the player's action 'torch', the only time the torch is in `ALLOWED`); not in rain, not with wood in his arms (so never on a wood trip), not when the way leads through water deeper than DOUSE_DEPTH. On arrival it is stuck in the ground (the game does it for a drink and for sleep, `plantTorch` for food) and burns out there. No new text.
 * 0.30.9 "Errands": the small stock errand gets +HANDOFF_SECS once per goal and takes its wet load to the lean-to site while `wetForSite` holds (else, since 0.30.13, the tideline); the upgrade piles search the whole ring finely (`dest()` of `homeNeed`); a failed roast ends the eat goal as failed when hunger is too low for other food.
 * Standing points (0.30.3 "Routes"): every errand at a pile, a fire or a building site goes to a spot where the game really offers the action for that object (game/stand, `goStand`); none reachable is an honest false, no stall. 0.30.7: the walk to a standing point has `settle` (STAND_SETTLE 3 s): a step of a coarse tick is longer than the 0.12 m window the movement takes for arrived, so he could swing across the point for ever; after 3 s within 0.3 m the arrival test (the action is offered at his real place) decides. Frond and stone piles cannot be added to (wider than the join distance): their next pile is a pile of its own on the ring UP_AT round the lean-to. Stock for the next fire never feeds a burning fire.
 * Walking a path (0.30.3 "Routes"): `walk` is a thin wrapper over game/route, the one follower: it pulls the string over the next route points (he heads for the furthest of the next four he can see by the rule of game/walk),
 * closes a segment he made no progress on for 0.7 s and plans again (at most three times: then `stats.stuck` counts each such stall, an event 'stuck' names it, and the walk fails), and reports no way at all as `stats.nopath` and an event 'nopath'.
 * There are no bans and no hand steering. He walks; only very thirsty (thirst >= 0.95) and far (20 m or more) does he run.
 *
 * chooseGoal(s) -> 'drink' | 'eat' | 'sleep' | 'fire' | 'stores' | 'idle' | 'none'   pure; s: { asleep, time, thirst, hunger, awake, canLie, water, waterNear,
 *   shellsEmpty, shellsFull, nuts, fibre, torch, fireLit, fireFuel (0..1), stock (pieces' worth of wood in the biggest pile at the fire spot), spare (in the other piles there), cool: {name: true}, canLight }
 * fireStep(s) -> 'light' | 'feed' | 'gather' | null,  storesStep(s) -> 'husk' | 'wood' | null   pure; what the fire / stores goal does now (s.pileLogs: pieces in the biggest pile there)
 * exploreChance(s), exploreReach(day), exploreWhere(missing, trips), exploreLate(time, secs, speed?), crabDue(s)   pure (0.29.4; crabDue 0.30.16): whether, how far, where to and when to turn back, tested in tests/mind.test.js
 * journeyGap(r), journeyOk(s), journeyRain(weather, total), journeyBrake(s)   pure (0.30.19): the days to the next journey (5 to 7), whether one may start now, whether rain is forecast for it, whether it turns back (tested in tests/journey.test.js)
 * fishChance(s), fishFoodOk(s), spearMakeOk(s)   pure (0.30.17): the pastime's chance, may he fish for food, may he make the spear now (see above; tested in tests/spear.test.js)
 * crabTripOk(s), crabFoodOk(s)   pure (0.29.1): may he go for crabs now (s.sea, time, crabs carried, flames, canLight, fibre, pileDry, cool)
 * huskWanted(s), restSeconds(r1, r2), strollKind(avail, last, r), strollNow(s, r)   pure; the choices of the pastimes (0.28.2), tested in tests/mind.test.js
 * sitKind(s) -> 'gaze' | 'fire' | 'rest' | null   pure (0.29.2): whether he sits while he rests (s: time, long, fireNear, gazing)
 * DRY_AT, TIDE_LAND, TIDE_NEAR, TIDE_CAMP, TIDE_APART, TIDE_JOIN_MAX, TIDE_COST, STOCK_MAX_COST, TORCH_TRIP, TORCH_FUEL   (0.30.13 / 0.30.14) the numbers of the tideline and of the torch
 * axeNext(s) -> bool   pure (0.31): does the axe project have its turn now (s: day, time, done (the home is complete), builtDay, axeDay, thirst, hunger, cool)
 * homeNext(s) -> 'leanto' | 'walls' | 'ring' | 'bed' | null   pure (0.29.3): the next piece of his home now (s: day, time, fire (he has a camp), lean ('none' | 'half' | 'done' | 'other'), up {walls, ring, bed: 0..1}, builtDay, cool)
 * SET_SPAN, HANDOFF_SECS   (0.30.4) the reach of a set of pieces to fetch (m of walking beyond the nearest) and the time a goal gets on top of its limit for the handoff
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
 *   mind.stats        { goals: {name: n}, home, timber: { plans, replans, loads[0..3] (pieces in his arms after a fetch), wetLoads[0..3], handoffs, handoffPieces, fallbacks, far, skipped, owed, retrieved } (0.30.4), stuck, nopath, idleSecs, sitSecs (seconds he sat), sits: {gaze, fire, rest: how often he sat down}, lightRefused, gazes, strolls, strollKinds: {kind: n}, explores (trips made), exploreSecs, tide: { rounds, picked, laid, trips, noSpot, burned, wetBurned } (0.30.13: pieces taken from the strip, laid above the high-water line, trips, trips with no spot, rescued pieces later burned, and burned wetter than 0.5), torch: { taken } (0.30.14), crabTrips, crabDigs, crabTripDigsMax, crabsCaught, spearsMade, spearStuck, fishTrips, fishTries, fishTripTriesMax, fishCaught, fishEaten (0.30.17), events: [..] } for tests and the playtest bot (searches: how many searches he began)
 *   mind.journeying   true from the start of a journey until he is home again (0.30.19); mind.journeyLeg true while he walks one of its two legs (out, home) on the journey finder; mind.journey the state { phase, to, home, camp, ... } or null; mind.stats.journey { started, completed, nights, fires, cold, noTarget, back: {thirst, hunger, rain, nopath, late}, wood, husked, list: [per journey] }; mind.journeyAim(day, time, where?, avail?) the target a journey would aim for (tests)
 *   mind.chose()      true while a sleep he chose himself is being started (the tests tell it from a collapse); mind.lastKind() the kind of the last button he used; mind.path the path finder
 *   opts.stream       a number to vary the chance (default 0)
 *   opts.onIntent     optional presentation callback before a situation-led errand, once per thought kind per goal; it changes no game state or decisions (0.30.1)
 *   mind.home()       { kind: 'leanto' | 'fire' | 'bed' | 'here', x, z }
 *   mind.tideSpot()  the spot just above the high-water line where wet wood would be laid from where he stands now, { x, z, cost } or null (for the tests)
 *   mind.strollCands(centre?, range?)  { shore, river, palms, forest, crabs: [{x, z}] } the places a stroll may go to (all on known ground; for the tests)
 *   mind.homePlan()   { step (homeNext without the time window), need (what the next unit does: { kind, want } a trip for pieces of that kind, { build } the building, or null), site } for the tests
 *   mind.leantoSites(fire)  the places for the lean-to round a fire, best first: [{ x, z, heading, score, r, water, geo }]; mind.siteReason(c, fire, ignore?) -> null | 'ground' | 'footprint' | 'keep' | 'solid' | 'approach' | 'room' | 'route' (0.30.7: why a lean-to { x, z, heading } does not fit there; ignore: the piles the building consumes); mind.existingSite(fire) -> { ...siteFor, heading } | null; mind.stats.home { units, trips, builds, refused, noMaterial }
 *   mind.materialFind(kind, range?)  nearest eligible loose material or abandoned pile by path cost (test helper); mind.timberPlan(src, n, opts?)  the set `selectStops` would fetch now, farthest first (test helper)
 *
 * Everything he decides from comes from the game objects; the only chance is a PRNG seeded from the island (core/noise), so a run is repeatable.
 *
 * 0.30.10 "Walls": he is never boxed in by his own camp. Every pile he lays (through the game's lay, `wood.drop`), the pile places of the upgrades (`homeNeed`, a gap from every pile and fire place instead of the 1.5 m from other piles), the tideline spot (`tideSpot`) and the leftovers of a build keep CAMP_GAP of walking room from the other solids (game/obstacles `gapFree`), so no ring of solids can close round him. The two building piles stand PAIR_HALF (0.925) either side of the site, 1.85 m apart (were 1.3 to 1.4), and the second is laid from beside the first (`siteDest`), so the game puts it 1.85 to 2 m from it: the gap needs 1.8 m, the arc's build pair allows 2 m.
 *
 * Depends on: game/felled (treeId, treeInfo, trunkRadius ...), game/axe and game/logs (through game), game/path, game/route, game/stand (through game.stand), game/weather (through game.weather: the forecast and the rain of a journey), game/movement, game/clock (DAY_SECONDS), game/wildlife, game/crabs and game/spear (through game), game/fish (fishableAt, CARRY_FISH), game/water, game/wood (dryness, inStripY), game/fire (TORCH_DRY, BURN, DOUSE_DEPTH), game/leanto (siteFor, UPGRADES), game/shells, game/sleep (isNight), game/known (through game.known), world/constants, core/noise
 */
import { mulberry32, hashInt } from '../core/noise.js';
import { HALF, T, NT } from '../world/constants.js';
import { createPath } from './path.js';
import { createRoute } from './route.js';
import { canStand, terrainAt, obstaclesNear, PACE, WALK_SPEED, BODY } from './movement.js';
import { asCamp, segmentClear } from './walk.js';
import { leantoCircles, leantoPoint, LEANTO_BACK, LEANTO_SIDE, LEANTO_FRONT, PILE_R, CAMP_GAP, gapFree } from './obstacles.js';
import { DAY_SECONDS } from './clock.js';
import { freshWater } from './water.js';
import { dryness, logTop, kindOf, inStripY, CARRY_MAX, STONE_MAX, PILE_FRONT, pileSolidRadius } from './wood.js';
import { LISTS, treeId, sizeKind, trunkRadius, isGiant, treeInfo } from './felled.js';
import { FIRE_MIN, FUEL_MAX, TORCH_DRY, BURN, DOUSE_DEPTH } from './fire.js';
import { ringCentre, siteFor, keepFree, KEEP, UPGRADES, UP_NEAR, NEED, RING_AT, RING_R, paidSteps } from './leanto.js';
import { DAWN as SLEEP_DAWN, isNight } from './sleep.js';
import { seaLevel } from './tide.js';
import { EAT_AT } from './shells.js';
import { fishableAt, CARRY_FISH, FISH_DEPTH } from './fish.js';

export const THIRST_GO = 0.35, THIRST_TOPUP = 0.2, THIRST_SIP = 0.15, NEAR_WATER = 40;   // 0.29 "Daily bread": a drink every 8 hours or so (thirsty is 12), three or four times a day with the shells and the evening's
export const HUNGER_GO = 0.4, TIRED_GO = 1;   // a meal at hunger 0.4 (a coconut takes 0.5 off); a nap by day only when he has been awake a whole day
export const VERY_AT = 1, VERY_HUNGER_AT = 2;   // 0.29.8 "Errand": the half-day-before-collapse thirst and the two-day hunger emergency still interrupt an errand
export const BED_THIRST = 0.25, BED_HUNGER = 0.3, SUPPER_FROM = 0.64;   // from SUPPER_FROM to LIGHT_FROM (supper, a drink before the night) he goes for a need a little earlier, so that he does not wake parched or hungry and is free to light the fire
export const EVENING = 0.6, LIGHT_FROM = 0.74, BED_FROM = 0.87, DAWN = SLEEP_DAWN, DAY_FROM = 0.2, GAZE_FROM = 0.76, GAZE_TO = 0.83;
export const WOOD_WANT = 4, NUT_WANT = 2, FIBRE_WANT = 3, PILE_FULL = 12, FEED_BELOW = 0.25, LIGHT_MIN_FUEL = 3, IDLE_NEAR = 8;   // 0.28.2: stores up to a full pile (PILE_MAX of game/wood) and 3 tufts (FIBRE_MAX of game/fibre)
export const SEARCH_LIMIT = 900;   // seconds a goal may take while it is searching for water or food
export const REST_MIN = 3, REST_MAX = 8, REST_LONG_MIN = 15, REST_LONG_MAX = 30, REST_LONG_CHANCE = 0.2, CHECK = 1.5;   // 0.28.2: mostly a short rest, now and then a long one
export const STROLL_FROM = 0.19, STROLL_TO = 0.8, STROLL_CHANCE = 0.9, STROLL_LIMIT = 300, STROLL_RANGE = 80, STROLL_MAX_COST = 150;   // pastimes on known ground, by day (0.28.2)
export const BERRY_PICK = 0.2;   // 0.29.2: a stroll through the forest takes a handful from a bush that bears from this hunger (days; was EAT_AT, a third of a day): fewer strolls fit into a day at the amble, and the berries must not vanish from his meals
export const SIT_FIRE = 3.5, SIT_AT_FIRE = 1.8;   // 0.29.2 "Amble": he sits at a fire with flames within SIT_FIRE m; to sit by one he walks to SIT_AT_FIRE m from it
export const LINGER_MIN = 5, LINGER_MAX = 12, PAUSE_CHANCE = 0.45, PAUSE_MIN = 2, PAUSE_MAX = 6;
export const STROLL_KINDS = ['shore', 'river', 'palms', 'forest', 'crabs'], STROLL_WEIGHT = { shore: 3, river: 2, palms: 2, forest: 2, crabs: 12 };   // 0.29.1: crabs, only at low water in the afternoon, so when it is possible it is the usual choice (0.29.2: weight 12, was 6, and the window opens at 0.38, was 0.42: at the amble each stroll takes half as long again, so fewer fitted into the window)
export const CRAB_TIDE = -0.2, CRAB_FROM = 0.38, CRAB_TO = 0.66, CRAB_FOOD_TO = 0.8, CRAB_DIGS = 4, CRAB_WANT = 1, CRAB_ROAST_HUNGER = 0.2, CRAB_SEEK = 10, NUT_FAR = 50, CRAB_LIMIT = 420;   // 0.29.1 "Low water": crab trips
export const HOME_DAY = 2, HOME_FROM = 0.21, HOME_TO = 0.44, HOME_LIMIT = 480, HOME_MAX_COST = 50, HOME_ORDER = ['walls', 'ring', 'bed'];   // 0.29.3 "Homestead": he builds his home from day 2 (the third day), in the morning (0.29.4: until 0.44, was 0.38; a crab trip comes first), one piece a day
// 0.31 "Axe": once the home is complete (lean-to, walls, ring, bed) he makes ONE axe and then fells at most one tree a morning (the home's window): first every tree whose trunk stands within AXE_CLEAR_R of the lean-to's middle, nearest first, then, while fewer than AXE_LOGS logs are stored, the nearest trees just beyond it (up to AXE_OUT_R)
export const AXE_CLEAR_R = 10, AXE_OUT_R = 32, AXE_LOGS = 12, AXE_LIMIT = 540, AXE_RANGE = 60, AXE_FIBRE = 2, AXE_THIRST = 0.25, AXE_HUNGER = 0.3, AXE_RETRY_DAYS = 6, LOG_RING = [11.6, 12.1, 12.6];   // a tree he cannot reach is asked again after AXE_RETRY_DAYS; the log piles stand 11.6 to 12.6 m from the lean-to's middle
export const SITE_RINGS = [5, 6.2, 7.5], SITE_HIGH = 0.8, SITE_LEVEL = 0.3, SITE_SLOPE = 0.25;   // the lean-to's site: 4 to 7 m from the home fire, 0.8 m above the high-water line (the sea stands at 0 at high water), the footprint level within 0.3 m
// 0.29.4 "Wander": now and then, by day and when nothing presses, he goes exploring to the edge of what he knows, on his own terrace, and is home well before dark
export const EXPLORE_FROM = 0.2, EXPLORE_TO = 0.52, EXPLORE_BACK = 0.6, EXPLORE_MARGIN = 0.012, EXPLORE_DETOUR = 1.5, EXPLORE_SPARE = 45, EXPLORE_LIMIT = 900, EXPLORE_ROUTE = 0.12;   // starts between FROM and TO, is home by BACK (where the evening's chores begin), with a margin; ground with a climbing route of more than EXPLORE_ROUTE is closed
export const EXPLORE_THIRST = 0.25, EXPLORE_HUNGER = 0.3, EXPLORE_GAP = 2, EXPLORE_CHANCE = 0.3, EXPLORE_MISSING_CHANCE = 0.8, LACK_DAYS = 2;   // nothing urgent; every EXPLORE_GAP-th day, or every day when something is missing at home
export const EXPLORE_REACH0 = 80, EXPLORE_REACH_DAY = 15, EXPLORE_EDGE = 18, EXPLORE_SLOPE = 0.45;   // how far from home a trip may go: 80 m on the first day, 15 m more each day (0.30.16: no cap; the island's edge and the way home before dark are the limits)
export const EXPLORE_EARLY = SLEEP_DAWN + 0.01;   // 0.30.16 "Reach": a trip may start this early (just after dawn, instead of EXPLORE_FROM) when nothing at home is urgent: the home project has nothing to do today and no crab trip is possible or due (`calm`)
// 0.30.19 "Journey": every 5 to 7 days (from day 4), when calm, a journey of a night to a far spot; the way over climbing routes of slope under JOURNEY_SLOPE is open to it (and only to it)
export const JOURNEY_DAY = 4, JOURNEY_GAP_MIN = 5, JOURNEY_GAP_MAX = 7, JOURNEY_FROM = EXPLORE_EARLY, JOURNEY_TO = 0.4, JOURNEY_RAIN_UNTIL = 0.3;   // the first day, the days to the next, the morning window (it leaves at the latest at JOURNEY_TO), and how far into the next morning a shower forecast keeps him at home
export const JOURNEY_THIRST = EXPLORE_THIRST, JOURNEY_HUNGER = EXPLORE_HUNGER;   // calm at home: thirst under 0.25 and hunger under 0.3 (the exploring points)
export const JOURNEY_MIN = 160, JOURNEY_MAX = 420, JOURNEY_MIN_COST = 220, JOURNEY_REAL = 0.5, JOURNEY_ARRIVE = 0.62, JOURNEY_CAMP = 0.66, JOURNEY_SLOPE = 3.2, JOURNEY_SPARE = 60;   // the target lies 160 to 420 m from home and a way of at least 220 s by the planner (a day trip's way is under 175 s: well beyond it); he walks it at the amble and should be there by JOURNEY_ARRIVE (the planner's cost is about three times the real walk, measured: JOURNEY_REAL 0.5 of it is counted) and starts the camp at JOURNEY_CAMP at the latest; route cells up to slope 3.2 are walkable on a journey
export const JOURNEY_HIGH = 1.0, JOURNEY_RIM = 0.8, JOURNEY_BARE = 1.8, JOURNEY_WATER = 70, JOURNEY_WOOD = 5, JOURNEY_WOOD_COST = 120, JOURNEY_LIMIT = 1500, JOURNEY_START_NEAR = 90, JOURNEY_COOL = 90, JOURNEY_HURRY = 0.5;   // the camp: ground at least 1 m above the sea, no drop or rise of 0.8 m within 2 m, 1.8 m clear of any trunk or boulder, fresh water within 70 m preferred; fuel of 5 pieces of driftwood (a branch counts half), fetched from at most 120 s of the planner's walking away; the goal limit
// 0.30.13 "Tideline": wet wood from the strip between the tides is carried to a spot just above the high-water line (TIDE_LAND: ground height, TIDE_NEAR: metres from where he stands), at least TIDE_CAMP (11 m: it covers every place the lean-to's site, ring and upgrade piles may come, 6 m left lean-tos with no site on some islands) from the fire, the lean-to and its site, TIDE_APART from other piles (a driftwood pile of fewer than TIDE_JOIN_MAX may be joined), by a way of at most TIDE_COST seconds
export const DRY_AT = TORCH_DRY, TIDE_LAND = [0.15, 0.8], TIDE_NEAR = [2, 9], TIDE_CAMP = 11, TIDE_APART = 3, TIDE_JOIN_MAX = 9, TIDE_COST = 30, STOCK_MAX_COST = 90;   // DRY_AT: the dryness the fire and the torch ask for; STOCK_MAX_COST: the longest walk to a pile of his own wood he left behind (fetchOwed)
// 0.30.14 "Torch": after dusk a trip of more than TORCH_TRIP m from a fire with at least TORCH_FUEL (two pieces) of fuel takes a torch
// 0.30.13 (the round): once a day by day he walks to the nearest strip with wet wood he knows (a way of at most TIDE_ROUND_COST s, home before EXPLORE_BACK) and rescues one or two loads; a dry pile at a beach edge counts TIDE_BONUS times its walking cost when firewood is fetched
export const TIDE_ROUND_FROM = 0.22, TIDE_ROUND_TO = 0.5, TIDE_ROUND_CHANCE = 0.85, TIDE_ROUND_COST = 150, TIDE_ROUND_RANGE = 120, TIDE_BONUS = 0.7;
export const TORCH_TRIP = 15, TORCH_FUEL = 2 * BURN;
export const SET_SPAN = 45, HANDOFF_SECS = 150, HANDOFF_MAX_COST = 150;   // 0.30.4 "Timber": a set of pieces to fetch reaches at most SET_SPAN m of walking beyond the nearest; a goal gets HANDOFF_SECS more on top of its limit for bringing the wood in his arms to camp first, and a camp farther than HANDOFF_MAX_COST of walking is out of reach for it (the wood is laid down where he stands)   // 0.30.4 "Timber": the time a goal gets on top of its limit for bringing the wood in his arms to camp first
export const PAIR_HALF = 0.925;   // 0.30.10: the two building piles stand 1.85 m apart (their solids 0.55 m apart: the camp's spacing rule needs 0.5 (CAMP_GAP), the arc's build pair 2 m at most; it was 1.3 to 1.4)
export const UP_AT = 2.1;   // 0.30.3 rule (a): the piles of the upgrades lie this far from the lean-to's middle, beside its keep-free region (a pile's solid is 0.65) and within UP_NEAR (4, 0.30.10; the ring of piles of a kind searches UP_AT to UP_AT + 1.2)
// 0.30.17 "Spear": making the one spear (a branch and a stone at hand), fishing for food (flames burning) and as an afternoon pastime, the spear kept at the camp
export const SPEAR_DAY = 6, SPEAR_RANGE = 60, SPEAR_LIMIT = 300, FISH_FROM = 0.42, FISH_TO = 0.6, FISH_FOOD_TO = 0.8, FISH_IDLE_CHANCE = 0.5, FISH_THIRST = 0.3, FISH_HUNGER = 0.35, FISH_RANGE = 80, FISH_TRIES = 8, FISH_WANT = 1, FISH_LIMIT = 420, FISH_EXTRA = 20;   // FISH_EXTRA: seconds a fish costs on top of the walk when it is weighed against a nut (the tries and the roast)
export const RANK = { drink: 0, eat: 1, sleep: 2, fire: 3, stores: 4, idle: 5 };
const LIMIT = { drink: 160, eat: 220, sleep: 420, fire: 240, stores: 240, idle: 90 };   // seconds a goal may take before it is dropped
const COOL = { crabs: 240, drink: 20, eat: 30, sleep: 20, light: 100, gather: 30, husk: 40, fire: 10, stores: 10, home: 300, axe: 300, explore: 600, fish: 240, spear: 300, journey: 600 };   // seconds a failed goal is left alone (0.28.2: about a third of before; a failed light waits 3 times as long when only one tuft of fibre is left)
const ALLOWED = ['drink', 'fill', 'pickup', 'lay', 'feed', 'husk', 'berries', 'bananas', 'roast', 'dig', 'plant', 'light', 'build', 'upgrade', 'torch', 'makeSpear', 'takeSpear', 'laySpear', 'fish', 'makeAxe', 'takeAxe', 'layAxe', 'fell'];   // the kinds of the arc / ring he ever chooses (the torch only from a fire, `torchFor`, 0.30.14); build and upgrade only in the home project (0.29.3)

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

/** 0.31 "Axe": does the axe project have its turn now (pure)? His home is complete (s.done: lean-to, walls, ring and bed), the day is from HOME_DAY, it is the home's morning window (HOME_FROM to HOME_TO), no piece of the home was finished today and no unit of the axe's work was done today (one tree, one log, or the axe itself a day),
 *  nothing presses (thirst under AXE_THIRST, hunger under AXE_HUNGER) and it is not cooling. s: { day, time, done, builtDay, axeDay, thirst, hunger, cool }. */
export function axeNext(s) {
  if (!s.done || (s.cool && s.cool.axe) || !(s.time >= HOME_FROM && s.time < HOME_TO) || s.day < HOME_DAY || s.builtDay === s.day || s.axeDay === s.day) return false;
  return !(s.thirst >= AXE_THIRST || s.hunger >= AXE_HUNGER);
}

/** 0.29.4 "Wander": the chance, at an idle moment, that he sets out exploring now (pure). s: { time, day, thirst, hunger, last (the day of the last trip), missing (how many of wood, branches, nuts are short at home), cool, crab (a crab trip is possible now) }.
 *  Never when a need is coming up (thirst, hunger), a crab trip is on, or outside EXPLORE_FROM to EXPLORE_TO (0.30.16: from EXPLORE_EARLY when s.calm: nothing at home is urgent); at most one trip a day, one in EXPLORE_GAP days when nothing is missing, every day when something is. */
export function exploreChance(s) {
  if (!(s.time >= (s.calm ? EXPLORE_EARLY : EXPLORE_FROM) && s.time < EXPLORE_TO) || (s.cool && s.cool.explore) || s.crab) return 0;
  if (s.thirst >= EXPLORE_THIRST || s.hunger >= EXPLORE_HUNGER) return 0;
  if (s.day - s.last < (s.missing > 0 ? 1 : EXPLORE_GAP)) return 0;
  return s.missing > 0 ? EXPLORE_MISSING_CHANCE : EXPLORE_CHANCE;
}
/** How far from home a trip may go on this day (metres): grows a little each day. */
export function exploreReach(day) { return EXPLORE_REACH0 + EXPLORE_REACH_DAY * Math.max(0, day); }   // 0.30.16: no cap (it was 220 m)

/** 0.30.16 "Reach": is a crab trip due later today? (pure) Some moment of the crab window from now on (a quarter of an hour of game time apart) at which `crabTripOk` would say yes, with the sea as the tide will have it then. s: as for crabTripOk, with s.total (days since the start). */
export function crabDue(s) {
  for (let t = Math.max(s.time, CRAB_FROM); t < CRAB_TO; t += 0.02) if (crabTripOk({ ...s, time: t, sea: seaLevel(s.total - s.time + t) })) return true;
  return false;
}
/** 0.30.19 "Journey": the days from the start of one journey to the earliest start of the next: 5, 6 or 7 (r in [0, 1), the PRNG of the journeys). */
export function journeyGap(r) { return JOURNEY_GAP_MIN + Math.min(JOURNEY_GAP_MAX - JOURNEY_GAP_MIN, Math.floor(r * (JOURNEY_GAP_MAX - JOURNEY_GAP_MIN + 1))); }
/** 0.30.19: is rain forecast that would keep him at home (pure)? A shower under way now, or one that starts before the end of tonight and the next morning (JOURNEY_RAIN_UNTIL into the next day). `weather` is game/weather's; total the days on the clock. */
export function journeyRain(weather, total) { const n = weather.next(total); return !!n && n.start < Math.floor(total) + 1 + JOURNEY_RAIN_UNTIL; }
/** 0.30.19: may a journey start now (pure)? s: { day, time, due (the first day of the next journey), lean ('done' when his lean-to stands), raining (now), rainSoon (journeyRain), thirst, hunger, cool }.
 *  From day JOURNEY_DAY and `due`, in the morning (JOURNEY_FROM to JOURNEY_TO), the lean-to standing, no rain now or forecast, thirst under JOURNEY_THIRST and hunger under JOURNEY_HUNGER. */
export function journeyOk(s) {
  if (s.day < JOURNEY_DAY || s.day < s.due || s.lean !== 'done' || s.raining || s.rainSoon || (s.cool && s.cool.journey)) return false;
  return s.time >= JOURNEY_FROM && s.time < JOURNEY_TO && s.thirst < JOURNEY_THIRST && s.hunger < JOURNEY_HUNGER;
}
/** 0.30.19: does a journey turn back now (pure)? Very thirsty (VERY_AT), very hungry (VERY_HUNGER_AT) or rain falling. s: { thirst, hunger, raining }. */
export function journeyBrake(s) { return s.thirst >= VERY_AT || s.hunger >= VERY_HUNGER_AT || !!s.raining; }

/** Where he expects what is missing: 'coast' (driftwood and coconuts wash up and grow there) or 'forest' (branches, berries); nothing missing: the coast and the forest in turn (trips = trips so far). */
/** 0.30.17 "Spear": the chance, at an idle moment, that he goes fishing as a pastime now (pure). Only when a spear exists, nothing is carried to roast (a crab or a fish), in the afternoon (FISH_FROM to FISH_TO), once a day,
 *  with nothing urgent (thirst under FISH_THIRST, hunger under FISH_HUNGER: a little short of the points where he goes for a drink or a meal) and no crab trip possible now (the tide's crabs come first). The catch is roasted at the evening fire
 *  (a fish spoils in a day; the evening fire is lit on about nine evenings in ten, so no fire is asked for now).
 *  s: { time, day, last (the day of the last fishing), spear, crabs, fish, thirst, hunger, crab (a crab trip is possible now), cool } */
export function fishChance(s) {
  if (!s.spear || (s.crabs || 0) + (s.fish || 0) >= FISH_WANT || (s.cool && s.cool.fish) || s.day === s.last || s.crab) return 0;
  if (!(s.time >= FISH_FROM && s.time < FISH_TO) || s.thirst >= FISH_THIRST || s.hunger >= FISH_HUNGER) return 0;
  return FISH_IDLE_CHANCE;
}
/** 0.30.17: may he go fishing for food now (pure)? A spear exists, room for a fish, flames to roast it at, by day (DAY_FROM to FISH_FOOD_TO). */
export function fishFoodOk(s) { return !!s.spear && (s.fish || 0) < CARRY_FISH && !!s.flames && s.time >= DAY_FROM && s.time < FISH_FOOD_TO && !(s.cool && s.cool.fish); }
/** 0.30.17: does he go and make the spear now (pure)? He has none at all, it is day (DAY_FROM to EVENING), nothing urgent, and the home comes first: his lean-to stands (s.lean 'done'), or it is day SPEAR_DAY.
 *  (Measured: made on day 0 or 1 it takes one of the few branches near the camp that the lean-to needs and the lean-to came a day or three later in 6 of 24 lives; made after the lean-to, or from day 6, the lean-tos came as before.) */
export function spearMakeOk(s) { return !s.spear && s.time >= DAY_FROM && s.time < EVENING && s.thirst < EXPLORE_THIRST && s.hunger < EXPLORE_HUNGER && !(s.cool && s.cool.spear) && (s.lean === 'done' || s.day >= SPEAR_DAY); }

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
  const catchN = (s.crabs || 0) + (s.fish || 0);   // 0.30.17: a fish waits for the flames like a crab
  if (!cool.eat && (s.hunger >= (late && !catchN ? BED_HUNGER : HUNGER_GO) || (catchN > 0 && s.flames && s.hunger >= CRAB_ROAST_HUNGER))) return 'eat';   // 0.29.1: with a crab carried he waits for the fire's flames to have it for supper
  if (!cool.sleep && s.canLie && (t >= BED_FROM || t < DAWN || s.awake >= TIRED_GO)) return 'sleep';
  if (!cool.fire && !s.journey && fireStep({ ...s, cool })) return 'fire';   // 0.30.19: on a journey the home fire and the stores wait (the camp's fire is the journey's own)
  if (!cool.stores && !s.journey && storesStep({ ...s, cool })) return 'stores';
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
  const rng = mulberry32(hashInt(world.seed + 28, opts.stream || 0, 1)), rngEx = mulberry32(hashInt(world.seed + 29, opts.stream || 0, 2)), rngTide = mulberry32(hashInt(world.seed + 30, opts.stream || 0, 3)), rngFish = mulberry32(hashInt(world.seed + 31, opts.stream || 0, 4));   // exploring (0.29.4) draws from a stream of its own, so that the days without a trip stay as they were
  const rngJourney = mulberry32(hashInt(world.seed + 32, opts.stream || 0, 5));   // 0.30.19: the target's rings and the days to the next journey draw from a stream of their own
  // ground he may be taken over: known all round, MARGIN (1.5 m) inside the edge of what he knows, so that sliding past a trunk or a bush never carries him into a cell he has not been to
  const MARGIN = 1.5, DIAG = MARGIN * 0.75;
  const inside = (x, z) => known.hasAround(x, z, MARGIN, DIAG);   // the nine points: (x, z), MARGIN along the axes, DIAG on the diagonals (0.30.5 "Quicker": one lookup where they share a cell)
  const path = createPath(world, { allow: inside, allowVersion: () => known.count, obstacles: game.movement.obstacles }), pathFree = createPath(world, { obstacles: game.movement.obstacles });   // pathFree: only for a search for water or food (the one time he goes into unknown ground)
  const stats = { axe: { made: 0, madeDay: -1, trips: 0, felled: 0, inner: 0, outer: 0, palms: 0, giants: 0, logs: 0, laid: 0, skipped: 0, stuck: 0, fails: 0, felledDays: [], list: [] }, tide: { rounds: 0, picked: 0, laid: 0, trips: 0, noSpot: 0, burned: 0, wetBurned: 0 }, torch: { taken: 0 }, timber: { plans: 0, replans: 0, loads: [0, 0, 0, 0], wetLoads: [0, 0, 0, 0], handoffs: 0, handoffPieces: 0, fallbacks: 0, far: 0, skipped: 0, owed: 0, retrieved: 0 }, goals: {}, stuck: 0, nopath: 0, idleSecs: 0, lightRefused: 0, gazes: 0, sitSecs: 0, sits: {}, searches: 0, strolls: 0, strollKinds: {}, home: { units: 0, trips: 0, builds: 0, refused: 0, noMaterial: 0 }, explores: 0, exploreSecs: 0, crabTrips: 0, crabDigs: 0, crabTripDigsMax: 0, crabsCaught: 0, spearsMade: 0, spearStuck: 0, fishTrips: 0, fishTries: 0, fishTripTriesMax: 0, fishCaught: 0, fishEaten: 0, journey: { started: 0, completed: 0, nights: 0, fires: 0, cold: 0, noTarget: 0, back: { thirst: 0, hunger: 0, rain: 0, nopath: 0, late: 0 }, stranded: 0, wood: 0, husked: 0, list: [] }, events: [] };
  const mind = { input: null, active: false, get searching() { return inp.learns === true && !exploring; }, get exploring() { return exploring && !journeyLeg; }, get journeying() { return !!journey; }, get journeyLeg() { return journeyLeg; }, get journey() { return journey; }, goal: null, resting: false, stats, step, engage, release, home: homeSpot, get walking() { return !!inp.target; } };
  let journey = null, journeyLeg = false, journeyDue = JOURNEY_DAY, journeyTried = -9;   // 0.30.19: the journey in hand (it outlasts goals and sleep), the first day of the next one, the day a start was last tried
  let fishedDay = -9, exploring = false, exploredDay = -9, fullPace = false, now = 0, cur = null, restUntil = 0, restLong = false, anchor = { x: p.x, z: p.z }, slept = null, gazedDay = -1, chose = false, lastKind = null;
  let pressed = null, choice = null, sleepKey = false, sinceCheck = 0, builtDay = -1, headingWanted = null, errands = 0;   // headingWanted: the way a lean-to being started should face (a player turns the view)
  const proj = { site: null };   // 0.29.3: the lean-to's site, chosen once and kept
  const coolUntil = {}, bad = new Map();
  const inp = mind.input = {
    up: false, down: false, left: false, right: false, run: false, stick: null, target: null, yaw: undefined, learns: false, pace: 1, sit: false,
    takeWake: () => false, takeLight: () => false, pressing: () => false, cancelAction() { pressed = null; }, clearTarget() { inp.target = null; },
    takeAction: () => { const k = pressed; pressed = null; return k; }, takeChoice: () => { const k = choice; choice = null; return k; }, takeSleep: () => { const k = sleepKey; sleepKey = false; return k; },
  };
  const ev = (type, data) => { if (stats.events.length < (type.startsWith('home') || type.startsWith('axe') || type.startsWith('tide') || type.startsWith('journey') ? 900 : 400)) stats.events.push({ type, day: clock.day, time: +clock.time.toFixed(3), x: +p.x.toFixed(1), z: +p.z.toFixed(1), ...data }); };
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
      if (cost < Infinity && (!best || cost * (c.pile && kind === 'drift' ? TIDE_BONUS : 1) < best.cost)) best = { ...c, cost: cost * (c.pile && kind === 'drift' ? TIDE_BONUS : 1) }; else if (cost === Infinity) markBad(kind, c.o, 300);
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
  const firePiles = fs => W.piles.filter(q => (q.kind === 'driftwood' || q.kind === 'branch') && Math.hypot(q.x - fs.x, q.z - fs.z) <= 2.4);
  const bestPile = fs => firePiles(fs).sort((a, b) => fuelOfPile(b) - fuelOfPile(a))[0] || null;
  const fireAt = fs => game.fire.fires.find(f => dist(f, fs) < 3.5 && (f.fuel > 0.005 || f.embers > 0.005)) || null;
  const pileKind = kind => kind === 'drift' || kind === 'timber' ? 'driftwood' : kind;
  const ownPile = q => {
    const fs = fireSpot();
    return firePiles(fs).includes(q) || (proj.site && Math.hypot(q.x - proj.site.x, q.z - proj.site.z) <= 2.2)
      || game.leantos.list.some(l => Math.hypot(q.x - l.x, q.z - l.z) <= UP_NEAR)
      || (!!journey && !!journey.camp && Math.hypot(q.x - journey.camp.x, q.z - journey.camp.z) <= 2.6);   // 0.30.19: the camp's pile on a journey is not wood to fetch
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
      journey: !!journey, sea: game.sea, crabs: game.crabs.carried.length, fish: game.fish.carried.length, spear: game.spear.has(), flames: !!flameFire(),
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
    const tap = !!o.tap, stop = o.stop ?? 1.0, fd = o.finder || (o.free ? pathFree : exploring ? (journeyLeg ? pathJourney : pathExplore) : path);   // 0.30.5: on an exploring trip every walk (the pick-ups at the far end, a berry bush, a nut) uses the exploring finder, which keeps off climbing routes and steep ground
    let route = null, finalSet = false, last = now;
    const t0 = now;
    for (;;) {
      if (o.until && o.until()) { idleInput(); return true; }
      if (o.settle && now - t0 > o.settle && Math.hypot(x - p.x, z - p.z) <= 0.3) { idleInput(); return true; }   // 0.30.4: a stop under the 0.12 m the movement takes for arrived can be passed again and again (a step is longer): after o.settle seconds close is close enough
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
  const STOP = 0.12, STAND_SETTLE = 3;   // the follower ends within this of a standing point (moveIntent takes less than 0.12 m for arrived)
  // 0.30.3 "Routes": to a spot where the game really offers `kind` for `obj` (game/stand: a pile to take from, add to or light, a fire to feed, a site or lean-to to build or upgrade). True when he stands there and the
  // action is offered; false when there is no such spot he can reach (the caller marks the object bad and goes on). A world that changed on the way (the pile is gone, another pile now counts) is looked at once more.
  function* goStand(kind, obj, o = {}) {
    for (let tries = 0; tries < 2; tries++) {
      if (kind === 'take' || kind === 'add' || kind === 'light' ? !W.piles.includes(obj) : kind === 'feed' ? !game.fire.fires.includes(obj) : false) return false;
      if (stand.usable(kind, obj, p.x, p.z, o.free ? null : inside)) { idleInput(); return true; }
      const s = stand.plan(kind, obj, o.free ? pathFree : path, p, { allow: o.free ? null : inside });
      if (!s) { stats.noStand = (stats.noStand || 0) + 1; if (stats.noStand <= 30) ev('no-stand', { kind }); return false; }
      if (!(yield* walk(s.x, s.z, { stop: STOP, hurry: o.hurry, settle: STAND_SETTLE }))) return false;   // 0.30.7: a step of a coarse tick is longer than the 0.12 m window, so he can swing across the point for ever (seed 1337 fresh, ring fire, a crab to roast): after STAND_SETTLE s within 0.3 m the arrival test (`offered` at his real place) decides
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
        if (hop === 0) yield* torchFor(f, pathFree);
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
      yield* torchFor(best);
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
    let roastFailed = false;
    if (catchCarried() && game.hunger.days >= CRAB_ROAST_HUNGER && flameFire()) { if (yield* roastCatch()) return true; roastFailed = true; }   // 0.29.1: supper from the crab he dug, before any nut: a raw crab spoils
    if (game.hunger.days < (clock.time >= SUPPER_FROM && clock.time < LIGHT_FROM && !catchCarried() ? BED_HUNGER : HUNGER_GO)) return !roastFailed;   // 0.30.9: a failed roast at a hunger too low for other food ends the goal as failed (it cools), and does not start again at once
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
        if (catchCarried() && flameFire() && (yield* roastCatch())) return true;
        cs = foods();
      }
    }
    // 0.30.17: a fish, weighed by its walking cost (to the spear, if it lies at the camp, and on to the water) like the nuts and the berries; flames are burning to roast it at
    const fo = fishOption();
    if (fo) cs.push(fo);
    if (!cs.length) { if (yield* searchFor('food')) cs = foods(); }   // hungry, nothing carried and no food known: he goes looking
    if (!cs.length) { ev('no-food'); return false; }
    cs.sort((a, q) => a.w - q.w); let pick = cs[0];
    if (pick.kind === 'fish') {
      yield* fishTrip(pick.t);   // (the eat goal has said foodIntent)
      if (catchCarried() && flameFire() && (yield* roastCatch())) return true;
      cs = foods(); if (!cs.length) return false;   // no fish after all: the nuts and the berries
      cs.sort((a, q) => a.w - q.w); pick = cs[0];
    }
    const t = pick.t, want = pick.kind === 'coco' ? ['husk'] : pick.kind === 'berry' ? ['berries'] : ['bananas'];
    const near = () => { const a = game.action().tap; return !!a && want.includes(a.kind) && !!a.thing && Math.hypot((a.thing.x ?? t.x) - t.x, (a.thing.z ?? t.z) - t.z) < 3; };
    yield* torchFor(t);
    yield* walk(t.x, t.z, { tap: pick.kind === 'coco', stop: 0.4, until: near, hurry: hurry() });
    let k = pressKind(want); if (k) yield* waitIdle();
    if (!k) { yield* walk(t.x, t.z, { stop: 0.2 }); k = pressKind(want); if (k) yield* waitIdle(); }
    if (game.fire.torch) yield* plantTorch();   // 0.30.14: arrived: the torch stays here
    if (!k) { markBad(pick.kind, t.o, 600); ev('food-not-offered', { kind: pick.kind }); return false; }
    return true;
  }

  const catchCarried = () => game.crabs.carried.length + game.fish.carried.length;   // 0.30.17: what is carried raw and has to be roasted
  function* roastCatch() {   // to the fire with flames and the row's crab or fish (the one caught first, as the game's roast does): kneels ROAST_TIME and eats it
    const f = flameFire(); if (!f) return false;
    think('roastIntent');   // 0.30.20: the reason, before he goes to the fire
    if (!(yield* goStand('nearFire', f))) return false;
    const F = game.fish.carried, C = game.crabs.carried, kind = F.length && (!C.length || F[0] < C[0]) ? 'fish' : 'crab', n0 = F.length;
    if (useRow(kind)) { yield* waitIdle(); if (kind === 'fish' && game.fish.carried.length < n0) stats.fishEaten++; return true; }
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

  // ---------- the spear and fishing (0.30.17 "Spear") ----------
  // One spear, made once (`makeSpearTrip`: a loose branch and a loose stone on known ground), kept lying at the camp (`spearSpot`: beside the lean-to, or round the fire when there is no lean-to, where a body keeps CAMP_GAP from every solid, clear of the lean-to's
  // keep-free region) and fetched only to fish (`fetchSpear`); afterwards he lays it back there (`returnSpear`) before he takes up wood (every goal but eat begins with it, `withHandoff`). Fishing (`fishTrip`) is the player's own action in shallow sea water (game/fish
  // `fishableAt`): up to FISH_TRIES tries, until FISH_WANT fish is carried. A fish is roasted like a crab.
  const S = game.spear, A = game.axe, LOGS = game.logs, FELLED = game.felled, offered = kind => { const a = game.action(); return [a.tap, ...a.options].some(o => o && o.kind === kind); };
  const campView = game.movement.obstacles.camp;
  let spearHome = null;
  const spearOk = (x, z) => !!openNear(x, z, 0) && gapFree(campView, x, z, BODY) && !game.leantos.list.some(l => keepFree(l).touches(x, z, BODY));
  function spearSpot() {   // where the spear lies at camp: the last spot while it is still good, else the nearest good one to the fire spot round the lean-to (or the fire)
    if (spearHome && spearOk(spearHome.x, spearHome.z)) return spearHome;
    const h = homeSpot(), fs = fireSpot(h), centre = h.kind === 'leanto' ? h.lt : h, cands = [];
    for (const r of h.kind === 'leanto' ? [3.2, 4, 4.8] : [2.6, 3.4, 4.2]) for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; cands.push({ x: centre.x + Math.sin(a) * r, z: centre.z + Math.cos(a) * r }); }
    cands.sort((a, b) => dist(a, fs) - dist(b, fs));
    spearHome = cands.find(q => spearOk(q.x, q.z)) || null;
    return spearHome;
  }
  function* fetchSpear() {   // the spear into his hand, from where it lies
    if (S.hand) return true;
    if (!S.at || W.load() || game.fire.torch) return false;
    const q = { x: S.at.x, z: S.at.z };
    yield* walk(q.x, q.z, { stop: 0.3, until: () => offered('takeSpear') });
    if (!S.hand) { if (!offered('takeSpear')) yield* walk(q.x, q.z, { stop: 0.1 }); if (pressKind(['takeSpear'])) yield* waitIdle(); }
    return S.hand;
  }
  function* returnSpear() {   // lays the spear down at its place at camp (the one thing he does with it besides fishing)
    if (!S.hand) return true;
    const q = spearSpot();
    if (q && (yield* walk(q.x, q.z, { stop: 0.15, settle: 3 })) && pressKind(['laySpear'])) yield* waitIdle();
    if (S.hand) { const o = standNear(p.x, p.z, 4); if (o) yield* walk(o.x, o.z, { stop: 0.3 }); if (pressKind(['laySpear'])) yield* waitIdle(); }   // no way to the camp: where he can
    if (S.hand) { stats.spearStuck++; ev('spear-stuck'); }
    return !S.hand;
  }
  let fishMemo = null;
  function fishSpots() {   // the places he knows in shallow sea water (the sea as it is now) within FISH_RANGE of home; looked at again when he knows more, the tide has moved or 20 s have passed
    const key = known.count + ':' + Math.round(game.sea * 40) + ':' + Math.floor(now / 20);
    if (fishMemo && fishMemo.key === key) return fishMemo.list;
    const h = homeSpot(), list = [];
    for (let r = 4; r <= FISH_RANGE; r += 2) for (let i = 0; i < 36; i++) {
      const a = (i + (r / 2 % 2) * 0.5) * Math.PI / 18, x = h.x + Math.sin(a) * r, z = h.z + Math.cos(a) * r;
      if (!(Math.abs(x) < HALF - 8 && Math.abs(z) < HALF - 8)) continue;
      const t = terrainAt(world, x, z, game.sea);
      if (fishableAt(t) && t.depth >= FISH_DEPTH[0] + 0.04 && t.depth <= FISH_DEPTH[1] - 0.04 && inside(x, z) && canStand(world, x, z, game.sea)) list.push({ x, z });   // the middle of the band: a step either way is still shallows
    }
    fishMemo = { key, list }; return list;
  }
  function bestFishSpot(maxCost) {   // the cheapest of the nearest few: { x, z, cost } where cost is the walk from here, by the spear when it lies at the camp
    const from = S.hand ? p : S.at; if (!from) return null;
    const first = S.hand ? 0 : path.cost(p, from); if (!(first < Infinity)) return null;
    let best = null;
    for (const c of fishSpots().map(q => ({ ...q, d: dist(q, from) })).sort((a, b) => a.d - b.d).slice(0, 5)) {
      const cost = first + path.cost(from, c);
      if (cost < maxCost && (!best || cost < best.cost)) best = { x: c.x, z: c.z, cost };
    }
    return best;
  }
  function fishOption() {   // fish as a food: its walking cost (the spear, the water, back to the flames) and FISH_EXTRA for the tries and the roast
    const s = senses(); if (!fishFoodOk(s)) return null;
    const f = flameFire(), o = f ? bestFishSpot(STROLL_MAX_COST) : null;
    return o ? { kind: 'fish', t: o, w: o.cost + dist(o, f) * 1.3 / WALK_SPEED + FISH_EXTRA } : null;
  }
  function* fishTrip(c, pastime = false) {   // the spear from the camp, into the shallows, up to FISH_TRIES tries until FISH_WANT fish is carried, the spear back at the camp
    return yield* errand(function* () {
    if (cur) cur.limit = FISH_LIMIT;
    if (pastime) think('fishIntent');   // 0.30.20: the afternoon pastime says why; a fish for the meal is the eat goal's foodIntent
    if (W.load()) yield* handoff('fish');
    if (!S.hand && !(yield* fetchSpear())) { cool('fish'); return false; }
    stats.fishTrips++; ev('fish-trip', { to: [+c.x.toFixed(1), +c.z.toFixed(1)] });
    const got0 = game.fish.carried.length; let tries = 0;
    try {
      yield* walk(c.x, c.z, { stop: 0.3, until: () => offered('fish') });
      if (!offered('fish')) yield* walk(c.x, c.z, { stop: 0.1, until: () => offered('fish'), settle: 3 });   // the follower stops a little short of a point on a shore: the last step in
      if (!offered('fish')) { const o = bestFishSpot(STROLL_MAX_COST); if (o) yield* walk(o.x, o.z, { stop: 0.3, until: () => offered('fish') }); }   // the tide has moved the shallows: once more
      while (tries < FISH_TRIES && game.fish.carried.length - got0 < FISH_WANT && offered('fish')) {
        if (!pressKind(['fish'])) break;
        tries++; stats.fishTries++; yield* waitIdle(); yield;
      }
    } finally { idleInput(); }
    stats.fishTripTriesMax = Math.max(stats.fishTripTriesMax, tries);
    const caught = game.fish.carried.length - got0; stats.fishCaught += Math.max(0, caught);
    ev('fish-trip-end', { tries, caught });
    if (caught <= 0) cool('fish');
    yield* returnSpear();
    return true;
    });
  }
  function* makeSpearTrip() {   // a loose branch under his arm, to a loose stone, kneel: the spear is made; it goes to the camp
    return yield* errand(function* () {
    if (cur) cur.limit = SPEAR_LIMIT;
    think('spearIntent');   // 0.30.20: the reason, once, before he sets off
    const cost = list => { for (const c of list.slice(0, 3)) { const k = path.cost(p, c); if (k < Infinity) return { ...c, cost: k }; } return null; };
    const b = cost(scan('branch', p.x, p.z, SPEAR_RANGE)), st = b ? cost(scan('stone', b.x, b.z, SPEAR_RANGE)) : null;
    if (!b || !st) { cool('spear'); return false; }
    ev('spear-trip', { branch: [+b.x.toFixed(1), +b.z.toFixed(1)], stone: [+st.x.toFixed(1), +st.z.toFixed(1)] });
    const pickOffered = () => { const a = game.action().tap; return !!a && a.kind === 'pickup' && !!a.thing && a.thing.kind === 'log' && !!a.thing.log.branch && Math.hypot(a.thing.x - b.x, a.thing.z - b.z) < 1.5; };
    yield* walk(b.x, b.z, { tap: true, stop: 0.4, until: pickOffered });
    let k = pressKind(['pickup']); if (k) yield* waitIdle();
    if (!W.carried.some(l => l.branch) || W.load() !== 1) { markBad('branch', b.o, 600); cool('spear'); return false; }
    yield* walk(st.x, st.z, { tap: true, stop: 0.4, until: () => offered('makeSpear') });
    if (!offered('makeSpear')) yield* walk(st.x, st.z, { stop: 0.2 });
    k = pressKind(['makeSpear']); if (k) yield* waitIdle();
    if (!S.has()) { markBad('stone', st.o, 600); cool('spear'); return false; }
    stats.spearsMade++; ev('spear-made');
    yield* returnSpear();
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

  const carriedKind = () => W.log && !W.carried.length && !W.stones.length ? 'log' : W.carried.length ? (W.carried[0].branch ? 'branch' : W.carried[0].frond ? 'frond' : 'drift') : (W.stones.length ? 'stone' : null);
  function* layDown() { for (let n = 0; n < 3 && (W.carried.length || W.stones.length || W.log); n++) { if (!pressKind(['feed', 'lay'])) break; yield* waitIdle(); } }
  function* toDest(d) {   // to where wood is laid down: beside the pile that is to take it (a spot where the game's lay joins that very pile), at a fire (where it is fed), else to the point itself (a new pile there)
    if (d.pile && W.piles.includes(d.pile) && (d.pile.kind === 'driftwood' || d.pile.kind === 'branch') && (yield* goStand('add', d.pile))) return true;   // (a frond or stone pile is wider than the join distance: none to be had from outside, then a pile of its own beside it)
    const f = game.fire.fires.find(q => dist(q, d) < 1.2);
    if (f && !d.exact) return (yield* goStand('feed', f)) || (yield* goStand('nearFire', f));
    if (d.exact) return true;   // layAt walks the exact approach itself
    const q = openNear(d.x, d.z, 1.5);
    return q ? yield* walk(q.x, q.z, { stop: 0.35 }) : false;
  }
  function* layAt(d) {   // lays what he carries down at d; when something else within reach takes the place of 'lay' in the arc, he steps aside and tries again
    const alive = d.stock ? game.fire.fires.find(q => dist(q, d) < 1.5) : null;
    if (alive && W.load()) {   // stock for tomorrow's fire never feeds a fire that still burns (by day he feeds embers only in passing): a pile of its own 2 m from it, on his side
      const a = Math.atan2(p.x - alive.x, p.z - alive.z);
      for (const da of [0, 0.5, -0.5, 1, -1, 1.5, -1.5]) {
        const q = openNear(alive.x + Math.sin(a + da) * 2, alive.z + Math.cos(a + da) * 2, 0.5);
        if (q && Math.hypot(q.x - alive.x, q.z - alive.z) >= 1.7 && (yield* walk(q.x, q.z, { stop: 0.3 }))) { for (let n = 0; n < 3 && W.load(); n++) { if (!pressKind(['lay'])) break; yield* waitIdle(); } break; }
      }
      if (!W.load()) return;
    }
    if (d.exact && W.load()) {
      const at = exactPileDrop(p, d);
      if (yield* walk(at.x, at.z, { stop: 0.08, settle: 4 })) { p.heading = at.heading; yield* layDown(); }
      if (!W.load()) return;
    }
    for (let tries = 0; tries < 3 && W.load(); tries++) {
      yield* layDown();
      if (!W.load()) break;
      if (d.pile && W.piles.includes(d.pile) && tries < 2 && (yield* goStand('add', d.pile))) continue;   // the pile is still there: a spot where the lay joins it
      const a = tries * 2.1 + 0.5, q = openNear(d.x + Math.sin(a) * 1.3, d.z + Math.cos(a) * 1.3, 0.5); if (q) yield* walk(q.x, q.z, { stop: 0.3 });
    }
  }
  // ---------- timber (0.30.4): from far to near, and the load goes to camp before anything else ----------
  // The nearest suitable pieces from where he stands (normally three; walking cost, as `nearestBy` weighs it) are the ones he fetches; the farthest of them first, then the nearer, and that order is kept: the set is chosen again only when a chosen
  // piece is gone or cannot be reached. A pile counts as the pieces it would give (its top ones, at most what he can carry).
  function selectStops(src, n, { r0 = 45, rMax = 200, maxCost = Infinity, k = 6 } = {}) {
    const cap = src === 'stone' ? STONE_MAX : CARRY_MAX;
    let set = [];
    for (let r = r0; r <= rMax; r *= 2.5) {
      const priced = [];
      for (const c of [...scan(src, p.x, p.z, r).slice(0, k), ...pileFinds(src, p.x, p.z, r).sort((a, b) => a.d - b.d).slice(0, k)]) {
        const cost = path.cost(p, c);
        if (cost === Infinity) { markBad(src, c.o, 300); continue; }
        const w = cost * (c.pile && src === 'drift' ? TIDE_BONUS : 1);   // 0.30.13: a dry pile at a beach edge counts less
        if (c.pile && W.load()) continue;   // with wood in his arm a pile is laid on, not taken from (the game offers no pickup): a pile is only a stop with empty arms
        if (w <= maxCost) priced.push({ ...c, cost: w, count: c.pile ? Math.min(c.pile.logs.length, cap) : 1 });
      }
      priced.sort((a, b) => a.cost - b.cost);
      set = []; let have = 0;
      if (priced.length && priced[0].pile) priced.length = 1;   // a pile first: it is the whole stop (taking it fills his arm; the next plan is made with what is then in it)
      else for (let i = priced.length - 1; i >= 0; i--) if (priced[i].pile) priced.splice(i, 1);   // a pile can only be taken with empty arms, so never after a loose piece
      for (const c of priced) { if (have >= n || c.cost > priced[0].cost + SET_SPAN) break; set.push(c); have += c.count; }   // (a piece more than SET_SPAN of walking farther than the nearest is not part of the set: the far-first leg stays short)
      if (have >= n || set.length) break;
    }
    return set;
  }
  const stillThere = (src, e) => (e.pile ? pileFinds(src, e.x, e.z, 0.5) : scan(src, e.x, e.z, 3)).some(c => c.o === e.o);   // (3 m: a piece lies in the tile of its own place or, near the edge, a neighbour)
  // fetches `o.goal` pieces as `o.have()` counts them: o { goal, have, wanted(stop) -> (arc option -> bool), good?(fresh) -> bool, onPick?(fresh), maxCost?, r0?, rMax?, think? }
  function* collect(src, o) {
    return yield* collectIn(src, o);
  }
  function* collectIn(src, o) {
    const ordered = src !== 'frond' && src !== 'stone';
    let plan = [], fails = 0, picked = 0, again = false;   // again: the plan was thrown away (a piece gone, or not to be had) and chosen anew
    while (o.have() < o.goal && fails < 6) {
      if (!plan.length) {
        plan = selectStops(src, o.goal - o.have(), o);
        if (!plan.length) break;
        stats.timber.plans++; if (again) stats.timber.replans++; again = false;
        if (ordered) plan.reverse();   // the farthest of the chosen pieces first
        ev('collect', { again, have: o.have(), goal: o.goal, src, ids: plan.map(e => e.pile ? 'pile' : e.id), costs: plan.map(e => +e.cost.toFixed(1)) });
      }
      const t = plan[0];
      if (!stillThere(src, t)) { plan = []; fails++; again = true; continue; }
      if (o.think) think(o.think);
      const before = new Set([...W.carried, ...W.stones].map(l => l.id)), had = o.have(), wanted = o.wanted(t);
      const arm = () => { if (o.tag) setTag(o.tag, o.dest); };   // just before the press: the piece that may come into his arms any moment is for this
      let k = null;
      if (t.pile) { if (yield* goStand('take', t.pile)) { arm(); k = pressKind(['pickup'], wanted); if (k) yield* waitIdle(); } }   // 0.30.3: a pile is taken from where the arc really offers it for that pile
      else {
        const near = () => { const a = game.action().tap; return !!a && a.kind === 'pickup' && wanted(a) && Math.hypot(a.thing.x - t.x, a.thing.z - t.z) < 1.5; };
        yield* walk(t.x, t.z, { tap: true, stop: 0.4, until: near });
        arm(); k = pressKind(['pickup'], wanted); if (k) yield* waitIdle();
        if (!k) { yield* walk(t.x, t.z, { stop: 0.2 }); arm(); k = pressKind(['pickup'], wanted); if (k) yield* waitIdle(); }
      }
      yield;
      const fresh = [...W.carried, ...W.stones].filter(l => !before.has(l.id));
      if (o.have() > had) {
        picked += o.have() - had;
        if (o.tag) setTag(o.tag, o.dest);
        if (o.onPick) o.onPick(fresh);
        if (o.good && !o.good(fresh)) { markBad(src, t.o, 600); break; }
        const got = new Set(fresh.map(l => l.id));   // what he really took: the stop itself, or a piece beside it that the arc offered first (that one is then no longer to be fetched, and the chosen stop stays in the plan)
        plan = plan.filter(e => !(e.pile ? e === t : got.has(e.id)));
        if (!plan.every(e => stillThere(src, e))) { plan = []; again = true; }   // one of the chosen is gone: the rest is chosen again from here
      } else { markBad(src, t.o, 600); plan = []; fails++; again = true; }
    }
    if (picked) { const n = Math.min(3, W.carried.length); if (src === 'strip') stats.timber.wetLoads[n]++; else stats.timber.loads[n]++; }
    return picked;
  }
  let tag = null, owed = null;   // tag: where the load in his arms is for ({ kind: 'fire' | 'home' | 'tide', dest, ids }); owed: wood an emergency made him lay down away from camp ({ ids, t })
  const TAG_SECS = 8;   // a pickup is under way (or just made) this long: the piece that comes into his arms is for the tag's purpose though it is not noted yet
  const validTag = () => {
    const all = [...W.carried, ...W.stones];
    if (!tag || !all.length) return null;
    if (now < tag.until) for (const l of all) tag.ids.add(l.id);
    return all.every(l => tag.ids.has(l.id)) ? tag : null;
  };
  const setTag = (kind, dest = null) => { tag = { kind, dest, until: now + TAG_SECS, ids: new Set([...W.carried, ...W.stones].map(l => l.id)) }; };
  // fetch up to three pieces of one kind (stones: two) and bring them to dest (fire: feed it first, then lay down); maxCost: only pieces within that walk (0.29.3, the home project); tagKind: 'fire' or 'home' (what the load is for)
  function* gather(kind, dest, want, maxCost = Infinity, src = kind, tagKind = 'fire') {
    return yield* errand(function* () {
    const cap = kind === 'stone' ? STONE_MAX : CARRY_MAX, pk = kind === 'drift' ? 'driftwood' : kind, mine = () => kind === 'stone' ? W.stones.length : W.carried.filter(l => kindOf(l) === pk).length;   // mine: pieces of the wanted kind in his arms (another piece lying close by may be the one the ring offers)
    const ck = carriedKind();
    if (ck && (ck !== kind || (kind === 'drift' && src !== 'timber' && wetCarried()))) yield* handoff('gather');   // 0.30.4: another kind (or wet wood for the fire's stock) goes to its own pile first
    yield* collect(src, {
      goal: Math.min(cap, want), have: mine, maxCost, think: kind === 'drift' || kind === 'branch' ? (tagKind === 'home' ? 'homeWoodIntent' : 'woodIntent') : null,
      wanted: t => o => !!o.thing && (t.pile ? o.thing.kind === 'pile' && o.thing.pile === t.pile : o.thing.kind === 'log' && kindOf(o.thing.log) === pk),
      tag: tagKind, dest,
    });
    if (!W.load()) return false;
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
  function fireStockDest(fs) {   // one actual dry-driftwood destination: its pile, or an exact first-pile drop at the fire; never a second build-sized kind
    const drift = firePiles(fs).filter(q => q.kind === 'driftwood'), pile = drift.filter(q => q.logs.length < PILE_FULL).sort((a, b) => b.logs.length - a.logs.length)[0];
    if (pile) return { x: pile.x, z: pile.z, pile, room: pairNear(fs, 'driftwood') ? Math.max(0, NEED - 1 - pile.logs.length) : PILE_FULL - pile.logs.length };
    if (drift.length || pairNear(fs, 'driftwood')) return null;
    return { ...fs, exact: true, stock: true, pile: null, room: PILE_FULL };
  }
  function* gatherWood() {
    const h = homeSpot(), fs = fireSpot(h), best = bestPile(fs), st = best ? fuelOfPile(best) : 0;
    const topUp = !!best && st >= WOOD_WANT;   // the evening's wood is there: only fill the pile up, and only with its own kind (two piles of 6 or more would make the arc offer to build)
    const order = best && best.kind === 'branch' ? ['branch', 'drift'] : ['drift', 'branch'];
    if (wetCarried()) yield* layTideline(true);   // wet wood from a stroll is not the fire's
    for (const kind of topUp ? order.slice(0, 1) : order) {
      const pk = kind === 'branch' ? 'branch' : 'driftwood', mine = firePiles(fs).filter(x => x.kind === pk).sort((a, b) => b.logs.length - a.logs.length)[0];
      let want = topUp ? Math.max(1, PILE_FULL - best.logs.length) : Math.max(1, Math.ceil((WOOD_WANT - st) / (kind === 'branch' ? 0.5 : 1)));
      if (pairNear(fs, pk)) { want = Math.min(want, NEED - 1 - (mine ? mine.logs.length : 0)); if (want < 1) continue; }   // 0.29.3: the other kind is already 6 or more: this pile stays below 6, else the arc offers to build and not to light
      const dest = () => {
        const q = firePiles(fs).filter(x => x.kind === pk && x.logs.length < 12).sort((a, b) => b.logs.length - a.logs.length)[0];
        if (q) return { x: q.x, z: q.z, pile: q, room: PILE_FULL - q.logs.length };
        return h.kind === 'leanto' && h.lt && game.leantos.has(h.lt, 'ring') ? { ...fs, exact: true, pile: null, room: PILE_FULL } : { ...fs, pile: null, room: PILE_FULL };
      };
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
    const logs0 = pile.logs.slice();
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
    if (fireAt(fs)) burnedLogs(logs0);
    return !!fireAt(fs);
  }

  function* feedFire() {   // from a pile at home (or what is carried): lay dry wood on the fire until it is full
    const fs = fireSpot(), f = fireAt(fs); if (!f) return false;
    if (wetCarried()) yield* layTideline(true);   // wet wood from a stroll is not the fire's
    if (!W.load()) {
      const pile = [...pilesNear('driftwood', fs.x, fs.z, 8), ...pilesNear('branch', fs.x, fs.z, 8)].filter(q => q.logs.length && !isBad('feedpile', q)).sort((a, b) => dist(a, f) - dist(b, f))[0];
      if (!pile) return false;
      think('fireLow');
      if (yield* goStand('take', pile)) { if (pressKind(['pickup'], o => !!o.thing && o.thing.kind === 'pile' && o.thing.pile === pile)) yield* waitIdle(); } else { markBad('feedpile', pile, 120); return false; }
    }
    think('fireLow');
    if (!(yield* goStand('feed', f))) { yield* layDown(); return false; }   // 0.30.3: where the arc really feeds THIS fire
    const fed0 = W.carried.slice();
    for (let i = 0; i < 4; i++) { if (!pressKind(['feed'])) break; yield* waitIdle(); }
    burnedLogs(fed0.filter(l => !W.carried.includes(l)));
    yield* layDown();
    return true;
  }

  function ringSpot(s, ang, r) {   // 0.30.21: a spot on the ring round the bed for a refused sleep: the first of four angles on ordinary ground (no climbing route: sleep is refused there), else the plain one as before
    let first = null;
    for (let k = 0; k < 4; k++) { const a = ang + k * Math.PI / 2, q = standNear(s.x + Math.sin(a) * r, s.z + Math.cos(a) * r); if (k === 0) first = q; if (q && ordinary(q.x, q.z)) return q; }
    return first;
  }

  function* sleepGoal() {
    const s = journey ? journeyBed() : sleepSpot();   // 0.30.19: on a journey he sleeps at the camp
    yield* torchFor(s);
    const ok = yield* walk(s.x, s.z, { stop: 0.5 });
    if (!ok && dist(p, s) > 6) return false;
    for (let i = 0; i < 3; i++) {
      if (!game.sleep.canLie(clock.time)) return false;
      chose = true; sleepKey = true; yield; yield;
      if (game.sleep.asleep || p.lie > 0) return true;
      chose = false; const ang = i * 2.1 + 0.5, s2 = ringSpot(s, ang, 1 + i); if (s2) yield* walk(s2.x, s2.z, { stop: 0.3 });
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
  // ---------- the lean-to's site (0.30.7 "Clearing") ----------
  // A site is a lean-to { x, z, heading } checked as the real one: its collision circles (game/obstacles `leantoCircles`, the very ones `campSolids` gives the built lean-to) and its keep-free region (game/leanto `keepFree`) must not touch a trunk, boulder or crag nor a solid of the camp, and no drying pile lies within DRY_PAIR of a place for a building pile (the piles that are
  // to be consumed by the building are left out); the ground rules hold on a grid of about SITE_CELL over the lean-to's own footprint (the walls' area), and the rest of the keep-free region is standable and out of the river (not a few sample points); a straight line S (the sleep point) - G (the gate) - F (in front) - the ring spot is walkable with the lean-to's own solids in place;
  // the ring spot and the three places of the upgrade piles have room (and, for a pile, a standing spot); and a way leads from the fire to the ring spot and to those standing spots. `siteGeometry` is pure geometry, `siteRoutes` asks the path finder.
  const SITE_CELL = 0.3, SITE_REACH = 4.5, PILE_CORE = 0.45;
  const axis = (lo, hi, step) => { const n = Math.max(1, Math.ceil((hi - lo) / step)); return Array.from({ length: n + 1 }, (_, i) => lo + (hi - lo) * i / n); };
  const SITE_DENSE = []; for (const f of axis(KEEP.back, KEEP.apron, SITE_CELL)) for (const r of axis(-KEEP.side, KEEP.side, SITE_CELL)) if (f <= KEEP.front || Math.abs(r) <= KEEP.apronSide) SITE_DENSE.push([f, r]);   // (f along the opening, r across; the footprint and then the narrower apron)
  const naturalNear = (x, z) => {   // the trunks, boulders and crags within SITE_REACH of a point (each once)
    const seen = new Set();
    for (let dx = -3; dx <= 3; dx += 3) for (let dz = -3; dz <= 3; dz += 3) for (const o of obstaclesNear(world, x + dx, z + dz)) if (Math.hypot(o.x - x, o.z - z) < SITE_REACH + o.r) seen.add(o);
    return [...seen];
  };
  const groundOk = (x, z, y0) => {   // the ground rules at one point: known, standable, not in a river, 1.5 m dry of it, SITE_HIGH above the high-water line, level with the middle within SITE_LEVEL
    if (!inside(x, z) || !canStand(world, x, z, 0)) return false;
    const t = terrainAt(world, x, z, 0);
    return !t.inRiver && world.dryOfRiver(x, z, 1.5) && t.y >= SITE_HIGH && Math.abs(t.y - y0) <= SITE_LEVEL;
  };
  function siteGeometry(c, ignore = []) {   // c: { x, z, heading }; ignore: piles that the building will consume. -> the reason it does not fit (a string), or { R, F, stands, rise }
    const l = { x: c.x, z: c.z, heading: c.heading }, keep = keepFree(l), pt = (f, r) => leantoPoint(l, f, r), y0 = world.H(l.x, l.z);
    if (!inside(l.x, l.z) || terrainAt(world, l.x, l.z, 0).s >= SITE_SLOPE) return 'ground';
    const nat = naturalNear(l.x, l.z), hyp = leantoCircles(l);
    const cc = game.movement.obstacles.camp.near(l.x, l.z, SITE_REACH).filter(o => !(o.g.kind === 'pile' && ignore.some(q => Math.abs(q.x - o.g.x) < 1e-6 && Math.abs(q.z - o.g.z) < 1e-6)));
    for (const o of nat) for (const h of hyp) if (Math.hypot(h.x - o.x, h.z - o.z) < h.r + o.r) return 'footprint';   // a trunk, boulder or crag in the walls (no room for a body between)
    for (const o of nat) if (keep.touches(o.x, o.z, o.r)) return 'keep';                                            // ... or in the room inside and in front of the opening
    for (const o of cc) { for (const h of hyp) if (Math.hypot(h.x - o.x, h.z - o.z) < h.r + o.r) return 'solid'; if (keep.touches(o.x, o.z, o.r)) return 'solid'; }   // a pile, a fire place or a wall of the camp
    let rise = 0;
    for (const [f, r] of SITE_DENSE) {
      const q = pt(f, r);
      if (f >= LEANTO_BACK && f <= LEANTO_FRONT && Math.abs(r) <= LEANTO_SIDE) { if (!groundOk(q.x, q.z, y0)) return 'ground'; rise = Math.max(rise, Math.abs(world.H(q.x, q.z) - y0)); }   // inside the walls: all the ground rules
      else if (!canStand(world, q.x, q.z, 0) || terrainAt(world, q.x, q.z, 0).inRiver) return 'ground';   // the rest of the keep-free region: standable and not in a river
    }
    const S = pt(0, 0), G = pt(0.65, 0), F = pt(1.6, 0), R = ringCentre(l), solids = [...cc, ...hyp];
    const view = asCamp((x, z, reach) => solids.filter(o => Math.abs(o.x - x) <= reach + o.r && Math.abs(o.z - z) <= reach + o.r));
    if (!canStand(world, S.x, S.z, 0) || !segmentClear(world, S, G, view) || !segmentClear(world, G, F, view) || !segmentClear(world, F, R, view)) return 'approach';
    const room = (q, rad) => nat.every(o => Math.hypot(o.x - q.x, o.z - q.z) >= o.r + rad) && solids.every(o => Math.hypot(o.x - q.x, o.z - q.z) >= o.r + rad);
    if (!groundOk(R.x, R.z, y0) || !room(R, RING_R)) return 'room';
    rise = Math.max(rise, Math.abs(world.H(R.x, R.z) - y0));
    const stands = [];
    for (const [f, r] of [[0, UP_AT], [0, -UP_AT], [-UP_AT, 0]]) {   // the piles of the upgrades: fronds on one side, stones on the other, branches behind
      const U = pt(f, r);
      if (!groundOk(U.x, U.z, y0) || !room(U, PILE_CORE)) return 'room';
      rise = Math.max(rise, Math.abs(world.H(U.x, U.z) - y0));
      let st = null;
      for (let k = 0; k < 12 && !st; k++) { const a = k * Math.PI / 6, q = { x: U.x + Math.sin(a) * 0.9, z: U.z + Math.cos(a) * 0.9 }; if (inside(q.x, q.z) && canStand(world, q.x, q.z, 0) && room(q, 0.02) && !keep.touches(q.x, q.z, 0.1)) st = q; }
      if (!st) return 'room';
      stands.push(st);
    }
    return { R, F, stands, rise };
  }
  function siteRoutes(c, f, geo) {   // null when ways lead from the fire to the ring spot (or in front of the opening) and to a standing spot at each upgrade pile, else the reason
    const bound = Math.hypot(c.x - f.x, c.z - f.z) * 2.5 + 10;
    if (!(Math.min(path.cost(f, geo.R), path.cost(f, geo.F)) < bound)) return 'route';
    for (const st of geo.stands) if (!(path.cost(f, st) < bound + 10)) return 'room';
    return null;
  }
  const siteReason = (c, f, ignore = []) => { const g = siteGeometry(c, ignore); return typeof g === 'string' ? g : siteRoutes(c, f, g); };   // null: the lean-to fits at c = { x, z, heading }
  // Places for the lean-to round the fire f, best first: a lean-to that fits as the real one (above), on ground he knows, dry and level, 0.8 m above the high-water line, with the ring and the piles of the upgrades in reach
  // and clear of the rivers; the open side a quarter turn from the line to the fire (so that the stone ring comes to stand 4 m or more from the old fire, and becomes his fire); nearer the fire and nearer fresh water he knows is better.
  function leantoSites(f, ignore = []) {
    const wp = waterPts(), out = [];
    for (const r of SITE_RINGS) for (let i = 0; i < 16; i++) for (const side of [1, -1]) {
      const a = (i + (r === SITE_RINGS[1] ? 0.5 : 0)) * Math.PI / 8, c = { x: f.x + Math.sin(a) * r, z: f.z + Math.cos(a) * r, heading: a + side * Math.PI / 2, r };
      const g = siteGeometry(c, ignore); if (typeof g === 'string') continue;
      let wd = 120; for (const q of wp) wd = Math.min(wd, Math.hypot(q.x - c.x, q.z - c.z));
      out.push({ ...c, score: r + 0.05 * wd + 3 * g.rise, water: wd, geo: g });
    }
    return out.sort((a, b) => a.score - b.score);
  }
  const sitePiles = sp => W.piles.filter(q => (q.kind === 'driftwood' || q.kind === 'branch') && Math.hypot(q.x - sp.x, q.z - sp.z) <= 2.2 && Math.hypot(q.x - sp.fire.x, q.z - sp.fire.z) > 2.6);   // 0.30.7: every pile of building material at the site, whatever its size (what the build does not use, `layLeftovers` of game/game moves out of the footprint): never a reason to reject the site
  function homeSite(h) {   // kept once chosen (while the fire is the same), and checked again each time it is asked for: if the ground has changed (a pile, a fire) a new one is chosen
    if (proj.site && dist(proj.site.fire, h) < 4) {
      const why = siteReason(proj.site, h, sitePiles(proj.site));
      if (!why) return proj.site;
      ev('home-site-bad', { why }); proj.site = null;
    }
    for (const c of leantoSites(h).slice(0, 8)) if (path.cost(h, c) < c.r * 2.5 + 10 && !siteRoutes(c, h, c.geo)) return (proj.site = { ...c, fire: { x: h.x, z: h.z } });
    return null;
  }
  const existingSite = h => {   // two piles of 6 near the fire that the player left: the building is there, if the lean-to fits (a quarter turn from the line to the fire first, then towards the fire, then away from it); else he does not adopt them
    for (const q of W.piles) if (q.kind === 'driftwood' && q.logs.length >= NEED && Math.hypot(q.x - h.x, q.z - h.z) <= 30 && inside(q.x, q.z)) {
      const s = siteFor(W.piles, q);   // (a pair at the fire is its stock, not a site)
      if (!s || Math.hypot(s.x - h.x, s.z - h.z) < 3.5 || !inside(s.x, s.z) || !canStand(world, s.x, s.z, 0)) continue;
      const a = Math.atan2(s.x - h.x, s.z - h.z), ig = [s.drift, s.branch, ...sitePiles({ x: s.x, z: s.z, fire: h })], mine = proj.site && dist(proj.site, s) < 1.5 ? [proj.site.heading] : [];   // (his own piles for the site he chose: its heading first)
      for (const heading of [...mine, a + Math.PI / 2, a - Math.PI / 2, a + Math.PI, a]) if (!siteReason({ x: s.x, z: s.z, heading }, h, ig)) return { ...s, heading };
    }
    return null;
  };
  const sitePile = (kind, sp) => W.piles.filter(q => q.kind === kind && Math.hypot(q.x - sp.x, q.z - sp.z) <= 2.2 && Math.hypot(q.x - sp.fire.x, q.z - sp.fire.z) > 2.6).sort((a, b) => b.logs.length - a.logs.length)[0] || null;   // the piles for the building: close to the site, and not the fire's stock
  function* doBuild(kind, obj, face) {   // walks to a spot where the arc offers `kind` for obj (a lean-to being built or upgraded, { site } of two piles), presses build / upgrade and kneels until it is done (or he is called away); face: the way a new lean-to is to open
    think(kind === 'build' ? 'buildIntent' : 'upgradeIntent');   // 0.30.20: the reason, before he walks to the spot
    if (!(yield* goStand(kind, obj))) { stats.home.refused++; ev('home-not-offered', { kind, arc: game.action().options.map(o => o.kind).join(), stand: false }); cool('home', 300); return false; }
    if (face !== undefined) { headingWanted = face; inp.yaw = face; }   // 0.30.7: at once, the game reads the way to open at the press of the same step
    if (!pressKind([kind])) { headingWanted = null; stats.home.refused++; ev('home-not-offered', { kind, arc: game.action().options.map(o => o.kind).join() }); cool('home', 300); return false; }
    stats.home.builds++;
    yield* waitActs(40); yield* waitIdle(); headingWanted = null;
    return true;
  }
  // 0.30.10: the second pile of the pair is laid from beside the first one (within PILE_JOIN): the game then puts it next to that pile at the camp's gap, 1.85 to 2 m away, still a build pair
  function siteDest(sp, kind, other) {   // where the pieces of `kind` ('driftwood' | 'branch') are laid for the building: on the pile there, else across the opening from the pile of the other kind (a metre and a bit apart), else at the site
    const sx = Math.sin(sp.heading), sz = Math.cos(sp.heading), mine = sitePile(kind, sp), twin = sitePile(other, sp);
    if (mine) return { x: mine.x, z: mine.z, pile: mine };
    for (const sg of twin ? [1, -1] : [kind === 'driftwood' ? -1 : 1]) { const q = twin ? { x: twin.x + sz * 0.9 * sg, z: twin.z - sx * 0.9 * sg } : { x: sp.x + sz * PAIR_HALF * sg, z: sp.z - sx * PAIR_HALF * sg }; const st = standNear(q.x, q.z, 0.5); if (st && Math.hypot(st.x - q.x, st.z - q.z) < 1) return st; }
    return standNear(sp.x, sp.z, 2);
  }
  // what the next unit of the project is, for `what` ('leanto' | 'walls' | 'ring' | 'bed'): { kind, want, dest } a trip for pieces of that kind to dest(), { build, run } the building, null when there is nothing he can do now
  function homeNeed(what, h) {
    if (what === 'leanto') {
      const half = game.leantos.list.filter(l => l.progress < 1 && inside(l.x, l.z)).sort((a, b) => dist(a, p) - dist(b, p))[0];
      if (half) return { build: true, run: () => doBuild('build', { leanto: half }, undefined) };
      let s = existingSite(h), face = s && s.heading, sp = null;
      if (!s) {
        sp = homeSite(h); if (!sp) { ev('home-no-site'); cool('home', 900); return null; }
        const dest = (kind, other) => () => siteDest(sp, kind, other);
        const d = sitePile('driftwood', sp), b = sitePile('branch', sp), nd = d ? d.logs.length : 0, nb = b ? b.logs.length : 0;
        if (nd < NEED) return { kind: 'drift', src: 'timber', want: NEED - nd, dest: dest('driftwood', 'branch') };
        if (nb < NEED) return { kind: 'branch', want: NEED - nb, dest: dest('branch', 'driftwood') };
        s = siteFor(W.piles, d); face = sp.heading;
        if (!s) { ev('home-site-bad'); cool('home', 600); return null; }
      }
      // 0.29.4: he builds at the pile that has its partner within 2 m (a second pile of 6 nearby, with no partner, offered 'light' only). 0.30.7: it opens the way the site was validated (a quarter turn from the line to the fire; towards its own ring,
      // which becomes the fire), and is checked once more at the pile pair itself right before the building starts
      return { build: true, run: function* () {
        const why = siteReason({ x: s.x, z: s.z, heading: face }, h, [s.drift, s.branch, ...sitePiles({ x: s.x, z: s.z, fire: h })]);
        if (why) { ev('home-site-bad', { why }); if (sp) proj.site = null; cool('home', 300); return false; }
        return yield* doBuild('build', { site: s }, face);
      } };
    }
    if (h.kind !== 'leanto') return null;
    const lt = h.lt, per = UPGRADES[what].per, p0 = (lt.up && lt.up[what]) || 0, left = UPGRADES[what].steps - paidSteps(what, p0), hx = Math.sin(lt.heading), hz = Math.cos(lt.heading);
    const spot = { frond: [hz, -hx], stone: [-hz, hx], branch: [-hx, -hz] };   // fronds on one side, stones on the other, branches behind the lean-to (UP_AT m from its middle: beside the keep-free region, within UP_NEAR)
    for (const [kind, n] of Object.entries(per)) {
      const need = n * left - pileSum(kind, lt.x, lt.z, UP_NEAR);
      if (need <= 0) continue;
      const [ux, uz] = spot[kind], at = { x: lt.x + ux * UP_AT, z: lt.z + uz * UP_AT };
      return { kind: kind === 'branch' ? 'branch' : kind, want: need, dest: () => {
        const q = bigPile(kind, at.x, at.z, 1.5);
        if (q && (kind === 'branch' || q.kind === 'driftwood')) return { x: q.x, z: q.z, pile: q };
        // a pile of fronds or stones is wider than the join distance (nothing is added to it from outside): the next one is a pile of its own at the nearest free spot of the ring UP_AT from the middle
        const base = Math.atan2(ux, uz), rs = pileSolidRadius({ kind, logs: [{ rad: 0.2 }] });
        for (let k = 0; k < 176; k++) {   // 0.30.9: a finer search (0.15 rad steps all round the ring, three radii, all within UP_NEAR): with 0.55 rad steps the old piles blocked every spot and a pile laid beside them fell outside UP_NEAR, so it never counted
          const ring = UP_AT + 0.4 * (k % 4), j = (k / 4) | 0, a = base + (j % 2 ? -1 : 1) * Math.ceil(j / 2) * 0.15, x = lt.x + Math.sin(a) * ring, z = lt.z + Math.cos(a) * ring;
          if (openNear(x, z, 0) && !keepFree(lt).touches(x, z, rs + BODY) && gapFree(game.movement.obstacles.camp, x, z, rs + BODY)) return { x, z, exact: true };   // 0.30.10: CAMP_GAP from every solid (it was 1.5 m from the other piles)
        }
        return q ? { x: q.x, z: q.z, pile: q } : { x: at.x, z: at.z, exact: true };
      } };
    }
    return { build: true, run: () => doBuild('upgrade', lt, undefined) };
  }
  function* homeGoal(what, need) {
    if (cur) cur.limit = HOME_LIMIT;
    const n0 = homeCount(); stats.home.units++;
    ev('home', { what, need: need.kind || 'build' });
    let ok;
    if (need.kind) { stats.home.trips++; ok = yield* gather(need.kind, need.dest, need.want, HOME_MAX_COST, need.src || need.kind, 'home'); if (!ok) { stats.home.noMaterial++; lack[need.kind === 'drift' ? 'wood' : need.kind === 'branch' ? 'branches' : need.kind === 'stone' ? 'wood' : 'nuts'] = clock.day; ev('home-no-material', { kind: need.kind }); cool('home', 600); } }
    else ok = yield* need.run();
    if (homeCount() > n0) { builtDay = clock.day; ev('home-built', { what }); }
    return ok;
  }

  // ---------- the axe and the clearing (0.31 "Axe") ----------
  // Only when his shelter is quite finished (lean-to, walls, ring and bed). He makes ONE axe (a branch, a stone and a tuft of fibre from known ground) and then, at an idle moment of the home's morning window, at most one tree a day through the player's own actions
  // (take the axe, 'fell', lay it down, shoulder the log, lay it on a log pile). The order: first every tree whose trunk stands within AXE_CLEAR_R of the lean-to's middle, nearest first (palms and giants too); only when that clearing is open (a tree he cannot reach stays: it is
  // asked again after AXE_RETRY_DAYS, as the known ground grows) and fewer than AXE_LOGS logs are stored (in log piles, lying or on his shoulder) the nearest trees beyond it, up to AXE_OUT_R, until twelve logs are there; then no more. A giant gives 2 or 3 sections: the day it falls he carries the first,
  // then one a morning (a log lying about is always carried before a new tree is felled; that is the day's work). The logs go to log piles of twelve at the clearing's edge, 11.6 to 12.6 m from the lean-to's middle (`logDest`: behind the lean-to first, then beside the last pile along the ring), the axe is kept lying
  // beside them (`axeSpot`), laid down where the tree fell while the log is carried and fetched back after it. Never for firewood. Nothing is saved but the game's own state: the axe lies where it was laid (never lost: `fetchAxe` goes to wherever it lies on known ground), a lying log is picked up the next morning.
  const homeDone = h => h.kind === 'leanto' && UP_NAMES.every(k => !!h.lt.up && h.lt.up[k] >= 1);
  let axeDay = -9, axeNone = -9, axeHome = null;   // the day of the last unit of work, the day the plan found nothing to do, where the axe is kept
  const axeSnap = () => ({ day: clock.day, time: clock.time, done: homeDone(homeSpot()) && axeNone !== clock.day, builtDay, axeDay, cool: { axe: isCool('axe') } });
  const logBad = new Set(), spotKey = (x, z) => Math.round(x * 2) + ',' + Math.round(z * 2);
  const naturalClear = (x, z, r) => naturalNear(x, z).every(o => Math.hypot(o.x - x, o.z - z) >= o.r + r);
  const logsStored = () => W.piles.filter(q => q.kind === 'log').reduce((n, q) => n + q.logs.length, 0);
  const logsLying = () => { let n = 0; for (const l of LOGS.all.values()) if (LOGS.onGround(l)) n++; return n; };
  const logTotal = () => logsStored() + logsLying() + (W.log ? 1 : 0);   // every log that is or will be in a pile: piled, lying, on his shoulder

  function treesWithin(c, r0, r1) {   // the standing trees whose trunk stands more than r0 and at most r1 from c, nearest first
    const out = [];
    for (const t of tilesNear(c.x, c.z, r1 + 2)) for (const list of LISTS) t[list].forEach((tree, index) => {
      const d = Math.hypot(tree.x - c.x, tree.z - c.z); if (d > r1 || d <= r0) return;
      const id = treeId(t, list, index); if (FELLED.has(id)) return;
      const kind = sizeKind(list, tree); out.push({ id, x: tree.x, z: tree.z, r: trunkRadius(tree, kind), d, kind, list, giant: isGiant(tree, kind) });
    });
    return out.sort((a, b) => a.d - b.d);
  }
  function planFell(t) {   // the standing spot beside a trunk where 'fell' is offered (the arc offers it only with the axe in hand: for the planning alone it is taken as held; nothing else reads it meanwhile)
    const had = A.hand; A.hand = true;
    try { return stand.plan('fell', t, path, p, { allow: inside }); } finally { A.hand = had; }
  }
  function treeReach(t, h) {   // a standing spot for t he can walk to on his own ground (known, no detour over another terrace), else null (a tree he cannot reach is left alone, and asked again AXE_RETRY_DAYS later)
    if (isBad('tree', t) || !inside(t.x, t.z)) return null;
    const fs = fireSpot(h), sp = planFell(t);
    if (!sp || !(path.cost(fs, sp) <= 2.5 * Math.hypot(sp.x - fs.x, sp.z - fs.z) / WALK_SPEED + 12)) { markBad('tree', t, AXE_RETRY_DAYS * DAY_SECONDS); stats.axe.skipped++; ev('axe-skip', { id: t.id, d: +t.d.toFixed(1), list: t.list }); return null; }
    return sp;
  }
  function nextTree(h) {   // the tree for today: the nearest reachable one in the clearing; else, while the stores are short, the nearest just outside it
    const c = { x: h.lt.x, z: h.lt.z };
    for (const t of treesWithin(c, -1, AXE_CLEAR_R).slice(0, 40)) { const sp = treeReach(t, h); if (sp) return { ...t, sp, inner: true }; }
    if (logTotal() >= AXE_LOGS) return null;
    for (const t of treesWithin(c, AXE_CLEAR_R, AXE_OUT_R).slice(0, 60)) { if (path.cost(fireSpot(h), t) > HOME_MAX_COST * 3) continue; const sp = treeReach(t, h); if (sp) return { ...t, sp, inner: false }; }
    return null;
  }
  function nextLog(h) {   // a log lying on known ground, the nearest by walking cost
    for (const l of LOGS.near(h.lt.x, h.lt.z, AXE_RANGE).filter(q => inside(q.x, q.z) && !isBad('log', q)).sort((a, b) => dist(a, p) - dist(b, p)).slice(0, 4)) {
      if (path.cost(p, l) < Infinity) return l;
      markBad('log', l, 1200);
    }
    return null;
  }
  function axePlan() {   // what the next unit of the project is: { what: 'make' } | { what: 'log', log } | { what: 'fell', tree } | null (nothing to do)
    const h = homeSpot(); if (!homeDone(h)) return null;
    if (!A.has()) return { what: 'make' };
    const l = nextLog(h); if (l) return { what: 'log', log: l };
    const t = nextTree(h); return t ? { what: 'fell', tree: t } : null;
  }

  // where the log piles stand: on the ring LOG_RING round the lean-to's middle, on known, dry, ordinary ground, a pile's room clear of every camp solid and trunk and the lean-to's keep-free region
  const logRoom = PILE_R + BODY;
  const ringPile = (lt, q) => { const d = Math.hypot(q.x - lt.x, q.z - lt.z); return d >= LOG_RING[0] - 1 && d <= LOG_RING[2] + 1; };
  function logSpotOk(lt, x, z) {
    if (!openNear(x, z, 0) || logBad.has(spotKey(x, z))) return false;
    const t = terrainAt(world, x, z, game.sea);
    if (t.inRiver || t.y < game.sea + 0.5 || t.s >= EXPLORE_SLOPE || t.climb > EXPLORE_ROUTE) return false;
    if (keepFree(lt).touches(x, z, logRoom) || !gapFree(campView, x, z, logRoom) || !naturalClear(x, z, logRoom + CAMP_GAP)) return false;
    for (let k = 0; k < 12; k++) {   // open ground all round it: a pile never closes a gap between a trunk, the sea or a slope and itself (a way past it stays)
      const qx = x + Math.sin(k * Math.PI / 6) * (logRoom + 0.7), qz = z + Math.cos(k * Math.PI / 6) * (logRoom + 0.7), q = terrainAt(world, qx, qz, game.sea);
      if (!canStand(world, qx, qz, game.sea) || q.inRiver || q.y < game.sea + 0.3 || q.s >= EXPLORE_SLOPE) return false;
    }
    return ![S.at, A.at].some(q => q && Math.hypot(q.x - x, q.z - z) < 1.6);
  }
  function logSpot(h) {   // a spot for a new pile: behind the lean-to for the first, beside the last pile along the ring after that; null when none fits
    const lt = h.lt, fs = fireSpot(h), piles = W.piles.filter(q => q.kind === 'log' && ringPile(lt, q)), prev = piles[piles.length - 1] || null, behind = lt.heading + Math.PI, cands = [];
    for (const r of LOG_RING) for (let i = 0; i < 36; i++) {
      const a = i * Math.PI / 18, x = lt.x + Math.sin(a) * r, z = lt.z + Math.cos(a) * r;
      if (!logSpotOk(lt, x, z)) continue;
      const turn = Math.abs(((a - behind) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);   // 0 straight behind
      cands.push({ x, z, k: prev ? Math.hypot(x - prev.x, z - prev.z) : turn * 10 + Math.abs(r - LOG_RING[1]) });
    }
    cands.sort((a, b) => a.k - b.k);
    for (const c of cands.slice(0, 12)) if (path.cost(fs, exactPileDrop(fs, c)) <= 3 * Math.hypot(c.x - fs.x, c.z - fs.z) / WALK_SPEED + 15) return { x: c.x, z: c.z };
    return null;
  }
  function logDest(h) {   // where the next log goes: the fullest log pile of the ring with room, else a new pile's spot ({ exact: true }), else null
    const open = W.piles.filter(q => q.kind === 'log' && ringPile(h.lt, q) && q.logs.length < PILE_FULL && inside(q.x, q.z) && !isBad('logpile', q)).sort((a, b) => b.logs.length - a.logs.length)[0];
    if (open) return { x: open.x, z: open.z, pile: open };
    const s = logSpot(h); return s ? { x: s.x, z: s.z, exact: true } : null;
  }
  function* deliverLog() {   // the log on his shoulder onto a log pile at the clearing's edge; false (the log stays on his shoulder) when no pile can be had
    const h = homeSpot(); if (!W.log || h.kind !== 'leanto') return false;
    for (let tries = 0; tries < 3 && W.log; tries++) {
      const d = logDest(h); if (!d) break;
      if (d.pile) {
        if (!(yield* goStand('add', d.pile))) { markBad('logpile', d.pile, 600); continue; }
        if (pressKind(['lay'])) yield* waitIdle();
      } else {
        const at = exactPileDrop(p, d);
        if (yield* walk(at.x, at.z, { stop: 0.08, settle: 4 })) { p.heading = at.heading; if (pressKind(['lay'])) yield* waitIdle(); }
        if (W.log) logBad.add(spotKey(d.x, d.z));
      }
    }
    if (W.log) { ev('axe-log-nowhere'); return false; }
    stats.axe.laid++;
    const q = W.piles.filter(o => o.kind === 'log').sort((a, b) => dist(a, p) - dist(b, p))[0];
    ev('axe-log-laid', { pile: q ? q.logs.length : 0, d: q ? +Math.hypot(q.x - h.lt.x, q.z - h.lt.z).toFixed(1) : null });
    return true;
  }
  function logStand(l) {   // a spot along the log where the arc offers to pick up THAT log (a pile or another piece nearer to his feet takes its place in the arc: the tideline's piles lie where trees fall too; the next section of a giant lies end to end with this one), the best of the spots; null when none
    const ca = Math.cos(l.a), sa = Math.sin(l.a), h = l.len / 2, camp = game.movement.obstacles.camp, offers = (qx, qz) => game.offersAt(qx, qz).some(o => o.kind === 'pickup' && o.thing && o.thing.kind === 'log' && o.thing.log === l);
    let best = null, bk = -1, bd = Infinity;
    for (let u = -1; u <= 1.001; u += 0.2) for (const side of [0, 0.2, -0.2, 0.4, -0.4]) {
      const x = l.x + ca * u * h - sa * side, z = l.z + sa * u * h + ca * side;
      if (!inside(x, z) || !canStand(world, x, z, game.sea) || camp.inside(x, z, 0.05) || !offers(x, z)) continue;
      let k = 0; for (let n = 0; n < 8; n++) { const qx = x + Math.sin(n * Math.PI / 4) * 0.12, qz = z + Math.cos(n * Math.PI / 4) * 0.12; if (!canStand(world, qx, qz, game.sea) || offers(qx, qz)) k++; }   // (the follower stops within 0.12 m, a slide a little more: the more the log is offered all round the spot, the better)
      const d = Math.hypot(x - p.x, z - p.z);
      if (k > bk || (k === bk && d < bd)) { bk = k; bd = d; best = { x, z }; }
    }
    return best;
  }
  function* fetchLog(l) {   // walks to a spot beside the log where it is offered and shoulders it (nothing else in his arms or hands)
    const wanted = o => !!o.thing && o.thing.kind === 'log' && o.thing.log === l;
    const near = () => { const a = game.action().tap; return !!a && a.kind === 'pickup' && wanted(a); };
    for (let tries = 0; tries < 2 && !W.log; tries++) {
      const at = logStand(l); if (!at) break;
      yield* walk(at.x, at.z, { stop: 0.12, settle: 3, until: near });
      const k = pressKind(['pickup'], wanted); if (k) yield* waitIdle();
    }
    return !!W.log;
  }

  // the axe's own place: beside the log piles (the next pile's spot), 1.9 to 3.1 m from it on the lean-to's side
  const axeSpotOk = (x, z) => !!openNear(x, z, 0) && gapFree(campView, x, z, BODY) && !game.leantos.list.some(l => keepFree(l).touches(x, z, BODY)) && !(S.at && Math.hypot(x - S.at.x, z - S.at.z) < 1.2) && naturalClear(x, z, BODY + 0.3);
  function axeSpot() {
    if (axeHome && axeSpotOk(axeHome.x, axeHome.z)) return axeHome;
    const h = homeSpot(), d = h.kind === 'leanto' ? logDest(h) : null, base = d || (h.kind === 'leanto' ? { x: h.lt.x, z: h.lt.z } : { x: h.x, z: h.z }), cands = [];
    for (const r of d ? [1.9, 2.5, 3.1] : [3.4, 4.2, 5]) for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; cands.push({ x: base.x + Math.sin(a) * r, z: base.z + Math.cos(a) * r }); }
    cands.sort((a, b) => dist(a, h) - dist(b, h));
    axeHome = cands.find(q => axeSpotOk(q.x, q.z)) || null;
    return axeHome;
  }
  function* fetchAxe() {   // the axe into his hand, from wherever it lies on known ground
    if (A.hand) return true;
    if (!A.at || W.load() || game.fire.torch || !inside(A.at.x, A.at.z)) return false;
    const q = { x: A.at.x, z: A.at.z };
    yield* walk(q.x, q.z, { stop: 0.3, until: () => offered('takeAxe') });
    if (!A.hand) { if (!offered('takeAxe')) yield* walk(q.x, q.z, { stop: 0.1 }); if (pressKind(['takeAxe'])) yield* waitIdle(); }
    return A.hand;
  }
  function* returnAxe() {   // lays the axe down at its place beside the log piles (as the spear: where he can when there is no way there)
    if (!A.hand) return true;
    const q = axeSpot();
    if (q && (yield* walk(q.x, q.z, { stop: 0.15, settle: 3 })) && pressKind(['layAxe'])) yield* waitIdle();
    if (A.hand) { const o = standNear(p.x, p.z, 4); if (o) yield* walk(o.x, o.z, { stop: 0.3 }); if (pressKind(['layAxe'])) yield* waitIdle(); }
    if (A.hand) { stats.axe.stuck++; ev('axe-stuck'); }
    return !A.hand;
  }

  function* makeAxeTrip() {   // a tuft of fibre (husked if need be), a loose branch under his arm, to a loose stone, kneel: the axe is made and laid down beside the log piles
    return yield* errand(function* () {
    if (cur) cur.limit = AXE_LIMIT;
    const h = homeSpot(), tuft = () => game.fibre.carried;
    for (let n = 0; n < 2 && tuft() < AXE_FIBRE; n++) { if (!nearestBy('coco', 60)) { cool('axe', 300); lack.nuts = clock.day; return false; } if (!(yield* huskGoal())) { cool('axe', 300); return false; } }
    if (tuft() < 1) { cool('axe', 300); return false; }
    const cost = list => { for (const c of list.slice(0, 3)) { const k = path.cost(p, c); if (k < Infinity) return { ...c, cost: k }; } return null; };
    const b = cost(scan('branch', h.x, h.z, AXE_RANGE)), st = b ? cost(scan('stone', b.x, b.z, AXE_RANGE)) : null;
    if (!b || !st) { cool('axe', 300); lack[b ? 'wood' : 'branches'] = clock.day; return false; }
    think('axeIntent');
    stats.axe.trips++; ev('axe-trip', { what: 'make', branch: [+b.x.toFixed(1), +b.z.toFixed(1)], stone: [+st.x.toFixed(1), +st.z.toFixed(1)] });
    const pickOffered = () => { const a = game.action().tap; return !!a && a.kind === 'pickup' && !!a.thing && a.thing.kind === 'log' && !!a.thing.log.branch && Math.hypot(a.thing.x - b.x, a.thing.z - b.z) < 1.5; };
    yield* walk(b.x, b.z, { tap: true, stop: 0.4, until: pickOffered });
    let k = pressKind(['pickup']); if (k) yield* waitIdle();
    if (!W.carried.some(l => l.branch) || W.load() !== 1) { markBad('branch', b.o, 600); cool('axe', 300); return false; }
    yield* walk(st.x, st.z, { tap: true, stop: 0.4, until: () => offered('makeAxe') });
    if (!offered('makeAxe')) yield* walk(st.x, st.z, { stop: 0.2 });
    k = pressKind(['makeAxe']); if (k) yield* waitIdle();
    if (!A.has()) { markBad('stone', st.o, 600); cool('axe', 300); stats.axe.fails++; return false; }
    stats.axe.made++; stats.axe.madeDay = clock.day; axeDay = clock.day; ev('axe-made');
    yield* returnAxe();
    return true;
    });
  }
  function* carryLog(l) {   // a lying log to a pile: the day's work when there is no tree to fell today (or the rest of a giant)
    return yield* errand(function* () {
    if (cur) cur.limit = AXE_LIMIT;
    stats.axe.trips++; ev('axe-trip', { what: 'log', at: [+l.x.toFixed(1), +l.z.toFixed(1)] });
    if (!(yield* fetchLog(l))) { const t = game.action().tap; ev('axe-fail', { what: 'log', why: 'fetch', tap: t && t.kind, thing: t && t.thing && t.thing.kind, d: +dist(p, l).toFixed(2), len: l.len }); markBad('log', l, 600); cool('axe', 300); stats.axe.fails++; return false; }
    axeDay = clock.day;
    if (!(yield* deliverLog())) { cool('axe', 300); stats.axe.fails++; return false; }
    return true;
    });
  }
  function* fellTree(t) {   // take the axe, to the tree, fell it, lay the axe down, carry the log to its pile, back for the axe and lay it down beside the piles
    return yield* errand(function* () {
    if (cur) cur.limit = AXE_LIMIT;
    think('clearIntent');
    stats.axe.trips++; ev('axe-trip', { what: 'fell', id: t.id, list: t.list, d: +t.d.toFixed(1), giant: t.giant, inner: t.inner });
    if (!(yield* fetchAxe())) { cool('axe', 300); stats.axe.fails++; return false; }
    const info = treeInfo(world, t.id);
    if (!info || FELLED.has(t.id) || !(yield* goStand('fell', info))) { markBad('tree', t, AXE_RETRY_DAYS * DAY_SECONDS); stats.axe.skipped++; ev('axe-skip', { id: t.id, why: 'stand' }); yield* returnAxe(); return false; }
    if (!pressKind(['fell'], o => !!o.tree && o.tree.id === t.id)) { markBad('tree', t, AXE_RETRY_DAYS * DAY_SECONDS); stats.axe.skipped++; ev('axe-skip', { id: t.id, why: 'offer' }); yield* returnAxe(); return false; }
    yield* waitActs(5); yield* waitIdle();
    if (!FELLED.has(t.id)) { stats.axe.fails++; ev('axe-fell-cut-short', { id: t.id, chopped: +FELLED.chopped(t.id).toFixed(2) }); return false; }   // the progress is kept; the next goal lays the axe back at the camp
    axeDay = clock.day; stats.axe.felled++; stats.axe[t.inner ? 'inner' : 'outer']++; if (t.list === 'palms') stats.axe.palms++; if (t.giant) stats.axe.giants++;
    stats.axe.felledDays.push(clock.day); stats.axe.list.push({ day: clock.day, id: t.id, list: t.list, d: +t.d.toFixed(1), giant: t.giant });
    ev('axe-felled', { id: t.id, list: t.list, d: +t.d.toFixed(1), giant: t.giant });
    for (let n = 0; n < 2 && A.hand; n++) { if (pressKind(['layAxe'])) yield* waitIdle(); else { const o = standNear(p.x, p.z, 2); if (o) yield* walk(o.x, o.z, { stop: 0.3 }); } }   // the axe lies where the tree fell while the log is carried
    if (A.hand) return false;
    const l = LOGS.near(t.x, t.z, 6).filter(q => !isBad('log', q)).sort((a, b) => dist(a, p) - dist(b, p))[0];
    if (l && (yield* fetchLog(l))) { stats.axe.logs++; yield* deliverLog(); }
    else if (l) { ev('axe-fail', { what: 'fell', why: 'fetch', id: l.id }); markBad('log', l, 600); stats.axe.fails++; }
    if (!W.log) { if (yield* fetchAxe()) yield* returnAxe(); }
    return true;
    });
  }
  function* axeGoal() {   // the day's unit of the project, if there is one; null when nothing was done (nothing to do, or not now)
    const plan = axePlan();
    if (!plan) { axeNone = clock.day; return null; }
    if (plan.what === 'make') return yield* makeAxeTrip();
    if (plan.what === 'log') return yield* carryLog(plan.log);
    return yield* fellTree(plan.tree);
  }

  // ---------- the tideline (0.30.13 "Tideline") ----------
  // Wet wood in the strip between the tides never dries there (the sea covers it again and again), and a pile in the strip is taken by the sea at high water. On a beach he knows (a stroll's shore leg, the far end of an exploring trip) he
  // takes up to three such pieces with an arm free and carries them a few metres higher, to a spot just above the high-water line (`tideSpot`), and lays them there: a small pile at the beach edge. It dries where it lies (game/wood), the
  // rain wets it again in the open. Later the stores and the evening fire fetch it like any pile that is not his own (`pileFinds`, dry on top). While the lean-to still needs driftwood at its site, wet wood goes there instead (`wetForSite`).
  // The same actions as a player's: pick up, lay down. Nothing is saved: `rescued` is only for the numbers.
  const wetPiece = l => dryness(l, clock.total) < DRY_AT;
  const wetCarried = () => carriedKind() === 'drift' && W.carried.some(wetPiece);
  const wetWanted = () => o => !!o.thing && o.thing.kind === 'log' && kindOf(o.thing.log) === 'driftwood' && inStripY(o.thing.log.y) && wetPiece(o.thing.log);
  const wetPicked = fresh => { stats.tide.picked += fresh.length; };
  const rescued = new Set();   // ids of the pieces he laid above the high-water line
  function tideSpot() {   // a spot a few metres from where he stands, just above the high-water line, clear of the camp and of other piles; null when there is none
    const fs = fireSpot(), camp = game.movement.obstacles.camp, lts = game.leantos.list, found = [];
    for (let r = TIDE_NEAR[0]; r <= TIDE_NEAR[1]; r++) for (let i = 0; i < 16; i++) {
      const a = (i + (r % 2) * 0.5) * Math.PI / 8, x = p.x + Math.sin(a) * r, z = p.z + Math.cos(a) * r, y = world.H(x, z);
      if (y < TIDE_LAND[0] || y > TIDE_LAND[1] || !inside(x, z) || !canStand(world, x, z, 0) || world.slope(x, z) > 0.35 || !world.dryOfRiver(x, z, 1.5)) continue;
      if (Math.hypot(x - fs.x, z - fs.z) < TIDE_CAMP || (proj.site && Math.hypot(x - proj.site.x, z - proj.site.z) < TIDE_CAMP) || lts.some(l => Math.hypot(x - l.x, z - l.z) < TIDE_CAMP)) continue;
      if (W.piles.some(q => Math.hypot(q.x - x, q.z - z) < TIDE_APART && !(q.kind === 'driftwood' && q.logs.length < TIDE_JOIN_MAX && Math.hypot(q.x - x, q.z - z) < 1))) continue;
      if (!gapFree(camp, x, z, PILE_R)) continue;
      let room = 0; for (let k = 0; k < 8; k++) { const qx = x + Math.sin(k * Math.PI / 4) * 1.1, qz = z + Math.cos(k * Math.PI / 4) * 1.1; if (inside(qx, qz) && canStand(world, qx, qz, game.sea, { obstacles: game.movement.obstacles }) && world.slope(qx, qz) < 0.35) room++; }
      if (room < 5) continue;   // a pile he can walk round: a standing point to take it from later
      found.push({ x, z, r });
      if (found.length >= 6) break;
    }
    let best = null;
    for (const c of found) { const cost = path.cost(p, c); if (cost < TIDE_COST && (!best || cost < best.cost)) best = { x: c.x, z: c.z, cost }; }
    return best;
  }
  function stripPoint() {   // the nearest ground he knows between the tides (by a way of at most TIDE_ROUND_COST s), 10 to 60 m away; null when there is none
    const cands = [];
    for (let r = 10; r <= 60; r += 5) for (let i = 0; i < 16; i++) {
      const a = (i + (r % 10) / 10) * Math.PI / 8, x = p.x + Math.sin(a) * r, z = p.z + Math.cos(a) * r;
      if (inside(x, z) && inStripY(world.H(x, z)) && world.slope(x, z) < 0.35 && canStand(world, x, z, game.sea, { obstacles: game.movement.obstacles })) cands.push({ x, z, r });
    }
    let best = null;
    for (const c of cands.slice(0, 10)) { const cost = path.cost(p, c); if (cost < TIDE_ROUND_COST && (!best || cost < best.cost)) best = { x: c.x, z: c.z, cost }; }
    return best;
  }
  function* layTideline(final = false) {   // wet wood in his arms: to the beach edge. final: nothing else can be done with it, so without a spot it is laid where he stands (never in the strip, where the sea takes a pile)
    return yield* errand(function* () {
      if (!W.carried.length) return;
      let s = tideSpot(); const ids = W.carried.map(l => l.id);
      if (!s && final) { const t = stripPoint(); if (t && (yield* walk(t.x, t.z, { stop: 1.2 }))) s = tideSpot(); }   // no spot here (he stands in the camp, where nothing is laid): to the nearest strip he knows and up the beach there, not a pile at the camp
      if (s) { ev('tide-lay', { to: [+s.x.toFixed(1), +s.z.toFixed(1)], n: ids.length }); yield* layAt({ x: s.x, z: s.z, exact: true }); }
      else { stats.tide.noSpot++; ev('tide-nospot', { final }); }
      if (final && W.load()) { if (!inStripY(world.H(p.x, p.z))) yield* layAt(p); }
      const laid = ids.filter(id => W.piles.some(q => q.logs.some(l => l.id === id) && !inStripY(world.H(q.x, q.z))));
      for (const id of laid) if (!rescued.has(id)) { rescued.add(id); stats.tide.laid++; }
      if (laid.length) ev('tide-laid', { n: laid.length });
    });
  }
  // wet wood in the strip within a few metres of where a shore leg ends: up to a full carry, only with an arm free and nothing but wet driftwood in it (dry wood or branches would mix with it); fetched far to near like all wood
  function* pickUpWet() {
    const ck = carriedKind();
    if ((ck && ck !== 'drift') || W.carried.some(l => !wetPiece(l)) || W.carried.length >= CARRY_MAX) return;
    const got = yield* collect('strip', { goal: CARRY_MAX, have: () => W.carried.length, r0: 8, rMax: 8, think: 'wetwood', wanted: wetWanted, good: fresh => !W.carried.some(l => !wetPiece(l)), onPick: wetPicked, tag: 'tide' });
    if (got && wetCarried() && !wetForSite()) { stats.tide.trips++; yield* layTideline(false); }
  }
  // The daily round (0.30.13): once a day by day, nothing urgent, the nearest strip he knows where wet wood lies, home before dark like an exploring trip: up to two loads, to the lean-to site while it needs driftwood, else to the beach edge.
  let tideDay = -9, tideNone = -1e9;
  function tideTarget() {
    const wet = scan('strip', p.x, p.z, TIDE_ROUND_RANGE).slice(0, 6);
    let best = null;
    for (const c of wet) { const cost = path.cost(p, c); if (cost < TIDE_ROUND_COST && (!best || cost < best.cost)) best = { x: c.x, z: c.z, cost }; }
    return best;
  }
  function* tideRound() {
    tideDay = clock.day; if (rngTide() >= TIDE_ROUND_CHANCE) return false;
    const t = tideTarget(); if (!t) { tideNone = now; return false; }
    if (exploreLate(clock.time, 2 * t.cost + 60, PACE)) return false;
    if (cur) cur.limit = EXPLORE_LIMIT;
    stats.tide.rounds++; ev('tide-round', { to: [+t.x.toFixed(1), +t.z.toFixed(1)] });
    for (let load = 0; load < 2; load++) {
      if (load && (exploreLate(clock.time, 2 * dist(p, homeSpot()) / WALK_SPEED + 60, PACE) || wetForSite() || !scan('strip', p.x, p.z, 8).length)) break;
      if (!load && !(yield* walk(t.x, t.z, { stop: 1.2 }))) break;
      const n0 = W.carried.length; yield* pickUpWet();
      if (W.carried.length <= n0 && !W.load()) break;
      if (W.load()) break;   // (carried on for the lean-to site: `deliver`)
    }
    yield* deliver();
    return true;
  }
  // the numbers of the pieces he rescued that were burned (fed to a fire, or in the pile a fire was lit from) and how wet they were then
  function burnedLogs(logs) { for (const l of logs) if (rescued.has(l.id)) { stats.tide.burned++; if (dryness(l, clock.total) < 0.5) stats.tide.wetBurned++; } }

  // ---------- the torch (0.30.14 "Torch") ----------
  // After dusk, beside a fire with flames, empty-handed, a trip of more than TORCH_TRIP (15 m) to drink, to bed or to look for food starts with a torch from the fire (the player's own action; it costs the fire half a piece, so never from a low fire).
  // Never in rain, with wood in his arms, or when the way leads through water deeper than DOUSE_DEPTH (it would put the torch out). On arrival the torch is stuck in the ground (the game does it for a drink and for sleep; `plantTorch` otherwise) and burns out there.
  const throughDeep = (finder, dest) => {
    const r = finder.find(p, dest, 20000, false); if (!r) return true;
    let a = p;
    for (const q of r.pts) {
      const n = Math.max(1, Math.ceil(Math.hypot(q.x - a.x, q.z - a.z)));
      for (let k = 1; k <= n; k++) if (terrainAt(world, a.x + (q.x - a.x) * k / n, a.z + (q.z - a.z) * k / n, game.sea).depth > DOUSE_DEPTH) return true;
      a = q;
    }
    return false;
  };
  function* torchFor(dest, finder = path) {
    if (!isNight(clock.time) || game.fire.torch || W.load() || game.weather.raining(clock.total) || Math.hypot(dest.x - p.x, dest.z - p.z) <= TORCH_TRIP) return;
    const f = nearFlame(SIT_FIRE); if (!f || !(f.fuel >= TORCH_FUEL)) return;   // beside a fire with flames, and not a low one
    if (throughDeep(finder, dest)) return;
    think('torchIntent');   // 0.30.20: the reason, before he goes to the fire for it
    if (!(game.action().options.concat(game.action().tap || []).some(o => o.kind === 'torch' && o.fire)) && !(yield* goStand('nearFire', f))) return;
    if (pressKind(['torch'], o => !!o.fire)) { yield* waitIdle(); if (game.fire.torch) { stats.torch.taken++; ev('torch-taken', { to: [+dest.x.toFixed(1), +dest.z.toFixed(1)] }); } }
  }
  function* plantTorch() {   // a torch in his hand is stuck in the ground where he stands (a step away when something else is offered here)
    for (let k = 0; k < 3 && game.fire.torch; k++) {
      if (pressKind(['plant'])) { yield* waitIdle(); yield; continue; }
      const a = k * 2.1 + 0.5, q = openNear(p.x + Math.sin(a) * 1.5, p.z + Math.cos(a) * 1.5, 0.5); if (q) yield* walk(q.x, q.z, { stop: 0.3 });
    }
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
      t.palms.forEach((o, pi) => { if (!game.felled.standing(t, 'palms', pi)) return; if (Math.hypot(o.x - centre.x, o.z - centre.z) <= range && inside(o.x, o.z)) { const st = around(o, 2.4); if (st) out.palms.push({ x: st.x, z: st.z, px: o.x, pz: o.z }); } });   // (0.31: a felled palm is no stroll's goal)
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
    if (wetForSite()) { const d = siteDest(proj.site, 'driftwood', 'branch'); if (d && (yield* toDest(d))) yield* layAt(d); return; }
    if (wetCarried()) { yield* layTideline(true); return; }   // wood that is not dry enough to burn never goes to the fire's pile
    const fs = fireSpot(), kind = carriedKind() === 'branch' ? 'branch' : 'driftwood';
    const q = firePiles(fs).filter(x => x.kind === kind && x.logs.length < PILE_FULL).sort((a, b) => b.logs.length - a.logs.length)[0], d = q ? { x: q.x, z: q.z, pile: q } : fs;
    if (pairNear(fs, kind) && (q ? q.logs.length : 0) + W.carried.length >= NEED) { yield* layAt(p); return; }   // it would make a second pile of 6 or more at the fire: laid down where he stands
    if (d.pile) { if (!(yield* goStand('add', d.pile))) return; }
    else { const o = openNear(d.x, d.z, 1.5); if (!o || !(yield* walk(o.x, o.z, { stop: 0.35 }))) return; }
    for (let n = 0; n < 3 && W.carried.length; n++) { if (!pressKind(['lay'])) break; yield* waitIdle(); }   // (lay only: by day he never feeds the flames with it)
    });
  }
  // 0.30.4 "Timber": the handoff. Before any other task he brings the wood in his arms to camp and lays it on the pile it belongs to: dry firewood on the fire's stock, wet wood on the drying pile, building material where the project wants it (what the
  // load is for was noted when he picked it up, `tag`; wood of no known purpose goes by its dryness). A deposit that cannot be made (no way, no standing point, nothing laid) is not retried: he lays it on a spot of its own at camp (a pile of its own, clear of
  // other piles), and as the last resort where he stands, so that nothing is lost and nothing loops. The two emergencies (very thirsty, very hungry) go first with what is in his arms; if the game laid it down for the drink, the handoff fetches it afterwards (`fetchOwed`).
  // 0.29.3 rule: wet driftwood in his arms (mean dryness under 0.6) is timber for the lean-to site while the project still needs driftwood there
  const wetForSite = () => carriedKind() === 'drift' && !!proj.site && !game.leantos.list.length && W.carried.reduce((n, l) => n + dryness(l, clock.total), 0) / W.carried.length < 0.6 && (sitePile('driftwood', proj.site)?.logs.length || 0) < NEED;
  function* campSpot() {
    const fs = fireSpot(), spots = [];
    for (const r of [2.4, 3.4, 4.4]) for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4 + r, q = openNear(fs.x + Math.sin(a) * r, fs.z + Math.cos(a) * r, 0.4);
      if (q && !W.piles.some(o => Math.hypot(o.x - q.x, o.z - q.z) < 1.8) && !game.fire.fires.some(f => dist(f, q) < 2.2)) spots.push(q);
    }
    spots.sort((a, b) => dist(a, p) - dist(b, p));
    for (const q of spots.slice(0, 3)) {
      if (!(yield* walk(q.x, q.z, { stop: 0.35 }))) continue;
      for (let n = 0; n < 3 && W.load(); n++) { if (!pressKind(['lay'])) break; yield* waitIdle(); }
      if (!W.load()) return true;
    }
    return false;
  }
  function* handoff(why) {
    if (!W.load()) return true;
    return yield* errand(function* () {
      if (cur && !cur.handed) { cur.handed = true; cur.limit = (cur.limit || LIMIT[cur.name]) + HANDOFF_SECS; }
      if (W.log && !W.carried.length && !W.stones.length && why !== 'sleep' && homeSpot().kind === 'leanto') {   // 0.31: a log goes to a log pile at the clearing's edge (never anywhere else but where he stands, when no pile can be had)
        stats.timber.handoffs++; stats.timber.handoffPieces++; ev('handoff', { why, ids: [W.log.id], kind: 'log', to: 'logpile', tag: null });
        if (yield* deliverLog()) { ev('handoff-done', { why, ids: [], left: 0 }); return true; }
      }
      const ids = [...W.carried, ...W.stones, ...(W.log ? [W.log] : [])].map(l => l.id), ck = carriedKind(), t = validTag();
      // 0.29.3 rule restored: wet driftwood (a stroll's, mean dryness under 0.6) goes to the lean-to site as timber while the project still needs driftwood there; never to the fire
      const siteWet = !(t && t.kind === 'home') && wetForSite();
      const dest = t && t.kind === 'home' ? t.dest : siteWet ? () => siteDest(proj.site, 'driftwood', 'branch') : null;
      const to = dest ? 'project' : (ck === 'drift' && wetCarried()) || (t && t.kind === 'tide' && ck === 'drift') ? 'tide' : ck === 'drift' || ck === 'branch' ? 'stock' : 'here';
      stats.timber.handoffs++; stats.timber.handoffPieces += ids.length;
      ev('handoff', { why, ids, kind: ck, to, tag: t ? t.kind : null });
      // a pile farther than HANDOFF_MAX_COST of walking (on another terrace the way round can be many times the distance) counts as out of reach for the handoff, except on the way to bed: the wood is laid down where he stands, a pile of its own
      const spot = to === 'project' ? dest() : to === 'stock' ? fireSpot() : null, open = spot && (openNear(spot.x, spot.z, 3) || spot), away = open && why !== 'sleep' ? path.cost(p, open) : 0;   // (the cost to a free spot beside the pile: a pile or a fire place is a solid)
      if (!(away <= HANDOFF_MAX_COST)) { stats.timber.far++; ev('handoff-far', { why, to, cost: +Math.min(9999, away).toFixed(0) }); yield* layAt(p); ev('handoff-done', { why, ids, left: W.load() }); return !W.load(); }
      if (to === 'project') { const d = dest(); if (d && (yield* toDest(d))) yield* layAt(d); }
      else if (to === 'tide') yield* layTideline(true);
      else if (to === 'stock') yield* deliver();
      else yield* layAt(p);
      if (W.load()) { stats.timber.fallbacks++; ev('handoff-fallback', { why, to, left: W.load() }); yield* campSpot(); }
      if (W.load()) yield* layAt(p);
      ev('handoff-done', { why, ids, left: W.load() });
      return !W.load();
    });
  }
  // wood an emergency made him lay down for a drink: back to it, up with it, and to camp (once: a pile gone, too far or night means it stays where it is, and is simply wood on the ground for the stores)
  function* fetchOwed() {
    const o = owed; if (!o) return;
    owed = null;
    if (W.load() || now - o.t > 1200 || game.sleep.canLie(clock.time)) return;
    const pile = W.piles.filter(q => q.logs.some(l => o.ids.has(l.id)) && inside(q.x, q.z)).sort((a, b) => dist(a, p) - dist(b, p))[0];
    if (!pile || !(path.cost(p, pile) < STOCK_MAX_COST)) return;
    yield* errand(function* () {
      stats.timber.retrieved++; ev('owed-fetch', { ids: [...o.ids] });
      if (!(yield* goStand('take', pile))) return;
      if (pressKind(['pickup'], c => !!c.thing && c.thing.kind === 'pile' && c.thing.pile === pile)) yield* waitIdle();
      yield* handoff('owed');
    });
  }
  function* arrive(kind, c, stroll = false) {   // what he does at the end of a leg (stroll: on a stroll of his own, not at the far end of an exploring trip)
    if (kind === 'shore') { yield* pauseHere(); yield* pickUpDrift(); yield* pickUpWet(); return; }
    if (kind === 'river') {
      const empty = (game.shells.empty() > 0 || game.thirst.days >= THIRST_TOPUP) && !W.load();   // 0.30.4: with wood in his arms a stroll's drink waits (the game would lay the wood down by the water); the drink goal takes it to camp first
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
    if (W.load()) yield* handoff('explore');   // 0.30.4
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

  // ---------- the journey (0.30.19 "Journey") ----------
  // Every 5 to 7 days from day 4, in the morning, when calm: a night away at a spot he does not know, far from home (see the header). The state `journey` outlives the goals (a drink or a meal breaks into it, sleep ends the goal it is in): the idle goal
  // carries it on from whatever phase it is in. 'out' and 'home' are legs on the finder `pathJourney` (the exploring finder with climbing routes of slope under JOURNEY_SLOPE opened: for journeys only), learning what he sees; 'camp' is on ground he knows by then.
  const jo = { x: 0, z: 0, reach: 0 }, jMemo = new Map(), journeyPts = [];
  const journeyGround = (x, z) => { const k = Math.round(x * 2) * 100003 + Math.round(z * 2); let v = jMemo.get(k); if (v === undefined) { const t = terrainAt(world, x, z, 0); v = t.climb <= EXPLORE_ROUTE ? t.s < EXPLORE_SLOPE : t.s < JOURNEY_SLOPE; jMemo.set(k, v); } return v; };
  const pathJourney = createPath(world, { allow: (x, z) => journeyGround(x, z) && Math.hypot(x - jo.x, z - jo.z) <= jo.reach + 20, obstacles: game.movement.obstacles });
  const brakeNow = () => journeyBrake({ thirst: game.thirst.days, hunger: game.hunger.days, raining: game.weather.raining(clock.total) });
  const brakeWhy = () => game.weather.raining(clock.total) ? 'rain' : game.thirst.days >= VERY_AT ? 'thirst' : 'hunger';
  const legBegin = () => { exploring = true; journeyLeg = true; inp.learns = true; fullPace = false; };
  const legEnd = () => { exploring = false; journeyLeg = false; fullPace = false; inp.learns = false; idleInput(); };
  function journeyTarget(home, where, avail) {   // the farthest unknown spot 200 to 420 m from home (coast or forest edge by `where`, as the exploring goals) with a way there that is done by JOURNEY_ARRIVE at the amble and a way back (the planner both ways)
    jo.x = home.x; jo.z = home.z; jo.reach = JOURNEY_MAX + JOURNEY_SPARE;
    const cands = [];
    for (let r = JOURNEY_MIN; r <= JOURNEY_MAX; r += 20) for (let i = 0; i < 24; i++) {
      const a = i * Math.PI / 12 + (r / 20 % 2) * Math.PI / 24, x = home.x + Math.sin(a) * r, z = home.z + Math.cos(a) * r;
      if (!(Math.abs(x) < HALF - 8 && Math.abs(z) < HALF - 8) || known.has(x, z) || !canStand(world, x, z, 0) || !journeyGround(x, z)) continue;
      if (journeyPts.some(q => Math.hypot(q.x - x, q.z - z) < 40)) continue;
      const y = world.H(x, z); if (y < 0.5) continue;
      let bias = 0;
      if (where === 'coast') { if (y < 3) for (let k = 0; k < 8; k++) if (world.H(x + Math.sin(k * Math.PI / 4) * 15, z + Math.cos(k * Math.PI / 4) * 15) < 0.2) { bias = 30; break; } }
      else if (y >= 1 && world.forestB(x, z) >= 0.55) bias = 30;
      if (waterAll.some(q => Math.hypot(q.x - x, q.z - z) < JOURNEY_WATER)) bias += 500;   // fresh water near comes first: a night away is spent by a river (the drink before bed, the drink in the morning), so the candidates near water are tried before the rest
      cands.push({ x, z, r, score: r + bias + 8 * rngJourney() });
    }
    for (const q of waterAll) {   // and the banks of the rivers: a night away is spent by fresh water (the drink before bed and the one in the morning)
      const r = Math.hypot(q.x - home.x, q.z - home.z), st = r >= JOURNEY_MIN && r <= JOURNEY_MAX ? { x: q.x, z: q.z } : null;
      if (!st || known.has(st.x, st.z) || !journeyGround(st.x, st.z) || world.H(st.x, st.z) < 0.5 || journeyPts.some(o => Math.hypot(o.x - st.x, o.z - st.z) < 40)) continue;
      cands.push({ x: st.x, z: st.z, r, score: r + 500 + 8 * rngJourney() });
    }
    cands.sort((u, v) => v.score - u.score);
    const real = cost => cost * JOURNEY_REAL / PACE + JOURNEY_SPARE, homeAvail = (EXPLORE_BACK - JOURNEY_FROM) * DAY_SECONDS;   // the walk at the amble, as it takes in fact (the planner's cost is pessimistic: about three times)
    const cheap = c => dist(p, c) * 1.15 * JOURNEY_REAL / PACE + JOURNEY_SPARE <= avail;   // a first look at the straight line (the planner's way is 1.15 s a metre at the least), then the way itself for the best few
    let tried = 0;
    for (const c of cands.filter(cheap)) {
      if (tried++ >= 12) break;
      const out = pathJourney.find(p, c, 60000);   // (a steep stretch between two cell centres can leave a walk without a plan: then another target)
      if (!out || out.cost < JOURNEY_MIN_COST || real(out.cost) > avail) continue;
      const back = pathJourney.find(c, home, 60000);
      if (back && real(back.cost) <= homeAvail) return { x: c.x, z: c.z, r: c.r, out: out.cost, back: back.cost };
    }
    return null;
  }
  function* journeyBegin() {   // true when a journey is on
    journeyTried = clock.day;
    if (W.load()) yield* handoff('journey');
    const home = fireSpot(homeSpot()), avail = (JOURNEY_ARRIVE - clock.time) * DAY_SECONDS;
    jo.x = home.x; jo.z = home.z; jo.reach = JOURNEY_MAX + JOURNEY_SPARE;
    if (dist(p, home) > JOURNEY_START_NEAR || !pathJourney.find(p, home, 20000)) { cool('journey', 300); ev('journey-none', { why: 'start', away: +dist(p, home).toFixed(0) }); return false; }
    const c = journeyTarget(home, exploreWhere([], stats.journey.started), avail);
    if (!c) { stats.journey.noTarget++; cool('journey', 300); ev('journey-none', { why: 'no-target' }); return false; }
    journeyDue = clock.day + journeyGap(rngJourney()); journeyPts.push(c); exploredDay = clock.day;
    journey = { day0: clock.day, t0: clock.total, phase: 'out', to: c, home, camp: null, max: 0, fails: 0, why: null };
    stats.journey.started++; journey.said = new Set(); think('journeyIntent'); ev('journey', { to: [+c.x.toFixed(1), +c.z.toFixed(1)], dist: +dist(home, c).toFixed(0), out: +c.out.toFixed(0), back: +c.back.toFixed(0), next: journeyDue });
    return true;
  }
  function journeyEnd(why) {
    const J = journey; if (!J) return;
    const hours = +((clock.total - J.t0) * 24).toFixed(1);
    stats.journey.list.push({ day: J.day0, to: [+J.to.x.toFixed(0), +J.to.z.toFixed(0)], dist: +dist(J.home, J.to).toFixed(0), max: +J.max.toFixed(0), hours, nights: J.nights || 0, fire: !!J.fire, wood: J.wood || 0, end: why, endDay: clock.day });
    if (why === 'home') stats.journey.completed++;
    ev('journey-end', { why, hours });
    journey = null; exploredDay = Math.max(exploredDay, clock.day);
  }
  const sayOnce = (J, kind) => { const k = kind + (J.nights || 0); if (J.said.has(k)) return; J.said.add(k); think(kind); };   // 0.30.20: one thought per journey phase (a second night out, or a second walk home, says its line again)
  const turnBack = (J, why) => { J.phase = 'home'; J.why = why; stats.journey.back[why]++; ev('journey-back', { why }); };
  function* pauseJourney(secs) { const until = now + secs; while (now < until) yield; }   // a look about (no chance involved: the stream of the strolls stays as it was)
  function* journeyOut(J) {
    legBegin();
    try {
      const ok = yield* walk(J.to.x, J.to.z, { stop: 2, finder: pathJourney, until: () => brakeNow() || clock.time >= JOURNEY_CAMP });
      if (brakeNow()) { turnBack(J, brakeWhy()); return; }
      if (ok && dist(p, J.to) <= 3) { ev('journey-there', { secs: +((clock.total - J.t0) * DAY_SECONDS).toFixed(0), planned: +J.to.out.toFixed(0) }); J.phase = 'camp'; yield* pauseJourney(4); }
      else if (clock.time >= JOURNEY_CAMP || clock.time >= 0.45) { J.phase = 'camp'; ev('journey-camp-early', { late: clock.time >= JOURNEY_CAMP }); }   // dusk comes (or the way is shut late in the day): the camp is made where he is
      else turnBack(J, 'nopath');
    } finally { legEnd(); }
  }
  // the camp spot near c: known, standable, JOURNEY_HIGH above the sea, ordinary ground (no route, no steep slope), out of the river, clear of trunks and boulders, no drop or rise of JOURNEY_RIM within 2 m (not on a rim), by preference near fresh water he knows
  function journeySpot(c) {
    const wp = waterPts(), cands = [];
    for (let r = 0; r <= 36; r += 3) for (let i = 0; i < (r ? 16 : 1); i++) {
      const a = i * Math.PI / 8 + r * 0.3, x = c.x + Math.sin(a) * r, z = c.z + Math.cos(a) * r;
      if (!inside(x, z) || !canStand(world, x, z, 0) || !ordinary(x, z) || !world.dryOfRiver(x, z, 2)) continue;
      const y = world.H(x, z); if (y < JOURNEY_HIGH) continue;
      if (obstaclesNear(world, x, z).some(o => Math.hypot(o.x - x, o.z - z) < o.r + JOURNEY_BARE)) continue;
      let rim = false;
      for (let k = 0; k < 8 && !rim; k++) for (const d of [1, 2]) if (Math.abs(world.H(x + Math.cos(k * Math.PI / 4) * d, z + Math.sin(k * Math.PI / 4) * d) - y) > JOURNEY_RIM) { rim = true; break; }
      if (rim) continue;
      let wd = Infinity; for (const q of wp) { const d = Math.hypot(q.x - x, q.z - z); if (d < wd) wd = d; }
      cands.push({ x, z, water: wd, score: r + (wd <= JOURNEY_WATER ? wd * 0.5 : 60 + Math.min(wd, 200) * 0.5) });
    }
    cands.sort((u, v) => u.score - v.score);
    const top = cands.slice(0, 10);
    for (const q of top) q.score -= 5 * Math.min(8, scan('drift', q.x, q.z, 40).length + 0.5 * scan('branch', q.x, q.z, 40).length);   // wood to hand: loose driftwood or branches within 40 m
    top.sort((u, v) => u.score - v.score);
    for (const q of top.slice(0, 6)) if (path.cost(p, q) < Infinity) return q;
    return null;
  }
  const campPile = C => W.piles.filter(q => q.kind === C.pk && Math.hypot(q.x - C.x, q.z - C.z) <= 2.4).sort((a, b) => b.logs.length - a.logs.length)[0] || null;
  const campFire = C => game.fire.fires.find(f => Math.hypot(f.x - C.x, f.z - C.z) < 3.5 && (f.fuel > 0.005 || f.embers > 0.005)) || null;
  function* journeyHusk() {   // a nut husked for the fibre of the drill (as `huskGoal`, with none of its marks: a journey is no lack at home)
    return yield* errand(function* () {
      const c = nearestBy('coco', 60); if (!c) return false;
      const near = () => { const a = game.action().tap; return !!a && a.kind === 'husk' && !a.carried; };
      yield* walk(c.x, c.z, { tap: true, stop: 0.4, until: near });
      let k = pressKind(['husk']); if (k) yield* waitIdle();
      if (!k) { yield* walk(c.x, c.z, { stop: 0.2 }); k = pressKind(['husk']); if (k) yield* waitIdle(); }
      if (!k) { markBad('coco', c.o, 600); return false; }
      stats.journey.husked++; return true;
    });
  }
  function woodSupply(kind) {   // the pieces of a kind within reach of the camp job (a way of at most JOURNEY_WOOD_COST), as fuel in pieces of driftwood
    let n = 0;
    for (const c of scan(kind, p.x, p.z, 90).slice(0, 12)) if (path.cost(p, c) <= JOURNEY_WOOD_COST) n++;
    return n * (kind === 'branch' ? 0.5 : 1);
  }
  function* journeyWood(J) {   // a little wood from nearby, laid in a pile at the camp spot (one kind: the arc lights a pile of FIRE_MIN pieces): the kind of which more is near
    const C = J.camp;
    for (let trip = 0; trip < 5; trip++) {
      const have = campPile(C);
      if (have && fuelOfPile(have) >= JOURNEY_WOOD) return;
      let kind = C.pk === 'branch' ? 'branch' : C.pk === 'driftwood' ? 'drift' : null;
      if (!kind) { const d = woodSupply('drift'), b = woodSupply('branch'); if (d <= 0 && b <= 0) return; kind = d >= b ? 'drift' : 'branch'; }
      const near = nearestBy(kind, 45, 4); if (!near || near.cost > JOURNEY_WOOD_COST) return;
      C.pk = kind === 'branch' ? 'branch' : 'driftwood';
      const dest = () => { const q = campPile(C); return q ? { x: q.x, z: q.z, pile: q, room: PILE_FULL - q.logs.length } : { x: C.x, z: C.z, exact: true, pile: null, room: PILE_FULL }; };
      const n0 = campPile(C) ? campPile(C).logs.length : 0;
      const ok = yield* gather(kind, dest, CARRY_MAX, JOURNEY_WOOD_COST, kind);
      const q = campPile(C); J.wood = q ? q.logs.length : 0; stats.journey.wood += Math.max(0, J.wood - n0);
      if (!ok || J.wood <= n0) return;
    }
  }
  function* journeyLight(J) {   // the small fire: fibre and the drill at the pile, as at home; a try may fail, and each costs a tuft
    const C = J.camp;
    if (C.lit) return !!C.fire;
    C.lit = true;
    const pile = campPile(C);
    if (!pile || pile.logs.length < FIRE_MIN || !(game.fibre.carried || game.fire.torch)) { ev('journey-cold', { wood: pile ? pile.logs.length : 0, fibre: game.fibre.carried }); return false; }
    if (pile.logs.reduce((n, l) => n + dryness(l, clock.total), 0) / pile.logs.length < 0.6) { ev('journey-cold', { why: 'wet' }); return false; }
    for (let k = 0; k < 3 && (game.fibre.carried || game.fire.torch) && !campFire(C); k++) {
      if (!(yield* goStand('light', pile)) || !pressKind(['light'])) { ev('journey-cold', { why: 'not-offered' }); break; }
      yield* waitActs(30); yield* waitIdle();
    }
    const f = campFire(C);
    if (f) { C.fire = f; J.fire = true; stats.journey.fires++; ev('journey-fire', { pieces: pile.logs.length }); }
    else { ev('journey-cold', { why: 'failed' }); }
    return !!f;
  }
  function* journeyCamp(J) {   // the night: a spot, fibre, wood, a small fire at dusk, the evening by it (the sleep goal puts him to bed there), and in the morning the way home
    if (cur) cur.limit = JOURNEY_LIMIT;
    if (J.camp && clock.day > J.camp.day && clock.time >= JOURNEY_FROM) {   // slept, and the day is here: home (no turning back: the plan)
      if (!J.camp.fire) { stats.journey.cold++; ev('journey-cold-night'); }
      J.phase = 'home'; J.why = 'morning'; ev('journey-morning', { fire: !!J.camp.fire }); return;
    }
    if (!J.camp) {
      const sp = journeySpot(p);
      J.camp = { x: sp ? sp.x : p.x, z: sp ? sp.z : p.z, day: clock.day, pk: null, fire: null, lit: false, husked: false };
      J.nights = (J.nights || 0) + 1; stats.journey.nights++; sayOnce(J, 'campIntent');
      ev('journey-camp', { at: [+J.camp.x.toFixed(1), +J.camp.z.toFixed(1)], spot: !!sp, water: sp ? +sp.water.toFixed(0) : null, fibre: game.fibre.carried });
    }
    const C = J.camp;
    if (Math.hypot(p.x - C.x, p.z - C.z) > 1.5) { fullPace = clock.time >= EVENING; if (!(yield* walk(C.x, C.z, { stop: 1.0 }))) { C.x = p.x; C.z = p.z; } fullPace = false; }   // (no way to the spot: here, then; in the evening, with the fire still to light, at the normal pace)
    if (!C.husked && !game.fibre.carried) { C.husked = true; yield* journeyHusk(); }
    if (!C.lit) yield* journeyWood(J);
    const look = lookAt();
    while (clock.time < LIGHT_FROM && clock.day === C.day) {   // the afternoon at the camp: he sits and looks out
      if (Math.hypot(p.x - C.x, p.z - C.z) > 6) { if (!(yield* walk(C.x, C.z, { stop: 1.5 }))) return true; }
      setSit(look, 'rest'); yield;
    }
    if (clock.day === C.day && clock.time >= LIGHT_FROM && !C.lit) { inp.sit = false; yield* journeyLight(J); }
    const f = campFire(C);
    while (clock.day === C.day && clock.time < BED_FROM) {   // the evening by the fire (or where the fire would be)
      if (f && Math.hypot(p.x - f.x, p.z - f.z) > SIT_FIRE) { const a = Math.atan2(p.x - f.x, p.z - f.z), q = standNear(f.x + Math.sin(a) * SIT_AT_FIRE, f.z + Math.cos(a) * SIT_AT_FIRE, 1); if (q) { inp.sit = false; yield* walk(q.x, q.z, { stop: 0.5 }); } }
      if (f && Math.hypot(p.x - f.x, p.z - f.z) <= SIT_FIRE) setSit(lookAt(), 'fire'); else setSit(look, 'rest');
      yield;
    }
    return true;
  }
  function* journeyHome(J) {   // the walk home by the planner; the journey ends when he is there
    if (cur) cur.limit = JOURNEY_LIMIT;
    const home = fireSpot(homeSpot());
    sayOnce(J, 'homeIntent');
    legBegin();
    try {
      let ok = yield* walk(home.x, home.z, { stop: 3, finder: pathJourney, until: () => { fullPace = game.thirst.days >= JOURNEY_HURRY || clock.time >= EXPLORE_BACK - 0.15; return clock.time >= JOURNEY_CAMP && dist(p, home) > 40; } });   // (thirsty, or late: at the normal pace)
      if (clock.time >= JOURNEY_CAMP && dist(p, home) > 40) { J.camp = null; J.phase = 'camp'; ev('journey-camp-again'); return; }   // dusk catches him on the way: another night out
      if (!ok && dist(p, home) > 6) ok = yield* walk(home.x, home.z, { stop: 3, finder: path });
      if (!ok && dist(p, home) > 6) ok = yield* walk(home.x, home.z, { stop: 3, free: true });
      if (dist(p, home) <= 6) journeyEnd('home');
      else if (++J.fails >= 3) { stats.journey.stranded++; journeyEnd('stranded'); }
    } finally { legEnd(); }
  }
  function* journeyGoal() {   // the idle goal while a journey is on: carries it on from whatever phase it is in
    const J = journey;
    if (cur) cur.limit = JOURNEY_LIMIT;
    if (J.phase === 'out') yield* journeyOut(J);
    if (journey === J && J.phase === 'camp') yield* journeyCamp(J);
    if (journey === J && J.phase === 'home') yield* journeyHome(J);
    return true;
  }
  function journeyBed() {   // where he sleeps on a journey: by the camp's fire, else at the camp spot, else where he stands
    const C = journey && journey.camp;
    if (!C || Math.hypot(p.x - C.x, p.z - C.z) > 80) return { x: p.x, z: p.z };
    const f = campFire(C);
    const flat = q => q && ordinary(q.x, q.z);   // (a climbing route is no place to lie down: the sleep key is refused there; the fire may stand at the edge of one)
    if (f) for (const [dx, dz] of [[1.4, 0], [0, -1.4], [-1.4, 0], [0, 1.4]]) { const q = standNear(f.x + dx, f.z + dz); if (flat(q)) return q; }
    return standNear(C.x, C.z) || { x: p.x, z: p.z };
  }
  let lastStroll = null;
  // Embers are a small exception to the daytime fire rule: while idle, Dave
  // uses a dry piece already under his arm if he passes his own home fire.
  // He never fetches wood or maintains flames by day, so it cannot become a
  // permanent daytime fire goal or interrupt an errand.
  function feedPassingEmber() {
    const f = fireAt(fireSpot(homeSpot()));
    if (!(!!f && f.fuel <= 0 && W.load() > 0 && dist(p, f) <= 1.2)) return false;
    const w0 = W.carried.slice(), k = pressKind(['feed']);
    if (k) burnedLogs(w0.filter(l => !W.carried.includes(l)));   // (the piece goes on at the next step: counted when it left his arm, usually there)
    return !!k;
  }
  function* idleGoal() {
    if (journey) return yield* journeyGoal();   // 0.30.19: a journey is on: nothing else is an idle pastime
    const h = homeSpot(), t = clock.time;
    if (t >= GAZE_FROM && t < GAZE_TO && gazedDay !== clock.day) { gazedDay = clock.day; yield* handoff('gaze'); return yield* gaze(); }
    const step = homeNext(homeSnap()), need = step ? homeNeed(step, h) : null;   // 0.29.3: the next piece of his home
    if (feedPassingEmber()) { yield; return true; }
    if (W.load() && !(need && need.kind && need.kind === carriedKind())) yield* handoff('idle');   // 0.30.4: wood left in his arms goes to camp, to the pile it belongs to (wet to drying, building timber to the site), before anything else; what the next home trip needs he keeps
    const s = senses();
    if (clock.day >= journeyDue && clock.day !== journeyTried && clock.time >= JOURNEY_FROM && clock.time < JOURNEY_TO && !isCool('journey')) {   // 0.30.19: now and then a journey (calm at home, in the morning, the weather fair)
      const sn = homeSnap();
      if (journeyOk({ day: clock.day, time: clock.time, due: journeyDue, lean: sn.lean, raining: game.weather.raining(clock.total), rainSoon: journeyRain(game.weather, clock.total), thirst: s.thirst, hunger: s.hunger, cool: s.cool }) && (yield* journeyBegin())) return yield* journeyGoal();
    }
    if (need && !crabTripOk(s)) return yield* homeGoal(step, need);
    if (spearMakeOk({ ...s, day: clock.day, lean: homeSnap().lean })) { if (scan('branch', h.x, h.z, SPEAR_RANGE).length && scan('stone', h.x, h.z, SPEAR_RANGE).length) return yield* makeSpearTrip(); cool('spear', 120); }   // 0.30.17: he has no spear and a branch and a stone are at hand
    if (axeNext({ ...axeSnap(), thirst: s.thirst, hunger: s.hunger }) && !crabTripOk(s)) { const r = yield* axeGoal(); if (r !== null) return r; }   // 0.31 "Axe": once the home is complete, the axe and one tree a morning
    if (clock.day !== tideDay && clock.time >= TIDE_ROUND_FROM && clock.time < TIDE_ROUND_TO && now - tideNone > 300 && s.thirst < EXPLORE_THIRST && s.hunger < EXPLORE_HUNGER && !crabTripOk(s)) { if (yield* tideRound()) return true; }   // 0.30.13: the daily round to the strip
    if (clock.day > exploredDay && clock.time >= EXPLORE_EARLY && clock.time < EXPLORE_TO) {   // 0.29.4: now and then he goes exploring
      // 0.30.16: before EXPLORE_FROM only when calm: the home project has nothing to do today (its next piece, as at HOME_FROM, is none: built today, finished, cooling, no camp; the axe's work of 0.31 does not count: it shares the morning with exploring by chance, as the spear and fishing do) and no crab trip is possible or due
      const calm = clock.time < EXPLORE_FROM ? !homeNext({ ...homeSnap(), time: HOME_FROM }) && !crabTripOk(s) && !crabDue({ ...s, total: clock.total }) : undefined;
      const missing = exploreMissing(h), chance = exploreChance({ time: clock.time, day: clock.day, thirst: s.thirst, hunger: s.hunger, last: exploredDay, missing: missing.length, cool: s.cool, crab: crabTripOk(s), calm });
      if (chance > 0 && rngEx() < chance) return yield* exploreTrip(missing);
    }
    {   // 0.30.17: fishing as an afternoon pastime, once a day, its own stream; home before dark
      const chance = fishChance({ ...s, day: clock.day, last: fishedDay, crab: crabTripOk(s) });
      if (chance > 0 && rngFish() < chance) {
        fishedDay = clock.day;
        const o = bestFishSpot(STROLL_MAX_COST);
        if (o && !exploreLate(clock.time, o.cost * 2 + 40)) return yield* fishTrip(o, true);
      }
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

  // 0.30.4 "Timber": every goal but idle (which looks at its own load) starts with the handoff, unless the wood in his arms is what the goal works with, or he is in an emergency
  const usesLoad = name => {
    if (wetCarried() || !(carriedKind() === 'drift' || carriedKind() === 'branch')) return false;
    const s = senses();
    return name === 'fire' ? ['feed', 'gather'].includes(fireStep(s)) : name === 'stores' ? storesStep(s) === 'wood' : false;
  };
  const withHandoff = (name, run) => function* () {
    const emergency = (name === 'drink' && game.thirst.days >= VERY_AT) || (name === 'eat' && game.hunger.days >= VERY_HUNGER_AT);
    if (game.fire.torch && name !== 'fire') yield* plantTorch();   // 0.30.14: a torch left in his hand (a trip cut short) is stuck in the ground first
    if (S.hand && !emergency && name !== 'eat') yield* returnSpear();
    if (A.hand && !emergency && name !== 'eat') yield* returnAxe();   // 0.31: the axe too lies at the camp before he takes up wood (a felling cut short leaves it in his hand)   // 0.30.17: the spear lies at the camp before he takes up wood (a fishing trip cut short leaves it in his hand)
    if (emergency) { if (W.load()) { owed = { ids: new Set([...W.carried, ...W.stones, ...(W.log ? [W.log] : [])].map(l => l.id)), t: now }; stats.timber.skipped++; stats.timber.owed += W.load(); ev('handoff-skipped', { goal: name, ids: [...owed.ids] }); } }
    else if (name === 'idle') { if (!W.load()) yield* fetchOwed(); }
    else if (!usesLoad(name)) { yield* handoff(name); if (name !== 'sleep') yield* fetchOwed(); }
    return yield* run();
  };
  const GOALS = { drink: withHandoff('drink', drinkGoal), eat: withHandoff('eat', eatGoal), sleep: withHandoff('sleep', sleepGoal), idle: withHandoff('idle', idleGoal), fire: withHandoff('fire', () => stuffGoal('fire')), stores: withHandoff('stores', () => stuffGoal('stores')) };

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
    if (cur && (failed || why === 'timeout') && cur.name !== 'idle') cool(cur.name, journey && (cur.name === 'drink' || cur.name === 'eat') ? JOURNEY_COOL : undefined);   // 0.30.19: on a journey a drink or a meal that cannot be had (no water he can reach, no food) is not tried again at once: each try costs the walk its rest
    try { if (cur) cur.it.return(); } catch (e) { /* the generator is gone anyway */ }
    cur = null; mind.goal = null; idleInput(); chose = false; fullPace = false;
  }

  function engage() {
    if (mind.active) return;
    mind.active = true; anchor = { x: p.x, z: p.z }; restUntil = now + 1 + 2 * rand(); mind.resting = true;
  }
  function release() {
    if (!mind.active) return;
    endGoal(); journey = null; journeyLeg = false; headingWanted = null; mind.active = false; mind.resting = false; pressed = null; choice = null; sleepKey = false; inp.up = inp.down = inp.left = inp.right = false; idleInput(); inp.sit = false; inp.pace = 1;
  }

  function step(dt) {
    if (!mind.active) return;
    now += dt;
    if (journey) journey.max = Math.max(journey.max, Math.hypot(p.x - journey.home.x, p.z - journey.home.z));
    if (headingWanted !== null) inp.yaw = headingWanted;   // a lean-to being started opens the way its site was validated (main sets the view's yaw each frame, before this)
    if (p.sitting > 0.5) stats.sitSecs += dt;
    if (game.sleep.asleep || p.lie > 0) {   // never wakes him, never acts in his sleep
      if (cur) endGoal(); idleInput(); inp.sit = false; pressed = null; choice = null; sleepKey = false;
      if (game.sleep.asleep && p.lie >= 1) slept = { x: p.x, z: p.z };
      return;
    }
    if (busy()) return;   // kneeling or bending: the game finishes it
    if (tag && !W.load() && now >= tag.until) tag = null;
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
  mind.path = path; mind.strollCands = strollCands; mind.leantoSites = leantoSites; mind.tideSpot = tideSpot; mind.materialFind = (kind, range) => nearestBy(kind, range); mind.timberPlan = (src, n, o) => selectStops(src, n, o).sort((a, b) => b.cost - a.cost);
  mind.exploreAim = (day, time, where = 'coast', avail = (EXPLORE_BACK - time) * DAY_SECONDS) => { const home = fireSpot(homeSpot()); exo.x = home.x; exo.z = home.z; exo.reach = exploreReach(day); return exploreTarget(home, exploreReach(day), where, avail); };   // 0.30.16: the spot a trip would aim for on that day at that time of day (tests; no side effects but the trip's own bookkeeping of exo)
  mind.journeyAim = (day, time, where = 'coast', avail = (JOURNEY_ARRIVE - time) * DAY_SECONDS) => { const home = fireSpot(homeSpot()); return journeyTarget(home, where, avail); };   // 0.30.19: the spot a journey would aim for (tests; the rings it looks at are the PRNG's)
  mind.axePlan = axePlan; mind.logDest = () => { const h = homeSpot(); return h.kind === 'leanto' ? logDest(h) : null; }; mind.axeSpot = axeSpot; mind.axeSnap = axeSnap;   // 0.31: for the tests
  mind.siteReason = siteReason; mind.existingSite = existingSite; mind.homePlan = () => { const h = homeSpot(), sn = { ...homeSnap(), time: HOME_FROM, day: Math.max(clock.day, HOME_DAY), builtDay: -1, cool: {} }, step = homeNext(sn); return { step, need: step ? homeNeed(step, h) : null, site: proj.site, snap: sn }; };
  return mind;
}
