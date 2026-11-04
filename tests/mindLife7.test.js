// Dave alone for ten game days on island 7 (game/mind, 0.28 "Habit"); the checks and the measured limits are in helpers/lifeSuite.
// Until 0.28.1 "Scramble" the walked start was a known bug (the water lies up a steep scramble where he stalled: 313 stuck detections, max thirst 2.0, 7 collapses). Measured now (10 days, steps of 0.1 s):
// walked: max thirst 1.14, hunger 1.01, no collapse, 10 own nights, no stuck detection; fresh: max thirst 1.06, hunger 1.10, no collapse, 10 nights
import { lifeSuite } from './helpers/lifeSuite.js';

lifeSuite(7, {
  walked: { maxThirst: 1.4, maxHunger: 1.5, collapses: 0, chosenSleeps: 9, warm: 3, stuckSelf: 0, stuckMax: 3 },
  fresh: { maxThirst: 1.4, maxHunger: 1.5, collapses: 0, chosenSleeps: 9, stuckMax: 3, searches: 1 },
});
