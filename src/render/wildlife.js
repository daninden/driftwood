/**
 * render/wildlife — draws the animals of game/wildlife: crabs, fish, the jumping
 * fish and its splash, and the birds.
 *
 * All instanced and in the toon style with the dark outline of the other props.
 * Only what game/wildlife lists is drawn (within 30 m of the castaway), a pool
 * of instances per kind that is refilled every frame. Nothing here casts a
 * shadow (they are small, and circling birds must not have one); the animals
 * receive them. They never count as "something happening" for the frame pacer.
 *
 *   hole    a dark dot in the sand (0.07 m across) where a crab lives, shut while the sea covers it
 *   crab    about 12 cm wide: an orange-red body, two claws, six little legs, two
 *           black eyes; one baked mesh; it runs sideways, its legs a little
 *           shaky while it moves, and sinks into / rises from its hole by scale
 *   bird    a white seabird (about 60 cm long, a metre across the wings), grey wing
 *           tips and tail, an orange beak and legs: a body and two wings that flap
 *           or glide (wings spread, tips up a little) or are folded back on the
 *           ground; a standing bird pecks by pitching its head down
 *   fish    a dark elongated shadow lying on the water (a soft flat shape with a
 *           tail, a little wiggle), drawn over the water so it reads under the
 *           surface; it fades by shrinking and by turning pale
 *   jump    a small silver fish on an arc, with a splash where it goes in and where
 *           it comes out: flat white flecks spreading and fading as the surf's foam
 *           (render/water) and a few drops thrown up
 *
 * flapAngle(t, ph, glide) -> wing angle in radians (up positive): flapping, or a
 *   gentle V while gliding (glide 0..1 is how much of the time a bird glides), pure
 * crabGeometry(), birdGeometries() -> baked geometries (positions, normals, vertex colours)
 * createWildlifeView(scene, wildlife) -> { update(dt) }   call once per drawn frame
 *   wildlife: game.wildlife
 *
 * Depends on: three, render/materials, render/palette, game/wildlife (SPLASH_TIME)
 */
import * as THREE from 'three';
import { toon, outlineMat } from './materials.js';
import { WILD } from './palette.js';
import { SPLASH_TIME } from '../game/wildlife.js';

export const MAX_CRABS = 96, MAX_BIRDS = 40, MAX_FISH = 64, MAX_HOLES = 160;
const CRAB_RISE = 0.02;   // the crab's body centre above the sand

/** Wing angle (radians, up positive) at time t: a flapping burst, or a shallow V while gliding. */
export function flapAngle(t, ph, glide) {
  const n = 0.5 + 0.5 * Math.sin(t * 0.6 + ph * 2.3), g = Math.max(0, Math.min(1, (glide - n) * 5 + 0.5));
  return (1 - g) * 0.7 * Math.sin(t * 10 + ph) + g * 0.16;
}

/** Bakes parts { geo, at, rot?, s?, color } (colour: a number or a function of the baked position) into one geometry with vertex colours. */
function bake(parts) {
  const pos = [], nor = [], col = [], m = new THREE.Matrix4(), nm = new THREE.Matrix3(), v = new THREE.Vector3(), c = new THREE.Color();
  for (const p of parts) {
    const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
    m.compose(new THREE.Vector3(...p.at), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(p.rot || [0, 0, 0]))), new THREE.Vector3(...(p.s || [1, 1, 1])));
    nm.getNormalMatrix(m);
    const P = g.attributes.position, N = g.attributes.normal;
    const fixed = [];   // a colour per triangle (taken at its middle) when the colour is a function: crisp edges, not a blend
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(m); pos.push(v.x, v.y, v.z); fixed.push(v.x, v.y, v.z);
    }
    for (let i = 0; i < P.count; i++) {
      const t = i - i % 3;
      if (typeof p.color === 'function') c.setHex(p.color((fixed[t * 3] + fixed[t * 3 + 3] + fixed[t * 3 + 6]) / 3, (fixed[t * 3 + 1] + fixed[t * 3 + 4] + fixed[t * 3 + 7]) / 3, (fixed[t * 3 + 2] + fixed[t * 3 + 5] + fixed[t * 3 + 8]) / 3)); else c.setHex(p.color);
      col.push(c.r, c.g, c.b);
      v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor.push(v.x, v.y, v.z);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}
