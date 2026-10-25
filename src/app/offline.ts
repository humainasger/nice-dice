// Offline policy for the shell (CLAUDE.md rule 7): the absence since the last save, clamped to the
// content cap, is credited through the store when it is long enough to count as "away". The core's
// applyOffline does the replay; this file only owns the wall clock. It also describes a hidden-tab
// span for the loop: Chrome wakes a tab hidden over five minutes once a minute, so the loop credits
// each wake silently and the span is reported as one absence when the tab is visible again.
import { content } from '@/content'
import { N, type GameState, type Num, type OfflineSummary } from '@/core'
import { creditOffline } from './store'

const { capMs, minAwayMs } = content.rules.offline

/** Milliseconds away: clamp(now - savedAt, 0, capMs). A clock that went back, or garbage, gives 0. */
export function elapsedSince(savedAt: number, now: number): number {
  if (!Number.isFinite(savedAt) || !Number.isFinite(now)) return 0
  return Math.min(Math.max(now - savedAt, 0), capMs)
}

/** A quick reload is not an absence: only gaps above rules.offline.minAwayMs are credited or shown. */
export function countsAsAway(elapsedMs: number): boolean {
  return elapsedMs > minAwayMs
}

/** Credits the time since savedAt when it counts as away. Returns the credited milliseconds, 0 when nothing was. */
export function creditAbsence(savedAt: number, now: number = Date.now()): number {
  const elapsed = elapsedSince(savedAt, now)
  if (!countsAsAway(elapsed)) return 0
  creditOffline(elapsed)
  return elapsed
}

/** What the game looked like when the tab went hidden, plus what the loop credited through the offline path since. */
export interface HiddenSpan {
  /** performance.now() when the tab went hidden. */
  readonly since: number
  readonly rolls: number
  readonly earned: Num
  /** Milliseconds settled at expected value by the credits so far. */
  readonly estimatedMs: number
  /** At least one gap went through the offline path, so the span is worth a summary. */
  readonly credited: boolean
}

export function beginHiddenSpan(game: GameState, now: number): HiddenSpan {
  return { since: now, rolls: game.rolls, earned: game.totalEarned, estimatedMs: 0, credited: false }
}

/** The span after one silent credit. */
export function noteHiddenCredit(span: HiddenSpan, summary: OfflineSummary): HiddenSpan {
  return { ...span, estimatedMs: span.estimatedMs + summary.estimatedMs, credited: true }
}

/**
 * The whole hidden span as one summary, measured from the game itself (rolls and lifetime points
 * then and now), so ticks and offline credits both count. Null when no gap needed the offline path:
 * a tab hidden for a short while ticked normally and gets no modal.
 */
export function hiddenSummary(span: HiddenSpan, game: GameState, now: number): OfflineSummary | null {
  if (!span.credited) return null
  const elapsedMs = Math.max(0, now - span.since)
  const estimatedMs = Math.min(span.estimatedMs, elapsedMs)
  return {
    elapsedMs,
    simulatedMs: elapsedMs - estimatedMs,
    estimatedMs,
    rolls: Math.max(0, game.rolls - span.rolls),
    gained: N.max(N.sub(game.totalEarned, span.earned), N.zero),
  }
}
