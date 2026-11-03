// Wildlife (0.17): where the animals live (fixed per seed, derived from the
// world without changing it), crabs that flee, hide and return, more crabs out
// at low water, fish that dart when he wades, the flock that lands and flies
// up, birds by day only, nothing alive beyond 30 m, and the shapes of the
// animals. Pure logic is driven by hand (time, place, sea), no real clock.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { coloniesOfTile, fishOfTile, birdCell, CELL } from '../src/game/habitats.js';
import { createWildlife, ALIVE, SCARE, SAFE, HIDE, DART, BACK_TIME, FLUSH, FLOCK_FIRST } from '../src/game/wildlife.js';
import { RANGE } from '../src/game/tide.js';
import { crabGeometry, birdGeometries, flapAngle } from '../src/render/wildlife.js';

let w, spawn, colonies, groups, cells;
beforeAll(async () => {
  w = await generateWorld(1337); spawn = startSpot(w);
  colonies = w.tiles.flatMap(t => coloniesOfTile(w, t));
  groups = w.tiles.flatMap(t => fishOfTile(w, t));
  cells = []; for (let cz = 0; cz < 12; cz++) for (let cx = 0; cx < 12; cx++) { const c = birdCell(w, cx, cz); if (c) cells.push(c); }
}, 120000);

const ctx = (x, z, o = {}) => ({ x, z, time: 0.45, sea: 0, wading: false, asleep: false, ...o });
const run = (wl, seconds, c, dt = 0.1) => { for (let t = 0; t < seconds - 1e-9; t += dt) wl.update(dt, c); };
const dry = c => c.holes.every(h => h.y > 0.3);
const near = (list, c, r) => list.filter(e => Math.hypot(e.x - c.x, e.z - c.z) <= r);

describe('where the animals live', () => {
  it('is fixed per seed: the same places again from a second world of the same seed', async () => {
    const w2 = await generateWorld(1337), again = w2.tiles.flatMap(t => coloniesOfTile(w2, t));
    expect(again.length).toBe(colonies.length);
    expect(JSON.stringify(again)).toBe(JSON.stringify(colonies));
    expect(JSON.stringify(w2.tiles.flatMap(t => fishOfTile(w2, t)))).toBe(JSON.stringify(groups));
  }, 120000);
  it('has crab colonies on the beach, a few holes and crabs each, some on the wet strip', () => {
    expect(colonies.length).toBeGreaterThan(50);
    for (const c of colonies) {
      expect(c.holes.length).toBeGreaterThanOrEqual(2); expect(c.holes.length).toBeLessThanOrEqual(5);
      expect(c.crabs.length).toBeGreaterThanOrEqual(2); expect(c.crabs.length).toBeLessThanOrEqual(5);
      for (const h of c.holes) { expect(h.y).toBeGreaterThan(-0.4); expect(h.y).toBeLessThan(1.0); expect(h.wet).toBe(h.y < 0.05); }
    }
    expect(colonies.some(c => c.holes.some(h => h.wet))).toBe(true);
    expect(colonies.some(dry)).toBe(true);
    expect(new Set(colonies.flatMap(c => c.crabs.map(k => k.id))).size).toBe(colonies.reduce((a, c) => a + c.crabs.length, 0));   // every crab has its own id
  });
  it('has fish groups of 2 to 5 over water, in rivers and in lagoons', () => {
    expect(groups.some(g => g.kind === 'river')).toBe(true);
    expect(groups.some(g => g.kind === 'lagoon')).toBe(true);
    for (const g of groups) {
      expect(g.fish.length).toBeGreaterThanOrEqual(2); expect(g.fish.length).toBeLessThanOrEqual(5);
      for (const f of g.fish) {
        const x = g.x + (g.kind === 'river' ? Math.cos(g.dir) * f.ox - Math.sin(g.dir) * f.oz : f.ox), z = g.z + (g.kind === 'river' ? Math.sin(g.dir) * f.ox + Math.cos(g.dir) * f.oz : f.oz);
        if (g.kind === 'river') expect(g.lw - w.H(x, z)).toBeGreaterThanOrEqual(0.1); else { expect(w.Lat(x, z)).toBeLessThan(0); expect(w.H(x, z)).toBeLessThan(-0.2); }
      }
    }
  });
  it('has circling birds over stretches of the coast, with a way to the rocky shore', () => {
    expect(cells.length).toBeGreaterThan(5);
    for (const c of cells) { expect(c.n).toBeGreaterThanOrEqual(2); expect(c.n).toBeLessThanOrEqual(4); expect(Math.hypot(c.away.x, c.away.z)).toBeCloseTo(1, 5); expect(c.alt).toBeGreaterThanOrEqual(6); }
  });
  it('leaves the generated island alone (the world fixture test guards seed 1337; the world has no wildlife fields)', () => {
    expect(Object.keys(w)).not.toContain('wildlife'); expect(Object.keys(w.tiles[0])).not.toContain('crabs');
  });
});

