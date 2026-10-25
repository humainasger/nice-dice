// The combos table: the seven poker hands and their base points multipliers (GDD section 5,
// Poker-hand combo row; docs/plans/active/m3-game.md section 1). Weakest to strongest. Upgrade
// cost and step live in rules.combo. Plain numbers only; core detects the hands in src/core/hands.ts.
import type { ComboDef } from './schema'

const NOTES = 'baseline from docs/plans/active/m3-game.md section 1, tune via GDD section 5'

export const combos: readonly ComboDef[] = [
  { id: 'pair', name: 'Pair', base: 2, notes: NOTES },
  { id: 'two_pair', name: 'Two Pair', base: 3, notes: NOTES },
  { id: 'three_kind', name: 'Three of a Kind', base: 4, notes: NOTES },
  { id: 'straight', name: 'Straight', base: 6, notes: NOTES },
  { id: 'full_house', name: 'Full House', base: 8, notes: NOTES },
  { id: 'four_kind', name: 'Four of a Kind', base: 12, notes: NOTES },
  { id: 'five_kind', name: 'Five of a Kind', base: 50, notes: NOTES },
]
