// see-through crowns: only the occlusion test is pure; it decides everything.
import { describe, it, expect } from 'vitest';
import { CAMDIR, RIGHT, basis, PITCH_MIN, PITCH_MAX } from '../src/core/view.js';

import { occludes } from '../src/render/ghosts.js';

const player = { x: 0, y: 0, z: 0 };
const at = (dc, dr, cy, R = 1.2) => ({ x: CAMDIR.x * dc + RIGHT.x * dr, z: CAMDIR.z * dc + RIGHT.z * dr, cy, R });

describe('occludes', () => {
  it('hides a crown right in front of the player', () => {
    // a crown 2 units towards the camera and 2 up sits over the player on screen
    expect(occludes(at(2, 0, 2), player)).toBe(true);
  });
  it('keeps trees behind the player solid', () => {
    expect(occludes(at(-2, 0, 2), player)).toBe(false);
  });
  it('keeps trees to the side solid', () => {
    expect(occludes(at(2, 4, 2), player)).toBe(false);
  });
  it('keeps low crowns far in front solid', () => {
    expect(occludes(at(9, 0, 1), player)).toBe(false);
  });
  it('follows the view when it is turned and tilted', () => {
    for (const yaw of [0, 2, 4]) for (const pitch of [PITCH_MIN, PITCH_MAX]) {
      const { cam, right } = basis(yaw), tree = (dc, dr) => ({ x: cam.x * dc + right.x * dr, z: cam.z * dc + right.z * dr, cy: 2, R: 1.2 });
      expect(occludes(tree(2, 0), player, yaw, pitch)).toBe(true);
      expect(occludes(tree(-2, 0), player, yaw, pitch)).toBe(false);
      expect(occludes(tree(2, 4), player, yaw, pitch)).toBe(false);
    }
  });
  it('treats a crown in front of the old view differently once the view is turned around', () => {
    expect(occludes(at(2, 0, 2), player, Math.PI / 4 + Math.PI)).toBe(false);
  });
});
