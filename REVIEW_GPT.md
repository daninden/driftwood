# Repository, architecture and performance review

## Scope and overall conclusion

Reviewed game version **0.13.2**, based on commit `b3c4350`, together with the
subsequent requested installation of Playwright. This document consolidates the
repository review, verification results, and architecture and performance advice.
It is a review, not an approved implementation plan or a change to game design.

Before publication, remote commit `718cf0a` (0.13.3, Clear marks) was integrated
without overwriting its changes. The review remains scoped to the original
0.13.2 inspection. Verification of the combined 0.13.3 state then passed:
**438 tests in 25 files**, the production build, and the quick smoke test
(`ok`, 38.9 seconds). This was not a new full architecture or visual review.

**Keep the current architecture.** It is appropriate for a small browser game:
clear layers, deterministic world generation, independently testable rules,
instancing, tile streaming and power-aware frame pacing. A different engine, ECS,
large framework or general-purpose event system is not currently justified.

The main opportunities are more predictable frame times, consistent input
handling, explicit resource ownership and measured GPU optimisation. The two
confirmed gameplay issues below remain unfixed. The missing smoke-test dependency
has been resolved.

## Verification and limitations

| Check | Result |
|---|---|
| Unit tests: `npm.cmd test` | 437 tests passed in 25 files |
| Production build: `npm.cmd run build` | Passed; generated `dist/` and the single-file build |
| Quick smoke test: `npm.cmd run smoke` | Passed after installing Playwright and Chromium; finished with `ok` in 41.6 seconds |
| Targeted Node reproductions | Confirmed the wood placement and thumbstick cancellation issues below |
| Dependency audit: `npm.cmd audit --json` | Three vulnerable development packages reported: one moderate and two critical |

The smoke test exercised movement, gathering and dropping wood, tides, sleep,
coconut husking, fire, torches, tally marks and action-button states, including a
phone-sized touch layout. It generated `smoke-*.png` screenshots. A passing test
does not establish visual approval of every screenshot or sustained performance.

The smoke test reported readiness after 6.3 seconds, six near tiles and 267 draw
calls at the initial view. These are observations from this environment, not
device-independent targets. Much of the smoke test pauses the normal render loop,
steps the game without continuous drawing and renders selected frames. Its total
duration and success must not be interpreted as an interactive frame-rate result.

No real-phone performance profile, long-session memory profile, GPU timing study
or full visual smoke run was performed. Performance risks below are derived from
code inspection unless explicitly described as measured or reproduced.

## Confirmed review findings

### 1. [P2] The first wood pile can be placed in water

**Location:** `src/game/wood.js:173-175`.

When no pile is nearby, `drop()` places a new pile directly at `{ x: fx, z: fz }`.
It does not call the supplied `wetAt` callback for this destination. That callback
is only used by `nextTo()` when placing a pile next to an existing one. Checking
that the player's feet are dry does not ensure that the point in front is dry.

**Impact:** a player on a bank facing water can drop wood into it. A pile placed
below the sea surface can then be removed immediately by `wood.flood()`.

**Reproduction:** create a wood state with a carried log and no nearby pile, then
call `drop(0, 0, 0, false, () => true)`. It returns `true`, empties the carried
wood and creates a pile at `(0, 0.45)`. The callback is never called, despite
declaring every proposed destination wet.

**Recommendation:** validate the first pile's destination too; find a dry
alternative or retain the wood if placement is impossible. Add regression tests
for placement without an existing pile, including both sea and river banks.
Current water-placement tests cover placement next to an existing pile.

**Status:** open; no gameplay fix made during this review.

### 2. [P2] Thumbstick movement does not interrupt kneeling work

**Location:** `src/game/game.js:253`.

The condition that cancels `work` checks walking keys and `input.target`, but not
`input.stick`. The queued-drink cancellation on the next line already includes
the stick, making the inconsistency particularly clear.

**Impact:** touch players cannot interrupt coconut husking, drinking or fire
drilling by moving the thumbstick as keyboard players can. The castaway stays
kneeling until the work ends.

**Reproduction:** start husking a coconut with a short action press, set
`input.stick = { x: 1, z: 0 }`, then update again. `player.work` remains `husk`,
its progress advances and displacement remains zero.

**Recommendation:** include stick movement in the cancellation condition and
test all three work types. Longer term, share one interpretation of movement
intent rather than repeating device-specific checks in each rule.

