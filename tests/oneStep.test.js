// 0.44.2 "One step" (agreed with the user 2026-11-23): a "take" walks to the piece or pile itself, and so does a "lay" with "at"; a "go" to that same place
// straight before it is dropped by game/actions checkPlan, so the plan (and the panel) shows one step: "pick up a stone", not "walk to a stone" and then "pick up a stone".
// Covers: go + take and go + lay at folded (minutes as the take or lay alone, the go's thought kept), a go to another place kept, a go before a "do" kept, the prompt's rule.
// Depends on: game/actions, ai/actPrompt.
import { describe, it, expect } from 'vitest';
import { checkPlan, stepMinutes, stepText } from '../src/game/actions.js';
import { actFixed } from '../src/ai/actPrompt.js';

const places = [
  { id: 'stone3', kind: 'stone', what: 'a stone', minutes: 10, x: 10, z: 0 },
  { id: 'pile1', kind: 'pile', what: 'a pile of 4 branches', minutes: 20, x: 30, z: 0, ref: { kind: 'branch' } },
  { id: 'water1', kind: 'water', what: 'fresh river water', minutes: 12, x: 0, z: 20 },
];

describe('0.44.2 "One step": no "go" before a "take" or a "lay at" of the same place', () => {
  it('go + take of the same place is one step, with the minutes of the take alone', () => {
    const c = checkPlan([{ go: 'stone3' }, { take: 'stone3' }], places);
    expect(c.ok).toBe(true);
    expect(c.steps).toEqual([{ take: 'stone3' }]);
    expect(c.minutes).toBeCloseTo(Math.round(stepMinutes({ take: 'stone3' }, places) * 10) / 10, 5);
    expect(stepText(c.steps[0], places)).toBe('pick up a stone (stone3)');
  });
  it('go + lay at the same place is one step; the thought of the go goes to it', () => {
    const c = checkPlan([{ take: 'stone3' }, { go: 'pile1', say: 'To my pile.' }, { lay: 'branch', at: 'pile1' }], places);
    expect(c.ok).toBe(true);
    expect(c.steps).toEqual([{ take: 'stone3' }, { lay: 'branch', at: 'pile1', say: 'To my pile.' }]);
  });
  it('a go to another place, or before a "do", stays', () => {
    expect(checkPlan([{ go: 'water1' }, { take: 'stone3' }], places).steps).toHaveLength(2);
    expect(checkPlan([{ go: 'water1' }, { do: 'drink' }], places).steps).toEqual([{ go: 'water1' }, { do: 'drink' }]);
    expect(checkPlan([{ go: 'stone3' }], places).steps).toEqual([{ go: 'stone3' }]);
  });
  it('the rules tell the model not to write the go', () => {
    const t = actFixed('Dave');
    expect(t).toMatch(/never write a "go" to the same place before it/);
  });
});
