// The sim engine: steps the real advance at 100 ms, lets a bot act once per simulated second,
// records the first simulated time of every milestone (and the longest stretch without a purchase)
// and snapshots the state at each requested horizon. Pure apart from the core it drives; run.ts
// prints and writes, balance.test.ts asserts.
import type { Id } from '@/content'
import {
  advance,
  createInitialState,
  dieView,
  expectedPointsPerRoll,
  expectedPointsPerSecond,
  N,
  type GameState,
  type Num,
} from '@/core'
import { createBot, type Bot, type Strategy } from './bots'

/** The fixed tick, the same 100 ms the app loop will use (m1-core.md: "steps the real advance at 100 ms"). */
export const TICK_MS = 100
/** Bots decide once per simulated second; acting on every tick would make the sim ten times slower. */
export const ACT_EVERY_MS = 1000
export const MINUTE_MS = 60_000
export const HOUR_MS = 3_600_000
/** Lifetime point totals whose first crossing the report lists. */
export const POINT_THRESHOLDS: readonly number[] = [1e3, 1e6, 1e9]

/** The GDD section 12 proposals and the briefs' checks (m3-game.md, m4-luck.md section 3), as windows on simulated ms and points. */
export const WINDOWS = {
  /** P1: second die affordable between minute 1 and 3 of active play. */
  die2AffordableMs: { min: 1 * MINUTE_MS, max: 3 * MINUTE_MS },
  /** All five dice owned within 45 minutes of active play. */
  allDiceOwnedMs: 45 * MINUTE_MS,
  /** First luck (prestige) between 30 and 60 minutes of active play (m4-luck.md section 3). */
  firstLuckMs: { min: 30 * MINUTE_MS, max: 60 * MINUTE_MS },
  /** The second luck lands within this much of the first (m4-luck.md section 3). */
  secondLuckWithinMs: 60 * MINUTE_MS,
  /** Lifetime total earned at 8 h, as N.parse text (m4-luck.md section 3). */
  lifetimeAt8h: { hours: 8, min: '1e25', max: '1e45' },
  /** Lifetime total earned at 24 h stays below this, as N.parse text; checked on one seed (m4-luck.md section 3). */
  lifetimeAt24h: { hours: 24, max: '1e80' },
  /** No stretch longer than this without a purchase inside the first purchaseGapHorizonMs (m4-luck.md section 3). */
  purchaseGapMs: 20 * MINUTE_MS,
  purchaseGapHorizonMs: 8 * HOUR_MS,
  /** Dead content: every die bought within 2 hours of active play. */
  deadContentMs: 2 * HOUR_MS,
  /** applyOffline with the tick cap versus 8 h fully stepped: relative difference in points. */
  offlineTolerance: 0.05,
} as const

export interface DieMilestones {
  readonly id: Id
  /** First simulated ms at which a buyDie would succeed (0 for the starting die). */
  affordableMs: number | null
  /** First simulated ms at which the die is owned (0 for the starting die). */
  boughtMs: number | null
}

export interface ThresholdMilestone {
  readonly threshold: number
  /** First simulated ms at which totalEarned reached the threshold. */
  ms: number | null
}

export interface Milestones {
  autoRollUnlockMs: number | null
  /** First simulated ms at which any die had ascended. */
  firstAscensionMs: number | null
  /** First simulated ms at which a charm was held. */
  firstCharmMs: number | null
  /** First simulated ms at which the player had prestiged. */
  firstLuckMs: number | null
  /** First simulated ms at which the player had prestiged twice. */
  secondLuckMs: number | null
  /** Simulated ms of the latest purchase the bot made (0 at the start: the game itself is the first anchor). */
  lastPurchaseMs: number
  /** Longest stretch between two consecutive purchases so far. */
  longestPurchaseGapMs: number
  readonly dice: readonly DieMilestones[]
  readonly totalEarned: readonly ThresholdMilestone[]
}

export interface Horizon {
  readonly hours: number
  readonly ms: number
  readonly state: GameState
  /** Expected points per second at the horizon: auto-roll plus the bot's manual rolls. */
  readonly incomePerSecond: Num
  /** Longest stretch without a purchase inside [0, ms], the trailing stretch to the horizon included. */
  readonly longestPurchaseGapMs: number
}

export interface SimRun {
  readonly strategy: Strategy
  readonly seed: number
  readonly milestones: Milestones
  /** One per requested horizon, in ascending order. */
  readonly horizons: readonly Horizon[]
}

/** Horizons rounded to whole ticks, deduplicated and sorted. */
export function horizonTicks(hours: readonly number[]): number[] {
  const ms = hours.map((h) => Math.round((h * HOUR_MS) / TICK_MS) * TICK_MS)
  return [...new Set(ms)].sort((a, b) => a - b)
}

