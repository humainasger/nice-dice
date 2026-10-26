// Property and example tests for the formulas: bulkCost against the summed levelCost,
// maxAffordable as the largest affordable count, the level cap, rollPoints as the hand sum times
// the best combo and the global multipliers, every multiplier source, the costs of the M3
// systems, luck on reset, the M5 luck sinks (mastery and favour costs and multipliers), and every
// unlock condition kind.
import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { content, type DieDef } from '@/content'
import { charmDef, comboDef, luckUpgradeDef } from './defs'
import {
  ascensionMultiplier,
  autoLevelAvailable,
  autoRollInterval,
  bulkCost,
  charmEffects,
  charmsKept,
  comboMultiplier,
  comboUpgradeCost,
  dieMultiplier,
  draftGrowth,
  draftOfferSize,
  draftRequirement,
  effectiveDieMultiplier,
  expectedComboMultiplier,
  expectedPointsPerRoll,
  faceCap,
  faceUpgradeCost,
  favourCost,
  favourMultiplier,
  findDie,
  globalMultiplier,
  headStartLevel,
  levelCost,
  levelsBuyable,
  lowestFaceIndex,
  luckAndUpgradesMultiplier,
  luckEffects,
  luckMultiplier,
  luckOnReset,
  luckUpgradeCost,
  luckUpgradeLevel,
  masteryCost,
  masteryLevel,
  masteryMultiplier,
  maxAffordable,
  rollPoints,
  rollValues,
  trophyMultiplier,
  unlockSatisfied,
} from './formulas'
import { bestHand } from './hands'
import { N, type Num } from './num'
import { createInitialState } from './save'
import type { GameState } from './state'

const [die1, die2, die3] = content.dice
if (!die1 || !die2 || !die3) throw new Error('these tests need at least three content dice')
const { rules } = content

const abs = (x: Num): Num => N.max(x, N.sub(0, x))
/** |a - b| <= tol * max(|a|, |b|, 1) */
const close = (a: Num, b: Num, tol = 1e-9): boolean =>
  N.lte(abs(N.sub(a, b)), N.mul(N.max(N.max(abs(a), abs(b)), 1), tol))

const tunedDie: fc.Arbitrary<DieDef> = fc
  .record({
    baseCost: fc.double({ min: 1, max: 1e6, noNaN: true }),
    costGrowth: fc.double({ min: 1.01, max: 2, noNaN: true }),
    baseMultiplier: fc.double({ min: 0.5, max: 100, noNaN: true }),
  })
  .map((tuning) => ({ ...die1, ...tuning }))
const anyDie = fc.oneof(fc.constantFrom(...content.dice), tunedDie)
const level = fc.integer({ min: 0, max: 300 })
const count = fc.integer({ min: 0, max: 150 })
const points: fc.Arbitrary<Num> = fc.oneof(
  fc.double({ min: 0, max: 1e12, noNaN: true }).map((x) => N.from(x)),
  fc
    .tuple(fc.double({ min: 1, max: 10, noNaN: true }), fc.integer({ min: 0, max: 400 }))
    .map(([m, e]) => N.parse(`${m}e${e}`)),
)

/** A state with random ownership and levels; the first die stays owned. */
const randomState: fc.Arbitrary<GameState> = fc
  .tuple(
    fc.integer(),
    fc.array(fc.tuple(fc.boolean(), fc.integer({ min: 1, max: 200 })), {
      minLength: content.dice.length,
      maxLength: content.dice.length,
    }),
  )
  .map(([seed, slots]) => {
    const base = createInitialState(seed)
    return {
      ...base,
      dice: base.dice.map((die, index) => {
        const slot = slots[index]
        if (!slot) return die
        const [owned, lvl] = slot
        return index === 0 || owned ? { ...die, owned: true, level: lvl } : die
      }),
    }
  })

const withDice = (state: GameState, levels: readonly number[]): GameState => ({
  ...state,
  dice: state.dice.map((die, i) => {
    const lvl = levels[i] ?? 0
    return lvl > 0 ? { ...die, owned: true, level: lvl } : { ...die, owned: false, level: 0 }
  }),
})

describe('dieMultiplier', () => {
  it('is the base multiplier per level', () => {
    expect(N.eq(dieMultiplier(die1, 1), 1)).toBe(true)
    expect(N.eq(dieMultiplier(die2, 3), 6)).toBe(true)
    expect(N.isZero(dieMultiplier(die3, 0))).toBe(true)
  })
})

