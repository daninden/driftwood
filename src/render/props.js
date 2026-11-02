/**
 * render/props — detailed props, added to a Batch.
 *
 * Every function takes the batch B, the shared kit (render/geometry), the
 * world where it needs heights, a tile PRNG r, and the scattered record
 * from world/vegetation. Order of r() calls matters: it keeps a tile
 * looking the same every time it is built.
 *
 *   addTree(B, kit, t, r)            broadleaf or jungle tree: trunk + blob crown
 *   addPine(B, kit, t, r)            trunk + three cones
 *   addPalm(B, kit, t, r)            curved trunk + fronds
 *   addRoots(B, kit, w, t, r)        roots curling over a wall edge, lianas in arcs
 *   addBeach(B, kit, w, tile, r)     coconuts under palms, bleached driftwood logs
 *   addTideLine(B, kit, w, tile, r, slicer)   generator: seaweed band with shells
 *   rockColor(r, dk?)
 *
 * Depends on: three, core/noise, render/palette, render/geometry
 */
import * as THREE from 'three';
import { pick } from '../core/noise.js';
import { P } from './palette.js';
import { T } from '../world/constants.js';
import { stickMatrix, mat4 } from './geometry.js';

export function rockColor(r, dk) { return new THREE.Color(r() < 0.5 ? P.rock : P.rock2).offsetHSL(0, 0, -0.03 - r() * (dk || 0.07)).getHex(); }

export function addTree(B, kit, t, r) {
  const jg = t.jungle, h = jg ? 2.6 + r() * 1.8 : 1.3 + r() * 1.4, lean = new THREE.Vector3((r() - 0.5) * 0.4, h, (r() - 0.5) * 0.4);
  const base = new THREE.Vector3(t.x, t.y - 0.1, t.z), top = base.clone().add(lean), tm = stickMatrix(base, top, (jg ? 0.15 : 0.1) + r() * 0.05);
  B.add('trunk', kit.trunk, kit.trunkMat, tm, jg ? 0x6a4c34 : P.trunk, { outline: 1.25 });
  const nb = jg ? 5 + (r() * 3 | 0) : 3 + (r() * 2 | 0), cs = (jg ? 1.05 : 0.75) + r() * 0.45, pal = jg ? P.jungle : P.canopy, tint = pick(r, pal);
  for (let k = 0; k < nb; k++) {
    const rad = 0.55 + r() * 0.35, a = r() * Math.PI * 2, rr = r() * (jg ? 0.8 : 0.55), y = top.y + (r() - 0.25) * 0.6 * cs;
    const c = new THREE.Color(r() < 0.75 ? tint : pick(r, pal)).offsetHSL(0, 0, (r() - 0.5) * 0.06).getHex();
    B.add('canopy', kit.canopy, kit.canopyMat, mat4(top.x + Math.cos(a) * rr * cs, y, top.z + Math.sin(a) * rr * cs, rad * cs, rad * cs * 0.85, rad * cs, r() * 6), c, { outline: 1.07 });
  }
}

export function addPine(B, kit, t, r) {
  const h = 1.6 + r() * 1.4, w = 0.45 + r() * 0.2, c = pick(r, P.pine);
  B.add('trunk', kit.trunk, kit.trunkMat, stickMatrix(new THREE.Vector3(t.x, t.y - 0.1, t.z), new THREE.Vector3(t.x, t.y + h * 0.4, t.z), 0.08), P.trunk, { outline: 1.25 });
  for (let k = 0; k < 3; k++) B.add('pine', kit.pine, kit.canopyMat, mat4(t.x, t.y + h * (0.35 + k * 0.22), t.z, w * (1 - k * 0.25), h * 0.42, w * (1 - k * 0.25), r() * 6), c, { outline: 1.08 });
}

const O3 = new THREE.Object3D();
export function addPalm(B, kit, p, r) {
  const o = new THREE.Vector3(p.x, p.y - 0.08, p.z), hgt = 2.4 + r() * 1.4, lean = 0.5 + r() * 0.9, th = Math.atan2(p.z, p.x) + (r() - 0.5) * 1.2, sd = { x: Math.cos(th), z: Math.sin(th) };
  let prev = o.clone();
  for (let i = 0; i < 8; i++) { const t = (i + 1) / 8, q = o.clone().add(new THREE.Vector3(sd.x * lean * t * t, hgt * t, sd.z * lean * t * t)); B.add('palmseg', kit.seg, kit.palmTrunkMat, stickMatrix(prev, q, 0.1 - 0.035 * t), 0x9a8264, { outline: 1.35 }); prev = q; }
  const nf = 8 + (r() * 3 | 0);
  for (let k = 0; k < nf; k++) { O3.position.copy(prev); O3.rotation.order = 'YZX'; O3.rotation.set(0, k / nf * Math.PI * 2 + r() * 0.3, (r() - 0.35) * 0.5); O3.scale.setScalar(0.75 + r() * 0.3); O3.updateMatrix(); B.add('frond', kit.frond, kit.frondMat, O3.matrix.clone(), 0xffffff, { depthMat: kit.frondDepth }); }
}

