# Handover

Where the work stands, for the next session. Read `AGENTS.md`, `docs/design.md` and `docs/architecture.md` first, as always. What each release did is in `docs/versions.md` (the release log); this file only says what is live, what is agreed next, and what is open.

## Status

**Ready to push: 0.30.7 "Clearing"** (2026-11-10): Dave sites his lean-to as the real one (see `docs/versions.md` for the decisions and the measured numbers). Live on `main` until then: 0.30.6 "Trust". The full `npm test` runs once, as the last step after the last code change before every push to `main`, and must be green (working agreement in `AGENTS.md`); it takes about 180 to 280 s on four cores.

## Next, agreed in order

1. **0.30.8 "Morning"**: while the wake line "Dave wakes. Day N." is showing, a new thought line above Dave waits until it has faded; the L log gets the line at once with its own time; no other change.
2. **0.30.9 "Errands"**: fix two bugs found by measurement on 0.30.6: about 34% of wet-strip stock errands end unfinished with wood in his arms (average 92 s; suspected the idle-goal time limit, which breaks the 0.29.8 rule that he finishes his task), and a loop where he picks up and drops 3 fronds 8 to 16 times in a row (in 7 of 24 runs); and if roasting a carried crab fails, he eats other food he carries (agreed 2026-11-10). Then measure the wood time again (about 34% of waking time on 0.30.6) before the user decides whether that is too much.

## Not authorised

Discussed with the user, but not approved for implementation. Do not start any of them without a new agreement.

- **0.31 "Outposts":** at places he often goes that lie far from home (the river, a berry-rich forest edge, the foot of a climbing route) Dave makes a small camp (a lean-to and a fire place); worn paths appear where he walks often.
- **0.32 "Garden":** by a camp he lays out a small garden: plants berry cuttings or banana suckers, waters them from a shell, harvests after a few days.
- **0.33 "Castaway's mind AI":** a later, optional language-model mind. The computer keeps doing all drawing and steering; the AI has no sight and is never required for ordinary play.
- **Later** (not agreed in detail, same rows as *Game ideas* in `docs/design.md`): bigger buildings (a hut of wood and fronds, a drying rack, a store), wear and repair, and the player's "build here" marking (tap a spot, choose a "here" icon in the arc; Dave remembers and builds there) instead of a full build mode with menus. Maybe short journal lines. Exploring over climbing routes (terraces) needs the path follower to be reliable on routes first.

## Open, not decided

- See *Open questions* in `docs/design.md`: loneliness without a fire (to be thought through with the user, without a meter), and what a fire means for the strangers.
- The user may drop mobile (phone) support altogether (said on 2026-11-05; not decided). The installable app (PWA, proposed as "Ashore") is dropped for that reason.
- Seed 7 walked: the home terrace is boxed in by climbing routes and has little wood, so Dave builds late and never explores far there. Possible later: let the home project walk to beaches he has not seen, or take the surplus of the fire's pile (not agreed).

## Bugs, later

Entries marked *to check* were written long ago and have not been re-verified after 0.30.3 "Routes".

- **Stuck in a steep pocket** (0.29.3, seed 2024 walked, one variant): at (-106.8, -147.4), slope 4.2 below a ledge, the path leads down but `stepPlayer` allows no step out, so `walk` gives up until morning. A fix belongs in `game/path` or `game/movement`. *To check.*
- **Cusp between two overlapping trunks** (0.28.1): `stepPlayer` gives up when he pushes straight into two overlapping trunks (it only tries other directions for terrain walls, not obstacles). River crossings at the border of `WADE_MAX` still need a playtest in a browser. *To check.*
- **Branch regrowth save/load** can differ in the order and bookkeeping of `branches.grown`. *To check.*
- **Seed 11** (0.27.5 playtest, 20 days): 13 `food-not-offered` events (the bot stood at food the action did not offer) and 2 of 21 save round trips off; never looked into. *To check.*
- **Home look** (0.27): at game zoom the side walls read as a fringe hanging from the roof, and are edge-on from the front; fallen fronds read as tan triangles. The upgrade time (30 s) and rest cost were chosen by the builder, not the user.
- **Row** (0.27.2): the row drawings rest at opacity 0.85; the shake and the larger touch area were not seen in a browser.
- **Crab catch** (0.22): the digging and roasting sounds were never heard by the maker; the dig icon reads less clearly than the roast icon; how often a catch is possible in real play is for the user to judge (the numbers are in `game/crabs`).
- **Rain** (0.21, 0.22.1): palm shadows stay fairly sharp in rain; a shower slept through checks the shelter with the lean-tos that exist at catch-up time and does not wet piles or carried wood.
- **Low water finds** (0.18): 14 of the 49 beach tiles with start wood on seed 1337 have no strip between the tide lines and get no new wood.
- **River mouth:** the river's water ribbon meets the sea along a straight diagonal colour edge (seen at `?spawn=-82,184`); the two water colours should blend.
- **Performance, from the review** (`docs/review-gpt.md`): measure frame times on a real phone (walking, turning the view, tiles being built; spikes, not only the average) before deciding on the tile building budget, fixed simulation steps or the shadows. Check for GPU leaks on a phone during long walks. Nothing changes in the look without the user.

## To be judged by the user, live

Built and tested headless, never judged by a person: the mix of 0.20 "Sound" (set by reasoning; levels in `LEVELS` in `audio/mix`), the rain look and sound of 0.21, the moving shadows of 0.19 "Wind" (amplitudes in `KINDS` in `render/wind`), shadows and the quality levels on the phone and the slow laptop, the amble and sitting pose of 0.29.2, and Dave carrying wet logs to the drying pile (0.29.5). The fire goes out after 15 game minutes of rain; say if that is too harsh.

## Notes

- The user writes in Dutch; everything in the repository stays in English.
- Developer helpers (`window.__driftwood`, `?spawn=`, `?time=`, `?quality=`, the smoke and playtest scripts) are described in `docs/architecture.md`.
- A cross-fade between two shadow lights was tried live and rejected: the shadows looked doubled during the fade.
