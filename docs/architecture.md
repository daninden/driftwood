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
- **No interface.** There is deliberately no HUD, map or menu. What you see is the island.

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
| `world/rivers` | Rivers (Dijkstra, smooth curve), waterfalls, carving beds and banks. |
| `world/vegetation` | Per tile: trees, palms, rocks, bushes, root spots (data only). |
| `world/occlusion` | Darker ground under crowns and in hollows. |
| `world/spots` | Finding places: the start spot, examples of each passage (for tests). |
| `world/world` | Builds everything from a seed and returns one read-only object with queries. |
| `game/movement` | Walking rules: walls block, passages let you climb, sliding along walls; trunks, boulders and crags (from the tile data, cached per tile) block and you slide round them. |
| `game/input` | Keys and clicks/taps to a movement intent (a double tap runs); mouse wheel, `+`/`-` and a two-finger pinch to zoom steps; `Q`/`E`, right-mouse drag and a two-finger twist to turn (the mouse also tilts). |
| `game/clock` | The time of day: a 20-minute day, part of the game state. |
| `game/game` | Game state (the player and the clock) and the per-frame update. |
| `render/palette` | All colours of style C in one place, the castaway's included. |
| `render/terrainColor` | Painted ground colour per point (pure, tested against the prototype). |
| `render/materials` | Toon shading, outlines, the rock shader for steep walls, see-through crowns. |
| `render/geometry` | Shared shapes (crowns, rocks, grass, ferns, driftwood) and matrix helpers. |
| `render/batch` | Many small objects into a few InstancedMeshes with outlines. |
| `render/props` | Detailed trees, palms, roots and lianas, beach finds, the tide line. Trees, pines and palms each pick a shape and colours from the tile generator. |
| `render/terrainTile` | Ground mesh and painted texture of one tile. |
| `render/farTiles` | A cheap version of every tile. Those in view at the start are built before the game starts; the rest follow in the background, about 3 ms per frame, tiles in view first. |
| `render/nearTile` | The full-detail version of one tile. |
| `render/streaming` | Which detailed tiles exist for the current view; building one at a time, dropping old ones. |
| `render/ghosts` | Making crowns between camera and castaway see-through, from any view angle. |
| `render/water` | Sea, river ribbons, surf, foam and spray at waterfalls. |
| `render/hero` | The castaway (hat, beard, torn shirt, shorts, bare feet) with a walk cycle. |
| `render/footprints` | Footprints in the sand. |
| `render/camera` | Orthographic camera that follows; player zoom within fixed limits; free turning and limited tilting, eased; zooms out on the summits; ground picking. |
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
  └─> game.update(input, dt) ──> the player moves (game/movement), the clock runs
                │
                └─> { distance, terrain, time } ──> view.render(player, info, dt)
                                                ├ camera follows; sun or moon from the time (render/sky)
                                                ├ castaway and footprints
                                                ├ streaming: at most ~9 ms building tiles
                                                ├ far tiles on/off
                                                ├ see-through crowns
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
npm run smoke     opens the build in headless Chromium, walks a bit, takes screenshots
```

- `tests/world.test.js` compares seed 1337 with a golden file exported from the style prototype: heights, levels, slopes, rivers, passages, vegetation per tile and ground colours. Any change to the generation shows up here.
- `tests/movement.test.js` really walks over the island: every passage must lead up, walls without a passage must stop you, and so must the sea; trunks, palms and boulders must stop you while you slide past them, small stones must not.
- `tests/streaming.test.js`, `tests/ghosts.test.js` and `tests/core.test.js` test the pure logic without a browser.
- `tests/heights.test.js` checks that building the height grids in strips (as the workers do) gives exactly the same grids, and that a failing worker lets `main` fall back.
- `tests/loading.test.js` tests the loading bar: steps in order, never backwards, ends full. The smoke test also saves the loader halfway (`smoke-0.png`) and checks the bar ends full.
- `tests/stage.test.js` checks that the shadow depth bias stays a few centimetres at every zoom level.
- `tests/props.test.js` tests the variety of trees, pines and palms (shapes, colours, lean directions, how many withered fronds) with a recording batch.
- `tests/game.test.js` tests click-to-walk, the running clock and the saveable state.
- `tests/sky.test.js` tests the clock and the light of the day: sun up and down, east to west, golden hour, enough light at night, a minimum light height, smooth changes.
- `tests/view.test.js` tests the view controls: zoom and tilt limits, and the input (wheel, `+`/`-`, `Q`/`E`, right-mouse drag, Ctrl/Cmd left to the browser, and on touch: tap, double tap, pinch and twist). Movement, ghost and streaming tests also run from turned and tilted views.

Rendering itself is not checked by unit tests. That is what the smoke test with screenshots is for.

## Publishing

The game is published on Vercel as a static site. The Vercel project is linked to the GitHub repository: every push to `main` is built there with `npm run build` and goes live from `dist/` (see `vercel.json`). So `main` is always what players see; run `npm test` (and for visual changes the smoke test) before pushing.

## Saving (not built yet)

The design allows for saving without building it yet:

- **The world never needs saving.** It follows entirely from the seed.
- **What needs saving is small:** the seed, the time of day, the player's position, and later what the player changed (dug, built, gathered) as a list of changes on top of the generated world. `game.state()` already returns that as a plain object.
- **Saving goes behind one interface**, for example `save/store.js` with `load()` and `save(state)`. First a local version in the browser; a backend can come later behind the same interface, without `game` or `render` noticing.

## Agreements

- New game elements only after discussion. Atmosphere comes first.
- Everything is in English: the game, the code and the documentation.
- Three.js is pinned to r128: the shaders depend on that version's internal shader chunks.
