// Dave alone for ten game days on island 2024 (game/mind, 0.28 "Habit", the daily rhythm of 0.29 "Daily bread"); the checks and the measured limits are in helpers/lifeSuite.
// Measured when this was written (10 days, steps of 0.1 s): see docs/handover.md item 17 (walked and fresh: max thirst 0.7, max hunger 0.7, 2.3 meals a day, every night slept, no collapse; coconuts nearly all of the food)
import { lifeSuite } from './helpers/lifeSuite.js';

lifeSuite(2024, {
  walked: { idle: 0.55, maxThirst: 1, maxHunger: 1, collapses: 0, chosenSleeps: 9, warm: 5, stuckSelf: 0, stuckMax: 3, nights: 7, inland: 0, crabs: 3, leanto: 8, upgrades: 1, explores: 2, evenings: 3, dried: 1 },
  fresh: { idle: 0.65, maxThirst: 1, maxHunger: 1, collapses: 0, chosenSleeps: 9, stuckMax: 3, nights: 7, inland: 0, crabs: 3, leanto: 9, explores: 2, grow: 100, evenings: 3, dried: 2 },
});
