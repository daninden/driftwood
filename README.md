# Driftwood

A stylised, diorama-like game: you are alone on a large, uninhabited island and slowly get to know it. Small, lonely, atmosphere first.

You walk, wade rivers, gather the driftwood the tide brings, husk coconuts for fibre, catch and roast crabs, pick berries and bananas, drink from the rivers, make fire and a torch, and sleep when you are tired. The island (600 × 600, seed 1337) is generated from a single number, with terraces, rivers, waterfalls and natural passages through the rock walls.

## Getting started

```
npm install
npx playwright install chromium   once, for the smoke test
npm run dev        development server at http://localhost:5173
npm test           unit tests
npm run build      dist/ plus dist/driftwood.html (everything in one file)
npm run smoke      quick check in headless Chromium with a few screenshots
npm run smoke:full the same with every screenshot
npm run playtest   a scripted castaway plays several game days in a real browser and reports how it went (run npm run build first)
```

The playtest (`npm run playtest -- --seed 7,1337 --days 10`, after a build) lets a simple bot play: it looks for food and water, gathers wood, makes fire and sleeps, saves and reloads once a day, and writes a short report and a few screenshots into `playtest-out/` (or the folder after `--out`). It is for finding bugs and judging balance, not part of the game.

Another island: add `#seed-2024` to the address. Start an island over: add `new` (`#new`, or `#seed-2024&new`); it starts fresh and `new` disappears from the address again.

## How to play

There is no goal, no map and no menu. What you see is the island.

The game remembers where you were. It saves itself as you play, one save per island, in this browser on this device, and picks up where you left off the next time. Nothing to press, nothing to show. The view is remembered too: how far you turned and tilted it and how far you zoomed come back as you left them.

The first time you start an island, the loading screen asks *What is your name?*. Type a name and press Enter (or tap the small arrow); leave it empty and you are the castaway. The name is kept with the island and not asked again; starting over asks again. A small line top left always says who you are and which day it is, such as `Dave, day 1`; it grows clearer for a moment when a new day begins. The day turns at midnight, also while you sleep.

### The action button

Clicking or tapping only walks. Click the ground and he walks there; click a piece of driftwood, a branch, a pile, a coconut or a fire and he walks to beside it and stands there, doing nothing. Everything he does is done with the **action button**: press **Space**, or the small ring in the bottom right corner (on a phone or tablet it sits just above the thumb stick). The ring is faint and empty when there is nothing to do, and clearer with a small drawing inside when there is:

- wood with an arrow up: pick it up (a piece, or from a pile); wood with an arrow down: lay down what you carry
- a half coconut: husk the coconut you stand beside (you eat it when you are hungry, else you carry it), or eat one you carry
- a cluster of berries with an arrow up: pick berries from the bush beside you (you eat them at once when you are hungry, else you carry them); a bunch of bananas with an arrow up: the same for a banana plant
- a plain cluster of berries or bunch of bananas: eat what you carry
- a hand over a hole: dig for a crab that has just hidden in its hole
- a crab over a flame: roast a crab beside a fire and eat it
- a flame over a piece of wood: lay a piece on the fire
- a torch: take a burning brand from the fire, or take up a torch stuck in the ground; a torch with a stroke of ground: stick the torch in the ground
- a drop: drink
- a half shell with a drop over it: fill an empty shell with river water
- a tilted shell with water in it: drink a full shell

A short press does the obvious thing for what you stand beside: what is in your hands decides first, then what is nearest, and laying down comes last. Some things take a **hold** (about half a second): hold the button to light a pile of wood (a flame) to build a lean-to (a small lean-to), or to lie down and sleep (a crescent moon). A thin ring fills round the drawing while you hold, so a short press never starts them by accident. When a short press and a hold both do something, the drawing of the short press is large and the one of the hold small beside it. Pressing the button also wakes you.

### The island

You are alone. The island rises in terraces, divided by rock walls. A wall stops you, but nature leaves passages: a scree slope, a ravine, rock benches, roots and lianas in the rain forest, or a mossy route beside a waterfall. Nothing marks them; look for loose stones, bare ground and moss. Tree trunks, big boulders and the open sea stop you too. Bushes only slow you down.

### Wind

A light wind moves the palms, trees, bushes and grass near you, and now and then a gust rolls over the island: you see it coming through the trees further off, and the shadows move with the leaves. It is calmer at night and in the rain forest, and strongest on the high terraces. It is only for the eye; it changes nothing in what you do.

### Rivers and the sea

