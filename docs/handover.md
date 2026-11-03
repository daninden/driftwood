# Handover

Where the work stands, for the next session. Read `CLAUDE.md`, `docs/design.md` and `docs/architecture.md` first, as always. Delete or rewrite this file once the work below is done.

## Done and live on `main`

Everything up to 0.12.1 "Smooth shadows" is live: the shadow light turns in steps of 1/32° (was ¼°, which jerked) and never comes below 15° (was about 11.5°); PCF soft edges are off. Before that, up to 0.12 "Piles": piles hold at most 12 pieces and one kind (a new pile starts right next to a full one), tally marks in ink above a pile and a fire while he stands beside it (`src/render/tallyMarks.js`), wet wood cannot be laid on a fire, the fire's tepee grows and shrinks with its pieces, and the day line and waking line are bigger and clearer with a soft glow. Before that, up to 0.11.1 "Still shadows": the shadows hold still around sunrise and sunset and move in tiny steps as the sun moves (the shadow light's direction is quantised in steps of about ¼°, see `src/render/stage.js`). Before that, up to 0.11 "Water": thirst (thirsty after a day, very thirsty after a day and a half, a collapse at two days), drinking by tapping river water or its bank, the drop mark next to the moon, and the burnt fire place that stays two days. Before that, up to 0.10 "Wet wood": wet wood that looks wet until it will burn (dark, cool, a slight sheen) with a damp patch in the sand, carrying that slows more (12 % a piece) with shorter steps and a stoop, and the view kept per island. Before that, up to 0.9 "Name": the fire and the torch, sleeping by the fire, wading, the inventory row, the name asked at the first start, the day line top left (`Dave, day 1`), the waking line, and the ink turning pale at night. Each version with its details is in `docs/versions.md`, the release log.

## Next, agreed with the user

In this order, each with its decisions in `docs/design.md`:

1. **0.13 "Action"**: clicking and tapping only walks (on a thing he walks to beside it and does nothing); every action goes through one action button: Space, and an ink ring bottom right (above the thumb stick on touch screens, in the corner on a desktop, also clickable) with a small ink icon of what it will do. A short press does the obvious thing for what he stands beside; holding it lights a pile (drill or torch) or sleeps, with a ring that fills while held. F and Z stay as shortcuts. Includes the agreed fix that a full fire takes no more wood. See *The action button* in `docs/design.md`.
2. **0.14 "Moving water"**: stylised and subtle, in the existing water shaders only (no extra objects). The river gets light streaks and flecks drifting downstream, faster on steep stretches, fords and falls; the white water at fords and falls moves. The sea gets slow glints and lines (a long swell); the surf breathes a little up and down the beach over a few seconds, on top of the tide. Lagoons are calmer. At night only faint moon glints, warm near fire and torch. Moving water does not count as "something happening" for the 15 fps idle rate. See *Art style* and *Quiet frames* in `docs/design.md`.
3. **0.15 "Coconut"**: hunger, eating the nut when husking, the half-coconut mark. See *Basic needs* in `docs/design.md`.
4. **0.16 "Lean-to"**: branches, the lean-to, sleeping under it. The lean-to now needs two piles close together, one with at least 6 driftwood and one with at least 6 branches (hold either to build). See *Basic needs* in `docs/design.md`.
5. **0.17 "Wildlife"**: crabs, fish and birds, atmosphere only. See *Wildlife* in `docs/design.md`.
6. **0.17.1 "River mouth"** (fix): the river does not meet the sea well. Beyond the mouth its bed runs on into the sea floor as a deep, dark trough with a rounded end, clearly visible through the water (seen on seed 1337 at a mouth with sand on both sides). The river bed should flatten out into the sea floor at the mouth, so the shallows run on smoothly. This changes the island: `tests/world.test.js` guards seed 1337 against the style prototype, so the prototype gets the same change and the fixture is regenerated with `prototypes/make-golden.js` (see `CLAUDE.md`).

## Open, not decided

See *Open questions* in `docs/design.md`: loneliness without a fire (to be thought through with the user, without a meter), what a fire means for the strangers.

## Bugs, later

- **Agreed fix, with 0.13 "Action":** a full fire (8 pieces) takes no more wood. Tapping it while carrying wood does nothing, and he keeps the piece (it is now wasted). See *Fire* in `docs/design.md`.

- Only the nearest torch shines brightly: with several torches burning at once only one gives full light (`render/fire` uses one point light for the strongest light near the castaway plus the carried torch). Every torch (and fire) nearby should light its surroundings.
- The first frame's dt can be slightly negative (rAF timestamp before the `performance.now()` taken at boot); in headless runs it briefly sets `sleep.lie` and clears a tap in the first frame.
- The dev panel shows garbled characters when `dist/driftwood.html` is opened from disk (no charset meta in the single-file build).

## Notes

- **Temporary `?shadows=step,min,soft`** (step and min in degrees, soft 0/1; read in `src/main.js`, applied by `src/render/sky.js`): compare shadow variants by eye, then remove the parameter and record the choice in `docs/design.md`. Defaults are `1/32,15,0`. Try `?shadows=0.25,11.54,0` (the 0.11.1 look), `?shadows=0.03125,15,1` (default plus soft edges), `?shadows=0.03125,20,0` (higher light, shorter shadows), `?shadows=0.125,12,0` (in between). Headless check at sunrise: the finer the step the more small flicker in the shadows on sand (see the 0.12.1 numbers in the session report); if the user sees shimmer at sunrise try `0.125,15,0` or the soft variant. Combine with `?time=0.185` (sunrise) or `?time=0.805` (sunset).

- Work directly on `main`; every push goes live. Run `npm test`, and for visual changes `npm run build && npm run smoke` and look at the screenshots.
- `window.__driftwood` (see `src/main.js`) exposes `world`, `game`, `view` (also `view.scene`), `input`, and `pause`, `step`, `draw` for headless checks. `?spawn=x,z` and `?time=t` help to look at one place or time. A river mouth on seed 1337: `?spawn=-77.7,169.4`. A shallow brook with a bank to drink at, 14 m from the start: water at (-77, 180), bank at (-75.8, 180).
- The user writes in Dutch; everything in the repository stays in English.
