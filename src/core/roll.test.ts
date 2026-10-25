// performRoll and unlockAutoRoll: faces per owned die in content order, the RNG advanced exactly
// once per owned die, the roll stamped at the given time with its best hand, the stats updated,
// and the unlock check.
import { describe, expect, it } from 'vitest'
import { content } from '@/content'
import { comboMultiplier } from './formulas'
import { bestHand } from './hands'
import { N } from './num'
import { createRng } from './rng'
import { performRoll, unlockAutoRoll } from './roll'
import { createInitialState } from './save'
import type { GameState } from './state'

const withLevels = (state: GameState, levels: readonly number[]): GameState => ({
  ...state,
  dice: state.dice.map((die, i) => {
    const lvl = levels[i] ?? 0
    return lvl > 0 ? { ...die, owned: true, level: lvl } : { ...die, owned: false, level: 0 }
  }),
})

describe('performRoll', () => {
  it('draws one side per owned die in content order, saves the RNG back and records the hand', () => {
    const state = withLevels(createInitialState(5), [2, 0, 3])
    const next = performRoll(state, 777)
    const rng = createRng(5)
    const faces = [rng.rollDie(6), rng.rollDie(6)]
    const hand = bestHand(faces)
    expect(next.lastRoll).toEqual({ faces, gained: next.lastRoll?.gained, at: 777, hand })
    expect(next.rng).toEqual(rng.getState())
    expect(next.rolls).toBe(1)
    const [die1, die3] = [content.dice[0], content.dice[2]]
    if (!die1 || !die3 || faces[0] === undefined || faces[1] === undefined) throw new Error('setup')
    let expected = N.from(faces[0] * die1.baseMultiplier * 2 + faces[1] * die3.baseMultiplier * 3)
    if (hand !== null) expected = N.mul(expected, comboMultiplier(state, hand))
    expect(N.eq(next.lastRoll?.gained ?? N.zero, expected)).toBe(true)
    expect(N.eq(next.points, expected)).toBe(true)
    expect(N.eq(next.totalEarned, expected)).toBe(true)
    expect(N.eq(next.totalEarnedRun, expected)).toBe(true)
    expect(N.eq(next.stats.bestRoll, expected)).toBe(true)
    expect(next.stats.hands).toEqual(hand === null ? {} : { [hand]: 1 })
    expect(next.dice).toBe(state.dice)
    // Trophies are the caller's job (dispatch and advance), not performRoll's.
    expect(next.trophies).toBe(state.trophies)
  })

  it('reads the printed faces and keeps the best roll', () => {
    const base = createInitialState(5)
    const edited: GameState = {
      ...base,
      dice: base.dice.map((die, i) => (i === 0 ? { ...die, faces: [10, 10, 10, 10, 10, 10], faceUpgrades: 39 } : die)),
      stats: { ...base.stats, bestRoll: N.from(1000) },
    }
    const next = performRoll(edited, 0)
    expect(N.eq(next.lastRoll?.gained ?? N.zero, 10)).toBe(true)
    expect(N.eq(next.stats.bestRoll, 1000)).toBe(true)
  })

  it('does not change the input state', () => {
    const state = createInitialState(1)
    const snapshot = JSON.stringify({ ...state, rng: [...state.rng] })
    performRoll(state, 0)
    expect(JSON.stringify({ ...state, rng: [...state.rng] })).toBe(snapshot)
  })
})

describe('unlockAutoRoll', () => {
  it('returns the same object while the rule does not hold or is already unlocked', () => {
    const locked = createInitialState(1)
    expect(unlockAutoRoll(locked)).toBe(locked)
    const unlocked = unlockAutoRoll(withLevels(locked, [2]))
    expect(unlockAutoRoll(unlocked)).toBe(unlocked)
  })

  it('unlocks and switches auto-roll on once the first die reaches level 2', () => {
    const state = withLevels(createInitialState(1), [2])
    const next = unlockAutoRoll(state)
    expect(next.autoRoll).toEqual({ ...state.autoRoll, unlocked: true, enabled: true })
    expect(next.autoRoll.intervalMs).toBe(content.rules.autoRoll.baseIntervalMs)
    expect(next.dice).toBe(state.dice)
  })
})
