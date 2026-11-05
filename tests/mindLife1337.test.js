// Dave alone for ten game days on island 1337 (game/mind, 0.28 "Habit", the daily rhythm of 0.29 "Daily bread"); the checks and the measured limits are in helpers/lifeSuite.
// Measured when this was written (10 days, steps of 0.1 s): see docs/handover.md item 17 (walked and fresh: max thirst 0.7, max hunger 0.7, 2 meals a day, every night slept, no collapse; beach alone: coconuts only, max hunger 0.7)
import { lifeSuite } from './helpers/lifeSuite.js';

lifeSuite(1337, {
  walked: { idle: 0.55, maxThirst: 1, maxHunger: 1, collapses: 0, chosenSleeps: 9, warm: 3, stuckSelf: 0, stuckMax: 3, nights: 7, inland: 5, crabs: 1, leanto: 8, upgrades: 2 },
  fresh: { idle: 0.65, maxThirst: 1, maxHunger: 1, collapses: 0, chosenSleeps: 9, stuckMax: 3, searches: 1, nights: 7, inland: 5 },
  beach: { nights: 7, maxHunger: 1.2, hungry: 0.2 },
});
