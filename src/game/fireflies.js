/**
 * game/fireflies — small lights that drift in the dark (0.17.4 "Fireflies"):
 * atmosphere only, not saved, no interaction beyond keeping out of his way.
 *
 * Where they live is fixed by the seed (game/habitats firefliesOfTile: groups of
 * 10 to 30 at forest edges and along rivers in the lowland and rain forest).
 * When: from dusk to an hour before sunrise (activity(time), fading in and out
 * at the edges), none by day. Only fireflies within ALIVE (30 m) of him are
 * worked out or listed.
 *
 * Each drifts in its own slow loop (0.3 to 2 m above the ground, up to about
 * 1 m sideways), blinks slowly in its own rhythm (blink: about 1.6 s of light
 * every 3 to 6 s, a faint glow in between) and, now and then, a few of a group
 * flash together (flash: every 30 to 70 s, about a third of the group, 1.2 s).
 * Within AVOID (3 m) of him a firefly drifts aside (away from him, at most
 * PUSH_MAX m) and, once he has gone, drifts back (BACK_TAU seconds).
 *
 * The sunset and sunrise below are those of render/sky (game does not import
 * render): the fireflies come out a little after SUNSET and go an hour
 * (1/24 day) before SUNRISE.
 *
 * ALIVE, AVOID, PUSH_MAX, BACK_TAU, FADE_IN, FADE_OUT, FLOOR
 * activity(time) -> 0..1   how awake the fireflies are at that time of day
 * blink(t, f) -> 0..1      the light of one firefly of a group at time t (seconds)
 * flash(t, g, f) -> 0..1   the synchronized flash of group g for firefly f
 * createFireflies(world) -> fireflies
 *   fireflies.update(dt, { x, z, time })   dt real seconds (at most 0.25 counts)
 *   fireflies.list() -> [{ id, x, y, z, glow }]   within ALIVE, glow 0..1 (blink or flash, times activity)
 *   fireflies.active -> activity now;  fireflies.groupsNear(x, z, r) -> [group] (game/habitats)
 *
 * Pure; no DOM, no Three.js.
 *
 * Depends on: world/constants, game/habitats
 */
import { HALF, T, NT } from '../world/constants.js';
import { firefliesOfTile } from './habitats.js';

export const ALIVE = 30, AVOID = 3, PUSH_MAX = 3.5, PUSH_SPEED = 2.2, BACK_TAU = 3, FLOOR = 0.1;
export const FADE_IN = [0.825, 0.865], FADE_OUT = [1.0933, 1.1333];   // evening of one day to morning of the next (time + 1)
const ON = 1.6, FLASH_LEN = 1.2, FLASH_SHARE = 0.35;
const hump = u => u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u) ** 2;
const ss = (a, b, x) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };

/** 0 by day, 1 at night: in from dusk, out an hour before sunrise. */
export function activity(time) {
  const n = time < 0.5 ? time + 1 : time;
  return ss(FADE_IN[0], FADE_IN[1], n) * (1 - ss(FADE_OUT[0], FADE_OUT[1], n));
}

/** The slow blink of one firefly: a soft hump of light ON seconds long every `period`, a faint glow between. */
export function blink(t, f) {
  const u = (t / f.period + f.bph) % 1;
  return FLOOR + (1 - FLOOR) * hump(u * f.period / ON);
}

/** The flash that a third of a group shares, every sync.period seconds. */
export function flash(t, g, f) {
  if (f.sk > FLASH_SHARE) return 0;
  const u = ((t + g.sync.off) % g.sync.period) / FLASH_LEN;
  return hump(u);
}

export function createFireflies(w) {
  let t = 0, act = 0;
  const offs = new Map(), out = [];
  const tilesNear = (x, z, m) => {
    const res = [], x0 = Math.max(0, Math.floor((x - m + HALF) / T)), x1 = Math.min(NT - 1, Math.floor((x + m + HALF) / T));
    const z0 = Math.max(0, Math.floor((z - m + HALF) / T)), z1 = Math.min(NT - 1, Math.floor((z + m + HALF) / T));
    for (let tz = z0; tz <= z1; tz++) for (let tx = x0; tx <= x1; tx++) { const tile = w.tiles[tz * NT + tx]; if (tile) res.push(tile); }
    return res;
  };
  function groupsNear(x, z, r) {
    const res = [];
    for (const tile of tilesNear(x, z, r + 8)) for (const g of firefliesOfTile(w, tile)) if (Math.hypot(g.x - x, g.z - z) <= r + g.r) res.push(g);
    return res;
  }
  function update(dt, ctx) {
    dt = Math.min(dt, 0.25); t += dt; act = activity(ctx.time); out.length = 0;
    if (act <= 0.002) { offs.clear(); return; }
    const seen = new Set();
    for (const g of groupsNear(ctx.x, ctx.z, ALIVE)) for (const f of g.flies) {
      const hx = f.x + f.dx * Math.sin(f.wx * t + f.px), hz = f.z + f.dz * Math.sin(f.wz * t + f.pz);
      let o = offs.get(f.id); if (!o) { o = { x: 0, z: 0 }; offs.set(f.id, o); }
      // keeping out of his way: pushed away from him inside AVOID, drifting back afterwards
      const ex = hx + o.x - ctx.x, ez = hz + o.z - ctx.z, d = Math.hypot(ex, ez);
      if (d < AVOID) {
        const k = PUSH_SPEED * dt * (1 - d / AVOID + 0.3) / (d || 1), ux = d > 1e-6 ? ex : Math.cos(f.px), uz = d > 1e-6 ? ez : Math.sin(f.px);
        o.x += ux * k; o.z += uz * k;
        const m = Math.hypot(o.x, o.z); if (m > PUSH_MAX) { o.x *= PUSH_MAX / m; o.z *= PUSH_MAX / m; }
      } else { const e = Math.exp(-dt / BACK_TAU); o.x *= e; o.z *= e; if (Math.abs(o.x) + Math.abs(o.z) < 1e-3) { o.x = 0; o.z = 0; } }
      const x = hx + o.x, z = hz + o.z;
      if (Math.hypot(x - ctx.x, z - ctx.z) > ALIVE) continue;
      seen.add(f.id);
      const y = Math.max(w.H(x, z), f.y) + f.h + f.ha * Math.sin(f.hw * t + f.hp);
      out.push({ id: f.id, x, y, z, glow: Math.max(blink(t, f), flash(t, g, f)) * act });
    }
    for (const id of offs.keys()) if (!seen.has(id)) offs.delete(id);
  }
  return { update, list: () => out, get active() { return act; }, groupsNear };
}