describe('effectiveDieMultiplier', () => {
  it('multiplies the level multiplier by the ascension factor and the die charms', () => {
    const base = createInitialState(1)
    const plain = base.dice[0]
    if (!plain) throw new Error('setup')
    expect(N.eq(effectiveDieMultiplier(base, plain), 1)).toBe(true)
    const ascended = { ...plain, level: 7, ascensions: 2 }
    expect(N.eq(effectiveDieMultiplier(base, ascended), 7 * rules.ascension.multiplier ** 2)).toBe(true)
    const charmed = { ...base, charms: ['oak_cup', 'oak_cup', 'tin_cup'] }
    const cup = charmDef('oak_cup').effect.value
    expect(N.eq(effectiveDieMultiplier(charmed, ascended), 7 * rules.ascension.multiplier ** 2 * cup * cup)).toBe(true)
    expect(N.isZero(effectiveDieMultiplier(base, { ...plain, owned: false, level: 0 }))).toBe(true)
  })

  it('ascensionMultiplier compounds', () => {
    expect(N.eq(ascensionMultiplier(0), 1)).toBe(true)
    expect(N.eq(ascensionMultiplier(1), rules.ascension.multiplier)).toBe(true)
    expect(N.eq(ascensionMultiplier(3), rules.ascension.multiplier ** 3)).toBe(true)
  })
})

describe('levelCost', () => {
  it('is baseCost at level 0 and grows by costGrowth per level', () => {
    expect(N.eq(levelCost(die1, 0), die1.baseCost)).toBe(true)
    expect(N.eq(levelCost(die2, 0), die2.baseCost)).toBe(true)
    expect(close(levelCost(die1, 1), N.from(die1.baseCost * die1.costGrowth))).toBe(true)
    expect(close(levelCost(die1, 10), N.from(die1.baseCost * die1.costGrowth ** 10))).toBe(true)
  })

  it('multiplies the whole curve by the ascension cost multiplier per ascension', () => {
    const factor = rules.ascension.costMultiplier
    expect(N.eq(levelCost(die1, 0, 0), levelCost(die1, 0))).toBe(true)
    expect(close(levelCost(die1, 0, 1), N.from(die1.baseCost * factor))).toBe(true)
    expect(close(levelCost(die1, 7, 2), N.from(die1.baseCost * die1.costGrowth ** 7 * factor ** 2))).toBe(true)
    expect(close(bulkCost(die1, 3, 5, 2), N.mul(bulkCost(die1, 3, 5), factor ** 2))).toBe(true)
    const purse = bulkCost(die1, 1, 10, 1)
    expect(maxAffordable(die1, 1, purse, 1)).toBe(10)
    expect(maxAffordable(die1, 1, purse)).toBeGreaterThan(10)
    expect(levelsBuyable(die1, 1, purse, 1)).toBe(10)
  })
})

describe('bulkCost', () => {
  it('is zero for a count of zero or less', () => {
    expect(N.isZero(bulkCost(die1, 5, 0))).toBe(true)
    expect(N.isZero(bulkCost(die1, 5, -3))).toBe(true)
  })

  it('is exactly the single level cost for a count of one', () => {
    // Exact, not close: a single level must be charged what dieView shows as nextCost.
    fc.assert(fc.property(anyDie, level, (def, lvl) => N.eq(bulkCost(def, lvl, 1), levelCost(def, lvl))))
  })

  it('equals the summed levelCost of the levels it buys', () => {
    fc.assert(
      fc.property(anyDie, level, count, (def, lvl, n) => {
        let sum = N.zero
        for (let k = 0; k < n; k++) sum = N.add(sum, levelCost(def, lvl + k))
        return close(bulkCost(def, lvl, n), sum)
      }),
      { numRuns: 2000 },
    )
  })
})

