/**
 * world/rivers — rivers from the highlands to the sea, with waterfalls.
 *
 * Steps
 *   1. Dijkstra on a coarse 4-unit grid of L finds the cheapest way downhill
 *      from the strongest highland to the sea (and a tributary from the
 *      second highland to the sea or the main river).
 *   2. The cell path is smoothed into a centripetal Catmull-Rom curve with a
 *      little wiggle, sampled every 0.5 units.
 *   3. The water level along the river is a running minimum of the ground,
 *      minus 0.45. Where it drops fast (> 1.6 over 6 samples) a fall is marked.
 *   4. Along the middle reach 2 to 4 fords are placed (fixed by the noise of
 *      the seed): short stretches, away from the falls and the deep
 *      stretch towards the sea, where the bed rises to FORD_DEPTH below the
 *      water.
 *   5. A distance field (RD distance, RT position along, RI river index) is
 *      built around the river, and the bed and banks are carved into HG
 *      (shallow where the river is narrow, near its source, and on the
 *      fords). Beside each waterfall a rough scramble route is carved as well.
 *
 * computeRivers({ HG, LG, noise, HL }) -> { rivers, RD, RT, RI }
 *   Mutates HG (carving). Each river: { pts, n, main, RL, kMouth, tMouth,
 *   falls: [{ top, base, drop }], fords: [{ k0, k1 }], W(t), L(t), LW(t),
 *   fordAt(k) }
 *     fords  stretches of samples k0..k1 where the bed is shallow
 *     fordAt(k) 0..1 how much sample position k (may be fractional) lies on a
 *            ford (1 on it, easing to 0 over FORD_RAMP samples beside it)
 *     W(t)  river width at t (0 = source, 1 = end)
 *     L(t)  water level (can be below 0 past the mouth); LW(t) = max(L, 0)
 *
 * Only the curve maths of Three.js is used (CatmullRomCurve3); no rendering.
 *
 * Depends on: three (math only), core/math, world/constants, world/heightfield
 */
import { CatmullRomCurve3, Vector3 } from 'three';
import { ss, lerp } from '../core/math.js';
import { S, HALF, GR, NG } from './constants.js';
import { sampleGrid } from './heightfield.js';

const CG = 4, NC = Math.round(S / CG) + 1;
export const FORD_DEPTH = 0.22;   // water depth over a ford's bed
export const FORD_HALF = 4;       // a ford is 2 * FORD_HALF + 1 samples (4 m) long
export const MOUTH_FADE = 16;     // samples (8 m) past the mouth over which the carved bed fades out into the sea floor
export const FORD_RAMP = 3;       // samples over which the bed eases down on either side
/** Bed depth below the water at the river's centre, from its width: shallow where it is narrow. */
export const bedDepth = w => 0.3 + 0.1 * w - 0.14 * ss(1.45, 0.95, w);
const hsm = L => L < 1 ? L * 7 : 7 + (L - 1) * 6;

/** Rocky coast mask: where the shore is rock instead of beach (0..1). */
export const rockCoast = (vnoise, x, z) => ss(0.55, 0.68, vnoise(x * 0.008 + 21, z * 0.008 + 13));

