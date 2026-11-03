/**
 * render/devPanel — the small developer panel, top right, one line such as
 * `v0.4 · Dev panel · 60 fps`: version and name (src/version) and the frames
 * per second. Same dark brown ink as the moon mark, faint, no box. It is a
 * developer aid, not part of the game: visible for now, to be hidden later
 * by flipping DEV_PANEL_VISIBLE to false. The backtick key toggles it at any
 * time; the choice is not remembered between sessions.
 *
 * DEV_PANEL_VISIBLE            whether the panel is shown at the start
 * FPS_WINDOW                   seconds the frame rate is averaged over (0.5)
 * createFpsMeter(window?) -> { add(dt) -> fps | null, fps() }   Pure.
 *   Feed it the real time of each frame in seconds. It averages over about
 *   `window` seconds and so gives a new, rounded whole number at most every
 *   `window` seconds (add returns it then, otherwise null); fps() is the
 *   latest value (null before the first). Frames longer than a second (a
 *   hidden tab, a pause) are not counted.
 * devLabel(version, name, fps) -> string   e.g. 'v0.4 · Dev panel · 60 fps'
 *   ('– fps' while there is no value yet). Pure.
 * isToggleKey(e) -> bool       true for the backtick key (code 'Backquote',
 *   not repeating, no Shift/Ctrl/Cmd/Alt: Shift+backtick starts the game over, see src/save). Pure.
 * createDevPanel(el, version, name, visible?) -> { frame(dt), toggle(), visible() }
 *   el: the #dev element (index.html); frame(dt) is called every frame with
 *   the real frame time and touches the DOM only when the text changed;
 *   listens for the backtick key on window.
 *
 * Depends on: nothing
 */
export const DEV_PANEL_VISIBLE = true;
export const FPS_WINDOW = 0.5;

export function createFpsMeter(window = FPS_WINDOW) {
  let time = 0, frames = 0, value = null;
  return {
    add(dt) {
      if (!(dt > 0) || dt > 1) return null;
      time += dt; frames++;
      if (time < window) return null;
      value = Math.round(frames / time); time = 0; frames = 0;
      return value;
    },
    fps: () => value,
  };
}

export const devLabel = (version, name, fps) => `v${version} \u00b7 ${name} \u00b7 ${fps === null || fps === undefined ? '\u2013' : fps} fps`;

export const isToggleKey = e => e.code === 'Backquote' && !e.repeat && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey;

export function createDevPanel(el, version, name, visible = DEV_PANEL_VISIBLE) {
  const meter = createFpsMeter();
  let shown = visible, text = null;
  const set = t => { if (t !== text) { text = t; el.textContent = t; } };
  const apply = () => { if (el.hidden === shown) el.hidden = !shown; };
  set(devLabel(version, name, null)); apply();
  const key = e => { if (isToggleKey(e)) toggle(); };
  function toggle() { shown = !shown; apply(); }
  window.addEventListener('keydown', key);
  return {
    frame(dt) { const f = meter.add(dt); if (f !== null) set(devLabel(version, name, f)); },
    toggle,
    visible: () => shown,
  };
}
