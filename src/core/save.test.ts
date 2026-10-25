// The save layer: the initial state, exact serialize/parse round trips via N.serialize, future
// versions rejected, invalid JSON and schema failures reported rather than thrown, defaults merged
// under missing fields and the dice list aligned to content.
import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { content } from '@/content'
import { advance } from './advance'
import { dispatch, type Command } from './commands'
import { N } from './num'
import { createRng } from './rng'
import { createInitialState, parseSave, SAVE_VERSION, serializeState, type SaveShape } from './save'
import type { GameState } from './state'

const ids = content.dice.map((def) => def.id)
const [die1, die2] = content.dice
if (!die1 || !die2) throw new Error('these tests need two content dice')

const plain = (state: GameState): SaveShape => JSON.parse(serializeState(state)) as SaveShape
const edited = (state: GameState, edit: (save: Record<string, unknown>) => void): string => {
  const save = JSON.parse(serializeState(state)) as Record<string, unknown>
  edit(save)
  return JSON.stringify(save)
}
const parsedOk = (text: string): GameState => {
  const result = parseSave(text)
  if (!result.ok) throw new Error(`expected ok, got ${result.reason}: ${result.detail}`)
  return result.state
}
const failure = (text: string): { reason: string; detail: string } => {
  const result = parseSave(text)
  if (result.ok) throw new Error('expected a failure')
  return { reason: result.reason, detail: result.detail }
}

type Step = { kind: 'command'; command: Command } | { kind: 'advance'; dtMs: number }
const command: fc.Arbitrary<Command> = fc.oneof(
  fc.constant<Command>({ type: 'roll' }),
  fc.constantFrom(...ids).map((id): Command => ({ type: 'buyDie', id })),
  fc
    .tuple(fc.constantFrom(...ids), fc.oneof(fc.integer({ min: 1, max: 20 }), fc.constant<'max'>('max')))
    .map(([id, count]): Command => ({ type: 'levelDie', id, count })),
  fc.boolean().map((enabled): Command => ({ type: 'setAutoRoll', enabled })),
)
const step: fc.Arbitrary<Step> = fc.oneof(
  command.map((c): Step => ({ kind: 'command', command: c })),
  fc.integer({ min: 0, max: 20000 }).map((dtMs): Step => ({ kind: 'advance', dtMs })),
)
/** States reached by play, so Nums carry real mantissas and exponents. */
const playedState: fc.Arbitrary<GameState> = fc
  .tuple(fc.integer(), fc.array(step, { maxLength: 40 }), fc.double({ min: 0, max: 1e30, noNaN: true }))
  .map(([seed, steps, bonus]) => {
    let state = createInitialState(seed)
    state = { ...state, points: N.from(bonus), totalEarned: N.from(bonus) }
    for (const s of steps) state = s.kind === 'command' ? dispatch(state, s.command) : advance(state, s.dtMs)
    return state
  })

describe('createInitialState', () => {
  it('starts with the first die owned at level 1, nothing else, and the content auto-roll interval', () => {
    const state = createInitialState(42)
    expect(state.version).toBe(SAVE_VERSION)
    expect(state.seed).toBe(42)
    expect(state.rng).toEqual(createRng(42).getState())
    expect(N.isZero(state.points)).toBe(true)
    expect(N.isZero(state.totalEarned)).toBe(true)
    expect(state.rolls).toBe(0)
    expect(state.playMs).toBe(0)
    expect(state.dice.map((die) => die.id)).toEqual(ids)
    expect(state.dice[0]).toEqual({ id: die1.id, owned: true, level: 1 })
    for (const die of state.dice.slice(1)) expect(die).toEqual({ id: die.id, owned: false, level: 0 })
    expect(state.autoRoll).toEqual({
      unlocked: false,
      enabled: false,
      intervalMs: content.rules.autoRoll.baseIntervalMs,
      elapsedMs: 0,
    })
    expect(state.lastRoll).toBeNull()
  })

  it('throws on a non-finite seed', () => {
    expect(() => createInitialState(NaN)).toThrow()
  })
})

