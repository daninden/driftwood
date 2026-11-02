/**
 * world/heightfield — the sampled grids every query reads from.
 *
 * Two NG × NG Float32 grids at spacing GR:
 *   HG  ground height (rivers carve into it afterwards)
 *   LG  terrace level L (negative = sea, also lagoons inside the island)
 *
 * buildHeightfield(shape, terrain, progress?) -> Promise<{ HG, LG }>
 *   progress(label, fraction) is awaited every few rows so a browser can
 *   breathe while this runs (it is the slowest step, a few seconds).
 * fillRows(shape, terrain, hg, lg, j0, j1, base)   computes rows j0..j1-1;
 *   the work unit for building the grids in parallel (see heightWorker)
 * sampleGrid(arr, x, z)  bilinear sample of any NG × NG grid
 *
 * Depends on: world/constants
 */
import { HALF, GR, NG } from './constants.js';

export async function buildHeightfield(shp, terrain, progress) {
  const HG = new Float32Array(NG * NG), LG = new Float32Array(NG * NG);
  for (let j = 0; j < NG; j += 144) {
    if (progress) await progress('heights', j / NG);
    fillRows(shp, terrain, HG, LG, j, Math.min(NG, j + 144), 0);
  }
  return { HG, LG };
}

/** Rows j0..j1-1 of both grids, written into hg/lg from row `base` on (0 for full grids, j0 for a strip). */
export function fillRows({ shape, SC }, { terrH }, hg, lg, j0, j1, base) {
  for (let j = j0; j < j1; j++) {
    const z = -HALF + j * GR, o = (j - base) * NG;
    for (let i = 0; i < NG; i++) {
      const x = -HALF + i * GR, s = shape(x, z), sea = s[0] < 0 || s[1] < 0, m = Math.min(s[0], s[1]), L = sea ? m : s[1] * SC;
      lg[o + i] = L;
      hg[o + i] = terrH(x, z, sea ? m : s[0], L);
    }
  }
}

export function sampleGrid(arr, x, z) {
  let fx = (x + HALF) / GR, fz = (z + HALF) / GR;
  fx = Math.max(0, Math.min(NG - 1.001, fx)); fz = Math.max(0, Math.min(NG - 1.001, fz));
  const i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j, o = j * NG + i, a = arr[o], b = arr[o + 1], c = arr[o + NG], d = arr[o + NG + 1];
  return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz;
}
