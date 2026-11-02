/**
 * render/mood — the atmosphere per terrace: colour grading, mist and light.
 *
 * The grading of the style shots, done live:
 *   - soft-light tint over the canvas: warm on the coast and lowland,
 *     cool on plateau and summit
 *   - a multiply layer that warms and deepens the beach
 *   - a mist gradient in the rain forest (lighter on the summit)
 *   - desaturation on the summit
 *   - paper grain and a soft vignette, always
 * Plus fog in the rain forest and cooler light from tier 3 up. Everything
 * blends over about 1.5 s when you change terrace.
 *
 * These are DOM layers stacked over the canvas (pointer-events: none);
 * they are part of the picture, not an interface.
 *
 * createMood({ stage, canvas, container }) -> { update(tier, dt) }
 *
 * Depends on: three, core/math
 */
import * as THREE from 'three';
import { lerp } from '../core/math.js';

const TINT = ['rgba(255,170,95,0.34)', 'rgba(255,190,120,0.24)', 'rgba(255,190,120,0.24)', 'rgba(160,190,225,0.18)', 'rgba(160,190,225,0.22)'];
const MIST = [0, 0, 1, 0, 0.4];

function grainURL() {
  const c = document.createElement('canvas'); c.width = c.height = 220; const g = c.getContext('2d'); let a = 7;
  const rr = () => (a = (a * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 280; k++) { g.fillStyle = rr() < 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'; g.fillRect(rr() * 220 | 0, rr() * 220 | 0, 2, 2); }
  return c.toDataURL();
}

export function createMood({ stage, canvas, container }) {
  const layer = (css) => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;pointer-events:none;' + css; container.appendChild(d); return d; };
  const tint = layer('mix-blend-mode:soft-light;transition:background-color 1.4s ease;');
  const mult = layer('mix-blend-mode:multiply;background:rgba(232,212,186,0.55);transition:opacity 1.4s ease;');
  const mist = layer('background:linear-gradient(rgba(236,240,232,0.16),rgba(236,240,232,0.05) 50%,rgba(236,240,232,0) 80%);opacity:0;transition:opacity 1.6s ease;');
  layer('background-image:url(' + grainURL() + ');');
  layer('background:radial-gradient(ellipse at center,rgba(0,0,0,0) 45%,rgba(20,15,10,0.3) 100%);');
  canvas.style.transition = 'filter 1.4s ease';

  const fog = new THREE.Fog(0xe4ebe2, 4000, 5000); stage.scene.fog = fog;
  const hemiW = new THREE.Color(0xe2ebf0), hemiC = new THREE.Color(0xdfe8f0), sunW = new THREE.Color(0xffe6c4), sunC = new THREE.Color(0xfff0dc);
  let tier = -1, fogAmt = 0, cool = 0;

  function update(k, dt) {
    if (k !== tier) {
      tier = k;
      tint.style.backgroundColor = TINT[k];
      mult.style.opacity = k === 0 ? 1 : 0;
      mist.style.opacity = MIST[k];
      canvas.style.filter = k === 4 ? 'saturate(0.72) contrast(1.04)' : 'saturate(1) contrast(1)';
    }
    fogAmt += ((k === 2 ? 1 : 0) - fogAmt) * Math.min(1, dt * 1.5);
    cool += ((k >= 3 ? 1 : 0) - cool) * Math.min(1, dt * 1.5);
    fog.near = lerp(4000, 405, fogAmt); fog.far = lerp(5000, 480, fogAmt);
    stage.hemi.color.copy(hemiW).lerp(hemiC, cool); stage.sun.color.copy(sunW).lerp(sunC, cool);
  }
  return { update };
}