export function addRoots(B, kit, w, t, r) {
  const { H } = w;
  const gx = H(t.x + 0.3, t.z) - H(t.x - 0.3, t.z), gz = H(t.x, t.z + 0.3) - H(t.x, t.z - 0.3), gl = Math.hypot(gx, gz) || 1, dx = -gx / gl, dz = -gz / gl, sx = -dz, sz = dx;
  const RC = [0xa27c52, 0xb08a5c, 0x9a7650, 0xa8845a];
  const root = (ox, oz, rad, nseg, step, curl, ph) => {
    let px = ox, pz = oz, prev = new THREE.Vector3(px, H(px, pz) + rad * 0.8, pz);
    const col = pick(r, RC), y0 = prev.y, maxDrop = 1.6 + r() * 1.6;
    for (let k = 0; k < nseg; k++) {
      const wv = Math.sin(k * 0.9 + ph) * curl, hs = H(px, pz); let m = 0;
      while (m < 12) { px += dx * step / 12 + sx * wv / 12; pz += dz * step / 12 + sz * wv / 12; m++; if (hs - H(px, pz) > 0.42) break; }
      px += (r() - 0.5) * 0.06; pz += (r() - 0.5) * 0.06;
      const q = new THREE.Vector3(px + dx * rad * 0.5, H(px, pz) + rad * 0.9, pz + dz * rad * 0.5);
      B.add('root', kit.seg, kit.trunkMat, stickMatrix(prev, q, rad), col, { outline: 1.22 });
      B.add('rootj', kit.shell, kit.trunkMat, mat4(q.x, q.y, q.z, rad * 1.08, rad * 1.08, rad * 1.08), col, { outline: 1.22 });
      if ((k === 3 || k === 7) && r() < 0.6) root(px, pz, rad * 0.65, nseg - k - 2, step * 0.8, curl * 1.4, ph + 2);
      prev = q; rad *= 0.86; if (y0 - q.y > maxDrop) break;
    }
  };
  root(t.x - dx * 1.8, t.z - dz * 1.8, 0.11 + r() * 0.06, 14, 0.45, 0.18 + r() * 0.12, r() * 6);
  const nl = r() < 0.75 ? 1 + (r() * 2 | 0) : 0;
  for (let l = 0; l < nl; l++) {
    const off = (r() - 0.5) * 2.4, ax = t.x - dx * (2.0 + r()) + sx * off, az = t.z - dz * (2.0 + r()) + sz * off, A = new THREE.Vector3(ax, H(ax, az) + 2.2 + r() * 1.2, az);
    const free = r() < 0.45, bx = t.x + dx * (0.8 + r()) + sx * (off + (r() - 0.5) * 2), bz = t.z + dz * (0.8 + r()) + sz * (off + (r() - 0.5) * 2);
    const Bp = free ? new THREE.Vector3(A.x + dx * 0.9, A.y - 1.6 - r() * 1.6, A.z + dz * 0.9) : new THREE.Vector3(bx, H(bx, bz) + 0.05, bz), sag = free ? 0.25 : 0.9 + r() * 0.8;
    const N = 14, lc = pick(r, [0x6a7a3a, 0x75843e, 0x5f7034]); let prev = A;
    for (let i = 1; i <= N; i++) {
      const u = i / N, q = new THREE.Vector3().lerpVectors(A, Bp, u);
      q.y -= sag * Math.sin(Math.PI * u) * (free ? u : 1); q.x += dx * 0.5 * Math.sin(Math.PI * u) + sx * 0.12 * Math.sin(u * 9); q.z += dz * 0.5 * Math.sin(Math.PI * u) + sz * 0.12 * Math.sin(u * 9);
      q.y = Math.max(q.y, H(q.x, q.z) + 0.05);
      B.add('liana', kit.seg, kit.trunkMat, stickMatrix(prev, q, 0.05 * (1 - u * 0.3)), lc, { outline: 1.25 });
      if (i % 2 === 0 || (free && i > N - 4)) { const a = r() * 6; B.add('lleaf', kit.shell, kit.trunkMat, mat4(q.x + Math.cos(a) * 0.08, q.y - 0.03, q.z + Math.sin(a) * 0.08, 0.2, 0.03, 0.1, a, (r() - 0.5) * 1.2, 0.6), pick(r, [0x5c7a36, 0x6a8a3c, 0x7f9c48, 0x4f6c30]), {}); }
      prev = q;
    }
  }
}

