# Architecture of Driftwood

Driftwood is small and lonely: one island, one castaway, atmosphere first (see `design.md`). The architecture has to keep it that way. Every part has one job, can be tested on its own, and knows as little as possible about the rest.

## Layers

```
core/     numbers and noise           no dependencies
world/    the island as data          uses core (and only the curve maths of three)
game/     rules and game state        uses core and world
render/   everything you see          uses core, world (read only) and three
main.js   wires it all together       the only place that knows every layer
heightWorker.js, parallelHeights.js   build the height grids in Web Workers for main (use core and world)
```

Rules:

- **Arrows point one way.** `world` does not know `game` or `render`. `game` does not know `render`. `render` reads the world and the player state but never changes them.
- **`world` and `game` are pure.** They touch neither the DOM nor WebGL, so they run in Node (the tests) and in Web Workers (the height grids, see Loading).
- **Everything follows from the seed.** The same number gives the same island, the same trees and the same colours. Every tile has its own generator (seed, tx, tz), so the order in which tiles are built does not matter.
- **Almost no interface.** There is deliberately no HUD, map or menu. What you see is the island. The marks on screen are the moon that shows how rested the castaway is (`render/restMark`) and, next to it, the row of what he carries loose (`render/carryMark`). The one exception is the developer panel (`render/devPanel`), a faint line top right with version, name and fps; it is a developer aid, visible for now, to be hidden later (`DEV_PANEL_VISIBLE`), and toggled with the backtick key.

## Modules

