/**
 * render/water — sea, rivers and everything that stays loaded all the time.
 *
 *   sea floor, two translucent sea planes
 *   river ribbons: vertex colour (white where it runs fast or falls) and a
 *     per-vertex alpha that fades at the banks; at the mouth the water runs
 *     down with the tide to wherever the sea stands, and fades into it
 *   fords (world/rivers) are recognisable by nature only: whiter, rippling
 *     water, a dozen small stones sticking out of it, gravel on the bed and a
 *     few foam flecks below the stones. Render-only (own PRNG) and not in
 *     tile.rocks, so they never block movement
 *   surf foam along the shore, for each of the FOAM_LEVELS of the tide (the
 *     levels next to the current sea level fade in), foam and spray at the
 *     foot of waterfalls
 *
 * Moving water (0.14), all in the existing water shaders, no extra objects:
 *   rivers: the ribbon carries a flow coordinate per vertex (rf = distance
 *     along the river measured in flow time, so a pattern that moves with
 *     the time moves at flowSpeed(..) metres a second wherever it is, across
 *     the ribbon in metres, how white the water is). Light streaks and flecks
 *     drift downstream, faster on steep stretches, fords and falls; the white
 *     water there breaks up and moves
 *   sea: the sea plane's normal gets a slow long swell and, on its crests,
 *     fine ripples, so the sun, the moon and the fire glint (the lights do
 *     the work: faint and silvery at night, warm by a fire or torch); faint
 *     pale lines of swell by day. A blurred land mask (calmField, a small
 *     texture) calms the lagoons and sheltered bays
 *   surf: the water level the sea planes, the surf and the river mouths use
 *     breathes up and down a few centimetres every few seconds (breath) on
 *     top of the tide, so the water edge slides up and down the beach
 *
 * Rain (0.21): a uniform uRain (0..1, the intensity of the shower) lets small rings spread and fade on the sea and the
 *   rivers (rainRings in RAIN_GLSL: a grid of cells, each with a drop of its own now and then, a thin ring growing
 *   from it); nothing else changes, and with uRain at 0 the shader does the same as before.
 *
 * buildWater(world, kit, scene) -> { setSea(level), tick(dt, day, rain?), clock }
 *   setSea moves the sea planes, the surf and the river mouths with the
 *   tide (game/tide) plus the breath; tick advances the water's own clock
 *   (any frame rate: it moves as fast as frames are drawn) and takes the
 *   daylight (0..1) that fades the pale lines of the swell at night; clock is the water's own time in
 *   seconds (the sound of the surf, audio/mix, breathes with it)
 * FOAM_LEVELS, foamWeights(level) -> weight 0..1 per foam level, pure
 * flowSpeed(slope, ford, fall) -> m/s a river's water moves, pure
 * breath(t) -> metres the water level breathes at time t, pure
 * calmField(world) -> { n, data } 0..255 calm per 5 m cell (lagoons high), pure
 *
 * Depends on: three, core/*, world/constants (sizes only), render/palette, render/materials, render/batch, render/props (rockColor)
 */
import * as THREE from 'three';
import { mulberry32 } from '../core/noise.js';
import { ss, lerp, hex, mix } from '../core/math.js';
import { S, HALF } from '../world/constants.js';
import { P, PC } from './palette.js';
import { toon, outlineMat } from './materials.js';
import { Batch } from './batch.js';
import { mat4 } from './geometry.js';
import { rockColor } from './props.js';

export const FOAM_LEVELS = [0, -0.1, -0.2, -0.3, -0.4];
const FOAM_STEP = 0.1;
export const foamWeights = s => FOAM_LEVELS.map(l => Math.max(0, 1 - Math.abs(s - l) / FOAM_STEP));


/** Speed of a river's water in m/s: slow in the calm, quicker down a steep stretch, over a ford and fastest down a fall (all three 0..1 or a drop per 2 m). */
export const flowSpeed = (slope, ford, fall) => Math.min(3, 0.5 + 1.4 * ss(0.05, 1.1, slope) + 0.6 * ford + 1.2 * fall);

