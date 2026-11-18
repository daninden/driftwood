# Game, logic and test coverage review

**Reviewed version:** 0.38.1 "Trace", commit `be4fcb4` on `main`.  
**Date:** 2026-11-18.  
**Status:** Review complete within the scope below. Recommendations are not approved implementation work.

## Summary

- **Keep the architecture:** the pure rules, deterministic island and real-movement tests are strong foundations.
- **Fix rule/feedback mismatches first:** stones and fronds can burn, failed digs can be reported as successful, and the advertised fish-use command fails.
- **Harden recovery:** invalid plans, unavailable models, silent startup requests and failed storage can leave the watching experience stuck or its budgets unenforced. Touch-only key recovery is missing.
- **Do not call verification green:** the build passed, but the full suite had two test timeouts and five worker errors. The two tests passed individually on rerun, which still ended with a worker error. The installed test runner differs from the project's required version.
- **Broaden scenario coverage:** the long lives omit construction and fresh unknown starts; a one-day fresh seed-7 reproduction had five stuck walks.

## Scope

This review examines the game rules, the action executor, AI integration, persistence and the evidence provided by the automated tests. It is a review, not approval to implement the recommendations or change the design. No game code is changed. The older `docs/review-gpt.md` concerns version 0.13.2 and remains separate.

The agreed scope excludes a visual play session. No real model requests, production-data changes, dependency upgrades, commits or pushes are made. Recommendations must preserve **rules, not advice**: better validation and clearer facts must not silently reintroduce the old rules chooser.

## Game assessment

The strongest part of the design is the connection between physical resources and visible consequences: wet wood, fire, shelter, carrying capacity, fatigue and terrain all matter. Building one visible piece per gathered resource makes progress understandable without a large interface. The deterministic island and pure game layer are a good fit for this small game; a new engine or broad architectural rewrite is not justified by this review.

Since 0.38.0 this is a watching experience, not a directly controlled survival game. That makes the model's understanding of the rules, honest action outcomes and recovery from failed requests part of the core experience. The viewer cannot steer Dave out of a bad loop. A safe executor and passing scripted lives do not establish that a real model produces interesting or sustainable lives.

The lack of a prescribed goal and the absence of a rules-based rescue are deliberate choices, not defects. Whether exploration and life after completing a hut remain engaging needs actual play observation; this code review cannot answer that. Similarly, visual atmosphere, sound quality, mobile usability and perceived waiting time were not assessed.

## Test coverage: what the evidence means

This is a **scenario and assertion review**, not a measured line/branch coverage report. No coverage percentage was collected. `package.json` and `vite.config.js:13` run Vitest in Node; browser smoke tests are separate commands. Test count alone should not be used as a coverage percentage.

| Area | Existing evidence | Important boundary |
|---|---|---|
| Island generation | `tests/world.test.js` compares seed 1337 with prototype heights, terrain, rivers, vegetation and colours | Strong regression guard for that island, not exhaustive procedural-world validation |
| Movement and routing | `movement`, `routes`, `pathFollow`, `routeNodes`, `stand`, `walk` and `trap` tests | Tests include real movement, not just finding a path; arbitrary seeds and geometry remain a wider space |
| Materials, needs and buildings | Dedicated wood, wet wood, fire, shells, forage, sleep, site, upgrades, hut, axe and spear tests | Isolated rule coverage is not the same as a long actor-controlled construction sequence |
| Action execution | `tests/actor.test.js` plus game-action tests | Verify concrete executor scenarios; do not certify every valid model-generated combination |
| Model client and planner | `tests/client.test.js`, `tests/planner.test.js` with fake requests | Local failure/retry contracts, not current provider availability or model competence |
| Save and logs | `tests/save.test.js`, `tests/logbook.test.js` | Serialisation and fake-storage tests do not establish every browser persistence lifecycle |
| Long lives | Three ten-day scenarios through the fake chooser | Safety checks on a narrow strategy, not live AI acceptance or broad progression coverage |
| Rendering and startup | Pure presentation tests and separate Playwright smoke scripts | No browser smoke or visual assessment in this review; a build alone is not runtime validation |