const ball = (a, b) => new THREE.SphereGeometry(1, a, b), rod = n => new THREE.CylinderGeometry(1, 1, 1, n);

/** The crab: width along x, claws to the front (+z), origin at the centre of the body. */
export function crabGeometry() {
  const C = WILD.crab, parts = [
    { geo: ball(9, 6), at: [0, 0, 0], s: [0.062, 0.026, 0.045], color: C.body },
    { geo: ball(5, 4), at: [-0.02, 0.026, 0.036], s: [0.009, 0.009, 0.009], color: C.eye }, { geo: ball(5, 4), at: [0.02, 0.026, 0.036], s: [0.009, 0.009, 0.009], color: C.eye },
  ];
  for (const side of [-1, 1]) {
    parts.push({ geo: ball(6, 4), at: [side * 0.066, 0.002, 0.05], s: [0.012, 0.01, 0.026], color: C.claw });   // the arm
    parts.push({ geo: ball(6, 4), at: [side * 0.072, 0.006, 0.088], s: [0.024, 0.014, 0.022], color: C.claw });   // the claw
    for (let i = 0; i < 3; i++) parts.push({ geo: rod(4), at: [side * 0.082, -0.008, -0.022 + i * 0.022], rot: [0, 0, side * 1.05], s: [0.0045, 0.05, 0.0045], color: C.leg });
  }
  return bake(parts).scale(0.68, 0.68, 0.68);   // 14 cm across with the legs, the body about 8 cm: a small crab
}

/** The bird: body (forward +x, up +y, origin at the centre of the body) and the two wings, each centred on its own middle (the right wing reaches +z). */
export function birdGeometries() {
  const B = WILD.bird, body = bake([
    { geo: ball(9, 6), at: [0, 0, 0], s: [0.2, 0.075, 0.07], color: B.body },
    { geo: ball(7, 5), at: [0.2, 0.045, 0], s: [0.055, 0.05, 0.05], color: B.body },
    { geo: new THREE.ConeGeometry(1, 1, 5), at: [0.275, 0.04, 0], rot: [0, 0, -Math.PI / 2], s: [0.017, 0.075, 0.017], color: B.beak },
    { geo: ball(7, 4), at: [-0.22, 0.012, 0], s: [0.1, 0.014, 0.05], color: B.tail },
    { geo: ball(4, 3), at: [0.225, 0.064, -0.04], s: [0.009, 0.009, 0.009], color: B.eye }, { geo: ball(4, 3), at: [0.225, 0.064, 0.04], s: [0.009, 0.009, 0.009], color: B.eye },
    { geo: rod(4), at: [0.02, -0.075, -0.03], s: [0.006, 0.08, 0.006], color: B.leg }, { geo: rod(4), at: [0.02, -0.075, 0.03], s: [0.006, 0.08, 0.006], color: B.leg },
  ]);
  const wing = side => bake([{ geo: ball(12, 6), at: [0, 0, 0], s: [0.13, 0.014, 0.5], color: (x, y, z) => z * side > 0.3 ? B.tip : B.body }]);
  return { body, right: wing(1), left: wing(-1) };
}