export function computeRivers({ HG, LG, noise, HL }) {
  const { vnoise } = noise;
  const cL = new Float32Array(NC * NC);
  for (let j = 0; j < NC; j++) for (let i = 0; i < NC; i++) cL[j * NC + i] = sampleGrid(LG, -HALF + i * CG, -HALF + j * CG);

  function findPath(src, isGoal) {
    const dist = new Float32Array(NC * NC).fill(Infinity), prev = new Int32Array(NC * NC).fill(-1), heap = [];
    const push = (d, id) => { heap.push([d, id]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    dist[src] = 0; push(0, src);
    while (heap.length) {
      const [d, id] = pop(); if (d > dist[id]) continue;
      if (isGoal(id)) { const path = []; for (let c = id; c >= 0; c = prev[c]) path.push(c); return path.reverse(); }
      const i = id % NC, j = (id / NC) | 0, h1 = hsm(cL[id]);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue; const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= NC || nj >= NC) continue;
        const nid = nj * NC + ni, L2 = cL[nid], h2 = hsm(L2), len = Math.hypot(di, dj);
        let cost = len * (1 + 60 * Math.max(0, h2 - h1) + 0.02 * Math.max(0, h2));
        if (L2 < 0.25 && L2 > -0.05) cost += rockCoast(vnoise, -HALF + ni * CG, -HALF + nj * CG) * 30;
        if (d + cost < dist[nid]) { dist[nid] = d + cost; prev[nid] = id; push(d + cost, nid); }
      }
    }
    return null;
  }
  function nearestCell(c, lo, hi) {
    let best = -1, bd = 1e9;
    for (let id = 0; id < NC * NC; id++) { const L = cL[id]; if (L < lo || L > hi) continue; const d = Math.hypot(-HALF + (id % NC) * CG - c.x, -HALF + ((id / NC) | 0) * CG - c.z); if (d < bd) { bd = d; best = id; } }
    return best;
  }
  function smoothPath(cells, wig, seed) {
    const ctrl = cells.filter((c, i) => i % 3 === 0 || i === cells.length - 1).map(id => new Vector3(-HALF + (id % NC) * CG, 0, -HALF + ((id / NC) | 0) * CG));
    const curve = new CatmullRomCurve3(ctrl, false, 'centripetal'), n = Math.max(4, Math.round(curve.getLength() / 0.5)), pts = curve.getSpacedPoints(n);
    return pts.map((p, k) => { const q = pts[Math.min(n, k + 1)], r = pts[Math.max(0, k - 1)], tx = q.x - r.x, tz = q.z - r.z, tl = Math.hypot(tx, tz) || 1, o = (vnoise(k * 0.5 * 0.08, seed) - 0.5) * wig * Math.sin(Math.PI * k / n); return { x: p.x - tz / tl * o, z: p.z + tx / tl * o }; });
  }

  // 1 + 2: paths
  const HLs = HL.slice().sort((a, b) => b.a - a.a);
  const rivers = [];
  const src = nearestCell(HLs[0], 3.7, 4.4);
  const cells = src >= 0 ? findPath(src, id => cL[id] < -0.04) : null;
  if (cells) rivers.push({ pts: smoothPath(cells, 6, 41), main: true });
  if (HLs.length > 1 && rivers.length) {
    const near = new Uint8Array(NC * NC);
    cells.forEach(id => { const i = id % NC, j = (id / NC) | 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) near[(j + dj) * NC + i + di] = 1; });
    const src2 = nearestCell(HLs[1], 2.6, 3.4);
    const c2 = src2 >= 0 ? findPath(src2, id => cL[id] < -0.04 || near[id]) : null;
    if (c2 && c2.length > 12) rivers.push({ pts: smoothPath(c2, 4, 57), main: false });
  }

  // 3 + 4: levels, falls, distance field
  const RD = new Float32Array(NG * NG).fill(1e4), RT = new Float32Array(NG * NG), RI = new Uint8Array(NG * NG);
  rivers.forEach((rv, ri) => {
    const pts = rv.pts, n = pts.length; rv.n = n; rv.RL = new Float32Array(n);
    let m = 1e9; for (let k = 0; k < n; k++) { m = Math.min(m, sampleGrid(HG, pts[k].x, pts[k].z) - 0.45); rv.RL[k] = m; }
    rv.kMouth = n - 1; for (let k = 0; k < n; k++) if (rv.RL[k] <= 0.02) { rv.kMouth = k; break; }
    rv.tMouth = rv.kMouth / (n - 1);
    rv.W = t => rv.main ? 1.0 + 3.2 * ss(0, 0.6, t) + 4.5 * ss(rv.tMouth - 0.04, rv.tMouth + 0.01, t) : 0.8 + 1.6 * ss(0, 1, t);
    rv.L = t => { const f = Math.max(0, Math.min(n - 1.0001, t * (n - 1))), k = f | 0, u = f - k; return rv.RL[k] + (rv.RL[k + 1] - rv.RL[k]) * u; };
    rv.LW = t => Math.max(rv.L(t), 0);
    const maxD = 13;
    for (let k = 0; k < n - 1; k++) {
      const ax = pts[k].x, az = pts[k].z, bx = pts[k + 1].x, bz = pts[k + 1].z, dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1e-6;
      const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - maxD + HALF) / GR)), i1 = Math.min(NG - 1, Math.ceil((Math.max(ax, bx) + maxD + HALF) / GR));
      const j0 = Math.max(0, Math.floor((Math.min(az, bz) - maxD + HALF) / GR)), j1 = Math.min(NG - 1, Math.ceil((Math.max(az, bz) + maxD + HALF) / GR));
      for (let j = j0; j <= j1; j++) {
        const z = -HALF + j * GR;
        for (let i = i0; i <= i1; i++) {
          const x = -HALF + i * GR; let u = ((x - ax) * dx + (z - az) * dz) / L2; u = u < 0 ? 0 : u > 1 ? 1 : u;
          const ex = x - ax - dx * u, ez = z - az - dz * u, d = Math.sqrt(ex * ex + ez * ez), id = j * NG + i;
          if (d < RD[id]) { RD[id] = d; RT[id] = (k + u) / (n - 1); RI[id] = ri; }
        }
      }
    }
    rv.falls = [];
    for (let k = 4; k < n - 4; k++) {
      if (rv.RL[k - 3] - rv.RL[k + 3] > 1.6 && rv.RL[k] > 0.3) {
        let e = k; while (e < n - 4 && rv.RL[e - 3] - rv.RL[e + 3] > 1.6) e++;
        rv.falls.push({ top: k, base: e + 2, drop: rv.RL[k - 3] - rv.RL[e + 3] }); k = e;
      }
    }
    placeFords(rv, ri, vnoise);
  });

  // carve the beds, banks and the scramble routes beside the falls
  for (let id = 0; id < NG * NG; id++) {
    const d = RD[id]; if (d > 13) continue;
    const rv = rivers[RI[id]], t = RT[id], w = rv.W(t), hw = w / 2, L = rv.L(t), dep = lerp(bedDepth(w), FORD_DEPTH, rv.fordAt(t * (rv.n - 1)));
    const cy = d < hw ? L - dep * (1 - (d / hw) ** 2) + 0.08 * (d / hw) ** 2 : L + 0.08 + (d - hw) * 0.75;
    // past the mouth the bed fades out into the sea floor (no trough offshore)
  const mf = 1 - ss(rv.kMouth, rv.kMouth + MOUTH_FADE, t * (rv.n - 1));
  if (cy < HG[id]) HG[id] = lerp(HG[id], cy, mf);
    for (const fl of rv.falls) {
      const t0 = (fl.top - 10) / (rv.n - 1), t1 = (fl.base + 10) / (rv.n - 1); if (t < t0 || t > t1 || d < hw + 0.2 || d > hw + 4.5) continue;
      const x = -HALF + (id % NG) * GR, z = -HALF + Math.floor(id / NG) * GR, pr = (t - t0) / (t1 - t0);
      const yr = lerp(rv.L(t0), rv.L(t1), pr) + 0.35 + (d - hw - 0.2) * 0.35 + (vnoise(x * 0.8, z * 0.8) - 0.5) * 0.5;
      if (yr < HG[id]) HG[id] = lerp(HG[id], yr, ss(hw + 4.5, hw + 3.0, d));
    }
  }
  return { rivers, RD, RT, RI };
}

