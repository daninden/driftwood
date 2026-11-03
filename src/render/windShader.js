/**
 * render/windShader — puts the wind (render/wind) into the vertex shaders of the swaying plants (0.19).
 *
 * The wind state is written once a frame into shared uniforms (setWind); every wind material, its
 * outline and its shadow depth material read the same ones, so a plant, its outline and its shadow
 * always move together. A plant is moved after its instance matrix, in world space, by a small offset
 * that depends on the instance position (so neighbours differ, and a gust reaches the trees further
 * off first), the height of the ground it stands on (the tier strength), and a weight of the vertex
 * itself (the tips of fronds and blades move, the roots do not). Nothing is moved on the CPU.
 *
 *   kinds (render/wind KINDS): frond (palm fronds), palmtrunk (the trunk of a palm, bending slightly at
 *   the top), crown (broadleaf and rain forest crowns and leaf clumps), pine (cones), bush, grass (grass,
 *   reeds, blades) and leaf (ferns and leaf fans). Fronds and palm trunk segments read the instanced
 *   attribute aWind = (where on the trunk, height of the palm), set by render/batch.
 *
 * windUniforms                 the shared uniforms ({ value } objects)
 * setWind(state, t)            copies a render/wind state and the wind time (s) into them
 * windGlsl(kind)               the GLSL (uniforms, tier and gust functions, windOffset) for a kind
 * windProject(kind)            what replaces <project_vertex> (and, after <worldpos_vertex>, the shadow lookup)
 * injectWind(shader, kind)     the shader object of onBeforeCompile changed: vertex shader + uniforms
 * withWind(material, kind)     makes a material sway (chains an earlier onBeforeCompile and cache key); returns it
 * windDepth(kind, params?)     a MeshDepthMaterial (RGBA packing) that sways the same way: the shadow of the plant
 * windOutline(kind)            the dark back-face hull material that sways the same way
 * hasWind(material) -> true if a material has been given wind (withWind)
 *
 * Depends on: three, render/wind
 */
import * as THREE from 'three';
import { KINDS, TIER_EDGES, TIER_FADE, TIER_STRENGTH, BASE_LEVEL, GUST_GAIN, GUST_WIDTH, GUST_SLOTS } from './wind.js';

export const windUniforms = {
  uWindT: { value: 0 }, uWindDir: { value: new THREE.Vector2(1, 0) }, uWindCalm: { value: 1 },
  uGust0: { value: new THREE.Vector2() }, uGust1: { value: new THREE.Vector2() }, uGust2: { value: new THREE.Vector2() },
};
const GUSTS = [windUniforms.uGust0, windUniforms.uGust1, windUniforms.uGust2];

export function setWind(state, t) {
  windUniforms.uWindT.value = t;
  windUniforms.uWindDir.value.set(state.dx, state.dz);
  windUniforms.uWindCalm.value = state.calm;
  for (let i = 0; i < GUST_SLOTS; i++) GUSTS[i].value.set(state.gusts[i].pos, state.gusts[i].amp);
}

const f = n => Number(n).toFixed(4);
// where on the shape a vertex is: 0 stays, 1 moves with the whole wind (lp: the vertex in object space)
const WEIGHT = {
  frond: 'pow( clamp( lp.x * 0.5, 0.0, 1.0 ), 1.6 )',
  palmtrunk: '0.0',
  crown: '1.0',
  pine: 'clamp( lp.y + 0.5, 0.0, 1.0 )',
  bush: '1.0',
  grass: 'min( lp.y * lp.y * 4.0, 1.0 )',
  leaf: 'clamp( length( lp.xz ) / 0.6, 0.0, 1.0 )',
};
// where a palm's trunk bends: from nothing at the foot to everything at the top (a segment's aWind.x is its foot, 1/8 of the trunk each)
const BEND_WEIGHT = { frond: 'aw.x', palmtrunk: 'aw.x + ( lp.y + 0.5 ) * 0.125' };