/** How far the water level breathes (metres) at time t: a slow swell of about 6.5 s with a longer one on top, at most 0.05. */
export const breath = t => 0.03 * Math.sin(t * 0.97) + 0.015 * Math.sin(t * 0.55 + 1.3);

const CALM_N = 144, CALM_R = 12;   // cells of 5 m; the land is looked at within 60 m
/** Where the sea is sheltered by land (lagoons, bays): a blurred land mask, 0..255 per cell of the square S x S, row 0 at -HALF. Open sea and the coast itself stay 0. */
export function calmField(w) {
  const n = CALM_N, cell = S / n, sat = new Float32Array((n + 1) * (n + 1));
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const land = w.Lat(-HALF + (i + 0.5) * cell, -HALF + (j + 0.5) * cell) >= 0 ? 1 : 0;
    sat[(j + 1) * (n + 1) + i + 1] = land + sat[j * (n + 1) + i + 1] + sat[(j + 1) * (n + 1) + i] - sat[j * (n + 1) + i];
  }
  const data = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const i0 = Math.max(0, i - CALM_R), i1 = Math.min(n, i + CALM_R + 1), j0 = Math.max(0, j - CALM_R), j1 = Math.min(n, j + CALM_R + 1);
    const sum = sat[j1 * (n + 1) + i1] - sat[j0 * (n + 1) + i1] - sat[j1 * (n + 1) + i0] + sat[j0 * (n + 1) + i0];
    data[j * n + i] = Math.round(255 * ss(0.5, 0.8, sum / ((i1 - i0) * (j1 - j0))));
  }
  return { n, data };
}

// GLSL shared by the water shaders: a cheap value noise
const NOISE_GLSL = `
float wHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wHash(i), wHash(i + vec2(1.0, 0.0)), f.x), mix(wHash(i + vec2(0.0, 1.0)), wHash(i + vec2(1.0, 1.0)), f.x), f.y); }
`;

// rings of rain drops: cells of a metre, each with a drop of its own (a chance of uRain), a ring growing to 0.2 m while it fades
const RAIN_GLSL = `
uniform float uRain;
float rainRings(vec2 p, float t) {
  float acc = 0.0;
  for (int i = 0; i < 2; i++) {
    vec2 q = p * (1.0 + 0.7 * float(i)) + 17.0 * float(i), id = floor(q), f = fract(q);
    float h = wHash(id), on = step(h, uRain * 0.55);
    vec2 c = vec2(wHash(id + 3.1), wHash(id + 7.7)) * 0.4 + 0.3;
    float age = fract(t * (0.5 + 0.4 * wHash(id + 1.3)) + h * 9.0);
    acc += on * smoothstep(0.035, 0.0, abs(length(f - c) - age * 0.26)) * (1.0 - age) * (1.0 - age);
  }
  return clamp(acc, 0.0, 1.0);
}
`;

function perpOf(rv, k) { const a = rv.pts[Math.max(0, k - 2)], b = rv.pts[Math.min(rv.n - 1, k + 2)], l = Math.hypot(b.x - a.x, b.z - a.z) || 1; return { x: -(b.z - a.z) / l, z: (b.x - a.x) / l }; }

const LOW = -0.5;   // a main river's ribbon runs on past its mouth until its water is this far below high water

