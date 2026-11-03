// Wind (0.19 "Wind"): the pure maths of render/wind, and the injection into the r128 shaders (render/windShader).
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createNoise } from '../src/core/noise.js';
import {
  TIER_STRENGTH, TIER_EDGES, KINDS, GUST_PERIOD, GUST_SPEED, GUST_RANGE, GUST_WIDTH, GUST_SLOTS, WIND_MAX, BASE_LEVEL, GUST_GAIN, NIGHT_CALM, TURN,
  tierStrength, windAngle, gustOf, calmOfDay, windState, gustLevel, windLevel, maxOffset,
} from '../src/render/wind.js';
import { windUniforms, setWind, windGlsl, windProject, injectWind, withWind, windDepth, windOutline, hasWind } from '../src/render/windShader.js';
import { toon } from '../src/render/materials.js';

const slot = n => ((n % GUST_SLOTS) + GUST_SLOTS) % GUST_SLOTS;

describe('wind direction', () => {
  it('is fixed by the seed and differs between seeds', () => {
    expect(windAngle(1337, 0.3)).toBe(windAngle(1337, 0.3));
    expect(windAngle(1337, 0)).not.toBeCloseTo(windAngle(42, 0), 3);
  });
  it('turns slowly: at most TURN radians away from its mean, under 0.2 degrees a second of play, once round a day', () => {
    const a0 = windAngle(7, 0); let lo = Infinity, hi = -Infinity, fastest = 0;
    for (let d = 0; d < 3; d += 1 / 1200) { const a = windAngle(7, d); lo = Math.min(lo, a); hi = Math.max(hi, a); fastest = Math.max(fastest, Math.abs(windAngle(7, d + 1 / 1200) - a)); }
    expect(hi - lo).toBeLessThanOrEqual(2 * TURN + 1e-9); expect(hi - lo).toBeGreaterThan(TURN);   // it does turn
    expect(fastest).toBeLessThan(0.2 * Math.PI / 180);   // per second of play (a day is 1200 s)
    expect(windAngle(7, 1)).toBeCloseTo(a0, 9);
  });
  it('gives a unit direction in the state', () => {
    const s = windState(1337, 10, 0.4, 1); expect(Math.hypot(s.dx, s.dz)).toBeCloseTo(1, 9);
  });
});

