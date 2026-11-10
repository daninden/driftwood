/** Voice phrases are deterministic presentation data and L stays passive. */
import { describe, expect, it, vi, afterEach } from 'vitest';
import * as THREE from 'three';
import { phraseFor, voiceTime, createThoughts, createVoice, isVoiceKey, isVoiceLogEvent } from '../src/render/voice.js';
import { PASSIVE_CODES, createActing } from '../src/game/input.js';

describe('Voice', () => {
  it('chooses fixed phrases from its own counter', () => {
    expect(phraseFor('woodIntent', 0)).toBe('I need some wood.');
    expect(phraseFor('woodIntent', 3)).toBe('I need some wood.');
    expect(phraseFor('foodIntent', 0)).toBe("I'm hungry.");
    expect(phraseFor('drinkIntent', 0)).toBe('I need a drink.');
    expect(phraseFor('fireLow', 0)).toBe("The fire's getting low.");
    expect(phraseFor('fireOut', 0)).toBe('I need a fire.');
    expect(phraseFor('not-an-action', 0)).toBeNull();
  });

  it('leaves quiet time and suppresses retry thoughts without queuing stale lines', () => {
    const thoughts = createThoughts();
    expect(thoughts.take('woodIntent')).toBe('I need some wood.');
    expect(thoughts.take('pickup')).toBeNull();
    thoughts.update(8);
    expect(thoughts.take('woodIntent')).toBeNull();
    expect(thoughts.take('foodIntent')).toBe('I need something to eat.');
    thoughts.update(52);
    expect(thoughts.take('woodIntent')).toBe('I need some wood.');
    expect(thoughts.take('unknown')).toBeNull();
  });

  it('formats island time without a date, including midnight and minute boundaries', () => {
    expect(voiceTime(0)).toBe('00:00');
    expect(voiceTime(0.5)).toBe('12:00');
    expect(voiceTime((8 * 60 + 5) / 1440)).toBe('08:05');
    expect(voiceTime(1439 / 1440)).toBe('23:59');
    expect(voiceTime(1)).toBe('00:00');
  });

  afterEach(() => vi.unstubAllGlobals());
  it('timestamps only the logged line at announcement time and logs no suppressed thoughts', () => {
    const el = () => ({ children: [], style: {}, scrollTop: 0, scrollHeight: 0, clientHeight: 0, setAttribute() {}, appendChild(child) { this.children.push(child); } });
    vi.stubGlobal('document', { createElement: el });
    const container = el(), log = el(), voice = createVoice(container, log);
    voice.announce('woodIntent', (8 * 60 + 5) / 1440);
    voice.announce('woodIntent', 0.5);
    expect(container.children[0].textContent).toBe('I need some wood.');
    expect(log.children.map(row => row.textContent)).toEqual(['08:05  I need some wood.']);
    expect(voice.history).toEqual(['08:05  I need some wood.']);
  });

  it('holds a thought back while the wake line shows, logs it at once, and shows it after (0.30.8 "Morning")', () => {
    const el = () => ({ children: [], style: {}, scrollTop: 0, scrollHeight: 0, clientHeight: 0, setAttribute() {}, appendChild(child) { this.children.push(child); }, getBoundingClientRect: () => ({ width: 800, height: 600 }) });
    vi.stubGlobal('document', { createElement: el });
    const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 2, 5); camera.updateMatrixWorld();
    const player = { x: 0, y: 0, z: 0 };
    const container = el(), log = el(), voice = createVoice(container, log), line = container.children[0];
    voice.update(10, player, camera, 10);
    voice.hold(11 + 5);                              // a sleep ended at 11 s: the wake line shows for 5 s
    voice.update(1, player, camera, 11);
    voice.announce('woodIntent', 0.25);
    expect(log.children.map(r => r.textContent)).toEqual(['06:00  I need some wood.']);   // logged at once
    expect(line.textContent).toBeUndefined();        // not shown above Dave yet
    voice.update(3.9, player, camera, 14.9);
    expect(line.textContent).toBeUndefined();
    voice.update(1.2, player, camera, 16.1);               // the wake line has faded
    expect(line.textContent).toBe('I need some wood.');
    expect(Number(line.style.opacity)).toBeGreaterThan(0);
    expect(log.children.length).toBe(1);
    voice.update(10, player, camera, 26.1);
    voice.announce('foodIntent', 0.3);               // outside the wake window: at once
    expect(line.textContent).toBe('I need something to eat.');
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
