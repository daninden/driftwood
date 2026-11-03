/**
 * game/habitats — where the animals (game/wildlife) live, fixed by the seed.
 *
 * Nothing here is drawn in the world's generation, so the generated island does
 * not change: every place is worked out from existing world data (heights,
 * levels, rivers) with a seeded PRNG per tile (or per 64 m cell of the sky),
 * when first asked for, and kept. The same seed gives the same places.
 *
 * Crab colonies: on the beach (the coast tier, gentle ground between 0.4 m
 * below high water and 1 m above it, dry of the rivers): a few holes in the sand
 * and 3 to 5 crabs that belong to them. Colonies on the wet strip are only
 * out of their holes when the sea has gone down (low water).
 * Fish (0.17.3: more of them, 0.45 to 0.65 m): groups of 2 to 5 in shallow river water
 * (not at falls, a group about every 9 river points) and in the shallow lagoons inside the
 * island (shallow sea water with land all round); and groups of 3 to 6 (0.5 to 0.75 m)
 * in the open sea along the coast, over a bed 0.55 to 3 m below high water (SEA_FISH),
 * beyond the surf. Sea groups use a PRNG of their own, so the others keep their places.
 * Bird cells: 64 m squares of the coast with 2 to 4 seabirds that circle high
 * over a stretch of shore, with the direction to the nearest rocky shore.
 *
 * COLONY_MAX, CELL (64), SEA_FISH
 * isBeach(w, x, z) -> true on gentle sand where crabs can have a hole (also the wet strip down to 0.4 m below high water)
 * coloniesOfTile(w, tile) -> [colony]
 *   colony: { id, x, z, holes: [{ x, y, z, wet }], crabs: [{ id, hole, x, z, u }] }
 *   wet: the hole lies on the strip that high water covers; u 0..1: a crab is
 *   out when u is below the fraction that is out (more at low water)
 * fishOfTile(w, tile) -> [group]
 *   group: { id, kind: 'river' | 'lagoon' | 'sea', x, z, dir, fish: [{ ox, oz, ph, len }] }
 *   dir: the angle (atan2(dz, dx)) fish face: upstream in rivers, free in lagoons and the sea
 *   river groups also carry lw, the water level of the river there
 * birdCell(w, cx, cz) -> null | { id, x, z, n, r, alt, omega, ph, away: { x, z } }
 *   the circling birds over the shore point (x, z) of cell (cx, cz); away is
 *   the unit direction to the nearest rocky shore (where they go in the evening)
 *
 * Pure data on a world; no DOM, no Three.js.
 *
 * Depends on: core/noise, world/constants
 */
import { mulberry32, hashInt } from '../core/noise.js';
import { HALF, T, NT } from '../world/constants.js';

export const COLONY_MAX = 6;
export const CELL = 64;
export const SEA_FISH = [-3.0, -0.55];   // sea groups lie over a bed between 3 m and 0.55 m below high water

/** Gentle ground on the coast where a crab can dig a hole; the wet strip counts too (down to 0.4 m below high water). */
export function isBeach(w, x, z) {
  const y = w.H(x, z);
  return y > -0.4 && y < 1.0 && w.Lat(x, z) < 0.35 && w.slope(x, z) < 0.4 && w.dryOfRiver(x, z, 1.0);
}

const colonyCache = new WeakMap(), fishCache = new WeakMap(), riverIndex = new WeakMap(), cellCache = new WeakMap();