| Module | Job |
|---|---|
| `core/noise` | Seeded noise (`vnoise`, `fbm`), PRNG and tile hash. The formulas are frozen. |
| `core/math` | `ss` (smoothstep), `lerp`, colour mixing. |
| `core/view` | The isometric view as angles (turn and tilt, with the tilt limits): what "towards the camera" and "screen right" mean for a given view. Pure maths; the camera owns the current angles. |
| `core/slicer` | Time slicing: heavy work as a generator that pauses when the frame budget is spent. |
| `core/loading` | The loading bar as one number: each generation step owns a measured share, so the bar fills evenly and never moves backwards. `main` draws it in `#loader` (`index.html`). |
| `world/constants` | Dimensions: 720 × 720 area, 0.25 grid, 40-unit tiles, terrace heights. |
| `world/shape` | Island outline and scattered highlands; scale to terrace level L. |
| `world/terrain` | From L to height: terraces, rock walls and the natural passages. |
| `world/heightfield` | The height and level grids, and bilinear sampling. |
| `world/rivers` | Rivers (Dijkstra, smooth curve), waterfalls, 2 to 4 fords per river along the middle reach (`rv.fords`, `rv.fordAt(k)`, `FORD_DEPTH`), carving beds and banks (shallow where a river is narrow, `bedDepth`; the bed rises to `FORD_DEPTH` on a ford). |
| `world/vegetation` | Per tile: trees, palms, rocks, bushes, root spots, and what can be gathered: driftwood and the coconuts under the palms (each with its own PRNG and an id per piece) (data only). |
| `world/occlusion` | Darker ground under crowns and in hollows. |
| `world/spots` | Finding places: the start spot, examples of each passage (for tests). |
| `world/world` | Builds everything from a seed and returns one read-only object with queries. |
| `game/movement` | Walking rules: walls block, passages let you climb, the sea blocks below the current sea level and river water blocks deeper than `WADE_MAX` (0.35, waist deep; you can always wade back out), sliding along walls; trunks, boulders and crags (from the tile data, cached per tile) block and you slide round them. |
| `game/input` | Keys and clicks/taps to a movement intent (a double tap runs; the tapped spot itself is marked, steering after it is not; a finger may wobble a little); holding the castaway or `Z` to sleep, a left click, tap or walking key to wake (not the view controls); holding anywhere else or `F` for the game to light a pile (and whether a press is still being held); mouse wheel, `+`/`-` and a two-finger pinch to zoom steps; `Q`/`E`, right-mouse drag and a two-finger twist to turn (the mouse also tilts). The thumb stick: pure `stickIntent` (thumb offset + radius + yaw -> island direction and run, dead zone 12 %, run past 85 %) and `input.stickStart/stickMove/stickEnd`, which feed `input.stick` (a direction that follows the current yaw, preferred by `moveIntent`) and `input.run`; a stick finger is not a tap, hold or one of the two fingers, and wakes like a walking key. |
| `game/wood` | Gathering: driftwood still on the beach, what is carried (at most 3, each piece slows you), piles; finding the nearest piece or pile, taking, laying down; washing up new wood at high water (deterministic per high water, never more per tile than at the start), piles the flood takes; washed-up wood is wet and dries over a day (`dryness`); piles and pieces taken off to burn; a plain saveable state. |
| `game/fibre` | Coconuts under the palms, husked for a tuft of fibre (at most 3 carried, one used up per attempt to light a fire); palms drop new nuts after some days; a plain saveable state. |
| `game/fire` | Fires: an attempt to light a pile (catches or not, from the dryness and tiredness, fixed by the seed and the number of attempts), burning down to embers and going out, feeding one piece at a time, the flood putting them out; torches taken out of a fire, carried or stuck in the ground, lighting a dry pile without fibre (`kindle`), burning out, put out by water; whether a fire warms a sleeper; a plain saveable state. |
| `game/clock` | The time of day and the number of days: a 20-minute day, part of the game state. |
| `game/tide` | Ebb and flow (pure): the sea level from the time, two high waters a day, and which high water it is. |
| `game/sleep` | Being awake, tiredness, and sleeping: how fast game time runs (20× while asleep, eased), lying down and getting up, falling asleep after two days (only on dry ground); a cold sleep without a fire ends after four hours; hard work tires (`tire`). |
| `game/game` | Game state (the player, the clock, the wood, sleep, the fibre and the fires) and the per-frame update: a tapped target is looked at once (on the castaway: lay down; on wood: walk there and pick it up, bending down briefly; on a coconut: kneel to husk it; on a fire: lay a piece on it, or empty-handed take a torch; with a torch, a tap on the castaway sticks it in the ground and a tap on a pile lights it); a hold on a pile (or `F`) kneels to drill fire; kneeling work stops when you walk or tap; sleeping and waking (the flood wakes the castaway when it reaches him); the clock runs (faster while asleep), the tide washes up wood at high water and takes covered piles, fires burn down. |
| `render/palette` | All colours of style C in one place, the castaway's included. |
| `render/terrainColor` | Painted ground colour per point (pure, tested against the prototype). |
| `render/materials` | Toon shading, outlines (also a cut version for vegetation), the rock shader for steep walls. |
| `render/geometry` | Shared shapes (crowns, rocks, grass, ferns, driftwood) and matrix helpers; palm fronds write full alpha (`opaqueCutout`), so the light page behind the transparent canvas never shows through their edges. |
| `render/batch` | Many small objects into a few InstancedMeshes with outlines. |
| `render/props` | Detailed trees, palms, roots and lianas, the tide line. Trees, pines and palms each pick a shape and colours from the tile generator. |
| `render/terrainTile` | Ground mesh and painted texture of one tile. |
| `render/farTiles` | A cheap version of every tile. Those in view at the start are built before the game starts; the rest follow in the background, about 3 ms per frame, tiles in view first. |
| `render/nearTile` | The full-detail version of one tile. |
| `render/streaming` | Which detailed tiles exist for the current view; building one at a time, dropping old ones. |
| `render/cutout` | The thinned veil in the vegetation round the castaway: a shader patch on the vegetation materials that discards, with an ordered dither, part of what lies in front of the figure inside a screen circle (40% kept in the middle, filling in to all at the edge). |
| `render/water` | Sea, river ribbons, surf, foam and spray at waterfalls. Fords are shown by nature only: whiter ribbon colour, a dozen small stones in the water, gravel on the bed and a few foam flecks (own PRNG, not in `tile.rocks`, so they never block). The sea planes move with the tide; the surf is built for five levels of the tide and the two next to the sea level fade in; a river's water runs on past its mouth down to wherever the sea stands (a shader uniform). No decoration that looks like driftwood: every piece you see can be picked up. |
| `render/driftwood` | The driftwood of `game/wood`: logs on the beach per detailed tile (rebuilt when wood is taken or washes up), piles stacked crosswise, and each piece's look, fixed by its place; wet wood is dark and bleaches in steps as it dries. Freshly washed-up wood fades in over 3 s. |
| `render/coconuts` | The coconuts of `game/fibre` under the palms, per detailed tile (rebuilt when one is taken or falls again). |
| `render/fire` | The fires of `game/fire`: a tepee of charred wood that sinks as it burns, flickering unlit flame cones, embers, rising smoke (also a puff after a failed attempt and a wisp while drilling), torches stuck in the ground; one warm point light over the strongest fire or torch near the castaway and one for the torch in his hand (always in the scene, so no shader is rebuilt), and at night a warm glow over the picture round the nearest lights (a DOM layer above the night grading). |
| `render/hero` | The castaway (hat, beard, torn shirt, shorts, bare feet) with a walk cycle, carried wood under the arm, a torch held up in the left hand, bending down, kneeling to husk a coconut or to twirl the staff as a fire drill, a tired stoop, lying down to sleep with the hat over his face, and a light stippled silhouette (drawn with an inverted depth test before the figure) where something solid hides it. |
| `render/footprints` | Footprints in the sand: at most 80, the oldest fading out; those the tide covers are wiped out. |
| `render/carryMark` | The row of small ink drawings (`#carry` in `index.html`) next to the moon that shows what he carries loose (for now the fibre tufts, from `game.fibre.carried`): faint, clear for a few seconds after a change. Pure `carryItems`, `carryChanged` and `carryOpacity` are tested; `main` feeds it each frame. |
| `render/thumbStick` | The thumb stick (`#stick` in `index.html`), bottom right, touch-only: ring and dot in the ink style of the moon mark, faint, clearer under a thumb. CSS shows it only for `(pointer: coarse)` without `(any-pointer: fine)` and after `body.ready`; `createThumbStick` checks the same with `matchMedia` (else returns null and attaches nothing). Pure `touchOnly` and `knobOffset` are tested; the DOM part captures the finger, moves the dot and calls `input.stickStart/stickMove/stickEnd`. Wired in `main`; never reaches the world's input element. |
| `render/devPanel` | The dev panel (`#dev` in `index.html`), one line top right: `v0.4 · Dev panel · 60 fps` (version and name from `src/version.js`, listed in `docs/versions.md`). Pure `createFpsMeter` (frame times in, whole fps out, averaged over 0.5 s so at most two updates a second), `devLabel` and `isToggleKey` are tested; the DOM part writes text only when it changed and toggles with the backtick key (`Backquote`, which `game/input` ignores), not remembered. `DEV_PANEL_VISIBLE` sets the start state. `main` feeds it the real frame time. |
| `render/restMark` | The moon mark (`#rest` in `index.html`) that wanes as the castaway needs sleep; drawn by `main` from `game.update`'s `rest`. |
| `render/camera` | Orthographic camera that follows; player zoom within fixed limits; free turning and limited tilting, eased; zooms out on the summits; ground picking. (`islandView.pickGround` also tells whether a point is on the castaway, and picks a beach log by its drawn shape, branch and roots included, rather than the ground behind it.) |
| `render/sky` | The light of the day from the time (pure): sun and moon paths, light and fill colours, grading for golden hour, dusk and night. |
| `render/mood` | Atmosphere per terrace and per time of day: colour grading, mist, cooler light, light colours, paper grain, vignette. |
| `render/stage` | Renderer, scene, lights (placed by `render/sky`, fixed in the world) and the shadow that follows the view. |
| `render/islandView` | Puts all render modules together and draws a frame. |

