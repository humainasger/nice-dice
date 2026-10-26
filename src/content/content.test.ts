// Content validation tests: the shipped tables pass, the M3 tables and rules match the brief, and a
// broken table is rejected with messages that name the offending rows and ids.
import { describe, expect, it } from 'vitest'
import { charms, COMBO_IDS, combos, content, dice, LUCK_UPGRADE_IDS, luckUpgrades, trophies, validateContent } from './index'
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

  it('dice carry the m5-theme.md material names, softest first', () => {
    expect(dice.map((d) => d.name)).toEqual(['Pine Die', 'Oak Die', 'Bone Die', 'Brass Die', 'Obsidian Die'])
    expect(dice.every((d) => typeof d.notes === 'string' && d.notes.length > 0)).toBe(true)
  })

  it('trophies read as the dicewright marks of m5-theme.md, with no casino or tavern copy anywhere in the tables', () => {
    expect(trophies.map((t) => t.name)).toEqual([
      'First Throw',
      'Warm Hands',
      'Journeyman',
      'Groove in the Bench',
      'Oak Shavings',
      'Bone Dust',
      'Brass Filings',
      'The Whole Set',
      'First Refinement',
      'Hung by the Lamp',
      'Pressed Your Luck',
      'Five Alike',
      'Earned Your Keep',
      'Set for Life',
    ])
    const copy = [
      ...trophies.flatMap((t) => [t.name, t.description]),
      ...charms.flatMap((c) => [c.name, c.flavour]),
      ...luckUpgrades.flatMap((u) => [u.name, u.description]),
    ].join(' ')
    expect(copy).not.toMatch(/casino|tavern|gambl|\btable\b|ascen/i)
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
        'die:die_1 mul 2',
        'die:die_3 mul 2',
        'die:die_4 mul 4',
        'die:die_5 mul 4',
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

  it('luck upgrades are the seven of m4-luck.md section 2, each id once, with the caps, costs and effects of the brief', () => {
    expect(luckUpgrades.map((u) => u.id)).toEqual([...LUCK_UPGRADE_IDS])
    expect(luckUpgrades.every((u) => u.effect.kind === u.id)).toBe(true)
    const byId = Object.fromEntries(luckUpgrades.map((u) => [u.id, u]))
    expect(byId['head_start']).toMatchObject({ maxLevel: 5, baseCost: 2, costGrowth: 1.6, effect: { kind: 'head_start', value: 10 } })
    expect(byId['quick_hands']).toMatchObject({ maxLevel: 8, baseCost: 1, costGrowth: 1.5, effect: { kind: 'quick_hands', value: 0.92 } })
    expect(byId['deep_pockets']).toMatchObject({ maxLevel: 10, baseCost: 1, costGrowth: 1.4, effect: { kind: 'deep_pockets', value: 1.2 } })
    expect(byId['keen_eye']).toMatchObject({ maxLevel: 5, baseCost: 2, costGrowth: 1.6, effect: { kind: 'keen_eye', value: 0.15 } })
    expect(byId['lucky_draw']).toMatchObject({ maxLevel: 2, baseCost: 4, costGrowth: 2, effect: { kind: 'lucky_draw', value: 1 } })
    expect(byId['memory']).toMatchObject({ maxLevel: 3, baseCost: 5, costGrowth: 2, effect: { kind: 'memory', value: 1 } })
    expect(byId['steady_hands']).toMatchObject({ maxLevel: 1, baseCost: 3, effect: { kind: 'steady_hands', value: 1 } })
  })

  it('rules carry the M3, M4 and M5 numbers from the briefs and the balance log', () => {
    const { ascension, combo, face, draft, luck, mastery, favour, trophy } = content.rules
    // luck.threshold is the 2026-10-25 retune; draft.growth (1.15 to 1.3) and ascension.costMultiplier
    // (300 to 400) are the 2026-10-26 M4 retune (docs/BALANCE_LOG.md); mastery and favour are the
    // m5-theme.md sections 1 and 2 luck sinks as written; the rest is the briefs as written.
    expect(ascension).toEqual({ level: 100, multiplier: 100, costMultiplier: 400 })
    expect(combo).toEqual({ upgradeCost: 50, costGrowth: 2.35, step: 0.1 })
    expect(face).toEqual({ cap: 12, costFactor: 5, costGrowth: 1.6, unlockLevel: 10 })
    expect(draft).toEqual({ growth: 1.3, offerSize: 3, rarityWeights: { common: 6, rare: 3, epic: 1 } })
    expect(luck).toEqual({ threshold: 1e10, perPoint: 0.1, perDecade: 10, autoLevelEveryMs: 1000 })
    expect(mastery).toEqual({ baseCost: 2, costGrowth: 1.35, step: 0.1 })
    expect(favour).toEqual({ costGrowth: 1.5, step: 0.05 })
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

  it('rejects a luck upgrades table missing an upgrade, an unknown id, a zero cap and a growth below 1', () => {
    const [first, ...rest] = luckUpgrades
    if (!first) throw new Error('setup')
    const message = messageOf(() =>
      validateContent({ luckUpgrades: [...rest, { ...first, id: 'rabbit_foot' }, { ...rest[0], maxLevel: 0, costGrowth: 0.9 }] }),
    )
    expect(message).toMatch(/luckUpgrades: upgrade "head_start" has no row/)
    expect(message).toMatch(/luckUpgrades\[6\] "rabbit_foot": id: /)
    expect(message).toMatch(/luckUpgrades\[7\] "quick_hands": maxLevel: /)
    expect(message).toMatch(/luckUpgrades\[7\] "quick_hands": costGrowth: /)
    expect(message).toMatch(/duplicate id "quick_hands"/)
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