You can wade up to your waist. Upstream, where a river is a narrow brook, you can cross anywhere. Along the middle reach you can cross only at fords, which you can tell by stones sticking out of the water and white rippling water. The deep stretch towards the sea cannot be crossed.

The tide comes in and goes out twice a day. At low water there is more beach to walk on. When the flood comes in round you, you can always wade back to shore. The flood wipes out your footprints.

### Driftwood

Pick up driftwood and carry at most three pieces; each one slows you down, and with three you take shorter steps and stoop a little. Lay it down at your feet, alone or on a pile (stand beside the pile and press the button). Wood never goes down in the water: if the spot in front of you is wet, it goes on a dry spot beside you, and if there is none you keep it in your arms. A pile stays where it is, and you can pick it up again once your arms are empty. A pile holds at most twelve pieces: wood laid on a full pile starts a new pile right next to it. Stand beside a pile and tally marks appear above it in ink, one stroke for each piece, in bundles of five, with a double line under them when it is full. They fade when you walk away.

Every high water brings some new wood, but you never see it arrive: it lands in the strip between the low-water and the high-water line, under the water. At low water the sea falls back and the wood lies there on the wet sand or in the shallows, and you can pick it up (also standing in the shallows); while the sea covers it completely you can only see it faintly through the water and cannot pick it up, but as soon as a bit of it sticks out of the water you can take it, also from the shallows. It stays wet as long as the sea keeps covering it, so carry it up the beach to dry. Wood you leave lying stays; the next high water only adds new pieces. The sea takes back piles laid on the wet sand of low water. Fresh wood is wet: it looks dark and a little glossy, with a damp patch in the sand under it, and stays that way until it is dry enough to burn; then it quickly bleaches to its own colour. A wet piece will not light a fire, so gather ahead.

### Branches and the lean-to

Under about half of the trees in the lowland and the rain forest lie a few dry branches, thinner and shorter than driftwood and dark, with a twig or two and some dry leaves. Pick them up like driftwood: wood and branches together, at most three at a time, and each one slows you down the same. Each branch you carry also shows as a small twig next to the moon. They are never wet. Lay them on piles of their own (a pile of branches never mixes with driftwood; twelve at most; tally marks as for driftwood). A branch grows back at the same spot after four to eight days. Branches burn too, but half as long as a piece of driftwood: you can feed them to a fire, and a pile of at least four can be lit like a pile of driftwood.

To build a **lean-to**, make a pile of at least six pieces of driftwood and a pile of at least six branches, close together (their middles within two metres). Stand beside either one and hold the button (or press **F**): he builds instead of lighting a fire. It takes six pieces of each out of the piles (the rest stays) and about a minute of play, and it costs about as much of your rest as two attempts to drill a fire. First two forked posts rise, then a ridge pole, then a few branches lean against it as a sloping roof, and last big palm fronds are laid over them. The open side faces the way the camera looks when you start, and stays that way. If you walk off, the half-built lean-to stays where it is; stand beside it and hold the button to go on building. It is not solid: you walk through it. You can build more than one. The flood takes a lean-to built on the wet sand of low water.

### Fronds, stones and a better lean-to

Under about one palm in three lies a dead palm frond, flat on the ground. Pick it up like a branch: it counts towards the three things you can carry under your arm (wood, branches and fronds together), slows you the same, and shows as a small frond next to the moon. A frond is always dry and does not burn. It grows back after four to six days. Fronds have piles of their own, like branches.

Along the river banks and at the foot of rocks lie small grey stones. Carry them in your hands, at most two at a time, apart from the wood; each one slows you like a piece of wood, and shows as a small stone next to the moon. They do not grow back, but there are plenty. They have piles of their own, up to twelve.

With these you can make a finished lean-to better, in any order, each once. Stand beside the lean-to, with the materials in piles within three metres of it, and hold the button (or press **F**): the picture on the button shows what he will build. He builds in steps and uses up one of each material as every step begins; if you walk off, what is done stays, and holding the button again builds on.

- **Side walls** (six fronds): fronds hang down along both sides. Wood and fires stay dry a little further from the lean-to (2.5 and 3 metres), and a cold sleep under it lasts seven hours instead of six, so you wake almost fully rested.
- **A bed** (four branches and four fronds): a low bed of branches and fronds under the roof. You rest a quarter faster when you sleep there.
- **A ring of stones** (eight stones): a ring in front of the open side. A fire inside it burns one and a half times as long, and the rain neither makes it burn faster nor puts it out.

### Coconut fibre

