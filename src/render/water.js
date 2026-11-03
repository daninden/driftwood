/**
 * render/water — sea, rivers and everything that stays loaded all the time.
 *
 *   sea floor, two translucent sea planes
 *   river ribbons: vertex colour (white where it runs fast or falls) and a
 *     per-vertex alpha that fades at the banks; at the mouth the water runs
 *     down with the tide to wherever the sea stands, and fades into it
 *   surf foam along the shore, for each of the FOAM_LEVELS of the tide (the
 *     levels next to the current sea level fade in), foam and spray at the
 *     foot of waterfalls
 *
 * buildWater(world, kit, scene) -> { setSea(level) }
 *   setSea moves the sea planes, the surf and the river mouths with the
 *   tide (game/tide)
 * FOAM_LEVELS, foamWeights(level) -> weight 0..1 per foam level, pure
 *
 * Depends on: three, core/*, render/palette, render/materials, render/batch
 */
import * as THREE from 'three';
import { mulberry32 } from '../core/noise.js';
import { ss, lerp, hex, mix } from '../core/math.js';
import { P, PC } from './palette.js';
import { toon, outlineMat } from './materials.js';
import { Batch } from './batch.js';
import { mat4 } from './geometry.js';

export const FOAM_LEVELS = [0, -0.1, -0.2, -0.3, -0.4];
const FOAM_STEP = 0.1;
export const foamWeights = s => FOAM_LEVELS.map(l => Math.max(0, 1 - Math.abs(s - l) / FOAM_STEP));

function perpOf(rv, k) { const a = rv.pts[Math.max(0, k - 2)], b = rv.pts[Math.min(rv.n - 1, k + 2)], l = Math.hypot(b.x - a.x, b.z - a.z) || 1; return { x: -(b.z - a.z) / l, z: (b.x - a.x) / l }; }

const LOW = -0.5;   // a main river's ribbon runs on past its mouth until its water is this far below high water

function riverRibbon(w, rv, sea) {
  const { hash2 } = w.noise, pos = [], col = [], al = [], lvs = [], idx = [], X = 7, wc = hex(P.water), white = [1, 1, 1];
  let kEnd = rv.n - 1;
  if (rv.main) { kEnd = rv.kMouth; while (kEnd < rv.n - 1 && rv.L(kEnd / (rv.n - 1)) > LOW) kEnd++; }
  let rows = 0;
  for (let k = 0; k <= kEnd; k++) {
    const p = rv.pts[k], pp = perpOf(rv, k), t = k / (rv.n - 1), hw = rv.W(t) / 2 + 0.35, lw = rv.LW(t) + 0.015;
    const sl = rv.LW(Math.max(0, k - 2) / (rv.n - 1)) - rv.LW(Math.min(rv.n - 1, k + 2) / (rv.n - 1));
    let foam = ss(0.25, 1.1, sl); rv.falls.forEach(f => { foam = Math.max(foam, Math.exp(-(((k - f.base - 3) / 5) ** 2)) * 0.75); });
    const fade = rv.main ? 1 : 1 - ss(rv.n - 12, rv.n - 1, k), lv = rv.L(t);
    for (let c = 0; c < X; c++) {
      const u = c / (X - 1) * 2 - 1; pos.push(p.x + pp.x * u * hw, lw, p.z + pp.z * u * hw); lvs.push(lv);
      const f = Math.min(1, foam * (0.88 + (hash2(k >> 1, c, 5) - 0.5) * 0.3) + Math.abs(u) * 0.08), cc = mix(wc, white, f); col.push(cc[0], cc[1], cc[2]);
      al.push(lerp(0.74, 0.95, ss(0.4, 1.2, sl)) * fade * (1 - 0.6 * ss(0.75, 1, Math.abs(u))));
    }
    if (rows > 0) for (let c = 0; c < X - 1; c++) { const a = (rows - 1) * X + c, b = rows * X + c; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    rows++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('alpha', new THREE.Float32BufferAttribute(al, 1)); g.setAttribute('lv', new THREE.Float32BufferAttribute(lvs, 1));
  g.setIndex(idx); g.computeVertexNormals();
  const mt = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, roughness: 0.25, metalness: 0, depthWrite: false, side: THREE.DoubleSide });
  mt.onBeforeCompile = sh => {
    // the water stands at its own level, or at the sea's where that is higher, and fades into the sea
    sh.uniforms.uSea = sea;
    sh.vertexShader = 'attribute float alpha;\nattribute float lv;\nuniform float uSea;\nvarying float vA;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y = max(lv, uSea) + 0.015;\nvA = alpha * smoothstep(uSea - 0.3, uSea + 0.15, lv);');
    sh.fragmentShader = 'varying float vA;\n' + sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.a *= vA;');
  };
  const m = new THREE.Mesh(g, mt); m.renderOrder = 4; m.receiveShadow = true; return m;
}

