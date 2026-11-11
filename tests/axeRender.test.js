// 0.31 "Axe", part 2: what is drawn and heard. The rhythm of the chop (figure and sound), the fall of a felled tree, the logs (shape, ends, rows of a pile), the cut marks, the trees of a tile
// without the felled ones (every other tree keeping its look), the icons of the action button, and the sound leaving the felled trees out. Recording batches, so no WebGL is needed.
// Depends on: render/chop, render/felling, render/timber, render/nearTile, render/batch, render/actionButton, render/palette, audio/mix, game/game, game/felled.
import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { treeId } from '../src/game/felled.js';
import { CHOP_PERIOD, CHOP_STRIKE, chopPose } from '../src/render/chop.js';
import { FALL_TIME, LIE_TIME, fallAngle } from '../src/render/felling.js';
import { timberGeo, pileSlots, logEnds, addLog, addTimberPile, addCutMarks, PITCH } from '../src/render/timber.js';
import { treeParts, rebuildTrees } from '../src/render/nearTile.js';
import { Batch } from '../src/render/batch.js';
import { outlineMat } from '../src/render/materials.js';
import { makeAxe } from '../src/render/axe.js';
import { TIMBER } from '../src/render/palette.js';
import { buttonIcons, ICONS, ICON_OF, LABEL_OF } from '../src/render/actionButton.js';
import { leavesNear } from '../src/audio/mix.js';
import { pileTally } from '../src/render/tallyMarks.js';

let w, spawn;
const kit = new Proxy({}, { get: (_, k) => k });   // geometries and materials by name
beforeAll(async () => { w = await generateWorld(1337); spawn = startSpot(w); });

const treeTile = list => w.tiles.find(t => t[list].length > 4 && t.tx > 3);
const itemsOf = B => [...B.map.values()].flatMap(e => e.list.map(it => [...it.m.elements.map(v => +v.toFixed(5)), it.c]));

describe('the chop', () => {
  it('has one rhythm for the figure and the sound: a blow every 1.1 s, landing at 0.72 of it', () => {
    expect(CHOP_PERIOD).toBeCloseTo(1.1, 6); expect(CHOP_STRIKE).toBeCloseTo(0.72, 6);
  });
  it('lifts the arm high and slowly, brings it down fast and is continuous all the way round', () => {
    const arms = []; for (let i = 0; i <= 100; i++) arms.push(chopPose(i / 100).arm);
    expect(Math.min(...arms)).toBeLessThan(-2.6); expect(Math.max(...arms)).toBeLessThan(-0.9);   // over his head, never behind him
    for (let i = 1; i < arms.length; i++) expect(Math.abs(arms[i] - arms[i - 1])).toBeLessThan(0.35);   // no jump (the fast blow moves most)
    expect(chopPose(1).arm).toBeCloseTo(chopPose(0).arm, 6);   // the periods join up
    const up = chopPose(0.3).arm - chopPose(0.2).arm, down = chopPose(CHOP_STRIKE).arm - chopPose(CHOP_STRIKE - 0.1).arm;
    expect(Math.abs(down)).toBeGreaterThan(Math.abs(up));   // down faster than up
    expect(chopPose(CHOP_STRIKE).lean).toBeGreaterThan(chopPose(0.3).lean);   // he leans into the blow
  });
});

describe('the fall', () => {
  it('tips the trunk from standing to lying, slowly at first and never backwards', () => {
    expect(fallAngle(0)).toBe(0); expect(fallAngle(1)).toBeCloseTo(Math.PI / 2, 9); expect(fallAngle(2)).toBeCloseTo(Math.PI / 2, 9); expect(fallAngle(-1)).toBe(0);
    let prev = 0; for (let i = 1; i <= 50; i++) { const a = fallAngle(i / 50); expect(a).toBeGreaterThanOrEqual(prev); prev = a; }
    expect(fallAngle(0.3)).toBeLessThan(0.3 * Math.PI / 2 / 2);   // slow to begin with
    expect(FALL_TIME).toBeCloseTo(1.5, 6); expect(LIE_TIME).toBeGreaterThan(0);
  });
});

