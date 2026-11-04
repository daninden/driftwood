/**
 * render/batch — collects many small objects and turns them into a few
 * InstancedMeshes (one per kind), each with an optional outline hull.
 *
 *   const B = new Batch(outlineMat, poolsOf(scene));   // the pools are optional, see below
 *   B.add('rock', geo, mat, matrix, 0xrrggbb, { outline: 1.08, cast: true });
 *   const mk = B.mark(); ...adds...; B.since(mk)  // [[key, from, to]]: what was added
 *   B.build(group)   // creates the meshes (or takes slots in the pools)
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
 * Pools (0.27.8 "Bundle"): `new Batch(outlineMat, poolsOf(scene))` hands the instances to the shared pools of the scene instead of
 * making meshes of its own. A pool is ONE InstancedMesh (plus one for the outline hulls) for every instance of one kind (geometry,
 * material, shadow flags, depth material, order, outline material, wind attribute or not) in the whole scene, so the near tiles and
 * the views of what lies on the ground cost a few draw calls together instead of a few hundred. B.build(group) takes a run of slots
 * at the end of each pool it needs, writes matrices, colours, the outline matrices and aWind there, and remembers the runs in
 * group.userData.slots. releaseGroup(group) (render/nearTile disposeGroup calls it) gives them back: the later runs slide down to
 * close the hole (a memmove of the typed arrays), so a pool draws exactly the live instances and holes never cost vertex work. A pool
 * grows by doubling: new meshes with copied arrays, the old ones disposed (an aWind copy of the shape too). Only the changed tail of
 * the arrays is uploaded, by pools.flush() (once a frame, before drawing); a pool without instances is hidden. The wind shader reads
 * the instance matrix and aWind, so it works the same in a pool, and in the shadow depth pass. Tiles are not culled one by one: the
 * streamer only keeps the tiles that are in view (plus a margin). Without pools (far tiles, water, the fading wood) a Batch makes
 * meshes of its own as before.
 *
 * poolsOf(scene) -> the PoolSet of a scene (made on the first call; its group is added to the scene)
 *   pools.flush()   uploads what changed; pools.stats() -> { pools, instances, capacity }
 * releaseGroup(group)   gives back the slots of a group built with pools (safe to call twice)
 *
 * Depends on: three, render/materials
 */
import * as THREE from 'three';

const POOLS = new WeakMap();
export function poolsOf(scene) {
  let p = POOLS.get(scene);
  if (!p) { p = new PoolSet(); scene.add(p.host); POOLS.set(scene, p); }
  return p;
}
export function releaseGroup(group) {
  const slots = group.userData.slots;
  if (slots) { slots.forEach(s => s.free()); group.userData.slots = null; }
}

class PoolSet {
  constructor() { this.host = new THREE.Group(); this.host.name = 'pools'; this.pools = new Map(); this.dirty = new Set(); }
  /** A run of slots in the pool of this kind, filled from entry b (see Batch.build). */
  take(b, outlineMat) {
    const hasAw = b.list.some(it => it.aw), dm = b.opts.depthMat || b.mat.userData.depthMat, olMat = b.opts.outline ? (b.mat.userData.outline || outlineMat) : null;
    const cast = b.opts.cast !== false, receive = b.opts.receive !== false, order = b.opts.order || 0;
    const key = [b.geo.uuid, b.mat.uuid, cast, receive, dm ? dm.uuid : '', order, olMat ? olMat.uuid : '', hasAw].join('|');
    let pool = this.pools.get(key);
    if (!pool) { pool = new Pool(this, { geo: b.geo, mat: b.mat, dm, olMat, cast, receive, order, hasAw }); this.pools.set(key, pool); }
    return pool.take(b);
  }
  flush() { this.dirty.forEach(p => p.flush()); this.dirty.clear(); }
  stats() { let instances = 0, capacity = 0; this.pools.forEach(p => { instances += p.count; capacity += p.cap; }); return { pools: this.pools.size, instances, capacity }; }
}

const COL = new THREE.Color(), TMP = new THREE.Matrix4(), POS = new THREE.Vector3(), QUAT = new THREE.Quaternion(), SCALE = new THREE.Vector3();