### Long-life coverage needs a clearer boundary

`tests/helpers/lives.js:13` selects only seeds 1337, 2024 and 7, all with `know: true`. Lines 17-21 grant the first day's known ground before the actor begins. The assertions in `tests/helpers/lifeTest.js:12-19` check completion, errors, collapse, needs, stuck walks, sleep count and step count.

The chooser in `tests/helpers/actorSim.js:40-71` drinks, eats nuts or berries, sleeps, gathers and lays driftwood, and sometimes wanders. It does not build a shelter or hut, make tools, fish, roast food or maintain a fire. Passing these lives therefore cannot establish that those systems work together over days through the actor.

There is also an explicitly documented excluded case: `docs/handover.md:63` reports repeated stuck walks and collapses on a fresh, unknown seed-7 start. A fresh local reproduction using `runLife(world, startSpot(world), { days: 1, know: false })` confirmed **5 stuck walks and 6 failed steps in one game day** (61 steps, 58 plans; no exception or collapse; the day completed). The simulation itself took 3.11 seconds. This already violates the zero-stuck criterion of the normal long-life tests. The historical ten-day collapse counts were not remeasured; neither result proves that every real model fails there.

**Recommendation (P2, coverage gap):** keep the useful existing safety runs, add a bounded unknown-start regression for seed 7 with an explicit escape/reachability criterion, and add deterministic actor scripts for construction, fire maintenance and interrupted work. Do not make CI depend on a real model or restore scripted habits to the game. Keep separate, opt-in live play evaluations for model quality and request clarity.

### Documentation mixes current behaviour and historical specifications

`docs/architecture.md:12` still describes an optional chooser using the removed `game/intent`; line 23 still describes the removed thumb stick and action button. Its testing quick reference at lines 349-352 names removed mind tests and obsolete player controls, while line 361 correctly explains the new actor-based lives. `docs/design.md:124,134-136,151` still instructs direct movement and action-button use, despite the current full-AI specification at lines 393-406.

**Recommendation (P3, confirmed documentation inconsistency):** make the current layers, controls and testing overview authoritative, and label or move old implementation narratives to historical sections. Keep the release history; do not leave contradictory instructions in the current specification. This is particularly important when deciding whether an apparent behaviour difference is a regression or intentional redesign.

### Browser smoke is primarily a scene test, not an autonomous-life test

`scripts/smoke-ai.js:10-19` supplies a fixed one-hour wait plan by default. Its `installHands` helper (lines 25-40) then gives the smoke script a synthetic input object that bypasses the actor for its scenes, as `scripts/smoke.js:11-12` explicitly documents. This is a useful and intentional way to produce repeatable rendering checks, but most of those scenes do not exercise the production planner-to-actor-to-game loop.

**Recommendation (P2, integration coverage gap):** retain the scene smokes and add a small mocked browser scenario that leaves the real actor in control through multiple plans, a failed request, recovery and a reload. Assert both state changes and the frozen game clock while waiting for a plan. No real provider or model is needed.

## Verification

