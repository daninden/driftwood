// The castaway's memory of the island (game/known, 0.28 "Habit"): cells of 10 m marked within 20 m of where he walked.
import { describe, it, expect } from 'vitest';
import { createKnown, CELL, RADIUS, STEP, NC, MAX_CELLS } from '../src/game/known.js';

describe('known ground', () => {
  it('starts knowing nothing', () => {
    const k = createKnown();
    expect(k.count).toBe(0); expect(k.has(0, 0)).toBe(false); expect(k.near(0, 0, 50)).toBe(false);
  });
  it('marks the cells whose middle is within 40 m of where he stands (what he sees)', () => {
    const k = createKnown(); expect(k.visit(0, 0)).toBe(52);   // middles at +-5, +-15, +-25, +-35 within 40 m
    expect(k.count).toBe(52);
    expect(k.has(0, 0)).toBe(true); expect(k.has(14, 0)).toBe(true); expect(k.has(-14, -9)).toBe(true);
    expect(k.has(34, 0)).toBe(true); expect(k.has(46, 0)).toBe(false); expect(k.has(0, -46)).toBe(false); expect(k.has(36, 36)).toBe(false); expect(k.has(26, 26)).toBe(true);
    expect(CELL).toBe(10); expect(RADIUS).toBe(40);
  });
  it('walking on marks more, standing or shuffling about marks nothing new', () => {
    const k = createKnown(); k.visit(0, 0);
    expect(k.visit(1, 1)).toBe(0);   // less than STEP away
    expect(k.visit(0, STEP - 0.1)).toBe(0);
    expect(k.visit(60, 0)).toBeGreaterThan(0);
    expect(k.has(90, 0)).toBe(true); expect(k.has(110, 0)).toBe(false);
  });
  it('marks only the cell he stands in when told to learn nothing (radius 0), as the mind walks him', () => {
    const k = createKnown(); k.visit(0, 0);
    const n = k.count; k.visit(14, 0, 0); k.visit(14.0, 3, 0);
    expect(k.count).toBe(n);   // that cell was known already
    k.visit(100, 100, 0); expect(k.count).toBe(n + 1); expect(k.has(100, 100)).toBe(true); expect(k.has(110, 100)).toBe(false);
  });
  it('knows the cell he stands in even where no middle is within the radius', () => {
    const k = createKnown(); k.visit(-100, -100, 3);
    expect(k.has(-100, -100)).toBe(true);
  });
  it('ignores places outside the island and numbers that are not numbers', () => {
    const k = createKnown();
    expect(k.visit(NaN, 0)).toBe(0); expect(k.visit(0, Infinity)).toBe(0);
    k.visit(-359, -359); expect(k.has(-400, -400)).toBe(false); expect(k.has(1e6, 0)).toBe(false);
    for (let i = 0; i < MAX_CELLS; i++) if (k.hasCell(i) && (i < 0 || i >= MAX_CELLS)) throw new Error('cell out of range');
  });
  it('near(): a known cell with its middle within r', () => {
    const k = createKnown(); k.visit(0, 0);
    expect(k.near(0, 0, 1)).toBe(false); expect(k.near(0, 0, 8)).toBe(true); expect(k.near(30, 0, 20)).toBe(true); expect(k.near(60, 0, 20)).toBe(false);
  });
  it('is saved as sorted cell numbers and comes back the same', () => {
    const k = createKnown(); k.visit(0, 0); k.visit(60, -40);
    const s = k.state();
    expect(s.cell).toBe(CELL); expect(s.cells).toEqual([...s.cells].sort((a, b) => a - b)); expect(s.cells.length).toBe(k.count);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
    const back = createKnown(s); expect(back.count).toBe(k.count); expect(back.state()).toEqual(s); expect(back.has(60, -40)).toBe(true);
    expect(NC).toBe(72); expect(s.cells.every(i => i >= 0 && i < NC * NC)).toBe(true);
  });
  it('drops garbage from a saved memory', () => {
    expect(createKnown({ cell: 5, cells: [1, 2, 3] }).count).toBe(0);   // another cell size
    expect(createKnown({ cell: CELL, cells: 'x' }).count).toBe(0);
    expect(createKnown({ cell: CELL }).count).toBe(0);
    expect(createKnown(null).count).toBe(0); expect(createKnown('x').count).toBe(0);
    const k = createKnown({ cell: CELL, cells: [3, 3, 4.5, -1, MAX_CELLS, NaN, '7', null, 12] });
    expect(k.state().cells).toEqual([3, 12]);
  });
});

describe('0.30.5 "Quicker": hasAround', () => {
  it('is exactly the nine has() lookups of the mind\'s `inside`, at cell edges, corners, the island edge and at random', () => {
    const k = createKnown();
    for (const [x, z] of [[0, 0], [37, -12], [-120, 80], [-355, -355], [200, 140]]) k.visit(x, z);
    k.visit(14, 9, 0); k.visit(355, 355, 0);
    let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const pts = [];
    for (let i = 0; i < 20000; i++) pts.push([rnd() * 760 - 380, rnd() * 760 - 380]);
    for (let c = -36; c <= 36; c++) for (const e of [-1.5, -1.4999999, -1.125, -1e-9, 0, 1e-9, 1.125, 1.5, 1.5000001]) { pts.push([c * CELL + e, 41.3]); pts.push([-20.7, c * CELL + e]); pts.push([c * CELL + e, c * CELL - e]); }
    let yes = 0;
    for (const [m, d] of [[1.5, 1.125], [0, 0], [4, 3]]) for (const [x, z] of pts) {
      const nine = k.has(x, z) && k.has(x + m, z) && k.has(x - m, z) && k.has(x, z + m) && k.has(x, z - m) && k.has(x + d, z + d) && k.has(x - d, z - d) && k.has(x + d, z - d) && k.has(x - d, z + d);
      expect(k.hasAround(x, z, m, d), `${x} ${z} ${m}`).toBe(nine); if (nine) yes++;
    }
    expect(yes).toBeGreaterThan(1000);
  });
});
