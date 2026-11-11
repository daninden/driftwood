// Playtest bot, the part that runs inside the page (injected by scripts/playtest.js after the game is ready and
// after scripts/playtest-lib.js, which provides window.DWLib: createMind). Since 0.32.1 "Watcher" it is a watcher only: Dave's own
// habit (src/game/mind) plays, the bot steps the game, logs metrics, events and errors, and asks for screenshots and save/load
// round trips. It plays nothing itself. Tooling only; no game code is changed.
// A few game methods are wrapped in the page to log events exactly (hunger.eat, thirst.drink, ...); they still call the original.
//
// window.makeBot(opts, imported) -> bot
//   bot.run(seconds) -> reason ('time' | 'shot' | 'roundtrip')   steps that many game seconds of ticks (1/60 s each)
//   bot.metrics   the log (plain JSON; pass it back as `imported` after a page reload)
//   bot.summary() -> small status object for the console
(function () {
  const TICK = 1 / 60, DAYS = 1200;
  window.makeBot = function makeBot(opts, imported) {
    const D = window.__driftwood, { world, game } = D, L = window.DWLib;
    const p = game.player, clock = game.clock;
    const mind = L.createMind(world, game);   // Dave's own habit, the real one from the built page's source
    mind.engage();
    const M = imported || { seed: world.seed, days: {}, events: [], errors: [], sleeps: [], roundtrips: [], shots: [], nextRt: 0 };
    const gt = () => clock.total * DAYS;
    const dayRec = d => M.days[d] || (M.days[d] = { day: d, maxHunger: 0, maxThirst: 0, minRest: 1, eaten: {}, eatenDays: 0, drinks: 0, sips: 0, fills: 0, tThirsty: 0, tVery: 0, tHungry: 0, tStarving: 0, tAsleep: 0, collapses: 0, sleeps: 0, fires: 0, fireFails: 0, firesLost: 0, firesLostRain: 0, leantos: 0, upgrades: 0, showers: 0, dist: 0, runSecs: 0, walkSecs: 0, winded: 0, });
    const R = () => dayRec(clock.day);
    const inc = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };
    const ev = (type, data) => { const e = { type, day: clock.day, time: +clock.time.toFixed(3), x: +p.x.toFixed(1), z: +p.z.toFixed(1), ...data }; M.events.push(e); return e; };
    const shot = (name, why) => { if (M.shots.some(s => s.name === name)) return; M.shots.push({ name, why, day: clock.day, time: +clock.time.toFixed(3), x: +p.x.toFixed(1), z: +p.z.toFixed(1) }); wantShot = name; };
    if (!imported) M.nextRt = gt() + 300;
    let wantShot = null, rtPending = false;

    // ---------- wrapped game methods: exact event log ----------
    if (!game.__wrapped) {
      game.__wrapped = true;
      const wrap = (obj, name, fn) => { const o = obj[name].bind(obj); obj[name] = (...a) => fn(o, ...a); };
      wrap(game.hunger, 'eat', (o, food) => {
        const lastKind = mind.lastKind(), before = game.hunger.days, kind = ({ husk: 'coconut', berries: 'berries', eatBerries: 'berries', bananas: 'banana', eatBanana: 'banana', roast: 'crab', 'use:berries': 'berries', 'use:banana': 'banana', 'use:nut': 'coconut', 'use:crab': 'crab' })[lastKind] || ('?' + lastKind);
        const r = o(food); inc(R().eaten, kind); R().eatenDays++;
        ev('eat', { kind, food: +(food === undefined ? 0.5 : food).toFixed(2), before: +before.toFixed(2), after: +game.hunger.days.toFixed(2) });
        return r;
      });
      wrap(game.thirst, 'drink', (o) => { const b = game.thirst.days; const r = o(); R().drinks++; ev('drink', { before: +b.toFixed(2) }); return r; });
      wrap(game.thirst, 'sip', (o, d) => { const r = o(d); R().sips++; ev('sip', { days: d }); return r; });
      wrap(game.shells, 'fill', (o) => { const r = o(); if (r) R().fills++; return r; });
      wrap(game.fire, 'attempt', (o, ...a) => { const n = game.fire.fires.length, r = o(...a); if (r) { R().fires++; ev('fire', { ok: true, attempts: game.fire.attempts, dry: +(a[3] || 0).toFixed(2) }); } else { R().fireFails++; ev('fire', { ok: false, attempts: game.fire.attempts, dry: +(a[3] || 0).toFixed(2) }); } return r; });
      wrap(game.leantos, 'start', (o, ...a) => { const r = o(...a); R().leantos++; ev('leanto-start'); return r; });
      wrap(game.leantos, 'upgraded', (o, l, what, pr) => { const was = l.up && l.up[what]; const r = o(l, what, pr); if (pr >= 1 && was !== 1) { R().upgrades++; ev('upgrade', { what }); shot('upgraded-leanto', 'upgrade ' + what + ' finished'); } return r; });
      wrap(game.sleep, 'start', (o, ...a) => {
        const t = game.thirst.days, hh = game.hunger.days, aw = game.sleep.awake, chosenNow = !!mind.chose();
        const r = o(...a); const s = { day: clock.day, t0: +clock.time.toFixed(3), x: +p.x.toFixed(1), z: +p.z.toFixed(1), chosen: chosenNow, reason: chosenNow ? 'chosen' : (t >= 1.49 ? 'thirst collapse' : aw >= 1.49 ? 'exhaustion' : 'other'), totalStart: clock.total, awake: +aw.toFixed(2), restBefore: +game.sleep.rest().toFixed(2), thirst: +t.toFixed(2), hunger: +hh.toFixed(2), leanto: game.leantos.shelter(p.x, p.z), fire: game.fire.warm(p.x, p.z), cur: null };
        if (!chosenNow) { R().collapses++; ev('collapse', { reason: s.reason }); }
        s.upgrades = (() => { const l = game.leantos.home(p.x, p.z); return l ? Object.keys(l.up || {}).filter(k => l.up[k] === 1) : []; })();
        M.sleeps.push(s); R().sleeps++; wokeCheck = s; M.lastSleepStart = clock.total; return r;
      });
    }
    let wokeCheck = null, wasAsleep = game.sleep.asleep;
    const home = () => game.leantos.list.find(l => l.progress >= 1) || null;
    const busy = () => game.sleep.asleep || p.lie > 0 || p.work || p.stoop > 0;

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
        if (game.thirst.days >= 0.5) r.tThirsty += dtg; if (game.thirst.days >= 1) r.tVery += dtg;
        if (game.hunger.days >= 0.5) r.tHungry += dtg; if (game.hunger.days >= 3) r.tStarving += dtg;
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
    function tick() {
      sense();
      if (M.nextRt <= gt() && !busy() && !game.sleep.asleep) { rtPending = true; M.rtKind = 'awake'; }
      else if (!M.midSleepDone && game.sleep.asleep && game.sleep.lie >= 1 && (clock.total - (M.lastSleepStart || 0)) > 0.1) { rtPending = true; M.rtKind = 'asleep'; M.midSleepDone = true; }
      mind.step(TICK); game.update(mind.input, TICK);   // Dave looks after himself
    }

    const bot = {
      metrics: M,
      takeShot() { const s = wantShot; wantShot = null; return s; },
      markRt(day) { const k = M.rtKind; rtPending = false; if (k !== 'asleep') M.nextRt = (day + 1.3) * DAYS; },   // next one on a later day
      run(seconds) {
        const end = gt() + seconds;
        while (gt() < end) {
          tick();
          if (wantShot) return 'shot';
          if (rtPending) return 'roundtrip';
        }
        M.mind = { goals: mind.stats.goals, stuck: mind.stats.stuck, nopath: mind.stats.nopath, idleSecs: +mind.stats.idleSecs.toFixed(0), lightRefused: mind.stats.lightRefused, gazes: mind.stats.gazes, explores: mind.stats.explores, exploreSecs: +mind.stats.exploreSecs.toFixed(0) };
        return 'time';
      },
      settle() { if (!game.sleep.asleep) for (let i = 0; i < 20; i++) game.update(mind.input, TICK); },
      summary() {
        return { day: clock.day, time: +clock.time.toFixed(2), x: +p.x.toFixed(0), z: +p.z.toFixed(0), thirst: +game.thirst.days.toFixed(2), hunger: +game.hunger.days.toFixed(2), rest: +game.sleep.rest().toFixed(2), goal: mind.goal && mind.goal.name, fires: game.fire.fires.length, leantos: game.leantos.list.map(l => +l.progress.toFixed(2)), stucks: mind.stats.stuck, asleep: game.sleep.asleep };
      },
    };
    return bot;
  };
})();
