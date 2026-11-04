# Release log

Each push that delivers something gets a version number and a short name, shown in the developer panel. Newest first.

## 0.27.1 "Husk" — 2026-11-04

- Fix: fibre no longer depends on hunger. At a coconut on the ground a short press always husks it (4 s) and gives a tuft when there is room; then he eats the nut when hunger is above half a day, or else carries the husked nut (at most 2; with 2 carried he eats it). In 0.25 a player who was not hungry and had a tuft picked nuts up whole and could not gather more fibre.
- A carried nut is already husked: eating it takes 2 s (`EAT_TIME` in `game/shells`), only when hungry, with no extra tuft; he keeps the shell. Carried nuts from older saves count as husked.
- Gone: the separate `take` of a whole nut and its button icon (`fibre.pick`).
- Tests: `tests/shells.test.js` and `tests/action.test.js` follow; 811 tests in all.

## 0.27 "Home" — 2026-11-04

- New materials: fallen palm fronds under about 1 palm in 3 (seed 1337: 561, 66 within 100 m of the start; back 4 to 6 days after taken; carried like wood, at most 3 together with wood and branches, always dry, not fuel; `game/fronds`) and stones at the foot of boulders and crags and along river banks (2522, 309 within 100 m; at most 2 carried apart from the wood, each slows like a piece of wood; no regrowing; `game/stones`). Both have their own piles (at most 12, tally marks), row drawings and a look on the ground (`render/finds`).
- Shelter upgrades, each once per finished lean-to, by a hold or F within 2.2 m of it with the materials in piles within 3 m; 30 s of work in steps, half the lean-to's rest cost, progress kept when he walks off (`up` per lean-to). The first affordable one is built, in the order walls, bed, ring; a new lean-to comes before an upgrade, an upgrade before lighting a pile.
  - Side walls (6 fronds): wood stays dry within 2.5 m (was 1.5) and a fire within 3 m (was 2); the cold sleep under it is 7 hours and leaves him 87.5 % rested (`WALLS_SLEEP`; a bare lean-to gives 6 hours and 75 %).
  - Bed (4 branches and 4 fronds): rest comes 1.25 times as fast when he sleeps under that lean-to.
  - Stone fire ring (8 stones), 2.2 m in front of the open side: a fire within 1 m of its middle burns 1.5 times as long, and rain neither speeds it up nor puts it out.
- Save: optional `fronds`, `stones`, `wood.stones`, the new pile kinds and `up`; older saves load; `momentKey` follows finished upgrades.
- Smoke: a new section builds the three upgrades (smoke-39, smoke-40) and shows a frond and stones on the ground and carried (smoke-41, smoke-42). Fixed: the check on carried branches had failed since 0.22.2 (it did not count the driftwood that joined the row then) without being noticed.
- Tests: `tests/upgrades.test.js` (new, 30). 809 tests in all.
- Known: at game zoom the walls read as a fringe and are hard to see from the front; fallen fronds look like tan triangles (see *Bugs, later* in the handover).

## 0.26 "Inland" — 2026-11-04

- New: food away from the coast (`game/forage`, pure; derived from the bushes of the world like branches from the trees, so the generated world is unchanged).
- Berry bushes: 1 in 4 lowland bushes bears red and dark purple berries (seed 1337: 472, the nearest 36 m inland from the start, 78 within 100 m; none on the beach). A press beside one picks a handful: eaten at once when hunger is above half a day (1/3 day of hunger less), otherwise carried (at most 2, a berry cluster in the row). The bush bears again 2 to 4 days later; a carried handful spoils after a day (`render/berries`).
- Wild bananas: rare plants beside rain forest bushes (seed 1337: 10, the nearest about 90 m from the start). A false trunk of about 2 m, six or seven long arching paddle leaves (one or two older ones hanging and torn) and a bunch of four tiers of green-yellow bananas with a purple bud on a curved stalk to one side (`render/bananas`). A press picks the bunch: eaten at once when hungry (a whole day of hunger less), otherwise carried (at most 1, row drawing). It grows back in 7 to 8 days; a carried bunch keeps 3 days.
- Priorities: a bush or banana plant competes by distance with the other things near him. With empty hands and nothing near, a full shell (when thirsty) comes first, then carried berries, then a carried bunch, then a carried coconut (what spoils first is eaten first). Icons: a berry cluster and a bunch with an arrow up for picking, the plain drawing for eating a carried one.
- Save: optional `berries` and `bananas` (`{ carried, picked }`); older saves load; `momentKey` counts them.
- Not done: clicking a bush or banana plant does not walk to it (the action button beside it does the picking). The banana bunch hangs to a side fixed per plant, so from some view angles it is behind the trunk.
- Tests: `tests/forage.test.js` (new, 25); the smoke test picks berries from the nearest bush (smoke-37, smoke-38). 779 tests in all.

## 0.25 "Shell" — 2026-11-04

- New: storing water and coconuts (`game/shells`, pure). After eating a coconut (husked on the ground or carried) he keeps the empty half shell, at most 2 (`SHELL_MAX`); shells do not count as wood and do not slow him.
- Filling: at river water (where drinking is offered) a short press drinks when thirst is above 0.1 day (`DRINK_AT`), otherwise it fills an empty shell (`fill`, 2 s kneeling; wood is laid down and a torch planted first, as for drinking). Without an empty shell it always drinks.
- Drinking a shell: with empty hands, out of the water and nothing else offered, a short press drinks a full shell when thirst is above a quarter day (`SIP_AT`): half a day of thirst less (`SIP_DRINK`, never below 0), 1.5 s. Water does not spoil. A press for wood is never taken by a drink.
- Coconuts: at a nut on the ground a press husks and eats it when hunger is above half a day (`EAT_AT`), when he has no fibre at all (so a fire can always be started) or when he already carries 2 nuts; otherwise he picks it up (`take`, at most 2, `NUT_MAX`). A carried nut is eaten later by a press with empty hands when hungry or without fibre (same `HUSK_TIME`, food, drink and tuft); a full shell comes first when he is also thirsty. Carried nuts do not spoil; a taken nut regrows like a husked one (`fibre.pick`).
- Row: a small coconut, an empty shell and a full shell (a wavy water line) after the crabs. Button icons: `take` (a nut with an arrow up), `fill` (a shell with a drop), `sip` (a tilted full shell); eating a carried nut uses the half coconut. He kneels in the drinking pose for fill and sip. No new sounds.
- Save: optional `shells: { full, nuts }`; older saves load; `momentKey` counts them.
- Tests: `tests/shells.test.js` (new), `tests/action.test.js`, `tests/fire.test.js`, `tests/hunger.test.js` follow; the smoke test keeps a shell after eating a nut and checks the row (smoke-36). 754 tests in all. Filling and sipping are covered by unit tests only, not the smoke run.

## 0.24 "Lean times" — 2026-11-04

