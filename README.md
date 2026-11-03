# Driftwood

A stylised, diorama-like game: you are alone on a large, uninhabited island and slowly get to know it. Small, lonely, atmosphere first.

You walk, wade rivers, gather the driftwood the tide brings, husk coconuts for fibre, make fire and a torch, and sleep when you are tired. The island (600 × 600, seed 1337) is generated from a single number, with terraces, rivers, waterfalls and natural passages through the rock walls.

## Getting started

```
npm install
npm run dev        development server at http://localhost:5173
npm test           unit tests
npm run build      dist/ plus dist/driftwood.html (everything in one file)
npm run smoke      open the build in headless Chromium and take screenshots
```

Another island: add `#seed-2024` to the address. Start an island over: add `new` (`#new`, or `#seed-2024&new`); it starts fresh and `new` disappears from the address again.

## How to play

There is no goal, no map and no menu. What you see is the island.

The game remembers where you were. It saves itself as you play, one save per island, in this browser on this device, and picks up where you left off the next time. Nothing to press, nothing to show.

### The island

You are alone. The island rises in terraces, divided by rock walls. A wall stops you, but nature leaves passages: a scree slope, a ravine, rock benches, roots and lianas in the rain forest, or a mossy route beside a waterfall. Nothing marks them; look for loose stones, bare ground and moss. Tree trunks, big boulders and the open sea stop you too. Bushes only slow you down.

### Rivers and the sea

You can wade up to your waist. Upstream, where a river is a narrow brook, you can cross anywhere. Along the middle reach you can cross only at fords, which you can tell by stones sticking out of the water and white rippling water. The deep stretch towards the sea cannot be crossed.

The tide comes in and goes out twice a day. At low water there is more beach to walk on. When the flood comes in round you, you can always wade back to shore. The flood wipes out your footprints.

### Driftwood

Pick up driftwood and carry at most three pieces; each one slows you down. Lay it down at your feet, alone or on a pile. A pile stays where it is, and you can pick it up again.

Every high water washes up some new wood, and the sea takes back piles laid on the wet sand of low water. Fresh wood is wet: it dries to its own colour over a day.

### Coconut fibre

Coconuts lie under the palms. Husk one and you get a tuft of fibre (the nut is not kept). You can carry at most three tufts. They show as small drawings next to the moon: faint most of the time, clearer for a moment when the number changes.

### Fire

You need a pile of at least four pieces of dry wood and a tuft of fibre. Drill a fire on the pile: it takes about fourteen seconds, costs some of your rest and uses up the tuft. It can fail, and wet wood will not catch.

A burning fire needs wood now and then: feed it by laying a piece on it. When the wood is gone it burns down to embers, and then goes out. The flood puts out a fire on the wet sand of low water.

**The torch.** With empty hands you can take a burning brand from a fire. Holding it, you have no hand free for wood. You can stick it in the ground and take it up again. Touch it to a dry pile of four or more pieces and the pile catches at once, without fibre, so a fire can be carried to a new place. A torch burns about two hours and goes out if you wade into deep water.

### Sleep

The moon in the bottom left corner shows how rested you are: full when rested, a thin sickle when you are worn out. After a day and a half you grow tired and slower. After two days you fall asleep where you stand.

Lie down on dry land whenever you like. Sleeping next to a fire lasts the whole night and you wake fully rested. Without a fire the cold wakes you after four hours, only half rested. A click, a tap or a walking key wakes you early. The rising flood wakes you too.

### Day and night

A day lasts twenty minutes. The sun rises in the east and sets in the west, with golden light low in the sky and lilac light at dusk and dawn. The night is dim and moonlit; a fire or torch lights its surroundings.

## Controls

- **W A S D** or arrow keys: walk; **Shift**: run
- **Click or tap** the ground to walk there; double tap to run
- **Click or tap** driftwood or a pile to pick it up; a coconut to husk it; the castaway to lay down what he carries; a burning fire to feed it (with wood) or take a torch (empty hands)
- **Click or tap** the castaway holding a torch to stick it in the ground; click or tap the torch to take it up
- **Click or tap** a pile while holding a torch to light it
- **Hold** a pile (or press **F** beside it) to light it
- **Hold** the castaway (or press **Z**) to sleep
- A left click, a tap or a walking key wakes him; the view controls do not
- **Thumb stick** (phones and tablets only, bottom right): drag from its centre to walk that way, to the rim to run; let go to stop
- **Q / E**, right mouse drag or two fingers: turn the view; right mouse drag up and down: tilt; mouse wheel, **+ / -** or pinch: zoom
- **Shift + `**: start over (forget this island's save and begin again)
- **`** (backtick): show or hide the developer panel (version, name, frame rate, work time per frame)

## More

- [docs/design.md](docs/design.md): what the game is, the art style, the world and the decisions
- [docs/architecture.md](docs/architecture.md): layers, modules, testing and saving
- [docs/versions.md](docs/versions.md): the release log, every version with its short name and what changed
- [CLAUDE.md](CLAUDE.md): working agreements
- [prototypes/](prototypes/): the prototypes the game grew out of
