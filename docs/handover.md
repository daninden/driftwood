# Handover

Where the work stands, for the next session. Read `CLAUDE.md`, `docs/design.md` and `docs/architecture.md` first, as always. Delete or rewrite this file once the work below is done.

## Done and live on `main`

Everything up to 0.9 "Name" is live: the fire and the torch, sleeping by the fire, wading, the inventory row, the name asked at the first start, the day line top left (`Dave, day 1`), the waking line, and the ink turning pale at night. Each version with its details is in `docs/versions.md`, the release log.

## Next, agreed with the user

In this order, each with its decisions in `docs/design.md`:

1. **0.10 "Wet wood"**: wood stays clearly wet until it is dry enough to burn, then bleaches quickly; a damp patch in the sand under fresh wood shrinks and disappears; carrying slows 12 % per piece (three pieces: 64 %) with shorter steps and a slight stoop; the view is saved per island; starting over or an old save starts in the default view. See `docs/design.md`, *Gathering driftwood* and *Camera and view*.
2. **0.11 "Water"**: thirst and drinking, the drop mark, and the burnt fire place that stays visible about two days. See `docs/design.md`, *Basic needs*.
3. **0.12 "Coconut"**: hunger, eating the nut when husking, the half-coconut mark. See `docs/design.md`, *Basic needs*.
4. **0.13 "Lean-to"**: branches, the lean-to, sleeping under it. See `docs/design.md`, *Basic needs*.

## Open, not decided

See *Open questions* in `docs/design.md`: loneliness without a fire (to be thought through with the user, without a meter), what a fire means for the strangers.

## Notes

- Work directly on `main`; every push goes live. Run `npm test`, and for visual changes `npm run build && npm run smoke` and look at the screenshots.
- `window.__driftwood` (see `src/main.js`) exposes `world`, `game`, `view` (also `view.scene`), `input`, and `pause`, `step`, `draw` for headless checks. `?spawn=x,z` and `?time=t` help to look at one place or time. A river mouth on seed 1337: `?spawn=-77.7,169.4`.
- The user writes in Dutch; everything in the repository stays in English.
