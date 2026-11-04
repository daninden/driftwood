// Dave alone for ten game days on island 7 (game/mind, 0.28 "Habit"); the checks and the measured limits are in helpers/lifeSuite.
// Measured when this was written (10 days, steps of 0.1 s): walked (a known bug, the water lies up a steep scramble where he stalls): max thirst 2.0, hunger 3.67, 7 collapses, 6 own nights; fresh: 1 search (789 ticks), max thirst 0.89, hunger 1.05, 11 nights, no collapse
import { lifeSuite } from './helpers/lifeSuite.js';

lifeSuite(7, {
  walked: { maxThirst: 2.01, maxHunger: 4.01, collapses: 9, chosenSleeps: 4, warm: 1, stuckSelf: 0, stuckMax: 6 },
  fresh: { maxThirst: 1.4, maxHunger: 1.5, collapses: 0, chosenSleeps: 9, stuckMax: 3, searches: 1 },
});
