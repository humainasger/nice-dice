// Bots for the headless sim: the active clicker and the idle player (docs/plans/active/m1-core.md,
// Sim, extended by docs/plans/active/m3-game.md). A bot is handed the state once per simulated
// second and answers with the next state through dispatch; time and randomness stay in core. Both
// shop the same way, the M1 rule "the most output multiplier per point first, saving for it when it
// is not yet affordable", with the M3 purchases valued in the same unit: a combo upgrade is worth
// the share of the dice sum its lift of the mean hand multiplier amounts to, a face upgrade the
// share of its die's multiplier one more pip on one side amounts to. The greedy M3 rules: ascend
// whenever a die can, pick the charm that lifts income most, prestige once luckOnReset is at least
// 2 and 20 minutes have passed since the last prestige. The M4 rule (m4-luck.md section 4): right
// after each luck reset, buy luck upgrades greedily by income lift per luck spent.
import { content, LUCK_UPGRADE_IDS, type LuckUpgradeEffectKind, type LuckUpgradeId } from '@/content'
import {
  autoRollInterval,
  bulkCost,
  canAscend,
  comboView,
  dieFaceView,
  dieView,
  dispatch,
  effectiveDieMultiplier,
  expectedComboMultiplier,
  expectedPointsPerRoll,
  levelsBuyable,
  luckOnReset,
  luckUpgradeView,
  N,
  type Command,
  type GameState,
  type Num,
} from '@/core'

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
/** The brief's cooldown between prestiges (m3-game.md, Sim bots). */
export const PRESTIGE_COOLDOWN_MS = 20 * 60_000
/** Luck a prestige must grant before the bot takes it (m3-game.md, Sim bots). */
export const PRESTIGE_MIN_LUCK = 2
/** Guard against a shopping loop that never settles; a round normally ends after a handful of buys. */
const MAX_PURCHASES_PER_ROUND = 60
/** Levels are bought in chunks of at least this share of the room to the cap, so near-equal dice do not ping-pong one level at a time. */
const LEVEL_CHUNK_SHARE = 0.1

export interface Purchase {
  readonly command: Command
  /** Output multiplier gained per point spent (the M1 unit: one point of dice sum). */
  readonly ratio: number
  readonly cost: Num
  readonly affordable: boolean
}

/**
 * Every purchase on sale right now, ranked best ratio first: one level of each owned die (its
 * effective multiplier per level), each unlocked unowned die (baseMultiplier for baseCost, the M1
 * rule), the next upgrade of each hand (the dice sum times the relative lift of the mean hand
 * multiplier) and the next face of each die (its multiplier times one pip over its face total).
 * Ties go to content order.
 */
export function rankPurchases(state: GameState): Purchase[] {
  const found: Purchase[] = []
  /** `cost` is what the command charges; `valuedAt` (default the same) is the outlay the gain is measured against. */
  const consider = (command: Command, gain: Num, cost: Num, valuedAt: Num = cost) => {
    if (!N.isFinite(cost) || N.lte(cost, 0) || N.lte(gain, 0) || N.lte(valuedAt, 0)) return
    const ratio = N.toNumber(N.div(gain, valuedAt))
    if (!Number.isFinite(ratio)) return
    found.push({ command, ratio, cost, affordable: N.gte(state.points, cost) })
  }
  let diceSum = N.zero
  for (const die of state.dice) diceSum = N.add(diceSum, effectiveDieMultiplier(state, die))
  for (const die of state.dice) {
    const view = dieView(state, die.id)
    if (view.owned) {
      if (!view.atCap) {
        consider({ type: 'levelDie', id: die.id, count: 1 }, N.div(view.multiplier, view.level), view.nextCost)
        // The sprint: every level to the cap in one go. Ascending alone changes nothing (level 1 at
        // x100 equals level 100), so it is valued as the whole cycle a player sees: reach the cap,
        // ascend, buy back to today's level on the fresh curve, and stand there x100 stronger.
        const toCap = view.cap - view.level
        const sprint = bulkCost(view.def, view.level, toCap, die.ascensions)
        const buyBack = bulkCost(view.def, 1, view.level - 1, die.ascensions + 1)
        const after = effectiveDieMultiplier(state, { ...die, ascensions: die.ascensions + 1 })
        consider({ type: 'levelDie', id: die.id, count: toCap }, N.sub(after, view.multiplier), sprint, N.add(sprint, buyBack))
      }
    } else if (view.unlocked) {
      consider({ type: 'buyDie', id: die.id }, N.from(view.def.baseMultiplier), view.nextCost)
    }
    const faces = dieFaceView(state, die.id)
    if (faces.unlocked && faces.faces[faces.nextIndex] !== undefined && (faces.faces[faces.nextIndex] ?? 0) < faces.cap) {
      const total = faces.faces.reduce((sum, face) => sum + face, 0)
      consider({ type: 'upgradeFace', id: die.id }, N.div(view.multiplier, total), faces.nextCost)
    }
  }
  const owned = state.dice.filter((die) => die.owned).length
  if (owned >= 2) {
    const mean = expectedComboMultiplier(state)
    for (const def of content.combos) {
      const view = comboView(state, def.id)
      const trial: GameState = { ...state, combos: { ...state.combos, [def.id]: view.level + 1 } }
      const lift = N.div(N.sub(expectedComboMultiplier(trial), mean), mean)
      consider({ type: 'upgradeCombo', id: def.id }, N.mul(diceSum, lift), view.nextCost)
    }
  }
  return found.sort((a, b) => b.ratio - a.ratio)
}