describe('maxAffordable', () => {
  it('is the largest count whose bulkCost is affordable', () => {
    fc.assert(
      fc.property(anyDie, level, points, (def, lvl, pts) => {
        const n = maxAffordable(def, lvl, pts)
        return (
          Number.isSafeInteger(n) &&
          n >= 0 &&
          N.lte(bulkCost(def, lvl, n), pts) &&
          N.gt(bulkCost(def, lvl, n + 1), pts)
        )
      }),
      { numRuns: 3000 },
    )
  })

  it('handles the exact boundary and the empty purse', () => {
    expect(maxAffordable(die1, 0, N.from(die1.baseCost))).toBe(1)
    expect(maxAffordable(die1, 0, N.from(die1.baseCost - 0.01))).toBe(0)
    expect(maxAffordable(die1, 0, N.zero)).toBe(0)
    expect(maxAffordable(die1, 0, N.from(-5))).toBe(0)
    expect(maxAffordable(die1, 1, N.from(die1.baseCost * die1.costGrowth))).toBe(1)
    const twoLevels = bulkCost(die1, 1, 2)
    expect(maxAffordable(die1, 1, twoLevels)).toBe(2)
    expect(maxAffordable(die1, 1, N.sub(twoLevels, 1e-6))).toBe(1)
  })

  it('stays exact past the double range', () => {
    const pts = N.parse('1e400')
    const n = maxAffordable(die1, 0, pts)
    expect(Number.isSafeInteger(n)).toBe(true)
    expect(n).toBeGreaterThan(10000)
    expect(N.lte(bulkCost(die1, 0, n), pts)).toBe(true)
    expect(N.gt(bulkCost(die1, 0, n + 1), pts)).toBe(true)
  })

  it('terminates with a safe integer just below the count limit', () => {
    // Regression: the bisection stalled on a mid equal to a bound once the gallop passed 2^53.
    const pts = N.parse('1e300000000000000')
    const n = maxAffordable(die1, 0, pts)
    expect(Number.isSafeInteger(n)).toBe(true)
    expect(n).toBeGreaterThan(1e15)
    expect(n).toBeLessThan(Number.MAX_SAFE_INTEGER)
    expect(N.lte(bulkCost(die1, 0, n), pts)).toBe(true)
    expect(N.gt(bulkCost(die1, 0, n + 1), pts)).toBe(true)
  })

  it('saturates at MAX_SAFE_INTEGER for a purse beyond any representable count', () => {
    // Regression: the settle loops spun forever because count + 1 === count above 2^53.
    for (const text of ['1e500000000000000', '1e1000000000000000', '1e8999999999999999']) {
      const n = maxAffordable(die1, 0, N.parse(text))
      expect(n, text).toBe(Number.MAX_SAFE_INTEGER)
    }
    for (const def of content.dice) {
      expect(maxAffordable(def, 500, N.parse('1e1000000000000000'))).toBe(Number.MAX_SAFE_INTEGER)
    }
  })
})

describe('levelsBuyable', () => {
  it('never passes the level cap', () => {
    const cap = rules.ascension.level
    const rich = N.parse('1e30')
    expect(levelsBuyable(die1, 1, rich)).toBe(cap - 1)
    expect(levelsBuyable(die1, cap - 1, rich)).toBe(1)
    expect(levelsBuyable(die1, cap, rich)).toBe(0)
    expect(levelsBuyable(die1, cap + 5, rich)).toBe(0)
    expect(levelsBuyable(die1, 1, N.from(5))).toBe(0)
    expect(levelsBuyable(die1, 1, levelCost(die1, 1))).toBe(1)
  })
})

describe('rollPoints', () => {
  it('is face times multiplier summed over the owned dice, times the best hand', () => {
    const initial = createInitialState(1)
    expect(N.eq(rollPoints(initial, [4]), 4)).toBe(true)
    const two = withDice(initial, [1, 2])
    expect(N.eq(rollPoints(two, [3, 5]), 3 * 1 + 5 * (2 * 2))).toBe(true)
    expect(N.eq(rollPoints(two, [5, 5]), (5 * 1 + 5 * 4) * comboDef('pair').base)).toBe(true)
  })

  it('reads the printed face, not the side, and applies luck, trophies and charms', () => {
    const base = createInitialState(1)
    const edited: GameState = {
      ...base,
      dice: base.dice.map((die, i) => (i === 0 ? { ...die, faces: [7, 2, 3, 4, 5, 6], faceUpgrades: 6 } : die)),
      luck: 1,
      luckTotal: 5,
      trophies: ['first_roll', 'hundred_rolls'],
      charms: ['worn_felt', 'golden_pip'],
    }
    const expected = 7 * (1 + rules.luck.perPoint * 5) * rules.trophy.multiplier ** 2 * 1.25 * 2
    expect(close(rollPoints(edited, [1]), N.from(expected))).toBe(true)
    expect(rollValues(edited, [1])).toEqual([7])
  })

  it('equals the hand sum times the best hand for any state and sides', () => {
    fc.assert(
      fc.property(randomState, fc.array(fc.integer({ min: 1, max: 6 }), { minLength: 5, maxLength: 5 }), (state, faces) => {
        let expected = N.zero
        let next = 0
        for (const die of state.dice) {
          if (!die.owned) continue
          const def = content.dice.find((d) => d.id === die.id)
          const face = faces[next]
          next += 1
          if (!def || face === undefined) return false
          expected = N.add(expected, N.mul(face, N.mul(def.baseMultiplier, die.level)))
        }
        const hand = bestHand(faces.slice(0, next))
        if (hand !== null) expected = N.mul(expected, comboDef(hand).base)
        // Within rounding: break_infinity multiplies a plain number into the mantissa before
        // normalising and a Decimal mantissa to mantissa, which can differ in the last ulp.
        return close(rollPoints(state, faces), expected, 1e-12)
      }),
    )
  })

  it('needs one side per owned die', () => {
    expect(() => rollPoints(createInitialState(1), [])).toThrow(/one side per owned die/)
  })
})