describe('gusts', () => {
  it('are fixed by seed and number, some weak or nothing, spaced about GUST_PERIOD apart', () => {
    expect(gustOf(1337, 5)).toEqual(gustOf(1337, 5));
    const amps = [];
    for (let n = 0; n < 200; n++) { const g = gustOf(1337, n); amps.push(g.amp); expect(g.amp).toBeGreaterThanOrEqual(0); expect(g.amp).toBeLessThanOrEqual(1); expect(Math.abs(g.start - n * GUST_PERIOD)).toBeLessThanOrEqual(8 + 1e-9); }
    expect(amps.filter(a => a === 0).length).toBeGreaterThan(10); expect(Math.max(...amps)).toBeGreaterThan(0.9);
  });
  it('travel along the wind direction at GUST_SPEED, so the trees further off move first', () => {
    let n = 0; while (gustOf(1337, n).amp < 0.8) n++;
    const g = gustOf(1337, n), t0 = g.start + 30, s0 = windState(1337, t0, 0.3, 1), s1 = windState(1337, t0 + 2, 0.3, 1);
    const q0 = s0.gusts[slot(n)], q1 = s1.gusts[slot(n)];
    expect(q0.amp).toBeCloseTo(g.amp, 9); expect(q1.pos - q0.pos).toBeCloseTo(2 * GUST_SPEED, 5);
    const at = (s, d) => ({ x: s.dx * d, z: s.dz * d }), ahead = at(s0, q0.pos + 2 * GUST_SPEED), behind = at(s0, q0.pos - 5 * GUST_SPEED);
    expect(gustLevel(s1, ahead.x, ahead.z)).toBeGreaterThan(gustLevel(s0, ahead.x, ahead.z));   // the front arrives further downwind
    expect(gustLevel(s1, behind.x, behind.z)).toBeLessThan(gustLevel(s0, behind.x, behind.z) + 1e-9);   // and leaves the places it has passed
  });
  it('are about GUST_WIDTH wide and never add up beyond 1', () => {
    const s = { dx: 1, dz: 0, calm: 1, gusts: [{ pos: 0, amp: 1 }, { pos: 10, amp: 1 }, { pos: 0, amp: 1 }] };
    expect(gustLevel(s, 0, 0)).toBe(1);
    const one = { ...s, gusts: [{ pos: 0, amp: 1 }, { pos: 0, amp: 0 }, { pos: 0, amp: 0 }] };
    expect(gustLevel(one, GUST_WIDTH * 3, 0)).toBeLessThan(0.001); expect(gustLevel(one, GUST_WIDTH, 0)).toBeCloseTo(Math.exp(-1), 6);
  });
  it('stay in their slot while they live, within the range, and never use more slots than there are', () => {
    for (let t = 0; t < 600; t += 7.3) { const s = windState(1337, t, 0.2, 1); expect(s.gusts.length).toBe(GUST_SLOTS); for (const q of s.gusts) { expect(q.pos).toBeGreaterThanOrEqual(-GUST_RANGE - 1e-9); expect(q.pos).toBeLessThanOrEqual(GUST_RANGE + 1e-9); } }
    const a = windState(1337, 100, 0.2, 1), b = windState(1337, 100.5, 0.2, 1);
    a.gusts.forEach((q, i) => { if (q.amp > 0 && b.gusts[i].amp > 0) expect(Math.abs(b.gusts[i].pos - q.pos - 0.5 * GUST_SPEED)).toBeLessThan(1e-6); });
  });
});

describe('strength', () => {
  const Y = [2, 8, 14, 20, 30];   // coast, lowland, rain forest, plateau, summit
  it('orders the tiers: rain forest weakest, then lowland, coast, plateau, summit', () => {
    const t = Y.map(tierStrength);
    expect(t[2]).toBeLessThan(0.2); expect(t[2]).toBeLessThan(t[1]); expect(t[1]).toBeLessThan(t[0]); expect(t[0]).toBeLessThan(t[3]); expect(t[3]).toBeLessThan(t[4]);
    TIER_STRENGTH.forEach((s, i) => expect(tierStrength(Y[i])).toBeCloseTo(s, 2));
  });
  it('is smooth between the terraces and never outside the table', () => {
    let prev = tierStrength(0);
    for (let y = 0; y < 45; y += 0.05) { const s = tierStrength(y); expect(Math.abs(s - prev)).toBeLessThan(0.15); expect(s).toBeGreaterThanOrEqual(Math.min(...TIER_STRENGTH) - 1e-9); expect(s).toBeLessThanOrEqual(Math.max(...TIER_STRENGTH) + 1e-9); prev = s; }
    expect(TIER_EDGES.length).toBe(TIER_STRENGTH.length - 1);
  });
  it('is calmer at night, still a little alive, and full by day', () => {
    expect(calmOfDay(0)).toBeCloseTo(NIGHT_CALM, 9); expect(calmOfDay(1)).toBe(1); expect(calmOfDay(0.5)).toBeGreaterThan(calmOfDay(0));
    const day = windState(1337, 50, 0.4, 1), night = windState(1337, 50, 0.4, 0);
    expect(windLevel(night, 3, 2, 3)).toBeLessThan(windLevel(day, 3, 2, 3)); expect(windLevel(night, 3, 2, 3)).toBeGreaterThan(0);
  });
  it('stays within bounds everywhere, has the calm base always and more in a gust', () => {
    let top = 0;
    for (let t = 0; t < 300; t += 3.7) for (let x = -300; x <= 300; x += 75) for (const y of [1, 8, 14, 20, 35]) { const s = windState(1337, t, 0.4, 1), l = windLevel(s, x, y, x * 0.3); expect(l).toBeLessThanOrEqual(WIND_MAX + 1e-9); expect(l).toBeGreaterThan(0); top = Math.max(top, l); }
    expect(top).toBeGreaterThan(BASE_LEVEL * 2);
    const calm = { dx: 1, dz: 0, calm: 1, gusts: [{ pos: 0, amp: 0 }, { pos: 0, amp: 0 }, { pos: 0, amp: 0 }] };
    expect(windLevel(calm, 0, 2, 0)).toBeCloseTo(BASE_LEVEL * tierStrength(2), 9);
  });
  it('moves nothing by more than half a metre (palms and their fronds stand on the coast and in the lowland, so at most a level of 1.12 and in a gust), and a trunk only bends, slightly, at the top', () => {
    for (const k of Object.keys(KINDS)) expect(maxOffset(k, BASE_LEVEL + GUST_GAIN)).toBeLessThan(0.5);
    for (const k of ['crown', 'pine', 'bush', 'grass', 'leaf']) expect(maxOffset(k)).toBeLessThan(0.45);   // even on the summit
    expect(KINDS.palmtrunk.push + KINDS.palmtrunk.lift + KINDS.palmtrunk.side + KINDS.palmtrunk.flutter).toBe(0);
    expect(KINDS.palmtrunk.bend * 5 * WIND_MAX).toBeLessThan(0.15);
  });
});

