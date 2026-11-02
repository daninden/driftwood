/**
 * world/spots — finding characteristic places on an island.
 *
 * Used for the start position and by the tests (and later perhaps for
 * events). Searches are deterministic: the same seed gives the same spots.
 *
 * findSpot(world, test, score, tries?) -> { x, y, z } | null
 *   Random search; keeps the best-scoring point that passes test.
 *   test(x, z, y, s, L) and score(x, z, y, s, L) get height y, slope s, level L.
 * startSpot(world)       a flat beach spot near the main river mouth
 * passageSpots(world)    one example of each natural passage, at the foot of
 *                        a wall that faces the camera: [{ kind, x, y, z }]
 *
 * Depends on: core/noise, core/view, world/constants
 */
import { mulberry32 } from '../core/noise.js';
import { CAMDIR } from '../core/view.js';
import { S } from './constants.js';

export function findSpot(w, test, score, tries = 60000, salt = 7) {
  const RS = mulberry32(w.seed * 31 + salt);
  let best = null, bs = -1e9;
  for (let i = 0; i < tries; i++) {
    const x = (RS() - 0.5) * (S - 80), z = (RS() - 0.5) * (S - 80), L = w.Lat(x, z); if (L < 0) continue;
    const y = w.H(x, z), s = w.slope(x, z); if (!test(x, z, y, s, L)) continue;
    const sc = score(x, z, y, s, L) + RS() * 0.05; if (sc > bs) { bs = sc; best = { x, y, z }; }
  }
  return best;
}

const flatOk = (w, x, z, s, m) => s < 0.32 && w.slope(x + 1, z) < 0.5 && w.slope(x - 1, z) < 0.5 && w.slope(x, z + 1) < 0.5 && w.slope(x, z - 1) < 0.5 && w.dryOfRiver(x, z, m);

export function startSpot(w) {
  const main = w.rivers.find(r => r.main), mouth = main ? main.pts[main.kMouth] : { x: 0, z: 0 };
  return findSpot(w, (x, z, y, s, L) => L < 0.4 && y > 0.5 && y < 0.9 && w.rcAt(x, z) < 0.3 && flatOk(w, x, z, s, 1.5), (x, z) => -Math.abs(Math.hypot(x - mouth.x, z - mouth.z) - 16) * 0.05)
    || findSpot(w, (x, z, y, s, L) => L > 0.05 && L < 1 && s < 0.4, () => 0);
}

export function passageSpots(w, tries = 150000) {
  const facing = (x, z) => w.Lat(x - CAMDIR.x * 3, z - CAMDIR.z * 3) - w.Lat(x + CAMDIR.x * 3, z + CAMDIR.z * 3);
  const spot = (key, tt) => findSpot(w, (x, z, y, s, L) => L > 0.9 && L < 4.6 && w.dryOfRiver(x, z, 1.5) && w.passAt(x, z, L)[key] > 0.7 && facing(x, z) > 0.04,
    (x, z, y, s, L) => { const pa = w.passAt(x, z, L); return pa[key] - Math.abs(pa.t - tt) * 1.5 + Math.min(0.3, facing(x, z)) * 2; }, tries, 11);
  const out = [];
  for (const [kind, tt] of [['scree', 0.1], ['ravine', 0.1], ['bench', 0.1], ['roots', 0.1]]) { const s = spot(kind, tt); if (s) out.push({ kind, ...s }); }
  const falls = [];
  w.rivers.forEach(rv => rv.falls.forEach(f => falls.push({ c: rv.pts[Math.round((f.top + f.base) / 2)], drop: f.drop })));
  if (falls.length) {
    const c = falls.sort((a, b) => b.drop - a.drop)[0].c;
    const s = findSpot(w, (x, z, y, s2) => Math.hypot(x - c.x, z - c.z) < 12 && w.fallRouteAt(x, z) > 0.6 && s2 < 0.9, (x, z, y) => -y, tries * 2, 13);
    if (s) out.push({ kind: 'fall', ...s });
  }
  return out;
}
