/**
 * render/fire — the fires of game/fire: charred wood laid as a little
 * tepee, flickering flames, embers, rising smoke, and the warm light a fire
 * throws round it at night.
 *
 *   - Flames are a few unlit cones in the colours of FIRE (palette), sized by
 *     the fire's strength (game/fire `strength`); they flicker, each fire in
 *     its own rhythm. When the wood is gone only the embers glow: warm at
 *     first, then dwindling to a few red points over their long stage.
 *   - Smoke rises and drifts away: thin over a good fire, thicker over embers
 *     and wet wood. A failed attempt (game/fire `puffs`) leaves a short puff;
 *     drilling (player.work) raises a thin wisp near the end.
 *   - Warm point lights stand over the nearest burning fires and torches in the
 *     ground (0.17.2): a fixed pool, always in the scene (so no shader is
 *     rebuilt), of which `active` are given out each frame, brighter at night.
 *     A light that changes the fire it serves first fades out and then fades
 *     in on the new one (FADE seconds), so nothing pops. At night a soft warm
 *     glow is laid over the picture round every light that is on: two prebaked sprites (a wide soft glow and a small bright core)
 *     drawn into the shared light layer (render/lightLayer, 0.27.7: a small canvas above the night grading of render/mood, which would
 *     otherwise darken the firelight with everything else; before it was a full-screen div with CSS gradients rebuilt every frame).
 *
 *   - A burnt place put out by the rain (`wet: true`, 0.21) is wet ash: the ash darker, the char ends the same.
 *   - A burnt place (game/fire `burnt`) is what a fire leaves when it goes out: a
 *     patch of ash and a few charred ends on the ground, no flame, smoke or
 *     light. It fades slowly over its two days (burntOpacity) and is gone.
 *
 * burntOpacity(left) -> 0..1   how clear a burnt place is with `left` days to
 *   go (BURNT_DAYS at first), pure: it fades from BURNT_PEAK to BURNT_FLOOR
 * pieces(fire) -> 1..8 the pieces the tepee is laid with (one per piece still on the
 *   fire, so it grows when wood is laid on and sinks as it burns; 3 for embers), pure
 * smokeAmount(fire, strength) -> 0..1 how much smoke a fire gives, pure
 * pickLights(lights, at, active) -> { carried, picks }   pure: of the lights ({ key, x, z, carried? }) within
 *   NEAR of `at`, the carried one (always, it has its own point light) and the `active` nearest others
 * stepPool(slots, picks, dt)   pure: gives the picked lights to slots ({ key, k, src }) with a fade: a slot keeps its
 *   light while it is picked; one that is not picked fades out over FADE seconds and only then takes a new light,
 *   which fades in; nothing jumps
 *   - A torch (game/fire) is a short charred stick with a small flame; stuck
 *     in the sand it stands slightly askew. It lights its surroundings like a
 *     small fire: a point light of its own follows the torch in his hand.
 *
 * makeTorch() -> Group   a torch, foot at its origin; userData.flicker(time)
 * FLAME_LOCAL, flameWorld(torch, out)   where the flame is, in the torch's
 *   space and in the world (with the tilt of a held or askew torch); the
 *   torch lights and their glow sit exactly there
 * createFireView(scene, container, fire, { pool, active, layer }?) -> fireView
 *   layer: the light layer to draw the glow into (islandView shares one with the fireflies and calls its begin and end round the frame);
 *   by default one of its own in the container
 *   pool: how many point lights for fires and torches in the ground (default POOL, fixed for the session);
 *   active: how many of them are given out (default pool; fireView.setActive(n) lowers it with the quality,
 *   the rest stay in the scene at intensity 0); fireView.lights is the number of point lights in the scene
 *   fireView.update(dt, { total, day, camera, player, H, heroFlame })
 *     total: days on the clock; day: 1 by day .. 0 at night (render/sky);
 *     camera: for the glow on screen; player: for the lights, the wisp and
 *     the torch he carries (player.torch);
 *     H: the world's ground height; heroFlame(out) -> out | null: the flame
 *     of the torch in his hand in world space (render/hero `flame`)
 *
 * Depends on: three, render/materials, render/palette, render/lightLayer, game/clock, game/fire
 */
