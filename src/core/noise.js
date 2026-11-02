/**
 * core/noise — deterministic randomness.
 *
 * Everything on the island comes from one seed. This module turns that seed
 * into the noise functions the rest of the code uses. Nothing here touches
 * the DOM or Three.js, so it runs in a browser, a worker or Node alike.
 *
 * Exports
 *   createNoise(seed) -> { seed, hash2, vnoise, fbm }
 *     hash2(x, y, s = seed)  integer lattice hash in [0, 1)
 *     vnoise(x, y)           smooth value noise in [0, 1], seeded
 *     fbm(x, y)              three octaves of vnoise, in [0, 1]
 *   mulberry32(a)            small seeded PRNG: () => [0, 1)
 *   hashInt(a, b, c)         mixes three ints into one uint32 (per-tile seeds)
 *
 * The exact formulas are frozen: changing them changes every island.
 * tests/world.test.js guards this with a golden file for seed 1337.
 */

export function createNoise(seed) {
  function hash2(x, y, s = seed) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }
  function fbm(x, y) {
    return (vnoise(x, y) * 0.5 + vnoise(x * 2 + 5.2, y * 2 + 1.3) * 0.25 + vnoise(x * 4 + 9.7, y * 4 + 3.1) * 0.125) / 0.875;
  }
  return { seed, hash2, vnoise, fbm };
}

export function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export const hashInt = (a, b, c) => (Math.imul(a, 73856093) ^ Math.imul(b + 1000, 19349663) ^ Math.imul(c + 1000, 83492791)) >>> 0;

/** Pick a random element with a PRNG from mulberry32. */
export const pick = (r, arr) => arr[(r() * arr.length) | 0];
