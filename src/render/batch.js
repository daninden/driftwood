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
 *       receive (default true; off for thin double-sided leaves that would
 *       shadow themselves in stripes),
 *       depthMat (custom shadow depth material; else the one of the material, userData.depthMat), order (renderOrder)
 *
 * Wind (0.19, render/windShader): a material with userData.outline gets that material for its outline hulls
 * (the hull sways with the plant); B.add's last argument aw = [where on the trunk, height] is the per-instance
 * attribute aWind of palm trunks and fronds (the geometry is then cloned for that mesh and disposed with it,
 * userData.ownGeometry).
 *
 * Depends on: three, render/materials
 */
import * as THREE from 'three';

export class Batch {
  constructor(outlineMat) { this.outlineMat = outlineMat; this.map = new Map(); }
  add(key, geo, mat, m, c, opts, aw) {
    if (!this.map.has(key)) this.map.set(key, { geo, mat, list: [], opts: opts || {} });
    this.map.get(key).list.push({ m, c, aw });
  }
  mark() { const o = new Map(); this.map.forEach((b, k) => o.set(k, b.list.length)); return o; }
  since(mk) { const out = []; this.map.forEach((b, k) => { const a = mk.get(k) || 0; if (b.list.length > a) out.push([k, a, b.list.length]); }); return out; }
  build(group) {
    const col = new THREE.Color(), tmp = new THREE.Matrix4(), pos = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    this.map.forEach(b => {
      let geo = b.geo;
      if (b.list.some(it => it.aw)) {   // per-instance wind attribute on an own copy of the shape
        geo = b.geo.clone(); const a = new Float32Array(b.list.length * 2);
        b.list.forEach((it, i) => { if (it.aw) { a[i * 2] = it.aw[0]; a[i * 2 + 1] = it.aw[1]; } });
        geo.setAttribute('aWind', new THREE.InstancedBufferAttribute(a, 2));
      }
      const im = new THREE.InstancedMesh(geo, b.mat, b.list.length); im.frustumCulled = false; if (geo !== b.geo) im.userData.ownGeometry = true;
      b.list.forEach((it, i) => { im.setMatrixAt(i, it.m); im.setColorAt(i, col.setHex(it.c)); });
      im.castShadow = b.opts.cast !== false; im.receiveShadow = b.opts.receive !== false;
      const dm = b.opts.depthMat || b.mat.userData.depthMat; if (dm) im.customDepthMaterial = dm;
      if (b.opts.order) im.renderOrder = b.opts.order;
      group.add(im); b.im = im;
      if (b.opts.outline) {
        const ol = new THREE.InstancedMesh(geo, b.mat.userData.outline || this.outlineMat, b.list.length); ol.frustumCulled = false; b.olM = [];
        b.list.forEach((it, i) => { it.m.decompose(pos, q, sc); sc.multiplyScalar(b.opts.outline); tmp.compose(pos, q, sc); ol.setMatrixAt(i, tmp); b.olM.push(tmp.clone()); });
        group.add(ol); b.ol = ol;
      }
    });
    return group;
  }
}
