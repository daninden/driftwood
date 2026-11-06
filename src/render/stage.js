/**
 * render/stage — renderer, scene and the two lights.
 *
 * A hemisphere sky fill plus one directional light (the sun by day, the
 * moon by night) with a shadow map of 4096 px (2048 px on touch-only devices). Where that light stands, and its
 * colour, come from render/sky; it stands still in the world while you turn
 * the view, so shadows stay on the ground. The shadow camera is fitted tightly
 * round what the view shows (render/shadowFit: finer texels, a different size
 * across the light in each direction) and snapped to shadow texels, in light
 * space, so shadows do not shimmer while walking; render/sky holds the light
 * direction still between small steps so that grid stays put. The depth bias
 * is set in metres (BIAS), not as a fraction of the shadow camera depth, so
 * shadows start right at the foot of a trunk or the castaway instead of a few
 * decimetres away.
 *
 * Shadow edges: three.js's PCF is replaced once, at start, by an own filter
 * (softPcf): 16 taps on a rotated spiral disc of a radius in texels
 * (SOFT_RADIUS, 3), turned per screen pixel, each tap a bilinear comparison
 * (four texels mixed by the fraction), which turns the jagged texel edges
 * into a soft band without steps. Why: with plain taps the jagged texel edges
 * fell slightly differently at every small step of the shadow light and
 * looked like flicker; a finer map and bilinear taps leave no jaggies to jump.
 *
 * Quality (render/quality): the stage starts with, and can change live to, one set of settings
 * { shadowSize, filter, pixelRatioMax, terrainShadows }. The map size is changed by disposing the
 * shadow map (it is made again at the new size on the next draw; snapToTexels reads mapSize.x each
 * frame). The pixel ratio is set again. Terrain meshes (tagged userData.terrain) stop or start
 * casting shadows. The filter: installSoft puts BOTH filters in the shader chunk once, at start, the
 * bilinear one in the PCF branch and the light one (lightPcf, the 16 plain taps of 0.13 to 0.14.1,
 * radius 1.5) in the PCF_SOFT branch, which three.js picks by renderer.shadowMap.type. Changing the
 * type changes the program key, so marking the materials of the scene for an update (needsUpdate)
 * is enough to switch filter live; a material that is not in the scene at that moment switches the
 * next time it is flagged or rebuilt (a few cached ones at most; both filters look much alike).
 *
 * createStage(container, { touch, settings }?) -> { renderer, scene, hemi, sun, resize(), setSun(color, intensity), followSun(view, dir, shadows?), applyQuality(settings), tagTerrain(object) }
 *   settings: as from render/quality settingsFor (default: the level 0 of the device)
 *   tagTerrain(object): sets castShadow of every terrain mesh below object to the current setting (for new tiles)
 *   view { target, yaw, pitch, zoom, aspect } as for fitShadow; dir: unit vector { x, y, z } towards the light
 * shadowMapSize(touch) -> 2048 for touch-only devices, else 4096
 * snapToTexels(p, dir, texel, texelUp) -> { x, y, z }: p moved onto the texel grid of a light shining along dir (render/shadowFit)
 * shadowBias(far) -> depth bias worth BIAS metres for a shadow camera reaching to far
 * softPcf(chunk, radius) -> the three.js shadow chunk with its PCF branch replaced by the own filter (radius in texels)
 * lightPcf(chunk, radius) -> the same with the PCF_SOFT branch replaced by the lighter filter: 16 plain taps (quality level 2)
 * SOFT_RADIUS -> filter radius in texels (3)
 *
 * Depends on: three, render/shadowFit
 */
import * as THREE from 'three';
import { fitShadow, snapToTexels } from './shadowFit.js';

