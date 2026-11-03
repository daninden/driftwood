/**
 * render/hero — the castaway: a small blocky figure, outlined like
 * everything else, dressed for a tropical island after a long time alone:
 * a straw hat, shaggy hair and a beard, a torn shirt with a ragged hem and
 * ripped short sleeves, frayed shorts, bare lower legs and bare feet, and a
 * staff. Hips and shoulders are joints, so legs (with their feet) and arms
 * swing while walking.
 *
 * The figure is read from far away, so the detail lives in the silhouette
 * and in flat colour areas (skin against cloth), not in small parts.
 *
 * Where something solid (a rock wall, a boulder, a trunk) hides the figure,
 * a light stippled silhouette shows through, so you never lose it.
 * Vegetation is cut away round it instead (render/cutout).
 *
 * Carried driftwood is held under the left arm, at its real length (low
 * enough that the head and hat stay readable). When the castaway picks up or lays down wood, the upper
 * body bends down and up again (player.stoop).
 *
 * To sleep (player.lie) the castaway lies down on his back with the straw
 * hat over his face; tired (player.tired) he lets his head and shoulders
 * hang and his arms swing less.
 *
 * Kneeling work (player.work): to husk a coconut he kneels, bent over, his
 * hands tearing at it in turn; to make fire he kneels and twirls his staff
 * upright between his palms as a fire drill, the hands rubbing back and
 * forth. The tufts of coconut fibre he carries (one to three) hang at the
 * waist of his shorts.
 *
 * createHero(scene) -> { group, update(player, wadeDepth, load?, fibre?) }
 *   update copies position and heading from the player state
 *   (game/movement) and animates the walk cycle from player.phase.
 *   load: the carried pieces as [{ len, rad, col }] (bottom first); the
 *   bundle is rebuilt when it changes. fibre: the tufts carried (0..3).
 *   The figure faces +z in its own space.
 *
 * Depends on: three, render/materials, render/palette
 */
import * as THREE from 'three';
import { toon, outlineMat } from './materials.js';
import { HERO } from './palette.js';

const silMat = new THREE.MeshBasicMaterial({ color: HERO.silhouette, depthFunc: THREE.GreaterDepth, depthWrite: false });
silMat.onBeforeCompile = sh => {
  sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'void main() {\n  vec2 sp = floor(gl_FragCoord.xy);\n  if (mod(sp.x + sp.y, 2.0) > 0.5) discard;');
};

