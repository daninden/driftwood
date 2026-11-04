// Dave alone for ten game days on island 1337 (game/mind, 0.28 "Habit"); the checks and the measured limits are in helpers/lifeSuite.
// Measured when this was written (10 days, steps of 0.1 s): walked: max thirst 0.89 days, max hunger 2.79 (of 4), 10 of 10 nights lain down by himself, 2 by a fire and 8 cold, no collapse, 0 stuck; fresh (only 20 m round the start known): no water known (the brook is too near the edge), starving for most of it, 16 collapses
import { lifeSuite } from './helpers/lifeSuite.js';

lifeSuite(1337, {
  walked: { maxThirst: 1.0, maxHunger: 3.4, collapses: 0, chosenSleeps: 9, warm: 1, stuckSelf: 0, stuckMax: 3 },
  fresh: { maxThirst: 2, maxHunger: 4, chosenSleeps: 5, stuckMax: 3 },
});
