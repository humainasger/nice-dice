// The M1 formulas. Every constant comes from src/content and every game value is a Num; the only
// plain arithmetic here is on content numbers, levels and counts.
import type { DieDef, UnlockCondition } from '@/content'
import { dieDef } from './defs'
import { N, type Num } from './num'
import type { DieState, GameState } from './state'

/** The state slot of a die, or undefined for an id the state does not know. */
export function findDie(state: GameState, id: string): DieState | undefined {
  return state.dice.find((die) => die.id === id)
}

/** Output multiplier of a die at a level: each level adds the base multiplier (Idle Dice). */
export function dieMultiplier(def: DieDef, level: number): Num {
  return N.mul(def.baseMultiplier, level)
}

/** Cost of going from `level` to `level + 1`. Level 0 to 1 is buying the die, at baseCost. */
export function levelCost(def: DieDef, level: number): Num {
  return N.mul(def.baseCost, N.pow(def.costGrowth, level))
}

/** Cost of the next `count` levels from `level`: the geometric sum in closed form. Zero for count <= 0. */
export function bulkCost(def: DieDef, level: number, count: number): Num {
  if (count <= 0) return N.zero
  // A single level is charged exactly the nextCost the UI shows; the closed form lands one ulp under it.
  if (count === 1) return levelCost(def, level)
  const growth = def.costGrowth
  return N.div(N.mul(levelCost(def, level), N.sub(N.pow(growth, count), 1)), growth - 1)
}

/** The largest count a level can carry; a purse past it saturates instead of looping forever. */
const MAX_COUNT = Number.MAX_SAFE_INTEGER

/**
 * Largest count of levels from `level` whose bulkCost fits in `points`; 0 when none does, and
 * MAX_SAFE_INTEGER when even that many fit (a purse of about 1e(3e14) points). Always terminates.
 */
export function maxAffordable(def: DieDef, level: number, points: Num): number {
  if (!N.isFinite(points) || N.lte(points, 0)) return 0
  // bulkCost(count) <= points  <=>  growth^count <= 1 + points * (growth - 1) / levelCost(level)
  const ratio = N.add(1, N.div(N.mul(points, def.costGrowth - 1), levelCost(def, level)))
  let count = floorLog(def.costGrowth, ratio)
  if (count >= MAX_COUNT) return MAX_COUNT
  // The log is taken in doubles, so settle the boundary against bulkCost itself. Both loops move
  // count by whole steps, which only works below MAX_COUNT (count + 1 === count above it).
  while (count > 0 && N.gt(bulkCost(def, level, count), points)) count--
  while (count < MAX_COUNT && N.lte(bulkCost(def, level, count + 1), points)) count++
  return count
}

/** floor(log_base(value)) for base > 1 and value >= 1, off by at most one near a boundary, capped at MAX_COUNT. */
function floorLog(base: number, value: Num): number {
  const asDouble = N.toNumber(value)
  if (Number.isFinite(asDouble)) {
    return Math.min(Math.max(0, Math.floor(Math.log(asDouble) / Math.log(base))), MAX_COUNT)
  }
  // value is past the double range: gallop to a power above it, then bisect. The gallop stops at
  // MAX_COUNT and the bisection steps from low, so neither can stall on a mid that equals a bound.
  let low = 0
  let high = 1
  while (N.lte(N.pow(base, high), value)) {
    if (high >= MAX_COUNT) return MAX_COUNT
    low = high
    high = Math.min(high * 2, MAX_COUNT)
  }
  while (high - low > 1) {
    const mid = low + Math.floor((high - low) / 2)
    if (N.lte(N.pow(base, mid), value)) low = mid
    else high = mid
  }
  return low
}

/** Points for one roll: each owned die's face times its multiplier. faces follow the owned dice in content order. */
export function rollPoints(state: GameState, faces: readonly number[]): Num {
  let total = N.zero
  let next = 0
  for (const die of state.dice) {
    if (!die.owned) continue
    const face = faces[next]
    next += 1
    if (face === undefined) throw new Error(`rollPoints needs one face per owned die, got ${faces.length}`)
    total = N.add(total, N.mul(face, dieMultiplier(dieDef(die.id), die.level)))
  }
  return total
}

/** Mean points per roll: each owned die's mean face ((sides + 1) / 2, so 3.5 on a d6) times its multiplier. */
export function expectedPointsPerRoll(state: GameState): Num {
  let total = N.zero
  for (const die of state.dice) {
    if (!die.owned) continue
    const def = dieDef(die.id)
    total = N.add(total, N.mul(dieMultiplier(def, die.level), (def.sides + 1) / 2))
  }
  return total
}

/** Whether an unlock condition holds. `owned` means that die is owned at or above the given level. */
export function unlockSatisfied(condition: UnlockCondition, state: GameState): boolean {
  switch (condition.kind) {
    case 'always':
      return true
    case 'totalEarned':
      return N.gte(state.totalEarned, condition.amount)
    case 'owned': {
      const die = findDie(state, condition.id)
      return die !== undefined && die.owned && die.level >= condition.count
    }
    case 'prestiges':
      // No prestige layer until M5.
      return false
  }
}
