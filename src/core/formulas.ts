// The formulas. Every constant comes from src/content and every game value is a Num; the only
// plain arithmetic here is on content numbers, levels and counts. Points per roll:
// (sum over owned dice of printed face x die multiplier) x best combo x charms x luck x trophies,
// where die multiplier = baseMultiplier x level x ascension^ascensions x die charms, the combo
// carries the keen_eye upgrade and "luck" is 1 + perPoint x luckTotal times the deep_pockets
// upgrade. The luck upgrades (src/content/luckUpgrades.ts) fold into LuckEffects the way charms
// fold into CharmEffects.
import {
  charmDieTarget,
  LUCK_UPGRADE_IDS,
  type ComboId,
  type DieDef,
  type Id,
  type LuckUpgradeDef,
  type LuckUpgradeId,
  type UnlockCondition,
} from '@/content'
import { charmDef, comboDef, dieDef, luckUpgradeDef, rarityOrder, rules } from './defs'
import { bestHand, handCounts } from './hands'
import { N, type Num } from './num'
import type { DieState, GameState } from './state'

/** The state slot of a die, or undefined for an id the state does not know. */
export function findDie(state: GameState, id: string): DieState | undefined {
  return state.dice.find((die) => die.id === id)
}

/** Output multiplier of a die at a level before ascensions and charms: each level adds the base multiplier (Idle Dice). */
export function dieMultiplier(def: DieDef, level: number): Num {
  return N.mul(def.baseMultiplier, level)
}

/**
 * Cost of going from `level` to `level + 1` on a die with `ascensions` so far. Level 0 to 1 is
 * buying the die, at baseCost. Each ascension multiplies the whole curve by
 * rules.ascension.costMultiplier, so a cycle to the cap costs more each time.
 */
export function levelCost(def: DieDef, level: number, ascensions = 0): Num {
  const base = N.mul(def.baseCost, N.pow(def.costGrowth, level))
  return ascensions > 0 ? N.mul(base, N.pow(rules.ascension.costMultiplier, ascensions)) : base
}

/** Cost of the next `count` levels from `level`: the geometric sum in closed form. Zero for count <= 0. */
export function bulkCost(def: DieDef, level: number, count: number, ascensions = 0): Num {
  if (count <= 0) return N.zero
  // A single level is charged exactly the nextCost the UI shows; the closed form lands one ulp under it.
  if (count === 1) return levelCost(def, level, ascensions)
  const growth = def.costGrowth
  return N.div(N.mul(levelCost(def, level, ascensions), N.sub(N.pow(growth, count), 1)), growth - 1)
}

/** The largest count a level can carry; a purse past it saturates instead of looping forever. */
const MAX_COUNT = Number.MAX_SAFE_INTEGER

/**
 * Largest count of levels from `level` whose bulkCost fits in `points`; 0 when none does, and
 * MAX_SAFE_INTEGER when even that many fit (a purse of about 1e(3e14) points). Always terminates.
 * Ignores the level cap; see levelsBuyable for the capped count.
 */
export function maxAffordable(def: DieDef, level: number, points: Num, ascensions = 0): number {
  if (!N.isFinite(points) || N.lte(points, 0)) return 0
  // bulkCost(count) <= points  <=>  growth^count <= 1 + points * (growth - 1) / levelCost(level)
  const ratio = N.add(1, N.div(N.mul(points, def.costGrowth - 1), levelCost(def, level, ascensions)))
  let count = floorLog(def.costGrowth, ratio)
  if (count >= MAX_COUNT) return MAX_COUNT
  // The log is taken in doubles, so settle the boundary against bulkCost itself. Both loops move
  // count by whole steps, which only works below MAX_COUNT (count + 1 === count above it).
  while (count > 0 && N.gt(bulkCost(def, level, count, ascensions), points)) count--
  while (count < MAX_COUNT && N.lte(bulkCost(def, level, count + 1, ascensions), points)) count++
  return count
}

