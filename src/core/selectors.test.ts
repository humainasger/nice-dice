// Selectors: dieView fields for owned, unowned, locked, affordable and capped dice, nextUnlock
// through the chain, the expected income helpers, and the M3 views (combos, faces, ascension,
// luck, draft, trophies, the multiplier breakdown).
import { describe, expect, it } from 'vitest'
import { content } from '@/content'
import { dispatch } from './commands'
import { comboDef, luckUpgradeDef } from './defs'
import {
  comboMultiplier,
  comboUpgradeCost,
  expectedComboMultiplier,
  expectedPointsPerRoll,
  faceUpgradeCost,
  levelCost,
  levelsBuyable,
  luckOnReset,
} from './formulas'
import { N, type Num } from './num'
import { createInitialState } from './save'
import {
  canAscend,
  comboView,
  dieFaceView,
  dieView,
  draftView,
  expectedPointsPerSecond,
  heldCharms,
  luckPreview,
  luckSummary,
  luckUpgradeView,
  multiplierBreakdown,
  nextUnlock,
  pointsPerRollExpected,
  trophyView,
} from './selectors'
import type { GameState } from './state'

const [die1, die2, die3] = content.dice
if (!die1 || !die2 || !die3) throw new Error('these tests need at least three content dice')
const { rules } = content
const CAP = rules.ascension.level

const abs = (x: Num): Num => N.max(x, N.sub(0, x))
const close = (a: Num, b: Num, tol = 1e-9): boolean =>
  N.lte(abs(N.sub(a, b)), N.mul(N.max(N.max(abs(a), abs(b)), 1), tol))

const withPoints = (state: GameState, points: number): GameState => ({
  ...state,
  points: N.from(points),
  totalEarned: N.add(state.totalEarned, points),
  totalEarnedRun: N.add(state.totalEarnedRun, points),
})