describe('expectedPointsPerRoll', () => {
  it('is the mean face times the multiplier with one die and grows with hands for more', () => {
    const initial = createInitialState(1)
    expect(close(expectedPointsPerRoll(initial), N.from(3.5))).toBe(true)
    // Two dice: E[face x best hand] per die is 3.5 plus the pair bonus 21 / 36.
    const two = withDice(initial, [1, 2])
    expect(close(expectedPointsPerRoll(two), N.from((1 + 4) * (3.5 + 21 / 36)))).toBe(true)
  })
})

describe('combo formulas', () => {
  it('comboMultiplier is base x (1 + step x level) x combo charms', () => {
    const state = createInitialState(1)
    expect(N.eq(comboMultiplier(state, 'pair'), comboDef('pair').base)).toBe(true)
    const levelled = { ...state, combos: { pair: 3 } }
    expect(close(comboMultiplier(levelled, 'pair'), N.from(comboDef('pair').base * (1 + 3 * rules.combo.step)))).toBe(true)
    const charmed = { ...levelled, charms: ['card_sharp'] }
    expect(close(comboMultiplier(charmed, 'pair'), N.from(comboDef('pair').base * (1 + 3 * rules.combo.step) * 1.25))).toBe(true)
    expect(close(comboMultiplier(charmed, 'five_kind'), N.from(comboDef('five_kind').base * 1.25))).toBe(true)
  })

  it('comboUpgradeCost grows geometrically', () => {
    expect(N.eq(comboUpgradeCost(0), rules.combo.upgradeCost)).toBe(true)
    expect(close(comboUpgradeCost(4), N.from(rules.combo.upgradeCost * rules.combo.costGrowth ** 4))).toBe(true)
  })
})

describe('face formulas', () => {
  it('faceUpgradeCost is baseCost x factor x growth ^ upgrades', () => {
    expect(N.eq(faceUpgradeCost(die1, 0), die1.baseCost * rules.face.costFactor)).toBe(true)
    expect(close(faceUpgradeCost(die2, 3), N.from(die2.baseCost * rules.face.costFactor * rules.face.costGrowth ** 3))).toBe(true)
  })

  it('faceCap is the content cap plus face_cap charms', () => {
    const state = createInitialState(1)
    expect(faceCap(state)).toBe(rules.face.cap)
    expect(faceCap({ ...state, charms: ['whittling_knife', 'whittling_knife'] })).toBe(rules.face.cap + 4)
  })

  it('lowestFaceIndex is the first lowest face', () => {
    expect(lowestFaceIndex([1, 2, 3, 4, 5, 6])).toBe(0)
    expect(lowestFaceIndex([3, 2, 2, 4, 5, 6])).toBe(1)
    expect(lowestFaceIndex([9, 9, 9, 9, 9, 9])).toBe(0)
  })
})

