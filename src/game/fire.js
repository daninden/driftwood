/**
 * game/fire — making fire, and keeping it going.
 *
 * Rules
 *   - A fire is laid as a pile of at least FIRE_MIN pieces of driftwood
 *     (game/wood), on dry ground.
 *   - Lighting it takes a tuft of coconut fibre (game/fibre) and DRILL_TIME
 *     seconds of kneeling and twirling the staff as a fire drill (game/game).
 *     It is hard work: a whole attempt costs DRILL_COST days of rest
 *     (game/sleep). Stopping before the end keeps the fibre.
 *   - At the end the fibre is used up, and the fire catches or it does not.
 *     The chance is CATCH at best for a beginner and grows with practice (0.30.21: every earlier attempt, failed ones too,
 *     counts; `practised` of core/math rises from CATCH to CATCH_TOP, fast at first, then slower; skill never fades), falls steeply with wet wood (the mean
 *     dryness of the pile, game/wood `dryness`, squared) and with tiredness
 *     (down to TIRED_CATCH of it at the limit). Wet wood never catches. A
 *     failed attempt leaves only a puff of smoke.
 *   - Each piece burns BURN days (wet wood half as long); a branch (a log with
 *     `branch: true`, game/branches) burns BRANCH_BURN (half) as long as a piece of driftwood; a fire holds at
 *     most FUEL_MAX of fuel. When the wood is gone the fire sinks to embers
 *     for EMBERS days and goes out. Its first WARM_EMBERS days still warm a
 *     sleeper; wood laid on a fire or on its embers,
 *     one piece at a time, keeps it going.
 *   - The flood puts out a fire it reaches (on the wet sand of low water).
 *   - A torch: a burning brand taken out of a fire that has flames, which
 *     costs the fire TORCH_COST of fuel. It burns TORCH_DAYS (two hours)
 *     and lights the way at night. It can be stuck in the ground, where it
 *     burns on, and taken up again. Wading deeper than DOUSE_DEPTH puts out a
 *     carried torch; the flood puts out one stuck in the sand.
 *   - A torch lights a pile of at least FIRE_MIN pieces without fibre or
 *     drilling: it always catches when the wood is dry enough (mean dryness
 *     at least TORCH_DRY), and the torch goes into the fire. Wetter wood only
 *     smokes, and the torch is kept.
 *   - When a fire goes out (its embers die) it leaves its burnt place: ash and
 *     charred ends, no light and no warmth, nothing that blocks. It stays
 *     BURNT_DAYS (two days) and fades slowly (render/fire). The flood washes it
 *     away sooner, as it puts fires out (and a fire put out by the flood leaves
 *     none); a new fire lit on it replaces it.
 *   - Rain (0.21, game/weather): a fire in the open burns RAIN_BURN (3) times as fast while it rains and
 *     goes out after RAIN_OUT (fifteen game minutes) of rain: it leaves a burnt place with `wet: true`
 *     (wet ash) and counts a hiss (`hissed`, `hissAt`). A torch, carried or in the ground, burns TORCH_RAIN (2)
 *     times as fast in the rain. Under a roof (game/game decides, `rain(x, z)` is false there) nothing changes.
 *   - A stone ring (0.27 "Home", game/leanto): a fire inside one (`ring(x, z)` is true there) burns RING_BURN (1.5) times as
 *     long, and the rain neither burns it faster nor puts it out. Torches are not helped.
 *   - A full fire (FUEL_MAX) takes no more wood: `full(f)`.
 *   - A fire, or only its first WARM_EMBERS of embers, within WARM_R warms a
 *     sleeper (game/sleep). A newly fed ember becomes a real flame and starts
 *     a fresh ember stage only after that flame has burned down.
 *   - Whether a fire catches is fixed by the seed and how many attempts
 *     there have been, so a game plays the same way twice.
 *
 * Pure data; no DOM, no Three.js.
 *
 * FIRE_MIN, DRILL_TIME, DRILL_COST, CATCH, CATCH_TOP, TIRED_CATCH, BURN, FUEL_MAX, EMBERS, WARM_EMBERS,
 * BRANCH_BURN, fuelOf(logs) -> the fuel in days of a list of pieces (a branch counts BRANCH_BURN of a piece)
 * TORCH_DAYS, TORCH_COST, TORCH_DRY, DOUSE_DEPTH, WARM_R, BURNT_DAYS, RAIN_BURN, RAIN_OUT, TORCH_RAIN, RING_BURN
 * full(f) -> true when fire f holds as much as it can (FUEL_MAX)
 * fireOutlook({ fuel, ring, hoursToDawn, dry, branches }) -> { pieces, hoursLeft, perPiece, need, storeHours, max, maxHours }   (0.36.9 "Voice", pure, read only: for the plan request of src/ai) what a fire and a store mean in hours:
 *   fuel: days of fuel on the fire (0 for none), ring: a stone ring holds it (RING_BURN), hoursToDawn: hours of the clock until dawn, dry: dry pieces of driftwood in the store, branches: branches in the store (a branch is BRANCH_BURN of a piece; wet wood
 *   does not burn and is left out). pieces: fuel in pieces of driftwood, hoursLeft: how long the fuel burns, perPiece: hours one dry piece burns (BURN, RING_BURN times as long in a ring), need: whole pieces more that the fire needs to last until dawn (0 when it lasts),
 *   storeHours: hours of fire the store holds, max / maxHours: what the fire holds at most (FUEL_MAX) in pieces and in hours. A wet piece laid on a fire gives half a piece (`feed`), so wet wood never counts here.
 * catchChance(dry, tired, attempts = 0) -> 0..CATCH_TOP   dry: mean dryness 0..1, tired 0..1 (game/sleep), attempts: the attempts made before (fire.attempts)
 * createFire(world, saved?) -> fire
 *   fire.fires             [{ id, x, z, fuel, embers, emberAge, lit, fed, rained? }]  fuel and embers in
 *                          days left; emberAge: days since its current ember stage began; lit: the day it was lit;
 *                          fed: pieces laid on; rained: days of rain on it so far
 *   fire.burnt             [{ id, x, z, left, n, wet? }]  burnt places: left: days to go (BURNT_DAYS
 *                          at first, then counting down), n: how many charred ends; wet: rain put the fire out
 *   fire.hissed            counts the fires the rain put out (for the sound); fire.hissAt is where the latest was { x, z }
 *   fire.puffs             [{ x, z, at }]  the latest failed attempts (at: the day), for the renderer
 *   fire.attempts          how many attempts there have been
 *   fire.version           goes up with every change that shows (not with burning)
 *   fire.torch             null, or { left } the torch carried (days left)
 *   fire.torches           [{ id, x, z, left }]  torches stuck in the ground
 *   fire.find(x, z, reach, only?) -> { kind: 'fire', fire, x, z, d } | { kind: 'torch', torch, x, z, d } | null
 *     the nearest fire or torch stuck in the ground (d: distance to its edge);
 *     only: 'fire' or 'torch' to look for that kind alone
 *   fire.takeTorch(f) -> true when a torch was taken out of fire f
 *   fire.plant(x, z) -> true when the torch carried was stuck in the ground there
 *   fire.pickTorch(t) -> true when torch t was taken up again (hands free of a torch)
 *   fire.douse() -> true when the torch carried went out (in the water)
 *   fire.warm(x, z) -> true when a fire or its embers are within WARM_R
 *   fire.attempt(x, z, logs, dry, tired, total) -> the new fire, or null when it did
 *     not catch (logs: the pile's pieces, dry: their mean dryness)
 *   fire.kindle(x, z, logs, dry, total) -> the new fire lit with the torch carried,
 *     or null (no torch, or the wood too wet: a puff of smoke)
 *   fire.feed(f, dry, burn?) -> true when a piece of dryness dry went on fire f (false: not a fire of ours, or it is full);
 *     burn: 1 for driftwood, BRANCH_BURN for a branch
 *   fire.update(days, rain?, at?, total?, ring?)  burns down by days of game time; embers and torches go out.
 *     ring: null, or ring(x, z) -> true where a stone ring holds the fire (game/leanto `ring`): it burns RING_BURN times as long, rain or not;
 *     rain: null, or rain(x, z) -> true where the rain reaches (not under a lean-to); at { x, z }: where the carried torch is;
 *     total: the days on the clock, to stamp the puff of steam a fire put out by the rain leaves
 *   fire.flood(sea) -> number of fires (and torches in the sand) the sea put out
 *   fire.strength(f) -> 0..1 how big the flames are (0 for embers)
 *   fire.state() -> { fires, attempts, nextId, torch, torches, burnt }   plain, for saving
 *   saved: such a state, to start from
 *
 * Depends on: core/noise, core/math
 */