/** The best purchase on sale, or null when nothing is. */
export function bestPurchase(state: GameState): Purchase | null {
  return rankPurchases(state)[0] ?? null
}

/**
 * Levels of `id` worth buying in one go: the ratio of a level falls by costGrowth per level, so
 * keep buying while it still beats the runner-up, never past what the purse or the cap allows.
 */
function levelsWorthBuying(state: GameState, id: string, best: Purchase, runnerUp: Purchase | undefined): number | 'max' {
  const view = dieView(state, id)
  const room = levelsBuyable(view.def, view.level, state.points, view.ascensions)
  // A purse that covers the whole way to the cap sweeps it: nothing below is worth a second thought.
  if (room >= view.cap - view.level) return 'max'
  if (runnerUp === undefined || runnerUp.ratio <= 0) return 'max'
  const steps = Math.floor(Math.log(best.ratio / runnerUp.ratio) / Math.log(view.def.costGrowth))
  const chunk = Math.ceil((view.cap - view.level) * LEVEL_CHUNK_SHARE)
  return Math.max(1, Math.min(room, Math.max(steps + 1, chunk)))
}

/** How far ahead the bot saves: a purchase it cannot reach within this much income is skipped for the best affordable one. */
export const SAVE_HORIZON_MS = 600_000

/**
 * Buys the best purchase while it is affordable, re-ranking after each buy. When the best one is
 * not affordable but within the save horizon the bot saves for it rather than buying a worse
 * substitute, so the content is played the way a value-minded player would; a target further away
 * than that (the sprint to a cap, early on) does not stall the round, and the best affordable
 * purchase is taken instead.
 */
export function buyGreedily(state: GameState): GameState {
  let next = state
  for (let round = 0; round < MAX_PURCHASES_PER_ROUND; round++) {
    // A new die is never left on the table: every player picks one up the moment it is affordable,
    // and the hands it adds lift every other die, which the per-point rule below cannot see.
    const newDie = next.dice.find((die) => !die.owned && dieView(next, die.id).canBuy)
    if (newDie !== undefined) {
      const bought = dispatch(next, { type: 'buyDie', id: newDie.id })
      if (bought !== next) {
        next = bought
        continue
      }
    }
    const ranked = rankPurchases(next)
    const best = ranked[0]
    if (best === undefined) break
    let chosen = best
    if (!best.affordable) {
      const reach = N.add(next.points, N.mul(incomeScore(next), SAVE_HORIZON_MS / 1000))
      if (N.lte(best.cost, reach)) break
      const fallback = ranked.find((purchase) => purchase.affordable)
      if (fallback === undefined) break
      chosen = fallback
    }
    let command = chosen.command
    if (command.type === 'levelDie' && command.count === 1) {
      const runnerUp = ranked.find((purchase) => purchase !== chosen)
      command = { ...command, count: levelsWorthBuying(next, command.id, chosen, runnerUp) }
    }
    const after = dispatch(next, command)
    if (after === next) break
    next = after
  }
  return next
}

/** Ascends every die that can (auto-ascend normally does this already). */
export function ascendAll(state: GameState): GameState {
  let next = state
  for (const die of state.dice) {
    if (canAscend(next, die.id)) next = dispatch(next, { type: 'ascend', id: die.id })
  }
  return next
}

/** Income the bot optimises: points per second once auto-roll runs, else points per roll. */
function incomeScore(state: GameState): Num {
  const perRoll = expectedPointsPerRoll(state)
  const { autoRoll } = state
  if (!autoRoll.unlocked || !autoRoll.enabled || !(autoRoll.intervalMs > 0)) return perRoll
  return N.div(N.mul(perRoll, 1000), autoRoll.intervalMs)
}

