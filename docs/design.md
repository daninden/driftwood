# Design of Driftwood

This document holds what has been **decided** about the game. Exploring happens in conversation; the results end up here. Keep it short and current: when a decision changes, change it here.

## Concept

A stylised, diorama-like survival game. You are completely alone on a large, wild island that you slowly get to know. The feeling of abandonment stays, but it is deliberately **not** a Robinson Crusoe story.

- **Feeling:** abandonment and loneliness. A small figure in a big landscape of beach, forest and mountain.
- **Tone:** realistic in what you do (no dungeons or fantasy), stylised in how it looks.
- **Core:** gathering, digging and building with driftwood and branches, and getting to know the island terrace by terrace.
- **Tension:** now and then strangers arrive by canoe. You do not know what they want. The threat works through hiding and avoiding, not fighting.
- **Scope:** small and lonely. The atmosphere matters most. New game elements are only added after discussion.

## Art style

Chosen: **style C, hand-painted with outlines.** Stylised and diorama-like, not realistic.

![The four style variants](images/style-variants.jpg)

| Variant | Verdict |
|---|---|
| A · Soft and painterly | Nice, but too sweet |
| B · Sharp low-poly with tilt-shift | Far too harsh |
| C · Hand-painted with outlines | **Chosen** |
| D · Lots of micro-detail | Too dark |
| C1–C4 · C under other light (midday, golden hour, mist, overcast) | The original C stays the favourite |

Explored earlier and dropped: 2D pixel art, plain low-poly and voxels.

![Style C under four kinds of light](images/style-c-lighting.jpg)

- **Colour:** warm, earthy tones. Sand, olive green, weathered wood. All colours live in `src/render/palette.js`.
- **Ground:** a painted texture with brush strokes.
- **Lighting:** toon shading in three light steps, bright midday light, soft warm colour grading. The sun follows its own path through the day (see *Day and night*); it stands still in the world when you turn the view, so shadows stay on the ground.
- **Outlines:** dark brown edges around trees, rocks, palm trunks and the castaway.
- **Detail:** leaf clusters, grass tufts, pebbles, shells and driftwood, at the level of the original style C.
- **Rock walls:** painted in the shader with strata, cracks and ledges, greyer higher up, so the texture never stretches on steep faces.
- **Water (0.14, built):** stylised and subtle, drawn only in the existing water shaders, with no extra objects. The river has light streaks and flecks drifting downstream, faster on steep stretches, fords and falls, and the white water at fords and falls moves. The sea has slow glints and long lines of swell; the surf breathes a little up and down the beach over a few seconds, on top of the tide. Lagoons are calmer. At night only faint moon glints, warm near a fire or torch. Moving water does not count as something happening for the idle frame rate (see *Quiet frames*). As built: river streaks and flecks move at 0.5 m/s in calm water, up to about 3 m/s down falls; the sea's swell tilts the surface slowly (periods of 7 to 15 s) with fine ripples on the crests, so sun, moon and fire glint by themselves (the lights do it: faint and silvery at night, warm by fire and torch), plus faint pale lines by day; lagoons and sheltered bays get a fifth of the motion; the water level breathes up to 4.5 cm every 6 to 11 s, so the surf edge slides a little up and down the beach.

Each terrace has its own colour and vegetation within the same style:

- **Coast:** warm sand, palms with coconuts underneath, bleached driftwood (logs with a branch or a root plate) and a ragged tide line of seaweed with shells and twigs. Graded a little warmer and darker than the rest.
- **Lowland:** open forest, grassland and the river, the green of the original style C.
- **Highland:** dark, mossy rain forest with ferns and a light mist.
- **Mountain plateau:** dry grass, heath, pines and rocks, cooler light.
- **Summit:** grey rock with lichen, less saturated and cool.

No two trees look alike, but all stay within the style and the calm palette (no flowering trees):

- **Heights:** most trees are middling, about one in ten is young and small and about one in ten an old giant: broadleaf trees 1.1–4.4 m, rain forest trees 2–7 m (a few emergent giants stand above the canopy), pines 1–4.4 m, palms 1.7–5 m (the castaway is about 0.75 m). A tall tree gets a thicker trunk and a fuller crown of more leaf clumps, not bigger balls. The height is fixed by the tree's place, so the simple far-away trees have the same height.

- **Palms:** most lean towards the sea, at widely different angles; some stand nearly straight, some bend out and up again, a few lean low. Palms close together often lean apart. Fronds range from fresh green to yellow-green and olive, trunks from grey-brown to sandy. About a quarter carry one or two withered, straw-coloured fronds hanging down; never more.
- **Broadleaf and rain forest trees:** round crowns, wide flat umbrella crowns, tall narrow ones and now and then a forked trunk with two crowns. Crown greens from yellow-green to dark; some trees have grey bark.
- **Bushes:** never one green ball, but a loose clump of smaller leaf clumps in the style of the tier: low, wide dune scrub with stiff blades on the coast, leafy shrubs in the lowland, big leaf fans over a dark core in the rain forest, flat olive heath cushions with wiry sprigs on the plateau, small grey-green tufts on the summit.
- **Pines:** two to four tiers, slim or wide, some leaning a little, in greens from warm to grey-blue.

### Quality that adapts (0.16.2, built)

The look is the same on every device, but the game lowers its own quality when it runs slowly (a laptop with an integrated graphics chip drew 10 to 12 frames a second with the finest shadows). There is no menu and no setting; the only trace is `qN` in the developer panel. Levels, from best, one step at a time:

0. As designed: shadow map 4096 px (2048 on touch-only devices), bilinear shadow filter, drawing at up to 1.5 times the screen's pixel ratio, the ground casts shadows.
1. Shadow map 2048 px.
2. A lighter shadow filter (16 plain taps, the soft edge of 0.13.1 to 0.14.1).
3. Pixel ratio 1.
4. The ground no longer casts shadows (trees, props and the castaway still do).