describe('logs', () => {
  it('are bark brown with pale cut ends and a dark rim, one shape for all', () => {
    const col = timberGeo.attributes.color, nor = timberGeo.attributes.normal, pos = timberGeo.attributes.position, c = new THREE.Color();
    let ends = 0, sides = 0;
    for (let i = 0; i < col.count; i++) {
      c.setRGB(col.getX(i), col.getY(i), col.getZ(i));
      if (Math.abs(nor.getY(i)) > 0.5) { ends++; expect(c.r).toBeGreaterThan(0.7); if (Math.hypot(pos.getX(i), pos.getZ(i)) < 0.01) expect(c.getHex()).toBe(new THREE.Color(TIMBER.endMid).getHex()); }
      else { sides++; expect(c.getHex()).toBe(new THREE.Color(TIMBER.bark).getHex()); expect(c.r).toBeLessThan(0.6); }
    }
    expect(ends).toBeGreaterThan(0); expect(sides).toBeGreaterThan(0);
  });
  it('lie along their axis, both ends on the ground (a slope tilts the log)', () => {
    const log = { id: 4 << 24, x: 3, z: 4, y: 1, len: 2, a: 0.5, rad: 0.14 }, slope = (x, z) => 0.3 * x;
    const [A, B] = logEnds(slope, log);
    expect(A.distanceTo(B)).toBeCloseTo(Math.hypot(2, 0.3 * Math.cos(0.5) * 2), 4);
    expect(B.x - A.x).toBeCloseTo(2 * Math.cos(0.5), 6); expect(B.z - A.z).toBeCloseTo(2 * Math.sin(0.5), 6);
    expect(A.y).toBeCloseTo(0.3 * A.x + 0.14 * 0.85, 6);
  });
  it('are drawn as a log and its own outline hull, which reaches only a finger past the ends', () => {
    const B = new Batch(outlineMat, null); addLog(B, () => 0, { id: (4 << 24) + 1, x: 0, z: 0, len: 2, a: 0, rad: 0.14 });
    expect([...B.map.keys()].sort()).toEqual(['tbo', 'tbr']);
    const log = B.map.get('tbr').list[0].m, hull = B.map.get('tbo').list[0].m, p = new THREE.Vector3(), q = new THREE.Quaternion(), s1 = new THREE.Vector3(), s2 = new THREE.Vector3();
    log.decompose(p, q, s1); hull.decompose(p, q, s2);
    expect(s1.y).toBeCloseTo(2, 5); expect(s2.y - s1.y).toBeGreaterThan(0.04); expect(s2.y - s1.y).toBeLessThan(0.1);
    expect(s2.x).toBeGreaterThan(s1.x);
    expect(B.map.get('tbo').opts.cast).toBe(false);
  });
});

describe('a pile of logs', () => {
  it('is a neat stack: rows of 4, 3, 3 and 2 from the bottom, filling from the bottom up', () => {
    const all = pileSlots(12); expect(all.length).toBe(12);
    const rows = []; for (const s of all) { const r = rows.find(x => x.y === s.y); if (r) r.n++; else rows.push({ y: s.y, n: 1 }); }
    expect(rows.map(r => r.n)).toEqual([4, 3, 3, 2]);
    for (let i = 1; i < all.length; i++) expect(all[i].y).toBeGreaterThanOrEqual(all[i - 1].y);
    for (const n of [1, 5, 11]) expect(pileSlots(n)).toEqual(all.slice(0, n));
    expect(Math.max(...all.map(s => Math.abs(s.side)))).toBeCloseTo(1.5 * PITCH, 6);   // narrow: about a metre across
  });
  it('draws every log of the pile once, all lying one way', () => {
    const logs = Array.from({ length: 12 }, (_, i) => ({ id: (4 << 24) + i, len: 2, rad: 0.13 })), B = new Batch(outlineMat, null);
    addTimberPile(B, () => 0, { x: 5, z: -3, kind: 'log', logs });
    expect(B.map.get('tbr').list.length).toBe(12); expect(B.map.get('tbo').list.length).toBe(12);
    const dirs = B.map.get('tbr').list.map(it => { const v = new THREE.Vector3(0, 1, 0).applyMatrix4(new THREE.Matrix4().extractRotation(it.m)); return Math.round(Math.atan2(v.z, v.x) * 10) / 10; });
    expect(new Set(dirs.map(d => Math.abs(d) < 1e-9 ? 0 : d)).size).toBeLessThanOrEqual(2);   // one axis (the sign of an end does not matter)
  });
});

