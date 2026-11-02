// Tree, pine and palm variety: shapes, colours, withered fronds, lean
// directions. Uses a recording batch, so no WebGL is needed.
import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../src/core/noise.js';
import { addTree, addPine, addPalm, DRY_CHANCE } from '../src/render/props.js';

const kit = new Proxy({}, { get: (_, k) => k });   // geometries and materials by name
function batch() { const list = []; return { list, add: (key, geo, mat, m, c) => list.push({ key, m, c }) }; }
const keys = b => b.list.map(e => e.key);

describe('trees', () => {
  it('builds the same tree from the same random stream', () => {
    const a = batch(), b = batch(), t = { x: 1, y: 2, z: 3, jungle: true };
    addTree(a, kit, t, mulberry32(5)); addTree(b, kit, t, mulberry32(5));
    expect(a.list.map(e => [e.key, e.c, ...e.m.elements])).toEqual(b.list.map(e => [e.key, e.c, ...e.m.elements]));
  });
  it('varies shape and colour', () => {
    const r = mulberry32(7), trunks = new Set(), crowns = new Set(), colours = new Set();
    for (let i = 0; i < 200; i++) {
      const b = batch(); addTree(b, kit, { x: 0, y: 0, z: 0, jungle: i % 2 === 0 }, r);
      trunks.add(keys(b).filter(k => k === 'trunk').length);
      const c = b.list.filter(e => e.key === 'canopy'); colours.add(c[0].c);
      crowns.add(Math.round(c[0].m.elements[5] / Math.hypot(...c[0].m.elements.slice(0, 3)) * 10));   // flattened crown blobs
    }
    expect(trunks).toEqual(new Set([1, 3]));          // single trunk and forked
    expect(crowns.size).toBeGreaterThan(1);           // round and umbrella
    expect(colours.size).toBeGreaterThan(20);
  });
  it('builds pines with two to four cones', () => {
    const r = mulberry32(9), counts = new Set();
    for (let i = 0; i < 100; i++) { const b = batch(); addPine(b, kit, { x: 0, y: 0, z: 0 }, r); counts.add(keys(b).filter(k => k === 'pine').length); }
    expect(counts).toEqual(new Set([2, 3, 4]));
  });
});

describe('palms', () => {
  const crownOf = b => { const s = b.list.filter(e => e.key === 'palmseg').at(-1).m.elements; return { x: s[12], z: s[14] }; };
  it('leans in many directions, not only towards the sea', () => {
    const r = mulberry32(11), bins = new Set(); let dry = 0, n = 400;
    for (let i = 0; i < n; i++) {
      const p = { x: 100, y: 1, z: 0 }, b = batch(); addPalm(b, kit, p, r);   // the sea lies towards +x
      const c = crownOf(b), a = Math.atan2(c.z - p.z, c.x - p.x);
      bins.add(Math.floor((a + Math.PI) / (Math.PI / 4)));
      if (keys(b).includes('frondDry')) dry++;
    }
    expect(bins.size).toBeGreaterThanOrEqual(6);
    expect(dry / n).toBeGreaterThan(DRY_CHANCE * 0.6);
    expect(dry / n).toBeLessThan(DRY_CHANCE * 1.4);   // a few, not too many
  });
  it('has at most two withered fronds per palm', () => {
    const r = mulberry32(13);
    for (let i = 0; i < 200; i++) { const b = batch(); addPalm(b, kit, { x: 50, y: 1, z: 50 }, r); expect(keys(b).filter(k => k === 'frondDry').length).toBeLessThanOrEqual(2); }
  });
  it('tints fronds per palm', () => {
    const r = mulberry32(17), tints = new Set();
    for (let i = 0; i < 50; i++) { const b = batch(); addPalm(b, kit, { x: 50, y: 1, z: 50 }, r); b.list.filter(e => e.key === 'frond').forEach(e => tints.add(e.c)); }
    expect(tints.size).toBeGreaterThan(30);
  });
  it('leans close neighbours apart more often than not', () => {
    const r = mulberry32(19), a = { x: 50, y: 1, z: 50 }, other = { x: 51.5, y: 1, z: 50 }; let away = 0;
    for (let i = 0; i < 200; i++) { const b = batch(); addPalm(b, kit, a, r, [a, other]); if (crownOf(b).x < a.x) away++; }
    expect(away / 200).toBeGreaterThan(0.55);
  });
});

describe('bushes', () => {
  it('are a clump of several pieces, never one ball', async () => {
    const { addBush } = await import('../src/render/props.js');
    const r = mulberry32(23);
    for (let k = 0; k < 5; k++) for (let i = 0; i < 20; i++) {
      const b = batch(); addBush(b, kit, { x: i * 3.1, y: 1, z: k * 2.7, k }, r);
      expect(keys(b).filter(x => x === 'bush').length).toBeGreaterThanOrEqual(2);
      expect(b.list.length).toBeGreaterThanOrEqual(4);
    }
  });
});
