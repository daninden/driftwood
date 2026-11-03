# Driftwood

A stylised, diorama-like game: you are alone on a large, uninhabited island and slowly get to know it. Small, lonely, atmosphere first.

You walk, wade rivers, gather the driftwood the tide brings, husk coconuts for fibre, drink from the rivers, make fire and a torch, and sleep when you are tired. The island (600 × 600, seed 1337) is generated from a single number, with terraces, rivers, waterfalls and natural passages through the rock walls.

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

The game remembers where you were. It saves itself as you play, one save per island, in this browser on this device, and picks up where you left off the next time. Nothing to press, nothing to show. The view is remembered too: how far you turned and tilted it and how far you zoomed come back as you left them.

The first time you start an island, the loading screen asks *What is your name?*. Type a name and press Enter (or tap the small arrow); leave it empty and you are the castaway. The name is kept with the island and not asked again; starting over asks again. A small line top left always says who you are and which day it is, such as `Dave, day 1`; it grows clearer for a moment when a new day begins. The day turns at midnight, also while you sleep.

### The action button

Clicking or tapping only walks. Click the ground and he walks there; click a piece of driftwood, a pile, a coconut or a fire and he walks to beside it and stands there, doing nothing. Everything he does is done with the **action button**: press **Space**, or the small ring in the bottom right corner (on a phone or tablet it sits just above the thumb stick). The ring is faint and empty when there is nothing to do, and clearer with a small drawing inside when there is:

- wood with an arrow up: pick it up (a piece, or from a pile); wood with an arrow down: lay down what you carry
- a tuft of fibre: husk the coconut
- a flame over a piece of wood: lay a piece on the fire
- a torch: take a burning brand from the fire, or take up a torch stuck in the ground; a torch with a stroke of ground: stick the torch in the ground
- a drop: drink

A short press does the obvious thing for what you stand beside: what is in your hands decides first, then what is nearest, and laying down comes last. Some things take a **hold** (about half a second): hold the button to light a pile of wood (a flame) or to lie down and sleep (a crescent moon). A thin ring fills round the drawing while you hold, so a short press never starts them by accident. When a short press and a hold both do something, the drawing of the short press is large and the one of the hold small beside it. Pressing the button also wakes you.

### The island

You are alone. The island rises in terraces, divided by rock walls. A wall stops you, but nature leaves passages: a scree slope, a ravine, rock benches, roots and lianas in the rain forest, or a mossy route beside a waterfall. Nothing marks them; look for loose stones, bare ground and moss. Tree trunks, big boulders and the open sea stop you too. Bushes only slow you down.

### Rivers and the sea

You can wade up to your waist. Upstream, where a river is a narrow brook, you can cross anywhere. Along the middle reach you can cross only at fords, which you can tell by stones sticking out of the water and white rippling water. The deep stretch towards the sea cannot be crossed.

The tide comes in and goes out twice a day. At low water there is more beach to walk on. When the flood comes in round you, you can always wade back to shore. The flood wipes out your footprints.

### Driftwood

Pick up driftwood and carry at most three pieces; each one slows you down, and with three you take shorter steps and stoop a little. Lay it down at your feet, alone or on a pile (stand beside the pile and press the button). A pile stays where it is, and you can pick it up again once your arms are empty. A pile holds at most twelve pieces: wood laid on a full pile starts a new pile right next to it. Stand beside a pile and tally marks appear above it in ink, one stroke for each piece, in bundles of five, with a double line under them when it is full. They fade when you walk away.

Every high water washes up some new wood, and the sea takes back piles laid on the wet sand of low water. Fresh wood is wet: it looks dark and a little glossy, with a damp patch in the sand under it, and stays that way until it is dry enough to burn; then it quickly bleaches to its own colour. A wet piece will not light a fire, so gather ahead.

### Coconut fibre

Coconuts lie under the palms. Stand beside one and press the button: he kneels and husks it, and you get a tuft of fibre (the nut is not kept). You can carry at most three tufts. They show as small drawings next to the moon: faint most of the time, clearer for a moment when the number changes.

### Thirst

After about a day (twenty minutes of play) you are thirsty and a little slower; after a day and a half you are very thirsty and your rest runs out twice as fast. After two days you collapse and sleep where you stand, and wake still thirsty. You never die.

