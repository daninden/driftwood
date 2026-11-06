// Adaptive quality: the level table, the governor's stepping, the remembered
// level and the ?quality=N parameter (render/quality), and the stage's filters.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { MAX_LEVEL, settingsFor, nextLevel, createGovernor, parseQuality, pickStart, cyclePreference, isQualityKey, loadPreference, savePreference, loadLevel, saveLevel, QUALITY_KEY, SLOW_DT, START_SETTLE, SETTLE_STEP, MEASURE } from '../src/render/quality.js';
import { lightPcf, softPcf, LIGHT_RADIUS, SOFT_RADIUS } from '../src/render/stage.js';

describe('level table', () => {
  it('lowers one thing at a time, from best down', () => {
    expect(settingsFor(0)).toEqual({ shadowSize: 4096, filter: 'bilinear', pixelRatioMax: 1.5, terrainShadows: true, fireLights: 4, rainStreaks: 220 });
    expect(settingsFor(1)).toEqual({ shadowSize: 2048, filter: 'bilinear', pixelRatioMax: 1.5, terrainShadows: true, fireLights: 4, rainStreaks: 220 });
    expect(settingsFor(2)).toEqual({ shadowSize: 2048, filter: 'plain', pixelRatioMax: 1.5, terrainShadows: true, fireLights: 2, rainStreaks: 160 });
    expect(settingsFor(3)).toEqual({ shadowSize: 2048, filter: 'plain', pixelRatioMax: 1, terrainShadows: true, fireLights: 2, rainStreaks: 110 });
    expect(settingsFor(4)).toEqual({ shadowSize: 2048, filter: 'plain', pixelRatioMax: 1, terrainShadows: false, fireLights: 2, rainStreaks: 70 });
    expect(MAX_LEVEL).toBe(4);
  });
  it('starts touch devices at 2048 already, so their level 0 is level 1', () => {
    expect(settingsFor(0, { touch: true })).toEqual(settingsFor(1, { touch: true }));
    expect(settingsFor(0, { touch: true }).shadowSize).toBe(2048);
  });
  it('treats a level out of range as the nearest', () => {
    expect(settingsFor(9)).toEqual(settingsFor(4)); expect(settingsFor(-1)).toEqual(settingsFor(0)); expect(settingsFor(NaN)).toEqual(settingsFor(0));
  });
});

describe('next level', () => {
  it('is one step down, and the lowest stays', () => {
    expect([0, 1, 2, 3].map(l => nextLevel(l, { dpr: 2 }))).toEqual([1, 2, 3, 4]);
    expect(nextLevel(4, { dpr: 2 })).toBe(4);
  });
  it('skips a step that changes nothing here (touch at level 0, a screen with pixel ratio 1 at level 2)', () => {
    expect(nextLevel(0, { touch: true, dpr: 2 })).toBe(2);
    expect(nextLevel(2, { dpr: 1 })).toBe(4);
    expect(nextLevel(2, { dpr: 1.25 })).toBe(3);
    expect(nextLevel(3, { dpr: 1 })).toBe(4);
  });
});

