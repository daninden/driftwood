// Dave alone for ten game days on island 2024 (game/mind, 0.28 "Habit"); the checks and the measured limits are in helpers/lifeSuite.
// Measured when this was written (10 days, steps of 0.1 s): walked: max thirst 0.96, max hunger 1.07, 10 of 10 nights, 7 by a fire, no collapse, 57 stuck detections of at most 0.5 s each; fresh: no water and no food known, thirst collapses all the time
import { lifeSuite } from './helpers/lifeSuite.js';

lifeSuite(2024, {
  walked: { maxThirst: 1.1, maxHunger: 1.5, collapses: 0, chosenSleeps: 9, warm: 5, stuckSelf: 0, stuckMax: 3 },
  fresh: { maxThirst: 2, maxHunger: 4, chosenSleeps: 4, stuckMax: 3 },
});