/** The fish shadow's shape: a soft flat body with a tail, white on transparent, the head at the right. Needs a browser (a canvas). */
function fishTexture() {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 40; const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 5;
  g.beginPath(); g.ellipse(76, 20, 40, 10, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(40, 20); g.lineTo(12, 9); g.lineTo(20, 20); g.lineTo(12, 31); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(70, 12); g.lineTo(60, 3); g.lineTo(82, 11); g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(cv); t.minFilter = THREE.LinearFilter; return t;
}

export function createWildlifeView(scene, wl) {
  const root = new THREE.Group(); root.name = 'wildlife'; scene.add(root);
  const dummy = new THREE.Object3D(), mA = new THREE.Matrix4(), mB = new THREE.Matrix4(), mC = new THREE.Matrix4(), mS = new THREE.Matrix4();
  const pool = (geo, mat, n, order) => { const im = new THREE.InstancedMesh(geo, mat, n); im.frustumCulled = false; im.castShadow = false; im.receiveShadow = true; im.count = 0; if (order) im.renderOrder = order; root.add(im); return im; };
  const lit = toon(0xffffff, { vertexColors: true });
  const holeMat = toon(WILD.crab.hole, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const hole = pool(new THREE.CircleGeometry(0.035, 8).rotateX(-Math.PI / 2), holeMat, MAX_HOLES);
  const crabG = crabGeometry(), crab = pool(crabG, lit, MAX_CRABS), crabO = pool(crabG, outlineMat, MAX_CRABS);
  const bg = birdGeometries(), body = pool(bg.body, lit, MAX_BIRDS), bodyO = pool(bg.body, outlineMat, MAX_BIRDS);
  const wingR = pool(bg.right, lit, MAX_BIRDS), wingRO = pool(bg.right, outlineMat, MAX_BIRDS), wingL = pool(bg.left, lit, MAX_BIRDS), wingLO = pool(bg.left, outlineMat, MAX_BIRDS);
  const shadow = new THREE.MeshBasicMaterial({ map: fishTexture(), transparent: true, opacity: 0.62, depthWrite: false });
  const fish = pool(new THREE.PlaneGeometry(1, 0.32).rotateX(-Math.PI / 2), shadow, MAX_FISH, 5);
  const dark = new THREE.Color(WILD.fish.shadow), pale = new THREE.Color(WILD.fish.pale), tint = new THREE.Color();
  fish.setColorAt(0, dark);   // creates the instance colours

  // the jumping fish, and its two splashes (one where it goes in, one where it comes out)
  const jumpFish = new THREE.Group(), JG = bake([
    { geo: ball(8, 5), at: [0, 0, 0], s: [0.15, 0.045, 0.04], color: (x, y) => y < -0.01 ? WILD.fish.belly : WILD.fish.jump },
    { geo: ball(5, 3), at: [-0.17, 0, 0], s: [0.05, 0.05, 0.008], color: WILD.fish.jump },
    { geo: ball(4, 3), at: [0.11, 0.015, 0.032], s: [0.01, 0.01, 0.01], color: WILD.crab.eye }, { geo: ball(4, 3), at: [0.11, 0.015, -0.032], s: [0.01, 0.01, 0.01], color: WILD.crab.eye },
  ]);
  const jm = new THREE.Mesh(JG, lit), jo = new THREE.Mesh(JG, outlineMat); jo.scale.setScalar(1.3); jumpFish.add(jm, jo); jumpFish.visible = false; root.add(jumpFish);
  const foamGeo = new THREE.CircleGeometry(1, 10).rotateX(-Math.PI / 2), dropGeo = new THREE.SphereGeometry(1, 5, 4);
  const splashes = [0, 1].map(() => {
    const g = new THREE.Group(), fm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false }), dm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false });
    const flecks = [], drops = [];
    for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(foamGeo, fm); m.renderOrder = 6; flecks.push({ m, a: i / 6 * Math.PI * 2 + i * 0.4 }); g.add(m); }
    for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(dropGeo, dm); m.renderOrder = 7; drops.push({ m, a: i / 5 * Math.PI * 2 + 0.7, v: 0.5 + (i % 3) * 0.25, up: 2.0 + (i % 2) * 0.8 }); g.add(m); }
    g.visible = false; root.add(g); return { g, fm, dm, flecks, drops };
  });

  let clock = 0;
  const place = (mesh, i, matrix) => mesh.setMatrixAt(i, matrix);
  const done = (...ms) => ms.forEach(m => { m.instanceMatrix.needsUpdate = true; });

  function holes() {
    const list = wl.holes(), n = Math.min(list.length, MAX_HOLES);
    for (let i = 0; i < n; i++) { dummy.position.set(list[i].x, list[i].y + 0.012, list[i].z); dummy.rotation.set(0, i * 1.7, 0); dummy.scale.set(1, 1, 0.8 + (i % 3) * 0.1); dummy.updateMatrix(); hole.setMatrixAt(i, dummy.matrix); }
    hole.count = n; done(hole);
  }

  function crabs() {
    const list = wl.crabs(), n = Math.min(list.length, MAX_CRABS);
    for (let i = 0; i < n; i++) {
      const c = list[i];
      dummy.position.set(c.x, c.y + CRAB_RISE * c.a - (1 - c.a) * 0.03, c.z);
      dummy.rotation.set(0, -c.ang, c.moving ? Math.sin(clock * 38 + c.id) * 0.1 : 0);
      dummy.scale.setScalar(Math.max(0.01, c.a)); dummy.updateMatrix(); place(crab, i, dummy.matrix);
      dummy.scale.setScalar(Math.max(0.01, c.a) * 1.32); dummy.updateMatrix(); place(crabO, i, dummy.matrix);
    }
    crab.count = crabO.count = n; done(crab, crabO);
  }

  function birds() {
    const list = wl.birds(), n = Math.min(list.length, MAX_BIRDS);
    for (let i = 0; i < n; i++) {
      const b = list[i], ground = b.mode === 'ground';
      dummy.position.set(b.x, b.y, b.z); dummy.rotation.order = 'YZX'; dummy.rotation.set(b.bank, -b.ang, b.pitch); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
      mA.copy(dummy.matrix); place(body, i, mA);
      mB.copy(mA).multiply(mS.makeScale(1.2, 1.2, 1.2)); place(bodyO, i, mB);
      for (const side of [1, -1]) {   // 1: the right wing (+z)
        mC.copy(mA).multiply(mS.makeTranslation(0.02, 0.02, 0));
        if (ground) { mC.multiply(mS.makeRotationY(-side * 1.4)); mC.multiply(mS.makeRotationX(side * 0.15)); mC.multiply(mS.makeScale(1, 1, 0.55)); }
        else mC.multiply(mS.makeRotationX(-side * flapAngle(clock, b.ph, b.glide)));
        mC.multiply(mS.makeTranslation(0, 0, side * 0.5));
        place(side > 0 ? wingR : wingL, i, mC);
        place(side > 0 ? wingRO : wingLO, i, mB.copy(mC).multiply(mS.makeScale(1.25, 2.6, 1.08)));
      }
    }
    body.count = bodyO.count = wingR.count = wingRO.count = wingL.count = wingLO.count = n; done(body, bodyO, wingR, wingRO, wingL, wingLO);
  }

  function fishes() {
    const list = wl.fish(), n = Math.min(list.length, MAX_FISH);
    for (let i = 0; i < n; i++) {
      const f = list[i], k = 0.55 + 0.45 * f.a;
      dummy.position.set(f.x, f.y, f.z); dummy.rotation.set(0, -f.ang + Math.sin(clock * 6 + f.ph) * 0.14, 0); dummy.scale.set(f.len * k, 1, f.len * k); dummy.updateMatrix();
      fish.setMatrixAt(i, dummy.matrix); fish.setColorAt(i, tint.copy(dark).lerp(pale, (1 - f.a) * 0.8));
    }
    fish.count = n; done(fish); if (n) fish.instanceColor.needsUpdate = true;
  }

  function jumping() {
    const j = wl.jump();
    jumpFish.visible = !!(j && j.air);
    if (j && j.air) { jumpFish.position.set(j.x, j.y, j.z); jumpFish.rotation.order = 'YZX'; jumpFish.rotation.set(0, -j.ang, j.pitch); }
    splashes.forEach((s, i) => {
      const sp = j && j.splashes[i];
      s.g.visible = !!sp; if (!sp) return;
      const u = Math.min(1, sp.age / SPLASH_TIME);
      s.g.position.set(sp.x, j.sea + 0.03, sp.z);
      s.fm.opacity = 0.7 * Math.pow(1 - u, 1.2); s.dm.opacity = 0.85 * (1 - u);
      s.flecks.forEach(f => { const r = 0.08 + 0.5 * u; f.m.position.set(Math.cos(f.a) * r, 0, Math.sin(f.a) * r); f.m.rotation.y = -f.a + Math.PI / 2; f.m.scale.set(0.18 + 0.2 * u, 1, 0.07 + 0.08 * u); });
      s.drops.forEach(d => { const t = sp.age, y = d.up * t - 3.5 * t * t, r = d.v * t; d.m.visible = y > 0; d.m.position.set(Math.cos(d.a) * r, y, Math.sin(d.a) * r); d.m.scale.setScalar(0.03); });
    });
  }

  return {
    update(dt) {
      clock += dt;
      holes(); crabs(); birds(); fishes(); jumping();
    },
  };
}
