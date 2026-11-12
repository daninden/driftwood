/**
 * render/gestureMark — the same small ink drawings as the marks at the bottom, shown for a moment above the castaway (0.34 "Gestures").
 *
 * Most of what he does is a short stoop or a kneel, and at the usual camera only the marks at the bottom-left change, which the eye does not
 * follow. So every time one of those marks changes (what he carries: wood, branches, fronds, stones, fibre, crabs, fish, berries, a banana
 * bunch, nuts, shells; the drop of thirst when he drinks; the half coconut of hunger when he eats) the drawing of it appears over his head,
 * in the ink of the marks (`--ink`, glow `--halo`, index.html, render/ink), the same paths (render/carryMark DRAWINGS, DROP_PATH of
 * render/thirstMark, SHELL_PATH and RIM_PATH of render/hungerMark), a constant size on screen whatever the zoom, and follows him as the camera
 * moves. It fades in at the start of the action and out shortly after its end. Two or three that change together stand side by side (smaller).
 * During the kneeling works whose result is sure (eating a nut, drinking, filling a shell, roasting, making a spear or an axe) the drawing is
 * there from the start of the work, not only when the mark changes at its end. No icon while he sleeps; no sound; no text. Actions with a lasting
 * visible result (building, the fire, felling, fishing, resting) get no icon of their own, only the marks that change with them.
 *
 * Pure part (tested):
 * GESTURE_MAX                   at most this many drawings at once (3)
 * GESTURE_IN, GESTURE_HOLD, GESTURE_OUT   seconds: fade in, held clear after the last change or the end of the work, fade out (about 1.45 s after the change)
 * gestureState(game, out?) -> state   the counts of carryState plus `thirst` and `hunger` (days), written into out so a frame makes no garbage
 * changedKeys(prev, cur) -> [key]   the drawings for what changed between two states: a carried count differs (carryMark ITEMS order),
 *   `drop` when thirst fell (he drank), `half` when hunger fell (he ate); needs first when more than GESTURE_MAX changed. Pure.
 * workKeys(work) -> [key]       the drawings shown from the start of a kneeling work (player.work); [] for the rest. Pure.
 * gestureOpacity(born, seen, now) -> 0..1   opacity of a drawing first shown at `born`, last asked for at `seen`. Pure.
 * createGestures() -> { update(state, work, asleep, now) -> [{ key, opacity }] }   which drawings show now and how clearly; no DOM, so it is tested alone
 * createGestureMark(container) -> { update(state, work, asleep, now, player, camera) }   the DOM part: a `.gesture` box in `container`, moved to
 *   the head's screen position (render/screenRect) and its drawings' opacity changed only when the step changed
 *
 * Depends on: three, render/carryMark, render/thirstMark, render/hungerMark, render/screenRect, core/math
 */
import * as THREE from 'three';
import { ss } from '../core/math.js';
import { ITEMS, DRAWINGS, carryState } from './carryMark.js';
import { DROP_PATH, drank } from './thirstMark.js';
import { SHELL_PATH, RIM_PATH, ate } from './hungerMark.js';
import { rectOf } from './screenRect.js';

export const GESTURE_MAX = 3;
export const GESTURE_IN = 0.25, GESTURE_HOLD = 1.0, GESTURE_OUT = 0.45;

// the drawings: the carry row's, plus the drop and the half coconut of the need marks (viewBox 0 0 W 24, drawn at the same stroke as the marks)
const BOXES = { drop: '0 0 16 24', half: '0 0 24 24' };
const NEED_PATHS = {
  drop: `<path class="fill" d="${DROP_PATH}"/><path d="${DROP_PATH}"/>`,
  half: `<path class="fill" d="${SHELL_PATH}"/><path d="${SHELL_PATH.replace(/Z$/, '')}"/><path d="${RIM_PATH}"/>`,
};
export const gestureSvg = key => `<svg viewBox="${BOXES[key] || '0 0 20 26'}" aria-hidden="true" data-kind="${key}">${NEED_PATHS[key] || DRAWINGS[key]}</svg>`;
export const isGestureKey = key => key in NEED_PATHS || key in DRAWINGS;

