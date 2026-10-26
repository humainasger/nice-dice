// Selectors for the meta screens (charms and the draft, luck, trophies shown as marks, stats): primitives and
// formatted strings, plus a few readonly id arrays that the call site wraps in useShallow. The
// describe* and *Text helpers are pure, for tests and for building row text from a content def.
import { content, type CharmDef, type CharmRarity, type ComboId, type Id, type TrophyDef } from '@/content'
import {
  N,
  charmEffects,
  comboDef,
  dieDef,
  draftRequirement,
  luckMultiplier,
  luckPreview,
  trophyDef,
  trophyMultiplier,
  type GameState,
} from '@/core'
import { formatDuration } from './selectors'
import type { StoreState } from './store'

const EMPTY_IDS: readonly Id[] = []
const PERCENT = 100

/** Sum of every die's ascensions this run. */
export function totalAscensions(game: GameState): number {
  return game.dice.reduce((sum, die) => sum + die.ascensions, 0)
}

// Charms and the draft
export const selectTotalAscensions = (s: StoreState): number => totalAscensions(s.game)
/** The charms tab has something to show: an ascension happened this run, or a charm or draft exists. */
export const selectCharmsUnlocked = (s: StoreState): boolean =>
  totalAscensions(s.game) > 0 || s.game.charms.length > 0 || s.game.draft.progress > 0 || s.game.draft.offer !== null
export const selectDraftProgress = (s: StoreState): number => s.game.draft.progress
export const selectDraftRequirement = (s: StoreState): number => draftRequirement(s.game)
export const selectDraftTaken = (s: StoreState): number => s.game.draft.taken
export const selectDraftOpen = (s: StoreState): boolean => s.game.draft.offer !== null
/** The draft dialog shows: an offer exists and the player has not put it aside. */
export const selectDraftDialogOpen = (s: StoreState): boolean => s.game.draft.offer !== null && !s.ui.draftDismissed
/** An offer exists but was put aside with "Decide later"; the Charms tab offers to reopen it. */
export const selectDraftWaiting = (s: StoreState): boolean => s.game.draft.offer !== null && s.ui.draftDismissed
export const selectDraftDismissed = (s: StoreState): boolean => s.ui.draftDismissed
export const selectDraftCanReroll = (s: StoreState): boolean => s.game.draft.offer !== null && !s.game.draft.rerolled
/** The offer's charm ids, empty while no draft is open. Wrap in useShallow. */
export const selectDraftOfferIds = (s: StoreState): readonly Id[] => s.game.draft.offer ?? EMPTY_IDS
/** Charms held this run in pick order, a charm picked twice twice. Wrap in useShallow. */
export const selectHeldCharmIds = (s: StoreState): readonly Id[] => s.game.charms
export const selectCharmCount = (s: StoreState): number => s.game.charms.length
/** Product of the held points charms, formatted ("1.88"). */
export const selectCharmPointsText = (s: StoreState): string => N.format(charmEffects(s.game).points)

/** The locked Charms tab's headline: after a luck reset the charms are coming back, not opening for the first time. Ascension is "refining" in copy (m5-theme.md). */
export function charmsLockedHeadline(prestiges: number): string {
  return prestiges > 0 ? 'Charms return after your first refinement of this run.' : 'Charms open after your first refinement.'
}
export const selectCharmsLockedHeadline = (s: StoreState): string => charmsLockedHeadline(s.game.prestiges)

export const RARITY_LABEL: Readonly<Record<CharmRarity, string>> = { common: 'Common', rare: 'Rare', epic: 'Epic' }

/** Whole percent of a factor's distance from 1: 0.85 gives 15, 1.25 gives 25. */
function percentOff(factor: number): number {
  return Math.round(Math.abs(1 - factor) * PERCENT)
}

/** One line of what a charm does: "x1.25 points on every roll", "Auto-roll 15% faster". */
export function describeCharmEffect(def: CharmDef): string {
  const { target, op, value } = def.effect
  const sign = value >= 0 ? '+' : ''
  if (target.startsWith('die:')) {
    const name = dieDef(target.slice('die:'.length)).name
    return op === 'mul' ? `x${value} ${name} output` : `${sign}${value} ${name} output`
  }
  switch (target) {
    case 'points':
      return op === 'mul' ? `x${value} points on every roll` : `${sign}${value} points on every roll`
    case 'combo':
      return op === 'mul' ? `Every hand pays ${percentOff(value)}% more` : `${sign}${value} to every hand multiplier`
    case 'autoroll':
      return op === 'mul' ? `Auto-roll ${percentOff(value)}% ${value < 1 ? 'faster' : 'slower'}` : `Auto-roll ${sign}${value} ms`
    case 'face_cap':
      return op === 'add' ? `Faces can go ${sign}${value} higher` : `Face cap x${value}`
    case 'draft_growth':
      return op === 'add' && value < 0 ? 'The next drafts come around sooner' : `Draft growth ${sign}${value}`
    default:
      // The die:<id> template member cannot be narrowed away by startsWith, so TypeScript lands here.
      return `${op === 'mul' ? 'x' : sign}${value} ${target}`
  }
}

