# Driftwood

A stylised, diorama-like game: you are alone on a large, uninhabited island and slowly get to know it. Small, lonely, atmosphere first.

You walk, wade rivers, gather the driftwood the tide brings, husk coconuts for fibre, drink from the rivers, make fire and a torch, and sleep when you are tired. The island (600 × 600, seed 1337) is generated from a single number, with terraces, rivers, waterfalls and natural passages through the rock walls.

## Getting started

```
npm install
npx playwright install chromium   once, for the smoke test
npm run dev        development server at http://localhost:5173
npm test           unit tests
npm run build      dist/ plus dist/driftwood.html (everything in one file)
npm run smoke      quick check in headless Chromium with a few screenshots
npm run smoke:full the same with every screenshot
```

Another island: add `#seed-2024` to the address. Start an island over: add `new` (`#new`, or `#seed-2024&new`); it starts fresh and `new` disappears from the address again.

## How to play

There is no goal, no map and no menu. What you see is the island.

The game remembers where you were. It saves itself as you play, one save per island, in this browser on this device, and picks up where you left off the next time. Nothing to press, nothing to show. The view is remembered too: how far you turned and tilted it and how far you zoomed come back as you left them.

The first time you start an island, the loading screen asks *What is your name?*. Type a name and press Enter (or tap the small arrow); leave it empty and you are the castaway. The name is kept with the island and not asked again; starting over asks again. A small line top left always says who you are and which day it is, such as `Dave, day 1`; it grows clearer for a moment when a new day begins. The day turns at midnight, also while you sleep.

### The action button

Clicking or tapping only walks. Click the ground and he walks there; click a piece of driftwood, a branch, a pile, a coconut or a fire and he walks to beside it and stands there, doing nothing. Everything he does is done with the **action button**: press **Space**, or the small ring in the bottom right corner (on a phone or tablet it sits just above the thumb stick). The ring is faint and empty when there is nothing to do, and clearer with a small drawing inside when there is:

- wood with an arrow up: pick it up (a piece, or from a pile); wood with an arrow down: lay down what you carry
- a half coconut: husk and eat the coconut
- a flame over a piece of wood: lay a piece on the fire
- a torch: take a burning brand from the fire, or take up a torch stuck in the ground; a torch with a stroke of ground: stick the torch in the ground
- a drop: drink

A short press does the obvious thing for what you stand beside: what is in your hands decides first, then what is nearest, and laying down comes last. Some things take a **hold** (about half a second): hold the button to light a pile of wood (a flame) to build a lean-to (a small lean-to), or to lie down and sleep (a crescent moon). A thin ring fills round the drawing while you hold, so a short press never starts them by accident. When a short press and a hold both do something, the drawing of the short press is large and the one of the hold small beside it. Pressing the button also wakes you.

### The island

You are alone. The island rises in terraces, divided by rock walls. A wall stops you, but nature leaves passages: a scree slope, a ravine, rock benches, roots and lianas in the rain forest, or a mossy route beside a waterfall. Nothing marks them; look for loose stones, bare ground and moss. Tree trunks, big boulders and the open sea stop you too. Bushes only slow you down.

### Rivers and the sea

You can wade up to your waist. Upstream, where a river is a narrow brook, you can cross anywhere. Along the middle reach you can cross only at fords, which you can tell by stones sticking out of the water and white rippling water. The deep stretch towards the sea cannot be crossed.

The tide comes in and goes out twice a day. At low water there is more beach to walk on. When the flood comes in round you, you can always wade back to shore. The flood wipes out your footprints.

### Driftwood

Pick up driftwood and carry at most three pieces; each one slows you down, and with three you take shorter steps and stoop a little. Lay it down at your feet, alone or on a pile (stand beside the pile and press the button). Wood never goes down in the water: if the spot in front of you is wet, it goes on a dry spot beside you, and if there is none you keep it in your arms. A pile stays where it is, and you can pick it up again once your arms are empty. A pile holds at most twelve pieces: wood laid on a full pile starts a new pile right next to it. Stand beside a pile and tally marks appear above it in ink, one stroke for each piece, in bundles of five, with a double line under them when it is full. They fade when you walk away.

Every high water washes up some new wood, and the sea takes back piles laid on the wet sand of low water. Fresh wood is wet: it looks dark and a little glossy, with a damp patch in the sand under it, and stays that way until it is dry enough to burn; then it quickly bleaches to its own colour. A wet piece will not light a fire, so gather ahead.

### Branches and the lean-to

