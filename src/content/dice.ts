// The dice table: what each die costs, how its price grows per level, what it multiplies and
// when it unlocks. Plain numbers only; core wraps them in Num when it computes.
import type { DieDef } from './schema'

const NOTES = 'baseline from PLAN.md section 3, tune via GDD section 4'

export const dice: readonly DieDef[] = [
  {
    id: 'die_1',
    name: 'First Die',
    sides: 6,
    baseCost: 10,
    costGrowth: 1.08,
    baseMultiplier: 1,
    unlock: { kind: 'always' },
    notes: NOTES,
  },
  {
    id: 'die_2',
    name: 'Second Die',
    sides: 6,
    baseCost: 100,
    costGrowth: 1.08,
    baseMultiplier: 2,
    unlock: { kind: 'owned', id: 'die_1', count: 1 },
    notes: NOTES,
  },
  {
    id: 'die_3',
    name: 'Third Die',
    sides: 6,
    baseCost: 1000,
    costGrowth: 1.08,
    baseMultiplier: 4,
    unlock: { kind: 'owned', id: 'die_2', count: 1 },
    notes: NOTES,
  },
  {
    id: 'die_4',
    name: 'Fourth Die',
    sides: 6,
    baseCost: 10000,
    costGrowth: 1.08,
    baseMultiplier: 8,
    unlock: { kind: 'owned', id: 'die_3', count: 1 },
    notes: NOTES,
  },
  {
    id: 'die_5',
    name: 'Fifth Die',
    sides: 6,
    baseCost: 100000,
    costGrowth: 1.08,
    baseMultiplier: 16,
    unlock: { kind: 'owned', id: 'die_4', count: 1 },
    notes: NOTES,
  },
]
