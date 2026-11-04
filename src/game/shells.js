/**
 * game/shells — storing water and coconuts (0.25 "Shell"): the empty half
 * shells he keeps after eating a coconut, and the whole coconuts he carries.
 *
 * Rules
 *   - After husking and eating a coconut he keeps its empty half shell, at
 *     most SHELL_MAX (2); with two he keeps none (the new one is dropped).
 *   - An empty shell can be filled at fresh river water (FILL_TIME of
 *     kneeling, game/game). A full one is drunk anywhere: it takes SIP_DRINK
 *     (half a day) off the thirst, never below 0, and the shell is empty
 *     again. Water in a shell does not spoil.
 *   - A coconut on the ground is always husked first (HUSK_TIME, game/game).
 *     When he is not hungry he carries the husked nut instead of eating it, at
 *     most NUT_MAX (2); with two he eats it anyway. A carried nut is already
 *     husked: eating it takes EAT_TIME, gives no tuft and leaves the shell. It
 *     does not spoil. (Nuts carried in saves from before 0.27.1 were unhusked;
 *     they are simply treated as husked.) Shells and nuts weigh nothing: they never slow him and are
 *     not wood (they show only in the row, render/carryMark).
 *   - Thresholds for the action button (game/game `action`): at river water a
 *     press drinks when thirst is more than DRINK_AT (a tenth of a day) or he has no
 *     empty shell, else it fills an empty one; away from the water a full
 *     shell is drunk when thirst is more than SIP_AT (a quarter day); a
 *     husked coconut is eaten, and a carried one eaten, when hunger is more
 *     than EAT_AT (half a day), else the husked one is carried.
 *
 * Pure data; no DOM, no Three.js.
 *
 * SHELL_MAX, NUT_MAX, SIP_DRINK, FILL_TIME, EAT_TIME, SIP_TIME, DRINK_AT, SIP_AT, EAT_AT
 * createShells(saved?) -> shells
 *   shells.list        [full] one boolean per shell kept, oldest first (true: filled with water)
 *   shells.nuts        coconuts carried, 0..NUT_MAX
 *   shells.empty()     number of empty shells        shells.full()  number of full ones
 *   shells.keep()      true when a new empty shell was kept (false: already SHELL_MAX)
 *   shells.fill()      true when an empty shell was filled
 *   shells.pour()      true when a full shell was drunk (it is empty again)
 *   shells.addNut()    true when a husked nut was kept (false: NUT_MAX)
 *   shells.eatNut()    true when a carried nut was used up
 *   shells.state() -> { full: [bool], nuts }   plain, for saving
 *   saved: such a state, to start from (bad parts are dropped)
 *
 * Depends on: nothing
 */
export const SHELL_MAX = 2, NUT_MAX = 2;
export const SIP_DRINK = 0.5;      // days of thirst a full shell takes away
export const FILL_TIME = 2;        // seconds of kneeling to fill a shell
export const EAT_TIME = 2;         // seconds of kneeling to eat a carried (already husked) nut
export const SIP_TIME = 1.5;       // seconds to drink a shell
export const DRINK_AT = 0.1;       // at the water: drink when thirst is above this, else fill a shell
export const SIP_AT = 0.25;        // away from the water: drink a full shell when thirst is above this
export const EAT_AT = 0.5;         // eat a husked coconut (on the spot or carried) when hunger is above this, else carry it

export function createShells(saved) {
  const shells = {
    list: [], nuts: 0,
    empty: () => shells.list.filter(f => !f).length,
    full: () => shells.list.filter(f => f).length,
    keep() { if (shells.list.length >= SHELL_MAX) return false; shells.list.push(false); return true; },
    fill() { const i = shells.list.indexOf(false); if (i < 0) return false; shells.list[i] = true; return true; },
    pour() { const i = shells.list.indexOf(true); if (i < 0) return false; shells.list[i] = false; return true; },
    addNut() { if (shells.nuts >= NUT_MAX) return false; shells.nuts++; return true; },
    eatNut() { if (shells.nuts <= 0) return false; shells.nuts--; return true; },
    state: () => ({ full: shells.list.slice(), nuts: shells.nuts }),
  };
  if (saved) {
    if (Array.isArray(saved.full)) shells.list = saved.full.slice(0, SHELL_MAX).map(f => f === true);
    if (Number.isFinite(saved.nuts)) shells.nuts = Math.max(0, Math.min(NUT_MAX, Math.floor(saved.nuts)));
  }
  return shells;
}
