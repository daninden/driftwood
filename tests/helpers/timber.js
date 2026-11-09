// Test helper for 0.30.4 "Timber": a camp game with loose logs where the test puts them, nothing else lying about, and places to put them.
// Not a test itself. Exports:
//   timberGame(world, spawn, { day, time, dry: [{x, z}], wet: [{x, z}], ... }) -> game   campGame with the island's own loose logs taken away (`lost`) and logs 700000+ (dry) and 700100+ (wet, washed up a tenth of a day ago) at the given places; the ground within 70 m known
//   places(world, game, mind, { strip, min, max, n, gapCost, gapDist, skip }) -> [{ x, z, cost }]   standable, dry, level places round the camp, nearest first, by walking cost from where he stands (strip: in the strip between the tides, else above it)
//   tick(game, mind, dt?)   one step of the mind and the game
// Depends on: tests/helpers/mindCamp, game/movement, game/wood
import { campGame } from './mindCamp.js';
import { canStand } from '../../src/game/movement.js';
import { inStripY } from '../../src/game/wood.js';

export const DRY_ID = 700000, WET_ID = 700100;

export function timberGame(w, spawn, { day = 1, time = 0.3, dry = [], wet = [], extra = {}, ...rest } = {}) {
  const lost = w.tiles.flatMap(t => t.drift || []).map(l => l.id), total = day + time;
  const mk = (q, id, wetNow) => ({ id, x: q.x, y: w.H(q.x, q.z), z: q.z, len: 1.4, a: 0.3, rad: 0.1, ...(wetNow ? { t: total - 0.1 } : {}) });
  const washed = [...dry.map((q, i) => mk(q, DRY_ID + i, false)), ...wet.map((q, i) => mk(q, WET_ID + i, true))];
  const g = campGame(w, spawn, { day, time, ...rest, extra: { wood: { washed, nextId: 710000, carried: [], piles: [], lost, tide: null }, ...extra } });
  g.known.visit(spawn.x, spawn.z, 70);
  return g;
}

export function places(w, g, m, { strip = false, min = 6, max = 44, n = 6, gapCost = 5, gapDist = 4, skip = () => false } = {}) {
  const c = { x: g.player.x, z: g.player.z }, all = [];
  for (let r = min; r <= max; r += 2) for (let i = 0; i < 24; i++) {
    const a = i * Math.PI / 12 + (r % 4) * 0.05, x = c.x + Math.sin(a) * r, z = c.z + Math.cos(a) * r, y = w.H(x, z);
    if (!canStand(w, x, z, 0) || w.slope(x, z) > 0.25 || w.riverAt(x, z) || skip(x, z)) continue;
    if (strip ? !inStripY(y) : !(y > 0.7 && y < 2)) continue;
    const cost = m.path.cost(g.player, { x, z });
    if (cost < Infinity && cost < 80) all.push({ x, z, cost });
  }
  all.sort((p, q) => p.cost - q.cost);
  const out = [];
  for (const p of all) if (out.length < n && out.every(q => Math.hypot(p.x - q.x, p.z - q.z) >= gapDist && Math.abs(p.cost - q.cost) >= gapCost)) out.push(p);
  return out;
}

export const tick = (g, m, dt = 0.1) => { m.step(dt); g.update(m.input, dt); };
