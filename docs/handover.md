# Handover

Where the work stands, for the next session. Read `AGENTS.md`, `docs/design.md` and `docs/architecture.md` first, as always. What each release did is in `docs/versions.md` (the release log); this file only says what is live, what is agreed next, and what is open.

## Status

**Live on `main`: 0.30.15 "Address" (282ac7e).** **Ready to push: 0.30.16 "Reach"** (see `docs/versions.md`). The full `npm test` runs once, as the last step after the last code change before every push to `main`, and must be green (working agreement in `AGENTS.md`); it takes about 180 to 280 s on four cores.

## Next, agreed in order

1. *(nothing agreed is waiting; 0.30.16 "Reach" is built and ready, see above.)* Measured: 0.30.16 changes none of the 24 ten-day lives, because the way home before dark (`EXPLORE_BACK` 0.6, path cost) allows only about 150 to 170 m from home whatever the reach, and the early morning hardly opens (few idle moments before 0.2, the home project has a piece to build almost every day). To decide with the user: whether the trips should be allowed to take more of the day (a later `EXPLORE_BACK`, or a rule for a day of its own), or whether 0.30.16 is enough as it is.

Later, agreed in principle, to work out first: **fishing close to home** (in his river or the sea off his own coast, e.g. with a spear made from a branch; a new way to get food, not a reason for a far trip).

**Milk explored and not built (2026-11-10):** a coconut already quenches 0.15 day of thirst since 0.15; a drink rule that preferred carried nuts made seed 7 walked collapse twice and lose its lean-to (nuts eaten for drink, none left for fibre and food); trips never needed a drink (they start with thirst under 0.25 and are short). The range of exploring is limited by its own rules (reach 80 m + 15 m a day, since 0.30.16 with no cap, and home before dark, which binds first), not by water. Still open: a reason for long trips across the island (the user wants something repeatable; not outposts, not storm wrack, not a one-off goal).

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
