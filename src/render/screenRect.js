/**
 * render/screenRect — the size of an element on screen, measured once and kept (0.27.7 "Lighter").
 *
 * The layers over the picture (the glow and fireflies, tally marks, rain) need the width and height of the island's container to place
 * things, once per drawn frame. getBoundingClientRect forces a layout; the size only changes when the window does. So the rect is
 * measured on first use and again after a `resize`, an `orientationchange` or a `visualViewport` resize (a phone's address bar), and a
 * ResizeObserver on the element where there is one.
 *
 * createRectCache(el, win?) -> { get(), invalidate() }   get() -> the element's rect ({ left, top, width, height, ... }), measured only when
 *   there is none kept; invalidate() throws the kept one away. win: the window (default the global one; none in Node: then nothing is listened to)
 * rectOf(el) -> rect   the kept rect of el, one cache per element (so each layer asks without holding a cache)
 *
 * Depends on: nothing (DOM only through the element and window given)
 */
export function createRectCache(el, win = typeof window !== 'undefined' ? window : null) {
  let rect = null;
  const stale = () => { rect = null; };
  if (win && win.addEventListener) {
    win.addEventListener('resize', stale); win.addEventListener('orientationchange', stale);
    if (win.visualViewport && win.visualViewport.addEventListener) win.visualViewport.addEventListener('resize', stale);
  }
  if (win && typeof win.ResizeObserver === 'function') { try { new win.ResizeObserver(stale).observe(el); } catch (e) { /* the window events are enough */ } }
  return { get() { return rect || (rect = el.getBoundingClientRect()); }, invalidate: stale };
}

const caches = new WeakMap();
export function rectOf(el) {
  let c = caches.get(el); if (!c) { c = createRectCache(el); caches.set(el, c); }
  return c.get();
}