- Production build: `npm.cmd run build` passed (134 modules transformed; Vite reported 10.73 seconds; single-file output generated).
- Full tests: `npm.cmd test` **failed**, with **1364 passed / 2 timed out** across **77 files** (75 passed / 2 failed), plus **5 unhandled worker RPC timeouts**; reported duration 415.63 seconds. The failures were the Trace pickup/lay test (`tests/actor.test.js:444`, 60-second limit) and the logbook noninterference simulation (`tests/logbook.test.js:190`, 120-second limit). All three ten-day known-ground lives passed. Other review checks also ran concurrently; these timeouts alone do not establish gameplay assertion failures.
- **Environment qualification:** that run used installed **Vitest 3.2.7**, not the **5.1.0** required by `package.json` and `package-lock.json`. `npm.cmd ls --depth=0` reported the invalid Vitest version and missing Playwright. Dependencies were not replaced during this review. Verification on a clean, lockfile-matched installation remains outstanding; this is not a green release gate.
- Focused single-worker rerun: `npm.cmd test -- tests/actor.test.js tests/logbook.test.js --maxWorkers=1 -t "a pick-up and a lay-down|the island state, the actor"` reported **both tests passed** (65 intentionally filtered out), but still exited **1** with one unhandled `onTaskUpdate` worker timeout. Duration 156.52 seconds; the logbook case took 114.43 seconds and Trace 30.60 seconds. This narrows the evidence to runtime/tooling reliability rather than a demonstrated failed assertion; it is still not a clean pass.
- Targeted unknown-start simulation: seed 7, one game day, reproduced 5 stuck walks; see the long-life coverage section.
- Extending that unknown-start reproduction to ten days exceeded the 120-second command timeout without a summary; no ten-day result is claimed.
- Windows environment: Node `v24.21.0`, npm `11.19.0`. The initial `npm test` invocation was blocked by PowerShell's script policy before Vitest started; it was rerun through `npm.cmd`, without changing that policy.
- No browser smoke, visual session, live model evaluation, coverage instrumentation or dependency security audit was performed.

## Logic and integration findings

Priorities: **P1** is a high-priority core-rule violation or blocked core experience; **P2** is a correctness, recovery or important coverage issue; **P3** is lower-risk maintenance. Source-confirmed findings are distinguished from mocked reproductions and browser behaviour that was not tested.

### G1 — Stones and fronds can be lit as ordinary fuel (P1)

**Evidence:** `src/game/game.js:346-351` excludes only timber (`log`) piles from lighting. `src/game/fire.js:108,185-200` treats non-branch pieces as ordinary fuel when constructing the fire. The separate feeding predicate excludes fronds, but is not used to validate lighting. This breaks the material rules and can consume building materials as fuel.

**Reproduction:** on dry ground on seed 1337, place four stones or four fronds in a pile beside the castaway, give him a torch, and execute `{ do: "light" }`. Both local game/actor reproductions produced a burning fire and consumed the pile. This is deterministic torch kindling, not a random successful drill attempt.

**Recommendation/test:** use an explicit burnable-kind rule consistently for lighting and feeding. Add negative tests for stone, frond and timber piles through both torch and drill paths, checking that no fire appears and no material is consumed. Keep positive driftwood and branch tests. This should be addressed before treating the physical resource model as reliable.

### G2 — Passing time can turn a failed action into a reported success (P2)

**Evidence:** the actor's success snapshot (`src/game/actor.js:392-393`) includes thirst, hunger and burning fuel. `doAction` at lines 465-478 generally treats any snapshot change as success, although those values change during ordinary time advancement. The special lighting check avoids this for some fire failures, but does not fix the general mechanism.

**Reproduction:** use a dry crab-colony scene on seed 1337 with initial dig count 0 and execute `{ do: "dig" }`. The dig count becomes 1, no crab is caught, yet the actor records `outcome: "done"`. The scene setup is available in `tests/crab.test.js:43-51`. Thus the model's recent history can contradict what the hands actually achieved.

**Recommendation/test:** determine outcomes from the requested action's result or relevant resource delta, not a global state diff. Guard failed digs explicitly while thirst/hunger rise and an unrelated fire burns. Audit other actions using the same success mechanism; they are risks, not all separately reproduced bugs. This is especially important for the purpose of 0.38.1 "Trace": truthful feedback rather than advice.

### G3 — The carried-fish menu offers an unusable crab command (P2)

**Evidence:** `src/game/actor.js:241` adds `use: "crab"` for either carried crabs or fish. Lines 512-516 pass that same kind to `game.use`, while `src/game/game.js:604-607` requires an actual crab for the crab argument.

**Reproduction:** carry one fish and no crabs beside a burning fire. `{ use: "crab" }` fails with a message saying a fire is needed, while direct `game.use("fish")` succeeds. `{ do: "roast" }` remains a workaround, so eating fish is not entirely impossible.

