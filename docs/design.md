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
- **Water (0.14, decided, not built yet):** stylised and subtle, drawn only in the existing water shaders, with no extra objects. The river has light streaks and flecks drifting downstream, faster on steep stretches, fords and falls, and the white water at fords and falls moves. The sea has slow glints and long lines of swell; the surf breathes a little up and down the beach over a few seconds, on top of the tide. Lagoons are calmer. At night only faint moon glints, warm near a fire or torch. Moving water does not count as something happening for the idle frame rate (see *Quiet frames*).

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

## The castaway

A small blocky figure with outlines, dressed for a tropical island after a long time alone: a straw hat, shaggy dark hair and a long, unkempt beard, a yellowed shirt with ripped short sleeves, holes and a ragged hem, frayed short trousers, bare sun-tanned legs and bare feet, and a staff. Because the figure is small on screen, the detail lives in the silhouette and in flat colour areas (skin against cloth), not in small parts.

The castaway walks unhurried (2.9 per second) and with Shift (on a touch screen: a double tap) breaks into a calm trot (3.9, about 1⅓ × walking), never a sprint: there is no hurry on the island.

Tree trunks (broadleaf, rain forest, pine and palm), boulders of 0.35 m and larger and the crags in the walls are solid: the castaway bumps into the trunk, not the crown, and slides round it. Grass, roots, small stones and beach finds are walked through or stepped over, and so are stones lying on a climbing route: there you scramble over them. Bushes are pushed through: they slow you to 55 % in the middle and hardly at all when you brush the edge (not on a climbing route).

## Gathering driftwood

The first game element. Driftwood lies on the dry beach above the tide line, a few pieces per stretch of beach, each with its own look (bleached colour, sometimes a side branch or a root plate).

- **Picking up (0.13):** click or tap a piece and the castaway walks to beside it and stands there; the action button (*The action button*) bends him down briefly to pick it up. A finger may tap a little less precisely than a mouse. Clicking, tapping and steering never pick anything up.
- **Carrying:** at most **3 pieces**, under the left arm at their real length (low enough that the head and hat stay readable). Every piece slows walking and running by 12 % (three pieces: 64 %), with shorter steps (each piece takes about 7 % off the stride) and a slight stoop, a forward lean that grows with the load (0.10, built).
- **Laying down (0.13):** the action button, when nothing else can be done: everything carried goes down at the feet, on a pile close by or as a new pile. Not in water. Standing beside a pile with wood in his arm, the button lays the wood on it rather than taking more from it; to take from it again, put the wood down first or walk off.
- **Piles** stay where they are, and can be picked up again with the action button when his arms are empty (the top pieces first, as many as fit).
- **Pile limit (0.12, built):** a pile holds at most **12 pieces**. Driftwood and branches never share a pile (branches come with the lean-to; every pile carries a kind, `driftwood` for now). Laying wood on a full pile, or on a pile of the other kind, starts a new pile right next to it: about a step away (0.95 m), first in the direction he faces, then round the pile, not in water and clear of other piles. When the pieces do not all fit, as many as fit go on the pile and the rest start the new pile (3 pieces on a pile of 11: 1 goes on it, 2 start a new one). A pile that holds more than 12 in an older save is left as it is: it takes no more wood and can be picked up as usual.
- **Tally marks (0.12, built):** while the castaway stands beside a pile (within about 1.8 m of its middle, a little further than `F` reaches), tally marks in ink show how many pieces it holds, drawn above it in the journal style: five-bar gates (four upright strokes, the fifth across them), with a double line under when the pile is full. They fade in over a third of a second, fade out when he walks away, and are pale ink at night (the shared ink colour). The pile itself visibly grows and shrinks with its count (two pieces to a layer). A fire gets the same marks (see *Fire*).
- No counter for what he carries: what you carry in your hands is what you see; piles and fires get tally marks. Wood is never solid; you walk over it. (Small things carried loose go into the inventory, see *Carrying and the inventory*; wood does not.)
- **New wood with every high water:** each high water washes up one or two new pieces per stretch of beach, on the dry sand above the tide line, each with its own look. They fade in over a few seconds. A stretch of beach never gets more loose wood than it had at the start, so the beach never fills up; your piles do not count. What you gather slowly grows back.
- **The flood takes back** a pile laid on the wet sand of low water, below the high-water line. Wood cannot be laid down in the sea.
- **Wet wood:** what a high water brings is wet and salty: dark when it washes up. It stays clearly wet, darker and cooler grey-brown with a slight wet sheen, until it is dry enough to burn, then bleaches quickly to its own colour, wherever it lies, in a pile or is carried under his arm (0.10, built: wet until three quarters of the day, the dryness at which a torch lights a pile, then bleaching over the next tenth of a day; colour in steps of about half a minute of play). A dark damp patch in the sand, a soft-edged disc somewhat larger than the log, lies under every wet log on the beach, shrinks and fades as the wood dries and is gone once it is dry enough to burn (0.10, built). Piles get no patch: the sea left the sand wet where it left the wood, and a pile has been carried and laid down. The wood that lies on the beach at the start is dry. Only dry wood makes a fire catch, so gathering ahead pays.

