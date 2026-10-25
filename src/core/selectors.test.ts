// Selectors: dieView fields for owned, unowned, locked and affordable dice, nextUnlock through the
// chain, and the expected income helpers.
import { describe, expect, it } from 'vitest'
import { content } from '@/content'
import { dispatch } from './commands'
import { expectedPointsPerRoll, levelCost, maxAffordable } from './formulas'
import { N } from './num'
import { createInitialState } from './save'
import { dieView, expectedPointsPerSecond, nextUnlock, pointsPerRollExpected } from './selectors'
import type { GameState } from './state'

const [die1, die2, die3] = content.dice
if (!die1 || !die2 || !die3) throw new Error('these tests need at least three content dice')

const withPoints = (state: GameState, points: number): GameState => ({
  ...state,
  points: N.from(points),
  totalEarned: N.add(state.totalEarned, points),
})

describe('dieView', () => {
  it('describes the owned first die', () => {
    const state = createInitialState(1)
    const view = dieView(state, die1.id)
    expect(view.def).toBe(die1)
    expect(view.owned).toBe(true)
    expect(view.level).toBe(1)
    expect(N.eq(view.multiplier, die1.baseMultiplier)).toBe(true)
    expect(N.eq(view.nextCost, levelCost(die1, 1))).toBe(true)
    expect(view.affordable).toBe(false)
    expect(view.maxAffordable).toBe(0)
    expect(view.unlocked).toBe(true)
    expect(view.canBuy).toBe(false)
  })

  it('describes an unowned die: baseCost next, zero multiplier, buyable once unlocked and affordable', () => {
    const poor = createInitialState(1)
    const second = dieView(poor, die2.id)
    expect(second.owned).toBe(false)
    expect(second.level).toBe(0)
    expect(N.isZero(second.multiplier)).toBe(true)
    expect(N.eq(second.nextCost, die2.baseCost)).toBe(true)
    expect(second.unlocked).toBe(true)
    expect(second.affordable).toBe(false)
    expect(second.canBuy).toBe(false)
    expect(second.maxAffordable).toBe(0)

    const rich = withPoints(poor, 1e6)
    expect(dieView(rich, die2.id).canBuy).toBe(true)
    const third = dieView(rich, die3.id)
    expect(third.unlocked).toBe(false)
    expect(third.affordable).toBe(true)
    expect(third.canBuy).toBe(false)
  })

  it('reports how many levels the purse buys', () => {
    const state = withPoints(createInitialState(1), 500)
    const view = dieView(state, die1.id)
    expect(view.affordable).toBe(true)
    expect(view.maxAffordable).toBe(maxAffordable(die1, 1, state.points))
    expect(view.maxAffordable).toBeGreaterThan(1)
  })

  it('throws on an id that is not in content', () => {
    expect(() => dieView(createInitialState(1), 'ghost')).toThrow(/Unknown die id/)
  })

  it('agrees with dispatch at the exact cost: affordable means one level buys and charges nextCost', () => {
    // The UI promises what the core delivers: with points equal to nextCost the level is bought and
    // the purse lands on zero; a hair less and neither side says yes.
    const base = createInitialState(1)
    for (const def of content.dice) {
      for (let level = 1; level <= 200; level++) {
        const owned: GameState = {
          ...base,
          dice: base.dice.map((die) => (die.id === def.id ? { ...die, owned: true, level } : die)),
        }
        const cost = levelCost(def, level)
        const exact: GameState = { ...owned, points: cost, totalEarned: cost }
        const view = dieView(exact, def.id)
        expect(view.affordable, `${def.id} level ${level}`).toBe(true)
        expect(view.maxAffordable, `${def.id} level ${level}`).toBeGreaterThanOrEqual(1)
        const bought = dispatch(exact, { type: 'levelDie', id: def.id, count: 1 })
        expect(bought, `${def.id} level ${level}`).not.toBe(exact)
        expect(N.isZero(bought.points), `${def.id} level ${level}: ${N.serialize(bought.points)} left`).toBe(true)
        const short: GameState = { ...exact, points: N.sub(cost, N.mul(cost, 1e-12)) }
        expect(dieView(short, def.id).affordable, `${def.id} level ${level}`).toBe(false)
        expect(dispatch(short, { type: 'levelDie', id: def.id, count: 1 }), `${def.id} level ${level}`).toBe(short)
      }
    }
  })
})

describe('nextUnlock', () => {
  it('walks the chain and ends with null', () => {
    let state = withPoints(createInitialState(1), 1e9)
    expect(nextUnlock(state)).toEqual({ def: die2, unlock: die2.unlock, satisfied: true })
    state = dispatch(state, { type: 'buyDie', id: die2.id })
    expect(nextUnlock(state)).toEqual({ def: die3, unlock: die3.unlock, satisfied: true })
    for (const def of content.dice.slice(2)) state = dispatch(state, { type: 'buyDie', id: def.id })
    expect(state.dice.every((die) => die.owned)).toBe(true)
    expect(nextUnlock(state)).toBeNull()
  })

  it('says when the next die is still locked', () => {
    const state = createInitialState(1)
    // Skip die_2 by hand: die_3 is next and its condition (die_2 owned) does not hold.
    const skipped: GameState = {
      ...state,
      dice: state.dice.map((die, i) => (i === 2 ? { ...die, owned: true, level: 1 } : die)),
    }
    const next = nextUnlock(skipped)
    expect(next?.def).toBe(die2)
    expect(next?.satisfied).toBe(true)
    const fourth = content.dice[3]
    if (!fourth) throw new Error('setup')
    const skippedTwice: GameState = {
      ...state,
      dice: state.dice.map((die, i) => (i === 1 ? { ...die, owned: true, level: 1 } : die)),
    }
    expect(nextUnlock(skippedTwice)).toEqual({ def: die3, unlock: die3.unlock, satisfied: true })
    expect(dieView(skippedTwice, fourth.id).unlocked).toBe(false)
    expect(dieView(state, die3.id).unlocked).toBe(false)
  })
})

describe('income helpers', () => {
  it('pointsPerRollExpected is the formula', () => {
    const state = createInitialState(1)
    expect(N.eq(pointsPerRollExpected(state), expectedPointsPerRoll(state))).toBe(true)
    expect(N.eq(pointsPerRollExpected(state), 3.5)).toBe(true)
  })

  it('expectedPointsPerSecond is zero while locked or off, else per-roll mean over the interval', () => {
    const locked = createInitialState(1)
    expect(N.isZero(expectedPointsPerSecond(locked))).toBe(true)
    const unlocked = dispatch(withPoints(locked, 1e6), { type: 'levelDie', id: die1.id, count: 1 })
    const perRoll = expectedPointsPerRoll(unlocked)
    const perSecond = N.div(N.mul(perRoll, 1000), unlocked.autoRoll.intervalMs)
    expect(N.eq(expectedPointsPerSecond(unlocked), perSecond)).toBe(true)
    const off = dispatch(unlocked, { type: 'setAutoRoll', enabled: false })
    expect(N.isZero(expectedPointsPerSecond(off))).toBe(true)
  })
})