function emptyMilestones(state: GameState): Milestones {
  return {
    autoRollUnlockMs: null,
    firstAscensionMs: null,
    firstCharmMs: null,
    firstLuckMs: null,
    secondLuckMs: null,
    lastPurchaseMs: 0,
    longestPurchaseGapMs: 0,
    dice: state.dice.map((die) => ({ id: die.id, affordableMs: null, boughtMs: null })),
    totalEarned: POINT_THRESHOLDS.map((threshold) => ({ threshold, ms: null })),
  }
}

/** Records every milestone that holds at this state and was not recorded yet. */
function observe(milestones: Milestones, state: GameState): void {
  const now = state.playMs
  if (milestones.autoRollUnlockMs === null && state.autoRoll.unlocked) milestones.autoRollUnlockMs = now
  if (milestones.firstAscensionMs === null && (state.dice.some((die) => die.ascensions > 0) || state.trophies.includes('first_ascension'))) {
    milestones.firstAscensionMs = now
  }
  if (milestones.firstCharmMs === null && (state.charms.length > 0 || state.trophies.includes('first_charm'))) {
    milestones.firstCharmMs = now
  }
  if (milestones.firstLuckMs === null && state.prestiges > 0) milestones.firstLuckMs = now
  if (milestones.secondLuckMs === null && state.prestiges > 1) milestones.secondLuckMs = now
  for (const die of milestones.dice) {
    if (die.boughtMs !== null) continue
    const view = dieView(state, die.id)
    if (view.owned) {
      die.boughtMs = now
      if (die.affordableMs === null) die.affordableMs = now
    } else if (die.affordableMs === null && view.canBuy) {
      die.affordableMs = now
    }
  }
  for (const mark of milestones.totalEarned) {
    if (mark.ms === null && N.gte(state.totalEarned, mark.threshold)) mark.ms = now
  }
}

/**
 * Whether the bot's round bought anything: a die, a level, a face, a hand upgrade, a charm pick, a
 * luck upgrade or a prestige. Ascensions count too, since in a round they come from levelling to
 * the cap. Rolls alone do not.
 */
export function purchased(before: GameState, after: GameState): boolean {
  if (after === before) return false
  if (after.prestiges !== before.prestiges) return true
  if (after.charms !== before.charms || after.luckUpgrades !== before.luckUpgrades || after.combos !== before.combos) return true
  return after.dice.some((die, index) => {
    const was = before.dice[index]
    return (
      was !== undefined &&
      (die.owned !== was.owned || die.level > was.level || die.faceUpgrades !== was.faceUpgrades || die.ascensions !== was.ascensions)
    )
  })
}

/** Mean points per second: auto-roll income plus whatever the bot still rolls by hand. */
export function incomePerSecond(bot: Bot, state: GameState): Num {
  const manual = bot.manualRollsPerSecond(state)
  const auto = expectedPointsPerSecond(state)
  return manual > 0 ? N.add(auto, N.mul(expectedPointsPerRoll(state), manual)) : auto
}

/**
 * Plays one seed with one bot up to the longest horizon. At every whole second the milestones are
 * observed, the bot acts, and they are observed again, so a purchase is stamped with the second it
 * happened and "affordable" is seen before the bot spends. Snapshots are taken after the bot's
 * round at each horizon.
 */
export function simulate(strategy: Strategy, seed: number, hours: readonly number[]): SimRun {
  const horizons = horizonTicks(hours)
  const last = horizons.at(-1)
  if (last === undefined) throw new Error('simulate needs at least one horizon')
  const hoursAt = new Map(horizons.map((ms) => [ms, ms / HOUR_MS]))
  const bot = createBot(strategy)
  let state = createInitialState(seed)
  const milestones = emptyMilestones(state)
  const snapshots: Horizon[] = []

  for (;;) {
    const now = state.playMs
    if (now % ACT_EVERY_MS === 0) {
      observe(milestones, state)
      const before = state
      state = bot.act(state)
      if (purchased(before, state)) {
        milestones.longestPurchaseGapMs = Math.max(milestones.longestPurchaseGapMs, now - milestones.lastPurchaseMs)
        milestones.lastPurchaseMs = now
      }
      observe(milestones, state)
    }
    const hoursHere = hoursAt.get(now)
    if (hoursHere !== undefined) {
      snapshots.push({
        hours: hoursHere,
        ms: now,
        state,
        incomePerSecond: incomePerSecond(bot, state),
        longestPurchaseGapMs: Math.max(milestones.longestPurchaseGapMs, now - milestones.lastPurchaseMs),
      })
    }
    if (now >= last) break
    state = advance(state, TICK_MS)
  }

  return { strategy, seed, milestones, horizons: snapshots }
}
