# Release log

Each push that delivers something gets a version number and a short name, shown in the developer panel. Newest first.

## 0.15 "Coconut" — 2026-11-03

- Hunger (new `src/game/hunger.js`, modelled on thirst): counted in game days since he last ate, running on while he sleeps, stopping at four days (no collapse; he never dies). Hungry from two days: walking speed down to 90 % at four days (multiplied with load, thirst and tiredness) and drilling a fire costs 1.5 times as much rest. Starving from four days: rest runs out 1.5 times as fast, multiplied with thirst's double (both together: 3 times).
- Eating: husking a coconut takes 4 seconds (was 2.5; the same kneeling work, no new animation). When it is done he has one tuft of fibre, eats the nut (hunger down by 4/3 day, not below 0) and drinks its milk (thirst down by a quarter day, `thirst.sip`), always, also when not hungry. Stopped early: nothing, the nut stays.
- The half coconut mark (`src/render/hungerMark.js`, `#hunger` in `index.html`) next to the drop: a half coconut seen from the side whose flesh empties from the top down as hunger grows; same ink, glow and opacity curve as the drop.
- Saving: an optional `hunger: { days }`; older saves load as not hungry (the format stays `v: 1`).

## 0.14.2 "Still edges" — 2026-11-03

- Fixed: the shadows flickered. Each tiny step of the shadow light (1/32°, about ten a second) re-drew the shadow map and its jagged texel edges fell slightly differently every time. Now there are no jaggies: the shadow map is 4096 px on desktop (2048 px on touch-only devices, as before), the soft filter's radius is 3 texels (was 1.5), and each of its 16 taps is a bilinear comparison (four texels mixed by the fraction). The light's stepping is unchanged. `shadowMapSize(touch)` in `src/render/stage.js` chooses the size; `main` passes the touch test down through `createIslandView` to `createStage`.
- Tried live and rejected: a cross-fade between two shadow lights (shadows looked doubled during the fade).
- No change to the game's elements.

## 0.14.1 "Dry ground" — 2026-11-03

- Fixed: a first pile no longer goes in the water. When no pile is near, the spot a step in front is checked too; if it is wet, a dry spot round him is used, and if there is none he keeps the wood (as with a full pile that has no room beside it).
- Fixed: the thumb stick now stops kneeling work (husking, drinking, drilling a fire) like the keys and a click do, through one helper, `wantsToMove(input)`, which also drops a queued action.
- Fixed: the first frame's time step is never negative (`Math.max(0, ...)` in `src/main.js`).
- The smoke test now starts the full Chromium (new headless mode) on the graphics card, with the old software drawing as fallback: the quick run takes about 15 seconds instead of about 35. One-time setup: `npx playwright install chromium`.
- `REVIEW_GPT.md` moved to `docs/review-gpt.md`. No change to the look or to the game's elements.

## 0.14 "Moving water" — 2026-11-03

- The water moves, stylised and subtle, in the existing water shaders only. Rivers: light streaks and flecks drift downstream, faster on steep stretches, fords and falls, and the white water at fords and falls breaks up and moves. Sea: a slow long swell with glints on the crests (the sun, the moon and fires and torches do the glinting: faint and silvery at night, warm by a fire) and faint pale lines by day. Lagoons and sheltered bays are calmer. The surf breathes up and down the beach over a few seconds on top of the tide.
- Moving water does not count as something happening: the idle 15 fps rate is unchanged, the water just moves as fast as frames are drawn.

## 0.13.3 "Clear marks" — 2026-11-03

- Every interface element is now readable on light and dark ground, by day and at night. The action button has a soft glow in the opposite colour of the ink behind ring and icon, a faint paper disc inside the ring (pale by day, dark at night), thicker strokes (2.2 px) and larger icons, and is clearer (0.45 empty, 0.95 with an action). The thumb stick, the moon, the drop, the fibre tufts and the tally marks get the same glow and thicker strokes; the moon, drop and fibre row rest at 0.5 instead of 0.3. No frames or boxes.

## 0.13.2 "Chosen shadows" — 2026-11-03

- The shadows settle on fine steps with soft edges: the shadow light turns in steps of 1/32 degree (was 1/16), never comes from lower than 15 degrees, the own soft filter has a radius of 1.5 texels, and the shadow camera keeps the tight fit. The user compared the variants by eye on a phone and chose these.
- The temporary `?shadows=step,min,soft,fit` comparison parameter is gone, together with the alternatives it switched between (old hard filter, old loose and roomier shadow cameras, softer filter).

## 0.13.1 "Soft shadows" — 2026-11-03

