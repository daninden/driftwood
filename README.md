# Driftwood

A stylised, diorama-like game: you are alone on a large, uninhabited island and slowly get to know it. Small, lonely, atmosphere first.

You walk, wade rivers, gather the driftwood the tide brings, husk coconuts for fibre, catch and roast crabs, spear and roast fish, pick berries and bananas, drink from the rivers, make fire and a torch, and sleep when you are tired. The island (600 × 600, seed 1337) is generated from a single number, with terraces, rivers, waterfalls and natural passages through the rock walls.

## Getting started

```
npm install
npx playwright install chromium   once, for the smoke test
npm run dev        development server at http://localhost:5173
npm test           all tests (the full check before every push to main, about 3 minutes)
npm run test:fast  the quick tests only, for feedback while working
npm run test:sim   only the long simulations of Dave alone for ten days
npm run build      dist/ plus dist/driftwood.html (everything in one file)
npm run smoke      quick check in headless Chromium with a few screenshots
npm run smoke:full the same with every screenshot
npm run playtest   a scripted castaway plays several game days in a real browser and reports how it went (run npm run build first)
```

The playtest (`npm run playtest -- --seed 7,1337 --days 10`, after a build) lets a simple bot play: it looks for food and water, gathers wood, makes fire and sleeps, saves and reloads once a day, and writes a short report and a few screenshots into `playtest-out/` (or the folder after `--out`). It is for finding bugs and judging balance, not part of the game.

### Address options

Options go in the address after a `?`, written `name=value` and joined with `&`. For example `?seed=2024&speed=8&time=0.75`.

For playing:

- `seed=2024`: another island (the default is the fixed island, seed 1337). Each island has its own save.
- `new`: start this island over. It starts fresh and `new` disappears from the address again, so a refresh keeps the game.

For testing (not needed to play):

- `spawn=x,z`: start somewhere else on the island.
- `time=t`: start at another time of day (0 is midnight, 0.5 is noon).
- `awake=d`: start as if he had been awake for `d` days.
- `quality=N`: force a picture quality from 0 to 4.
- `speed=N`: run the game N times as fast (1 to 16).

With `spawn`, `time` or `awake` nothing is loaded and nothing is saved.

## How to play

There is no goal, no map and no menu. What you see is the island.

The game remembers where you were. It saves itself as you play, one save per island, in this browser on this device, and picks up where you left off the next time. Nothing to press, nothing to show. The view is remembered too: how far you turned and tilted it and how far you zoomed come back as you left them.

The first time you start an island, the loading screen asks *What is your name?*. Type a name and press Enter (or tap the small arrow); leave it empty and you are the castaway. The name is kept with the island and not asked again; starting over asks again. A small line top left always says who you are and which day it is, such as `Dave, day 1`; it grows clearer for a moment when a new day begins. The day turns at midnight, also while you sleep.

### The action button

Clicking or tapping only walks. Click the ground and he walks there; click a piece of driftwood, a branch, a pile, a coconut or a fire and he walks to beside it (round a lean-to or a pile if one is in the way) and stands there, doing nothing; if something solid such as a lean-to wall lies straight in the way of a click on the ground, he walks round it. Everything he does is done with the **action button** and the small drawings above it: press **Space**, or the small ring in the bottom right corner (on a phone or tablet it sits just above the thumb stick). The ring is faint and empty when there is nothing small to do, and clearer with a drawing inside when there is:

- wood with an arrow up: pick it up (a piece, or from a pile); wood with an arrow down: lay down what you carry
- a half coconut: husk the coconut you stand beside (you eat it when you are hungry, else you carry it), or eat one you carry
- a cluster of berries with an arrow up: pick berries from the bush beside you (you eat them at once when you are hungry, else you carry them); a bunch of bananas with an arrow up: the same for a banana plant
- a plain cluster of berries or bunch of bananas: eat what you carry
- a hand over a hole: dig for a crab that has just hidden in its hole
- a crab over a flame: roast a crab beside a fire and eat it; a fish over a flame: the same for a fish
- a spear: make a spear (an icon of the arc, see *Fish and the spear*); a spear with an arrow down: lay the spear down; a spear with an arrow up: take it up again
- a fish over a line of water: fish with the spear
- a flame over a piece of wood: lay a piece on the fire
- a torch: take a burning brand from the fire, or take up a torch stuck in the ground; a torch with a stroke of ground: stick the torch in the ground
- a drop: drink
- a half shell with a drop over it: fill an empty shell with river water
- a tilted shell with water in it: drink a full shell

