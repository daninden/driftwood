/**
 * audio/sound — the sound of the island (0.20 "Sound"): the Web Audio graph. DOM and Web Audio only here.
 *
 * Everything is made in the browser, no sound files: one buffer of pink noise (5 s, looped from random
 * offsets), filters, simple oscillators and envelopes. audio/mix decides what should be heard; this module
 * builds the graph once and, every frame, moves each layer's gain and tone to the targets it is given,
 * smoothly (setTargetAtTime), and plays the single events: footsteps, work sounds, crackles, gull cries,
 * cricket chirps.
 *
 *   Layers (each a gain node into the master): surf (low-passed noise whose cutoff and gain follow the swell,
 *   plus a faint hiss on the crest), river (band-passed noise with a babbling second voice), wind (band-passed
 *   noise), rustle (high-passed noise with fast uneven amplitude), howl (a narrow, slowly wavering band of
 *   noise, summit only), fire (low rumble with random crackles), crickets (scheduled 4 to 5 kHz pulse trains),
 *   gulls (scheduled gliding cries), rain (0.21: noise through a high-pass and a low-pass whose cutoff drops under a
 *   roof, with a faint patter), and the buses for footsteps, work and single effects (the hiss of a fire put out by the rain).
 *   Master gain (MASTER) into a soft limiter (DynamicsCompressor) into the speakers, so nothing clips.
 *
 * The browser only allows sound after a key or tap: gesture() creates (or resumes) the context. M or the
 * mark turns sound off with setEnabled(false): the master fades out and the context is suspended, so it
 * costs nothing; a hidden tab does the same. update() does nothing while nothing is audible.
 *
 * createSound({ enabled }) -> sound
 *   sound.gesture()          call from a key or tap: creates the context the first time, resumes it after
 *   sound.setEnabled(on)     fades in or out (and suspends)
 *   sound.update(heard, dt)  heard: what audio/mix createMixer().update gives; dt: seconds since the last frame
 *   sound.active             true while the context runs and sound is on (so there is something to feed)
 *   sound.context            the AudioContext, or null before the first gesture
 *   sound.enabled
 *
 * Depends on: audio/mix (MASTER)
 */
import { MASTER, LEVELS } from './mix.js';

const NOISE_SECONDS = 5, FADE = 0.35, LOOK_AHEAD = 0.3;
const rand = (a, b) => a + Math.random() * (b - a);

