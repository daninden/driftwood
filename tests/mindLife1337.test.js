// Dave alone for ten game days on island 1337 (game/mind, 0.28 "Habit", the daily rhythm of 0.29 "Daily bread"); the checks and the measured limits are in helpers/lifeSuite.
// 0.29.4 "Wander": he goes exploring now and then, so on a fresh start he finds nuts and fibre himself and no longer has to search (searches: 0), eats more nuts and fewer berries (walked: inland 1), and builds his lean-to by day 7.
// Measured when this was written (10 days, steps of 0.1 s): see docs/handover.md item 17 (walked and fresh: max thirst 0.7, max hunger 0.7, 2 meals a day, every night slept, no collapse; beach alone: coconuts only, max hunger 0.7)
import { expect } from 'vitest';
import { lifeSuite } from './helpers/lifeSuite.js';

// 0.30.2 "Checks": the dry-stock checks of 0.29.15 (formerly tests/dryStock.test.js) run on this suite's walked ten-day run instead of playing the same run a second time (identical by construction: same seed, same start, same days).
lifeSuite(1337, {
  walked: { idle: 0.55, maxThirst: 1, maxHunger: 1, collapses: 0, chosenSleeps: 9, warm: 3, stuckSelf: 0, stuckMax: 3, nights: 7, inland: 1, crabs: 1, leanto: 9, upgrades: 1, explores: 2, evenings: 4, dried: 2 },   // 0.29.15: Dry stock restores the normal drying conservation check.
  fresh: { idle: 0.65, maxThirst: 1, maxHunger: 1, collapses: 0, chosenSleeps: 9, stuckMax: 3, nights: 7, inland: 3, leanto: 9, explores: 2, grow: 100, evenings: 6, dried: 3 },   // 0.29.8: user approved one additional fireless evening
  beach: { nights: 7, maxHunger: 1.2, hungry: 0.2 },
  extra: [{
    // Dry stock (0.29.15): an actual game and mind run keeps the small wet reserve finite and never counts a drying log as moved more than once.
    name: 'dry stock: uses finite stock errands and never repeats a drying transfer in the walked seed-1337 run',
    run: (w, spawn, walkedRun) => {
      const { r, mind } = walkedRun();
      const moved = mind.stats.events.filter(e => e.type === 'dry-moved');
      expect(mind.stats.drying.stockErrands).toBeGreaterThan(0);
      expect(r.drying.wetTaken).toBeGreaterThan(0);
      expect(r.drying.laid).toBeGreaterThan(0);
      expect(r.drying.moved).toBeGreaterThan(0);
      expect(r.drying.laid).toBeLessThanOrEqual(r.drying.wetTaken);
      expect(r.drying.moved).toBeLessThanOrEqual(r.drying.laid);
      expect(mind.dryPiles().every(q => q.logs.length <= 5)).toBe(true);
      expect(moved.length).toBeGreaterThan(0);
      expect(moved.every(e => e.n > 0 && e.ids.length === e.n && e.destination === 'fire' && !e.drying && Math.hypot(e.from[0] - e.to[0], e.from[1] - e.to[1]) > 0.2)).toBe(true);
      const ids = moved.flatMap(e => e.ids);
      expect(new Set(ids).size).toBe(ids.length);
      expect(moved.reduce((n, e) => n + e.n, 0)).toBe(r.drying.moved);
    },
  }],
});
