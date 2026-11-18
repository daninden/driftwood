// 0.36.9 "Voice": longer thoughts above Dave, on at most two lines and shown longer (render/voice, index.html). (0.38.0: the parts about the old rules mind, ai/said and the old
// chooser are gone with them.)
// Depends on: render/voice, ai/config.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { SAID_MAX, cleanSaid, cutAtWord, showTime, isFixedLine, SHOW_FIXED, SHOW_OWN, SHOW_READ, PHRASES, createVoice } from '../src/render/voice.js';
import { SAID_LEN } from '../src/ai/config.js';

afterEach(() => vi.unstubAllGlobals());

describe('point 1: a longer thought on at most two lines, shown longer', () => {
  it('SAID_MAX is 140, the same number as the request asks for; a longer text is cut at a word boundary with an ellipsis, never back to the fixed phrase', () => {
    expect(SAID_MAX).toBe(140); expect(SAID_LEN).toBe(SAID_MAX);
    const words = 'The fire is nearly out and the night is long so I will bring in a few branches before the dark comes down over the shore again tonight and the stars come out one by one'.split(' ');
    const long = words.join(' '); expect(long.length).toBeGreaterThan(SAID_MAX);
    const c = cleanSaid(long); expect(c.length).toBeLessThanOrEqual(SAID_MAX); expect(c.endsWith('…')).toBe(true); expect(long.startsWith(c.slice(0, -1).trimEnd())).toBe(true);
    expect(long.slice(c.length - 1, c.length)).toBe(' ');   // the cut is between words
    expect(cleanSaid(long.slice(0, 140))).toBe(long.slice(0, 140));
    expect(cutAtWord('one two three four', 10)).toBe('one two…'); expect(cutAtWord('short', 10)).toBe('short'); expect(cutAtWord('x'.repeat(30), 10).length).toBe(10);
  });
  it('the line above him is wide enough for 140 characters on two lines (index.html), and balanced', () => {
    const css = readFileSync(new URL('../index.html', import.meta.url), 'utf8'), rule = css.match(/\.voice \{[^}]*\}/)[0];
    const m = rule.match(/max-width:\s*min\((\d+)px,\s*(\d+)vw\)/); expect(m).not.toBeNull();
    const px = +m[1], font = +rule.match(/font:\s*italic (\d+)px/)[1];
    expect(2 * px).toBeGreaterThanOrEqual(SAID_MAX * font * 0.46);   // a serif italic is about 0.46 em a character: two lines hold 140
    expect(rule).toContain('text-wrap:balance');
  });
  it('on a screen too narrow for two lines the line is cut at a word boundary until it fits, and is shown for its own time (createVoice)', () => {
    const el = () => ({ children: [], style: {}, setAttribute() {}, appendChild(c) { this.children.push(c); }, getBoundingClientRect: () => ({ width: 400, height: 600 }), _t: '',
      get textContent() { return this._t; }, set textContent(v) { this._t = v; }, get offsetHeight() { return 20 * Math.ceil(Math.max(1, this._t.length) / 40); } });   // 40 characters a line of 20 px
    vi.stubGlobal('document', { createElement: el }); vi.stubGlobal('getComputedStyle', () => ({ lineHeight: '20px' }));
    const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 2, 5); camera.updateMatrixWorld();
    const container = el(), voice = createVoice(container), line = container.children[0], player = { x: 0, y: 0, z: 0 };
    const said = 'The fire is nearly out and the night is long: I will bring in a few branches before the dark.';   // 94 characters: three lines of 40
    voice.update(20, player, camera, 20); expect(voice.announceStep(0.5, said, null)).toBe(said);
    expect(line.textContent.length).toBeLessThan(said.length); expect(line.textContent.endsWith('…')).toBe(true); expect(line.offsetHeight).toBeLessThanOrEqual(40);
    expect(said.startsWith(line.textContent.slice(0, -1).trimEnd())).toBe(true);
    voice.update(4.5, player, camera, 24.5); expect(Number(line.style.opacity)).toBeGreaterThan(0.5);   // still there after the old 3 s
    voice.update(6, player, camera, 30.5); expect(Number(line.style.opacity)).toBe(0);
  });
});





