/**
 * render/lightLayer — one small canvas for the lights laid over the picture (0.27.7 "Lighter").
 *
 * The warm glow round fires and torches (render/fire) and the fireflies (render/fireflies) are both drawn here, additively, in one
 * transparent 2D canvas above the night grading of render/mood (which would otherwise darken them with everything else), blended
 * onto the picture with `mix-blend-mode: screen`. Before 0.27.7 the glow was a full-screen div whose CSS gradients were rebuilt as text
 * every frame and the fireflies a full-resolution canvas cleared and redrawn every frame; now the canvas is SCALE (a half) of the
 * screen's size in css pixels, each light is one `drawImage` of a sprite baked once, and nothing is cleared, drawn or shown when no light
 * is on (by day, no fire, no fireflies). The soft glows lose nothing at half the resolution.
 *
 * SCALE (0.5)
 * radialSprite(size, stops) -> canvas   a sprite: a radial gradient from the middle to the rim; stops: [[offset 0..1, 'rgba(...)']]
 * createLightLayer(container, win?) -> layer
 *   layer.begin()    once per drawn frame, before anything is drawn: sizes the canvas to the container (render/screenRect) and clears it when
 *                    the last frame drew something
 *   layer.rect()     the container's size in css px ({ width, height }), for placing lights
 *   layer.draw(sprite, x, y, r, alpha, over?)   adds a sprite centred on x, y (css px), radius r (css px), at alpha 0..1; additive, or laid over what is
 *                    there when `over` is true (the bright core of a fire's glow, which the CSS layers it replaces painted on top)
 *   layer.end()      once per drawn frame, after: hides the canvas when this frame drew nothing
 *   layer.canvas     the element
 *   Without a 2D context (a test with a fake document) every call does nothing.
 *
 * Depends on: render/screenRect
 */
import { rectOf } from './screenRect.js';

export const SCALE = 0.5;

export function radialSprite(size, stops) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext && c.getContext('2d'); if (!g) return c;
  const m = size / 2, gr = g.createRadialGradient(m, m, 0, m, m, m);
  for (const [at, col] of stops) gr.addColorStop(at, col);
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  return c;
}

export function createLightLayer(container) {
  const cv = document.createElement('canvas');
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;mix-blend-mode:screen;display:none;';
  container.appendChild(cv);
  const g = cv.getContext && cv.getContext('2d');
  let shown = false, drew = false, W = 0, H = 0, op = 'lighter';
  const setOp = o => { if (o !== op) { op = o; g.globalCompositeOperation = o; } };
  return {
    canvas: cv,
    rect: () => rectOf(container),
    begin() {
      if (!g) return;
      const rc = rectOf(container), w = Math.max(1, Math.round(rc.width * SCALE)), h = Math.max(1, Math.round(rc.height * SCALE));
      if (w !== W || h !== H) { W = cv.width = w; H = cv.height = h; drew = false; }   // resizing clears it
      else if (drew) g.clearRect(0, 0, W, H);
      drew = false;
      op = 'lighter'; g.globalCompositeOperation = op;
    },
    draw(sprite, x, y, r, alpha, over = false) {
      if (!g || !(alpha > 0.002) || !(r > 0.3)) return;
      setOp(over ? 'source-over' : 'lighter');
      if (!shown) { cv.style.display = 'block'; shown = true; }
      g.globalAlpha = alpha > 1 ? 1 : alpha;
      g.drawImage(sprite, (x - r) * SCALE, (y - r) * SCALE, r * 2 * SCALE, r * 2 * SCALE);
      drew = true;
    },
    end() {
      if (g) g.globalAlpha = 1;
      if (!drew && shown) { cv.style.display = 'none'; shown = false; }
    },
  };
}