/** floor(log_base(value)) for base > 1 and value >= 1, off by at most one near a boundary, capped at MAX_COUNT. */
function floorLog(base: number, value: Num): number {
  const asDouble = N.toNumber(value)
  if (Number.isFinite(asDouble)) {
    return Math.min(Math.max(0, Math.floor(Math.log(asDouble) / Math.log(base))), MAX_COUNT)
  }
  // value is past the double range: gallop to a power above it, then bisect. The gallop stops at
  // MAX_COUNT and the bisection steps from low, so neither can stall on a mid that equals a bound.
  let low = 0
  let high = 1
  while (N.lte(N.pow(base, high), value)) {
    if (high >= MAX_COUNT) return MAX_COUNT
    low = high
    high = Math.min(high * 2, MAX_COUNT)
  }
  while (high - low > 1) {
    const mid = low + Math.floor((high - low) / 2)
    if (N.lte(N.pow(base, mid), value)) low = mid
    else high = mid
  }
  return low
}

/** The level at which a die stops levelling and can ascend. */
export const levelCap = (): number => rules.ascension.level

/** Levels of `def` buyable from `level` with `points`, never past the cap. */
export function levelsBuyable(def: DieDef, level: number, points: Num, ascensions = 0): number {
  const room = levelCap() - level
  if (room <= 0) return 0
  return Math.min(room, maxAffordable(def, level, points, ascensions))
}

/** Output factor from ascensions: rules.ascension.multiplier per ascension, compounding. */
export function ascensionMultiplier(ascensions: number): Num {
  return N.pow(rules.ascension.multiplier, ascensions)
}

/** Every charm effect held, folded into one object the formulas read. */
export interface CharmEffects {
  /** Product of the `points` multipliers. */
  readonly points: Num
  /** Product of the `die:<id>` multipliers per die id; a die with no charm is absent (factor 1). */
  readonly dice: ReadonlyMap<Id, Num>
  /** Product of the `combo` multipliers. */
  readonly combo: Num
  /** Product of the `autoroll` interval factors (plain, it scales milliseconds). */
  readonly autoroll: number
  /** Sum of the `face_cap` additions. */
  readonly faceCap: number
  /** Sum of the `draft_growth` additions. */
  readonly draftGrowth: number
}

const NO_CHARMS: CharmEffects = { points: N.one, dice: new Map(), combo: N.one, autoroll: 1, faceCap: 0, draftGrowth: 0 }

/** Folds the held charms. `add` on a multiplicative target and `mul` on an additive one are applied in the only sensible way. */
export function charmEffects(state: GameState): CharmEffects {
  return charmEffectsOf(state.charms)
}

/** charmEffects for a bare list of charm ids (the save schema has no state yet). */
export function charmEffectsOf(charms: readonly Id[]): CharmEffects {
  if (charms.length === 0) return NO_CHARMS
  let points = N.one
  const dice = new Map<Id, Num>()
  let combo = N.one
  let autoroll = 1
  let faceCap = 0
  let draftGrowth = 0
  for (const id of charms) {
    const { target, op, value } = charmDef(id).effect
    const die = charmDieTarget(target)
    if (die !== null) {
      const current = dice.get(die) ?? N.one
      dice.set(die, op === 'mul' ? N.mul(current, value) : N.add(current, value))
      continue
    }
    switch (target) {
      case 'points':
        points = op === 'mul' ? N.mul(points, value) : N.add(points, value)
        break
      case 'combo':
        combo = op === 'mul' ? N.mul(combo, value) : N.add(combo, value)
        break
      case 'autoroll':
        autoroll = op === 'mul' ? autoroll * value : autoroll + value
        break
      case 'face_cap':
        faceCap = op === 'add' ? faceCap + value : faceCap * value
        break
      case 'draft_growth':
        draftGrowth = op === 'add' ? draftGrowth + value : draftGrowth * value
        break
    }
  }
  return { points, dice, combo, autoroll, faceCap, draftGrowth }
}

/** What one owned die multiplies its printed face by: base x level x ascensions x its charms. Zero while unowned. */
export function effectiveDieMultiplier(state: GameState, die: DieState, effects: CharmEffects = charmEffects(state)): Num {
  if (!die.owned) return N.zero
  const def = dieDef(die.id)
  const charm = effects.dice.get(die.id)
  const base = N.mul(dieMultiplier(def, die.level), ascensionMultiplier(die.ascensions))
  return charm === undefined ? base : N.mul(base, charm)
}

/** The level of a luck upgrade (0 when never bought). */
export const luckUpgradeLevel = (state: GameState, id: LuckUpgradeId): number => state.luckUpgrades[id] ?? 0