After the island has faded in, the game measures the time between frames over 3 seconds of normal play (not while idling); below 27 frames a second (30 with a tolerance) it steps down one level, waits 2 seconds for things to settle, and measures again, until it is fine or at level 4. The first 4 seconds are ignored (tiles are still being built). It never steps back up within a session. The level is remembered per device and the next start begins there (and may step further down). A step that changes nothing on this device is skipped (touch devices start at 2048 anyway). The numbers are in `render/quality`.

## The castaway

A small blocky figure with outlines, dressed for a tropical island after a long time alone: a straw hat, shaggy dark hair and a long, unkempt beard, a yellowed shirt with ripped short sleeves, holes and a ragged hem, frayed short trousers, bare sun-tanned legs and bare feet, and a staff. Because the figure is small on screen, the detail lives in the silhouette and in flat colour areas (skin against cloth), not in small parts.

The castaway walks unhurried (2.9 per second) and with Shift (on a touch screen: a double tap) breaks into a calm trot (3.9, about 1⅓ × walking), never a sprint: there is no hurry on the island.

Tree trunks (broadleaf, rain forest, pine and palm), boulders of 0.35 m and larger and the crags in the walls are solid: the castaway bumps into the trunk, not the crown, and slides round it. Grass, roots, small stones and beach finds are walked through or stepped over, and so are stones lying on a climbing route: there you scramble over them. Bushes are pushed through: they slow you to 55 % in the middle and hardly at all when you brush the edge (not on a climbing route).

## Gathering driftwood

The first game element. Driftwood lies on the dry beach above the tide line, a few pieces per stretch of beach, each with its own look (bleached colour, sometimes a side branch or a root plate).

- **Picking up (0.13):** click or tap a piece and the castaway walks to beside it and stands there; the action button (*The action button*) bends him down briefly to pick it up. A finger may tap a little less precisely than a mouse. Clicking, tapping and steering never pick anything up.
- **Carrying:** at most **3 pieces**, under the left arm at their real length (low enough that the head and hat stay readable). Every piece slows walking and running by 12 % (three pieces: 64 %), with shorter steps (each piece takes about 7 % off the stride) and a slight stoop, a forward lean that grows with the load (0.10, built).
- **Laying down (0.13):** the action button, when nothing else can be done: everything carried goes down at the feet, on a pile close by or as a new pile. Not in water. Standing beside a pile with wood in his arm, the button lays the wood on it rather than taking more from it; to take from it again, put the wood down first or walk off.
- **A pile never goes in the water (0.14.1):** a first pile goes a step in front of him; if that spot is wet, a dry spot round him is used (first in the direction he faces, then alternating left and right, clear of other piles); if there is none, he keeps the wood in his arms, as with a full pile that has no room beside it.
- **Piles** stay where they are, and can be picked up again with the action button when his arms are empty (the top pieces first, as many as fit).
- **Pile limit (0.12, built):** a pile holds at most **12 pieces**. Driftwood and branches never share a pile (every pile carries a kind, `driftwood` or `branch`, see *Basic needs*; carried together, each kind is laid on its own piles). Laying wood on a full pile, or on a pile of the other kind, starts a new pile right next to it: about a step away (0.95 m), first in the direction he faces, then round the pile, not in water and clear of other piles. When the pieces do not all fit, as many as fit go on the pile and the rest start the new pile (3 pieces on a pile of 11: 1 goes on it, 2 start a new one). A pile that holds more than 12 in an older save is left as it is: it takes no more wood and can be picked up as usual.
- **Tally marks (0.12, built):** while the castaway stands beside a pile (within about 1.8 m of its middle, a little further than `F` reaches), tally marks in ink show how many pieces it holds, drawn above it in the journal style: five-bar gates (four upright strokes, the fifth across them), with a double line under when the pile is full. They fade in over a third of a second, fade out when he walks away, and are pale ink at night (the shared ink colour). The pile itself visibly grows and shrinks with its count (two pieces to a layer). A fire gets the same marks (see *Fire*).
- No counter for what he carries: what you carry in your hands is what you see; piles and fires get tally marks. Wood is never solid; you walk over it. (Small things carried loose go into the inventory, see *Carrying and the inventory*; wood does not.)
- **New wood with every high water:** each high water washes up one or two new pieces per stretch of beach, on the dry sand above the tide line, each with its own look. They fade in over a few seconds. A stretch of beach never gets more loose wood than it had at the start, so the beach never fills up; your piles do not count. What you gather slowly grows back.
- **The flood takes back** a pile laid on the wet sand of low water, below the high-water line. Wood cannot be laid down in the sea.
- **Wet wood:** what a high water brings is wet and salty: dark when it washes up. It stays clearly wet, darker and cooler grey-brown with a slight wet sheen, until it is dry enough to burn, then bleaches quickly to its own colour, wherever it lies, in a pile or is carried under his arm (0.10, built: wet until three quarters of the day, the dryness at which a torch lights a pile, then bleaching over the next tenth of a day; colour in steps of about half a minute of play). A dark damp patch in the sand, a soft-edged disc somewhat larger than the log, lies under every wet log on the beach, shrinks and fades as the wood dries and is gone once it is dry enough to burn (0.10, built). Piles get no patch: the sea left the sand wet where it left the wood, and a pile has been carried and laid down. The wood that lies on the beach at the start is dry. Only dry wood makes a fire catch, so gathering ahead pays.

## Coconut fibre

A fire needs something that catches first: the dry fibre of a coconut husk.

- **Coconuts** lie under the palms, one to three under about half of them.
- **Husking (0.13):** click or tap a coconut and he walks to beside it; the action button makes him kneel and tear the husk off with his hands (about 4 seconds since 0.15, when he also eats the nut; before that 2½). That gives a meal (see *Basic needs*, Food) and **one tuft of fibre** when he has room for it. Husking is always offered for a nut within reach, also with three tufts: then he still eats the nut (and it grows back as usual) but gets no fourth tuft. Walking off, clicking elsewhere or pushing the thumb stick stops him, and the nut stays where it was.
- **Carrying:** at most **3 tufts**, kept loose in his shorts and not drawn on him; they show in the inventory row (see *Carrying and the inventory*). Fibre weighs nothing.
- **New nuts:** a palm drops a new coconut where an old one lay, three to six days after it was taken.

