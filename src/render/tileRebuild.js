/**
 * render/tileRebuild — rebuilds only the detailed tiles whose pieces changed (0.27.7 "Lighter").
 *
 * The views of what lies on the ground (branches, coconuts, berries, bananas, fronds and stones, beach driftwood)
 * keep a group per detailed tile. When the game module behind a view changes (its `version`), the module also
 * says which tiles changed (its `dirty` Set of indices into world.tiles: game/branches, fibre, forage, fronds, stones, wood),
 * so a pickup rebuilds one tile and not every tile near him.
 *
 * rebuildTiles(tiles, dirty, worldTiles, rebuild) -> number of tiles rebuilt   pure (no Three.js)
 *   tiles: Map tile -> group (what the view holds); dirty: the Set of tile indices, emptied here, or undefined when the module
 *   does not say (then every tile held is rebuilt); worldTiles: world.tiles (index -> tile);
 *   rebuild(tile, group): disposes the group and puts the new one into `tiles`. Tiles that are not held (not near) are skipped:
 *   they are built from the game's state when they come near.
 *
 * Depends on: nothing
 */
export function rebuildTiles(tiles, dirty, worldTiles, rebuild) {
  let n = 0;
  if (!dirty) { tiles.forEach((g, tile) => { rebuild(tile, g); n++; }); return n; }
  for (const k of dirty) { const tile = worldTiles[k]; if (tile && tiles.has(tile)) { rebuild(tile, tiles.get(tile)); n++; } }
  dirty.clear();
  return n;
}