class Pool {
  constructor(set, kind) {
    this.set = set; this.kind = kind; this.cap = 0; this.count = 0; this.slots = []; this.dirty = Infinity;
    this.mat = new Float32Array(0); this.col = new Float32Array(0); this.aw = kind.hasAw ? new Float32Array(0) : null; this.ol = kind.olMat ? new Float32Array(0) : null;
    this.im = null; this.olMesh = null; this.geo = null;
  }
  grow(need) {
    const cap = Math.max(need, this.cap * 2, 64), k = this.kind, n = this.count;
    const grown = (a, stride) => { const o = new Float32Array(cap * stride); o.set(a.subarray(0, n * stride)); return o; };
    this.mat = grown(this.mat, 16); this.col = grown(this.col, 3);
    if (this.aw) this.aw = grown(this.aw, 2);
    if (this.ol) this.ol = grown(this.ol, 16);
    this.cap = cap;
    const old = [this.im, this.olMesh], oldGeo = this.geo;
    let geo = k.geo;
    if (k.hasAw) { geo = k.geo.clone(); geo.setAttribute('aWind', new THREE.InstancedBufferAttribute(this.aw, 2)); }   // an own copy of the shape for the per-instance wind attribute
    this.geo = geo;
    const make = (material, mats) => {
      const m = new THREE.InstancedMesh(geo, material, 1);
      m.instanceMatrix = new THREE.BufferAttribute(mats, 16); m.frustumCulled = false; m.count = n; m.visible = n > 0;
      return m;
    };
    const im = this.im = make(k.mat, this.mat);
    im.instanceColor = new THREE.BufferAttribute(this.col, 3);
    im.castShadow = k.cast; im.receiveShadow = k.receive;
    if (k.dm) im.customDepthMaterial = k.dm;
    if (k.order) im.renderOrder = k.order;
    this.set.host.add(im);
    this.olMesh = null;
    if (k.olMat) { this.olMesh = make(k.olMat, this.ol); this.set.host.add(this.olMesh); }
    old.forEach(m => { if (m) { this.set.host.remove(m); m.dispose(); } });
    if (oldGeo && k.hasAw) oldGeo.dispose();
    this.dirty = 0; this.set.dirty.add(this);
  }
  take(b) {
    const list = b.list, n = list.length, start = this.count;
    if (start + n > this.cap) this.grow(start + n);
    const outline = b.opts.outline;
    for (let i = 0; i < n; i++) {
      const it = list[i], j = start + i;
      it.m.toArray(this.mat, j * 16); COL.setHex(it.c).toArray(this.col, j * 3);
      if (this.aw && it.aw) { this.aw[j * 2] = it.aw[0]; this.aw[j * 2 + 1] = it.aw[1]; }
      if (this.ol) { it.m.decompose(POS, QUAT, SCALE); SCALE.multiplyScalar(outline); TMP.compose(POS, QUAT, SCALE); TMP.toArray(this.ol, j * 16); }
    }
    this.count += n; this.sync(start);
    const slot = { pool: this, start, n, free: () => this.free(slot) };
    this.slots.push(slot);
    return slot;
  }
  free(slot) {
    const i = this.slots.indexOf(slot); if (i < 0) return;
    this.slots.splice(i, 1);
    const from = slot.start, end = from + slot.n, n = slot.n, tail = this.count - end;
    if (tail > 0) {
      this.mat.copyWithin(from * 16, end * 16, this.count * 16); this.col.copyWithin(from * 3, end * 3, this.count * 3);
      if (this.aw) this.aw.copyWithin(from * 2, end * 2, this.count * 2);
      if (this.ol) this.ol.copyWithin(from * 16, end * 16, this.count * 16);
      for (let k = i; k < this.slots.length; k++) this.slots[k].start -= n;
    }
    this.count -= n; slot.pool = null; this.sync(from);
  }
  sync(from) {
    this.im.count = this.count; this.im.visible = this.count > 0;
    if (this.olMesh) { this.olMesh.count = this.count; this.olMesh.visible = this.count > 0; }
    this.dirty = Math.min(this.dirty, from); this.set.dirty.add(this);
  }
  flush() {
    const from = this.dirty; this.dirty = Infinity;
    const up = (attr, stride) => { const offset = from * stride, count = this.count * stride - offset; if (count > 0) { attr.updateRange.offset = offset; attr.updateRange.count = count; attr.needsUpdate = true; } };
    up(this.im.instanceMatrix, 16); up(this.im.instanceColor, 3);
    if (this.aw) up(this.geo.attributes.aWind, 2);
    if (this.olMesh) up(this.olMesh.instanceMatrix, 16);
  }
}

export class Batch {
  constructor(outlineMat, pools) { this.outlineMat = outlineMat; this.pools = pools || null; this.map = new Map(); }
  add(key, geo, mat, m, c, opts, aw) {
    if (!this.map.has(key)) this.map.set(key, { geo, mat, list: [], opts: opts || {} });
    this.map.get(key).list.push({ m, c, aw });
  }
  mark() { const o = new Map(); this.map.forEach((b, k) => o.set(k, b.list.length)); return o; }
  since(mk) { const out = []; this.map.forEach((b, k) => { const a = mk.get(k) || 0; if (b.list.length > a) out.push([k, a, b.list.length]); }); return out; }
  build(group) {
    if (this.pools) { const slots = group.userData.slots || (group.userData.slots = []); this.map.forEach(b => slots.push(this.pools.take(b, this.outlineMat))); return group; }
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
