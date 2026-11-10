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
 * Where anything hides the figure (a rock wall, a boulder, a trunk, a
 * crown, a palm, a bush, a fern), an even, semi-transparent dark ink silhouette
 * (SIL_OPACITY, one flat shape in the dark brown of the ink, no pattern) shows through, so you never lose it.
 *
 * Carried driftwood is held under the left arm, at its real length (low
 * enough that the head and hat stay readable). A load (0.10) shortens his steps
 * (the swing gets smaller by CARRY_STRIDE per piece) and bends him forward
 * from the hips, LEAN radians per piece (0.11: twice as much, about 17 degrees with
 * three pieces; head, hat and bundle lean with the upper body), eased in and out. When the castaway picks up or lays down wood, the upper
 * body bends down and up again (player.stoop).
 *
 * To sleep (player.lie) the castaway lies down on his back with the straw
 * hat over his face; tired (player.tired) he lets his head and shoulders
 * hang and his arms swing less; thirsty (player.thirsty, 0..1) his head hangs a
 * little forward on its own joint (HANG radians at most, 0.11).
 *
 * To rest, by himself (0.29.2 "Amble", player.sitting 0..1, eased by sitEase over half a second; game/game, set only by game/mind), he sits on the ground: knees drawn up, feet flat, the
 * body leaning forward a little over them, his arms forward and resting, the head up to look out, the hat on and the staff laid down on the ground beside him (SIT, sitPose).
 *
 * Kneeling work (player.work): to husk a coconut he kneels, bent over, his
 * hands tearing at it in turn; to drink (and, since 0.25, to fill a shell or sip from one) he kneels low over the water and brings his cupped hands to his mouth now and then; to make fire he kneels and twirls his staff
 * upright between his palms as a fire drill, the hands rubbing back and
 * forth; to dig for a crab he kneels the same way, hands forward and scraping, and he kneels the same way at a fire to roast one (0.22). A burning torch (player.torch) he holds up in front of him in his
 * left hand. Since 0.30.17 "Spear" (player.spear) the spear is in his right hand in place of the staff; to fish (player.work 'fish') he stands, leans over the water, peers with the spear forward and down, and thrusts in the last third.
 *
 * SIL_OPACITY   opacity of the silhouette (0..1)
 * SIT, sitEase(f), sitPose(f)   the sitting pose at full, its easing and the angles at a transition value f (pure; tests/hero.test.js)
 * createHero(scene) -> { group, update(player, wadeDepth, load?), flame(out) }
 *   update copies position and heading from the player state
 *   (game/movement) and animates the walk cycle from player.phase. In water
 *   he sinks by wadeDepth * 0.6, but never deeper than 0.35 (his waist).
 *   load: the carried pieces as [{ len, rad, col, wet? }] (bottom first; wet:
 *   still looks wet, so it gets the wet sheen, render/materials wetToon); the
 *   bundle is rebuilt when it changes.
 *   flame(out) -> out | null: the flame of the torch in his hand in world
 *   space (null without a torch), for the light of render/fire.
 *   The figure faces +z in its own space.
 *
 * Depends on: three, render/materials, render/palette, render/fire, render/spear, game/wood (CARRY_STRIDE)
 */
import * as THREE from 'three';
import { toon, wetToon, outlineMat } from './materials.js';
import { CARRY_STRIDE } from '../game/wood.js';
import { HERO } from './palette.js';
import { makeTorch, flameWorld } from './fire.js';
import { makeSpear } from './spear.js';

// Drawn where something is in front of the figure (inverted depth test). The
// stencil lets each pixel be painted once, so overlapping parts of the body
// do not add up to a patchy shape. It blends like a transparent material but
// stays in the opaque pass (custom blending), so renderOrder puts it before
// the figure, which then covers it.
export const SIL_OPACITY = 0.8;
export const HANG = 0.3;   // his head hangs forward this much (radians) when he is about to collapse from thirst
export const SIT = { hip: -2.0, knee: 1.05, lean: 0.14, drop: 0.25, arm: -0.95, head: -0.2, spread: 0.16 };   // 0.29.2: the sitting pose at full: thighs forward and up (hip), shins back down (knee), body forward over the knees, seat down on the ground (metres), arms forward, head up to look out, knees a little apart (spread)
export const LEAN = 0.10;   // forward lean per carried piece, radians (three pieces: about 17 degrees), from the hips
const silMat = new THREE.MeshBasicMaterial({
  color: HERO.silhouette, opacity: SIL_OPACITY, depthFunc: THREE.GreaterDepth, depthWrite: false,
  blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  stencilWrite: true, stencilFunc: THREE.NotEqualStencilFunc, stencilRef: 1, stencilZPass: THREE.ReplaceStencilOp,
});