describe('the shader injection', () => {
  const fake = vs => ({ uniforms: {}, vertexShader: vs, fragmentShader: 'void main() {}' });
  it('replaces project_vertex and the shadow lookup in the toon, depth and basic shaders of r128', () => {
    for (const lib of ['toon', 'depth', 'basic']) {
      const src = THREE.ShaderLib[lib].vertexShader; expect(src).toContain('#include <project_vertex>');
      const out = injectWind(fake(src), 'crown').vertexShader;
      expect(out).not.toContain('#include <project_vertex>'); expect(out).toContain('windOffset'); expect(out).toContain('instanceMatrix[ 3 ]'); expect(out).toContain('uWindT');
      expect(out).toContain('gl_Position = projectionMatrix * mvPosition;');
    }
    const toonOut = injectWind(fake(THREE.ShaderLib.toon.vertexShader), 'crown').vertexShader;
    expect(toonOut).toContain('worldPosition.xyz += wOff');   // the shadow it receives is looked up where the plant is
    expect(toonOut.indexOf('worldPosition.xyz += wOff')).toBeLessThan(toonOut.indexOf('#include <shadowmap_vertex>'));
  });
  it('puts the same shared uniforms in every material, so one write per frame moves them all', () => {
    const a = injectWind(fake(THREE.ShaderLib.toon.vertexShader), 'frond'), b = injectWind(fake(THREE.ShaderLib.depth.vertexShader), 'grass');
    for (const k of ['uWindT', 'uWindDir', 'uWindCalm', 'uGust0', 'uGust1', 'uGust2']) { expect(a.uniforms[k]).toBe(windUniforms[k]); expect(b.uniforms[k]).toBe(a.uniforms[k]); }
  });
  it('writes the state into the uniforms', () => {
    const s = windState(1337, 40, 0.4, 1); setWind(s, 40);
    expect(windUniforms.uWindT.value).toBe(40); expect(windUniforms.uWindDir.value.x).toBeCloseTo(s.dx, 9); expect(windUniforms.uWindCalm.value).toBe(s.calm);
    s.gusts.forEach((q, i) => { expect(windUniforms['uGust' + i].value.x).toBe(q.pos); expect(windUniforms['uGust' + i].value.y).toBe(q.amp); });
  });
  it('writes the tier table into the GLSL and lets only fronds and palm trunks read the trunk attribute', () => {
    const g = windGlsl('crown');
    expect(g).toContain(TIER_STRENGTH[0].toFixed(4)); expect(g.match(/smoothstep/g).length).toBe(TIER_EDGES.length); expect(g).not.toContain('attribute vec2 aWind');
    expect(windGlsl('frond')).toContain('attribute vec2 aWind'); expect(windGlsl('palmtrunk')).toContain('attribute vec2 aWind');
    expect(windProject('palmtrunk')).toContain('aWind'); expect(windProject('crown')).not.toContain('aWind');
    expect(() => windGlsl('rock')).toThrow();
  });
  it('gives each kind its own program, chains an earlier onBeforeCompile and marks the material', () => {
    const m = toon(0xffffff, {}), n = toon(0xffffff, {}), mm = toon(0xffffff, {});
    let ran = 0; mm.onBeforeCompile = sh => { ran++; sh.fragmentShader += '//x'; };
    withWind(m, 'crown'); withWind(n, 'bush'); withWind(mm, 'crown');
    expect(m.customProgramCacheKey()).not.toBe(n.customProgramCacheKey());
    const sh = fake(THREE.ShaderLib.toon.vertexShader); mm.onBeforeCompile(sh);
    expect(ran).toBe(1); expect(sh.fragmentShader).toContain('//x'); expect(sh.vertexShader).toContain('windOffset');
    expect(hasWind(m)).toBe(true); expect(hasWind(toon())).toBe(false);
    expect(windDepth('crown').isMeshDepthMaterial).toBe(true); expect(windOutline('crown').side).toBe(THREE.BackSide);
  });
});

