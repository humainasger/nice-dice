// The save layer: the initial state, exact serialize/parse round trips via N.serialize, future
// versions rejected, invalid JSON and schema failures reported rather than thrown, defaults merged
// under missing fields, the M3 invariants, and the lists aligned to content (dice, combos, charms,
// trophies, the draft offer, luck upgrades, mastery).
import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { content, LUCK_UPGRADE_IDS } from '@/content'
import { advance } from './advance'
import { dispatch, type Command } from './commands'
import { N } from './num'
import { createRng } from './rng'
import { createInitialState, parseSave, SAVE_VERSION, serializeState, type SaveShape } from './save'
import type { GameState } from './state'

const ids = content.dice.map((def) => def.id)
const [die1, die2] = content.dice
if (!die1 || !die2) throw new Error('these tests need two content dice')
const { rules } = content

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
/** A plain die slot as the save holds it. */
const slot = (id: string, owned: boolean, level: number, extra: Record<string, unknown> = {}) => ({
  id,
  owned,
  level,
  faces: [1, 2, 3, 4, 5, 6],
  ascensions: 0,
  faceUpgrades: 0,
  ...extra,
})
const FACE_CAP = rules.face.cap

type Step = { kind: 'command'; command: Command } | { kind: 'advance'; dtMs: number }
const comboIds = content.combos.map((def) => def.id)
const command: fc.Arbitrary<Command> = fc.oneof(
  fc.constant<Command>({ type: 'roll' }),
  fc.constantFrom(...ids).map((id): Command => ({ type: 'buyDie', id })),
  fc
    .tuple(fc.constantFrom(...ids), fc.oneof(fc.integer({ min: 1, max: 20 }), fc.constant<'max'>('max')))
    .map(([id, count]): Command => ({ type: 'levelDie', id, count })),
  fc.boolean().map((enabled): Command => ({ type: 'setAutoRoll', enabled })),
  fc.constantFrom(...comboIds).map((id): Command => ({ type: 'upgradeCombo', id })),
  fc.constantFrom(...ids).map((id): Command => ({ type: 'upgradeFace', id })),
  fc.constantFrom(...ids).map((id): Command => ({ type: 'ascend', id })),
  fc.integer({ min: 0, max: 2 }).map((index): Command => ({ type: 'pickCharm', index })),
  fc.constant<Command>({ type: 'rerollDraft' }),
  fc.constant<Command>({ type: 'prestige' }),
  fc.boolean().map((enabled): Command => ({ type: 'setAutoAscend', enabled })),
  fc.constant<Command>({ type: 'clearNewTrophy' }),
  fc.constantFrom(...LUCK_UPGRADE_IDS).map((id): Command => ({ type: 'buyLuckUpgrade', id })),
  fc.boolean().map((enabled): Command => ({ type: 'setAutoLevel', enabled })),
  fc.constantFrom(...ids).map((id): Command => ({ type: 'masterDie', id })),
  fc.constant<Command>({ type: 'buyFavour' }),
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
    state = { ...state, points: N.from(bonus), totalEarned: N.from(bonus), totalEarnedRun: N.from(bonus) }
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
    expect(N.isZero(state.totalEarnedRun)).toBe(true)
    expect(state.rolls).toBe(0)
    expect(state.playMs).toBe(0)
    expect(state.dice.map((die) => die.id)).toEqual(ids)
    expect(state.dice[0]).toEqual(slot(die1.id, true, 1))
    for (const die of state.dice.slice(1)) expect(die).toEqual(slot(die.id, false, 0))
    expect(state.autoRoll).toEqual({
      unlocked: false,
      enabled: false,
      intervalMs: content.rules.autoRoll.baseIntervalMs,
      elapsedMs: 0,
    })
    expect(state.lastRoll).toBeNull()
    expect(state.combos).toEqual({})
    expect(state.charms).toEqual([])
    expect(state.draft).toEqual({ progress: 0, taken: 0, offer: null, rerolled: false })
    expect(state.luck).toBe(0)
    expect(state.luckTotal).toBe(0)
    expect(state.luckUpgrades).toEqual({})
    expect(state.mastery).toEqual({})
    expect(state.favour).toBe(0)
    expect(state.prestiges).toBe(0)
    expect(state.trophies).toEqual([])
    expect(state.newTrophy).toBeNull()
    expect(state.autoAscend).toBe(true)
    expect(state.autoLevel).toBe(false)
    expect(state.stats).toEqual({ bestRoll: N.zero, hands: {}, lastLuckAt: 0 })
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
    expect(save.totalEarnedRun).toBe(N.serialize(state.totalEarnedRun))
    expect(save.lastRoll?.gained).toBe(N.serialize(state.lastRoll?.gained ?? N.zero))
    expect(save.lastRoll?.hand).toBeNull()
    expect(save.rng).toEqual(state.rng)
    expect(save.dice).toEqual(state.dice)
    expect(save.autoRoll).toEqual(state.autoRoll)
    expect(save.stats.bestRoll).toBe(N.serialize(state.stats.bestRoll))
    expect(save.trophies).toEqual(['first_roll'])
  })
})