describe('serializeState', () => {
  it('writes compact JSON with every Num as N.serialize text', () => {
    const state = dispatch(createInitialState(1), { type: 'roll' })
    const text = serializeState(state)
    expect(text).not.toContain('\n')
    const save = plain(state)
    expect(save.version).toBe(SAVE_VERSION)
    expect(save.points).toBe(N.serialize(state.points))
    expect(save.totalEarned).toBe(N.serialize(state.totalEarned))
    expect(save.lastRoll?.gained).toBe(N.serialize(state.lastRoll?.gained ?? N.zero))
    expect(save.rng).toEqual(state.rng)
    expect(save.dice).toEqual(state.dice)
    expect(save.autoRoll).toEqual(state.autoRoll)
  })
})

describe('parseSave round trip', () => {
  it('gives back an equal state for the initial state and after play', () => {
    const initial = createInitialState(1)
    expect(parsedOk(serializeState(initial))).toEqual(initial)
    fc.assert(
      fc.property(playedState, (state) => {
        const text = serializeState(state)
        const back = parsedOk(text)
        return serializeState(back) === text && N.eq(back.points, state.points) && N.eq(back.totalEarned, state.totalEarned)
      }),
      { numRuns: 300 },
    )
  })

  it('returns fresh objects that do not alias the source state', () => {
    const state = dispatch(createInitialState(1), { type: 'roll' })
    const back = parsedOk(serializeState(state))
    expect(back).toEqual(state)
    expect(back).not.toBe(state)
    expect(back.rng).not.toBe(state.rng)
    expect(back.dice).not.toBe(state.dice)
    expect(back.lastRoll).not.toBe(state.lastRoll)
  })

  it('round-trips wide Nums exactly', () => {
    const state = { ...createInitialState(1), points: N.parse('1.2345678901234567e500'), totalEarned: N.parse('9.87e600') }
    const back = parsedOk(serializeState(state))
    expect(N.eq(back.points, state.points)).toBe(true)
    expect(N.eq(back.totalEarned, state.totalEarned)).toBe(true)
  })
})