describe('governor', () => {
  // feeds `seconds` of frames of dt each; returns the levels it gave
  const run = (g, seconds, dt, idle = false) => { const out = []; for (let t = 0; t < seconds; t += dt) { const r = g.frame(dt, idle); if (r !== null) out.push(r); } return out; };
  it('steps down one level when the frames are too slow, after the settle time', () => {
    const g = createGovernor({ level: 0, dpr: 2 });
    expect(run(g, START_SETTLE + 0.5, 0.1)).toEqual([]);      // settling: nothing yet, however slow
    expect(run(g, MEASURE + 0.5, 0.1)).toEqual([1]); expect(g.level).toBe(1);
  });
  it('stays when the frames are fast enough, at 60 and at a capped 30', () => {
    for (const dt of [1 / 60, 1 / 30]) { const g = createGovernor({ level: 0, dpr: 2 }); expect(run(g, 60, dt)).toEqual([]); expect(g.level).toBe(0); }
    expect(1 / 30).toBeLessThan(SLOW_DT);
  });
  it('waits for things to settle after a step, then measures again, and goes on until it is fine', () => {
    const g = createGovernor({ level: 0, dpr: 2 }); const out = [];
    for (let t = 0; t < 60; t += 0.1) { const r = g.frame(0.1, false); if (r !== null) out.push([r, +t.toFixed(1)]); }
    expect(out.map(o => o[0])).toEqual([1, 2, 3, 4]);
    expect(out[1][1] - out[0][1]).toBeGreaterThanOrEqual(SETTLE_STEP + MEASURE - 0.2);
    expect(run(g, 30, 0.1)).toEqual([]); expect(g.level).toBe(4);   // the lowest stays
  });
  it('stops as soon as it is fine, and never steps up', () => {
    const g = createGovernor({ level: 0, dpr: 2 });
    run(g, START_SETTLE + MEASURE + 0.5, 0.1); expect(g.level).toBe(1);
    expect(run(g, 60, 1 / 60)).toEqual([]); expect(g.level).toBe(1);
  });
  it('ignores the settle time: a slow start (tiles being built) does not count', () => {
    const g = createGovernor({ level: 0, dpr: 2 });
    run(g, START_SETTLE, 0.3); expect(g.level).toBe(0);
    expect(run(g, 20, 1 / 60)).toEqual([]);
  });
  it('does not count idle frames, nor the first frame after idling', () => {
    const g = createGovernor({ level: 0, dpr: 2 });
    run(g, START_SETTLE + 0.5, 1 / 60);
    expect(run(g, 30, 1 / 15, true)).toEqual([]);
    expect(g.frame(1 / 15, false)).toBeNull();   // the interval of the wake-up frame is the idle one
    expect(run(g, 30, 1 / 60)).toEqual([]);
  });
  it('treats a gap (a hidden tab) as a pause, not as a slow frame', () => {
    const g = createGovernor({ level: 0, dpr: 2 });
    run(g, START_SETTLE + 0.5, 1 / 60);
    expect(g.frame(5, false)).toBeNull();
    expect(run(g, 20, 1 / 60)).toEqual([]); expect(g.level).toBe(0);
  });
  it('one long spike among fast frames does not step down', () => {
    const g = createGovernor({ level: 0, dpr: 2 });
    run(g, START_SETTLE + 0.5, 1 / 60);
    const out = [];
    for (let i = 0; i < 400; i++) { const r = g.frame(i === 100 ? 0.4 : 1 / 60, false); if (r !== null) out.push(r); }
    expect(out).toEqual([]);
  });
  it('does nothing when adapting is off (a forced level)', () => {
    const g = createGovernor({ level: 2, adapt: false, dpr: 2 });
    expect(run(g, 60, 0.2)).toEqual([]); expect(g.level).toBe(2);
  });
  it('steps a touch device from 0 straight to 2', () => {
    const g = createGovernor({ level: 0, touch: true, dpr: 2 });
    expect(run(g, 8, 0.1)).toEqual([2]);
  });
});

describe('?quality=N', () => {
  it('reads a whole level 0 to 4 and nothing else', () => {
    expect(parseQuality('?quality=3')).toBe(3); expect(parseQuality('?spawn=1,2&quality=0')).toBe(0);
    for (const bad of ['', '?', '?quality=', '?quality=5', '?quality=-1', '?quality=2.5', '?quality=x', '?spawn=1,2']) expect(parseQuality(bad)).toBeNull();
    expect(parseQuality(undefined)).toBeNull();
  });
  it('forces the level and stops adapting; otherwise uses a fixed preference before the remembered automatic level', () => {
    expect(pickStart({ param: 3, stored: 1 })).toEqual({ level: 3, adapt: false });
    expect(pickStart({ param: 0, stored: 2 })).toEqual({ level: 0, adapt: false });
    expect(pickStart({ stored: 2 })).toEqual({ level: 2, adapt: true });
    expect(pickStart({ preference: { auto: 2, fixed: 4 } })).toEqual({ level: 4, adapt: false });
    expect(pickStart({ preference: { auto: 2, fixed: null } })).toEqual({ level: 2, adapt: true });
    expect(pickStart({ preference: { auto: 2, fixed: 4 }, touch: true })).toEqual({ level: 2, adapt: true });
    expect(pickStart({ param: 1, preference: { auto: 2, fixed: 4 } })).toEqual({ level: 1, adapt: false });
    expect(pickStart({})).toEqual({ level: 0, adapt: true });
  });
});