Coconuts lie under the palms. Stand beside one and press the button: he kneels and husks it, hungry or not, and you get a tuft of fibre, as long as you have room for it. When the husk is off you eat the nut if you are hungry (more than half a day since you ate, see Hunger); if you are not hungry you carry it instead (see Shells and coconuts to carry). You can carry at most three tufts; with three he still husks the nut, but gets no fourth tuft. They show as small drawings next to the moon: faint most of the time, clearer for a moment when the number changes. The same row shows each piece of driftwood you carry as a small weathered log, each branch as a twig, each frond as a small frond, each stone as a small stone and each crab as a small crab, each coconut as a small coconut and each half shell as a small bowl.

### Thirst

After about a day (twenty minutes of play) you are thirsty and clearly slower, with shorter steps; after a day and a half you are very thirsty and your rest runs out twice as fast. After two days you collapse and sleep where you stand, and wake still thirsty. You never die.

Drink at a river: stand in the water or on its bank and press the button; you kneel and drink for a few seconds. Wood you carry is laid down first, a torch is stuck in the ground first. The sea and the lagoons are salt and do nothing, and wading in a river does not drink by itself. A small drop next to the moon shows your thirst: full after a drink, emptying as you get thirsty. Your head hangs a little when you are thirsty.

### Shells and coconuts to carry

After you have husked and eaten a coconut you keep its empty half shell, two at most (with two, you do not keep a third). They show in the row as small bowls. At a river, with an empty shell and hardly thirsty, a short press fills a shell instead of drinking (a short kneel, about two seconds); if you are thirsty (more than a tenth of a day since you drank) or have no empty shell, the press drinks as always. A full shell shows a line of water in it. Away from the water, with your hands empty, a press drinks a full shell when you are thirsty (more than a quarter of a day since you drank): it takes away half a day of thirst. Water in a shell does not spoil.

When you are not hungry, a press beside a coconut still husks it (four seconds, and your tuft) but you keep the husked nut instead of eating it, two at most, shown as small coconuts in the row. With two in your arms you eat it anyway. Later, when you are hungry (more than half a day since you ate) and your hands are empty with nothing else to do, a press eats a carried coconut (it is already husked, so only about two seconds, the same meal, and the shell, but no new tuft). A press never takes the place of something nearer: laying down or picking up wood, a coconut, a fire and a crab hole come first, and a drink from a shell comes before eating a carried coconut. Shells and coconuts weigh nothing and do not slow you, and carried coconuts do not spoil.

You can also click or tap the small drawing of a carried coconut, a full shell, berries, a banana bunch or a crab in the row next to the moon to use it right away, whether or not you are hungry or thirsty (the crab only beside a fire with flames). He can do this with wood under his arm, but not in the water, with a torch in his hand, while he is busy or asleep; then the drawing just shakes a little. The other drawings (wood, branches, fronds, stones, fibre, empty shells) cannot be clicked.

### Hunger

After about two days without eating you are hungry: slower, and drilling a fire costs more of your rest. After four days you are starving and your rest runs out faster, so you fall asleep exhausted sooner (and if you are thirsty as well, faster still). You never die of it, and it never gets worse than that.

The food is the coconut. Husking one now takes a little longer, about four seconds: first the husk comes off (you get your tuft of fibre if you have room), then you eat the nut. One nut takes away a third of the way to starving and a bit of thirst too (and when you are not hungry you carry the husked nut with you instead, see above). Walk off before you are done and nothing happens; the nut stays. A small half coconut next to the drop shows your hunger: full after a meal, emptying as you get hungry. Coconuts are few, about one palm in five has one, and a nut grows back after six to ten days, so you search along the palms every day.

### Berries and bananas

Away from the coast there is food too. Many of the shrubs of the lowland, at the edge of the forest and in the clearings, carry small red and purple berries; you see them on the bush. Stand beside a bush with berries and press the button: when you are hungry (more than half a day since you ate) you eat a handful on the spot, and it takes away a third of a day of hunger; otherwise you take it with you, two handfuls at most, shown in the row as a little cluster of berries. Press the button with empty hands when you are hungry and you eat one. Berries spoil: after a day (twenty minutes of play) a carried handful is gone. The bush is bare once picked and bears again after two to four days.

Deep in the rain forest, rare, there are wild banana plants: a short pale trunk with big leaves and, when it bears, a bunch of green-yellow bananas hanging beneath. A bunch is a whole day of hunger: you eat it on the spot when you are hungry, or carry one bunch (a bunch of bananas in the row); a carried bunch keeps three days. The plant grows a new bunch after a week. When you eat what you carry, berries go first (they spoil first), then the bananas, then a coconut.

### Crabs

