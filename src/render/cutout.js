/**
 * render/cutout — a thinned veil in the vegetation round the castaway.
 *
 * Everything drawn with a cut material (crowns, pines, palm trunks and
 * fronds, bushes, ferns, trunks, roots and their outlines) is thinned out
 * in a round patch on screen around the castaway, but only where it stands
 * between the camera and the figure. It is never a clean hole: an ordered
 * dither keeps CUT_CORE_KEEP of the leaves in the middle and fills in
 * gradually to all of them at the edge, so the trees stay visible and the
 * shaded ground beneath never shows as a dark disc. It moves smoothly with
 * the castaway and never switches whole trees on or off. Shadows are not
 * affected.
 *
 * withCutout(material, margin?, core?) -> material   patches its shaders
 *   (once) to thin out whatever lies more than margin metres in front of the
 *   figure, keeping core (default CUT_CORE_KEEP) of it in the middle.
 *   Outlines use a negative margin and core 0: they are back faces that lie
 *   behind the crown they outline. With the same dither pattern and a lower
 *   keep everywhere, an outline pixel survives only where the leaves in
 *   front of it survive too, so it never shows as dark dots in the gaps.
 * updateCutout(camera, renderer, at) sets the window for this frame;
 *   at: { x, y, z } the middle of the figure
 * cutoutParams(camera, width, height, at) -> { cx, cy, r, depth }   pure:
 *   the window in drawing-buffer pixels and the figure's view depth
 * cutKeep(d, core?) -> 0..1   pure: the share of vegetation kept at
 *   distance d from the middle of the window (d in radii; mirrors the shader)
 * CUT_RADIUS (metres), CUT_MARGIN (metres in front of the figure before
 *   anything is cut), CUT_CORE_KEEP (share kept in the middle)
 *
 * Depends on: three
 */
import * as THREE from 'three';

export const CUT_RADIUS = 1.5, CUT_MARGIN = 0.5, CUT_CORE_KEEP = 0.4;

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function cutKeep(d, core = CUT_CORE_KEEP) {
  return d >= 1 ? 1 : core + (1 - core) * smooth(0, 1, d);
}
const uniforms = { uCutC: { value: new THREE.Vector2() }, uCutR: { value: 0 }, uCutZ: { value: 0 } };

const VERT_HEAD = 'varying float vCutZ;\n';
const FRAG_HEAD = `uniform vec2 uCutC;
uniform float uCutR;
uniform float uCutZ;
varying float vCutZ;
float cutB2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float cutB4(vec2 a) { return cutB2(0.5 * a) * 0.25 + cutB2(a); }
`;
const fragTest = (margin, core) => `
  if (uCutR > 0.0 && vCutZ < uCutZ - ${margin.toFixed(2)}) {
    float cd = length(gl_FragCoord.xy - uCutC) / uCutR;
    if (cd < 1.0 && cutB4(gl_FragCoord.xy) >= mix(${core.toFixed(2)}, 1.0, smoothstep(0.0, 1.0, cd))) discard;
  }
`;

export function withCutout(mat, margin = CUT_MARGIN, core = CUT_CORE_KEEP) {
  if (mat.userData.cut) return mat;
  const before = mat.onBeforeCompile, key = mat.customProgramCacheKey;
  mat.onBeforeCompile = (sh, r) => {
    if (before) before(sh, r);
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = VERT_HEAD + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvCutZ = -mvPosition.z;');
    sh.fragmentShader = FRAG_HEAD + sh.fragmentShader.replace('void main() {', 'void main() {' + fragTest(margin, core));
  };
  mat.customProgramCacheKey = () => (key ? key.call(mat) : '') + '|cut' + margin + '|' + core;
  mat.userData.cut = true; mat.needsUpdate = true;
  return mat;
}

const v = new THREE.Vector3();
export function cutoutParams(camera, width, height, at) {
  v.set(at.x, at.y, at.z).applyMatrix4(camera.matrixWorldInverse);
  const depth = -v.z;
  v.set(at.x, at.y, at.z).project(camera);
  const perPx = (camera.top - camera.bottom) / camera.zoom / height;
  return { cx: (v.x * 0.5 + 0.5) * width, cy: (v.y * 0.5 + 0.5) * height, r: CUT_RADIUS / perPx, depth };
}

const size = new THREE.Vector2();
export function updateCutout(camera, renderer, at) {
  renderer.getDrawingBufferSize(size);
  const p = cutoutParams(camera, size.x, size.y, at);
  uniforms.uCutC.value.set(p.cx, p.cy); uniforms.uCutR.value = p.r; uniforms.uCutZ.value = p.depth;
}
