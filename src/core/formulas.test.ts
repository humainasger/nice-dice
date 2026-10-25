// Property and example tests for the M1 formulas: bulkCost against the summed levelCost,
// maxAffordable as the largest affordable count, rollPoints as the hand sum, the mean roll and
// every unlock condition kind.
import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { content, type DieDef } from '@/content'
import {
  bulkCost,
  dieMultiplier,
  expectedPointsPerRoll,
  findDie,
  levelCost,
  maxAffordable,
  rollPoints,
  unlockSatisfied,
} from './formulas'
import { N, type Num } from './num'
import { createInitialState } from './save'
import type { GameState } from './state'

const [die1, die2, die3] = content.dice
if (!die1 || !die2 || !die3) throw new Error('these tests need at least three content dice')

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

describe('levelCost', () => {
  it('is baseCost at level 0 and grows by costGrowth per level', () => {
    expect(N.eq(levelCost(die1, 0), die1.baseCost)).toBe(true)
    expect(N.eq(levelCost(die2, 0), die2.baseCost)).toBe(true)
    expect(close(levelCost(die1, 1), N.from(die1.baseCost * die1.costGrowth))).toBe(true)
    expect(close(levelCost(die1, 10), N.from(die1.baseCost * die1.costGrowth ** 10))).toBe(true)
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

describe('rollPoints', () => {
  it('is face times multiplier summed over the owned dice', () => {
    const initial = createInitialState(1)
    expect(N.eq(rollPoints(initial, [4]), 4)).toBe(true)
    const two = withDice(initial, [1, 2])
    expect(N.eq(rollPoints(two, [3, 5]), 3 * 1 + 5 * (2 * 2))).toBe(true)
  })

  it('equals the hand sum for any state and faces', () => {
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
        return N.eq(rollPoints(state, faces), expected)
      }),
    )
  })

  it('needs one face per owned die', () => {
    expect(() => rollPoints(createInitialState(1), [])).toThrow(/one face per owned die/)
  })
})

describe('expectedPointsPerRoll', () => {
  it('is the mean face times the summed multipliers', () => {
    const initial = createInitialState(1)
    expect(N.eq(expectedPointsPerRoll(initial), 3.5)).toBe(true)
    expect(N.eq(expectedPointsPerRoll(withDice(initial, [1, 2])), 3.5 * (1 + 4))).toBe(true)
    expect(N.eq(expectedPointsPerRoll(withDice(initial, [3, 0, 2])), 3.5 * (3 + 8))).toBe(true)
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

  it('prestiges is false until M5', () => {
    expect(unlockSatisfied({ kind: 'prestiges', count: 1 }, initial)).toBe(false)
  })
})

describe('findDie', () => {
  it('finds a slot by id and returns undefined otherwise', () => {
    const initial = createInitialState(1)
    expect(findDie(initial, die2.id)?.id).toBe(die2.id)
    expect(findDie(initial, 'ghost')).toBeUndefined()
  })
})
