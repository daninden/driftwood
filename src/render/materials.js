/**
 * render/materials — toon shading, outlines and the painted terrain shader.
 *
 * toon(color, opts)   MeshToonMaterial with the shared 3-step gradient map
 * outlineMat          dark brown back-face hull, scaled copies give outlines
 * terrainMat(map)     toon material for a terrain tile; in the shader, steep
 *                     faces get painted rock: strata, cracks and ledges,
 *                     greyer and cooler higher up
 * ghostMat            transparent crowns for trees between camera and player
 *
 * Depends on: three
 */
import * as THREE from 'three';

const gradMap = (() => {
  const d = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
})();

export const toon = (color, o) => new THREE.MeshToonMaterial(Object.assign({ color: color === undefined ? 0xffffff : color, gradientMap: gradMap }, o || {}));
export const outlineMat = new THREE.MeshBasicMaterial({ color: 0x2e2418, side: THREE.BackSide });
export const ghostMat = toon(0xffffff, { vertexColors: true, transparent: true, opacity: 0.14, depthWrite: false });

const ROCK_GLSL = `#include <map_fragment>
  float st = 1.0 - smoothstep(0.45, 0.74, vWN.y);
  if (st > 0.001 && vWP.y > 0.6) {
    vec3 an = abs(vWN);
    float u = an.x > an.z ? vWP.z : vWP.x;
    float yy = vWP.y;
    float n1 = vn2(vec2(u * 0.3, yy * 0.8)), n2 = vn2(vec2(u * 1.3, yy * 2.4)), n3 = vn2(vec2(u * 4.0, yy * 6.0));
    float band = sin(yy * 2.6 + n1 * 3.5) * 0.5 + 0.5;
    vec3 rc = mix(vec3(0.53, 0.47, 0.40), vec3(0.68, 0.61, 0.53), band * 0.55 + n2 * 0.45);
    float crack = 1.0 - smoothstep(0.0, 0.06, abs(fract(u * 0.42 + n1 * 1.1) - 0.5));
    float ledge = smoothstep(0.82, 0.95, fract(yy * 0.5 + n1 * 0.7));
    rc *= 1.0 - 0.32 * crack * (0.5 + n2);
    rc = mix(rc, rc * 1.22, ledge);
    rc *= 0.9 + 0.2 * n3;
    rc = mix(rc, vec3(dot(rc, vec3(0.33))) * vec3(0.97, 0.98, 1.0), smoothstep(24.0, 40.0, yy) * 0.6);
    rc = mix(rc, rc * vec3(0.85, 0.95, 0.78), ledge * smoothstep(0.4, 0.8, n2) * (1.0 - smoothstep(20.0, 30.0, yy)));
    diffuseColor.rgb = mix(diffuseColor.rgb, rc, st);
  }`;

export function terrainMat(map) {
  const m = toon(0xffffff, { map });
  m.onBeforeCompile = sh => {
    sh.vertexShader = 'varying vec3 vWP;\nvarying vec3 vWN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = `varying vec3 vWP;
varying vec3 vWN;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
` + sh.fragmentShader.replace('#include <map_fragment>', ROCK_GLSL);
  };
  m.customProgramCacheKey = () => 'terrain';
  return m;
}
