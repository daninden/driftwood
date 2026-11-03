# Handover

Where the work stands, for the next session. Read `CLAUDE.md`, `docs/design.md` and `docs/architecture.md` first, as always. Delete or rewrite this file once the work below is done.

## Done and live on `main`

Everything up to 0.11 "Water" is live: thirst (thirsty after a day, very thirsty after a day and a half, a collapse at two days), drinking by tapping river water or its bank, the drop mark next to the moon, and the burnt fire place that stays two days. Before that, up to 0.10 "Wet wood": wet wood that looks wet until it will burn (dark, cool, a slight sheen) with a damp patch in the sand, carrying that slows more (12 % a piece) with shorter steps and a stoop, and the view kept per island. Before that, up to 0.9 "Name": the fire and the torch, sleeping by the fire, wading, the inventory row, the name asked at the first start, the day line top left (`Dave, day 1`), the waking line, and the ink turning pale at night. Each version with its details is in `docs/versions.md`, the release log.

## Next, agreed with the user

In this order, each with its decisions in `docs/design.md`:

1. **0.11.1 "Still shadows"** (being finished in the current session; it is not listed as live in `docs/versions.md` yet, so it is still to do): around golden hour the shadows tremble even when the castaway stands still. The sun's direction changes every frame and breaks the shadow-texel snapping in `src/render/stage.js`. Fix: quantise the shadow light's direction in small steps (about ¼°). See *Day and night* in `docs/design.md`.
2. **0.12 "Piles"**: a pile holds at most 12 pieces. Driftwood and branches never share a pile (branches come with the lean-to); laying wood on a full pile, or on a pile of the other kind, starts a new pile right next to it. Tally marks in ink (journal style, five-bar gates, a double line under when full) appear above a pile, and above a fire (pieces still on it, max 8; a half-burnt piece as a short stroke; none for embers), while the castaway stands beside it. They fade when he walks away and are pale ink at night. The pile and the fire's tepee visibly grow and shrink with the count. Wet wood cannot be laid on a fire: tapping a fire while carrying wood lays one piece that is dry enough to burn; from a mixed load he picks a dry piece and keeps the wet; with only wet wood nothing happens. Readability of the name/day line top left and the waking line: about 15 px and 22 px, resting opacity 0.55 (0.9 when a day turns); the waking line peaks at 0.95 and stays 5 s; a soft glow in the opposite colour of the ink (pale paper by day, dark at night) behind the letters, no frame. See *Gathering driftwood*, *Fire* and *Camera and view* in `docs/design.md`.
3. **0.13 "Moving water"**: stylised and subtle, in the existing water shaders only (no extra objects). The river gets light streaks and flecks drifting downstream, faster on steep stretches, fords and falls; the white water at fords and falls moves. The sea gets slow glints and lines (a long swell); the surf breathes a little up and down the beach over a few seconds, on top of the tide. Lagoons are calmer. At night only faint moon glints, warm near fire and torch. Moving water does not count as "something happening" for the 15 fps idle rate. See *Art style* and *Quiet frames* in `docs/design.md`.
4. **0.14 "Coconut"**: hunger, eating the nut when husking, the half-coconut mark. See *Basic needs* in `docs/design.md`.
5. **0.15 "Lean-to"**: branches, the lean-to, sleeping under it. The lean-to now needs two piles close together, one with at least 6 driftwood and one with at least 6 branches (hold either to build). See *Basic needs* in `docs/design.md`.
6. **0.16 "Wildlife"**: crabs, fish and birds, atmosphere only. See *Wildlife* in `docs/design.md`.

## Open, not decided

See *Open questions* in `docs/design.md`: loneliness without a fire (to be thought through with the user, without a meter), what a fire means for the strangers.

## Bugs, later

- Only the nearest torch shines brightly: with several torches burning at once only one gives full light (`render/fire` uses one point light for the strongest light near the castaway plus the carried torch). Every torch (and fire) nearby should light its surroundings.
- The first frame's dt can be slightly negative (rAF timestamp before the `performance.now()` taken at boot); in headless runs it briefly sets `sleep.lie` and clears a tap in the first frame.
- The dev panel shows garbled characters when `dist/driftwood.html` is opened from disk (no charset meta in the single-file build).

## Notes

- Work directly on `main`; every push goes live. Run `npm test`, and for visual changes `npm run build && npm run smoke` and look at the screenshots.
- `window.__driftwood` (see `src/main.js`) exposes `world`, `game`, `view` (also `view.scene`), `input`, and `pause`, `step`, `draw` for headless checks. `?spawn=x,z` and `?time=t` help to look at one place or time. A river mouth on seed 1337: `?spawn=-77.7,169.4`. A shallow brook with a bank to drink at, 14 m from the start: water at (-77, 180), bank at (-75.8, 180).
- The user writes in Dutch; everything in the repository stays in English.