/** The easing of sitting down and getting up (player.sitting 0..1, linear in time, game/game SIT_TIME): no popping at either end. */
export const sitEase = f => { const x = Math.min(1, Math.max(0, f)); return x * x * (3 - 2 * x); };
/** The sitting pose (radians; drop in metres) at a transition value f of player.sitting: all zero standing, SIT when seated, eased in between. */
export function sitPose(f) {
  const e = sitEase(f);
  return { e, hip: SIT.hip * e, knee: SIT.knee * e, ankle: -(SIT.hip + SIT.knee) * e, lean: SIT.lean * e, drop: SIT.drop * e, arm: SIT.arm * e, head: SIT.head * e };
}

export function createHero(scene) {
  const group = new THREE.Group(), body = new THREE.Group(); group.add(body); body.scale.setScalar(0.62);
  const shirt = toon(HERO.shirt), shorts = toon(HERO.shorts), skin = toon(HERO.skin), hair = toon(HERO.hair), hatM = toon(HERO.hat);
  const part = (parent, geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); const o = new THREE.Mesh(geo, outlineMat); o.scale.setScalar(1.12); m.add(o); return m; };
  const box = (parent, w, h, d, mat, x, y, z) => part(parent, new THREE.BoxGeometry(w, h, d), mat, x, y, z);
  const HIP = 0.48, upper = new THREE.Group(); upper.position.y = HIP; body.add(upper);   // bends at the hips
  const joint = (x, y, z, parent = body) => { const j = new THREE.Group(); j.position.set(x, y, z); parent.add(j); return j; };
  const hipL = joint(-0.08, HIP, 0), hipR = joint(0.08, HIP, 0), shL = joint(-0.21, 0.88 - HIP, 0, upper), shR = joint(0.21, 0.88 - HIP, 0, upper), torso = joint(0, -HIP, 0, upper);

  // Legs: frayed shorts to just above the knee, bare lower leg, bare foot. The knee is a joint (0.29.2: he sits with his knees drawn up); walking leaves it straight.
  const knees = [];
  for (const [hip, s] of [[hipL, -1], [hipR, 1]]) {
    box(hip, 0.135, 0.2, 0.145, shorts, 0, -0.1, 0);
    box(hip, 0.04, 0.035, 0.03, shorts, 0.03 * s, -0.21, 0.055);                // frayed hem
    box(hip, 0.035, 0.03, 0.03, shorts, -0.035 * s, -0.205, -0.05);
    const knee = joint(0, -0.2, 0, hip), ankle = joint(0, -0.255, 0, knee); knees.push({ knee, ankle });   // the ankle keeps the foot flat on the ground when he sits
    box(knee, 0.085, 0.27, 0.09, skin, 0, -0.135, 0);
    box(ankle, 0.09, 0.04, 0.16, skin, 0, -0.005, 0.035);                       // bare foot
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

  // Head: face, shaggy hair, a full beard, the straw hat. All on the neck joint (it hangs forward when he is thirsty).
  const NECK = 0.9, neck = joint(0, NECK, 0, torso);
  part(neck, new THREE.SphereGeometry(0.12, 14, 10), skin, 0, 1.04 - NECK, 0);
  const hr = new THREE.Mesh(new THREE.SphereGeometry(0.126, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hair); hr.position.set(0, 1.055 - NECK, -0.01); neck.add(hr);
  box(neck, 0.2, 0.09, 0.06, hair, 0, 1.0 - NECK, -0.09);                             // hair hanging out under the hat
  box(neck, 0.05, 0.06, 0.04, hair, -0.07, 0.95 - NECK, -0.1);
  box(neck, 0.05, 0.05, 0.04, hair, 0.06, 0.955 - NECK, -0.1);
  const beard = part(neck, new THREE.SphereGeometry(0.11, 12, 8), hair, 0, 0.97 - NECK, 0.045); beard.scale.set(1.1, 0.85, 0.9);
  box(torso, 0.13, 0.1, 0.07, hair, 0, 0.885, 0.085);                           // long, unkempt beard over the chest
  box(torso, 0.07, 0.06, 0.05, hair, 0.01, 0.83, 0.1);
  const hat = joint(0, 1.13 - NECK, 0, neck);   // tipped over the face to sleep
  part(hat, new THREE.CylinderGeometry(0.24, 0.24, 0.025, 18), hatM, 0, 0, 0);
  part(hat, new THREE.CylinderGeometry(0.12, 0.14, 0.13, 16), hatM, 0, 0.07, 0);

  const wp = new THREE.Vector3(), wt = new THREE.Vector3(), wq = new THREE.Quaternion(), wr = new THREE.Quaternion(), LAID = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0.12, 0));   // for laying the staff down when he sits
  const staffGeo = new THREE.CylinderGeometry(0.018, 0.022, 1.35, 6), staffMat = toon(HERO.staff);
  const staff = part(shR, staffGeo, staffMat, 0.06, -0.3, 0.1);
  const spear = makeSpear(); spear.scale.setScalar(1 / 0.62); spear.position.set(0.06, -0.3, 0.1); spear.rotation.x = 0.3; spear.visible = false; shR.add(spear);   // 0.30.17: the fishing spear in his right hand, in place of the staff
  const drill = joint(0, 0.2, 0.34, body);   // the staff upright as a fire drill, its foot on the hearth in front of his knees
  part(drill, staffGeo, staffMat, 0, 0.62, 0); drill.visible = false;

  // A burning torch, held up in the left hand (render/fire draws its light).
  const torch = makeTorch(); torch.scale.setScalar(1 / 0.62); torch.position.set(0, -0.44, 0.02); torch.rotation.x = 1.0; torch.visible = false; shL.add(torch);

  // Silhouette: where something solid hides the figure, an even light
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
  let loadKey = '', clock = 0, lean = 0;
  function setLoad(load) {
    const key = load.map(l => l.len.toFixed(3) + l.col + (l.wet ? 'w' : '')).join();
    if (key === loadKey) return;
    loadKey = key;
    for (const c of [...bundle.children]) { bundle.remove(c); c.traverse(o => { if (o.isMesh && o.material !== outlineMat && o.material !== silMat) o.material.dispose(); }); }
    load.forEach((l, i) => {
      const m = new THREE.Mesh(logGeo, l.wet ? wetToon(l.col) : toon(l.col)); m.castShadow = true;
      m.position.set(-l.rad * 0.6 - (i % 2) * 0.05, (i >> 1) * 0.07 - (i % 2) * 0.02, (i - 1) * 0.07 - l.len * 0.1);
      m.quaternion.setFromUnitVectors(up, axis); m.scale.set(l.rad, l.len, l.rad);
      const o = new THREE.Mesh(logGeo, outlineMat); o.scale.set(1.18, 1.02, 1.18); m.add(o);
      bundle.add(m);
    });
    silhouette(bundle);
  }

  function update(p, wade = 0, load = []) {
    setLoad(load); clock += 1 / 60;
    const wk = p.work, kneel = wk && wk.kind !== 'fish' ? Math.min(1, wk.f * (wk.kind === 'drill' || wk.kind === 'build' ? 14 : wk.kind === 'drink' || wk.kind === 'fill' || wk.kind === 'sip' || wk.kind === 'dig' ? 4 : wk.kind === 'roast' ? 6 : 2.5) / 0.4) : 0, drilling = !!wk && wk.kind === 'drill', drinking = !!wk && (wk.kind === 'drink' || wk.kind === 'fill' || wk.kind === 'sip');
    const holding = !!p.spear && !(p.lie > 0), fishing = holding && !!wk && wk.kind === 'fish';   // 0.30.17: he stands and peers, then strikes in the last third
    staff.visible = !drilling && !holding; drill.visible = drilling; spear.visible = holding;
    const lit = !!p.torch && !(p.lie > 0); torch.visible = lit; if (lit) torch.userData.flicker(clock);
    group.position.set(p.x, p.y - Math.min(0.35, wade * 0.6), p.z); group.rotation.y = p.heading;
    const tired = p.tired || 0, thirsty = p.thirsty || 0, lie = p.lie || 0, ly = lie * lie * (3 - 2 * lie);
    const sw = p.moving ? Math.sin(p.phase) * Math.min(0.75, 0.3 + p.speed * 0.1) * (1 - 0.35 * tired) * (1 - CARRY_STRIDE * load.length) : 0, carry = load.length > 0;
    const bend = Math.sin(Math.PI * Math.min(1, p.stoop || 0));   // down and up again
    const sit = Math.sin(Math.PI * Math.min(1, ly * 1.6)) * (ly < 0.62 ? 1 : 0);   // knees bend on the way down and up
    const sp = sitPose((p.sitting || 0) * (1 - ly));   // sitting on the ground (0.29.2)
    const kn = kneel * kneel * (3 - 2 * kneel), rub = wk ? Math.sin(clock * (drilling ? 16 : 9)) : 0, sip = drinking ? Math.max(0, Math.sin(clock * 2.2)) : 0;   // cupped hands up to the mouth, now and then
    hipL.rotation.x += (sw * (1 - sp.e) + bend * 0.5 + sit * 0.9 + kn * 0.75 + sp.hip - hipL.rotation.x) * 0.4; hipR.rotation.x += (-sw * (1 - sp.e) + bend * 0.5 + sit * 0.9 + kn * 0.55 + sp.hip - hipR.rotation.x) * 0.4;   // squatting
    for (const k of knees) { k.knee.rotation.x = sp.knee; k.ankle.rotation.x = sp.ankle; }
    hipL.rotation.z = -SIT.spread * sp.e; hipR.rotation.z = SIT.spread * sp.e;   // the knees a little apart
    lean += (LEAN * load.length - lean) * 0.12;   // the weight pulls him forward a little
    const peer = fishing ? 0.25 : 0;   // leans over the water
    upper.rotation.x = peer + lean * (1 - ly) + sp.lean + bend * 0.9 + tired * 0.18 * (1 - ly) + kn * (drilling ? 0.3 : drinking ? 0.9 - 0.35 * sip : 0.6);
    neck.rotation.x += (HANG * thirsty * (1 - ly) + sp.head + (drinking ? -0.5 * kn * (1 - sip) + 0.3 * kn * sip : 0) - neck.rotation.x) * 0.2;   // head down with thirst; looks ahead at the water
    body.rotation.x = -Math.PI / 2 * ly;   // on his back, face up, head away from where he faced
    hat.position.set(0, 1.13 - NECK - 0.1 * ly, 0.13 * ly); hat.rotation.x = Math.PI / 2 * ly;
    if (kn > 0) {   // both hands forward, working: tearing the husk, or rubbing the drill between the palms
      const fw = drilling ? -0.85 : drinking ? -0.9 - 0.7 * sip : -0.6;
      shL.rotation.z = (drilling ? 0.55 : drinking ? 0.3 : 0.2) * kn; shR.rotation.z = -(drilling ? 0.55 : drinking ? 0.3 : 0.2) * kn;
      const sh = drinking ? 0 : rub * 0.18;
      shL.rotation.x += (fw * kn + sh - shL.rotation.x) * 0.5; shR.rotation.x += (fw * kn - sh - shR.rotation.x) * 0.5;
    } else {
      shR.rotation.z = 0;
      shR.rotation.z = -0.2 * sp.e;
      shL.rotation.z = (carry ? -0.35 : lit ? -0.15 : 0) * (1 - sp.e) + 0.2 * sp.e;
      shL.rotation.x += (((carry ? -0.35 : lit ? -1.0 - sw * 0.1 : -sw * 0.8) - bend * 0.5) * (1 - sp.e) + sp.arm - shL.rotation.x) * 0.4;   // the left arm holds the bundle, or the torch up in front
      const strike = fishing ? Math.min(1, Math.max(0, (wk.f - 0.7) / 0.12)) * (wk.f < 0.95 ? 1 : 0.4) : 0;   // peering (spear held ready, forward and down), then the thrust
      shR.rotation.x += ((fishing ? -1.1 - 0.6 * strike : sw * 0.5 - 0.15 - bend * 0.6) * (1 - sp.e) + sp.arm - shR.rotation.x) * (fishing ? 0.5 : 0.4);
      spear.rotation.x += ((fishing ? 0.9 : 0.3) - spear.rotation.x) * 0.3;
    }
    drill.rotation.y = clock * 22;   // spinning
    body.position.y = (p.moving ? Math.abs(Math.cos(p.phase)) * 0.03 : 0) - bend * 0.12 + ly * 0.07 - kn * 0.13 - sp.drop;
    // sitting, he lays the staff down on the ground beside him (right side, pointing forward): it travels from his hand to the ground as he sits down, and back as he gets up
    staff.position.set(0.06, -0.3, 0.1); staff.quaternion.identity();
    if (sp.e > 0.001 && staff.visible) {
      group.updateMatrixWorld(true);
      staff.getWorldPosition(wp); staff.getWorldQuaternion(wq); wt.set(0.2, 0.03, 0.12); group.localToWorld(wt); group.getWorldQuaternion(wr); wr.multiply(LAID);
      wp.lerp(wt, sp.e); wq.slerp(wr, sp.e);
      staff.parent.worldToLocal(wp); staff.parent.getWorldQuaternion(wr); wq.premultiply(wr.invert()); staff.position.copy(wp); staff.quaternion.copy(wq);
    }
  }
  const flame = out => (torch.visible ? flameWorld(torch, out) : null);
  return { group, update, flame };
}
