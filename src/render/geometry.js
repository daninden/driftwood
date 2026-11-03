/**
 * render/geometry — shared meshes for props, and matrix helpers.
 *
 * createKit(noise) -> kit with geometries and materials, built once:
 *   canopy, canopyLod, trunk, pine, pineLod, bush, bushLod, rock, rockLod,
 *   seg (unit cylinder for sticks), frond (+ frondMat, frondDepth, and
 *   dryFrondMat, dryFrondDepth for withered fronds),
 *   grass, reed, fern, pebble, shell, driftwood
 *   materials: canopyMat, trunkMat, rockMat, palmTrunkMat, grassMat,
 *   fernMat, smallMat
 *   Some shapes are made lumpy with the island's noise, so they belong to a seed.
 * stickMatrix(a, b, r)   matrix that stretches the unit cylinder from a to b
 * Wind (0.19): canopyMat, pineMat, bushMat, palmTrunkMat, frondMat, dryFrondMat, grassMat and fernMat sway
 *   (render/windShader), with the shadow depth material (frondDepth, dryFrondDepth, or userData.depthMat) and the
 *   outline hull (userData.outline) that sway the same way. They are for the detailed tiles only: farCanopyMat is
 *   the still crown material of the far tiles, frondStillMat and frondStillDepth the still fronds of the lean-to.
 * mat4(x, y, z, sx, sy, sz, ry, rx, rz)   compose position, scale, rotation
 * opaqueCutout(material)   alpha-tested leaves write full alpha, so the page
 *   behind the canvas never shows through their edges
 *
 * Depends on: three, core/noise, render/materials
 */
import * as THREE from 'three';
import { mulberry32 } from '../core/noise.js';
import { toon } from './materials.js';
import { withWind, windDepth, windOutline } from './windShader.js';

const UP = new THREE.Vector3(0, 1, 0);
export function stickMatrix(a, b, r) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize());
  return new THREE.Matrix4().compose(a.clone().addScaledVector(d, 0.5), q, new THREE.Vector3(r, len, r));
}
/**
 * Leaves cut out of a texture (alphaTest) would write their soft edge alpha
 * into the canvas, and the light page behind it would shine through as a
 * pale rim (most visible at night). Write them fully opaque.
 */
export function opaqueCutout(mat) {
  const key = mat.customProgramCacheKey;
  mat.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n  gl_FragColor.a = 1.0;'); };
  mat.customProgramCacheKey = () => (key ? key.call(mat) : '') + '|opaque';
  return mat;
}
export const mat4 = (x, y, z, sx, sy, sz, ry, rx, rz) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)), new THREE.Vector3(sx, sy, sz));

/** A material that sways, with its shadow depth material and (if outlined) its outline hull. */
function swaying(mat, kind, { depth = true, outline = true, depthParams } = {}) {
  withWind(mat, kind);
  if (depth) mat.userData.depthMat = windDepth(kind, depthParams);
  if (outline) mat.userData.outline = windOutline(kind);
  return mat;
}

