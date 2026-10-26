// The trophies table: fourteen achievements (GDD section 10; docs/plans/active/m3-game.md
// section 6). Shown to the player as "Marks", a dicewright's maker's marks, since M5
// (docs/plans/active/m5-theme.md); the ids, the code name and the save field stay "trophies".
// Each held trophy multiplies points by rules.trophy.multiplier. Conditions read one field of the
// state each; core checks them after every change that can complete one.
import type { TrophyDef } from './schema'

const NOTES = 'baseline from docs/plans/active/m3-game.md section 6, names from m5-theme.md, tune via GDD section 10'

export const trophies: readonly TrophyDef[] = [
  { id: 'first_roll', name: 'First Throw', description: 'Roll a die on the bench once.', condition: { kind: 'rolls', count: 1 }, notes: NOTES },
  { id: 'hundred_rolls', name: 'Warm Hands', description: 'Roll 100 times.', condition: { kind: 'rolls', count: 100 }, notes: NOTES },
  { id: 'thousand_rolls', name: 'Journeyman', description: 'Roll 1,000 times.', condition: { kind: 'rolls', count: 1000 }, notes: NOTES },
  { id: 'ten_thousand_rolls', name: 'Groove in the Bench', description: 'Roll 10,000 times. The wood remembers.', condition: { kind: 'rolls', count: 10000 }, notes: NOTES },
  { id: 'second_die', name: 'Oak Shavings', description: 'Carve the Oak Die.', condition: { kind: 'dieOwned', id: 'die_2' }, notes: NOTES },
  { id: 'third_die', name: 'Bone Dust', description: 'Carve the Bone Die.', condition: { kind: 'dieOwned', id: 'die_3' }, notes: NOTES },
  { id: 'fourth_die', name: 'Brass Filings', description: 'Carve the Brass Die.', condition: { kind: 'dieOwned', id: 'die_4' }, notes: NOTES },
  { id: 'fifth_die', name: 'The Whole Set', description: 'Carve the Obsidian Die. Five dice on the bench.', condition: { kind: 'dieOwned', id: 'die_5' }, notes: NOTES },
  { id: 'first_ascension', name: 'First Refinement', description: 'Refine a die for the first time.', condition: { kind: 'ascensions', count: 1 }, notes: NOTES },
  { id: 'first_charm', name: 'Hung by the Lamp', description: 'Pick your first charm.', condition: { kind: 'charms', count: 1 }, notes: NOTES },
  { id: 'first_luck', name: 'Pressed Your Luck', description: 'Reset for luck for the first time.', condition: { kind: 'prestiges', count: 1 }, notes: NOTES },
  { id: 'five_of_a_kind', name: 'Five Alike', description: 'Roll five of a kind.', condition: { kind: 'hand', combo: 'five_kind' }, notes: NOTES },
  { id: 'million', name: 'Earned Your Keep', description: 'Earn 1,000,000 points in total.', condition: { kind: 'totalEarned', amount: 1000000 }, notes: NOTES },
  { id: 'billion', name: 'Set for Life', description: 'Earn 1,000,000,000 points in total.', condition: { kind: 'totalEarned', amount: 1000000000 }, notes: NOTES },
]
