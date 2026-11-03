# Handover

Where the work stands, for the next session. Read `CLAUDE.md`, `docs/design.md` and `docs/architecture.md` first, as always. Delete or rewrite this file once the work below is done.

## Done and live on `main`

- **Fire** (`game/fibre`, `game/fire`, `render/coconuts`, `render/fire`): coconuts under the palms are husked for fibre (at most 3 tufts); washed-up wood is wet and dries over a day; a hold on a pile of 4+ pieces (or `F`) drills fire with the staff (costs rest, uses a tuft, may fail); fires burn down to embers, are fed one piece at a time, and the flood puts them out.
- **Sleeping by the fire** (`game/sleep` `COLD_SLEEP`, `game/fire` `warm`): without a fire within 3 m he wakes after four hours, half rested; by a fire he sleeps the night through.
- **Torch** (`game/fire`, `render/fire` `makeTorch`, `render/hero`): taken out of a burning fire with empty hands; burns two hours, lights a circle at night, leaves no hand free for wood, can be stuck in the ground and taken up again, goes out in deep water and under the flood; it also lights a dry pile without fibre (`kindle`).
- **Fixes**: the river runs on down to the sea at low water (shader uniform in `render/water`); only a left click, a tap or a walking key wakes the castaway; the decorative, unpickable driftwood in `render/water` is gone and logs are picked by their drawn shape (`islandView.pickLog`); palm fronds write full alpha (`geometry.opaqueCutout`), so they no longer glow pale at night.

- **Wading** (`world/rivers`, `game/movement`, `render/water`): the castaway wades rivers up to his waist (`WADE_MAX` 0.35); narrow upstream brooks are shallow and can be waded anywhere, each river has 2 to 4 fords along the middle reach (`rv.fords`), shown only by stones, gravel and whiter rippling water, and the wide deep reach towards the sea cannot be waded.

All tests (191) and the smoke test pass.

## Next, agreed with the user (in this order)

### 1. Inventory: a row of drawings next to the moon

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