describe('crabs', () => {
  const pick = () => { const col = colonies.filter(dry).sort((a, b) => Math.hypot(a.x - spawn.x, a.z - spawn.z) - Math.hypot(b.x - spawn.x, b.z - spawn.z))[0], crab = col.crabs.find(k => k.u < 0.4); return { col, crab, id: crab.id }; };
  const seen = (wl, id) => wl.crabs().find(c => c.id === id);
  it('are out on the sand, and run sideways now and then', () => {
    const { col, id } = pick(), wl = createWildlife(w), c = ctx(col.x + 12, col.z);
    wl.update(0.1, c); const first = seen(wl, id); expect(first).toBeTruthy(); expect(first.a).toBe(1);
    let moved = false, p0 = { x: first.x, z: first.z };
    for (let i = 0; i < 600 && !moved; i++) { wl.update(0.1, c); const s = seen(wl, id); if (s && Math.hypot(s.x - p0.x, s.z - p0.z) > 0.1) moved = true; }
    expect(moved).toBe(true);
    const s = seen(wl, id); expect(Math.hypot(s.x - col.holes[col.crabs.find(k => k.id === id).hole].x, s.z - col.holes[col.crabs.find(k => k.id === id).hole].z)).toBeLessThan(1.6);   // they stay near their hole
  });
  it('flee within 3 m to a hole, and come out again 10 to 20 s after he is more than 5 m away', () => {
    const { col, id } = pick(), wl = createWildlife(w), far = ctx(col.x + 12, col.z);
    wl.update(0.1, far); const c0 = seen(wl, id), at = { x: c0.x, z: c0.z };
    const scare = ctx(at.x + SCARE - 0.5, at.z);
    run(wl, 4, scare);
    expect(seen(wl, id)).toBeUndefined();                                    // gone into a hole
    const hole = col.holes.map(h => Math.hypot(h.x - at.x, h.z - at.z)); expect(Math.min(...hole)).toBeLessThan(2);
    run(wl, 40, ctx(at.x + SAFE - 1, at.z));                                 // 4 m away: not far enough, it stays hidden
    expect(seen(wl, id)).toBeUndefined();
    const away = ctx(at.x + SAFE + 3, at.z); let t = 0;
    while (!seen(wl, id) && t < 40) { wl.update(0.1, away); t += 0.1; }
    expect(t).toBeGreaterThanOrEqual(HIDE[0] - 0.2); expect(t).toBeLessThanOrEqual(HIDE[1] + 0.8);
  });
  it('do not flee from further than 3 m', () => {
    const { col, id } = pick(), wl = createWildlife(w); wl.update(0.1, ctx(col.x + 12, col.z));
    const c0 = seen(wl, id);
    run(wl, 3, ctx(c0.x + SCARE + 0.6, c0.z));
    expect(seen(wl, id)).toBeTruthy();
  });
  it('are more out at low water, and those on the wet strip only when the sea has gone down', () => {
    const best = colonies.reduce((b, c) => { const n = near(colonies, c, 25).length; return n > b.n ? { n, c } : b; }, { n: 0, c: null }).c;
    const count = sea => { const wl = createWildlife(w); wl.update(0.1, ctx(best.x, best.z, { sea })); return wl.crabs().length; };
    const high = count(0), low = count(-RANGE);
    expect(low).toBeGreaterThan(high);
    const wet = colonies.find(c => c.holes.every(h => h.wet) && c.crabs.length);
    const wl = createWildlife(w); wl.update(0.1, ctx(wet.x, wet.z, { sea: 0 }));
    expect(wl.crabs().filter(k => wet.crabs.some(q => q.id === k.id)).length).toBe(0);
    const wl2 = createWildlife(w); wl2.update(0.1, ctx(wet.x, wet.z, { sea: -RANGE }));
    expect(wl2.crabs().filter(k => wet.crabs.some(q => q.id === k.id)).length).toBeGreaterThan(0);
  });
  it('are there at night too', () => {
    const { col, id } = pick(), wl = createWildlife(w); wl.update(0.1, ctx(col.x + 12, col.z, { time: 0.02 }));
    expect(seen(wl, id)).toBeTruthy();
  });
});

