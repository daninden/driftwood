// Playtest bot, the part that runs inside the page (injected by scripts/playtest.js after the game is ready and
// after scripts/playtest-lib.js, which provides window.DWLib: the game's own movement rules and path finding, src/game/path).
// Tooling only; no game code is changed (opts: window.__mindMode = true, set by `npm run playtest -- --mind`, lets the bot do nothing and Dave's own habit, src/game/mind, live). It plays through the real inputs: input.target (a click on the ground or on a
// thing), input.run (Shift), the action button (input.actionStart/actionEnd, the same calls the button makes), a click on an icon of
// the arc above it (input.choose(i), what the click calls; for light, build, upgrade and sleep) and game.use(kind) for the drawings in the row (what a click on the row calls).
// Only a few game methods are wrapped, to log events exactly (hunger.eat, thirst.drink, ...); they still call the original.
//
// window.makeBot(opts, imported) -> bot
//   bot.run(seconds) -> reason ('time' | 'shot' | 'roundtrip')   plays that many game seconds of ticks (0.1 s each)
//   bot.metrics   the log (plain JSON; pass it back as `imported` after a page reload)
//   bot.summary() -> small status object for the console
(function () {
  const HALF = 360, C = 1.5, TICK = 1 / 60, DAYS = 1200;
  window.makeBot = function makeBot(opts, imported) {
    const D = window.__driftwood, { world, game, input } = D, L = window.DWLib;
    const p = game.player, clock = game.clock, W = game.wood;
    const mind = window.__mindMode ? L.createMind(world, game) : null;   // --mind: the bot does nothing, Dave's own habit (src/game/mind) lives (0.28)
    if (mind) mind.engage();
    const fresh = !imported; const M = imported || { seed: world.seed, days: {}, events: [], stucks: [], errors: [], botErrors: [], searches: [], sleeps: [], roundtrips: [], shots: [], goals: {}, totals: {}, nextRt: 0, base: null };
    const gt = () => clock.total * DAYS;
    const dayRec = d => M.days[d] || (M.days[d] = { day: d, maxHunger: 0, maxThirst: 0, minRest: 1, eaten: {}, eatenDays: 0, drinks: 0, sips: 0, fills: 0, searches: 0, searchSecs: 0, tThirsty: 0, tVery: 0, tHungry: 0, tStarving: 0, tAsleep: 0, collapses: 0, sleeps: 0, fires: 0, fireFails: 0, firesLost: 0, firesLostRain: 0, leantos: 0, upgrades: 0, showers: 0, dist: 0, runSecs: 0, walkSecs: 0, winded: 0, stuck: 0, goalsAbandoned: 0, wood: 0, branches: 0, fronds: 0, stones: 0, husks: 0, berries: 0, bananas: 0, crabsCaught: 0, crabsEaten: 0, crabDigs: 0 });
    const R = () => dayRec(clock.day);
    const inc = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };
    const ev = (type, data) => { const e = { type, day: clock.day, time: +clock.time.toFixed(3), x: +p.x.toFixed(1), z: +p.z.toFixed(1), ...data }; M.events.push(e); return e; };
    const botErr = (what, e) => { M.botErrors.push({ day: clock.day, time: +clock.time.toFixed(3), what, msg: String(e && e.stack || e).slice(0, 400) }); };
    const shot = (name, why) => { if (M.shots.some(s => s.name === name)) return; M.shots.push({ name, why, day: clock.day, time: +clock.time.toFixed(3), x: +p.x.toFixed(1), z: +p.z.toFixed(1) }); wantShot = name; };
    if (fresh) M.nextRt = gt() + 300;
    let wantShot = null, lastKind0 = null, search = null, botSleep = false;

    // ---------- wrapped game methods: exact event log ----------
    if (!game.__wrapped) {
      game.__wrapped = true;
      const wrap = (obj, name, fn) => { const o = obj[name].bind(obj); obj[name] = (...a) => fn(o, ...a); };
      wrap(game.hunger, 'eat', (o, food) => {
        const lastKind = mind ? mind.lastKind() : lastKind0, before = game.hunger.days, kind = ({ husk: 'coconut', berries: 'berries', eatBerries: 'berries', bananas: 'banana', eatBanana: 'banana', roast: 'crab', 'use:berries': 'berries', 'use:banana': 'banana', 'use:nut': 'coconut', 'use:crab': 'crab' })[lastKind] || ('?' + lastKind);
        const r = o(food); inc(R().eaten, kind); R().eatenDays++;
        ev('eat', { kind, food: +(food === undefined ? 1 : food).toFixed(2), before: +before.toFixed(2), after: +game.hunger.days.toFixed(2) });
        if (search) { const dur = gt() - search.t0; M.searches.push({ day: clock.day, kind, secs: +dur.toFixed(1), from: search.from, hungerAtStart: search.h, target: search.kind }); R().searches++; R().searchSecs += dur; search = null; }
        return r;
      });
      wrap(game.thirst, 'drink', (o) => { const b = game.thirst.days; const r = o(); R().drinks++; ev('drink', { before: +b.toFixed(2) }); return r; });
      wrap(game.thirst, 'sip', (o, d) => { const r = o(d); R().sips++; ev('sip', { days: d }); return r; });
      wrap(game.shells, 'fill', (o) => { const r = o(); if (r) R().fills++; return r; });
      wrap(game.fire, 'attempt', (o, ...a) => { const n = game.fire.fires.length, r = o(...a); if (r) { R().fires++; ev('fire', { ok: true, attempts: game.fire.attempts, dry: +(a[3] || 0).toFixed(2) }); } else { R().fireFails++; ev('fire', { ok: false, attempts: game.fire.attempts, dry: +(a[3] || 0).toFixed(2) }); } return r; });
      wrap(game.leantos, 'start', (o, ...a) => { const r = o(...a); R().leantos++; ev('leanto-start'); return r; });
      wrap(game.leantos, 'upgraded', (o, l, what, pr) => { const was = l.up && l.up[what]; const r = o(l, what, pr); if (pr >= 1 && was !== 1) { R().upgrades++; ev('upgrade', { what }); shot('upgraded-leanto', 'upgrade ' + what + ' finished'); } return r; });
      wrap(game.sleep, 'start', (o, ...a) => {
        const t = game.thirst.days, hh = game.hunger.days, aw = game.sleep.awake, chosenNow = botSleep || !!(mind && mind.chose());
        const r = o(...a); const s = { day: clock.day, t0: +clock.time.toFixed(3), x: +p.x.toFixed(1), z: +p.z.toFixed(1), chosen: chosenNow, reason: chosenNow ? 'chosen' : (t >= 1.99 ? 'thirst collapse' : aw >= 1.99 ? 'exhaustion' : 'other'), totalStart: clock.total, awake: +aw.toFixed(2), restBefore: +game.sleep.rest().toFixed(2), thirst: +t.toFixed(2), hunger: +hh.toFixed(2), leanto: game.leantos.shelter(p.x, p.z), fire: game.fire.warm(p.x, p.z), cur: null };
        if (!chosenNow) { R().collapses++; ev('collapse', { reason: s.reason }); }
        s.upgrades = (() => { const l = game.leantos.home(p.x, p.z); return l ? Object.keys(l.up || {}).filter(k => l.up[k] === 1) : []; })();
        M.sleeps.push(s); R().sleeps++; wokeCheck = s; M.lastSleepStart = clock.total; botSleep = false; return r;
      });
    }
    let wokeCheck = null, wasAsleep = game.sleep.asleep;

    // ---------- path finding on a grid of 1.5 m cells, with the game's own movement rules (src/game/path, moved there from this file in 0.28) ----------
    const pth = L.createPath(world), banned = pth.banned;
    const isStand = (ix, iz) => pth.isStand(ix, iz), nearestCell = (x, z, rings = 4) => pth.nearestCell(x, z, rings);
    const findPath = (from, to, maxExp = 90000, retry = true) => pth.find(from, to, maxExp, retry);
    const pathCost = (x, z) => { const r = findPath(p, { x, z }); return r ? r.cost : Infinity; };

    // ---------- looking at the island (a player sees it; the bot reads the lists) ----------
    const tileAt = new Map(world.tiles.map(t => [t.tx * 100 + t.tz, t]));
    const tilesNear = (x, z, r) => {
      const out = [], tx0 = Math.floor((x - r + HALF) / 40), tx1 = Math.floor((x + r + HALF) / 40), tz0 = Math.floor((z - r + HALF) / 40), tz1 = Math.floor((z + r + HALF) / 40);
      for (let tx = tx0; tx <= tx1; tx++) for (let tz = tz0; tz <= tz1; tz++) { const t = tileAt.get(tx * 100 + tz); if (t) out.push(t); }
      return out;
    };
    const bad = new Map();   // kind:id -> game seconds until which it is skipped
    const isBad = (kind, o) => (bad.get(kind + ':' + o.id) || 0) > gt();
    const markBad = (kind, o, secs = 400) => { bad.set(kind + ':' + o.id, gt() + secs); };
    const SRC = {
      coco: t => game.fibre.groundCocos(t),
      berry: t => game.berries.bearingIn(t),
      banana: t => game.bananas.bearingIn(t),
      drift: t => W.beachLogs(t).filter(l => L.dryness(l, clock.total) >= 0.95 && L.logTop(l) > game.sea + 0.02),
      branch: t => game.branches.groundBranches(t),
      frond: t => game.fronds.groundFronds(t),
      stone: t => game.stones.groundStones(t),
    };
    const scan = (kind, x, z, r) => {
      const out = [];
      for (const t of tilesNear(x, z, r)) for (const o of SRC[kind](t)) { const d = Math.hypot(o.x - x, o.z - z); if (d <= r && !isBad(kind, o)) out.push({ o, d, x: o.x, z: o.z, id: o.id }); }
      return out.sort((a, b) => a.d - b.d);
    };
    // the nearest by path cost among the closest few
    const nearestBy = (kind, r = 60, k = 4) => {
      let best = null;
      for (let rr = r; rr <= 360 && !best; rr *= 2.5) {
        for (const c of scan(kind, p.x, p.z, rr).slice(0, k)) { const cost = pathCost(c.x, c.z); if (cost < Infinity && (!best || cost < best.cost)) best = { ...c, cost }; else if (cost === Infinity) markBad(kind, c.o, 300); }
      }
      return best;
    };
    // fresh water he can stand beside: sampled points of the rivers
    const waterPts = (() => {
      const out = []; for (const rv of world.rivers) for (let i = 0; i < rv.pts.length; i += 2) { const q = rv.pts[i]; if (L.freshWater(world, q.x, q.z, 0) && L.canStand(world, q.x, q.z, 0)) out.push({ x: q.x, z: q.z }); }
      return out;
    })();

    // ---------- base ----------
    const yaw = Number.isFinite(input.yaw) ? input.yaw : L.YAW;
    const FWD = { x: Math.sin(yaw), z: Math.cos(yaw) }, RGT = { x: Math.cos(yaw), z: -Math.sin(yaw) };
    const chooseBase = () => {
      const s0 = { x: p.x, z: p.z }; let best = null;
      const branchCount = (x, z) => tilesNear(x, z, 20).reduce((n, t) => n + game.branches.groundBranches(t).filter(b => Math.hypot(b.x - x, b.z - z) < 20).length, 0);
      const driftCount = (x, z) => tilesNear(x, z, 60).reduce((n, t) => n + W.beachLogs(t).filter(l => Math.hypot(l.x - x, l.z - z) < 60).length, 0);
      for (let dx = -150; dx <= 150; dx += 5) for (let dz = -150; dz <= 150; dz += 5) {
        const x = s0.x + dx, z = s0.z + dz, y = world.H(x, z);
        if (y < 0.9 || y > 6 || world.slope(x, z) > 0.25 || !world.dryOfRiver(x, z, 5)) continue;
        let ok = true; for (const [a, b] of [[3, 0], [-3, 0], [0, 3], [0, -3], [8, 0], [-8, 0], [0, 8], [0, -8]]) if (!L.canStand(world, x + a, z + b, 0) || world.slope(x + a, z + b) > 0.5) { ok = false; break; }
        if (!ok || !L.canStand(world, x, z, 0)) continue;
        const wd = Math.min(...waterPts.map(q => Math.hypot(q.x - x, q.z - z))), bc = branchCount(x, z);
        const dc = driftCount(x, z), score = 0.4 * Math.hypot(dx, dz) + 0.6 * wd + (bc < 14 ? 60 : 0) + (dc < 8 ? 80 : 0);
        if (!best || score < best.score) best = { x, z, y, score, wd, bc, dc, dist: Math.hypot(dx, dz) };
      }
      return best;
    };
    const B = M.base || (M.base = chooseBase() || { x: p.x, z: p.z, y: p.y, fallback: true });
    const FS0 = { x: B.x + RGT.x * 7, z: B.z + RGT.z * 7 };   // where the fire is made before there is a lean-to
    const home = () => game.leantos.list.find(l => l.progress >= 1) || null;
    const half = () => game.leantos.list.find(l => l.progress < 1) || null;
    const fireSpot = () => { const l = home(); return l ? L.ringCentre(l) : FS0; };
    const sleepSpot = () => { const l = home(); return l ? { x: l.x, z: l.z } : { x: FS0.x - RGT.x * 1.2, z: FS0.z - RGT.z * 1.2 }; };

    // ---------- moving ----------
    const busy = () => game.sleep.asleep || p.lie > 0 || p.work || p.stoop > 0;
    const idleInput = () => { input.target = null; input.run = false; };
    let rtPending = false;
    // goTo(x, z, { tap, stop, until, run }) -> true when he got there. tap: a click on a thing (he walks to beside it, the game decides where).
    function* goTo(x, z, o = {}) {
      if (cur) cur.at = 'goTo ' + x.toFixed(0) + ',' + z.toFixed(0);
      const tap = !!o.tap, stop = o.stop ?? 1.0; let plan = null, pi = 0, finalSet = false, replans = 0, chk = { x: p.x, z: p.z, t: gt() }, stuckN = 0, seen = gt();
      for (;;) {
        if (o.until && o.until()) { idleInput(); return true; }
        const d = Math.hypot(x - p.x, z - p.z);
        if (!tap && d <= stop) { idleInput(); return true; }
        if (!plan) {
          plan = findPath(p, { x, z }); pi = 0;
          if (!plan) { ev('nopath', { to: [+x.toFixed(1), +z.toFixed(1)], goal: cur && cur.name }); markBadTarget(x, z); idleInput(); return false; }
          if (d < 3.5 && plan.pts.length <= 3) plan.direct = true;
        }
        // advance along the cells
        { let bj = pi, bd = 1e9; for (let j = pi; j < Math.min(plan.pts.length, pi + 8); j++) { const dd = Math.hypot(plan.pts[j].x - p.x, plan.pts[j].z - p.z); if (dd < bd) { bd = dd; bj = j; } } pi = bj; if (bd > 5) { plan = null; finalSet = false; if (++replans > 6) { idleInput(); return false; } yield; continue; } }
        while (pi < plan.pts.length - 1 && Math.hypot(plan.pts[pi].x - p.x, plan.pts[pi].z - p.z) < 1.1) pi++;
        const last = pi >= plan.pts.length - 1 || plan.direct || Math.hypot(plan.pts.at(-1).x - p.x, plan.pts.at(-1).z - p.z) < 2.2;
        let remaining = d;
        if (last) {
          if (tap) { if (!finalSet) { input.target = { x, z, tap: true }; finalSet = true; } else if (!input.target) { return true; } }
          else input.target = { x, z };
        } else {
          const w = plan.pts[Math.min(pi + 1, plan.pts.length - 1)]; input.target = { x: w.x, z: w.z }; if (cur) cur.dbg = [pi, plan.pts.length, w.x, w.z];
          remaining = (plan.pts.length - pi) * C;
        }
        input.run = (o.run !== false) && remaining > 14 && !p.winded;
        if (gt() - seen > 0.5) chk = { x: p.x, z: p.z, t: gt() };   // he was busy (kneeling, sleeping): start counting again
        seen = gt();
        // stuck check every 4 game seconds
        if (gt() - chk.t >= 4) {
          const moved = Math.hypot(p.x - chk.x, p.z - chk.z);
          if (moved < 0.3 && !busy() && tap && d < 1.3) { idleInput(); return true; }   // beside a thing that lies against a trunk: close enough to reach it
          if (moved < 0.3 && !busy()) {
            stuckN++; R().stuck++;
            const t = L.terrainAt(world, p.x, p.z, game.sea);
            const e = { day: clock.day, time: +clock.time.toFixed(3), x: +p.x.toFixed(1), z: +p.z.toFixed(1), y: +p.y.toFixed(2), goal: cur && cur.name, target: [+x.toFixed(1), +z.toFixed(1)], dist: +d.toFixed(1), n: stuckN, slope: +t.s.toFixed(2), river: t.inRiver, depth: +t.depth.toFixed(2), sea: +game.sea.toFixed(2), climb: +t.climb.toFixed(2), load: W.load() };
            M.stucks.push(e); if (M.stucks.length <= 3) shot('stuck-' + M.stucks.length, 'stuck at ' + e.x + ',' + e.z);
            // ban the cell ahead and plan again
            const ahead = plan.pts[Math.min(pi + 1, plan.pts.length - 1)]; if (ahead) pth.ban(ahead.x, ahead.z);
            if (banned.size > 40) banned.clear();
            // steer by hand for a moment, like a player on a steep scramble: the free direction closest to the goal
            for (let i = 0; i < 20; i++) {
              const gx = x - p.x, gz = z - p.z, gl = Math.hypot(gx, gz) || 1; let bu = null, bs = -2;
              for (let a = 0; a < 24; a++) { const ang = a * Math.PI / 12, ux = Math.sin(ang), uz = Math.cos(ang); const f1 = L.stepFactor(world, { x: p.x, z: p.z, y: p.y }, p.x + ux * 0.3, p.z + uz * 0.3, game.sea), f2 = L.stepFactor(world, { x: p.x, z: p.z, y: p.y }, p.x + ux * 1.2, p.z + uz * 1.2, game.sea); if (f1 > 0 && f2 > 0) { const sc = (ux * gx + uz * gz) / gl; if (sc > bs) { bs = sc; bu = { ux, uz }; } } }
              input.target = bu ? { x: p.x + bu.ux * 2.5, z: p.z + bu.uz * 2.5 } : null; yield;
            }
            chk = { x: p.x, z: p.z, t: gt() };
            plan = null; finalSet = false; if (stuckN >= 3 || ++replans > 4) { idleInput(); return false; }
          }
          chk = { x: p.x, z: p.z, t: gt() };
        }
        yield;
      }
    }
    const markBadTarget = () => {};
    // wait for the walk to a thing / the pending act of F to finish (bounded)
    function* waitActs(maxS = 25) { const t0 = gt(); while (input.target && gt() - t0 < maxS) yield; }
    function* waitHoldAct(maxS = 25) { const t0 = gt(); yield; while (input.target && input.target.act && gt() - t0 < maxS) yield; yield; }

    // ---------- the buttons ----------
    const press = () => { input.actionStart('bot'); input.actionEnd('bot'); };
    const option = kinds => { const o = game.action().options, i = o.findIndex(x => kinds.includes(x.kind)); return i < 0 ? null : { i, kind: o[i].kind }; };   // an icon of the arc
    const choose = kinds => { const f = option(kinds); if (!f) return null; input.choose(f.i); return f.kind; };   // a click on it
    const arcKinds = () => game.action().options.map(o => o.kind).join();
    function* act(kinds) {   // a short press of the action button if it would do one of kinds; returns the kind or null
      const a = game.action().tap; if (!a || (kinds && !kinds.includes(a.kind))) return null;
      lastKind0 = a.kind; press(); yield; return a.kind;
    }
    function* useRow(kind) { lastKind0 = 'use:' + kind; const ok = game.use(kind, input); yield; return ok; }

    // ---------- counting piles ----------
    const pilesNear = (kind, x, z, r) => W.piles.filter(q => q.kind === kind && Math.hypot(q.x - x, q.z - z) <= r);
    const countNear = (kind, x, z, r, dryOnly) => pilesNear(kind, x, z, r).reduce((n, q) => n + q.logs.filter(l => !dryOnly || L.dryness(l, clock.total) >= 0.9).length, 0);
    const carriedKind = () => W.carried.length ? (W.carried[0].branch ? 'branch' : W.carried[0].frond ? 'frond' : 'drift') : (W.stones.length ? 'stone' : null);

    // ---------- goals ----------
    let cur = null;
    const urgentThirst = () => game.thirst.days > 0.9;
    const wantsFood = () => game.hunger.days >= 1.3;

    const badWater = [];
    function* drinkGoal() {
      if (game.shells.full() > 0 && game.thirst.days > 0.3 && !game.fire.torch) { const ok = yield* useRow('water'); if (ok) { while (busy()) yield; return; } }
      for (let tries = 0; tries < 4; tries++) {
        // water spots at least 1.6 m from any pile (beside a pile the button picks the pile up instead of drinking)
        const free = q => !W.piles.some(pl => Math.hypot(pl.x - q.x, pl.z - q.z) < 1.6) && !badWater.some(w => Math.hypot(w.x - q.x, w.z - q.z) < 2);
        let cand = waterPts.filter(free).map(q => ({ ...q, d: Math.hypot(q.x - p.x, q.z - p.z) })).sort((a, b) => a.d - b.d).slice(0, 4);
        if (!cand.length) { badWater.length = 0; cand = waterPts.map(q => ({ ...q, d: Math.hypot(q.x - p.x, q.z - p.z) })).sort((a, b) => a.d - b.d).slice(0, 4); }
        let best = null; for (const c of cand) { const cost = pathCost(c.x, c.z); if (cost < Infinity && (!best || cost < best.cost)) best = { ...c, cost }; }
        if (!best) { ev('no-water-path'); return; }
        const near = () => !!L.findWater(world, p.x, p.z, 0.7, game.sea) && free(p);
        const ok = yield* goTo(best.x, best.z, { stop: 0.3, until: near });
        let presses = 0, did = 0;
        while (presses++ < 6 && (game.thirst.days > 0.08 || game.shells.empty() > 0)) {
          let k = yield* act(['drink', 'fill']);
          if (!k) { const a = game.action().tap; if (a && (a.kind === 'husk' || a.kind === 'pickup') && presses < 5) { yield* act([a.kind]); while (busy()) yield; continue; } break; }
          did++; while (busy()) yield;
        }
        if (did) return;
        ev('drink-not-offered', { ok, tap: (game.action().tap || {}).kind }); badWater.push({ x: best.x, z: best.z }, { x: p.x, z: p.z });
      }
    }

    function* eatGoal() {
      // carried food first
      if (game.berries.carried.length && game.hunger.days > 0.5) { if (yield* useRow('berries')) return; }
      if (game.bananas.carried.length && game.hunger.days > 0.5) { if (yield* useRow('banana')) return; }
      if (game.shells.nuts > 0) { if (yield* useRow('nut')) return; }
      if (game.crabs.carried.length && game.fire.fires.some(f => game.fire.strength(f) > 0)) { /* roast when passing a fire: handled in nightGoal */ }
      // search
      const cs = [];
      const c = nearestBy('coco', 140), b = nearestBy('berry', 140), bn = nearestBy('banana', 120, 2);
      if (c) cs.push({ kind: 'coco', t: c, w: c.cost }); if (b) cs.push({ kind: 'berry', t: b, w: b.cost * 3 }); if (bn) cs.push({ kind: 'banana', t: bn, w: bn.cost * 0.8 });
      if (!cs.length) { ev('no-food-found'); return; }
      cs.sort((a, b) => a.w - b.w); const pick = cs[0];
      if (!search) search = { t0: gt(), from: [+p.x.toFixed(0), +p.z.toFixed(0)], h: +game.hunger.days.toFixed(2), kind: pick.kind, cost: +pick.t.cost.toFixed(0) };
      const t = pick.t, want = pick.kind === 'coco' ? ['husk'] : pick.kind === 'berry' ? ['berries'] : ['bananas'];
      const near = () => { const a = game.action().tap; return !!a && want.includes(a.kind) && !!a.thing && Math.hypot((a.thing.x ?? t.x) - t.x, (a.thing.z ?? t.z) - t.z) < 3; };
      const ok = yield* goTo(t.x, t.z, { tap: pick.kind === 'coco', stop: 0.4, until: near });
      let k = yield* act(want);
      if (!k) { const ok2 = yield* goTo(t.x, t.z, { stop: 0.2, run: false }); k = yield* act(want); }
      if (!k) { markBad(pick.kind, t.o, 600); ev('food-not-offered', { kind: pick.kind, ok, at: [+t.x.toFixed(1), +t.z.toFixed(1)], action: (game.action().tap || {}).kind }); }
    }

    function* huskGoal() {   // a nut for fibre (and to carry)
      const c = nearestBy('coco', 140); if (!c) return;
      const near = () => { const a = game.action().tap; return !!a && a.kind === 'husk' && !a.carried; };
      yield* goTo(c.x, c.z, { tap: true, stop: 0.4, until: near });
      let k = yield* act(['husk']);
      if (!k) { yield* goTo(c.x, c.z, { stop: 0.2, run: false }); k = yield* act(['husk']); }
      if (!k) markBad('coco', c.o, 600);
    }

    // gather up to the carrying limit of one resource, return it to where the pile goes (dest: fn -> {x,z,pre?})
    function* gatherGoal(kind, dest, want) {
      const cap = kind === 'stone' ? 2 : 3; let got = 0;
      const ck = carriedKind(); if (ck && ck !== kind) { const k0 = yield* act(['lay']); while (busy()) yield; }
      else if (ck === kind) got = kind === 'stone' ? W.stones.length : W.carried.length;
      while (got < Math.min(cap, want)) {
        const t = nearestBy(kind, 45, 4); if (!t) break;
        const near = () => { const a = game.action().tap; return !!a && a.kind === 'pickup'; };
        const before = W.carried.length + W.stones.length;
        yield* goTo(t.x, t.z, { tap: true, stop: 0.4, until: () => { const a = game.action().tap; return !!a && a.kind === 'pickup' && !!a.thing && a.thing.kind === 'log' && Math.hypot(a.thing.x - t.x, a.thing.z - t.z) < 1.5; } });
        let k = yield* act(['pickup']);
        if (!k) { yield* goTo(t.x, t.z, { stop: 0.2, run: false }); k = yield* act(['pickup']); }
        while (busy()) yield;
        yield;
        if (W.carried.length + W.stones.length > before) { got++; inc(R(), kind === 'drift' ? 'wood' : kind === 'branch' ? 'branches' : kind === 'frond' ? 'fronds' : 'stones'); } else markBad(kind, t.o, 600);
      }
      if (!W.carried.length && !W.stones.length) return;
      const d = dest(); if (!d) return;
      if (d.pre) yield* goTo(d.pre.x, d.pre.z, { stop: 0.5 });
      const ok = yield* goTo(d.x, d.z, { stop: 0.35, run: false });
      let n = 0;
      while ((W.carried.length || W.stones.length) && n++ < 3) { const k = yield* act(['lay']); if (!k) break; while (busy()) yield; }
      yield;
    }

    const driftPilePos = () => { const q = pilesNear('driftwood', B.x, B.z, 3.5)[0]; return q ? { x: q.x, z: q.z } : { x: B.x, z: B.z }; };
    const approachFrom = (anchor, dist) => {   // a stand point `dist` from the anchor on the side he comes from, and one beyond it to walk in from
      const dx = p.x - anchor.x, dz = p.z - anchor.z, l = Math.hypot(dx, dz) || 1, u = { x: dx / l, z: dz / l };
      return { x: anchor.x + u.x * dist, z: anchor.z + u.z * dist, pre: { x: anchor.x + u.x * (dist + 1.2), z: anchor.z + u.z * (dist + 1.2) } };
    };
    const destLeanD = () => driftPilePos();
    const destLeanB = () => { const q = pilesNear('branch', B.x, B.z, 4)[0]; if (q) return { x: q.x, z: q.z }; const a = pilesNear('driftwood', B.x, B.z, 3.5)[0]; return a ? approachFrom(a, 1.5) : { x: B.x + 1.2, z: B.z }; };
    const destFire = () => fireSpot();
    const destHome = which => () => {
      const l = home(); if (!l) return null;
      const ang = { frond: Math.PI / 2, stone: -Math.PI / 2, branch: Math.PI }[which], h = l.heading + ang;
      const q = pilesNear(which, l.x, l.z, 3)[0]; if (q) return { x: q.x, z: q.z };
      return { x: l.x + Math.sin(h) * 2.0, z: l.z + Math.cos(h) * 2.0 };
    };

    function* buildLeanto() {
      const l0 = half(); const dp = pilesNear('driftwood', B.x, B.z, 4)[0] || null;
      if (!l0) {
        const dpile = pilesNear('driftwood', B.x, B.z, 4).find(q => q.logs.length >= 6), bpile = pilesNear('branch', B.x, B.z, 4).find(q => q.logs.length >= 6);
        if (!dpile || !bpile) return;
        yield* goTo(dpile.x + (bpile.x - dpile.x) * 0.5, dpile.z + (bpile.z - dpile.z) * 0.5, { stop: 0.5, run: false });
      } else yield* goTo(l0.x, l0.z + 0.8, { stop: 0.5, run: false });
      for (let i = 0; i < 4; i++) {
        if (!option(['build'])) { yield; if (i) break; continue; }
        choose(['build']); yield* waitHoldAct(); while (busy()) yield; yield;
        if (home()) break;
      }
      if (!home()) ev('build-failed', { piles: W.piles.map(q => q.kind + ':' + q.logs.length + '@' + q.x.toFixed(1) + ',' + q.z.toFixed(1)).join(' '), arc: arcKinds(), half: !!half() });
      else shot('leanto-built', 'lean-to finished');
    }

    function* upgradeGoal() {
      const l = home(); if (!l) return;
      yield* goTo(l.x + Math.sin(l.heading) * 1.4, l.z + Math.cos(l.heading) * 1.4, { stop: 0.5, run: false });
      for (let i = 0; i < 6; i++) {
        if (!option(['upgrade'])) { if (i) break; yield; continue; }
        choose(['upgrade']); yield* waitHoldAct(60); while (busy()) yield; yield;
      }
    }

    function* lightFire() {
      const fs = fireSpot();
      if (game.fire.fires.some(f => Math.hypot(f.x - fs.x, f.z - fs.z) < 3) ) return;
      const pile = pilesNear('driftwood', fs.x, fs.z, 1.6).sort((a, b) => b.logs.length - a.logs.length)[0];
      if (!pile || pile.logs.length < L.FIRE_MIN || !game.fibre.carried) return;
      const mean = pile.logs.reduce((s, l) => s + L.dryness(l, clock.total), 0) / pile.logs.length;
      if (mean < 0.55) { ev('fire-skipped-wet', { mean: +mean.toFixed(2) }); return; }
      for (let k = 0; k < 3 && game.fibre.carried && !game.fire.fires.some(f => Math.hypot(f.x - fs.x, f.z - fs.z) < 3); k++) {
        // stand on the side away from the lean-to, so the arc offers to light rather than to build an upgrade
        const l = home(), sx = pile.x + (l ? FWD.x * 0.9 : 0.9), sz = pile.z + (l ? FWD.z * 0.9 : 0);
        yield* goTo(sx, sz, { stop: 0.5, run: false });
        const a = game.action();
        if (!option(['light'])) { ev('light-not-offered', { arc: arcKinds(), tap: (a.tap || {}).kind, piles: W.piles.map(q => q.kind[0] + q.logs.length).join() }); noLightUntil = gt() + 400; return; }
        choose(['light']); yield* waitHoldAct(30); while (busy()) yield; yield;
        if (game.fire.fires.length && !pilesNear('driftwood', fs.x, fs.z, 1.6).length) { shot('night-fire', 'fire lit'); break; }
      }
    }

    function* feedFire() {   // lay carried dry wood on the fire, until it is full
      const f = game.fire.fires.find(q => !q.dead); if (!f) return;
      yield* goTo(f.x + 0.8, f.z + 0.4, { stop: 0.7, run: false });
      for (let i = 0; i < 4; i++) { const k = yield* act(['feed']); if (!k) break; while (busy()) yield; }
    }

    function* sleepGoal() {
      const s = sleepSpot();
      yield* goTo(s.x, s.z, { stop: 0.5, run: false });
      for (let i = 0; i < 3; i++) {
        if (!game.sleep.canLie()) { ev('cannot-lie', { awake: +game.sleep.awake.toFixed(2) }); return; }
        botSleep = true; choose(['sleep']); yield; yield;
        if (game.sleep.asleep || p.lie > 0) return;
        botSleep = false; const ang = i * 2.1 + 0.5; yield* goTo(s.x + Math.sin(ang) * (1 + i), s.z + Math.cos(ang) * (1 + i), { stop: 0.3, run: false });
      }
      botSleep = false; ev('sleep-refused', { arc: arcKinds() }); noSleepUntil = gt() + 300;
    }

    let noSleepUntil = 0;
    const nightWindow = () => clock.time >= 0.72 || clock.time < 0.1;
    const sleepWindow = () => clock.time >= 0.86 || clock.time < 0.1;
    function* nightGoal() {
      // 1. a fire for the night, if wood and fibre are ready
      yield* lightFire();
      // 2. sleep when it is time
      if ((sleepWindow() && game.sleep.canLie()) || game.sleep.awake > 1.7) yield* sleepGoal();

    }

    function* choreGoal() {
      const l = home(), t = clock.time, fs = fireSpot();
      const fireReady = () => game.fire.fires.some(f => Math.hypot(f.x - fs.x, f.z - fs.z) < 3 && f.fuel > 0.1);
      const firePile = () => Math.max(0, ...pilesNear('driftwood', fs.x, fs.z, 1.6).map(q => q.logs.length));
      // fibre for the fire
      if (game.fibre.carried < 2) return yield* huskGoal();
      // fire stock before the evening
      if (!fireReady() && firePile() < 6 && t > 0.45 && (l || t > 0.6)) return yield* gatherGoal('drift', destFire, 6 - firePile());
      if (!l) {
        const hasB = !!half();
        const d = countNear('driftwood', B.x, B.z, 4), b = countNear('branch', B.x, B.z, 4);
        if (!hasB && d < 6) return yield* gatherGoal('drift', destLeanD, 6 - d);
        if (!hasB && b < 6) return yield* gatherGoal('branch', destLeanB, 6 - b);
        if (!hasB) { if (!M.goals.build) M.goals.build = 0; M.goals.build++; return yield* buildLeanto(); }
        return yield* buildLeanto();
      }
      // upgrades
      const up = l.up || {}, done = k => up[k] === 1;
      const needFronds = (done('walls') ? 0 : 6) + (done('bed') ? 0 : 4), haveFronds = countNear('frond', l.x, l.z, 3);
      const needBr = done('bed') ? 0 : 4, haveBr = countNear('branch', l.x, l.z, 3);
      const needSt = done('ring') ? 0 : 8, haveSt = countNear('stone', l.x, l.z, 3);
      if (L.UPGRADES && l && option(['upgrade'])) return yield* upgradeGoal();
      if (haveFronds < needFronds) return yield* gatherGoal('frond', destHome('frond'), needFronds - haveFronds);
      if (haveBr < needBr) return yield* gatherGoal('branch', destHome('branch'), needBr - haveBr);
      if (haveSt < needSt) return yield* gatherGoal('stone', destHome('stone'), needSt - haveSt);
      if (!done('walls') || !done('bed') || !done('ring')) return yield* upgradeGoal();
      // everything built: keep a stock
      if (game.shells.nuts < 2 && game.hunger.days < 1.0 && game.shells.nuts + 0 < 2) return yield* huskGoal();
      if (game.shells.empty() > 0 && game.thirst.days < 0.9) return yield* drinkGoal();
      if (!fireReady() && firePile() < 6) return yield* gatherGoal('drift', destFire, 6 - firePile());
      const t0 = gt(); const s = sleepSpot(); yield* goTo(s.x, s.z + 1.5, { stop: 1.5, run: false }); while (gt() - t0 < 30) yield;
    }

    const fireLit = () => { const fs = fireSpot(); return game.fire.fires.some(f => Math.hypot(f.x - fs.x, f.z - fs.z) < 3 && f.fuel > 0.1); };
    const firePileReady = () => { const fs = fireSpot(); return Math.max(0, ...pilesNear('driftwood', fs.x, fs.z, 1.6).map(q => q.logs.length)) >= L.FIRE_MIN && game.fibre.carried > 0 && gt() > noLightUntil; };
    let noLightUntil = 0;
    function pick() {
      const t = clock.time;
      if (urgentThirst()) return { name: 'drink', gen: drinkGoal, limit: 220, hi: true };
      if (wantsFood()) return { name: 'eat', gen: eatGoal, limit: 300, hi: true };
      if (game.sleep.awake > 1.75 || (sleepWindow() && game.sleep.canLie() && gt() > noSleepUntil)) return { name: 'night', gen: nightGoal, limit: 500 };
      if (nightWindow() && !fireLit() && firePileReady()) return { name: 'night', gen: nightGoal, limit: 300 };
      if (game.thirst.days > 0.45 && game.shells.empty() > 0 && waterPts.length && Math.min(...waterPts.map(q => Math.hypot(q.x - p.x, q.z - p.z))) < 40) return { name: 'drink', gen: drinkGoal, limit: 220 };
      return { name: 'chore', gen: choreGoal, limit: 420 };
    }
    const startGoal = g => {
      cur = { ...g, t0: gt(), it: g.gen() }; inc(M.goals, g.name);
      if (g.name === 'eat' && !search && !game.berries.carried.length && !game.bananas.carried.length && !game.shells.nuts) { /* search starts inside eatGoal */ }
    };
    const endGoal = why => { if (banned.size > 3000) banned.clear(); if (why) { R().goalsAbandoned++; ev('goal-abandoned', { goal: cur.name, why }); } try { cur.it.return(); } catch (e) { } cur = null; idleInput(); };

    // ---------- sensing: metrics every tick ----------
    let prev = { x: p.x, z: p.z, total: clock.total, winded: false, rain: false, fires: new Map(), hissed: game.fire.hissed };
    const sense = () => {
      const r = R(), dtg = (clock.total - prev.total) * DAYS;
      // NaN checks
      for (const [k, v] of [['x', p.x], ['y', p.y], ['z', p.z], ['thirst', game.thirst.days], ['hunger', game.hunger.days], ['awake', game.sleep.awake], ['time', clock.time], ['rest', game.sleep.rest()], ['breath', game.breath.level]]) {
        if (!Number.isFinite(v)) { if (!M.errors.some(e => e.k === k)) M.errors.push({ k, v: String(v), day: clock.day, time: clock.time }); }
      }
      if (dtg > 0 && dtg < 5) {
        const dd = Math.hypot(p.x - prev.x, p.z - prev.z); if (dd < 2) { r.dist += dd; if (p.running) r.runSecs += dtg; else if (dd > 0.001) r.walkSecs += dtg; } else if (dd >= 2) ev('jump', { d: +dd.toFixed(1) });
        if (game.thirst.days >= 1) r.tThirsty += dtg; if (game.thirst.days >= 1.5) r.tVery += dtg;
        if (game.hunger.days >= 2) r.tHungry += dtg; if (game.hunger.days >= 4) r.tStarving += dtg;
      }
      if (game.sleep.asleep && dtg > 0) r.tAsleep += dtg;
      r.maxHunger = Math.max(r.maxHunger, game.hunger.days); r.maxThirst = Math.max(r.maxThirst, game.thirst.days); r.minRest = Math.min(r.minRest, game.sleep.rest());
      if (p.winded && !prev.winded) r.winded++;
      prev.winded = !!p.winded; prev.x = p.x; prev.z = p.z; prev.total = clock.total;
      // sleep ended
      if (wasAsleep && !game.sleep.asleep && wokeCheck) { wokeCheck.t1 = +clock.time.toFixed(3); wokeCheck.hours = +((clock.total - wokeCheck.totalStart) * 24).toFixed(1); wokeCheck.restAfter = +game.sleep.rest().toFixed(2); wokeCheck.fireAfter = game.fire.warm(p.x, p.z); wokeCheck = null; }
      wasAsleep = game.sleep.asleep;
      // rain
      const rain = game.weather.raining(clock.total);
      if (rain && !prev.rain) { r.showers++; ev('rain-start'); shot('rain', 'rain begins'); }
      prev.rain = rain;
      // fires lost
      const now = new Map(game.fire.fires.map(f => [f.id, f]));
      for (const [id, f] of prev.fires) if (!now.has(id)) { const rainLost = game.fire.hissed > prev.hissed; r.firesLost++; if (rainLost) r.firesLostRain++; ev('fire-gone', { rain: rainLost, fuelLeft: +(f.fuel || 0).toFixed(3), embers: +(f.embers || 0).toFixed(3) }); }
      prev.fires = new Map([...now].map(([id, f]) => [id, { fuel: f.fuel, embers: f.embers }])); prev.hissed = game.fire.hissed;
      // night picture with a fire, once
      if (now.size && clock.time > 0.9 && !M.shots.some(s => s.name === 'night-base')) { const f = game.fire.fires[0]; if (Math.hypot(f.x - p.x, f.z - p.z) < 6) shot('night-base', 'night at the base with a fire'); }
      if (clock.time > 0.45 && clock.time < 0.55 && home() && !M.shots.some(s => s.name === 'leanto-day') && Math.hypot(home().x - p.x, home().z - p.z) < 6) shot('leanto-day', 'lean-to by day');
    };

    // ---------- the tick ----------
    let sinceCheck = 0;
    function tick() {
      sense();
      if (M.nextRt <= gt() && !busy() && !game.sleep.asleep) { rtPending = true; M.rtKind = 'awake'; }
      else if (!M.midSleepDone && game.sleep.asleep && game.sleep.lie >= 1 && (clock.total - (M.lastSleepStart || 0)) > 0.1) { rtPending = true; M.rtKind = 'asleep'; M.midSleepDone = true; }
      if (mind) { mind.step(TICK); game.update(mind.input, TICK); return; }   // --mind: Dave looks after himself, the bot does nothing
      if (busy()) { game.update(input, TICK); return; }
      if (!cur) startGoal(pick());
      sinceCheck += TICK;
      if (cur && sinceCheck >= 1.5) {   // let hunger or thirst interrupt a chore
        sinceCheck = 0;
        if (!cur.hi && (urgentThirst() || (wantsFood() && game.hunger.days > 1.6)) && cur.name !== 'drink' && cur.name !== 'eat') endGoal('preempted by need');
        else if (gt() - cur.t0 > cur.limit) endGoal('timeout');
      }
      if (cur) {
        let r; try { r = cur.it.next(); } catch (e) { botErr(cur.name, e); r = { done: true }; M.errorsInGoal = (M.errorsInGoal || 0) + 1; }
        if (r.done) { if (cur.name === 'eat' && search && !wantsFood()) search = null; endGoal(); }
      }
      game.update(input, TICK);
    }

    const bot = {
      metrics: M, findPath, nearestCell, isStand, banned,
      get rtPending() { return rtPending; },
      takeShot() { const s = wantShot; wantShot = null; return s; },
      markRt(day) { const k = M.rtKind; rtPending = false; if (k !== 'asleep') M.nextRt = (day + 1.3) * DAYS; },   // next one on a later day
      run(seconds) {
        const end = gt() + seconds; let n = 0;
        while (gt() < end) {
          tick(); n++;
          if (wantShot) return 'shot';
          if (rtPending) return 'roundtrip';
        }
        if (mind) M.mind = { goals: mind.stats.goals, stuck: mind.stats.stuck, nopath: mind.stats.nopath, idleSecs: +mind.stats.idleSecs.toFixed(0), lightRefused: mind.stats.lightRefused, gazes: mind.stats.gazes };
        return 'time';
      },
      settle() { idleInput(); cur = null; if (!game.sleep.asleep) for (let i = 0; i < 20; i++) { game.update(mind ? mind.input : input, TICK); } },
      summary() {
        return { at: cur && cur.at, dbg: cur && cur.dbg, day: clock.day, time: +clock.time.toFixed(2), x: +p.x.toFixed(0), z: +p.z.toFixed(0), thirst: +game.thirst.days.toFixed(2), hunger: +game.hunger.days.toFixed(2), rest: +game.sleep.rest().toFixed(2), goal: cur && cur.name, carried: W.carried.length, nuts: game.shells.nuts, fibre: game.fibre.carried, fires: game.fire.fires.length, leantos: game.leantos.list.map(l => +l.progress.toFixed(2)), stucks: M.stucks.length, botErrors: M.botErrors.length, asleep: game.sleep.asleep };
      },
    };
    return bot;
  };
})();
