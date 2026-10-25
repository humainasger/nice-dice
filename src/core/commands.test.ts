// dispatch on every command, valid and invalid: no-ops hand back the same object, points never go
// negative, levels never exceed what the points allowed, and a command sequence is deterministic
// for its seed.
import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { content } from '@/content'
import { advance } from './advance'
import { dispatch, type Command } from './commands'
import { dieDef } from './defs'
import { bulkCost, levelCost, maxAffordable, rollPoints } from './formulas'
import { N, type Num } from './num'
import { createRng } from './rng'
import { createInitialState, serializeState } from './save'
import type { GameState } from './state'

const [die1, die2, die3] = content.dice
if (!die1 || !die2 || !die3) throw new Error('these tests need at least three content dice')
const ids = content.dice.map((def) => def.id)

const abs = (x: Num): Num => N.max(x, N.sub(0, x))
const close = (a: Num, b: Num, tol = 1e-9): boolean =>
  N.lte(abs(N.sub(a, b)), N.mul(N.max(N.max(abs(a), abs(b)), 1), tol))

/** The state with its purse set to `points` (and totalEarned raised to match). */
const withPoints = (state: GameState, points: number): GameState => ({
  ...state,
  points: N.from(points),
  totalEarned: N.add(state.totalEarned, points),
})

describe('roll', () => {
  it('rolls every owned die once with the saved RNG and records the result', () => {
    const state = createInitialState(1)
    const next = dispatch(state, { type: 'roll' })
    expect(next).not.toBe(state)
    expect(next.rolls).toBe(1)
    const rng = createRng(1)
    const face = rng.rollDie(6)
    expect(next.lastRoll?.faces).toEqual([face])
    expect(next.rng).toEqual(rng.getState())
    expect(next.lastRoll?.at).toBe(0)
    const gained = rollPoints(state, [face])
    expect(N.eq(next.lastRoll?.gained ?? N.zero, gained)).toBe(true)
    expect(N.eq(next.points, gained)).toBe(true)
    expect(N.eq(next.totalEarned, gained)).toBe(true)
    // Untouched parts are shared.
    expect(next.dice).toBe(state.dice)
    expect(next.autoRoll).toBe(state.autoRoll)
  })

  it('stamps the roll with the current playMs', () => {
    const state = { ...createInitialState(1), playMs: 1234 }
    expect(dispatch(state, { type: 'roll' }).lastRoll?.at).toBe(1234)
  })

  it('does not unlock auto-roll by itself', () => {
    let state = createInitialState(2)
    for (let i = 0; i < 20; i++) state = dispatch(state, { type: 'roll' })
    expect(state.autoRoll.unlocked).toBe(false)
  })
})

describe('buyDie', () => {
  it('ignores unknown, owned, locked and unaffordable dice', () => {
    const state = withPoints(createInitialState(1), 1e9)
    expect(dispatch(state, { type: 'buyDie', id: 'ghost' })).toBe(state)
    expect(dispatch(state, { type: 'buyDie', id: die1.id })).toBe(state)
    expect(dispatch(state, { type: 'buyDie', id: die3.id })).toBe(state)
    const poor = withPoints(createInitialState(1), die2.baseCost - 1)
    expect(dispatch(poor, { type: 'buyDie', id: die2.id })).toBe(poor)
  })

  it('buys an unlocked, affordable die at baseCost into level 1', () => {
    const state = withPoints(createInitialState(1), die2.baseCost + 50)
    const next = dispatch(state, { type: 'buyDie', id: die2.id })
    expect(next).not.toBe(state)
    expect(next.dice[1]).toEqual({ id: die2.id, owned: true, level: 1 })
    expect(N.eq(next.points, 50)).toBe(true)
    expect(next.totalEarned).toBe(state.totalEarned)
    expect(next.dice[0]).toBe(state.dice[0])
    expect(next.dice[2]).toBe(state.dice[2])
  })

  it('unlocks the chain one die at a time', () => {
    let state = withPoints(createInitialState(1), 1e9)
    expect(dispatch(state, { type: 'buyDie', id: die3.id })).toBe(state)
    state = dispatch(state, { type: 'buyDie', id: die2.id })
    const next = dispatch(state, { type: 'buyDie', id: die3.id })
    expect(next.dice[2]?.owned).toBe(true)
    expect(N.eq(next.points, 1e9 - die2.baseCost - die3.baseCost)).toBe(true)
  })
})