describe('fish', () => {
  const group = () => groups.filter(g => g.kind === 'river').sort((a, b) => Math.hypot(a.x - spawn.x, a.z - spawn.z) - Math.hypot(b.x - spawn.x, b.z - spawn.z))[0];
  const mine = (wl, g) => wl.fish().filter(f => Math.floor(f.id / 8) === g.id);
  it('lie facing upstream in the shallow water and stay when he only walks by', () => {
    const g = group(), wl = createWildlife(w); run(wl, 1, ctx(g.x + 1.5, g.z));
    expect(mine(wl, g).length).toBeGreaterThanOrEqual(2);
    for (const f of mine(wl, g)) { expect(f.ang).toBeCloseTo(g.dir, 5); expect(f.y).toBeCloseTo(g.lw + 0.03, 5); }
    run(wl, 5, ctx(g.x + 1.5, g.z)); expect(mine(wl, g).length).toBeGreaterThanOrEqual(2);   // standing on the bank (not wading): they stay
  });
  it('dart off and fade when he wades within 2 m, and come back slowly', () => {
    const g = group(), wl = createWildlife(w); run(wl, 1, ctx(g.x, g.z + 6));
    const n = mine(wl, g).length; expect(n).toBeGreaterThanOrEqual(2);
    const wade = ctx(g.x, g.z + DART - 0.8, { wading: true }); wl.update(0.1, wade);
    run(wl, 0.3, wade); expect(mine(wl, g).every(f => f.a < 1)).toBe(true);   // fading
    run(wl, 1, wade); expect(mine(wl, g).length).toBe(0);                      // gone
    const away = ctx(g.x, g.z + 6, { wading: true }); let t = 0;
    while (!mine(wl, g).length && t < 40) { wl.update(0.1, away); t += 0.1; }
    expect(t).toBeGreaterThan(7); expect(t).toBeLessThan(17.5);
    const a0 = mine(wl, g)[0].a; expect(a0).toBeLessThan(0.1);                 // they come back slowly
    run(wl, BACK_TIME + 0.5, away); expect(mine(wl, g)[0].a).toBe(1);
  });
  it('do not dart for a wader who is further than 2 m', () => {
    const g = group(), wl = createWildlife(w); wl.update(0.1, ctx(g.x, g.z + 6));
    run(wl, 3, ctx(g.x, g.z + DART + 1.6, { wading: true })); expect(mine(wl, g).length).toBeGreaterThanOrEqual(2);
  });
  it('are not drawn over a sandbank that the low tide has laid dry (lagoons)', () => {
    const g = groups.find(k => k.kind === 'lagoon'), wl = createWildlife(w);
    run(wl, 1, ctx(g.x, g.z + 8, { sea: 0 })); const wet = mine(wl, g).length;
    const wl2 = createWildlife(w); run(wl2, 1, ctx(g.x, g.z + 8, { sea: -RANGE }));
    expect(mine(wl2, g).length).toBeLessThanOrEqual(wet);
  });
  it('one jumps just beyond the surf every half to one and a half minutes when the sea is in view, with a splash', () => {
    const wl = createWildlife(w), c = ctx(spawn.x, spawn.z), starts = []; let was = false, splash = false;
    for (let t = 0; t < 400; t += 0.1) {
      wl.update(0.1, c); const j = wl.jump();
      if (j && !was) starts.push(t); was = !!j;
      if (j && j.splashes.length) { splash = true; expect(j.y).toBeGreaterThanOrEqual(j.sea - 1e-9); expect(j.y).toBeLessThan(j.sea + 1); }
    }
    expect(splash).toBe(true); expect(starts.length).toBeGreaterThanOrEqual(3); expect(starts.length).toBeLessThanOrEqual(13);
    for (let i = 1; i < starts.length; i++) expect(starts[i] - starts[i - 1]).toBeGreaterThan(29);
  });
});