describe('tally marks of a pile of logs', () => {
  it('count the logs like those of any pile, and show the double line when it is full', () => {
    const pile = n => ({ kind: 'log', logs: Array.from({ length: n }, (_, i) => ({ id: (4 << 24) + i, timber: true })) });
    expect(pileTally(pile(7))).toEqual({ count: 7, part: false, full: false });
    expect(pileTally(pile(12))).toEqual({ count: 12, part: false, full: true });
  });
});

describe('felled trees', () => {
  it('leave a flat cut mark on their tile, only on that tile, and nothing for a tile with none', () => {
    const g = createGame(w, spawn, { time: 0.3, day: 1 }), tile = treeTile('trees'), other = w.tiles.find(t => t !== tile && t.trees.length);
    const B0 = new Batch(outlineMat, null); addCutMarks(B0, kit, w, tile, g.felled); expect(B0.map.size).toBe(0);
    const info = { id: treeId(tile, 'trees', 0), list: 'trees', index: 0, tile, tree: tile.trees[0], kind: 'tree', scale: 1, giant: false, x: tile.trees[0].x, z: tile.trees[0].z, r: 0.13 };
    g.felled.fell(info, 0.5, 1);
    const B = new Batch(outlineMat, null); addCutMarks(B, kit, w, tile, g.felled);
    expect(B.map.get('cutm').list.length).toBe(1); expect(B.map.get('cutr').list.length).toBe(1);
    const m = B.map.get('cutm').list[0].m, p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); m.decompose(p, q, s);
    expect(p.x).toBeCloseTo(tile.trees[0].x, 6); expect(p.z).toBeCloseTo(tile.trees[0].z, 6);
    expect(s.y).toBeLessThan(0.05); expect(s.x).toBeGreaterThan(0.13);   // flat, a little wider than the trunk
    expect(B.map.get('cutm').opts.cast).toBe(false);   // never casts a shadow
    const B2 = new Batch(outlineMat, null); addCutMarks(B2, kit, w, other, g.felled); expect(B2.map.size).toBe(0);
  });
  it('are left out of the tile without changing any other tree (a felled tree still uses its random numbers)', () => {
    const g = createGame(w, spawn, { time: 0.3, day: 1 }), tile = treeTile('trees');
    const before = tile.trees.slice(1, 6).map((_, i) => itemsOf(treeParts(w, kit, tile, 'trees', i + 1)));
    const pal = tile.palms.length ? itemsOf(treeParts(w, kit, tile, 'palms', tile.palms.length - 1)) : null;
    g.felled.fell({ id: treeId(tile, 'trees', 0), list: 'trees', index: 0, tile, tree: tile.trees[0], kind: 'tree', scale: 1, giant: false, x: tile.trees[0].x, z: tile.trees[0].z, r: 0.13 }, 0, 1);
    const after = tile.trees.slice(1, 6).map((_, i) => itemsOf(treeParts(w, kit, tile, 'trees', i + 1)));
    expect(after).toEqual(before);
    if (pal) expect(itemsOf(treeParts(w, kit, tile, 'palms', tile.palms.length - 1))).toEqual(pal);
    expect(itemsOf(treeParts(w, kit, tile, 'trees', 0)).length).toBeGreaterThan(0);   // the felled tree itself can still be drawn: it is the one that falls
    expect(treeParts(w, kit, tile, 'trees', 99999)).toBeNull();
  });
  it('rebuild the tree group of a tile with one tree less', () => {
    const g = createGame(w, spawn, { time: 0.3, day: 1 }), tile = treeTile('pines') || treeTile('trees'), list = tile.pines.length > 4 ? 'pines' : 'trees';
    const taken = [], fakePools = { take: b => { taken.push(b); return { free() {}, n: b.list.length }; } };
    const group = new THREE.Group(); group.userData.treeGroup = new THREE.Group();
    rebuildTrees(w, kit, tile, group, fakePools);
    const count = () => taken.reduce((n, b) => n + (b.opts.cast === false ? 0 : b.list.length), 0);
    const all = count(); taken.length = 0;
    g.felled.fell({ id: treeId(tile, list, 0), list, index: 0, tile, tree: tile[list][0], kind: list === 'pines' ? 'pine' : 'tree', scale: 1, giant: false, x: tile[list][0].x, z: tile[list][0].z, r: 0.1 }, 0, 1);
    rebuildTrees(w, kit, tile, group, fakePools);
    expect(count()).toBeLessThan(all + 1); expect(taken.length).toBeGreaterThan(0);
    expect(group.userData.fv).toBe(g.felled.version);
    expect(group.userData.treeGroup.parent).toBe(group);
  });
});