export function createHero(scene) {
  const group = new THREE.Group(), body = new THREE.Group(); group.add(body); body.scale.setScalar(0.62);
  const shirt = toon(HERO.shirt), shorts = toon(HERO.shorts), skin = toon(HERO.skin), hair = toon(HERO.hair), hatM = toon(HERO.hat);
  const part = (parent, geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); const o = new THREE.Mesh(geo, outlineMat); o.scale.setScalar(1.12); m.add(o); return m; };
  const box = (parent, w, h, d, mat, x, y, z) => part(parent, new THREE.BoxGeometry(w, h, d), mat, x, y, z);
  const HIP = 0.48, upper = new THREE.Group(); upper.position.y = HIP; body.add(upper);   // bends at the hips
  const joint = (x, y, z, parent = body) => { const j = new THREE.Group(); j.position.set(x, y, z); parent.add(j); return j; };
  const hipL = joint(-0.08, HIP, 0), hipR = joint(0.08, HIP, 0), shL = joint(-0.21, 0.88 - HIP, 0, upper), shR = joint(0.21, 0.88 - HIP, 0, upper), torso = joint(0, -HIP, 0, upper);

  // Legs: frayed shorts to just above the knee, bare lower leg, bare foot.
  for (const [hip, s] of [[hipL, -1], [hipR, 1]]) {
    box(hip, 0.135, 0.2, 0.145, shorts, 0, -0.1, 0);
    box(hip, 0.04, 0.035, 0.03, shorts, 0.03 * s, -0.21, 0.055);                // frayed hem
    box(hip, 0.035, 0.03, 0.03, shorts, -0.035 * s, -0.205, -0.05);
    box(hip, 0.085, 0.27, 0.09, skin, 0, -0.335, 0);
    box(hip, 0.09, 0.04, 0.16, skin, 0, -0.46, 0.035);                          // bare foot
  }
  box(torso, 0.3, 0.09, 0.19, shorts, 0, 0.47, 0);                              // seat of the shorts

  // Arms: ripped short sleeve, bare arm, hand.
  for (const sh of [shL, shR]) {
    box(sh, 0.11, 0.14, 0.11, shirt, 0, -0.06, 0);
    box(sh, 0.075, 0.27, 0.075, skin, 0, -0.26, 0);
    box(sh, 0.08, 0.07, 0.08, skin, 0, -0.42, 0);
  }

  // Torso: a torn shirt with an open neck, a rip on the chest and a ragged hem.
  box(torso, 0.33, 0.4, 0.2, shirt, 0, 0.72, 0);
  box(torso, 0.1, 0.07, 0.012, skin, 0, 0.885, 0.101);                         // open neck
  box(torso, 0.07, 0.09, 0.012, skin, 0.08, 0.72, 0.101);                      // rip on the chest
  box(torso, 0.06, 0.07, 0.012, skin, -0.07, 0.78, -0.101);                    // rip on the back
  box(torso, 0.1, 0.08, 0.205, shirt, -0.1, 0.5, 0);                            // ragged hem, uneven tails
  box(torso, 0.07, 0.05, 0.205, shirt, 0.02, 0.51, 0);
  box(torso, 0.09, 0.1, 0.205, shirt, 0.11, 0.49, 0);

  // Head: face, shaggy hair, a full beard, the straw hat.
  part(torso, new THREE.SphereGeometry(0.12, 14, 10), skin, 0, 1.04, 0);
  const hr = new THREE.Mesh(new THREE.SphereGeometry(0.126, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hair); hr.position.set(0, 1.055, -0.01); torso.add(hr);
  box(torso, 0.2, 0.09, 0.06, hair, 0, 1.0, -0.09);                             // hair hanging out under the hat
  box(torso, 0.05, 0.06, 0.04, hair, -0.07, 0.95, -0.1);
  box(torso, 0.05, 0.05, 0.04, hair, 0.06, 0.955, -0.1);
  const beard = part(torso, new THREE.SphereGeometry(0.11, 12, 8), hair, 0, 0.97, 0.045); beard.scale.set(1.1, 0.85, 0.9);
  box(torso, 0.13, 0.1, 0.07, hair, 0, 0.885, 0.085);                           // long, unkempt beard over the chest
  box(torso, 0.07, 0.06, 0.05, hair, 0.01, 0.83, 0.1);
  const hat = joint(0, 1.13, 0, torso);   // tipped over the face to sleep
  part(hat, new THREE.CylinderGeometry(0.24, 0.24, 0.025, 18), hatM, 0, 0, 0);
  part(hat, new THREE.CylinderGeometry(0.12, 0.14, 0.13, 16), hatM, 0, 0.07, 0);

  const staffGeo = new THREE.CylinderGeometry(0.018, 0.022, 1.35, 6), staffMat = toon(HERO.staff);
  const staff = part(shR, staffGeo, staffMat, 0.06, -0.3, 0.1);
  const drill = joint(0, 0.2, 0.34, body);   // the staff upright as a fire drill, its foot on the hearth in front of his knees
  part(drill, staffGeo, staffMat, 0, 0.62, 0); drill.visible = false;

  // Tufts of coconut fibre tucked into the waist of the shorts.
  const fibreMat = toon(HERO.fibre), tufts = [[0.13, 0.49, 0.08], [0.16, 0.48, -0.03], [-0.14, 0.49, 0.06]].map(([x, y, z], i) => {
    const t = part(torso, new THREE.BoxGeometry(0.07, 0.12, 0.06), fibreMat, x, y, z); t.rotation.z = (i - 1) * 0.3; t.visible = false; return t;
  });

  // Silhouette: where something solid hides the figure, a light stippled
  // shape shows through. It is drawn after the world and before the figure
  // itself (renderOrder), with an inverted depth test.
  const silhouette = root => {
    const parts = []; root.traverse(o => { if (o.isMesh && o.material !== silMat) parts.push(o); });
    for (const m of parts) {
      m.renderOrder = 2;
      if (m.material === outlineMat) continue;
      const sil = new THREE.Mesh(m.geometry, silMat); sil.renderOrder = 1; m.add(sil);
    }
  };
  silhouette(group);
  scene.add(group);

  // The bundle under the left arm, in metres (undoing the body scale).
  const bundle = new THREE.Group(); bundle.position.set(-0.27, 0.66 - HIP, 0); bundle.scale.setScalar(1 / 0.62); upper.add(bundle);
  const logGeo = new THREE.CylinderGeometry(1, 0.8, 1, 7), axis = new THREE.Vector3(0.04, -0.1, 1).normalize(), up = new THREE.Vector3(0, 1, 0);
  let loadKey = '', clock = 0;
  function setLoad(load) {
    const key = load.map(l => l.len.toFixed(3) + l.col).join();
    if (key === loadKey) return;
    loadKey = key;
    for (const c of [...bundle.children]) { bundle.remove(c); c.traverse(o => { if (o.isMesh && o.material !== outlineMat && o.material !== silMat) o.material.dispose(); }); }
    load.forEach((l, i) => {
      const m = new THREE.Mesh(logGeo, toon(l.col)); m.castShadow = true;
      m.position.set(-l.rad * 0.6 - (i % 2) * 0.05, (i >> 1) * 0.07 - (i % 2) * 0.02, (i - 1) * 0.07 - l.len * 0.1);
      m.quaternion.setFromUnitVectors(up, axis); m.scale.set(l.rad, l.len, l.rad);
      const o = new THREE.Mesh(logGeo, outlineMat); o.scale.set(1.18, 1.02, 1.18); m.add(o);
      bundle.add(m);
    });
    silhouette(bundle);
  }

  function update(p, wade = 0, load = [], fibre = 0) {
    setLoad(load); clock += 1 / 60;
    tufts.forEach((t, i) => { t.visible = i < fibre; });
    const wk = p.work, kneel = wk ? Math.min(1, wk.f * (wk.kind === 'drill' ? 14 : 2.5) / 0.4) : 0, drilling = !!wk && wk.kind === 'drill';
    staff.visible = !drilling; drill.visible = drilling;
    group.position.set(p.x, p.y - Math.min(0.35, wade * 0.6), p.z); group.rotation.y = p.heading;
    const tired = p.tired || 0, lie = p.lie || 0, ly = lie * lie * (3 - 2 * lie);
    const sw = p.moving ? Math.sin(p.phase) * Math.min(0.75, 0.3 + p.speed * 0.1) * (1 - 0.35 * tired) : 0, carry = load.length > 0;
    const bend = Math.sin(Math.PI * Math.min(1, p.stoop || 0));   // down and up again
    const sit = Math.sin(Math.PI * Math.min(1, ly * 1.6)) * (ly < 0.62 ? 1 : 0);   // knees bend on the way down and up
    const kn = kneel * kneel * (3 - 2 * kneel), rub = wk ? Math.sin(clock * (drilling ? 16 : 9)) : 0;
    hipL.rotation.x += (sw + bend * 0.5 + sit * 0.9 + kn * 0.75 - hipL.rotation.x) * 0.4; hipR.rotation.x += (-sw + bend * 0.5 + sit * 0.9 + kn * 0.55 - hipR.rotation.x) * 0.4;   // squatting
    upper.rotation.x = bend * 0.9 + tired * 0.18 * (1 - ly) + kn * (drilling ? 0.3 : 0.6);
    body.rotation.x = -Math.PI / 2 * ly;   // on his back, face up, head away from where he faced
    hat.position.set(0, 1.13 - 0.1 * ly, 0.13 * ly); hat.rotation.x = Math.PI / 2 * ly;
    if (kn > 0) {   // both hands forward, working: tearing the husk, or rubbing the drill between the palms
      const fw = drilling ? -0.85 : -0.6;
      shL.rotation.z = (drilling ? 0.55 : 0.2) * kn; shR.rotation.z = -(drilling ? 0.55 : 0.2) * kn;
      shL.rotation.x += (fw * kn + rub * 0.18 - shL.rotation.x) * 0.5; shR.rotation.x += (fw * kn - rub * 0.18 - shR.rotation.x) * 0.5;
    } else {
      shR.rotation.z = 0;
      shL.rotation.z = carry ? -0.35 : 0;
      shL.rotation.x += ((carry ? -0.35 : -sw * 0.8) - bend * 0.5 - shL.rotation.x) * 0.4;   // the left arm holds the bundle
      shR.rotation.x += (sw * 0.5 - 0.15 - bend * 0.6 - shR.rotation.x) * 0.4;
    }
    drill.rotation.y = clock * 22;   // spinning
    body.position.y = (p.moving ? Math.abs(Math.cos(p.phase)) * 0.03 : 0) - bend * 0.12 + ly * 0.07 - kn * 0.13;
  }
  return { group, update };
}
