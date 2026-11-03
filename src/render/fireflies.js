/**
 * render/fireflies — draws the fireflies of game/fireflies (0.17.4 "Fireflies").
 *
 * A layer of its own over the picture, above the night grading (like the glow
 * round fires in render/fire): a transparent 2D canvas, additive, with one small
 * sprite per firefly baked once in code, a warm yellow centre in a soft halo.
 * No point lights and nothing in the 3D scene, so the light count and the shaders
 * stay as they are, and the grading cannot dim them. The cost is a clear and at
 * most MAX_FLIES drawImage calls per frame. Like the glow it ignores the depth
 * of the scene (a firefly drifts 0.3 to 2 m up, in the open or between trees).
 * By day the list is empty and the canvas is hidden. Never counts as "something
 * happening" for the frame pacer.
 *
 * MAX_FLIES (300)
 * haloRadius(pxPerM) -> css px of the soft halo (grows with the zoom, within limits), pure
 * glowSprite(size) -> a canvas with the baked sprite
 * createFireflyView(container, fireflies) -> { update(dt, camera) }   once per drawn frame
 *   fireflies: game.fireflies; camera: the orthographic camera
 *
 * Depends on: three (a Vector3 to project)
 */
import * as THREE from 'three';

export const MAX_FLIES = 300;
const SPRITE = 64;

/** Radius in css px of the halo: about 0.2 m on screen, never less than 6 or more than 16 px. */
export function haloRadius(pxPerM) { return Math.max(6, Math.min(16, 0.2 * pxPerM)); }

/** The sprite: white-yellow centre, warm yellow glow, soft fall-off to nothing at the edge. */
export function glowSprite(size = SPRITE) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), m = size / 2, gr = g.createRadialGradient(m, m, 0, m, m, m);
  gr.addColorStop(0, 'rgba(255,250,200,1)'); gr.addColorStop(0.07, 'rgba(255,240,150,0.95)');
  gr.addColorStop(0.2, 'rgba(255,215,90,0.45)'); gr.addColorStop(0.5, 'rgba(255,190,60,0.12)'); gr.addColorStop(1, 'rgba(255,180,50,0)');
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  return c;
}

export function createFireflyView(container, fireflies) {
  const cv = document.createElement('canvas');
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;mix-blend-mode:screen;display:none;';
  container.appendChild(cv);
  const g = cv.getContext('2d'), sprite = glowSprite(), v = new THREE.Vector3();
  let shown = false;
  function update(dt, camera) {
    const list = fireflies.list();
    if (!list.length) { if (shown) { cv.style.display = 'none'; shown = false; } return; }
    const rc = container.getBoundingClientRect(), ratio = Math.min(2, window.devicePixelRatio || 1), W = Math.round(rc.width * ratio), H = Math.round(rc.height * ratio);
    if (!shown) { cv.style.display = 'block'; shown = true; }
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.globalCompositeOperation = 'lighter';
    const rad = haloRadius(rc.height / (camera.top - camera.bottom)) * ratio, n = Math.min(list.length, MAX_FLIES);
    for (let i = 0; i < n; i++) {
      const f = list[i]; if (f.glow < 0.01) continue;
      v.set(f.x, f.y, f.z).project(camera);
      if (v.x < -1.1 || v.x > 1.1 || v.y < -1.1 || v.y > 1.1) continue;
      g.globalAlpha = Math.min(1, f.glow);
      const r = rad * (0.75 + 0.25 * f.glow);
      g.drawImage(sprite, (v.x + 1) / 2 * W - r, (1 - v.y) / 2 * H - r, r * 2, r * 2);
    }
    g.globalAlpha = 1;
  }
  return { update };
}
