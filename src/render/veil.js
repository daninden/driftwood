/**
 * render/veil — a material that can be thinned out into a stipple (0.33 "Hut").
 *
 * The roof of a hut turns see-through while the castaway is inside it. The old stippled veil of the trees (0.27.5) was replaced by the ink silhouette behind things, but here the thing in the way is a
 * roof of our own, and thinning it is the clearest way to see inside: `veiled(base, uniform)` is a copy of a material whose fragment shader throws away a share `uniform.value` (0..1) of the pixels, in an
 * ordered 4 by 4 pattern fixed to the screen (so it does not swim), and keeps the rest unchanged (toon lighting, outline, cut-out fronds). With the value 0 nothing is thrown away. The share is the one
 * number the caller eases up and down; the shadow pass is not touched (the roof still shadows). A copy per hut keeps one hut's roof thin without thinning another's.
 *
 * VEIL_SHARE   the share thrown away while he is inside (0.6: some 40 % of the roof stays)
 * veiled(base, uniform) -> material   a clone of `base` (a toon, basic or cut-out material) that discards the share; chains the base's own onBeforeCompile and cache key; its userData holds only `shared: true` (render/nearTile disposeGroup leaves a shared material to its owner)
 * veilCut(x, y) -> 0..1   pure: the ordered-dither threshold of pixel (x, y) (the same arithmetic as the shader); a pixel is thrown away when it is below the share
 *
 * Depends on: three
 */
export const VEIL_SHARE = 0.6;

const m2 = (x, y) => (x * 2 + y * 3) % 4, md = (v, n) => ((v % n) + n) % n;
export function veilCut(x, y) {
  const cx = Math.floor(x), cy = Math.floor(y);
  return (4 * m2(md(cx, 2), md(cy, 2)) + m2(md(Math.floor(cx / 2), 2), md(Math.floor(cy / 2), 2))) / 16 + 1 / 32;
}

const GLSL = `uniform float uVeil;
float veilM2(vec2 q) { return mod(q.x * 2.0 + q.y * 3.0, 4.0); }
float veilCut(vec2 p) { vec2 c = floor(p); return (4.0 * veilM2(mod(c, 2.0)) + veilM2(mod(floor(c * 0.5), 2.0))) / 16.0 + 0.03125; }
`;

export function veiled(base, uniform) {
  const m = base.clone(); m.userData = { shared: true };   // shared: disposeGroup leaves it (its owner disposes it)
  const before = base.onBeforeCompile, key0 = base.customProgramCacheKey ? base.customProgramCacheKey() : '';
  m.onBeforeCompile = (sh, renderer) => {
    if (before) before.call(m, sh, renderer);
    sh.uniforms.uVeil = uniform;
    sh.fragmentShader = GLSL + sh.fragmentShader.replace('void main() {', 'void main() {\n  if (uVeil > 0.001 && veilCut(gl_FragCoord.xy) < uVeil) discard;');
  };
  m.customProgramCacheKey = () => key0 + '|veil';
  return m;
}