/**
 * The middle reach: samples where the river is too deep to wade (where
 * bedDepth is more than FORD_DEPTH + 0.13), at least 8 samples from a fall,
 * and above the deep stretch towards the sea. 2 to 4 fords are spread over
 * it, at least FORD_GAP samples apart (fewer if it is too short).
 */
const FORD_GAP = 6;
function placeFords(rv, ri, vnoise) {
  const n = rv.n, kEnd = rv.main ? Math.floor((rv.tMouth - 0.07) * (n - 1)) : rv.kMouth - 4;
  const ok = new Uint8Array(n);
  for (let k = 0; k < n; k++) {
    const t = k / (n - 1);
    ok[k] = k <= kEnd && bedDepth(rv.W(t)) > FORD_DEPTH + 0.13 && rv.RL[k] > 0.15 && !rv.falls.some(f => k > f.top - 8 && k < f.base + 8) ? 1 : 0;
  }
  const centres = [], span = FORD_HALF + FORD_RAMP;
  for (let k = span; k < n - span; k++) { let all = true; for (let j = k - span; j <= k + span && all; j++) all = !!ok[j]; if (all) centres.push(k); }
  rv.fords = [];
  const want = 2 + Math.min(2, Math.floor(vnoise(ri * 7.3 + 3.1, 11.7) * 3)), chunk = centres.length / want;
  for (let f = 0; f < want; f++) {
    const prev = rv.fords.length ? rv.fords[rv.fords.length - 1].k1 + FORD_GAP + FORD_HALF : -1;
    const target = Math.max(prev, centres[Math.floor(chunk * (f + 0.2 + 0.6 * vnoise(ri * 5.1 + f * 1.7, 23.3)))]);
    const k = centres.find(c => c >= target); if (k === undefined) break;
    rv.fords.push({ k0: k - FORD_HALF, k1: k + FORD_HALF });
  }
  rv.fordAt = k => { let f = 0; for (const fd of rv.fords) f = Math.max(f, ss(fd.k0 - FORD_RAMP, fd.k0, k) * ss(fd.k1 + FORD_RAMP, fd.k1, k)); return f; };
}