export function createSound({ enabled = true } = {}) {
  let ctx = null, g = null, on = enabled, hidden = false, suspendTimer = null;
  const last = new Map();   // param -> last target, so unchanged ones are not set again
  const clocks = { work: 0, crickets: [0, 0, 0, 0] };
  let workLast = '';

  const audible = () => !!ctx && on && !hidden;

  function noiseBuffer(c) {
    const n = c.sampleRate * NOISE_SECONDS, buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;   // pink noise (Paul Kellet's filter)
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
    }
    return buf;
  }

  function build() {
    const c = new (window.AudioContext || window.webkitAudioContext)();
    const master = c.createGain(); master.gain.value = 0;
    const limiter = c.createDynamicsCompressor();
    limiter.threshold.value = -14; limiter.knee.value = 12; limiter.ratio.value = 8; limiter.attack.value = 0.005; limiter.release.value = 0.2;
    master.connect(limiter); limiter.connect(c.destination);
    const buf = noiseBuffer(c);
    const gain = (v, dest) => { const n = c.createGain(); n.gain.value = v; n.connect(dest); return n; };
    const filter = (type, f, q, dest) => { const n = c.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; n.connect(dest); return n; };
    const noise = dest => { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rand(0.9, 1.1); s.connect(dest); s.start(0, rand(0, NOISE_SECONDS - 0.1)); return s; };
    const lfo = (rate, depth, param) => { const o = c.createOscillator(), d = c.createGain(); o.frequency.value = rate; d.gain.value = depth; o.connect(d); d.connect(param); o.start(); return o; };
    const layer = () => gain(0, master);

    const L = { surf: layer(), hiss: layer(), river: layer(), babble: layer(), wind: layer(), rustle: layer(), howl: layer(), fire: layer(), crickets: layer(), gulls: layer(), rain: layer(), patter: layer(), steps: gain(1, master), work: gain(LEVELS.work, master), fx: gain(1, master) };

    const F = {};
    F.surf = filter('lowpass', 800, 0.4, L.surf); noise(F.surf);
    noise(filter('bandpass', 2600, 0.5, L.hiss));   // foam on the crest
    F.river = filter('bandpass', 900, 0.6, L.river); noise(F.river);
    const babble = gain(0.55, L.babble); lfo(3.3, 0.3, babble.gain); lfo(5.7, 0.15, babble.gain);
    noise(filter('bandpass', 1500, 2.5, babble));
    F.wind = filter('bandpass', 400, 0.8, L.wind); noise(F.wind);
    const rustle = gain(0.5, L.rustle); lfo(7.1, 0.3, rustle.gain); lfo(11.3, 0.2, rustle.gain);
    noise(filter('highpass', 2800, 0.5, rustle));
    const howl = gain(5, L.howl); lfo(0.21, 0.5, howl.gain);
    F.howl = filter('bandpass', 450, 14, howl); lfo(0.13, 45, F.howl.frequency); noise(F.howl);
    F.rain = filter('lowpass', 7500, 0.5, L.rain); noise(filter('highpass', 600, 0.5, F.rain));   // rain: a steady hiss, darker under a roof
    const patter = gain(0.5, L.patter); lfo(8.3, 0.3, patter.gain); lfo(12.7, 0.2, patter.gain); noise(filter('bandpass', 3200, 1.2, patter));   // and a faint uneven patter
    const rumble = gain(0.8, L.fire); lfo(2.3, 0.35, rumble.gain);
    noise(filter('lowpass', 240, 0.7, rumble));

    return { c, master, limiter, buf, L, F, noise };
  }

  // one-shot noise grain: band-passed, with a quick attack and an exponential decay
  function grain(dest, { at = 0, freq, to, q = 1, dur = 0.1, gain = 0.3, type = 'bandpass', attack = 0.004 }) {
    const { c, buf } = g, t = c.currentTime + at + 0.005;
    const s = c.createBufferSource(); s.buffer = buf; s.playbackRate.value = rand(0.8, 1.25);
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const e = c.createGain(); e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(gain, t + attack); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(e); e.connect(dest); s.start(t, rand(0, NOISE_SECONDS - 0.6), dur + 0.05);
  }

  // one-shot tone gliding through points [[time share, freq], ...]
  function tone(dest, { at = 0, type = 'sine', points, dur = 0.1, gain = 0.2, attack = 0.005, filt = null }) {
    const { c } = g, t = c.currentTime + at + 0.005;
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(points[0][1], t);
    for (let i = 1; i < points.length; i++) o.frequency.linearRampToValueAtTime(points[i][1], t + dur * points[i][0]);
    const e = c.createGain(); e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(gain, t + attack); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let out = e;
    if (filt) { const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = filt.freq; f.Q.value = filt.q; e.connect(f); out = f; }
    o.connect(e); out.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }

  const STEPS = {
    dry: (d, k, v) => { grain(d, { freq: 1700 * k, q: 0.8, dur: 0.11 * v, gain: 0.55 }); grain(d, { at: 0.02, freq: 4200 * k, q: 0.6, dur: 0.05, gain: 0.18 }); },
    wet: (d, k, v) => { grain(d, { freq: 700 * k, q: 1, dur: 0.09 * v, gain: 0.7 }); tone(d, { points: [[0, 150 * k], [1, 80 * k]], dur: 0.08 * v, gain: 0.25 }); grain(d, { at: 0.04, freq: 500 * k, to: 950 * k, q: 3, dur: 0.05, gain: 0.2 }); },
    water: (d, k, v) => { grain(d, { freq: 1000 * k, to: 500 * k, q: 0.9, dur: 0.24 * v, gain: 0.6 }); for (let i = 0; i < 2; i++) tone(d, { at: rand(0.02, 0.14), points: [[0, 450 * k], [1, 1100 * k]], dur: 0.05, gain: 0.07 }); },
    grass: (d, k, v) => { grain(d, { freq: 3000 * k, q: 0.6, dur: 0.08 * v, gain: 0.35 }); grain(d, { at: 0.01, freq: 1200 * k, q: 0.7, dur: 0.06 * v, gain: 0.2 }); },
  };
  function step(s) {
    const k = rand(0.88, 1.12) * (1 - 0.3 * s.heavy), v = (1 + 0.5 * s.heavy) * (s.run ? 0.85 : 1);
    const bus = g.c.createGain(); bus.gain.value = s.gain; bus.connect(g.L.steps);   // this step's own loudness (mix: stepOf)
    (STEPS[s.ground] || STEPS.grass)(bus, k, v);
  }

  function work(w, dt) {
    const key = w ? w.kind : '';
    if (key !== workLast) { workLast = key; clocks.work = 0; }
    if (!w) return;
    clocks.work -= dt;
    if (clocks.work > 0) return;
    const d = g.L.work;
    if (w.kind === 'husk') {
      clocks.work = rand(0.45, 0.65);
      grain(d, { freq: 2400, to: 900, q: 0.9, dur: 0.26, gain: 0.5 }); tone(d, { at: 0.12, points: [[0, 110], [1, 60]], dur: 0.13, gain: 0.35 });
    } else if (w.kind === 'drill') {
      clocks.work = 0.11;
      grain(d, { freq: 1000 + 700 * w.f, q: 2.5, dur: 0.1, gain: 0.3 + 0.2 * w.f }); grain(d, { freq: 2600, q: 1, dur: 0.05, gain: 0.1 });
    } else if (w.kind === 'build') {
      clocks.work = rand(0.8, 1.1);
      tone(d, { type: 'triangle', points: [[0, 210], [1, 120]], dur: 0.11, gain: 0.5 }); grain(d, { freq: 900, q: 1.5, dur: 0.04, gain: 0.25 });
      tone(d, { at: 0.2, type: 'triangle', points: [[0, 190], [1, 110]], dur: 0.1, gain: 0.3 });
    } else clocks.work = 1;   // drinking and the rest: quiet
  }

  function hiss(level) {   // a fire put out by the rain: a burst of steam
    const bus = g.c.createGain(); bus.gain.value = level; bus.connect(g.L.fx);
    grain(bus, { freq: 6000, to: 2600, q: 0.6, dur: 1.5, gain: 1, attack: 0.03 }); grain(bus, { at: 0.05, freq: 3000, to: 1400, q: 0.7, dur: 1.0, gain: 0.7, attack: 0.03 });
  }

  function crackle(rate, dt) {
    for (let i = 0; i < 3 && Math.random() < rate * dt; i++) grain(g.L.fire, { freq: rand(1500, 5200), q: rand(1, 4), dur: rand(0.006, 0.03), gain: rand(0.3, 1), attack: 0.001 });
  }

  function gull(rate, dt) {
    if (Math.random() >= rate * dt) return;
    const n = 2 + Math.floor(Math.random() * 3), base = rand(1500, 1900);
    for (let i = 0; i < n; i++) {
      const at = i * rand(0.3, 0.4), up = i === 0 ? 1.15 : 1;
      tone(g.L.gulls, { at, type: 'sawtooth', points: [[0, base * 0.8 * up], [0.35, base * 1.25 * up], [1, base * 0.7 * up]], dur: rand(0.22, 0.34), gain: 1, attack: 0.03, filt: { freq: 2200, q: 1.4 } });
    }
  }

  function crickets(level) {
    const t = g.c.currentTime;
    for (let i = 0; i < clocks.crickets.length; i++) {
      if (clocks.crickets[i] < t) clocks.crickets[i] = t + rand(0, 0.8);
      while (clocks.crickets[i] < t + LOOK_AHEAD) {
        if (level > 0.002) {
          const f = 4200 + i * 330 + rand(-30, 30), at = clocks.crickets[i] - t;
          for (let p = 0; p < 3; p++) tone(g.L.crickets, { at: at + p * 0.05, points: [[0, f], [1, f * 1.01]], dur: 0.028, gain: 0.5, attack: 0.006 });
        }
        clocks.crickets[i] += 0.8 + i * 0.17 + rand(0, 0.9);
      }
    }
  }

  function set(param, v, tc) {
    if (Math.abs((last.get(param) ?? -1) - v) < 1e-4 * Math.max(1, Math.abs(v))) return;
    last.set(param, v); param.setTargetAtTime(v, ctx.currentTime, tc);
  }

  function settle() {
    if (!ctx) return;
    clearTimeout(suspendTimer); suspendTimer = null;
    const want = audible();
    if (want) { if (ctx.state !== 'running') ctx.resume().catch(() => {}); }
    g.master.gain.cancelScheduledValues(ctx.currentTime);
    g.master.gain.setTargetAtTime(want ? MASTER : 0, ctx.currentTime, FADE / 3);
    if (!want) suspendTimer = setTimeout(() => { if (ctx && !audible() && ctx.state === 'running') ctx.suspend().catch(() => {}); }, FADE * 1000 * 2);
  }

  function gesture() {
    if (ctx && (ctx.state === 'running' || !on)) return;   // nothing to start or wake
    if (!ctx) {
      try { ctx = (g = build()).c; } catch (e) { ctx = null; g = null; return; }
      document.addEventListener('visibilitychange', () => { hidden = document.visibilityState === 'hidden'; settle(); });
      hidden = document.visibilityState === 'hidden';
    }
    settle();
  }

  function setEnabled(v) { on = !!v; settle(); }

  function update(heard, dt) {
    if (!audible() || ctx.state !== 'running') return;
    const m = heard.levels, L = g.L, F = g.F;
    set(L.surf.gain, m.surf.gain, 0.12); set(F.surf.frequency, m.surf.cutoff, 0.12); set(L.hiss.gain, m.surf.gain * m.surf.hiss * 0.35, 0.12);
    set(L.river.gain, m.river.gain, 0.3); set(F.river.frequency, m.river.cutoff, 0.4); set(L.babble.gain, m.river.gain * 0.6, 0.3);
    set(L.wind.gain, m.wind.gain, 0.5); set(F.wind.frequency, m.wind.freq, 0.5);
    set(L.rustle.gain, m.rustle.gain, 0.4);
    set(L.howl.gain, m.howl.gain, 0.8); set(F.howl.frequency, m.howl.freq, 0.8);
    set(L.fire.gain, m.fire.gain, 0.3);
    set(L.crickets.gain, m.crickets.gain, 1);
    set(L.gulls.gain, m.gulls.gain, 0.2);
    set(L.rain.gain, m.rain.gain, 1); set(F.rain.frequency, m.rain.cutoff, 0.6); set(L.patter.gain, m.rain.gain * 0.22, 1);
    if (m.fire.rate > 0) crackle(m.fire.rate, dt);
    if (m.gulls.rate > 0) gull(m.gulls.rate, dt);
    crickets(m.crickets.gain);
    for (const s of heard.steps) step(s);
    for (const h of heard.hisses || []) hiss(h);
    work(heard.work, dt);
  }

  return {
    gesture, setEnabled, update,
    get active() { return audible() && ctx.state === 'running'; },
    get context() { return ctx; },
    get enabled() { return on; },
  };
}