describe('parseSave failures', () => {
  const state = dispatch(createInitialState(1), { type: 'roll' })

  it('reports invalid JSON', () => {
    for (const text of ['', '{', 'not json', '{"version": 1,}']) {
      expect(failure(text).reason, text).toBe('invalid-json')
    }
  })

  it('rejects a future version without touching it', () => {
    const text = edited(state, (save) => {
      save['version'] = SAVE_VERSION + 1
    })
    const before = JSON.parse(text) as unknown
    const result = failure(text)
    expect(result.reason).toBe('future-version')
    expect(result.detail).toContain(String(SAVE_VERSION + 1))
    expect(JSON.parse(text)).toEqual(before)
  })

  it('reports a save that is not an object or has no usable version', () => {
    for (const text of ['42', 'null', '[]', '"save"', '{}', '{"version": 0}', '{"version": 1.5}', '{"version": "1"}']) {
      const result = failure(text)
      expect(result.reason, text).toBe('schema')
      expect(result.detail, text).toMatch(/not a JSON object|version/)
    }
  })

  it('reports schema failures with the offending path', () => {
    const cases: [string, (save: Record<string, unknown>) => void, RegExp][] = [
      ['negative points', (s) => void (s['points'] = '-5e0'), /^points: /],
      ['garbage points', (s) => void (s['points'] = 'abc'), /^points: /],
      ['points as a number', (s) => void (s['points'] = 5), /^points: /],
      ['negative totalEarned', (s) => void (s['totalEarned'] = '-1e0'), /^totalEarned: /],
      ['unknown key', (s) => void (s['bonus'] = 1), /bonus/],
      ['fractional rolls', (s) => void (s['rolls'] = 1.5), /^rolls: /],
      ['negative playMs', (s) => void (s['playMs'] = -1), /^playMs: /],
      ['rng too short', (s) => void (s['rng'] = [1, 2, 3]), /^rng: /],
      ['rng all zero', (s) => void (s['rng'] = [0, 0, 0, 0]), /^rng: /],
      ['rng not numbers', (s) => void (s['rng'] = ['a', 'b', 'c', 'd']), /^rng\.0: /],
      ['owned die at level 0', (s) => void (s['dice'] = [{ id: die1.id, owned: true, level: 0 }]), /^dice\.0: /],
      ['unowned die at level 3', (s) => void (s['dice'] = [{ id: die2.id, owned: false, level: 3 }]), /^dice\.0: /],
      ['bad die id', (s) => void (s['dice'] = [{ id: 'Die-1', owned: true, level: 1 }]), /^dice\.0\.id: /],
      ['dice not an array', (s) => void (s['dice'] = 'none'), /^dice: /],
      ['zero interval', (s) => void (s['autoRoll'] = { unlocked: true, enabled: true, intervalMs: 0, elapsedMs: 0 }), /^autoRoll\.intervalMs: /],
      ['fractional interval', (s) => void (s['autoRoll'] = { unlocked: true, enabled: true, intervalMs: 0.5, elapsedMs: 0 }), /^autoRoll\.intervalMs: /],
      ['tiny interval', (s) => void (s['autoRoll'] = { unlocked: true, enabled: true, intervalMs: 1e-9, elapsedMs: 0 }), /^autoRoll\.intervalMs: /],
      ['negative elapsed', (s) => void (s['autoRoll'] = { unlocked: true, enabled: true, intervalMs: 5000, elapsedMs: -1 }), /^autoRoll\.elapsedMs: /],
      ['elapsed at the interval', (s) => void (s['autoRoll'] = { unlocked: true, enabled: true, intervalMs: 5000, elapsedMs: 5000 }), /^autoRoll\.elapsedMs: /],
      ['elapsed past the interval', (s) => void (s['autoRoll'] = { unlocked: true, enabled: true, intervalMs: 5000, elapsedMs: 12000 }), /^autoRoll\.elapsedMs: /],
      ['enabled before unlocked', (s) => void (s['autoRoll'] = { unlocked: false, enabled: true, intervalMs: 5000, elapsedMs: 0 }), /^autoRoll\.enabled: /],
      ['enabled as a string', (s) => void (s['autoRoll'] = { unlocked: true, enabled: 'yes', intervalMs: 5000, elapsedMs: 0 }), /^autoRoll\.enabled: /],
      ['first die unowned', (s) => void (s['dice'] = [{ id: die1.id, owned: false, level: 0 }]), /^dice: /],
      ['duplicate die ids', (s) => void (s['dice'] = [{ id: die1.id, owned: true, level: 1 }, { id: die1.id, owned: true, level: 9 }]), /^dice: /],
      ['totalEarned below points', (s) => void ((s['points'] = '5e1'), (s['totalEarned'] = '4e1')), /^totalEarned: /],
      ['a prototype key', (s) => void (s['constructor'] = {}), /^\(root\): /],
      ['face of zero', (s) => void (s['lastRoll'] = { faces: [0], gained: '4e0', at: 0 }), /^lastRoll\.faces\.0: /],
      ['lastRoll gained garbage', (s) => void (s['lastRoll'] = { faces: [4], gained: 'four', at: 0 }), /^lastRoll\.gained: /],
      ['lastRoll as a number', (s) => void (s['lastRoll'] = 7), /^lastRoll: /],
      ['seed as a string', (s) => void (s['seed'] = '1'), /^seed: /],
    ]
    for (const [name, edit, pattern] of cases) {
      const result = failure(edited(state, edit))
      expect(result.reason, name).toBe('schema')
      expect(result.detail, name).toMatch(pattern)
    }
  })

  it('never throws on arbitrary text', () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const result = parseSave(text)
        return result.ok === true || typeof result.detail === 'string'
      }),
    )
  })
})

