// The test of one ten-day life (0.38.0 "Only him"; one file per seed, tests/lives<seed>.test.js, so the long runs spread over the workers). Safety bounds only (tests/helpers/lives).
import { describe, it, expect } from 'vitest';
import { generateWorld } from '../../src/world/world.js';
import { startSpot } from '../../src/world/spots.js';
import { COLLAPSE_AT } from '../../src/game/thirst.js';
import { STARVING_AT } from '../../src/game/hunger.js';
import { runLife, LIVES } from './lives.js';

export function lifeTest(seed) {
  const { know } = LIVES.find(l => l.seed === seed);
  describe(`ten days on island ${seed} through the fake chooser (the first day ${know ? 'known' : 'unknown'})`, () => {
    it('reaches the last day with no error, no collapse, thirst and hunger under their maxima, and no stuck walk', async () => {
      const w = await generateWorld(seed), r = runLife(w, startSpot(w), { days: 10, know });
      expect(r.errors).toEqual([]);
      expect(r.reached).toBe(true); expect(r.day).toBeGreaterThanOrEqual(10);
      expect(r.collapses).toBe(0);
      expect(r.maxThirst).toBeLessThan(COLLAPSE_AT); expect(r.maxHunger).toBeLessThan(STARVING_AT);
      expect(r.stuck).toBe(0);
      expect(r.sleeps).toBeGreaterThanOrEqual(9); expect(r.steps).toBeGreaterThan(500);   // he lived: a night's sleep a day, and many steps
    }, 900000);
  });
}
