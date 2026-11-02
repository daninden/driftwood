/**
 * heightWorker — a Web Worker that computes strips of the height grids.
 *
 * Message in:  { seed, j0, j1 }  rows j0..j1-1
 * Message out: { j0, j1, hg, lg } Float32Arrays of (j1 - j0) rows, transferred
 *
 * It rebuilds the same pure shape and terrain functions from the seed and
 * calls world/heightfield fillRows, so the result is exactly what a build on
 * the main thread would give. Used by main through createParallelHeights.
 *
 * Depends on: core/noise, world/shape, world/terrain, world/heightfield, world/constants
 */
import { createNoise } from './core/noise.js';
import { createShape } from './world/shape.js';
import { createTerrain } from './world/terrain.js';
import { fillRows } from './world/heightfield.js';
import { NG } from './world/constants.js';

let made = null;
self.onmessage = ({ data: { seed, j0, j1 } }) => {
  if (!made || made.seed !== seed) { const noise = createNoise(seed); made = { seed, shp: createShape(noise, seed), terrain: createTerrain(noise) }; }
  const hg = new Float32Array((j1 - j0) * NG), lg = new Float32Array((j1 - j0) * NG);
  fillRows(made.shp, made.terrain, hg, lg, j0, j1, j0);
  self.postMessage({ j0, j1, hg, lg }, [hg.buffer, lg.buffer]);
};
