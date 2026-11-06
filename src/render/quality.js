/**
 * render/quality — the game lowers its own quality on a slow device.
 *
 * Five levels, from best (0) down, one step at a time; nothing steps back up
 * within a session. Pure: no DOM, no WebGL. render/stage applies the settings,
 * main feeds the governor and keeps the level (see docs/architecture.md).
 *
 *   0  as built: shadow map 4096 px (2048 on touch-only devices), bilinear
 *      shadow filter, pixel ratio up to 1.5, the terrain casts shadows
 *   1  shadow map 2048 px
 *   2  the lighter shadow filter (16 plain taps, radius 1.5 texels)
 *   3  pixel ratio 1
 *   4  the terrain no longer casts shadows (trees, props and the castaway do)
 *   rainStreaks: how many streaks of rain the rain layer draws at most (220, 220, 160, 110, 70 for levels 0 to 4; render/rain). It is no step of its own.
 *   fireLights: how many fires and torches in the ground get a point light (4 at levels 0 and 1, 2 below; 0.17.2).
 *      render/fire keeps the pool of the level the session starts at in the scene for good and only gives out
 *      fewer when the level drops, so no shader is rebuilt. It is no step of its own (nextLevel ignores it).
 *
 * MAX_LEVEL                    4
 * settingsFor(level, { touch }?) -> { shadowSize, filter: 'bilinear' | 'plain', pixelRatioMax, terrainShadows, fireLights, rainStreaks }
 *   (a level beyond the range counts as the nearest one)
 * nextLevel(level, { touch, dpr }?) -> the next level down whose settings differ in effect (on a touch device
 *   level 0 is level 1, on a screen with a pixel ratio of 1 level 3 is level 2, so those steps are skipped),
 *   or `level` itself when there is no lower one
 * createGovernor({ level, adapt?, touch?, dpr? }) -> { level, frame(dt, idle, building?) -> new level | null }
 *   Measures the mean time between drawn frames over MEASURE seconds of normal (not idle)
 *   play; above SLOW_DT (a frame rate under 27, a tolerance of 10 % on the target of
 *   30) it steps one level down and returns the new level, else null. The first START_SETTLE seconds and
 *   SETTLE_STEP seconds after each step, and a second after a gap (a hidden tab), are ignored, so
 *   tile building does not count; nor do the frames in which tiles were built (`building`, 0.27.7: render/islandView `building`; the streamer pumps up to
 *   9 ms and the far tiles 3 ms a frame) and the first frame after one (its interval holds the building); so are idle frames and the first frame after idling (the interval
 *   there is the idle rate, not the cost). One frame counts for at most 0.2 s. It is the interval, not the work
 *   time, that is measured: the work time leaves out the graphics card, and on a touch device capped at 30 a
 *   healthy interval is 33 ms. With adapt false (a forced level) it never steps.
 * parseQuality(search) -> level | null    the `?quality=N` test parameter ("2", not "2.5" or "x")
 * pickStart({ param, preference?, stored?, touch? }?) -> { level, adapt }   the forced level (no adapting), fixed desktop preference, or remembered automatic level, else 0; touch-only starts automatic
 * cyclePreference(preference) -> preference   Auto -> fixed 0 -> ... -> fixed 4 -> Auto, retaining Auto's last chosen level
 * isQualityKey(event) -> bool   one plain G press outside a typing field
 * QUALITY_KEY, loadPreference(getStorage?) -> { auto, fixed } | null, savePreference(preference, getStorage?) -> bool   per device, in localStorage, never throws
 * loadLevel/saveLevel remain the automatic-level compatibility helpers for the earlier stored format.
 *
 * Depends on: nothing
 */
export const MAX_LEVEL = 4;
export const QUALITY_KEY = 'driftwood-quality';
export const TARGET_FPS = 30;
export const SLOW_DT = 1 / (TARGET_FPS * 0.9);   // seconds between frames: slower than this is too slow
export const MEASURE = 3, START_SETTLE = 4, SETTLE_STEP = 2, SETTLE_GAP = 1, GAP = 0.5, MIN_FRAMES = 20, MAX_DT = 0.2;

const clamp = level => (Number.isInteger(level) ? Math.max(0, Math.min(MAX_LEVEL, level)) : 0);

export function settingsFor(level, { touch = false } = {}) {
  const l = clamp(level);
  return {
    shadowSize: l === 0 && !touch ? 4096 : 2048,
    filter: l >= 2 ? 'plain' : 'bilinear',
    pixelRatioMax: l >= 3 ? 1 : 1.5,
    terrainShadows: l < 4,
    fireLights: l <= 1 ? 4 : 2,
    rainStreaks: [220, 220, 160, 110, 70][l],
  };
}

