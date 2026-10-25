// The content lookups: dieDef, comboDef, charmDef and trophyDef return their rows by id and throw
// on unknown ids; the id predicates agree with them; combosByStrength is the table ordered by base;
// rules is the content rules object.
import { describe, expect, it } from 'vitest'
import { content } from '@/content'
import { charmDef, comboDef, combosByStrength, dieDef, isCharmId, isComboId, isTrophyId, rules, trophyDef } from './defs'

describe('defs', () => {
  it('return the content row for every id', () => {
    for (const def of content.dice) expect(dieDef(def.id)).toBe(def)
    for (const def of content.combos) expect(comboDef(def.id)).toBe(def)
    for (const def of content.charms) expect(charmDef(def.id)).toBe(def)
    for (const def of content.trophies) expect(trophyDef(def.id)).toBe(def)
  })

  it('throw on an unknown id, naming the table', () => {
    expect(() => dieDef('ghost')).toThrow(/Unknown die id "ghost"/)
    expect(() => comboDef('ghost' as 'pair')).toThrow(/Unknown combo id "ghost"/)
    expect(() => charmDef('ghost')).toThrow(/Unknown charm id "ghost"/)
    expect(() => trophyDef('ghost')).toThrow(/Unknown trophy id "ghost"/)
  })

  it('id predicates agree with the tables', () => {
    expect(isComboId('pair')).toBe(true)
    expect(isComboId('die_1')).toBe(false)
    expect(isCharmId('worn_felt')).toBe(true)
    expect(isCharmId('pair')).toBe(false)
    expect(isTrophyId('first_roll')).toBe(true)
    expect(isTrophyId('worn_felt')).toBe(false)
  })

  it('combosByStrength is every hand, strongest first', () => {
    expect(combosByStrength.map((def) => def.id).sort()).toEqual(content.combos.map((def) => def.id).sort())
    for (let i = 1; i < combosByStrength.length; i++) {
      expect(combosByStrength[i - 1]?.base ?? 0).toBeGreaterThanOrEqual(combosByStrength[i]?.base ?? 0)
    }
    expect(combosByStrength[0]?.id).toBe('five_kind')
    expect(combosByStrength.at(-1)?.id).toBe('pair')
  })
})

describe('rules', () => {
  it('is the content rules table', () => {
    expect(rules).toBe(content.rules)
    expect(rules.autoRoll.baseIntervalMs).toBe(5000)
    expect(rules.autoRoll.unlock).toEqual({ kind: 'owned', id: 'die_1', count: 2 })
    expect(rules.offline).toEqual({ tickMs: 100, maxTicks: 100000, capMs: 8 * 60 * 60 * 1000, minAwayMs: 10000, foregroundCatchupMs: 60000 })
    expect(rules.ascension).toEqual({ level: 100, multiplier: 100, costMultiplier: 300 })
  })
})