- Food is scarcer, so finding it takes a little searching every day. Coconuts: only the first nut of a palm is kept, and only for a third of the palms that have nuts (`nutsOfTile` and `NUT_SHARE` in `game/fibre`, by a hash of the seed, the tile and the palm), so about 1 palm in 5 has one nut (seed 1337: 339 nuts on 1680 palms, was 1961). A nut grows back after 6 to 10 days (was 3 to 6). Thinned in the game layer: the generated world and its fixture are unchanged; taken ids of nuts that no longer exist are dropped when an old save loads.
- Crabs: at most 2 colonies per beach tile (`COLONY_MAX`, was 6) with 2 or 3 crabs each (was 3 to 5); seed 1337 has 123 colonies and 311 crabs (was 242 and 1063). A caught crab comes back after 5 to 8 days (was 3 to 5).
- Near the start of seed 1337: 4 nuts and 7 colonies (18 crabs) within 50 m, 27 nuts and 17 colonies within 100 m.
- Tests and the smoke script read nuts through `nutsOfTile` / `fibre.groundCocos`; new tests for the share, one nut per palm, determinism, regrow times and colony sizes.
- Docs: design.md gets an "Agreed, not built yet" section (0.25 "Shell", 0.26 "Inland", the shelter upgrades).

## 0.23 "Breath" — 2026-11-04