export function gestureState(game, out = {}) {
  carryState(game, out);
  out.thirst = game.thirst.days; out.hunger = game.hunger.days;
  return out;
}

export function changedKeys(prev, cur) {
  if (!prev || !cur) return [];
  const needs = [], carry = [];
  if (drank(prev.thirst, cur.thirst)) needs.push('drop');
  if (ate(prev.hunger, cur.hunger)) needs.push('half');
  for (const k of ITEMS) if (((prev[k]) || 0) !== ((cur[k]) || 0)) carry.push(k);
  const keep = needs.concat(carry.slice(0, Math.max(0, GESTURE_MAX - needs.length))).slice(0, GESTURE_MAX);
  return carry.filter(k => keep.includes(k)).concat(needs.filter(k => keep.includes(k)));   // shown: what he carries first, then the needs
}

const WORK_KEYS = { husk: ['nut'], sip: ['water'], drink: ['drop'], fill: ['shell'], make: ['branch'], makeAxe: ['branch', 'fibre'] };
export function workKeys(work) {
  if (!work) return [];
  if (work.kind === 'roast') return [work.food === 'fish' ? 'fish' : 'crab'];
  return WORK_KEYS[work.kind] || [];
}

export function gestureOpacity(born, seen, now) {
  const fadeIn = ss(0, GESTURE_IN, now - born), fadeOut = 1 - ss(GESTURE_HOLD, GESTURE_HOLD + GESTURE_OUT, now - seen);
  return Math.max(0, Math.min(fadeIn, fadeOut));
}

export function createGestures() {
  let prev = null, shown = [];   // shown: [{ key, born, seen }], oldest first
  const prevState = {};
  function update(state, work, asleep, now) {
    const had = prev !== null;
    const keys = had && !asleep ? changedKeys(prev, state) : [];
    if (!prev) prev = prevState;
    for (const k of Object.keys(state)) prev[k] = state[k];
    if (asleep) { shown = []; return []; }
    const asked = keys.concat(workKeys(work));
    for (const key of asked) {
      const e = shown.find(s => s.key === key);
      if (e) e.seen = now; else shown.push({ key, born: now, seen: now });
    }
    shown = shown.filter(s => now - s.seen < GESTURE_HOLD + GESTURE_OUT);
    if (shown.length > GESTURE_MAX) shown = shown.slice(shown.length - GESTURE_MAX);
    return shown.map(s => ({ key: s.key, opacity: gestureOpacity(s.born, s.seen, now) }));
  }
  return { update };
}

export function createGestureMark(container) {
  const box = document.createElement('div');
  box.className = 'gesture'; box.setAttribute('aria-hidden', 'true'); container.appendChild(box);
  const tracker = createGestures(), point = new THREE.Vector3();
  let keys = '', ops = '', on = false;
  function update(state, work, asleep, now, player, camera) {
    const list = tracker.update(state, work, asleep, now);
    const k = list.map(g => g.key).join();
    if (k !== keys) { keys = k; ops = ''; box.innerHTML = list.map(g => gestureSvg(g.key)).join(''); box.classList.toggle('many', list.length > 1); }
    if (!list.length) { if (on) { on = false; box.style.opacity = '0'; } return; }
    on = true; box.style.opacity = '1';
    const o = list.map(g => g.opacity.toFixed(2)).join();
    if (o !== ops) { ops = o; list.forEach((g, i) => { box.children[i].style.opacity = g.opacity.toFixed(2); }); }
    const rect = rectOf(container);
    point.set(player.x, player.y + 1.9, player.z).project(camera);
    const x = Math.max(24, Math.min(rect.width - 24, (point.x + 1) * rect.width / 2));
    const y = Math.max(40, Math.min(rect.height - 8, (1 - point.y) * rect.height / 2));
    box.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px) translate(-50%,-100%)`;
  }
  return { update };
}