Drink at a river: stand in the water or on its bank and press the button; you kneel and drink for a few seconds. Wood you carry is laid down first, a torch is stuck in the ground first. The sea and the lagoons are salt and do nothing, and wading in a river does not drink by itself. A small drop next to the moon shows your thirst: full after a drink, emptying as you get thirsty. Your head hangs a little when you are thirsty.

### Fire

You need a pile of at least four pieces of dry wood and a tuft of fibre. Stand beside the pile and hold the button (or press **F**): he kneels and drills a fire, which takes about fourteen seconds, costs some of your rest and uses up the tuft. It can fail, and wet wood will not catch. A short press beside the pile just picks it up.

A burning fire needs wood now and then: stand beside it with wood in your arms and press the button to lay a piece on it. Only dry wood goes on a fire: with wet and dry wood in your arms you lay a dry piece, and wet wood alone is just laid down on the ground. A fire holds at most eight pieces: when it is full the button offers nothing to lay on it, and you keep the wood. Stand beside a fire and tally marks above it count the pieces still on it (up to eight; a half-burnt piece is a short stroke, embers get none), and the little tepee of charred wood grows and shrinks with that number. When the wood is gone it burns down to embers, and then goes out. The flood puts out a fire on the wet sand of low water. A fire that goes out leaves its burnt place, ash and charred ends, which stays for about two days and fades; the flood washes it away sooner. It gives no light or warmth, and you walk over it.

**The torch.** With empty hands, press the button beside a burning fire to take a burning brand from it. Holding it, you have no hand free for wood. Press the button to stick it in the ground (when nothing else can be done), and press beside it with empty hands to take it up again. Hold the button beside a dry pile of four or more pieces with the torch in your hand and the pile catches at once, without fibre, so a fire can be carried to a new place. A torch burns about two hours and goes out if you wade into deep water.

### Sleep

The moon in the bottom left corner shows how rested you are: full when rested, a thin sickle when you are worn out. After a day and a half you grow tired and slower. After two days you fall asleep where you stand.

Lie down on dry land whenever you like: hold the button where there is no pile to light (or press **Z**). Sleeping next to a fire lasts the whole night and you wake fully rested. Without a fire the cold wakes you after four hours, only half rested. A click, a tap, the button or a walking key wakes you early. The rising flood wakes you too. However a sleep ends, a short line fades in and out in the middle of the screen, such as *Dave wakes. Day 3.*

### Day and night

A day lasts twenty minutes. The sun rises in the east and sets in the west, with golden light low in the sky and lilac light at dusk and dawn. The night is dim and moonlit; a fire or torch lights its surroundings. The small marks on screen (the moon, the drop, the row of what you carry, the thumb stick, the action button, the name line) are dark brown by day and turn pale at night.

## Controls

- **W A S D** or arrow keys: walk; **Shift**: run
- **Click or tap** the ground to walk there; double tap to run. Clicking or tapping a thing (driftwood, a pile, a coconut, a fire, a torch in the ground) walks to beside it and does nothing else
- **Space** or the ring in the bottom right corner (on a phone above the thumb stick): the action button. A short press picks up, lays down, husks, feeds a fire, takes or sticks a torch, or drinks, whatever the drawing in the ring shows
- **Hold** the action button (about half a second) to light a pile beside you (or press **F** there), or to sleep (or press **Z**)
- A left click, a tap, the action button or a walking key wakes him; the view controls do not
- **Thumb stick** (phones and tablets only, bottom right): drag from its centre to walk that way, to the rim to run; let go to stop
- **Q / E**, right mouse drag or two fingers: turn the view; right mouse drag up and down: tilt; mouse wheel, **+ / -** or pinch: zoom (the view is remembered per island)
- **Enter** (or the arrow): confirm your name at the start of an island
- **Shift + `**: start over (forget this island's save and begin again; the name is asked again)
- **`** (backtick): show or hide the developer panel (version, name, frame rate, work time per frame); while it is shown you can zoom out further, to 25

## More

- [docs/design.md](docs/design.md): what the game is, the art style, the world and the decisions
- [docs/architecture.md](docs/architecture.md): layers, modules, testing and saving
- [docs/versions.md](docs/versions.md): the release log, every version with its short name and what changed
- [docs/handover.md](docs/handover.md): the planning: what is live, what is being built and what is agreed next
- [CLAUDE.md](CLAUDE.md): working agreements
- [prototypes/](prototypes/): the prototypes the game grew out of
