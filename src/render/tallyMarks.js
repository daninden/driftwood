/**
 * render/tallyMarks — tally marks in ink above a pile of wood and above a fire,
 * while the castaway stands beside it (0.12).
 *
 * Journal style, in the ink of the other marks (`--ink`, pale at night,
 * render/ink): strokes in groups of five, four upright strokes with a diagonal
 * fifth across them, each stroke a little off the true. A pile (game/wood)
 * shows one stroke per piece, up to PILE_MAX (12), with a double line under
 * it when it is full. A fire (game/fire) shows the pieces still on it, up to
 * 8 (FUEL_MAX), with a double line under at 8; a half-burnt piece is a short
 * stroke after the whole ones; embers get none. No numbers, no frame.
 *
 * The marks are small SVG drawings in a layer over the picture, projected
 * from a point above the pile or fire. They fade in over FADE_IN seconds when
 * he comes within BESIDE of the middle of it and fade out over FADE_OUT when
 * he walks away (or the pile is gone). Nothing is drawn while no pile or fire
 * is near him.
 *
 * BESIDE, FADE_IN, FADE_OUT
 * tallyDrawing(count, part, full) -> { width, height, d }   the strokes as SVG path
 *   data in a box of width × height units: count whole strokes, part: a short
 *   stroke after them, full: the double line under. Pure.
 * fireTally(fuel) -> { count, part, full }   the strokes for a fire holding
 *   fuel (days of burning, game/fire): count whole pieces, part a half-burnt
 *   piece, full at 8. Pure.
 * pileTally(pile) -> { count, part, full }   the strokes for a pile. Pure.
 * createTallyView(container) -> { update(dt, { game, camera, H, player }) }
 *   container: the element the layer goes into (the island view's container).
 *   Touches the DOM only when a drawing or a position (to half a pixel) changes.
 *
 * Depends on: three, game/wood (PILE_MAX), game/fire (BURN, FUEL_MAX)
 */
import * as THREE from 'three';
import { PILE_MAX } from '../game/wood.js';
import { BURN, FUEL_MAX } from '../game/fire.js';

export const BESIDE = 1.8;       // how close to the middle of a pile or fire counts as beside it (F reaches 1.2 from his feet, plus the reach of a pile)
export const FADE_IN = 0.35, FADE_OUT = 0.6;
const FIRE_MAX = Math.round(FUEL_MAX / BURN);
const SIZE = 2.1;                // pixels per drawing unit
const H = 12, GAP = 4, GROUP = 4 * GAP + 7;   // stroke height, spacing, width of a group with its gap

const jit = (i, k) => Math.sin(i * 12.9898 + k * 78.233) * 0.5;   // -0.5 .. 0.5, fixed per stroke

export function tallyDrawing(count, part = false, full = false) {
  const n = Math.max(0, Math.floor(count)), seg = [];
  const up = (x, i, h = H) => { const j = jit(i, 1), k = jit(i, 2); seg.push(`M${(x + j).toFixed(1)} ${(H + 1 - h + k * 0.6).toFixed(1)}L${(x + j * 0.4 + 0.3).toFixed(1)} ${(H + 1 + k * 0.4).toFixed(1)}`); };
  let right = 0;
  for (let g = 0; g * 5 < n; g++) {
    const x0 = 1 + g * GROUP, here = Math.min(5, n - g * 5);
    for (let s = 0; s < Math.min(4, here); s++) up(x0 + s * GAP, g * 5 + s);
    if (here === 5) { seg.push(`M${(x0 - 2).toFixed(1)} ${(H - 1.5).toFixed(1)}L${(x0 + 4 * GAP + 2).toFixed(1)} ${(2.5).toFixed(1)}`); }
    right = x0 + (Math.min(4, here) - 1) * GAP;
    if (here === 5) right = x0 + 4 * GAP + 2;
  }
  if (part) {
    const g = Math.floor(n / 5), r = n % 5, x = n === 0 ? 1 : 1 + g * GROUP + r * GAP;
    up(x, n + 40, H * 0.5); right = x;
  }
  const width = right + 3;
  if (full) {
    seg.push(`M-1 ${H + 4}L${(width + 1).toFixed(1)} ${(H + 3.4).toFixed(1)}`, `M0.5 ${H + 6.6}L${(width - 0.5).toFixed(1)} ${(H + 6.2).toFixed(1)}`);
  }
  return { width, height: H + (full ? 8 : 3), d: seg.join('') };
}

