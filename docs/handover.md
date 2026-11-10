# Handover

Where the work stands, for the next session. Read `AGENTS.md`, `docs/design.md` and `docs/architecture.md` first, as always. What each release did is in `docs/versions.md` (the release log); this file only says what is live, what is agreed next, and what is open.

## Status

**Live on `main`: 0.30.11 "Hurry".** **Ready to push (built together, measured once, `npm test` green at the last step): 0.30.12 "Kindling", 0.30.13 "Tideline" and 0.30.14 "Torch"** (see `docs/versions.md`; the measurement is under 0.30.14). The full `npm test` runs once, as the last step after the last code change before every push to `main`, and must be green (working agreement in `AGENTS.md`); it takes about 180 to 280 s on four cores.

## Next, agreed in order

1. **0.30.15 "Address"** (agreed with the user on 2026-11-10): all address options use `?` in `name=value` form joined with `&`. `?seed=2024` and `?new` replace `#seed-2024` and `#new`; old links need not keep working. The README gets an "Address options" block with the player options (seed, new) apart from the test options (spawn, time, awake, speed, quality, and so on), noting that with spawn, time or awake nothing is saved. Docs, tests and the smoke and playtest scripts are updated with it.

The long-simulation bounds follow the policy in `docs/architecture.md`. (The "Woodpile" idea was explored and shelved on 2026-11-10; see *Drying, the way ahead* in `docs/design.md`.)

## Open

- **Lean-to by day 10: 18 of 24 lives** (20 of 24 on 0.30.11, mean day 5.1 against 4.2), after the tuning steps listed in `docs/versions.md` under 0.30.14 (`TIDE_CAMP` 11, wet wood in the camp carried to the strip). Seed 7 (little wood in reach, no lean-to bound) and seed 1337 fresh account for it; the site is fragile (it is rejected as `room` or `footprint` when any pile lies near it). All safety bounds hold. To look at with the user: a daily round that also brings wet wood to the site before day 2, or a sturdier site check.

## Not authorised

Discussed with the user, but not approved for implementation. Do not start any of them without a new agreement.

- **Dropped (the user, 2026-11-10):** "Outposts" (a camp of his own belongs to the loneliness; he should not leave it), worn "Paths", and storm wrack. Under discussion instead: coconut water, so that he can range further from the rivers and still come home every night.
- **0.32 "Garden":** by a camp he lays out a small garden: plants berry cuttings or banana suckers, waters them from a shell, harvests after a few days.
- **0.33 "Castaway's mind AI":** a later, optional language-model mind. The computer keeps doing all drawing and steering; the AI has no sight and is never required for ordinary play.
- **Later** (not agreed in detail, same rows as *Game ideas* in `docs/design.md`): bigger buildings (a hut of wood and fronds, a drying rack, a store), wear and repair, and the player's "build here" marking (tap a spot, choose a "here" icon in the arc; Dave remembers and builds there) instead of a full build mode with menus. Maybe short journal lines. Exploring over climbing routes (terraces) needs the path follower to be reliable on routes first.

## Open, not decided

- See *Open questions* in `docs/design.md`: loneliness without a fire (to be thought through with the user, without a meter), and what a fire means for the strangers.
- The user may drop mobile (phone) support altogether (said on 2026-11-05; not decided). The installable app (PWA, proposed as "Ashore") is dropped for that reason.
- Seed 7 walked: the home terrace is boxed in by climbing routes and has little wood, so Dave builds late and never explores far there. Possible later: let the home project walk to beaches he has not seen, or take the surplus of the fire's pile (not agreed).

## Notes

- The user writes in Dutch; everything in the repository stays in English.
- Developer helpers (`window.__driftwood`, `?spawn=`, `?time=`, `?quality=`, the smoke and playtest scripts) are described in `docs/architecture.md`.
- A cross-fade between two shadow lights was tried live and rejected: the shadows looked doubled during the fade.
