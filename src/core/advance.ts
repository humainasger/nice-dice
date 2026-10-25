// Simulated time. advance steps the auto-roller by one slice of time; applyOffline replays an
// absence in fixed ticks up to a cap and settles the rest at expected value. Both are pure and
// deterministic: the RNG lives in the state, the clock arrives as an argument.
import { rules } from './defs'
import { expectedPointsPerRoll } from './formulas'
import { N, type Num } from './num'
import { performRoll } from './roll'
import type { GameState } from './state'

/**
 * Adds dtMs to playMs. While auto-roll is unlocked and enabled, accumulates elapsedMs and rolls
 * once per full interval, each roll stamped with the simulated time its interval completed.
 * Returns the same object when dtMs is not a positive finite number. Meant for ticks of about
 * 100 ms; long absences go through applyOffline.
 */
export function advance(state: GameState, dtMs: number): GameState {
  if (!Number.isFinite(dtMs) || dtMs <= 0) return state
  const playMs = state.playMs + dtMs
  const { autoRoll } = state
  if (!autoRoll.unlocked || !autoRoll.enabled || !(autoRoll.intervalMs > 0)) return { ...state, playMs }

  let next: GameState = { ...state, playMs }
  let elapsed = autoRoll.elapsedMs + dtMs
  // The interval in progress began elapsedMs before this call; each roll lands on its boundary.
  // parseSave keeps elapsedMs below intervalMs, so every boundary is past the old playMs; the
  // clamp keeps a hand-built state with a backlog from stamping a roll before time zero, which
  // the save schema would then refuse.
  let at = state.playMs - autoRoll.elapsedMs
  while (elapsed >= autoRoll.intervalMs) {
    elapsed -= autoRoll.intervalMs
    at += autoRoll.intervalMs
    next = performRoll(next, Math.max(at, 0))
  }
  return { ...next, autoRoll: { ...next.autoRoll, elapsedMs: elapsed } }
}

export interface OfflineOptions {
  /** Fixed tick length. Default: content rules.offline.tickMs (100). */
  readonly tickMs?: number
  /** Ticks replayed before the expected-value remainder. Default: rules.offline.maxTicks (100000). */
  readonly maxTicks?: number
  /** Longest absence credited. Default: rules.offline.capMs (8 h). */
  readonly capMs?: number
}

export interface OfflineSummary {
  /** The absence actually credited: elapsedMs clamped to [0, capMs]. */
  readonly elapsedMs: number
  /** Milliseconds replayed tick by tick with real rolls. */
  readonly simulatedMs: number
  /** Milliseconds settled at expected value. */
  readonly estimatedMs: number
  /** Rolls credited, real and estimated. */
  readonly rolls: number
  /** Points credited, real and estimated. */
  readonly gained: Num
}

export interface OfflineResult {
  readonly state: GameState
  readonly summary: OfflineSummary
}

/**
 * Credits time away. elapsedMs is clamped to [0, capMs]: a negative or non-finite value means the
 * clock went back and grants nothing (the same state object comes back). Up to maxTicks ticks run
 * through advance, then the rest is settled at expectedPointsPerRoll per full interval.
 */
export function applyOffline(state: GameState, elapsedMs: number, opts: OfflineOptions = {}): OfflineResult {
  const tickMs = opts.tickMs ?? rules.offline.tickMs
  const maxTicks = opts.maxTicks ?? rules.offline.maxTicks
  const capMs = opts.capMs ?? rules.offline.capMs
  if (!(tickMs > 0) || !(maxTicks >= 0) || !(capMs >= 0)) {
    throw new Error(`applyOffline needs tickMs > 0, maxTicks >= 0 and capMs >= 0, got ${JSON.stringify({ tickMs, maxTicks, capMs })}`)
  }
  const elapsed = Number.isFinite(elapsedMs) ? Math.min(Math.max(elapsedMs, 0), capMs) : 0
  if (elapsed <= 0) {
    return { state, summary: { elapsedMs: 0, simulatedMs: 0, estimatedMs: 0, rolls: 0, gained: N.zero } }
  }

  const ticks = Math.min(Math.floor(elapsed / tickMs), maxTicks)
  const simulatedMs = ticks * tickMs
  let next = state
  for (let tick = 0; tick < ticks; tick++) next = advance(next, tickMs)

  const estimatedMs = elapsed - simulatedMs
  if (estimatedMs > 0) next = estimate(next, estimatedMs)

  return {
    state: next,
    summary: {
      elapsedMs: elapsed,
      simulatedMs,
      estimatedMs,
      rolls: next.rolls - state.rolls,
      gained: N.sub(next.totalEarned, state.totalEarned),
    },
  }
}

/** Expected-value settlement of a stretch too long to tick: every full interval becomes one mean roll. */
function estimate(state: GameState, ms: number): GameState {
  const playMs = state.playMs + ms
  const { autoRoll } = state
  if (!autoRoll.unlocked || !autoRoll.enabled || !(autoRoll.intervalMs > 0)) return { ...state, playMs }
  const total = autoRoll.elapsedMs + ms
  const rolls = Math.floor(total / autoRoll.intervalMs)
  const gained = N.mul(expectedPointsPerRoll(state), rolls)
  return {
    ...state,
    playMs,
    points: N.add(state.points, gained),
    totalEarned: N.add(state.totalEarned, gained),
    rolls: state.rolls + rolls,
    autoRoll: { ...autoRoll, elapsedMs: total - rolls * autoRoll.intervalMs },
  }
}
