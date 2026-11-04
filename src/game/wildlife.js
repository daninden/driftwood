/**
 * game/wildlife — crabs, fish and birds: atmosphere only (0.17 "Wildlife").
 *
 * The animals move and react to the castaway, but nothing can be done with
 * them. Nothing is saved. Where they live is fixed by the seed
 * (game/habitats); what they do runs here, from the time of day, the sea
 * level, the castaway's place and a seeded PRNG. Everything is alive only
 * within ALIVE (30 m) of him: nothing further away is updated or listed.
 *
 * Crabs (about 12 cm): out on the sand near their holes, with short sideways
 * runs. Within SCARE (3 m) they scuttle sideways to the nearest hole and
 * vanish into it; hidden, they come out again HIDE (10 to 20 s) after he has
 * been more than SAFE (5 m) away. More are out at low water (45 % of each
 * colony at high water, all of it at low water), and a crab whose hole the sea
 * covers is in it. Also at night.
 * Fish: groups in shallow river, lagoon and sea water (0.17.3); when he WADES within DART
 * (2 m) they dart off and fade in DART_TIME, stay away HIDE_FISH (8 to 16 s,
 * counted while he is further than 2.5 m) and come back slowly (BACK_TIME).
 * A fish jumps every JUMP_EVERY (30 to 90 s) just beyond the surf when the
 * sea is in view: a short arc (JUMP_TIME) with a splash where it goes in and
 * where it comes out (SPLASH_TIME).
 * Birds (white seabirds with grey wing tips): by day 2 to 4 circle high over
 * each stretch of coast, arriving at ARRIVE and leaving at LEAVE towards the
 * rocky shore; none at night. Every FLOCK_EVERY (150 to 300 s of play, the
 * first after 90 to 180 s) a flock of 5 to 8 glides down to the beach 10 to 20 m
 * from him, pecks about and, when one is within FLUSH (4 m), flies up, circles
 * and leaves; unbothered, it leaves after 60 to 120 s; in the evening it
 * leaves at once.
 *
 * createWildlife(world, { seed? }) -> wildlife
 *   wildlife.update(dt, { x, z, time, sea, wading?, asleep? })
 *     dt real seconds (at most 0.25 counts); time of day 0..1 (game/clock);
 *     sea the sea level (game/tide); wading: he stands in water
 *   wildlife.crabs()  -> [{ id, x, y, z, ang, a, moving }]   crabs above ground within ALIVE;
 *     ang: the angle (atan2(dz, dx)) of the body's long axis; a 0..1 how far out of the hole
 *   wildlife.hiding(x, z, reach) -> null | { id, x, z, d }   0.22: the nearest crab that fled into a hole within reach (d: distance to the hole) and is still hiding in it, with the hole's place
 *   wildlife.isHiding(id) -> true while crab id is still hiding in the hole it fled into
 *   wildlife.escape(id)   -> the crab ran out of the back of its hole: it stays hidden three times as long and is no longer there to dig for
 *   (update's ctx may carry gone(id) -> true for a crab that was caught and is out of its colony: it is not there)
 *   wildlife.holes()  -> [{ x, y, z }]   the crab holes within ALIVE that the sea does not cover (dark dots in the sand)
 *   wildlife.fish()   -> [{ id, kind, x, y, z, ang, a, len, ph }]   a 0..1 how visible
 *   wildlife.birds()  -> [{ id, mode: 'air' | 'ground', x, y, z, ang, pitch, bank, glide, ph }]
 *     y: the centre of the body (a standing bird: BIRD_H above the ground)
 *   wildlife.jump()   -> null | { x, y, z, ang, pitch, air, sea, splashes: [{ x, z, age }] }   air: the fish is in the air; age in seconds
 *   wildlife.callFlock() -> true when a flock starts to land (the timer does the same; for tests)
 *   wildlife.coloniesNear(x, z, r) -> [colony] (game/habitats)
 *   wildlife.flock    the flock now, or null (phase 'land' | 'ground' | 'up' | 'leave')
 *
 * Pure; no DOM, no Three.js.
 *
 * Depends on: core/noise, world/constants, game/habitats, game/tide
 */
import { mulberry32, hashInt } from '../core/noise.js';
import { HALF, T, NT } from '../world/constants.js';
import { RANGE } from './tide.js';
import { coloniesOfTile, fishOfTile, birdCell, CELL } from './habitats.js';

