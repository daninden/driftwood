/** Voice phrases are deterministic presentation data and L stays passive. */
import { describe, expect, it, vi, afterEach } from 'vitest';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { PHRASES, SAID_MAX, cleanSaid, phraseFor, voiceTime, createThoughts, createVoice } from '../src/render/voice.js';
import { LACK_KINDS } from '../src/game/lack.js';

describe('Voice', () => {
  it('chooses fixed phrases from its own counter', () => {
    expect(phraseFor('woodIntent', 0)).toBe('I need some wood.');
    expect(phraseFor('woodIntent', 4)).toBe('I need some wood.');
    expect(phraseFor('woodIntent', 1)).not.toBe('I need some wood.');
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
    expect(thoughts.take('foodIntent')).toBe("I'm hungry.");
    thoughts.update(52);
    expect(thoughts.take('woodIntent')).toBe(PHRASES.woodIntent[1]);
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
  it('shows a thought above Dave and drops a suppressed repeat (the Words log is gone since 0.36.6)', () => {
    const el = () => ({ children: [], style: {}, scrollTop: 0, scrollHeight: 0, clientHeight: 0, setAttribute() {}, appendChild(child) { this.children.push(child); } });
    vi.stubGlobal('document', { createElement: el });
    const container = el(), voice = createVoice(container);
    voice.announce('woodIntent', (8 * 60 + 5) / 1440);
    voice.announce('woodIntent', 0.5);
    expect(container.children[0].textContent).toBe('I need some wood.');
  });

  it('holds a thought back while the wake line shows, and shows it after (0.30.8 "Morning")', () => {
    const el = () => ({ children: [], style: {}, scrollTop: 0, scrollHeight: 0, clientHeight: 0, setAttribute() {}, appendChild(child) { this.children.push(child); }, getBoundingClientRect: () => ({ width: 800, height: 600 }) });
    vi.stubGlobal('document', { createElement: el });
    const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 2, 5); camera.updateMatrixWorld();
    const player = { x: 0, y: 0, z: 0 };
    const container = el(), voice = createVoice(container), line = container.children[0];
    voice.update(10, player, camera, 10);
    voice.hold(11 + 5);                              // a sleep ended at 11 s: the wake line shows for 5 s
    voice.update(1, player, camera, 11);
    voice.announce('woodIntent', 0.25);
    expect(line.textContent).toBeUndefined();        // not shown above Dave yet
    voice.update(3.9, player, camera, 14.9);
    expect(line.textContent).toBeUndefined();
    voice.update(1.2, player, camera, 16.1);               // the wake line has faded
    expect(line.textContent).toBe('I need some wood.');
    expect(Number(line.style.opacity)).toBeGreaterThan(0);

    voice.update(10, player, camera, 26.1);
    voice.announce('foodIntent', 0.3);               // outside the wake window: at once
    expect(line.textContent).toBe("I'm hungry.");
  });

  it('speaks only reasons: no action kind has a phrase (0.30.20 "Words")', () => {
    for (const kind of ['pickup', 'lay', 'feed', 'husk', 'drink', 'fill', 'sip', 'dig', 'roast', 'light', 'kindle', 'build', 'upgrade', 'sleep', 'berries', 'bananas', 'eatBerries', 'eatBanana', 'torch', 'plant', 'eatNut', 'drytransfer']) expect(phraseFor(kind, 0)).toBeNull();
    const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
    expect(main).not.toMatch(/game\.onAction/);
  });

  it('has 3 or 4 lines for every kind the mind thinks and every kind the player can lack', () => {
    const mind = readFileSync(new URL('../src/game/mind.js', import.meta.url), 'utf8');
    const kinds = new Set([...mind.matchAll(/think\('(\w+)'\)/g)].map(m => m[1]));
    for (const m of mind.matchAll(/'(\w+Intent)'/g)) kinds.add(m[1]);
    for (const m of mind.matchAll(/think\([^\n]*\? '(\w+)' : '(\w+)'\)/g)) { kinds.add(m[1]); kinds.add(m[2]); }   // a choice between two kinds
    for (const m of mind.matchAll(/think: ([^\n]*?)(?:, wanted|,\n)/g)) for (const q of m[1].matchAll(/(?<!=== )'(\w+)'/g)) kinds.add(q[1]);   // the collect option
    for (const k of LACK_KINDS) kinds.add(k);
    for (const k of ['fibreIntent', 'foodReserve', 'wetwood', 'fireOut', 'fireLow', 'explore', 'homeWoodIntent', 'axeIntent', 'clearIntent', 'hutIntent']) expect(kinds.has(k)).toBe(true);
    for (const kind of kinds) { expect(PHRASES[kind], kind).toBeDefined(); expect(PHRASES[kind].length).toBeGreaterThanOrEqual(3); expect(PHRASES[kind].length).toBeLessThanOrEqual(4); }
    for (const kind of Object.keys(PHRASES)) expect(kinds.has(kind), `unused phrase ${kind}`).toBe(true);
  });

  it('rotates the variants and never repeats a line for a kind twice in a row', () => {
    for (const kind of Object.keys(PHRASES)) {
      const thoughts = createThoughts(), said = [];
      for (let i = 0; i < PHRASES[kind].length * 2 + 1; i++) { thoughts.update(100); said.push(thoughts.take(kind)); }
      for (let i = 1; i < said.length; i++) expect(said[i]).not.toBe(said[i - 1]);
      expect(new Set(said).size).toBe(PHRASES[kind].length);
    }
  });
});

describe('0.36.4 "Hindsight": the AI\'s own words above Dave', () => {
  it('cleanSaid keeps real text of at most 70 characters, tidied, and nothing else', () => {
    expect(SAID_MAX).toBe(70);
    expect(cleanSaid('  I could do with   a drink.  ')).toBe('I could do with a drink.');
    expect(cleanSaid('x'.repeat(70))).toBe('x'.repeat(70)); expect(cleanSaid('x'.repeat(71))).toBeNull();
    for (const bad of ['', '   ', null, undefined, 5, {}]) expect(cleanSaid(bad)).toBeNull();
  });
  it('a given reason replaces the fixed phrase of its kind; empty or too long falls back to the phrase', () => {
    const th = createThoughts(); th.update(100);
    expect(th.take('drinkIntent', 'Water first, then the shore.')).toBe('Water first, then the shore.');
    th.update(61); expect(th.take('drinkIntent', 'x'.repeat(71))).toBe(PHRASES.drinkIntent[0]);   // (too long: the fixed phrase; its rotation had not moved)
    th.update(61); expect(th.take('drinkIntent', '')).toBe(PHRASES.drinkIntent[1]);
    th.update(61); expect(th.take('drinkIntent')).toBe(PHRASES.drinkIntent[2]);   // the AI off: exactly as before
  });
  it('the quiet-time rules still apply to such a line (8 s for any line, 60 s for one kind), and a kind without phrases says nothing', () => {
    const th = createThoughts(); th.update(100);
    expect(th.take('spearIntent', 'A spear, then.')).toBe('A spear, then.');
    th.update(5); expect(th.take('fishIntent', 'Fish soon.')).toBeNull();
    th.update(4); expect(th.take('fishIntent', 'Fish soon.')).toBe('Fish soon.');
    th.update(20); expect(th.take('fishIntent', 'Again.')).toBeNull(); th.update(41); expect(th.take('fishIntent', 'Again.')).toBe('Again.');
    expect(th.take('nonsenseKind', 'Hello.')).toBeNull();
  });
});

describe('0.36.5 "Reach": the reason of a plan step is said when the step starts', () => {
  it('takeStep says the AI\'s words as a line of its own, under the 8 s quiet rule but not the 60 s of a kind', () => {
    const t = createThoughts();
    t.update(100);
    expect(t.takeStep('Time to see what is out there.', 'explore')).toBe('Time to see what is out there.');
    t.update(3); expect(t.takeStep('Another reason', 'explore')).toBeNull();   // inside the quiet time
    t.update(6); expect(t.takeStep('Another reason', 'explore')).toBe('Another reason');   // the same kind again after 8 s: no 60 s rule
  });
  it('takeStep falls back to the step\'s fixed phrase when the text is unusable, and says nothing when there is none', () => {
    const t = createThoughts(); t.update(100);
    expect(t.takeStep('x'.repeat(SAID_MAX + 1), 'woodIntent')).toBe(phraseFor('woodIntent', 0));
    t.update(100); expect(t.takeStep('', null)).toBeNull();
    t.update(100); expect(t.takeStep(null, 'noSuchKind')).toBeNull();
  });
});
