// Commands and dispatch: the only way a player action changes state. Pure; an invalid command or
// a no-op returns the very same state object, so callers can tell "nothing happened" by identity.
import type { Id } from '@/content'
import { dieDef } from './defs'
import { bulkCost, findDie, maxAffordable, unlockSatisfied } from './formulas'
import { N } from './num'
import { performRoll, unlockAutoRoll } from './roll'
import { createInitialState } from './save'
import type { DieState, GameState } from './state'

export type Command =
  /** Manual roll, always allowed. */
  | { readonly type: 'roll' }
  /** Buy an unowned die whose unlock condition holds and whose baseCost is affordable. */
  | { readonly type: 'buyDie'; readonly id: Id }
  /** Buy up to `count` levels of an owned die, as many as affordable. 'max' buys every affordable level. */
  | { readonly type: 'levelDie'; readonly id: Id; readonly count: number | 'max' }
  /** Switch auto-roll on or off; only once it is unlocked. */
  | { readonly type: 'setAutoRoll'; readonly enabled: boolean }
  /** New game from a seed. */
  | { readonly type: 'reset'; readonly seed: number }

export function dispatch(state: GameState, command: Command): GameState {
  switch (command.type) {
    case 'roll':
      return performRoll(state, state.playMs)
    case 'buyDie':
      return buyDie(state, command.id)
    case 'levelDie':
      return levelDie(state, command.id, command.count)
    case 'setAutoRoll':
      return setAutoRoll(state, command.enabled)
    case 'reset':
      return typeof command.seed === 'number' && Number.isFinite(command.seed) ? createInitialState(command.seed) : state
    default:
      // Unknown type at runtime (a command built from untyped data): nothing happens.
      return state
  }
}

function replaceDie(dice: readonly DieState[], id: Id, next: DieState): DieState[] {
  return dice.map((die) => (die.id === id ? next : die))
}

function buyDie(state: GameState, id: Id): GameState {
  const die = findDie(state, id)
  if (die === undefined || die.owned) return state
  const def = dieDef(id)
  if (!unlockSatisfied(def.unlock, state)) return state
  const cost = N.from(def.baseCost)
  if (N.lt(state.points, cost)) return state
  return unlockAutoRoll({
    ...state,
    points: N.max(N.sub(state.points, cost), N.zero),
    dice: replaceDie(state.dice, id, { id, owned: true, level: 1 }),
  })
}

function levelDie(state: GameState, id: Id, count: number | 'max'): GameState {
  const die = findDie(state, id)
  if (die === undefined || !die.owned) return state
  if (count !== 'max' && !(Number.isSafeInteger(count) && count >= 1)) return state
  const def = dieDef(id)
  const affordable = maxAffordable(def, die.level, state.points)
  const levels = count === 'max' ? affordable : Math.min(count, affordable)
  if (levels <= 0) return state
  return unlockAutoRoll({
    ...state,
    points: N.max(N.sub(state.points, bulkCost(def, die.level, levels)), N.zero),
    dice: replaceDie(state.dice, id, { ...die, level: die.level + levels }),
  })
}

function setAutoRoll(state: GameState, enabled: boolean): GameState {
  if (typeof enabled !== 'boolean') return state
  if (!state.autoRoll.unlocked || state.autoRoll.enabled === enabled) return state
  return { ...state, autoRoll: { ...state.autoRoll, enabled } }
}