const sameInEffect = (a, b, dpr) => a.shadowSize === b.shadowSize && a.filter === b.filter && a.terrainShadows === b.terrainShadows && Math.min(dpr, a.pixelRatioMax) === Math.min(dpr, b.pixelRatioMax);
export function nextLevel(level, { touch = false, dpr = 1 } = {}) {
  const from = clamp(level), now = settingsFor(from, { touch }), d = dpr > 0 ? dpr : 1;
  for (let l = from + 1; l <= MAX_LEVEL; l++) if (!sameInEffect(now, settingsFor(l, { touch }), d)) return l;
  return from;
}

export function createGovernor({ level = 0, adapt = true, touch = false, dpr = 1 } = {}) {
  let lvl = clamp(level), settle = START_SETTLE, sum = 0, n = 0, time = 0, wasIdle = false, wasBuilding = false;
  const reset = () => { sum = 0; n = 0; time = 0; };
  return {
    get level() { return lvl; },
    frame(dt, idle = false, building = false) {
      if (!adapt || !(dt > 0) || nextLevel(lvl, { touch, dpr }) === lvl) return null;
      if (dt > GAP) { reset(); settle = Math.max(settle, SETTLE_GAP); wasIdle = false; wasBuilding = building; return null; }
      if (settle > 0) { settle -= dt; reset(); wasIdle = idle; wasBuilding = building; return null; }
      if (idle) { wasIdle = true; wasBuilding = building; return null; }
      if (wasIdle) { wasIdle = false; wasBuilding = building; return null; }
      const skip = building || wasBuilding; wasBuilding = building;   // the interval of a frame holds the work of the one before it
      if (skip) return null;
      sum += Math.min(dt, MAX_DT); n++; time += dt;
      if (time < MEASURE || n < MIN_FRAMES) return null;
      const mean = sum / n; reset();
      if (mean <= SLOW_DT) return null;
      lvl = nextLevel(lvl, { touch, dpr }); settle = SETTLE_STEP;
      return lvl;
    },
  };
}

export function parseQuality(search) {
  const v = new URLSearchParams(search || '').get('quality');
  return v !== null && /^\d+$/.test(v) && Number(v) <= MAX_LEVEL ? Number(v) : null;
}

const validLevel = level => Number.isInteger(level) && level >= 0 && level <= MAX_LEVEL;
const cleanPreference = preference => preference && validLevel(preference.auto) && (preference.fixed === null || validLevel(preference.fixed)) ? { auto: preference.auto, fixed: preference.fixed } : null;

export function pickStart({ param = null, preference = null, stored = null, touch = false } = {}) {
  if (param !== null) return { level: clamp(param), adapt: false };
  const pref = cleanPreference(preference);
  if (pref) return pref.fixed === null || touch ? { level: pref.auto, adapt: true } : { level: pref.fixed, adapt: false };
  return { level: stored !== null ? clamp(stored) : 0, adapt: true };
}

export function cyclePreference(preference = { auto: 0, fixed: null }) {
  const pref = cleanPreference(preference) || { auto: 0, fixed: null };
  if (pref.fixed === null) return { ...pref, fixed: 0 };
  return pref.fixed < MAX_LEVEL ? { ...pref, fixed: pref.fixed + 1 } : { ...pref, fixed: null };
}

export const isQualityKey = e => {
  const target = e.target;
  const typing = target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName || ''));
  return e.code === 'KeyG' && !e.repeat && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && !typing;
};

export function loadPreference(getStorage = () => window.localStorage) {
  try {
    const text = getStorage().getItem(QUALITY_KEY);
    if (text === null) return null;
    if (/^\d+$/.test(text) && Number(text) <= MAX_LEVEL) return { auto: Number(text), fixed: null };   // 0.29.6 and earlier
    const value = JSON.parse(text);
    return cleanPreference(value);
  } catch (e) { return null; }
}

export function savePreference(preference, getStorage = () => window.localStorage) {
  const pref = cleanPreference(preference);
  if (!pref) return false;
  try { getStorage().setItem(QUALITY_KEY, JSON.stringify(pref)); return true; } catch (e) { return false; }
}

export function loadLevel(getStorage = () => window.localStorage) {
  const preference = loadPreference(getStorage); return preference ? preference.auto : null;
}
export function saveLevel(level, getStorage = () => window.localStorage) {
  return savePreference({ auto: clamp(level), fixed: null }, getStorage);
}
