// State types for the M1 game: what a save holds and what dispatch and advance transform. Every
// field is readonly; updates build new objects and share the untouched parts (structural sharing).
import type { Id } from '@/content'
import type { Num } from './num'

/** One die slot per content die. level >= 1 when owned, 0 when not. */
export interface DieState {
  readonly id: Id
  readonly owned: boolean
  readonly level: number
}

/** The most recent roll. faces holds one face per owned die, in content order; at is playMs at the roll. */
export interface RollResult {
  readonly faces: readonly number[]
  readonly gained: Num
  readonly at: number
}

/** Auto-roll: unlocked by the content rule, toggled by the player, ticking in simulated time. */
export interface AutoRoll {
  readonly unlocked: boolean
  readonly enabled: boolean
  readonly intervalMs: number
  readonly elapsedMs: number
}

export interface GameState {
  /** SAVE_VERSION the state was built for. */
  readonly version: number
  /** Original seed, kept for the sim and bug reports. */
  readonly seed: number
  /** Serialised xoroshiro128plus state; advanced by every roll. */
  readonly rng: readonly number[]
  /** Spendable points. */
  readonly points: Num
  /** Lifetime points; drives unlocks and stats. */
  readonly totalEarned: Num
  readonly rolls: number
  /** Simulated milliseconds advanced, never wall clock. The app owns wall-clock time. */
  readonly playMs: number
  /** One per content die, in content order. The first die starts owned at level 1. */
  readonly dice: readonly DieState[]
  readonly autoRoll: AutoRoll
  readonly lastRoll: RollResult | null
}
