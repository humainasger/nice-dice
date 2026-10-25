// Tests for the seeded RNG: determinism, save and restore, and bounds of nextInt and rollDie.
import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { createRng, restoreRng, type Rng } from './rng'

const seed = fc.integer()
const draw = (rng: Rng, count: number): number[] => Array.from({ length: count }, () => rng.next())
const roll = (rng: Rng, count: number, sides: number): number[] =>
  Array.from({ length: count }, () => rng.rollDie(sides))

describe('createRng', () => {
  it('gives the same sequence for the same seed', () => {
    fc.assert(
      fc.property(seed, (s) => {
        expect(draw(createRng(s), 50)).toEqual(draw(createRng(s), 50))
        expect(roll(createRng(s), 50, 6)).toEqual(roll(createRng(s), 50, 6))
      }),
    )
  })

  it('gives different sequences for different seeds', () => {
    expect(draw(createRng(1), 10)).not.toEqual(draw(createRng(2), 10))
  })

  it('next() stays in [0, 1)', () => {
    fc.assert(
      fc.property(seed, (s) => {
        const rng = createRng(s)
        for (let i = 0; i < 1000; i++) {
          const value = rng.next()
          if (value < 0 || value >= 1) return false
        }
        return true
      }),
    )
  })

  it('rejects a non-finite seed', () => {
    expect(() => createRng(NaN)).toThrow()
    expect(() => createRng(Infinity)).toThrow()
  })
})

describe('restoreRng', () => {
  it('continues identically from getState()', () => {
    fc.assert(
      fc.property(seed, fc.integer({ min: 0, max: 200 }), (s, skip) => {
        const original = createRng(s)
        for (let i = 0; i < skip; i++) original.rollDie(6)
        const restored = restoreRng(original.getState())
        expect(draw(restored, 20)).toEqual(draw(original, 20))
        expect(roll(restored, 20, 20)).toEqual(roll(original, 20, 20))
      }),
    )
  })

  it('getState returns a copy', () => {
    const rng = createRng(1)
    const snapshot = [...rng.getState()]
    const handed = rng.getState() as number[]
    handed[0] = 123
    expect(rng.getState()).toEqual(snapshot)
  })

  it('state survives a JSON round trip', () => {
    const original = createRng(99)
    original.next()
    const restored = restoreRng(JSON.parse(JSON.stringify(original.getState())) as number[])
    expect(draw(restored, 5)).toEqual(draw(original, 5))
  })

  it('rejects malformed states', () => {
    const bad: number[][] = [[], [1, 2, 3], [0, 0, 0, 0], [1.5, 2, 3, 4], [2 ** 40, 0, 0, 1], [1, 2, 3, 4, 5]]
    for (const state of bad) expect(() => restoreRng(state), JSON.stringify(state)).toThrow()
  })
})

describe('rollDie and nextInt', () => {
  it('rollDie(6) stays within 1..6 over 10000 rolls', () => {
    fc.assert(
      fc.property(seed, (s) => {
        const rng = createRng(s)
        for (let i = 0; i < 10000; i++) {
          const face = rng.rollDie(6)
          if (!Number.isInteger(face) || face < 1 || face > 6) return false
        }
        return true
      }),
    )
  })

  it('rollDie(sides) stays within 1..sides over 10000 rolls', () => {
    fc.assert(
      fc.property(seed, fc.integer({ min: 1, max: 100 }), (s, sides) => {
        const rng = createRng(s)
        for (let i = 0; i < 10000; i++) {
          const face = rng.rollDie(sides)
          if (!Number.isInteger(face) || face < 1 || face > sides) return false
        }
        return true
      }),
    )
  })

  it('rollDie(6) reaches every face', () => {
    const rng = createRng(7)
    const seen = new Set(roll(rng, 1000, 6))
    expect([...seen].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('nextInt is inclusive at both ends', () => {
    const rng = createRng(3)
    const seen = new Set(Array.from({ length: 500 }, () => rng.nextInt(-2, 2)))
    expect([...seen].sort((a, b) => a - b)).toEqual([-2, -1, 0, 1, 2])
    expect(rng.nextInt(4, 4)).toBe(4)
  })

  it('rejects bad bounds', () => {
    const rng = createRng(1)
    expect(() => rng.nextInt(5, 1)).toThrow()
    expect(() => rng.nextInt(1.5, 3)).toThrow()
    expect(() => rng.rollDie(0)).toThrow()
    expect(() => rng.rollDie(2.5)).toThrow()
  })
})
