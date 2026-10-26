// Selectors for the luck shop (src/ui/meta/LuckPanel.tsx), the mastery button on a die card
// (src/ui/DieCard.tsx) and the auto-level switch on the dice board: primitives and strings, plus
// one row view per luck upgrade, one for Fortune's Favour and one per die's mastery that the call
// site wraps in useShallow. describeLuckEffect is pure and builds the effect line from the content
// def, so a retuned value or a new level reads right without touching the panel.
import { content, type Id, type LuckUpgradeDef, type LuckUpgradeId } from '@/content'
import {
  N,
  autoLevelAvailable,
  dieDef,
  favourView,
  headStartLevel,
  luckEffects,
  luckUpgradeView,
  masteryView,
  type GameState,
} from '@/core'
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
        ? "Auto-level is yours: the switch sits in the bench's Automation sheet"
        : "Unlocks the auto-level switch in the bench's Automation sheet"
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

// The two unbounded M5 sinks (rules.favour, rules.mastery). Neither has a cap, so the views carry
// the next cost as a plain number that only ever grows, never a "maxed" flag.

/** The Fortune's Favour row of the Luck tab, primitives and strings only. */
export interface FavourRowView {
  readonly level: number
  /** Luck price of the next level. */
  readonly nextCost: number
  readonly affordable: boolean
  /** Whole percent one level adds to every roll: 5. */
  readonly stepPercent: number
  /** Whole percent the current level adds to every roll: 15 at level 3, 0 unbought. */
  readonly bonusPercent: number
  /** The points factor from favour, formatted: "1.15". */
  readonly multiplier: string
}

export function favourRow(game: GameState): FavourRowView {
  const v = favourView(game)
  const step = content.rules.favour.step
  return {
    level: v.level,
    nextCost: v.nextCost,
    affordable: v.affordable,
    stepPercent: percent(step),
    bonusPercent: percent(step * v.level),
    multiplier: N.format(v.multiplier),
  }
}

/** Wrap in useShallow at the call site. */
export const selectFavourRow = (s: StoreState): FavourRowView => favourRow(s.game)

/** One die's mastery: the badge and button on its card, and its row in the Luck tab. Primitives and strings only. */
export interface MasteryRowView {
  readonly name: string
  /** The die is on the bench this run. Mastery can be bought on an unowned die too; the Luck tab lists owned dice only. */
  readonly owned: boolean
  readonly level: number
  /** Luck price of the next level. */
  readonly nextCost: number
  readonly affordable: boolean
  /** Whole percent one level adds to this die's output: 10. */
  readonly stepPercent: number
  /** Whole percent the current level adds to this die's output: 30 at level 3, 0 unbought. */
  readonly bonusPercent: number
  /** The die's output factor from mastery, formatted: "1.3". */
  readonly multiplier: string
}

export function masteryRow(game: GameState, id: Id): MasteryRowView {
  const v = masteryView(game, id)
  const step = content.rules.mastery.step
  return {
    name: dieDef(id).name,
    owned: game.dice.some((die) => die.id === id && die.owned),
    level: v.level,
    nextCost: v.nextCost,
    affordable: v.affordable,
    stepPercent: percent(step),
    bonusPercent: percent(step * v.level),
    multiplier: N.format(v.multiplier),
  }
}

/** Selector factory for one die's mastery. Memoise at the call site and wrap in useShallow. */
export function selectMasteryRow(id: Id): (s: StoreState) => MasteryRowView {
  return (s) => masteryRow(s.game, id)
}

/** Favour or some die's mastery is within the spendable luck, for the Luck tab's attention dot next to selectLuckShopReady. */
export const selectLuckSinkReady = (s: StoreState): boolean =>
  favourView(s.game).affordable || content.dice.some((def) => masteryView(s.game, def.id).affordable)