- Fixed: the shadow edges are no longer jagged and restless. The shadow map (still 2048 px) now covers only what is seen, measured across the light, so its texels are about 3 times finer on the sand with a low sun (the old square covered far more than the view). Its size changes in steps of 5 %, so zooming or turning does not make the edges shift, and it still snaps to whole texels so walking does not shimmer.
- Soft edges: three.js's hard shadow filter is replaced by an own one (16 taps on a small disc, turned per pixel), which turns the stair steps into a narrow soft band while the drawn look stays crisp.
- The shadow light now turns in steps of 1/16 degree (was 1/32): with the finer map it is the calmest step in the headless flicker check.
- Temporary `?shadows=step,min,soft,fit` grows two meanings: `soft` is 0 (old hard filter), 1 (new soft, default) or 2 (softer); a fourth value `fit` is 0 (old loose shadow camera), 1 (tight, default) or 2 (tight with more room).

## 0.13 "Action" — 2026-11-03

- Clicking and tapping only walk now. On wood, a pile, a coconut, a fire or a torch in the ground he walks to beside it and stands there, doing nothing; river water and its bank are just ground, so wading through a river works and a stray click no longer takes a torch from a fire or makes him drink. Tapping or holding the castaway does nothing any more.
- One action button: **Space**, and a thin ink ring in the bottom right corner (above the thumb stick on touch screens, clickable with the mouse on a desktop), in the same ink as the other marks and pale at night. Faint and empty when nothing can be done; clearer, with a small ink icon, when something can. Its touches never count as a walk tap and do not disturb the stick or the two-finger view gestures.
- A short press does the obvious thing for what he stands beside: pick up wood or from a pile, husk a coconut, lay a piece of dry wood on a fire, take a torch from a fire or take up a planted torch, drink at river water or its bank, and otherwise lay down what he carries or stick the torch in the ground. What is in his hands decides first (dry wood beside a fire feeds it, even with a pile next to it), then what is nearest; laying down comes last.
- Holding the button (about half a second) does the heavy things: light a pile of four or more (fire drill with fibre, or a torch) and, anywhere else on dry ground, sleep. A small ring round the icon fills while it is held. `F` and `Z` stay as shortcuts. A press of the button wakes a sleeping castaway.
- Icons in thin ink: wood with an arrow up or down, the fibre tuft, a flame over a piece of wood, a torch, a torch with a stroke of ground, the drop, a flame and the crescent moon. When a short press and a hold both do something, the short-press icon is large and the hold icon small beside it.
- Fixed: a full fire (eight pieces) takes no more wood; the button offers nothing to lay on it and the piece is no longer wasted.
- The pure `game.action()` says what a press and a hold would do; the button draws its icon from it. New `tests/action.test.js`.

## 0.12.1 "Smooth shadows" — 2026-11-03

- Fixed: the shadows no longer move in visible jerks. The shadow light now turns in steps of 1/32 degree (before: a quarter degree, about a metre of shadow per step with a low sun), and it never comes from lower than 15 degrees (before: about 11.5), so shadows at sunrise and sunset are less extreme. The sun and the sky colours are unchanged.
- Temporary developer parameter `?shadows=step,min,soft` (degrees, degrees, 0 or 1) to compare variants; to be removed once one is chosen.

## 0.12 "Piles" — 2026-11-03

- A pile holds at most twelve pieces, and (for later) only one kind of wood. Wood laid on a full pile starts a new pile right next to it, and what does not fit on a pile goes into the new one. Older saves with bigger piles still load.
- Tally marks in ink appear above a pile and above a fire while you stand beside it: strokes in bundles of five, with a double line under when it is full (12 for a pile, 8 for a fire). On a fire they count the pieces still burning, a half-burnt piece as a short stroke, none for embers. They fade in and out and turn pale at night with the other ink. Piles grow and shrink with their count, and so does the fire's tepee.
- Wet wood cannot be laid on a fire: you lay a dry piece from a mixed load, and nothing happens with only wet wood.
- The day line top left and the waking line are easier to read: bigger (15 and 22 px), the day line more present (opacity 0.55, 0.9 when a day turns), the waking line stays 5 seconds, and both have a soft glow behind the letters in the opposite colour of the ink.

## 0.11.1 "Still shadows" — 2026-11-03

- Fixed: around sunrise and sunset the shadows trembled, even standing still; they now hold still and move on in tiny steps as the sun moves.

## 0.11 "Water" — 2026-11-03

