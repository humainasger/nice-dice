// Auto-level (the steady_hands luck upgrade): once per rules.luck.autoLevelEveryMs of simulated
// time, advance runs one pass that buys the cheapest affordable level across the owned dice and
// then the next die when it is unlocked and affordable. Both buys go through dispatch, so they
// cost and behave exactly as the player's own levelDie and buyDie would (auto-ascend included).
import { dispatch } from './commands'
import { dieDef, rules } from './defs'
import { autoLevelAvailable, levelCap, levelCost, unlockSatisfied } from './formulas'
import { N, type Num } from './num'
import type { GameState } from './state'

/** Whether auto-level runs at all: switched on and the upgrade owned. */
export function autoLevelActive(state: GameState): boolean {
  return state.autoLevel && autoLevelAvailable(state)
}

/** How many auto-level boundaries lie in (before, after]: one per rules.luck.autoLevelEveryMs crossed. */
export function autoLevelPasses(beforeMs: number, afterMs: number): number {
  const every = rules.luck.autoLevelEveryMs
  return Math.max(0, Math.floor(afterMs / every) - Math.floor(beforeMs / every))
}

/** One pass: the cheapest affordable level of an owned die below the cap, then the next die when affordable. Same object when neither is. */
export function autoLevelOnce(state: GameState): GameState {
  let next = state
  let cheapest: { readonly id: string; readonly cost: Num } | null = null
  const cap = levelCap()
  for (const die of next.dice) {
    if (!die.owned || die.level >= cap) continue
    const cost = levelCost(dieDef(die.id), die.level, die.ascensions)
    if (N.gt(cost, next.points)) continue
    if (cheapest === null || N.lt(cost, cheapest.cost)) cheapest = { id: die.id, cost }
  }
  if (cheapest !== null) next = dispatch(next, { type: 'levelDie', id: cheapest.id, count: 1 })
  const unowned = next.dice.find((die) => !die.owned)
  if (unowned !== undefined) {
    const def = dieDef(unowned.id)
    if (unlockSatisfied(def.unlock, next) && N.gte(next.points, def.baseCost)) next = dispatch(next, { type: 'buyDie', id: unowned.id })
  }
  return next
}