import { mulberry32, hashInt } from '../core/noise.js';
import { practised } from '../core/math.js';

export const FIRE_MIN = 4;
export const DRILL_TIME = 14;                 // seconds of twirling
export const DRILL_COST = 0.08;               // days of rest a whole attempt costs
export const CATCH = 0.6, CATCH_TOP = 0.9, TIRED_CATCH = 0.5;  // the best chance of a beginner, the best after much practice (0.30.21), and how much of it is left worn out
export const BURN = 2.5 / 24;                 // a dry piece burns two and a half hours
export const BRANCH_BURN = 0.5;                // a branch burns half as long as a piece of driftwood
export const fuelOf = logs => logs.reduce((s, l) => s + (l.branch ? BRANCH_BURN : 1), 0) * BURN;
export const FUEL_MAX = 8 * BURN;
export const EMBERS = 12 / 24;                 // embers can be woken for half a day
export const WARM_EMBERS = 1.5 / 24;           // only their first hour and a half warm sleep
export const TORCH_DAYS = 2 / 24;             // a torch burns two hours
export const TORCH_COST = BURN / 2;           // and takes half a piece's worth out of the fire
export const TORCH_DRY = 0.75;                // a torch lights a pile this dry, always
export const DOUSE_DEPTH = 0.3;               // wading deeper puts a torch out
export const BURNT_DAYS = 2;                  // a burnt place stays this long
export const WARM_R = 3;                      // a fire this close warms a sleeper
export const RAIN_BURN = 3;                   // in the rain a fire in the open burns down this many times as fast
export const RAIN_OUT = 15 / 1440;            // and goes out after this much rain (fifteen game minutes)
export const RING_BURN = 1.5;                 // in a stone ring a fire lasts this many times as long
export const TORCH_RAIN = 2;                  // a torch burns this many times as fast in the rain
const FIRE_R = 0.5;                           // how far a fire reaches round its centre
const TORCH_R = 0.2;
const PUFFS = 4;
const BURNT_MAX = 32;                         // at most this many burnt places are kept
const BURNT_R = 0.7;                          // a new fire this close to a burnt place replaces it