Under about half of the trees in the lowland and the rain forest lie a few dry branches, thinner and shorter than driftwood and dark, with a twig or two and some dry leaves. Pick them up like driftwood: wood and branches together, at most three at a time, and each one slows you down the same. Each branch you carry also shows as a small twig next to the moon. They are never wet. Lay them on piles of their own (a pile of branches never mixes with driftwood; twelve at most; tally marks as for driftwood). A branch grows back at the same spot after four to eight days. Branches burn too, but half as long as a piece of driftwood: you can feed them to a fire, and a pile of at least four can be lit like a pile of driftwood.

To build a **lean-to**, make a pile of at least six pieces of driftwood and a pile of at least six branches, close together (their middles within two metres). Stand beside either one and hold the button (or press **F**): he builds instead of lighting a fire. It takes six pieces of each out of the piles (the rest stays) and about a minute of play, and it costs about as much of your rest as two attempts to drill a fire. First two forked posts rise, then a ridge pole, then a few branches lean against it as a sloping roof, and last big palm fronds are laid over them. The open side faces the way the camera looks when you start, and stays that way. If you walk off, the half-built lean-to stays where it is; stand beside it and hold the button to go on building. It is not solid: you walk through it. You can build more than one. The flood takes a lean-to built on the wet sand of low water.

### Coconut fibre

Coconuts lie under the palms. Stand beside one and press the button: he kneels and husks it, and you eat the nut (see Hunger); you also get a tuft of fibre, as long as you have room for it. You can carry at most three tufts; with three he still eats the nut, but gets no fourth tuft. They show as small drawings next to the moon: faint most of the time, clearer for a moment when the number changes.

### Thirst

After about a day (twenty minutes of play) you are thirsty and clearly slower, with shorter steps; after a day and a half you are very thirsty and your rest runs out twice as fast. After two days you collapse and sleep where you stand, and wake still thirsty. You never die.

Drink at a river: stand in the water or on its bank and press the button; you kneel and drink for a few seconds. Wood you carry is laid down first, a torch is stuck in the ground first. The sea and the lagoons are salt and do nothing, and wading in a river does not drink by itself. A small drop next to the moon shows your thirst: full after a drink, emptying as you get thirsty. Your head hangs a little when you are thirsty.

### Hunger

After about two days without eating you are hungry: slower, and drilling a fire costs more of your rest. After four days you are starving and your rest runs out faster, so you fall asleep exhausted sooner (and if you are thirsty as well, faster still). You never die of it, and it never gets worse than that.

The food is the coconut. Husking one now takes a little longer, about four seconds: first the husk comes off (you get your tuft of fibre if you have room), then you eat the nut. One nut takes away a third of the way to starving and a bit of thirst too, also when you are not hungry. Walk off before you are done and nothing happens; the nut stays. A small half coconut next to the drop shows your hunger: full after a meal, emptying as you get hungry. Coconuts grow back after a few days, so you move along the palms.

### Fire

You need a pile of at least four pieces of dry wood and a tuft of fibre. Stand beside the pile and hold the button (or press **F**): he kneels and drills a fire, which takes about fourteen seconds, costs some of your rest and uses up the tuft. It can fail, and wet wood will not catch. A short press beside the pile just picks it up.

A burning fire needs wood now and then: stand beside it with wood in your arms and press the button to lay a piece on it. Only dry wood goes on a fire: with wet and dry wood in your arms you lay a dry piece, and wet wood alone is just laid down on the ground. A fire holds at most eight pieces: when it is full the button offers nothing to lay on it, and you keep the wood. Stand beside a fire and tally marks above it count the pieces still on it (up to eight; a half-burnt piece is a short stroke, embers get none), and the little tepee of charred wood grows and shrinks with that number. When the wood is gone it burns down to embers, and then goes out. The flood puts out a fire on the wet sand of low water. A fire that goes out leaves its burnt place, ash and charred ends, which stays for about two days and fades; the flood washes it away sooner. It gives no light or warmth, and you walk over it.

**The torch.** With empty hands, press the button beside a burning fire to take a burning brand from it. Holding it, you have no hand free for wood. Press the button to stick it in the ground (when nothing else can be done), and press beside it with empty hands to take it up again. Hold the button beside a dry pile of four or more pieces with the torch in your hand and the pile catches at once, without fibre, so a fire can be carried to a new place. A torch burns about two hours and goes out if you wade into deep water. Every fire and torch near you lights the ground round it at night, not only the nearest one, so a few torches stuck in the sand make a lit path.

