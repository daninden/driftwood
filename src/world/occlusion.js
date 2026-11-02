/**
 * world/occlusion — a cheap ambient-occlusion field.
 *
 * Ground under tree crowns and in hollows is painted darker. The tree part
 * is splatted once into a 0.5-unit grid; the hollow part is computed on the
 * fly from the heightfield.
 *
 * buildOcclusion(tiles, H) -> aoAt(x, z, y) in 0.5..1 (1 = fully open)
 *
 * Depends on: world/constants
 */
import { S, HALF } from './constants.js';

const GA = 0.5, NA = Math.round(S / GA) + 1;

export function buildOcclusion(tiles, H) {
  const AOG = new Float32Array(NA * NA);
  tiles.forEach(tl => tl.trees.concat(tl.pines).forEach(t => {
    const r = t.jungle ? 2.4 : 1.8;
    for (let j = Math.max(0, Math.floor((t.z - r + HALF) / GA)); j <= Math.min(NA - 1, Math.ceil((t.z + r + HALF) / GA)); j++)
      for (let i = Math.max(0, Math.floor((t.x - r + HALF) / GA)); i <= Math.min(NA - 1, Math.ceil((t.x + r + HALF) / GA)); i++) {
        const d = Math.hypot(-HALF + i * GA - t.x, -HALF + j * GA - t.z);
        if (d < r) { const w = 1 - d / r; AOG[j * NA + i] += w * w * 0.4; }
      }
  }));
  return function aoAt(x, z, y) {
    const fx = Math.max(0, Math.min(NA - 1.001, (x + HALF) / GA)), fz = Math.max(0, Math.min(NA - 1.001, (z + HALF) / GA)), i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j, o = j * NA + i;
    let a = AOG[o] * (1 - tx) * (1 - tz) + AOG[o + 1] * tx * (1 - tz) + AOG[o + NA] * (1 - tx) * tz + AOG[o + NA + 1] * tx * tz;
    const avg = (H(x + 1.2, z) + H(x - 1.2, z) + H(x, z + 1.2) + H(x, z - 1.2)) / 4; a += Math.max(0, Math.min(0.25, (avg - y) * 0.35));
    return 1 - Math.min(0.5, a);
  };
}
