// The shadow bias stays a few centimetres, whatever the shadow camera depth,
// so shadows start at the foot of a trunk or the castaway.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { shadowBias, snapToTexels, BIAS, softPcf, SOFT_RADIUS, shadowMapSize } from '../src/render/stage.js';
import { fitShadow, lightAxes, roundUp, GROW } from '../src/render/shadowFit.js';

describe('shadow bias', () => {
  it('is BIAS metres at every zoom level', () => {
    for (const half of [24, 50, 90]) {
      const far = (half * 3 + 200) * 2 + half * 2;
      expect(-shadowBias(far) * (far - 1)).toBeCloseTo(BIAS);
    }
  });
  it('is small enough that a shadow starts at the foot', () => {
    expect(BIAS).toBeLessThanOrEqual(0.05);
  });
});

describe('texel snapping in light space', () => {
  const dir = (el, az) => ({ x: Math.cos(el) * Math.cos(az), y: Math.sin(el), z: Math.cos(el) * Math.sin(az) });
  const axes = d => { let rx = d.z, rz = -d.x; const l = Math.hypot(rx, rz); rx /= l; rz /= l; return { r: [rx, 0, rz], u: [d.y * rz, d.z * rx - d.x * rz, -d.y * rx] }; };
  const dot = (p, a) => p.x * a[0] + p.y * a[1] + p.z * a[2];
  it('puts the point on a whole texel across the light and keeps it along the light', () => {
    const d = dir(0.2, 1.1), texel = 0.05, p = { x: 13.37, y: 1.9, z: -7.77 }, q = snapToTexels(p, d, texel), { r, u } = axes(d);
    for (const a of [r, u]) { const k = dot(q, a) / texel; expect(k).toBeCloseTo(Math.round(k), 6); }
    expect(q.x * d.x + q.y * d.y + q.z * d.z).toBeCloseTo(p.x * d.x + p.y * d.y + p.z * d.z);
  });
  it('moves by less than a texel across the light', () => {
    const d = dir(0.35, 2.0), texel = 0.1, p = { x: 4.3, y: 0.7, z: 9.1 }, q = snapToTexels(p, d, texel), { r, u } = axes(d);
    for (const a of [r, u]) expect(Math.abs(dot(q, a) - dot(p, a))).toBeLessThanOrEqual(texel / 2 + 1e-9);
  });
  it('holds still for small movements of the target within a texel', () => {
    const d = dir(0.3, 0.5), texel = 0.2, { r, u } = axes(d), base = snapToTexels({ x: 5, y: 1, z: 5 }, d, texel);
    const a = snapToTexels(base, d, texel), nudge = { x: base.x + 0.03 * r[0] + 0.03 * u[0], y: base.y + 0.03 * u[1], z: base.z + 0.03 * r[2] + 0.03 * u[2] };
    const b = snapToTexels(nudge, d, texel);   // 0.03 across the light, texel 0.2: same cell
    expect(b.x).toBeCloseTo(a.x, 6); expect(b.y).toBeCloseTo(a.y, 6); expect(b.z).toBeCloseTo(a.z, 6);
  });
});

describe('texel snapping with different texel sizes across and up', () => {
  const d = { x: Math.cos(0.3) * Math.cos(1.2), y: Math.sin(0.3), z: Math.cos(0.3) * Math.sin(1.2) }, { r, u } = lightAxes(d);
  const dot = (p, a) => p.x * a[0] + p.y * a[1] + p.z * a[2];
  it('puts the point on whole texels of each size', () => {
    const q = snapToTexels({ x: 3.3, y: 1.1, z: -8.2 }, d, 0.04, 0.015);
    expect(dot(q, r) / 0.04).toBeCloseTo(Math.round(dot(q, r) / 0.04), 6); expect(dot(q, u) / 0.015).toBeCloseTo(Math.round(dot(q, u) / 0.015), 6);
  });
});

