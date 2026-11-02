/**
 * core/math — tiny numeric helpers shared by every layer.
 *
 * Exports
 *   ss(a, b, x)      smoothstep from a to b (a may be larger than b)
 *   lerp(a, b, t)    linear blend
 *   clamp(x, lo, hi)
 *   hex(0xrrggbb)    -> [r, g, b] in 0..1
 *   mix(c1, c2, t)   blend two [r, g, b] colours
 */

export const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
export const hex = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
export const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