describe('quality preference', () => {
  const mem = () => { const d = {}; return { getItem: k => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); }, d }; };
  it('cycles Auto through every fixed level and returns with the automatic level intact', () => {
    let preference = { auto: 2, fixed: null };
    for (const fixed of [0, 1, 2, 3, 4]) { preference = cyclePreference(preference); expect(preference).toEqual({ auto: 2, fixed }); }
    expect(cyclePreference(preference)).toEqual({ auto: 2, fixed: null });
  });
  it('round-trips the automatic choice and fixed override through storage', () => {
    const s = mem(); expect(loadPreference(() => s)).toBeNull();
    expect(savePreference({ auto: 2, fixed: 3 }, () => s)).toBe(true); expect(s.d[QUALITY_KEY]).toBe('{"auto":2,"fixed":3}');
    expect(loadPreference(() => s)).toEqual({ auto: 2, fixed: 3 });
    expect(saveLevel(1, () => s)).toBe(true); expect(loadLevel(() => s)).toBe(1);
  });
  it('reads the old automatic-only level as an automatic preference', () => {
    expect(loadPreference(() => ({ getItem: () => '3' }))).toEqual({ auto: 3, fixed: null });
  });
  it('ignores rubbish and survives broken storage', () => {
    for (const v of ['x', '9', '-1', '2.5', '', '{"auto":5,"fixed":null}', '{"auto":2,"fixed":7}']) expect(loadPreference(() => ({ getItem: () => v }))).toBeNull();
    const broken = () => { throw new Error('denied'); };
    expect(loadPreference(broken)).toBeNull(); expect(savePreference({ auto: 2, fixed: null }, broken)).toBe(false);
    expect(savePreference({ auto: 2, fixed: null }, () => ({ setItem: broken }))).toBe(false); expect(loadPreference(() => ({ getItem: broken }))).toBeNull();
  });
  it('accepts one plain G press but never a repeat, modified key or typing field', () => {
    expect(isQualityKey({ code: 'KeyG' })).toBe(true);
    for (const e of [{ code: 'KeyG', repeat: true }, { code: 'KeyG', shiftKey: true }, { code: 'KeyG', ctrlKey: true }, { code: 'KeyG', metaKey: true }, { code: 'KeyG', altKey: true }, { code: 'KeyG', target: { tagName: 'INPUT' } }, { code: 'KeyG', target: { isContentEditable: true } }, { code: 'KeyF' }]) expect(isQualityKey(e)).toBe(false);
  });
});

describe('the two shadow filters in one chunk', () => {
  const both = lightPcf(softPcf(THREE.ShaderChunk.shadowmap_pars_fragment, SOFT_RADIUS), LIGHT_RADIUS);
  it('keeps the bilinear filter in PCF and puts 16 plain taps in PCF_SOFT', () => {
    const i = both.indexOf('SHADOWMAP_TYPE_PCF_SOFT'), j = both.indexOf('SHADOWMAP_TYPE_VSM', i);
    const soft = both.slice(i, j);
    expect(soft).toContain('16.0'); expect(soft).toContain(LIGHT_RADIUS.toFixed(3)); expect(soft).not.toContain('fract( p )');
    expect(soft.match(/texture2DCompare/g).length).toBe(1);   // one tap in the loop
    expect(both.slice(0, i)).toContain('fract( p )');
    expect(both).toContain('VSMShadow'); expect(both).toContain('float getShadow');
  });
  it('leaves a chunk without the branch alone', () => { expect(lightPcf('nothing here', 1.5)).toBe('nothing here'); });
  it('is a radius of 1.5 texels', () => { expect(LIGHT_RADIUS).toBe(1.5); });
});