export const pileTally = pile => ({ count: Math.min(pile.logs.length, PILE_MAX), part: false, full: pile.logs.length >= PILE_MAX });

export function fireTally(fuel) {
  if (!(fuel > 0)) return { count: 0, part: false, full: false };
  const pieces = Math.min(FIRE_MAX, fuel / BURN), count = Math.min(FIRE_MAX, Math.floor(pieces + 0.05));
  return { count, part: pieces - count > 0.1, full: count >= FIRE_MAX };
}

export function createTallyView(container) {
  const layer = document.createElement('div');
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;overflow:hidden;';
  layer.setAttribute('aria-hidden', 'true');
  container.appendChild(layer);
  const marks = new Map();   // pile or fire -> { el, path, key, alpha, x, y, z, shown, pos }
  const v = new THREE.Vector3();

  function make() {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg'), path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    el.style.cssText = 'position:absolute;left:0;top:0;overflow:visible;opacity:0;will-change:transform;';
    path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'var(--ink)'); path.setAttribute('stroke-width', '1.5');
    path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-linejoin', 'round');
    el.appendChild(path); layer.appendChild(el);
    return { el, path, key: '', alpha: 0, x: 0, y: 0, z: 0, w: 0, h: 0, shown: '', pos: '' };
  }

  function update(dt, { game, camera, H: ground, player }) {
    const want = new Map();   // thing -> { x, y, z, tally }
    for (const p of game.wood.piles) {
      const near = Math.hypot(p.x - player.x, p.z - player.z) <= BESIDE;
      want.set(p, { near, x: p.x, z: p.z, up: 0.55 + Math.ceil(p.logs.length / 2) * 0.19, tally: pileTally(p) });
    }
    for (const f of game.fire.fires) {
      const near = Math.hypot(f.x - player.x, f.z - player.z) <= BESIDE;
      want.set(f, { near, x: f.x, z: f.z, up: 1.45, tally: fireTally(f.fuel) });
    }
    for (const [thing, w] of want) {
      if (!w.near && !marks.has(thing)) continue;
      let m = marks.get(thing); if (!m) { m = make(); marks.set(thing, m); }
      m.x = w.x; m.z = w.z; m.y = ground(w.x, w.z) + w.up;
      const t = w.tally, key = t.count + ':' + t.part + ':' + t.full;
      if (key !== m.key) {
        m.key = key;
        const d = tallyDrawing(t.count, t.part, t.full);
        m.path.setAttribute('d', d.d); m.w = d.width * SIZE; m.h = d.height * SIZE;
        m.el.setAttribute('width', m.w.toFixed(1)); m.el.setAttribute('height', m.h.toFixed(1)); m.el.setAttribute('viewBox', `0 0 ${d.width.toFixed(1)} ${d.height.toFixed(1)}`);
        m.empty = t.count === 0 && !t.part;
      }
      m.target = w.near && !m.empty ? 1 : 0;
    }
    const rc = layer.getBoundingClientRect();
    for (const [thing, m] of marks) {
      if (!want.has(thing)) m.target = 0;
      const step = dt / (m.target > m.alpha ? FADE_IN : FADE_OUT);
      m.alpha = m.target > m.alpha ? Math.min(m.target, m.alpha + step) : Math.max(m.target, m.alpha - step);
      if (m.alpha <= 0 && m.target === 0) { layer.removeChild(m.el); marks.delete(thing); continue; }   // faded out: gone until he comes near again
      const o = m.alpha.toFixed(2);
      if (o !== m.shown) { m.shown = o; m.el.style.opacity = o; m.el.style.visibility = m.alpha > 0 ? 'visible' : 'hidden'; }
      if (m.alpha <= 0) continue;
      v.set(m.x, m.y, m.z).project(camera);
      const sx = (v.x + 1) / 2 * rc.width - m.w / 2, sy = (1 - v.y) / 2 * rc.height - m.h, pos = `translate(${Math.round(sx * 2) / 2}px,${Math.round(sy * 2) / 2}px)`;
      if (pos !== m.pos) { m.pos = pos; m.el.style.transform = pos; }
    }
  }
  return { update };
}
