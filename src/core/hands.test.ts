// Hand detection on every hand and its near misses, the pattern counts behind the expected value,
// and the expected value itself against a brute-force enumeration (exact) and a Monte Carlo run
// (within 2 percent) for two and three dice with edited faces and upgraded combos.
import { describe, expect, it } from 'vitest'
import { content, type ComboId } from '@/content'
import { comboMultiplier, expectedComboMultiplier, expectedPointsPerRoll, rollPoints } from './formulas'
import { bestHand, handCounts, handMembers } from './hands'
import { N, type Num } from './num'
import { createRng } from './rng'
import { createInitialState } from './save'
import type { GameState } from './state'

const abs = (x: Num): Num => N.max(x, N.sub(0, x))
/** |a - b| <= tol * max(|a|, |b|, 1) */
const close = (a: Num, b: Num, tol = 1e-9): boolean =>
  N.lte(abs(N.sub(a, b)), N.mul(N.max(N.max(abs(a), abs(b)), 1), tol))

describe('bestHand', () => {
  const cases: [string, number[], ComboId | null][] = [
    ['one die is never a hand', [6], null],
    ['two different sides', [1, 2], null],
    ['pair of two', [3, 3], 'pair'],
    ['pair among three', [3, 5, 3], 'pair'],
    ['three sides with a gap are nothing', [1, 2, 4], null],
    ['two pair', [2, 5, 2, 5], 'two_pair'],
    ['two pair near miss is a pair', [2, 2, 5, 6], 'pair'],
    ['three of a kind', [4, 4, 4], 'three_kind'],
    ['three of a kind with two odd dice', [4, 1, 4, 2, 4], 'three_kind'],
    ['a pair with three odd dice', [4, 4, 1, 2, 3], 'pair'],
    ['straight of three', [3, 1, 2], 'straight'],
    ['straight of four', [5, 2, 4, 3], 'straight'],
    ['low straight of five', [1, 2, 3, 4, 5], 'straight'],
    ['high straight of five', [6, 5, 4, 3, 2], 'straight'],
    ['five distinct with a gap is nothing', [1, 2, 3, 4, 6], null],
    ['a run with a repeat is just the pair', [1, 2, 3, 3], 'pair'],
    ['full house', [2, 5, 2, 5, 2], 'full_house'],
    ['full house near miss is three of a kind', [2, 2, 2, 5, 6], 'three_kind'],
    ['a triple and a pair in six dice would be a full house too', [2, 2, 2, 5, 5], 'full_house'],
    ['four of a kind', [6, 6, 1, 6, 6], 'four_kind'],
    ['four of a kind near miss is a full house', [6, 6, 6, 1, 1], 'full_house'],
    ['five of a kind', [3, 3, 3, 3, 3], 'five_kind'],
    ['five of a kind near miss is four of a kind', [3, 3, 3, 3, 4], 'four_kind'],
    ['no dice', [], null],
  ]
  it.each(cases)('%s', (_name, faces, hand) => {
    expect(bestHand(faces)).toBe(hand)
  })

  it('never names a hand the content table lacks', () => {
    const ids = new Set(content.combos.map((def) => def.id))
    for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) for (let c = 1; c <= 6; c++) {
      const hand = bestHand([a, b, c])
      expect(hand === null || ids.has(hand)).toBe(true)
    }
  })
})

describe('handMembers', () => {
  it.each<[number[], number[]]>([
    [[1, 2], []],
    [[3, 5, 3], [0, 2]],
    [[2, 2, 5, 6], [0, 1]],
    [[2, 2, 5, 5, 6], [0, 1, 2, 3]],
    [[4, 1, 4, 2, 4], [0, 2, 4]],
    [[3, 1, 2], [0, 1, 2]],
    [[2, 5, 2, 5, 2], [0, 1, 2, 3, 4]],
    [[6, 6, 1, 6, 6], [0, 1, 3, 4]],
    [[3, 3, 3, 3, 3], [0, 1, 2, 3, 4]],
    [[1, 1, 6, 6, 2], [0, 1, 2, 3]],
    [[5, 5, 1, 1, 1], [0, 1, 2, 3, 4]],
    [[2, 2, 6, 6], [0, 1, 2, 3]],
  ])('%j rings %j', (faces, members) => {
    expect(handMembers(faces)).toEqual(members)
  })

  it('on a plain pair among two pairs of equal count rings the higher side', () => {
    // Three dice cannot hold two pairs; with a pair of 2s and a lone 6 only the 2s ring.
    expect(handMembers([6, 2, 2])).toEqual([1, 2])
  })
})

