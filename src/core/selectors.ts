// Pure read helpers for the UI and the sim. They return plain data computed from a state and the
// content tables; nothing here changes state.
import {
  content,
  type CharmDef,
  type ComboDef,
  type ComboId,
  type DieDef,
  type Id,
  type LuckUpgradeDef,
  type LuckUpgradeId,
  type TrophyDef,
  type UnlockCondition,
} from '@/content'
import { canAscendDie } from './ascend'
import { charmDef, comboDef, dieDef, luckUpgradeDef, rules } from './defs'
import {
  charmEffects,
  comboLevel,
  comboMultiplier,
  comboUpgradeCost,
  draftRequirement,
  effectiveDieMultiplier,
  expectedComboMultiplier,
  expectedPointsPerRoll,
  faceCap,
  faceUpgradeCost,
  findDie,
  levelCap,
  levelCost,
  levelsBuyable,
  lowestFaceIndex,
  luckAndUpgradesMultiplier,
  luckMultiplier,
  luckOnReset,
  luckUpgradeCost,
  luckUpgradeLevel,
  trophyMultiplier,
  unlockSatisfied,
} from './formulas'
import { N, type Num } from './num'
import type { GameState } from './state'

export interface DieView {
  readonly def: DieDef
  readonly owned: boolean
  readonly level: number
  /** Current output multiplier with ascensions and charms (zero while unowned). */
  readonly multiplier: Num
  /** Cost of the next level, or baseCost while unowned. */
  readonly nextCost: Num
  /** points >= nextCost and a level can still be bought (false at the cap). */
  readonly affordable: boolean
  /** Levels buyable right now, never past the cap; 0 while unowned. */
  readonly maxAffordable: number
  /** The unlock condition holds (always true once owned). */
  readonly unlocked: boolean
  /** Unowned, unlocked and affordable: a buyDie command would succeed. */
  readonly canBuy: boolean
  readonly ascensions: number
  /** Owned and at the level cap: levelling stops, ascend is the next step. */
  readonly atCap: boolean
  /** The level cap, for "level 37 / 100". */
  readonly cap: number
}

/** Everything a die card shows. Throws on an id that is not in content. */
export function dieView(state: GameState, id: Id): DieView {
  const def = dieDef(id)
  const die = findDie(state, id)
  const owned = die?.owned ?? false
  const level = die?.level ?? 0
  const cap = levelCap()
  const atCap = owned && level >= cap
  const ascensions = die?.ascensions ?? 0
  const nextCost = levelCost(def, level, ascensions)
  const affordable = !atCap && N.gte(state.points, nextCost)
  const unlocked = owned || unlockSatisfied(def.unlock, state)
  return {
    def,
    owned,
    level,
    multiplier: die === undefined ? N.zero : effectiveDieMultiplier(state, die),
    nextCost,
    affordable,
    maxAffordable: owned ? levelsBuyable(def, level, state.points, ascensions) : 0,
    unlocked,
    canBuy: !owned && unlocked && affordable,
    ascensions,
    atCap,
    cap,
  }
}

export interface NextUnlock {
  readonly def: DieDef
  readonly unlock: UnlockCondition
  /** The condition already holds; only the cost stands in the way. */
  readonly satisfied: boolean
}

/** The first unowned die in content order, or null once every die is owned. */
export function nextUnlock(state: GameState): NextUnlock | null {
  const die = state.dice.find((slot) => !slot.owned)
  if (die === undefined) return null
  const def = dieDef(die.id)
  return { def, unlock: def.unlock, satisfied: unlockSatisfied(def.unlock, state) }
}

/** Mean points of one roll with the current dice, combos and multipliers. */
export function pointsPerRollExpected(state: GameState): Num {
  return expectedPointsPerRoll(state)
}

/** Mean points per second from auto-roll; zero while it is locked or switched off. */
export function expectedPointsPerSecond(state: GameState): Num {
  const { autoRoll } = state
  if (!autoRoll.unlocked || !autoRoll.enabled || !(autoRoll.intervalMs > 0)) return N.zero
  return N.div(N.mul(expectedPointsPerRoll(state), 1000), autoRoll.intervalMs)
}

export interface ComboView {
  readonly def: ComboDef
  readonly level: number
  /** Points multiplier when this hand is the best one rolled, with its level and combo charms. */
  readonly multiplier: Num
  readonly nextCost: Num
  readonly affordable: boolean
}

/** Everything a combo row shows. Throws on an id that is not a hand. */
export function comboView(state: GameState, id: ComboId): ComboView {
  const nextCost = comboUpgradeCost(comboLevel(state, id))
  return {
    def: comboDef(id),
    level: comboLevel(state, id),
    multiplier: comboMultiplier(state, id),
    nextCost,
    affordable: N.gte(state.points, nextCost),
  }
}

export interface DieFaceView {
  /** The printed value of each side, in side order. */
  readonly faces: readonly number[]
  /** Unlocked, below the cap and affordable: an upgradeFace command would succeed. */
  readonly canUpgrade: boolean
  readonly nextCost: Num
  /** Highest value a face can reach right now (content cap plus charms). */
  readonly cap: number
  /** Owned and at or above rules.face.unlockLevel. */
  readonly unlocked: boolean
  /** Which side the next upgrade raises (the lowest, first on ties). */
  readonly nextIndex: number
}

