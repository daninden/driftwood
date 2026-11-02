/**
 * world/terrain — from terrace level L to ground height, including the
 * natural passages through the terrace walls.
 *
 * L is a continuous "terrace level": floor(L) is the tier (0 coast ... 4 summit),
 * the fraction is how far across that tier you are. Near the end of each
 * tier the ground rises as a rock wall to the next BASE height.
 *
 * Natural passages (there are no steps, ropes or posts on this island):
 *   scree   a collapsed part of the wall, a rough ramp
 *   bench   the wall broken into two lower walls
 *   ravine  a cleft cut up through the wall
 *   roots   in the jungle tiers (1, 2): a lower wall you climb on roots
 * Routes beside waterfalls are carved by world/rivers, not here.
 *
 * createTerrain(noise) -> { passFields, passAt, terrH, wallWidth }
 *   passFields(x, z, k)   raw passage strengths for tier k (0..1 each)
 *   passAt(x, z, L)       passage strengths at a point, faded to the wall zone,
 *                         plus t (position across the wall) and any (max)
 *   terrH(x, z, mask, L)  ground height
 *
 * Depends on: core/math, world/constants
 */
import { ss, lerp } from '../core/math.js';
import { BASE } from './constants.js';

export const NO_PASS = Object.freeze({ scree: 0, bench: 0, ravine: 0, roots: 0, t: -1, any: 0 });

export function createTerrain(noise) {
  const { vnoise, fbm } = noise;
  const wallWidth = (x, z) => 0.045 + 0.05 * vnoise(x * 0.02 + 3, z * 0.02 + 8);

  function passFields(x, z, k) {
    const blob = ss(0.78, 0.86, vnoise(x * 0.034 + 40, z * 0.034 + 11)), sel = vnoise(x * 0.02 + 77, z * 0.02 + 5);
    const ridge = 1 - Math.abs(vnoise(x * 0.045 + 3, z * 0.045 + 91) * 2 - 1);
    const ravine = ss(0.82, 0.9, ridge) * ss(0.5, 0.6, vnoise(x * 0.011 + 8, z * 0.011 + 3));
    const roots = (k === 1 || k === 2) ? ss(0.62, 0.72, vnoise(x * 0.03 + 5, z * 0.03 + 50)) : 0;
    return { scree: blob * ss(0.42, 0.58, sel), bench: blob * (1 - ss(0.42, 0.58, sel)), ravine, roots };
  }

  function passAt(x, z, L) {
    if (L < 0.02) return NO_PASS;
    const k = Math.floor(L), f = L - k, w = wallWidth(x, z), f0 = 1 - w - 0.32;
    if (f < f0 || k > 5) return NO_PASS;
    const t = (f - f0) / (1 - f0), e = ss(0, 0.06, t) * ss(1, 0.95, t), p = passFields(x, z, k);
    const o = { scree: p.scree * e, bench: p.bench * e, ravine: p.ravine * e, roots: p.roots * e, t, w };
    o.any = Math.max(o.scree, o.bench, o.ravine, o.roots);
    return o;
  }

  function terrH(x, z, mask, L) {
    if (mask < 0 || L < 0) return Math.max(Math.min(mask, L) * 35, -9) + (vnoise(x * 0.9, z * 0.9) - 0.5) * 0.05;
    const k = Math.min(6, Math.floor(L)), f = L - k;
    const w = wallWidth(x, z);
    const rc = ss(0.55, 0.68, vnoise(x * 0.008 + 21, z * 0.008 + 13));
    const und = (fbm(x * 0.05 + 2, z * 0.05 + 6) - 0.5) * 1.4;
    const within = f0 => k === 0
      ? lerp(0.9 * Math.pow(Math.min(1, f0 / 0.1), 0.8) + Math.max(0, f0 - 0.1) * 1.7, 3.4 * ss(0, 0.03, f0) + f0 * 1.4, rc) + und * 0.4 * ss(0.15, 0.4, f0)
      : BASE[k] + f0 * 1.6 + und * ss(0, 0.08, f0);
    const top = within(1);
    let h = within(f) + ss(1 - w, 1, f) * (BASE[k + 1] - top);
    const f0 = 1 - w - 0.32;
    if (f > f0 && k < 6) {
      const pf = passFields(x, z, k), t = (f - f0) / (1 - f0), D = BASE[k + 1] - top;
      if (pf.scree > 0) { const rs = lerp(within(f0), BASE[k + 1], Math.pow(t, 1.2)) + (vnoise(x * 0.7, z * 0.7) - 0.5) * 0.7 * Math.sin(Math.PI * t); h = lerp(h, rs, pf.scree); }
      if (pf.bench > 0) { const hb = within(f) + ss(1 - w - 0.2, 0.8, f) * D * 0.5 + ss(1 - w, 1, f) * D * 0.5; h = lerp(h, hb, pf.bench); }
      if (pf.ravine > 0 && t > 0.45) { const fs = f0 + 0.45 * (1 - f0), rk = lerp(within(fs), BASE[k + 1] - 0.3, ss(0.45, 1, t)) + (vnoise(x * 0.9 + 4, z * 0.9) - 0.5) * 0.5; h = lerp(h, rk, pf.ravine); }
      if (pf.roots > 0) { const rl = lerp(within(f0), BASE[k + 1], ss(0.55, 1, t)); h = lerp(h, rl, pf.roots * 0.8); }
    }
    if (L > 4) { const ridge = 1 - Math.abs(vnoise(x * 0.05 + 20, z * 0.05 + 4) * 2 - 1); h += Math.pow(L - 4, 1.3) * 7 * (0.6 + 0.6 * ridge); }
    return h + (vnoise(x * 0.9, z * 0.9) - 0.5) * 0.12;
  }

  return { passFields, passAt, terrH, wallWidth };
}
