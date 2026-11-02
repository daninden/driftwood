/**
 * render/terrainTile — the ground mesh and painted texture of one tile.
 *
 * Geometry: an (n+1)² grid over the 40 × 40 tile with a one-cell skirt
 * that hangs 1.2 down, so neighbouring tiles of different detail never
 * show cracks. Normals come from the heightfield.
 * Texture: the ground colour colorAt (render/terrainColor), sampled every
 * second pixel on detailed tiles and blended in between, then thousands of
 * soft brush strokes in the local colour give the hand-painted look.
 *
 * Both are generators that yield when the slicer's frame budget is spent.
 *   tileGeometry(world, tile, n, slicer)          -> BufferGeometry
 *   tileTexture(world, colorAt, tile, size, slicer) -> CanvasTexture
 *   paintStroke(data, size, cx, cy, rot, rx, ry, r, g, b, alpha)   one brush
 *     stroke blended into RGBA pixel data
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

/**
 * A soft, rotated ellipse blended straight into RGBA pixel data, the way the
 * canvas would draw it (rotation rot, radii rx along and ry across, colour
 * r g b at alpha, edges anti-aliased over about one pixel). Painting the
 * 21 000 strokes of a tile this way instead of through the canvas API is
 * many times faster.
 */
export function paintStroke(d, size, cx, cy, rot, rx, ry, r, g, b, alpha) {
  const c = Math.cos(rot), s = Math.sin(rot), ext = Math.max(rx, ry) + 1;
  const x0 = Math.max(0, Math.floor(cx - ext)), x1 = Math.min(size - 1, Math.ceil(cx + ext)), y0 = Math.max(0, Math.floor(cy - ext)), y1 = Math.min(size - 1, Math.ceil(cy + ext));
  const soft = Math.min(rx, ry);
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - cy;
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, u = (dx * c + dy * s) / rx, v = (dy * c - dx * s) / ry, q = Math.sqrt(u * u + v * v);
      let cov = (1 - q) * soft + 0.5; if (cov <= 0) continue; if (cov > 1) cov = 1;
      const al = alpha * cov, i = (y * size + x) * 4;
      d[i] += (r - d[i]) * al; d[i + 1] += (g - d[i + 1]) * al; d[i + 2] += (b - d[i + 2]) * al;
    }
  }
}

export function* tileTexture(w, colorAt, tile, size, slicer, anisotropy = 4) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const g = cv.getContext('2d'), img = g.createImageData(size, size), d = img.data;
  // The ground colour is sampled every STEP pixels and blended in between: it
  // changes slowly, and the brush strokes on top carry the fine detail.
  const st = size >= 512 ? 2 : 1, m = size / st + 1, grid = new Float32Array(m * m * 3);
  for (let gy = 0; gy < m; gy++) {
    const z = tile.z0 + (gy * st + 0.5) / size * T;
    for (let gx = 0; gx < m; gx++) { const c = colorAt(tile.x0 + (gx * st + 0.5) / size * T, z), o = (gy * m + gx) * 3; grid[o] = c[0] * 255; grid[o + 1] = c[1] * 255; grid[o + 2] = c[2] * 255; }
    if (slicer && slicer.over()) yield;
  }
  for (let py = 0; py < size; py++) {
    const gy = (py / st) | 0, ty = (py - gy * st) / st;
    for (let px = 0; px < size; px++) {
      const gx = (px / st) | 0, tx = (px - gx * st) / st, o = (gy * m + gx) * 3, i = (py * size + px) * 4;
      for (let k = 0; k < 3; k++) { const a = grid[o + k], b = grid[o + 3 + k], c = grid[o + m * 3 + k], e = grid[o + m * 3 + 3 + k]; d[i + k] = a + (b - a) * tx + (c - a) * ty + (a - b - c + e) * tx * ty; }
      d[i + 3] = 255;
    }
  }
  const r2 = mulberry32(hashInt(w.seed + 5, tile.tx, tile.tz)), k = size / 1024, n = Math.round(21000 * k * k);
  for (let s = 0; s < n; s++) {
    const px = r2() * size, py = r2() * size, x = tile.x0 + px / size * T, z = tile.z0 + py / size * T, a = r2(), b = r2(), e = r2(), f0 = 0.86 + r2() * 0.26;
    if (w.H(x, z) < -4) continue;
    const c = colorAt(x, z);
    paintStroke(d, size, px, py, 0.6 + (a - 0.5) * 0.7, Math.max(0.6, (3 + b * 5) * k * 4) / 4 * (k < 0.5 ? 2 : 1), Math.max(0.4, (1 + e * 1.3) * k), (c[0] * f0 * 255 | 0), (c[1] * f0 * 255 | 0), (c[2] * f0 * 255 | 0), 0.55);
    if ((s & 1023) === 0 && slicer && slicer.over()) yield;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.anisotropy = anisotropy; return t;
}
