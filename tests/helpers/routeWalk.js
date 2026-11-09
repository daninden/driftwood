// Test helper (0.30.3 "Routes", replaces follow.js): walks a route of game/route with the real stepPlayer in steps of 0.1 s and reports how it went.
// routeWalk(world, finder, from, goal, { secs, stop, tap, movement, onStep, onTick, dt }) -> { arrived, unreachable, nopath, reason, secs, stall, replans, stalls, clip, reversals, finalDistance, length, x, z }
//   movement: stepPlayer options (game.movement); onStep(player) observes each real step; onTick(t, player) may change the camp between steps; stop: the arrival distance (1 m); stall: the longest time (s) without moving 0.3 m
//   clip: the deepest he stood inside a camp circle he did not start in (the escape rule excepted); reversals: turns of more than 120 degrees between two half-second displacements; length: metres walked
import { stepPlayer, moveIntent } from '../../src/game/movement.js';
import { createRoute } from '../../src/game/route.js';

export function routeWalk(world, finder, from, goal, { secs = 240, stop = 1, tap = false, movement = null, onStep = null, onTick = null, dt = 0.1 } = {}) {
  const route = createRoute(finder, from, goal, { stop, tap });
  const res = { arrived: false, unreachable: false, nopath: false, reason: null, secs: 0, stall: 0, replans: 0, stalls: 0, clip: 0, reversals: 0, finalDistance: Infinity, length: 0, x: from.x, z: from.z };
  const sig = o => `${o.x.toFixed(3)}:${o.z.toFixed(3)}:${o.r.toFixed(3)}`;
  const exempt = movement && movement.obstacles ? new Set(movement.obstacles(from.x, from.z, 3).filter(o => Math.hypot(from.x - o.x, from.z - o.z) < o.r).map(sig)) : new Set(), seen = new Set(exempt);   // a circle he starts in, or one that appears round him, may be left (movement's escape rule)
  const p = { x: from.x, z: from.z, y: world.H(from.x, from.z), heading: 0, phase: 0 };
  let t = 0, since = 0, cx = p.x, cz = p.z, anchor = { x: p.x, z: p.z }, prev = null, last = { x: p.x, z: p.z }, tick = 0;
  const finish = () => {
    res.secs = t; res.replans = route.replans; res.stalls = route.stalls; res.x = p.x; res.z = p.z; res.finalDistance = Math.hypot(goal.x - p.x, goal.z - p.z);
    res.arrived = route.state === 'arrived' || (tap ? false : res.finalDistance <= stop);
    res.unreachable = route.state === 'unreachable'; res.reason = route.reason; res.nopath = res.unreachable && route.reason === 'nopath' && t === 0;
    return res;
  };
  while (t < secs) {
    if (onTick) onTick(t, p);
    const u = route.update(p, dt, false);
    if (u.state !== 'going') break;
    stepPlayer(world, p, moveIntent({ target: u.target }, p), dt, false, 1, 0, 1, movement); onStep && onStep(p); t += dt; tick++;
    res.length += Math.hypot(p.x - last.x, p.z - last.z); last = { x: p.x, z: p.z };
    if (movement && movement.obstacles) for (const o of movement.obstacles(p.x, p.z, 2)) { const k = sig(o); if (!seen.has(k)) { seen.add(k); if (Math.hypot(p.x - o.x, p.z - o.z) < o.r) exempt.add(k); } if (exempt.has(k)) continue; res.clip = Math.max(res.clip, o.r - Math.hypot(p.x - o.x, p.z - o.z)); }
    if (Math.hypot(p.x - cx, p.z - cz) >= 0.3) { cx = p.x; cz = p.z; since = 0; } else { since += dt; res.stall = Math.max(res.stall, since); }
    if (tick % 5 === 0) { const v = { x: p.x - anchor.x, z: p.z - anchor.z }; if (Math.hypot(v.x, v.z) > 0.15) { if (prev && v.x * prev.x + v.z * prev.z < -0.5 * Math.hypot(v.x, v.z) * Math.hypot(prev.x, prev.z)) res.reversals++; prev = v; } anchor = { x: p.x, z: p.z }; }
  }
  return finish();
}
