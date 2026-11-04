/**
 * game/known — which part of the island the castaway knows (0.28 "Habit").
 *
 * The island is cut into square cells of CELL (10) metres. A cell is *known* once he has walked within RADIUS (20) metres of its middle
 * (the middle of the cell, not any corner): every few metres of walking marks the cells round him. It is a coarse memory, not a map: nothing
 * of it is drawn. It only says where the castaway's own habit (game/mind) may take him: he goes to places he has been and nowhere else.
 *
 * Only the player's walking teaches him new ground. While game/mind walks him (`input.learns === false`, see game/game) only the cell he stands
 * in is marked, which is known already, so his habit can never creep out into unknown land by walking at the edge of what he knows.
 *
 * CELL, RADIUS, STEP, NC (cells per side), MAX_CELLS
 * createKnown(saved?) -> known
 *   known.has(x, z)           true when the cell of (x, z) is known
 *   known.hasCell(i)          true when cell index i (iz * NC + ix) is known
 *   known.near(x, z, r)       true when a known cell's middle is within r of (x, z)
 *   known.visit(x, z, r?)     he is at (x, z): marks the cells whose middle is within r (default RADIUS; 0: just his own cell). Looks only once he
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

export const CELL = 10, RADIUS = 20, STEP = 2;
export const NC = Math.ceil(S / CELL), MAX_CELLS = NC * NC;

const cellOf = v => Math.floor((v + HALF) / CELL);
const middle = i => (i + 0.5) * CELL - HALF;

export function createKnown(saved) {
  const cells = new Set();
  let lastX = NaN, lastZ = NaN, lastR = NaN;
  const known = {
    get count() { return cells.size; },
    has(x, z) { const ix = cellOf(x), iz = cellOf(z); return ix >= 0 && iz >= 0 && ix < NC && iz < NC && cells.has(iz * NC + ix); },
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
