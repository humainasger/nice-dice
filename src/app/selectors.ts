// String and primitive selectors for the UI, so components never build objects or hand Decimals
// to React (CLAUDE.md rule 4). Object-shaped views (one die card) go through useShallow at the
// call site. The format* helpers are pure and take the clock as an argument, for tests.
import { COMBO_IDS, content, type ComboId, type Id, type UnlockCondition } from '@/content'
import {
  N,
  bulkCost,
  canAscend,
  comboView,
  dieDef,
  dieFaceView,
  dieView,
  expectedComboMultiplier,
  expectedPointsPerSecond,
  handCounts,
  handMembers,
  levelCap,
  levelCost,
  luckPreview,
  multiplierBreakdown,
  nextUnlock,
  pointsPerRollExpected,
  rollValues,
  type DieState,
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
 * Whether enough of the absence was settled at expected value to be worth saying so: at least one
 * auto-roll interval, so at least one whole roll was estimated rather than rolled. Nearly every
 * absence leaves a sub-tick remainder (elapsed is rarely a multiple of tickMs), and a remainder
 * shorter than a roll is rounding, not an estimate the player would notice. intervalMs is the
 * game's current auto-roll interval; the tick size is the floor when it is missing or smaller.
 */
export function isEstimated(o: OfflineSummary, intervalMs: number = TICK_MS): boolean {
  return o.estimatedMs >= Math.max(TICK_MS, intervalMs)
}

/** "Away 12 min: 144 rolls, 1.2K points, partly estimated". Empty when there is no summary. */
export function formatOffline(o: OfflineSummary | null, intervalMs: number = TICK_MS): string {
  if (o === null) return ''
  const estimated = isEstimated(o, intervalMs) ? ', partly estimated' : ''
  return `Away ${formatDuration(o.elapsedMs)}: ${o.rolls} rolls, ${N.format(o.gained)} points${estimated}`
}

const DAY_MS = 24 * HOUR_MS

function twoDigits(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

/** "2026-10-25 14:03" in local time, hand rolled so da-DK and en-US read the same (no Intl). */
export function formatDateTime(at: number): string {
  const d = new Date(at)
  return `${d.getFullYear()}-${twoDigits(d.getMonth() + 1)}-${twoDigits(d.getDate())} ${twoDigits(d.getHours())}:${twoDigits(d.getMinutes())}`
}

/** When a stored copy was written: "12 min ago" inside a day, the date and time beyond it, "unknown time" without a stamp. */
export function formatBackupTime(savedAt: number, now: number): string {
  if (savedAt <= 0) return 'unknown time'
  if (now - savedAt < DAY_MS) return formatAgo(savedAt, now)
  return formatDateTime(savedAt)
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

// Offline summary. The "partly estimated" note is measured against the game's own auto-roll
// interval: shorter estimates are a fraction of one roll.
export const selectHasOffline = (s: StoreState): boolean => s.ui.offline !== null
export const selectOfflineText = (s: StoreState): string => formatOffline(s.ui.offline, s.game.autoRoll.intervalMs)
export const selectOfflineAwayText = (s: StoreState): string =>
  s.ui.offline === null ? '' : formatDuration(s.ui.offline.elapsedMs)
export const selectOfflineRolls = (s: StoreState): number => s.ui.offline?.rolls ?? 0
export const selectOfflineGainedText = (s: StoreState): string =>
  s.ui.offline === null ? '' : N.format(s.ui.offline.gained)
export const selectOfflineEstimated = (s: StoreState): boolean =>
  s.ui.offline !== null && isEstimated(s.ui.offline, s.game.autoRoll.intervalMs)

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

// Sound (src/app/audio.ts reads the same flag on every play call)
export const selectSound = (s: StoreState): boolean => s.ui.settings.sound

// M3 table selectors (docs/plans/active/m3-game.md): the die slot with faces, ascension and face
// editing, the combo rows, the hand callout, the multiplier breakdown and the tab shell's badges.
// Object views hold primitives and strings only, so useShallow at the call site sees a change only
// when something on screen changes.

/** Rank of a hand, 1 (pair) to 7 (five of a kind); 0 for none. The combos table is weakest first. */
export function handRank(hand: ComboId | null): number {
  return hand === null ? 0 : COMBO_IDS.indexOf(hand) + 1
}

/** "12%", "1.5%", "0.08%": a share in [0, 1] as a percentage with the precision its size needs. Locale independent. */
export function formatPercent(share: number): string {
  if (!(share > 0)) return '0%'
  const percent = share * 100
  if (percent >= 10) return `${percent.toFixed(0)}%`
  if (percent >= 1) return `${percent.toFixed(1)}%`
  return `${percent.toFixed(2)}%`
}

function ownedCount(dice: readonly DieState[]): number {
  let n = 0
  for (const die of dice) if (die.owned) n += 1
  return n
}

/** Position of the die at content `index` among the owned dice (lastRoll.faces order), or -1 while unowned. */
function ownedIndex(dice: readonly DieState[], index: number): number {
  const die = dice[index]
  if (die === undefined || !die.owned) return -1
  let n = 0
  for (let i = 0; i < index; i++) if (dice[i]?.owned) n += 1
  return n
}

// The last roll's hand
export const selectLastHand = (s: StoreState): ComboId | null => s.game.lastRoll?.hand ?? null
/** "FULL HOUSE 9.6x": the last roll's hand at its current upgraded multiplier, for the callout. Empty without a hand. */
export const selectHandText = (s: StoreState): string => {
  const hand = s.game.lastRoll?.hand ?? null
  if (hand === null) return ''
  const v = comboView(s.game, hand)
  return `${v.def.name.toUpperCase()} ${N.format(v.multiplier)}x`
}
export const selectHandRank = (s: StoreState): number => handRank(s.game.lastRoll?.hand ?? null)
/** Lifetime four and five of a kind: a counter that moves exactly when a big hand lands (particles, shake). */
export const selectBigHands = (s: StoreState): number =>
  (s.game.stats.hands.four_kind ?? 0) + (s.game.stats.hands.five_kind ?? 0)
/** Printed values of the last roll in owned-dice order, space separated; the sides when the dice changed since. */
export const selectLastRollValues = (s: StoreState): string => {
  const last = s.game.lastRoll
  if (last === null) return ''
  if (last.faces.length !== ownedCount(s.game.dice)) return last.faces.join(' ')
  return rollValues(s.game, last.faces).join(' ')
}

// Multiplier breakdown chips
export interface BreakdownView {
  readonly dice: string
  readonly combo: string
  readonly charms: string
  readonly luck: string
  readonly trophies: string
  readonly total: string
}
/** Every factor of the points formula, formatted. Wrap in useShallow at the call site. */
export const selectBreakdown = (s: StoreState): BreakdownView => {
  const b = multiplierBreakdown(s.game)
  return {
    dice: N.format(b.dice),
    combo: N.format(b.combo),
    charms: N.format(b.charms),
    luck: N.format(b.luck),
    trophies: N.format(b.trophies),
    total: N.format(b.total),
  }
}

// Die slots
export interface DieSlotView {
  readonly name: string
  readonly owned: boolean
  readonly unlocked: boolean
  readonly level: number
  readonly cap: number
  readonly atCap: boolean
  readonly ascensions: number
  readonly multiplier: string
  /** Cost of the next level, or the buy price while unowned. */
  readonly nextCost: string
  readonly cost10: string
  readonly costMax: string
  readonly affordable: boolean
  readonly maxAffordable: number
  readonly canBuy: boolean
  readonly canAscend: boolean
  /** Side (1 to 6) the die landed on in the last roll; null before the first roll or while unowned. */
  readonly side: number | null
  /** Printed value of that side; null like side. */
  readonly value: number | null
  /** The six printed faces in side order, space separated: "1 2 3 4 5 6". */
  readonly faces: string
  readonly faceUnlocked: boolean
  readonly canUpgradeFace: boolean
  readonly faceCost: string
  readonly faceCap: number
  /** Side index the next face upgrade raises (the lowest, first on ties). */
  readonly faceNext: number
  /** Every face sits at the cap. */
  readonly facesMaxed: boolean
  /** The die is one of the dice that form the last roll's hand. */
  readonly inHand: boolean
  /** What unlocks the die; empty once unlocked. */
  readonly unlockText: string
}

/** Selector factory for one die card with the M3 fields. index is the die's position in content order. Memoise at the call site. */
export function selectDieSlot(id: Id, index: number): (s: StoreState) => DieSlotView {
  return (s) => {
    const v = dieView(s.game, id)
    const f = dieFaceView(s.game, id)
    const last = s.game.lastRoll
    const at = ownedIndex(s.game.dice, index)
    const side = last !== null && at >= 0 ? (last.faces[at] ?? null) : null
    const value = side === null ? null : (f.faces[side - 1] ?? null)
    const inHand = last !== null && at >= 0 && last.hand !== null && handMembers(last.faces).includes(at)
    const lowest = f.faces[f.nextIndex] ?? f.cap
    return {
      name: v.def.name,
      owned: v.owned,
      unlocked: v.unlocked,
      level: v.level,
      cap: v.cap,
      atCap: v.atCap,
      ascensions: v.ascensions,
      multiplier: N.format(v.multiplier),
      nextCost: N.format(v.nextCost),
      cost10: v.owned && !v.atCap ? N.format(bulkCost(v.def, v.level, 10, v.ascensions)) : '',
      costMax: v.owned && v.maxAffordable > 0 ? N.format(bulkCost(v.def, v.level, v.maxAffordable, v.ascensions)) : '',
      affordable: v.affordable,
      maxAffordable: v.maxAffordable,
      canBuy: v.canBuy,
      canAscend: v.owned && canAscend(s.game, id),
      side,
      value,
      faces: f.faces.join(' '),
      faceUnlocked: f.unlocked,
      canUpgradeFace: f.canUpgrade,
      faceCost: N.format(f.nextCost),
      faceCap: f.cap,
      faceNext: f.nextIndex,
      facesMaxed: f.faces.length > 0 && lowest >= f.cap,
      inHand,
      unlockText: v.unlocked ? '' : describeUnlock(v.def.unlock),
    }
  }
}

/** Some die has ascended or sits at the cap: the auto-ascend switch has something to say. */
export const selectAscensionVisible = (s: StoreState): boolean =>
  s.game.dice.some((die) => die.ascensions > 0 || (die.owned && die.level >= levelCap()))
export const selectAutoAscend = (s: StoreState): boolean => s.game.autoAscend

// Combos
export interface ComboRowView {
  readonly name: string
  readonly level: number
  readonly multiplier: string
  readonly nextCost: string
  readonly affordable: boolean
  /** Share of rolls with the dice owned whose best hand is this one: "12%". "0%" while impossible. */
  readonly frequency: string
  /** The hand can come up with the dice owned. */
  readonly possible: boolean
  /** Lifetime rolls whose best hand was this one. */
  readonly seen: number
}

/** Selector factory for one combo row. Memoise at the call site and wrap in useShallow. */
export function selectComboRow(id: ComboId): (s: StoreState) => ComboRowView {
  return (s) => {
    const v = comboView(s.game, id)
    const n = ownedCount(s.game.dice)
    const sides = content.dice[0]?.sides ?? 6
    const counts = n >= 2 ? handCounts(n, sides) : null
    const share = counts === null ? 0 : (counts.total.get(id) ?? 0) / counts.patterns
    return {
      name: v.def.name,
      level: v.level,
      multiplier: N.format(v.multiplier),
      nextCost: N.format(v.nextCost),
      affordable: v.affordable,
      frequency: formatPercent(share),
      possible: share > 0,
      seen: s.game.stats.hands[id] ?? 0,
    }
  }
}

/** Hands need two dice; the Combos tab is locked until the second die is owned. */
export const selectCombosUnlocked = (s: StoreState): boolean => ownedCount(s.game.dice) >= 2
export const selectOwnedCount = (s: StoreState): number => ownedCount(s.game.dice)
/** Mean best-hand multiplier over every pattern of the owned dice, formatted. */
export const selectCombosExpectedText = (s: StoreState): string => N.format(expectedComboMultiplier(s.game))

// Tab shell
export const selectDraftOpen = (s: StoreState): boolean => s.game.draft.offer !== null
export const selectHasNewTrophy = (s: StoreState): boolean => s.game.newTrophy !== null
export const selectLuckUnlocked = (s: StoreState): boolean => luckPreview(s.game).unlocked
export const selectLuck = (s: StoreState): number => s.game.luck
