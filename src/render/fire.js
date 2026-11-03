/**
 * render/fire — the fires of game/fire: charred wood laid as a little
 * tepee, flickering flames, embers, rising smoke, and the warm light a fire
 * throws round it at night.
 *
 *   - Flames are a few unlit cones in the colours of FIRE (palette), sized by
 *     the fire's strength (game/fire `strength`); they flicker, each fire in
 *     its own rhythm. When the wood is gone only the embers glow, dimming.
 *   - Smoke rises and drifts away: thin over a good fire, thicker over embers
 *     and wet wood. A failed attempt (game/fire `puffs`) leaves a short puff;
 *     drilling (player.work) raises a thin wisp near the end.
 *   - One warm point light stands over the strongest fire near the castaway,
 *     brighter at night. At night a soft warm glow is also laid over the
 *     picture round it (a DOM layer above the night grading of render/mood,
 *     which would otherwise darken the firelight with everything else).
 *
 * smokeAmount(fire, strength) -> 0..1 how much smoke a fire gives, pure
 * createFireView(scene, container, fire) -> fireView
 *   fireView.update(dt, { total, day, camera, player, H })
 *     total: days on the clock; day: 1 by day .. 0 at night (render/sky);
 *     camera: for the glow on screen; player: for the light and the wisp;
 *     H: the world's ground height
 *
 * Depends on: three, render/materials, render/palette, game/clock, game/fire
 */
import * as THREE from 'three';
import { toon, outlineMat } from './materials.js';
import { FIRE } from './palette.js';
import { DAY_SECONDS } from '../game/clock.js';
import { EMBERS } from '../game/fire.js';

const PUFF_SECONDS = 7, WISPS = 7, LIGHT_RANGE = 9, NEAR = 60;

export const smokeAmount = (f, s) => f.fuel > 0 ? 0.35 + 0.25 * (1 - s) : 0.5 * Math.min(1, f.embers / EMBERS + 0.2);

const TONGUES = [[0, 0, 1], [0.09, 0.05, 0.7], [-0.07, 0.07, 0.62], [0.02, -0.09, 0.55]];   // offset x, z and height of each flame tongue
const coneGeo = (() => {   // a flame tongue: yellow at the foot, orange-red at the tip
  const g = new THREE.ConeGeometry(1, 1, 7, 3, true).translate(0, 0.5, 0), p = g.attributes.position, c = [], lo = new THREE.Color(FIRE.flame[0]), mid = new THREE.Color(FIRE.flame[1]), hi = new THREE.Color(FIRE.flame[2]), t = new THREE.Color();
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); (y < 0.5 ? t.copy(lo).lerp(mid, y * 2) : t.copy(mid).lerp(hi, (y - 0.5) * 2)).toArray(c, i * 3); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); return g;
})();
const logGeo = new THREE.CylinderGeometry(1, 0.8, 1, 7).translate(0, 0.5, 0);
const blobGeo = new THREE.IcosahedronGeometry(1, 1);
const ashGeo = new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2);
const flameMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
const emberMat = new THREE.MeshBasicMaterial({ color: FIRE.ember, transparent: true });
const ashMat = toon(FIRE.ash, { transparent: true, opacity: 0.85, depthWrite: false });

/** A rising column of soft puffs at (x, y, z); amount 0..1 how thick. */
function createSmoke(scene, seed) {
  const g = new THREE.Group(), puffs = [];
  for (let i = 0; i < WISPS; i++) {
    const m = new THREE.Mesh(blobGeo, new THREE.MeshBasicMaterial({ color: FIRE.smoke, transparent: true, opacity: 0, depthWrite: false }));
    m.renderOrder = 3; g.add(m); puffs.push(m);
  }
  scene.add(g);
  let t = seed * 1.7;
  return {
    update(dt, x, y, z, amount) {
      t += dt; g.visible = amount > 0.01;
      if (!g.visible) return;
      puffs.forEach((m, i) => {
        const u = ((t / 4.5 + i / WISPS) % 1 + 1) % 1, k = Math.sin(seed * 3 + i * 2.1);
        m.position.set(x + u * u * 1.4 + Math.sin(t * 0.7 + i) * 0.08 * u, y + 0.25 + u * 2.6, z + u * u * 0.6 + k * 0.1 * u);
        m.scale.setScalar(0.1 + u * 0.38);
        m.material.opacity = amount * 0.55 * Math.sin(Math.PI * Math.min(1, u * 1.15)) * (1 - u * 0.4);
      });
    },
    dispose() { scene.remove(g); puffs.forEach(m => m.material.dispose()); },
  };
}