export function buildWater(w, kit, scene) {
  const { H, Lat, slope } = w;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), toon(new THREE.Color().setRGB(...mix(PC.seabed, PC.waterDeep, 0.55)).getHex())); floor.position.y = -9.05; scene.add(floor);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: P.water, transparent: true, opacity: 0.5, roughness: 0.15, metalness: 0, depthWrite: false })); sea.renderOrder = 2; scene.add(sea);
  const seaTop = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: P.waterDeep, transparent: true, opacity: 0.18, roughness: 0.1, depthWrite: false })); seaTop.position.y = 0.005; seaTop.renderOrder = 3; scene.add(seaTop);
  const seaU = { value: 0 };
  w.rivers.forEach(rv => { const m = riverRibbon(w, rv, seaU); m.frustumCulled = false; scene.add(m); });

  const foamGeo = new THREE.CircleGeometry(1, 10).rotateX(-Math.PI / 2);
  const foamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false });
  const B = new Batch(outlineMat), r = mulberry32(w.seed + 77);
  // the surf at each level of the tide: a ring where the sea meets the sand, a fainter one further out
  const surf = FOAM_LEVELS.map(l => {
    const m1 = foamMat.clone(), m2 = foamMat.clone(); m2.opacity = 0.4;
    const g = new THREE.Group(); g.position.y = l; scene.add(g);
    return { l, g, m1, m2, B: new Batch(outlineMat) };
  });
  w.tiles.forEach(tl => {
    if (tl.hmax < -8.9) return; const n = 80;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = tl.x0 + (i + r()) * 0.5, z = tl.z0 + (j + r()) * 0.5, y = H(x, z);
      if (y > 0.05 || y < -0.85) continue;
      for (const f of surf) {
        const d = y - f.l;
        if (Math.abs(d) < 0.05 && r() < 0.5) f.B.add('f', foamGeo, f.m1, mat4(x, 0.02, z, 0.15 + r() * 0.25, 1, 0.08 + r() * 0.12, r() * 6), 0xffffff, { cast: false, order: 6 });
        else if (d > -0.42 && d < -0.32 && r() < 0.35) f.B.add('f2', foamGeo, f.m2, mat4(x, 0.02, z, 0.2 + r() * 0.3, 1, 0.06 + r() * 0.08, r() * 6), 0xffffff, { cast: false, order: 6 });
      }
    }
  });
  surf.forEach(f => f.B.build(f.g));
  const sprayMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, depthWrite: false }), sprayGeo = new THREE.IcosahedronGeometry(1, 2);
  w.rivers.forEach(rv => rv.falls.forEach(f => {
    const pb = rv.pts[Math.min(rv.n - 1, f.base + 3)], lw = rv.LW(f.base / (rv.n - 1)) + 0.03, wd = rv.W(f.base / (rv.n - 1));
    for (let n = 0; n < 60; n++) { const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * wd * 0.55; B.add('fr', foamGeo, foamMat, mat4(pb.x + Math.cos(a) * rr, lw, pb.z + Math.sin(a) * rr, 0.15 + r() * 0.3, 1, 0.08 + r() * 0.14, r() * 6), 0xffffff, { cast: false, order: 6 }); }
    const fp = rv.pts[f.base];
    for (let n = 0; n < 10; n++) { const s = 0.35 + r() * 0.6, m = new THREE.Mesh(sprayGeo, sprayMat); m.position.set(fp.x + (r() - 0.5) * 1.6, lw + 0.2 + r() * 0.9, fp.z + (r() - 0.5) * 1.6); m.scale.set(s, s * 0.7, s); m.renderOrder = 7; scene.add(m); }
  }));
  B.build(scene);

  function setSea(s) {
    sea.position.y = s; seaTop.position.y = s + 0.005; seaU.value = s;
    foamWeights(s).forEach((k, i) => { const f = surf[i]; f.g.visible = k > 0.001; f.m1.opacity = 0.7 * k; f.m2.opacity = 0.4 * k; });
  }
  setSea(0);
  return { setSea };
}
