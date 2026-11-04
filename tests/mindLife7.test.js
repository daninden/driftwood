// Dave alone for ten game days on island 7 (game/mind, 0.28 "Habit", the daily rhythm of 0.29 "Daily bread"); the checks and the measured limits are in helpers/lifeSuite.
// Until 0.28.1 "Scramble" the walked start was a known bug (the water lies up a steep scramble where he stalled). Measured now (10 days, steps of 0.1 s): see docs/handover.md item 17
// (walked: max thirst 0.7, hunger 0.7, hungry 13 % of the waking time because of the long way to the water, every night slept, no collapse; fresh: max thirst 0.7, hunger 0.75)
import { expect } from 'vitest';
import { lifeSuite } from './helpers/lifeSuite.js';
import { createGame } from '../src/game/game.js';
import { createMind } from '../src/game/mind.js';

lifeSuite(7, {
  walked: { idle: 0.4, maxThirst: 1, maxHunger: 1, collapses: 0, chosenSleeps: 9, warm: 3, stuckSelf: 0, stuckMax: 3, nights: 7, inland: 5, hungry: 0.25 },
  extra: [{
    // 0.29: standing at (-254.3, -35.7) at 0.59 of day 0 (as after the playtest's save and reload), thirsty at 0.25, he searched for water, saw some above a wall at (-214, -74)
    // (known, but no way to it over known ground), stopped searching there, and stood by the wall for days (the playtest on seed 7 showed 5 thirst collapses in 3 days). Now a search only
    // ends when there is water he can walk to.
    name: 'does not stop his search for water at water he cannot reach (seed 7, from the spot of the playtest reload)',
    run: (w) => {
      const sp = { x: -254.25, z: -35.7 }; sp.y = w.H(sp.x, sp.z);
      const g = createGame(w, sp, { time: 0.5903, thirst: { days: 0.2503 }, hunger: { days: 0.2503 }, sleep: { awake: 0.25 } }), m = createMind(w, g); m.engage();
      let maxThirst = 0, drank = false; const d0 = g.clock.total; g.thirst.drink = (o => () => { drank = true; return o(); })(g.thirst.drink.bind(g.thirst));
      while (g.clock.total < d0 + 0.7) { m.step(1 / 30); g.update(m.input, 1 / 30); maxThirst = Math.max(maxThirst, g.thirst.days); }
      expect(drank).toBe(true); expect(maxThirst).toBeLessThan(0.7); expect(m.stats.stuck).toBeLessThan(5); expect(m.stats.searches).toBeGreaterThanOrEqual(1);
    },
  }],
  fresh: { idle: 0.55, maxThirst: 1, maxHunger: 1, collapses: 0, chosenSleeps: 9, stuckMax: 3, searches: 1, nights: 7, inland: 1 },
});
