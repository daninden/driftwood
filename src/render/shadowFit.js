/**
 * render/shadowFit — where the shadow camera stands and how big it is (pure).
 *
 * The shadow map has a fixed number of texels (2048 x 2048), so the smaller
 * the area it covers, the finer its texels. A low sun stretches every texel
 * over a long stretch of sand, so a loose fit shows jagged shadow edges that
 * jump whenever the light turns. fitShadow wraps the shadow camera tightly
 * round what is seen: the ground and the low hills inside the view (the view
 * box cut off at a height range), measured across the light (its right and up
 * axes) with different sizes for each axis. Shadow casters outside that box
 * still cast into it, because a shadow falls along the light and so keeps its
 * place across the light; only the depth range (near, far) has to be long.
 *
 * Both sizes are rounded up in small steps (GROW) so the texel size stays the
 * same while the view turns or zooms a little; the centre is snapped to whole
 * texels (snapToTexels) so shadows do not shimmer while walking.
 *
 * lightAxes(dir) -> { r, u }      the shadow camera's right and up axes ([x, y, z]) for a light towards dir
 * snapToTexels(p, dir, texel, texelUp = texel) -> { x, y, z }: p moved onto the texel grid of a light shining along dir
 * roundUp(x) -> x rounded up to the next step of GROW
 * fitShadow(view, dir) -> { centre: {x, y, z}, ha, hb }
 *   view { target, yaw, pitch, zoom, aspect }: the ortho view (radians; zoom is its half height in metres)
 *   dir: unit vector towards the light
 *   centre: where the shadow camera looks (not yet snapped), ha / hb: half sizes across the light (right, up)
 *
 * Depends on: nothing
 */
export const GROW = 1.05;
const BELOW = 3, ABOVE = 0.8, ABOVE_MIN = 5, ABOVE_MAX = 20, MARGIN = 0.4;   // metres below the target, above it (times the zoom, with limits), margin

/** The shadow camera's right and up axes for a light towards `dir` (unit): right is up (0,1,0) x dir, up is dir x right. */
export function lightAxes(dir) {
  let rx = dir.z, rz = -dir.x; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
  return { r: [rx, 0, rz], u: [dir.y * rz, dir.z * rx - dir.x * rz, -dir.y * rx] };
}

/** Snap p to the shadow texel grid of a light standing in direction `dir` (unit, towards the light):
 *  round its coordinates across the light (right, up) to whole texels, keep the one along it. */
export function snapToTexels(p, dir, texel, texelUp = texel) {
  const { r, u } = lightAxes(dir);
  const a = p.x * r[0] + p.z * r[2], b = p.x * u[0] + p.y * u[1] + p.z * u[2], c = p.x * dir.x + p.y * dir.y + p.z * dir.z;
  const sa = Math.round(a / texel) * texel, sb = Math.round(b / texelUp) * texelUp;
  return { x: sa * r[0] + sb * u[0] + c * dir.x, y: sb * u[1] + c * dir.y, z: sa * r[2] + sb * u[2] + c * dir.z };
}

/** Round x up to the next power of GROW (so sizes change in steps of 5 %, not continuously). */
export function roundUp(x) { return Math.pow(GROW, Math.ceil(Math.log(x) / Math.log(GROW) - 1e-9)); }

export function fitShadow(view, dir) {
  const { target, yaw, pitch, zoom, aspect } = view;
  const { r, u } = lightAxes(dir);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const right = [Math.cos(yaw), 0, -Math.sin(yaw)], up = [-sp * Math.sin(yaw), cp, -sp * Math.cos(yaw)], toCam = [cp * Math.sin(yaw), sp, cp * Math.cos(yaw)];
  const below = BELOW, above = Math.max(ABOVE_MIN, Math.min(ABOVE_MAX, zoom * ABOVE));
  let amin = Infinity, amax = -Infinity, bmin = Infinity, bmax = -Infinity;
  for (const h of [-below, above]) for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const x = sx * zoom * aspect, y = sy * zoom, t = (h - y * cp) / sp;   // along the view ray until it reaches height h above the target
    const p = [target.x + x * right[0] + y * up[0] + t * toCam[0], target.y + h, target.z + x * right[2] + y * up[2] + t * toCam[2]];
    const a = p[0] * r[0] + p[1] * r[1] + p[2] * r[2], b = p[0] * u[0] + p[1] * u[1] + p[2] * u[2];
    amin = Math.min(amin, a); amax = Math.max(amax, a); bmin = Math.min(bmin, b); bmax = Math.max(bmax, b);
  }
  const ac = (amin + amax) / 2, bc = (bmin + bmax) / 2, c = target.x * dir.x + target.y * dir.y + target.z * dir.z;
  return {
    centre: { x: ac * r[0] + bc * u[0] + c * dir.x, y: ac * r[1] + bc * u[1] + c * dir.y, z: ac * r[2] + bc * u[2] + c * dir.z },
    ha: roundUp((amax - amin) / 2 + MARGIN), hb: roundUp((bmax - bmin) / 2 + MARGIN),
  };
}
