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

  it('dice match the GDD section 4 table (Idle Dice baseline, die_5 baseCost tuned 2026-10-25 per BALANCE_LOG)', () => {
    expect(dice.map((d) => d.baseCost)).toEqual([10, 100, 1000, 10000, 35000])
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

describe('validateContent on broken rules', () => {
  it('names every rules field that fails the schema, with the rules prefix', () => {
    const message = messageOf(() =>
      validateContent({
        rules: {
          autoRoll: { baseIntervalMs: 0, unlock: { kind: 'owned', id: 'ghost', count: 1 } },
          offline: { tickMs: 1.5, maxTicks: 100000, capMs: 1 },
        },
      }),
    )
    expect(message).toMatch(/Content validation failed/)
    expect(message).toMatch(/rules: autoRoll\.baseIntervalMs: /)
    expect(message).toMatch(/rules: offline\.tickMs: /)
    expect(message).not.toMatch(/capMs/)
    expect(message).not.toMatch(/maxTicks/)
  })

  it('names a dangling unlock id once the rules parse', () => {
    const message = messageOf(() =>
      validateContent({
        rules: { ...content.rules, autoRoll: { ...content.rules.autoRoll, unlock: { kind: 'owned', id: 'ghost', count: 1 } } },
      }),
    )
    expect(message).toMatch(/rules "autoRoll\.unlock": unlock refers to unknown id "ghost"/)
    expect(message).toMatch(/1 problem\(s\)/)
  })

  it('rejects unknown keys and a non-object rules table', () => {
    expect(messageOf(() => validateContent({ rules: { ...content.rules, bonus: 1 } }))).toMatch(
      /rules: \(root\): Unrecognized key/,
    )
    expect(messageOf(() => validateContent({ rules: 42 }))).toMatch(/rules: \(root\): /)
  })

  it('accepts the shipped rules alongside a broken dice table without touching them', () => {
    const message = messageOf(() => validateContent({ dice: [{ ...dice[0], costGrowth: 1 }] }))
    expect(message).toMatch(/dice\[0\] "die_1": costGrowth: /)
    expect(message).not.toMatch(/rules/)
  })
})