/** Luck price of the next level of an upgrade after `level` levels: ceil(baseCost x costGrowth ^ level). A whole number of luck. */
export function luckUpgradeCost(def: LuckUpgradeDef, level: number): number {
  return Math.ceil(def.baseCost * Math.pow(def.costGrowth, level))
}

/** Every luck upgrade effect owned, folded into one object the formulas read. */
export interface LuckEffects {
  /** Level die_1 starts a new run at from head_start; 0 means the plain level 1. */
  readonly headStartLevel: number
  /** Product of the quick_hands interval factors (plain, it scales milliseconds). */
  readonly autoroll: number
  /** Product of the deep_pockets points multipliers. */
  readonly points: Num
  /** Combo multiplier factor from keen_eye: 1 + value x level. */
  readonly combo: Num
  /** Extra charms per draft offer from lucky_draw. */
  readonly offerBonus: number
  /** Charms a luck reset keeps, from memory. */
  readonly memory: number
  /** steady_hands is owned, so auto-level can run. */
  readonly autoLevel: boolean
}

const NO_UPGRADES: LuckEffects = { headStartLevel: 0, autoroll: 1, points: N.one, combo: N.one, offerBonus: 0, memory: 0, autoLevel: false }

/** Folds the owned luck upgrades. Each effect kind is applied in exactly one way; see the content schema. */
export function luckEffects(state: GameState): LuckEffects {
  let found = false
  let headStartLevel = 0
  let autoroll = 1
  let points = N.one
  let combo = N.one
  let offerBonus = 0
  let memory = 0
  let autoLevel = false
  for (const id of LUCK_UPGRADE_IDS) {
    const level = luckUpgradeLevel(state, id)
    if (level <= 0) continue
    found = true
    const { kind, value } = luckUpgradeDef(id).effect
    switch (kind) {
      case 'head_start':
        headStartLevel += value * level
        break
      case 'quick_hands':
        autoroll *= Math.pow(value, level)
        break
      case 'deep_pockets':
        points = N.mul(points, N.pow(value, level))
        break
      case 'keen_eye':
        combo = N.add(combo, N.mul(value, level))
        break
      case 'lucky_draw':
        offerBonus += value * level
        break
      case 'memory':
        memory += value * level
        break
      case 'steady_hands':
        autoLevel = true
        break
    }
  }
  return found ? { headStartLevel, autoroll, points, combo, offerBonus, memory, autoLevel } : NO_UPGRADES
}

/** Auto-level can run: the steady_hands upgrade is owned. */
export function autoLevelAvailable(state: GameState): boolean {
  return luckEffects(state).autoLevel
}

/** The level die_1 starts a new run at: head_start levels, never below 1 and never past the cap. */
export function headStartLevel(effects: LuckEffects): number {
  return Math.max(1, Math.min(levelCap(), Math.floor(effects.headStartLevel)))
}

/**
 * The charms a luck reset keeps: up to `count`, highest rarity first (rarityOrder, the content
 * enum order), ties in pick order. The whole list when count covers it, nothing for count 0.
 */
export function charmsKept(charms: readonly Id[], count: number): Id[] {
  if (count <= 0 || charms.length === 0) return []
  if (count >= charms.length) return [...charms]
  const ranked = charms.map((id, index) => ({ id, index, rank: rarityOrder.indexOf(charmDef(id).rarity) }))
  ranked.sort((a, b) => b.rank - a.rank || a.index - b.index)
  return ranked.slice(0, count).map((entry) => entry.id)
}

/** The upgrade level of a hand (0 when never upgraded). */
export const comboLevel = (state: GameState, id: ComboId): number => state.combos[id] ?? 0

/** Points multiplier of a hand at its current level: base x (1 + step x level) x combo charms x keen_eye. */
export function comboMultiplier(
  state: GameState,
  id: ComboId,
  effects: CharmEffects = charmEffects(state),
  upgrades: LuckEffects = luckEffects(state),
): Num {
  const def = comboDef(id)
  const levelled = N.mul(def.base, N.add(1, N.mul(rules.combo.step, comboLevel(state, id))))
  const charmed = N.eq(effects.combo, N.one) ? levelled : N.mul(levelled, effects.combo)
  return N.eq(upgrades.combo, N.one) ? charmed : N.mul(charmed, upgrades.combo)
}

