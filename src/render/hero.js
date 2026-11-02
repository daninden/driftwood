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
 * createHero(scene) -> { group, update(player, wadeDepth) }
 *   update copies position and heading from the player state
 *   (game/movement) and animates the walk cycle from player.phase.
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
  const joint = (x, y, z) => { const j = new THREE.Group(); j.position.set(x, y, z); body.add(j); return j; };
  const hipL = joint(-0.08, 0.48, 0), hipR = joint(0.08, 0.48, 0), shL = joint(-0.21, 0.88, 0), shR = joint(0.21, 0.88, 0), torso = joint(0, 0, 0);

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
  part(torso, new THREE.CylinderGeometry(0.24, 0.24, 0.025, 18), hatM, 0, 1.13, 0);
  part(torso, new THREE.CylinderGeometry(0.12, 0.14, 0.13, 16), hatM, 0, 1.2, 0);

  part(shR, new THREE.CylinderGeometry(0.018, 0.022, 1.35, 6), toon(HERO.staff), 0.06, -0.3, 0.1);

  // Silhouette: where something solid hides the figure, a light stippled
  // shape shows through. It is drawn after the world and before the figure
  // itself (renderOrder), with an inverted depth test.
  const parts = []; group.traverse(o => { if (o.isMesh) parts.push(o); });
  for (const m of parts) {
    m.renderOrder = 2;
    if (m.material === outlineMat) continue;
    const sil = new THREE.Mesh(m.geometry, silMat); sil.renderOrder = 1; m.add(sil);
  }
  scene.add(group);

  function update(p, wade = 0) {
    group.position.set(p.x, p.y - Math.min(0.35, wade * 0.6), p.z); group.rotation.y = p.heading;
    const sw = p.moving ? Math.sin(p.phase) * Math.min(0.75, 0.3 + p.speed * 0.1) : 0;
    hipL.rotation.x += (sw - hipL.rotation.x) * 0.4; hipR.rotation.x += (-sw - hipR.rotation.x) * 0.4;
    shL.rotation.x += (-sw * 0.8 - shL.rotation.x) * 0.4; shR.rotation.x += (sw * 0.5 - 0.15 - shR.rotation.x) * 0.4;
    body.position.y = p.moving ? Math.abs(Math.cos(p.phase)) * 0.03 : 0;
  }
  return { group, update };
}
