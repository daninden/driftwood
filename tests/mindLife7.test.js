// Dave alone for ten game days on island 7 (game/mind, 0.28 "Habit"); the checks and the measured limits are in helpers/lifeSuite.
// Measured when this was written (10 days, steps of 0.1 s): walked: max thirst 1.76, max hunger 3.09, 9 of 10 nights lain down by himself, 4 by a fire, 1 collapse, 342 stuck detections (the water lies up a steep scramble: 21000 ticks thirsty); fresh: no water known
import { lifeSuite } from './helpers/lifeSuite.js';

lifeSuite(7, {
  walked: { maxThirst: 2, maxHunger: 4, collapses: 5, chosenSleeps: 6, warm: 2, stuckSelf: 0, stuckMax: 5 },
  fresh: { maxThirst: 2, maxHunger: 4, chosenSleeps: 4, stuckMax: 5 },
});
