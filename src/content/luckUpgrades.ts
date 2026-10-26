// The luck upgrades table: the seven permanent upgrades luck buys (docs/plans/active/m4-luck.md
// section 2; GDD section 7.1). Cost of the next level = ceil(baseCost x costGrowth ^ level), paid
// in spendable luck; levels survive every luck reset. Plain values only; core applies the effects
// in src/core/formulas.ts and src/core/commands.ts.
import type { LuckUpgradeDef } from './schema'

const NOTES = 'baseline from docs/plans/active/m4-luck.md section 2, tune via GDD section 7.1'

export const luckUpgrades: readonly LuckUpgradeDef[] = [
  {
    id: 'head_start',
    name: 'Head Start',
    description: 'Every run begins with the first die at level 10 per level.',
    maxLevel: 5,
    baseCost: 2,
    costGrowth: 1.6,
    effect: { kind: 'head_start', value: 10 },
    notes: NOTES,
  },
  {
    id: 'quick_hands',
    name: 'Quick Hands',
    description: 'Auto-roll waits 8% less between rolls per level.',
    maxLevel: 8,
    baseCost: 1,
    costGrowth: 1.5,
    effect: { kind: 'quick_hands', value: 0.92 },
    notes: NOTES,
  },
  {
    id: 'deep_pockets',
    name: 'Deep Pockets',
    description: 'Every roll pays x1.2 per level.',
    maxLevel: 10,
    baseCost: 1,
    costGrowth: 1.4,
    effect: { kind: 'deep_pockets', value: 1.2 },
    notes: NOTES,
  },
  {
    id: 'keen_eye',
    name: 'Keen Eye',
    description: 'Every hand multiplier is 15% higher per level.',
    maxLevel: 5,
    baseCost: 2,
    costGrowth: 1.6,
    effect: { kind: 'keen_eye', value: 0.15 },
    notes: NOTES,
  },
  {
    id: 'lucky_draw',
    name: 'Lucky Draw',
    description: 'Every draft offers one more charm per level.',
    maxLevel: 2,
    baseCost: 4,
    costGrowth: 2,
    effect: { kind: 'lucky_draw', value: 1 },
    notes: NOTES,
  },
  {
    id: 'memory',
    name: 'Memory',
    description: 'One charm per level survives a luck reset, the rarest first.',
    maxLevel: 3,
    baseCost: 5,
    costGrowth: 2,
    effect: { kind: 'memory', value: 1 },
    notes: NOTES,
  },
  {
    id: 'steady_hands',
    name: 'Steady Hands',
    description: 'Auto-level: every second buys the cheapest die level you can afford, and the next die when you can.',
    maxLevel: 1,
    baseCost: 3,
    costGrowth: 1,
    effect: { kind: 'steady_hands', value: 1 },
    notes: NOTES,
  },
]