Crabs live in holes in the sand of the beach, more of them out on the wet sand at low water. Walk up to a colony and the crabs scuttle into their holes. Stand beside a hole one has hidden in (while you stay close it keeps hiding) and press the button: he kneels and digs, about five seconds. About half the time he gets the crab; otherwise you see the crab pop out of the sand a little way off, scuttle away from you and dive into another hole, where it stays hidden a good while longer. You cannot dig again for luck: whether a dig catches is decided by the island and the number of digs so far. At low water, with all the crabs out, there are many more holes to try than at high water.

You can carry two crabs at most, shown as small crabs in the row next to the moon. They do not slow you and do not count against the three pieces of wood. A crab is never eaten raw: beside a fire that has flames (not just embers) press the button and he kneels about eight seconds to roast and eat one. That takes away two thirds of a day of hunger, half of what a coconut does. A raw crab you have not roasted within a day (twenty minutes of play) goes bad and is gone from the row. A crab you caught is missing from its colony; it comes back after five to eight days. Walk off before you are done and nothing happens (the crab stays with you).

### Fire

You need a pile of at least four pieces of dry wood and a tuft of fibre. Stand beside the pile and hold the button (or press **F**): he kneels and drills a fire, which takes about fourteen seconds, costs some of your rest and uses up the tuft. It can fail, and wet wood will not catch. A short press beside the pile just picks it up.

A burning fire needs wood now and then: stand beside it with wood in your arms and press the button to lay a piece on it. Only dry wood goes on a fire: with wet and dry wood in your arms you lay a dry piece, and wet wood alone is just laid down on the ground. A fire holds at most eight pieces: when it is full the button offers nothing to lay on it, and you keep the wood. Stand beside a fire and tally marks above it count the pieces still on it (up to eight; a half-burnt piece is a short stroke, embers get none), and the little tepee of charred wood grows and shrinks with that number. When the wood is gone it burns down to embers, and then goes out. The flood puts out a fire on the wet sand of low water. A fire that goes out leaves its burnt place, ash and charred ends, which stays for about two days and fades; the flood washes it away sooner. It gives no light or warmth, and you walk over it.

**The torch.** With empty hands, press the button beside a burning fire to take a burning brand from it. Holding it, you have no hand free for wood. Press the button to stick it in the ground (when nothing else can be done), and press beside it with empty hands to take it up again. Hold the button beside a dry pile of four or more pieces with the torch in your hand and the pile catches at once, without fibre, so a fire can be carried to a new place. A torch burns about two hours and goes out if you wade into deep water. Every fire and torch near you lights the ground round it at night, not only the nearest one, so a few torches stuck in the sand make a lit path.

### Sleep

The moon in the bottom left corner shows how rested you are: full when rested, a thin sickle when you are worn out. After a day and a half you grow tired and slower, with shorter steps. Being tired, thirsty and hungry all slow you, and they add up (together you walk at about a third of your speed). After two days you fall asleep where you stand.

You can only lie down once you have been awake a while (about half a day; before that the button offers no sleep and **Z** does nothing), although if you are worn out or too thirsty you still collapse and sleep. Then lie down on dry land: hold the button where there is no pile to light (or press **Z**). Sleeping next to a fire lasts the whole night and you wake fully rested. Without a fire the cold wakes you after three hours, only about 40 % rested. Lie down within about a metre of a finished lean-to and the cold sleep lasts six hours and you wake three quarters rested; with a fire close by you sleep the whole night as before, and you recover a quarter faster than by a fire alone. A click, a tap, the button or a walking key wakes you early. The rising flood wakes you too. However a sleep ends, a short line fades in and out in the middle of the screen, such as *Dave wakes. Day 3.*

### Animals

You are not quite alone. Small **crabs** live on the beach, in small groups of two or three round a few holes in the sand, and more of them are out on the wet sand at low water. They run sideways; come within a few steps and they scuttle into a hole and vanish, and come out again after a while once you have gone. In the shallow river water (up to where it runs into the sea), in the lagoons and along the coast beyond the surf you may see the dark shapes of **fish**, big enough to spot at a glance; wade in near them and they dart away, and they come back slowly. Now and then a fish jumps out beyond the surf. By day **seabirds** circle high over the coast and leave in the evening; every few minutes a small flock lands on the beach to peck about, and when you come close they fly up and leave. They are only there to look at: you cannot catch or do anything with them. They are only alive near you, and nothing about them is saved.

At night, from dusk until about an hour before sunrise, **fireflies** drift in small groups at the edges of the forest and along the rivers of the lowland and the rain forest: tiny warm lights that blink slowly, now and then a few together, and that drift aside when you walk through them.

