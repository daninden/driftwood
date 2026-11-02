/**
 * render/streaming — which detailed tiles exist, and building them one at a
 * time without stutter.
 *
 * tileInView(tile, focus, zoom, aspect, margin) -> boolean
 *   Pure geometry: is the tile (plus margin) inside the isometric view
 *   rectangle around focus? The rectangle reaches further away from the
 *   camera than towards it, because high ground behind the player shows up
 *   higher on screen.
 *
 * createStreamer({ tiles, build, onReady, onDrop, slicer, maxZoom })
 *   build(tile) -> generator returning the built thing
 *   onReady(tile, value), onDrop(tile, value | undefined)
 *   streamer.update(focus, zoom, aspect)  decide what is wanted, drop what
 *                                         is far out of view, start the
 *                                         nearest queued build
 *   streamer.pump(ms)                      work on the current build
 *   streamer.entries                       Map<tile, { state, value }>
 *   streamer.pending()                     number of tiles not ready yet
 *
 * No Three.js: tested in Node with fake builds.
 *
 * Depends on: core/view, world/constants
 */
import { toView } from '../core/view.js';
import { T } from '../world/constants.js';

export function tileInView(tile, focus, zoom, aspect, margin = 0) {
  const v = toView(tile.x0 + T / 2 - focus.x, tile.z0 + T / 2 - focus.z), m = T * 0.71 + margin;
  return Math.abs(v.dr) < zoom * aspect + m + 2 && v.dc > -(zoom * 2 + 12 + m) && v.dc < zoom * 2 + 40 + m;
}

export function createStreamer({ tiles, build, onReady, onDrop, slicer, maxZoom = 8 }) {
  const entries = new Map();
  let current = null;
  const land = tiles.filter(t => t.hmax > -8.9);

  function update(focus, zoom, aspect) {
    const z = Math.min(zoom, maxZoom);
    for (const t of land) if (!entries.has(t) && tileInView(t, focus, z, aspect, 0)) entries.set(t, { state: 'queued' });
    entries.forEach((e, t) => {
      if (tileInView(t, focus, z, aspect, 30)) return;
      if (current && current.tile === t) current = null;
      onDrop(t, e.value); entries.delete(t);
    });
    if (!current) {
      let best = null, bd = Infinity;
      entries.forEach((e, t) => {
        if (e.state !== 'queued') return;
        const d = Math.hypot(t.x0 + T / 2 - focus.x, t.z0 + T / 2 - focus.z) - (tileInView(t, focus, z, aspect, -T * 0.5) ? 30 : 0);
        if (d < bd) { bd = d; best = t; }
      });
      if (best) { const e = entries.get(best); e.state = 'building'; current = { tile: best, job: slicer.job(build(best)) }; }
    }
  }

  function pump(ms) {
    if (!current) return false;
    const res = current.job.run(ms);
    if (res.done) { const e = entries.get(current.tile); e.state = 'ready'; e.value = res.value; onReady(current.tile, res.value); current = null; }
    return true;
  }

  const pending = () => { let n = 0; entries.forEach(e => { if (e.state !== 'ready') n++; }); return n; };
  return { update, pump, entries, pending };
}
