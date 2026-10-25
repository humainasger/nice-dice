// dieDef looks up content rows by id; rules is the content rules object.
import { describe, expect, it } from 'vitest'
import { content } from '@/content'
import { dieDef, rules } from './defs'

describe('dieDef', () => {
  it('returns the content row for every die id', () => {
    for (const def of content.dice) expect(dieDef(def.id)).toBe(def)
  })

  it('throws on an unknown id', () => {
    expect(() => dieDef('ghost')).toThrow(/Unknown die id "ghost"/)
  })
})

describe('rules', () => {
  it('is the content rules table', () => {
    expect(rules).toBe(content.rules)
    expect(rules.autoRoll.baseIntervalMs).toBe(5000)
    expect(rules.autoRoll.unlock).toEqual({ kind: 'owned', id: 'die_1', count: 2 })
    expect(rules.offline).toEqual({ tickMs: 100, maxTicks: 100000, capMs: 8 * 60 * 60 * 1000 })
  })
})