import * as THREE from 'three';
import { toon, outlineMat } from './materials.js';
import { FIRE } from './palette.js';
import { createLightLayer, radialSprite } from './lightLayer.js';
import { DAY_SECONDS } from '../game/clock.js';
import { EMBERS, BURNT_DAYS, BURN, FUEL_MAX, emberGlow } from '../game/fire.js';

const PUFF_SECONDS = 7, WISPS = 7, LIGHT_RANGE = 14, NEAR = 60;
export const POOL = 4, FADE = 0.3;   // point lights for fires and torches in the ground; seconds to fade a light out or in
const TORCH_POW = 0.55, TORCH_RANGE = 9;
// Gentler than the inverse square (decay 2): the light is the same one metre from the flame, but reaches further, so the wider range shows.
const LIGHT_DECAY = 1.5;

/** Of the lights within NEAR of `at`: the carried one, and the `active` nearest others (pure). */
export function pickLights(lights, at, active) {
  const d = l => Math.hypot(l.x - at.x, l.z - at.z), near = lights.filter(l => d(l) < NEAR);
  return { carried: near.find(l => l.carried) || null, picks: near.filter(l => !l.carried).sort((a, b) => d(a) - d(b)).slice(0, Math.max(0, active)) };
}

/** Gives the picked lights to the slots with a fade, in place (pure; see the header). */
export function stepPool(slots, picks, dt) {
  const keys = new Set(picks.map(l => l.key));
  for (const s of slots) {
    const want = s.key !== null && keys.has(s.key);
    if (want) s.src = picks.find(l => l.key === s.key);
    s.k = want ? Math.min(1, s.k + dt / FADE) : Math.max(0, s.k - dt / FADE);
    if (!want && s.k <= 0) { s.key = null; s.src = null; }
  }
  for (const l of picks) if (!slots.some(s => s.key === l.key)) { const free = slots.find(s => s.key === null); if (free) { free.key = l.key; free.src = l; free.k = 0; } }
}

export const BURNT_PEAK = 0.8, BURNT_FLOOR = 0.12;   // opacity of a fresh burnt place, and just before it is gone
export const burntOpacity = left => BURNT_FLOOR + (BURNT_PEAK - BURNT_FLOOR) * Math.min(1, Math.max(0, left / BURNT_DAYS));

/** How many charred pieces the tepee of a fire is laid with: one for each piece still on it (1..8), a sunk heap of three for embers. */
export const pieces = f => f.fuel > 0 ? Math.max(1, Math.min(Math.round(FUEL_MAX / BURN), Math.ceil(f.fuel / BURN - 0.05))) : 3;

export const smokeAmount = (f, s) => f.fuel > 0 ? 0.35 + 0.25 * (1 - s) : 0.5 * (0.1 + 0.9 * emberGlow(f));

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
        m.material.opacity = amount * 0.66 * Math.sin(Math.PI * Math.min(1, u * 1.15)) * (1 - u * 0.4);
      });
    },
    dispose() { scene.remove(g); puffs.forEach(m => m.material.dispose()); },
  };
}

/** Where the flame of a torch sits, in the torch's own space (the middle of the flame above the head). */
export const FLAME_LOCAL = new THREE.Vector3(0, 0.68, 0);
/** The flame of a torch object in world space, with its current tilt and parents (written to out). */
export function flameWorld(torch, out) {
  torch.updateWorldMatrix(true, false);
  return out.copy(FLAME_LOCAL).applyMatrix4(torch.matrixWorld);
}

