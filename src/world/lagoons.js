/**
 * world/lagoons — no water inside the island that the sea cannot reach (0.44.0 "Dry").
 *
 * The sea is one plane at the sea level (game/tide), so every hollow below
 * high water (0) would show water and rise and fall with the tide, even
 * behind metres of dune. An inland lake is only kept when it is joined to
 * the open sea at high water: then it is part of the sea. Every other hollow
 * that holds water at high water is filled to dry land:
 *
 *   1. The open sea: every cell below 0 joined to the edge of the map.
 *   2. The spill level of the low cells beside it (a priority flood over the
 *      cells below DRY_FILL): the lowest height a path to the open sea has
 *      to climb over; DRY_FILL where it is higher.
 *   3. The cells lower than their spill level (capped at DRY_FILL) fall into
 *      groups; a group with a cell below 0 held water at high water: its
 *      cells are raised to that level, and their terrace level to at least
 *      DRY_L (ordinary coast land, above the beach: no tide line, driftwood
 *      or crabs on it). Dry hollows (no cell below 0) are left alone.
 *
 * Runs on the full grids after the heightfield and before the rivers, so the
 * rivers find the real sea.
 *
 * fillLagoons(HG, LG) -> { cells, groups }   mutates HG and LG; how many cells
 *                                            and hollows were filled
 * DRY_FILL (0.3 m), DRY_L (0.36)
 *
 * Depends on: world/constants
 */
import { NG } from './constants.js';

export const DRY_FILL = 0.3;   // metres above high water the filled hollows lie at most (lower where the way to the sea is lower)
export const DRY_L = 0.36;     // the terrace level a filled cell gets at least: coast land, above the beach features (all below 0.35)

export function fillLagoons(HG, LG) {
  const N = NG, NN = N * N, F = DRY_FILL;
  // 1. the open sea
  const open = new Uint8Array(NN), stack = new Int32Array(NN);
  let sp = 0;
  const seed = k => { if (!open[k] && HG[k] < 0) { open[k] = 1; stack[sp++] = k; } };
  for (let i = 0; i < N; i++) { seed(i); seed((N - 1) * N + i); seed(i * N); seed(i * N + N - 1); }
  while (sp) {
    const k = stack[--sp], x = k % N;
    if (x > 0) seed(k - 1); if (x < N - 1) seed(k + 1); if (k >= N) seed(k - N); if (k < NN - N) seed(k + N);
  }
  // 2. spill levels of the low cells (priority flood from the open sea's edge)
  const lvl = new Float32Array(NN).fill(F);
  let cap = 1 << 16, hk = new Float32Array(cap), hi = new Int32Array(cap), hn = 0;
  const push = (v, k) => {
    if (hn === cap) { cap *= 2; const a = new Float32Array(cap), b = new Int32Array(cap); a.set(hk); b.set(hi); hk = a; hi = b; }
    let i = hn++;
    while (i > 0) { const p = (i - 1) >> 1; if (hk[p] <= v) break; hk[i] = hk[p]; hi[i] = hi[p]; i = p; }
    hk[i] = v; hi[i] = k;
  };
  const relax = (v, n) => { if (open[n] || HG[n] >= F) return; const nv = Math.max(v, HG[n]); if (nv < lvl[n]) { lvl[n] = nv; push(nv, n); } };
  const around = (k, v) => { const x = k % N; if (x > 0) relax(v, k - 1); if (x < N - 1) relax(v, k + 1); if (k >= N) relax(v, k - N); if (k < NN - N) relax(v, k + N); };
  for (let k = 0; k < NN; k++) if (open[k]) around(k, 0);
  while (hn) {
    const v = hk[0], k = hi[0], lv = hk[--hn], li = hi[hn];
    let i = 0;
    for (;;) { const l = 2 * i + 1, r = l + 1; let m = -1, mv = lv; if (l < hn && hk[l] < mv) { m = l; mv = hk[l]; } if (r < hn && hk[r] < mv) m = r; if (m < 0) break; hk[i] = hk[m]; hi[i] = hi[m]; i = m; }
    if (hn) { hk[i] = lv; hi[i] = li; }
    if (v > lvl[k]) continue;
    around(k, v);
  }
  // 3. groups of cells below their spill level; fill those that held water at high water
  const seen = new Uint8Array(NN), group = new Int32Array(NN);
  let cells = 0, groups = 0;
  for (let k0 = 0; k0 < NN; k0++) {
    if (seen[k0] || open[k0] || !(HG[k0] < lvl[k0])) continue;
    let n = 0, wet = false; sp = 0; stack[sp++] = k0; seen[k0] = 1;
    while (sp) {
      const k = stack[--sp], x = k % N; group[n++] = k; if (HG[k] < 0) wet = true;
      const take = m => { if (!seen[m] && !open[m] && HG[m] < lvl[m]) { seen[m] = 1; stack[sp++] = m; } };
      if (x > 0) take(k - 1); if (x < N - 1) take(k + 1); if (k >= N) take(k - N); if (k < NN - N) take(k + N);
    }
    if (!wet) continue;
    groups++; cells += n;
    for (let i = 0; i < n; i++) { const k = group[i]; HG[k] = lvl[k]; if (LG[k] < DRY_L) LG[k] = DRY_L; }
  }
  return { cells, groups };
}