export function createKit(noise) {
  const { vnoise, hash2 } = noise;
  const lumpy = (g, amt, seed) => { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), s = 1 + (vnoise(x * 1.8 + seed, z * 1.8 + y * 1.1 + seed * 0.7) - 0.5) * amt; p.setXYZ(i, x * s, y * s, z * s); } g.computeVertexNormals(); return g; };
  const gradient = (g, lo, hi) => { const p = g.attributes.position, c = []; for (let i = 0; i < p.count; i++) { const t = (p.getY(i) + 1) / 2, v = lo + (hi - lo) * Math.max(0, Math.min(1, t)); c.push(v, v, v); } g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); return g; };
  const tuft = (blades, h0, h1, wd, seed) => {
    const r = mulberry32(seed), pos = [];
    for (let b = 0; b < blades; b++) { const a = b / blades * Math.PI * 2 + r(), h = h0 + r() * h1, lean = 0.06 + r() * 0.08, bx = Math.cos(a) * 0.03, bz = Math.sin(a) * 0.03, px = -Math.sin(a) * wd, pz = Math.cos(a) * wd; pos.push(bx - px, 0, bz - pz, bx + px, 0, bz + pz, bx + Math.cos(a) * lean, h, bz + Math.sin(a) * lean); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const n = []; for (let i = 0; i < pos.length / 3; i++) n.push(0, 1, 0); g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3)); return g;
  };
  const fern = (() => {
    const pos = [];
    for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; for (let s = 0; s < 4; s++) { const t0 = s / 4, t1 = (s + 1) / 4, w0 = 0.07 * (1 - t0 * 0.8), w1 = 0.07 * (1 - t1 * 0.8); const p0 = [Math.cos(a) * t0 * 0.6, 0.26 * Math.sin(t0 * 2.4), Math.sin(a) * t0 * 0.6], p1 = [Math.cos(a) * t1 * 0.6, 0.26 * Math.sin(t1 * 2.4), Math.sin(a) * t1 * 0.6], px = -Math.sin(a), pz = Math.cos(a); pos.push(p0[0] - px * w0, p0[1], p0[2] - pz * w0, p0[0] + px * w0, p0[1], p0[2] + pz * w0, p1[0] + px * w1, p1[1], p1[2] + pz * w1, p0[0] - px * w0, p0[1], p0[2] - pz * w0, p1[0] + px * w1, p1[1], p1[2] + pz * w1, p1[0] - px * w1, p1[1], p1[2] - pz * w1); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
  })();
  const paintFrond = (cols, rib, seed) => {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const g = cv.getContext('2d');
    for (let x = 4; x < 250; x += 4) { const len = (1 - x / 256) * 25 + 5; for (const side of [-1, 1]) { g.strokeStyle = cols[(hash2(x, side + 3, seed) * cols.length) | 0]; g.lineWidth = 2.6; g.beginPath(); g.moveTo(x, 32); g.quadraticCurveTo(x + len * 0.4, 32 + side * len * 0.55, x + len * 0.95, 32 + side * len); g.stroke(); } }
    g.strokeStyle = rib; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 32); g.lineTo(256, 32); g.stroke(); return new THREE.CanvasTexture(cv);
  };
  const frondTex = paintFrond(['#6e8f3c', '#5c7d34', '#7f9c48'], '#6b6a35', 41);
  const dryTex = paintFrond(['#c9ad6a', '#b89a58', '#a8844a', '#bfa060'], '#8a6a3a', 43);
  const frond = (() => { const g = new THREE.PlaneGeometry(2.0, 0.6, 10, 1), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i) + 1.0, y = p.getY(i), t = x / 2.0; p.setXYZ(i, x, -0.15 * x * x + 0.25 * x * (1 - t), y * (1 - 0.6 * t)); } g.computeVertexNormals(); return g; })();

  const kit = {
    canopy: gradient(lumpy(new THREE.IcosahedronGeometry(1, 2), 0.35, 2), 0.7, 1.05),
    canopyLod: gradient(lumpy(new THREE.IcosahedronGeometry(1, 1), 0.3, 2), 0.7, 1.05),
    trunk: new THREE.CylinderGeometry(0.7, 1, 1, 8, 1),
    pine: gradient(new THREE.ConeGeometry(1, 1, 10), 0.7, 1.05),
    pineLod: gradient(new THREE.ConeGeometry(1, 1, 6), 0.7, 1.05),
    bush: gradient(lumpy(new THREE.IcosahedronGeometry(1, 2), 0.45, 9), 0.6, 1.05),
    bushLod: gradient(lumpy(new THREE.IcosahedronGeometry(1, 0), 0.3, 9), 0.6, 1.05),
    rock: lumpy(new THREE.IcosahedronGeometry(1, 1), 0.55, 4),
    rockLod: lumpy(new THREE.IcosahedronGeometry(1, 0), 0.4, 4),
    seg: new THREE.CylinderGeometry(1, 1, 1, 8),
    frond, grass: tuft(7, 0.22, 0.2, 0.022, 5), reed: tuft(9, 0.55, 0.45, 0.016, 8), fern,
    pebble: new THREE.IcosahedronGeometry(1, 0), shell: new THREE.SphereGeometry(1, 6, 4),
    driftwood: lumpy(new THREE.CylinderGeometry(0.09, 0.07, 1, 8, 4), 0.5, 7),
    canopyMat: swaying(toon(0xffffff, { vertexColors: true }), 'crown'), pineMat: swaying(toon(0xffffff, { vertexColors: true }), 'pine'), bushMat: swaying(toon(0xffffff, { vertexColors: true }), 'bush'),
    farCanopyMat: toon(0xffffff, { vertexColors: true }),   // the far tiles stand still
    trunkMat: toon(), rockMat: toon(), palmTrunkMat: swaying(toon(), 'palmtrunk'),
    frondMat: swaying(opaqueCutout(toon(0xffffff, { map: frondTex, alphaTest: 0.4, side: THREE.DoubleSide })), 'frond', { outline: false, depthParams: { map: frondTex, alphaTest: 0.4 } }),
    dryFrondMat: swaying(opaqueCutout(toon(0xffffff, { map: dryTex, alphaTest: 0.4, side: THREE.DoubleSide })), 'frond', { outline: false, depthParams: { map: dryTex, alphaTest: 0.4 } }),
    frondStillMat: opaqueCutout(toon(0xffffff, { map: frondTex, alphaTest: 0.4, side: THREE.DoubleSide })),
    frondStillDepth: new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: frondTex, alphaTest: 0.4 }),
    grassMat: swaying(toon(0xffffff, { side: THREE.DoubleSide }), 'grass', { depth: false, outline: false }), fernMat: swaying(toon(0xffffff, { side: THREE.DoubleSide }), 'leaf', { outline: false }), smallMat: toon(),
  };
  kit.frondDepth = kit.frondMat.userData.depthMat; kit.dryFrondDepth = kit.dryFrondMat.userData.depthMat;   // the fronds' shadow, swaying with them
  return kit;
}
