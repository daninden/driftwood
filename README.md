# Driftwood

A stylised, diorama-like game: you are alone on a large, uninhabited island and slowly get to know it. Small, lonely, atmosphere first.

For now you can only walk. The island (600 × 600, seed 1337) is generated from a single number, with terraces, rivers, waterfalls and natural passages through the rock walls.

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
- **Click or tap** the ground to walk there

## More

- [docs/architecture.md](docs/architecture.md): layers, modules, testing and saving
