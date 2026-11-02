/**
 * render/terrainTile — the ground mesh and painted texture of one tile.
 *
 * Geometry: an (n+1)² grid over the 40 × 40 tile with a one-cell skirt
 * that hangs 1.2 down, so neighbouring tiles of different detail never
 * show cracks. Normals come from the heightfield.
 * Texture: every pixel is colorAt (render/terrainColor), then thousands of
 * soft brush strokes in the local colour give the hand-painted look.
 *
 * Both are generators that yield when the slicer's frame budget is spent.
 *   tileGeometry(world, tile, n, slicer)          -> BufferGeometry
 *   tileTexture(world, colorAt, tile, size, slicer) -> CanvasTexture
 * Use drain() from core/slicer to build them in one go.
 *
 * Depends on: three, core/noise, world/constants
 */
import * as THREE from 'three';
import { mulberry32, hashInt } from '../core/noise.js';
import { T } from '../world/constants.js';

export function* tileGeometry(w, tile, n, slicer) {
  const { H } = w, N = n + 3, pos = new Float32Array(N * N * 3), nor = new Float32Array(N * N * 3), uv = new Float32Array(N * N * 2), e = T / n;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const ii = Math.min(n, Math.max(0, i - 1)), jj = Math.min(n, Math.max(0, j - 1)), x = tile.x0 + ii / n * T, z = tile.z0 + jj / n * T, skirt = i === 0 || j === 0 || i === N - 1 || j === N - 1, o = j * N + i;
      pos[o * 3] = x; pos[o * 3 + 1] = H(x, z) - (skirt ? 1.2 : 0); pos[o * 3 + 2] = z;
      const nx = H(x - e, z) - H(x + e, z), nz = H(x, z - e) - H(x, z + e), l = Math.hypot(nx, 2 * e, nz); nor[o * 3] = nx / l; nor[o * 3 + 1] = 2 * e / l; nor[o * 3 + 2] = nz / l;
      uv[o * 2] = ii / n; uv[o * 2 + 1] = 1 - jj / n;
    }
    if (slicer && slicer.over()) yield;
  }
  const idx = new Uint32Array((N - 1) * (N - 1) * 6); let q = 0;
  for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) { const a = j * N + i, b = a + 1, c = a + N, d = c + 1; idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

export function* tileTexture(w, colorAt, tile, size, slicer, anisotropy = 4) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const g = cv.getContext('2d'), img = g.createImageData(size, size), d = img.data;
  for (let py = 0; py < size; py++) {
    const z = tile.z0 + (py + 0.5) / size * T;
    for (let px = 0; px < size; px++) { const x = tile.x0 + (px + 0.5) / size * T, c = colorAt(x, z), i = (py * size + px) * 4; d[i] = c[0] * 255; d[i + 1] = c[1] * 255; d[i + 2] = c[2] * 255; d[i + 3] = 255; }
    if (slicer && slicer.over()) yield;
  }
  g.putImageData(img, 0, 0);
  const r2 = mulberry32(hashInt(w.seed + 5, tile.tx, tile.tz)), k = size / 1024, n = Math.round(21000 * k * k);
  for (let s = 0; s < n; s++) {
    const px = r2() * size, py = r2() * size, x = tile.x0 + px / size * T, z = tile.z0 + py / size * T, a = r2(), b = r2(), e = r2(), f0 = 0.86 + r2() * 0.26;
    if (w.H(x, z) < -4) continue;
    const c = colorAt(x, z); g.fillStyle = 'rgba(' + (c[0] * f0 * 255 | 0) + ',' + (c[1] * f0 * 255 | 0) + ',' + (c[2] * f0 * 255 | 0) + ',0.55)';
    g.setTransform(1, 0, 0, 1, px, py); g.rotate(0.6 + (a - 0.5) * 0.7); g.beginPath();
    g.ellipse(0, 0, Math.max(0.6, (3 + b * 5) * k * 4) / 4 * (k < 0.5 ? 2 : 1), Math.max(0.4, (1 + e * 1.3) * k), 0, 0, Math.PI * 2); g.fill();
    if ((s & 255) === 0 && slicer && slicer.over()) { g.setTransform(1, 0, 0, 1, 0, 0); yield; }
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.anisotropy = anisotropy; return t;
}
