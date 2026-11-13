/**
 * render/devPanel — the small developer panel, top right, one line such as
 * `v0.7 · Quiet frames · 30 fps · 9 ms · q1 · idle`: version and name (src/version),
 * the frames per second drawn, the work time per frame in ms (update + render,
 * not the interval), the quality level `qN` (render/quality; only when it is known), `idle` while the frame pacer idles (render/framePacer) and, last,
 * `habit` while the castaway's own habit is in charge (0.28, game/mind; a developer aid only: the game itself shows nothing). Same ink as the moon mark (`--ink`, pale at night, render/ink), faint, with a quiet backing (`--ink-back`) that turns dark at night. It is a
 * developer aid, not part of the game: visible for now, to be hidden later
 * by flipping DEV_PANEL_VISIBLE to false. The backtick key toggles it at any
 * time; the choice is not remembered between sessions. While it is visible the
 * furthest zoom is 25 instead of 10 (a developer aid, see main).
 *
 * DEV_PANEL_VISIBLE            whether the panel is shown at the start
 * FPS_WINDOW                   seconds the frame rate is averaged over (0.5)
 * createFpsMeter(window?) -> { add(dt, workMs?) -> fps | null, fps(), ms() }   Pure.
 *   Feed it the real time of each frame in seconds and, if known, the time
 *   its work took in ms. It averages over about `window` seconds and so gives
 *   a new, rounded whole number at most every `window` seconds (add returns
 *   it then, otherwise null); fps() is the latest value (null before the
 *   first), ms() the latest average work time rounded to a whole ms (null
 *   without any). Frames longer than a second (a hidden tab, a pause) are
 *   not counted.
 * devLabel(version, name, fps, ms?, idle?, zoom?, quality?, hands?, habit?, speed?) -> string   e.g.
 *   'v0.7 · Quiet frames · 30 fps · 9 ms · idle' ('– fps' while there is no
 *   value yet; ' · N ms' only with ms, ' · ×8' only when the test speed (`?speed=N`, game/steps) is above 1, ' · zoom 18' only when zoom is beyond 10, the normal limit; ' · q1 auto' or ' · q1 fixed' only with a quality state, after zoom; the Hands mode (`self`, `computer`, `auto`), ' · idle' only when idle; ' · habit' last, only when habit). Pure.
 * isDevPanelEvent(e) -> bool   the event came from inside the panel (#dev; 0.36.4: main skips those events, so a click on the panel never takes Dave over or ends his habit). Pure.
 * isToggleKey(e) -> bool       true for the backtick key (code 'Backquote',
 *   not repeating, no Shift/Ctrl/Cmd/Alt: Shift+backtick starts the game over, see src/save). Pure.
 * createDevPanel(el, version, name, visible?) -> { frame(dt, workMs?, idle?, zoom?), setQuality({ level, adapt } | level), setHands(mode), setHabit(on), setSpeed(n), toggle(), visible() }
 *   el: the #dev element (index.html); frame is called for every drawn frame
 *   with the real time since the previous drawn frame, the ms its update and
 *   render took, and whether the pacer is idling; it touches the DOM only when the text changed;
 *   listens for the backtick key on window.
 *
 * Depends on: nothing (main passes it the zoom and the test speed `setSpeed(n)`, `×N` from game/steps; the 25 limit while visible is core/view `zoomMax`)
 */
export const DEV_PANEL_VISIBLE = true;
export const FPS_WINDOW = 0.5;

export function createFpsMeter(window = FPS_WINDOW) {
  let time = 0, frames = 0, value = null, work = 0, worked = 0, workValue = null;
  return {
    add(dt, workMs) {
      if (!(dt > 0) || dt > 1) return null;
      time += dt; frames++;
      if (workMs >= 0) { work += workMs; worked++; }
      if (time < window) return null;
      value = Math.round(frames / time); time = 0; frames = 0;
      if (worked) workValue = Math.round(work / worked);
      work = 0; worked = 0;
      return value;
    },
    fps: () => value,
    ms: () => workValue,
  };
}

export const devLabel = (version, name, fps, ms = null, idle = false, zoom = 0, quality = null, hands = null, habit = false, speed = 1) => {
  if (typeof hands === 'boolean') { habit = hands; hands = null; }   // pre-Hands pure callers
  return `v${version} \u00b7 ${name} \u00b7 ${fps === null || fps === undefined ? '\u2013' : fps} fps` + (ms === null || ms === undefined ? '' : ` \u00b7 ${ms} ms`) + (speed > 1 ? ` \u00b7 \u00d7${Math.round(speed * 100) / 100}` : '') + (zoom > 10.5 ? ` \u00b7 zoom ${Math.round(zoom)}` : '') + (quality === null || quality === undefined ? '' : ` \u00b7 q${typeof quality === 'object' ? quality.level : quality} ${typeof quality === 'object' && !quality.adapt ? 'fixed' : 'auto'}`) + (hands ? ` \u00b7 ${hands}` : '') + (idle ? ' \u00b7 idle' : '') + (habit ? ' \u00b7 habit' : '');
};

export function isDevPanelEvent(e) {
  const path = e && e.composedPath && e.composedPath();
  if (Array.isArray(path) && path.some(n => n && n.id === 'dev')) return true;
  const t = e && e.target;
  return !!(t && (t.id === 'dev' || (t.closest && t.closest('#dev'))));
}

export const isToggleKey = e => e.code === 'Backquote' && !(e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || '')) && !e.repeat && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey;

export function createDevPanel(el, version, name, visible = DEV_PANEL_VISIBLE) {
  const meter = createFpsMeter();
  let shown = visible, text = null, idling = false, zoomed = 0, quality = null, hands = null, habit = false, speed = 1;
  const refresh = () => set(devLabel(version, name, meter.fps(), meter.ms(), idling, zoomed, quality, hands, habit, speed));
  const set = t => { if (t !== text) { text = t; el.textContent = t; } };
  const apply = () => { if (el.hidden === shown) el.hidden = !shown; };
  set(devLabel(version, name, null)); apply();
  const key = e => { if (isToggleKey(e)) toggle(); };
  function toggle() { shown = !shown; apply(); }
  window.addEventListener('keydown', key);
  return {
    frame(dt, workMs, idle = false, zoom = 0) {
      const f = meter.add(dt, workMs), z = zoom > 10.5 ? Math.round(zoom) : 0;
      if (f !== null || idle !== idling || z !== zoomed) { idling = idle; zoomed = z; refresh(); }
    },
    setQuality(q) { if (q !== quality) { quality = q; refresh(); } },
    setHands(mode) { if (mode !== hands) { hands = mode; refresh(); } },
    setSpeed(n) { if (n !== speed) { speed = n; refresh(); } },
    setHabit(on) { on = !!on; if (on !== habit) { habit = on; refresh(); } },
    toggle,
    visible: () => shown,
  };
}