export function addBeach(B, kit, w, tile, r) {
  const { H, slope, Lat } = w;
  tile.palms.forEach(t => { if (r() < 0.6) for (let c = 0, n = 1 + (r() * 3 | 0); c < n; c++) { const a = r() * 6, d = 0.3 + r() * 0.9, x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d; B.add('coco', kit.shell, kit.smallMat, mat4(x, H(x, z) + 0.07, z, 0.1, 0.085, 0.09, a), pick(r, [0x7a5a36, 0x6a4c2e, 0x8a6a3e]), { outline: 1.15 }); } });
  for (let n = 0; n < 26; n++) {
    const x = tile.x0 + r() * T, z = tile.z0 + r() * T, y = H(x, z); if (!(y > 0.25 && y < 1.1 && slope(x, z) < 0.35 && Lat(x, z) < 0.35) || r() > 0.5) continue;
    const len = 0.9 + r() * 1.3, a = r() * Math.PI, ca = Math.cos(a), sa = Math.sin(a), rad = 0.07 + r() * 0.06, col = pick(r, [0xa8987c, 0x9a8a70, 0xb4a68c, 0x8e8068]);
    const A = new THREE.Vector3(x - ca * len / 2, 0, z - sa * len / 2), Bv = new THREE.Vector3(x + ca * len / 2, 0, z + sa * len / 2);
    A.y = Math.max(H(A.x, A.z), y - 0.2) + rad * 0.7; Bv.y = Math.max(H(Bv.x, Bv.z), y - 0.2) + rad * 0.6;
    B.add('log', kit.driftwood, kit.smallMat, stickMatrix(A, Bv, rad / 0.09), col, { outline: 1.12 });
    if (r() < 0.6) { const u = 0.3 + r() * 0.5, P0 = new THREE.Vector3().lerpVectors(A, Bv, u), side = r() < 0.5 ? 1 : -1, bl = 0.5 + r() * 0.7, P1 = P0.clone().add(new THREE.Vector3((ca * 0.6 - sa * side) * bl, 0.15 + r() * 0.3, (sa * 0.6 + ca * side) * bl)); B.add('logb', kit.driftwood, kit.smallMat, stickMatrix(P0, P1, rad * 0.4 / 0.09), col, { outline: 1.15 }); }
    if (r() < 0.35) for (let k = 0; k < 5; k++) { const ang = k / 5 * Math.PI * 2 + r(), P1 = A.clone().add(new THREE.Vector3(-ca * 0.15 + Math.cos(ang) * -sa * 0.45, Math.sin(ang) * 0.4 + 0.1, -sa * 0.15 + Math.cos(ang) * ca * 0.45)); P1.y = Math.max(P1.y, H(P1.x, P1.z) + 0.03); B.add('logr', kit.driftwood, kit.smallMat, stickMatrix(A, P1, rad * 0.35 / 0.09), col, { outline: 1.15 }); }
  }
}

export function* addTideLine(B, kit, w, tile, r, slicer) {
  const { H, Lat } = w, { vnoise } = w.noise, m = 240;
  for (let j = 0; j < m; j++) {
    for (let i = 0; i < m; i++) {
      const x = tile.x0 + (i + r()) * T / m, z = tile.z0 + (j + r()) * T / m, y = H(x, z); if (y < 0.12 || y > 0.4) continue;
      const mid = 0.24 + (vnoise(x * 0.08, z * 0.08) - 0.5) * 0.1, d = Math.abs(y - mid), gap = vnoise(x * 0.25 + 9, z * 0.25 + 3);
      if (d > 0.035 * (0.6 + gap) || gap < 0.3 || r() > 0.7 || Lat(x, z) > 0.3) continue;
      const a = r() * 6, l = 0.06 + r() * 0.12;
      B.add('weed', kit.shell, kit.smallMat, mat4(x, y + 0.006, z, l, 0.01, 0.02 + r() * 0.015, a), pick(r, [0x4a5428, 0x5a4a2a, 0x3e4824, 0x6a5a30, 0x2f3a22, 0x55602e]), { cast: false });
      if (r() < 0.03) B.add('shell', kit.shell, kit.smallMat, mat4(x + 0.06, y + 0.01, z, 0.045, 0.018, 0.055, a), pick(r, [0xf6f0e4, 0xeedccd, 0xe8c8b0]), { cast: false });
      else if (r() < 0.012) { const L2 = 0.25 + r() * 0.35; B.add('twig', kit.driftwood, kit.smallMat, mat4(x, y + 0.03, z, 0.35, L2, 0.35, a, 0, Math.PI / 2), pick(r, [0xb8ab94, 0xa89a84]), { cast: false }); }
    }
    if (slicer.over()) yield;
  }
}