/** Cost of the next upgrade of a hand at `level`: upgradeCost x costGrowth ^ level. */
export function comboUpgradeCost(level: number): Num {
  return N.mul(rules.combo.upgradeCost, N.pow(rules.combo.costGrowth, level))
}

/** Highest value a face may be raised to: the content cap plus face_cap charms. */
export function faceCap(state: GameState, effects: CharmEffects = charmEffects(state)): number {
  return rules.face.cap + effects.faceCap
}

/** Cost of the next face upgrade on a die after `upgrades` so far: baseCost x costFactor x costGrowth ^ upgrades. */
export function faceUpgradeCost(def: DieDef, upgrades: number): Num {
  return N.mul(N.mul(def.baseCost, rules.face.costFactor), N.pow(rules.face.costGrowth, upgrades))
}

/** Index of the lowest face; the first on ties. */
export function lowestFaceIndex(faces: readonly number[]): number {
  let best = 0
  for (let i = 1; i < faces.length; i++) {
    if ((faces[i] ?? Infinity) < (faces[best] ?? Infinity)) best = i
  }
  return best
}

/** Points multiplier from luck: 1 + perPoint x luckTotal (lifetime luck, spending it takes nothing away). */
export function luckMultiplier(state: GameState): Num {
  return N.add(1, N.mul(rules.luck.perPoint, state.luckTotal))
}

/** Points multiplier from trophies: rules.trophy.multiplier per trophy held. */
export function trophyMultiplier(state: GameState): Num {
  return N.pow(rules.trophy.multiplier, state.trophies.length)
}

/**
 * log10 of a positive Num from its exact serialized "<m>e<e>" form (1 <= m < 10 in canonical
 * form), so a whole number of decades comes out exact and the double range is no limit. NaN for
 * a non-finite value, whose text has no exponent part.
 */
function log10(value: Num): number {
  const [mantissa, exponent] = N.serialize(value).split('e')
  return Math.log10(Number(mantissa)) + Number(exponent)
}

/**
 * Luck granted by a prestige right now: floor(perDecade x log10(totalEarnedRun / threshold)) + 1
 * once the run has reached the threshold, 0 below it. A log curve, so a run ten times richer is
 * worth perDecade more luck, not a multiple.
 */
export function luckOnReset(state: GameState): number {
  const ratio = N.div(state.totalEarnedRun, rules.luck.threshold)
  if (N.lt(ratio, 1)) return 0
  const decades = log10(ratio)
  if (!Number.isFinite(decades)) return MAX_COUNT
  return Math.min(Math.floor(rules.luck.perDecade * decades) + 1, MAX_COUNT)
}

/** The auto-roll interval with the held charms and the quick_hands upgrade applied, whole milliseconds, at least 1. */
export function autoRollInterval(
  state: GameState,
  effects: CharmEffects = charmEffects(state),
  upgrades: LuckEffects = luckEffects(state),
): number {
  return Math.max(1, Math.floor(rules.autoRoll.baseIntervalMs * effects.autoroll * upgrades.autoroll))
}

/** Charms in a draft offer: the content size plus the lucky_draw upgrade. */
export function draftOfferSize(state: GameState, upgrades: LuckEffects = luckEffects(state)): number {
  return rules.draft.offerSize + Math.floor(upgrades.offerBonus)
}

/** Draft requirement growth with charms applied, never below 1. */
export function draftGrowth(state: GameState, effects: CharmEffects = charmEffects(state)): number {
  return Math.max(1, rules.draft.growth + effects.draftGrowth)
}

/** Ascensions needed for the next draft: ceil(growth ^ charms taken). */
export function draftRequirement(state: GameState, effects: CharmEffects = charmEffects(state)): number {
  return Math.ceil(Math.pow(draftGrowth(state, effects), state.draft.taken))
}

/** Everything luck gives every roll: 1 + perPoint x luckTotal, times the deep_pockets upgrade. */
export function luckAndUpgradesMultiplier(state: GameState, upgrades: LuckEffects = luckEffects(state)): Num {
  const luck = luckMultiplier(state)
  return N.eq(upgrades.points, N.one) ? luck : N.mul(luck, upgrades.points)
}

/** Multipliers that apply to every roll: points charms x luck (with deep_pockets) x trophies. */
export function globalMultiplier(
  state: GameState,
  effects: CharmEffects = charmEffects(state),
  upgrades: LuckEffects = luckEffects(state),
): Num {
  return N.mul(N.mul(effects.points, luckAndUpgradesMultiplier(state, upgrades)), trophyMultiplier(state))
}

