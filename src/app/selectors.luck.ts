// Selectors for the luck shop (src/ui/meta/LuckPanel.tsx) and the auto-level switch on the dice
// board: primitives and strings, plus one row view per luck upgrade that the call site wraps in
// useShallow. describeLuckEffect is pure and builds the effect line from the content def, so a
// retuned value or a new level reads right without touching the panel.
import { content, type LuckUpgradeDef, type LuckUpgradeId } from '@/content'
import { N, autoLevelAvailable, dieDef, headStartLevel, luckEffects, luckUpgradeView, type GameState } from '@/core'
import type { StoreState } from './store'

const PERCENT = 100
/** The die head_start raises: the one every run starts with. */
const FIRST_DIE = 'die_1'

// Header
export const selectLuckSpendable = (s: StoreState): number => s.game.luck
export const selectLuckTotal = (s: StoreState): number => s.game.luckTotal
/** Luck spent so far: lifetime minus what is left. */
export const selectLuckSpent = (s: StoreState): number => Math.max(0, s.game.luckTotal - s.game.luck)
/** Luck has been earned at least once, so the shop is open; before that the rows show greyed. */
export const selectLuckShopOpen = (s: StoreState): boolean => s.game.luckTotal > 0
/** Luck per tenfold of run points past the threshold, for the reset preview's formula line. */
export const selectLuckPerDecade = (): number => content.rules.luck.perDecade

// What the next reset keeps, from the owned upgrades
/** Charms a luck reset keeps (the memory upgrade), 0 without it. */
export const selectMemoryKept = (s: StoreState): number => Math.floor(luckEffects(s.game).memory)
/** The level the first die starts a new run at (1 without head_start). */
export const selectHeadStartLevel = (s: StoreState): number => headStartLevel(luckEffects(s.game))
export const selectFirstDieName = (): string => dieDef(FIRST_DIE).name

// Auto-level (steady_hands)
export const selectAutoLevelAvailable = (s: StoreState): boolean => autoLevelAvailable(s.game)
export const selectAutoLevel = (s: StoreState): boolean => s.game.autoLevel

/** Whole percent of a step above 1: 0.15 gives 15. */
function percent(value: number): number {
  return Math.round(value * PERCENT)
}

/** "x0.72": a plain factor through the one formatter. */
function factor(value: number): string {
  return `x${N.format(N.from(value))}`
}

/**
 * One line of what an upgrade does per level and, once bought, where it stands now:
 * "x0.92 auto-roll interval per level, now x0.72". Built from the def, never hard-coded.
 */
export function describeLuckEffect(def: LuckUpgradeDef, level: number): string {
  const { kind, value } = def.effect
  const owned = level > 0
  switch (kind) {
    case 'head_start':
      return `${dieDef(FIRST_DIE).name} starts every run ${value} levels higher per level${owned ? `, now at level ${Math.max(1, value * level)}` : ''}`
    case 'quick_hands':
      return `${factor(value)} auto-roll interval per level${owned ? `, now ${factor(Math.pow(value, level))}` : ''}`
    case 'deep_pockets':
      return `${factor(value)} points per level${owned ? `, now x${N.format(N.pow(value, level))}` : ''}`
    case 'keen_eye':
      return `+${percent(value)}% on every hand multiplier per level${owned ? `, now +${percent(value * level)}%` : ''}`
    case 'lucky_draw':
      return `+${value} charm in every draft offer per level${owned ? `, now ${content.rules.draft.offerSize + value * level} per offer` : ''}`
    case 'memory':
      return `${value} more charm survives a luck reset per level, rarest first${owned ? `, now ${value * level} kept` : ''}`
    case 'steady_hands':
      return owned
        ? 'Auto-level is yours: the switch sits in the dice board header'
        : 'Unlocks the auto-level switch in the dice board header'
  }
}

/** One upgrade row, primitives and strings only. */
export interface LuckUpgradeRowView {
  readonly id: LuckUpgradeId
  readonly name: string
  readonly description: string
  readonly level: number
  readonly maxLevel: number
  readonly effectText: string
  /** Luck price of the next level; 0 at the cap. */
  readonly nextCost: number
  readonly affordable: boolean
  readonly maxed: boolean
}

export function luckUpgradeRow(game: GameState, id: LuckUpgradeId): LuckUpgradeRowView {
  const v = luckUpgradeView(game, id)
  return {
    id,
    name: v.def.name,
    description: v.def.description,
    level: v.level,
    maxLevel: v.maxLevel,
    effectText: describeLuckEffect(v.def, v.level),
    nextCost: v.nextCost ?? 0,
    affordable: v.affordable,
    maxed: v.maxed,
  }
}

/** Selector factory for one upgrade row. Memoise at the call site and wrap in useShallow. */
export function selectLuckUpgradeRow(id: LuckUpgradeId): (s: StoreState) => LuckUpgradeRowView {
  return (s) => luckUpgradeRow(s.game, id)
}

/** Some upgrade is below its cap and within the spendable luck: the Luck tab shows its attention dot. */
export const selectLuckShopReady = (s: StoreState): boolean => content.luckUpgrades.some((def) => luckUpgradeView(s.game, def.id).affordable)
