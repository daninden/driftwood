/**
 * render/terrainColor — the painted colour of the ground at a point.
 *
 * Mixes sand, wet sand, seabed, terrace ground (open vs forest floor),
 * river banks and beds, passage colours (scree, ravine, roots, moss beside
 * falls), rock on steep slopes with horizontal banding, and occlusion.
 * Steep walls get extra rock detail in the shader (render/materials).
 *
 * createTerrainColor(world) -> colorAt(x, z) -> [r, g, b] in 0..1
 *
 * Plain maths, no Three.js, so it is tested in Node against a golden file.
 *
 * Depends on: core/math, render/palette; reads world queries
 */
import { ss, hex, mix } from '../core/math.js';
import { P, PC, TG } from './palette.js';

const C_SOIL = hex(0x8a7650), C_BED = hex(0x8d8a6e);

export function createTerrainColor(w) {
  const { H, Lat, slope, tierAt, forestB, forestF, riverAt, passAt, fallRouteAt, aoAt } = w;
  const { vnoise } = w.noise;
  const ground = (k, n1, n2, n3, F) => { const t = TG[k]; return mix(mix(t.o, t.o2, n1), mix(t.f, t.f2, n2), ss(0.15, 0.75, F + (n2 - 0.5) * 0.2)); };

  return function colorAt(x, z) {
    const y = H(x, z), sl = slope(x, z), L = Lat(x, z), n1 = vnoise(x * 0.3 + 5, z * 0.3 + 1), n2 = vnoise(x * 1.3, z * 1.3), n3 = vnoise(x * 4, z * 4);
    let c = mix(PC.sand, PC.sand2, n2);
    c = mix(c, PC.wet, 1 - ss(0.04, 0.32, y));
    if (y < 0) { c = mix(c, PC.seabed, ss(0, -2.4, y)); c = mix(c, PC.waterDeep, ss(-1.5, -9, y) * 0.55); }
    if (L > 0) {
      const k = tierAt(L), f = L - Math.floor(L), b = forestB(x, z);
      const extra = k === 3 ? ss(0.45, 0.7, vnoise(x * 0.08 + 3, z * 0.08 + 7)) : k === 4 ? ss(0.5, 0.8, vnoise(x * 0.2, z * 0.2 + 5)) : 0;
      let gc = ground(k, n1, n2, n3, k >= 3 ? Math.max(forestF(k, b), extra) : forestF(k, b));
      if (k < 4) gc = mix(gc, ground(k + 1, n1, n2, n3, forestF(k + 1, b)), ss(0.86, 1.0, f) * 0.8);
      c = mix(c, gc, k === 0 ? ss(0.9, 1.4, y + (n1 - 0.5) * 0.4) : 1);
    }
    const rv = riverAt(x, z);
    if (rv) {
      const delta = rv.rv.main ? ss(rv.rv.tMouth - 0.06, rv.rv.tMouth - 0.02, rv.t) : 0, bank = 1 - ss(rv.hw - 0.2, rv.hw + 1.3 + n1 * 0.6, rv.d);
      if (bank > 0 && y > -0.3 && y < rv.lw + 1.5) c = mix(c, mix(mix(C_SOIL, PC.rock2, n2 * 0.5), PC.wet, delta), bank * (0.7 - 0.45 * delta));
      if (y < rv.lw - 0.02 && rv.d < rv.hw + 0.4) { const bed = mix(mix(C_BED, PC.rock2, n3 * 0.6), PC.wet, delta); c = mix(bed, mix(bed, PC.seabed, 0.5), ss(0, 0.8, rv.lw - y)); }
    }
    const pa = passAt(x, z, L);
    if (pa.scree > 0.05) c = mix(c, mix(hex(0xa69d8f), hex(0x857d71), n3 * 0.7 + n2 * 0.3), ss(0.05, 0.5, pa.scree) * 0.9);
    if (pa.ravine > 0.05) c = mix(c, mix(PC.rock2, hex(0x6f7b4c), n2 * 0.6), ss(0.05, 0.5, pa.ravine) * 0.75);
    if (pa.roots > 0.05) c = mix(c, mix(hex(0x5e5034), hex(0x4f6634), n2), ss(0.05, 0.5, pa.roots) * 0.55);
    const fr = rv ? fallRouteAt(x, z) : 0; if (fr > 0) c = mix(c, mix(hex(0x6a7a48), hex(0x55663a), n2), fr * 0.55);
    const rk = Math.max(ss(0.75, 1.25, sl) * ss(0.3, 1.6, y) * (1 - ss(0.2, 0.6, pa.scree)) * (1 - fr * 0.6), ss(0.9, 1.4, sl) * (y < 0.3 && y > -2.5 ? 0.8 : 0), ss(4.3, 4.9, L) * 0.85);
    c = mix(c, mix(mix(PC.rock, PC.rock2, n2), mix(hex(0x8d887f), hex(0x77736c), n2), ss(4.1, 4.6, L)), rk);
    if (rk > 0.3) { const band = 0.9 + 0.12 * Math.sin(y * 4.2 + n1 * 4 + n2 * 1.5); c = mix(c, [c[0] * band, c[1] * band, c[2] * band], rk); }
    c = mix(c, PC.peak, ss(5.3, 5.8, L) * 0.2);
    const v = (1 + (n3 - 0.5) * P.noise) * aoAt(x, z, y);
    return [c[0] * v, c[1] * v, c[2] * v];
  };
}
