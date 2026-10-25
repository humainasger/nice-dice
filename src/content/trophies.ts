// The trophies table: fourteen achievements (GDD section 10; docs/plans/active/m3-game.md
// section 6). Each held trophy multiplies points by rules.trophy.multiplier. Conditions read one
// field of the state each; core checks them after every change that can complete one.
import type { TrophyDef } from './schema'

const NOTES = 'baseline from docs/plans/active/m3-game.md section 6, tune via GDD section 10'

export const trophies: readonly TrophyDef[] = [
  { id: 'first_roll', name: 'First Roll', description: 'Roll the dice once.', condition: { kind: 'rolls', count: 1 }, notes: NOTES },
  { id: 'hundred_rolls', name: 'Warm Hands', description: 'Roll 100 times.', condition: { kind: 'rolls', count: 100 }, notes: NOTES },
  { id: 'thousand_rolls', name: 'Regular', description: 'Roll 1,000 times.', condition: { kind: 'rolls', count: 1000 }, notes: NOTES },
  { id: 'ten_thousand_rolls', name: 'Part of the Furniture', description: 'Roll 10,000 times.', condition: { kind: 'rolls', count: 10000 }, notes: NOTES },
  { id: 'second_die', name: 'Company', description: 'Buy the second die.', condition: { kind: 'dieOwned', id: 'die_2' }, notes: NOTES },
  { id: 'third_die', name: 'A Crowd', description: 'Buy the third die.', condition: { kind: 'dieOwned', id: 'die_3' }, notes: NOTES },
  { id: 'fourth_die', name: 'Full Table', description: 'Buy the fourth die.', condition: { kind: 'dieOwned', id: 'die_4' }, notes: NOTES },
  { id: 'fifth_die', name: 'The Whole Set', description: 'Buy the fifth die.', condition: { kind: 'dieOwned', id: 'die_5' }, notes: NOTES },
  { id: 'first_ascension', name: 'Over the Top', description: 'Ascend a die for the first time.', condition: { kind: 'ascensions', count: 1 }, notes: NOTES },
  { id: 'first_charm', name: 'Lucky Charm', description: 'Pick your first charm.', condition: { kind: 'charms', count: 1 }, notes: NOTES },
  { id: 'first_luck', name: 'Pressed Your Luck', description: 'Prestige for the first time.', condition: { kind: 'prestiges', count: 1 }, notes: NOTES },
  { id: 'five_of_a_kind', name: 'Five Alike', description: 'Roll five of a kind.', condition: { kind: 'hand', combo: 'five_kind' }, notes: NOTES },
  { id: 'million', name: 'Millionaire', description: 'Earn 1,000,000 points in total.', condition: { kind: 'totalEarned', amount: 1000000 }, notes: NOTES },
  { id: 'billion', name: 'Billionaire', description: 'Earn 1,000,000,000 points in total.', condition: { kind: 'totalEarned', amount: 1000000000 }, notes: NOTES },
]
