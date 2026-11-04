/**
 * render/soundMark — the sound mark: a small speaker in ink above the moon, on touch-only devices (0.20 "Sound").
 *
 * Drawn like the other marks (rim in `--ink`, the glow `--halo`, faint most of the time). Sound on: a
 * speaker with two waves; off: the speaker crossed out. A tap turns sound on or off (the same as M on a
 * keyboard, audio/pref). Where a keyboard is the way to play (not touch-only) the mark stays hidden.
 *
 * markState(on) -> { waves: bool, cross: bool, opacity }   what the mark shows. Pure.
 * createSoundMark(el, onTap) -> { update(on) }   el: the #sound svg (index.html) with .waves and .cross groups;
 *   onTap() is called by a tap on it. Only touches the DOM when the state changed. Without el: does nothing.
 *
 * Depends on: nothing
 */
export const markState = on => ({ waves: !!on, cross: !on, opacity: on ? 0.5 : 0.4 });

export function createSoundMark(el, onTap) {
  if (!el) return { update() {} };
  const waves = el.querySelector('.waves'), cross = el.querySelector('.cross');
  let shown = null;
  el.addEventListener('pointerup', e => { e.preventDefault(); e.stopPropagation(); onTap(); });
  el.addEventListener('pointerdown', e => e.stopPropagation());
  return {
    update(on) {
      if (on === shown) return;
      shown = on;
      const s = markState(on);
      waves.style.display = s.waves ? '' : 'none'; cross.style.display = s.cross ? '' : 'none'; el.style.opacity = s.opacity;
    },
  };
}