### Sleep

The moon in the bottom left corner shows how rested you are: full when rested, a thin sickle when you are worn out. After a day and a half you grow tired and slower, with shorter steps. Being tired, thirsty and hungry all slow you, and they add up (together you walk at about a third of your speed). After two days you fall asleep where you stand.

You can only lie down once you have been awake a while (about half a day; before that the button offers no sleep and **Z** does nothing), although if you are worn out or too thirsty you still collapse and sleep. Then lie down on dry land: hold the button where there is no pile to light (or press **Z**). Sleeping next to a fire lasts the whole night and you wake fully rested. Without a fire the cold wakes you after three hours, only about 40 % rested. Lie down within about a metre of a finished lean-to and the cold sleep lasts six hours and you wake three quarters rested; with a fire close by you sleep the whole night as before, and you recover a quarter faster than by a fire alone. A click, a tap, the button or a walking key wakes you early. The rising flood wakes you too. However a sleep ends, a short line fades in and out in the middle of the screen, such as *Dave wakes. Day 3.*

### Animals

You are not quite alone. Small **crabs** live on the beach, in groups round a few holes in the sand, and more of them are out on the wet sand at low water. They run sideways; come within a few steps and they scuttle into a hole and vanish, and come out again after a while once you have gone. In the shallow river water, in the lagoons and along the coast beyond the surf you may see the dark shapes of **fish**; wade in near them and they dart away, and they come back slowly. Now and then a fish jumps out beyond the surf. By day **seabirds** circle high over the coast and leave in the evening; every few minutes a small flock lands on the beach to peck about, and when you come close they fly up and leave. They are only there to look at: you cannot catch or do anything with them. They are only alive near you, and nothing about them is saved.

At night, from dusk until about an hour before sunrise, **fireflies** drift in small groups at the edges of the forest and along the rivers of the lowland and the rain forest: tiny warm lights that blink slowly, now and then a few together, and that drift aside when you walk through them.

### Day and night

A day lasts twenty minutes. The sun rises in the east and sets in the west, with golden light low in the sky and lilac light at dusk and dawn. The night is dim and moonlit; a fire or torch lights its surroundings. The small marks on screen (the moon, the drop, the row of what you carry, the thumb stick, the action button, the name line) are dark brown by day and turn pale at night.

### Slow computers

On a slow computer the game lowers the quality of its shadows (and, as a last step, how sharply it draws) by itself, a step at a time, until it runs smoothly. It remembers this on that device. There is nothing to set.

## Controls

- **W A S D** or arrow keys: walk; **Shift**: run
- **Click or tap** the ground to walk there; double tap to run. Clicking or tapping a thing (driftwood, a branch, a pile, a coconut, a fire, a torch in the ground) walks to beside it and does nothing else
- **Space** or the ring in the bottom right corner (on a phone above the thumb stick): the action button. A short press picks up, lays down, husks (and eats) a coconut, picks up a branch, feeds a fire, takes or sticks a torch, or drinks, whatever the drawing in the ring shows
- **Hold** the action button (about half a second) to light a pile beside you (or press **F** there), to build a lean-to beside a pile of driftwood and a pile of branches that are close together (or press **F** there), or to sleep (or press **Z**; only after about half a day awake)
- A left click, a tap, the action button or a walking key wakes him; the view controls do not
- **Thumb stick** (phones and tablets only, bottom right): drag from its centre to walk that way, to the rim to run; let go to stop. Pushing the stick also stops whatever he is kneeling at (husking, drinking, drilling a fire), like walking off
- **Q / E**, right mouse drag or two fingers: turn the view; right mouse drag up and down: tilt; mouse wheel, **+ / -** or pinch: zoom (the view is remembered per island)
- **Enter** (or the arrow): confirm your name at the start of an island
- **Shift + `**: start over (forget this island's save and begin again; the name is asked again)
- **`** (backtick): show or hide the developer panel (version, name, frame rate, work time per frame, quality level `q0` to `q4`); while it is shown you can zoom out further, to 25

## More

- [docs/design.md](docs/design.md): what the game is, the art style, the world and the decisions
- [docs/architecture.md](docs/architecture.md): layers, modules, testing and saving
- [docs/versions.md](docs/versions.md): the release log, every version with its short name and what changed
- [docs/handover.md](docs/handover.md): the planning: what is live, what is being built and what is agreed next
- [CLAUDE.md](CLAUDE.md): working agreements
- [prototypes/](prototypes/): the prototypes the game grew out of