## Fire

Making fire is deliberately hard: it takes preparation and effort, so a fire that burns is precious.

- **Laying a fire:** a pile of at least **4 pieces** of driftwood on dry ground, laid down as any pile.
- **Lighting it (0.13):** hold the action button for about half a second standing beside the pile (within about 1.2 m of its edge), or press `F` there. With fibre on him, the castaway walks to the pile's side, kneels and twirls his staff upright between his palms as a fire drill, for about **14 seconds**. It is hard work: a whole attempt costs some rest (the moon wanes visibly). Walking off, clicking elsewhere or pushing the thumb stick stops him; the fibre is kept. A short press beside the pile picks it up; only a hold lights it.
- **Whether it catches:** at the end the tuft is used up, and the fire catches or it does not. At best (dry wood, rested) a little more than half the attempts catch. Wet wood makes it much harder (the chance falls with the square of the pile's dryness), fresh wood never catches, and a tired castaway does worse (half the chance at the limit). A failed attempt leaves only a puff of smoke; the pile stays. Whether an attempt catches is fixed by the seed and the number of attempts, so it cannot be retried for luck.
- **Burning:** the pile becomes a little tepee of charred wood with flames and rising smoke. Each piece burns about **2½ hours** of game time, so four pieces last most of a night; a fire holds at most eight pieces' worth. A branch burns half as long (1¼ hours), so it counts as half a piece, as a short stroke in the tally. When the wood is gone it sinks to **embers** that glow for about 1½ hours, then it goes out and you start again. No number: the size of the flames tells how much is left, but tally marks show the count when you stand beside it (below).
- **Keeping it going:** the action button beside a fire while carrying wood lays one piece on it. That also works on the embers. Wet wood cannot be laid on a fire (0.12, built): the button lays one piece that is dry enough to burn; from a mixed load he picks a dry piece and keeps the wet; with only wet wood the button just lays the wood down on the ground. A full fire (8 pieces) takes no more wood (0.13, built): the button offers nothing to lay on it, the piece is not wasted, and with wood in his arm it lays the wood down beside the fire like anywhere else.
- **Tally marks by a fire (0.12, built):** while the castaway stands beside a fire, tally marks in ink above it count the pieces still on it, up to 8, in the same gates as for a pile (double line under when full). A half-burnt piece counts as a short stroke; embers get none. As for piles, they fade when he walks away and are pale ink at night, and the fire's tepee visibly grows and shrinks with the count (one charred piece in the tepee for each piece still on the fire, taller with more).
- **Light:** a fire throws a warm, flickering light round it; at night a soft glow lies round it over the darkness. The light reaches about 14 m for a fire and 9 m for a torch, and sits exactly at the flame (also on the torch in his hand). By day a thin column of grey smoke rises.
- **The flood** puts out a fire laid on the wet sand of low water.
- **Warmth:** a fire close by lets the castaway sleep the night through (see *Sleep*).
- **A torch:** the action button beside a burning fire with empty hands and the castaway takes a burning brand out of it (it costs the fire half a piece's worth; not from embers). He holds it up in his left hand; it lights a small warm circle round him at night and burns about **two hours** of game time. With a torch he has no hand free for wood. The action button sticks it in the ground in front of him when nothing else can be done, where it burns on as a light; beside it, with empty hands, the button takes it up again. Lying down to sleep, he sticks it in the ground first. Wading in deeper than about 30 cm puts it out, and the flood puts out a torch stuck in the wet sand.
- **Lighting with a torch:** hold the action button (or press `F`) beside a pile of at least 4 pieces while holding a torch: the castaway kneels and pushes the torch into it. No fibre and no drilling: dry wood (dry for at least three quarters of the day it takes) always catches, and the torch goes into the fire. Wetter wood only smokes, and he keeps the torch. So a fire, once made, can be carried to a new place.
- Fire is not solid, like wood (see *Known weak spots*). It burns on while the castaway sleeps.

## Ebb and flow

- **Two high waters a day,** as on a real coast: the tide comes round every 12 h 25 min of game time (about 10⅓ minutes of play), so high water falls a little later each day. A game starts on a falling tide, mid-morning.
- At high water the sea stands where it always stood, at the tide line of seaweed. At low water it is **0.4 m lower**: a strip of wet sand falls dry, and you can walk further out, onto the sandbanks of the lagoons. The surf follows the water's edge.
- When the flood comes in round you, you can always wade back to shore; you cannot go further out. Footprints the water covers are wiped out.

## Sleep

- The castaway has to sleep **at least every two days** (40 minutes of play). After a day and a half he is tired: his head and shoulders hang, his arms swing less and he walks slower, down to 60 % at the limit. At two days he falls asleep where he stands.
- **Going to sleep (0.13):** hold the action button for about half a second where nothing can be lit (see *The action button*), or press `Z`. You can sleep anywhere on dry land, not in the water and not on a climbing route, and at any time of day. He first lays down what he carries, then lies on his back with the straw hat over his face.
- **Sleeping by a fire:** with a burning fire (or its embers) within about 3 m, the castaway sleeps the whole night through and wakes fully rested. Without one the sleep is cold: he wakes after **four hours**, about half rested. If the fire goes out while he sleeps, the cold wakes him once he has slept four hours. So a fire that lasts the night is worth the work. Under a lean-to (0.16, see *Basic needs*) the cold sleep lasts six hours and he wakes three quarters rested, and by a fire he also rests 1.25 times as fast.
- **A sleep lasts eight hours** of game time (by a fire); meanwhile time runs **20 times as fast** (about 20 seconds), easing in and out. The sun or moon, the tide and the wood all go on: wood that washes up meanwhile lies there when you wake. A full sleep rests you completely. A left click, a tap, the action button or a walking key (WASD, arrows) wakes you early, only partly rested; turning, tilting or zooming the view does not. The flood wakes you too: you can lie down on the wet sand of low water, but when the rising water reaches you, you wake and get up, only partly rested. Worn out in the water, you wade on and only fall asleep once on dry ground.
- **How long still:** a small moon in the bottom left corner, in the dark brown of the loading screen. Full when rested, it wanes to a thin sickle and to nothing as the two days run out, and waxes again while you sleep. It is faint most of the time and grows clearer in the last half day. No numbers.

## Day and night

- **One day lasts 20 minutes of play.** A game starts in the middle of the morning.
- **The sun** rises in the east, climbs over the south to about 62° and sets in the west. It is up for about 13 minutes. Low sun gives warm golden light and long shadows; at noon the light is plain style C.
- **Dusk and dawn** last about a minute each around the horizon: the light turns lilac and mauve, the warm coast grading fades and colours lose some saturation.
- **Night lasts about 5 minutes and is moonlit:** dark blue and dim, with soft moon shadows, about a third darker than before. Only the moon, a fire and a torch give light, so their circles stand out; the island and the castaway stay readable. Dusk and dawn stay smooth, golden hour is unchanged.
- The shadow light never comes from lower than 15° (0.12.1, built; before 0.12.1 about 11.5°), so shadows stay readable and less extreme at sunrise and sunset. Only the shadow light is lifted: the sun disc and the sky colours follow the true sun.
- **Shadows as built (0.13.1, settings chosen 0.13.2):** the shadow map was 2048 px (see 0.14.2 below), but the shadow camera is fitted tightly round what is seen (`render/shadowFit`): the view box, cut off between 3 m below the castaway and a zoom-dependent height above him (0.8 x zoom, 5..20 m), measured across the light, so with a low sun a texel covers about 3 cm of sand instead of about 9 cm. Shadows of things outside that box (tall palms, hills towards the sun) still fall into the view, because a shadow keeps its place across the light. The size changes in steps of 5 % so turning and zooming do not make edges shift, and the centre snaps to whole texels so walking does not shimmer. The hard three.js PCF is replaced by an own soft filter: 16 taps on a disc of 1.5 texels (3 since 0.14.2), turned per pixel, which makes the stair steps of the map into a soft band while the toon look stays crisp. The light's direction turns in steps of 1/32° (0.11.1 had ¼°, which jerked about a metre with a low sun), so a step moves the tip of a tall palm's shadow only a few centimetres. **Chosen (0.13.2):** the user compared the variants by eye on a phone and chose steps of 1/32°, a minimum shadow-light height of 15°, the soft filter at 1.5 texels and the tight fit. These are now fixed; the comparison parameter and the alternatives are gone. **Soft edges without jaggies (0.14.2):** the shadows still flickered, because each tiny step of the light re-rasterised the map and its jagged texel edges fell slightly differently every time. The fix is to leave no jaggies: the shadow map is 4096 px on desktop and 2048 px on phones (touch-only devices), the filter radius is 3 texels and each tap is a bilinear comparison. The light keeps its 1/32° steps. A cross-fade between two shadow lights was tried and rejected (doubled shadows).
- No clock on screen (only the day number in the day line, see *Decisions*), no stars, moon disc or weather yet. The day drives the tide (see *Ebb and flow*) and sleeping speeds it up (see *Sleep*); what else it should mean for playing is still to be discussed.

## World

Every game gets a new island from a **seed**. **Seed 1337** is the fixed demo. The island is about **600 × 600**: crossing it takes a few minutes of walking, a walk around the coast about a quarter of an hour. You never see it all at once; the camera follows the castaway, but from far enough away that the figure stays small in the landscape.

![Overview of seed 1337](images/island-1337-overview.jpg)

![Four seeds: 1337, 2024, 77 and 4242](images/seeds.jpg)

- **Irregular terraces:** several highlands spread over the island, with rock walls of about 6 m between the terraces.
- **Difficulty rises with height:** coast → lowland → highland with rain forest → mountain plateau → summit. Higher means less food, colder, more wind and mist.
- **Passages:** all natural, because the island is uninhabited: no steps, ropes or posts. You have to find your own way. There are five kinds:
  - a **scree slope** where part of the wall has collapsed
  - a **ravine**, a cleft up through the wall
  - **rock benches**, where the wall breaks into two lower steps
  - a **route beside a waterfall**, over wet, mossy rocks
  - in the rain forest, **roots and lianas** over a lower wall

  You recognise a passage only by nature itself: loose stones, less vegetation, moss. The higher the terrace, the scarcer the passages.
- **Rivers:** run from a highland to the sea. Where they leave a terrace, a waterfall forms. Sometimes a tributary joins. At the mouth the bed flattens out into the sea floor (the carve fades out over 8 m past the mouth, 0.17.1), so the shallows run on smoothly and there is no dark trough offshore.
- **Wading (built):** the castaway wades at most up to his waist, about **0.35 m**; deeper water stops him as the sea does, and he never sinks further than his waist. Upstream, where a river is still a narrow brook, it is shallow and can be waded anywhere. Along the middle reach each river gets **2 to 4 fords**: shallow stretches where the bed rises, recognisable only by nature (stones sticking out of the water, gravel, white rippling water; no markers). The wide, deep stretch towards the sea cannot be waded. So a river is a real border you have to learn. The fords are carved into the bed by the world generation (a deliberate change of seed 1337); the stones and gravel on them are drawn only and never block.
- **Coast:** beaches with palms, rocky shores and lagoons with sandbanks.

![The terraces at game zoom](images/island-1337-terraces.jpg)

![The five passages, and the coast](images/island-1337-passages.jpg)

## The action button (0.13, built)

Too many things happened at a stray click: a torch taken from a fire, a drink at a river he only meant to wade through. So clicking and tapping only walk, and everything he does goes through one action button.

- **Clicking or tapping** the ground or a thing only walks: on a thing (wood, a pile, a coconut, a fire, a torch in the ground) he walks to beside it and stands there, doing nothing. River water and its bank are just ground: he walks to the spot, wading if it lies in the river, so wading through a river just works. The castaway himself is no longer a thing to tap, and holding the ground, a pile or him does nothing.
- **One action button:** **Space** on a keyboard, and an ink ring drawn like the thumb stick (thin dark brown ink, no fills, turning pale at night). On touch-only screens it sits bottom right, just above the thumb stick, inside the safe area; on a desktop in the bottom right corner, where it can also be clicked. Faint (0.45) and empty when there is nothing to do; clear (0.95) with an ink icon inside when there is, fully opaque under a finger (1). Since 0.13.3 (built) the ring holds a faint paper disc (about 0.29 opacity, pale paper by day and dark brown at night), has a soft glow behind it and the icons (strokes 2.2 px, icons about 1.2 times larger: 1.8 times the drawing box alone, 1.25 beside a small hold icon). The button has its own pointer handling: a finger or the mouse on it is never a walk tap or steering, and does not count towards the thumb stick or the two-finger turn and pinch.
- **A short press** (on release) does the obvious thing for what he stands beside: pick up driftwood or from a pile, husk a coconut, lay wood on a fire (dry wood only), take a torch from a fire or take up a planted torch, drink at river water or its bank, and otherwise lay down what he carries or stick the torch in the ground. What is in his hands decides first, then what is nearest: with dry wood beside a fire he feeds the fire, even with a pile next to it; with wood in his arm a pile is laid on, not taken from; laying down (or sticking the torch in the ground) comes last, when nothing else can be done. Reaches: wood, a coconut and a planted torch within about half a metre of his feet (0.55); a pile or a fire within 1.2 m of its edge (as for `F`); fresh river water within 0.8 m, so standing on the bank counts. Drinking with wood in his arm or a torch in his hand first lays the wood down (or sticks the torch in the dry ground beside him) and then kneels; in the water, where wood cannot be laid down, there is nothing to drink with wood in his arm. Pressing while he bends down or kneels does nothing.
- **Holding** the button (about half a second) does the heavy things, so a short press never starts them by accident: light a pile (with the fire drill and fibre, or with a torch in his hand; the pile has at least 4 pieces and he stands on dry ground), build a lean-to (0.16: beside a pile of at least 6 driftwood or 6 branches with the other kind close by, or beside a half-built lean-to; this wins over lighting) and sleep. A small ring round the icon fills while it is held. Beside a pile he could light, the hold lights it (and a short press picks it up, or with a torch in his hand sticks the torch in the ground); lighting wins over sleeping. Anywhere else on dry, walkable ground the hold sleeps; in the water or on a climbing route there is no hold. **F** and **Z** stay as shortcuts for lighting and sleeping.
- **Icons** in the same thin ink as the moon and the drop: wood with an arrow up (pick up) or down (lay down), the half coconut (husk, as in the hunger mark since 0.16; before it was the fibre tuft), a flame over a piece of wood (feed the fire), a torch (take a torch, also take one up), a torch with a stroke of ground (stick it in the ground), the drop (drink), a flame (light, hold), a small lean-to (build, hold, 0.16: two posts, a ridge and a sloping roof) and the crescent moon (sleep, hold). When a short press and a hold both do something (beside a pile of four or more he could light, or whenever he could also lie down), the short-press icon is shown large and the hold icon small beside it; when only a hold does something its icon is shown alone.
- **A full fire** (8 pieces) takes no more wood: the button offers nothing to lay on it, and the piece is not wasted (see *Fire*).
- A press of the button, like a walking key, wakes a sleeping castaway; that press then does nothing more.

## Carrying and the inventory (built)

- **What he holds in his hands is visible in his hands:** driftwood under the arm, the torch, later a bow or a fishing rod in hand.
- **What he carries loose is drawn in the inventory:** a quiet row of small drawings next to the moon mark, in the same dark brown ink, drawn as in a journal: no boxes, frames or numbers. Three tufts of fibre are three little drawings. Later: nails, a knife, and so on.
- The row is faint most of the time (the moon's quiet level) and grows clearer for about 3 seconds when something is added or used up, then eases back over 2 seconds. With nothing carried it is empty.
- Wood and the torch are **not** in the row; they show only in the world. Branches are the exception (0.16): each branch carried is a small drawing of a twig with a leaf in the row, next to the fibre tufts, and it also shows under his arm.
- Limits stay physical (what fits in the hands, at the waist, on the back), not a number of slots.

## Camera and view

- Orthographic: isometric without perspective. It starts rotated 45° and tilted 30° down.
- **Turning and tilting:** the player turns the view freely around (hold `Q` / `E`, or drag with the right mouse button) and tilts it between 25° and 45° (right mouse button up/down). Turning starts and stops softly. No snapping to fixed angles. Not flatter than 25° (without perspective the ground would run on endlessly) and not steeper than 45° (the rock walls and terraces would stop reading). Walking with the keys stays relative to the screen: W always walks away from you. The view angles are saved per island with the game (0.10, built); a new start or an old save starts in the default view, turned 45° and tilted 30°.
- Turning also lets you look behind walls and trees; worth keeping in mind once hiding from the strangers is designed.
- **Never lose the castaway:** vegetation between the camera and the castaway (crowns, pines, palms, bushes, ferns) is thinned out round the figure into a stippled veil (about 1.5 m in radius; the middle keeps some 40% of the leaves, filling in gradually to the edge), so the castaway shows through while the trees stay visible; never a clean hole. It moves smoothly with the castaway; whole trees never switch on or off. Where something solid hides the figure (a rock wall, a boulder, a trunk, a fern right in front), a light stippled silhouette of the castaway shows through.
- **Footprints** in the sand: at most about 80 (some 17 m of trail); the oldest fade out, so the trail thins behind you.
- No plinth while playing.
- The camera stays far enough away that the castaway is small in a big landscape (about 6% of the screen height): zooming in too close shrinks the loneliness.
- **Zooming:** the player can zoom with the mouse wheel or `+` / `-`, between 5 and 10 (it starts at 7). Never closer than that, so the figure always stays small. As a developer aid (0.10), while the dev panel is visible the furthest zoom is 25 and the panel line adds `zoom N` beyond 10; hiding the panel (backtick) brings the normal limit back and a zoom beyond 10 eases back to 10, and a saved zoom beyond 10 is clamped to 10 when the panel is hidden at load. No buttons on screen. The zoom is saved per island with the game too (0.10, built); the view opens straight in the saved pose, without easing in from the default, and is saved shortly (1.5 s) after it stops changing; a new start or an old save starts at 7.
- **Touch screens:** tap to walk to a spot, drag to steer, double tap to run there (hold and drag after the double tap to steer while running). Everything else goes through the action button (see *The action button*). Two fingers: pinch to zoom (same limits), twist to turn the view; the island turns with the fingers, and the castaway stops while two fingers are down. No tilting on a touch screen. **Thumb stick (0.5):** on touch-only devices (a coarse primary pointer and no fine pointer anywhere, so never on a desktop nor on a laptop with a touch screen and a mouse) a thumb stick sits fixed bottom right, inside the safe area, to walk with one finger. It is drawn like the moon mark: a thin dark brown ink ring (about 110 px across) with a dot, no fills, arrows or labels; faint (0.55) most of the time, clearer (0.95) under a thumb (ring 2.2 px with the glow of 0.13.3); the dot follows the thumb inside the ring and springs back on release. Its touch area is a little larger than the ring. Dragging from the centre walks that way relative to the screen, like the walking keys (up is away from the camera, whatever the view angle); a small dead zone (12 %) near the centre does nothing, pushing past 85 % of the radius runs, letting go stops. It wakes a sleeping castaway like a walking key. A finger on the stick is never a tap or steering for the world and does not count towards the two-finger turn and pinch; a second finger elsewhere can still turn or zoom the view, and the stick keeps walking meanwhile. The browser's own page zoom is switched off.
- On a summit the camera zooms out a further 1.6× on top of the player's zoom (at most 14), as a reward for the climb.
- **Almost no interface:** no HUD, map or menu. What you see is the island (the wood you carry, the torch in his hand, how big the flames are). The exceptions are the touch-only thumb stick (see *Touch screens*), the action button (see *The action button*), the faint moon that shows how long you can still go without sleep (see *Sleep*), the inventory row next to it (see *Carrying and the inventory*), the castaway's name (see *Name*), the developer panel (see below), and the loading screen: the word *Driftwood* in a dark brown serif (Georgia) on the sand background, with a thin bar below it that fills as the island is made, and fades out as the island fades in. No percentage, no step names.
- **Name (0.9, built):** the first time an island is started, the loading screen asks one thing under the title: *What is your name?*, in a handwritten-feel italic, with a bare input below it (no frame, only an ink underline and the caret, the loading screen's dark brown) and a small → to tap. Enter or → confirms; an empty answer is fine and means *the castaway*. Loading goes on meanwhile and the island only fades in once the question is answered (if loading is done first, it waits quietly). Up to 20 characters, trimmed. On phones the keyboard comes up. The name is saved with the island and not asked again; starting over (Shift + backtick, `#new`) asks again. The test parameters (`?spawn`, `?time`, `?awake`) skip the question and use *the castaway*.
- **The day line (0.9, built):** one small line in ink top left, inside the safe area, always there: `Dave, day 3` (`The castaway, day 3` without a name). Faint like the moon most of the time, clearer for a few seconds when it first shows and when a new day begins, then easing back (the same curve as the inventory row). Day 1 is the day the game started; the day turns at midnight on the game clock, also while he sleeps.
- **The waking line (0.9, built):** whenever a sleep ends, however it ends (rested, the cold, the flood, a tap), a short line in the middle of the screen fades in and out over about 4 seconds: `Dave wakes. Day 3.` (`The castaway wakes. Day 3.`). Same ink, no box.
- **Readability of the day and waking lines (0.12, built):** the day line grows to about 15 px and the waking line to about 22 px. The day line rests at opacity 0.55 (instead of faint) and goes to 0.9 when a day turns. The waking line peaks at 0.95 and stays for 5 seconds (instead of the 4 seconds above). Both get a soft glow behind the letters in the opposite colour of the ink (pale paper by day, dark at night), with no frame (a text shadow that follows the same day and night blending as the ink).
- **Pale ink at night (0.9, built):** all ink marks (the moon, the inventory row, the thumb stick, the action button, the developer panel, the day line and the waking line) share one colour that follows the light of the day: dark brown by day, a pale warm paper colour at night, blending smoothly through dusk and dawn. The developer panel's light backing turns dark at night so its text stays readable. The loading screen keeps its dark brown.
- **Interface on any ground (0.13.3, built):** every interface element is drawn so that it stays readable on light and on dark ground (sand, green, water, shadow), by day and at night: ink with a soft glow in the opposite colour behind its strokes, strokes thick enough to read, and a faint backing where an element needs one (the action button gets a faint paper disc). Built as: one glow, `--halo` (two soft drop-shadows of `--ink-glow`, 1.5 px and 4 px; `--ink-glow` is pale paper by day and dark brown at night, 0.85) on the action button, thumb stick, moon, drop and fibre tufts; the tally marks get a wider stroke of the glow colour under the ink instead. Strokes: action ring and icons 2.2 px (icons keep their width at any scale), filling ring 2.8, thumb stick ring 2.2, moon rim 1.8, drop 2, fibre 2, tally 1.7 units (about 3.6 px) over a glow stroke of 3.8 units. Resting opacity of the moon, drop and fibre row is 0.5 (was 0.3), peak 0.95. No frames or hard boxes anywhere. This holds for every element added later too.
- **Dev panel:** a developer aid, not part of the game: one faint line top right in the same dark brown ink (`v0.4 · Dev panel · 60 fps`: version, name, frames per second). Visible for now; later it is hidden by default (`DEV_PANEL_VISIBLE`) and the backtick key (`` ` ``) shows and hides it, as it already does now. Since 0.7 it also shows the work time per frame in ms and the word `idle` while the game rests (`v0.7 · Quiet frames · 30 fps · 9 ms · idle`). Not remembered between sessions. The versions are listed in `docs/versions.md`.
- **Quiet frames (0.7):** the game is easy on the battery. On touch-only devices it draws at most 30 frames a second (a desktop is not capped), and on every device at most 15 a second when nothing has happened for about 3 seconds (the castaway standing still, the view settled, no touch, key or wheel). Any input brings the full rate back at once. Fire flicker and the slow sun and tide do not count as something happening, and neither does moving water (0.14, built: the water just moves as fast as frames are drawn).

## Decisions

- **Language:** everything is in English: the game, the code and the documentation.
- **Name:** Driftwood.
- **Engine:** Three.js in the browser for now. A large tiled world works well there. Godot may come later, for example for Steam or a console.
- **Scope of the base:** the island and walking, then atmosphere. The first game elements are gathering driftwood, ebb and flow, sleep, coconut fibre and fire (see above); more only after discussion.
- **Saving (0.6, built):** automatic and silent, no menu and no message. One save **per island** (per seed), kept in the browser's local storage, so it belongs to this browser on this device; another browser or device starts fresh. The game is laid over the generated island at start-up: where he stands, the time, how long he has been awake or asleep, the wood carried, in piles and washed up, the coconuts taken, the fibre, fires, torches. Not saved: footprints, kneeling work in progress. The view (turn, tilt, zoom) is saved per island too (0.10, built) and restored silently at start-up. **Start over** with Shift + backtick (`` Shift+` ``), or by opening the island with `#new` in the address (it starts fresh and `new` is removed from the address again). A save that cannot be read is ignored. A local save is all there is for now; a backend could come later behind the same interface (see `architecture.md`).
- **Working method:** see `CLAUDE.md`.

## Basic needs (water 0.11, food 0.15 and shelter 0.16, all built)

- **General:** the castaway never dies. Needs make him slower and wear him out; at worst he collapses and sleeps, like exhaustion. Each need has a small ink mark in the row next to the moon, always shown (faint like the moon, clearer when it matters), no bars or numbers.
- **Water (0.11 "Water", built):** thirsty after about one day (20 minutes of play), very thirsty after a day and a half. Drinking (0.13): the action button standing at river water or on its bank (within 0.8 m) (wood or a torch is laid down or stuck in the ground first, as before sleep); he kneels and drinks a few seconds and is no longer thirsty. Sea and lagoon water don't help (he doesn't kneel). No carrying water yet.
- **Water effects (built):** thirst is counted in game days and keeps running while he sleeps (a night is a third of a day); thirsty: clearly slower (65 % at the point of collapse, 0.16.1; combined with load, tiredness and hunger); very thirsty: rest runs out twice as fast; after two days he collapses and sleeps, and wakes still thirsty. Mark: a drop that empties (full just after a drink, empty at the collapse), placed between the moon and the row of what he carries, with room for the half coconut right after it; his head hangs a little. After a collapse he wakes at a day and three quarters, so he does not collapse again at once. Drinking needs fresh water: river water above the sea at high water, not the last stretch at the mouth; a tap on the bank counts (a little further than for a piece of wood). There is no key for it, only the button.
- **Food (0.15 "Coconut", built):** hunger is counted in game days since he last ate and keeps running while he sleeps (a night is a third of a day). Hungry after two days, starving after four, where it simply stops (no collapse of its own; he never dies). Husking a coconut now takes 4 seconds (the same kneeling work, no new animation: first the husk, then he eats). When the work is done he has one tuft of fibre and has eaten the nut (always, also when not hungry; no storing for now, may change later): one nut takes away 4/3 day of hunger (a third of the way to starving, never below 0) and a quarter day of thirst. Stopped early (walking off, the thumb stick, a click), nothing happens and the nut stays. Coconuts grow back after some days, so you move along the palms.
- **Food effects (0.15, built):** hungry: drilling fire costs 1.5 times as much rest, and he walks slower (down to 75 % at four days, 0.16.1, multiplied with load, thirst and tiredness); starving: rest runs out 1.5 times as fast (multiplied with thirst's double: both together make 3 times), so he falls asleep exhausted sooner. Mark: a half coconut next to the drop, seen from the side, whose white flesh empties from the top down (full just after eating, empty when starving), faint most of the time, clearer as hunger grows and for a moment after eating, like the drop. **Heavy legs (0.16.1, built):** needs slow him clearly (tired 60 %, thirsty 65 %, hungry 75 % at the worst, each easing in from its own threshold; multiplied together, at the worst about 29 %, and with the load). His steps get shorter with the slowing, as when carrying: stride = 1 - 0.4 x (1 - the combined needs factor), about 72 % at the worst, so he does not shuffle. Later, not decided in detail: crabs at low water, fishing.
- **Branches (0.16 "Lean-to", built):** new material, lying under about half of the broadleaf and rain forest trees (none on the coast, the plateau or the summit): 0 to 2 under a tree, fixed per island by the seed, like the coconuts under the palms (derived from the tree list, so the generated island itself does not change). A branch is thinner and shorter than driftwood (0.8 to 1.2 m, dark bark, one or two side twigs and a few dry leaves) and always dry: never wet, no damp patch. After he takes one it grows back at the same spot 4 to 8 days later (coconuts: 3 to 6). Picked up and carried under the arm like driftwood: the same slowing per piece, and wood and branches together at most three (`CARRY_MAX`). Branches have their own piles (kind `branch`, at most 12, never mixed with driftwood, tally marks as for driftwood) and an own small icon in the inventory row next to the fibre tufts (one per branch carried). They burn too, but half as long as a piece of driftwood (1¼ hours): branches can feed a fire, and a pile of at least 4 branches can be lit like a driftwood pile.
- **Building a lean-to (0.16, built):** the condition is a pile with at least 6 driftwood and a pile with at least 6 branches whose centres are within 2 m of each other. Hold the action button (or press `F`) beside either of them and he builds instead of lighting (building wins over lighting; the button shows a small lean-to as the hold icon). It takes 6 driftwood and 6 branches out of those piles (the rest stays) and the lean-to stands midway between the two piles. He kneels and works for about an hour of game time (about a minute of play) and it costs as much rest as two attempts to drill a fire. Walking off, the thumb stick or a click stops him: the half-built lean-to stays where it is, and holding the button beside it builds on from where it was (no more wood is needed). It rises in steps: first two forked driftwood posts, then a ridge pole, then branches leaning on it as a sloping roof, about 2 m wide and 1.5 m deep. The open side faces the camera at the moment building starts (the heading is stored and stays fixed). A lean-to is not solid: he walks through it, like piles. More than one may be built.
- **Lean-to effect (0.16, built):** it counts when he goes to sleep within about 1 m of the centre of a finished lean-to. Without a fire the cold sleep lasts 6 hours instead of 4 and he wakes about three quarters rested (instead of half). With a fire within 3 m he sleeps the whole night, and he recovers 1.25 times as fast as by a fire alone. The flood takes a lean-to (also a half-built one) that stands on the wet sand of low water, as it takes piles and torches. It is shown only in the world, not in the row.
- **Fire place (with 0.11, built):** after a fire goes out, the burnt place (ash and charred ends) stays visible for about two days, fading slowly, then is gone; the flood washes it away sooner (a fire the flood puts out leaves none), and a new fire lit on it replaces it. It gives no light or warmth and does not block walking.

## Wildlife (0.17 "Wildlife", built)

Atmosphere only: the animals move and react to the castaway (flee, hide, dart, fly up), but nothing can be done with them yet. Catching, cooking on the fire and eating come later. Nothing is saved, there is no sound, and no interface.

- Where they live is fixed per island by the seed, like the trees (`game/habitats`, derived from the world without changing the generated island). They are alive only within about 30 m of the castaway (nothing further away is updated or drawn), instanced, small and simple, in the same toon style with outlines. Moving animals do not count as "something happening" for the 15 fps idle rate (they just animate at whatever rate frames are drawn).
- **Crabs:** about 12 cm (14 cm across with the legs), orange-red body, two claws, little legs, two black eyes. Small groups on the beach with a few holes each, more out on the wet sand at low water: about 45 % of a colony is out at high water, all of it at low water, and a crab whose hole the sea covers is in it. They make short sideways runs near their hole. Within about 3 m they scuttle sideways to the nearest hole and vanish; they come out again 10 to 20 s after he has been more than 5 m away. Also at night. The holes are dark dots in the sand (7 cm across), shut while the sea covers them.
- **Fish:** dark elongated shadows in groups of 2 to 5 in shallow river water (not at falls) and in the shallow lagoons inside the island; in rivers they face upstream with a little wiggle, in lagoons they drift about slowly. When he wades within about 2 m they dart off and fade (not for someone on the bank), stay away 8 to 16 s while he keeps 2.5 m off, and come back slowly (4 s). Over a sandbank at low water there is no fish. Now and then (every half to one and a half minutes, when the sea is in view) a fish jumps just beyond the surf: a small silver fish on an arc of about a second, with a splash where it goes in and where it comes out, in the white-water style (flat white flecks spreading and fading, a few drops thrown up).
- **Birds:** white seabirds with grey wing tips, grey-white tail, orange beak and legs, about 60 cm long and a metre across the wings, flapping and gliding. By day 2 to 4 circle high over each stretch of coast (6 to 9 m up: the camera looks from a low angle, so higher would leave the screen; no shadows); they arrive at dawn (0.20 to 0.27 of the day) and in the evening (0.69 to 0.76) fly off towards the nearest rocky shore and are gone; no birds at night. Every few minutes of play (the first after 90 to 180 s, then every 150 to 300 s, by day, not while he sleeps) a flock of 5 to 8 glides down to flat dry sand 10 to 20 m from him (the birds spread out over a few metres) and pecks about (heads down, little walks). When one is within about 4 m they all fly up, circle and leave towards the rocky shore. Unbothered, a landed flock leaves after 60 to 120 s, and in the evening at once.
- **Shadows:** nothing casts one (crabs and landed birds are too small to be worth the cost, and circling birds must have none); they do receive the light and shade of the scene.
- **Cost:** a pool of instanced meshes refilled every frame, at most 96 crabs, 40 birds and 64 fish shadows, each with its outline mesh; the animals do not follow the quality levels of 0.16.2 (they are cheap).

## Game ideas (not built, not decided)

An early atmosphere prototype tried most of these. They are ideas until we decide otherwise.

| Part | Idea |
|---|---|
| Gathering, later | A barrel of nails at the wreck |
| Digging | The ground really sinks; salt water on the beach, nails at the wreck |
| Building | Lean-to (built in 0.16, see *Basic needs*); fire is built (of driftwood or branches, see *Fire*) |
| Building, later | Rope from lianas or palm fibre, lashing, palisade, storage pit, raft |
| Day and night | At night only the light of your fire; a fire can be seen from far away (also by the strangers) |
| Strangers | A canoe lands on a distant beach and lights a fire; within 10 m they see you and flee; they leave footprints |
| Journal | Messages as journal lines in an 18th-century hand |
| Food, later | Crabs at low water, fishing; storing coconuts |
| Animals, later | Sea turtle laying eggs at night, parrots in the rain forest, lizards on warm rocks, wild goats on the plateau, wild pigs (tension), bats at dusk, fireflies at night, dolphins or whale spouts far out at sea, coconut crab |
| Weather | A storm wrecks your lean-to but washes up new driftwood |
| Map | Filled in by yourself, journal style; only what you have seen |
| Ending | Build a raft and sail away, or stay |

## Open questions

- Who are the strangers (mutineers, slave traders, other castaways)?
- Saving: local only for now (0.6); a backend later?
- Mood per terrace: weather over time (mist in the rain forest, wind on the summit).
- What else should the day/night cycle mean for playing (food, strangers)?
- Should a fire mean anything for the strangers?
- Loneliness: the castaway growing lonelier without a fire, shown without a meter (an idea, to be thought through).

## Known weak spots

- The ravine still reads more like a gully than a cleft; its shape needs to be steeper and narrower.
- Some roots stand slightly off the wall, so their shadow falls loose on the wall.
- Driftwood looks flat from above (more like planks than round logs); a bark texture would help.
- The colour transition between terraces could be softer.
- You can walk straight through a fire, as through wood.
