// Content validation tests: the shipped tables pass, the M3 tables and rules match the brief, and a
// broken table is rejected with messages that name the offending rows and ids.
import { describe, expect, it } from 'vitest'
import { charms, COMBO_IDS, combos, content, dice, trophies, validateContent } from './index'
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

  it('combos hold every hand once, weakest to strongest, at the m3-game.md bases', () => {
    expect(combos.map((c) => c.id)).toEqual([...COMBO_IDS])
    expect(combos.map((c) => c.base)).toEqual([2, 3, 4, 6, 8, 12, 50])
  })

  it('charms are the fourteen of m3-game.md section 4 with common, rare and epic rows', () => {
    expect(charms).toHaveLength(14)
    expect(new Set(charms.map((c) => c.id)).size).toBe(14)
    const byRarity = (rarity: string) => charms.filter((c) => c.rarity === rarity).length
    expect(byRarity('common')).toBe(5)
    expect(byRarity('rare')).toBe(5)
    expect(byRarity('epic')).toBe(4)
    const effects = charms.map((c) => `${c.effect.target} ${c.effect.op} ${c.effect.value}`)
    expect(effects).toEqual(
      expect.arrayContaining([
        'points mul 1.25',
        'points mul 1.5',
        'points mul 2',
        'die:die_1 mul 3',
        'die:die_5 mul 6',
        'combo mul 1.25',
        'autoroll mul 0.85',
        'autoroll mul 0.7',
        'face_cap add 2',
        'draft_growth add -0.05',
      ]),
    )
    for (const charm of charms) {
      if (charm.effect.target.startsWith('die:')) expect(dice.some((d) => `die:${d.id}` === charm.effect.target)).toBe(true)
    }
  })

  it('trophies are the fourteen of m3-game.md section 6', () => {
    expect(trophies).toHaveLength(14)
    expect(new Set(trophies.map((t) => t.id)).size).toBe(14)
    const kinds = trophies.map((t) => t.condition.kind)
    expect(kinds.filter((k) => k === 'rolls')).toHaveLength(4)
    expect(kinds.filter((k) => k === 'dieOwned')).toHaveLength(4)
    expect(kinds.filter((k) => k === 'totalEarned')).toHaveLength(2)
    expect(kinds).toEqual(expect.arrayContaining(['ascensions', 'charms', 'prestiges', 'hand']))
  })

  it('rules carry the M3 numbers from the brief', () => {
    const { ascension, combo, face, draft, luck, trophy } = content.rules
    // costMultiplier and luck.threshold are the 2026-10-25 retunes (docs/BALANCE_LOG.md); the rest is the brief as written.
    expect(ascension).toEqual({ level: 100, multiplier: 100, costMultiplier: 300 })
    expect(combo).toEqual({ upgradeCost: 50, costGrowth: 2.35, step: 0.1 })
    expect(face).toEqual({ cap: 12, costFactor: 5, costGrowth: 1.6, unlockLevel: 10 })
    expect(draft).toEqual({ growth: 1.15, offerSize: 3, rarityWeights: { common: 6, rare: 3, epic: 1 } })
    expect(luck).toEqual({ threshold: 1e10, perPoint: 0.1 })
    expect(trophy).toEqual({ multiplier: 1.02 })
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
  /** Ids the broken table no longer declares (die_3 is renamed, die_5 is gone), which charms and trophies still point at. */
  const dangling = ['die_3', 'die_5']
  const danglingRefs =
    charms.filter((c) => dangling.some((id) => c.effect.target === `die:${id}`)).length +
    trophies.filter((t) => t.condition.kind === 'dieOwned' && dangling.includes(t.condition.id)).length

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

  it('names the charms and trophies left pointing at dice the table lost', () => {
    const message = messageOf(() => validateContent({ dice: broken }))
    expect(message).toMatch(/charms\[\d+\] "clay_cup": effect target refers to unknown id "die_3"/)
    expect(message).toMatch(/trophies\[\d+\] "fifth_die": condition refers to unknown id "die_5"/)
  })

  it('reports every problem in one error', () => {
    expect(danglingRefs).toBeGreaterThan(0)
    expect(messageOf(() => validateContent({ dice: broken }))).toMatch(new RegExp(`${3 + danglingRefs} problem\\(s\\)`))
  })

  it('rejects unknown keys, bad ids and non-objects', () => {
    const message = messageOf(() =>
      validateContent({ dice: [{ ...first, colour: 'red' }, { ...second, id: 'Die-2' }, 42] }),
    )
    expect(message).toMatch(/dice\[0\] "die_1": \(row\): Unrecognized key/)
    expect(message).toMatch(/dice\[1\] "Die-2": id: id must be lowercase snake_case/)
    expect(message).toMatch(/dice\[2\]: \(row\): /)
  })

  it('rejects a combos table missing a hand, an unknown hand id and a base of 1', () => {
    const [pair, ...rest] = combos
    if (!pair) throw new Error('setup')
    const message = messageOf(() => validateContent({ combos: [...rest, { ...pair, id: 'royal_flush' }, { ...rest[0], base: 1 }] }))
    expect(message).toMatch(/combos: hand "pair" has no row/)
    expect(message).toMatch(/combos\[6\] "royal_flush": id: /)
    expect(message).toMatch(/combos\[7\] "two_pair": base: /)
    expect(message).toMatch(/duplicate id "two_pair"/)
  })

  it('rejects a charm with a bad rarity, a bad target or an unknown die, and a trophy on an unknown die or hand', () => {
    const [charm] = charms
    const [trophy] = trophies
    if (!charm || !trophy) throw new Error('setup')
    const message = messageOf(() =>
      validateContent({
        charms: [
          { ...charm, rarity: 'legendary' },
          { ...charm, id: 'odd_one', effect: { target: 'luck', op: 'mul', value: 2 } },
          { ...charm, id: 'ghost_cup', effect: { target: 'die:die_9', op: 'mul', value: 3 } },
        ],
        trophies: [
          { ...trophy, id: 'sixth_die', condition: { kind: 'dieOwned', id: 'die_6' } },
          { ...trophy, id: 'flush', condition: { kind: 'hand', combo: 'flush' } },
        ],
      }),
    )
    expect(message).toMatch(/charms\[0\] "worn_felt": rarity: /)
    expect(message).toMatch(/charms\[1\] "odd_one": effect\.target: /)
    expect(message).toMatch(/charms\[2\] "ghost_cup": effect target refers to unknown id "die_9"/)
    expect(message).toMatch(/trophies\[0\] "sixth_die": condition refers to unknown id "die_6"/)
    expect(message).toMatch(/trophies\[1\] "flush": condition\.combo: /)
  })
})

describe('validateContent on broken rules', () => {
  it('names every rules field that fails the schema, with the rules prefix', () => {
    const message = messageOf(() =>
      validateContent({
        rules: {
          ...content.rules,
          autoRoll: { baseIntervalMs: 0, unlock: { kind: 'owned', id: 'ghost', count: 1 } },
          offline: { tickMs: 1.5, maxTicks: 100000, capMs: 1 },
          ascension: { level: 0, multiplier: 1 },
        },
      }),
    )
    expect(message).toMatch(/Content validation failed/)
    expect(message).toMatch(/rules: autoRoll\.baseIntervalMs: /)
    expect(message).toMatch(/rules: offline\.tickMs: /)
    expect(message).toMatch(/rules: ascension\.level: /)
    expect(message).toMatch(/rules: ascension\.multiplier: /)
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
