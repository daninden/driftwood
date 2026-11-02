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
 * sampleGrid(arr, x, z)  bilinear sample of any NG × NG grid
 *
 * Depends on: world/constants
 */
import { HALF, GR, NG } from './constants.js';

export async function buildHeightfield({ shape, SC }, { terrH }, progress) {
  const HG = new Float32Array(NG * NG), LG = new Float32Array(NG * NG);
  for (let j = 0; j < NG; j++) {
    if (progress && j % 144 === 0) await progress('heights', j / NG);
    const z = -HALF + j * GR;
    for (let i = 0; i < NG; i++) {
      const x = -HALF + i * GR, s = shape(x, z), sea = s[0] < 0 || s[1] < 0, m = Math.min(s[0], s[1]), L = sea ? m : s[1] * SC;
      LG[j * NG + i] = L;
      HG[j * NG + i] = terrH(x, z, sea ? m : s[0], L);
    }
  }
  return { HG, LG };
}

export function sampleGrid(arr, x, z) {
  let fx = (x + HALF) / GR, fz = (z + HALF) / GR;
  fx = Math.max(0, Math.min(NG - 1.001, fx)); fz = Math.max(0, Math.min(NG - 1.001, fz));
  const i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j, o = j * NG + i, a = arr[o], b = arr[o + 1], c = arr[o + NG], d = arr[o + NG + 1];
  return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz;
}