describe('birds', () => {
  it('circle high over the coast by day, none at night', () => {
    const c = cells[0], wl = createWildlife(w);
    wl.update(0.1, ctx(c.x, c.z, { time: 0.45 })); const day = wl.birds();
    expect(day.length).toBeGreaterThanOrEqual(2); for (const b of day) { expect(b.mode).toBe('air'); expect(b.y).toBeGreaterThan(4); }
    for (const t of [0.0, 0.1, 0.19, 0.8, 0.95]) { wl.update(0.1, ctx(c.x, c.z, { time: t })); expect(wl.birds().length).toBe(0); }
  });
  it('arrive at dawn and fly off to the rocky shore in the evening', () => {
    const c = cells[0], wl = createWildlife(w);
    wl.update(0.1, ctx(c.x, c.z, { time: 0.22 })); const dawn = wl.birds().length;
    wl.update(0.1, ctx(c.x, c.z, { time: 0.5 })); expect(wl.birds().length).toBeGreaterThan(dawn);   // still on their way in at 0.22
    wl.update(0.1, ctx(c.x, c.z, { time: 0.69 })); expect(wl.birds().length).toBeGreaterThanOrEqual(2);
    wl.update(0.1, ctx(c.x, c.z, { time: 0.75 })); expect(wl.birds().length).toBe(0);   // gone
  });
  it('have no shadow: the view never lets them cast one (render/wildlife castShadow stays false)', async () => {
    const src = (await import('node:fs')).readFileSync(new URL('../src/render/wildlife.js', import.meta.url), 'utf8');
    expect(src).toMatch(/im\.castShadow = false/); expect(src).not.toMatch(/castShadow = true/);
  });
});

describe('the flock', () => {
  const flockOf = wl => wl.birds().filter(b => b.id >= 4000000);   // the flock, not the birds circling high over the coast
  const landed = (o = {}) => { const wl = createWildlife(w), c = ctx(spawn.x, spawn.z, o); wl.update(0.1, c); expect(wl.callFlock()).toBe(true); for (let t = 0; t < 20 && wl.flock.phase === 'land'; t += 0.1) wl.update(0.1, c); return { wl, c }; };
  it('lands on the beach 10 to 20 m away, 5 to 8 birds, and pecks about', () => {
    const { wl, c } = landed(); expect(wl.flock.phase).toBe('ground');
    const list = flockOf(wl); expect(list.length).toBeGreaterThanOrEqual(5); expect(list.length).toBeLessThanOrEqual(8);
    for (const b of list) { expect(b.mode).toBe('ground'); const d = Math.hypot(b.x - c.x, b.z - c.z); expect(d).toBeGreaterThanOrEqual(9.9); expect(d).toBeLessThanOrEqual(20.1); expect(w.H(b.x, b.z)).toBeGreaterThan(0.05); }
    const pitches = new Set(); for (let i = 0; i < 400; i++) { wl.update(0.1, c); flockOf(wl).forEach(b => pitches.add(b.pitch < -0.3)); }
    expect(pitches.has(true)).toBe(true);   // some bird has its head down
  });
  it('stays while he keeps 4 m away, and flies up, circles and leaves when he comes within 4 m', () => {
    const { wl, c } = landed(), site = wl.flock.site;
    const ang = Math.atan2(site.z - c.z, site.x - c.x), mid = { x: site.x - Math.cos(ang) * (FLUSH + 2.4), z: site.z - Math.sin(ang) * (FLUSH + 2.4) };
    run(wl, 3, ctx(mid.x, mid.z)); expect(wl.flock.phase).toBe('ground');
    const close = ctx(site.x, site.z); wl.update(0.1, close);
    expect(wl.flock.phase).toBe('up');
    run(wl, 2, close); expect(flockOf(wl).every(b => b.mode === 'air' && b.y > w.H(b.x, b.z) + 0.5)).toBe(true);
    run(wl, 3, close); expect(wl.flock.phase).toBe('leave');
    run(wl, 30, close); expect(wl.flock).toBeNull();
  });
  it('comes by itself every few minutes of day play, not at night, and leaves in the evening', () => {
    const wl = createWildlife(w), c = ctx(spawn.x, spawn.z); let t = 0;
    while (!wl.flock && t < FLOCK_FIRST[1] + 30) { wl.update(0.25, c); t += 0.25; }
    expect(wl.flock).not.toBeNull(); expect(t).toBeGreaterThanOrEqual(FLOCK_FIRST[0] - 1); expect(t).toBeLessThanOrEqual(FLOCK_FIRST[1] + 1);
    for (let i = 0; i < 200 && wl.flock.phase === 'land'; i++) wl.update(0.1, c);
    expect(wl.flock.phase).toBe('ground');
    wl.update(0.1, ctx(spawn.x, spawn.z, { time: 0.72 })); expect(wl.flock.phase).toBe('up');   // evening
    run(wl, 40, ctx(spawn.x, spawn.z, { time: 0.72 })); expect(wl.flock).toBeNull();
    const night = createWildlife(w); run(night, 700, ctx(spawn.x, spawn.z, { time: 0.9 }), 0.25); expect(night.flock).toBeNull(); expect(night.birds().length).toBe(0);
  });
  it('does not come while he sleeps', () => {
    const wl = createWildlife(w); run(wl, 400, ctx(spawn.x, spawn.z, { asleep: true }), 0.25); expect(wl.flock).toBeNull();
  });
});