/** A torch: a short stick with a small flame at its head (also used by render/hero). */
export function makeTorch() {
  const g = new THREE.Group();
  const stick = new THREE.Mesh(logGeo, toon(FIRE.char[1])); stick.scale.set(0.025, 0.55, 0.025); stick.castShadow = true;
  const o = new THREE.Mesh(logGeo, outlineMat); o.scale.set(1.5, 1.02, 1.5); stick.add(o); g.add(stick);
  const head = new THREE.Mesh(blobGeo, toon(FIRE.char[2])); head.position.y = 0.56; head.scale.set(0.045, 0.06, 0.045); g.add(head);
  const flames = [0, 1].map(i => { const m = new THREE.Mesh(coneGeo, flameMat); m.position.set(i * 0.02 - 0.01, 0.58, 0); g.add(m); return m; });
  g.userData.flicker = t => flames.forEach((m, i) => { const k = 1 + 0.2 * Math.sin(t * (9 + i * 4) + i); m.scale.set(0.05 - i * 0.012, (0.2 - i * 0.06) * k, 0.05 - i * 0.012); });
  return g;
}

/** Torches stuck in the ground. */
function createTorches(scene) {
  const views = new Map();
  return {
    flame(tc, out) { return views.has(tc) ? flameWorld(views.get(tc), out) : null; },
    update(list, t, H) {
      for (const tc of list) if (!views.has(tc)) { const m = makeTorch(); m.rotation.z = 0.12; m.rotation.y = tc.id; scene.add(m); views.set(tc, m); }
      views.forEach((m, tc) => {
        if (!list.includes(tc)) { scene.remove(m); views.delete(tc); return; }
        m.position.set(tc.x, H(tc.x, tc.z) - 0.08, tc.z); m.userData.flicker(t + tc.id);
      });
    },
  };
}

/** A burnt place: ash and charred ends, each place with its own materials so it fades on its own. */
function buildBurnt(b) {
  const g = new THREE.Group(), mats = [], mat = (col, base) => { const m = toon(col, { transparent: true, opacity: base, depthWrite: false }); m.userData.base = base; mats.push(m); return m; };
  const ash = new THREE.Mesh(ashGeo, mat(b.wet ? new THREE.Color(FIRE.ash).multiplyScalar(0.55).getHex() : FIRE.ash, 0.85)); ash.scale.setScalar(0.5); ash.position.y = 0.012; ash.receiveShadow = true; g.add(ash);
  const dark = new THREE.Mesh(ashGeo, mat(FIRE.char[2], 0.7)); dark.scale.set(0.3, 1, 0.24); dark.rotation.y = b.id; dark.position.y = 0.014; g.add(dark);
  for (let i = 0; i < b.n; i++) {   // the charred ends, lying where the tepee fell
    const a = i / b.n * Math.PI * 2 + b.id, m = new THREE.Mesh(logGeo, mat(FIRE.char[i % FIRE.char.length], 1));
    m.position.set(Math.cos(a) * 0.2, 0.02, Math.sin(a) * 0.2); m.rotation.set(Math.PI / 2 - 0.12, 0, -a + Math.PI / 2); m.scale.set(0.045, 0.22 + 0.05 * (i % 3), 0.045);
    const o = new THREE.Mesh(logGeo, outlineMat.clone()); o.material.transparent = true; o.scale.set(1.25, 1.02, 1.25); o.material.userData.base = 1; mats.push(o.material); m.add(o); g.add(m);
  }
  return { g, mats, shown: -1 };
}