**Status:** open; no gameplay fix made during this review.

### 3. [P2, resolved] The documented smoke test lacked its dependency

**Location:** `scripts/smoke.js:35` and `package.json` development dependencies.

The smoke script required `playwright`, but it was absent from the manifest and
lockfile. After a clean `npm.cmd ci`, the smoke command failed immediately with
`Cannot find module 'playwright'`.

**Resolution requested and performed:** installed Playwright as a development
dependency, updated `package.json` and `package-lock.json`, and installed Chromium
locally. The subsequent complete quick smoke run passed.

Browser binaries are not installed by `npm ci` alone. A fresh environment should
also run:

```sh
npx playwright install chromium
npm run build
npm run smoke
```

On PowerShell systems where script execution is restricted, use `npx.cmd` and
`npm.cmd`. Document the browser prerequisite in onboarding or CI instructions.

### Development dependency security

The audit reported vulnerabilities involving Vitest, `@vitest/mocker` and
Tinypool. Reported categories included arbitrary file reads, code injection and
prototype-pollution gadgets that can lead to code execution under the relevant
conditions. Two affected packages were classified critical by the audit.

These are development-tooling findings, not evidence of an exploitable flaw in
the published static game. Actual exposure depends on how the tools are used and
which inputs or servers are exposed. Plan a controlled dependency upgrade, check
runtime requirements and rerun verification; do not blindly apply
`npm audit fix --force`. The Playwright installation did not resolve these
pre-existing audit findings.

## Architecture as implemented

```text
core/      Maths, seeded noise, view basis, loading and cooperative scheduling
   |
world/     Terrain, rivers, vegetation, world generation and spatial queries
   |
game/      Movement, clock, wood, fibre, fire, thirst, sleep and game state

render/    Reads world and game state; presents them through Three.js and DOM

main.js    Composition root: startup, input, saving and the animation loop
```

### World generation

`src/world/world.js` builds the island from a seed: shape and terraces, height
and level grids, rivers and river carving, vegetation and gatherable objects,
then ambient occlusion. Consumers use queries such as `H(x, z)`, `slope()` and
`riverAt()` rather than reaching into rendering details.

`src/parallelHeights.js` distributes height-grid strips to Web Workers; startup
falls back to main-thread generation when necessary. This is a suitable use of
workers: expensive, deterministic, separable numerical work.

### Simulation

`src/game/game.js` coordinates small rule modules. The state and rules run
without DOM or WebGL, making them directly testable in Node. Saves store the
changing game state, not the generated island; regeneration from the seed keeps
save data small and problems reproducible.

### Rendering and streaming

The generated square is 720 by 720 world units, with an island of roughly 600 by
600. Tiles are 40 by 40 units. Far tiles use simpler geometry and small textures;
near tiles contain detailed terrain, painted textures and vegetation.

`src/render/streaming.js` builds detail tiles cooperatively and removes those
well outside the view. The removal margin provides hysteresis and reduces
repeated construction at view boundaries. `src/render/batch.js` groups repeated
objects into instanced meshes, with additional outline meshes where needed.

The frame flow is approximately:

```text
Input and view controls
  -> simulation update
  -> camera, lighting, objects and UI updates
  -> near/far tile construction work
  -> render
  -> autosave when necessary
```

### Existing strengths worth preserving

- Clear separation of world data, simulation and presentation.
- Deterministic generation and golden-world tests.
- Small focused modules and broad functional test coverage.
- Instancing, near/far detail levels and incremental streaming already in place.
- Automatic persistence separated from rendering and simulation rules.
- Power-aware frame pacing: at most 30 fps on touch-only devices and 15 fps
  after inactivity; desktop rendering is otherwise uncapped.

## Performance conclusions and recommendations

### 1. Make tile construction budgets more predictable

**Highest-priority performance investigation.** In
`src/render/islandView.js`, near-tile construction receives approximately 9 ms
per drawn frame and far-tile construction another 3 ms. Their combined nominal
12 ms leaves little room within a 16.7 ms frame at 60 fps.

These are cooperative budgets, not hard limits. A generator only stops at its
next yield, and some substantial steps are uninterruptible:

- The full texture interpolation loop in `src/render/terrainTile.js` has no
  intermediate yield.
