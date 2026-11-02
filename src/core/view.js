/**
 * core/view — the fixed isometric viewing direction.
 *
 * The camera always looks from the +x/+z side, rotated 45° and pitched 30°
 * down. Several layers need to know what "towards the camera" and "screen
 * right" mean on the ground plane: movement (W walks away from the camera),
 * see-through tree crowns, and which tiles are in view.
 *
 * Exports
 *   CAMDIR   unit vector on the ground pointing towards the camera
 *   RIGHT    unit vector on the ground pointing to screen right
 *   PITCH, YAW  camera angles in radians
 *   toView(dx, dz) -> { dr, dc }   offset expressed along RIGHT and CAMDIR
 *   screenUp(dy, dc)               how far up the screen a point appears,
 *                                  relative to a reference point, in world units
 */

const R2 = Math.SQRT2;
export const CAMDIR = Object.freeze({ x: 1 / R2, z: 1 / R2 });
export const RIGHT = Object.freeze({ x: 1 / R2, z: -1 / R2 });
export const PITCH = Math.PI / 6;
export const YAW = Math.PI / 4;

export const toView = (dx, dz) => ({ dr: dx * RIGHT.x + dz * RIGHT.z, dc: dx * CAMDIR.x + dz * CAMDIR.z });
export const screenUp = (dy, dc) => dy * Math.cos(PITCH) - dc * Math.sin(PITCH);