Every module starts with a header that says what it does, what it exports and what it depends on.

## One frame

```
input ──> view.zoomBy(input.takeZoom()), view.turn(input.takeTurn(dt))
  │          zoom and view angles are view settings, not game state
  │      input.yaw = view.yaw   so the keys walk relative to the screen
  │
  └─> game.update(input, dt) ──> sleep or wake (game/sleep: how fast game time runs), a tap or hold is looked at
                │                (game/wood, game/fibre, game/fire), kneeling work goes on, the player moves (game/movement),
                │                the clock runs, the tide (game/tide) washes up wood, fires burn down
                │
                ├─> { rest } ──> the moon mark (render/restMark)
                ├─> fibre.carried ──> the carry row (render/carryMark)
                ├─> real frame time ──> the dev panel (render/devPanel)
                └─> { distance, terrain, time, sea } ──> view.render(player, info, dt)
                                                ├ camera follows; sun or moon from the time (render/sky)
                                                ├ sea level and surf of the tide
                                                ├ driftwood when game.wood changed or dried a step (fresh wood fades in), coconuts; castaway with its load and fibre, footprints
                                                ├ fires: flames, smoke, the fire light and the night glow
                                                ├ streaming: at most ~9 ms building tiles
                                                ├ far tiles on/off
                                                ├ window in the vegetation round the castaway
                                                ├ mood of the current terrace
                                                └ draw
```

