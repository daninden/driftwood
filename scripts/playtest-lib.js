// Bundled by scripts/playtest.js (esbuild, IIFE, global `DWLib`) and injected into the page, so the bot can use the
// game's own movement rules for path finding. Tooling only; nothing here is part of the game.
export { canStand, stepFactor, terrainAt, nearestStandable } from '../src/game/movement.js';
export { createPath } from '../src/game/path.js';
export { findWater, freshWater } from '../src/game/water.js';
export { FIRE_MIN, DRILL_TIME, FUEL_MAX, BURN } from '../src/game/fire.js';
export { UPGRADES, UP_REACH, ringCentre } from '../src/game/leanto.js';   // (0.32: NEED and UP_NEAR are gone with the building piles)
export { dryness, logTop } from '../src/game/wood.js';
export { WARM_R } from '../src/game/fire.js';
export { YAW } from '../src/core/view.js';
export { createMind } from '../src/game/mind.js';
