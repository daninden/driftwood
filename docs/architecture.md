# Architecture of Driftwood

Driftwood is small and lonely: one island, one castaway, atmosphere first (see `design.md`). The architecture has to keep it that way. Every part has one job, can be tested on its own, and knows as little as possible about the rest.

## Layers

```
core/     numbers and noise           no dependencies
world/    the island as data          uses core (and only the curve maths of three)
game/     rules and game state        uses core and world
render/   everything you see          uses core, world (read only) and three
main.js   wires it all together       the only place that knows every layer
```

Rules:

- **Arrows point one way.** `world` does not know `game` or `render`. `game` does not know `render`. `render` reads the world and the player state but never changes them.
- **`world` and `game` are pure.** They touch neither the DOM nor WebGL, so they run in Node (the tests) and could later run in a Web Worker.
- **Everything follows from the seed.** The same number gives the same island, the same trees and the same colours. Every tile has its own generator (seed, tx, tz), so the order in which tiles are built does not matter.
- **No interface.** There is deliberately no HUD, map or menu. What you see is the island.

## Modules

| Module | Job |
|---|---|
| `core/noise` | Seeded noise (`vnoise`, `fbm`), PRNG and tile hash. The formulas are frozen. |
| `core/math` | `ss` (smoothstep), `lerp`, colour mixing. |
| `core/view` | The fixed isometric view direction: what "towards the camera" and "screen right" mean. |
| `core/slicer` | Time slicing: heavy work as a generator that pauses when the frame budget is spent. |
| `world/constants` | Dimensions: 720 × 720 area, 0.25 grid, 40-unit tiles, terrace heights. |
| `world/shape` | Island outline and scattered highlands; scale to terrace level L. |
| `world/terrain` | From L to height: terraces, rock walls and the natural passages. |
| `world/heightfield` | The height and level grids, and bilinear sampling. |
| `world/rivers` | Rivers (Dijkstra, smooth curve), waterfalls, carving beds and banks. |
| `world/vegetation` | Per tile: trees, palms, rocks, bushes, root spots (data only). |
| `world/occlusion` | Darker ground under crowns and in hollows. |
| `world/spots` | Finding places: the start spot, examples of each passage (for tests). |
| `world/world` | Builds everything from a seed and returns one read-only object with queries. |
| `game/movement` | Walking rules: walls block, passages let you climb, sliding along walls. |
| `game/input` | Keys and clicks/taps to a movement intent; mouse wheel and `+`/`-` to zoom steps. |
| `game/game` | Game state (the player) and the per-frame update. |
| `render/palette` | All colours of style C in one place, the castaway's included. |
| `render/terrainColor` | Painted ground colour per point (pure, tested against the prototype). |
| `render/materials` | Toon shading, outlines, the rock shader for steep walls, see-through crowns. |
| `render/geometry` | Shared shapes (crowns, rocks, grass, ferns, driftwood) and matrix helpers. |
| `render/batch` | Many small objects into a few InstancedMeshes with outlines. |
| `render/props` | Detailed trees, palms, roots and lianas, beach finds, the tide line. |
| `render/terrainTile` | Ground mesh and painted texture of one tile. |
| `render/farTiles` | A cheap version of every tile, always present. |
| `render/nearTile` | The full-detail version of one tile. |
| `render/streaming` | Which detailed tiles exist; building one at a time, dropping old ones. |
| `render/ghosts` | Making crowns between camera and castaway see-through. |
| `render/water` | Sea, river ribbons, surf, foam and spray at waterfalls. |
| `render/hero` | The castaway (hat, beard, torn shirt, shorts, bare feet) with a walk cycle. |
| `render/footprints` | Footprints in the sand. |
| `render/camera` | Orthographic camera that follows; player zoom within fixed limits; zooms out on the summits; ground picking. |
| `render/mood` | Atmosphere per terrace: colour grading, mist, cooler light, paper grain, vignette. |
| `render/stage` | Renderer, scene, lights and the shadow that follows the view. |
| `render/islandView` | Puts all render modules together and draws a frame. |

Every module starts with a header that says what it does, what it exports and what it depends on.

## One frame

```
input ──> view.zoomBy(input.takeZoom())   zoom is a view setting, not game state
  │
  └─> game.update(input, dt) ──> the player moves (game/movement)
                │
                └─> { distance, terrain } ──> view.render(player, info, dt)
                                                ├ camera and sun follow
                                                ├ castaway and footprints
                                                ├ streaming: at most ~9 ms building tiles
                                                ├ far tiles on/off
                                                ├ see-through crowns
                                                ├ mood of the current terrace
                                                └ draw
```

## Loading

`generateWorld` takes a few seconds in the browser (mostly the height grid). Then `islandView` builds the water and the far tiles. `main.js` lets the browser breathe between the steps. There is no loading screen: you see the background colour, and the island fades in when it is ready.

A Web Worker is not needed yet: nothing stutters while playing, because detailed tiles are built in slices of about 9 ms per frame. Because `world` is pure, it can move to a worker later if loading gets too slow.

## Testing

```
npm test          unit tests (Vitest, Node), about 30 s
npm run build     builds dist/ and dist/driftwood.html (a single file)
npm run smoke     opens the build in headless Chromium, walks a bit, takes screenshots
```

- `tests/world.test.js` compares seed 1337 with a golden file exported from the style prototype: heights, levels, slopes, rivers, passages, vegetation per tile and ground colours. Any change to the generation shows up here.
- `tests/movement.test.js` really walks over the island: every passage must lead up, walls without a passage must stop you, and so must the sea.
- `tests/streaming.test.js`, `tests/ghosts.test.js` and `tests/core.test.js` test the pure logic without a browser.
- `tests/game.test.js` tests click-to-walk and the saveable state.
- `tests/zoom.test.js` tests the zoom limits and the zoom input (wheel, `+`/`-`, Ctrl/Cmd left to the browser).

Rendering itself is not checked by unit tests. That is what the smoke test with screenshots is for.

## Saving (not built yet)

The design allows for saving without building it yet:

- **The world never needs saving.** It follows entirely from the seed.
- **What needs saving is small:** the seed, the player's position, and later what the player changed (dug, built, gathered) as a list of changes on top of the generated world. `game.state()` already returns that as a plain object.
- **Saving goes behind one interface**, for example `save/store.js` with `load()` and `save(state)`. First a local version in the browser; a backend can come later behind the same interface, without `game` or `render` noticing.

## Agreements

- New game elements only after discussion. Atmosphere comes first.
- Everything is in English: the game, the code and the documentation.
- Three.js is pinned to r128: the shaders depend on that version's internal shader chunks.
