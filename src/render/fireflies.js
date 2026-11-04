/**
 * render/fireflies — draws the fireflies of game/fireflies (0.17.4 "Fireflies").
 *
 * Drawn into the light layer (render/lightLayer, 0.27.7: the same small canvas as the glow round fires, above the night grading,
 * additive), with one small sprite per firefly baked once in code, a warm yellow centre in a soft halo.
 * No point lights and nothing in the 3D scene, so the light count and the shaders
 * stay as they are, and the grading cannot dim them. The cost is at most MAX_FLIES
 * drawImage calls per frame into a half-size canvas (before 0.27.7 a full-size canvas was cleared and redrawn as well). Like the glow
 * it ignores the depth of the scene (a firefly drifts 0.3 to 2 m up, in the open or between trees).
 * By day the list is empty and nothing is drawn. Never counts as "something
 * happening" for the frame pacer.
 *
 * MAX_FLIES (300)
 * haloRadius(pxPerM) -> css px of the soft halo (grows with the zoom, within limits), pure
 * glowSprite(size) -> a canvas with the baked sprite
 * createFireflyView(container, fireflies, layer?) -> { update(dt, camera) }   once per drawn frame
 *   fireflies: game.fireflies; camera: the orthographic camera; layer: the light layer to draw into (islandView shares one with the
 *   fire's glow and calls its begin and end round the frame), by default one of its own in the container
 *
 * Depends on: three (a Vector3 to project), render/lightLayer
 */
import * as THREE from 'three';
import { createLightLayer } from './lightLayer.js';

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

export function createFireflyView(container, fireflies, shared) {
  const layer = shared || createLightLayer(container), sprite = glowSprite(), v = new THREE.Vector3();
  function update(dt, camera) {
    const list = fireflies.list();
    if (!shared) layer.begin();
    if (list.length) {
      const rc = layer.rect(), rad = haloRadius(rc.height / (camera.top - camera.bottom)), n = Math.min(list.length, MAX_FLIES);
      for (let i = 0; i < n; i++) {
        const f = list[i]; if (f.glow < 0.01) continue;
        v.set(f.x, f.y, f.z).project(camera);
        if (v.x < -1.1 || v.x > 1.1 || v.y < -1.1 || v.y > 1.1) continue;
        layer.draw(sprite, (v.x + 1) / 2 * rc.width, (1 - v.y) / 2 * rc.height, rad * (0.75 + 0.25 * f.glow), Math.min(1, f.glow));
      }
    }
    if (!shared) layer.end();
  }
  return { update };
}
