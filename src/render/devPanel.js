/**
 * render/devPanel — the small developer panel, top right, one line such as
 * `v0.7 · Quiet frames · 30 fps · 9 ms · q1 · idle`: version and name (src/version),
 * the frames per second drawn, the work time per frame in ms (update + render,
 * not the interval), the quality level `qN` (render/quality; only when it is known) and `idle` while the frame pacer idles (render/framePacer). Same ink as the moon mark (`--ink`, pale at night, render/ink), faint, with a quiet backing (`--ink-back`) that turns dark at night. It is a
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
 * devLabel(version, name, fps, ms?, idle?, zoom?, quality?) -> string   e.g.
 *   'v0.7 · Quiet frames · 30 fps · 9 ms · idle' ('– fps' while there is no
 *   value yet; ' · N ms' only with ms, ' · zoom 18' only when zoom is beyond 10, the normal limit; ' · q1' only with a quality level, after zoom; ' · idle' only when idle). Pure.
 * isToggleKey(e) -> bool       true for the backtick key (code 'Backquote',
 *   not repeating, no Shift/Ctrl/Cmd/Alt: Shift+backtick starts the game over, see src/save). Pure.
 * createDevPanel(el, version, name, visible?) -> { frame(dt, workMs?, idle?, zoom?), setQuality(level), toggle(), visible() }
 *   el: the #dev element (index.html); frame is called for every drawn frame
 *   with the real time since the previous drawn frame, the ms its update and
 *   render took, and whether the pacer is idling; it touches the DOM only when the text changed;
 *   listens for the backtick key on window.
 *
 * Depends on: nothing (main passes it the zoom; the 25 limit while visible is core/view `zoomMax`)
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

export const devLabel = (version, name, fps, ms = null, idle = false, zoom = 0, quality = null) =>
  `v${version} \u00b7 ${name} \u00b7 ${fps === null || fps === undefined ? '\u2013' : fps} fps` + (ms === null || ms === undefined ? '' : ` \u00b7 ${ms} ms`) + (zoom > 10.5 ? ` \u00b7 zoom ${Math.round(zoom)}` : '') + (quality === null || quality === undefined ? '' : ` \u00b7 q${quality}`) + (idle ? ' \u00b7 idle' : '');

export const isToggleKey = e => e.code === 'Backquote' && !e.repeat && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey;

export function createDevPanel(el, version, name, visible = DEV_PANEL_VISIBLE) {
  const meter = createFpsMeter();
  let shown = visible, text = null, idling = false, zoomed = 0, quality = null;
  const refresh = () => set(devLabel(version, name, meter.fps(), meter.ms(), idling, zoomed, quality));
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
    toggle,
    visible: () => shown,
  };
}
