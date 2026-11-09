// A path must be one he can walk (0.28.1 "Scramble"): the path finder only joins cells by lines the walking rules let him follow, and walking it
// with the real stepPlayer and the follower of game/route (tests/helpers/routeWalk) gets there without a stall. Before 0.28.1 these routes stalled for good:
//   seed 7: the climbing routes up the cliff faces round (-203, -90), (-200, -78), (-185, 24) and (-240, -6): a route is a narrow band and a line between two
//     cells that were both fine cut across the wall; he stood on the wall with every step blocked
//   seed 11: the thicket round the stores at (115, -162): a line through two trunks that overlap, and he stuck between them
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { createPath } from '../src/game/path.js';
import { nearestStandable } from '../src/game/movement.js';
import { routeWalk } from './helpers/routeWalk.js';

function suite(seed, spots) {
  let w, path, pts;
  beforeAll(async () => { w = await generateWorld(seed); path = createPath(w); pts = spots.map(([x, z]) => nearestStandable(w, x, z)); }, 120000);
  describe(`walking the paths of island ${seed}`, () => {
    it('gets from each of the places that used to stall to each of the others, with no stall of 3 s', () => {
      let n = 0;
      for (const a of pts) for (const b of pts) {
        if (a === b) continue;
        const r = routeWalk(w, path, a, b, { secs: 700 }); n++;
        expect(r.nopath, `no way from ${a.x.toFixed(1)},${a.z.toFixed(1)} to ${b.x.toFixed(1)},${b.z.toFixed(1)}`).toBe(false);
        expect(r.arrived, `stuck at ${r.x.toFixed(1)},${r.z.toFixed(1)} on the way from ${a.x.toFixed(1)},${a.z.toFixed(1)} to ${b.x.toFixed(1)},${b.z.toFixed(1)}`).toBe(true);
        expect(r.stall).toBeLessThan(3);
      }
      expect(n).toBe(pts.length * (pts.length - 1));
    });
  });
}

suite(7, [[-212, -80], [-195.9, -91], [-240, -6], [-184.6, 24.4], [-200.5, -76]]);
suite(11, [[115, -158], [108, -166], [113.5, -162.4], [128, -171]]);
