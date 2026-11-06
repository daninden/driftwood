// Dave alone for ten game days on island 1337 (game/mind, 0.28 "Habit", the daily rhythm of 0.29 "Daily bread"); the checks and the measured limits are in helpers/lifeSuite.
// 0.29.4 "Wander": he goes exploring now and then, so on a fresh start he finds nuts and fibre himself and no longer has to search (searches: 0), eats more nuts and fewer berries (walked: inland 1), and builds his lean-to by day 7.
// Measured when this was written (10 days, steps of 0.1 s): see docs/handover.md item 17 (walked and fresh: max thirst 0.7, max hunger 0.7, 2 meals a day, every night slept, no collapse; beach alone: coconuts only, max hunger 0.7)
import { lifeSuite } from './helpers/lifeSuite.js';

lifeSuite(1337, {
  walked: { idle: 0.55, maxThirst: 1, maxHunger: 1, collapses: 0, chosenSleeps: 9, warm: 3, stuckSelf: 0, stuckMax: 3, nights: 7, inland: 1, crabs: 1, leanto: 9, upgrades: 1, explores: 2, evenings: 4, dried: 2, knownDryingShuttle: true },   // 0.29.8: known bug: six laid wet logs are repeatedly counted as moved (78); keep the expected failing conservation test until fixed
  fresh: { idle: 0.65, maxThirst: 1, maxHunger: 1, collapses: 0, chosenSleeps: 9, stuckMax: 3, nights: 7, inland: 3, leanto: 9, explores: 2, grow: 100, evenings: 6, dried: 3 },   // 0.29.8: user approved one additional fireless evening
  beach: { nights: 7, maxHunger: 1.2, hungry: 0.2 },
});
