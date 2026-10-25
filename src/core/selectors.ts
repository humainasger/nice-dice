// Pure read helpers for the UI and the sim. They return plain data computed from a state and the
// content tables; nothing here changes state.
import type { DieDef, Id, UnlockCondition } from '@/content'
import { dieDef } from './defs'
import {
  dieMultiplier,
  expectedPointsPerRoll,
  findDie,
  levelCost,
  maxAffordable,
  unlockSatisfied,
} from './formulas'
import { N, type Num } from './num'
import type { GameState } from './state'

export interface DieView {
  readonly def: DieDef
  readonly owned: boolean
  readonly level: number
  /** Current output multiplier (zero while unowned). */
  readonly multiplier: Num
  /** Cost of the next level, or baseCost while unowned. */
  readonly nextCost: Num
  /** points >= nextCost. */
  readonly affordable: boolean
  /** Levels buyable right now; 0 while unowned. */
  readonly maxAffordable: number
  /** The unlock condition holds (always true once owned). */
  readonly unlocked: boolean
  /** Unowned, unlocked and affordable: a buyDie command would succeed. */
  readonly canBuy: boolean
}

/** Everything a die card shows. Throws on an id that is not in content. */
export function dieView(state: GameState, id: Id): DieView {
  const def = dieDef(id)
  const die = findDie(state, id)
  const owned = die?.owned ?? false
  const level = die?.level ?? 0
  const nextCost = levelCost(def, level)
  const affordable = N.gte(state.points, nextCost)
  const unlocked = owned || unlockSatisfied(def.unlock, state)
  return {
    def,
    owned,
    level,
    multiplier: dieMultiplier(def, level),
    nextCost,
    affordable,
    maxAffordable: owned ? maxAffordable(def, level, state.points) : 0,
    unlocked,
    canBuy: !owned && unlocked && affordable,
  }
}

export interface NextUnlock {
  readonly def: DieDef
  readonly unlock: UnlockCondition
  /** The condition already holds; only the cost stands in the way. */
  readonly satisfied: boolean
}

/** The first unowned die in content order, or null once every die is owned. */
export function nextUnlock(state: GameState): NextUnlock | null {
  const die = state.dice.find((slot) => !slot.owned)
  if (die === undefined) return null
  const def = dieDef(die.id)
  return { def, unlock: def.unlock, satisfied: unlockSatisfied(def.unlock, state) }
}

/** Mean points of one roll with the current dice. */
export function pointsPerRollExpected(state: GameState): Num {
  return expectedPointsPerRoll(state)
}

/** Mean points per second from auto-roll; zero while it is locked or switched off. */
export function expectedPointsPerSecond(state: GameState): Num {
  const { autoRoll } = state
  if (!autoRoll.unlocked || !autoRoll.enabled || !(autoRoll.intervalMs > 0)) return N.zero
  return N.div(N.mul(expectedPointsPerRoll(state), 1000), autoRoll.intervalMs)
}
