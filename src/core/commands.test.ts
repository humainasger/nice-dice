// dispatch on every command, valid and invalid: no-ops hand back the same object, points never go
// negative, levels never exceed what the points allowed or the cap, the M3 commands (combos,
// faces, ascension, the draft, luck, auto-ascend, trophies), the M4 luck shop (buyLuckUpgrade,
// setAutoLevel, prestige with memory and head_start), the M5 luck sinks (masterDie, buyFavour),
// and a command sequence is deterministic for its seed with every reachable state loadable.
import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { content, LUCK_UPGRADE_IDS } from '@/content'
import { advance } from './advance'
import { dispatch, type Command } from './commands'
import { charmDef, dieDef, luckUpgradeDef } from './defs'
import {
  autoRollInterval,
  bulkCost,
  comboUpgradeCost,
  draftOfferSize,
  effectiveDieMultiplier,
  faceUpgradeCost,
  favourCost,
  levelCost,
  levelsBuyable,
  luckOnReset,
  luckUpgradeCost,
  masteryCost,
  maxAffordable,
  rollPoints,
} from './formulas'
import { N, type Num } from './num'
import { createRng } from './rng'
import { createInitialState, parseSave, serializeState } from './save'
import type { GameState } from './state'

const [die1, die2, die3] = content.dice
if (!die1 || !die2 || !die3) throw new Error('these tests need at least three content dice')
const ids = content.dice.map((def) => def.id)
const { rules } = content
const CAP = rules.ascension.level

const abs = (x: Num): Num => N.max(x, N.sub(0, x))
const close = (a: Num, b: Num, tol = 1e-9): boolean =>
  N.lte(abs(N.sub(a, b)), N.mul(N.max(N.max(abs(a), abs(b)), 1), tol))

/** The state with its purse set to `points` (and both totals raised to match). */
const withPoints = (state: GameState, points: number): GameState => ({
  ...state,
  points: N.from(points),
  totalEarned: N.add(state.totalEarned, points),
  totalEarnedRun: N.add(state.totalEarnedRun, points),
})

/** The state with die `index` owned at `level` (other fields untouched). */
const withLevel = (state: GameState, index: number, level: number): GameState => ({
  ...state,
  dice: state.dice.map((die, i) => (i === index ? { ...die, owned: true, level } : die)),
})

/** A rich state with die_1 at the cap; ascending it opens the first draft (requirement 1). */
const atCap = (seed = 1): GameState => withLevel(withPoints(createInitialState(seed), 1e9), 0, CAP)
const withDraft = (seed = 1): GameState => {
  const opened = dispatch(atCap(seed), { type: 'ascend', id: die1.id })
  if (opened.draft.offer === null) throw new Error('setup: the first ascension should open a draft')
  return opened
}

