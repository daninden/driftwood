# Driftwood

A stylised, diorama-like game: a castaway is alone on a large, uninhabited island and slowly gets to know it. You watch him. Small, lonely, atmosphere first.

A language model is his mind (with your own free key): it decides everything he does, one thing at a time. He walks, wades rivers, gathers the driftwood the tide brings, husks coconuts for fibre, catches and roasts crabs, spears and roasts fish, picks berries and bananas, drinks from the rivers, makes fire and a torch, builds himself a home and sleeps when he is tired. The island (600 × 600, seed 1337) is generated from a single number, with terraces, rivers, waterfalls and natural passages through the rock walls.

## Getting started

```
npm install
npx playwright install chromium   once, for the smoke test
npm run dev        development server at http://localhost:5173
npm test           all tests (the full check before every push to main, about 3 minutes)
npm run test:fast  the quick tests only, for feedback while working
npm run test:sim   only the long lives: ten game days on three islands, played by a fixed fake mind
npm run build      dist/ plus dist/driftwood.html (everything in one file)
npm run smoke      quick check in headless Chromium with a few screenshots
npm run smoke:full the same with every screenshot
```

The tests and the smoke tests never ask a real model: the tests play him with a fixed fake mind, and the smoke tests answer every request to the model themselves with a fixed plan. `scripts/ai-playtest.js` plays a game without a browser and writes each request to a file, so that someone (or another model) can answer it by hand; it is for finding what the request lacks, not part of the game.

### Address options

Options go in the address after a `?`, written `name=value` and joined with `&`. For example `?seed=2024&speed=8&time=0.75`.

For playing:

- `seed=2024`: that island. Without it the game goes on with the island you played last; a new game (the first start, `?new`, or Shift + backtick) gets a new random island, and the old island's save is removed. The AI panel shows the island's number, so you can come back to it with `seed=`. Each island has its own save; the key is asked only once for all of them.
- `new`: start this island over. It starts fresh and `new` disappears from the address again, so a refresh keeps the game.

For testing (not needed to play):

- `spawn=x,z`: start somewhere else on the island.
- `time=t`: start at another time of day (0 is midnight, 0.5 is noon).
- `awake=d`: start as if he had been awake for `d` days.
- `quality=N`: force a picture quality from 0 to 4.
- `speed=N`: run the game N times as fast (1 to 16).

With `spawn`, `time` or `awake` nothing is loaded and nothing is saved, and the start screen asks nothing (he then waits for a plan until a key is saved).

## How to play

There is no goal, no map and no menu, and nothing for you to do but watch. What you see is the island, and the castaway on it.

**The start.** The first time, the loading screen asks for *a key for the mind that plays him*: a free key from Google AI Studio (aistudio.google.com/apikey). Paste it and press Enter (or tap the small arrow). The game checks it with one small request; a key that does not work is asked again, with the reason. The key stays in this browser, in its own place, never in the save; once a key works it is not asked again (the AI panel, **I**, can change or remove it; without a key the game cannot go on and the screen asks again). Then, at the first start of an island, it asks *What is your name?*: his name. Leave it empty and he is the castaway. The name is kept with the island and not asked again; starting over asks again. A small line top left always says who he is and which day it is, such as `Dave, day 1`; it grows clearer for a moment when a new day begins. The day turns at midnight, also while he sleeps.

**The game remembers.** It saves itself as he lives, one save per island, in this browser on this device, and picks up where it was the next time. The view is remembered too: how far you turned and tilted it and how far you zoomed come back as you left them.

### His mind

A language model plays him completely: it chooses where he walks and then one thing to do there (drink at the river, fill a shell, husk a coconut, pick up a piece of driftwood, lay it down, light the fire, build a piece of the lean-to, sleep, and so on), in short plans of about an hour of game time (at most twelve steps). The game walks him and does the work, and afterwards tells the model whether each step worked, and why not. It is told only what really happened, and what he could know: a step counts as done only when it did what it was for (a dig that caught nothing failed), and wood he lays down on his own (before drinking or felling, when he lies down to sleep) is told too. It is told the time, the weather, how thirsty, hungry and tired he is, what he carries (and how much room is left under his arm), his home and his fires, what he did lately (what each pick-up took and each lay-down laid, and what he carried after it), the places he has seen with their distance (each keeps the same name as long as it exists, and his own piles say when he laid them), and the rules of the island. A new plan is asked when the last one is done, when a step failed, when it starts to rain, when he collapsed and when he wakes. Nothing overrules the model: if it lets him go thirsty he collapses, and a night without a fire is cold. At sunset it writes down what the day taught him (his lessons, at most ten), and it keeps a few short notes for itself; both are saved with the island.

