// The shadow bias stays a few centimetres, whatever the shadow camera depth,
// so shadows start at the foot of a trunk or the castaway.
import { describe, it, expect } from 'vitest';
import { shadowBias, snapToTexels, BIAS } from '../src/render/stage.js';

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
