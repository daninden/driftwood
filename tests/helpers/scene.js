// Test helpers for scenes (0.38.0 "Only him": from tests/helpers/mindSim and tests/helpers/mindCamp, which served the old mind; these two never used it):
//   walkFirstDay(world, game, spawn, o?) -> { points, reached, cells }   the ground a first day of walking would teach him: the game's own shortest walks from the start to the
//       nearest water, coconuts, driftwood, branches and a berry bush, and back (o: { radius, water, cocos, logs, branches, berries } how many of each)
//   SITES_1337: [{ x, z, heading, r }]   lean-to sites round the start of seed 1337, best first (tests/fixtures/sites1337.json: as the old mind chose them; fixed scenes)
//   campGame(world, spawn, { day, time, leantos, know, piles, stocked, extra }) -> game   a game with his camp at the start (a burnt fire place), the ground of a first day known,
//       optionally lean-tos; stocked: nuts, fibre and a full pile of wood at the fire
// Depends on: game/game, game/leanto, game/path, game/water, game/movement, world/constants
import { createGame } from '../../src/game/game.js';
import { ringCentre } from '../../src/game/leanto.js';
import { HALF, T } from '../../src/world/constants.js';
import { freshWater } from '../../src/game/water.js';
import { canStand } from '../../src/game/movement.js';
import { createPath } from '../../src/game/path.js';
import { readFileSync } from 'node:fs';

export const SITES_1337 = JSON.parse(readFileSync(new URL('../fixtures/sites1337.json', import.meta.url), 'utf8')).sites;

export const HOME_DAY = 2;   // the day of the camp scenes (it was the old mind's first day of home work)

export function walkFirstDay(world, game, spawn, o = {}) {
  const k = game.known, pts = [];
  const tilesNear = (x, z, r) => { const out = []; for (const t of world.tiles) if (Math.abs(t.tx * T - HALF + T / 2 - x) < r + T && Math.abs(t.tz * T - HALF + T / 2 - z) < r + T) out.push(t); return out; };
  const nearest = (list, n) => list.map(q => ({ ...q, d: Math.hypot(q.x - spawn.x, q.z - spawn.z) })).sort((a, b) => a.d - b.d).slice(0, n);
  const water = []; for (const rv of world.rivers) for (let i = 0; i < rv.pts.length; i += 2) { const q = rv.pts[i]; if (freshWater(world, q.x, q.z, 0) && canStand(world, q.x, q.z, 0)) water.push({ x: q.x, z: q.z }); }
  const R = o.radius || 150, near = tilesNear(spawn.x, spawn.z, R), cocos = [], logs = [], branches = [], berries = [];
  for (const t of near) { cocos.push(...game.fibre.groundCocos(t)); logs.push(...game.wood.beachLogs(t)); branches.push(...game.branches.groundBranches(t)); berries.push(...game.berries.bearingIn(t)); }
  for (const [list, n] of [[water, o.water ?? 2], [cocos, o.cocos ?? 4], [logs, o.logs ?? 4], [branches, o.branches ?? 4], [berries, o.berries ?? 1]]) pts.push(...nearest(list, n));
  const finder = createPath(world);   // a player walks round the sea and the rocks: the way is the game's own shortest walk
  const walk = (from, to) => {
    const r = finder.find(from, to); if (!r) return false;
    for (const q of r.pts) k.visit(q.x, q.z);
    return true;
  };
  let reached = 0;
  for (const q of pts) if (walk(spawn, q)) { reached++; walk(q, spawn); }
  return { points: pts.length, reached, cells: k.count };
}

// a game on day `day` at `time` with his camp at the start (a burnt fire place), the ground of a first day known, and optionally lean-tos
export const campGame = (w, spawn, { day = HOME_DAY, time = 0.22, leantos = null, know = true, piles = [], stocked = true, extra = {} } = {}) => {   // stocked: nuts, fibre and a full pile of wood at the fire, so that the morning is free for the house
  const g = createGame(w, spawn, { day, time, sleep: { awake: 0.1 }, ...(stocked ? { shells: { full: [], nuts: 2 }, fibre: { carried: 3 } } : {}), fire: { fires: [], burnt: [{ id: 0, x: spawn.x, z: spawn.z, left: 2, n: 3 }], attempts: 0, nextId: 1 }, ...(leantos ? { leantos } : {}), ...extra });
  if (know) walkFirstDay(w, g, spawn);
  const log = (kind, i, x, z) => ({ id: 900000 + i, x, y: w.H(x, z), z, len: 2, a: 0, rad: 0.1, ...(kind === 'branch' ? { branch: true } : {}) });
  const rc = leantos && leantos.list[0].progress >= 1 ? ringCentre(leantos.list[0]) : { x: spawn.x, z: spawn.z };   // the fire's place: where the lean-to's ring is, else the old fire
  for (const q of stocked ? [{ id: 9, kind: 'driftwood', n: 12, x: rc.x + 0.4, z: rc.z }, ...piles] : piles) g.wood.piles.push({ x: q.x, z: q.z, kind: q.kind, logs: Array.from({ length: q.n }, (_, i) => log(q.kind, q.id * 20 + i, q.x, q.z)) });
  return g;
};
