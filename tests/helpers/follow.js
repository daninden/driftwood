// Test helper (0.28.1 "Scramble"): walks a path the way game/mind does, with the real stepPlayer in steps of 0.1 s, and reports how it went.
// follow(world, path, from, to, { secs, arrivalDistance?, movement?, onStep? }) -> { arrived, secs, stall, x, z }   movement: stepPlayer options; onStep(player) observes each real step; stall: the longest time (s) without moving 0.3 m
import { stepPlayer, moveIntent } from '../../src/game/movement.js';

export function follow(world, path, from, to, { secs = 240, arrivalDistance = 1, movement = null, onStep = null } = {}) {
  const r = path.find(from, to); if (!r) return { arrived: false, nopath: true, secs: 0, stall: 0, x: from.x, z: from.z };
  const p = { x: from.x, z: from.z, y: world.H(from.x, from.z), heading: 0, phase: 0 };
  let pi = 0, t = 0, stall = 0, since = 0, cx = p.x, cz = p.z;
  while (t < secs) {
    if (Math.hypot(to.x - p.x, to.z - p.z) <= arrivalDistance) return { arrived: true, secs: t, stall, x: p.x, z: p.z };
    const d0 = i => Math.hypot(r.pts[i].x - p.x, r.pts[i].z - p.z);
    while (pi < r.pts.length - 1 && (d0(pi) < 0.45 || (d0(pi) < 1.1 && path.clear(p, r.pts[pi + 1])))) pi++;   // the same rule as game/mind
    const last = (pi >= r.pts.length - 1 || Math.hypot(r.pts.at(-1).x - p.x, r.pts.at(-1).z - p.z) < 2.2) && (!path.dynamic || path.clear(p, to)), w = last ? to : r.pts[pi];
    stepPlayer(world, p, moveIntent({ target: w }, p), 0.1, false, 1, 0, 1, movement); onStep && onStep(p); t += 0.1;
    if (Math.hypot(p.x - cx, p.z - cz) >= 0.3) { cx = p.x; cz = p.z; since = 0; } else { since += 0.1; stall = Math.max(stall, since); }
  }
  return { arrived: false, secs: t, stall, x: p.x, z: p.z };
}
