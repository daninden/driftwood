// The configurations of the ten-day lives of Dave alone (0.30.2 "Checks": moved here from tests/mindLife1337/2024/7.test.js, unchanged, so that each scenario can have a test file of its own).
// The checks and what each number means are in helpers/lifeSuite; the numbers are measured, not wished for.
// Exports: LIFE { 1337, 2024, 7 }: { walked, fresh, beach?, extra? }. Depends on: game/game, game/mind (the seed-7 water-search extra), DRY_MAX, vitest (expect).
import { expect } from 'vitest';
import { createGame } from '../../src/game/game.js';
import { createMind, DRY_MAX } from '../../src/game/mind.js';

export const LIFE = {};

// Dave alone for ten game days on island 1337 (game/mind, 0.28 "Habit", the daily rhythm of 0.29 "Daily bread"); the checks and the measured limits are in helpers/lifeSuite.
// 0.29.4 "Wander": he goes exploring now and then, so on a fresh start he finds nuts and fibre himself and no longer has to search (searches: 0), eats more nuts and fewer berries (walked: inland 1), and builds his lean-to by day 7.
// Measured when this was written (10 days, steps of 0.1 s): see docs/handover.md item 17 (walked and fresh: max thirst 0.7, max hunger 0.7, 2 meals a day, every night slept, no collapse; beach alone: coconuts only, max hunger 0.7)
// 0.30.2 "Checks": the dry-stock checks of 0.29.15 (formerly tests/dryStock.test.js) run on this suite's walked ten-day run instead of playing the same run a second time (identical by construction: same seed, same start, same days).
LIFE[1337] = {
  walked: { idle: 0.55, collapses: 0, chosenSleeps: 5, warm: 3, stuckSelf: 0, stuckMax: 3, nights: 4, inland: 1, crabs: 1, leanto: 10, upgrades: 1, explores: 1, evenings: 4, dried: 2 },   // 0.30.9: policy of lifeSuite (met on 2 of 4 streams; about half the 0.30.8 mean, never tighter than before; lean-to by day 10); thirst and hunger maxima are the suite's MAX_THIRST and MAX_HUNGER
  fresh: { idle: 0.65, collapses: 0, chosenSleeps: 5, stuckMax: 3, nights: 4, inland: 2, leanto: 10, explores: 2, grow: 75, evenings: 6, dried: 3 },
  beach: { nights: 4, hungry: 0.2 },
  extra: [{
    // Dry stock (0.29.15): an actual game and mind run keeps the small wet reserve finite and never counts a drying log as moved more than once.
    name: 'dry stock: uses finite stock errands and never repeats a drying transfer in the walked seed-1337 run',
    run: async (w, spawn, walkedRuns) => {   // 0.30.5: on each stream's walked run
      for (const { r, mind, stream } of await walkedRuns()) {
        const at = (what, actual) => expect(actual, `seed 1337 walked stream ${stream}: ${what}; drying=${JSON.stringify(r.drying)}`);
        const moved = mind.stats.events.filter(e => e.type === 'dry-moved');
        at('stock errands', mind.stats.drying.stockErrands).toBeGreaterThan(0);
        at('wet taken', r.drying.wetTaken).toBeGreaterThan(0);
        at('laid', r.drying.laid).toBeGreaterThan(0);
        at('moved', r.drying.moved).toBeGreaterThan(0);
        at('laid no more than taken', r.drying.laid).toBeLessThanOrEqual(r.drying.wetTaken);
        at('moved no more than laid', r.drying.moved).toBeLessThanOrEqual(r.drying.laid);
        at('every drying pile holds at most a full pile', mind.dryPiles().every(q => q.logs.length <= DRY_MAX)).toBe(true);
        at('some move happened', moved.length).toBeGreaterThan(0);
        at('every move is a real move from the drying pile to the fire', moved.every(e => e.n > 0 && e.ids.length === e.n && e.destination === 'fire' && !e.drying && Math.hypot(e.from[0] - e.to[0], e.from[1] - e.to[1]) > 0.2)).toBe(true);
        const ids = moved.flatMap(e => e.ids);
        at('no piece moved twice', new Set(ids).size).toBe(ids.length);
        at('the moves add up', moved.reduce((n, e) => n + e.n, 0)).toBe(r.drying.moved);
      }
    },
  }],
};