describe('roll', () => {
  it('rolls every owned die once with the saved RNG and records the result', () => {
    const state = createInitialState(1)
    const next = dispatch(state, { type: 'roll' })
    expect(next).not.toBe(state)
    expect(next.rolls).toBe(1)
    const rng = createRng(1)
    const face = rng.rollDie(6)
    expect(next.lastRoll?.faces).toEqual([face])
    expect(next.lastRoll?.hand).toBeNull()
    expect(next.rng).toEqual(rng.getState())
    expect(next.lastRoll?.at).toBe(0)
    const gained = rollPoints(state, [face])
    expect(N.eq(next.lastRoll?.gained ?? N.zero, gained)).toBe(true)
    expect(N.eq(next.points, gained)).toBe(true)
    expect(N.eq(next.totalEarned, gained)).toBe(true)
    expect(N.eq(next.totalEarnedRun, gained)).toBe(true)
    expect(N.eq(next.stats.bestRoll, gained)).toBe(true)
    expect(next.trophies).toEqual(['first_roll'])
    expect(next.newTrophy).toBe('first_roll')
    // Untouched parts are shared.
    expect(next.dice).toBe(state.dice)
    expect(next.autoRoll).toBe(state.autoRoll)
    expect(next.combos).toBe(state.combos)
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

  it('records the hand it made and counts it in the stats', () => {
    let state = withLevel(withLevel(createInitialState(3), 1, 1), 2, 1)
    let hands = 0
    for (let i = 0; i < 60; i++) {
      state = dispatch(state, { type: 'roll' })
      if (state.lastRoll?.hand !== null) hands += 1
    }
    expect(hands).toBeGreaterThan(0)
    const counted = Object.values(state.stats.hands).reduce((sum, n) => sum + (n ?? 0), 0)
    expect(counted).toBe(hands)
    expect(N.gte(state.stats.bestRoll, state.lastRoll?.gained ?? N.zero)).toBe(true)
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

  it('buys an unlocked, affordable die at baseCost into level 1 with fresh faces, and awards its trophy', () => {
    const state = withPoints(createInitialState(1), die2.baseCost + 50)
    const next = dispatch(state, { type: 'buyDie', id: die2.id })
    expect(next).not.toBe(state)
    expect(next.dice[1]).toEqual({ id: die2.id, owned: true, level: 1, faces: [1, 2, 3, 4, 5, 6], ascensions: 0, faceUpgrades: 0 })
    expect(N.eq(next.points, 50)).toBe(true)
    expect(next.totalEarned).toBe(state.totalEarned)
    expect(next.dice[0]).toBe(state.dice[0])
    expect(next.dice[2]).toBe(state.dice[2])
    expect(next.trophies).toContain('second_die')
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
    expect(next.dice[0]).toEqual({ ...state.dice[0], level: 2 })
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

  it('stops at the level cap, and with auto-ascend off a capped die is a no-op', () => {
    const off: GameState = { ...withPoints(createInitialState(1), 1e30), autoAscend: false }
    const max = dispatch(off, { type: 'levelDie', id: die1.id, count: 'max' })
    expect(max.dice[0]?.level).toBe(CAP)
    expect(max.dice[0]?.ascensions).toBe(0)
    expect(N.eq(max.points, N.sub(off.points, bulkCost(die1, 1, CAP - 1)))).toBe(true)
    expect(dispatch(max, { type: 'levelDie', id: die1.id, count: 1 })).toBe(max)
    expect(dispatch(max, { type: 'levelDie', id: die1.id, count: 'max' })).toBe(max)
  })

  it('with auto-ascend on, a die that reaches or sits at the cap ascends in the same command', () => {
    const rich = withPoints(createInitialState(1), 1e30)
    const max = dispatch(rich, { type: 'levelDie', id: die1.id, count: 'max' })
    expect(max.dice[0]?.level).toBe(1)
    expect(max.dice[0]?.ascensions).toBe(1)
    expect(max.draft.progress).toBeGreaterThanOrEqual(0)
    expect(max.draft.offer).not.toBeNull()
    expect(max.trophies).toContain('first_ascension')
    const sitting = withLevel(rich, 0, CAP)
    const ascended = dispatch(sitting, { type: 'levelDie', id: die1.id, count: 1 })
    expect(ascended.dice[0]).toMatchObject({ level: 1, ascensions: 1 })
    expect(ascended.points).toBe(sitting.points)
  })

  it('never exceeds what the points or the cap allowed and never overdraws', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1e9, noNaN: true }),
        fc.integer({ min: 1, max: CAP - 1 }),
        fc.oneof(fc.integer({ min: 1, max: 500 }), fc.constant<'max'>('max')),
        (purse, startLevel, count) => {
          const state: GameState = { ...withLevel(withPoints(createInitialState(1), purse), 0, startLevel), autoAscend: false }
          const allowed = levelsBuyable(die1, startLevel, state.points)
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

describe('upgradeCombo', () => {
  it('ignores unknown hands and an unaffordable upgrade', () => {
    const poor = withPoints(createInitialState(1), rules.combo.upgradeCost - 1)
    expect(dispatch(poor, { type: 'upgradeCombo', id: 'pair' })).toBe(poor)
    const rich = withPoints(createInitialState(1), 1e9)
    expect(dispatch(rich, { type: 'upgradeCombo', id: 'royal_flush' as 'pair' })).toBe(rich)
    expect(dispatch(rich, { type: 'upgradeCombo', id: 7 as unknown as 'pair' })).toBe(rich)
  })

  it('charges the level cost and raises the level, sharing the untouched parts', () => {
    const state = withPoints(createInitialState(1), 1e9)
    const once = dispatch(state, { type: 'upgradeCombo', id: 'pair' })
    expect(once.combos).toEqual({ pair: 1 })
    expect(N.eq(once.points, N.sub(state.points, comboUpgradeCost(0)))).toBe(true)
    expect(once.dice).toBe(state.dice)
    const twice = dispatch(once, { type: 'upgradeCombo', id: 'pair' })
    expect(twice.combos).toEqual({ pair: 2 })
    expect(N.eq(twice.points, N.sub(once.points, comboUpgradeCost(1)))).toBe(true)
    const other = dispatch(twice, { type: 'upgradeCombo', id: 'five_kind' })
    expect(other.combos).toEqual({ pair: 2, five_kind: 1 })
  })
})

describe('upgradeFace', () => {
  const unlockedDie = (seed = 1): GameState => withLevel(withPoints(createInitialState(seed), 1e9), 0, rules.face.unlockLevel)

  it('ignores unknown, unowned and under-levelled dice and an unaffordable upgrade', () => {
    const state = withPoints(createInitialState(1), 1e9)
    expect(dispatch(state, { type: 'upgradeFace', id: 'ghost' })).toBe(state)
    expect(dispatch(state, { type: 'upgradeFace', id: die2.id })).toBe(state)
    expect(dispatch(state, { type: 'upgradeFace', id: die1.id })).toBe(state)
    const under = withLevel(state, 0, rules.face.unlockLevel - 1)
    expect(dispatch(under, { type: 'upgradeFace', id: die1.id })).toBe(under)
    const poor = { ...unlockedDie(), points: N.sub(faceUpgradeCost(die1, 0), 1) }
    expect(dispatch(poor, { type: 'upgradeFace', id: die1.id })).toBe(poor)
  })

  it('raises the lowest face by one (the first on ties) at the growing cost', () => {
    const state = unlockedDie()
    const one = dispatch(state, { type: 'upgradeFace', id: die1.id })
    expect(one.dice[0]).toMatchObject({ faces: [2, 2, 3, 4, 5, 6], faceUpgrades: 1 })
    expect(N.eq(one.points, N.sub(state.points, faceUpgradeCost(die1, 0)))).toBe(true)
    const two = dispatch(one, { type: 'upgradeFace', id: die1.id })
    expect(two.dice[0]).toMatchObject({ faces: [3, 2, 3, 4, 5, 6], faceUpgrades: 2 })
    expect(N.eq(two.points, N.sub(one.points, faceUpgradeCost(die1, 1)))).toBe(true)
    const three = dispatch(two, { type: 'upgradeFace', id: die1.id })
    expect(three.dice[0]?.faces).toEqual([3, 3, 3, 4, 5, 6])
    expect(three.dice[1]).toBe(state.dice[1])
  })

  it('stops at the cap, which face_cap charms raise', () => {
    let state = withPoints(unlockedDie(), 1e30)
    for (let i = 0; i < 200; i++) state = dispatch(state, { type: 'upgradeFace', id: die1.id })
    expect(state.dice[0]?.faces).toEqual(Array.from({ length: 6 }, () => rules.face.cap))
    expect(dispatch(state, { type: 'upgradeFace', id: die1.id })).toBe(state)
    const charmed = { ...state, charms: ['whittling_knife'] }
    const raised = dispatch(charmed, { type: 'upgradeFace', id: die1.id })
    expect(raised.dice[0]?.faces[0]).toBe(rules.face.cap + 1)
  })
})

describe('ascend', () => {
  it('ignores unknown, unowned and under-cap dice', () => {
    const state = withPoints(createInitialState(1), 1e9)
    expect(dispatch(state, { type: 'ascend', id: 'ghost' })).toBe(state)
    expect(dispatch(state, { type: 'ascend', id: die2.id })).toBe(state)
    expect(dispatch(state, { type: 'ascend', id: die1.id })).toBe(state)
    const almost = withLevel(state, 0, CAP - 1)
    expect(dispatch(almost, { type: 'ascend', id: die1.id })).toBe(almost)
  })

  it('resets the level, counts the ascension, fills draft progress and opens the first draft', () => {
    const state = atCap()
    const next = dispatch(state, { type: 'ascend', id: die1.id })
    expect(next.dice[0]).toMatchObject({ level: 1, ascensions: 1, faces: state.dice[0]?.faces })
    expect(next.points).toBe(state.points)
    expect(next.draft.offer).toHaveLength(rules.draft.offerSize)
    expect(next.draft.progress).toBe(1)
    expect(next.draft.rerolled).toBe(false)
    expect(next.rng).not.toEqual(state.rng)
    expect(next.trophies).toContain('first_ascension')
    expect(new Set(next.draft.offer).size).toBe(rules.draft.offerSize)
    for (const id of next.draft.offer ?? []) expect(() => charmDef(id)).not.toThrow()
  })

  it('offers only charms whose die is owned', () => {
    const next = dispatch(atCap(), { type: 'ascend', id: die1.id })
    for (const id of next.draft.offer ?? []) {
      const { target } = charmDef(id).effect
      if (target.startsWith('die:')) expect(target).toBe(`die:${die1.id}`)
    }
  })

  it('keeps one offer open while progress piles up, then opens the next after a pick', () => {
    let state = withDraft()
    state = dispatch(withLevel(state, 0, CAP), { type: 'ascend', id: die1.id })
    expect(state.draft.progress).toBe(2)
    expect(state.draft.offer).toHaveLength(rules.draft.offerSize)
    const picked = dispatch(state, { type: 'pickCharm', index: 0 })
    expect(picked.charms).toHaveLength(1)
    expect(picked.draft.taken).toBe(1)
    // Progress 2 - 1 = 1 against a requirement of ceil(growth ^ 1) = 2: no second offer yet.
    expect(Math.ceil(rules.draft.growth)).toBe(2)
    expect(picked.draft.progress).toBe(1)
    expect(picked.draft.offer).toBeNull()
  })
})

describe('pickCharm and rerollDraft', () => {
  it('ignore a closed draft and bad indexes', () => {
    const closed = createInitialState(1)
    expect(dispatch(closed, { type: 'pickCharm', index: 0 })).toBe(closed)
    expect(dispatch(closed, { type: 'rerollDraft' })).toBe(closed)
    const open = withDraft()
    for (const index of [-1, 3, 1.5, NaN, Infinity]) {
      expect(dispatch(open, { type: 'pickCharm', index }), String(index)).toBe(open)
    }
  })

  it('takes the charm, closes the offer, spends the progress and awards the trophy', () => {
    const open = withDraft()
    const offer = open.draft.offer ?? []
    const picked = dispatch(open, { type: 'pickCharm', index: 1 })
    expect(picked.charms).toEqual([offer[1]])
    expect(picked.draft).toEqual({ progress: 0, taken: 1, offer: null, rerolled: false })
    expect(picked.trophies).toContain('first_charm')
    expect(picked.dice).toBe(open.dice)
  })

  it('an autoroll charm shortens the interval and keeps the partial interval below it', () => {
    const open = withDraft()
    const spring = { ...open, draft: { ...open.draft, offer: ['quick_hand', 'worn_felt', 'oak_cup'] }, autoRoll: { unlocked: true, enabled: true, intervalMs: 5000, elapsedMs: 4900 } }
    const picked = dispatch(spring, { type: 'pickCharm', index: 0 })
    expect(picked.autoRoll.intervalMs).toBe(Math.floor(5000 * 0.7))
    expect(picked.autoRoll.elapsedMs).toBeLessThan(picked.autoRoll.intervalMs)
    const other = dispatch(spring, { type: 'pickCharm', index: 1 })
    expect(other.autoRoll).toBe(spring.autoRoll)
  })

  it('rerolls once per draft for free and redraws from the RNG', () => {
    const open = withDraft()
    const rerolled = dispatch(open, { type: 'rerollDraft' })
    expect(rerolled.draft.rerolled).toBe(true)
    expect(rerolled.draft.offer).toHaveLength(rules.draft.offerSize)
    expect(rerolled.rng).not.toEqual(open.rng)
    expect(rerolled.points).toBe(open.points)
    expect(dispatch(rerolled, { type: 'rerollDraft' })).toBe(rerolled)
    const picked = dispatch(rerolled, { type: 'pickCharm', index: 0 })
    expect(picked.draft.rerolled).toBe(false)
  })

  it('prefers charms not yet held while enough remain', () => {
    let state = withDraft()
    const seen = new Set<string>()
    for (let round = 0; round < 6; round++) {
      const offer = state.draft.offer ?? []
      for (const id of offer) expect(seen.has(id), `${id} offered again`).toBe(false)
      const pick = offer[0]
      if (pick === undefined) throw new Error('setup: empty offer')
      seen.add(pick)
      state = dispatch(state, { type: 'pickCharm', index: 0 })
      state = { ...state, draft: { ...state.draft, progress: 1000 } }
      state = dispatch(withLevel(state, 0, CAP), { type: 'ascend', id: die1.id })
    }
  })
})

describe('prestige', () => {
  const run = (total: number): GameState => {
    let state = withPoints(createInitialState(5), total)
    state = dispatch(state, { type: 'buyDie', id: die2.id })
    state = dispatch(state, { type: 'levelDie', id: die1.id, count: 20 })
    state = dispatch(state, { type: 'upgradeCombo', id: 'pair' })
    state = dispatch(state, { type: 'upgradeFace', id: die1.id })
    state = dispatch(state, { type: 'roll' })
    return { ...state, playMs: 123_456 }
  }

  it('is ignored below the luck threshold', () => {
    const state = run(rules.luck.threshold / 2)
    expect(dispatch(state, { type: 'prestige' })).toBe(state)
  })

  it('converts the run into luck (spendable and lifetime) and resets what the brief says, keeping the rest', () => {
    const state = { ...run(4 * rules.luck.threshold), charms: ['worn_felt'], trophies: ['first_roll'], autoAscend: false }
    const unlockedRoll = { ...state, autoRoll: { ...state.autoRoll, unlocked: true, enabled: true, intervalMs: 4000, elapsedMs: 100 } }
    const gain = luckOnReset(unlockedRoll)
    expect(gain).toBe(Math.floor(rules.luck.perDecade * Math.log10(4)) + 1)
    const next = dispatch(unlockedRoll, { type: 'prestige' })
    expect(next.luck).toBe(gain)
    expect(next.luckTotal).toBe(gain)
    expect(next.luckUpgrades).toBe(unlockedRoll.luckUpgrades)
    expect(next.autoLevel).toBe(false)
    expect(next.prestiges).toBe(1)
    expect(N.isZero(next.points)).toBe(true)
    expect(N.isZero(next.totalEarnedRun)).toBe(true)
    expect(next.totalEarned).toBe(unlockedRoll.totalEarned)
    expect(next.dice).toEqual(createInitialState(5).dice)
    expect(next.combos).toEqual({})
    expect(next.charms).toEqual([])
    expect(next.draft).toEqual({ progress: 0, taken: 0, offer: null, rerolled: false })
    expect(next.lastRoll).toBeNull()
    expect(next.autoRoll).toEqual({ unlocked: true, enabled: true, intervalMs: rules.autoRoll.baseIntervalMs, elapsedMs: 0 })
    // The prestige completes first_luck, and the lifetime total (four thresholds, kept) completes the
    // total-earned trophies in the same check.
    expect(next.trophies).toEqual(['first_roll', 'first_luck', 'million', 'billion'])
    expect(next.newTrophy).toBe('billion')
    expect(next.autoAscend).toBe(false)
    expect(next.stats.lastLuckAt).toBe(123_456)
    expect(next.stats.bestRoll).toBe(unlockedRoll.stats.bestRoll)
    expect(next.rolls).toBe(unlockedRoll.rolls)
    expect(next.playMs).toBe(unlockedRoll.playMs)
    expect(next.rng).toBe(unlockedRoll.rng)
    expect(next.seed).toBe(unlockedRoll.seed)
  })

  it('adds up over several prestiges, into both counters, with spent luck staying spent', () => {
    const first = dispatch(run(rules.luck.threshold), { type: 'prestige' })
    expect(first.luck).toBe(1)
    expect(first.luckTotal).toBe(1)
    const spent = dispatch(first, { type: 'buyLuckUpgrade', id: 'quick_hands' })
    expect(spent.luck).toBe(0)
    const again = { ...spent, totalEarned: N.from(1e12), totalEarnedRun: N.from(9 * rules.luck.threshold) }
    const gain = luckOnReset(again)
    expect(gain).toBe(Math.floor(rules.luck.perDecade * Math.log10(9)) + 1)
    const second = dispatch(again, { type: 'prestige' })
    expect(second.luck).toBe(gain)
    expect(second.luckTotal).toBe(1 + gain)
    expect(second.luckUpgrades).toEqual({ quick_hands: 1 })
    expect(second.prestiges).toBe(2)
  })

  it('memory keeps the rarest charms through the reset and head_start sets the starting level of the first die', () => {
    const base = { ...run(4 * rules.luck.threshold), charms: ['worn_felt', 'quick_hand', 'silver_thimble', 'oak_cup', 'chalk_mark'] }
    const plain = dispatch(base, { type: 'prestige' })
    expect(plain.charms).toEqual([])
    expect(plain.dice[0]).toMatchObject({ level: 1, ascensions: 0 })
    const remembered = { ...base, luckUpgrades: { memory: 2, head_start: 3 } }
    const next = dispatch(remembered, { type: 'prestige' })
    // Epic Quick Hand first, then the rare Silver Thimble; the commons go.
    expect(next.charms).toEqual(['quick_hand', 'silver_thimble'])
    expect(next.dice[0]).toMatchObject({ level: 30, ascensions: 0, faces: [1, 2, 3, 4, 5, 6] })
    expect(next.dice.slice(1).every((die) => !die.owned)).toBe(true)
    expect(next.draft).toEqual({ progress: 0, taken: 0, offer: null, rerolled: false })
    // The kept Quick Hand still speeds up auto-roll in the new run.
    expect(next.autoRoll.intervalMs).toBe(autoRollInterval(next))
    expect(next.autoRoll.intervalMs).toBe(Math.floor(rules.autoRoll.baseIntervalMs * 0.7))
    expect(next.autoRoll.elapsedMs).toBe(0)
    const all = dispatch({ ...base, luckUpgrades: { memory: 3, head_start: 5 } }, { type: 'prestige' })
    expect(all.charms).toEqual(['quick_hand', 'silver_thimble', 'worn_felt'])
    expect(all.dice[0]?.level).toBe(50)
    expect(parseSave(serializeState(all)).ok).toBe(true)
  })
})

describe('buyLuckUpgrade', () => {
  const rich = (luck: number, extra: Partial<GameState> = {}): GameState => ({ ...createInitialState(1), luck, luckTotal: luck, ...extra })

  it('ignores an unknown id, a non-string, an unaffordable level and a maxed upgrade', () => {
    const state = rich(100)
    expect(dispatch(state, { type: 'buyLuckUpgrade', id: 'rabbit_foot' as 'memory' })).toBe(state)
    expect(dispatch(state, { type: 'buyLuckUpgrade', id: 7 as unknown as 'memory' })).toBe(state)
    const poor = rich(1)
    expect(dispatch(poor, { type: 'buyLuckUpgrade', id: 'head_start' })).toBe(poor)
    const maxed = rich(100, { luckUpgrades: { lucky_draw: 2 } })
    expect(dispatch(maxed, { type: 'buyLuckUpgrade', id: 'lucky_draw' })).toBe(maxed)
    const broke = rich(0)
    for (const id of LUCK_UPGRADE_IDS) expect(dispatch(broke, { type: 'buyLuckUpgrade', id }), id).toBe(broke)
  })

  it('charges the next cost from spendable luck only and raises the level, sharing the untouched parts', () => {
    const state = rich(20)
    const def = luckUpgradeDef('deep_pockets')
    const once = dispatch(state, { type: 'buyLuckUpgrade', id: 'deep_pockets' })
    expect(once.luckUpgrades).toEqual({ deep_pockets: 1 })
    expect(once.luck).toBe(20 - luckUpgradeCost(def, 0))
    expect(once.luckTotal).toBe(20)
    expect(once.dice).toBe(state.dice)
    expect(once.autoRoll).toBe(state.autoRoll)
    expect(once.autoLevel).toBe(false)
    const twice = dispatch(once, { type: 'buyLuckUpgrade', id: 'deep_pockets' })
    expect(twice.luckUpgrades).toEqual({ deep_pockets: 2 })
    expect(twice.luck).toBe(once.luck - luckUpgradeCost(def, 1))
    const other = dispatch(twice, { type: 'buyLuckUpgrade', id: 'memory' })
    expect(other.luckUpgrades).toEqual({ deep_pockets: 2, memory: 1 })
    expect(N.gt(rollPoints(twice, [4]), rollPoints(state, [4]))).toBe(true)
  })

  it('walks every upgrade to its cap at the content costs and never overdraws', () => {
    for (const def of content.luckUpgrades) {
      let state = rich(1000)
      let paid = 0
      for (let level = 0; level < def.maxLevel; level++) {
        const next = dispatch(state, { type: 'buyLuckUpgrade', id: def.id })
        expect(next, `${def.id} level ${level}`).not.toBe(state)
        paid += luckUpgradeCost(def, level)
        expect(next.luck).toBe(1000 - paid)
        expect(next.luckUpgrades[def.id]).toBe(level + 1)
        state = next
      }
      expect(dispatch(state, { type: 'buyLuckUpgrade', id: def.id })).toBe(state)
      const exact = rich(luckUpgradeCost(def, 0))
      expect(dispatch(exact, { type: 'buyLuckUpgrade', id: def.id }).luck).toBe(0)
      const short = rich(luckUpgradeCost(def, 0) - 1)
      expect(dispatch(short, { type: 'buyLuckUpgrade', id: def.id })).toBe(short)
    }
  })

  it('steady_hands switches auto-level on and quick_hands shortens the interval, keeping the partial interval below it', () => {
    const state = rich(10, { autoRoll: { unlocked: true, enabled: true, intervalMs: 5000, elapsedMs: 4900 } })
    const steady = dispatch(state, { type: 'buyLuckUpgrade', id: 'steady_hands' })
    expect(steady.autoLevel).toBe(true)
    expect(steady.autoRoll).toBe(state.autoRoll)
    const quick = dispatch(state, { type: 'buyLuckUpgrade', id: 'quick_hands' })
    expect(quick.autoRoll.intervalMs).toBe(Math.floor(5000 * 0.92))
    expect(quick.autoRoll.elapsedMs).toBeLessThan(quick.autoRoll.intervalMs)
    expect(quick.autoLevel).toBe(false)
    const locked = dispatch(rich(10), { type: 'buyLuckUpgrade', id: 'quick_hands' })
    expect(locked.autoRoll.intervalMs).toBe(Math.floor(rules.autoRoll.baseIntervalMs * 0.92))
  })
})

describe('masterDie', () => {
  const rich = (luck: number, extra: Partial<GameState> = {}): GameState => ({ ...createInitialState(1), luck, luckTotal: luck, ...extra })

  it('ignores an unknown id, a non-string and an unaffordable level', () => {
    const state = rich(100)
    expect(dispatch(state, { type: 'masterDie', id: 'ghost' })).toBe(state)
    expect(dispatch(state, { type: 'masterDie', id: 7 as unknown as string })).toBe(state)
    const poor = rich(masteryCost(0) - 1)
    expect(dispatch(poor, { type: 'masterDie', id: die1.id })).toBe(poor)
    const broke = rich(0)
    for (const id of ids) expect(dispatch(broke, { type: 'masterDie', id }), id).toBe(broke)
  })

  it('charges the next cost from spendable luck only, raises that die alone and lifts only its output', () => {
    // die_2 bought through dispatch, so its trophy is already awarded and the sink buys change nothing else.
    const state = dispatch(withPoints(rich(20), die2.baseCost), { type: 'buyDie', id: die2.id })
    expect(state.dice[1]?.owned).toBe(true)
    const once = dispatch(state, { type: 'masterDie', id: die1.id })
    expect(once).not.toBe(state)
    expect(once.mastery).toEqual({ [die1.id]: 1 })
    expect(once.luck).toBe(20 - masteryCost(0))
    expect(once.luckTotal).toBe(20)
    expect(once.favour).toBe(0)
    expect(once.dice).toBe(state.dice)
    expect(once.luckUpgrades).toBe(state.luckUpgrades)
    expect(once.autoRoll).toBe(state.autoRoll)
    const twice = dispatch(once, { type: 'masterDie', id: die1.id })
    expect(twice.mastery).toEqual({ [die1.id]: 2 })
    expect(twice.luck).toBe(once.luck - masteryCost(1))
    const other = dispatch(twice, { type: 'masterDie', id: die2.id })
    expect(other.mastery).toEqual({ [die1.id]: 2, [die2.id]: 1 })
    expect(other.luck).toBe(twice.luck - masteryCost(0))
    // With die_1 alone, two mastery levels lift the roll by exactly x(1 + 2 x step).
    const onlyFirst: GameState = { ...state, dice: state.dice.map((die, i) => (i === 1 ? { ...die, owned: false, level: 0 } : die)) }
    const onlyFirstMastered: GameState = { ...onlyFirst, mastery: twice.mastery }
    expect(close(rollPoints(onlyFirstMastered, [4]), N.mul(rollPoints(onlyFirst, [4]), 1 + 2 * rules.mastery.step))).toBe(true)
    // With both dice (faces 4 and 1, no hand) only die_1's share of the dice sum grows: (4 x m1 x 1.2 + 1 x m2) / (4 x m1 + 1 x m2).
    const [first, second] = state.dice
    if (!first || !second) throw new Error('setup')
    const m1 = effectiveDieMultiplier(state, first)
    const m2 = effectiveDieMultiplier(state, second)
    const before = N.add(N.mul(m1, 4), m2)
    const after = N.add(N.mul(N.mul(m1, 4), 1 + 2 * rules.mastery.step), m2)
    expect(close(rollPoints(twice, [4, 1]), N.mul(rollPoints(state, [4, 1]), N.div(after, before)))).toBe(true)
  })

  it('works on an unowned die, and the level counts once the die is bought', () => {
    const state = rich(10)
    expect(state.dice[1]?.owned).toBe(false)
    const mastered = dispatch(state, { type: 'masterDie', id: die2.id })
    expect(mastered.mastery).toEqual({ [die2.id]: 1 })
    expect(mastered.dice).toBe(state.dice)
    const bought = dispatch(withPoints(mastered, 1e6), { type: 'buyDie', id: die2.id })
    const plain = dispatch(withPoints(state, 1e6), { type: 'buyDie', id: die2.id })
    expect(N.gt(rollPoints(bought, [1, 4]), rollPoints(plain, [1, 4]))).toBe(true)
  })

  it('has no cap: walks thirty levels at the content costs, never overdraws, and stops exactly when the luck runs short', () => {
    let state = rich(100000)
    let paid = 0
    for (let level = 0; level < 30; level++) {
      const next = dispatch(state, { type: 'masterDie', id: die3.id })
      expect(next, `level ${level}`).not.toBe(state)
      paid += masteryCost(level)
      expect(next.luck).toBe(100000 - paid)
      expect(next.mastery[die3.id]).toBe(level + 1)
      state = next
    }
    expect(paid).toBe(46457)
    const exact = rich(masteryCost(0))
    expect(dispatch(exact, { type: 'masterDie', id: die1.id }).luck).toBe(0)
    const short = rich(masteryCost(0) - 1)
    expect(dispatch(short, { type: 'masterDie', id: die1.id })).toBe(short)
    const high = rich(1000, { mastery: { [die1.id]: 5000 } })
    expect(masteryCost(5000)).toBe(Infinity)
    expect(dispatch(high, { type: 'masterDie', id: die1.id })).toBe(high)
    expect(parseSave(serializeState(state)).ok).toBe(true)
  })

  it('survives a luck reset', () => {
    const state = rich(10, { totalEarned: N.from(4 * rules.luck.threshold), totalEarnedRun: N.from(4 * rules.luck.threshold) })
    const mastered = dispatch(dispatch(state, { type: 'masterDie', id: die1.id }), { type: 'masterDie', id: die2.id })
    const reset = dispatch(mastered, { type: 'prestige' })
    expect(reset.prestiges).toBe(1)
    expect(reset.mastery).toBe(mastered.mastery)
    expect(reset.dice[1]?.owned).toBe(false)
    expect(reset.luck).toBe(mastered.luck + luckOnReset(mastered))
  })
})

describe('buyFavour', () => {
  const rich = (luck: number, extra: Partial<GameState> = {}): GameState => ({ ...createInitialState(1), luck, luckTotal: luck, ...extra })

  it('ignores an unaffordable level', () => {
    const broke = rich(0)
    expect(dispatch(broke, { type: 'buyFavour' })).toBe(broke)
    const short = rich(favourCost(3) - 1, { favour: 3 })
    expect(dispatch(short, { type: 'buyFavour' })).toBe(short)
  })

  it('charges the next cost from spendable luck only, raises the level and lifts every roll by the step', () => {
    // die_2 bought through dispatch, so its trophy is already awarded and the sink buys change nothing else.
    const state = dispatch(withPoints(rich(20), die2.baseCost), { type: 'buyDie', id: die2.id })
    expect(state.dice[1]?.owned).toBe(true)
    const once = dispatch(state, { type: 'buyFavour' })
    expect(once).not.toBe(state)
    expect(once.favour).toBe(1)
    expect(once.luck).toBe(20 - favourCost(0))
    expect(once.luck).toBe(19)
    expect(once.luckTotal).toBe(20)
    expect(once.mastery).toBe(state.mastery)
    expect(once.dice).toBe(state.dice)
    expect(once.luckUpgrades).toBe(state.luckUpgrades)
    const twice = dispatch(once, { type: 'buyFavour' })
    expect(twice.favour).toBe(2)
    expect(twice.luck).toBe(once.luck - favourCost(1))
    for (const faces of [[4, 1], [3, 3], [6, 6]]) {
      expect(close(rollPoints(twice, faces), N.mul(rollPoints(state, faces), 1 + 2 * rules.favour.step))).toBe(true)
    }
  })

  it('has no cap: walks thirty levels at the content costs, never overdraws, and stops exactly when the luck runs short', () => {
    let state = rich(1000000)
    let paid = 0
    for (let level = 0; level < 30; level++) {
      const next = dispatch(state, { type: 'buyFavour' })
      expect(next, `level ${level}`).not.toBe(state)
      paid += favourCost(level)
      expect(next.luck).toBe(1000000 - paid)
      expect(next.favour).toBe(level + 1)
      state = next
    }
    expect(paid).toBe(383514)
    const exact = rich(favourCost(0))
    expect(dispatch(exact, { type: 'buyFavour' }).luck).toBe(0)
    const high = rich(1000, { favour: 5000 })
    expect(favourCost(5000)).toBe(Infinity)
    expect(dispatch(high, { type: 'buyFavour' })).toBe(high)
    expect(parseSave(serializeState(state)).ok).toBe(true)
  })

  it('survives a luck reset', () => {
    const state = rich(10, { totalEarned: N.from(4 * rules.luck.threshold), totalEarnedRun: N.from(4 * rules.luck.threshold) })
    const favoured = dispatch(dispatch(state, { type: 'buyFavour' }), { type: 'buyFavour' })
    expect(favoured.favour).toBe(2)
    const reset = dispatch(favoured, { type: 'prestige' })
    expect(reset.favour).toBe(2)
    expect(reset.luck).toBe(favoured.luck + luckOnReset(favoured))
    expect(reset.luckTotal).toBe(10 + luckOnReset(favoured))
  })
})

describe('setAutoLevel', () => {
  it('is a no-op without steady_hands, for a non-boolean and for the current value, and toggles once owned', () => {
    const state = createInitialState(1)
    expect(dispatch(state, { type: 'setAutoLevel', enabled: true })).toBe(state)
    expect(dispatch(state, { type: 'setAutoLevel', enabled: false })).toBe(state)
    const owned = dispatch({ ...state, luck: 3, luckTotal: 3 }, { type: 'buyLuckUpgrade', id: 'steady_hands' })
    expect(owned.autoLevel).toBe(true)
    expect(dispatch(owned, { type: 'setAutoLevel', enabled: true })).toBe(owned)
    expect(dispatch(owned, { type: 'setAutoLevel', enabled: 'yes' as unknown as boolean })).toBe(owned)
    const off = dispatch(owned, { type: 'setAutoLevel', enabled: false })
    expect(off.autoLevel).toBe(false)
    expect(off.dice).toBe(owned.dice)
    expect(dispatch(off, { type: 'setAutoLevel', enabled: true }).autoLevel).toBe(true)
  })
})

describe('setAutoAscend', () => {
  it('toggles, is a no-op for the current value or a non-boolean, and ascends capped dice when switched on', () => {
    const state = createInitialState(1)
    expect(state.autoAscend).toBe(true)
    expect(dispatch(state, { type: 'setAutoAscend', enabled: true })).toBe(state)
    expect(dispatch(state, { type: 'setAutoAscend', enabled: 'yes' as unknown as boolean })).toBe(state)
    const off = dispatch(state, { type: 'setAutoAscend', enabled: false })
    expect(off.autoAscend).toBe(false)
    expect(off.dice).toBe(state.dice)
    const capped = withLevel(off, 0, CAP)
    expect(dispatch(capped, { type: 'levelDie', id: die1.id, count: 1 })).toBe(capped)
    const on = dispatch(capped, { type: 'setAutoAscend', enabled: true })
    expect(on.autoAscend).toBe(true)
    expect(on.dice[0]).toMatchObject({ level: 1, ascensions: 1 })
  })
})

describe('clearNewTrophy', () => {
  it('clears the toast and is a no-op when there is none', () => {
    const state = createInitialState(1)
    expect(dispatch(state, { type: 'clearNewTrophy' })).toBe(state)
    const rolled = dispatch(state, { type: 'roll' })
    expect(rolled.newTrophy).toBe('first_roll')
    const cleared = dispatch(rolled, { type: 'clearNewTrophy' })
    expect(cleared.newTrophy).toBeNull()
    expect(cleared.trophies).toEqual(['first_roll'])
    expect(cleared.dice).toBe(rolled.dice)
  })
})

describe('trophies', () => {
  it('are awarded after the command that completes them, several at once, with the latest in newTrophy', () => {
    let state = createInitialState(1)
    for (let i = 0; i < 99; i++) state = dispatch(state, { type: 'roll' })
    expect(state.trophies).toEqual(['first_roll'])
    state = dispatch(state, { type: 'roll' })
    expect(state.trophies).toEqual(['first_roll', 'hundred_rolls'])
    expect(state.newTrophy).toBe('hundred_rolls')
    const rich = { ...state, totalEarned: N.from(2e9), totalEarnedRun: N.from(2e9), points: N.from(2e9) }
    const bought = dispatch(rich, { type: 'buyDie', id: die2.id })
    expect(bought.trophies).toEqual(['first_roll', 'hundred_rolls', 'second_die', 'million', 'billion'])
    expect(bought.newTrophy).toBe('billion')
  })

  it('five of a kind is awarded on the roll that makes it', () => {
    let state = createInitialState(1)
    state = {
      ...state,
      dice: state.dice.map((die) => ({ ...die, owned: true, level: 1 })),
    }
    let found = false
    for (let i = 0; i < 20_000 && !found; i++) {
      state = dispatch(state, { type: 'roll' })
      if (state.lastRoll?.hand === 'five_kind') found = true
    }
    expect(found).toBe(true)
    expect(state.trophies).toContain('five_of_a_kind')
    expect(state.stats.hands.five_kind).toBeGreaterThanOrEqual(1)
  })
})

describe('dispatch', () => {
  it('ignores an unknown command type', () => {
    const state = createInitialState(1)
    expect(dispatch(state, { type: 'nope' } as unknown as Command)).toBe(state)
  })

  type Step = { kind: 'command'; command: Command } | { kind: 'advance'; dtMs: number }
  const comboIds = content.combos.map((def) => def.id)
  const command: fc.Arbitrary<Command> = fc.oneof(
    fc.constant<Command>({ type: 'roll' }),
    fc.constantFrom(...ids).map((id): Command => ({ type: 'buyDie', id })),
    fc
      .tuple(fc.constantFrom(...ids), fc.oneof(fc.integer({ min: -2, max: 20 }), fc.constant<'max'>('max')))
      .map(([id, count]): Command => ({ type: 'levelDie', id, count })),
    fc.boolean().map((enabled): Command => ({ type: 'setAutoRoll', enabled })),
    fc.constantFrom(...comboIds).map((id): Command => ({ type: 'upgradeCombo', id })),
    fc.constantFrom(...ids).map((id): Command => ({ type: 'upgradeFace', id })),
    fc.constantFrom(...ids).map((id): Command => ({ type: 'ascend', id })),
    fc.integer({ min: -1, max: 3 }).map((index): Command => ({ type: 'pickCharm', index })),
    fc.constant<Command>({ type: 'rerollDraft' }),
    fc.constant<Command>({ type: 'prestige' }),
    fc.boolean().map((enabled): Command => ({ type: 'setAutoAscend', enabled })),
    fc.constant<Command>({ type: 'clearNewTrophy' }),
    fc.constantFrom(...LUCK_UPGRADE_IDS).map((id): Command => ({ type: 'buyLuckUpgrade', id })),
    fc.boolean().map((enabled): Command => ({ type: 'setAutoLevel', enabled })),
    fc.constantFrom(...ids, 'ghost').map((id): Command => ({ type: 'masterDie', id })),
    fc.constant<Command>({ type: 'buyFavour' }),
  )
  const step: fc.Arbitrary<Step> = fc.oneof(
    command.map((c): Step => ({ kind: 'command', command: c })),
    fc.integer({ min: 0, max: 20000 }).map((dtMs): Step => ({ kind: 'advance', dtMs })),
  )

  const invariants = (state: GameState): boolean =>
    N.gte(state.points, 0) &&
    N.gte(state.totalEarned, state.points) &&
    N.gte(state.totalEarnedRun, state.points) &&
    N.gte(state.totalEarned, state.totalEarnedRun) &&
    state.luck >= 0 &&
    state.luckTotal >= state.luck &&
    Object.entries(state.mastery).every(([id, level]) => ids.includes(id) && Number.isSafeInteger(level) && (level ?? 0) >= 1) &&
    Number.isSafeInteger(state.favour) &&
    state.favour >= 0 &&
    Object.entries(state.luckUpgrades).every(([id, level]) => (level ?? 0) <= luckUpgradeDef(id as (typeof LUCK_UPGRADE_IDS)[number]).maxLevel) &&
    (!state.autoLevel || (state.luckUpgrades.steady_hands ?? 0) >= 1) &&
    state.dice.length === content.dice.length &&
    state.dice[0]?.owned === true &&
    state.dice.every((die) => (die.owned ? die.level >= 1 && die.level <= CAP : die.level === 0)) &&
    state.dice.every((die) => die.faces.length === 6 && die.faces.every((face, i) => face >= i + 1 && face <= rules.face.cap + 2 * state.charms.length)) &&
    (!state.autoRoll.enabled || state.autoRoll.unlocked) &&
    state.autoRoll.elapsedMs >= 0 &&
    state.autoRoll.elapsedMs < state.autoRoll.intervalMs &&
    state.draft.progress >= 0 &&
    (state.draft.offer === null || state.draft.offer.length === draftOfferSize(state)) &&
    new Set(state.trophies).size === state.trophies.length &&
    parseSave(serializeState(state)).ok

  /** A purse injection so the random walk reaches the cap, the draft and the luck threshold within a few steps. */
  const boost = (state: GameState, points: number): GameState => withPoints(state, points)

  const run = (seed: number, purse: number, steps: readonly Step[]): GameState => {
    let state = boost(createInitialState(seed), purse)
    for (const s of steps) {
      const before = state
      state = s.kind === 'command' ? dispatch(state, s.command) : advance(state, s.dtMs)
      if (!invariants(state)) throw new Error(`invariant broken after ${JSON.stringify(s)}: ${JSON.stringify(parseSave(serializeState(state)))}`)
      if (s.kind === 'command' && s.command.type === 'levelDie') {
        const id = s.command.id
        const slot = before.dice.find((die) => die.id === id)
        const after = state.dice.find((die) => die.id === id)
        if (slot && after && slot.owned) {
          const allowed = levelsBuyable(dieDef(slot.id), slot.level, before.points, slot.ascensions)
          if (after.level - slot.level > allowed) throw new Error('levelled beyond the purse')
        }
      }
    }
    return state
  }

  // 300 random games of up to 60 steps, each step re-parsing the save: about 3 s alone, slower
  // when the sim suite shares the machine, so the default 5 s timeout is not enough.
  it('keeps the invariants over any command sequence and is deterministic for a seed', { timeout: 60_000 }, () => {
    fc.assert(
      fc.property(fc.integer(), fc.constantFrom(0, 1e3, 1e7, 1e12), fc.array(step, { maxLength: 60 }), (seed, purse, steps) => {
        const once = run(seed, purse, steps)
        const twice = run(seed, purse, steps)
        return serializeState(once) === serializeState(twice)
      }),
      { numRuns: 300 },
    )
  })
})