- The castaway gets thirsty: after about a day (20 minutes of play) he is thirsty and a little slower, after a day and a half very thirsty and his rest runs out twice as fast. After two days he collapses and sleeps like exhaustion, and wakes still thirsty. He never dies.
- Drink at a river: tap the water or its bank, and he walks there, kneels and drinks for a few seconds. Wood in his arms is laid down first, a torch is stuck in the dry ground first. Sea and lagoon water are salt and do nothing; wading in a river does not drink by itself.
- A small ink drop next to the moon shows his thirst: full after a drink, emptying as he gets thirsty, faint like the moon and clearer as it matters and for a moment after drinking. His head hangs a little when he is thirsty.
- When a fire goes out it leaves its burnt place: ash and charred ends that stay for about two days, fading slowly. No light or warmth, and you walk over it. The flood washes it away sooner, and a new fire lit on it replaces it.
- He stoops more under a load: twice as much lean per piece (about 17 degrees with three), from the hips.
- Thirst and the burnt places are saved (older saves load as not thirsty, with no burnt places).

## 0.10 "Wet wood" — 2026-11-03

- Wood that the sea has just brought looks wet until it is dry enough to burn: a dark, cool grey-brown with a slight sheen, on the beach, in a pile and under his arm. Then it bleaches to its own colour within a couple of minutes.
- Under fresh wood on the beach lies a dark damp patch in the sand; it shrinks and fades as the wood dries and is gone when the wood will burn.
- Carrying slows you more: 12 % per piece (three pieces: 64 %), with shorter steps and a slight stoop.
- The view (turn, tilt and zoom) is remembered per island and comes back exactly as you left it; starting over, or an old save, gives the default view.
- Dev: while the developer panel is visible you can zoom out to 25 instead of 10 (the panel then shows `zoom N` beyond 10); with the panel hidden the normal limit applies again.

## 0.9 "Name" — 2026-11-03

- At the first start of an island the loading screen asks "What is your name?". Enter, or the small arrow, confirms; an empty answer means the castaway. The name is saved with the island, and starting over asks again.
- A small line top left always says who you are and which day it is, such as `Dave, day 1`; it grows clearer for a few seconds when a new day begins.
- When a sleep ends, a short line fades in and out in the middle of the screen, such as `Dave wakes. Day 3.`
- All the ink on screen (the moon, the row, the thumb stick, the lines of writing, the developer panel) turns pale at night.

## 0.8 "Wider light" — 2026-11-03

- The firelight reaches further, about 14 m round a fire and 9 m round a torch; the torch lights the ground at its flame.
- Nights are darker, and the smoke a little darker.
- Behind trees the castaway is now an even silhouette, not a stippled veil, and the paper grain is gone.
- The loading screen reads DRIFTWOOD in capitals.

## 0.7 "Quiet frames" — 2026-11-03

- On phones and tablets the game uses less power: at most 30 frames a second on touch-only devices.
- On every device it drops to 15 frames a second when nothing has happened for three seconds.

## 0.6 "Saved" — 2026-11-03

- The island saves itself in this browser, one save per island, and picks up where you left off.
- Shift + ` (or `#new` in the address) starts the island over.

## 0.5 "Thumb stick" — 2026-11-03

- On touch-only screens a thumb stick sits bottom right: drag from its centre to walk that way, to the rim to run.
- Let go to stop.

## 0.4 "Dev panel" — 2026-11-03

- A faint line top right shows the version, its name, the frames per second and the work time per frame.
- The backtick key (`) shows or hides it.

## 0.3 "Ink row" — 2026-11-03

- The fibre you carry is drawn as a row of small ink tufts next to the moon, not at the castaway's waist.
- The tufts are faint most of the time and clearer for a moment when their number changes.

## 0.2 "Fords" — 2026-11-03

- You can wade rivers up to your waist.
- Where a river is a narrow brook you can cross anywhere; along the middle reach you cross only at fords, marked by stones sticking out of the water and white rippling water.
- The deep stretch towards the sea cannot be crossed.

## 0.1 "Fire" — 2026-11-03

- You are alone on a large island of terraces, rock walls, rivers and waterfalls. You walk it and climb through its natural passages: a scree slope, a ravine, rock benches, roots and lianas, a mossy route by a waterfall. Trunks, boulders and the open sea stop you.
- Driftwood washes up with the tide, which comes in and goes out twice a day. You carry up to three pieces and lay them in piles; every high water brings new wood.
- Husk coconuts under the palms for a tuft of fibre.
- You sleep when you are tired. The moon in the corner shows how rested you are; sleep by a fire and you wake fully rested.
- Drill a fire on a pile of four dry pieces with a tuft of fibre, and feed it with wood. Take a burning brand from the fire as a torch and light a pile with it.
- A day lasts twenty minutes, with a golden sun and a dim, moonlit night that the fire and the torch light.
