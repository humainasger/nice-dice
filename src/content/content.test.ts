// Content validation tests: the shipped tables pass, and a broken table is rejected with
// messages that name the offending rows and ids.
import { describe, expect, it } from 'vitest'
import { content, dice, validateContent } from './index'
import type { DieDef } from './schema'

const messageOf = (run: () => void): string => {
  try {
    run()
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
  return ''
}

describe('content tables', () => {
  it('validate', () => {
    expect(() => validateContent()).not.toThrow()
  })

  it('hold only plain JSON values', () => {
    expect(JSON.parse(JSON.stringify(content))).toEqual(content)
  })

  it('dice follow the PLAN.md section 3 baseline', () => {
    expect(dice.map((d) => d.baseCost)).toEqual([10, 100, 1000, 10000, 100000])
    expect(dice.map((d) => d.baseMultiplier)).toEqual([1, 2, 4, 8, 16])
    expect(dice.every((d) => d.costGrowth === 1.08 && d.sides === 6)).toBe(true)
    expect(dice[0]?.unlock).toEqual({ kind: 'always' })
    for (let i = 1; i < dice.length; i++) {
      expect(dice[i]?.unlock).toEqual({ kind: 'owned', id: dice[i - 1]?.id, count: 1 })
    }
  })
})

describe('validateContent on a broken table', () => {
  const [first, second, third, fourth] = dice as readonly [DieDef, DieDef, DieDef, DieDef, DieDef]
  const broken: readonly unknown[] = [
    first,
    { ...second, unlock: { kind: 'owned', id: 'ghost_die', count: 1 } },
    { ...third, id: 'die_1' },
    { ...fourth, costGrowth: 1 },
  ]

  it('throws', () => {
    expect(() => validateContent({ dice: broken })).toThrow(/Content validation failed/)
  })

  it('names the dangling unlock id', () => {
    expect(messageOf(() => validateContent({ dice: broken }))).toMatch(
      /dice\[1\] "die_2": unlock refers to unknown id "ghost_die"/,
    )
  })

  it('names the duplicate id and both places', () => {
    expect(messageOf(() => validateContent({ dice: broken }))).toMatch(
      /duplicate id "die_1" declared at dice\[0\] "die_1", dice\[2\] "die_1"/,
    )
  })

  it('names the row with a cost growth that is not above 1', () => {
    expect(messageOf(() => validateContent({ dice: broken }))).toMatch(/dice\[3\] "die_4": costGrowth: /)
  })

  it('reports every problem in one error', () => {
    expect(messageOf(() => validateContent({ dice: broken }))).toMatch(/3 problem\(s\)/)
  })

  it('rejects unknown keys, bad ids and non-objects', () => {
    const message = messageOf(() =>
      validateContent({ dice: [{ ...first, colour: 'red' }, { ...second, id: 'Die-2' }, 42] }),
    )
    expect(message).toMatch(/dice\[0\] "die_1": \(row\): Unrecognized key/)
    expect(message).toMatch(/dice\[1\] "Die-2": id: id must be lowercase snake_case/)
    expect(message).toMatch(/dice\[2\]: \(row\): /)
  })
})
