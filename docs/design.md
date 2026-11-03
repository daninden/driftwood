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
- **Lighting:** toon shading in three light steps, bright midday light, soft warm colour grading and a light paper grain. The sun follows its own path through the day (see *Day and night*); it stands still in the world when you turn the view, so shadows stay on the ground.
- **Outlines:** dark brown edges around trees, rocks, palm trunks and the castaway.
- **Detail:** leaf clusters, grass tufts, pebbles, shells and driftwood, at the level of the original style C.
- **Rock walls:** painted in the shader with strata, cracks and ledges, greyer higher up, so the texture never stretches on steep faces.

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

- **Picking up:** click or tap a piece; the castaway walks there, bends down briefly and picks it up. A finger may tap a little less precisely than a mouse. Steering with a dragged finger never picks anything up.
- **Carrying:** at most **3 pieces**, under the left arm at their real length (low enough that the head and hat stay readable). Every piece slows walking and running by 6 % (three pieces: 82 %).
- **Laying down:** click or tap the castaway: everything carried goes down at the feet, on a pile close by or as a new pile. Not in water.
- **Piles** stay where they are, and can be picked up again by clicking them (the top pieces first, as many as fit).
- No counter: what you carry in your hands is what you see. Wood is never solid; you walk over it. (Small things carried loose go into the inventory, see *Carrying and the inventory*; wood does not.)
- **New wood with every high water:** each high water washes up one or two new pieces per stretch of beach, on the dry sand above the tide line, each with its own look. They fade in over a few seconds. A stretch of beach never gets more loose wood than it had at the start, so the beach never fills up; your piles do not count. What you gather slowly grows back.
- **The flood takes back** a pile laid on the wet sand of low water, below the high-water line. Wood cannot be laid down in the sea.
- **Wet wood:** what a high water brings is wet and salty: dark when it washes up, it bleaches to its own colour over **a day**, wherever it lies or is carried. The wood that lies on the beach at the start is dry. Only dry wood makes a fire catch, so gathering ahead pays.

## Coconut fibre

A fire needs something that catches first: the dry fibre of a coconut husk.

- **Coconuts** lie under the palms, one to three under about half of them.
- **Husking:** click or tap a coconut; the castaway walks there, kneels and tears the husk off with his hands (about 2½ seconds). That gives **one tuft of fibre**; the nut itself is not kept. Walking off or tapping elsewhere stops him, and the nut stays where it was.
- **Carrying:** at most **3 tufts**, kept loose in his shorts and not drawn on him; they show in the inventory row (see *Carrying and the inventory*). Fibre weighs nothing.
- **New nuts:** a palm drops a new coconut where an old one lay, three to six days after it was taken.

## Fire

Making fire is deliberately hard: it takes preparation and effort, so a fire that burns is precious.