A press does the obvious small thing for what you stand beside: what is in your hands decides first, then what is nearest, and laying down comes last. When more than one thing can be done, up to three smaller drawings appear in an arc above the ring (a drink at the water next to a pile, say): click or tap one, or press **1**, **2** or **3** (left to right), to do that instead. The big things are only ever in the arc, so a press never starts them by accident: a flame to light a pile of wood, a small lean-to to build one, the drawing of an upgrade, and a crescent moon to lie down and sleep. Nothing appears when there is only one thing to do. There is no long press. Pressing the button also wakes you.

### Leaving Dave alone

Before Dave sets off to meet a need, a short handwritten thought appears near him: "I need some wood.", "I'm hungry.", "I need a drink." or "The fire's getting low." He then quietly gets on with it, without narrating every pickup or retry. When he wakes, a thought waits until the "Dave wakes" line has faded. The thoughts fade after a few seconds, leave quiet gaps and do not change what he decides to do. They are fixed English text, not recorded speech or an online service. Press **L** to open or close a quiet scroll of every thought shown since this game opened. Each entry starts with the island time as **HH:mm**, without a date; the floating thought has no timestamp. The log is not saved and is empty after a reload. Reading or scrolling it never walks Dave or takes him away from his habits.

Do nothing for half a minute (no key, click or tap; turning, tilting and zooming the view does not count, so you can watch him from any side) and Dave looks after himself, the way he would on any ordinary day. He walks to the river and drinks when he is thirsty and fills his shells, drinks three or four times a day, eats a coconut, berries or a banana at mealtimes (about twice a day), brings driftwood to a pile at home in the afternoon, lights it in the evening if he has a tuft of fibre and keeps the fire going, goes home to his lean-to or his fire and lies down to sleep every evening, and when the tide is low in the afternoon he digs for a crab at a beach he knows and roasts it at the evening fire, makes himself a spear once his lean-to stands (from a branch and a stone he knows) and keeps it lying at his camp, and now and then in the afternoon fetches it, wades into the shallows he knows, spears a fish and lays the spear back at the camp (and he fishes when he is hungry and a fire is burning, if the fish is the cheapest food), and in between he strolls about on his own (along the waterline, to the river, past the palms, to a berry bush), picks up driftwood he finds on the way and brings it home, and only now and then just stands for a while. He finishes a real errand before an ordinary need interrupts it, so a load reaches its pile instead of being left by the river; only severe thirst or hunger makes him drop it. When he goes to fetch wood he picks out the nearest three pieces from where he stands and takes the farthest of them first, then the nearer ones, so his way back leads past the rest; wet wood from the strip of the beach he carries up to three pieces at a time (see below). If he has wood in his arms when something else comes up (a drink, a meal, bed, a walk), he first brings it home and lays it on the right pile (dry wood at the fire, building timber at his house site; wet wood he lays down at the edge of the beach) and only then goes on (if home is very far away by foot, he sets the wood down where he stands instead); only when he is very thirsty or very hungry does he go straight to the river or the food with the wood still in his arms and bring it home afterwards. He can also use an abandoned pile of the right material on ground he knows, but leaves the piles at his fire and home alone. That includes the small piles he lays at the beach edge (below): once their wood is dry he fetches it for the fire. The wood that the sea leaves in the wet strip of the beach never dries there, and the sea takes a pile laid there. So when he walks along a beach he knows (near home or far from it, on a stroll or an exploring trip) and passes wet wood in that strip, he carries up to three pieces a few steps higher and lays them in a small pile just above the line the high water reaches. There the wood dries by itself (rain wets it again in the open), and later he fetches it as dry firewood; for the fire he even prefers such a dry pile at a beach edge to loose wood a little closer by. Once a day, by day, when nothing presses (not at the low-tide crab hour, and not in the morning while his house has work for him), he also sets out on purpose: he walks to the nearest beach he knows where wet wood lies, carries up to three pieces and, if more lies there and there is time, a second load, and is back home before dark. While his lean-to still needs driftwood he brings that wood to the building site instead of the beach edge. He keeps no drying pile at his camp. In the evening he lights the fire when he has four pieces of dry wood and feeds it only when it is nearly out. When it is dark and he sets off from his fire on a longer way (more than fifteen steps) to drink, to bed or to look for food, he takes a burning torch from the fire (not when the fire is low, in the rain, or when the way leads through deep water) and sticks it in the ground when he gets there, where it burns out. A full firewood pile (twelve pieces) makes him wait; at sunset he walks to the shore and sits down to look out. After a few days, when the first two nights are behind him, he begins to build himself a home: in the mornings he looks for an open spot near his fire, a few steps from it, with plenty of room: level, dry ground well above the tide, preferably not far from fresh water, with no palm, rock or pile squeezing in on the shelter and room in front of it and all round for his fire ring and his heaps of material. If he finds no such spot he waits and tries again later, rather than squeeze a shelter in between the trees. He brings driftwood and branches there and builds a lean-to, which opens to the side of his old fire (so his new fire ring ends up a little way from the old one), and then, a piece a day, improves it: side walls of palm fronds, a ring of stones for the fire and a bed. If you have built a lean-to yourself, that one is his home and he only improves it; he never builds a second. If you leave two piles of wood for a lean-to, he builds there only when there is room for it; otherwise he leaves them as material and chooses a spot of his own. You can still build wherever you like. Nothing on the screen tells you; you just see him go about his day, and after a week you find a house standing where there was only a fire.