export function windGlsl(kind) {
  const k = KINDS[kind];
  if (!k) throw new Error('unknown wind kind ' + kind);
  const tier = TIER_STRENGTH.map((s, i) => (i === 0 ? f(s) : `+ ( ${f(s - TIER_STRENGTH[i - 1])} ) * smoothstep( ${f(TIER_EDGES[i - 1] - TIER_FADE)}, ${f(TIER_EDGES[i - 1] + TIER_FADE)}, y )`)).join(' ');
  return `uniform float uWindT;
uniform vec2 uWindDir;
uniform float uWindCalm;
uniform vec2 uGust0;
uniform vec2 uGust1;
uniform vec2 uGust2;
${BEND_WEIGHT[kind] ? 'attribute vec2 aWind;' : ''}
float windTier( float y ) { return ${tier}; }
float windGust( float s, vec2 q ) { float d = ( s - q.x ) / ${f(GUST_WIDTH)}; return q.y * exp( - d * d ); }
vec3 windOffset( vec3 ip, vec3 iq, vec3 lp, vec2 aw ) {
	float s = dot( ip.xz, uWindDir );
	float g = min( 1.0, windGust( s, uGust0 ) + windGust( s, uGust1 ) + windGust( s, uGust2 ) );
	float lvl = uWindCalm * windTier( ip.y ) * ( ${f(BASE_LEVEL)} + ${f(GUST_GAIN)} * g );
	float ph0 = dot( ip.xz, vec2( 0.23, 0.17 ) );
	float hs = fract( sin( dot( ip.xz${k.single ? ' + iq.xz * 17.3' : ''}, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
	float ph1 = ph0 + hs * ${f(k.spread)};
	float t = uWindT;
	float sway = 0.65 + 0.35 * sin( t * 1.3 + ph1 );
	float sway2 = sin( t * 2.3 + ph1 * 1.7 + 1.3 );
	float w = ${WEIGHT[kind]};
	vec2 sd = vec2( - uWindDir.y, uWindDir.x );
	vec2 hz = uWindDir * ( ${f(k.push)} * sway * w ) + sd * ( ${f(k.side)} * sway2 * w );
	vec3 fl = vec3( sin( t * 4.1 + dot( lp, vec3( 4.1, 3.3, 5.2 ) ) + ph1 * 2.0 ), 0.6 * sin( t * 3.3 + dot( lp, vec3( 2.7, 5.1, 3.9 ) ) ), sin( t * 3.7 + dot( lp, vec3( 5.3, 2.1, 4.4 ) ) ) ) * ( ${f(k.flutter)} * w );
	vec3 d = vec3( hz.x, ${f(k.lift)} * sway2 * w, hz.y ) + fl;
${BEND_WEIGHT[kind] ? `	float bw = ${BEND_WEIGHT[kind]};
	d.xz += uWindDir * ( ${f(k.bend)} * aw.y * ( 0.65 + 0.35 * sin( t * 1.1 + ph0 ) ) * bw * bw );` : ''}
	return d * lvl;
}`;
}

export const windProject = kind => `vec4 mvPosition = vec4( transformed, 1.0 );
vec3 wIp = vec3( 0.0 ), wIq = vec3( 0.0 );
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
	wIp = instanceMatrix[ 3 ].xyz; wIq = instanceMatrix[ 0 ].xyz;
#endif
vec3 wOff = windOffset( wIp, wIq, transformed, ${BEND_WEIGHT[kind] ? 'aWind' : 'vec2( 0.0 )'} );
mvPosition.xyz += wOff;
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`;

/** The shader of onBeforeCompile with the wind in its vertex shader and the shared uniforms. */
export function injectWind(sh, kind) {
  Object.assign(sh.uniforms, windUniforms);
  // the place a shadow is looked up at moves with the plant too, or its own shadow would not fit it
  const shadowLook = '#include <worldpos_vertex>\n#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP )\n\tworldPosition.xyz += wOff;\n#endif';
  sh.vertexShader = windGlsl(kind) + '\n' + sh.vertexShader.replace('#include <project_vertex>', () => windProject(kind)).replace('#include <worldpos_vertex>', () => shadowLook);
  return sh;
}

export function withWind(mat, kind) {
  const before = mat.onBeforeCompile, key = Object.getPrototypeOf(mat).customProgramCacheKey === mat.customProgramCacheKey ? null : mat.customProgramCacheKey;
  mat.onBeforeCompile = (sh, renderer) => { if (before) before.call(mat, sh, renderer); injectWind(sh, kind); };
  mat.customProgramCacheKey = () => (key ? key.call(mat) : 'plain') + '|wind:' + kind;
  mat.userData.wind = kind;
  return mat;
}

export const hasWind = mat => !!(mat && mat.userData && mat.userData.wind);

export function windDepth(kind, params) {
  return withWind(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, ...(params || {}) }), kind);
}

export function windOutline(kind) {
  return withWind(new THREE.MeshBasicMaterial({ color: 0x2e2418, side: THREE.BackSide }), kind);
}
