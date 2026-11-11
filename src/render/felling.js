/**
 * render/felling — the fall of a felled tree (0.31 "Axe"): the tree tips over, away from him, and is then replaced by its logs and its crown's material.
 *
 * The tree is drawn again exactly as the tile drew it (render/nearTile `treeParts`, a Batch of own meshes) inside a pivot at its foot, and tips over towards the fall heading
 * of its record (game/felled `felled.last.h`: towards (sin h, cos h)) for FALL_TIME seconds, slowly at first and ever faster, as a tree does (`fallAngle`), then lies still
 * for a moment (LIE_TIME) and is gone. The tile has already stopped drawing it at the moment of the felling (the tree group of the tile is rebuilt, render/nearTile); the logs it left are
 * held back (render/timber `hold`) until the tree has landed, so the trunk does not fall onto its own logs. One fall at a time: a new felling ends the one in progress.
 *
 * FALL_TIME (1.5 s), LIE_TIME (0.25 s)
 * fallAngle(u) -> radians   the tilt of the trunk at the share u (0..1) of the fall: 0 standing, PI / 2 lying; pure, never backwards
 * createFellingView(scene, world, kit, game, timber) -> { update(dt), playing }
 *   update(dt)   dt in real seconds; starts the fall of a new `game.felled.last` (felled.falls went up), moves the tree, removes it at the end
 *   playing      true while a tree is falling or lying
 *
 * Depends on: three, render/nearTile (treeParts, disposeGroup), game/felled (treeInfo, read only)
 */
import * as THREE from 'three';
import { treeParts, disposeGroup } from './nearTile.js';
import { treeInfo } from '../game/felled.js';

export const FALL_TIME = 1.5, LIE_TIME = 0.25;
export const fallAngle = u => (Math.PI / 2) * Math.pow(Math.min(1, Math.max(0, u)), 2.3);

export function createFellingView(scene, w, kit, game, timber) {
  let seen = game.felled.falls, cur = null, size = game.logs.all.size;
  const axis = new THREE.Vector3();
  function stop() { if (!cur) return; scene.remove(cur.pivot); disposeGroup(cur.group); cur = null; if (timber) timber.hold(null); }
  function start(rec, held) {
    stop();
    const info = treeInfo(w, rec.id), B = info && treeParts(w, kit, info.tile, info.list, info.index);
    if (!B) return;
    const group = new THREE.Group(), pivot = new THREE.Group();
    B.build(group); group.position.set(-rec.x, -rec.y, -rec.z); pivot.add(group); pivot.position.set(rec.x, rec.y, rec.z); scene.add(pivot);
    cur = { pivot, group, t: 0, h: rec.h, r: info.r, y: rec.y };
    if (timber) timber.hold(held);
  }
  function update(dt = 0) {
    if (game.felled.falls !== seen) {
      seen = game.felled.falls;
      const rec = game.felled.last;
      const held = new Set([...game.logs.all.keys()].slice(size));   // the logs this felling left lie there, out of sight, until the tree has landed
      if (rec) start(rec, held);
    }
    size = game.logs.all.size;
    if (!cur) return;
    cur.t += dt;
    const th = fallAngle(cur.t / FALL_TIME);
    axis.set(Math.cos(cur.h), 0, -Math.sin(cur.h));   // up x axis = the heading: the top goes towards (sin h, cos h)
    cur.pivot.quaternion.setFromAxisAngle(axis, th);
    cur.pivot.position.y = cur.y + cur.r * Math.sin(th);   // the trunk lies on the ground, not in it
    if (cur.t >= FALL_TIME + LIE_TIME) stop();
  }
  return { update, get playing() { return !!cur; } };
}
