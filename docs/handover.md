# Handover

Where the work stands, for the next session. Read `CLAUDE.md`, `docs/design.md` and `docs/architecture.md` first, as always. Delete or rewrite this file once the work below is done.

## Done and live on `main`

- **Fire** (`game/fibre`, `game/fire`, `render/coconuts`, `render/fire`): coconuts under the palms are husked for fibre (at most 3 tufts); washed-up wood is wet and dries over a day; a hold on a pile of 4+ pieces (or `F`) drills fire with the staff (costs rest, uses a tuft, may fail); fires burn down to embers, are fed one piece at a time, and the flood puts them out.
- **Sleeping by the fire** (`game/sleep` `COLD_SLEEP`, `game/fire` `warm`): without a fire within 3 m he wakes after four hours, half rested; by a fire he sleeps the night through.
- **Torch** (`game/fire`, `render/fire` `makeTorch`, `render/hero`): taken out of a burning fire with empty hands; burns two hours, lights a circle at night, leaves no hand free for wood, can be stuck in the ground and taken up again, goes out in deep water and under the flood; it also lights a dry pile without fibre (`kindle`).
- **Fixes**: the river runs on down to the sea at low water (shader uniform in `render/water`); only a left click, a tap or a walking key wakes the castaway; the decorative, unpickable driftwood in `render/water` is gone and logs are picked by their drawn shape (`islandView.pickLog`); palm fronds write full alpha (`geometry.opaqueCutout`), so they no longer glow pale at night.

All tests (186) and the smoke test pass.

## Next, agreed with the user (in this order)

### 1. Rivers: wading to the waist, fords

Decided in `docs/design.md` (*World*, "Wading"). Not started.

- Now: `game/movement` `stepFactor` lets you wade river water up to 0.85 deep (`b.inRiver && b.depth > 0.85`), but the castaway is only 0.75 tall, so his head goes under. `render/hero` sinks him by `min(0.35, wade * 0.6)`.
- Measured centre-line depth on seed 1337 (`rv.LW(t) - H` along `rv.pts`): upstream about 0.3–0.4, middle reach 0.5–0.7, towards the mouth rising to 3 m. With a 0.35 limit almost the whole river would block, hence the fords.
- Plan:
  - Lower the wading limit to about 0.35 (rivers; the sea rule stays as it is).
  - Carve 2–4 fords per river along the middle reach in `world/rivers.js` (in the bed-carving loop at the end: raise the bed to about 0.2–0.25 below the water level over a short stretch, a few metres long, deterministic from the seed). Keep the deep stretch near the sea unfordable. Mark the fords on the river (for example `rv.fords: [{ k0, k1 }]`).
  - Show them by nature: gravel and stones in the bed and white rippling water (`render/water` vertex colour/foam; `render/nearTile` or `world/vegetation` for the stones; stones on a ford must not block, like stones on a climbing route).
  - This changes the generated world on purpose. Following `CLAUDE.md`: change `prototypes/island-generator/generator.html` the same way, then regenerate `tests/fixtures/golden-1337.json` with `node prototypes/make-golden.js`. The hook point is `log('water & foam');`.
  - Check that every terrace is still reachable: `tests/movement.test.js` walks the passages and may cross rivers. Add tests: wading stops at the limit, every ford can be crossed, the deep stretch cannot.
  - Update `docs/architecture.md` (`world/rivers`, `game/movement`, `render/water`).

### 2. Inventory: a row of drawings next to the moon

Decided in `docs/design.md` (*Carrying and the inventory*). Not started.

- Rule from the user: what he holds in his hands is visible in his hands; what he carries loose is drawn in the inventory. Wood and the torch stay out of it.
- For now only the coconut fibre goes in it (`game.fibre.carried`, 0–3). The tufts at his waist in `render/hero` can stay or go.
- Build it like `render/restMark` (the moon, `#rest` in `index.html`): a small module, for example `render/carryMark`, with a pure part that can be tested in `tests/render.test.js` (which drawings to show, the opacity over time) and a DOM part fed by `main` from the game state. Same dark brown ink (`#2e2418`), faint most of the time, clearer for a few seconds after a change. Simple SVG drawings in a journal style. No boxes, frames or numbers.
- Make it general enough for later items (nails, knife, ...) without building those.
- Run the smoke test and look at the screenshots, on a phone-sized viewport too (the moon sits bottom left with safe-area insets).

## Open, not decided

See *Open questions* in `docs/design.md`: loneliness without a fire (to be thought through with the user, without a meter), darker nights (now that fire and torch give light), what a fire means for the strangers.

## Notes

- Work directly on `main`; every push goes live. Run `npm test`, and for visual changes `npm run build && npm run smoke` and look at the screenshots.
- `window.__driftwood` (see `src/main.js`) exposes `world`, `game`, `view` (also `view.scene`), `input`, and `pause`, `step`, `draw` for headless checks. `?spawn=x,z` and `?time=t` help to look at one place or time. A river mouth on seed 1337: `?spawn=-77.7,169.4`.
- The user writes in Dutch; everything in the repository stays in English.