export const full = f => f.fuel >= FUEL_MAX - 1e-9;
export const catchChance = (dry, tired = 0, attempts = 0) => practised(CATCH, CATCH_TOP, attempts) * Math.max(0, Math.min(1, dry)) ** 2 * (1 - (1 - TIRED_CATCH) * Math.max(0, Math.min(1, tired)));
/** 0.36.9: what a fire and a store mean in hours (pure; see the header). */
export function fireOutlook({ fuel = 0, ring = false, hoursToDawn = 0, dry = 0, branches = 0 } = {}) {
  const k = ring ? RING_BURN : 1, perPiece = BURN * 24 * k, f = Math.max(0, fuel);
  const hoursLeft = f * 24 * k;
  return {
    pieces: f / BURN, hoursLeft, perPiece, need: Math.max(0, Math.ceil((Math.max(0, hoursToDawn) - hoursLeft) / perPiece - 1e-9)),
    storeHours: (Math.max(0, dry) + Math.max(0, branches) * BRANCH_BURN) * perPiece, max: FUEL_MAX / BURN, maxHours: FUEL_MAX * 24 * k,
  };
}
/** The visual heat left in an ember stage: warm at first, a few red points at its end. */
export const emberGlow = f => Math.max(0, Math.min(1, f.embers / EMBERS)) ** 1.7;

