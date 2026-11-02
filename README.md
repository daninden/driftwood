# Driftwood

A stylised, diorama-like game: you are alone on a large, uninhabited island and slowly get to know it. Small, lonely, atmosphere first.

For now you walk, gather the driftwood the tide brings and sleep. The island (600 × 600, seed 1337) is generated from a single number, with terraces, rivers, waterfalls and natural passages through the rock walls.

## Getting started

```
npm install
npm run dev        development server at http://localhost:5173
npm test           unit tests
npm run build      dist/ plus dist/driftwood.html (everything in one file)
npm run smoke      open the build in headless Chromium and take screenshots
```

Another island: add `#seed-2024` to the address.

## Controls

- **W A S D** or arrow keys: walk; **Shift**: run
- **Click or tap** the ground to walk there; double tap to run
- **Click or tap** driftwood to pick it up, the castaway to lay it down
- **Hold** the castaway (or press **Z**) to sleep; any key or tap wakes him
- **Q / E**, right mouse drag or two fingers: turn the view; mouse wheel, **+ / -** or pinch: zoom

## More

- [docs/design.md](docs/design.md): what the game is, the art style, the world and the decisions
- [docs/architecture.md](docs/architecture.md): layers, modules, testing and saving
- [CLAUDE.md](CLAUDE.md): working agreements
- [prototypes/](prototypes/): the prototypes the game grew out of
