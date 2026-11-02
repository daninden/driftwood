/**
 * world/shape — the island outline and its "potential" field.
 *
 * The island is a warped disc (mask) with a number of random highlands on
 * top. The potential tells how high a point wants to be; it is later scaled
 * so that the top 1.5 % of the land reaches tier 4.75 (the summits).
 *
 * createShape(noise, seed) -> { HL, shape, SC }
 *   HL               highland blobs [{ x, z, r, a }]
 *   shape(x, z)      -> [mask, potential]; mask < 0 means open sea
 *   SC               scale from potential to terrace level L (L = potential * SC)
 *
 * Depends on: core/noise, core/math, world/constants
 */
import { mulberry32 } from '../core/noise.js';
import { ss } from '../core/math.js';
import { HALF, RAD } from './constants.js';

export function createShape(noise, seed) {
  const { fbm } = noise;
  const R0 = mulberry32(seed * 9973 + 1);
  const HL = [];
  const n = 7 + (R0() * 5 | 0);
  for (let i = 0; i < n; i++) {
    const a = R0() * Math.PI * 2, d = 25 + Math.sqrt(R0()) * 180;
    HL.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, r: 24 + R0() * 26, a: 0.4 + R0() * 0.4 });
  }

  function shape(x, z) {
    const wx = x + (fbm(x * 0.006 + 1.3, z * 0.006 + 2.1) - 0.5) * 110, wz = z + (fbm(x * 0.006 + 7.7, z * 0.006 + 3.9) - 0.5) * 110;
    let mask = 1 - Math.hypot(wx, wz) / RAD + (fbm(wx * 0.009 + 5, wz * 0.009 + 5) - 0.5) * 0.45;
    mask = Math.min(mask, (HALF - 30 - Math.max(Math.abs(x), Math.abs(z))) / 60);
    if (mask < 0) return [mask, mask];
    let hl = 0; for (const h of HL) hl += h.a * Math.exp(-((wx - h.x) ** 2 + (wz - h.z) ** 2) / (h.r * h.r));
    const med = (fbm(x * 0.012 + 9, z * 0.012 + 4) - 0.5) * 0.65 + (fbm(x * 0.03 + 2, z * 0.03 + 7) - 0.5) * 0.18;
    return [mask, mask * 0.34 + hl * ss(0, 0.2, mask) + med * ss(0, 0.25, mask)];
  }

  const v = [];
  for (let z = -HALF; z <= HALF; z += 4) for (let x = -HALF; x <= HALF; x += 4) { const s = shape(x, z); if (s[0] > 0) v.push(s[1]); }
  v.sort((a, b) => a - b);
  const SC = 4.75 / v[Math.floor(v.length * 0.985)];

  return { HL, shape, SC };
}