describe('handCounts', () => {
  it('matches the known distribution of five six-sided dice', () => {
    const counts = handCounts(5, 6)
    expect(counts.patterns).toBe(7776)
    const total = (hand: ComboId | null) => counts.total.get(hand) ?? 0
    expect(total('five_kind')).toBe(6)
    expect(total('four_kind')).toBe(150)
    expect(total('full_house')).toBe(300)
    expect(total('straight')).toBe(240)
    expect(total('three_kind')).toBe(1200)
    expect(total('two_pair')).toBe(1800)
    expect(total('pair')).toBe(3600)
    expect(total(null)).toBe(480)
    let sum = 0
    for (const count of counts.total.values()) sum += count
    expect(sum).toBe(7776)
  })

  it('splits every hand by the first die with rows that sum to the hand total', () => {
    for (const n of [1, 2, 3, 4, 5]) {
      const counts = handCounts(n, 6)
      expect(counts.patterns).toBe(6 ** n)
      for (const [hand, row] of counts.byFace) {
        expect(row).toHaveLength(6)
        expect(row.reduce((a, b) => a + b, 0)).toBe(counts.total.get(hand))
      }
    }
    const two = handCounts(2, 6)
    expect(two.total.get('pair')).toBe(6)
    expect(two.total.get(null)).toBe(30)
    expect(two.byFace.get('pair')).toEqual([1, 1, 1, 1, 1, 1])
    const one = handCounts(1, 6)
    expect([...one.total.keys()]).toEqual([null])
  })

  it('is memoised and rejects bad arguments', () => {
    expect(handCounts(3, 6)).toBe(handCounts(3, 6))
    expect(() => handCounts(0, 6)).toThrow()
    expect(() => handCounts(2, 0)).toThrow()
    expect(() => handCounts(2.5, 6)).toThrow()
  })
})

/** A state with the given owned dice (level, faces), combo levels and charms. */
function build(
  dice: readonly { level: number; faces?: number[]; ascensions?: number }[],
  combos: Partial<Record<ComboId, number>> = {},
  charms: string[] = [],
): GameState {
  const base = createInitialState(11)
  return {
    ...base,
    dice: base.dice.map((die, i) => {
      const spec = dice[i]
      if (spec === undefined) return i === 0 ? die : { ...die, owned: false, level: 0 }
      return { ...die, owned: true, level: spec.level, faces: spec.faces ?? die.faces, ascensions: spec.ascensions ?? 0 }
    }),
    combos,
    charms,
  }
}

/** The mean of rollPoints over every pattern, the slow way. */
function bruteForce(state: GameState): Num {
  const n = state.dice.filter((die) => die.owned).length
  const pattern = Array.from({ length: n }, () => 1)
  let total = N.zero
  let count = 0
  for (;;) {
    total = N.add(total, rollPoints(state, pattern))
    count += 1
    let i = n - 1
    while (i >= 0 && pattern[i] === 6) {
      pattern[i] = 1
      i -= 1
    }
    if (i < 0) break
    pattern[i] = (pattern[i] ?? 1) + 1
  }
  return N.div(total, count)
}

describe('expectedPointsPerRoll', () => {
  const states: [string, GameState][] = [
    ['one die', build([{ level: 3 }])],
    ['two plain dice', build([{ level: 2 }, { level: 1 }])],
    ['two dice, edited faces and an upgraded pair', build([{ level: 5, faces: [4, 4, 4, 5, 6, 6] }, { level: 2, faces: [2, 2, 3, 4, 5, 6] }], { pair: 3 })],
    ['three dice with charms', build([{ level: 7 }, { level: 3, faces: [3, 3, 3, 4, 5, 6] }, { level: 1, ascensions: 1 }], { straight: 2, three_kind: 1 }, ['card_sharp', 'golden_pip', 'tin_cup'])],
    ['five dice', build([{ level: 50 }, { level: 20 }, { level: 10 }, { level: 5 }, { level: 1 }], { five_kind: 4, full_house: 1 })],
  ]

  it.each(states)('equals the brute-force mean over every pattern: %s', (_name, state) => {
    expect(close(expectedPointsPerRoll(state), bruteForce(state), 1e-9)).toBe(true)
  })

  it('is the plain mean face times the multiplier with one die', () => {
    expect(close(expectedPointsPerRoll(createInitialState(1)), N.from(3.5))).toBe(true)
    expect(close(expectedComboMultiplier(createInitialState(1)), N.one)).toBe(true)
  })

  it('expected combo multiplier is the hand-weighted mean of the combo multipliers', () => {
    const state = build([{ level: 1 }, { level: 1 }], { pair: 1 })
    // Two dice: a pair on 6 of 36 patterns at base 2 x 1.1.
    const pair = comboMultiplier(state, 'pair')
    const expected = N.div(N.add(N.mul(pair, 6), 30), 36)
    expect(close(expectedComboMultiplier(state), expected)).toBe(true)
  })

  it.each([
    ['two dice', build([{ level: 4, faces: [3, 3, 3, 4, 5, 6] }, { level: 2 }], { pair: 2 })],
    ['three dice', build([{ level: 9 }, { level: 4, faces: [2, 2, 3, 4, 5, 6] }, { level: 2 }], { straight: 1, three_kind: 2 }, ['card_sharp'])],
  ])('is within 2 percent of a Monte Carlo estimate: %s', (_name, state) => {
    const rng = createRng(2024)
    const n = state.dice.filter((die) => die.owned).length
    const rolls = 40_000
    let total = N.zero
    for (let i = 0; i < rolls; i++) {
      const faces = Array.from({ length: n }, () => rng.rollDie(6))
      total = N.add(total, rollPoints(state, faces))
    }
    const monteCarlo = N.div(total, rolls)
    const expected = expectedPointsPerRoll(state)
    const relative = N.toNumber(N.div(abs(N.sub(monteCarlo, expected)), expected))
    expect(relative, `Monte Carlo ${N.format(monteCarlo)} vs expected ${N.format(expected)}`).toBeLessThan(0.02)
  })
})