When he lives by himself he ambles: on his strolls and when he is just passing the time he walks slower than you do, with shorter steps, and he only hurries (at his normal walking pace) for a real need such as a drink, a meal, the fire or going to bed. He also sits down to rest: on the ground, knees drawn up, hat on, looking at the sea or into his fire, at sunset, in the evening by his fire and in his longer rests during the day. He gets up the moment you touch anything and walks off as you ask; you cannot make him sit yourself, and sitting does nothing special, it is only how he rests. On a desktop, **H** chooses whether his hands are yours (**Self**), his at once (**Computer**) or automatic after half a minute (**Auto**, the default). The browser remembers that choice, not the island save.

The moment you touch anything he is yours again, and half a minute of quiet later he takes over once more. He only goes to places where he has been (the island is remembered in coarse squares round everywhere you walked him, forty metres round), and now and then, by day and when nothing is pressing (more often when he is short of wood, branches or coconuts), he goes exploring by himself: a quiet walk to the edge of what he knows, a good way further each day, along the coast or towards the forest, and in time he ranges over the whole island; everything he walks past he knows afterwards. On these day trips he always walks home again before dark, and he stays on his own stretch of ground and does not climb. About once a week, from the fourth day on, he does something bigger when his lean-to stands and the weather is fair: he goes on a journey. On a calm morning, after he has had a drink and something to eat, he sets off for a place he has never been, a long way from home, by the coast or at the edge of the forest, preferably by a river, and this time he does climb the rock routes on the way if they lead there. He looks around as he goes, so everything he sees he knows afterwards, and he eats and drinks what he finds. Before dusk he picks a dry spot, gathers a little wood nearby, lights a small fire with a tuft of fibre if he has one (he husks a coconut for it if he has none) and sleeps on the ground beside it; he builds nothing there. If there is no wood or the fire will not catch, he sleeps cold, and that is a hard night. In the morning he walks home, and the only thing he leaves behind is a burnt place that fades like any fire. He does not go in the rain or when rain is coming, he turns back at once when he gets very thirsty or very hungry, and he only goes where he can find the way back. Apart from that he does not wander off for the fun of it, and he fetches the things for his home (driftwood, branches, palm fronds, stones) only from ground he knows; if there is none within reach, his house waits. He does not build anything else, and the big exploring (climbing up to new terraces) is still yours. If he is thirsty and knows no water, or hungry and knows no food, he goes looking for it himself, walking carefully out from home (downhill for water, along the coast for coconuts); what he walks past he now knows, and once he has found it he only goes where he has been again. He sees about forty metres round him as he walks, so the places he knows are wider than the path itself.

### The island

You are alone. The island rises in terraces, divided by rock walls. A wall stops you, but nature leaves passages: a scree slope, a ravine, rock benches, roots and lianas in the rain forest, or a mossy route beside a waterfall. Nothing marks them; look for loose stones, bare ground and moss. Tree trunks, big boulders and the open sea stop you too. Bushes only slow you down.

### Wind

A light wind moves the palms, trees, bushes and grass near you, and now and then a gust rolls over the island: you see it coming through the trees further off, and the shadows move with the leaves. It is calmer at night and in the rain forest, and strongest on the high terraces. It is only for the eye; it changes nothing in what you do.

### Rivers and the sea

You can wade up to your waist. Upstream, where a river is a narrow brook, you can cross anywhere. Along the middle reach you can cross only at fords, which you can tell by stones sticking out of the water and white rippling water. The deep stretch towards the sea cannot be crossed.

The tide comes in and goes out twice a day. At low water there is more beach to walk on. Your footprints stay clear for a short while, then fade away over about a minute of game time; a sleep moves that time on too. When the flood comes in round you, you can always wade back to shore. The flood wipes out your footprints.

### Driftwood