describe('the axe', () => {
  it('is a haft with a blade, made of three meshes with the dark outline on the haft and the blade', () => {
    const a = makeAxe(); let meshes = 0; a.traverse(o => { if (o.isMesh) meshes++; });
    expect(a.children.length).toBe(3); expect(meshes).toBe(5);
    const blade = a.children[1]; expect(blade.position.y).toBeGreaterThan(0.5); expect(blade.position.z).toBeGreaterThan(0);   // at the top, the edge out to the front
  });
});

describe('the action button for the axe and the logs', () => {
  it('has an icon and plain words for making, taking up, laying down and felling', () => {
    for (const [kind, key] of [['makeAxe', 'axe'], ['takeAxe', 'takeAxe'], ['layAxe', 'layAxe'], ['fell', 'fell']]) { expect(ICON_OF[kind]).toBe(key); expect(ICONS[key]).toBeTruthy(); expect(LABEL_OF[kind]).toBeTruthy(); }
    expect(buttonIcons({ tap: { kind: 'fell', tree: {} }, options: [{ kind: 'layAxe' }, { kind: 'makeAxe' }] })).toEqual({ main: 'fell', options: [{ key: 'layAxe', label: 'Lay the axe down' }, { key: 'axe', label: 'Make an axe' }] });
  });
  it('draws picking up a log (or a pile of logs) and laying one down as a log with its cut end showing', () => {
    expect(buttonIcons({ tap: { kind: 'pickup', thing: { kind: 'log', log: { timber: true } } }, options: [] }).main).toBe('pickupLog');
    expect(buttonIcons({ tap: { kind: 'pickup', thing: { kind: 'pile', pile: { kind: 'log', logs: [] } } }, options: [] }).main).toBe('pickupLog');
    expect(buttonIcons({ tap: { kind: 'pickup', thing: { kind: 'log', log: {} } }, options: [] }).main).toBe('pickup');   // driftwood keeps its own drawing
    expect(buttonIcons({ tap: { kind: 'lay' }, options: [] }).main).toBe('lay');
    expect(buttonIcons({ tap: { kind: 'lay' }, options: [] }, true).main).toBe('layLog');   // with a log on his shoulder
    expect(buttonIcons({ tap: null, options: [{ kind: 'lay' }] }, true).options).toEqual([{ key: 'layLog', label: 'Lay the log on the pile' }]);
    for (const k of ['pickupLog', 'layLog']) { expect(ICONS[k]).toBeTruthy(); expect(LABEL_OF[k]).toBeTruthy(); }
  });
});

describe('sound under felled trees', () => {
  it('counts no rustle and no cricket cover from a tree that is gone', () => {
    const g = createGame(w, spawn, { time: 0.3, day: 1 });
    // a thin stand: a tile with a few trees, a spot between two of them (the rustle saturates in a dense forest)
    const all = t => [...t.palms.map(q => ['palms', q]), ...t.trees.map(q => ['trees', q]), ...t.pines.map(q => ['pines', q])];
    const tile = w.tiles.filter(t => all(t).length >= 2 && all(t).length <= 5).find(t => { const [a, b] = all(t); return leavesNear(w, (a[1].x + b[1].x) / 2, (a[1].z + b[1].z) / 2).leaves > 0; });
    const [a, b] = all(tile), x = (a[1].x + b[1].x) / 2, z = (a[1].z + b[1].z) / 2, before = leavesNear(w, x, z);
    expect(before.leaves).toBeGreaterThan(0); expect(before.leaves).toBeLessThan(1);
    for (const list of ['palms', 'trees', 'pines']) tile[list].forEach((tree, index) => g.felled.fell({ id: treeId(tile, list, index), list, index, tile, tree, kind: list === 'pines' ? 'pine' : list === 'palms' ? 'palm' : 'tree', scale: 1, giant: false, x: tree.x, z: tree.z, r: 0.1 }, 0, 1));
    const after = leavesNear(w, x, z);
    expect(after.leaves).toBeLessThan(before.leaves); expect(after.forest).toBeLessThanOrEqual(before.forest);   // (trees of the neighbouring tiles may still rustle)
    createGame(w, spawn, { time: 0.3, day: 1 });   // a new game on the same world has none felled: the sound is as it was
    expect(leavesNear(w, x, z)).toEqual(before);
  });
});