## Coconut fibre

A fire needs something that catches first: the dry fibre of a coconut husk.

- **Coconuts** lie under the palms, one to three under about half of them.
- **Husking (0.13):** click or tap a coconut and he walks to beside it; the action button makes him kneel and tear the husk off with his hands (about 2½ seconds). That gives **one tuft of fibre**; the nut itself is not kept. Walking off or clicking elsewhere stops him, and the nut stays where it was.
- **Carrying:** at most **3 tufts**, kept loose in his shorts and not drawn on him; they show in the inventory row (see *Carrying and the inventory*). Fibre weighs nothing.
- **New nuts:** a palm drops a new coconut where an old one lay, three to six days after it was taken.

## Fire

Making fire is deliberately hard: it takes preparation and effort, so a fire that burns is precious.

- **Laying a fire:** a pile of at least **4 pieces** of driftwood on dry ground, laid down as any pile.
- **Lighting it (0.13):** hold the action button for about half a second standing beside the pile (within about 1.2 m of its edge), or press `F` there. With fibre on him, the castaway walks to the pile's side, kneels and twirls his staff upright between his palms as a fire drill, for about **14 seconds**. It is hard work: a whole attempt costs some rest (the moon wanes visibly). Walking off or clicking elsewhere stops him; the fibre is kept. A short press beside the pile picks it up; only a hold lights it.
- **Whether it catches:** at the end the tuft is used up, and the fire catches or it does not. At best (dry wood, rested) a little more than half the attempts catch. Wet wood makes it much harder (the chance falls with the square of the pile's dryness), fresh wood never catches, and a tired castaway does worse (half the chance at the limit). A failed attempt leaves only a puff of smoke; the pile stays. Whether an attempt catches is fixed by the seed and the number of attempts, so it cannot be retried for luck.
- **Burning:** the pile becomes a little tepee of charred wood with flames and rising smoke. Each piece burns about **2½ hours** of game time, so four pieces last most of a night; a fire holds at most eight pieces' worth. When the wood is gone it sinks to **embers** that glow for about 1½ hours, then it goes out and you start again. No number: the size of the flames tells how much is left, but tally marks show the count when you stand beside it (below).
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

- The castaway has to sleep **at least every two days** (40 minutes of play). After a day and a half he is tired: his head and shoulders hang, his arms swing less and he walks slower, down to 75 % at the limit. At two days he falls asleep where he stands.
- **Going to sleep (0.13):** hold the action button for about half a second where nothing can be lit (see *The action button*), or press `Z`. You can sleep anywhere on dry land, not in the water and not on a climbing route, and at any time of day. He first lays down what he carries, then lies on his back with the straw hat over his face.
- **Sleeping by a fire:** with a burning fire (or its embers) within about 3 m, the castaway sleeps the whole night through and wakes fully rested. Without one the sleep is cold: he wakes after **four hours**, about half rested. If the fire goes out while he sleeps, the cold wakes him once he has slept four hours. So a fire that lasts the night is worth the work.
- **A sleep lasts eight hours** of game time (by a fire); meanwhile time runs **20 times as fast** (about 20 seconds), easing in and out. The sun or moon, the tide and the wood all go on: wood that washes up meanwhile lies there when you wake. A full sleep rests you completely. A left click, a tap, the action button or a walking key (WASD, arrows) wakes you early, only partly rested; turning, tilting or zooming the view does not. The flood wakes you too: you can lie down on the wet sand of low water, but when the rising water reaches you, you wake and get up, only partly rested. Worn out in the water, you wade on and only fall asleep once on dry ground.
- **How long still:** a small moon in the bottom left corner, in the dark brown of the loading screen. Full when rested, it wanes to a thin sickle and to nothing as the two days run out, and waxes again while you sleep. It is faint most of the time and grows clearer in the last half day. No numbers.

## Day and night

- **One day lasts 20 minutes of play.** A game starts in the middle of the morning.
- **The sun** rises in the east, climbs over the south to about 62° and sets in the west. It is up for about 13 minutes. Low sun gives warm golden light and long shadows; at noon the light is plain style C.
- **Dusk and dawn** last about a minute each around the horizon: the light turns lilac and mauve, the warm coast grading fades and colours lose some saturation.
- **Night lasts about 5 minutes and is moonlit:** dark blue and dim, with soft moon shadows, about a third darker than before. Only the moon, a fire and a torch give light, so their circles stand out; the island and the castaway stay readable. Dusk and dawn stay smooth, golden hour is unchanged.
- The shadow light never comes from lower than 15° (0.12.1, built; before 0.12.1 about 11.5°), so shadows stay readable and less extreme at sunrise and sunset. Only the shadow light is lifted: the sun disc and the sky colours follow the true sun.
- **Shadows as built (0.13.1, settings chosen 0.13.2):** the shadow map is still 2048 px, but the shadow camera is fitted tightly round what is seen (`render/shadowFit`): the view box, cut off between 3 m below the castaway and a zoom-dependent height above him (0.8 x zoom, 5..20 m), measured across the light, so with a low sun a texel covers about 3 cm of sand instead of about 9 cm. Shadows of things outside that box (tall palms, hills towards the sun) still fall into the view, because a shadow keeps its place across the light. The size changes in steps of 5 % so turning and zooming do not make edges shift, and the centre snaps to whole texels so walking does not shimmer. The hard three.js PCF is replaced by an own soft filter: 16 taps on a disc of 1.5 texels, turned per pixel, which makes the stair steps of the map into a narrow soft band (a few centimetres wide, about two pixels on screen) while the toon look stays crisp. The light's direction turns in steps of 1/32° (0.11.1 had ¼°, which jerked about a metre with a low sun), so a step moves the tip of a tall palm's shadow only a few centimetres. **Chosen (0.13.2):** the user compared the variants by eye on a phone and chose steps of 1/32°, a minimum shadow-light height of 15°, the soft filter at 1.5 texels and the tight fit. These are now fixed; the comparison parameter and the alternatives are gone.
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
- **Rivers:** run from a highland to the sea. Where they leave a terrace, a waterfall forms. Sometimes a tributary joins.
- **Wading (built):** the castaway wades at most up to his waist, about **0.35 m**; deeper water stops him as the sea does, and he never sinks further than his waist. Upstream, where a river is still a narrow brook, it is shallow and can be waded anywhere. Along the middle reach each river gets **2 to 4 fords**: shallow stretches where the bed rises, recognisable only by nature (stones sticking out of the water, gravel, white rippling water; no markers). The wide, deep stretch towards the sea cannot be waded. So a river is a real border you have to learn. The fords are carved into the bed by the world generation (a deliberate change of seed 1337); the stones and gravel on them are drawn only and never block.
- **Coast:** beaches with palms, rocky shores and lagoons with sandbanks.

![The terraces at game zoom](images/island-1337-terraces.jpg)

![The five passages, and the coast](images/island-1337-passages.jpg)

## The action button (0.13, built)

Too many things happened at a stray click: a torch taken from a fire, a drink at a river he only meant to wade through. So clicking and tapping only walk, and everything he does goes through one action button.

- **Clicking or tapping** the ground or a thing only walks: on a thing (wood, a pile, a coconut, a fire, a torch in the ground) he walks to beside it and stands there, doing nothing. River water and its bank are just ground: he walks to the spot, wading if it lies in the river, so wading through a river just works. The castaway himself is no longer a thing to tap, and holding the ground, a pile or him does nothing.
- **One action button:** **Space** on a keyboard, and an ink ring drawn like the thumb stick (thin dark brown ink, no fills, turning pale at night). On touch-only screens it sits bottom right, just above the thumb stick, inside the safe area; on a desktop in the bottom right corner, where it can also be clicked. Faint (0.3) and empty when there is nothing to do; clearer (0.75) with a small ink icon inside when there is, a little clearer under a finger (0.9). The button has its own pointer handling: a finger or the mouse on it is never a walk tap or steering, and does not count towards the thumb stick or the two-finger turn and pinch.
- **A short press** (on release) does the obvious thing for what he stands beside: pick up driftwood or from a pile, husk a coconut, lay wood on a fire (dry wood only), take a torch from a fire or take up a planted torch, drink at river water or its bank, and otherwise lay down what he carries or stick the torch in the ground. What is in his hands decides first, then what is nearest: with dry wood beside a fire he feeds the fire, even with a pile next to it; with wood in his arm a pile is laid on, not taken from; laying down (or sticking the torch in the ground) comes last, when nothing else can be done. Reaches: wood, a coconut and a planted torch within about half a metre of his feet (0.55); a pile or a fire within 1.2 m of its edge (as for `F`); fresh river water within 0.8 m, so standing on the bank counts. Drinking with wood in his arm or a torch in his hand first lays the wood down (or sticks the torch in the dry ground beside him) and then kneels; in the water, where wood cannot be laid down, there is nothing to drink with wood in his arm. Pressing while he bends down or kneels does nothing.
- **Holding** the button (about half a second) does the heavy things, so a short press never starts them by accident: light a pile (with the fire drill and fibre, or with a torch in his hand; the pile has at least 4 pieces and he stands on dry ground) and sleep. A small ring round the icon fills while it is held. Beside a pile he could light, the hold lights it (and a short press picks it up, or with a torch in his hand sticks the torch in the ground); lighting wins over sleeping. Anywhere else on dry, walkable ground the hold sleeps; in the water or on a climbing route there is no hold. **F** and **Z** stay as shortcuts for lighting and sleeping.
- **Icons** in the same thin ink as the moon and the drop: wood with an arrow up (pick up) or down (lay down), the fibre tuft (husk), a flame over a piece of wood (feed the fire), a torch (take a torch, also take one up), a torch with a stroke of ground (stick it in the ground), the drop (drink), a flame (light, hold) and the crescent moon (sleep, hold). When a short press and a hold both do something (beside a pile of four or more he could light, or whenever he could also lie down), the short-press icon is shown large and the hold icon small beside it; when only a hold does something its icon is shown alone.
- **A full fire** (8 pieces) takes no more wood: the button offers nothing to lay on it, and the piece is not wasted (see *Fire*).
- A press of the button, like a walking key, wakes a sleeping castaway; that press then does nothing more.

## Carrying and the inventory (built)

- **What he holds in his hands is visible in his hands:** driftwood under the arm, the torch, later a bow or a fishing rod in hand.
- **What he carries loose is drawn in the inventory:** a quiet row of small drawings next to the moon mark, in the same dark brown ink, drawn as in a journal: no boxes, frames or numbers. Three tufts of fibre are three little drawings. Later: nails, a knife, and so on.
- The row is faint most of the time (the moon's quiet level) and grows clearer for about 3 seconds when something is added or used up, then eases back over 2 seconds. With nothing carried it is empty.
- Wood and the torch are **not** in the row; they show only in the world.
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
- **Touch screens:** tap to walk to a spot, drag to steer, double tap to run there (hold and drag after the double tap to steer while running). Everything else goes through the action button (see *The action button*). Two fingers: pinch to zoom (same limits), twist to turn the view; the island turns with the fingers, and the castaway stops while two fingers are down. No tilting on a touch screen. **Thumb stick (0.5):** on touch-only devices (a coarse primary pointer and no fine pointer anywhere, so never on a desktop nor on a laptop with a touch screen and a mouse) a thumb stick sits fixed bottom right, inside the safe area, to walk with one finger. It is drawn like the moon mark: a thin dark brown ink ring (about 110 px across) with a dot, no fills, arrows or labels; faint (0.3) most of the time, clearer (0.75) under a thumb; the dot follows the thumb inside the ring and springs back on release. Its touch area is a little larger than the ring. Dragging from the centre walks that way relative to the screen, like the walking keys (up is away from the camera, whatever the view angle); a small dead zone (12 %) near the centre does nothing, pushing past 85 % of the radius runs, letting go stops. It wakes a sleeping castaway like a walking key. A finger on the stick is never a tap or steering for the world and does not count towards the two-finger turn and pinch; a second finger elsewhere can still turn or zoom the view, and the stick keeps walking meanwhile. The browser's own page zoom is switched off.
- On a summit the camera zooms out a further 1.6× on top of the player's zoom (at most 14), as a reward for the climb.
- **Almost no interface:** no HUD, map or menu. What you see is the island (the wood you carry, the torch in his hand, how big the flames are). The exceptions are the touch-only thumb stick (see *Touch screens*), the action button (see *The action button*), the faint moon that shows how long you can still go without sleep (see *Sleep*), the inventory row next to it (see *Carrying and the inventory*), the castaway's name (see *Name*), the developer panel (see below), and the loading screen: the word *Driftwood* in a dark brown serif (Georgia) on the sand background, with a thin bar below it that fills as the island is made, and fades out as the island fades in. No percentage, no step names.
- **Name (0.9, built):** the first time an island is started, the loading screen asks one thing under the title: *What is your name?*, in a handwritten-feel italic, with a bare input below it (no frame, only an ink underline and the caret, the loading screen's dark brown) and a small → to tap. Enter or → confirms; an empty answer is fine and means *the castaway*. Loading goes on meanwhile and the island only fades in once the question is answered (if loading is done first, it waits quietly). Up to 20 characters, trimmed. On phones the keyboard comes up. The name is saved with the island and not asked again; starting over (Shift + backtick, `#new`) asks again. The test parameters (`?spawn`, `?time`, `?awake`) skip the question and use *the castaway*.
- **The day line (0.9, built):** one small line in ink top left, inside the safe area, always there: `Dave, day 3` (`The castaway, day 3` without a name). Faint like the moon most of the time, clearer for a few seconds when it first shows and when a new day begins, then easing back (the same curve as the inventory row). Day 1 is the day the game started; the day turns at midnight on the game clock, also while he sleeps.
- **The waking line (0.9, built):** whenever a sleep ends, however it ends (rested, the cold, the flood, a tap), a short line in the middle of the screen fades in and out over about 4 seconds: `Dave wakes. Day 3.` (`The castaway wakes. Day 3.`). Same ink, no box.
- **Readability of the day and waking lines (0.12, built):** the day line grows to about 15 px and the waking line to about 22 px. The day line rests at opacity 0.55 (instead of faint) and goes to 0.9 when a day turns. The waking line peaks at 0.95 and stays for 5 seconds (instead of the 4 seconds above). Both get a soft glow behind the letters in the opposite colour of the ink (pale paper by day, dark at night), with no frame (a text shadow that follows the same day and night blending as the ink).
- **Pale ink at night (0.9, built):** all ink marks (the moon, the inventory row, the thumb stick, the action button, the developer panel, the day line and the waking line) share one colour that follows the light of the day: dark brown by day, a pale warm paper colour at night, blending smoothly through dusk and dawn. The developer panel's light backing turns dark at night so its text stays readable. The loading screen keeps its dark brown.
- **Interface on any ground (decided, 0.13.3 "Clear marks"):** every interface element is drawn so that it stays readable on light and on dark ground (sand, green, water, shadow), by day and at night: ink with a soft glow in the opposite colour behind its strokes, strokes thick enough to read, and a faint backing where an element needs one (the action button gets a faint paper disc). This holds for every element added later too.
- **Dev panel:** a developer aid, not part of the game: one faint line top right in the same dark brown ink (`v0.4 · Dev panel · 60 fps`: version, name, frames per second). Visible for now; later it is hidden by default (`DEV_PANEL_VISIBLE`) and the backtick key (`` ` ``) shows and hides it, as it already does now. Since 0.7 it also shows the work time per frame in ms and the word `idle` while the game rests (`v0.7 · Quiet frames · 30 fps · 9 ms · idle`). Not remembered between sessions. The versions are listed in `docs/versions.md`.
- **Quiet frames (0.7):** the game is easy on the battery. On touch-only devices it draws at most 30 frames a second (a desktop is not capped), and on every device at most 15 a second when nothing has happened for about 3 seconds (the castaway standing still, the view settled, no touch, key or wheel). Any input brings the full rate back at once. Fire flicker and the slow sun and tide do not count as something happening, and neither does moving water (0.14, decided, not built yet).

## Decisions

- **Language:** everything is in English: the game, the code and the documentation.
- **Name:** Driftwood.
- **Engine:** Three.js in the browser for now. A large tiled world works well there. Godot may come later, for example for Steam or a console.
- **Scope of the base:** the island and walking, then atmosphere. The first game elements are gathering driftwood, ebb and flow, sleep, coconut fibre and fire (see above); more only after discussion.
- **Saving (0.6, built):** automatic and silent, no menu and no message. One save **per island** (per seed), kept in the browser's local storage, so it belongs to this browser on this device; another browser or device starts fresh. The game is laid over the generated island at start-up: where he stands, the time, how long he has been awake or asleep, the wood carried, in piles and washed up, the coconuts taken, the fibre, fires, torches. Not saved: footprints, kneeling work in progress. The view (turn, tilt, zoom) is saved per island too (0.10, built) and restored silently at start-up. **Start over** with Shift + backtick (`` Shift+` ``), or by opening the island with `#new` in the address (it starts fresh and `new` is removed from the address again). A save that cannot be read is ignored. A local save is all there is for now; a backend could come later behind the same interface (see `architecture.md`).
- **Working method:** see `CLAUDE.md`.

## Basic needs (water built in 0.11, the rest decided, not built yet)

- **General:** the castaway never dies. Needs make him slower and wear him out; at worst he collapses and sleeps, like exhaustion. Each need has a small ink mark in the row next to the moon, always shown (faint like the moon, clearer when it matters), no bars or numbers.
- **Water (0.11 "Water", built):** thirsty after about one day (20 minutes of play), very thirsty after a day and a half. Drinking (0.13): the action button standing at river water or on its bank (within 0.8 m) (wood or a torch is laid down or stuck in the ground first, as before sleep); he kneels and drinks a few seconds and is no longer thirsty. Sea and lagoon water don't help (he doesn't kneel). No carrying water yet.
- **Water effects (built):** thirst is counted in game days and keeps running while he sleeps (a night is a third of a day); thirsty: a little slower (85 % at the point of collapse, combined with load and tiredness); a little slower, like tiredness; very thirsty: rest runs out twice as fast; after two days he collapses and sleeps, and wakes still thirsty. Mark: a drop that empties (full just after a drink, empty at the collapse), placed between the moon and the row of what he carries, with room for the half coconut right after it; his head hangs a little. After a collapse he wakes at a day and three quarters, so he does not collapse again at once. Drinking needs fresh water: river water above the sea at high water, not the last stretch at the mouth; a tap on the bank counts (a little further than for a piece of wood). There is no key for it, only the button.
- **Food (0.15 "Coconut"):** hungry after about two days, starving after four. Husking a coconut gives a tuft of fibre and he eats and drinks the nut on the spot (always, also when not hungry; no storing for now, may change later): one nut takes away about a third of the hunger and a little thirst. Coconuts grow back after some days, so you move along the palms.
- **Food effects:** hungry: drilling fire costs more rest, a little slower; starving: rest runs out faster. Mark: half a coconut that empties. Later, not decided in detail: crabs at low water, fishing.
- **Shelter (0.16 "Lean-to"):** new material: branches, lying under broadleaf trees and in the rain forest like driftwood on the beach. Picked up and carried under the arm (wood and branches together at most three). Dry; they burn too, shorter than driftwood; they grow back slowly.
- **Building a lean-to (0.16, decided, not built yet):** two piles close together, one with at least 6 driftwood and one with at least 6 branches; hold either (or press `F` beside it) as when lighting a fire, and he builds instead. About an hour of game time (about a minute of play), costs rest. The lean-to rises in steps (posts, then a sloping roof of branches), open side towards the camera.
- **Lean-to effect:** sleeping under a lean-to without fire: the cold sleep lasts 6 hours instead of 4 and he wakes about three quarters rested; with a fire within 3 m: the whole night, and he recovers faster than by a fire alone. The flood takes a lean-to built on the wet sand of low water. More than one may be built. Shown only in the world, not in the row.
- **Fire place (with 0.11, built):** after a fire goes out, the burnt place (ash and charred ends) stays visible for about two days, fading slowly, then is gone; the flood washes it away sooner (a fire the flood puts out leaves none), and a new fire lit on it replaces it. It gives no light or warmth and does not block walking.

## Wildlife (decided, not built yet)

- **0.17 "Wildlife"**, after the lean-to. Atmosphere only for now: the animals move and react to the castaway (flee, hide, fly up), but nothing can be done with them yet. Catching, cooking on the fire and eating come later.
- Where they live is fixed per island by the seed, like the trees. They only come alive near the castaway, so it stays cheap on phones. Small and simple, in the same toon style with outlines.
- **Crabs** on the beach, more on the wet sand at low water. They scuttle sideways and dart into a hole when you come near.
- **Fish:** dark little shadows in the shallow river and lagoon water that dart away when you wade in. Now and then a fish jumps near the surf.
- **Birds:** seabirds circling high over the coast by day. Now and then a small flock lands on the beach and flies up when you come near. In the evening they head for the rocky shore.

## Game ideas (not built, not decided)

An early atmosphere prototype tried most of these. They are ideas until we decide otherwise.

| Part | Idea |
|---|---|
| Gathering, later | Branches under trees, a barrel of nails at the wreck |
| Digging | The ground really sinks; salt water on the beach, nails at the wreck |
| Building | Lean-to (see *Basic needs*); fire is built (of driftwood only, see *Fire*) |
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