### Rain

Now and then, about once a week of the island's days (never in the first two days), a shower comes: the light turns grey and soft, thin rain falls, rings spread on the water and the ground goes dark and shiny, with the soft hiss of rain in the sound. A shower lasts a minute or two. Wood left out in the open gets wet again, the loose pieces lying about, your piles and what you carry, and wet wood will not burn until it has dried again (branches dry faster than driftwood). A fire in the open burns down fast in the rain and goes out after a few seconds of play with a hiss, leaving wet ash; torches burn out twice as fast. **A lean-to is a roof:** wood within about a metre and a half of a finished lean-to stays dry, and a fire within two metres of it, or a torch there, keeps burning as if it were fine weather. So build the fire next to your shelter.

### Sound

The island has a quiet sound of its own (in the rain you hear the rain, a little softer under a lean-to), made in your browser (there are no sound files), and it depends on where you are. The surf swells and falls back in the rhythm of the water's edge, loud on the beach and faint inland. Near a river you hear it murmur, more at a ford and a rush at a waterfall. A soft wind follows the gusts you see in the trees, with a rustle of leaves near palms and trees and a thin howl on the summit. A fire or torch near you crackles. Your steps sound different on dry sand, wet sand, in the water and on grass, and heavier when you are tired, thirsty, hungry or carrying wood. Husking, drilling a fire and building make their own sounds. Seabirds call when they are near, and at night crickets sing in the forest. It is all quiet on purpose.

Sound begins with your first key press or tap, because browsers do not allow it earlier. Press **M** to turn it off and on, or click or tap the small speaker mark above the moon. The island remembers your choice on that device.

### Day and night

A day lasts twenty minutes. The sun rises in the east and sets in the west, with golden light low in the sky and lilac light at dusk and dawn. The night is dim and moonlit; a fire or torch lights its surroundings. The small marks on screen (the moon, the drop, the row of what you carry, the thumb stick, the action button, the name line) are dark brown by day and turn pale at night.

### Slow computers

On a slow computer the game lowers the quality of its shadows (and, as a last step, how sharply it draws) by itself, a step at a time, until it runs smoothly. It remembers this on that device. There is nothing to set.

## Controls

- **W A S D** or arrow keys: walk; **Shift**: run, but only for a short while: after about twelve seconds he is out of breath and walks until he has recovered (sooner when he is tired, thirsty, hungry or loaded)
- **Click or tap** the ground to walk there; double tap to run (he gets out of breath like this too). Clicking or tapping a thing (driftwood, a branch, a pile, a coconut, a fire, a torch in the ground) walks to beside it and does nothing else
- **Click or tap a drawing in the row** next to the moon to use it at once: a coconut is eaten (about two seconds), a full shell is drunk, berries and a banana bunch are eaten, and a crab is roasted and eaten beside a fire with flames. You choose, so you can eat or drink even when you are not hungry or thirsty. Wood, branches, fronds, stones, fibre and empty shells cannot be used this way. If it cannot be done now (no fire for the crab, you are in the water, holding a torch, busy or asleep), nothing happens and the drawing gives a small shake. Clicking the row never makes him walk.
- **Space** or the ring in the bottom right corner (on a phone above the thumb stick): the action button. A short press picks up, lays down, husks a coconut (and eats it when you are hungry), eats a carried one, digs for a crab, roasts and eats one, picks up a branch, a frond or a stone, feeds a fire, takes or sticks a torch, or drinks, fills a shell or drinks from one, picks berries or bananas or eats them, whatever the drawing in the ring shows
- **Hold** the action button (about half a second) to light a pile beside you (or press **F** there), to build a lean-to beside a pile of driftwood and a pile of branches that are close together, to build the next upgrade of a finished lean-to beside it when the fronds, branches or stones it needs are in piles within three metres (or press **F** there), or to sleep (or press **Z**; only after about half a day awake)
- A left click, a tap, the action button or a walking key wakes him; the view controls do not
- **Thumb stick** (phones and tablets only, bottom right): drag from its centre to walk that way, to the rim to run (for a short while); let go to stop. Pushing the stick also stops whatever he is kneeling at (husking, digging, roasting, drinking, filling a shell, drilling a fire), like walking off
- **Q / E**, right mouse drag or two fingers: turn the view; right mouse drag up and down: tilt; mouse wheel, **+ / -** or pinch: zoom (the view is remembered per island)
- **M**, or a click or tap on the small speaker above the moon: turn sound on or off
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