const withLevel = (state: GameState, index: number, level: number): GameState => ({
  ...state,
  dice: state.dice.map((die, i) => (i === index ? { ...die, owned: true, level } : die)),
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
    expect(view.ascensions).toBe(0)
    expect(view.atCap).toBe(false)
    expect(view.cap).toBe(CAP)
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

  it('reports how many levels the purse buys, never past the cap', () => {
    const state = withPoints(createInitialState(1), 500)
    const view = dieView(state, die1.id)
    expect(view.affordable).toBe(true)
    expect(view.maxAffordable).toBe(levelsBuyable(die1, 1, state.points))
    expect(view.maxAffordable).toBeGreaterThan(1)
    const rich = withPoints(createInitialState(1), 1e30)
    expect(dieView(rich, die1.id).maxAffordable).toBe(CAP - 1)
  })

  it('at the cap nothing is affordable and the die can ascend', () => {
    const capped = withLevel(withPoints(createInitialState(1), 1e30), 0, CAP)
    const view = dieView(capped, die1.id)
    expect(view.atCap).toBe(true)
    expect(view.affordable).toBe(false)
    expect(view.maxAffordable).toBe(0)
    expect(canAscend(capped, die1.id)).toBe(true)
    expect(canAscend(capped, die2.id)).toBe(false)
    expect(canAscend(createInitialState(1), die1.id)).toBe(false)
    const ascended = dispatch(capped, { type: 'ascend', id: die1.id })
    const after = dieView(ascended, die1.id)
    expect(after.ascensions).toBe(1)
    expect(N.eq(after.multiplier, die1.baseMultiplier * rules.ascension.multiplier)).toBe(true)
  })

  it('throws on an id that is not in content', () => {
    expect(() => dieView(createInitialState(1), 'ghost')).toThrow(/Unknown die id/)
  })

  it('agrees with dispatch at the exact cost: affordable means one level buys and charges nextCost', () => {
    // The UI promises what the core delivers: with points equal to nextCost the level is bought and
    // the purse lands on zero; a hair less and neither side says yes. Below the cap only.
    const base = { ...createInitialState(1), autoAscend: false }
    for (const def of content.dice) {
      for (let level = 1; level < CAP; level++) {
        const owned: GameState = {
          ...base,
          dice: base.dice.map((die) => (die.id === def.id ? { ...die, owned: true, level } : die)),
        }
        const cost = levelCost(def, level)
        const exact: GameState = { ...owned, points: cost, totalEarned: cost, totalEarnedRun: cost }
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
    const skipped = withLevel(state, 2, 1)
    const next = nextUnlock(skipped)
    expect(next?.def).toBe(die2)
    expect(next?.satisfied).toBe(true)
    const fourth = content.dice[3]
    if (!fourth) throw new Error('setup')
    const skippedTwice = withLevel(state, 1, 1)
    expect(nextUnlock(skippedTwice)).toEqual({ def: die3, unlock: die3.unlock, satisfied: true })
    expect(dieView(skippedTwice, fourth.id).unlocked).toBe(false)
    expect(dieView(state, die3.id).unlocked).toBe(false)
  })
})

describe('income helpers', () => {
  it('pointsPerRollExpected is the formula', () => {
    const state = createInitialState(1)
    expect(N.eq(pointsPerRollExpected(state), expectedPointsPerRoll(state))).toBe(true)
    expect(close(pointsPerRollExpected(state), N.from(3.5))).toBe(true)
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

describe('comboView', () => {
  it('shows the level, the multiplier and the next cost, and agrees with dispatch on affordability', () => {
    const state = withPoints(createInitialState(1), rules.combo.upgradeCost)
    const view = comboView(state, 'pair')
    expect(view.def).toBe(comboDef('pair'))
    expect(view.level).toBe(0)
    expect(N.eq(view.multiplier, comboDef('pair').base)).toBe(true)
    expect(N.eq(view.nextCost, comboUpgradeCost(0))).toBe(true)
    expect(view.affordable).toBe(true)
    const upgraded = dispatch(state, { type: 'upgradeCombo', id: 'pair' })
    expect(upgraded).not.toBe(state)
    const after = comboView(upgraded, 'pair')
    expect(after.level).toBe(1)
    expect(N.eq(after.multiplier, comboMultiplier(upgraded, 'pair'))).toBe(true)
    expect(after.affordable).toBe(false)
    expect(dispatch(upgraded, { type: 'upgradeCombo', id: 'pair' })).toBe(upgraded)
  })
})

describe('dieFaceView', () => {
  it('is locked below the unlock level and open from it', () => {
    const state = withPoints(createInitialState(1), 1e9)
    const locked = dieFaceView(state, die1.id)
    expect(locked.unlocked).toBe(false)
    expect(locked.canUpgrade).toBe(false)
    expect(locked.faces).toEqual([1, 2, 3, 4, 5, 6])
    expect(locked.cap).toBe(rules.face.cap)
    expect(N.eq(locked.nextCost, faceUpgradeCost(die1, 0))).toBe(true)
    expect(locked.nextIndex).toBe(0)
    const open = withLevel(state, 0, rules.face.unlockLevel)
    const view = dieFaceView(open, die1.id)
    expect(view.unlocked).toBe(true)
    expect(view.canUpgrade).toBe(true)
    const upgraded = dispatch(open, { type: 'upgradeFace', id: die1.id })
    expect(dieFaceView(upgraded, die1.id).faces).toEqual([2, 2, 3, 4, 5, 6])
    expect(dieFaceView(upgraded, die1.id).nextIndex).toBe(0)
    expect(N.eq(dieFaceView(upgraded, die1.id).nextCost, faceUpgradeCost(die1, 1))).toBe(true)
  })

  it('cannot upgrade at the cap, an unowned die or an empty purse', () => {
    const base = withLevel(withPoints(createInitialState(1), 1e30), 0, rules.face.unlockLevel)
    let state = base
    for (let i = 0; i < 100; i++) state = dispatch(state, { type: 'upgradeFace', id: die1.id })
    const view = dieFaceView(state, die1.id)
    expect(view.faces.every((face) => face === rules.face.cap)).toBe(true)
    expect(view.canUpgrade).toBe(false)
    expect(dieFaceView({ ...state, charms: ['whittling_knife'] }, die1.id).canUpgrade).toBe(true)
    expect(dieFaceView(base, die2.id).unlocked).toBe(false)
    expect(dieFaceView({ ...base, points: N.zero }, die1.id).canUpgrade).toBe(false)
  })
})

describe('luckPreview, luckSummary and luckUpgradeView', () => {
  it('luckPreview unlocks at the threshold and previews the luck a prestige grants with the log formula', () => {
    const state = createInitialState(1)
    const at = (run: number): GameState => ({ ...state, totalEarned: N.from(run), totalEarnedRun: N.from(run) })
    const t = rules.luck.threshold
    expect(luckPreview(at(0))).toEqual({ unlocked: false, onReset: 0, threshold: N.from(t) })
    expect(luckPreview(at(t)).unlocked).toBe(true)
    expect(luckPreview(at(t)).onReset).toBe(1)
    expect(luckPreview(at(10 * t)).onReset).toBe(rules.luck.perDecade + 1)
    expect(luckPreview(at(9 * t)).onReset).toBe(luckOnReset(at(9 * t)))
  })

  it('luckSummary separates spendable from lifetime luck and carries the multiplier and the formula constants', () => {
    const state = { ...createInitialState(1), luck: 3, luckTotal: 12 }
    const summary = luckSummary(state)
    expect(summary.luck).toBe(3)
    expect(summary.luckTotal).toBe(12)
    expect(close(summary.multiplier, N.from(1 + 12 * rules.luck.perPoint))).toBe(true)
    expect(summary.perDecade).toBe(rules.luck.perDecade)
    expect(N.eq(summary.threshold, rules.luck.threshold)).toBe(true)
  })

  it('luckUpgradeView shows level, cap and next cost, and agrees with dispatch on affordability', () => {
    const poor = { ...createInitialState(1), luck: 1, luckTotal: 1 }
    const view = luckUpgradeView(poor, 'head_start')
    expect(view.def).toBe(luckUpgradeDef('head_start'))
    expect(view).toMatchObject({ level: 0, maxLevel: 5, nextCost: 2, affordable: false, maxed: false })
    expect(dispatch(poor, { type: 'buyLuckUpgrade', id: 'head_start' })).toBe(poor)
    const cheap = luckUpgradeView(poor, 'quick_hands')
    expect(cheap).toMatchObject({ level: 0, nextCost: 1, affordable: true, maxed: false })
    const bought = dispatch(poor, { type: 'buyLuckUpgrade', id: 'quick_hands' })
    expect(bought).not.toBe(poor)
    expect(luckUpgradeView(bought, 'quick_hands')).toMatchObject({ level: 1, nextCost: 2, affordable: false })
    const maxed = { ...poor, luck: 100, luckTotal: 100, luckUpgrades: { steady_hands: 1 } }
    expect(luckUpgradeView(maxed, 'steady_hands')).toMatchObject({ level: 1, maxLevel: 1, nextCost: null, affordable: false, maxed: true })
    expect(dispatch(maxed, { type: 'buyLuckUpgrade', id: 'steady_hands' })).toBe(maxed)
    expect(() => luckUpgradeView(poor, 'rabbit_foot' as 'memory')).toThrow(/Unknown luck upgrade id/)
  })
})

describe('draftView and heldCharms', () => {
  it('reports progress, requirement, the offer as defs and the reroll', () => {
    const state = createInitialState(1)
    expect(draftView(state)).toEqual({ progress: 0, requirement: 1, offer: null, canReroll: false, taken: 0 })
    const opened = dispatch(withLevel(withPoints(state, 1e9), 0, CAP), { type: 'ascend', id: die1.id })
    const view = draftView(opened)
    expect(view.offer?.map((def) => def.id)).toEqual(opened.draft.offer)
    expect(view.canReroll).toBe(true)
    const rerolled = dispatch(opened, { type: 'rerollDraft' })
    expect(draftView(rerolled).canReroll).toBe(false)
    const picked = dispatch(rerolled, { type: 'pickCharm', index: 2 })
    expect(draftView(picked)).toMatchObject({ offer: null, canReroll: false, taken: 1, progress: 0 })
    expect(draftView(picked).requirement).toBe(Math.ceil(rules.draft.growth))
    expect(heldCharms(picked).map((def) => def.id)).toEqual(picked.charms)
    expect(heldCharms(state)).toEqual([])
  })
})

describe('trophyView', () => {
  it('splits held (in earned order) from the rest (in content order)', () => {
    const state = createInitialState(1)
    expect(trophyView(state).held).toEqual([])
    expect(trophyView(state).next).toEqual(content.trophies)
    const rolled = dispatch(state, { type: 'roll' })
    const view = trophyView(rolled)
    expect(view.held.map((def) => def.id)).toEqual(['first_roll'])
    expect(view.next.map((def) => def.id)).toEqual(content.trophies.map((def) => def.id).filter((id) => id !== 'first_roll'))
  })
})

describe('multiplierBreakdown', () => {
  it('lists every source and their product', () => {
    const base = withLevel(withPoints(createInitialState(1), 1e9), 1, 3)
    const state: GameState = { ...base, luck: 0, luckTotal: 2, trophies: ['first_roll', 'million'], charms: ['worn_felt', 'tin_cup'] }
    const view = multiplierBreakdown(state)
    // die_1 level 1 (x1) plus die_2 level 3 (x6) with the Tin Cup (x2 since the M4 retune).
    expect(N.eq(view.dice, 1 + 6 * 2)).toBe(true)
    expect(N.eq(view.combo, expectedComboMultiplier(state))).toBe(true)
    expect(close(view.charms, N.from(1.25))).toBe(true)
    expect(close(view.luck, N.from(1 + 2 * rules.luck.perPoint))).toBe(true)
    expect(close(view.trophies, N.from(rules.trophy.multiplier ** 2))).toBe(true)
    const product = N.mul(N.mul(N.mul(N.mul(view.dice, view.combo), view.charms), view.luck), view.trophies)
    expect(N.eq(view.total, product)).toBe(true)
    // deep_pockets rides in the luck factor; keen_eye in the expected combo.
    const upgraded: GameState = { ...state, luckUpgrades: { deep_pockets: 2, keen_eye: 1 } }
    const after = multiplierBreakdown(upgraded)
    expect(close(after.luck, N.from((1 + 2 * rules.luck.perPoint) * 1.2 ** 2))).toBe(true)
    expect(N.gt(after.combo, view.combo)).toBe(true)
    const afterProduct = N.mul(N.mul(N.mul(N.mul(after.dice, after.combo), after.charms), after.luck), after.trophies)
    expect(N.eq(after.total, afterProduct)).toBe(true)
    const plain = multiplierBreakdown(createInitialState(1))
    expect(N.eq(plain.dice, 1)).toBe(true)
    expect(N.eq(plain.combo, 1)).toBe(true)
    expect(N.eq(plain.total, 1)).toBe(true)
  })
})
