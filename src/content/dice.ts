// The dice table: what each die costs, how its price grows per level, what it multiplies and
// when it unlocks. Plain numbers only; core wraps them in Num when it computes. Names follow the
// dicewright fantasy (docs/plans/active/m5-theme.md): one material per die, softest first, with a
// one-line material note ahead of the tuning note.
import type { DieDef } from './schema'

export const dice: readonly DieDef[] = [
  {
    id: 'die_1',
    name: 'Pine Die',
    sides: 6,
    baseCost: 10,
    costGrowth: 1.08,
    baseMultiplier: 1,
    unlock: { kind: 'always' },
    notes: 'Pine: soft, pale and quick to carve, the first die every dicewright makes. Numbers: baseline from PLAN.md section 3, tune via GDD section 4.',
  },
  {
    id: 'die_2',
    name: 'Oak Die',
    sides: 6,
    baseCost: 100,
    costGrowth: 1.08,
    baseMultiplier: 2,
    unlock: { kind: 'owned', id: 'die_1', count: 1 },
    notes: 'Oak: hard, heavy and close-grained, it lands with a knock. Numbers: baseline from PLAN.md section 3, tune via GDD section 4.',
  },
  {
    id: 'die_3',
    name: 'Bone Die',
    sides: 6,
    baseCost: 1000,
    costGrowth: 1.08,
    baseMultiplier: 4,
    unlock: { kind: 'owned', id: 'die_2', count: 1 },
    notes: 'Bone: boiled, bleached and polished, the old trade standard. Numbers: baseline from PLAN.md section 3, tune via GDD section 4.',
  },
  {
    id: 'die_4',
    name: 'Brass Die',
    sides: 6,
    baseCost: 10000,
    costGrowth: 1.08,
    baseMultiplier: 8,
    unlock: { kind: 'owned', id: 'die_3', count: 1 },
    notes: 'Brass: cast, filed and lacquered, it rings on the bench. Numbers: baseline from PLAN.md section 3, tune via GDD section 4.',
  },
  {
    id: 'die_5',
    name: 'Obsidian Die',
    sides: 6,
    // Idle Dice baseline 100000. Tuned 2026-10-25 so the active bot owns all five dice inside the
    // 45 minute window (docs/BALANCE_LOG.md); GDD section 4 row die_5 carries the value.
    baseCost: 35000,
    costGrowth: 1.08,
    baseMultiplier: 16,
    unlock: { kind: 'owned', id: 'die_4', count: 1 },
    notes:
      'Obsidian: volcanic glass ground with grit for a week, one slip and it shatters. Numbers: baseline from PLAN.md section 3 with baseCost tuned 2026-10-25, see docs/BALANCE_LOG.md; tune via GDD section 4.',
  },
]