/** Takes the offered charm that lifts income most (the first on ties) while a draft is open. */
export function pickCharms(state: GameState): GameState {
  let next = state
  while (next.draft.offer !== null) {
    let bestIndex = -1
    let bestScore: Num | null = null
    for (let index = 0; index < next.draft.offer.length; index++) {
      const picked = dispatch(next, { type: 'pickCharm', index })
      if (picked === next) continue
      const score = incomeScore(picked)
      if (bestScore === null || N.gt(score, bestScore)) {
        bestScore = score
        bestIndex = index
      }
    }
    if (bestIndex < 0) break
    const after = dispatch(next, { type: 'pickCharm', index: bestIndex })
    if (after === next) break
    next = after
  }
  return next
}

/** Whether the greedy rule says to prestige now. */
export function shouldPrestige(state: GameState): boolean {
  if (luckOnReset(state) < PRESTIGE_MIN_LUCK) return false
  return state.prestiges === 0 || state.playMs - state.stats.lastLuckAt >= PRESTIGE_COOLDOWN_MS
}

/**
 * Income lift per level assumed for the upgrades whose payoff the income figure cannot see right
 * after a reset: head_start (the first minutes of a run go several times faster), lucky_draw (a
 * wider offer means a better pick per draft), memory (a kept rare or epic charm is worth x1.5 to
 * x2 from the first roll) and steady_hands (a convenience; the bot shops for itself). The other
 * three are measured on a trial state.
 */
export const ASSUMED_LUCK_LIFT: Readonly<Partial<Record<LuckUpgradeEffectKind, number>>> = {
  head_start: 0.5,
  lucky_draw: 0.15,
  memory: 0.4,
  steady_hands: 0.05,
}

export interface LuckPurchase {
  readonly id: LuckUpgradeId
  /** Relative income lift of the next level, measured or assumed. */
  readonly lift: number
  /** Lift per luck spent; the rank key. */
  readonly ratio: number
  readonly cost: number
  readonly affordable: boolean
}

/** Income from the formulas with the interval re-derived, so a trial state with one more quick_hands shows its lift. */
function incomeOf(state: GameState): Num {
  const perRoll = expectedPointsPerRoll(state)
  if (!state.autoRoll.unlocked || !state.autoRoll.enabled) return perRoll
  return N.div(N.mul(perRoll, 1000), autoRollInterval(state))
}

/** Every luck upgrade below its cap, ranked by income lift per luck, best first. Ties go to content order. */
export function rankLuckUpgrades(state: GameState): LuckPurchase[] {
  const found: LuckPurchase[] = []
  const base = incomeOf(state)
  for (const id of LUCK_UPGRADE_IDS) {
    const view = luckUpgradeView(state, id)
    if (view.maxed || view.nextCost === null) continue
    const assumed = ASSUMED_LUCK_LIFT[view.def.effect.kind]
    let lift = assumed ?? 0
    if (assumed === undefined) {
      const trial: GameState = { ...state, luckUpgrades: { ...state.luckUpgrades, [id]: view.level + 1 } }
      lift = N.isZero(base) ? 0 : N.toNumber(N.div(incomeOf(trial), base)) - 1
    }
    found.push({ id, lift, ratio: lift / view.nextCost, cost: view.nextCost, affordable: view.affordable })
  }
  return found.sort((a, b) => b.ratio - a.ratio)
}

/** Buys the best affordable luck upgrade by lift per luck, re-ranking after each buy, until the luck runs out. */
export function buyLuckUpgrades(state: GameState): GameState {
  let next = state
  for (let round = 0; round < MAX_PURCHASES_PER_ROUND; round++) {
    const best = rankLuckUpgrades(next).find((purchase) => purchase.affordable)
    if (best === undefined) break
    const after = dispatch(next, { type: 'buyLuckUpgrade', id: best.id })
    if (after === next) break
    next = after
  }
  return next
}

/** The round every bot shares: prestige (then the luck shop), ascend, draft, then shop. */
function manage(state: GameState): GameState {
  let next = state
  if (shouldPrestige(state)) {
    next = dispatch(state, { type: 'prestige' })
    if (next !== state) next = buyLuckUpgrades(next)
  }
  next = ascendAll(next)
  next = pickCharms(next)
  return buyGreedily(next)
}

/** Rolls by hand once a second until auto-roll unlocks, then lets auto-roll earn; shops every second. */
const active: Bot = {
  strategy: 'active',
  act(state) {
    const rolled = state.autoRoll.unlocked ? state : dispatch(state, { type: 'roll' })
    return manage(rolled)
  },
  manualRollsPerSecond: (state) => (state.autoRoll.unlocked ? 0 : 1),
}

/** Never rolls by hand; shops every 30 s. With auto-roll locked at the start it earns nothing by itself. */
const idle: Bot = {
  strategy: 'idle',
  act(state) {
    return state.playMs % IDLE_BUY_EVERY_MS === 0 ? manage(state) : state
  },
  manualRollsPerSecond: () => 0,
}

export const bots: Readonly<Record<Strategy, Bot>> = { active, idle }

export function createBot(strategy: Strategy): Bot {
  return bots[strategy]
}
