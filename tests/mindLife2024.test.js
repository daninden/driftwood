// Dave alone for ten game days on island 2024 (game/mind, 0.28 "Habit"); the checks and the measured limits are in helpers/lifeSuite.
// Measured when this was written (10 days, steps of 0.1 s): walked: max thirst 0.94, max hunger 1.04, 10 of 10 nights, 7 by a fire, no collapse; fresh: no search needed (the 40 m show the water), max thirst 0.89, hunger 1.04, 10 nights, 6 by a fire, no collapse
import { lifeSuite } from './helpers/lifeSuite.js';

lifeSuite(2024, {
  walked: { idle: 0.6, maxThirst: 1.1, maxHunger: 1.3, collapses: 0, chosenSleeps: 9, warm: 5, stuckSelf: 0, stuckMax: 3 },
  fresh: { idle: 0.7, maxThirst: 1.3, maxHunger: 1.5, collapses: 0, chosenSleeps: 9, stuckMax: 3 },
});