## Loading

Loading takes about 3 seconds on a 4-core laptop. The height grids are the heaviest part (8.3 million points): `main.js` has them built in Web Workers, one per spare core (`src/heightWorker.js` computes strips of rows with `world/heightfield` `fillRows`, `src/parallelHeights.js` hands out the strips and puts the grids together). The result is exactly what a build on the main thread gives (tested); if workers are not available, `main` falls back to that. Then `islandView` builds the water and only the far tiles around the start (the others follow while playing), and `view.prepare` builds the detailed tiles in view at the start, so the game never opens on the simple stand-in tiles. A detailed tile costs about 0.15 s: its ground colour is sampled every second pixel and blended in between, and its 21 000 brush strokes are painted straight into the pixel data (`paintStroke`) rather than through the canvas API. `main.js` lets the browser breathe between the steps and fills the loading bar from the step reports (`core/loading`). When the first frame is drawn, the loader fades out and the island fades in.

Nothing stutters while playing, because detailed tiles are built in slices of about 9 ms per frame and the remaining far tiles in slices of about 3 ms.

## Testing

```
npm test          unit tests (Vitest, Node), about 30 s
npm run build     builds dist/ and dist/driftwood.html (a single file)
npm run smoke     opens the build in headless Chromium, walks, gathers wood, waits for low water, sleeps a cold sleep, waits for a high water, husks a coconut, lights a fire, takes screenshots (about 60 s)
```