- Running: 5.5 m/s (was 3.9, almost twice walking at 2.9), but no longer without end. New pure module `game/breath`: about 12 s of running from full (`RUN_TIME`); needs and load make it run out faster (the drain is divided by the walking factor of load × tiredness × thirst × hunger, not below `MIN_STRAIN` 0.4, so at the worst about 5 s). Out of breath he walks by himself, whatever is asked (Shift, double tap, the thumb stick's rim), until breath is back at 40 % (`RESUME`). Breath comes back in 8 s walking and 5 s standing, kneeling or asleep. Not saved: he starts with full breath.
- No meter: below 30 % breath his running stride shortens, down to 75 % at empty; out of breath you hear him pant softly (`pant` in `audio/mix`, a filtered-noise breath in `audio/sound` about every 0.8 s).
- Tests: `tests/breath.test.js` (new), `tests/movement.test.js` and `tests/sound.test.js` follow.

## 0.22.4 "Above water" — 2026-11-04

- Wood: a piece that still sticks out of the water can be found and picked up; only wood the sea covers wholly is out of reach. The top of a log is `logTop(log) = log.y + TOP_K * log.rad` (`TOP_K` 1.7, as the renderer lifts it), and `wood.find` skips a log only when the sea is at or above that top. The action button, tap-to-walk and `take` all follow. A log that shows lies at most 0.22 m deep, below `WADE_MAX`, so he can always stand beside it.
- Wash-up: new wood is only placed where the whole log is under water at high water, so it is still never seen to appear.
- Unchanged: the sea covering a log's spot still restarts its drying.
- Tests: `tests/tide.test.js` (sea above, level with and just below the top; the water depth at a log that shows; washed-up wood wholly covered at high water).

## 0.22.3 "Speaker" — 2026-11-04

- Sound: the small ink speaker above the moon now shows on every device, not only on touch-only ones; a click on it turns sound on or off like **M** (`src/main.js`, `render/soundMark`).

## 0.22.2 "Clearer finds" — 2026-11-04

- Crab catch: a failed dig is now visible. The crab pops out of the sand 0.5 to 1 m from the hole on the far side from him, scuttles away from him (3.4 m/s) and dives into another hole of its colony 2 to 4.5 m on, or digs in on the sand. It then stays hidden three times as long (30 to 60 s) and cannot be dug for (`wildlife.escape`, `ESC_POP`, `ESC_RUN`, `ESC_SPEED` in `game/wildlife`). A crab away from its home hole drifts back toward it. The chance is unchanged (0.5).
- Inventory: driftwood carried now shows in the row, one small ink log per piece (rounded ends, two grain lines), before the branches; wet and dry look the same (`render/carryMark`, item `driftwood`).
- Fish: the fish were black in every version until now, whatever their colour said: `setColorAt` ran while the pool's count was 0, so three r128 made an empty instance-colour buffer. The buffer is now made by hand. Fish are a soft teal (`0x3f8189`, opacity 0.58), about 30 % darker than the water by day and 20 % at dusk, and their fade to pale shows too. This is the likely reason they were not seen on phones (small black shapes at low alpha on a pale sea).
- Camera: the depth range is 30 to 760 instead of 1 to 4000 (`depthRange` in `render/camera`), so a 16-bit depth buffer resolves about 1 cm instead of 6; the fish material has a polygon offset. Safety margins; not checked on a real phone.
- Lean-to: the palm fronds lie on the roof branches instead of floating 0.5 to 0.6 m above them. Each frond starts on the ridge and follows the roof's slope line (`roofLine`, `frondProfile`, `FROND_SY` in `render/leanto`); its pose does not depend on the build stage.
- Tests: `tests/crab.test.js` (a failed dig), `tests/render.test.js` (driftwood in the row), `tests/leanto.test.js` (fronds on the roof line), `tests/view.test.js` (depth range). 712 tests in all.

## 0.22.1 "Loose ends" — 2026-11-04

- Rain: loose wood anywhere on the island now gets wet from a shower, not only within 40 m of him. Far wood is caught up lazily: `weather.lastFall(total)` (new, `game/weather`) gives the end of the latest shower, and `wood.rain(..., lastFall)` soaks wood in the open that comes within reach as of that moment, as long as less than its drying time has passed. Washed-up wood (few pieces) is wetted wherever it lies. A shower he slept through also wets loose wood in the open now (not piles or carried wood, which can have been moved since). Caveat: the shelter check uses the lean-tos that exist at catch-up time.
- Rain: a regrown branch starts dry. `branches.update` replaces the old object with a new one without `t`, carrying `g`, the day it grew, so rain from before it grew does not count. Caveat: `g` is not saved.
- Low water finds: wood that washes up during a fast-forward sleep, after the high water has passed, gets its drying start at the last moment the sea still covered that spot (`washUp(n, avoid, total)` and `lastCovered` in `game/wood`), so it is never dry too early.
- Tiles: no GPU leak was found (headless memory count stable over 4 rounds of walking 200 m away and back). A tile build that is dropped before it is finished is now cancelled: `job.cancel()` in `core/slicer` closes the generator, `render/streaming` cancels, and `render/nearTile` disposes what it had made.
- Build: `dist/driftwood.html` now starts with `<meta charset="utf-8">` (`scripts/inline.js`), so the dev panel no longer shows garbled characters when it is opened from disk.
- Tools: Vitest 3.2.7 to 5.1.0; `npm audit` reports 0 vulnerabilities; no config changes.

## 0.22 "Crab catch" — 2026-11-04

- New: crabs can be caught and eaten, the second food after the coconut. Digging: beside a hole a crab has just fled into (the crab stays in its hole while he is within 5 m, as always) a short press of the action button makes him kneel and dig for 5 s (work kind `dig`, icon a hand with claws over a hole); the dig catches with chance 0.5, fixed by the seed and the number of digs so far (`game/crabs`, like `fire.attempt`, so it cannot be repeated for luck); a failed dig sends the crab out of the back (`wildlife.escape`: it stays hidden three times as long and is no longer there to dig for). More crabs are out at low water, so there are more fled crabs then.
- Carrying: at most 2 crabs, a small crab each in the row of what he carries (ink like the other drawings); separate from `CARRY_MAX` and no slowing. A crab carried one game day goes bad and leaves the row.
- Eating: never raw. Beside a fire with flames (not embers) a short press makes him kneel 8 s (work kind `roast`, icon a crab over a flame) and eat the crab carried longest: `hunger.eat(CRAB_FOOD)` takes 2/3 day off (the coconut stays 4/3; `hunger.eat` gets an optional amount). Choices: dry wood in his arm still feeds the fire first; otherwise roast comes before taking a torch at the same fire, and a nearer coconut or hole wins; no torch in his hand for either. If the flames are gone when the 8 s end, the crab is kept.
- Colonies: a caught crab is gone from its colony (`wildlife.update` is given `gone(id)`) and comes back 3 to 5 days after it was caught, one crab at a time, so a colony caught empty grows back.
- Sound: a short scrape while digging and a sizzle while roasting (work sounds of `audio/sound`, kinds `dig` and `roast`).
- Save: optional `crabs: { carried, gone, digs }`; older saves load; `momentKey` counts crabs carried and gone.
- Structure: new pure module `game/crabs`; `game/wildlife` gets `hiding`, `isHiding`, `escape` and the `gone` test; `game/game` the tap kinds `dig` and `roast`; `render/carryMark` the `crab` drawing (`CRAB_PATHS`), `render/actionButton` the icons `dig` and `roast`; `render/hero` kneels for both (no new animation).
- Tests: `tests/crab.test.js` (24), `tests/action.test.js` and `tests/wildlife.test.js` follow. 701 tests in all. Smoke: at low water he scares the crabs, digs at a hole (a dig number that catches is chosen), carries the crab in the row, roasts and eats it by a fire (smoke-34 the dig icon, smoke-35 the crab in the row and the roast icon).
- Not heard or tried by hand by the maker: the sounds, and how often a person finds a crab in a hole in real play (the fled crab must be walked up to; the dig icon is a hand over a hole and reads less clearly than the roast icon).

## 0.21 "Rain" — 2026-11-04

- New: showers of rain, about once a week. The first shower starts 5 to 9 days in, each next one 5 to 9 days after the start of the last, one to two hours of game time (one to two minutes of play) with a soft start and end of ten game minutes and a strength of 0.75 to 1 of its own; all fixed per island by the seed, so never in the first two days and nothing to save for the schedule. `game/weather` (pure): `createWeather(seed)` with `showers`, `intensity`, `raining` (from 0.25), `shower`, `next`; `game.weather` and `game.rain`. On seed 1337 the showers start at day 7.97, 14.55, 22.62, 30.40, 38.14 and so on.
- Wood in the open gets wet (`wood.rain`, about every 0.4 s of game time, only near him: loose wood within 40 m, every pile, what he carries) by setting `log.t` to now, so it dries again through the existing dryness (a day for driftwood, `BRANCH_DRY_DAYS` half a day for branches, new). Wood within 1.5 m of a finished lean-to (`leantos.covers`), also what he carries while he stands there, stays dry; a half-built one gives no roof. Start wood and branches that got wet are saved in the optional `wet` field of the wood's save (wood washed up since the start has its `t` already).
- Fire: a fire in the open burns down 3 times as fast in the rain and goes out after fifteen game minutes of rain (about fifteen seconds of play) with a puff of steam and a hiss, leaving a burnt place with `wet: true` (wet ash, darker); a shower that ends first lets it live (the count `rained` starts over, saved as an optional field). A fire within 2 m of a finished lean-to is untouched. Torches, carried and planted, burn twice as fast in the rain (not within 2 m of a finished lean-to, for the carried one by where he stands). `fire.update(days, rain, at, total)`, `fire.hissed`, `fire.hissAt`.
- Look (`render/mood`, `render/rain`, `render/water`, `render/materials`): the sun at half strength and greyer, the sky fill greyer and a little stronger, colours at 0.6 saturation, a grey-blue grading, so the shadows soften; a layer of thin slanted streaks (a 2D canvas above the scene, at most 220 streaks, 220/220/160/110/70 for the quality levels, `rainStreaks` in `settingsFor`); rings on the sea and the rivers (`uRain` and `rainRings` in the water shaders); the ground 16 % darker with a soft sheen band (`uWet` in `terrainMat`, one shared uniform). On at every quality level, not activity for the frame pacer.
- Sound (`audio/mix`, `audio/sound`): the `rain` layer of 0.20 now plays: noise through a high-pass at 600 Hz and a low-pass at 7.5 kHz with a faint patter, `LEVELS.rain` 0.16 times the intensity; under a lean-to (within 1.5 m) 0.45 of it with the low-pass at 1.9 kHz; and a one-shot hiss (`LEVELS.hiss` 0.3, heard within 30 m, louder close) for each fire the rain puts out. The levels are set by reasoning, not by ear: the user listens.
- Tests: `tests/rain.test.js` (29), see `docs/architecture.md`; `tests/quality.test.js` and `tests/sound.test.js` follow the new settings and the rain layer. 677 tests in all. Smoke: the first shower reaches the game from the clock, smoke-32 (rain by day on the start beach) and smoke-33 (dusk, a lean-to with a fire by it that burns on, an open fire that goes out and leaves wet ash, a dry pile under the roof and a wet one outside).
- Cost measured here (graphics card, one render of the settled view including the wait for the card): 3.7 ms dry, 3.9 to 4.7 ms in full rain (the rings and the ground are a few lines of shader, the streaks one clear and two strokes of at most 220 lines).

## 0.20 "Sound" — 2026-11-04

- New: the island has a sound, all made in the browser with Web Audio (one buffer of pink noise, filters, simple oscillators, envelopes), no sound files, so the single-file build is unchanged. Quiet on purpose: master gain 0.5 into a soft limiter, every layer's peak in one table (`LEVELS` in `audio/mix`).
- Layers (`audio/mix` decides, `audio/sound` plays): surf (low-passed noise, loud at the water's edge, about a third at 20 m, a fifth at 40 m, gone at 100 m from the sea, darker further off; swells and falls with `breath` of `render/water`, read from the water's own clock `view.waterTime`, with a faint hiss on the crest); river murmur within 12 m of a river (louder and brighter at fords, louder with a deeper rush and a longer reach at falls, a babbling second voice); wind (band-passed noise following `windLevel` at his place: the gusts, the strength per height, calmer at night), a rustle of leaves when palms and trees stand within 14 m, and on the summit a narrow wavering howl; fire (a low flutter and random crackles whose number grows with `fire.strength`, embers hush, planted torches and the torch in his hand; gone beyond 15 m); footsteps (one per half walk cycle of `player.phase`: dry sand, wet sand, water, grass or forest floor; a run louder; tired, thirsty, hungry or a load make them lower, longer and louder); work (husking tears and thumps, drilling a rubbing that rises as the glow nears, building knocks; drinking none); gulls (gliding cries when birds are within 30 m, a landed flock loud, circling ones rare and faint); crickets (short pulse trains of four voices in the forest from dusk to dawn only); rain (an empty gain node and a `rain` target of 0, for 0.21).
- Switching: `M` toggles sound (not while typing the name, not with a modifier); on touch-only devices an ink speaker mark `#sound` above the moon (`render/soundMark`, crossed out when off, larger tap area) does the same; the choice is kept in `localStorage` under `driftwood-sound` (default on; broken storage tolerated, `audio/pref`). Sound starts with the first key, tap or click (capture phase on `window`, so answering the name question counts); a hidden tab or switching off fades the master out and suspends the context.
- Structure: new layer `audio/` beside `render`: `audio/mix` (pure), `audio/sound` (the only module with `AudioContext`), `audio/pref` (pure, storage handed in); `render/water` gets a `clock` getter and `islandView` a `waterTime` getter; `main` wires it (`__driftwood.sound`, `__driftwood.soundSwitch`).
- Cost measured here: the mixer 0.002 ms a frame, the look round him (four times a second) 0.04 ms, `sound.update` 0.03 ms on average (0.4 ms at most, the timer's resolution); the audio runs on the browser's audio thread. Nothing is called while sound is off or the tab hidden.
- Levels were set by reasoning, not by ear: the user listens and judges the mix.
- Tests: `tests/sound.test.js` (28), see `docs/architecture.md`. Smoke: after the first key the audio context exists and M flips the sound off and on again, without page errors.

## 0.19 "Wind" — 2026-11-03

- New: the plants on the detailed tiles sway in the wind, atmosphere only. Palm fronds most (tips up and down and a little sideways, the top of a palm bends slightly, up to 0.012 m per metre of its height), broadleaf and rain forest crowns rock as a whole with the clumps a little apart, pines, bushes, ferns, leaf fans, grass and reeds a little; trunks, branches, rocks, driftwood, the lean-to (its fronds too) and all far tiles stand still. Outlines move with their plants.
- The wind (`render/wind`, pure, `windState(seed, t, total, day)`): direction fixed per island by the seed and turning +-0.45 rad (26 degrees) once round a game day; a calm base (level 0.22) plus gusts: one about every 32 s (+- 8), starting 420 m upwind and travelling at 12 m/s as a bump 40 m wide, strength fixed by (seed, number) with about a fifth of them nothing, at most 3 alive (slots). So a gust reaches the trees further off first. Strength by the height of the ground (`tierStrength`, smooth between terraces): coast 1, lowland 0.75, rain forest 0.12, plateau 1.5, summit 1.8; calm 0.4 at night. Largest movements: a frond tip 0.2 m, a crown 0.11 m, grass 0.09 m (bounded in the tests).
- Done in the vertex shaders (`render/windShader`): `onBeforeCompile` replaces `<project_vertex>` (displacement after the instance matrix from the instance position, so neighbours differ, the tier at its height and a weight of the vertex: fronds and blades move at the tip, pine cones towards the top) and the shadow look-up after `<worldpos_vertex>`. One set of shared uniforms (time, direction, calm, three gusts) written once a frame in `islandView.render`. New kit materials per kind (`pineMat`, `bushMat` next to the swaying `canopyMat`, `palmTrunkMat`, frond, grass and fern ones); `farCanopyMat`, `frondStillMat` and `frondStillDepth` stay still for the far tiles and the lean-to. Palm trunk segments and fronds carry the instanced attribute `aWind` (`render/batch`, own copy of the shape per tile).
- Shadows move too: every swaying material has a `userData.depthMat` (a `MeshDepthMaterial` with the same displacement, the fronds' with their map and alpha test) that `render/batch` sets as `customDepthMaterial`, and the receiving side looks its shadow up at the displaced place, so no self-shadow acne. The 0.14.2 filter is unchanged; two frames at the same wind time are identical, shadows only move with the plants.
- Quality: on at every level; before and after measured at the start view (1280x800, desktop card, `gl.finish` after each render): 10.1 / 6.9 / 1.1 ms before, 10.4 / 7.0 / 1.2 ms after for the first, second and third series of 90 frames (the card clocks up), the same at level 4. Wind is not activity for the 15 fps idle rate. The wind clock runs with the drawn dt (`view.windTime`); `__driftwood.draw` sets it to 20 s, so the smoke shots are repeatable, and a sped-up sleep does not make gusts race.
- Pines also sway a little although the first plan named only palms, trees, bushes and grass.
- Tests: `tests/wind.test.js` (20): see `docs/architecture.md`.

## 0.18 "Low water finds" — 2026-11-03

- New driftwood no longer lands on the dry beach: each high water places it (same numbers as before: one or two pieces per beach tile, never more than the tile had at the start) in the strip between the low-water and the high-water line, on gentle ground and not in a river, while the spot is under water, so you never see it appear. On seed 1337 35 of the 49 tiles with start wood have such a strip, 149 pieces of the 214 can be refilled; the other 14 tiles get no new wood.
- At low water the wood lies out on the wet sand or in the shallows and is picked up as usual (also standing in shallow water). While the sea covers its spot it cannot be picked up (`find`, `take`, so also click targets and the action button's pickup skip it) and it shows faintly through the water.
- Wood in the strip stays wet: `wood.tideUpdate(sea, total)` sets `log.t = total` of every washed-up piece under the sea (not those carried), so its drying starts over each time the sea covers it. Carried up above high water it dries as before. No damp patch under wood in the strip. Left wood stays across high waters; start wood on the dry beach is unchanged; piles in the strip are still taken by the flood. Nothing new in the save (`t` was saved already); old saves load.
- Tests: strip spots only, not pickable when covered and pickable at low water (also through the action button), stays wet while covered and dries once carried, left wood stays, cap respected, start wood unchanged, save round trip.

## 0.17.6 "More fish" — 2026-11-03

- Why fish were skipped near the start of seed 1337: river groups sat at every 9th river point and 20 % of those were dropped by the seed, so along the last 40 m of the river before the mouth (the wide, slow stretch where he starts, 4 to 9 m wide, 0.6 to 1.1 m deep) only three groups were left, and the mouth was excluded outright (`k < kMouth - 3`); past the mouth the channel is a strip about 8 m wide, which the random sea rules (random points per 40 m tile, bed 0.55 to 3 m deep) practically never hit. The depth and width checks themselves were not the cause.
- River groups: 92 % of the points kept (was 80 %), up to the mouth (still every 9th point), depth up to 1.5 m allowed (was 1.2), fish spread over up to 1.5 m across (was 0.8), 2 to 4 fish per group (was 2 to 5). New: river mouth groups of 2 to 4 sea fish along the channel from the mouth out to sea (kind `sea`, ids `1050000 + k`, every 8th river point, same bed range `SEA_FISH`, PRNG per river point). Seed 1337: 340 groups (16 river, was 15), 21 within 40 m of the start beach, about 10 fish in one view of the river; the island and its fixture are unchanged.
- Sizes: river and lagoon fish 35 to 50 cm, sea fish 40 to 60 cm (`FISH_LEN`, `SEA_LEN` in `game/habitats`), same dark silhouette. A first try at 1.5 times bigger (68 to 112 cm) was too big, the fish read as sharks next to the castaway, so the fix is placement, not size; note these sizes are slightly smaller than 0.17.3's 45 to 65 and 50 to 75 cm. The pool holds 192 (was 128).
- Tests: fish in the wide stretch and in the mouth, sizes, fixture unchanged; the Lat check skips mouth groups (the carved channel has Lat about 0). Smoke: the fish shot (`smoke-28.png`) also requires river or mouth fish within 30 m.

## 0.17.5 "Palm roof" — 2026-11-03

- Look only. The lean-to roof is now seven thin, uneven branches (was twelve; spacing, slant, length and thickness vary, seeded by position) with, as a last building step from progress 0.84, five big overlapping palm fronds laid over the ridge and branches one by one (`leantoFronds` in `render/leanto`; the palms' own frond geometry, material and tints, no outline). Seen from the default camera it reads as a roof of fronds, no longer as a gate or fence. No new material, no new rules, nothing in `game/`; the save format is unchanged.
- Tests: `tests/leanto.test.js` (roof branch count, no fronds before the roof is done, fronds appear one by one up to five). Smoke: `smoke-22.png` and `smoke-23.png` show it.

## 0.17.4 "Fireflies" — 2026-11-03

- New: fireflies, atmosphere only. Groups of 10 to 30 at forest edges (forest density in the transition range with at least two trees within 7 m) and along river banks, in the lowland and rain forest only (tiers 1 and 2, ground at least 1 m above high water: never the open beach, plateau or summit), fixed per island by the seed (`firefliesOfTile` in `game/habitats`, own PRNG streams, derived from existing world data: the island and its fixture are unchanged). Seed 1337: 81 groups (70 edge, 11 river), 1580 fireflies.
- Behaviour in `game/fireflies` (pure, `game.fireflies`, not saved): out from dusk to an hour before sunrise (`activity(time)`: in over 0.04 day after sunset, out over the 0.04 day before that hour, none by day); each drifts 0.3 to 2 m above the ground and up to about 1 m sideways, blinks slowly in its own rhythm (1.6 s of light every 3 to 6 s, faint glow between), a third of a group flashes together every 30 to 70 s, and within 3 m of him a firefly is pushed away (at most 3.5 m) and drifts back with a time constant of 3 s. Only within 30 m.
- Drawing in `render/fireflies`: a transparent 2D canvas over the picture, above the night grading (as the fire glow), additive, one baked sprite (warm yellow centre, soft halo) per firefly, at most 300 a frame; no point lights, nothing in the 3D scene, so the light count stays constant. By day the list is empty and the canvas is hidden. Like the fire glow it ignores scene depth. They do not count as "something happening" for the 15 fps idle rate.
- Cost (desktop card, 1280x800, seed 1337, walking among about 215 listed fireflies at night): 60 fps, 2 to 3 ms work per frame between tile-building spikes, the same as the same place by day.
- Tests: `tests/fireflies.test.js` (placement seeded and island untouched, groups of 10 to 30, only tiers 1 and 2 and never on the beach, activity by time, blinking within bounds and slow, synchronized flashes, drifting aside and back, nothing beyond 30 m, not saved, not counted as activity). Smoke: `smoke-29.png`, a night shot among a river group (also in the quick run); the smoke test restores the clock afterwards, so the tide of the later shots is unchanged.
- README: one paragraph on the fireflies.

## 0.17.3 "Restless" — 2026-11-03

- Fish: why the user saw none (checked on seed 1337): only 23 groups on the whole island, 2 within 30 m of the start beach (the nearest 18.7 m away, outside the view) and 3 within 30 m of the brook at (-77, 180), none in the open sea, and small (30 to 45 cm), light (opacity 0.62) shadows. Drawing was not the problem: the fish plane lies 1.5 cm above the river surface and 3 cm above the sea, drawn after the water meshes (render order 5, no depth write), and fish are listed within 30 m as designed.
- Now 337 groups (15 river, 32 lagoon, 290 sea; 11 within 30 m of the start beach, 13 within 30 m of the brook): river groups about every 9th point (was 14, 80 % kept, was 55 %), lagoon tiles keep 50 % (was 25 %), up to 4 per tile. New in the open sea: groups of 3 to 6 over a bed 0.55 to 3 m below high water (`SEA_FISH`), beyond the surf, with a PRNG of their own (the others keep their rules), drifting like lagoon fish and darting when he wades within 2 m. Fish are 45 to 65 cm (sea 50 to 75), the shadow colour is darker (`0x0f2830`), opacity 0.82, a slightly wider shape; the pool holds 128. World generation and the seed 1337 fixture are untouched.
- Gulls half as big, on the ground and in the air (`BIRD_SCALE` 0.5 in `render/wildlife`; a landed gull stands `BIRD_H` 0.06 m above the ground); behaviour unchanged.
- Sleep: he can only choose to sleep after half a day awake (`SLEEP_AFTER` 0.5, `sleep.canLie()`): no sleep hold on the action button and `Z` does nothing before that; collapsing (exhaustion, thirst) is unchanged. A cold sleep without fire or lean-to lasts 3 hours (`COLD_SLEEP`, was 4) and leaves him 40 % rested from empty: `COLD_REST` (16/15) makes that sleep rest 1.067 times as fast as `REST_RATE` (0.8 day of being awake in 3 hours). A lean-to sleep stays 6 hours and three quarters, a fire sleep the whole night. Saving a sleep in progress is unchanged.
- Tests: fish near the start and the brook, sea fish in shallow coastal water and their darting, fish sizes, gull sizes, no sleep before half a day (button and Z), allowed after, collapse, cold sleep 3 h / 40 %, lean-to and fire sleep, save of a sleep. Existing tests that sleep from a fresh game now start with half a day awake. The smoke test tops up the walk to 0.6 day before its `Z` (the new rule blocked it) and expects a 3 hour cold sleep; new shot `smoke-28.png` (fish by day at the default zoom, also in the quick run); the flock shot stands 5.5 m from the gulls and zooms in, as they are small now.

## 0.17.2 "Many lights" — 2026-11-03

- Fix: only the strongest fire or torch near the castaway lit the ground, plus the torch in his hand; the others were only a glow. Now every burning fire and torch in the ground near him lights its surroundings.
- A fixed pool of point lights in `render/fire` (`POOL` 4, always in the scene, so no shader is rebuilt; unused ones at intensity 0), given each frame to the nearest fires and torches (within 60 m); the carried torch keeps its own light. `pickLights` and `stepPool` are pure. A light that changes the fire it serves fades out over 0.3 s (`FADE`) and only then fades in on the new one, so nothing pops. Ranges, decay and positions are as before (14 m, 9 m, 1.5, at the flame).
- Quality: `settingsFor` has `fireLights` (4 at levels 0 and 1, 2 at 2 to 4). The pool is sized once at the start of the session from the starting level; when the level drops, `view.setQuality` calls `fireView.setActive`, which gives out fewer lights while the rest stay in the scene dark, so nothing is recompiled.
- The glow over the picture follows every light that is on (pool and carried), scaled by its fade.
- Cost: 3 more point lights per lit material. On the desktop card here a frame at night with a fire and four torches took 3.9 ms with the pool and 3.9 ms with the old two lights (no measurable difference).
- Tests: `tests/lights.test.js`; the smoke test has a night shot with a fire and two torches (`smoke-27.png`, also in the quick run). README: a line on torches lighting the ground.

## 0.17.1 "River mouth" — 2026-11-03

- Fix: beyond a river mouth the carved bed ran on into the sea as a deep, dark trough (up to 2 m deeper than the sea floor, with a rounded end), clearly visible through the water. The river's path continues out to sea and the carve followed it. Now the carve fades out over `MOUTH_FADE` (16 samples, 8 m) past the mouth (`world/rivers`), so the bed flattens into the sea floor and the shallows run on smoothly. The banks that were cut away beside the offshore path are land again, so a mouth has sand on both sides.
- Changed cells: only within 26 m of a mouth (1330 cells of 0.5 m on seed 1337, all raised, none lowered). Rivers on land (fords, falls, banks, `riverAt`) are unchanged.
- The style prototype (`prototypes/island-generator/generator.html`) got the same change. The 400 random fixture points do not lie near a mouth, so they stay the same; `make-golden.js` now also exports the ground height along each river past its mouth (`mouthH`) and `tests/world.test.js` compares it, and checks that no trough is left.
- Habitats: a lagoon fish is only placed over sea water (`Lat < 0`), which the changed mouth floor exposed as an edge case.

## 0.17 "Wildlife" — 2026-11-03

- Crabs, fish and birds, atmosphere only (nothing to do with them, no sound, nothing saved), all alive only within 30 m of the castaway.
- Where they live: new `src/game/habitats.js` (pure) works out crab colonies, fish groups and bird cells from existing world data with a PRNG seeded by the seed and the tile or cell, like `game/branches`; the generated island and the seed 1337 fixture are untouched.
- Behaviour: new `src/game/wildlife.js` (pure, run from the end of `game.update`; `game.wildlife`). Crabs: sideways runs near their hole, scuttle to the nearest hole within 3 m, back 10 to 20 s after he is more than 5 m away, 45 % of a colony out at high water and all at low water, holes the sea covers are shut. Fish: shadows in shallow rivers (facing upstream) and lagoons, darting and fading when he wades within 2 m, back after 8 to 16 s over 4 s; a fish jumps beyond the surf every 30 to 90 s with a splash. Birds: 2 to 4 circle high over each stretch of coast by day, arriving at dawn and leaving towards the rocky shore in the evening, none at night; a flock of 5 to 8 lands 10 to 20 m away every few minutes (the first after 90 to 180 s), pecks about and flies up, circles and leaves when one is within 4 m.
- Drawing: new `src/render/wildlife.js`: instanced pools in the toon style with outlines (a crab about 14 cm across, a seabird 60 cm long with a metre of wings that flap, glide or fold, fish as dark flat shadows drawn over the water, the jumping fish and a splash of flat white flecks and drops in the surf's style). No shadows are cast; the moving animals do not keep the idle rate of 15 fps from kicking in (`framePacer` is unchanged).
- Tests: `tests/wildlife.test.js`. Smoke test: crabs at low water (`smoke-25.png`) and a landed flock (`smoke-26.png`, also in the quick run). README: an *Animals* section.

## 0.16.2 "Light load" — 2026-11-03

- The game lowers its own quality on a slow device (a laptop with an integrated chip drew 10 to 12 fps with the 4096 px shadow map, the 16 x 4 tap filter and 1.5 times pixel ratio). New `src/render/quality.js` (pure): five levels, one step at a time: 0 as before, 1 shadow map 2048, 2 the lighter filter (16 plain taps, radius 1.5), 3 pixel ratio 1, 4 the ground casts no shadows. After the island has faded in, the mean time between non-idle frames is measured over 3 s; slower than 1/27 s steps down one level, 2 s of settling, measure again; the first 4 s, idle frames, the frame after idling and gaps are ignored; never steps up. Steps that change nothing on the device are skipped (touch devices already start at 2048).
- Remembered per device in `localStorage` (`driftwood-quality`); the next start begins there. `?quality=N` forces a level and stops adapting (tests). The dev panel shows `qN`.
- Stage: `applyQuality(settings)` changes the shadow map size (disposed and rebuilt), pixel ratio and terrain shadow casting live; the filter is switched through the shadow map type (both filters live in the shader chunk: bilinear in PCF, light in PCF_SOFT) plus `needsUpdate` on the scene's materials. Terrain meshes are tagged `userData.terrain`.
- `scripts/smoke.js` takes `--quality=N`. README: a plain note for slow computers. Tests: `tests/quality.test.js`, the dev panel label.

## 0.16.1 "Heavy legs" — 2026-11-03

- Needs slow him clearly: tired down to 60 % at two days awake (`TIRED_SLOW`, was 75 %), thirsty down to 65 % at the point of collapse (`THIRST_SLOW`, was 85 %), hungry down to 75 % at four days (`HUNGER_SLOW`, was 90 %). Each still eases in from its own threshold; they multiply together (at the worst about 29 %) and with the load.
- Shorter steps with the slowing, as when carrying: `game/movement` `weariStride(needsSpeed)` = 1 - `WEARY_STRIDE` (0.4) x (1 - the combined needs speed), about 72 % at the worst; `game/game` multiplies it with the carrying stride and gives it to `stepPlayer`. No change in render.
- Tests: the new numbers at the limits and halfway, the combined factor and the shorter stride in the game.

## 0.16 "Lean-to" — 2026-11-03

- Branches (new `src/game/branches.js`, `src/render/branches.js`): 0 to 2 dry branches lie under about half of the broadleaf and rain forest trees, fixed per island by the seed and worked out in `game/branches` from the tree list (no change to the generated world; the seed 1337 fixture is untouched). Thinner and shorter than driftwood (0.8 to 1.2 m), dark bark, a twig or two and dry leaves, with outlines. Picked up and carried like driftwood (wood and branches together at most 3, the same slowing), never wet, grow back at the same spot 4 to 8 days after they were taken. Own piles (kind `branch`, at most 12, never mixed; a mixed load is laid down kind by kind), tally marks as for driftwood, an own twig drawing per branch carried in the inventory row. A branch burns half as long as a piece of driftwood (`BRANCH_BURN`, `fuelOf`): it feeds a fire for half a piece and a pile of branches can be lit like a driftwood pile.
- The lean-to (new `src/game/leanto.js`, `src/render/leanto.js`): a pile with at least 6 driftwood and a pile with at least 6 branches whose centres are within 2 m of each other; holding the action button (or `F`) beside either builds instead of lighting. It takes 6 + 6 out of the piles, the lean-to stands midway, and he kneels for 60 s (an hour of game time), which costs as much rest as two drill attempts. Walking off keeps the half-built lean-to; holding beside it builds on. It rises in steps (two forked posts, a ridge pole, a sloping roof of branches), about 2 m wide and 1.5 m deep, open side towards the camera at the start; not solid. The action button has a new hold icon, a small lean-to.
- Sleeping within about 1 m of a finished lean-to: the cold sleep lasts 6 hours (was 4) and he wakes about three quarters rested; with a fire within 3 m he sleeps the whole night and rests 1.25 times as fast as by a fire alone (`SHELTER_SLEEP`, `SHELTER_REST` in `game/sleep`). The flood takes a lean-to on the wet sand of low water, also a half-built one. More than one may be built.
- Saving: optional `branches: { taken }` and `leantos: { list, nextId }`; branch piles are part of `wood.piles` (kind `branch`). Older saves load as they were (the format stays `v: 1`).
- Fix: husking a coconut is always offered, also with three tufts of fibre: he still eats the nut (hunger and thirst go down, the nut grows back as usual) but gets no fourth tuft. Before, with three tufts he could not eat at all. The action button icon for husking is now the half coconut (as in the hunger mark) instead of the fibre tuft.

## 0.15 "Coconut" — 2026-11-03

- Hunger (new `src/game/hunger.js`, modelled on thirst): counted in game days since he last ate, running on while he sleeps, stopping at four days (no collapse; he never dies). Hungry from two days: walking speed down to 90 % at four days (multiplied with load, thirst and tiredness) and drilling a fire costs 1.5 times as much rest. Starving from four days: rest runs out 1.5 times as fast, multiplied with thirst's double (both together: 3 times).
- Eating: husking a coconut takes 4 seconds (was 2.5; the same kneeling work, no new animation). When it is done he has one tuft of fibre, eats the nut (hunger down by 4/3 day, not below 0) and drinks its milk (thirst down by a quarter day, `thirst.sip`), always, also when not hungry. Stopped early: nothing, the nut stays.
- The half coconut mark (`src/render/hungerMark.js`, `#hunger` in `index.html`) next to the drop: a half coconut seen from the side whose flesh empties from the top down as hunger grows; same ink, glow and opacity curve as the drop.
- Saving: an optional `hunger: { days }`; older saves load as not hungry (the format stays `v: 1`).

## 0.14.2 "Still edges" — 2026-11-03

- Fixed: the shadows flickered. Each tiny step of the shadow light (1/32°, about ten a second) re-drew the shadow map and its jagged texel edges fell slightly differently every time. Now there are no jaggies: the shadow map is 4096 px on desktop (2048 px on touch-only devices, as before), the soft filter's radius is 3 texels (was 1.5), and each of its 16 taps is a bilinear comparison (four texels mixed by the fraction). The light's stepping is unchanged. `shadowMapSize(touch)` in `src/render/stage.js` chooses the size; `main` passes the touch test down through `createIslandView` to `createStage`.
- Tried live and rejected: a cross-fade between two shadow lights (shadows looked doubled during the fade).
- No change to the game's elements.

## 0.14.1 "Dry ground" — 2026-11-03

- Fixed: a first pile no longer goes in the water. When no pile is near, the spot a step in front is checked too; if it is wet, a dry spot round him is used, and if there is none he keeps the wood (as with a full pile that has no room beside it).
- Fixed: the thumb stick now stops kneeling work (husking, drinking, drilling a fire) like the keys and a click do, through one helper, `wantsToMove(input)`, which also drops a queued action.
- Fixed: the first frame's time step is never negative (`Math.max(0, ...)` in `src/main.js`).
- The smoke test now starts the full Chromium (new headless mode) on the graphics card, with the old software drawing as fallback: the quick run takes about 15 seconds instead of about 35. One-time setup: `npx playwright install chromium`.
- `REVIEW_GPT.md` moved to `docs/review-gpt.md`. No change to the look or to the game's elements.

## 0.14 "Moving water" — 2026-11-03

- The water moves, stylised and subtle, in the existing water shaders only. Rivers: light streaks and flecks drift downstream, faster on steep stretches, fords and falls, and the white water at fords and falls breaks up and moves. Sea: a slow long swell with glints on the crests (the sun, the moon and fires and torches do the glinting: faint and silvery at night, warm by a fire) and faint pale lines by day. Lagoons and sheltered bays are calmer. The surf breathes up and down the beach over a few seconds on top of the tide.
- Moving water does not count as something happening: the idle 15 fps rate is unchanged, the water just moves as fast as frames are drawn.

## 0.13.3 "Clear marks" — 2026-11-03

- Every interface element is now readable on light and dark ground, by day and at night. The action button has a soft glow in the opposite colour of the ink behind ring and icon, a faint paper disc inside the ring (pale by day, dark at night), thicker strokes (2.2 px) and larger icons, and is clearer (0.45 empty, 0.95 with an action). The thumb stick, the moon, the drop, the fibre tufts and the tally marks get the same glow and thicker strokes; the moon, drop and fibre row rest at 0.5 instead of 0.3. No frames or boxes.

## 0.13.2 "Chosen shadows" — 2026-11-03

- The shadows settle on fine steps with soft edges: the shadow light turns in steps of 1/32 degree (was 1/16), never comes from lower than 15 degrees, the own soft filter has a radius of 1.5 texels, and the shadow camera keeps the tight fit. The user compared the variants by eye on a phone and chose these.
- The temporary `?shadows=step,min,soft,fit` comparison parameter is gone, together with the alternatives it switched between (old hard filter, old loose and roomier shadow cameras, softer filter).

## 0.13.1 "Soft shadows" — 2026-11-03

- Fixed: the shadow edges are no longer jagged and restless. The shadow map (still 2048 px) now covers only what is seen, measured across the light, so its texels are about 3 times finer on the sand with a low sun (the old square covered far more than the view). Its size changes in steps of 5 %, so zooming or turning does not make the edges shift, and it still snaps to whole texels so walking does not shimmer.
- Soft edges: three.js's hard shadow filter is replaced by an own one (16 taps on a small disc, turned per pixel), which turns the stair steps into a narrow soft band while the drawn look stays crisp.
- The shadow light now turns in steps of 1/16 degree (was 1/32): with the finer map it is the calmest step in the headless flicker check.
- Temporary `?shadows=step,min,soft,fit` grows two meanings: `soft` is 0 (old hard filter), 1 (new soft, default) or 2 (softer); a fourth value `fit` is 0 (old loose shadow camera), 1 (tight, default) or 2 (tight with more room).

## 0.13 "Action" — 2026-11-03

- Clicking and tapping only walk now. On wood, a pile, a coconut, a fire or a torch in the ground he walks to beside it and stands there, doing nothing; river water and its bank are just ground, so wading through a river works and a stray click no longer takes a torch from a fire or makes him drink. Tapping or holding the castaway does nothing any more.
- One action button: **Space**, and a thin ink ring in the bottom right corner (above the thumb stick on touch screens, clickable with the mouse on a desktop), in the same ink as the other marks and pale at night. Faint and empty when nothing can be done; clearer, with a small ink icon, when something can. Its touches never count as a walk tap and do not disturb the stick or the two-finger view gestures.
- A short press does the obvious thing for what he stands beside: pick up wood or from a pile, husk a coconut, lay a piece of dry wood on a fire, take a torch from a fire or take up a planted torch, drink at river water or its bank, and otherwise lay down what he carries or stick the torch in the ground. What is in his hands decides first (dry wood beside a fire feeds it, even with a pile next to it), then what is nearest; laying down comes last.
- Holding the button (about half a second) does the heavy things: light a pile of four or more (fire drill with fibre, or a torch) and, anywhere else on dry ground, sleep. A small ring round the icon fills while it is held. `F` and `Z` stay as shortcuts. A press of the button wakes a sleeping castaway.
- Icons in thin ink: wood with an arrow up or down, the fibre tuft, a flame over a piece of wood, a torch, a torch with a stroke of ground, the drop, a flame and the crescent moon. When a short press and a hold both do something, the short-press icon is large and the hold icon small beside it.
- Fixed: a full fire (eight pieces) takes no more wood; the button offers nothing to lay on it and the piece is no longer wasted.
- The pure `game.action()` says what a press and a hold would do; the button draws its icon from it. New `tests/action.test.js`.

## 0.12.1 "Smooth shadows" — 2026-11-03

- Fixed: the shadows no longer move in visible jerks. The shadow light now turns in steps of 1/32 degree (before: a quarter degree, about a metre of shadow per step with a low sun), and it never comes from lower than 15 degrees (before: about 11.5), so shadows at sunrise and sunset are less extreme. The sun and the sky colours are unchanged.
- Temporary developer parameter `?shadows=step,min,soft` (degrees, degrees, 0 or 1) to compare variants; to be removed once one is chosen.

## 0.12 "Piles" — 2026-11-03

- A pile holds at most twelve pieces, and (for later) only one kind of wood. Wood laid on a full pile starts a new pile right next to it, and what does not fit on a pile goes into the new one. Older saves with bigger piles still load.
- Tally marks in ink appear above a pile and above a fire while you stand beside it: strokes in bundles of five, with a double line under when it is full (12 for a pile, 8 for a fire). On a fire they count the pieces still burning, a half-burnt piece as a short stroke, none for embers. They fade in and out and turn pale at night with the other ink. Piles grow and shrink with their count, and so does the fire's tepee.
- Wet wood cannot be laid on a fire: you lay a dry piece from a mixed load, and nothing happens with only wet wood.
- The day line top left and the waking line are easier to read: bigger (15 and 22 px), the day line more present (opacity 0.55, 0.9 when a day turns), the waking line stays 5 seconds, and both have a soft glow behind the letters in the opposite colour of the ink.

## 0.11.1 "Still shadows" — 2026-11-03

- Fixed: around sunrise and sunset the shadows trembled, even standing still; they now hold still and move on in tiny steps as the sun moves.

## 0.11 "Water" — 2026-11-03

- The castaway gets thirsty: after about a day (20 minutes of play) he is thirsty and a little slower, after a day and a half very thirsty and his rest runs out twice as fast. After two days he collapses and sleeps like exhaustion, and wakes still thirsty. He never dies.
- Drink at a river: tap the water or its bank, and he walks there, kneels and drinks for a few seconds. Wood in his arms is laid down first, a torch is stuck in the dry ground first. Sea and lagoon water are salt and do nothing; wading in a river does not drink by itself.
- A small ink drop next to the moon shows his thirst: full after a drink, emptying as he gets thirsty, faint like the moon and clearer as it matters and for a moment after drinking. His head hangs a little when he is thirsty.
- When a fire goes out it leaves its burnt place: ash and charred ends that stay for about two days, fading slowly. No light or warmth, and you walk over it. The flood washes it away sooner, and a new fire lit on it replaces it.
- He stoops more under a load: twice as much lean per piece (about 17 degrees with three), from the hips.
- Thirst and the burnt places are saved (older saves load as not thirsty, with no burnt places).

## 0.10 "Wet wood" — 2026-11-03

- Wood that the sea has just brought looks wet until it is dry enough to burn: a dark, cool grey-brown with a slight sheen, on the beach, in a pile and under his arm. Then it bleaches to its own colour within a couple of minutes.
- Under fresh wood on the beach lies a dark damp patch in the sand; it shrinks and fades as the wood dries and is gone when the wood will burn.
- Carrying slows you more: 12 % per piece (three pieces: 64 %), with shorter steps and a slight stoop.
- The view (turn, tilt and zoom) is remembered per island and comes back exactly as you left it; starting over, or an old save, gives the default view.
- Dev: while the developer panel is visible you can zoom out to 25 instead of 10 (the panel then shows `zoom N` beyond 10); with the panel hidden the normal limit applies again.

## 0.9 "Name" — 2026-11-03

- At the first start of an island the loading screen asks "What is your name?". Enter, or the small arrow, confirms; an empty answer means the castaway. The name is saved with the island, and starting over asks again.
- A small line top left always says who you are and which day it is, such as `Dave, day 1`; it grows clearer for a few seconds when a new day begins.
- When a sleep ends, a short line fades in and out in the middle of the screen, such as `Dave wakes. Day 3.`
- All the ink on screen (the moon, the row, the thumb stick, the lines of writing, the developer panel) turns pale at night.

## 0.8 "Wider light" — 2026-11-03

- The firelight reaches further, about 14 m round a fire and 9 m round a torch; the torch lights the ground at its flame.
- Nights are darker, and the smoke a little darker.
- Behind trees the castaway is now an even silhouette, not a stippled veil, and the paper grain is gone.
- The loading screen reads DRIFTWOOD in capitals.

## 0.7 "Quiet frames" — 2026-11-03

- On phones and tablets the game uses less power: at most 30 frames a second on touch-only devices.
- On every device it drops to 15 frames a second when nothing has happened for three seconds.

## 0.6 "Saved" — 2026-11-03

- The island saves itself in this browser, one save per island, and picks up where you left off.
- Shift + ` (or `#new` in the address) starts the island over.

## 0.5 "Thumb stick" — 2026-11-03

- On touch-only screens a thumb stick sits bottom right: drag from its centre to walk that way, to the rim to run.
- Let go to stop.

## 0.4 "Dev panel" — 2026-11-03

- A faint line top right shows the version, its name, the frames per second and the work time per frame.
- The backtick key (`) shows or hides it.

## 0.3 "Ink row" — 2026-11-03

- The fibre you carry is drawn as a row of small ink tufts next to the moon, not at the castaway's waist.
- The tufts are faint most of the time and clearer for a moment when their number changes.

## 0.2 "Fords" — 2026-11-03

- You can wade rivers up to your waist.
- Where a river is a narrow brook you can cross anywhere; along the middle reach you cross only at fords, marked by stones sticking out of the water and white rippling water.
- The deep stretch towards the sea cannot be crossed.

## 0.1 "Fire" — 2026-11-03

- You are alone on a large island of terraces, rock walls, rivers and waterfalls. You walk it and climb through its natural passages: a scree slope, a ravine, rock benches, roots and lianas, a mossy route by a waterfall. Trunks, boulders and the open sea stop you.
- Driftwood washes up with the tide, which comes in and goes out twice a day. You carry up to three pieces and lay them in piles; every high water brings new wood.
- Husk coconuts under the palms for a tuft of fibre.
- You sleep when you are tired. The moon in the corner shows how rested you are; sleep by a fire and you wake fully rested.
- Drill a fire on a pile of four dry pieces with a tuft of fibre, and feed it with wood. Take a burning brand from the fire as a torch and light a pile with it.
- A day lasts twenty minutes, with a golden sun and a dim, moonlit night that the fire and the torch light.
