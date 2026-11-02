// The shadow bias stays a few centimetres, whatever the shadow camera depth,
// so shadows start at the foot of a trunk or the castaway.
import { describe, it, expect } from 'vitest';
import { shadowBias, BIAS } from '../src/render/stage.js';

describe('shadow bias', () => {
  it('is BIAS metres at every zoom level', () => {
    for (const half of [24, 50, 90]) {
      const far = (half * 3 + 200) * 2 + half * 2;
      expect(-shadowBias(far) * (far - 1)).toBeCloseTo(BIAS);
    }
  });
  it('is small enough that a shadow starts at the foot', () => {
    expect(BIAS).toBeLessThanOrEqual(0.05);
  });
});
