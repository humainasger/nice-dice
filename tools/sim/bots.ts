// Bots for the headless sim: the active clicker and the idle player (docs/plans/active/m1-core.md,
// Sim). A bot is handed the state once per simulated second and answers with the next state through
// dispatch; time and randomness stay in core. Both shop the same way: the purchase with the most
// multiplier per point first, saving for it when it is not yet affordable.
import { dispatch, dieView, N, type Command, type GameState } from '@/core'

export const STRATEGIES = ['active', 'idle'] as const
export type Strategy = (typeof STRATEGIES)[number]

export function isStrategy(value: string): value is Strategy {
  return (STRATEGIES as readonly string[]).includes(value)
}

export interface Bot {
  readonly strategy: Strategy
  /** One decision round at state.playMs. Returns the same object when nothing happened. */
  act(state: GameState): GameState
  /** Manual rolls per second the bot makes at this state; the report adds them to the income figure. */
  manualRollsPerSecond(state: GameState): number
}

/** How often the idle bot shops, in simulated ms (m1-core.md: every 30 s). */
export const IDLE_BUY_EVERY_MS = 30_000
/** Guard against a shopping loop that never settles; a round normally ends after a handful of buys. */
const MAX_PURCHASES_PER_ROUND = 10_000

export interface Purchase {
  readonly command: Command
  /** Multiplier gained per point spent. */
  readonly ratio: number
}

/**
 * The purchase with the most multiplier per point: one level of an owned die (+baseMultiplier for
 * levelCost) or an unlocked, unowned die (+baseMultiplier for baseCost). Ties go to content order.
 * null when nothing is for sale (every die owned and nothing levelable never happens in M1).
 */
export function bestPurchase(state: GameState): Purchase | null {
  let best: Purchase | null = null
  for (const die of state.dice) {
    const view = dieView(state, die.id)
    if (!view.owned && !view.unlocked) continue
    const cost = N.toNumber(view.nextCost)
    if (!Number.isFinite(cost) || cost <= 0) continue
    const ratio = view.def.baseMultiplier / cost
    if (best === null || ratio > best.ratio) {
      const command: Command = view.owned
        ? { type: 'levelDie', id: die.id, count: 1 }
        : { type: 'buyDie', id: die.id }
      best = { command, ratio }
    }
  }
  return best
}

/**
 * Buys the best purchase while it is affordable, re-ranking after each buy. When the best one is
 * not affordable the bot saves for it rather than buying a worse substitute, so the dice table is
 * played the way a value-minded player would.
 */
export function buyGreedily(state: GameState): GameState {
  let next = state
  for (let round = 0; round < MAX_PURCHASES_PER_ROUND; round++) {
    const best = bestPurchase(next)
    if (best === null) break
    const after = dispatch(next, best.command)
    if (after === next) break
    next = after
  }
  return next
}

/** Rolls by hand once a second until auto-roll unlocks, then lets auto-roll earn; shops every second. */
const active: Bot = {
  strategy: 'active',
  act(state) {
    const rolled = state.autoRoll.unlocked ? state : dispatch(state, { type: 'roll' })
    return buyGreedily(rolled)
  },
  manualRollsPerSecond: (state) => (state.autoRoll.unlocked ? 0 : 1),
}

/** Never rolls by hand; shops every 30 s. With auto-roll locked at the start it earns nothing by itself. */
const idle: Bot = {
  strategy: 'idle',
  act(state) {
    return state.playMs % IDLE_BUY_EVERY_MS === 0 ? buyGreedily(state) : state
  },
  manualRollsPerSecond: () => 0,
}

export const bots: Readonly<Record<Strategy, Bot>> = { active, idle }

export function createBot(strategy: Strategy): Bot {
  return bots[strategy]
}