function riverRibbon(w, rv, sea, uT, uDay, uRain) {
  const { hash2 } = w.noise, pos = [], col = [], al = [], lvs = [], rfs = [], idx = [], X = 7, wc = hex(P.water), white = [1, 1, 1];
  let kEnd = rv.n - 1;
  if (rv.main) { kEnd = rv.kMouth; while (kEnd < rv.n - 1 && rv.L(kEnd / (rv.n - 1)) > LOW) kEnd++; }
  let rows = 0, q = 0;
  for (let k = 0; k <= kEnd; k++) {
    const p = rv.pts[k], pp = perpOf(rv, k), t = k / (rv.n - 1), hw = rv.W(t) / 2 + 0.35, lw = rv.LW(t) + 0.015;
    const sl = rv.LW(Math.max(0, k - 2) / (rv.n - 1)) - rv.LW(Math.min(rv.n - 1, k + 2) / (rv.n - 1));
    let foam = ss(0.25, 1.1, sl), fall = 0; rv.falls.forEach(f => { const g = Math.exp(-(((k - f.base - 3) / 5) ** 2)); fall = Math.max(fall, g); foam = Math.max(foam, g * 0.75); });
    foam = Math.max(foam, rv.fordAt(k) * 0.55);   // fords run whiter: shallow, rippling water
    // flow time along the river (seconds a drifting speck needs to get here), so patterns moving with the clock move at flowSpeed
    if (k > 0) q += Math.hypot(p.x - rv.pts[k - 1].x, p.z - rv.pts[k - 1].z) / flowSpeed(sl, rv.fordAt(k), fall);
    const fade = rv.main ? 1 : 1 - ss(rv.n - 12, rv.n - 1, k), lv = rv.L(t);
    for (let c = 0; c < X; c++) {
      const u = c / (X - 1) * 2 - 1; pos.push(p.x + pp.x * u * hw, lw, p.z + pp.z * u * hw); lvs.push(lv); rfs.push(q, u * hw, Math.min(1, foam * 1.3));
      const f = Math.min(1, foam * (0.88 + (hash2(k >> 1, c, 5) - 0.5) * 0.3) + Math.abs(u) * 0.08), cc = mix(wc, white, f); col.push(cc[0], cc[1], cc[2]);
      al.push(lerp(0.74, 0.95, ss(0.4, 1.2, sl)) * fade * (1 - 0.6 * ss(0.75, 1, Math.abs(u))));
    }
    if (rows > 0) for (let c = 0; c < X - 1; c++) { const a = (rows - 1) * X + c, b = rows * X + c; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    rows++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('alpha', new THREE.Float32BufferAttribute(al, 1)); g.setAttribute('lv', new THREE.Float32BufferAttribute(lvs, 1)); g.setAttribute('rf', new THREE.Float32BufferAttribute(rfs, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const mt = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, roughness: 0.25, metalness: 0, depthWrite: false, side: THREE.DoubleSide });
  mt.onBeforeCompile = sh => {
    // the water stands at its own level, or at the sea's where that is higher, and fades into the sea
    sh.uniforms.uSea = sea; sh.uniforms.uT = uT; sh.uniforms.uDay = uDay; sh.uniforms.uRain = uRain;
    sh.vertexShader = 'attribute float alpha;\nattribute float lv;\nattribute vec3 rf;\nuniform float uSea;\nvarying float vA;\nvarying vec3 vRF;\nvarying vec3 vWP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y = max(lv, uSea) + 0.015;\nvA = alpha * smoothstep(uSea - 0.3, uSea + 0.15, lv);\nvRF = rf;\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    // light streaks and flecks drift downstream; white water breaks up and moves (rf: flow time, metres across, whiteness)
    sh.fragmentShader = 'varying float vA;\nvarying vec3 vRF;\nvarying vec3 vWP;\nuniform float uT;\nuniform float uDay;\n' + NOISE_GLSL + RAIN_GLSL + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
      {
        float e = vRF.z, x = (vRF.x - uT) * 0.35, y = vRF.y * 2.2, lit = 0.45 + 0.55 * uDay;
        float streak = smoothstep(0.64, 0.82, wNoise(vec2(x, y))) * (0.16 + 0.5 * e);
        float fleck = smoothstep(0.84, 0.92, wNoise(vec2(x * 3.1 + 7.0, y * 2.7))) * (0.3 + 0.5 * e);
        float broken = smoothstep(0.42, 0.72, wNoise(vec2(x * 2.2 + 3.0, y * 1.6 + 5.0)));
        diffuseColor.rgb *= 1.0 - e * 0.12 * (1.0 - broken);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), clamp((streak + fleck + e * 0.45 * broken) * lit, 0.0, 0.85));
        float ring = rainRings(vWP.xz, uT) * (1.0 - e * 0.7) * (0.35 + 0.65 * uDay);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.97, 1.0), ring * 0.55);
      }`)
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.a *= vA;');
  };
  mt.customProgramCacheKey = () => 'riverFlow';
  const m = new THREE.Mesh(g, mt); m.renderOrder = 4; m.receiveShadow = true; return m;
}

export function buildWater(w, kit, scene) {
  const { H, Lat, slope } = w;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), toon(new THREE.Color().setRGB(...mix(PC.seabed, PC.waterDeep, 0.55)).getHex())); floor.position.y = -9.05; scene.add(floor);
  const uT = { value: 0 }, uDay = { value: 1 }, uRain = { value: 0 };
  const calm = calmField(w), calmTex = new THREE.DataTexture(calm.data, calm.n, calm.n, THREE.LuminanceFormat, THREE.UnsignedByteType);
  calmTex.magFilter = calmTex.minFilter = THREE.LinearFilter; calmTex.wrapS = calmTex.wrapT = THREE.ClampToEdgeWrapping; calmTex.generateMipmaps = false; calmTex.needsUpdate = true;
  const seaMat = new THREE.MeshStandardMaterial({ color: P.water, transparent: true, opacity: 0.5, roughness: 0.15, metalness: 0, depthWrite: false });
  seaMat.onBeforeCompile = sh => {
    sh.uniforms.uT = uT; sh.uniforms.uDay = uDay; sh.uniforms.uRain = uRain; sh.uniforms.uCalm = { value: calmTex };
    sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    // a slow long swell tilts the surface (crossing plane waves bent by a little noise) and fine ripples ride its crests, so the lights glint on it;
    // faint pale lines on the crests by day; lagoons and bays are calmer
    sh.fragmentShader = 'varying vec3 vWP;\nuniform float uT;\nuniform float uDay;\nuniform sampler2D uCalm;\n' + NOISE_GLSL + RAIN_GLSL + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
      float swH = 0.0; vec2 swG = vec2(0.0), rpG = vec2(0.0);
      {
        vec2 p = vWP.xz;
        float calm = texture2D(uCalm, (p + ${HALF.toFixed(1)}) / ${S.toFixed(1)}).r, still = 1.0 - 0.8 * calm;
        float far = 1.0 - smoothstep(160.0, 420.0, length(vViewPosition));
        float bend = (wNoise(p * 0.03 + uT * 0.01) - 0.5) * 5.0;
        vec2 d1 = vec2(0.94, 0.34), d2 = vec2(-0.5, 0.87), d3 = vec2(0.2, -0.98);
        float k1 = 0.27, k2 = 0.48, k3 = 0.9;
        float a1 = dot(p, d1) * k1 - uT * 0.42 + bend, a2 = dot(p, d2) * k2 - uT * 0.55 + bend * 0.7, a3 = dot(p, d3) * k3 - uT * 0.7;
        swH = (sin(a1) * 0.5 + sin(a2) * 0.32 + sin(a3) * 0.18);
        swG = (cos(a1) * 0.5 * k1 * d1 + cos(a2) * 0.32 * k2 * d2 + cos(a3) * 0.18 * k3 * d3) * 0.22;
        float crest = smoothstep(0.0, 0.8, swH);
        float b1 = dot(p, vec2(0.8, 0.6)) * 3.6 - uT * 1.5 + wNoise(p * 0.5) * 6.0, b2 = dot(p, vec2(-0.6, 0.8)) * 2.7 - uT * 1.2 + wNoise(p * 0.4 + 9.0) * 6.0;
        rpG = (cos(b1) * vec2(0.8, 0.6) * 3.6 + cos(b2) * vec2(-0.6, 0.8) * 2.7) * 0.05 * crest * far;
        swG *= still; rpG *= still;
        float line = smoothstep(0.35, 0.9, swH) * still * far;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.97, 1.0), line * 0.12 * uDay);
        diffuseColor.a = min(1.0, diffuseColor.a + line * 0.1 * uDay);
        float ring = rainRings(p, uT) * (1.0 - smoothstep(60.0, 220.0, length(vViewPosition))) * (0.35 + 0.65 * uDay);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.97, 1.0), ring * 0.5);
        diffuseColor.a = min(1.0, diffuseColor.a + ring * 0.25);
      }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      normal = normalize(normal + (viewMatrix * vec4(-(swG.x + rpG.x), 0.0, -(swG.y + rpG.y), 0.0)).xyz);`);
  };
  seaMat.customProgramCacheKey = () => 'seaSwell';
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), seaMat); sea.renderOrder = 2; scene.add(sea);
  const seaTop = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: P.waterDeep, transparent: true, opacity: 0.18, roughness: 0.1, depthWrite: false })); seaTop.position.y = 0.005; seaTop.renderOrder = 3; scene.add(seaTop);
  const seaU = { value: 0 };
  w.rivers.forEach(rv => { const m = riverRibbon(w, rv, seaU, uT, uDay, uRain); m.frustumCulled = false; scene.add(m); });

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
  // fords: stones just out of the water, gravel on the bed, foam flecks downstream
  const rf = mulberry32(w.seed + 91);
  w.rivers.forEach(rv => rv.fords.forEach(fd => {
    const spot = (k, u) => { const kk = Math.max(0, Math.min(rv.n - 1, k)), p = rv.pts[Math.round(kk)], pp = perpOf(rv, Math.round(kk)), t = Math.round(kk) / (rv.n - 1), hw = rv.W(t) / 2; return { x: p.x + pp.x * u * hw, z: p.z + pp.z * u * hw, lw: rv.LW(t) }; };
    const span = fd.k1 - fd.k0 + 2;
    for (let n = 0; n < 12; n++) {
      const s = 0.08 + rf() * 0.12, q = spot(fd.k0 - 1 + rf() * span, (rf() * 2 - 1) * 0.9);
      B.add('fordRock', kit.rock, kit.rockMat, mat4(q.x, q.lw - s * 0.35, q.z, s, s * 0.7, s, rf() * 6, rf() * 0.4), rockColor(rf), { outline: 1.08 });
      if (n % 3 === 0) { const f = spot(fd.k0 - 1 + rf() * span + 1.5, (rf() * 2 - 1) * 0.8); B.add('fordFoam', foamGeo, foamMat, mat4(f.x, f.lw + 0.03, f.z, 0.1 + rf() * 0.14, 1, 0.06 + rf() * 0.08, rf() * 6), 0xffffff, { cast: false, order: 6 }); }
    }
    for (let n = 0; n < 60; n++) {
      const s = 0.03 + rf() * 0.04, q = spot(fd.k0 - 1 + rf() * span, (rf() * 2 - 1) * 0.95);
      B.add('fordPebble', kit.rock, kit.rockMat, mat4(q.x, H(q.x, q.z) - s * 0.05, q.z, s, s * 0.4, s, rf() * 6), rockColor(rf, 0.12), {});
    }
  }));
  B.build(scene);

  let tide = 0, clock = 0;
  function setSea(base) {
    tide = base; const s = base + breath(clock);
    sea.position.y = s; seaTop.position.y = s + 0.005; seaU.value = s;
    foamWeights(s).forEach((k, i) => { const f = surf[i]; f.g.visible = k > 0.001; f.m1.opacity = 0.7 * k; f.m2.opacity = 0.4 * k; });
  }
  setSea(0);
  /** Advance the water's own clock by dt (real seconds between drawn frames) and set the daylight 0..1 and the rain 0..1. */
  function tick(dt, day, rain = 0) { clock += dt; uT.value = clock; uDay.value = day; uRain.value = rain; setSea(tide); }
  return { setSea, tick, get clock() { return clock; } };
}