export function createFireView(scene, container, fire, opts = {}) {
  const views = new Map();   // fire -> its meshes
  const burnt = new Map();   // burnt place -> its meshes
  const puffs = new Map();   // failed attempt -> smoke
  // always there, so no shader is rebuilt when a fire is lit or a torch taken
  // the number of point lights in the scene never changes for the session; a lower quality only gives out fewer
  const pool = Math.max(1, Math.floor(opts.pool ?? POOL)); let active = Math.min(pool, Math.max(0, Math.floor(opts.active ?? pool)));
  const handLight = new THREE.PointLight(FIRE.light, 0, TORCH_RANGE, LIGHT_DECAY); scene.add(handLight);
  const slots = Array.from({ length: pool }, () => { const light = new THREE.PointLight(FIRE.light, 0, LIGHT_RANGE, LIGHT_DECAY); scene.add(light); return { light, key: null, k: 0, src: null }; });
  const place = (pl, l, night, k = 1) => {
    if (!l || k <= 0) { pl.intensity = 0; return; }
    pl.position.set(l.x, l.y, l.z); pl.intensity = l.pow * 1.1 * night * night * (1 + 0.08 * l.fl) * k;   // by day the sun drowns it
    pl.distance = l.range * (0.6 + 0.4 * l.pow);
  };
  const torchView = createTorches(scene);
  const wisp = createSmoke(scene, 0.3);
  const layer = opts.layer || createLightLayer(container), own = !opts.layer;
  const [gr, gg, gb] = FIRE.glow;   // the sprites of the glow, at full strength: a wide soft one and a small bright core, drawn with the light's own alpha
  const wide = radialSprite(128, [[0, `rgba(${gr},${gg},${gb},0.6)`], [0.3, `rgba(${gr},${gg},${gb},0.22)`], [0.65, `rgba(${gr},${gg},${gb},0.06)`], [1, `rgba(${gr},${gg},${gb},0)`]]);
  const core = radialSprite(64, [[0, 'rgba(255,214,140,0.95)'], [0.55, 'rgba(255,170,90,0.5)'], [1, 'rgba(255,170,90,0)']]);
  const v = new THREE.Vector3(), flame = new THREE.Vector3(), spots = new Float64Array((pool + 1) * 4);
  let clock = 0;

  function build(f) {
    const g = new THREE.Group(); g.position.set(f.x, 0, f.z); scene.add(g);
    const ash = new THREE.Mesh(ashGeo, ashMat); ash.scale.setScalar(0.42); ash.position.y = 0.012; ash.receiveShadow = true; g.add(ash);
    const wood = new THREE.Group(); g.add(wood);
    const flames = TONGUES.map(() => { const m = new THREE.Mesh(coneGeo, flameMat); g.add(m); return m; });
    const embers = [0, 1, 2, 3, 4].map(i => { const m = new THREE.Mesh(blobGeo, emberMat.clone()); const a = i * 1.3 + f.id; m.position.set(Math.cos(a) * 0.12, 0.05, Math.sin(a) * 0.12); m.scale.set(0.06, 0.035, 0.05); g.add(m); return m; });
    return { g, wood, flames, embers, smoke: createSmoke(scene, f.id + 1), key: '' };
  }
  function layWood(vw, f, s) {
    const n = pieces(f), key = n + ':' + (s > 0 ? 'f' : 'e');
    if (key === vw.key) return; vw.key = key;
    for (const c of [...vw.wood.children]) { vw.wood.remove(c); c.material.dispose(); }
    const tall = s > 0 ? 0.2 + 0.045 * n : 0.06, rim = 0.28 + 0.012 * n;   // the tepee grows with the pieces on the fire and sinks as it burns down
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + f.id, m = new THREE.Mesh(logGeo, toon(FIRE.char[i % FIRE.char.length]));
      m.position.set(Math.cos(a) * rim, 0.02, Math.sin(a) * rim);
      m.lookAt(0, tall, 0); m.rotateX(Math.PI / 2); m.scale.set(0.055, Math.hypot(rim, tall) * 1.05, 0.055);
      m.castShadow = true; const o = new THREE.Mesh(logGeo, outlineMat); o.scale.set(1.25, 1.02, 1.25); m.add(o);
      vw.wood.add(m);
    }
  }
  function dropView(vw) { scene.remove(vw.g); vw.wood.children.forEach(c => c.material.dispose()); vw.embers.forEach(m => m.material.dispose()); vw.smoke.dispose(); }

  function update(dt, { total, day, camera, player, H, heroFlame }) {
    clock += dt;
    const night = 1 - day;
    // fires come and go
    for (const f of fire.fires) if (!views.has(f)) views.set(f, build(f));
    views.forEach((vw, f) => { if (!fire.fires.includes(f)) { dropView(vw); views.delete(f); } });
    // burnt places: no light, no smoke, fading over their two days
    for (const b of fire.burnt) if (!burnt.has(b)) { const vw = buildBurnt(b); scene.add(vw.g); burnt.set(b, vw); }
    burnt.forEach((vw, b) => {
      if (!fire.burnt.includes(b)) { scene.remove(vw.g); vw.mats.forEach(m => m.dispose()); burnt.delete(b); return; }
      vw.g.position.set(b.x, H(b.x, b.z), b.z);
      const o = Math.round(burntOpacity(b.left) * 50);
      if (o !== vw.shown) { vw.shown = o; vw.mats.forEach(m => { m.opacity = m.userData.base * o / 50; }); }
    });
    const lights = [];   // { x, y, z, pow, range, fl }: what gives light near the castaway
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
      const glowE = s > 0 ? 1 : emberGlow(f);
      vw.embers.forEach((m, i) => {
        const point = s > 0 || i < 1 || glowE > 0.12;
        m.visible = point; m.material.opacity = s > 0 ? 1 : (0.08 + 0.92 * glowE);
        m.scale.y = 0.035 * (0.8 + 0.2 * Math.sin(clock * 2 + i)) * (s > 0 ? 1 : 0.35 + 0.65 * glowE);
      });
      vw.smoke.update(dt, f.x, y + (s > 0 ? 0.3 + 0.5 * s : 0.05), f.z, smokeAmount(f, s));
      lights.push({ key: f, x: f.x, y: y + 0.6, z: f.z, pow: s > 0 ? s : 0.2 * glowE, range: LIGHT_RANGE, fl });
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
    // torches: stuck in the ground, and the one he carries (drawn by render/hero)
    torchView.update(fire.torches, clock, H);
    for (const t of fire.torches) { const p = torchView.flame(t, flame); if (p) lights.push({ key: t, x: p.x, y: p.y, z: p.z, pow: TORCH_POW, range: TORCH_RANGE, fl: Math.sin(clock * 11 + t.id), exact: true }); }
    if (player.torch && heroFlame && heroFlame(flame)) lights.push({ x: flame.x, y: flame.y, z: flame.z, pow: TORCH_POW, range: TORCH_RANGE, fl: Math.sin(clock * 12), carried: true, exact: true });
    // the point lights: the carried torch, and the nearest fires and torches in the ground (faded, never jumping)
    const { carried, picks } = pickLights(lights, player, active);
    stepPool(slots, picks, dt);
    place(handLight, carried, night);
    for (const s of slots) place(s.light, s.src, night, s.k);
    // at night a warm glow round every light that is on, over the night grading
    if (own) layer.begin();
    if (night > 0.04) {   // by day there is nothing to draw
      const rc = layer.rect(), per = rc.height / (camera.top - camera.bottom);
      let n = 0;   // the glows of this frame (x, y, radius, alpha), in a buffer kept between frames: the wide soft ones first, then the bright cores over them
      const shine = (l, fade) => {
        v.set(l.x, l.exact ? l.y : l.y - 0.3, l.z).project(camera);
        const px = l.range * (0.6 + 0.4 * l.pow) * per * 0.5;
        spots[n++] = (v.x + 1) / 2 * rc.width; spots[n++] = (1 - v.y) / 2 * rc.height; spots[n++] = px; spots[n++] = night * night * l.pow * (0.8 + 0.2 * l.fl) * fade;
      };
      if (carried) shine(carried, 1);
      for (const s of slots) if (s.src && s.k > 0 && n < spots.length) shine(s.src, s.k);
      for (let i = 0; i < n; i += 4) layer.draw(wide, spots[i], spots[i + 1], spots[i + 2], spots[i + 3]);
      for (let i = 0; i < n; i += 4) layer.draw(core, spots[i], spots[i + 1] - spots[i + 2] * 0.05, spots[i + 2] * 0.12, spots[i + 3], true);
    }
    if (own) layer.end();
  }
  return { update, setActive(n) { active = Math.min(pool, Math.max(0, Math.floor(n))); }, get lights() { return pool + 1; } };
}