export { snapToTexels };
export const BIAS = 0.04;   // metres along the light
/** Depth bias for a shadow camera from near 1 to `far`: always BIAS metres. */
export const shadowBias = far => -BIAS / (far - 1);
export const SOFT_RADIUS = 3;   // texels
export const shadowMapSize = touch => (touch ? 2048 : 4096);   // phones keep 2048
const PCF_OLD = /#if defined\( SHADOWMAP_TYPE_PCF \)[\s\S]*?(?=#elif defined\( SHADOWMAP_TYPE_PCF_SOFT \))/;
/** The shadow chunk with its PCF branch replaced: 16 bilinear taps on a spiral disc of `radius` texels, turned per screen pixel (no pattern, no crawl). */
export function softPcf(chunk, radius) {
  const glsl = `#if defined( SHADOWMAP_TYPE_PCF )

			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float turn = 6.2831853 * fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) );
			float sum = 0.0;
			for ( int i = 0; i < 16; i ++ ) {
				float fi = float( i );
				float ang = fi * 2.3999632 + turn;
				vec2 off = vec2( cos( ang ), sin( ang ) ) * ( sqrt( ( fi + 0.5 ) / 16.0 ) * ${radius.toFixed(3)} );
				{ vec2 p = ( shadowCoord.xy + off * texelSize ) * shadowMapSize - 0.5; vec2 f = fract( p ); vec2 b = ( floor( p ) + 0.5 ) * texelSize;
				  float a0 = texture2DCompare( shadowMap, b, shadowCoord.z ), a1 = texture2DCompare( shadowMap, b + vec2( texelSize.x, 0.0 ), shadowCoord.z );
				  float a2 = texture2DCompare( shadowMap, b + vec2( 0.0, texelSize.y ), shadowCoord.z ), a3 = texture2DCompare( shadowMap, b + texelSize, shadowCoord.z );
				  sum += mix( mix( a0, a1, f.x ), mix( a2, a3, f.x ), f.y ); }
			}
			shadow = sum * ( 1.0 / 16.0 );

		`;
  return PCF_OLD.test(chunk) ? chunk.replace(PCF_OLD, () => glsl) : chunk;
}
const SOFT_OLD = /#elif defined\( SHADOWMAP_TYPE_PCF_SOFT \)[\s\S]*?(?=#elif defined\( SHADOWMAP_TYPE_VSM \))/;
/** The shadow chunk with its PCF_SOFT branch replaced: 16 plain taps (no bilinear compare) on the same spiral disc of `radius` texels. */
export function lightPcf(chunk, radius) {
  const glsl = `#elif defined( SHADOWMAP_TYPE_PCF_SOFT )

			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float turn = 6.2831853 * fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) );
			float sum = 0.0;
			for ( int i = 0; i < 16; i ++ ) {
				float fi = float( i );
				float ang = fi * 2.3999632 + turn;
				vec2 off = vec2( cos( ang ), sin( ang ) ) * ( sqrt( ( fi + 0.5 ) / 16.0 ) * ${radius.toFixed(3)} );
				sum += texture2DCompare( shadowMap, shadowCoord.xy + off * texelSize, shadowCoord.z );
			}
			shadow = sum * ( 1.0 / 16.0 );

		`;
  return SOFT_OLD.test(chunk) ? chunk.replace(SOFT_OLD, () => glsl) : chunk;
}
export const LIGHT_RADIUS = 1.5;   // texels
let softDone = false;
function installSoft(radius) {
  if (softDone) return; softDone = true;
  THREE.ShaderChunk.shadowmap_pars_fragment = lightPcf(softPcf(THREE.ShaderChunk.shadowmap_pars_fragment, radius), LIGHT_RADIUS);   // before any material compiles
}

export function createStage(container, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  const cfg = { shadowSize: shadowMapSize(!!opts.touch), filter: 'bilinear', pixelRatioMax: 1.5, terrainShadows: true, ...(opts.settings || {}) };
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = cfg.filter === 'plain' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap; installSoft(SOFT_RADIUS);
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const hemi = new THREE.HemisphereLight(0xe2ebf0, 0x8a7458, 0.6); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe6c4, 1.0), clearSun = new THREE.DirectionalLight(0xffe6c4, 0);
  sun.castShadow = true; sun.shadow.mapSize.set(cfg.shadowSize, cfg.shadowSize); sun.shadow.normalBias = 0.03;
  scene.add(sun); scene.add(sun.target); scene.add(clearSun); scene.add(clearSun.target);

  function resize() { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cfg.pixelRatioMax)); renderer.setSize(window.innerWidth, window.innerHeight); }
  resize();
  const tagTerrain = o => o.traverse(m => { if (m.userData.terrain) m.castShadow = cfg.terrainShadows; });
  /** Changes to a new set of settings, live (see the header). */
  function applyQuality(next) {
    const was = { ...cfg }; Object.assign(cfg, next);
    if (cfg.shadowSize !== was.shadowSize) { if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } sun.shadow.mapSize.set(cfg.shadowSize, cfg.shadowSize); }
    if (cfg.pixelRatioMax !== was.pixelRatioMax) resize();
    if (cfg.terrainShadows !== was.terrainShadows) tagTerrain(scene);
    if (cfg.filter !== was.filter) {
      renderer.shadowMap.type = cfg.filter === 'plain' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
      scene.traverse(o => { if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.needsUpdate = true; });
    }
  }

  let shadowStrength = 1, sunIntensity = 1;
  const st = new THREE.Vector3(), dir = new THREE.Vector3();
  /** Split direct light between a shadowed and an unshadowed twin: total light stays unchanged while the shadow fades. */
  function setSun(color, intensity) {
    sun.color.copy(color); clearSun.color.copy(color); sunIntensity = intensity;
    sun.intensity = sunIntensity * shadowStrength; clearSun.intensity = sunIntensity * (1 - shadowStrength);
  }
  function followSun(view, d, shadows = 1) {
    shadowStrength = Math.max(0, Math.min(1, shadows));
    sun.intensity = sunIntensity * shadowStrength; clearSun.intensity = sunIntensity * (1 - shadowStrength);
    // Once the shadow contribution is actually zero there is no map pass.
    sun.castShadow = shadowStrength > 0;
    dir.set(d.x, d.y, d.z).normalize();
    const { centre, ha, hb } = fitShadow(view, dir), size = sun.shadow.mapSize.x;
    const q = snapToTexels(centre, dir, ha * 2 / size, hb * 2 / size); st.set(q.x, q.y, q.z);
    const half = Math.max(ha, hb);
    sun.target.position.copy(st); clearSun.target.position.copy(st); const dist = half * 3 + 200;   // far enough that a low light still stands above the summits (casters are found by depth, not by the box)
    sun.position.copy(st).addScaledVector(dir, dist); clearSun.position.copy(sun.position); sun.target.updateMatrixWorld(); clearSun.target.updateMatrixWorld();
    const far = dist * 2 + half * 2;
    Object.assign(sun.shadow.camera, { left: -ha, right: ha, top: hb, bottom: -hb, near: 1, far });
    sun.shadow.bias = shadowBias(far);
    sun.shadow.camera.updateProjectionMatrix();
  }
  return { renderer, scene, hemi, sun, resize, setSun, followSun, applyQuality, tagTerrain };
}