// Luck
export const selectLuck = (s: StoreState): number => s.game.luck
export const selectPrestiges = (s: StoreState): number => s.game.prestiges
export const selectLuckUnlocked = (s: StoreState): boolean => luckPreview(s.game).unlocked
export const selectLuckOnReset = (s: StoreState): number => luckPreview(s.game).onReset
export const selectLuckThresholdText = (s: StoreState): string => N.format(luckPreview(s.game).threshold)
export const selectRunEarnedText = (s: StoreState): string => N.format(s.game.totalEarnedRun)
export const selectTotalEarnedText = (s: StoreState): string => N.format(s.game.totalEarned)
/** Run earnings toward the threshold, 0 to 100, in half steps so the bar does not re-render every tick. */
export const selectLuckProgressPercent = (s: StoreState): number => {
  const ratio = N.toNumber(N.div(s.game.totalEarnedRun, luckPreview(s.game).threshold))
  if (!Number.isFinite(ratio)) return PERCENT
  return Math.min(PERCENT, Math.round(ratio * PERCENT * 2) / 2)
}
/** The points multiplier luck gives right now ("1.3"). */
export const selectLuckMultiplierText = (s: StoreState): string => N.format(luckMultiplier(s.game))
/** The points multiplier luck would give after a prestige right now. Lifetime luck drives it (M4): spending luck never lowers it. */
export const selectLuckAfterResetText = (s: StoreState): string => {
  const { onReset } = luckPreview(s.game)
  return N.format(N.add(1, N.mul(content.rules.luck.perPoint, s.game.luckTotal + onReset)))
}

// Trophies
/** Trophy ids held, in the order earned. Wrap in useShallow. */
export const selectTrophyIds = (s: StoreState): readonly Id[] => s.game.trophies
export const selectTrophyCount = (s: StoreState): number => s.game.trophies.length
export const selectTrophyTotal = (): number => content.trophies.length
/** The points multiplier the held trophies give ("1.1"). */
export const selectTrophyBonusText = (s: StoreState): string => N.format(trophyMultiplier(s.game))
export const selectNewTrophyId = (s: StoreState): string | null => s.game.newTrophy
export const selectNewTrophyName = (s: StoreState): string => (s.game.newTrophy === null ? '' : trophyDef(s.game.newTrophy).name)
export const selectNewTrophyDescription = (s: StoreState): string =>
  s.game.newTrophy === null ? '' : trophyDef(s.game.newTrophy).description

// The toast queue (ui.trophyQueue): the store appends every trophy a state change awards; the
// toast shows the head and shifts it off after its time.
export const selectTrophyToastId = (s: StoreState): string | null => s.ui.trophyQueue[0] ?? null
export const selectTrophyToastName = (s: StoreState): string => {
  const id = s.ui.trophyQueue[0]
  return id === undefined ? '' : trophyDef(id).name
}
export const selectTrophyToastDescription = (s: StoreState): string => {
  const id = s.ui.trophyQueue[0]
  return id === undefined ? '' : trophyDef(id).description
}
export const selectTrophyQueueLength = (s: StoreState): number => s.ui.trophyQueue.length

/** Where a player stands on a mark (trophy in code), as "412 / 1.00K rolls" or "Carve the Oak Die". */
export function trophyProgressText(def: TrophyDef, game: GameState): string {
  const c = def.condition
  switch (c.kind) {
    case 'rolls':
      return `${N.format(N.from(game.rolls))} / ${N.format(N.from(c.count))} rolls`
    case 'dieOwned':
      return `Carve the ${dieDef(c.id).name}`
    case 'ascensions':
      return `${totalAscensions(game)} / ${c.count} ${c.count === 1 ? 'refinement' : 'refinements'}`
    case 'charms':
      return `${game.charms.length} / ${c.count} ${c.count === 1 ? 'charm' : 'charms'}`
    case 'prestiges':
      return `${game.prestiges} / ${c.count} ${c.count === 1 ? 'luck reset' : 'luck resets'}`
    case 'hand':
      return `Roll ${comboDef(c.combo).name.toLowerCase()} once`
    case 'totalEarned':
      return `${N.format(game.totalEarned)} / ${N.format(N.from(c.amount))} points`
  }
}

/** Progress toward a trophy, 0 to 1, in hundredths. */
export function trophyProgressRatio(def: TrophyDef, game: GameState): number {
  const c = def.condition
  let ratio: number
  switch (c.kind) {
    case 'rolls':
      ratio = game.rolls / c.count
      break
    case 'dieOwned':
      ratio = game.dice.find((die) => die.id === c.id)?.owned === true ? 1 : 0
      break
    case 'ascensions':
      ratio = totalAscensions(game) / c.count
      break
    case 'charms':
      ratio = game.charms.length / c.count
      break
    case 'prestiges':
      ratio = game.prestiges / c.count
      break
    case 'hand':
      ratio = (game.stats.hands[c.combo] ?? 0) >= 1 ? 1 : 0
      break
    case 'totalEarned':
      ratio = N.toNumber(N.div(game.totalEarned, c.amount))
      break
  }
  if (!Number.isFinite(ratio)) return 1
  return Math.min(1, Math.max(0, Math.floor(ratio * PERCENT) / PERCENT))
}

/** Selector factory: a trophy's progress line. Memoise at the call site. */
export function selectTrophyProgressText(id: Id): (s: StoreState) => string {
  const def = trophyDef(id)
  return (s) => trophyProgressText(def, s.game)
}

/** Selector factory: a trophy's progress, 0 to 1. Memoise at the call site. */
export function selectTrophyProgressRatio(id: Id): (s: StoreState) => number {
  const def = trophyDef(id)
  return (s) => trophyProgressRatio(def, s.game)
}

// Stats
export const selectBestRollText = (s: StoreState): string => N.format(s.game.stats.bestRoll)
export const selectPlayTimeText = (s: StoreState): string => formatDuration(s.game.playMs)
export const selectHandsSeenTotal = (s: StoreState): number =>
  Object.values(s.game.stats.hands).reduce((sum: number, count) => sum + (count ?? 0), 0)

/** Selector factory: rolls whose best hand was this combo. Memoise at the call site. */
export function selectHandCount(id: ComboId): (s: StoreState) => number {
  return (s) => s.game.stats.hands[id] ?? 0
}

// Settings that live in the game state
export const selectAutoAscend = (s: StoreState): boolean => s.game.autoAscend
