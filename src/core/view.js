/**
 * core/view — the isometric viewing direction, as angles.
 *
 * The camera looks down at the player from a compass angle (yaw) and a
 * downward tilt (pitch). The player can turn the view freely around and
 * tilt it between PITCH_MIN and PITCH_MAX; it starts at YAW / PITCH (from
 * the +x/+z side, 45° round, 30° down). Several layers need to know what
 * "towards the camera" and "screen right" mean on the ground plane:
 * movement (W walks away from the camera), see-through tree crowns, and
 * which tiles are in view. Pure maths, no state: whoever owns the camera
 * passes the current angles in.
 *
 * Exports
 *   YAW, PITCH             the starting angles in radians
 *   PITCH_MIN, PITCH_MAX   how far the view may tilt (25°..45°)
 *   basis(yaw) -> { cam, right }   unit vectors on the ground: towards the
 *                                  camera, and to screen right
 *   CAMDIR, RIGHT          basis(YAW), the starting view
 *   toView(dx, dz, yaw?) -> { dr, dc }   offset expressed along right and cam
 *   screenUp(dy, dc, pitch?)             how far up the screen a point
 *                                        appears, relative to a reference
 *                                        point, in world units
 *   groundDepth(pitch?)    how much ground (towards/away from the camera)
 *                          one unit of screen height covers
 *
 * Depends on: nothing
 */

export const YAW = Math.PI / 4;
export const PITCH = Math.PI / 6;
export const PITCH_MIN = 25 * Math.PI / 180, PITCH_MAX = 45 * Math.PI / 180;

export const basis = yaw => ({ cam: { x: Math.sin(yaw), z: Math.cos(yaw) }, right: { x: Math.cos(yaw), z: -Math.sin(yaw) } });
const START = basis(YAW);
export const CAMDIR = Object.freeze(START.cam);
export const RIGHT = Object.freeze(START.right);

export const toView = (dx, dz, yaw = YAW) => {
  const s = Math.sin(yaw), c = Math.cos(yaw);
  return { dr: dx * c - dz * s, dc: dx * s + dz * c };
};
export const screenUp = (dy, dc, pitch = PITCH) => dy * Math.cos(pitch) - dc * Math.sin(pitch);
export const groundDepth = (pitch = PITCH) => 1 / Math.sin(pitch);