describe('global multipliers', () => {
  it('luckMultiplier is 1 + perPoint x luckTotal, untouched by spending', () => {
    const state = createInitialState(1)
    expect(N.eq(luckMultiplier(state), 1)).toBe(true)
    expect(close(luckMultiplier({ ...state, luck: 7, luckTotal: 7 }), N.from(1 + 7 * rules.luck.perPoint))).toBe(true)
    expect(close(luckMultiplier({ ...state, luck: 0, luckTotal: 7 }), N.from(1 + 7 * rules.luck.perPoint))).toBe(true)
  })

  it('trophyMultiplier compounds per trophy', () => {
    const state = createInitialState(1)
    expect(N.eq(trophyMultiplier(state), 1)).toBe(true)
    expect(close(trophyMultiplier({ ...state, trophies: ['first_roll', 'million', 'billion'] }), N.from(rules.trophy.multiplier ** 3))).toBe(true)
  })

  it('globalMultiplier is points charms x luck x trophies, and charmEffects folds every target', () => {
    const state: GameState = {
      ...createInitialState(1),
      luck: 2,
      luckTotal: 2,
      trophies: ['first_roll'],
      charms: ['worn_felt', 'silver_thimble', 'card_sharp', 'wound_spring', 'quick_hand', 'whittling_knife', 'second_helping', 'clay_cup'],
    }
    const effects = charmEffects(state)
    expect(close(effects.points, N.from(1.25 * 1.5))).toBe(true)
    expect(close(effects.combo, N.from(1.25))).toBe(true)
    expect(effects.autoroll).toBeCloseTo(0.85 * 0.7)
    expect(effects.faceCap).toBe(2)
    expect(effects.draftGrowth).toBeCloseTo(-0.05)
    expect(N.eq(effects.dice.get('die_3') ?? N.zero, charmDef('clay_cup').effect.value)).toBe(true)
    expect(effects.dice.has('die_1')).toBe(false)
    expect(close(globalMultiplier(state), N.from(1.25 * 1.5 * (1 + 2 * rules.luck.perPoint) * rules.trophy.multiplier))).toBe(true)
  })

  it('autoRollInterval scales the base interval by the autoroll charms, whole ms, at least 1', () => {
    const state = createInitialState(1)
    expect(autoRollInterval(state)).toBe(rules.autoRoll.baseIntervalMs)
    expect(autoRollInterval({ ...state, charms: ['wound_spring'] })).toBe(Math.floor(rules.autoRoll.baseIntervalMs * 0.85))
    expect(autoRollInterval({ ...state, charms: Array.from({ length: 60 }, () => 'quick_hand') })).toBe(1)
  })

  it('draftRequirement is ceil(growth ^ taken) with growth softened by charms, never below 1', () => {
    const state = createInitialState(1)
    expect(draftGrowth(state)).toBe(rules.draft.growth)
    expect(draftRequirement(state)).toBe(1)
    const taken = (n: number, charms: string[] = []): GameState => ({ ...state, charms, draft: { ...state.draft, taken: n } })
    expect(draftRequirement(taken(5))).toBe(Math.ceil(rules.draft.growth ** 5))
    expect(draftRequirement(taken(5, ['second_helping']))).toBe(Math.ceil((rules.draft.growth - 0.05) ** 5))
    expect(draftGrowth(taken(0, Array.from({ length: 10 }, () => 'second_helping')))).toBe(1)
    expect(draftRequirement(taken(40, Array.from({ length: 10 }, () => 'second_helping')))).toBe(1)
  })
})

describe('luckOnReset', () => {
  it('is floor(perDecade x log10(run / threshold)) + 1 once the run has earned the threshold, exact on whole decades', () => {
    const state = createInitialState(1)
    const at = (run: Num): GameState => ({ ...state, totalEarned: run, totalEarnedRun: run })
    const t = rules.luck.threshold
    const d = rules.luck.perDecade
    const table: [Num, number][] = [
      [N.zero, 0],
      [N.from(t - 1), 0],
      [N.from(t), 1],
      [N.from(1.5 * t), Math.floor(d * Math.log10(1.5)) + 1],
      [N.from(4 * t), Math.floor(d * Math.log10(4)) + 1],
      [N.from(9.99 * t), Math.floor(d * Math.log10(9.99)) + 1],
      [N.from(10 * t), d + 1],
      [N.from(100 * t), 2 * d + 1],
      [N.mul(t, N.parse('1e15')), 15 * d + 1],
      [N.mul(t, N.parse('1e23')), 23 * d + 1],
      [N.mul(t, N.parse('1e400')), 400 * d + 1],
    ]
    for (const [run, expected] of table) expect(luckOnReset(at(run)), N.serialize(run)).toBe(expected)
    expect(Number.isSafeInteger(luckOnReset(at(N.parse('1e700'))))).toBe(true)
  })

  it('grows by perDecade per tenfold run, never by a multiple', () => {
    const state = createInitialState(1)
    const at = (run: Num): GameState => ({ ...state, totalEarned: run, totalEarnedRun: run })
    const t = rules.luck.threshold
    for (let decade = 0; decade < 30; decade++) {
      const here = luckOnReset(at(N.mul(t, N.pow(10, decade))))
      const next = luckOnReset(at(N.mul(t, N.pow(10, decade + 1))))
      expect(next - here).toBe(rules.luck.perDecade)
    }
  })
})

