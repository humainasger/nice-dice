// advance and applyOffline: deterministic for a seed, one roll per full interval, nothing while
// locked or disabled, the same object when nothing changes, the auto-ascend sweep, trophies after
// rolls, ticks up to the cap then the expected-value remainder, negative time clamped to nothing.
import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { content } from '@/content'
import { advance, applyOffline } from './advance'
import { dispatch } from './commands'
import { expectedPointsPerRoll } from './formulas'
import { N, type Num } from './num'
import { createInitialState, parseSave, serializeState } from './save'
import type { GameState } from './state'

const die1 = content.dice[0]
if (!die1) throw new Error('these tests need a content die')
const INTERVAL = content.rules.autoRoll.baseIntervalMs
const CAP = content.rules.ascension.level

const abs = (x: Num): Num => N.max(x, N.sub(0, x))
/** |a - b| <= share * |b| */
const within = (a: Num, b: Num, share: number): boolean => N.lte(abs(N.sub(a, b)), N.mul(abs(b), share))

/** Auto-roll unlocked and on, by levelling the first die to 2 with a fat purse. */
const unlocked = (seed: number, purse = 1e6): GameState => {
  const base = createInitialState(seed)
  const rich = { ...base, points: N.from(purse), totalEarned: N.from(purse), totalEarnedRun: N.from(purse) }
  const state = dispatch(rich, { type: 'levelDie', id: die1.id, count: 1 })
  if (!state.autoRoll.unlocked || !state.autoRoll.enabled) throw new Error('setup: auto-roll should be unlocked')
  return state
}

const tick = (state: GameState, times: number, dtMs = 100): GameState => {
  let next = state
  for (let i = 0; i < times; i++) next = advance(next, dtMs)
  return next
}

describe('advance', () => {
  it('returns the same object for a non-positive or non-finite dt', () => {
    const state = unlocked(1)
    for (const dt of [0, -100, NaN, Infinity, -Infinity]) expect(advance(state, dt), String(dt)).toBe(state)
  })

  it('only moves playMs while auto-roll is locked', () => {
    const state = createInitialState(1)
    const next = tick(state, 100)
    expect(next.playMs).toBe(10000)
    expect(next.rolls).toBe(0)
    expect(next.lastRoll).toBeNull()
    expect(next.autoRoll).toBe(state.autoRoll)
    expect(next.rng).toBe(state.rng)
    expect(next.dice).toBe(state.dice)
    expect(next.trophies).toBe(state.trophies)
  })

  it('does not roll while auto-roll is switched off', () => {
    const state = dispatch(unlocked(1), { type: 'setAutoRoll', enabled: false })
    const next = tick(state, 200)
    expect(next.playMs).toBe(20000)
    expect(next.rolls).toBe(state.rolls)
    expect(next.autoRoll).toBe(state.autoRoll)
  })

  it('rolls once per full interval at 100 ms ticks and awards roll trophies', () => {
    const state = unlocked(1)
    const almost = tick(state, INTERVAL / 100 - 1)
    expect(almost.rolls).toBe(0)
    expect(almost.autoRoll.elapsedMs).toBe(INTERVAL - 100)
    const first = advance(almost, 100)
    expect(first.rolls).toBe(1)
    expect(first.autoRoll.elapsedMs).toBe(0)
    expect(first.lastRoll?.at).toBe(INTERVAL)
    expect(first.lastRoll?.faces).toHaveLength(1)
    expect(first.trophies).toContain('first_roll')
    expect(N.gt(first.points, state.points)).toBe(true)
    expect(N.eq(N.sub(first.points, state.points), first.lastRoll?.gained ?? N.zero)).toBe(true)
    const minute = tick(state, 600)
    expect(minute.rolls).toBe(60000 / INTERVAL)
    expect(minute.playMs).toBe(60000)
  })

  it('catches up several intervals in one call and stamps each roll on its boundary', () => {
    const state = unlocked(1)
    const next = advance(state, 3 * INTERVAL + 10)
    expect(next.rolls).toBe(3)
    expect(next.autoRoll.elapsedMs).toBe(10)
    expect(next.lastRoll?.at).toBe(3 * INTERVAL)
    expect(next.playMs).toBe(3 * INTERVAL + 10)
  })

  it('carries a partial interval across calls', () => {
    const state = unlocked(1)
    const a = advance(state, INTERVAL - 1)
    expect(a.rolls).toBe(0)
    const b = advance(a, 2)
    expect(b.rolls).toBe(1)
    expect(b.lastRoll?.at).toBe(INTERVAL)
    expect(b.autoRoll.elapsedMs).toBe(1)
  })

  it('never stamps a roll before time zero, even for a hand-built backlog', () => {
    // parseSave refuses elapsedMs >= intervalMs; this guards the state built in memory.
    const state = unlocked(1)
    const backlog: GameState = { ...state, playMs: 0, autoRoll: { ...state.autoRoll, elapsedMs: 3 * INTERVAL } }
    const next = advance(backlog, 100)
    expect(next.rolls).toBe(3)
    expect(next.lastRoll?.at).toBeGreaterThanOrEqual(0)
    expect(next.autoRoll.elapsedMs).toBe(100)
    expect(parseSave(serializeState(next)).ok).toBe(true)
  })

  it('ascends a die sitting at the cap when auto-ascend is on, even with auto-roll locked', () => {
    const base = createInitialState(1)
    const capped: GameState = { ...base, dice: base.dice.map((die, i) => (i === 0 ? { ...die, level: CAP } : die)) }
    const swept = advance(capped, 100)
    expect(swept.dice[0]).toMatchObject({ level: 1, ascensions: 1 })
    expect(swept.draft.offer).not.toBeNull()
    expect(swept.trophies).toContain('first_ascension')
    const off: GameState = { ...capped, autoAscend: false }
    const left = advance(off, 100)
    expect(left.dice).toBe(off.dice)
  })

  it('rolls exactly floor(elapsed / interval) times over any dt sequence', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 3 * INTERVAL }), { maxLength: 40 }), (dts) => {
        let state = unlocked(3)
        let total = 0
        for (const dt of dts) {
          state = advance(state, dt)
          total += dt
        }
        const rolls = Math.floor(total / INTERVAL)
        return (
          state.rolls === rolls &&
          state.playMs === total &&
          state.autoRoll.elapsedMs === total - rolls * INTERVAL &&
          (rolls === 0 || state.lastRoll?.at === rolls * INTERVAL)
        )
      }),
    )
  })

  it('is deterministic for a seed', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer({ min: 1, max: 600 }), (seed, ticks) => {
        const a = tick(unlocked(seed), ticks)
        const b = tick(unlocked(seed), ticks)
        return serializeState(a) === serializeState(b)
      }),
      { numRuns: 50 },
    )
    expect(serializeState(tick(unlocked(1), 300))).not.toBe(serializeState(tick(unlocked(2), 300)))
  })

  it('matches manual rolls draw for draw', () => {
    // Auto rolls consume the same RNG stream as manual rolls, so 12 auto rolls equal 12 manual rolls.
    const state = unlocked(9)
    const auto = tick(state, (12 * INTERVAL) / 100)
    let manual = state
    for (let i = 0; i < 12; i++) manual = dispatch(manual, { type: 'roll' })
    expect(auto.rng).toEqual(manual.rng)
    expect(N.eq(auto.points, manual.points)).toBe(true)
    expect(auto.lastRoll?.faces).toEqual(manual.lastRoll?.faces)
  })
})