- `tests/world.test.js` compares seed 1337 with a golden file exported from the style prototype: heights, levels, slopes, rivers, passages, vegetation per tile and ground colours. Any change to the generation shows up here.
- `tests/movement.test.js` really walks over the island: every passage must lead up, walls without a passage must stop you, and so must the sea; trunks, palms and boulders must stop you while you slide past them, small stones must not; rivers stop you at waist depth, every ford can be crossed, the deep reach cannot, and upstream brooks can be waded anywhere.
- `tests/streaming.test.js`, `tests/render.test.js` (window round the castaway, fading footprints, the moon mark, the carry row, the surf levels) and `tests/core.test.js` test the pure logic without a browser.
- `tests/devPanel.test.js` tests the dev panel: fps averaging (calm, at most twice a second, odd frames ignored), the label, the backtick toggle and the version.
- `tests/heights.test.js` checks that building the height grids in strips (as the workers do) gives exactly the same grids, and that a failing worker lets `main` fall back.
- `tests/loading.test.js` tests the loading bar: steps in order, never backwards, ends full. The smoke test also saves the loader halfway (`smoke-0.png`) and checks the bar ends full.
- `tests/stage.test.js` checks that the shadow depth bias stays a few centimetres at every zoom level.
- `tests/props.test.js` tests the variety of trees, pines and palms (shapes, colours, lean directions, how many withered fronds) with a recording batch.
- `tests/wood.test.js` tests gathering: driftwood on the beach, picking up with a click or (less precise) tap, not when steering, at most three pieces and the slowdown, laying down on the castaway, piles, and the saved state.
- `tests/game.test.js` tests click-to-walk, the running clock and the saveable state.
- `tests/tide.test.js` tests the days on the clock, the sea level (twice a day, a little later each day), walking further out at low water and wading back, wood washing up (where there is room, never more than at the start, deterministic, away from the castaway, saved) and piles the flood takes.
- `tests/fire.test.js` tests the coconuts and the fibre (husking, at most three tufts, new nuts), wood drying, the chance that a fire catches, lighting (kneeling, the cost in rest, fibre used up, failing, stopping early, too small a pile, wet wood, a long press and waiting while it is held), burning down to embers, feeding, the flood, saving, sleeping warm by a fire or cold without one, the torch (taking, no hand free for wood, lighting a pile with it, sticking in the ground and taking up, burning out, water, before sleep), and the input (a long press away from the castaway, `F`).
- `tests/thumbStick.test.js` tests the stick: the mapping (dead zone, directions from the default and a turned view, run at the rim), the input (walking from the stick through `moveIntent`, stopping on release, running, no tap, hold or steering from a stick finger, not counted towards two fingers, waking), and `touchOnly`/`knobOffset`.
- `tests/sleep.test.js` tests tiredness, falling asleep after two days, the length and speed of a sleep, waking early, sleeping in the game (laying wood down first, not in the water, woken by the flood on the wet sand of low water, not falling asleep while wading) and the input (holding the castaway with a finger or mouse, `Z`, waking).
- `tests/sky.test.js` tests the clock and the light of the day: sun up and down, east to west, golden hour, enough light at night, a minimum light height, smooth changes.
- `tests/view.test.js` tests the view controls: zoom and tilt limits, and the input (wheel, `+`/`-`, `Q`/`E`, right-mouse drag, Ctrl/Cmd left to the browser, and on touch: tap, double tap, pinch and twist). Movement and streaming tests also run from turned and tilted views.

Rendering itself is not checked by unit tests. That is what the smoke test with screenshots is for. A headless browser without a GPU draws only a few frames per second, so after loading the smoke test does not play in real time: it pauses drawing, runs the game in fixed 1/60 s steps and draws one settled frame per screenshot (`__driftwood.pause`, `step`, `draw` in `main.js`, for the smoke test only). Stepped walks leave no footprints, because those are laid while drawing.

## Publishing

The game is published on Vercel as a static site. The Vercel project is linked to the GitHub repository: every push to `main` is built there with `npm run build` and goes live from `dist/` (see `vercel.json`). So `main` is always what players see; run `npm test` (and for visual changes the smoke test) before pushing.

## Saving (not built yet)

The design allows for saving without building it yet:

- **The world never needs saving.** It follows entirely from the seed.
- **What needs saving is small:** the seed, the day and the time of day (the tide follows from them), the player's position, how long the castaway has been awake, and what changed on top of the generated world: for now the driftwood carried and the piles (as ids of the pieces), the wood washed up since the start (with when it washed up, for drying), the pieces the sea took back or that were burnt and the last high water that brought wood; the fibre carried and the coconuts taken (and when); the fires, the torches and the number of attempts; how long the castaway has slept in the current sleep; later what was dug and built. `game.state()` already returns that as a plain object.
- **Saving goes behind one interface**, for example `save/store.js` with `load()` and `save(state)`. First a local version in the browser; a backend can come later behind the same interface, without `game` or `render` noticing.

## Agreements

- New game elements only after discussion. Atmosphere comes first.
- Everything is in English: the game, the code and the documentation.
- Three.js is pinned to r128: the shaders depend on that version's internal shader chunks.