- `Batch.build()` fills instance buffers synchronously.
- `pumpFarTiles()` checks elapsed time between tiles, but each far tile is built
  synchronously in full.
- Texture upload and shader compilation can impose rendering costs beyond the
  CPU construction budget.

**Recommendations:** add yield points to the remaining long loops; use one
shared construction budget; test an initial 2-4 ms budget at a 60 fps target and
tune using measurements. Reduce background work while movement or camera motion
needs headroom and catch up when measured capacity permits. Time slicing alone
does not guarantee stutter-free frames.

### 2. Reduce simulation dependence on rendering speed

`src/main.js` clamps active per-frame simulation time to 0.05 seconds. This
protects against large steps, but sustained 10 fps advances only about half a
second of simulation per real second. Movement and the day cycle therefore slow
down under sustained rendering load. Idle frames have a separate 0.1-second cap.

**Recommendation:** evaluate an accumulator with fixed simulation steps and a
bounded number of catch-up steps. Handle resuming a hidden tab explicitly rather
than trying to simulate a long absence. This should improve consistency without
introducing an unbounded catch-up loop. Test sleep acceleration and consumption
of one-shot input carefully when changing update scheduling.

### 3. Profile shadows before reducing visual quality

The renderer uses a 2048 by 2048 shadow map, a custom 16-sample soft filter, and
terrain and vegetation shadow casters. This is a plausible mobile GPU cost, not
a proven bottleneck from the current evidence.

**Recommendation:** compare the same scene with current settings, shadows off,
a smaller shadow map and lower render resolution. This distinguishes shadow
rendering, fragment cost and other limits. Preserve the chosen soft-shadow style
as the baseline; prioritise changes with little visible effect and obtain
approval before altering the established visual design.

### 4. Track geometry and memory explicitly

A near terrain tile has about 52,000 triangles before vegetation and props. A
1024 by 1024 RGBA texture typically costs about 5.3 MiB of GPU memory with its
mipmap chain. These are estimates, not measured total GPU residency.

The two 2881 by 2881 Float32 height and level grids alone require about 63 MiB.
River data, vegetation, render buffers, textures and construction intermediates
add further memory. These costs are not necessarily excessive, but should be
measured on mobile rather than assumed safe.

**Recommendations:** record geometry and texture counts, triangle counts and
memory trends during a long outward-and-return walk. Check that resource counts
stabilise. Consider lower terrain detail, smaller textures or a small bounded
tile cache only after identifying a real constraint. A cache trades rebuild
latency for memory; it is not automatically a win.

## Focused architecture improvements

### Unify movement intent

Use a shared `hasMovementIntent(input)` helper or a compact normalised input
snapshot. Work interruption, queued actions and sleep should not independently
enumerate keyboard, target and stick inputs. The confirmed thumbstick bug is a
concrete reason for this small improvement.

### Keep game orchestration explicit

`game.js` is still manageable. As features grow, separate action selection,
action start and long-running work update/cancellation into focused functions or
modules. Keep `game.js` as the coordinator. Avoid building a generic action
framework or event bus before the game needs one.

### Make resource ownership and cancellation explicit

Document which textures, geometries and materials belong to a tile and which
are shared. Give resource owners clear cleanup paths, including listeners and
partially constructed or cancelled tile jobs. Inspect what happens when a tile
is dropped before its generator completes. This is a lifecycle risk to test,
not a confirmed measured memory leak.

## Suggested order of work

These are recommendations for discussion, not implementation approval.

1. Fix the two confirmed gameplay issues with regression tests, and document the
   Chromium installation prerequisite for new environments.
2. Establish frame-time measurements for walking, camera rotation and tile
   construction, including a real phone. Separate simulation, build and render
   CPU costs; use GPU timings where supported. Track frame-time percentiles and
   spikes, not just average fps. The current work-time display is not a complete
   GPU timing measurement.
3. Break up long synchronous tile-building steps and adopt a shared, measured
   construction budget.
4. Evaluate bounded fixed-step simulation and explicit tab-resume behaviour.
5. Compare shadow and resolution costs before changing detail or appearance.
6. Add a long streaming/memory test, and plan a controlled test-tooling security
   update.

**Bottom line:** retain the architecture and the atmosphere. Measure the costly
frames, distribute work more evenly, unify input semantics and tighten lifecycle
ownership before pursuing major rewrites or visual compromises.