**Recommendation/test:** make the advertised command and executor agree on which carried catch is used, including fish-only and mixed inventory. Assert the actual food consumption and hunger change, and distinguish missing food from missing flames in failure feedback.

### G4 — Rain abandons a plan but leaves its active work running (P2)

**Evidence:** `src/game/actor.js:577-590` drops its generator and plan on rain but does not cancel game work. The game cancels work on movement or sleep (`src/game/game.js:753-754`); while it persists it suppresses offers (`:488`). Existing rain coverage in `tests/actor.test.js:271-279` interrupts a wait rather than real work.

**Reproduction:** start husking while carrying the spear; introduce rain after 0.3 seconds, then select `{ do: "laySpear" }`. Husking continues, the new step fails as not offered, and the abandoned husk may later finish without its own completed actor-step record. Both actions were available before the work began.

**Recommendation/test:** explicitly decide whether an interruption cancels current work or lets it finish before replanning. Either policy must keep the executor, menu and trace consistent; this review does not choose new behaviour on the user's behalf. Test rain during husking, felling and building, including material consumption and step records.

### G5 — Fuel facts disagree with the actual dryness threshold (P3)

**Evidence:** `src/game/actor.js:139,151` labels driftwood wet below dryness 0.95, but feeding/kindling accepts 0.75 (`src/game/game.js:292`, `src/game/fire.js:196-200`). A reproduced pile at dryness 0.8 was described as four wet pieces while kindling succeeded.

**Recommendation/test:** express burnability consistently, or distinguish residual dampness from "too wet to burn" explicitly. Test the menu and actual fire rules at the threshold and in the interval between 0.75 and 0.95. This is misleading input to the chooser, not proof that every model will avoid that wood.

### I1 — A touch-only viewer cannot recover from a saved, revoked key (P1)

**Evidence:** `src/main.js:152-153` skips key onboarding when any nonempty key is saved. `src/render/aiPanel.js:213-225,255-256` puts replacement/removal controls inside a panel initially hidden and opened through keyboard **I**; no external touch opener is wired.

**Scenario:** finish onboarding on a phone, revoke the key, and reload. Requests fail, but retry sends the same credentials. Without a hardware keyboard or clearing browser data there is no in-game way to reach key replacement. This is source-confirmed, not browser-tested. Mobile support has been discussed as potentially removable, but has not been declared removed.

**Recommendation/test:** agree a minimal touch-accessible recovery path to the existing key controls, then test invalid saved-key recovery without keyboard events. Do not add a larger settings interface merely for this issue.

### I2 — Rejected plans reset the failure budget before they are valid (P2)

**Evidence:** `src/ai/planner.js:70-75` resets `errors` when the answer parses, before the actor accepts it. Lines 88-94 count three actor rejections as a failure, but the next parsable invalid answer resets that count of failures again.

**Reproduction:** a mocked chooser repeatedly returned a JSON plan containing `do: "not-an-action"`. After 51 rejections the review harness observed 52 started requests and 17 failure records, but the planner still had not reached `failed`. Thus invalid plans can keep consuming requests while game time remains frozen. The existing planner test checks the first batch of rejections, not eventual exhaustion across batches.

**Recommendation/test:** reset the consecutive unusable-plan budget on acceptance, not JSON parsing alone. Test enough repeated rejection batches to reach the documented terminal failure, then test explicit retry and a valid accepted plan.

### I3 — Exhausted or unavailable models look like endless thinking (P2)

**Evidence:** `src/ai/planner.js:98,105-108` returns `WAIT` with an error but an `idle` status when no model can send. `src/render/thinkingMark.js:13-15` renders that status as only `thinking…`, without explanation or retry.

**Reproduction:** with `canSend: () => false`, the returned status is `idle`, the error is `every model is spent or paused`, and the visible state is `{ text: "thinking…", retry: false }`. This was independently reproduced locally. Short rate-limit pauses may recover automatically; daily exhaustion lasts longer, and models marked dead by HTTP 404 (`src/ai/client.js:82`) stay dead for the session.