export function coloniesOfTile(w, tile) {
  let list = colonyCache.get(tile); if (list) return list;
  list = []; colonyCache.set(tile, list);
  if (tile.hmax < -0.4) return list;
  const r = mulberry32(hashInt(w.seed + 301, tile.tx, tile.tz)), base = (tile.tz * NT + tile.tx) * 64;
  for (let k = 0; k < 40 && list.length < COLONY_MAX; k++) {
    const x = tile.x0 + r() * T, z = tile.z0 + r() * T, keep = r() < 0.5;
    if (!keep || !isBeach(w, x, z) || list.some(c => Math.hypot(c.x - x, c.z - z) < 7)) continue;
    const holes = [], nh = 3 + Math.floor(r() * 3);
    for (let i = 0; i < nh * 3 && holes.length < nh; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 1.7, hx = x + Math.cos(a) * d, hz = z + Math.sin(a) * d;
      if (!isBeach(w, hx, hz)) continue;
      const y = w.H(hx, hz);
      holes.push({ x: hx, y, z: hz, wet: y < 0.05 });
    }
    if (holes.length < 2) continue;
    const id = base + list.length, nc = Math.min(5, holes.length + (r() < 0.5 ? 1 : 0)), crabs = [];
    for (let i = 0; i < nc; i++) {
      const h = holes[i % holes.length], a = r() * Math.PI * 2;
      crabs.push({ id: id * 8 + i, hole: i % holes.length, x: h.x + Math.cos(a) * 0.1, z: h.z + Math.sin(a) * 0.1, u: (i + r()) / nc });
    }
    list.push({ id, x, z, holes, crabs });
  }
  return list;
}

/** The river groups of the whole island, sorted into tiles once. */
function riverGroups(w) {
  let idx = riverIndex.get(w); if (idx) return idx;
  idx = new Map(); riverIndex.set(w, idx);
  w.rivers.forEach((rv, ri) => {
    for (let k = 6; k < rv.kMouth - 3; k += 9) {
      const p = rv.pts[k], r = mulberry32(hashInt(Math.round(p.x * 8), Math.round(p.z * 8), 223));
      if (r() >= 0.8) continue;
      if (rv.falls.some(f => k > f.top - 6 && k < f.base + 8)) continue;
      const a = rv.pts[Math.max(0, k - 2)], b = rv.pts[Math.min(rv.n - 1, k + 2)], l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      const px = -(b.z - a.z) / l, pz = (b.x - a.x) / l, t = k / (rv.n - 1), hw = rv.W(t) / 2, lw = rv.LW(t);
      const off = (r() - 0.5) * hw * 0.8, cx = p.x + px * off, cz = p.z + pz * off, dir = Math.atan2(a.z - b.z, a.x - b.x);   // upstream: from the mouth side towards the source
      const n = 2 + Math.floor(r() * 4), fish = [];
      for (let i = 0; i < n; i++) {
        const ox = (r() - 0.5) * 0.9, oz = (r() - 0.5) * Math.min(0.8, hw * 0.9), fx = cx + Math.cos(dir) * ox - Math.sin(dir) * oz, fz = cz + Math.sin(dir) * ox + Math.cos(dir) * oz;
        if (lw - w.H(fx, fz) < 0.1 || lw - w.H(fx, fz) > 1.2) continue;   // only where there is water over the bed
        fish.push({ ox, oz, ph: r() * 6.28, len: 0.45 + r() * 0.2 });
      }
      if (fish.length < 2) continue;
      const tile = Math.floor((cz + HALF) / T) * NT + Math.floor((cx + HALF) / T);
      if (!idx.has(tile)) idx.set(tile, []);
      idx.get(tile).push({ id: 1000000 + ri * 100000 + k, kind: 'river', x: cx, z: cz, dir, lw, fish });
    }
  });
  return idx;
}

/** Shallow sea water with land on most sides within 40 m: a lagoon inside the island. */
function enclosed(w, x, z) {
  let hits = 0;
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    for (let d = 4; d <= 40; d += 4) if (w.Lat(x + Math.cos(a) * d, z + Math.sin(a) * d) >= 0) { hits++; break; }
  }
  return hits >= 5;
}