describe('luck upgrades', () => {
  const base = createInitialState(1)
  const owning = (upgrades: GameState['luckUpgrades']): GameState => ({ ...base, luckUpgrades: upgrades })

  it('luckUpgradeCost is ceil(baseCost x costGrowth ^ level), a whole number of luck, for every row', () => {
    const series = (id: Parameters<typeof luckUpgradeDef>[0]) => {
      const def = luckUpgradeDef(id)
      return Array.from({ length: def.maxLevel }, (_, level) => luckUpgradeCost(def, level))
    }
    expect(series('head_start')).toEqual([2, 4, 6, 9, 14])
    expect(series('quick_hands')).toEqual([1, 2, 3, 4, 6, 8, 12, 18])
    expect(series('deep_pockets')).toEqual([1, 2, 2, 3, 4, 6, 8, 11, 15, 21])
    expect(series('keen_eye')).toEqual([2, 4, 6, 9, 14])
    expect(series('lucky_draw')).toEqual([4, 8])
    expect(series('memory')).toEqual([5, 10, 20])
    expect(series('steady_hands')).toEqual([3])
    for (const def of content.luckUpgrades) {
      for (let level = 0; level < def.maxLevel; level++) {
        const cost = luckUpgradeCost(def, level)
        expect(Number.isInteger(cost) && cost >= 1).toBe(true)
        if (level > 0) expect(cost).toBeGreaterThanOrEqual(luckUpgradeCost(def, level - 1))
      }
    }
  })

  it('luckEffects folds nothing into the neutral effects and each kind into its own field', () => {
    expect(luckEffects(base)).toEqual({ headStartLevel: 0, autoroll: 1, points: N.one, combo: N.one, offerBonus: 0, memory: 0, autoLevel: false })
    expect(luckUpgradeLevel(base, 'deep_pockets')).toBe(0)
    const all = owning({ head_start: 2, quick_hands: 3, deep_pockets: 4, keen_eye: 2, lucky_draw: 1, memory: 3, steady_hands: 1 })
    const effects = luckEffects(all)
    expect(effects.headStartLevel).toBe(20)
    expect(effects.autoroll).toBeCloseTo(0.92 ** 3)
    expect(close(effects.points, N.from(1.2 ** 4))).toBe(true)
    expect(close(effects.combo, N.from(1 + 0.15 * 2))).toBe(true)
    expect(effects.offerBonus).toBe(1)
    expect(effects.memory).toBe(3)
    expect(effects.autoLevel).toBe(true)
    expect(luckUpgradeLevel(all, 'deep_pockets')).toBe(4)
  })

  it('deep_pockets multiplies every roll and keen_eye every hand, and both reach the expected value', () => {
    const two = { ...base, dice: base.dice.map((die, i) => (i <= 1 ? { ...die, owned: true, level: 1 } : die)) }
    const pockets = { ...two, luckUpgrades: { deep_pockets: 2 } }
    expect(close(luckAndUpgradesMultiplier(pockets), N.from(1.2 ** 2))).toBe(true)
    expect(close(globalMultiplier(pockets), N.from(1.2 ** 2))).toBe(true)
    expect(close(rollPoints(pockets, [3, 5]), N.mul(rollPoints(two, [3, 5]), 1.2 ** 2))).toBe(true)
    expect(close(expectedPointsPerRoll(pockets), N.mul(expectedPointsPerRoll(two), 1.2 ** 2))).toBe(true)
    const eye = { ...two, luckUpgrades: { keen_eye: 2 } }
    expect(close(comboMultiplier(eye, 'pair'), N.from(comboDef('pair').base * 1.3))).toBe(true)
    expect(close(comboMultiplier({ ...eye, charms: ['card_sharp'] }, 'five_kind'), N.from(comboDef('five_kind').base * 1.25 * 1.3))).toBe(true)
    expect(N.eq(rollPoints(eye, [3, 5]), rollPoints(two, [3, 5]))).toBe(true)
    expect(close(rollPoints(eye, [5, 5]), N.mul(rollPoints(two, [5, 5]), 1.3))).toBe(true)
    expect(N.gt(expectedComboMultiplier(eye), expectedComboMultiplier(two))).toBe(true)
  })

  it('quick_hands shortens the auto-roll interval on top of the charms, whole ms, at least 1', () => {
    expect(autoRollInterval(owning({ quick_hands: 1 }))).toBe(Math.floor(rules.autoRoll.baseIntervalMs * 0.92))
    expect(autoRollInterval({ ...owning({ quick_hands: 8 }), charms: ['quick_hand'] })).toBe(Math.floor(rules.autoRoll.baseIntervalMs * 0.92 ** 8 * 0.7))
    expect(autoRollInterval({ ...owning({ quick_hands: 8 }), charms: Array.from({ length: 60 }, () => 'quick_hand') })).toBe(1)
  })

  it('lucky_draw widens the offer, head_start sets the starting level within the cap, steady_hands makes auto-level available', () => {
    expect(draftOfferSize(base)).toBe(rules.draft.offerSize)
    expect(draftOfferSize(owning({ lucky_draw: 2 }))).toBe(rules.draft.offerSize + 2)
    expect(headStartLevel(luckEffects(base))).toBe(1)
    expect(headStartLevel(luckEffects(owning({ head_start: 1 })))).toBe(10)
    expect(headStartLevel(luckEffects(owning({ head_start: 5 })))).toBe(50)
    expect(headStartLevel({ ...luckEffects(base), headStartLevel: 1e6 })).toBe(rules.ascension.level)
    expect(autoLevelAvailable(base)).toBe(false)
    expect(autoLevelAvailable(owning({ steady_hands: 1 }))).toBe(true)
  })

  it('luck sinks: mastery and favour cost tables are ceil of the content curves, whole luck, never falling', () => {
    const series = (cost: (level: number) => number, count: number) => Array.from({ length: count }, (_, level) => cost(level))
    // ceil(2 x 1.35 ^ level) and ceil(1.5 ^ level), the m5-theme.md sections 1 and 2 curves.
    expect(series(masteryCost, 12)).toEqual([2, 3, 4, 5, 7, 9, 13, 17, 23, 30, 41, 55])
    expect(series(favourCost, 12)).toEqual([1, 2, 3, 4, 6, 8, 12, 18, 26, 39, 58, 87])
    expect(masteryCost(0)).toBe(rules.mastery.baseCost)
    expect(favourCost(0)).toBe(1)
    for (let level = 0; level < 200; level++) {
      for (const cost of [masteryCost(level), favourCost(level)]) {
        expect(Number.isInteger(cost) && cost >= 1).toBe(true)
      }
      if (level > 0) {
        expect(masteryCost(level)).toBeGreaterThanOrEqual(masteryCost(level - 1))
        expect(favourCost(level)).toBeGreaterThanOrEqual(favourCost(level - 1))
      }
    }
    // Unbounded in principle; a level past the double range costs Infinity, which no purse covers.
    expect(masteryCost(5000)).toBe(Infinity)
    expect(favourCost(5000)).toBe(Infinity)
  })

  it('luck sinks: the multipliers are 1 + step x level', () => {
    expect(N.eq(masteryMultiplier(0), 1)).toBe(true)
    expect(close(masteryMultiplier(1), N.from(1 + rules.mastery.step))).toBe(true)
    expect(close(masteryMultiplier(17), N.from(1 + 17 * rules.mastery.step))).toBe(true)
    expect(N.eq(favourMultiplier(0), 1)).toBe(true)
    expect(close(favourMultiplier(1), N.from(1 + rules.favour.step))).toBe(true)
    expect(close(favourMultiplier(40), N.from(1 + 40 * rules.favour.step))).toBe(true)
  })

  it('mastery multiplies that die alone, on top of its level, ascensions and charms, owned dice only', () => {
    const two: GameState = { ...base, dice: base.dice.map((die, i) => (i <= 1 ? { ...die, owned: true, level: 1 } : die)) }
    const [first, second] = two.dice
    if (!first || !second) throw new Error('setup')
    expect(masteryLevel(two, die1.id)).toBe(0)
    const mastered: GameState = { ...two, mastery: { [die1.id]: 3 } }
    expect(masteryLevel(mastered, die1.id)).toBe(3)
    expect(close(effectiveDieMultiplier(mastered, first), N.from(1 + 3 * rules.mastery.step))).toBe(true)
    expect(N.eq(effectiveDieMultiplier(mastered, second), effectiveDieMultiplier(two, second))).toBe(true)
    const stacked: GameState = { ...mastered, charms: ['oak_cup'], dice: mastered.dice.map((die, i) => (i === 0 ? { ...die, level: 7, ascensions: 2 } : die)) }
    const expected = 7 * rules.ascension.multiplier ** 2 * charmDef('oak_cup').effect.value * (1 + 3 * rules.mastery.step)
    expect(close(effectiveDieMultiplier(stacked, stacked.dice[0] ?? first), N.from(expected))).toBe(true)
    // Unowned: zero, mastery or not (the level is kept for when the die comes back).
    expect(N.isZero(effectiveDieMultiplier(mastered, { ...first, owned: false, level: 0 }))).toBe(true)
    // Both dice at face 3: only the first die's share grows, by exactly its mastery factor.
    const before = rollPoints(two, [3, 3])
    const after = rollPoints(mastered, [3, 3])
    const dieShare = N.div(N.mul(effectiveDieMultiplier(two, first), 3), N.add(N.mul(effectiveDieMultiplier(two, first), 3), N.mul(effectiveDieMultiplier(two, second), 3)))
    const lift = N.add(1, N.mul(dieShare, 3 * rules.mastery.step))
    expect(close(after, N.mul(before, lift))).toBe(true)
    expect(close(expectedPointsPerRoll(mastered), N.mul(expectedPointsPerRoll(two), lift))).toBe(true)
  })

  it('favour multiplies every roll inside the luck factor, on top of lifetime luck and deep_pockets', () => {
    const two: GameState = { ...base, dice: base.dice.map((die, i) => (i <= 1 ? { ...die, owned: true, level: 1 } : die)) }
    const favoured: GameState = { ...two, favour: 4 }
    const factor = 1 + 4 * rules.favour.step
    expect(close(luckAndUpgradesMultiplier(favoured), N.from(factor))).toBe(true)
    expect(close(globalMultiplier(favoured), N.from(factor))).toBe(true)
    expect(close(rollPoints(favoured, [3, 5]), N.mul(rollPoints(two, [3, 5]), factor))).toBe(true)
    expect(close(expectedPointsPerRoll(favoured), N.mul(expectedPointsPerRoll(two), factor))).toBe(true)
    const everything: GameState = { ...favoured, luck: 0, luckTotal: 12, luckUpgrades: { deep_pockets: 2 }, trophies: ['first_roll'], charms: ['worn_felt'] }
    const luckFactor = (1 + 12 * rules.luck.perPoint) * 1.2 ** 2 * factor
    expect(close(luckAndUpgradesMultiplier(everything), N.from(luckFactor))).toBe(true)
    expect(close(globalMultiplier(everything), N.from(luckFactor * rules.trophy.multiplier * 1.25))).toBe(true)
    // luckMultiplier itself (the Luck tab summary) stays 1 + perPoint x luckTotal.
    expect(close(luckMultiplier(everything), N.from(1 + 12 * rules.luck.perPoint))).toBe(true)
  })

  it('charmsKept keeps the rarest charms first, pick order on ties, and the whole list when the count covers it', () => {
    const held = ['worn_felt', 'silver_thimble', 'golden_pip', 'chalk_mark', 'card_sharp']
    expect(charmsKept(held, 0)).toEqual([])
    expect(charmsKept([], 3)).toEqual([])
    expect(charmsKept(held, 1)).toEqual(['golden_pip'])
    expect(charmsKept(held, 2)).toEqual(['golden_pip', 'silver_thimble'])
    expect(charmsKept(held, 3)).toEqual(['golden_pip', 'silver_thimble', 'card_sharp'])
    expect(charmsKept(held, 4)).toEqual(['golden_pip', 'silver_thimble', 'card_sharp', 'worn_felt'])
    expect(charmsKept(held, 5)).toEqual(held)
    expect(charmsKept(held, 9)).toEqual(held)
    expect(charmsKept(['oak_cup', 'oak_cup', 'tin_cup'], 2)).toEqual(['oak_cup', 'oak_cup'])
  })
})