export function createFireView(scene, container, fire) {
  const views = new Map();   // fire -> its meshes
  const puffs = new Map();   // failed attempt -> smoke
  const light = new THREE.PointLight(FIRE.light, 0, LIGHT_RANGE, 2); light.castShadow = false; scene.add(light);   // always there, so no shader is rebuilt when a fire is lit
  const wisp = createSmoke(scene, 0.3);
  const glow = document.createElement('div'); glow.style.cssText = 'position:fixed;inset:0;pointer-events:none;mix-blend-mode:screen;opacity:0;';
  container.appendChild(glow);
  const v = new THREE.Vector3();
  let clock = 0;

  function build(f) {
    const g = new THREE.Group(); g.position.set(f.x, 0, f.z); scene.add(g);
    const ash = new THREE.Mesh(ashGeo, ashMat); ash.scale.setScalar(0.42); ash.position.y = 0.012; ash.receiveShadow = true; g.add(ash);
    const wood = new THREE.Group(); g.add(wood);
    const flames = TONGUES.map(() => { const m = new THREE.Mesh(coneGeo, flameMat); g.add(m); return m; });
    const embers = [0, 1, 2, 3, 4].map(i => { const m = new THREE.Mesh(blobGeo, emberMat); const a = i * 1.3 + f.id; m.position.set(Math.cos(a) * 0.12, 0.05, Math.sin(a) * 0.12); m.scale.set(0.06, 0.035, 0.05); g.add(m); return m; });
    return { g, wood, flames, embers, smoke: createSmoke(scene, f.id + 1), key: '' };
  }
  function layWood(vw, f, s) {
    const n = Math.max(3, Math.min(6, f.fed)), key = n + ':' + (s > 0 ? Math.round(s * 4) : 'e');
    if (key === vw.key) return; vw.key = key;
    for (const c of [...vw.wood.children]) { vw.wood.remove(c); c.material.dispose(); }
    const tall = s > 0 ? 0.25 + 0.3 * s : 0.06;   // the tepee sinks as it burns down
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + f.id, m = new THREE.Mesh(logGeo, toon(FIRE.char[i % FIRE.char.length]));
      m.position.set(Math.cos(a) * 0.34, 0.02, Math.sin(a) * 0.34);
      m.lookAt(0, tall, 0); m.rotateX(Math.PI / 2); m.scale.set(0.055, Math.hypot(0.34, tall) * 1.05, 0.055);
      m.castShadow = true; const o = new THREE.Mesh(logGeo, outlineMat); o.scale.set(1.25, 1.02, 1.25); m.add(o);
      vw.wood.add(m);
    }
  }
  function dropView(vw) { scene.remove(vw.g); vw.wood.children.forEach(c => c.material.dispose()); vw.smoke.dispose(); }

  function update(dt, { total, day, camera, player, H }) {
    clock += dt;
    const night = 1 - day;
    // fires come and go
    for (const f of fire.fires) if (!views.has(f)) views.set(f, build(f));
    views.forEach((vw, f) => { if (!fire.fires.includes(f)) { dropView(vw); views.delete(f); } });
    let best = null, bestW = 0;
    views.forEach((vw, f) => {
      const s = fire.strength(f), y = H(f.x, f.z), fl = Math.sin(clock * 9 + f.id) * 0.5 + Math.sin(clock * 13.7 + f.id * 2) * 0.5;
      vw.g.position.y = y;
      layWood(vw, f, s);
      vw.flames.forEach((m, i) => {
        const [ox, oz, k] = TONGUES[i], lick = Math.sin(clock * (7 + i * 2.3) + f.id + i * 1.7) * 0.5 + Math.sin(clock * (11 + i) + i) * 0.5;
        m.visible = s > 0 && (i < 2 || s > 0.4);
        const h = (0.3 + 0.55 * s) * k * (1 + 0.18 * lick), r = 0.13 * (0.6 + 0.4 * s) * (0.7 + 0.3 * k);
        m.scale.set(r, h, r);
        m.position.set(ox * (0.6 + 0.4 * s) + Math.sin(clock * 5 + i) * 0.012, 0.04, oz * (0.6 + 0.4 * s) + Math.cos(clock * 4 + i) * 0.012);
        m.rotation.set(ox * 1.2 + lick * 0.06, clock * (0.5 + i * 0.2), -oz * 1.2);
      });
      const glowE = s > 0 ? 1 : Math.max(0.15, f.embers / EMBERS);
      emberMat.opacity = 1;
      vw.embers.forEach((m, i) => { m.visible = true; m.scale.y = 0.035 * (0.8 + 0.2 * Math.sin(clock * 2 + i)) * glowE; });
      vw.smoke.update(dt, f.x, y + (s > 0 ? 0.3 + 0.5 * s : 0.05), f.z, smokeAmount(f, s));
      const d = Math.hypot(f.x - player.x, f.z - player.z), wgt = (s > 0 ? s : 0.25 * glowE) * (d < NEAR ? 1 : 0) / (1 + d * 0.05);
      if (wgt > bestW) { bestW = wgt; best = { f, s, y, fl, glowE }; }
    });
    // failed attempts: a short puff of smoke
    for (const p of fire.puffs) if (!puffs.has(p) && (total - p.at) * DAY_SECONDS < PUFF_SECONDS) puffs.set(p, createSmoke(scene, p.at * 97));
    puffs.forEach((sm, p) => {
      const age = (total - p.at) * DAY_SECONDS;
      if (age > PUFF_SECONDS || !fire.puffs.includes(p)) { sm.dispose(); puffs.delete(p); return; }
      sm.update(dt, p.x, H(p.x, p.z), p.z, 0.8 * (1 - age / PUFF_SECONDS));
    });
    // the drill smokes near the end
    const wk = player.work;
    if (wk && wk.kind === 'drill') { const fx = player.x + Math.sin(player.heading) * 0.3, fz = player.z + Math.cos(player.heading) * 0.3; wisp.update(dt, fx, H(fx, fz) - 0.2, fz, Math.max(0, (wk.f - 0.45) / 0.55) ** 2 * 0.6); }
    else wisp.update(dt, 0, 0, 0, 0);
    // the light and the glow of the strongest fire close by
    if (best) {
      const { f, s, y, fl, glowE } = best, pow = s > 0 ? s : 0.2 * glowE;
      light.position.set(f.x, y + 0.6, f.z);
      light.intensity = pow * 1.1 * night * night * (1 + 0.08 * fl);   // by day the sun drowns it
      light.distance = LIGHT_RANGE * (0.6 + 0.4 * pow);
      v.set(f.x, y + 0.3, f.z).project(camera);
      const rc = container.getBoundingClientRect(), sx = (v.x + 1) / 2 * rc.width, sy = (1 - v.y) / 2 * rc.height;
      const px = light.distance / (camera.top - camera.bottom) * rc.height * 0.5, [r, g, b] = FIRE.glow;
      const core = (px * 0.12).toFixed(0), cy = (sy - px * 0.05).toFixed(0);   // the flames themselves, bright over the night grading
      glow.style.background = `radial-gradient(circle ${core}px at ${sx.toFixed(0)}px ${cy}px, rgba(255,214,140,0.95), rgba(255,170,90,0.5) 55%, rgba(255,170,90,0) 100%), radial-gradient(circle ${px.toFixed(0)}px at ${sx.toFixed(0)}px ${sy.toFixed(0)}px, rgba(${r},${g},${b},0.6), rgba(${r},${g},${b},0.22) 30%, rgba(${r},${g},${b},0.06) 65%, rgba(${r},${g},${b},0) 100%)`;
      glow.style.opacity = (night * night * pow * (0.8 + 0.2 * fl)).toFixed(3);
    } else { light.intensity = 0; glow.style.opacity = '0'; }
  }
  return { update };
}