/** The face editor of one die. Throws on an id that is not in content. */
export function dieFaceView(state: GameState, id: Id): DieFaceView {
  const def = dieDef(id)
  const die = findDie(state, id)
  const faces = die?.faces ?? []
  const unlocked = die !== undefined && die.owned && die.level >= rules.face.unlockLevel
  const cap = faceCap(state)
  const nextIndex = lowestFaceIndex(faces)
  const nextCost = faceUpgradeCost(def, die?.faceUpgrades ?? 0)
  const belowCap = (faces[nextIndex] ?? cap) < cap
  return { faces, canUpgrade: unlocked && belowCap && N.gte(state.points, nextCost), nextCost, cap, unlocked, nextIndex }
}

/** Whether an ascend command would succeed for the die. */
export function canAscend(state: GameState, id: Id): boolean {
  return canAscendDie(state, id)
}

export interface LuckPreview {
  /** The run has earned the threshold. */
  readonly unlocked: boolean
  /** Luck a prestige grants right now (0 while locked): floor(perDecade x log10(run / threshold)) + 1. */
  readonly onReset: number
  readonly threshold: Num
}

export function luckPreview(state: GameState): LuckPreview {
  const threshold = N.from(rules.luck.threshold)
  return {
    unlocked: N.gte(state.totalEarnedRun, threshold),
    onReset: luckOnReset(state),
    threshold,
  }
}

export interface LuckSummary {
  /** Spendable luck. */
  readonly luck: number
  /** Lifetime luck, which drives the multiplier. */
  readonly luckTotal: number
  /** 1 + rules.luck.perPoint x luckTotal. */
  readonly multiplier: Num
  /** Luck per decade of run points past the threshold. */
  readonly perDecade: number
  readonly threshold: Num
}

/** The luck shop header: what can be spent, what has been earned, and what it multiplies. */
export function luckSummary(state: GameState): LuckSummary {
  return {
    luck: state.luck,
    luckTotal: state.luckTotal,
    multiplier: luckMultiplier(state),
    perDecade: rules.luck.perDecade,
    threshold: N.from(rules.luck.threshold),
  }
}

export interface LuckUpgradeView {
  readonly def: LuckUpgradeDef
  readonly level: number
  readonly maxLevel: number
  /** Luck price of the next level, or null at the cap. */
  readonly nextCost: number | null
  /** Below the cap and the luck covers nextCost: a buyLuckUpgrade command would succeed. */
  readonly affordable: boolean
  readonly maxed: boolean
}

/** Everything a luck upgrade row shows. Throws on an id that is not in content. */
export function luckUpgradeView(state: GameState, id: LuckUpgradeId): LuckUpgradeView {
  const def = luckUpgradeDef(id)
  const level = luckUpgradeLevel(state, id)
  const maxed = level >= def.maxLevel
  const nextCost = maxed ? null : luckUpgradeCost(def, level)
  return { def, level, maxLevel: def.maxLevel, nextCost, affordable: nextCost !== null && state.luck >= nextCost, maxed }
}

export interface DraftView {
  readonly progress: number
  readonly requirement: number
  /** The charms on offer, or null while no draft is open. */
  readonly offer: readonly CharmDef[] | null
  readonly canReroll: boolean
  /** Charms taken this run. */
  readonly taken: number
}

export function draftView(state: GameState): DraftView {
  const { draft } = state
  return {
    progress: draft.progress,
    requirement: draftRequirement(state),
    offer: draft.offer === null ? null : draft.offer.map(charmDef),
    canReroll: draft.offer !== null && !draft.rerolled,
    taken: draft.taken,
  }
}

/** The charms held this run, in pick order (a charm picked twice appears twice). */
export function heldCharms(state: GameState): CharmDef[] {
  return state.charms.map(charmDef)
}

export interface TrophyView {
  /** Held, in the order earned. */
  readonly held: readonly TrophyDef[]
  /** Not yet earned, in content order. */
  readonly next: readonly TrophyDef[]
}

export function trophyView(state: GameState): TrophyView {
  const held = state.trophies.map((id) => content.trophies.find((def) => def.id === id)).filter((def) => def !== undefined)
  const next = content.trophies.filter((def) => !state.trophies.includes(def.id))
  return { held, next }
}

export interface MultiplierBreakdown {
  /** Sum of the owned dice's output multipliers (what one face point is worth before the rest). */
  readonly dice: Num
  /** Mean best-hand multiplier over every pattern of the owned dice. */
  readonly combo: Num
  /** Product of the `points` charms. */
  readonly charms: Num
  /** Everything luck gives: 1 + perPoint x luckTotal, times the deep_pockets upgrade. */
  readonly luck: Num
  readonly trophies: Num
  /** dice x combo x charms x luck x trophies. */
  readonly total: Num
}

export function multiplierBreakdown(state: GameState): MultiplierBreakdown {
  const effects = charmEffects(state)
  let dice = N.zero
  for (const die of state.dice) dice = N.add(dice, effectiveDieMultiplier(state, die, effects))
  const combo = expectedComboMultiplier(state)
  const charms = effects.points
  const luck = luckAndUpgradesMultiplier(state)
  const trophies = trophyMultiplier(state)
  const total = N.mul(N.mul(N.mul(N.mul(dice, combo), charms), luck), trophies)
  return { dice, combo, charms, luck, trophies, total }
}