describe('nothing beyond 30 m is alive', () => {
  it('lists only what is within 30 m (crabs, fish, birds), and nothing out at sea', () => {
    const best = colonies.reduce((b, c) => { const n = near(colonies, c, 25).length; return n > b.n ? { n, c } : b; }, { n: 0, c: null }).c;
    const wl = createWildlife(w), c = ctx(best.x, best.z, { sea: -RANGE }); run(wl, 3, c);
    expect(wl.crabs().length).toBeGreaterThan(0);
    for (const k of wl.crabs()) expect(Math.hypot(k.x - c.x, k.z - c.z)).toBeLessThanOrEqual(ALIVE);
    for (const f of wl.fish()) expect(Math.hypot(f.x - c.x, f.z - c.z)).toBeLessThanOrEqual(ALIVE);
    for (const b of wl.birds()) expect(Math.hypot(b.x - c.x, b.z - c.z)).toBeLessThanOrEqual(ALIVE);
    const sea = createWildlife(w); run(sea, 5, ctx(-350, -350)); expect(sea.crabs().length + sea.fish().length + sea.birds().length).toBe(0);
  });
  it('a crab 31 m away is not there, and 29 m away it is', () => {
    const col = colonies.filter(dry)[3], crab = col.crabs.find(k => k.u < 0.4), wl = createWildlife(w), at = ctx(col.x + 12, col.z);
    wl.update(0.1, at); const k0 = wl.crabs().find(k => k.id === crab.id);
    wl.update(0.1, ctx(k0.x + 31, k0.z)); expect(wl.crabs().find(k => k.id === crab.id)).toBeUndefined();
    wl.update(0.1, ctx(k0.x + 29, k0.z)); expect(wl.crabs().find(k => k.id === crab.id)).toBeTruthy();
  });
  it('is not saved, and the game runs it with the castaway', () => {
    const g = createGame(w, spawn, { time: 0.4 });
    for (let i = 0; i < 60; i++) g.update({}, 1 / 30);
    expect(g.wildlife).toBeTruthy(); expect(Object.keys(g.state())).not.toContain('wildlife'); expect(JSON.stringify(g.state())).not.toMatch(/crab|flock/);
  });
});

describe('the shapes', () => {
  const box = g => { g.computeBoundingBox(); return g.boundingBox; };
  it('a crab is about 14 cm across with vertex colours', () => {
    const g = crabGeometry(), b = box(g); expect(g.attributes.color.count).toBe(g.attributes.position.count);
    expect(b.max.x - b.min.x).toBeGreaterThan(0.1); expect(b.max.x - b.min.x).toBeLessThan(0.17); expect(b.max.y - b.min.y).toBeLessThan(0.06);
  });
  it('a bird is a body of about 60 cm and wings of half a metre each', () => {
    const { body, right, left } = birdGeometries(), bb = box(body), br = box(right), bl = box(left);
    expect(bb.max.x - bb.min.x).toBeGreaterThan(0.5); expect(bb.max.x - bb.min.x).toBeLessThan(0.7);
    expect(br.max.z - br.min.z).toBeGreaterThan(0.9); expect(br.max.z - br.min.z).toBeLessThan(1.05); expect(bl.max.z - bl.min.z).toBeGreaterThan(0.9);
    const tip = (g, s) => { const c = g.attributes.color, p = g.attributes.position; let grey = 0; for (let i = 0; i < p.count; i++) if (p.getZ(i) * s > 0.4 && c.getX(i) < 0.6) grey++; return grey; };
    expect(tip(right, 1)).toBeGreaterThan(0); expect(tip(left, -1)).toBeGreaterThan(0);   // grey tips at the outer ends
  });
  it('wings flap or glide', () => {
    let hi = -9, lo = 9; for (let t = 0; t < 20; t += 0.02) { const a = flapAngle(t, 0.3, 0); hi = Math.max(hi, a); lo = Math.min(lo, a); }
    expect(hi).toBeGreaterThan(0.5); expect(lo).toBeLessThan(-0.5);
    for (let t = 0; t < 20; t += 0.5) expect(flapAngle(t, 0.3, 2)).toBeCloseTo(0.16, 5);
  });
});
