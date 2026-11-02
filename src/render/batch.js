/**
 * render/batch — collects many small objects and turns them into a few
 * InstancedMeshes (one per kind), each with an optional outline hull.
 *
 *   const B = new Batch(outlineMat);
 *   B.add('rock', geo, mat, matrix, 0xrrggbb, { outline: 1.08, cast: true });
 *   const mk = B.mark(); ...adds...; B.since(mk)  // [[key, from, to]]: what was added
 *   B.build(group)   // creates the meshes; each entry then has .im, .ol, .olM
 *
 * opts: outline (hull scale, omit for none), cast (default true),
 *       depthMat (custom shadow depth material), order (renderOrder)
 *
 * Depends on: three
 */
import * as THREE from 'three';

export class Batch {
  constructor(outlineMat) { this.outlineMat = outlineMat; this.map = new Map(); }
  add(key, geo, mat, m, c, opts) {
    if (!this.map.has(key)) this.map.set(key, { geo, mat, list: [], opts: opts || {} });
    this.map.get(key).list.push({ m, c });
  }
  mark() { const o = new Map(); this.map.forEach((b, k) => o.set(k, b.list.length)); return o; }
  since(mk) { const out = []; this.map.forEach((b, k) => { const a = mk.get(k) || 0; if (b.list.length > a) out.push([k, a, b.list.length]); }); return out; }
  build(group) {
    const col = new THREE.Color(), tmp = new THREE.Matrix4(), pos = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    this.map.forEach(b => {
      const im = new THREE.InstancedMesh(b.geo, b.mat, b.list.length); im.frustumCulled = false;
      b.list.forEach((it, i) => { im.setMatrixAt(i, it.m); im.setColorAt(i, col.setHex(it.c)); });
      im.castShadow = b.opts.cast !== false; im.receiveShadow = true;
      if (b.opts.depthMat) im.customDepthMaterial = b.opts.depthMat;
      if (b.opts.order) im.renderOrder = b.opts.order;
      group.add(im); b.im = im;
      if (b.opts.outline) {
        const ol = new THREE.InstancedMesh(b.geo, this.outlineMat, b.list.length); ol.frustumCulled = false; b.olM = [];
        b.list.forEach((it, i) => { it.m.decompose(pos, q, sc); sc.multiplyScalar(b.opts.outline); tmp.compose(pos, q, sc); ol.setMatrixAt(i, tmp); b.olM.push(tmp.clone()); });
        group.add(ol); b.ol = ol;
      }
    });
    return group;
  }
}