- **Laying a fire:** a pile of at least **4 pieces** of driftwood on dry ground, laid down as any pile.
- **Lighting it:** hold the pile for about half a second (finger or mouse button), or press `F` standing beside it. With fibre on him, the castaway walks to the pile, kneels and twirls his staff upright between his palms as a fire drill, for about **14 seconds**. It is hard work: a whole attempt costs some rest (the moon wanes visibly). Walking off or tapping elsewhere stops him; the fibre is kept. A short tap on a pile still picks it up; while the press is still held he waits beside the pile.
- **Whether it catches:** at the end the tuft is used up, and the fire catches or it does not. At best (dry wood, rested) a little more than half the attempts catch. Wet wood makes it much harder (the chance falls with the square of the pile's dryness), fresh wood never catches, and a tired castaway does worse (half the chance at the limit). A failed attempt leaves only a puff of smoke; the pile stays. Whether an attempt catches is fixed by the seed and the number of attempts, so it cannot be retried for luck.
- **Burning:** the pile becomes a little tepee of charred wood with flames and rising smoke. Each piece burns about **2½ hours** of game time (wet wood half as long), so four pieces last most of a night; a fire holds at most eight pieces' worth. When the wood is gone it sinks to **embers** that glow for about 1½ hours, then it goes out and you start again. No counter: the size of the flames tells how much is left.
- **Keeping it going:** click or tap the fire while carrying wood; the castaway lays one piece on it. That also works on the embers.
- **Light:** a fire throws a warm, flickering light round it; at night a soft glow lies round it over the darkness. By day a thin column of smoke rises.
- **The flood** puts out a fire laid on the wet sand of low water.
- **Warmth:** a fire close by lets the castaway sleep the night through (see *Sleep*).
- **A torch:** click or tap a burning fire with empty hands and the castaway takes a burning brand out of it (it costs the fire half a piece's worth; not from embers). He holds it up in his left hand; it lights a small warm circle round him at night and burns about **two hours** of game time. With a torch he has no hand free for wood. A click or tap on the castaway sticks it in the ground in front of him, where it burns on as a light; a click or tap on it takes it up again. Lying down to sleep, he sticks it in the ground first. Wading in deeper than about 30 cm puts it out, and the flood puts out a torch stuck in the wet sand.
- **Lighting with a torch:** click or tap a pile of at least 4 pieces while holding a torch (or hold it, or press `F` beside it): the castaway kneels and pushes the torch into it. No fibre and no drilling: dry wood (dry for at least three quarters of the day it takes) always catches, and the torch goes into the fire. Wetter wood only smokes, and he keeps the torch. So a fire, once made, can be carried to a new place.
- Fire is not solid, like wood (see *Known weak spots*). It burns on while the castaway sleeps.

## Ebb and flow

- **Two high waters a day,** as on a real coast: the tide comes round every 12 h 25 min of game time (about 10⅓ minutes of play), so high water falls a little later each day. A game starts on a falling tide, mid-morning.
- At high water the sea stands where it always stood, at the tide line of seaweed. At low water it is **0.4 m lower**: a strip of wet sand falls dry, and you can walk further out, onto the sandbanks of the lagoons. The surf follows the water's edge.
- When the flood comes in round you, you can always wade back to shore; you cannot go further out. Footprints the water covers are wiped out.

## Sleep

- The castaway has to sleep **at least every two days** (40 minutes of play). After a day and a half he is tired: his head and shoulders hang, his arms swing less and he walks slower, down to 75 % at the limit. At two days he falls asleep where he stands.
- **Going to sleep:** hold the castaway for about half a second (finger or mouse button), or press `Z`. A short tap on the castaway still lays wood down. You can sleep anywhere on dry land, not in the water and not on a climbing route, and at any time of day. He first lays down what he carries, then lies on his back with the straw hat over his face.
- **Sleeping by a fire:** with a burning fire (or its embers) within about 3 m, the castaway sleeps the whole night through and wakes fully rested. Without one the sleep is cold: he wakes after **four hours**, about half rested. If the fire goes out while he sleeps, the cold wakes him once he has slept four hours. So a fire that lasts the night is worth the work.
- **A sleep lasts eight hours** of game time (by a fire); meanwhile time runs **20 times as fast** (about 20 seconds), easing in and out. The sun or moon, the tide and the wood all go on: wood that washes up meanwhile lies there when you wake. A full sleep rests you completely. A left click, a tap or a walking key (WASD, arrows) wakes you early, only partly rested; turning, tilting or zooming the view does not. The flood wakes you too: you can lie down on the wet sand of low water, but when the rising water reaches you, you wake and get up, only partly rested. Worn out in the water, you wade on and only fall asleep once on dry ground.
- **How long still:** a small moon in the bottom left corner, in the dark brown of the loading screen. Full when rested, it wanes to a thin sickle and to nothing as the two days run out, and waxes again while you sleep. It is faint most of the time and grows clearer in the last half day. No numbers.

## Day and night

- **One day lasts 20 minutes of play.** A game starts in the middle of the morning.
- **The sun** rises in the east, climbs over the south to about 62° and sets in the west. It is up for about 13 minutes. Low sun gives warm golden light and long shadows; at noon the light is plain style C.
- **Dusk and dawn** last about a minute each around the horizon: the light turns lilac and mauve, the warm coast grading fades and colours lose some saturation.
- **Night lasts about 5 minutes and is moonlit:** dark blue and dim, with soft moon shadows; the island is just readable. A fire and a torch light their surroundings. Darker nights (where only your fire gives light) could come now that there is fire; not decided yet.
- The light never comes from lower than about 12°, so shadows stay readable.
- No clock on screen, no stars, moon disc or weather yet. The day drives the tide (see *Ebb and flow*) and sleeping speeds it up (see *Sleep*); what else it should mean for playing is still to be discussed.

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

## Carrying and the inventory (built)

- **What he holds in his hands is visible in his hands:** driftwood under the arm, the torch, later a bow or a fishing rod in hand.
- **What he carries loose is drawn in the inventory:** a quiet row of small drawings next to the moon mark, in the same dark brown ink, drawn as in a journal: no boxes, frames or numbers. Three tufts of fibre are three little drawings. Later: nails, a knife, and so on.
- The row is faint most of the time (the moon's quiet level) and grows clearer for about 3 seconds when something is added or used up, then eases back over 2 seconds. With nothing carried it is empty.
- Wood and the torch are **not** in the row; they show only in the world.
- Limits stay physical (what fits in the hands, at the waist, on the back), not a number of slots.

## Camera and view

- Orthographic: isometric without perspective. It starts rotated 45° and tilted 30° down.
- **Turning and tilting:** the player turns the view freely around (hold `Q` / `E`, or drag with the right mouse button) and tilts it between 25° and 45° (right mouse button up/down). Turning starts and stops softly. No snapping to fixed angles. Not flatter than 25° (without perspective the ground would run on endlessly) and not steeper than 45° (the rock walls and terraces would stop reading). Walking with the keys stays relative to the screen: W always walks away from you. The view angles are not saved.
- Turning also lets you look behind walls and trees; worth keeping in mind once hiding from the strangers is designed.
- **Never lose the castaway:** vegetation between the camera and the castaway (crowns, pines, palms, bushes, ferns) is thinned out round the figure into a stippled veil (about 1.5 m in radius; the middle keeps some 40% of the leaves, filling in gradually to the edge), so the castaway shows through while the trees stay visible; never a clean hole. It moves smoothly with the castaway; whole trees never switch on or off. Where something solid hides the figure (a rock wall, a boulder, a trunk, a fern right in front), a light stippled silhouette of the castaway shows through.
- **Footprints** in the sand: at most about 80 (some 17 m of trail); the oldest fade out, so the trail thins behind you.
- No plinth while playing.
- The camera stays far enough away that the castaway is small in a big landscape (about 6% of the screen height): zooming in too close shrinks the loneliness.
- **Zooming:** the player can zoom with the mouse wheel or `+` / `-`, between 5 and 10 (it starts at 7). Never closer than that, so the figure always stays small. No buttons on screen. The zoom is not saved.
- **Touch screens:** tap to walk to a spot, drag to steer, double tap to run there (hold and drag after the double tap to steer while running). Hold the castaway to sleep (see *Sleep*). Two fingers: pinch to zoom (same limits), twist to turn the view; the island turns with the fingers, and the castaway stops while two fingers are down. No tilting on a touch screen. The browser's own page zoom is switched off.
- On a summit the camera zooms out a further 1.6× on top of the player's zoom (at most 14), as a reward for the climb.
- **Almost no interface:** no HUD, map or menu. What you see is the island (the wood you carry, the torch in his hand, how big the flames are). The exceptions are the faint moon that shows how long you can still go without sleep (see *Sleep*), the inventory row next to it (see *Carrying and the inventory*), the developer panel (see below), and the loading screen: the word *Driftwood* in a dark brown serif (Georgia) on the sand background, with a thin bar below it that fills as the island is made, and fades out as the island fades in. No percentage, no step names.
- **Dev panel:** a developer aid, not part of the game: one faint line top right in the same dark brown ink (`v0.4 · Dev panel · 60 fps`: version, name, frames per second). Visible for now; later it is hidden by default (`DEV_PANEL_VISIBLE`) and the backtick key (`` ` ``) shows and hides it, as it already does now. Not remembered between sessions. The versions are listed in `docs/versions.md`.

## Decisions

- **Language:** everything is in English: the game, the code and the documentation.
- **Name:** Driftwood.
- **Engine:** Three.js in the browser for now. A large tiled world works well there. Godot may come later, for example for Steam or a console.
- **Scope of the base:** the island and walking, then atmosphere. The first game elements are gathering driftwood, ebb and flow, sleep, coconut fibre and fire (see above); more only after discussion.
- **Saving:** not built. When it comes: local in the browser first, behind one interface, so a backend can be added later without changing the game (see `architecture.md`).
- **Working method:** see `CLAUDE.md`.

## Game ideas (not built, not decided)

An early atmosphere prototype tried most of these. They are ideas until we decide otherwise.

| Part | Idea |
|---|---|
| Gathering, later | Branches under trees, a barrel of nails at the wreck |
| Digging | The ground really sinks; salt water on the beach, nails at the wreck |
| Building | Lean-to (6 driftwood, 6 branches); fire is built (of driftwood only, see *Fire*) |
| Building, later | Rope from lianas or palm fibre, lashing, palisade, storage pit, raft |
| Day and night | At night only the light of your fire; a fire can be seen from far away (also by the strangers) |
| Strangers | A canoe lands on a distant beach and lights a fire; within 10 m they see you and flee; they leave footprints |
| Journal | Messages as journal lines in an 18th-century hand |
| Basic needs | Fresh water (rain, well, river), food (coconut, fish, crab); sleeping in a lean-to |
| Weather | A storm wrecks your lean-to but washes up new driftwood |
| Map | Filled in by yourself, journal style; only what you have seen |
| Ending | Build a raft and sail away, or stay |

## Open questions

- Who are the strangers (mutineers, slave traders, other castaways)?
- Saving: local only, or a backend later?
- Mood per terrace: weather over time (mist in the rain forest, wind on the summit).
- What else should the day/night cycle mean for playing (food, strangers, darker nights now that there is fire)?
- Should a fire mean anything for the strangers?
- Loneliness: the castaway growing lonelier without a fire, shown without a meter (an idea, to be thought through).

## Known weak spots

- The ravine still reads more like a gully than a cleft; its shape needs to be steeper and narrower.
- Some roots stand slightly off the wall, so their shadow falls loose on the wall.
- Driftwood looks flat from above (more like planks than round logs); a bark texture would help.
- The colour transition between terraces could be softer.
- You can walk straight through a fire, as through wood.
