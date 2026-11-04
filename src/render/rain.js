/**
 * render/rain — the rain over the picture (0.21 "Rain"): thin streaks, and the grey veil's partner in render/mood.
 *
 * A layer of its own over the picture, like the glow round fires (render/fire) and the fireflies: a transparent
 * 2D canvas with one path of thin, slightly slanted lines, a few hundred at most, falling fast down the screen and
 * wrapping round. Nothing in the 3D scene and no shader changes (the rings on the water are in render/water, the
 * sheen on the ground in render/materials). The cost is a clear and one stroke per frame. The number of streaks
 * follows the intensity of the shower and the quality level (render/quality `rainStreaks`: fewer on the lower
 * levels). The streaks are placed by a seeded generator, so a picture repeats. Rain is drawn at whatever rate the
 * frame loop runs (15 a second when idle) and is never "something happening" for the frame pacer.
 *
 * STREAKS_MAX (220)
 * streakCount(intensity, max) -> how many of the max streaks are drawn, pure (none below a hundredth)
 * makeStreaks(n) -> [{ x, y, speed, len, a }]  the streaks, pure (x, y in 0..1 of the screen)
 * advance(streaks, dt) -> moves them down (speed in screen heights a second) and wraps them, in place
 * createRainView(container, { max }?) -> { update(dt, intensity, day), setMax(n) }   once per drawn frame
 *   day: 0 (night) .. 1; at night the streaks stay light and nearly as strong as by day (0.27.6: they were barely visible against the dark grading), a little greyer and fainter
 *
 * Depends on: core/noise, render/screenRect
 */
import { mulberry32 } from '../core/noise.js';
import { rectOf } from './screenRect.js';

export const STREAKS_MAX = 220;
const SLANT = 0.13;   // sideways per downwards: the rain leans a little with the wind

export const streakCount = (intensity, max) => intensity < 0.01 ? 0 : Math.min(max, Math.round(max * Math.min(1, intensity)));

export function makeStreaks(n) {
  const r = mulberry32(2100 + n), out = [];
  for (let i = 0; i < n; i++) out.push({ x: r(), y: r(), speed: 1.1 + 0.9 * r(), len: 0.018 + 0.03 * r(), a: 0.45 + 0.55 * r() });
  return out;
}

export function advance(streaks, dt) {
  for (const s of streaks) { s.y += s.speed * dt * 0.6; if (s.y > 1.05) { s.y -= 1.1; s.x = (s.x + 0.37) % 1; } }
}

export function createRainView(container, opts = {}) {
  const cv = document.createElement('canvas');
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;display:none;';
  container.appendChild(cv);
  const g = cv.getContext('2d');
  let max = opts.max ?? STREAKS_MAX, streaks = makeStreaks(max), shown = false;
  const setMax = n => { if (n !== max) { max = n; streaks = makeStreaks(max); } };
  function update(dt, intensity, day = 1) {
    const n = streakCount(intensity, max);
    if (!n) { if (shown) { cv.style.display = 'none'; shown = false; } return; }
    const rc = rectOf(container), ratio = Math.min(2, window.devicePixelRatio || 1), W = Math.round(rc.width * ratio), H = Math.round(rc.height * ratio);
    if (!shown) { cv.style.display = 'block'; shown = true; }
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    advance(streaks, Math.min(dt, 0.1));
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
    g.lineCap = 'round'; g.lineWidth = Math.max(1, 1.1 * ratio);
    const pale = 0.8 + 0.2 * day, rgb = Math.round(185 + 55 * day), fade = 0.5 * Math.min(1, intensity * 1.2) * pale;
    for (const pass of [0, 1]) {   // two strengths in two strokes: the near streaks clearer than the far ones
      g.strokeStyle = `rgba(${rgb},${rgb + 8},${Math.min(255, rgb + 18)},${(fade * (pass ? 1 : 0.55)).toFixed(3)})`;
      g.beginPath();
      for (let i = 0; i < n; i++) {
        const s = streaks[i]; if ((s.a > 0.72) !== !!pass) continue;
        const x = s.x * W, y = s.y * H, l = s.len * H;
        g.moveTo(x, y); g.lineTo(x - l * SLANT, y - l);
      }
      g.stroke();
    }
  }
  return { update, setMax };
}