// Dave alone for ten game days on island 2024 (game/mind, 0.28 "Habit", the daily rhythm of 0.29 "Daily bread"); the checks and the measured limits are in helpers/lifeSuite.
// Measured when this was written (10 days, steps of 0.1 s): see docs/handover.md item 17 (walked and fresh: max thirst 0.7, max hunger 0.7, 2.3 meals a day, every night slept, no collapse; coconuts nearly all of the food)
LIFE[2024] = {
  walked: { idle: 0.55, collapses: 0, chosenSleeps: 5, warm: 5, stuckSelf: 0, stuckMax: 3, nights: 4, inland: 0, crabs: 2, leanto: 10, upgrades: 1, explores: 1, evenings: 3, dried: 1 },   // 0.30.9: policy of lifeSuite (the history of the old bounds is in docs/versions.md 0.30.4 and 0.30.5)
  fresh: { idle: 0.65, collapses: 0, chosenSleeps: 5, stuckMax: 3, nights: 4, inland: 0, crabs: 1, leanto: 10, explores: 1, grow: 55, evenings: 3, dried: 2 },
};

// Dave alone for ten game days on island 7 (game/mind, 0.28 "Habit", the daily rhythm of 0.29 "Daily bread"); the checks and the measured limits are in helpers/lifeSuite.
// Until 0.28.1 "Scramble" the walked start was a known bug (the water lies up a steep scramble where he stalled). Measured now (10 days, steps of 0.1 s): see docs/handover.md item 17
// (walked: max thirst 0.7, hunger 0.7, hungry 13 % of the waking time because of the long way to the water, every night slept, no collapse; fresh: max thirst 0.7, hunger 0.75)
LIFE[7] = {
  walked: { idle: 0.4, collapses: 0, chosenSleeps: 5, warm: 3, stuckSelf: 0, stuckMax: 3, nights: 4, inland: 1, hungry: 0.25, crabs: 2, evenings: 6, strolls: 15, drinksMin: 1.0 },   // 0.30.9: policy of lifeSuite (history of the old bounds: docs/versions.md 0.30.4 to 0.30.7)
  extra: [{
    // 0.29: standing at (-254.3, -35.7) at 0.59 of day 0 (as after the playtest's save and reload), thirsty at 0.25, he searched for water, saw some above a wall at (-214, -74)
    // (known, but no way to it over known ground), stopped searching there, and stood by the wall for days (the playtest on seed 7 showed 5 thirst collapses in 3 days). Now a search only
    // ends when there is water he can walk to.
    part: 'fresh',
    name: 'does not stop his search for water at water he cannot reach (seed 7, from the spot of the playtest reload)',
    run: (w) => {
      const sp = { x: -254.25, z: -35.7 }; sp.y = w.H(sp.x, sp.z);
      const g = createGame(w, sp, { time: 0.5903, thirst: { days: 0.2503 }, hunger: { days: 0.2503 }, sleep: { awake: 0.25 } }), m = createMind(w, g); m.engage();
      let maxThirst = 0, drank = false; const d0 = g.clock.total; g.thirst.drink = (o => () => { drank = true; return o(); })(g.thirst.drink.bind(g.thirst));
      while (g.clock.total < d0 + 0.7) { m.step(1 / 30); g.update(m.input, 1 / 30); maxThirst = Math.max(maxThirst, g.thirst.days); }
      expect(drank).toBe(true); expect(maxThirst).toBeLessThan(0.7); expect(m.stats.stuck).toBeLessThan(5); expect(m.stats.searches).toBeGreaterThanOrEqual(1);
    },
  }],
  fresh: { idle: 0.55, collapses: 0, chosenSleeps: 5, stuckMax: 3, searches: 1, nights: 3, inland: 1, crabs: 1, drinksMin: 1.1, evenings: 6, dried: 1, strolls: 13 },
};
