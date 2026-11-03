/**
 * render/mood — the atmosphere per terrace: colour grading, mist and light.
 *
 * The grading of the style shots, done live:
 *   - soft-light tint over the canvas: warm on the coast and lowland,
 *     cool on plateau and summit
 *   - a multiply layer that warms and deepens the beach
 *   - a mist gradient in the rain forest (lighter on the summit)
 *   - desaturation on the summit
 *   - a soft vignette, always
 * Plus fog in the rain forest and cooler light from tier 3 up. Everything
 * blends over about 1.5 s when you change terrace.
 *
 * On top of that the time of day (render/sky): the colour and strength of
 * sun or moon and of the sky fill, and a multiply layer for golden hour,
 * dusk and moonlit night. The warm terrace grading fades towards night, so
 * dusk turns rose rather than brown.
 *
 * These are DOM layers stacked over the canvas (pointer-events: none);
 * they are part of the picture, not an interface.
 *
 * createMood({ stage, canvas, container }) -> { update(tier, dt, sky) }
 *   sky: skyAt(time) from render/sky
 *
 * Depends on: three, core/math
 */
import * as THREE from 'three';
import { lerp } from '../core/math.js';

const TINT = ['rgba(255,170,95,0.34)', 'rgba(255,190,120,0.24)', 'rgba(255,190,120,0.24)', 'rgba(160,190,225,0.18)', 'rgba(160,190,225,0.22)'];
const MIST = [0, 0, 1, 0, 0.4];

export function createMood({ stage, canvas, container }) {
  const layer = (css) => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;pointer-events:none;' + css; container.appendChild(d); return d; };
  const tint = layer('mix-blend-mode:soft-light;transition:background-color 1.4s ease;');
  const mult = layer('mix-blend-mode:multiply;background:rgba(232,212,186,0.55);');
  const mist = layer('background:linear-gradient(rgba(236,240,232,0.16),rgba(236,240,232,0.05) 50%,rgba(236,240,232,0) 80%);opacity:0;transition:opacity 1.6s ease;');
  const daylight = layer('mix-blend-mode:multiply;background-color:rgb(255,255,255);');
  layer('background:radial-gradient(ellipse at center,rgba(0,0,0,0) 45%,rgba(20,15,10,0.3) 100%);');

  const fog = new THREE.Fog(0xe4ebe2, 4000, 5000); stage.scene.fog = fog;
  const hemiC = new THREE.Color(0xdfe8f0), sunC = new THREE.Color(0xfff0dc);
  let tier = -1, fogAmt = 0, cool = 0, beach = 0, summit = 0, grade = '', warmth = '', filter = '';

  function update(k, dt, sky) {
    if (k !== tier) {
      tier = k;
      tint.style.backgroundColor = TINT[k];
      mist.style.opacity = MIST[k];
    }
    fogAmt += ((k === 2 ? 1 : 0) - fogAmt) * Math.min(1, dt * 1.5);
    cool += ((k >= 3 ? 1 : 0) - cool) * Math.min(1, dt * 1.5);
    beach += ((k === 0 ? 1 : 0) - beach) * Math.min(1, dt * 1.5);
    summit += ((k === 4 ? 1 : 0) - summit) * Math.min(1, dt * 1.5);
    const f = 'saturate(' + (sky.saturation * lerp(1, 0.72, summit)).toFixed(2) + ') contrast(' + lerp(1, 1.04, summit).toFixed(3) + ')';
    if (f !== filter) { canvas.style.filter = f; filter = f; }
    const warm = 0.3 + 0.7 * sky.day, w = (beach * warm).toFixed(2) + ',' + warm.toFixed(2);
    if (w !== warmth) { mult.style.opacity = (beach * warm).toFixed(2); tint.style.opacity = warm.toFixed(2); warmth = w; }
    fog.near = lerp(4000, 405, fogAmt); fog.far = lerp(5000, 480, fogAmt);
    const { light, fill } = sky;
    stage.sun.color.setRGB(...light.color).lerp(sunC, cool * sky.day); stage.sun.intensity = light.intensity;
    stage.hemi.color.setRGB(...fill.color).lerp(hemiC, cool * sky.day); stage.hemi.intensity = fill.intensity;
    const g = 'rgb(' + sky.grade.map(v => Math.round(v * 255)).join(',') + ')';
    if (g !== grade) { daylight.style.backgroundColor = g; grade = g; }
  }
  return { update };
}