describe('levelDie', () => {
  it('ignores unknown and unowned dice and bad counts', () => {
    const state = withPoints(createInitialState(1), 1e6)
    expect(dispatch(state, { type: 'levelDie', id: 'ghost', count: 1 })).toBe(state)
    expect(dispatch(state, { type: 'levelDie', id: die2.id, count: 1 })).toBe(state)
    for (const count of [0, -3, 2.5, NaN, Infinity, 2 ** 53]) {
      expect(dispatch(state, { type: 'levelDie', id: die1.id, count }), String(count)).toBe(state)
    }
  })

  it('ignores a level it cannot pay for', () => {
    const state = withPoints(createInitialState(1), 5)
    expect(dispatch(state, { type: 'levelDie', id: die1.id, count: 1 })).toBe(state)
    expect(dispatch(state, { type: 'levelDie', id: die1.id, count: 'max' })).toBe(state)
  })

  it('buys one level at levelCost and unlocks auto-roll at level 2 of the first die', () => {
    const cost = levelCost(die1, 1)
    const state = withPoints(createInitialState(1), N.toNumber(cost) + 0.5)
    const next = dispatch(state, { type: 'levelDie', id: die1.id, count: 1 })
    expect(next.dice[0]).toEqual({ id: die1.id, owned: true, level: 2 })
    expect(close(next.points, N.from(0.5))).toBe(true)
    expect(N.gte(next.points, 0)).toBe(true)
    expect(next.autoRoll).toEqual({ ...state.autoRoll, unlocked: true, enabled: true })
    expect(next.dice[1]).toBe(state.dice[1])
  })

  it('buys exactly count levels when affordable', () => {
    const state = withPoints(createInitialState(1), 1e6)
    const next = dispatch(state, { type: 'levelDie', id: die1.id, count: 3 })
    expect(next.dice[0]?.level).toBe(4)
    expect(N.eq(next.points, N.sub(state.points, bulkCost(die1, 1, 3)))).toBe(true)
  })

  it('caps count at what is affordable, and max buys all of it', () => {
    const state = withPoints(createInitialState(1), 500)
    const affordable = maxAffordable(die1, 1, state.points)
    expect(affordable).toBeGreaterThan(1)
    const capped = dispatch(state, { type: 'levelDie', id: die1.id, count: affordable + 50 })
    expect(capped.dice[0]?.level).toBe(1 + affordable)
    const max = dispatch(state, { type: 'levelDie', id: die1.id, count: 'max' })
    expect(max.dice[0]?.level).toBe(1 + affordable)
    expect(maxAffordable(die1, 1 + affordable, max.points)).toBe(0)
    expect(N.gte(max.points, 0)).toBe(true)
  })

  it('never exceeds what the points allowed and never overdraws', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1e9, noNaN: true }),
        fc.integer({ min: 1, max: 200 }),
        fc.oneof(fc.integer({ min: 1, max: 500 }), fc.constant<'max'>('max')),
        (purse, startLevel, count) => {
          const base = createInitialState(1)
          const state: GameState = {
            ...withPoints(base, purse),
            dice: base.dice.map((die, i) => (i === 0 ? { ...die, level: startLevel } : die)),
          }
          const allowed = maxAffordable(die1, startLevel, state.points)
          const next = dispatch(state, { type: 'levelDie', id: die1.id, count })
          const added = (next.dice[0]?.level ?? 0) - startLevel
          const wanted = count === 'max' ? allowed : Math.min(count, allowed)
          if (added !== wanted) return false
          if (added === 0) return next === state
          return N.gte(next.points, 0) && N.eq(next.points, N.sub(state.points, bulkCost(die1, startLevel, added)))
        },
      ),
      { numRuns: 1000 },
    )
  })
})

