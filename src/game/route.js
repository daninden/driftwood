/**
 * game/route — the one follower of a planned way (0.30.3 "Routes"): a pure state machine that turns a route of game/path into the point to walk to next.
 *
 * It replaces the copy of the follower in game/mind (`walk`) and in the old tests/helpers/follow.js. It makes no steps itself and has no generators
 * and no input object: the caller sets `input.target` from `update`'s answer and steps the movement (game/mind through game/game, the tests through
 * `stepPlayer`).
 *   - String pulling: the target is the furthest of the next STRING (4) route points, at most SIGHT (6 m) ahead, that is visible from where he stands
 *     by game/walk `segmentClear` (margin 0.04); the index never goes back. A route point is passed when he is within PASSED (0.3 m, less than one
 *     step) of it. There are no reach radii and no cell bans.
 *   - No progress: less than STALL_MOVE (0.15 m) in STALL_SECS (0.7 s) while not busy closes the blocked segment (the plan edge, or for a shortcut the
 *     points ahead that he could have pulled to, which are then no longer pulled to) and plans again from where he stands. After MAX_REPLANS (3) such stalls the route is
 *     'unreachable' (reason 'stuck'). No hand steering.
 *   - A change of the camp (the finder's `campKey`) is checked against the rest of the route only (one pass of segment tests); it replans only when a
 *     segment is closed now. A pile laid behind him costs nothing. A big displacement (more than DRIFT, 8 m from the next point) replans too.
 *
 * createRoute(finder, from, goal, { stop?, tap?, near?, maxExp? }) -> route
 *   finder    a game/path finder; goal { x, z }
 *   stop      (1) the distance to the goal at which a walk without tap is over; tap: the walk ends by the game consuming a tapped target, never by distance; near (0): with tap, a stall within this distance of the goal also ends it as arrived (without tap, a stall within ARRIVED, 0.15 m, does: movement takes less than 0.12 m for arrived)
 *   route.state       'going' | 'arrived' | 'unreachable';   route.reason  for 'unreachable': 'nopath' (no way at all, at the start or after a camp change) or 'stuck'
 *   route.update(player, dt, busy) -> { target: { x, z } | null, final (target is the goal itself), state, remaining (metres of route left), stalled (a stall was just handled that did not end the walk as arrived; 0.33.1) }
 *   route.pts, route.index, route.replans, route.stalls, route.closed   for the tests and the mind's statistics
 *
 * Pure; no DOM, no Three.js.
 *
 * Depends on: game/path (the finder given), game/walk (through the finder)
 */
export const STRING = 4, SIGHT = 6, PASSED = 0.3, STALL_SECS = 0.7, STALL_MOVE = 0.15, MAX_REPLANS = 3, DRIFT = 8, LOOK = 0.2, ARRIVED = 0.15;

export function createRoute(finder, from, goal, { stop = 1, tap = false, near = 0, maxExp } = {}) {
  const r = {
    state: 'going', reason: null, pts: [], index: 0, replans: 0, stalls: 0, drifts: 0, closed: new Set(), noShort: new Set(), update,
  };
  // r.index: the first route point not yet passed; aim: the point he walks to (r.index, or a later one he sees from here)
  let cum = [], key = null, aim = 0, lookAt = -1, t = 0, prog = { x: from.x, z: from.z, t: 0 };

  function plan(at) {
    const res = finder.find(at, goal, { maxExp, closed: r.closed });
    if (!res) return false;
    r.pts = res.pts; r.index = 0; aim = 0; lookAt = -1; cum = [0];
    for (let i = 1; i < r.pts.length; i++) cum.push(cum[i - 1] + Math.hypot(r.pts[i].x - r.pts[i - 1].x, r.pts[i].z - r.pts[i - 1].z));
    key = finder.campKey ? finder.campKey() : null;
    return true;
  }
  const dist = (p, q) => Math.hypot(q.x - p.x, q.z - p.z);
  const close = (u, v) => { r.closed.add(finder.edgeKey(u, v)); r.closed.add(finder.edgeKey(v, u)); };
  const fail = reason => { r.state = 'unreachable'; r.reason = reason; };
  const done = (stalled = false) => ({ target: null, final: false, state: r.state, remaining: 0, stalled });

  if (!plan(from)) fail('nopath');

  function restOpen(p) {   // the rest of the route against the camp as it is now
    let a = p;
    for (let i = r.index; i < r.pts.length; i++) { if (!finder.open(a, r.pts[i])) return false; a = r.pts[i]; }
    return true;
  }

  function blocked(p, d) {
    r.stalls++;
    if (d <= (tap ? near : ARRIVED)) { r.state = 'arrived'; return; }   // (the game itself takes less than 0.12 m for arrived: moveIntent)
    if (r.replans >= MAX_REPLANS) { fail('stuck'); return; }
    r.replans++;
    if (aim > r.index) { for (let j = r.index + 1; j <= Math.min(r.pts.length - 1, r.index + STRING); j++) r.noShort.add(r.pts[j].id); aim = r.index; lookAt = -1; return; }   // he was pulled to a point past the next: no shortcut from here again, the plan edge next
    const prev = r.index > 0 ? r.pts[r.index - 1].id : -1;   // START (-1): the first edge leaves the exact place he stood at
    close(prev, r.pts[r.index].id);
    if (!plan(p)) fail('stuck');
  }

  function update(p, dt, busy) {
    if (r.state !== 'going') return done();
    t += dt;
    const d = dist(p, goal);
    if (!tap && d <= stop) { r.state = 'arrived'; return done(); }
    let stalled = false;
    // the camp changed: look at the rest of the route
    const ck = finder.campKey ? finder.campKey() : null;
    if (ck !== key) {
      key = ck;
      if (!restOpen(p) && !plan(p)) { fail('nopath'); return done(); }
    }
    // no progress
    if (busy) prog = { x: p.x, z: p.z, t };
    else if (t - prog.t >= STALL_SECS) {
      if (dist(p, prog) < STALL_MOVE) {
        stalled = true; blocked(p, d); prog = { x: p.x, z: p.z, t };
        if (r.state !== 'going') return done(stalled && r.state !== 'arrived');   // 0.33.1: a stall that ended the walk as arrived (within ARRIVED or tap's near) is the walk's end, not a stuck one
      } else prog = { x: p.x, z: p.z, t };
    }
    // a big displacement: plan again (not a stall)
    if (dist(p, r.pts[r.index]) > DRIFT && r.drifts < 6) { r.drifts++; if (!plan(p)) { fail('nopath'); return done(stalled); } }
    // pass the points he is at, then pull the string
    const last = r.pts.length - 1, was = r.index;
    for (let j = Math.min(last - 1, r.index + STRING); j >= r.index; j--) if (dist(p, r.pts[j]) < PASSED) { r.index = j + 1; break; }
    if (aim < r.index) aim = r.index;
    if (r.index !== was || lookAt < 0 || t - lookAt >= LOOK) {
      lookAt = t; aim = r.index;
      for (let j = Math.min(last, r.index + STRING); j > r.index; j--) {
        const q = r.pts[j];
        if (r.noShort.has(q.id) || dist(p, q) > SIGHT) continue;
        if (finder.clear(p, q)) { aim = j; break; }
      }
    }
    const q = r.pts[aim];
    return { target: { x: q.x, z: q.z }, final: aim === last, state: 'going', remaining: cum[last] - cum[aim] + dist(p, q), stalled };
  }
  return r;
}
