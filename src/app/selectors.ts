// String and primitive selectors for the UI, so components never build objects or hand Decimals
// to React (CLAUDE.md rule 4). Object-shaped views (one die card) go through useShallow at the
// call site. The format* helpers are pure and take the clock as an argument, for tests.
import { content, type Id, type UnlockCondition } from '@/content'
import {
  N,
  bulkCost,
  dieDef,
  dieView,
  expectedPointsPerSecond,
  levelCost,
  nextUnlock,
  pointsPerRollExpected,
  type OfflineSummary,
} from '@/core'
import type { RecoveryCandidate, SaveStatus, StoreState, Theme } from './store'

const SECOND_MS = 1000
const MINUTE_MS = 60 * SECOND_MS
const HOUR_MS = 60 * MINUTE_MS
const TICK_MS = content.rules.offline.tickMs

/** "42 s", "3 min", "2 h 5 min". Whole units, floored. */
export function formatDuration(ms: number): string {
  const clamped = Math.max(0, Math.floor(ms))
  if (clamped < MINUTE_MS) return `${Math.floor(clamped / SECOND_MS)} s`
  if (clamped < HOUR_MS) return `${Math.floor(clamped / MINUTE_MS)} min`
  const hours = Math.floor(clamped / HOUR_MS)
  const minutes = Math.floor((clamped % HOUR_MS) / MINUTE_MS)
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`
}

/** "5 s", "4.5 s": a millisecond interval in seconds with up to two decimals, trimmed. */
export function formatSeconds(ms: number): string {
  return `${Number((ms / SECOND_MS).toFixed(2))} s`
}

/** The save status line: "Saved 12 s ago, persisted", "Not saved yet", "Not saved: quota exceeded". Pure; the UI supplies the clock. */
export function formatSaveStatus(save: Pick<SaveStatus, 'lastSavedAt' | 'persisted' | 'error'>, now: number): string {
  if (save.error !== null) return `Not saved: ${save.error}`
  if (save.lastSavedAt === null) return 'Not saved yet'
  const ago = formatDuration(now - save.lastSavedAt)
  const persisted = save.persisted === null ? '' : save.persisted ? ', persisted' : ', not persisted'
  return `Saved ${ago} ago${persisted}`
}

/**
 * Whether at least one whole tick of the absence was settled at expected value instead of rolled.
 * Nearly every absence leaves a sub-tick remainder (elapsed is rarely a multiple of tickMs); that
 * is rounding, not an estimate worth telling the player about.
 */
export function isEstimated(o: OfflineSummary): boolean {
  return o.estimatedMs >= TICK_MS
}

/** "Away 12 min: 144 rolls, 1.2K points, partly estimated". Empty when there is no summary. */
export function formatOffline(o: OfflineSummary | null): string {
  if (o === null) return ''
  const estimated = isEstimated(o) ? ', partly estimated' : ''
  return `Away ${formatDuration(o.elapsedMs)}: ${o.rolls} rolls, ${N.format(o.gained)} points${estimated}`
}

/** What a player must do for an unlock condition, as a clause: "own Second Die", "level First Die to 2". */
export function describeUnlock(unlock: UnlockCondition): string {
  switch (unlock.kind) {
    case 'always':
      return 'available from the start'
    case 'totalEarned':
      return `earn ${N.format(N.from(unlock.amount))} points in total`
    case 'owned':
      return unlock.count <= 1 ? `own ${dieDef(unlock.id).name}` : `level ${dieDef(unlock.id).name} to ${unlock.count}`
    case 'prestiges':
      return unlock.count === 1 ? 'prestige once' : `prestige ${unlock.count} times`
  }
}

// Game values
export const selectPointsText = (s: StoreState): string => N.format(s.game.points)
export const selectPerRollText = (s: StoreState): string => N.format(pointsPerRollExpected(s.game))
export const selectPerSecondText = (s: StoreState): string => N.format(expectedPointsPerSecond(s.game))
export const selectRolls = (s: StoreState): number => s.game.rolls
export const selectLastGainedText = (s: StoreState): string =>
  s.game.lastRoll === null ? '' : N.format(s.game.lastRoll.gained)
/** Faces of the last roll in content order, space separated: "3 5 2". Empty before the first roll. */
export const selectLastRollFaces = (s: StoreState): string => s.game.lastRoll?.faces.join(' ') ?? ''
export const selectAutoUnlocked = (s: StoreState): boolean => s.game.autoRoll.unlocked
export const selectAutoEnabled = (s: StoreState): boolean => s.game.autoRoll.enabled
export const selectAutoIntervalText = (s: StoreState): string => formatSeconds(s.game.autoRoll.intervalMs)
export const selectAutoProgress = (s: StoreState): number => {
  const { elapsedMs, intervalMs } = s.game.autoRoll
  return intervalMs > 0 ? Math.min(1, elapsedMs / intervalMs) : 0
}
/** The next die to buy: ready, or what unlocks it. "Every die owned" once the board is full. */
export const selectNextUnlockText = (s: StoreState): string => {
  const next = nextUnlock(s.game)
  if (next === null) return 'Every die owned'
  if (next.satisfied) return `${next.def.name} is ready to buy for ${N.format(levelCost(next.def, 0))}`
  return `${next.def.name} unlocks: ${describeUnlock(next.unlock)}`
}

// Offline summary
export const selectHasOffline = (s: StoreState): boolean => s.ui.offline !== null
export const selectOfflineText = (s: StoreState): string => formatOffline(s.ui.offline)
export const selectOfflineAwayText = (s: StoreState): string =>
  s.ui.offline === null ? '' : formatDuration(s.ui.offline.elapsedMs)
export const selectOfflineRolls = (s: StoreState): number => s.ui.offline?.rolls ?? 0
export const selectOfflineGainedText = (s: StoreState): string =>
  s.ui.offline === null ? '' : N.format(s.ui.offline.gained)
export const selectOfflineEstimated = (s: StoreState): boolean => s.ui.offline !== null && isEstimated(s.ui.offline)

// App state
export const selectBooted = (s: StoreState): boolean => s.ui.booted
export const selectLocked = (s: StoreState): boolean => s.ui.locked
export const selectTheme = (s: StoreState): Theme => s.ui.settings.theme
export const selectReduceMotion = (s: StoreState): boolean => s.ui.settings.reduceMotion
export const selectLastSavedAt = (s: StoreState): number | null => s.ui.save.lastSavedAt
export const selectPersisted = (s: StoreState): boolean | null => s.ui.save.persisted
export const selectSaveError = (s: StoreState): string | null => s.ui.save.error
export const selectQuarantined = (s: StoreState): boolean => s.ui.save.quarantined

// Recovery dialog
const NO_CANDIDATES: readonly RecoveryCandidate[] = []
export const selectHasRecovery = (s: StoreState): boolean => s.ui.recovery !== null
export const selectRecoveryReason = (s: StoreState): string => s.ui.recovery?.reason ?? ''
/** The stored copies to offer. Stable while the dialog is up; wrap in useShallow at the call site all the same. */
export const selectRecoveryCandidates = (s: StoreState): readonly RecoveryCandidate[] => s.ui.recovery?.candidates ?? NO_CANDIDATES

/** "2 h 5 min ago", "just now" for a stored copy's stamp; "unknown time" when there is none. */
export function formatAgo(savedAt: number, now: number): string {
  if (savedAt <= 0) return 'unknown time'
  const ms = now - savedAt
  if (ms < SECOND_MS) return 'just now'
  return `${formatDuration(ms)} ago`
}

// Dice
export interface DieCardView {
  readonly name: string
  readonly owned: boolean
  readonly unlocked: boolean
  readonly level: number
  readonly multiplier: string
  /** Cost of the next level, or the buy price while unowned. */
  readonly nextCost: string
  /** Cost of the next ten levels; empty while unowned. */
  readonly cost10: string
  /** Cost of every affordable level; empty while unowned or when none is affordable. */
  readonly costMax: string
  readonly affordable: boolean
  readonly maxAffordable: number
  readonly canBuy: boolean
  /** Face from the last roll, null before the first roll or while unowned. */
  readonly face: number | null
  /** What unlocks the die; empty once unlocked. */
  readonly unlockText: string
}

/** Selector factory for one die card. index is the die's position in content order. Memoise at the call site. */
export function selectDieCard(id: Id, index: number): (s: StoreState) => DieCardView {
  return (s) => {
    const v = dieView(s.game, id)
    const faces = s.game.lastRoll?.faces
    const face = faces !== undefined && index < faces.length ? (faces[index] ?? null) : null
    return {
      name: v.def.name,
      owned: v.owned,
      unlocked: v.unlocked,
      level: v.level,
      multiplier: N.format(v.multiplier),
      nextCost: N.format(v.nextCost),
      cost10: v.owned ? N.format(bulkCost(v.def, v.level, 10)) : '',
      costMax: v.owned && v.maxAffordable > 0 ? N.format(bulkCost(v.def, v.level, v.maxAffordable)) : '',
      affordable: v.affordable,
      maxAffordable: v.maxAffordable,
      canBuy: v.canBuy,
      face,
      unlockText: v.unlocked ? '' : describeUnlock(v.def.unlock),
    }
  }
}

/** Selector factory: a die's level (0 while unowned). */
export function selectDieLevel(id: Id): (s: StoreState) => number {
  return (s) => dieView(s.game, id).level
}

/** Selector factory: the next level's cost, or the buy price while unowned, formatted. */
export function selectDieCostText(id: Id): (s: StoreState) => string {
  return (s) => N.format(dieView(s.game, id).nextCost)
}

export const selectUpdateReady = (s: StoreState): boolean => s.ui.updateReady