describe('applyOffline', () => {
  const opts = { tickMs: 100, maxTicks: 100000 }

  it('grants nothing for negative or non-finite time and hands back the same object', () => {
    const state = unlocked(1)
    for (const elapsed of [-1, -1e9, NaN, -Infinity]) {
      const result = applyOffline(state, elapsed, opts)
      expect(result.state, String(elapsed)).toBe(state)
      expect(result.summary).toEqual({ elapsedMs: 0, simulatedMs: 0, estimatedMs: 0, rolls: 0, gained: N.zero })
    }
    expect(applyOffline(state, 0, opts).state).toBe(state)
  })

  it('only moves playMs while auto-roll is locked', () => {
    const state = createInitialState(1)
    const { state: next, summary } = applyOffline(state, 3600000, opts)
    expect(next.playMs).toBe(3600000)
    expect(next.rolls).toBe(0)
    expect(summary).toEqual({ elapsedMs: 3600000, simulatedMs: 3600000, estimatedMs: 0, rolls: 0, gained: N.zero })
    expect(N.eq(next.points, state.points)).toBe(true)
  })

  it('ticks the whole absence when it fits under maxTicks', () => {
    const state = unlocked(1)
    const elapsed = 20 * INTERVAL
    const { state: next, summary } = applyOffline(state, elapsed, opts)
    const stepped = tick(state, elapsed / 100)
    expect(serializeState(next)).toBe(serializeState(stepped))
    expect(summary.elapsedMs).toBe(elapsed)
    expect(summary.simulatedMs).toBe(elapsed)
    expect(summary.estimatedMs).toBe(0)
    expect(summary.rolls).toBe(20)
    expect(N.eq(summary.gained, N.sub(stepped.totalEarned, state.totalEarned))).toBe(true)
  })

  it('ticks up to maxTicks then settles the rest at expected value', () => {
    const state = unlocked(1)
    const elapsed = 4 * INTERVAL
    const { state: next, summary } = applyOffline(state, elapsed, { tickMs: 100, maxTicks: INTERVAL / 100 })
    const stepped = tick(state, INTERVAL / 100)
    expect(stepped.rolls).toBe(1)
    const ev = N.mul(expectedPointsPerRoll(stepped), 3)
    expect(summary.simulatedMs).toBe(INTERVAL)
    expect(summary.estimatedMs).toBe(3 * INTERVAL)
    expect(summary.rolls).toBe(4)
    expect(next.rolls).toBe(4)
    expect(next.playMs).toBe(elapsed)
    expect(next.autoRoll.elapsedMs).toBe(0)
    expect(N.eq(next.points, N.add(stepped.points, ev))).toBe(true)
    expect(N.eq(next.totalEarned, N.add(stepped.totalEarned, ev))).toBe(true)
    expect(N.eq(next.totalEarnedRun, N.add(stepped.totalEarnedRun, ev))).toBe(true)
    expect(N.eq(summary.gained, N.sub(next.totalEarned, state.totalEarned))).toBe(true)
    // The estimate rolls no dice: the RNG and the last real roll stay as the ticks left them.
    expect(next.rng).toEqual(stepped.rng)
    expect(next.lastRoll).toEqual(stepped.lastRoll)
  })

  it('settles everything at expected value with maxTicks 0 and keeps the partial interval', () => {
    const state = unlocked(1)
    const elapsed = 7 * INTERVAL + 1234
    const { state: next, summary } = applyOffline(state, elapsed, { tickMs: 100, maxTicks: 0 })
    expect(summary).toEqual({
      elapsedMs: elapsed,
      simulatedMs: 0,
      estimatedMs: elapsed,
      rolls: 7,
      gained: N.mul(expectedPointsPerRoll(state), 7),
    })
    expect(next.autoRoll.elapsedMs).toBe(1234)
    expect(next.rng).toBe(state.rng)
    expect(next.lastRoll).toBe(state.lastRoll)
    // Estimated rolls still count towards roll trophies.
    expect(next.trophies).toContain('first_roll')
  })

  it('clamps the absence to the offline cap', () => {
    const state = createInitialState(1)
    const cap = content.rules.offline.capMs
    const { state: next, summary } = applyOffline(state, cap + 3600000)
    expect(summary.elapsedMs).toBe(cap)
    expect(next.playMs).toBe(cap)
    // A non-finite elapsed is a broken clock, not a long absence: nothing is granted.
    expect(applyOffline(state, Infinity).state).toBe(state)
    expect(applyOffline(state, 1000, { capMs: 400 }).summary.elapsedMs).toBe(400)
  })

  it('defaults tickMs, maxTicks and capMs to the content rules', () => {
    const state = unlocked(1)
    const elapsed = content.rules.offline.capMs
    const explicit = applyOffline(state, elapsed, {
      tickMs: content.rules.offline.tickMs,
      maxTicks: content.rules.offline.maxTicks,
      capMs: content.rules.offline.capMs,
    })
    const defaulted = applyOffline(state, elapsed)
    expect(serializeState(defaulted.state)).toBe(serializeState(explicit.state))
    expect(defaulted.summary.simulatedMs).toBe(content.rules.offline.tickMs * content.rules.offline.maxTicks)
    expect(defaulted.summary.estimatedMs).toBe(elapsed - defaulted.summary.simulatedMs)
  })

  it('expected value tracks the stepped simulation within 5 percent over two hours, combos included', () => {
    // Three dice so hands matter. The roll trophies the two hours would cross are earned up front
    // (rolls preset past 10,000, one roll dispatched), since the estimate cannot know when a
    // stepped run would earn them; that step is a known 2 percent each.
    const base = unlocked(4)
    const three: GameState = {
      ...base,
      rolls: 10_000,
      dice: base.dice.map((die, i) => (i <= 2 ? { ...die, owned: true, level: 5 } : die)),
    }
    const state = dispatch(three, { type: 'roll' })
    expect(state.trophies).toEqual(expect.arrayContaining(['first_roll', 'ten_thousand_rolls', 'million']))
    const twoHours = 2 * 3600000
    const stepped = applyOffline(state, twoHours, { tickMs: 100, maxTicks: 1e6 })
    const estimated = applyOffline(state, twoHours, { tickMs: 100, maxTicks: 0 })
    expect(stepped.summary.simulatedMs).toBe(twoHours)
    expect(estimated.summary.estimatedMs).toBe(twoHours)
    expect(stepped.summary.rolls).toBe(estimated.summary.rolls)
    expect(stepped.state.trophies).toEqual(state.trophies)
    expect(within(stepped.summary.gained, estimated.summary.gained, 0.05)).toBe(true)
  })

  it('rejects impossible options', () => {
    const state = unlocked(1)
    expect(() => applyOffline(state, 1000, { tickMs: 0 })).toThrow(/tickMs/)
    expect(() => applyOffline(state, 1000, { maxTicks: -1 })).toThrow(/maxTicks/)
    expect(() => applyOffline(state, 1000, { capMs: -1 })).toThrow(/capMs/)
  })
})