While the model thinks, the whole island pauses and "thinking…" shows at the top of the screen; when no model answers it tries again after a few seconds, and after several failures (also when the model keeps writing plans the game cannot follow) the line says why and offers a "try again" button. When every model has used up its requests for the day, the line says so and when the budget starts again; when a model is only paused for a moment, it says how long. If the saved key stops working (it was revoked or deleted), the game goes back to the key question of the start screen with a note, so a new key can be pasted also on a phone. When rain starts, he stops what he is doing (a felling keeps the chopping done so far) and the model is asked again. When a plan starts, he says the model's one thought for it above his head, in his own voice: one or two short sentences, on at most two lines; it stays a little longer the longer it is. He never says what he is doing, only why.

Whenever one of the small marks at the bottom changes (he picks something up, lays it down, eats or drinks), the same small drawing shows for a moment above him, so you can see what he just picked up, ate or drank without looking down at the corner. It is always the same size, however far you zoom out, and fades away by itself. Picking up, laying down, eating and drinking take a few seconds, so you can see him do it.

When he walks to a piece of wood, a frond, a stone or a log and picks it up, he takes that piece, not something else that lies closer. His thoughts above his head and his lessons are in plain words: they never use the game's names for places (such as "driftwood1").

He walks to a place only over ground he has seen; a wander (a walk out one way for some minutes) may take him into ground he has not seen yet, and what he walks past he knows afterwards. In the dark he walks only with a burning torch in his hand, or from firelight to firelight. The sections below say how the island works, for him; the model is told the same rules.

### The island

He is alone. The island rises in terraces, divided by rock walls. A wall stops him, but nature leaves passages: a scree slope, a ravine, rock benches, roots and lianas in the rain forest, or a mossy route beside a waterfall. Nothing marks them; look for loose stones, bare ground and moss. Tree trunks, big boulders and the open sea stop him too. Bushes only slow him down.

### Wind

A light wind moves the palms, trees, bushes and grass near him, and now and then a gust rolls over the island: he sees it coming through the trees further off, and the shadows move with the leaves. It is calmer at night and in the rain forest, and strongest on the high terraces. It is only for the eye; it changes nothing in what he does.

### Rivers and the sea

He can wade up to his waist. Upstream, where a river is a narrow brook, he can cross anywhere. Along the middle reach he can cross only at fords, which he can tell by stones sticking out of the water and white rippling water. The deep stretch towards the sea cannot be crossed.

The tide comes in and goes out twice a day. At low water there is more beach to walk on. His footprints stay clear for a short while, then fade away over about a minute of game time; a sleep moves that time on too. When the flood comes in round him, he can always wade back to shore. The flood wipes out his footprints.

### Driftwood

