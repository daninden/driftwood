# Prototypes

The single-file prototypes the game grew out of, kept for reference. They are not part of the build and are not maintained with the game.

| Folder | What it is |
|---|---|
| `style-variants/scene.html` | The fixed diorama scene used to compare art styles A–D and the lighting variants C1–C4 (`?style=a` … `h`). |
| `island-generator/generator.html` | The seed-based 600 × 600 island generator that the game's `world/` modules were ported from. Renders an overview and shots at game zoom (`?seed=1337&mode=all`, `pass` or `overview`). |

Both load Three.js r128 from cdnjs.

## Scripts

```
node prototypes/render.js styles abcdefgh [outDir]    style images
node prototypes/render.js island 1337:all [outDir]    overview + terrace shots
node prototypes/render.js island 1337:pass [outDir]   overview + passage shots
node prototypes/make-golden.js                        re-export tests/fixtures/golden-1337.json
```

They use the Playwright Chromium that is available in the development environment. Without internet access, set `THREE_LOCAL` to a local copy of `three.min.js` (r128).

The images in `docs/images/` were rendered with these scripts.