describe('near and far tiles', () => {
  let kit;
  beforeAll(async () => {
    const ctx = new Proxy({}, { get: () => () => {}, set: () => true });
    globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
    const { createKit } = await import('../src/render/geometry.js');
    kit = createKit(createNoise(1337));
  });
  it('sway in the plants of the detailed tiles, with a shadow that sways and an outline hull that does', () => {
    for (const [k, kind] of [['canopyMat', 'crown'], ['pineMat', 'pine'], ['bushMat', 'bush'], ['palmTrunkMat', 'palmtrunk'], ['frondMat', 'frond'], ['dryFrondMat', 'frond'], ['grassMat', 'grass'], ['fernMat', 'leaf']]) {
      expect(kit[k].userData.wind).toBe(kind);
      const sh = { uniforms: {}, vertexShader: THREE.ShaderLib.toon.vertexShader, fragmentShader: '' }; kit[k].onBeforeCompile(sh);
      expect(sh.uniforms.uWindT).toBe(windUniforms.uWindT);
    }
    for (const k of ['canopyMat', 'pineMat', 'bushMat', 'palmTrunkMat', 'frondMat', 'dryFrondMat', 'fernMat']) expect(hasWind(kit[k].userData.depthMat)).toBe(true);
    for (const k of ['canopyMat', 'pineMat', 'bushMat', 'palmTrunkMat']) expect(hasWind(kit[k].userData.outline)).toBe(true);
    expect(kit.frondDepth).toBe(kit.frondMat.userData.depthMat); expect(kit.frondDepth.alphaTest).toBe(0.4); expect(kit.frondDepth.map).toBeTruthy();
  });
  it('leave the trunks, rocks, the far tiles and the lean-to still', () => {
    for (const k of ['trunkMat', 'rockMat', 'smallMat', 'farCanopyMat', 'frondStillMat', 'frondStillDepth']) expect(hasWind(kit[k])).toBe(false);
    const read = f => readFileSync(new URL('../src/render/' + f, import.meta.url), 'utf8');
    expect(read('farTiles.js')).not.toMatch(/kit\.(canopyMat|bushMat|pineMat|palmTrunkMat|frondMat|grassMat|fernMat)/);
    expect(read('leanto.js')).not.toMatch(/kit\.frondMat|kit\.frondDepth/);
  });
});

describe('wind and the idle frame rate', () => {
  it('is not among the things that keep the frame rate up', () => {
    const src = readFileSync(new URL('../src/render/framePacer.js', import.meta.url), 'utf8');
    expect(src).not.toMatch(/wind/i);
  });
});
