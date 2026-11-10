/**
 * game/known — which part of the island the castaway knows (0.28 "Habit").
 *
 * The island is cut into square cells of CELL (10) metres. A cell is *known* once he has walked within RADIUS (40) metres of its middle
 * (the middle of the cell, not any corner): every few metres of walking marks the cells round him. It is a coarse memory, not a map: nothing
 * of it is drawn. It only says where the castaway's own habit (game/mind) may take him: he goes to places he has been and nowhere else.
 *
 * Only the player's walking teaches him new ground. While game/mind walks him (`input.learns === false`, see game/game) only the cell he stands
 * in is marked, which is known already, so his habit can never creep out into unknown land by walking at the edge of what he knows.
 *
 * CELL, RADIUS, STEP, NC (cells per side), MAX_CELLS, cellOf(v) (the cell index along one axis)
 * createKnown(saved?) -> known
 *   known.has(x, z)           true when the cell of (x, z) is known
 *   known.hasAround(x, z, m, d)  0.30.5 "Quicker": exactly has(x, z) && has(x ± m, z) && has(x, z ± m) && has(x ± d, z ± d) (the four diagonals), in one or two
 *                             lookups where those points share cells (m and d >= 0, d <= m); game/mind asks this for its `inside`
 *   known.hasCell(i)          true when cell index i (iz * NC + ix) is known
 *   known.near(x, z, r)       true when a known cell's middle is within r of (x, z)
 *   known.visit(x, z, r?)     he is at (x, z): marks the cells whose middle is within r (default RADIUS, 40 m: what he sees; 0: just his own cell). Looks only once he
 *                             has moved STEP (2 m) since the last look (or r changed). Returns the number of cells newly known
 *   known.count               how many cells are known
 *   known.state() -> { cell, cells: [index] }   plain, for saving (sorted)
 *   saved: such a state, to start from; anything else (another cell size, bad numbers) is dropped
 *
 * Pure data; no DOM, no Three.js.
 *
 * Depends on: world/constants
 */
import { HALF, S } from '../world/constants.js';

export const CELL = 10, RADIUS = 40, STEP = 2;
export const NC = Math.ceil(S / CELL), MAX_CELLS = NC * NC;

export const cellOf = v => Math.floor((v + HALF) / CELL);
const middle = i => (i + 0.5) * CELL - HALF;

export function createKnown(saved) {
  const set = new Set(), grid = new Uint8Array(MAX_CELLS);   // 0.30.5 "Quicker": the same cells as a flat array for the lookups (the set keeps the count and the order of the save)
  const cells = { has: k => set.has(k), add: k => { set.add(k); grid[k] = 1; }, get size() { return set.size; }, [Symbol.iterator]: () => set[Symbol.iterator]() };
  let lastX = NaN, lastZ = NaN, lastR = NaN;
  const at = (ix, iz) => ix >= 0 && iz >= 0 && ix < NC && iz < NC && grid[iz * NC + ix] === 1;
  const known = {
    get count() { return set.size; },
    has(x, z) { return at(cellOf(x), cellOf(z)); },
    // cellOf is monotone, so when x - m and x + m fall in one cell every x between them does too (and the same along z): then the nine points are one cell
    hasAround(x, z, m, d) {
      const i0 = cellOf(x - m), i1 = cellOf(x + m), j0 = cellOf(z - m), j1 = cellOf(z + m);
      if (i0 === i1 && j0 === j1) return at(i0, j0);
      return at(cellOf(x), cellOf(z)) && at(i1, cellOf(z)) && at(i0, cellOf(z)) && at(cellOf(x), j1) && at(cellOf(x), j0)
        && at(cellOf(x + d), cellOf(z + d)) && at(cellOf(x - d), cellOf(z - d)) && at(cellOf(x + d), cellOf(z - d)) && at(cellOf(x - d), cellOf(z + d));
    },
    hasCell: i => cells.has(i),
    near(x, z, r) {
      const i0 = Math.max(0, cellOf(x - r)), i1 = Math.min(NC - 1, cellOf(x + r)), j0 = Math.max(0, cellOf(z - r)), j1 = Math.min(NC - 1, cellOf(z + r));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (cells.has(j * NC + i) && Math.hypot(middle(i) - x, middle(j) - z) <= r) return true;
      return false;
    },
    visit(x, z, r = RADIUS) {
      if (!Number.isFinite(x) || !Number.isFinite(z)) return 0;
      if (r === lastR && Math.hypot(x - lastX, z - lastZ) < STEP) return 0;
      lastX = x; lastZ = z; lastR = r;
      let added = 0;
      const mark = (i, j) => { if (i < 0 || j < 0 || i >= NC || j >= NC) return; const k = j * NC + i; if (!cells.has(k)) { cells.add(k); added++; } };
      if (r <= 0) { mark(cellOf(x), cellOf(z)); return added; }
      const i0 = cellOf(x - r), i1 = cellOf(x + r), j0 = cellOf(z - r), j1 = cellOf(z + r);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (Math.hypot(middle(i) - x, middle(j) - z) <= r) mark(i, j);
      if (!added && !cells.has(cellOf(x) + cellOf(z) * NC)) mark(cellOf(x), cellOf(z));   // always the cell he stands in
      return added;
    },
    state: () => ({ cell: CELL, cells: [...cells].sort((a, b) => a - b) }),
  };
  if (saved && saved.cell === CELL && Array.isArray(saved.cells)) for (const k of saved.cells) if (Number.isInteger(k) && k >= 0 && k < MAX_CELLS) cells.add(k);
  return known;
}