describe('parseSave accepts only states that stay loadable', () => {
  it('an accepted save still parses after a tick and a roll, with lastRoll.at never negative', () => {
    // Regression: a save with elapsedMs >= intervalMs loaded, then advance stamped lastRoll.at
    // negative and the next autosave was rejected by the schema.
    fc.assert(
      fc.property(playedState, (state) => {
        const loaded = parsedOk(serializeState(state))
        const ticked = dispatch(advance(loaded, 100), { type: 'roll' })
        const at = ticked.lastRoll?.at ?? 0
        return parseSave(serializeState(ticked)).ok && at >= 0 && ticked.autoRoll.elapsedMs < ticked.autoRoll.intervalMs
      }),
      { numRuns: 200 },
    )
  })

  it('a backlog in elapsedMs is refused instead of loading into a stalled tick', () => {
    const state = dispatch(createInitialState(1), { type: 'roll' })
    const result = failure(
      edited(state, (save) => {
        save['autoRoll'] = { unlocked: true, enabled: true, intervalMs: 5000, elapsedMs: 5e9 }
      }),
    )
    expect(result.reason).toBe('schema')
    expect(result.detail).toMatch(/autoRoll\.elapsedMs: elapsedMs must be below intervalMs/)
  })
})

describe('parseSave defaults and alignment', () => {
  const state = (() => {
    let s = createInitialState(3)
    s = { ...s, points: N.from(1e6), totalEarned: N.from(1e6) }
    s = dispatch(s, { type: 'levelDie', id: die1.id, count: 2 })
    s = dispatch(s, { type: 'buyDie', id: die2.id })
    return advance(s, 2600)
  })()

  it('fills fields the save lacks from a fresh initial state', () => {
    const back = parsedOk(
      edited(state, (save) => {
        delete save['autoRoll']
        delete save['lastRoll']
        delete save['rolls']
        delete save['playMs']
      }),
    )
    expect(back.autoRoll).toEqual(createInitialState(3).autoRoll)
    expect(back.lastRoll).toBeNull()
    expect(back.rolls).toBe(0)
    expect(back.playMs).toBe(0)
    expect(back.dice).toEqual(state.dice)
    expect(N.eq(back.points, state.points)).toBe(true)
  })

  it('merges a partial nested object key by key', () => {
    const back = parsedOk(
      edited(state, (save) => {
        save['autoRoll'] = { enabled: false }
      }),
    )
    expect(back.autoRoll).toEqual({ ...createInitialState(3).autoRoll, enabled: false })
  })

  it('derives a missing RNG from the saved seed', () => {
    const back = parsedOk(
      edited(state, (save) => {
        delete save['rng']
      }),
    )
    expect(back.rng).toEqual(createRng(3).getState())
  })

  it('fills a missing dice list with the initial dice', () => {
    const back = parsedOk(
      edited(state, (save) => {
        delete save['dice']
      }),
    )
    expect(back.dice).toEqual(createInitialState(3).dice)
  })

  it('aligns the dice list to content: missing slots default, unknown ids drop, order is content order', () => {
    const back = parsedOk(
      edited(state, (save) => {
        save['dice'] = [
          { id: die2.id, owned: true, level: 7 },
          { id: 'die_99', owned: true, level: 4 },
          { id: die1.id, owned: true, level: 3 },
        ]
      }),
    )
    expect(back.dice.map((die) => die.id)).toEqual(ids)
    expect(back.dice[0]).toEqual({ id: die1.id, owned: true, level: 3 })
    expect(back.dice[1]).toEqual({ id: die2.id, owned: true, level: 7 })
    for (const die of back.dice.slice(2)) expect(die).toEqual({ id: die.id, owned: false, level: 0 })
  })
})
