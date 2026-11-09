// Test helper for the mind tests: a game with Dave's camp (0.29.3 "Homestead"), shared by tests/mind.test.js and tests/mindSim.test.js.
// Exports: campGame(world, spawn, { day, time, leantos, know, piles, stocked, extra }) -> game
// Depends on: game/game, game/leanto, game/mind (HOME_DAY), tests/helpers/mindSim (walkFirstDay)
import { createGame } from '../../src/game/game.js';
import { ringCentre } from '../../src/game/leanto.js';
import { HOME_DAY } from '../../src/game/mind.js';
import { walkFirstDay } from './mindSim.js';

// a game on day `day` at `time` with his camp at the start (a burnt fire place), the ground of a first day known, and optionally lean-tos
export const campGame = (w, spawn, { day = HOME_DAY, time = 0.22, leantos = null, know = true, piles = [], stocked = true, extra = {} } = {}) => {   // stocked: nuts, fibre and a full pile of wood at the fire, so that the morning is free for the house
  const g = createGame(w, spawn, { day, time, sleep: { awake: 0.1 }, ...(stocked ? { shells: { full: [], nuts: 2 }, fibre: { carried: 3 } } : {}), fire: { fires: [], burnt: [{ id: 0, x: spawn.x, z: spawn.z, left: 2, n: 3 }], attempts: 0, nextId: 1 }, ...(leantos ? { leantos } : {}), ...extra });
  if (know) walkFirstDay(w, g, spawn);
  const log = (kind, i, x, z) => ({ id: 900000 + i, x, y: w.H(x, z), z, len: 2, a: 0, rad: 0.1, ...(kind === 'branch' ? { branch: true } : {}) });
  const rc = leantos && leantos.list[0].progress >= 1 ? ringCentre(leantos.list[0]) : { x: spawn.x, z: spawn.z };   // the fire's place: where the lean-to's ring is, else the old fire
  for (const q of stocked ? [{ id: 9, kind: 'driftwood', n: 12, x: rc.x + 0.4, z: rc.z }, ...piles] : piles) g.wood.piles.push({ x: q.x, z: q.z, kind: q.kind, logs: Array.from({ length: q.n }, (_, i) => log(q.kind, q.id * 20 + i, q.x, q.z)) });
  return g;
};