Pick up driftwood and carry at most three pieces; each one slows you down, and with three you take shorter steps and stoop a little. Lay it down at your feet, alone or on a pile (stand beside the pile and press the button). Wood never goes down in the water: if the spot in front of you is wet, it goes on a dry spot beside you, and if there is none you keep it in your arms. A pile stays where it is, and you can pick it up again once your arms are empty. A pile is solid to its visible edge, so walk round it to pick it up or lay wood on it. A pile holds at most twelve pieces: wood laid on a full pile starts a new pile next to it, but never so close that the piles close in on you: every new pile keeps about half a metre of free walking room from the other piles and fire places (a lean-to's walls are the exception), so you and Dave can always walk between them, and if there is no such spot within a few steps the wood stays in your arms. Stand beside a pile and tally marks appear above it in ink, one stroke for each piece, in bundles of five, with a double line under them when it is full. They fade when you walk away.

Every high water brings some new wood, but you never see it arrive: it lands in the strip between the low-water and the high-water line, under the water. At low water the sea falls back and the wood lies there on the wet sand or in the shallows, and you can pick it up (also standing in the shallows); while the sea covers it completely you can only see it faintly through the water and cannot pick it up, but as soon as a bit of it sticks out of the water you can take it, also from the shallows. It stays wet as long as the sea keeps covering it, so carry it up the beach to dry. Wood you leave lying stays; the next high water only adds new pieces. The sea takes back piles laid on the wet sand of low water. Fresh wood is wet: it looks dark and a little glossy, with a damp patch in the sand under it, and stays that way until it is dry enough to burn; then it quickly bleaches to its own colour. A wet piece will not light a fire, so gather ahead.

### Branches and the lean-to

Under about half of the trees in the lowland and the rain forest lie a few dry branches, thinner and shorter than driftwood and dark, with a twig or two and some dry leaves. Pick them up like driftwood: wood and branches together, at most three at a time, and each one slows you down the same. Each branch you carry also shows as a small twig next to the moon. They are never wet. Lay them on piles of their own (a pile of branches never mixes with driftwood; twelve at most; tally marks as for driftwood). A branch grows back at the same spot after four to eight days. Branches burn too, but half as long as a piece of driftwood: you can feed them to a fire, and a pile of at least four can be lit like a pile of driftwood.

To build a **lean-to**, make a pile of at least six pieces of driftwood and a pile of at least six branches, close together (their middles within two metres). Stand beside either one and click the little lean-to above the button (or press **F**): he builds instead of lighting a fire. It takes six pieces of each out of the piles (the rest stays) and about a minute of play, and it costs about as much of your rest as two attempts to drill a fire. First two forked posts rise, then a ridge pole, then a few branches lean against it as a sloping roof, and last big palm fronds are laid over them. The open side faces the way the camera looks when you start, and stays that way. If you walk off, the half-built lean-to stays where it is; stand beside it and click the little lean-to again to go on building. Its whole back and both sides are solid, even while it is unfinished, but the open front stays clear so you can enter to sleep; Dave uses that opening when he leaves it by himself. You can build more than one. The flood takes a lean-to built on the wet sand of low water. Building works beside any pile of six driftwood that has a pile of six branches within two metres, even when a smaller pile lies nearer to you. The lean-to's inside and the space just in front of its opening stay free of wood: if you lay wood down there it goes into a pile beside the lean-to instead, and when a lean-to is begun, the wood left over in the two piles is gathered into one pile of each kind beside it, so the doorway is never blocked.

### Fronds, stones and a better lean-to

Under about one palm in three lies a dead palm frond, flat on the ground. Pick it up like a branch: it counts towards the three things you can carry under your arm (wood, branches and fronds together), slows you the same, and shows as a small frond next to the moon. A frond is always dry and does not burn. It grows back after four to six days. Fronds have piles of their own, like branches.

Along the river banks and at the foot of rocks lie small grey stones. Carry them in your hands, at most two at a time, apart from the wood; each one slows you like a piece of wood, and shows as a small stone next to the moon. They do not grow back, but there are plenty. They have piles of their own, up to twelve.

With these you can make a finished lean-to better, in any order, each once. Stand beside the lean-to, with the materials in piles within four metres of it, and click the drawing in the arc above the button (or press **F**): it shows what he will build. He builds in steps and uses up one of each material as every step begins; if you walk off, what is done stays, and choosing it again builds on.

- **Side walls** (six fronds): fronds hang down along both sides. Wood and fires stay dry a little further from the lean-to (2.5 and 3 metres), and a cold sleep under it lasts seven hours instead of six, so you wake almost fully rested.
- **A bed** (four branches and four fronds): a low bed of branches and fronds under the roof. You rest a quarter faster when you sleep there.
- **A ring of stones** (eight stones): a ring in front of the open side. A fire inside it burns one and a half times as long, and the rain neither makes it burn faster nor puts it out. When Dave builds his own fire there, he puts it in the middle of the ring.

### Coconut fibre

Coconuts lie under the palms. Stand beside one and press the button: he kneels and husks it, hungry or not, and you get a tuft of fibre, as long as you have room for it. When the husk is off you eat the nut if you are hungry (more than a third of a day since you ate, see Hunger); if you are not hungry you carry it instead (see Shells and coconuts to carry). You can carry at most three tufts; with three he still husks the nut, but gets no fourth tuft. They show as small drawings next to the moon: faint most of the time, clearer for a moment when the number changes. The same row shows each piece of driftwood you carry as a small weathered log, each branch as a twig, each frond as a small frond, each stone as a small stone and each crab as a small crab, each coconut as a small coconut and each half shell as a small bowl.

### Thirst

You get thirsty quickly: after about half a day (ten minutes of play) you are thirsty and clearly slower, with shorter steps; after a day you are very thirsty and your rest runs out twice as fast. After a day and a half you collapse and sleep where you stand, and wake still thirsty. So you drink three or four times a day. You never die.

Drink at a river: stand in the water or on its bank and press the button; you kneel and drink for a few seconds. Wood you carry is laid down first, a torch is stuck in the ground first. The sea and the lagoons are salt and do nothing, and wading in a river does not drink by itself. A small drop next to the moon shows your thirst: full after a drink, emptying as you get thirsty. Your head hangs a little when you are thirsty.

### Shells and coconuts to carry

After you have husked and eaten a coconut you keep its empty half shell, two at most (with two, you do not keep a third). They show in the row as small bowls. At a river, with an empty shell and hardly thirsty, a short press fills a shell instead of drinking (a short kneel, about two seconds); if you are thirsty (more than a twentieth of a day since you drank) or have no empty shell, the press drinks as always. A full shell shows a line of water in it. Away from the water, with your hands empty, a press drinks a full shell when you are thirsty (a little over three hours since you drank): it takes away a third of a day of thirst. Water in a shell does not spoil.

When you are not hungry, a press beside a coconut still husks it (four seconds, and your tuft) but you keep the husked nut instead of eating it, two at most, shown as small coconuts in the row. With two in your arms you eat it anyway. Later, when you are hungry (more than a third of a day since you ate) and your hands are empty with nothing else to do, a press eats a carried coconut (it is already husked, so only about two seconds, the same meal, and the shell, but no new tuft). A press never takes the place of something nearer: laying down or picking up wood, a coconut, a fire and a crab hole come first, and a drink from a shell comes before eating a carried coconut. Shells and coconuts weigh nothing and do not slow you, and carried coconuts do not spoil.

You can also click or tap the small drawing of a carried coconut, a full shell, berries, a banana bunch or a crab in the row next to the moon to use it right away, whether or not you are hungry or thirsty (the crab only beside a fire with flames). He can do this with wood under his arm, but not in the water, with a torch in his hand, while he is busy or asleep; then the drawing just shakes a little. The other drawings (wood, branches, fronds, stones, fibre, empty shells) cannot be clicked.

### Hunger

You eat about twice a day: after about half a day without eating you are hungry, slower, and drilling a fire costs more of your rest (you wake up hungry, as the night is a third of a day). After three days you are starving and your rest runs out faster, so you fall asleep exhausted sooner (and if you are thirsty as well, faster still). You never die of it, and it never gets worse than that.

The food is the coconut. Husking one now takes a little longer, about four seconds: first the husk comes off (you get your tuft of fibre if you have room), then you eat the nut. One nut is a meal: it takes away half a day of hunger and a little thirst too (and when you are not hungry you carry the husked nut with you instead, see above). Walk off before you are done and nothing happens; the nut stays. A small half coconut next to the drop shows your hunger: full after a meal, emptying as you get hungry. Coconuts are few, about one palm in eight has one, and a nut grows back after eight to twelve days, so you search along the palms every day; on the beach alone you can just about feed yourself, and the inland, with its berries, feeds you better.

### Berries and bananas

Away from the coast there is food too. Many of the shrubs of the lowland (about one in five), at the edge of the forest and in the clearings, carry small red and purple berries; you see them on the bush. Stand beside a bush with berries and press the button: when you are hungry (more than a third of a day since you ate) you eat a handful on the spot, and it takes away a sixth of a day of hunger, a snack (six handfuls are a day of eating); otherwise you take it with you, two handfuls at most, shown in the row as a little cluster of berries. Press the button with empty hands when you are hungry and you eat one. Berries spoil: after a day (twenty minutes of play) a carried handful is gone. The bush is bare once picked and bears again after two to four days. Away from the coast you will find enough of them to eat well.

Deep in the rain forest, rare, there are wild banana plants: a short pale trunk with big leaves and, when it bears, a bunch of green-yellow bananas hanging beneath. A bunch is a whole day of hunger: you eat it on the spot when you are hungry, or carry one bunch (a bunch of bananas in the row); a carried bunch keeps three days. The plant grows a new bunch after a week. When you eat what you carry, berries go first (they spoil first), then the bananas, then a coconut.

### Crabs

Crabs live in holes in the sand of the beach, more of them out on the wet sand at low water. Walk up to a colony and the crabs scuttle into their holes. Stand beside a hole one has hidden in (while you stay close it keeps hiding) and press the button: he kneels and digs, about five seconds. About half the time he gets the crab; otherwise you see the crab pop out of the sand a little way off, scuttle away from you and dive into another hole, where it stays hidden a good while longer. You cannot dig again for luck: whether a dig catches is decided by the island and the number of digs so far. At low water, with all the crabs out, there are many more holes to try than at high water.

You can carry two crabs at most, shown as small crabs in the row next to the moon. They do not slow you and do not count against the three pieces of wood. A crab is never eaten raw: beside a fire that has flames (not just embers) press the button and he kneels about eight seconds to roast and eat one. That takes away half a day of hunger, a meal like a coconut. A raw crab you have not roasted within a day (twenty minutes of play) goes bad and is gone from the row. A crab you caught is missing from its colony; it comes back after five to eight days. Walk off before you are done and nothing happens (the crab stays with you).

### Fish and the spear

You can make a spear. Carry one branch under your arm (just the branch, nothing else) and stand beside a stone, a loose one or a pile of stones, on dry ground: a small drawing of a spear appears in the arc above the ring. Click it, or press its number, and he kneels for about ten seconds and makes the spear. The branch is used up; the stone stays where it was. There is only one spear and it never wears out.

He holds the spear in his hand, in place of his staff, and so his hand is full, like with a torch: while you hold it you cannot pick up wood, branches, fronds or stones, or take a torch. The action button lays the spear down at your feet (on dry ground) and takes it up again when you stand beside it. When he lies down to sleep he lays it down beside him.

Wade into the sea where the water is shallow (above the ankle and no deeper than the knee; not in a river) with the spear in your hand and the ring shows a fish. Press it: he stands still, leans over the water, peers and strikes, about three seconds. A little under one try in two brings a fish. You cannot try again for luck: whether a try catches is decided by the island and the number of tries so far, and a try that finds nothing still counts. Walk off before the try is done and nothing happens. The spear catches fish in the sea only, not in the rivers.

You can carry two fish at most, shown as small fish in the row next to the moon, and with two you cannot fish. They do not slow you and do not count against the three pieces of wood. A fish is never eaten raw: beside a fire that has flames press the button, or click the fish in the row, and he kneels about eight seconds to roast and eat it (the one you caught first, if you also carry a crab). That takes away half a day of hunger, a meal like a coconut or a crab. A raw fish you have not roasted within a day (twenty minutes of play) goes bad and is gone from the row.

### Fire

You need a pile of at least four pieces of dry wood and a tuft of fibre. Stand beside the pile and click the flame above the button (or press **F**): he kneels and drills a fire, which takes about fourteen seconds, costs some of your rest and uses up the tuft. It can fail, and wet wood will not catch. The button itself beside the pile just picks it up.

A burning fire needs wood now and then: stand beside it with wood in your arms and press the button to lay a piece on it. Only dry wood goes on a fire: with wet and dry wood in your arms you lay a dry piece, and wet wood alone is just laid down on the ground. A fire holds at most eight pieces: when it is full the button offers nothing to lay on it, and you keep the wood. Stand beside a fire and tally marks above it count the pieces still on it (up to eight; a half-burnt piece is a short stroke, embers get none), and the little tepee of charred wood grows and shrinks with that number. When the wood is gone it sinks to embers. They begin as a warm glow and slowly fade to a few red points over about twelve hours, so dry wood laid on them can wake the fire again without drilling. Only their first hour and a half are warm enough for sleep; in open rain they still hiss out after fifteen minutes. A stone ring keeps embers for half as long again, as it does flames. The flood puts out a fire on the wet sand of low water. A fire that goes out leaves its burnt place, ash and charred ends, which stays for about two days and fades; the flood washes it away sooner. It gives no light or warmth, but its place remains solid, like a burning fire, so you act from its edge.

**The torch.** With empty hands, press the button beside a burning fire to take a burning brand from it. Holding it, you have no hand free for wood. Press the button to stick it in the ground (when nothing else can be done), and press beside it with empty hands to take it up again. Click the flame beside a dry pile of four or more pieces with the torch in your hand and the pile catches at once, without fibre, so a fire can be carried to a new place. A torch burns about two hours and goes out if you wade into deep water. Every fire and torch near you lights the ground round it at night, not only the nearest one, so a few torches stuck in the sand make a lit path.

### Sleep

The moon in the bottom left corner shows how rested you are: full when rested, a thin sickle when you are worn out. You sleep every night. After about sixteen hours awake (a day from dawn to dusk is just short of that) you grow tired and slower, with shorter steps. Being tired, thirsty and hungry all slow you, and they add up (together you walk at about a third of your speed). After a day and a half you fall asleep where you stand.

You can lie down from dusk on (once you have been awake a few hours), and by day once you have been awake half a day, but then it is only a nap: two hours that rest you half as fast. Before that no moon is offered and **Z** does nothing; if you are worn out or too thirsty you still collapse and sleep. Then lie down on dry land: click the moon above the button (or press **Z**). Sleeping next to a fire lasts the whole night and you wake fully rested. Without a fire the cold wakes you after three hours, only a little rested (you can lie down again). Lie down within about a metre of a finished lean-to and the cold sleep lasts six hours and you wake three quarters rested; with a fire close by you sleep the whole night as before, and you recover a quarter faster than by a fire alone. A click, a tap, the button or a walking key wakes you early. The rising flood wakes you too. However a sleep ends, a short line fades in and out in the middle of the screen, such as *Dave wakes. Day 3.*

### Animals

You are not quite alone. Small **crabs** live on the beach, in small groups of two or three round a few holes in the sand, and more of them are out on the wet sand at low water. They run sideways; come within a few steps and they scuttle into a hole and vanish, and come out again after a while once you have gone. In the shallow river water (up to where it runs into the sea), in the lagoons and along the coast beyond the surf you may see the dark shapes of **fish**, big enough to spot at a glance; wade in near them and they dart away, and they come back slowly. Now and then a fish jumps out beyond the surf. By day **seabirds** circle high over the coast and leave in the evening; every few minutes a small flock lands on the beach to peck about, and when you come close they fly up and leave. They are only there to look at: you cannot catch or do anything with them. They are only alive near you, and nothing about them is saved.

At night, from dusk until about an hour before sunrise, **fireflies** drift in small groups at the edges of the forest and along the rivers of the lowland and the rain forest: tiny warm lights that blink slowly, now and then a few together, and that drift aside when you walk through them.

### Rain

Now and then, about once a week of the island's days (never in the first two days), a shower comes: the light turns grey and soft, thin rain falls, rings spread on the water and the ground goes dark and shiny, with the soft hiss of rain in the sound. A shower lasts a minute or two. Wood left out in the open gets wet again, the loose pieces lying about, your piles and what you carry, and wet wood will not burn until it has dried again (branches dry faster than driftwood). A fire in the open burns down fast in the rain and goes out after a few seconds of play with a hiss, leaving wet ash; torches burn out twice as fast. **A lean-to is a roof:** wood within about a metre and a half of a finished lean-to stays dry, and a fire within two metres of it, or a torch there, keeps burning as if it were fine weather. So build the fire next to your shelter.

### Sound

The island has a quiet sound of its own (in the rain you hear the rain, a little softer under a lean-to), made in your browser (there are no sound files), and it depends on where you are. The surf swells and falls back in the rhythm of the water's edge, loud on the beach and faint inland. Near a river you hear it murmur, more at a ford and a rush at a waterfall. A soft wind follows the gusts you see in the trees, with a rustle of leaves near palms and trees and a thin howl on the summit. A fire or torch near you crackles. Your steps sound different on dry sand, wet sand, in the water and on grass, and heavier when you are tired, thirsty, hungry or carrying wood. Husking, drilling a fire and building make their own sounds. Seabirds call when they are near, and at night crickets sing in the forest. It is all quiet on purpose.

Sound begins with your first key press or tap, because browsers do not allow it earlier. Press **M** to turn it off and on, or click or tap the small speaker mark above the moon. The island remembers your choice on that device.

### Day and night

A day lasts twenty minutes. The sun rises in the east, climbs over the south and sets in the west, with golden light low in the sky and lilac light at dusk and dawn. The night is dark and moonlit: you can still just make out the island and Dave, while a fire or torch stands out and catches the nearby water. Daylight shadows fade away at dusk and return at dawn; fire and torch light has no shadows. Fish and the pale movement on the water become hard to see in the dark. The small marks on screen change over a moment at middle dusk and dawn, with their opposite glow kept clear, so they remain readable.

### Slow computers

On a slow computer the game lowers the quality of its shadows (and, as a last step, how sharply it draws) by itself, a step at a time, until it runs smoothly. It remembers its automatic choice on that device. On a desktop, press **G** to choose a fixed quality instead; press it through 0 to 4 once more to return to automatic quality. Phones and tablets stay automatic.

## Controls

- **W A S D** or arrow keys: walk; **Shift**: run, but only for a short while: after about twelve seconds he is out of breath and walks until he has recovered (sooner when he is tired, thirsty, hungry or loaded)
- **H** (desktop): cycle **Self → Computer → Auto → Self**. Self keeps Dave in your hands; Computer gives him his ordinary habits at once; Auto (the default) waits half a minute. Walking, clicking/tapping the world or using an action switches Computer back to Self. The same input takes over temporarily in Auto, which stays selected. Turning, tilting, zooming and developer controls do not change it.
- **L**: open or close Dave's session notes: a scrollable record of his thoughts in this browser session, each with the island time (HH:mm, no date).
- **Leave it alone** for half a minute in Auto and Dave looks after himself (see *Leaving Dave alone*). About once a week that includes a journey: a night away, and home the next morning (if you touch anything he stops and is yours again, wherever he is). While he is on his own he walks slower and sometimes sits down to rest; you walk at your usual speed as soon as you take over
- **Click or tap** the ground to walk there; double tap to run (he gets out of breath like this too). Clicking or tapping a thing (driftwood, a branch, a pile, a coconut, a fire, a torch in the ground) walks to beside it and does nothing else
- **Click or tap a drawing in the row** next to the moon to use it at once: a coconut is eaten (about two seconds), a full shell is drunk, berries and a banana bunch are eaten, and a crab or a fish is roasted and eaten beside a fire with flames. You choose, so you can eat or drink even when you are not hungry or thirsty. Wood, branches, fronds, stones, fibre and empty shells cannot be used this way. If it cannot be done now (no fire for the crab, you are in the water, holding a torch, busy or asleep), nothing happens and the drawing gives a small shake. Clicking the row never makes him walk.
- **Space** or the ring in the bottom right corner (on a phone above the thumb stick): the action button. A press picks up, lays down, husks a coconut (and eats it when you are hungry), eats a carried one, digs for a crab, roasts and eats a crab or a fish, fishes with the spear in shallow sea water, lays the spear down or takes it up, picks up a branch, a frond or a stone, feeds a fire, takes or sticks a torch, or drinks, fills a shell or drinks from one, picks berries or bananas or eats them, whatever the drawing in the ring shows
- **The drawings above the ring** (up to three, when more than one thing can be done): click or tap one, or press **1**, **2** or **3** (left to right). They are the other small things (a drink, a pick-up ...) and the big ones: a flame lights a pile beside you (or press **F** there), a small lean-to builds one beside a pile of driftwood and a pile of branches that are close together, the drawing of an upgrade builds the next upgrade of a finished lean-to beside it when the fronds, branches or stones it needs are in piles within three metres (or press **F** there), and the crescent moon sleeps (or press **Z**; only after about half a day awake). A spear is an icon of the arc too (make a spear, when you carry just a branch and stand beside a stone). The big things are never done by the ring or Space.
- A left click, a tap, the action button or a walking key wakes him; the view controls do not
- **Thumb stick** (phones and tablets only, bottom right): drag from its centre to walk that way, to the rim to run (for a short while); let go to stop. Pushing the stick also stops whatever he is kneeling at (husking, digging, roasting, drinking, filling a shell, drilling a fire), like walking off
- You can turn, tilt and zoom the view while he lives his life by himself: only things that act on him (walking, clicking the world, the action button) give him back to you.
- **Q / E**, right mouse drag or two fingers: turn the view; right mouse drag up and down: tilt; mouse wheel, **+ / -** or pinch: zoom (the view is remembered per island)
- **M**, or a click or tap on the small speaker above the moon: turn sound on or off
- **G** (desktop only): cycle the picture quality from automatic to fixed levels 0 through 4, then back to automatic; the developer panel says whether it is `auto` or `fixed`
- **Enter** (or the arrow): confirm your name at the start of an island
- **Shift + `**: start over (forget this island's save and begin again; the name is asked again)
- **`** (backtick): show or hide the developer panel (version, name, frame rate, work time per frame, quality level `q0` to `q4`, automatic or fixed); while it is shown you can zoom out further, to 25

## More

- [docs/design.md](docs/design.md): what the game is, the art style, the world and the decisions
- [docs/architecture.md](docs/architecture.md): layers, modules, testing and saving
- [docs/versions.md](docs/versions.md): the release log, every version with its short name and what changed
- [docs/handover.md](docs/handover.md): the planning: what is live, what is being built and what is agreed next
- [AGENTS.md](AGENTS.md): working agreements
- [prototypes/](prototypes/): the prototypes the game grew out of
