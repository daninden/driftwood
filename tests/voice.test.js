/** Voice phrases are deterministic presentation data and L stays passive. */
import { describe, expect, it } from 'vitest';
import { phraseFor, isVoiceKey, isVoiceLogEvent } from '../src/render/voice.js';
import { PASSIVE_CODES, createActing } from '../src/game/input.js';

describe('Voice', () => {
  it('chooses fixed phrases from its own counter', () => {
    expect(phraseFor('pickup', 0)).toBe('I will take this along.');
    expect(phraseFor('pickup', 3)).toBe('I will take this along.');
    expect(phraseFor('eatNut', 0)).toBe('I will eat this now.');
    expect(phraseFor('supplies', 0)).toBe('I will check my supplies.');
    expect(phraseFor('not-an-action', 0)).toBeNull();
  });

  it('leaves L out of castaway control', () => {
    const acting = createActing();
    expect(PASSIVE_CODES.has('KeyL')).toBe(true);
    expect(acting.event({ type: 'keydown', code: 'KeyL' })).toBe(false);
  });

  it('accepts only a plain L and recognises log targets before capture handlers', () => {
    expect(isVoiceKey({ type: 'keydown', code: 'KeyL' })).toBe(true);
    expect(isVoiceKey({ type: 'keydown', code: 'KeyL', shiftKey: true })).toBe(false);
    expect(isVoiceKey({ type: 'keydown', code: 'KeyL', target: { isContentEditable: true } })).toBe(false);
    const log = { id: 'voice-log' };
    expect(isVoiceLogEvent({ composedPath: () => [{}, log] })).toBe(true);
    expect(isVoiceLogEvent({ target: { closest: s => s === '#voice-log' ? log : null } })).toBe(true);
    expect(isVoiceLogEvent({ target: {} })).toBe(false);
  });
});