export function fishOfTile(w, tile) {
  let list = fishCache.get(tile); if (list) return list;
  list = (riverGroups(w).get(tile.tz * NT + tile.tx) || []).slice(); fishCache.set(tile, list);
  if (tile.hmax > -0.85) {
    const r = mulberry32(hashInt(w.seed + 311, tile.tx, tile.tz)), base = 2000000 + (tile.tz * NT + tile.tx) * 16;
    let n = 0;
    for (let k = 0; k < 40 && n < 4; k++) {
      const x = tile.x0 + r() * T, z = tile.z0 + r() * T, keep = r() < 0.5, y = w.H(x, z);
      if (!keep || y > -0.25 || y < -0.85 || w.Lat(x, z) >= 0 || list.some(g => g.kind === 'lagoon' && Math.hypot(g.x - x, g.z - z) < 10) || !enclosed(w, x, z)) continue;
      const nf = 2 + Math.floor(r() * 4), fish = [];
      for (let i = 0; i < nf; i++) {
        const ox = (r() - 0.5) * 2.4, oz = (r() - 0.5) * 2.4;
        const fy = w.H(x + ox, z + oz);
        if (fy > -0.2 || fy < -1.0 || w.Lat(x + ox, z + oz) >= 0) continue;   // only over the sea
        fish.push({ ox, oz, ph: r() * 6.28, len: 0.45 + r() * 0.2 });
      }
      if (fish.length < 2) continue;
      list.push({ id: base + n++, kind: 'lagoon', x, z, dir: r() * Math.PI * 2, fish });
    }
  }
  if (tile.hmax > SEA_FISH[0]) {
    // the open sea along the coast: shallow water beyond the surf, a few metres deep at most, where the fish still show through the water
    const rs = mulberry32(hashInt(w.seed + 313, tile.tx, tile.tz)), bs = 4000000 + (tile.tz * NT + tile.tx) * 16;
    let ns = 0;
    for (let k = 0; k < 120 && ns < 5; k++) {
      const x = tile.x0 + rs() * T, z = tile.z0 + rs() * T, keep = rs() < 0.7, y = w.H(x, z);
      if (!keep || y > SEA_FISH[1] || y < SEA_FISH[0] || w.Lat(x, z) >= 0 || list.some(g => g.kind !== 'river' && Math.hypot(g.x - x, g.z - z) < 7)) continue;
      const nf = 3 + Math.floor(rs() * 4), fish = [];
      for (let i = 0; i < nf; i++) {
        const ox = (rs() - 0.5) * 3, oz = (rs() - 0.5) * 3, fy = w.H(x + ox, z + oz);
        if (fy > SEA_FISH[1] || fy < SEA_FISH[0] - 0.4 || w.Lat(x + ox, z + oz) >= 0) continue;
        fish.push({ ox, oz, ph: rs() * 6.28, len: 0.5 + rs() * 0.25 });
      }
      if (fish.length < 3) continue;
      list.push({ id: bs + ns++, kind: 'sea', x, z, dir: rs() * Math.PI * 2, fish });
    }
  }
  return list;
}

/** The unit direction from (x, z) to the nearest rocky shore (rcAt high on the coast), looked for up to 300 m away. */
function awayTowardsRock(w, x, z, r) {
  let best = null, bd = Infinity;
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2;
    for (let d = 20; d <= 300; d += 20) {
      const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
      if (Math.abs(px) < HALF && Math.abs(pz) < HALF && w.rcAt(px, pz) > 0.7 && w.Lat(px, pz) < 0.6 && w.Lat(px, pz) > -0.6) { if (d < bd) { bd = d; best = a; } break; }
    }
  }
  const a = best === null ? r() * Math.PI * 2 : best;
  return { x: Math.cos(a), z: Math.sin(a) };
}

export function birdCell(w, cx, cz) {
  let m = cellCache.get(w); if (!m) { m = new Map(); cellCache.set(w, m); }
  const key = cz * 1000 + cx; if (m.has(key)) return m.get(key);
  const r = mulberry32(hashInt(w.seed + 331, cx, cz)); let cell = null;
  const x0 = cx * CELL - HALF, z0 = cz * CELL - HALF;
  for (let k = 0; k < 14 && !cell; k++) {
    const x = x0 + r() * CELL, z = z0 + r() * CELL, y = w.H(x, z);
    if (y > -0.5 && y < 0.7 && w.Lat(x, z) < 0.35 && r() < 0.8) {
      cell = { id: key, x, z, n: 2 + Math.floor(r() * 3), r: 7 + r() * 8, alt: 6 + r() * 3, omega: (0.25 + r() * 0.15) * (r() < 0.5 ? -1 : 1), ph: r() * Math.PI * 2, away: awayTowardsRock(w, x, z, r) };
    }
  }
  m.set(key, cell);
  return cell;
}
