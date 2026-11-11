# Handover

Where the work stands, for the next session. Read `AGENTS.md`, `docs/design.md` and `docs/architecture.md` first, as always. What each release did is in `docs/versions.md` (the release log); this file only says what is live, what is agreed next, and what is open.

## Status

**Live on `main`: 0.30.21 "Practice"** (the chance of lighting a fire, digging a crab and spearing a fish rises with practice, from the beginner's to a ceiling; nothing shown; see `docs/versions.md`), on top of 0.30.20 "Words" (e02202c). The full `npm test` runs once, as the last step after the last code change before every push to `main`, and must be green (working agreement in `AGENTS.md`); it takes about 180 to 280 s on four cores.

## Next, agreed in order

1. **0.31 "Axe"** (being built; agreed with the user on 2026-11-11): a stone axe (1 branch, 1 stone, 1 fibre), felling any tree (broadleaf, pine, palm, giants too), a log of about 2 m (a giant 2 to 3) carried alone on the shoulder to a log pile (kind `log`, at most 12, never burns, never taken by the flood, never disappears), crown material left as ordinary branches, fronds and coconuts, no stump in the way (a flat mark only), nothing regrows. Dave only fells once his shelter is complete (lean-to, walls, ring, bed), at most one tree a day in the mornings: first every tree within 10 m of the lean-to (the clearing, as far as he can reach), then the nearest trees outside it until one pile of 12; log piles stand just outside the clearing (11 to 13 m), more wood makes a new pile beside the last. The user expects a shelter to stand on the beach among the palms almost always. Clearing (logs as hut material) and Hut are to be worked out with the user later.
2. **0.31.1 "Milk"** (agreed with the user on 2026-11-11, after a playtest: on a journey he camped, got thirsty and walked almost all the way home to drink): (a) **coconut milk on journeys only:** away from home, thirsty, and the nearest known fresh water further than about 60 m of path, he husks a coconut from a palm nearby and drinks its milk instead of walking back; never a carried nut (the stores at home are not touched, which is what made seed 7 walked collapse in the 2026-11-10 attempt); (b) **shells filled before a journey:** on the morning a journey starts he fills his empty shells at the river first. Measure the 24 ten-day lives (thirst, collapses, walks back from a journey camp) before and after.
3. *(after these: nothing agreed is waiting.)* Built before them: Built before it: 0.30.20 "Words" (actions never speak, only reasons; need thoughts for the player) and 0.30.19 "Journey": Agreed with the user on 2026-11-11 and built: about once every 5 to 7 days from day 4, when calm at home, Dave goes on a journey: out in the morning to a far spot he does not know, a night on the ground by a small fire of his own, home the next morning; climbing routes (slope under 3.2) are open to journeys and to nothing else. Measured on the 24 ten-day lives: 20 journeys in 16 lives (12 finished within the ten days, 8 still on at the end), 240 to 280 m from home, about 27 hours away, 13 nights away (12 by a fire, 1 cold), the known ground on day 10 from 15.8% to 24.6% of the land cells (cells gained 142 to 290), no collapse, max thirst 0.86 (0.78 before), max hunger 0.86 (same), stuck 80 (85), nopath 0; 20-day lives (4): 2.75 journeys each. See `docs/versions.md`.

Later, agreed in principle, to work out first: **more on fishing** (smoking fish, fishing in the river, a fish that is drawn and is the target, wear of the spear). Not agreed in detail; 0.30.17 has none of them.

**Milk explored and not built (2026-11-10):** a coconut already quenches 0.15 day of thirst since 0.15; a drink rule that preferred carried nuts made seed 7 walked collapse twice and lose its lean-to (nuts eaten for drink, none left for fibre and food); trips never needed a drink (they start with thirst under 0.25 and are short). The range of exploring is limited by its own rules (reach 80 m + 15 m a day, since 0.30.16 with no cap, and home before dark, which binds first), not by water. Still open: a reason for long trips across the island (the user wants something repeatable; not outposts, not storm wrack, not a one-off goal).

The long-simulation bounds follow the policy in `docs/architecture.md`. (The "Woodpile" idea was explored and shelved on 2026-11-10; see *Drying, the way ahead* in `docs/design.md`.)

## Open

- **Planner limits met on the way to 0.30.19 (not fixed, do not break journeys; measured 2026-11-11 with the real `stepPlayer` and `game.update` on 25 long walks per island and routes of every cluster):** (1) **About 4.5% of the walks over narrow climbing routes get no plan**, because a steep stretch of 1 to 2 m falls between two cell centres of the 1.5 m grid that are not standable (the cell grid has no node on it; `game/path` finds no edge). A journey chooses another target when the planner finds no way, so it only costs a target. (2) **A start right on a cliff rim** can connect to a cell below the wall (the start's connection lines are checked only for the wall rule of `game/walk`, not for the height of the rim), and the follower then stalls under it. A journey therefore never picks a camp spot with a drop or rise of 0.8 m within 2 m (`JOURNEY_RIM`); the day trips and the errands are as before. *Possible fix (not agreed):* treat route cells of slope under 3.2 as standable on the cell grid (a standable cell that is a route cell), or add fine nodes (`game/fine`) along such routes; and check that the connections of a start and a goal do not cross a wall (a drop of more than the step rule allows between the point and the cell). Following was reliable where a plan existed: 99.8% of the planned walks over routes arrived, no collapse.
- **Reach (0.30.16): "home before dark" is still the limit of the day trips** (see the next point). Journeys (0.30.19) are the long way out; the day trips are unchanged (150 to 170 m of path cost from home, back by 0.6). Open: whether the day trips should be allowed a later return time (`EXPLORE_BACK`) now that journeys exist.
- **For the user: Reach (0.30.16) had no measurable effect.** The 24 ten-day lives were identical, life by life, before and after it: "home before dark" (back by `EXPLORE_BACK` 0.6, planned with the path cost) binds at about 150 to 170 m of path cost from home whatever the reach, and the early morning hardly opens (few idle moments before 0.2; the home project has a piece to build almost every day). Options to discuss: a later return time (`EXPLORE_BACK`), or a day of its own for long trips (a rule: one day in so many he does nothing else). Nothing is changed until agreed.
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
