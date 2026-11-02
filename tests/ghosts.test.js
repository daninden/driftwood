// see-through crowns: only the occlusion test is pure; it decides everything.
import { describe, it, expect } from 'vitest';
import { CAMDIR, RIGHT } from '../src/core/view.js';

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
});