describe('parseSave round trip', () => {
  // 300 random games, each serialized and parsed: slow when the sim suite shares the machine.
  it('gives back an equal state for the initial state and after play', { timeout: 60_000 }, () => {
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
    expect(back.stats).not.toBe(state.stats)
  })

  it('round-trips wide Nums exactly', () => {
    const state = {
      ...createInitialState(1),
      points: N.parse('1.2345678901234567e500'),
      totalEarnedRun: N.parse('5e550'),
      totalEarned: N.parse('9.87e600'),
    }
    const back = parsedOk(serializeState(state))
    expect(N.eq(back.points, state.points)).toBe(true)
    expect(N.eq(back.totalEarnedRun, state.totalEarnedRun)).toBe(true)
    expect(N.eq(back.totalEarned, state.totalEarned)).toBe(true)
  })

  it('round-trips a full M3 state: faces, ascensions, combos, charms, an open draft, luck and trophies', () => {
    let state = { ...createInitialState(9), points: N.from(1e12), totalEarned: N.from(1e12), totalEarnedRun: N.from(1e12) }
    state = dispatch(state, { type: 'buyDie', id: die2.id })
    state = dispatch(state, { type: 'levelDie', id: die2.id, count: 'max' })
    state = dispatch(state, { type: 'upgradeFace', id: die2.id })
    state = dispatch(state, { type: 'upgradeCombo', id: 'pair' })
    state = dispatch(state, { type: 'roll' })
    expect(state.dice[1]?.ascensions).toBe(1)
    expect(state.draft.offer).not.toBeNull()
    const back = parsedOk(serializeState(state))
    expect(back).toEqual(state)
    const picked = dispatch(state, { type: 'pickCharm', index: 0 })
    const withLuck = dispatch(picked, { type: 'prestige' })
    expect(withLuck.luck).toBeGreaterThan(0)
    expect(parsedOk(serializeState(picked))).toEqual(picked)
    expect(parsedOk(serializeState(withLuck))).toEqual(withLuck)
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
      ['owned die at level 0', (s) => void (s['dice'] = [slot(die1.id, true, 0)]), /^dice\.0: /],
      ['unowned die at level 3', (s) => void (s['dice'] = [slot(die1.id, true, 1), slot(die2.id, false, 3)]), /^dice\.1: /],
      ['bad die id', (s) => void (s['dice'] = [slot('Die-1', true, 1)]), /^dice\.0\.id: /],
      ['dice not an array', (s) => void (s['dice'] = 'none'), /^dice: /],
      ['die with five faces', (s) => void (s['dice'] = [slot(die1.id, true, 1, { faces: [1, 2, 3, 4, 5] })]), /^dice\.0\.faces: /],
      ['face below its start', (s) => void (s['dice'] = [slot(die1.id, true, 1, { faces: [1, 1, 3, 4, 5, 6] })]), /^dice\.0\.faces: /],
      ['faceUpgrades off by one', (s) => void (s['dice'] = [slot(die1.id, true, 1, { faces: [2, 2, 3, 4, 5, 6], faceUpgrades: 2 })]), /^dice\.0\.faceUpgrades: /],
      ['face above the cap', (s) => void (s['dice'] = [slot(die1.id, true, 1, { faces: [FACE_CAP + 1, 2, 3, 4, 5, 6], faceUpgrades: FACE_CAP })]), /^dice\.0\.faces: /],
      ['negative ascensions', (s) => void (s['dice'] = [slot(die1.id, true, 1, { ascensions: -1 })]), /^dice\.0\.ascensions: /],
      ['zero interval', (s) => void (s['autoRoll'] = { unlocked: true, enabled: true, intervalMs: 0, elapsedMs: 0 }), /^autoRoll\.intervalMs: /],
      ['fractional interval', (s) => void (s['autoRoll'] = { unlocked: true, enabled: true, intervalMs: 0.5, elapsedMs: 0 }), /^autoRoll\.intervalMs: /],
      ['tiny interval', (s) => void (s['autoRoll'] = { unlocked: true, enabled: true, intervalMs: 1e-9, elapsedMs: 0 }), /^autoRoll\.intervalMs: /],
      ['negative elapsed', (s) => void (s['autoRoll'] = { unlocked: true, enabled: true, intervalMs: 5000, elapsedMs: -1 }), /^autoRoll\.elapsedMs: /],
      ['elapsed at the interval', (s) => void (s['autoRoll'] = { unlocked: true, enabled: true, intervalMs: 5000, elapsedMs: 5000 }), /^autoRoll\.elapsedMs: /],
      ['elapsed past the interval', (s) => void (s['autoRoll'] = { unlocked: true, enabled: true, intervalMs: 5000, elapsedMs: 12000 }), /^autoRoll\.elapsedMs: /],
      ['enabled before unlocked', (s) => void (s['autoRoll'] = { unlocked: false, enabled: true, intervalMs: 5000, elapsedMs: 0 }), /^autoRoll\.enabled: /],
      ['enabled as a string', (s) => void (s['autoRoll'] = { unlocked: true, enabled: 'yes', intervalMs: 5000, elapsedMs: 0 }), /^autoRoll\.enabled: /],
      ['first die unowned', (s) => void (s['dice'] = [slot(die1.id, false, 0)]), /^dice: /],
      ['duplicate die ids', (s) => void (s['dice'] = [slot(die1.id, true, 1), slot(die1.id, true, 9)]), /^dice: /],
      ['totalEarned below points', (s) => void ((s['points'] = '5e1'), (s['totalEarned'] = '4e1')), /^totalEarned: /],
      ['totalEarned below totalEarnedRun', (s) => void ((s['totalEarnedRun'] = '9e1'), (s['totalEarned'] = '4e1')), /^totalEarned: /],
      ['totalEarnedRun below points', (s) => void ((s['points'] = '3e0'), (s['totalEarnedRun'] = '1e0'), (s['totalEarned'] = '9e1')), /^totalEarnedRun: /],
      ['negative totalEarnedRun', (s) => void (s['totalEarnedRun'] = '-1e0'), /^totalEarnedRun: /],
      ['a prototype key', (s) => void (s['constructor'] = {}), /^\(root\): /],
      ['face of zero', (s) => void (s['lastRoll'] = { faces: [0], gained: '4e0', at: 0, hand: null }), /^lastRoll\.faces\.0: /],
      ['lastRoll gained garbage', (s) => void (s['lastRoll'] = { faces: [4], gained: 'four', at: 0, hand: null }), /^lastRoll\.gained: /],
      ['lastRoll as a number', (s) => void (s['lastRoll'] = 7), /^lastRoll: /],
      ['seed as a string', (s) => void (s['seed'] = '1'), /^seed: /],
      ['negative combo level', (s) => void (s['combos'] = { pair: -1 }), /^combos\.pair: /],
      ['charms not an array', (s) => void (s['charms'] = 'worn_felt'), /^charms: /],
      ['empty draft offer', (s) => void (s['draft'] = { progress: 0, taken: 0, offer: [], rerolled: false }), /^draft\.offer: /],
      ['negative draft progress', (s) => void (s['draft'] = { progress: -1, taken: 0, offer: null, rerolled: false }), /^draft\.progress: /],
      ['fractional luck', (s) => void (s['luck'] = 1.5), /^luck: /],
      ['fractional luckTotal', (s) => void (s['luckTotal'] = 2.5), /^luckTotal: /],
      ['luck above luckTotal', (s) => void ((s['luck'] = 3), (s['luckTotal'] = 1)), /^luckTotal: must be at least luck/],
      ['negative luck upgrade level', (s) => void (s['luckUpgrades'] = { deep_pockets: -1 }), /^luckUpgrades\.deep_pockets: /],
      ['luck upgrades not an object', (s) => void (s['luckUpgrades'] = ['deep_pockets']), /^luckUpgrades: /],
      ['negative mastery level', (s) => void (s['mastery'] = { die_1: -1 }), /^mastery\.die_1: /],
      ['fractional mastery level', (s) => void (s['mastery'] = { die_2: 1.5 }), /^mastery\.die_2: /],
      ['mastery not an object', (s) => void (s['mastery'] = ['die_1']), /^mastery: /],
      ['negative favour', (s) => void (s['favour'] = -1), /^favour: /],
      ['fractional favour', (s) => void (s['favour'] = 2.5), /^favour: /],
      ['favour as a string', (s) => void (s['favour'] = '3'), /^favour: /],
      ['autoLevel as a string', (s) => void (s['autoLevel'] = 'on'), /^autoLevel: /],
      ['negative prestiges', (s) => void (s['prestiges'] = -1), /^prestiges: /],
      ['duplicate trophies', (s) => void (s['trophies'] = ['first_roll', 'first_roll']), /^trophies: /],
      ['newTrophy with a bad id', (s) => void (s['newTrophy'] = 'First Roll'), /^newTrophy: /],
      ['autoAscend as a string', (s) => void (s['autoAscend'] = 'on'), /^autoAscend: /],
      ['negative hand count', (s) => void (s['stats'] = { bestRoll: '0e0', hands: { pair: -2 }, lastLuckAt: 0 }), /^stats\.hands\.pair: /],
      ['negative lastLuckAt', (s) => void (s['stats'] = { bestRoll: '0e0', hands: {}, lastLuckAt: -5 }), /^stats\.lastLuckAt: /],
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
  it('an accepted save still parses after a tick and a roll, with lastRoll.at never negative', { timeout: 60_000 }, () => {
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

  it('faces above the cap load when a face_cap charm raises it', () => {
    const state = dispatch(createInitialState(1), { type: 'roll' })
    const text = edited(state, (save) => {
      save['charms'] = ['whittling_knife']
      save['dice'] = [slot(die1.id, true, 1, { faces: [FACE_CAP + 2, 2, 3, 4, 5, 6], faceUpgrades: FACE_CAP + 1 })]
    })
    expect(parsedOk(text).dice[0]?.faces[0]).toBe(FACE_CAP + 2)
  })
})

describe('parseSave defaults and alignment', () => {
  const state = (() => {
    let s = createInitialState(3)
    s = { ...s, points: N.from(1e6), totalEarned: N.from(1e6), totalEarnedRun: N.from(1e6) }
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
        delete save['combos']
        delete save['charms']
        delete save['draft']
        delete save['luck']
        delete save['luckTotal']
        delete save['luckUpgrades']
        delete save['mastery']
        delete save['favour']
        delete save['prestiges']
        delete save['trophies']
        delete save['newTrophy']
        delete save['autoAscend']
        delete save['autoLevel']
        delete save['stats']
        delete save['totalEarnedRun']
      }),
    )
    const fresh = createInitialState(3)
    expect(back.autoRoll).toEqual(fresh.autoRoll)
    expect(back.lastRoll).toBeNull()
    expect(back.rolls).toBe(0)
    expect(back.playMs).toBe(0)
    expect(back.dice).toEqual(state.dice)
    expect(N.eq(back.points, state.points)).toBe(true)
    expect(back.combos).toEqual({})
    expect(back.charms).toEqual([])
    expect(back.draft).toEqual(fresh.draft)
    expect(back.luck).toBe(0)
    expect(back.luckTotal).toBe(0)
    expect(back.luckUpgrades).toEqual({})
    expect(back.mastery).toEqual({})
    expect(back.favour).toBe(0)
    expect(back.prestiges).toBe(0)
    expect(back.trophies).toEqual([])
    expect(back.newTrophy).toBeNull()
    expect(back.autoAscend).toBe(true)
    expect(back.autoLevel).toBe(false)
    expect(back.stats).toEqual(fresh.stats)
    // A missing run total heals to the lifetime total, the only default that keeps the purse under it.
    expect(N.eq(back.totalEarnedRun, back.totalEarned)).toBe(true)
  })

  it('aligns mastery to content: unknown die ids and zero levels drop, the rest stays uncapped', () => {
    const back = parsedOk(
      edited(state, (save) => {
        save['mastery'] = { die_1: 4, die_9: 2, die_3: 0, die_5: 250 }
        save['favour'] = 17
      }),
    )
    expect(back.mastery).toEqual({ die_1: 4, die_5: 250 })
    expect(back.favour).toBe(17)
    expect(parsedOk(serializeState(back)).mastery).toEqual({ die_1: 4, die_5: 250 })
  })

  it('a missing lifetime luck heals to the luck held, the only default that keeps luck under it', () => {
    const back = parsedOk(
      edited(state, (save) => {
        save['luck'] = 5
        delete save['luckTotal']
      }),
    )
    expect(back.luck).toBe(5)
    expect(back.luckTotal).toBe(5)
  })

  it('aligns the luck upgrades to content: unknown ids and zero levels drop, levels clamp to the cap', () => {
    const back = parsedOk(
      edited(state, (save) => {
        save['luck'] = 0
        save['luckTotal'] = 50
        save['luckUpgrades'] = { deep_pockets: 3, rabbit_foot: 2, head_start: 99, quick_hands: 0 }
      }),
    )
    expect(back.luckUpgrades).toEqual({ deep_pockets: 3, head_start: content.luckUpgrades.find((u) => u.id === 'head_start')?.maxLevel })
  })

  it('merges a partial nested object key by key', () => {
    const back = parsedOk(
      edited(state, (save) => {
        save['autoRoll'] = { enabled: false }
        save['draft'] = { taken: 2 }
        save['stats'] = { lastLuckAt: 5 }
      }),
    )
    expect(back.autoRoll).toEqual({ ...createInitialState(3).autoRoll, enabled: false })
    expect(back.draft).toEqual({ progress: 0, taken: 2, offer: null, rerolled: false })
    expect(back.stats).toEqual({ bestRoll: N.zero, hands: {}, lastLuckAt: 5 })
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
        save['dice'] = [slot(die2.id, true, 7), slot('die_99', true, 4), slot(die1.id, true, 3)]
      }),
    )
    expect(back.dice.map((die) => die.id)).toEqual(ids)
    expect(back.dice[0]).toEqual(slot(die1.id, true, 3))
    expect(back.dice[1]).toEqual(slot(die2.id, true, 7))
    for (const die of back.dice.slice(2)) expect(die).toEqual(slot(die.id, false, 0))
  })

  it('drops combos, charms, trophies, hands and an offer that name rows no longer in content', () => {
    const back = parsedOk(
      edited(state, (save) => {
        save['combos'] = { pair: 2, royal_flush: 9 }
        save['charms'] = ['worn_felt', 'rabbit_foot']
        save['trophies'] = ['first_roll', 'moon_landing']
        save['newTrophy'] = 'moon_landing'
        save['draft'] = { progress: 1, taken: 0, offer: ['worn_felt', 'rabbit_foot', 'oak_cup'], rerolled: false }
        save['stats'] = { bestRoll: '0e0', hands: { pair: 3, royal_flush: 1 }, lastLuckAt: 0 }
        save['lastRoll'] = { faces: [2, 2], gained: '4e0', at: 0, hand: 'royal_flush' }
      }),
    )
    expect(back.combos).toEqual({ pair: 2 })
    expect(back.charms).toEqual(['worn_felt'])
    expect(back.trophies).toEqual(['first_roll'])
    expect(back.newTrophy).toBeNull()
    expect(back.draft.offer).toBeNull()
    expect(back.stats.hands).toEqual({ pair: 3 })
    expect(back.lastRoll?.hand).toBeNull()
    const kept = parsedOk(
      edited(state, (save) => {
        save['draft'] = { progress: 1, taken: 0, offer: ['worn_felt', 'oak_cup'], rerolled: true }
        save['lastRoll'] = { faces: [2, 2], gained: '4e0', at: 0, hand: 'pair' }
      }),
    )
    expect(kept.draft.offer).toEqual(['worn_felt', 'oak_cup'])
    expect(kept.lastRoll?.hand).toBe('pair')
  })
})
