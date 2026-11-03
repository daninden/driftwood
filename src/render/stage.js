/**
 * render/stage — renderer, scene and the two lights.
 *
 * A hemisphere sky fill plus one directional light (the sun by day, the
 * moon by night) with a 2048 px shadow map. Where that light stands, and its
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
 * (SOFT_RADIUS, 1.5), turned per screen pixel, which turns the jagged texel edges
 * into a narrow soft band.
 *
 * createStage(container) -> { renderer, scene, hemi, sun, resize(), followSun(view, dir) }
 *   view { target, yaw, pitch, zoom, aspect } as for fitShadow; dir: unit vector { x, y, z } towards the light
 * snapToTexels(p, dir, texel, texelUp) -> { x, y, z }: p moved onto the texel grid of a light shining along dir (render/shadowFit)
 * shadowBias(far) -> depth bias worth BIAS metres for a shadow camera reaching to far
 * softPcf(chunk, radius) -> the three.js shadow chunk with its PCF branch replaced by the own filter (radius in texels)
 * SOFT_RADIUS -> filter radius in texels (1.5)
 *
 * Depends on: three, render/shadowFit
 */
import * as THREE from 'three';
import { fitShadow, snapToTexels } from './shadowFit.js';

export { snapToTexels };
export const BIAS = 0.04;   // metres along the light
/** Depth bias for a shadow camera from near 1 to `far`: always BIAS metres. */
export const shadowBias = far => -BIAS / (far - 1);
export const SOFT_RADIUS = 1.5;   // texels
const PCF_OLD = /#if defined\( SHADOWMAP_TYPE_PCF \)[\s\S]*?(?=#elif defined\( SHADOWMAP_TYPE_PCF_SOFT \))/;
/** The shadow chunk with its PCF branch replaced: 16 taps on a spiral disc of `radius` texels, turned per screen pixel (no pattern, no crawl). */
export function softPcf(chunk, radius) {
  const glsl = `#if defined( SHADOWMAP_TYPE_PCF )

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
  return PCF_OLD.test(chunk) ? chunk.replace(PCF_OLD, () => glsl) : chunk;
}
let softDone = false;
function installSoft(radius) {
  if (softDone) return; softDone = true;
  THREE.ShaderChunk.shadowmap_pars_fragment = softPcf(THREE.ShaderChunk.shadowmap_pars_fragment, radius);   // before any material compiles
}

export function createStage(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; installSoft(SOFT_RADIUS);
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const hemi = new THREE.HemisphereLight(0xe2ebf0, 0x8a7458, 0.6); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe6c4, 1.0);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.normalBias = 0.03;
  scene.add(sun); scene.add(sun.target);

  function resize() { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); renderer.setSize(window.innerWidth, window.innerHeight); }
  resize();

  const st = new THREE.Vector3(), dir = new THREE.Vector3();
  function followSun(view, d) {
    dir.set(d.x, d.y, d.z).normalize();
    const { centre, ha, hb } = fitShadow(view, dir), size = sun.shadow.mapSize.x;
    const q = snapToTexels(centre, dir, ha * 2 / size, hb * 2 / size); st.set(q.x, q.y, q.z);
    const half = Math.max(ha, hb);
    sun.target.position.copy(st); const dist = half * 3 + 200;   // far enough that a low light still stands above the summits (casters are found by depth, not by the box)
    sun.position.copy(st).addScaledVector(dir, dist); sun.target.updateMatrixWorld();
    const far = dist * 2 + half * 2;
    Object.assign(sun.shadow.camera, { left: -ha, right: ha, top: hb, bottom: -hb, near: 1, far });
    sun.shadow.bias = shadowBias(far);
    sun.shadow.camera.updateProjectionMatrix();
  }
  return { renderer, scene, hemi, sun, resize, followSun };
}
