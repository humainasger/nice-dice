// State types for the game: what a save holds and what dispatch and advance transform. Every
// field is readonly; updates build new objects and share the untouched parts (structural sharing).
import type { ComboId, Id, LuckUpgradeId } from '@/content'
import type { Num } from './num'

/** One die slot per content die. level >= 1 when owned, 0 when not. */
export interface DieState {
  readonly id: Id
  readonly owned: boolean
  readonly level: number
  /** The value printed on each of the six sides, in side order; starts 1 to 6, raised by upgradeFace. */
  readonly faces: readonly number[]
  /** Times the die has ascended (level back to 1, output x rules.ascension.multiplier each). */
  readonly ascensions: number
  /** Face upgrades bought on this die; drives the next face cost. */
  readonly faceUpgrades: number
}

/**
 * The most recent roll. faces holds the side (1 to 6) each owned die landed on, in content order;
 * the points came from the values printed on those sides. hand is the best combo the sides made.
 */
export interface RollResult {
  readonly faces: readonly number[]
  readonly gained: Num
  readonly at: number
  readonly hand: ComboId | null
}

/** Auto-roll: unlocked by the content rule, toggled by the player, ticking in simulated time. */
export interface AutoRoll {
  readonly unlocked: boolean
  readonly enabled: boolean
  readonly intervalMs: number
  readonly elapsedMs: number
}

/** The charm draft: ascensions fill progress; at the requirement an offer opens until a pick. */
export interface Draft {
  readonly progress: number
  /** Charms taken this run; the requirement grows with it. */
  readonly taken: number
  /** The charms on offer, or null while no draft is open. */
  readonly offer: readonly Id[] | null
  /** The free reroll of this offer has been used. */
  readonly rerolled: boolean
}

/** Lifetime statistics; never reset. */
export interface Stats {
  readonly bestRoll: Num
  /** Rolls whose best hand was each combo. */
  readonly hands: Readonly<Partial<Record<ComboId, number>>>
  /** playMs of the last prestige (0 before the first). */
  readonly lastLuckAt: number
}

export interface GameState {
  /** SAVE_VERSION the state was built for. */
  readonly version: number
  /** Original seed, kept for the sim and bug reports. */
  readonly seed: number
  /** Serialised xoroshiro128plus state; advanced by every roll and every draft offer. */
  readonly rng: readonly number[]
  /** Spendable points. */
  readonly points: Num
  /** Lifetime points; drives trophies and stats. */
  readonly totalEarned: Num
  /** Points earned since the last prestige; drives the luck preview. */
  readonly totalEarnedRun: Num
  readonly rolls: number
  /** Simulated milliseconds advanced, never wall clock. The app owns wall-clock time. */
  readonly playMs: number
  /** One per content die, in content order. The first die starts owned at level 1. */
  readonly dice: readonly DieState[]
  readonly autoRoll: AutoRoll
  readonly lastRoll: RollResult | null
  /** Upgrade level per hand; a hand with no entry is level 0. */
  readonly combos: Readonly<Partial<Record<ComboId, number>>>
  /** Charms held this run, in pick order. The same charm may appear more than once. */
  readonly charms: readonly Id[]
  readonly draft: Draft
  /** Spendable luck: earned by prestige, spent on luck upgrades. Never above luckTotal. */
  readonly luck: number
  /** Lifetime luck earned, spent or not; drives the points multiplier 1 + rules.luck.perPoint x luckTotal. */
  readonly luckTotal: number
  /** Level per luck upgrade; an upgrade with no entry is level 0. Permanent across runs. */
  readonly luckUpgrades: Readonly<Partial<Record<LuckUpgradeId, number>>>
  readonly prestiges: number
  /** Trophies held, in the order earned. */
  readonly trophies: readonly Id[]
  /** The latest trophy earned and not yet shown; cleared by clearNewTrophy. */
  readonly newTrophy: Id | null
  /** Ascend a die the moment it reaches the level cap. */
  readonly autoAscend: boolean
  /**
   * Auto-level switch: once per rules.luck.autoLevelEveryMs of simulated time, buy the cheapest
   * affordable die level, then the next die when affordable. Only acts while the steady_hands
   * upgrade is owned; buying it switches this on.
   */
  readonly autoLevel: boolean
  readonly stats: Stats
}
