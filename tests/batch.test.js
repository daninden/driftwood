// The shared instanced pools of render/batch (0.27.8 "Bundle"): slots taken per group, closed up when a group is released,
// grown by doubling, with outlines and the per-instance wind attribute. No WebGL needed.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Batch, poolsOf, releaseGroup } from '../src/render/batch.js';

const geo = new THREE.BoxGeometry(1, 1, 1), mat = new THREE.MeshBasicMaterial(), olMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide });
const at = x => new THREE.Matrix4().makeTranslation(x, 0, 0);
function group(pools, xs, opts = {}, aw) {
  const B = new Batch(olMat, pools), g = new THREE.Group();
  xs.forEach(x => B.add('k', geo, mat, at(x), 0xff0000 + x, opts, aw ? [x, 2] : undefined));
  B.build(g); return g;
}
const meshes = pools => pools.host.children;
const xsOf = mesh => Array.from({ length: mesh.count }, (_, i) => mesh.instanceMatrix.array[i * 16 + 12]);

describe('instanced pools', () => {
  it('put the same kind of two groups into one mesh', () => {
    const pools = poolsOf(new THREE.Scene());
    group(pools, [1, 2, 3]); group(pools, [4, 5]);
    expect(meshes(pools).length).toBe(1);
    expect(pools.stats().instances).toBe(5);
    expect(xsOf(meshes(pools)[0])).toEqual([1, 2, 3, 4, 5]);
  });

  it('give a released run back and close the hole, so the later runs slide down', () => {
    const pools = poolsOf(new THREE.Scene());
    const a = group(pools, [1, 2]), b = group(pools, [3, 4, 5]), c = group(pools, [6]);
    releaseGroup(b);
    const m = meshes(pools)[0];
    expect(m.count).toBe(3); expect(xsOf(m)).toEqual([1, 2, 6]);
    releaseGroup(b);   // twice is harmless
    expect(m.count).toBe(3);
    releaseGroup(a); expect(xsOf(m)).toEqual([6]);
    expect(c.userData.slots[0].start).toBe(0);
    releaseGroup(c); expect(m.count).toBe(0); expect(m.visible).toBe(false);
    group(pools, [7]); expect(m.visible).toBe(true); expect(xsOf(m)).toEqual([7]);
  });

  it('keep the colours with the matrices when they slide', () => {
    const pools = poolsOf(new THREE.Scene());
    const a = group(pools, [1]), b = group(pools, [2]);
    releaseGroup(a);
    const m = meshes(pools)[0], col = new THREE.Color();
    m.getColorAt(0, col); expect(col.getHex()).toBe(0xff0000 + 2);
    expect(b.userData.slots[0].start).toBe(0);
  });

  it('grow past their capacity without losing instances, and dispose the old meshes', () => {
    const pools = poolsOf(new THREE.Scene()), seen = [];
    const g = group(pools, [1, 2, 3]); const first = meshes(pools)[0];
    first.addEventListener('dispose', () => seen.push('disposed'));
    const xs = Array.from({ length: 300 }, (_, i) => 10 + i);
    group(pools, xs);
    const ms = meshes(pools);
    expect(ms.length).toBe(1); expect(ms[0]).not.toBe(first); expect(seen).toEqual(['disposed']);
    expect(ms[0].count).toBe(303); expect(xsOf(ms[0]).slice(0, 4)).toEqual([1, 2, 3, 10]);
    expect(pools.stats().capacity).toBeGreaterThanOrEqual(303);
    releaseGroup(g); expect(ms[0].count).toBe(300);
  });

  it('make an outline twin with scaled matrices that slides with the instances', () => {
    const pools = poolsOf(new THREE.Scene());
    const a = group(pools, [1], { outline: 1.5 }), b = group(pools, [2], { outline: 1.5 });
    expect(meshes(pools).length).toBe(2);
    const [im, ol] = meshes(pools), s = new THREE.Vector3(), p = new THREE.Vector3(), q = new THREE.Quaternion(), m = new THREE.Matrix4();
    expect(ol.material).toBe(olMat);
    releaseGroup(a);
    expect(im.count).toBe(1); expect(ol.count).toBe(1);
    ol.getMatrixAt(0, m); m.decompose(p, q, s);
    expect(p.x).toBe(2); expect(s.x).toBeCloseTo(1.5);
    expect(b.userData.slots.length).toBe(1);
  });

  it('keep the per-instance wind attribute on an own copy of the shape, and slide it', () => {
    const pools = poolsOf(new THREE.Scene());
    const a = group(pools, [1], {}, true), b = group(pools, [2], {}, true);
    const m = meshes(pools)[0];
    expect(m.geometry).not.toBe(geo); expect(m.geometry.attributes.aWind.array[0]).toBe(1);
    releaseGroup(a);
    expect(m.geometry.attributes.aWind.array[0]).toBe(2); expect(m.geometry.attributes.aWind.array[1]).toBe(2);
    expect(b.userData.slots[0].start).toBe(0);
  });

  it('keep kinds with other flags apart, and set the shadow flags and depth material', () => {
    const pools = poolsOf(new THREE.Scene()), dm = new THREE.MeshDepthMaterial();
    group(pools, [1], { cast: false }); group(pools, [2], { receive: false, depthMat: dm });
    const [a, b] = meshes(pools);
    expect(a.castShadow).toBe(false); expect(b.castShadow).toBe(true); expect(b.receiveShadow).toBe(false); expect(b.customDepthMaterial).toBe(dm);
  });

  it('upload only the changed tail, once, at flush', () => {
    const pools = poolsOf(new THREE.Scene());
    group(pools, [1, 2]); pools.flush();
    const m = meshes(pools)[0], v = m.instanceMatrix.version;
    group(pools, [3]); group(pools, [4]);
    pools.flush();
    expect(m.instanceMatrix.version).toBe(v + 1);
    expect(m.instanceMatrix.updateRange.offset).toBe(2 * 16); expect(m.instanceMatrix.updateRange.count).toBe(2 * 16);
    pools.flush(); expect(m.instanceMatrix.version).toBe(v + 1);
  });

  it('leave a Batch without pools making its own meshes', () => {
    const g = group(null, [1, 2], { outline: 1.2 });
    expect(g.children.length).toBe(2); expect(g.userData.slots).toBeUndefined();
  });
});
