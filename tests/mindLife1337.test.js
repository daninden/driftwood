// Dave alone for ten game days on island 1337 (game/mind, 0.28 "Habit"); the checks and the measured limits are in helpers/lifeSuite.
// Measured when this was written (10 days, steps of 0.1 s): walked: max thirst 1.0, max hunger 1.04, 10 of 10 nights, 6 by a fire, no collapse; fresh: 5 searches (305 ticks), max thirst 0.92, max hunger 1.05, 11 nights, 1 by a fire, no collapse
import { lifeSuite } from './helpers/lifeSuite.js';

lifeSuite(1337, {
  walked: { maxThirst: 1.1, maxHunger: 1.5, collapses: 0, chosenSleeps: 9, warm: 3, stuckSelf: 0, stuckMax: 3 },
  fresh: { maxThirst: 1.3, maxHunger: 1.5, collapses: 0, chosenSleeps: 9, stuckMax: 3, searches: 1 },
});