export const ALIVE = 30, SCARE = 3, SAFE = 5, HIDE = [10, 20], DART = 2, DART_TIME = 0.7, BACK_TIME = 4, HIDE_FISH = [8, 16], FISH_CLEAR = 2.5;
export const JUMP_EVERY = [30, 90], JUMP_TIME = 0.9, SPLASH_TIME = 0.9, FLOCK_EVERY = [150, 300], FLOCK_FIRST = [90, 180], FLOCK_DIST = [11.5, 18.5], FLUSH = 4;
export const ARRIVE = [0.2, 0.27], LEAVE = [0.69, 0.76], FLOCK_DAY = [0.27, 0.62], BIRD_H = 0.06;
const OUT_MIN = 0.45, CRAB_RUN = 0.7, CRAB_HOME = 0.9, CRAB_FLEE = 2.4;
const SKY_AWAY = 220;   // metres the circling birds go out along the way to the rocky shore while arriving and leaving

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const between = (r, [a, b]) => a + r() * (b - a);

export function createWildlife(w, { seed = w.seed } = {}) {
  const R = mulberry32(hashInt(seed | 0, 337, 1));
  const crabS = new Map(), fishS = new Map();
  let clock = 0, p = { x: 0, z: 0 }, time = 0.5, sea = 0, wading = false, asleep = false;
  let nextJump = between(R, JUMP_EVERY), jump = null, nextFlock = between(R, FLOCK_FIRST), flock = null;
  const out = { crabs: [], fish: [], birds: [], holes: [] };

  const tilesNear = m => {
    const out = [], x0 = Math.max(0, Math.floor((p.x - m + HALF) / T)), x1 = Math.min(NT - 1, Math.floor((p.x + m + HALF) / T));
    const z0 = Math.max(0, Math.floor((p.z - m + HALF) / T)), z1 = Math.min(NT - 1, Math.floor((p.z + m + HALF) / T));
    for (let tz = z0; tz <= z1; tz++) for (let tx = x0; tx <= x1; tx++) { const t = w.tiles[tz * NT + tx]; if (t) out.push(t); }
    return out;
  };
  const dist = (x, z) => Math.hypot(x - p.x, z - p.z);
  const sandOK = (x, z, margin = 0.04) => { const y = w.H(x, z); return y > sea + margin && y > -0.4 && w.Lat(x, z) < 0.5; };

  // ---- crabs
  function updateCrabs(dt, ctx0) {
    const frac = OUT_MIN + (1 - OUT_MIN) * clamp(-sea / RANGE, 0, 1), list = out.crabs, holes = out.holes; list.length = 0; holes.length = 0;
    for (const tile of tilesNear(ALIVE + 4)) for (const col of coloniesOfTile(w, tile)) {
      if (dist(col.x, col.z) > ALIVE + 4) continue;
      for (const h of col.holes) if (h.y > sea + 0.02 && dist(h.x, h.z) <= ALIVE) holes.push(h);
      for (const crab of col.crabs) {
        if (ctx0.gone && ctx0.gone(crab.id)) { crabS.delete(crab.id); continue; }   // caught (game/crabs): not there until it comes back
        const hole = col.holes[crab.hole], want = hole.y > sea + 0.05 && crab.u < frac;
        let s = crabS.get(crab.id);
        if (!s) {
          s = { mode: want ? 'out' : 'hidden', x: want ? crab.x : hole.x, z: want ? crab.z : hole.z, a: want ? 1 : 0, t: 1, need: 0, ang: crab.id * 2.1, run: false, tx: 0, tz: 0, speed: 0, r: mulberry32(hashInt(crab.id, 5, 227)), moving: false };
          s.need = between(s.r, HIDE); if (!want) s.t = s.need;
          crabS.set(crab.id, s);
        }
        const d = dist(s.x, s.z);
        if (d > ALIVE) continue;   // frozen, not drawn
        s.moving = false;
        const goTo = (x, z, v) => { const dx = x - s.x, dz = z - s.z, l = Math.hypot(dx, dz); if (l < 1e-6) return true; const st = Math.min(l, v * dt); s.x += dx / l * st; s.z += dz / l * st; s.ang = Math.atan2(dz, dx); s.moving = true; return st >= l - 1e-9; };
        if (s.mode === 'out') {
          const scared = d < SCARE;
          if (scared || !want) {   // to the nearest hole (or its own, when only the sea sends it home)
            let h = hole;
            if (scared) for (const q of col.holes) if (Math.hypot(q.x - s.x, q.z - s.z) < Math.hypot(h.x - s.x, h.z - s.z)) h = q;
            s.mode = 'home'; s.tx = h.x; s.tz = h.z; s.speed = scared ? CRAB_FLEE : CRAB_HOME; s.fled = scared; s.hole = h;
          } else {
            s.t -= dt;
            if (s.run) { if (goTo(s.tx, s.tz, CRAB_RUN)) { s.run = false; s.t = 1.2 + s.r() * 3.5; } else s.moving = true; }
            else if (s.t <= 0) {
              const a = s.r() * Math.PI * 2, l = 0.25 + s.r() * 0.5, tx = s.x + Math.cos(a) * l, tz = s.z + Math.sin(a) * l;
              if (Math.hypot(tx - hole.x, tz - hole.z) < 1.4 && sandOK(tx, tz)) { s.run = true; s.tx = tx; s.tz = tz; } else s.t = 0.3;
            }
          }
        }
        if (s.mode === 'home') {
          if (goTo(s.tx, s.tz, s.speed)) { s.mode = 'in'; s.run = false; }
        } else if (s.mode === 'in') {
          s.a -= dt / 0.25;
          if (s.a <= 0) { s.a = 0; s.mode = 'hidden'; s.t = 0; s.need = between(s.r, HIDE); s.x = s.tx; s.z = s.tz; }
        } else if (s.mode === 'hidden') {
          if (want && d > SAFE) s.t += dt;
          if (s.t >= s.need) { s.mode = 'emerge'; s.a = 0; s.fled = false; }
        } else if (s.mode === 'emerge') {
          if (d < SCARE) { s.mode = 'in'; s.tx = s.x; s.tz = s.z; }
          else { s.a += dt / 0.4; if (s.a >= 1) { s.a = 1; s.mode = 'out'; s.t = 1 + s.r() * 2; } }
        }
        if (s.a > 0.01) list.push({ id: crab.id, x: s.x, y: w.H(s.x, s.z), z: s.z, ang: s.ang, a: s.a, moving: s.moving });
      }
    }
  }

  // 0.22: a crab that fled into a hole and is still in it can be dug for
  const hidingIn = s => s.fled && (s.mode === 'in' || s.mode === 'hidden') && s.hole && s.hole.y > sea + 0.05;
  function hiding(x, z, reach) {
    let best = null;
    for (const [id, s] of crabS) {
      if (!hidingIn(s)) continue;
      const d = Math.hypot(s.hole.x - x, s.hole.z - z);
      if (d <= reach && (!best || d < best.d)) best = { id, x: s.hole.x, z: s.hole.z, d };
    }
    return best;
  }
  const isHiding = id => { const s = crabS.get(id); return !!s && hidingIn(s); };
  function escape(id) {
    const s = crabS.get(id); if (!s) return;
    s.fled = false; s.mode = 'hidden'; s.t = 0; s.need = between(s.r, HIDE) * 3;
  }

  // ---- fish
  const fishPos = (g, f, s) => {   // where a fish is now: its place in the group, a little drift, and how far it has darted
    let ox = f.ox, oz = f.oz;
    if (g.kind === 'river') ox += Math.sin(clock * 0.6 + f.ph) * 0.1;
    else { ox += Math.cos(clock * 0.25 + f.ph) * 0.4; oz += Math.sin(clock * 0.25 + f.ph) * 0.4; }
    const c = Math.cos(g.dir), n = Math.sin(g.dir), o = s && s.off.get(f);
    const x = g.kind === 'river' ? c * ox - n * oz : ox, z = g.kind === 'river' ? n * ox + c * oz : oz;
    return { x: g.x + x + (o ? o.x : 0), z: g.z + z + (o ? o.z : 0) };
  };
  function updateFish(dt) {
    const list = out.fish; list.length = 0;
    for (const tile of tilesNear(ALIVE + 4)) for (const g of fishOfTile(w, tile)) {
      if (dist(g.x, g.z) > ALIVE + 4) continue;
      let s = fishS.get(g.id);
      if (!s) { s = { mode: 'idle', a: 1, t: 0, need: 0, off: new Map(), vel: new Map(), r: mulberry32(hashInt(g.id, 7, 229)) }; fishS.set(g.id, s); }
      const level = g.kind === 'river' ? g.lw : sea, near = Math.min(...g.fish.map(f => { const q = fishPos(g, f, s); return dist(q.x, q.z); }));
      if (near > ALIVE) continue;
      if ((s.mode === 'idle' || s.mode === 'back') && wading && near < DART) {
        s.mode = 'dart'; s.t = 0;
        for (const f of g.fish) {
          const q = fishPos(g, f, s), dx = q.x - p.x, dz = q.z - p.z, l = Math.hypot(dx, dz) || 1;
          if (g.kind === 'river') { const sg = (dx * Math.cos(g.dir) + dz * Math.sin(g.dir)) >= 0 ? 1 : -1; s.vel.set(f, { x: Math.cos(g.dir) * sg * 4.5, z: Math.sin(g.dir) * sg * 4.5 }); }
          else s.vel.set(f, { x: dx / l * 4.5 + (s.r() - 0.5) * 2, z: dz / l * 4.5 + (s.r() - 0.5) * 2 });
        }
      }
      if (s.mode === 'dart') {
        s.t += dt; s.a = Math.max(0, s.a - dt / DART_TIME);
        for (const f of g.fish) { const v = s.vel.get(f), o = s.off.get(f) || { x: 0, z: 0 }; o.x += v.x * dt; o.z += v.z * dt; s.off.set(f, o); }
        if (s.a <= 0) { s.mode = 'gone'; s.t = 0; s.need = between(s.r, HIDE_FISH); }
      } else if (s.mode === 'gone') {
        if (near > FISH_CLEAR) s.t += dt;
        if (s.t >= s.need) { s.mode = 'back'; s.off.clear(); s.t = 0; }
      } else if (s.mode === 'back') {
        s.t += dt; s.a = Math.min(1, s.t / BACK_TIME); if (s.a >= 1) s.mode = 'idle';
      }
      if (s.a <= 0.02) continue;
      for (const f of g.fish) {
        const q = fishPos(g, f, s), d = dist(q.x, q.z);
        if (d > ALIVE) continue;
        const depth = level - w.H(q.x, q.z);
        if (depth < (g.kind === 'river' ? 0.1 : 0.12)) continue;   // a sandbank at low water, or a bank
        const v = s.vel.get(f), moving = s.mode === 'dart' && v;
        const ang = moving ? Math.atan2(v.z, v.x) : g.kind === 'river' ? g.dir : g.dir + clock * 0.25 + f.ph + Math.PI / 2;
        list.push({ id: g.id * 8 + g.fish.indexOf(f), kind: g.kind, x: q.x, y: level + 0.03, z: q.z, ang, a: s.a, len: f.len, ph: f.ph });
      }
    }
  }

  // ---- the jumping fish
  function startJump() {
    for (let i = 0; i < 40; i++) {   // a spot just beyond the surf (0.9 to 1.7 m deep), 6 to 28 m away
      const a = R() * Math.PI * 2, d = 6 + R() * 22, x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d, y = w.H(x, z);
      if (y < -0.9 && y > -1.7 && w.Lat(x, z) < 0) {
        const ang = R() * Math.PI * 2, len = 1.0 + R() * 0.5;
        jump = { x0: x, z0: z, x1: x + Math.cos(ang) * len, z1: z + Math.sin(ang) * len, ang, h: 0.45 + R() * 0.25, t: 0 };
        return true;
      }
    }
    return false;
  }
  function updateJump(dt) {
    if (jump) { jump.t += dt; if (jump.t > JUMP_TIME + SPLASH_TIME) jump = null; return; }
    nextJump -= dt;
    if (nextJump <= 0) nextJump = startJump() ? between(R, JUMP_EVERY) : 8;
  }

  // ---- birds
  const presence = t => t < ARRIVE[0] || t >= LEAVE[1] ? null : t < ARRIVE[1] ? 1 - (t - ARRIVE[0]) / (ARRIVE[1] - ARRIVE[0]) : t < LEAVE[0] ? 0 : (t - LEAVE[0]) / (LEAVE[1] - LEAVE[0]);   // null: none; else how far out along the way to the rock (1 .. 0 .. 1)
  function circling(list) {
    const f = presence(time); if (f === null) return;
    const cx0 = Math.floor((p.x - 45 + HALF) / CELL), cx1 = Math.floor((p.x + 45 + HALF) / CELL), cz0 = Math.floor((p.z - 45 + HALF) / CELL), cz1 = Math.floor((p.z + 45 + HALF) / CELL);
    for (let cz = Math.max(0, cz0); cz <= cz1; cz++) for (let cx = Math.max(0, cx0); cx <= cx1; cx++) {
      const c = birdCell(w, cx, cz); if (!c) continue;
      for (let j = 0; j < c.n; j++) {
        const th = c.ph + c.omega * clock + j * 2 * Math.PI / c.n, rr = c.r * (1 + 0.12 * Math.sin(j * 3 + 1)), s = Math.sign(c.omega);
        const x = c.x + Math.cos(th) * rr + c.away.x * f * SKY_AWAY, z = c.z + Math.sin(th) * rr + c.away.z * f * SKY_AWAY, y = c.alt + Math.sin(j * 1.7 + c.ph) * 1.2 + f * 10;
        if (dist(x, z) > ALIVE) continue;
        list.push({ id: 3000000 + c.id * 8 + j, mode: 'air', x, y, z, ang: th + s * Math.PI / 2, pitch: 0, bank: -s * 0.35, glide: 0.85, ph: j * 1.9 + c.ph });
      }
    }
  }

  function pickSite() {   // dry sand, 10 to 20 m away: a flat patch (the middle and most of four more spots round it)
    const good = (x, z) => { const y = w.H(x, z); return y > Math.max(0.1, sea + 0.1) && y < 1.3 && w.Lat(x, z) < 0.35 && w.slope(x, z) < 0.4 && w.dryOfRiver(x, z, 1.5); };
    for (let i = 0; i < 80; i++) {
      const a = R() * Math.PI * 2, d = between(R, FLOCK_DIST), x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
      if (good(x, z) && [[1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]].filter(([dx, dz]) => good(x + dx, z + dz)).length >= 3) return { x, z };
    }
    return null;
  }
  function awayFrom(x, z) {
    const cell = birdCell(w, Math.floor((x + HALF) / CELL), Math.floor((z + HALF) / CELL));
    if (cell) return cell.away;
    const a = R() * Math.PI * 2; return { x: Math.cos(a), z: Math.sin(a) };
  }
  function callFlock() {
    if (flock) return false;
    const site = pickSite(); if (!site) return false;
    const n = 5 + Math.floor(R() * 4), away = awayFrom(site.x, site.z), birds = [], from = R() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      let tx = site.x, tz = site.z;
      for (let k = 0; k < 12; k++) {   // scattered over the sand, each on its own spot and not on top of another bird
        const a = R() * Math.PI * 2, d = Math.sqrt(R()) * 1.5, x = site.x + Math.cos(a) * d, z = site.z + Math.sin(a) * d;
        if (w.H(x, z) > Math.max(0.05, sea + 0.05) && w.slope(x, z) < 0.5 && w.dryOfRiver(x, z, 1.2) && !birds.some(o => Math.hypot(o.tx - x, o.tz - z) < 0.55)) { tx = x; tz = z; break; }
      }
      const a = from + (R() - 0.5) * 0.9, d = 24 + R() * 8;
      birds.push({ id: 4000000 + i, x: site.x + Math.cos(a) * d, z: site.z + Math.sin(a) * d, y: 10 + R() * 4, sx: 0, sz: 0, sy: 0, tx, tz, u: -R() * 1.6, dur: 4 + R() * 2.5, ang: 0, pitch: 0, mode: 'glide', mt: 0, ph: R() * 6.28, speed: 0, turn: 0, climb: 0, alt: 0, delay: 0, peck: 0, walk: null });
      const b = birds[i]; b.sx = b.x; b.sz = b.z; b.sy = b.y; b.ang = Math.atan2(tz - b.z, tx - b.x);
    }
    flock = { phase: 'land', t: 0, stay: between(R, [60, 120]), site, away, birds };
    return true;
  }
  const groundOf = (x, z) => w.H(x, z) + BIRD_H;
  function takeOff() {
    flock.phase = 'up'; flock.t = 0;
    for (const b of flock.birds) {
      const away = Math.atan2(b.z - p.z, b.x - p.x);
      b.mode = 'fly'; b.delay = R() * 0.5; b.ang = away + (R() - 0.5) * 2; b.speed = 3 + R() * 2; b.climb = 2.6 + R() * 1.4; b.alt = Math.max(b.y - groundOf(b.x, b.z), 0) + 7 + R() * 5; b.turn = (R() < 0.5 ? -1 : 1) * (0.4 + R() * 0.3); b.pitch = 0.25;
    }
  }
  function updateFlock(dt) {
    const f = flock, day = time >= ARRIVE[1] && time < LEAVE[0];
    f.t += dt;
    if (!f.birds.some(b => dist(b.x, b.z) < ALIVE + 10)) { flock = null; nextFlock = between(R, FLOCK_EVERY); return; }   // out of reach: it simply is not there any more
    if (f.phase === 'land') {
      let all = true;
      for (const b of f.birds) {
        b.u += dt / b.dur;
        if (b.u < 0) { all = false; b.x = b.sx; b.z = b.sz; continue; }
        if (b.mode === 'glide') {
          const u = Math.min(1, b.u), e = u * u * (3 - 2 * u), px = b.x, pz = b.z, py = b.y;
          b.x = b.sx + (b.tx - b.sx) * e; b.z = b.sz + (b.tz - b.sz) * e; b.y = groundOf(b.tx, b.tz) + (b.sy - groundOf(b.tx, b.tz)) * (1 - u) * (1 - u);
          const ds = Math.hypot(b.x - px, b.z - pz) || 1e-6;
          b.pitch = u > 0.85 ? 0.5 : clamp(Math.atan2(b.y - py, ds), -0.5, 0.2);
          if (u >= 1) { b.mode = 'look'; b.mt = 0.5 + R() * 1.5; b.pitch = 0; b.y = groundOf(b.x, b.z); }
        }
        if (b.mode === 'glide') all = false;
      }
      if (all) { f.phase = 'ground'; f.t = 0; }
    } else if (f.phase === 'ground') {
      for (const b of f.birds) {
        b.mt -= dt;
        if (b.mode === 'walk') {
          const dx = b.walk.x - b.x, dz = b.walk.z - b.z, l = Math.hypot(dx, dz), st = Math.min(l, 0.5 * dt);
          if (l > 1e-6) { b.x += dx / l * st; b.z += dz / l * st; b.ang = Math.atan2(dz, dx); }
          b.y = groundOf(b.x, b.z); b.pitch = 0.1;
        } else if (b.mode === 'peck') { b.peck += dt; b.pitch = -0.9 * Math.max(0, Math.sin(b.peck * 9)); }
        else b.pitch = 0.2;
        if (b.mt <= 0) {
          const r = R();
          if (r < 0.45) { b.mode = 'peck'; b.mt = 1 + R() * 2; b.peck = 0; }
          else if (r < 0.75) {
            const a = R() * Math.PI * 2, d = 0.3 + R() * 0.7, x = b.x + Math.cos(a) * d, z = b.z + Math.sin(a) * d;
            if (Math.hypot(x - f.site.x, z - f.site.z) < 1.6 && w.H(x, z) > Math.max(0.05, sea + 0.05) && w.dryOfRiver(x, z, 1.2)) { b.mode = 'walk'; b.walk = { x, z }; b.mt = d / 0.5; } else { b.mode = 'look'; b.mt = 0.5; }
          } else { b.mode = 'look'; b.mt = 1 + R() * 2; b.ang += (R() - 0.5) * 1.5; }
        }
      }
      if (f.birds.some(b => dist(b.x, b.z) < FLUSH) || f.t > f.stay || !day) takeOff();
    } else if (f.phase === 'up' || f.phase === 'leave') {
      const target = Math.atan2(f.away.z, f.away.x), leaving = f.phase === 'leave';
      for (const b of f.birds) {
        if (b.delay > 0) { b.delay -= dt; continue; }
        if (leaving) { let d = target - b.ang; d = Math.atan2(Math.sin(d), Math.cos(d)); b.ang += clamp(d, -1, 1) * Math.min(1, dt * 1.2); b.speed = Math.min(6.5, b.speed + dt * 1.5); }
        else b.ang += b.turn * dt;
        b.x += Math.cos(b.ang) * b.speed * dt; b.z += Math.sin(b.ang) * b.speed * dt;
        const ceil = groundOf(b.x, b.z) + b.alt;
        if (b.y < ceil) { b.y = Math.min(ceil, b.y + b.climb * dt); b.pitch = 0.4; } else b.pitch = 0.05;
        if (leaving) b.y += dt * 0.6;
        b.mode = 'fly';
      }
      if (f.phase === 'up' && f.t > 4.5) { f.phase = 'leave'; f.t = 0; }
      else if (leaving && (f.t > 20 || f.birds.every(b => dist(b.x, b.z) > ALIVE + 10))) { flock = null; nextFlock = between(R, FLOCK_EVERY); }
    }
  }
  function flockBirds(list) {
    if (!flock) return;
    for (const b of flock.birds) {
      if (b.u < 0 && flock.phase === 'land') continue;
      if (dist(b.x, b.z) > ALIVE) continue;
      const air = b.mode === 'glide' || b.mode === 'fly';
      list.push({ id: b.id, mode: air ? 'air' : 'ground', x: b.x, y: b.y, z: b.z, ang: b.ang, pitch: b.pitch, bank: air && flock.phase !== 'land' ? 0.2 * Math.sign(b.turn || 1) : 0, glide: flock.phase === 'land' ? 0.7 : 0.1, ph: b.ph });
    }
  }

  function update(dt, ctx) {
    dt = clamp(dt, 0, 0.25);
    clock += dt; p = { x: ctx.x, z: ctx.z }; time = ctx.time; sea = ctx.sea || 0; wading = !!ctx.wading; asleep = !!ctx.asleep;
    updateCrabs(dt, ctx); updateFish(dt); updateJump(dt);
    if (flock) updateFlock(dt);
    else if (!asleep && time >= FLOCK_DAY[0] && time < FLOCK_DAY[1]) { nextFlock -= dt; if (nextFlock <= 0) { if (!callFlock()) nextFlock = 15; } }
    const birds = out.birds; birds.length = 0; circling(birds); flockBirds(birds);
  }

  function jumpView() {
    if (!jump) return null;
    const u = clamp(jump.t / JUMP_TIME, 0, 1), splashes = [], y = sea;
    if (jump.t < SPLASH_TIME) splashes.push({ x: jump.x0, z: jump.z0, age: jump.t });
    if (jump.t >= JUMP_TIME) splashes.push({ x: jump.x1, z: jump.z1, age: jump.t - JUMP_TIME });
    if (jump.t < JUMP_TIME && dist(jump.x0, jump.z0) > ALIVE) return null;
    const air = jump.t < JUMP_TIME, rise = 4 * jump.h * (1 - 2 * u);   // the slope of the arc
    return { x: jump.x0 + (jump.x1 - jump.x0) * u, y: y + 4 * jump.h * u * (1 - u), z: jump.z0 + (jump.z1 - jump.z0) * u, ang: jump.ang, pitch: air ? Math.atan2(rise, Math.hypot(jump.x1 - jump.x0, jump.z1 - jump.z0)) : 0, air, sea: y, splashes };
  }
  function coloniesNear(x, z, r) {
    const res = [], x0 = Math.max(0, Math.floor((x - r + HALF) / T)), x1 = Math.min(NT - 1, Math.floor((x + r + HALF) / T)), z0 = Math.max(0, Math.floor((z - r + HALF) / T)), z1 = Math.min(NT - 1, Math.floor((z + r + HALF) / T));
    for (let tz = z0; tz <= z1; tz++) for (let tx = x0; tx <= x1; tx++) { const t = w.tiles[tz * NT + tx]; if (t) for (const c of coloniesOfTile(w, t)) if (Math.hypot(c.x - x, c.z - z) <= r) res.push(c); }
    return res;
  }

  return { update, hiding, isHiding, escape, crabs: () => out.crabs, holes: () => out.holes, fish: () => out.fish, birds: () => out.birds, jump: jumpView, callFlock, coloniesNear, get flock() { return flock; } };
}