describe('unlockSatisfied', () => {
  const initial = createInitialState(1)

  it('always', () => {
    expect(unlockSatisfied({ kind: 'always' }, initial)).toBe(true)
  })

  it('totalEarned compares lifetime points', () => {
    const rich = { ...initial, totalEarned: N.from(500) }
    expect(unlockSatisfied({ kind: 'totalEarned', amount: 500 }, rich)).toBe(true)
    expect(unlockSatisfied({ kind: 'totalEarned', amount: 501 }, rich)).toBe(false)
    expect(unlockSatisfied({ kind: 'totalEarned', amount: 0 }, initial)).toBe(true)
  })

  it('owned needs the die owned at or above the count', () => {
    expect(unlockSatisfied({ kind: 'owned', id: die1.id, count: 1 }, initial)).toBe(true)
    expect(unlockSatisfied({ kind: 'owned', id: die1.id, count: 2 }, initial)).toBe(false)
    expect(unlockSatisfied({ kind: 'owned', id: die1.id, count: 2 }, withDice(initial, [2]))).toBe(true)
    expect(unlockSatisfied({ kind: 'owned', id: die2.id, count: 1 }, initial)).toBe(false)
    expect(unlockSatisfied({ kind: 'owned', id: 'ghost', count: 1 }, initial)).toBe(false)
  })

  it('prestiges compares the prestige count', () => {
    expect(unlockSatisfied({ kind: 'prestiges', count: 1 }, initial)).toBe(false)
    expect(unlockSatisfied({ kind: 'prestiges', count: 1 }, { ...initial, prestiges: 1 })).toBe(true)
    expect(unlockSatisfied({ kind: 'prestiges', count: 3 }, { ...initial, prestiges: 2 })).toBe(false)
  })
})

describe('findDie', () => {
  it('finds a slot by id and returns undefined otherwise', () => {
    const initial = createInitialState(1)
    expect(findDie(initial, die2.id)?.id).toBe(die2.id)
    expect(findDie(initial, 'ghost')).toBeUndefined()
  })
})