/** The printed value each owned die shows for the side it landed on. faces follow the owned dice in content order. */
export function rollValues(state: GameState, faces: readonly number[]): number[] {
  const values: number[] = []
  let next = 0
  for (const die of state.dice) {
    if (!die.owned) continue
    const side = faces[next]
    next += 1
    const value = side === undefined ? undefined : die.faces[side - 1]
    if (value === undefined) throw new Error(`rollValues needs one side per owned die within its faces, got ${JSON.stringify(faces)}`)
    values.push(value)
  }
  return values
}

/** Points for one roll of the given sides: the face sum times the best hand times the global multipliers. */
export function rollPoints(state: GameState, faces: readonly number[]): Num {
  const effects = charmEffects(state)
  const upgrades = luckEffects(state)
  const values = rollValues(state, faces)
  let total = N.zero
  let next = 0
  for (const die of state.dice) {
    if (!die.owned) continue
    total = N.add(total, N.mul(values[next] ?? 0, effectiveDieMultiplier(state, die, effects)))
    next += 1
  }
  // Only the owned dice make the hand; a caller passing more sides than dice has the extras ignored.
  const hand = bestHand(faces.length === values.length ? faces : faces.slice(0, values.length))
  if (hand !== null) total = N.mul(total, comboMultiplier(state, hand, effects, upgrades))
  return N.mul(total, globalMultiplier(state, effects, upgrades))
}

/** The hand counts for the owned dice, or null with no die owned. Every content die has the same sides. */
function ownedHandCounts(state: GameState) {
  const owned = state.dice.filter((die) => die.owned)
  const first = owned[0]
  if (first === undefined) return null
  const sides = dieDef(first.id).sides
  return { owned, sides, counts: handCounts(owned.length, sides) }
}

/**
 * Mean points per roll, exact: every pattern of the owned dice is enumerated once per dice count
 * (handCounts) and the mean is the sum over dice of the die multiplier times the mean of its
 * printed face weighted by the best hand's multiplier, times the global multipliers.
 */
export function expectedPointsPerRoll(state: GameState): Num {
  const found = ownedHandCounts(state)
  if (found === null) return N.zero
  const { owned, sides, counts } = found
  const effects = charmEffects(state)
  const upgrades = luckEffects(state)
  // weight[side - 1] = sum over the patterns whose first die shows that side of the best hand's multiplier.
  const weight: Num[] = Array.from({ length: sides }, () => N.zero)
  for (const [hand, row] of counts.byFace) {
    const multiplier = hand === null ? N.one : comboMultiplier(state, hand, effects, upgrades)
    row.forEach((count, index) => {
      if (count > 0) weight[index] = N.add(weight[index] ?? N.zero, N.mul(multiplier, count))
    })
  }
  let total = N.zero
  for (const die of owned) {
    let mean = N.zero
    die.faces.forEach((value, index) => {
      mean = N.add(mean, N.mul(weight[index] ?? N.zero, value))
    })
    total = N.add(total, N.mul(effectiveDieMultiplier(state, die, effects), mean))
  }
  return N.mul(N.div(total, counts.patterns), globalMultiplier(state, effects, upgrades))
}

/** Mean best-hand multiplier over every pattern of the owned dice (1 with fewer than two dice). */
export function expectedComboMultiplier(state: GameState): Num {
  const found = ownedHandCounts(state)
  if (found === null) return N.one
  const effects = charmEffects(state)
  const upgrades = luckEffects(state)
  let total = N.zero
  for (const [hand, count] of found.counts.total) {
    total = N.add(total, N.mul(hand === null ? N.one : comboMultiplier(state, hand, effects, upgrades), count))
  }
  return N.div(total, found.counts.patterns)
}

/** Whether an unlock condition holds. `owned` means that die is owned at or above the given level. */
export function unlockSatisfied(condition: UnlockCondition, state: GameState): boolean {
  switch (condition.kind) {
    case 'always':
      return true
    case 'totalEarned':
      return N.gte(state.totalEarned, condition.amount)
    case 'owned': {
      const die = findDie(state, condition.id)
      return die !== undefined && die.owned && die.level >= condition.count
    }
    case 'prestiges':
      return state.prestiges >= condition.count
  }
}
