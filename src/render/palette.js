/**
 * render/palette — the colours of style C (hand-painted with outlines).
 *
 * P    named colours as 0xrrggbb (single) or arrays (variations); frondTint
 *      and dryTint multiply the green and the dry frond textures
 * PC   the single colours as [r, g, b] in 0..1, for painting textures
 * TG   ground colours per terrace tier: open (o, o2) and forest floor (f, f2)
 * BUSHC  bush colours per tier
 * SKY    light over the day: sunlight at noon and low, moonlight, sky fill
 *        (hemisphere) by day, at dusk and at night, and the multiply grading
 *        of golden hour, dusk and night
 * HERO   the castaway: sun-tanned skin, yellowed torn shirt, faded shorts,
 *        dark hair and beard, straw hat, staff, and the light silhouette
 *        that shows when something hides the figure
 *
 * Changing a value here changes the look everywhere; nothing else hard-codes
 * these colours. Plain data, no Three.js.
 */
import { hex } from '../core/math.js';

export const P = Object.freeze({
  sand: 0xebd09a, sand2: 0xdfc188, wet: 0xc4a676, seabed: 0x8fae96, rock: 0xa49684, rock2: 0x8e8070, peak: 0xe2d8c6,
  trunk: 0x7a5638, water: 0x6fc0b6, waterDeep: 0x3a8296, noise: 0.08,
  canopy: [0x6e933f, 0x5c8236, 0x82a04a, 0x8fa64e, 0x7d8c3e, 0x98a850, 0x4e7432],
  jungle: [0x4f7a3a, 0x5a8540, 0x46703a, 0x618a44, 0x3e6434, 0x6a8c3e],
  pine: [0x4d7440, 0x5a8248, 0x466a44, 0x5a7a5a, 0x52705c], bush: [0x6f9442, 0x7f9f48], bg: ['#efe0c2', '#cdb48c'],
  bark: [0x7a5638, 0x8a7c6a], jungleBark: [0x6a4c34, 0x75685a],
  palmTrunk: [0x9a8264, 0x8a7a6a, 0xa89070, 0x907660],
  frondTint: [0xffffff, 0xe4ee88, 0xffd878, 0xa8c090, 0xc0c47c], dryTint: [0xffffff, 0xd4b08c],
});

export const PC = Object.freeze(Object.fromEntries(Object.entries(P).filter(([, v]) => typeof v === 'number').map(([k, v]) => [k, hex(v)])));

export const TG = Object.freeze([
  { o: hex(0xa6ae5e), o2: hex(0x9aa452), f: hex(0x748f42), f2: hex(0x627d38) },   // 0 coast (dunes)
  { o: hex(0x93a34e), o2: hex(0x88994a), f: hex(0x748f42), f2: hex(0x627d38) },   // 1 lowland
  { o: hex(0x6f8c40), o2: hex(0x7a9446), f: hex(0x56733a), f2: hex(0x4a6634) },   // 2 highland, mossy
  { o: hex(0xa3a067), o2: hex(0x948f5e), f: hex(0x857f5c), f2: hex(0x8a7a6a) },   // 3 plateau, dry grass and heath
  { o: hex(0x8f8b82), o2: hex(0x9a968a), f: hex(0x858179), f2: hex(0x9b9a7e) },   // 4 summit, rock and lichen
]);

export const BUSHC = Object.freeze([[0x8a9a52, 0x9aa45a], P.bush, [0x4f7038, 0x5a7a3c, 0x46683a], [0x7d7f52, 0x8a8752, 0x6f7448, 0x857a5c], [0x7d8452, 0x8a8a5a]]);

export const HERO = Object.freeze({ skin: 0xbf8a68, shirt: 0xe6dcbf, shorts: 0x8a7558, hair: 0x4a3222, hat: 0xc9b07a, staff: 0x7a5a3a, silhouette: 0xf4ead2 });

export const SKY = Object.freeze({
  sunNoon: 0xffe6c4, sunLow: 0xffc690, moon: 0xb4c6ec,
  fillDay: 0xe2ebf0, fillDusk: 0xcab4dc, fillNight: 0x8494c4,
  gradeGolden: 0xffe6cc, gradeDusk: 0xd9b8d6, gradeNight: 0x5f6e9e,
});
