/**
 * render/cutout — a soft round window in the vegetation round the castaway.
 *
 * Everything drawn with a cut material (crowns, pines, palm trunks and
 * fronds, bushes, ferns, trunks, roots and their outlines) leaves a round
 * hole on screen around the castaway, but only where it stands between the
 * camera and the figure. The hole has a soft, stippled edge (ordered
 * dither), moves smoothly with the castaway and never switches whole trees
 * on or off. Shadows are not affected.
 *
 * withCutout(material, margin?) -> material   patches its shaders (once) to
 *   cut whatever lies more than margin metres in front of the figure.
 *   Outlines use a negative margin: they are back faces that lie behind the
 *   crown they outline, and would show as a dark disc through the hole.
 * updateCutout(camera, renderer, at) sets the window for this frame;
 *   at: { x, y, z } the middle of the figure
 * cutoutParams(camera, width, height, at) -> { cx, cy, r, depth }   pure:
 *   the window in drawing-buffer pixels and the figure's view depth
 * CUT_RADIUS (metres), CUT_MARGIN (metres in front of the figure before
 *   anything is cut)
 *
 * Depends on: three
 */
import * as THREE from 'three';

export const CUT_RADIUS = 1.25, CUT_MARGIN = 0.5;
const uniforms = { uCutC: { value: new THREE.Vector2() }, uCutR: { value: 0 }, uCutZ: { value: 0 } };

const VERT_HEAD = 'varying float vCutZ;\n';
const FRAG_HEAD = `uniform vec2 uCutC;
uniform float uCutR;
uniform float uCutZ;
varying float vCutZ;
float cutB2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float cutB4(vec2 a) { return cutB2(0.5 * a) * 0.25 + cutB2(a); }
`;
const fragTest = margin => `
  if (uCutR > 0.0 && vCutZ < uCutZ - ${margin.toFixed(2)}) {
    float cd = length(gl_FragCoord.xy - uCutC) / uCutR;
    if (cd < 1.0 && cutB4(gl_FragCoord.xy) >= smoothstep(0.78, 1.0, cd)) discard;
  }
`;

export function withCutout(mat, margin = CUT_MARGIN) {
  if (mat.userData.cut) return mat;
  const before = mat.onBeforeCompile, key = mat.customProgramCacheKey;
  mat.onBeforeCompile = (sh, r) => {
    if (before) before(sh, r);
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = VERT_HEAD + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvCutZ = -mvPosition.z;');
    sh.fragmentShader = FRAG_HEAD + sh.fragmentShader.replace('void main() {', 'void main() {' + fragTest(margin));
  };
  mat.customProgramCacheKey = () => (key ? key.call(mat) : '') + '|cut' + margin;
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