He picks up driftwood and carries at most three pieces; each one slows him down (stones in his hands too, so carrying what he does not need costs him time), and with three he takes shorter steps and stoops a little. He lays it down at his feet, alone or on a pile (standing beside the pile). Wood never goes down in the water: if the spot in front of him is wet, it goes on a dry spot beside him, and if there is none he keeps it in his arms. A pile stays where it is, and he can take from it again whenever he has room (beside a pile with wood in his arms he can lay it down or take more). A pile is solid to its visible edge, so walk round it to pick it up or lay wood on it. A pile holds at most twelve pieces: wood laid on a full pile starts a new pile next to it, but never so close that the piles close in on him: every new pile keeps about half a metre of free walking room from the other piles and fire places (a lean-to's walls are the exception), so he can always walk between them, and if there is no such spot within a few steps the wood stays in his arms. Beside a pile tally marks appear above it in ink, one stroke for each piece, in bundles of five, with a double line under them when it is full. They fade when he walks away.

Every high water brings some new wood, but he never sees it arrive: it lands in the strip between the low-water and the high-water line, under the water. At low water the sea falls back and the wood lies there on the wet sand or in the shallows, and he can pick it up (also standing in the shallows); while the sea covers it completely he can only see it faintly through the water and cannot pick it up, but as soon as a bit of it sticks out of the water he can take it, also from the shallows. It stays wet as long as the sea keeps covering it, so carry it up the beach to dry. Wood he leaves lying stays; the next high water only adds new pieces. The sea takes back piles laid on the wet sand of low water. Fresh wood is wet: it looks dark and a little glossy, with a damp patch in the sand under it, and stays that way until it is dry enough to burn; then it quickly bleaches to its own colour. A wet piece will not light a fire, so gather ahead.

### Branches and the lean-to

Under about half of the trees in the lowland and the rain forest lie a few dry branches, thinner and shorter than driftwood and dark, with a twig or two and some dry leaves. He picks them up like driftwood: wood and branches together, at most three at a time, and each one slows him down the same. Each branch he carries also shows as a small twig next to the moon. They are never wet. He lays them on piles of their own (a pile of branches never mixes with driftwood; twelve at most; tally marks as for driftwood). A branch grows back at the same spot after four to eight days. Branches burn too, but half as long as a piece of driftwood: he can feed them to a fire, and a pile of at least four can be lit like a pile of driftwood.

To build a **lean-to**, he builds it piece by piece, with nothing but what he carries: every part he sees is one piece he brought. With a piece of driftwood under his arm he stands where he wants the lean-to: the middle of it will lie a step behind him. A lean-to starts only where his whole home can stand, the lean-to and later the hut around it: ground that stays dry at high water, fairly level, with no boulder or other lean-to where the hut will go (trees there can be felled for the hut later), and none of his own piles or fire places on the spot (a pile laid there blocks it until it is carried away). Its open side faces the way of the place he chose, else the first way round that fits (it stays that way), and a home stays where it is begun. Until he has begun one, the model is told the places for a home he has seen, with how far the fresh water, the shore and the trees are, so it can look around first. **Build here** (the action `buildHere`): he kneels for about four seconds, the piece is used up and the first post stands. That is how a site begins. A lean-to takes fifteen pieces in this order: four of driftwood (two forked posts, the ridge pole and a sill log at the foot of the roof), then six branches (the roof branches), then five palm fronds (laid over the roof). A site only takes the piece it needs next: with a site in its branch stage a piece of driftwood fits nowhere. He carries a fitting piece up to the site (within about a metre and a half of its middle; the fitting piece can be one of three he carries) and **builds it in** (`buildIn`): four seconds of kneeling, the piece is used up and the next part appears. He builds in every fitting piece he carries, one after another, four seconds each, until the next part needs something he does not carry or the lean-to is finished. Walking off before the end builds nothing and he keeps the piece; the site stays as it is and he can go on any time, with the same or another load. The whole lean-to costs about as much of his rest as two attempts to drill a fire, a fifteenth of that for each piece. Its back and both sides are solid from the fifth part on (the first roof branch), but the open front stays clear so he can enter to sleep; It only gives shelter once it is finished. He can build more than one (no two within about three metres). The flood takes a lean-to built on the wet sand of low water. The lean-to's inside and the space just in front of its opening stay free of wood: if he lays wood down there it goes into a pile beside the lean-to instead. Piles of wood are firewood, the log pile and what he keeps: nothing is built from a pile any more. Building clears the ground: the first piece he builds in (and again the first part of a hut, which is bigger) removes the bushes, grass, ferns and small rocks under the building and in front of its opening for good (berries and bananas growing there are lost), and pushes the loose stones, wood, branches, fronds and coconuts lying there just aside, so nothing is lost.

### Fronds, stones and a better lean-to

Under about one palm in three lies a dead palm frond, flat on the ground. He picks it up like a branch: it counts towards the three things he can carry under his arm (wood, branches and fronds together), slows him the same, and shows as a small frond next to the moon. A frond is always dry and does not burn. It grows back after four to six days. Fronds have piles of their own, like branches.

Along the river banks and at the foot of rocks lie small grey stones. He carries them in his hands, at most two at a time, apart from the wood; each one slows him like a piece of wood, and shows as a small stone next to the moon. They do not grow back, but there are plenty. They have piles of their own, up to twelve.

With these he can make a finished lean-to better, each once, also piece by piece: stand within about two metres of the middle of the finished lean-to with a fitting piece in his arms (a frond, a branch) or hands (a stone) and **upgrades** it (`upgrade`): the piece is used up after about four seconds of kneeling. Every other fitting piece he carries goes in right after it, the same way; if he walks off, what is done stays. The pieces go in the order the upgrade needs them, and when his piece would fit more than one upgrade the first of walls, bed and ring is built (stones fit only the ring).

- **Side walls** (six fronds, three on a side): fronds hang down along both sides. Wood and fires stay dry a little further from the lean-to (2.5 and 3 metres), and a cold sleep under it lasts five hours instead of four, so he wakes a little better rested. A whole night still needs a fire.
- **A bed** (four branches, then four fronds): a low bed of branches, two rails with their legs and two slats, and fronds on it, under the roof. He rests a quarter faster when he sleeps there.
- **A ring of stones** (eight stones): a ring in front of the open side. Once it stands, a fire can only be lit in the ring itself, not right beside it (lighting is not offered for a pile within eight metres of its middle, outside the ring). The middle of the ring is always free for the fire's wood: a pile laid there is never turned away because the lean-to or the hut is close, and fuel laid down new in the ring lies exactly in its middle, so the fire burns in the middle of the ring. A fire inside it burns one and a half times as long, and the rain neither makes it burn faster nor puts it out. Beside a finished ring the fire belongs in the ring: no other fire within about eight metres of it can be lit, and an old one that is still burning there is not fed and burns out.

### The hut

When a lean-to has its side walls, its bed and its stone ring, he can rebuild it into a **hut**, on the same spot, piece by piece, like everything else: a roof of branches and palm fronds over low log walls, about three metres wide and two and a half deep, with a doorway on the side of the stone ring. It takes thirty-two pieces in this order: four logs (the corner posts), eight logs (the low walls: the back, the two sides, each in two rows, and a short log either side of the door), eight branches (the roof frame: a beam at the front, a beam at the back and six rafters) and twelve palm fronds (a thick roof). The hut costs about twice as much of his rest as the lean-to, a thirty-second of that for each piece.

He stands within about two and a half metres of the middle of the lean-to. For the first twelve pieces carry **a log on his shoulder** (see *The axe, felling and logs*: pick up a log from a pile or the ground, carry it alone and slowly; a freshly felled log is green and has to dry two days first) and **builds the hut** (`upgrade` beside the finished home): twelve seconds of kneeling (about a quarter of an hour of game time, and it tires him more than the lean-to did), the log is used up and the first corner post stands. A hut is work for a few days. The other pieces are built in the same way (the little hut with a log or a stick and an arrow down into it): the rest of the logs, then branches, then fronds, each in the order it is needed; a piece that does not fit the next part is not offered. The first piece starts the hut only where it fits: dry, level ground, no other building within about five metres, and no tree, rock, pile, fire or burnt place touching its walls or lying inside it (the stone ring and the lean-to itself do not count). Once it is begun nothing more is checked. While it rises the lean-to keeps its parts and its effects, and he can sleep in it; the posts and walls are solid as they go up, but the doorway stays open. When the last frond is laid the old lean-to's parts go and the hut stands.

In a finished hut a cold sleep lasts the whole night and rests him almost fully, wood inside stays dry, and the rain sounds muffled and dark. **No fire and no torch** can be lit inside it or right by its walls (the stone ring outside keeps its fire). The roof turns see-through, a thin speckle, while he is inside, so he can see where he stands. There is no corner for firewood: a store would be a separate building, later.

### Coconut fibre

Coconuts lie under the palms. Beside one he can husk it: he kneels and husks it, hungry or not, and he gets a tuft of fibre, as long as he has room for it. When the husk is off he eats the nut if he is hungry (more than a third of a day since he ate, see Hunger); if he is not hungry he carries it instead (see Shells and coconuts to carry). He can carry at most three tufts; with three he still husks the nut, but gets no fourth tuft. They show as small drawings next to the moon: faint most of the time, clearer for a moment when the number changes. The same row shows each piece of driftwood he carries as a small weathered log, each branch as a twig, each frond as a small frond, each stone as a small stone and each crab as a small crab, each coconut as a small coconut and each half shell as a small bowl.

### His hands

He has two hands. One can hold the spear, one a burning torch, and under the other arm he carries wood (driftwood, branches or fronds). The axe hangs at his belt and takes no hand. So with the spear in his hand he can still carry wood, and with a torch he can carry wood or hold the spear, but not both. Stones take both hands, so no stones with the spear or a torch. A log on his shoulder takes everything. Felling takes the axe in both hands (no spear, torch, stones or log; wood under his arm is laid down first). Building a piece in and making a tool need the spear and the torch out of his hands. Laying down what he carries and sticking the torch in the ground are always among the drawings.

### Thirst

He gets thirsty quickly: after about half a day (ten minutes of play) he is thirsty and clearly slower, with shorter steps; after a day he is very thirsty and his rest runs out twice as fast. After a day and a half he collapses and sleep where he stands, and wake still thirsty. So he drinks three or four times a day. He never dies.

Drink at a river whenever he likes, thirsty or not: in the water or on its bank he kneels and drinks for a few seconds. Wood he carries is laid down first, a torch is stuck in the ground first. The sea and the lagoons are salt and do nothing, and wading in a river does not drink by itself. A small drop next to the moon shows his thirst: full after a drink, about half full some eight hours after it, a quarter when he is thirsty, and empty when he is about to collapse. The drop gets clearer as it empties. His head hangs a little when he is thirsty.

### Shells and coconuts to carry

After he has husked and eaten a coconut he keeps its empty half shell, two at most (with two, he does not keep a third). They show in the row as small bowls. At a river, with an empty shell and hardly thirsty, he can fill a shell instead of drinking (a short kneel, about three seconds); if he is thirsty (more than a twentieth of a day since he drank) or has no empty shell, he drinks. A full shell shows a line of water in it. Away from the water he can drink a full shell he carries (a little over three hours since he drank): it takes away a third of a day of thirst. Water in a shell does not spoil.

When he is not hungry, husking a coconut still (four seconds, and his tuft) but he keeps the husked nut instead of eating it, two at most, shown as small coconuts in the row. With two in his arms he eats it anyway. Later he can eat a carried coconut (it is already husked, so only about three seconds, the same meal, and the shell, but no new tuft). Shells and coconuts weigh nothing and do not slow him, and carried coconuts do not spoil.

He can also eat or drink a carried coconut, a full shell, berries, a banana bunch or a crab right away, anywhere, whether or not he is hungry or thirsty (the crab only beside a fire with flames). He can do this with wood under his arm, but not in the water, with a torch in his hand, while he is busy or asleep; then the drawing just shakes a little.

### Hunger

He eats about twice a day: after about half a day without eating he is hungry, slower, and drilling a fire costs more of his rest (he wakes up hungry, as the night is a third of a day). After three days he is starving and his rest runs out faster, so he falls asleep exhausted sooner (and if he is thirsty as well, faster still). He never dies of it, and it never gets worse than that.

The food is the coconut. Husking one now takes a little longer, about four seconds: first the husk comes off (he gets his tuft of fibre if he has room), then he eats the nut. One nut is a meal: it takes away half a day of hunger and a little thirst too (and when he is not hungry he carries the husked nut with him instead, see above). If he walks off before he is done nothing happens; the nut stays. A small half coconut next to the drop shows his hunger in the same way: full after a meal, about half full some ten hours after it, a quarter when he is hungry, and empty when he is starving; it too gets clearer as it empties. Coconuts are few, about one palm in eight has one, and a nut grows back after eight to twelve days, so he searches along the palms every day; on the beach alone he can just about feed himself, and the inland, with its berries, feeds him better.

### Berries and bananas

Away from the coast there is food too. Many of the shrubs of the lowland (about one in five), at the edge of the forest and in the clearings, carry small red and purple berries; he sees them on the bush. Beside a bush with berries he picks them: when he is hungry (more than a third of a day since he ate) he eats a handful on the spot, and it takes away a sixth of a day of hunger, a snack (six handfuls are a day of eating); otherwise he takes it with him, two handfuls at most, shown in the row as a little cluster of berries; with two handfuls already he eats it anyway. With empty hands, when he is hungry, he eats one; and he can eat what he carries whenever he likes (also with a torch in his hand or standing in water). Berries spoil: after a day (twenty minutes of play) a carried handful is gone. The bush is bare once picked and bears again after two to four days. Away from the coast he will find enough of them to eat well.

Deep in the rain forest, rare, there are wild banana plants: a short pale trunk with big leaves and, when it bears, a bunch of green-yellow bananas hanging beneath. A bunch is a whole day of hunger: he eats it on the spot when he is hungry, or carry one bunch (a bunch of bananas in the row); a carried bunch keeps three days. The plant grows a new bunch after a week. When he eats what he carries, berries go first (they spoil first), then the bananas, then a coconut.

### Crabs

Crabs live in holes in the sand of the beach, more of them out on the wet sand at low water. When he walks up to a colony the crabs scuttle into their holes. Stand beside a hole one has hidden in (while he stays close it keeps hiding) and dig: he kneels and digs, about five seconds. At first about half the time he gets the crab (more often with practice, see *Practice*); otherwise he sees the crab pop out of the sand a little way off, scuttle away from him and dive into another hole, where it stays hidden a good while longer. He cannot dig again for luck: whether a dig catches is decided by the island and the number of digs so far. At low water, with all the crabs out, there are many more holes to try than at high water.

He can carry two crabs at most, shown as small crabs in the row next to the moon. They do not slow him and do not count against the three pieces of wood. A crab is never eaten raw: beside a fire that has flames (not just embers) he kneels about eight seconds to roast and eat one. That takes away half a day of hunger, a meal like a coconut. A raw crab he has not roasted within a day (twenty minutes of play) goes bad and is gone from the row. A crab he caught is missing from its colony; it comes back after five to eight days. If he walks off before he is done nothing happens (the crab stays with him).

### Fish and the spear

He can make a spear. With a branch under his arm, beside a stone (a loose one or a pile of stones), on dry ground, he can make a spear (`makeSpear`). Then he lays down whatever else he carries, kneels for about ten seconds and makes the spear. The branch is used up; the stone stays where it was. There is only one spear and it never wears out.

He holds the spear in his hand, in place of his staff, and so his hand is full, like with a torch: while he holds it he cannot pick up wood, branches, fronds or stones, or take a torch. He can lay the spear down at his feet (on dry ground) and take it up again when he stands beside it. When he lies down to sleep he lays it down beside him.

Where the sea is shallow (above the ankle and no deeper than the knee; not in a river), with the spear in his hand, he can fish. Then he stands still, leans over the water with the point of the spear down, peers and strikes, about three seconds. At first a little under one try in two brings a fish (more with practice, see *Practice*). He cannot try again for luck: whether a try catches is decided by the island and the number of tries so far, and a try that finds nothing still counts. If he walks off before the try is done nothing happens. The spear catches fish in the sea only, not in the rivers.

He can carry two fish at most, shown as small fish in the row next to the moon, and with two he cannot fish. They do not slow him and do not count against the three pieces of wood. A fish is never eaten raw: beside a fire that has flames he kneels about eight seconds to roast and eat it (the one he caught first, if he also carries a crab). That takes away half a day of hunger, a meal like a coconut or a crab. A raw fish he has not roasted within a day (twenty minutes of play) goes bad and is gone from the row.

### Practice

Dave gets better with practice. The more often he tries to light a fire with the drill, dig for a crab or spear a fish, the better he gets at it: quickly at first, then more slowly, until after a few dozen tries he is good at it, though never perfect. Every try counts, the ones that fail too, and what he has learned he never forgets (it is kept in the save). Nothing is shown for it: he only notices that it fails less often as the days go by. Wet wood still never catches, and a tired Dave still drills worse.

### Fire

He needs a pile of at least four pieces of dry wood (driftwood or branches: a pile of stones or fronds does not burn) and a tuft of fibre. Beside the pile he can light it: he kneels and drills a fire, which takes about fourteen seconds, costs some of his rest and uses up the tuft. It can fail, less often the more he has tried (see *Practice*), and wet wood will not catch.

A burning fire needs wood now and then: beside it with wood in his arms he lays a piece on it (`feed`). Only dry wood goes on a fire: with wet and dry wood in his arms he lays a dry piece, and wet wood alone is just laid down on the ground. A fire holds at most eight pieces: when it is full nothing more can be laid on it, and he keeps the wood. Beside a fire tally marks above it count the pieces still on it (up to eight; a half-burnt piece is a short stroke, embers get none), and the little tepee of charred wood grows and shrinks with that number. When the wood is gone it sinks to embers. They begin as a warm glow and slowly fade to a few red points over about twelve hours, so dry wood laid on them can wake the fire again without drilling. Only their first hour and a half are warm enough for sleep; in open rain they still hiss out after fifteen minutes. A stone ring keeps embers for half as long again, as it does flames. The flood puts out a fire on the wet sand of low water. A fire that goes out leaves its burnt place, ash and charred ends, which stays for about two days and fades; the flood washes it away sooner. It gives no light or warmth, but its place remains solid, like a burning fire, so he acts from its edge.

**The torch.** Beside a burning fire he can take a burning brand from it. Holding it, his other arm is free for wood: he can pick up driftwood, branches and fronds, lay them down and put them on a fire with the torch in his hand, but no stones. With wood under his arm, or with the spear in his hand, he can still take a torch; not with the axe, and not with both. He can always stick it in the ground, and beside a torch in the ground take it up again. With the torch in his hand, lighting a dry pile of four or more pieces makes it catch at once, without fibre, so a fire can be carried to a new place. A torch burns about two hours and goes out if he wades into deep water. Every fire and torch near him lights the ground round it at night, not only the nearest one, so a few torches stuck in the sand make a lit path.

### Sleep

The moon in the bottom left corner shows how rested he is: full when rested, a thin sickle when he is worn out. He sleeps every night. After about sixteen hours awake (a day from dawn to dusk is just short of that) he grows tired and slower, with shorter steps. Being tired, thirsty and hungry all slow him, and they add up (together he walks at about a third of his speed). After a day and a half he falls asleep where he stands.

He can lie down from dusk on (once he has been awake a few hours), and by day once he has been awake half a day, but then it is only a nap: two hours that rest him half as fast. Before that he cannot lie down; if he is worn out or too thirsty he still collapses and sleep. Then he lies down on dry land. Sleeping next to a fire lasts the whole night and he wakes fully rested. Without a fire the cold wakes him after three hours, only a little rested (he can lie down again). Lying down within about a metre of a finished lean-to, the cold sleep lasts four hours and he wakes about half rested (the lean-to keeps the warmth of a fire, it does not replace it); with a fire close by he sleeps the whole night as before, and he recovers a quarter faster than by a fire alone. The rising flood wakes him too. However a sleep ends, a short line fades in and out in the middle of the screen, such as *Dave wakes. Day 3.*

### Animals

He is not quite alone. Small **crabs** live on the beach, in small groups of two or three round a few holes in the sand, and more of them are out on the wet sand at low water. They run sideways; come within a few steps and they scuttle into a hole and vanish, and come out again after a while once he has gone. In the shallow river water (up to where it runs into the sea), in the lagoons and along the coast beyond the surf he may see the dark shapes of **fish**, big enough to spot at a glance; wade in near them and they dart away, and they come back slowly. Now and then a fish jumps out beyond the surf. By day **seabirds** circle high over the coast and leave in the evening; every few minutes a small flock lands on the beach to peck about, and when he comes close they fly up and leave. They are only there to look at: he cannot catch or do anything with them. They are only alive near him, and nothing about them is saved.

At night, from dusk until about an hour before sunrise, **fireflies** drift in small groups at the edges of the forest and along the rivers of the lowland and the rain forest: tiny warm lights that blink slowly, now and then a few together, and that drift aside when he walks through them.

### Rain

Now and then, about once a week of the island's days (never in the first two days), a shower comes: the light turns grey and soft, thin rain falls, rings spread on the water and the ground goes dark and shiny, with the soft hiss of rain in the sound. A shower lasts a minute or two. Wood left out in the open gets wet again, the loose pieces lying about, his piles and what he carries, and wet wood will not burn until it has dried again (branches dry faster than driftwood). A fire in the open burns down fast in the rain and goes out after a few seconds of play with a hiss, leaving wet ash; torches burn out twice as fast. **A lean-to is a roof:** wood within about a metre and a half of a finished lean-to stays dry, and a fire within two metres of it, or a torch there, keeps burning as if it were fine weather. So build the fire next to his shelter.

### Sound

The island has a quiet sound of its own (in the rain you hear the rain, a little softer under a lean-to), made in your browser (there are no sound files), and it depends on where he is. The surf swells and falls back in the rhythm of the water's edge, loud on the beach and faint inland. Near a river he hears it murmur, more at a ford and a rush at a waterfall. A soft wind follows the gusts he sees in the trees, with a rustle of leaves near palms and trees and a thin howl on the summit. A fire or torch near him crackles. His steps sound different on dry sand, wet sand, in the water and on grass, and heavier when he is tired, thirsty, hungry or carrying wood. Husking, drilling a fire and building make their own sounds. Seabirds call when they are near, and at night crickets sing in the forest. It is all quiet on purpose.

Sound begins with your first key press or tap, because browsers do not allow it earlier. Press **M** to turn it off and on, or click or tap the small speaker mark above the moon. The game remembers your choice on that device.

### Day and night

A day lasts twenty minutes. The sun rises in the east, climbs over the south and sets in the west, with golden light low in the sky and lilac light at dusk and dawn. The night is dark and moonlit: you can still just make out the island and Dave, while a fire or torch stands out and catches the nearby water. Daylight shadows fade away at dusk and return at dawn; fire and torch light has no shadows. Fish and the pale movement on the water become hard to see in the dark. The small marks on screen change over a moment at middle dusk and dawn, with their opposite glow kept clear, so they remain readable.

### Slow computers

On a slow computer the game lowers the quality of its shadows (and, as a last step, how sharply it draws) by itself, a step at a time, until it runs smoothly. It remembers its automatic choice on that device. On a desktop, press **G** to choose a fixed quality instead; press it through 0 to 4 once more to return to automatic quality. Phones and tablets stay automatic.

### The axe, felling and logs

He can make an axe. With a branch under his arm (anything else he carries is laid down first), beside a stone (a loose one or a pile of stones) on dry ground, and a tuft of coconut fibre with him, he can make an axe (`makeAxe`). Then he kneels for about ten seconds and makes the axe. The branch, the stone and the fibre are used up. There is only one axe and it never wears out.

Once made, the axe hangs at his belt: you see it tucked in on his back, the head up behind his shoulder. It is always with him and he never lays it down, so it is never in the way of carrying wood, stones or a log, a torch or the spear.

With the axe at his belt and both hands free, stand beside a tree (any tree: palm, pine, broadleaf, a giant) on dry ground, and he can fell it. Then he takes the axe in both hands and chops, standing, for about a minute of play (an hour of game time) and it tires him like building a lean-to. If he walks off, the work he did is kept. Then the tree falls, away from him, and it is gone for good: nothing grows back. No stump is left in the way, only a flat pale mark on the ground that he walks over. The trunk becomes a log of about two metres (a giant gives two or three), lying where the tree fell. The crown leaves what he would find under it: a palm leaves fronds and a coconut or two, other trees a few branches. Lying logs do not block he; he steps over them.

A log is heavy. He picks it up with nothing else in his arms or hands and carries it alone on his shoulder, slowly, and he cannot run with it. Laid down, it goes on a pile of logs, at most twelve in a pile, never mixed with other wood; from a pile he takes a dry log first, if there is one. Logs never rot, never burn and the sea does not take them, and he cannot put them on the fire or use them for the lean-to. They are timber for the hut (see *The hut*). A freshly felled log is green: it has to dry for two days (wherever it lies) before it can go into the hut, so the hut is something for later days.

**In the dark.** He walks only with a burning torch in his hand (taken from a fire with flames, which costs the fire half a piece of wood; it burns about two hours, twice as fast in rain), or between places that both lie in the light of a burning fire or of a torch stuck in the ground; without light he stays where he is. A walk that would end after dusk counts too. Sleeping and fishing are plans of their own: he sleeps until he wakes, and fishes for the minutes the model chooses until he catches a fish.

## Controls

You only watch; nothing you press acts on him.

- **Q / E**, right mouse drag or two fingers: turn the view; right mouse drag up and down: tilt; mouse wheel, **+ / -** or pinch: zoom (the view is remembered per island)
- **M**, or a click or tap on the small speaker above the moon: turn sound on or off
- **G** (desktop only): cycle the picture quality from automatic to fixed levels 0 through 4, then back to automatic; the developer panel says whether it is `auto` or `fixed`
- **I**: show or hide the AI panel. Closed it is one line: the model in use with how many of its requests are spent today, and any problem in red; the small cog opens the key (paste a new one to change it, or **remove key**: the game stops and asks for a key again) and the model details. Open it shows a "Now" line (the step he is doing, or that he waits for a plan), the current plan with a marker at the running step and ticks or crosses on the finished ones, and every request, newest first (why it was asked, his thought, the steps, or what went wrong; a click shows the full request and answer). A "Memory" block shows his notes and his lessons. "copy log" copies the last request as the model saw it and every plan of the last two game days; "download log" saves the whole logbook of this game as a file (`driftwood-log-<seed>-day<N>.jsonl`, never your key; kept in this browser until you start a new game, at most about 20 MB). Only the state of the game is sent (no key, and of you only the name you gave him: "the castaway" if you gave none); on Google's free tier prompts may be used by Google to improve its products.
- **Enter** (or the arrow): confirm the key and his name on the start screen
- **Shift + `**: start over (forget this island's save and begin again; the name is asked again, the key is kept)
- **`** (backtick): show or hide the developer panel (version, name, frame rate, work time per frame, quality level `q0` to `q4`, automatic or fixed); while it is shown you can zoom out further, to 25

## More

- [docs/design.md](docs/design.md): what the game is, the art style, the world and the decisions
- [docs/architecture.md](docs/architecture.md): layers, modules, testing and saving
- [docs/versions.md](docs/versions.md): the release log, every version with its short name and what changed
- [docs/handover.md](docs/handover.md): the planning: what is live, what is being built and what is agreed next
- [AGENTS.md](AGENTS.md): working agreements
- [prototypes/](prototypes/): the prototypes the game grew out of