describe('shadow camera fit', () => {
  const dir = (el, az) => ({ x: Math.cos(el) * Math.cos(az), y: Math.sin(el), z: Math.cos(el) * Math.sin(az) });
  const view = (o = {}) => ({ target: { x: 10, y: 1, z: -4 }, yaw: Math.PI / 4, pitch: Math.PI / 6, zoom: 7, aspect: 1.6, ...o });
  it('is much shorter across the up axis of a low sun, and no bigger than the old fit at normal zoom', () => {
    const f = fitShadow(view(), dir(15 * Math.PI / 180, 1));
    expect(f.hb).toBeLessThan(f.ha / 2); expect(f.ha).toBeLessThanOrEqual(24);
  });
  it('covers the ground corners of the view (and the corners high above it) with room to spare', () => {
    for (const el of [15, 40, 62]) for (const yaw of [0.3, 1.9, 4.4]) {
      const v = view({ yaw, zoom: 9 }), dr = dir(el * Math.PI / 180, 2.2), f = fitShadow(v, dr), { r, u } = lightAxes(dr);
      const c = f.centre, cx = c.x * r[0] + c.z * r[2], cy = c.x * u[0] + c.y * u[1] + c.z * u[2];
      const cp = Math.cos(v.pitch), sp = Math.sin(v.pitch);
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        const x = sx * v.zoom * v.aspect, y = sy * v.zoom, t = (0 - y * cp) / sp;   // the view ray down to the ground at the target's height
        const p = { x: v.target.x + x * Math.cos(yaw) - y * sp * Math.sin(yaw) + t * cp * Math.sin(yaw), y: v.target.y, z: v.target.z - x * Math.sin(yaw) - y * sp * Math.cos(yaw) + t * cp * Math.cos(yaw) };
        expect(Math.abs(p.x * r[0] + p.z * r[2] - cx)).toBeLessThanOrEqual(f.ha); expect(Math.abs(p.x * u[0] + p.y * u[1] + p.z * u[2] - cy)).toBeLessThanOrEqual(f.hb);
      }
    }
  });
  it('grows with the zoom', () => {
    const d = dir(0.5, 1);
    expect(fitShadow(view({ zoom: 10 }), d).ha).toBeGreaterThan(fitShadow(view({ zoom: 5 }), d).ha);
  });
  it('rounds the sizes up in steps, so the texel size holds while the view turns a little', () => {
    expect(roundUp(10)).toBeGreaterThanOrEqual(10); expect(roundUp(10)).toBeLessThan(10 * GROW + 1e-9); expect(roundUp(roundUp(10))).toBeCloseTo(roundUp(10), 9);
    const d = dir(0.5, 1), a = fitShadow(view({ yaw: 0.7 }), d), b = fitShadow(view({ yaw: 0.7001 }), d);
    expect(b.ha).toBe(a.ha); expect(b.hb).toBe(a.hb);
  });
});

describe('own soft shadow filter', () => {
  const chunk = THREE.ShaderChunk.shadowmap_pars_fragment;
  it('replaces the PCF branch of the r128 chunk and nothing else', () => {
    const out = softPcf(chunk, SOFT_RADIUS);
    expect(out).not.toBe(chunk); expect(out).toContain('16.0'); expect(out).toContain('gl_FragCoord');
    expect(out).toContain('SHADOWMAP_TYPE_PCF_SOFT'); expect(out).toContain('VSMShadow'); expect(out).toContain('float getShadow');
    expect(out).toContain((SOFT_RADIUS).toFixed(3));
    expect(out.match(/texture2DCompare\( shadowMap, shadowCoord\.xy \+ vec2\( dx0, dy0 \)/g)).toBeNull();   // the 17 hard taps are gone
  });
  it('leaves a chunk without a PCF branch alone', () => { expect(softPcf('nothing here', 3)).toBe('nothing here'); });
  it('has a radius of 3 texels', () => { expect(SOFT_RADIUS).toBe(3); });
  it('makes every tap a bilinear comparison of four texels', () => {
    const out = softPcf(chunk, SOFT_RADIUS);
    expect(out).toContain('fract( p )'); expect(out).toContain('shadowMapSize');
    expect(out).toContain('mix( mix( a0, a1, f.x ), mix( a2, a3, f.x ), f.y )');
    expect(out.match(/texture2DCompare\( shadowMap, b/g).length).toBe(4);
  });
  it('chooses the shadow map size per device', () => { expect(shadowMapSize(false)).toBe(4096); expect(shadowMapSize(true)).toBe(2048); });
});