describe('setAutoRoll', () => {
  const unlocked = dispatch(withPoints(createInitialState(1), 1e6), { type: 'levelDie', id: die1.id, count: 1 })

  it('is ignored while locked', () => {
    const state = createInitialState(1)
    expect(dispatch(state, { type: 'setAutoRoll', enabled: true })).toBe(state)
    expect(dispatch(state, { type: 'setAutoRoll', enabled: false })).toBe(state)
  })

  it('toggles once unlocked and is a no-op for the current value', () => {
    expect(unlocked.autoRoll.enabled).toBe(true)
    expect(dispatch(unlocked, { type: 'setAutoRoll', enabled: true })).toBe(unlocked)
    const off = dispatch(unlocked, { type: 'setAutoRoll', enabled: false })
    expect(off.autoRoll).toEqual({ ...unlocked.autoRoll, enabled: false })
    expect(off.dice).toBe(unlocked.dice)
    expect(dispatch(off, { type: 'setAutoRoll', enabled: true }).autoRoll.enabled).toBe(true)
  })

  it('ignores a non-boolean built from untyped data', () => {
    const command = { type: 'setAutoRoll', enabled: 'yes' } as unknown as Command
    expect(dispatch(unlocked, command)).toBe(unlocked)
  })
})

describe('reset', () => {
  it('starts a new game from the seed', () => {
    let state = createInitialState(1)
    for (let i = 0; i < 5; i++) state = dispatch(state, { type: 'roll' })
    const fresh = dispatch(state, { type: 'reset', seed: 7 })
    expect(serializeState(fresh)).toBe(serializeState(createInitialState(7)))
  })

  it('ignores a non-finite seed', () => {
    const state = createInitialState(1)
    expect(dispatch(state, { type: 'reset', seed: NaN })).toBe(state)
    expect(dispatch(state, { type: 'reset', seed: Infinity })).toBe(state)
  })
})

describe('dispatch', () => {
  it('ignores an unknown command type', () => {
    const state = createInitialState(1)
    expect(dispatch(state, { type: 'nope' } as unknown as Command)).toBe(state)
  })

  type Step = { kind: 'command'; command: Command } | { kind: 'advance'; dtMs: number }
  const command: fc.Arbitrary<Command> = fc.oneof(
    fc.constant<Command>({ type: 'roll' }),
    fc.constantFrom(...ids).map((id): Command => ({ type: 'buyDie', id })),
    fc
      .tuple(fc.constantFrom(...ids), fc.oneof(fc.integer({ min: -2, max: 20 }), fc.constant<'max'>('max')))
      .map(([id, count]): Command => ({ type: 'levelDie', id, count })),
    fc.boolean().map((enabled): Command => ({ type: 'setAutoRoll', enabled })),
  )
  const step: fc.Arbitrary<Step> = fc.oneof(
    command.map((c): Step => ({ kind: 'command', command: c })),
    fc.integer({ min: 0, max: 20000 }).map((dtMs): Step => ({ kind: 'advance', dtMs })),
  )

  const invariants = (state: GameState): boolean =>
    N.gte(state.points, 0) &&
    N.gte(state.totalEarned, state.points) &&
    state.dice.length === content.dice.length &&
    state.dice[0]?.owned === true &&
    state.dice.every((die) => (die.owned ? die.level >= 1 : die.level === 0)) &&
    (!state.autoRoll.enabled || state.autoRoll.unlocked) &&
    state.autoRoll.elapsedMs >= 0 &&
    state.autoRoll.elapsedMs < state.autoRoll.intervalMs

  const run = (seed: number, steps: readonly Step[]): GameState => {
    let state = createInitialState(seed)
    for (const s of steps) {
      const before = state
      state = s.kind === 'command' ? dispatch(state, s.command) : advance(state, s.dtMs)
      if (!invariants(state)) throw new Error(`invariant broken after ${JSON.stringify(s)}`)
      if (s.kind === 'command' && s.command.type === 'levelDie') {
        const id = s.command.id
        const slot = before.dice.find((die) => die.id === id)
        const after = state.dice.find((die) => die.id === id)
        if (slot && after && slot.owned) {
          const allowed = maxAffordable(dieDef(slot.id), slot.level, before.points)
          if (after.level - slot.level > allowed) throw new Error('levelled beyond the purse')
        }
      }
    }
    return state
  }

  it('keeps the invariants over any command sequence and is deterministic for a seed', () => {
    fc.assert(
      fc.property(fc.integer(), fc.array(step, { maxLength: 60 }), (seed, steps) => {
        const once = run(seed, steps)
        const twice = run(seed, steps)
        return serializeState(once) === serializeState(twice)
      }),
      { numRuns: 300 },
    )
  })
})