**Recommendation/test:** distinguish waiting for a known budget reset from a configuration/provider failure, expose the existing reason, and make recovery reachable. Test the combined client, planner and thinking-line contract; a retry button alone cannot restore an exhausted quota.

### I4 — Silent dependencies can block mandatory startup indefinitely (P2)

**Evidence:** the chat request has an abort/timeout guard, but `src/ai/client.js:121-130` does not give the onboarding model-list request one. `src/render/startScreen.js:50-54` disables both controls until it settles. Separately, `src/ai/logStore.js:21-34` bounds database opening but not the subsequent reads; `src/main.js:220` awaits those reads through `logbook.open()` before boot can finish.

**Reproductions:** fake transports that never settle leave key checking pending without an abort signal; a fake IndexedDB that opens but never answers its reads leaves logbook opening pending. The gaps are confirmed by source and mocks; real-browser occurrence was not measured.

**Recommendation/test:** bound key-check completion and restore its controls after failure. Keep optional logging off the critical path after a bounded storage failure, falling back to memory. Test silent fetch/body reads and silent post-open database operations, not just rejected promises or failed database opening.

### I5 — Daily budgets are not enforced when storage fails (P2)

**Evidence:** `src/ai/client.js:48-59,69-70` reads the daily counter only from storage and silently ignores write failures. The model's `mem` counter is unused.

**Reproduction:** use null storage, `perDay: 1`, a successful fake fetch, and advance the injected clock by 61 seconds between calls. Three requests succeed; `status().today` remains 0 and `canSend()` stays true. This was independently reproduced locally. The minute window still works, but it does not replace the daily budget. `tests/client.test.js:123-125` currently expects the missing daily count instead of guarding the limit.

**Recommendation/test:** maintain a session counter even without persistence, with the same day rollover. Test null storage, throwing reads, failed writes and midnight rollover; document that cross-session enforcement cannot be guaranteed without working storage.

### Additional bounded concerns

- **Credential redaction during key rotation:** `src/ai/client.js:55,69,95` scrubs an error with the current key rather than the request's captured key. A deferred fake error containing the previous key survives after rotation. Whether the real provider echoes keys was not verified, so no production credential leak is claimed. Redact with the request key before truncating error bodies and add a rotation regression test.
- **Test address isolation:** `src/main.js:145-149` clears a `?new` save before detecting `time`, `awake` or `spawn` test mode. A combined `?new&time=...` therefore clears the normal save despite the README's statement that test parameters do not save/load. This is source-confirmed, not tested against a real save. Resolve the precedence explicitly and test with fake storage; do not reproduce by deleting player data.

- **Planted-torch reachability:** `src/game/actor.js:249-251` describes nearby planted torches as lighting facts, but the places menu does not give them direct `go` identities. The omission is confirmed; how often this prevents useful recovery in real play is unmeasured. Check intended action parity before adding another target kind.

## Recommended order, subject to approval

1. Establish a reproducible test baseline with the lockfile-matched tools; investigate the two timeouts without dismissing the failed full run or blindly raising limits. The all-core worker configuration (`vite.config.js:13`) and concurrent review workload are relevant, but not a proven root cause.
2. Repair fuel-kind validation (G1) and truthful action outcomes (G2), with regression tests.
3. Repair the advertised fish action (G3), agree work-interruption semantics (G4), and align material facts (G5).
4. Make existing onboarding and AI failure recovery reliable (I1-I5), including touch access, request exhaustion and storage failure. Address the bounded credential-redaction concern while testing client failures.
5. Expand deterministic actor scenarios and mocked browser integration, and retain a visible regression for unknown seed-7 starts. Refresh the current documentation separately from historical release narratives.

**Overall conclusion:** keep the layered, deterministic architecture. The largest risks are not a lack of game systems, but disagreement between the physical rules, the facts the model receives and the outcome the executor reports. The existing tests are substantial and valuable, yet do not currently justify a clean release verdict or confidence in full autonomous play across these boundaries.