export function createFire(w, saved) {
  const fire = { fires: [], puffs: [], attempts: 0, version: 0, hissed: 0, hissAt: null, torch: null, torches: [], burnt: [], find, attempt, kindle, feed, takeTorch, plant, pickTorch, douse, warm, update, flood, strength, state };
  let nextId = 0;
  if (saved) {
    fire.fires = (saved.fires || []).map(f => {
      // Saves before Embers held at most the old 1.5-hour remainder. Keep that
      // remainder rather than giving them a fresh half day or fresh warmth.
      const embers = Math.max(0, Math.min(EMBERS, f.embers || 0));
      return { ...f, embers, emberAge: Number.isFinite(f.emberAge) ? Math.max(0, f.emberAge) : Math.max(WARM_EMBERS, EMBERS - embers) };
    });
    fire.attempts = saved.attempts || 0;
    fire.torch = saved.torch ? { ...saved.torch } : null;
    fire.torches = (saved.torches || []).map(t => ({ ...t }));
    fire.burnt = (saved.burnt || []).slice(0, BURNT_MAX).map(b => ({ ...b }));
    nextId = saved.nextId || [...fire.fires, ...fire.torches, ...fire.burnt].reduce((m, f) => Math.max(m, f.id + 1), 0);
  }

  function find(x, z, reach, only) {
    let best = null, bd = reach;
    if (only !== 'torch') for (const f of fire.fires) {
      const d = Math.max(0, Math.hypot(x - f.x, z - f.z) - FIRE_R);
      if (d < bd) { bd = d; best = { kind: 'fire', fire: f, x: f.x, z: f.z, d }; }
    }
    if (only !== 'fire') for (const t of fire.torches) {
      const d = Math.max(0, Math.hypot(x - t.x, z - t.z) - TORCH_R);
      if (d < bd) { bd = d; best = { kind: 'torch', torch: t, x: t.x, z: t.z, d }; }
    }
    return best;
  }
  function takeTorch(f) {
    if (fire.torch || !fire.fires.includes(f) || f.fuel <= TORCH_COST) return false;
    f.fuel -= TORCH_COST; fire.torch = { left: TORCH_DAYS }; fire.version++; return true;
  }
  function plant(x, z) {
    if (!fire.torch) return false;
    fire.torches.push({ id: nextId++, x, z, left: fire.torch.left }); fire.torch = null; fire.version++; return true;
  }
  function pickTorch(t) {
    const i = fire.torches.indexOf(t); if (fire.torch || i < 0) return false;
    fire.torches.splice(i, 1); fire.torch = { left: t.left }; fire.version++; return true;
  }
  function douse() { if (!fire.torch) return false; fire.torch = null; fire.version++; return true; }
  function warm(x, z) { return fire.fires.some(f => (f.fuel > 0 || f.emberAge < WARM_EMBERS) && Math.hypot(f.x - x, f.z - z) < WARM_R); }
  function attempt(x, z, logs, dry, tired, total) {
    const r = mulberry32(hashInt(w.seed + 71, fire.attempts, 7)); r();
    const chance = catchChance(dry, tired, fire.attempts);
    fire.attempts++;
    if (r() >= chance) {
      fire.puffs.push({ x, z, at: total }); if (fire.puffs.length > PUFFS) fire.puffs.shift();
      fire.version++; return null;
    }
    const f = { id: nextId++, x, z, fuel: Math.min(FUEL_MAX, fuelOf(logs)), embers: EMBERS, emberAge: 0, lit: total, fed: logs.length };
    fire.fires.push(f); clearBurnt(x, z); fire.version++; return f;
  }
  function kindle(x, z, logs, dry, total) {
    if (!fire.torch) return null;
    if (dry < TORCH_DRY) { fire.puffs.push({ x, z, at: total }); if (fire.puffs.length > PUFFS) fire.puffs.shift(); fire.version++; return null; }
    const f = { id: nextId++, x, z, fuel: Math.min(FUEL_MAX, fuelOf(logs)), embers: EMBERS, emberAge: 0, lit: total, fed: logs.length };
    fire.fires.push(f); clearBurnt(x, z); fire.torch = null; fire.version++; return f;
  }
  function clearBurnt(x, z) { fire.burnt = fire.burnt.filter(b => Math.hypot(b.x - x, b.z - z) >= BURNT_R); }
  function feed(f, dry = 1, burn = 1) {
    if (!fire.fires.includes(f) || full(f)) return false;
    f.fuel = Math.min(FUEL_MAX, f.fuel + BURN * burn * (0.5 + 0.5 * dry)); f.embers = EMBERS; f.emberAge = 0; f.fed++;
    fire.version++; return true;
  }
  function update(days, rain = null, at = null, total = null, ring = null) {
    if (!(days > 0)) return;
    for (let i = fire.burnt.length - 1; i >= 0; i--) { const b = fire.burnt[i]; b.left -= days; if (b.left <= 0) { fire.burnt.splice(i, 1); fire.version++; } }
    for (let i = fire.fires.length - 1; i >= 0; i--) {
      const f = fire.fires[i], held = !!ring && ring(f.x, f.z), wet = !held && !!rain && rain(f.x, f.z), k = (wet ? RAIN_BURN : 1) / (held ? RING_BURN : 1);
      if (wet) f.rained = (f.rained || 0) + days; else if (f.rained) delete f.rained;
      if (f.rained >= RAIN_OUT) { fire.fires.splice(i, 1); leaveBurnt(f, true); fire.hissed++; fire.hissAt = { x: f.x, z: f.z }; if (total !== null) { fire.puffs.push({ x: f.x, z: f.z, at: total }); if (fire.puffs.length > PUFFS) fire.puffs.shift(); } fire.version++; continue; }   // the rain put it out
      let emberDays = days;
      if (f.fuel > 0) {
        const fuelDays = Math.min(days, f.fuel / k), burned = fuelDays * k;
        f.fuel -= burned; emberDays -= fuelDays;
        if (f.fuel < 1e-9) f.fuel = 0;
        if (f.fuel === 0) { f.embers = EMBERS; f.emberAge = 0; fire.version++; }
      }
      if (f.fuel === 0 && emberDays > 0) {
        f.embers -= emberDays * k; f.emberAge += emberDays;
        if (f.embers <= 0) { fire.fires.splice(i, 1); leaveBurnt(f); fire.version++; }
      }
    }
    if (fire.torch) { fire.torch.left -= days * (rain && at && rain(at.x, at.z) ? TORCH_RAIN : 1); if (fire.torch.left <= 0) { fire.torch = null; fire.version++; } }
    for (let i = fire.torches.length - 1; i >= 0; i--) { const t = fire.torches[i]; t.left -= days * (rain && rain(t.x, t.z) ? TORCH_RAIN : 1); if (t.left <= 0) { fire.torches.splice(i, 1); fire.version++; } }
  }
  function leaveBurnt(f, wet = false) {
    fire.burnt.push({ id: f.id, x: f.x, z: f.z, left: BURNT_DAYS, n: Math.max(3, Math.min(6, f.fed)), ...(wet ? { wet: true } : {}) });
    if (fire.burnt.length > BURNT_MAX) fire.burnt.shift();
  }
  function flood(sea) {
    let n = 0;
    for (const list of [fire.fires, fire.torches, fire.burnt]) for (let i = list.length - 1; i >= 0; i--) if (w.H(list[i].x, list[i].z) < sea) { list.splice(i, 1); n++; }
    if (n) fire.version++;
    return n;
  }
  function strength(f) { return f.fuel > 0 ? Math.min(1, 0.35 + f.fuel / (3 * BURN) * 0.65) : 0; }
  function state() { return { fires: fire.fires.map(f => ({ ...f })), attempts: fire.attempts, nextId, torch: fire.torch ? { ...fire.torch } : null, torches: fire.torches.map(t => ({ ...t })), burnt: fire.burnt.map(b => ({ ...b })) }; }
  return fire;
}
