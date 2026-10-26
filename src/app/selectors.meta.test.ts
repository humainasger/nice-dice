// The pure text helpers behind the meta panels: every content charm gets a readable effect line,
// every trophy a progress line and a ratio in [0, 1], and the luck selectors agree with core.
// Also the two pieces of ui state the store keeps for the meta screens: the put-aside draft
// (cleared when the offer changes) and the trophy toast queue (every trophy a change awards,
// shown one at a time, newTrophy cleared when it drains).
import { describe, expect, it } from 'vitest'
import { content, type Id } from '@/content'
import { createInitialState, dispatch, luckMultiplier, luckPreview, N, type GameState } from '@/core'
import {
  charmsLockedHeadline,
  describeCharmEffect,
  selectCharmsUnlocked,
  selectDraftDialogOpen,
  selectDraftWaiting,
  selectLuckAfterResetText,
  selectLuckProgressPercent,
  selectTrophyToastId,
  selectTrophyToastName,
  trophyProgressRatio,
  trophyProgressText,
} from './selectors.meta'
import { defaultSettings, dismissDraft, replaceGame, reopenDraft, send, shiftTrophy, store, type StoreState } from './store'

function storeState(game = createInitialState(7)): StoreState {
  return {
    game,
    ui: {
      booted: true,
      locked: false,
      offline: null,
      recovery: null,
      settings: defaultSettings,
      save: { lastSavedAt: null, persisted: null, error: null, quarantined: false },
      updateReady: false,
      draftDismissed: false,
      trophyQueue: [],
    },
  }
}

/** A fresh game with a draft open on the first three content charms (or the given ids). */
function withOffer(seed: number, offer?: readonly Id[]): GameState {
  const ids = offer ?? content.charms.slice(0, content.rules.draft.offerSize).map((c) => c.id)
  const game = createInitialState(seed)
  return { ...game, draft: { ...game.draft, offer: ids } }
}

describe('describeCharmEffect', () => {
  it('gives every content charm a non-empty line without a raw target id', () => {
    for (const def of content.charms) {
      const text = describeCharmEffect(def)
      expect(text.length).toBeGreaterThan(5)
      expect(text).not.toContain('die:')
      expect(text).not.toContain('undefined')
    }
  })

  it('reads multipliers and speed-ups the way a player would', () => {
    const points = content.charms.find((c) => c.effect.target === 'points' && c.effect.value === 1.25)
    const autoroll = content.charms.find((c) => c.effect.target === 'autoroll' && c.effect.value === 0.85)
    const die = content.charms.find((c) => c.effect.target === 'die:die_1')
    expect(points && describeCharmEffect(points)).toBe('x1.25 points on every roll')
    expect(autoroll && describeCharmEffect(autoroll)).toBe('Auto-roll 15% faster')
    expect(die && describeCharmEffect(die)).toContain(content.dice[0]?.name ?? '')
  })
})

describe('trophy progress', () => {
  it('describes every trophy from a fresh game and stays inside [0, 1]', () => {
    const game = createInitialState(1)
    for (const def of content.trophies) {
      expect(trophyProgressText(def, game).length).toBeGreaterThan(3)
      const ratio = trophyProgressRatio(def, game)
      expect(ratio).toBeGreaterThanOrEqual(0)
      expect(ratio).toBeLessThanOrEqual(1)
    }
  })

  it('moves with the state', () => {
    const rolls = content.trophies.find((t) => t.condition.kind === 'rolls' && t.condition.count === 100)
    if (rolls === undefined) throw new Error('no 100 rolls trophy')
    let game = createInitialState(3)
    expect(trophyProgressText(rolls, game)).toBe('0 / 100 rolls')
    expect(trophyProgressRatio(rolls, game)).toBe(0)
    for (let i = 0; i < 25; i++) game = dispatch(game, { type: 'roll' })
    expect(trophyProgressText(rolls, game)).toBe('25 / 100 rolls')
    expect(trophyProgressRatio(rolls, game)).toBe(0.25)
  })
})

describe('luck selectors', () => {
  it('start locked at zero percent with the multiplier after reset equal to the current one', () => {
    const s = storeState()
    expect(selectLuckProgressPercent(s)).toBe(0)
    expect(selectLuckAfterResetText(s)).toBe(N.format(luckMultiplier(s.game)))
    expect(selectCharmsUnlocked(s)).toBe(false)
  })

  it('reports the full bar and the raised multiplier once the run has earned the threshold', () => {
    const threshold = N.from(content.rules.luck.threshold)
    const game = { ...createInitialState(5), totalEarned: N.mul(threshold, 4), totalEarnedRun: N.mul(threshold, 4) }
    const s = storeState(game)
    expect(selectLuckProgressPercent(s)).toBe(100)
    // The amount is core's business (the curve changed in M4); the text must follow it, on lifetime luck.
    const { onReset } = luckPreview(game)
    expect(onReset).toBeGreaterThanOrEqual(1)
    expect(selectLuckAfterResetText(s)).toBe(N.format(N.add(1, N.mul(content.rules.luck.perPoint, game.luckTotal + onReset))))
  })
})

describe('charms headline', () => {
  it('says the charms return, not open, after a luck reset', () => {
    expect(charmsLockedHeadline(0)).toBe('Charms open after your first ascension.')
    expect(charmsLockedHeadline(1)).toBe('Charms return after your first ascension of this run.')
  })
})

describe('the put-aside draft', () => {
  it('dismisses the open offer and reopens on request', () => {
    replaceGame(withOffer(11))
    expect(selectDraftDialogOpen(store.getState())).toBe(true)
    expect(selectDraftWaiting(store.getState())).toBe(false)
    dismissDraft()
    expect(selectDraftDialogOpen(store.getState())).toBe(false)
    expect(selectDraftWaiting(store.getState())).toBe(true)
    reopenDraft()
    expect(selectDraftDialogOpen(store.getState())).toBe(true)
  })

  it('clears the dismissal when the offer changes: a pick, a reroll, a new offer', () => {
    replaceGame(withOffer(12))
    dismissDraft()
    send({ type: 'rerollDraft' })
    expect(store.getState().ui.draftDismissed).toBe(false)

    dismissDraft()
    send({ type: 'pickCharm', index: 0 })
    expect(store.getState().game.draft.offer).toBeNull()
    expect(store.getState().ui.draftDismissed).toBe(false)
    expect(selectDraftWaiting(store.getState())).toBe(false)

    dismissDraft()
    replaceGame(withOffer(13, content.charms.slice(1, 1 + content.rules.draft.offerSize).map((c) => c.id)))
    expect(store.getState().ui.draftDismissed).toBe(false)
    expect(selectDraftDialogOpen(store.getState())).toBe(true)
  })

  it('leaves a dismissal in place while the same offer stands', () => {
    replaceGame(withOffer(14))
    dismissDraft()
    send({ type: 'roll' })
    expect(selectDraftWaiting(store.getState())).toBe(true)
  })
})

describe('the trophy toast queue', () => {
  const firstRoll = content.trophies.find((t) => t.condition.kind === 'rolls' && t.condition.count === 1)
  const hundredRolls = content.trophies.find((t) => t.condition.kind === 'rolls' && t.condition.count === 100)
  if (firstRoll === undefined || hundredRolls === undefined) throw new Error('rolls trophies missing from content')

  it('queues the trophy a roll awards and clears newTrophy when it is shifted off', () => {
    replaceGame(createInitialState(21))
    expect(selectTrophyToastId(store.getState())).toBeNull()
    send({ type: 'roll' })
    expect(selectTrophyToastId(store.getState())).toBe(firstRoll.id)
    expect(selectTrophyToastName(store.getState())).toBe(firstRoll.name)
    expect(store.getState().game.newTrophy).toBe(firstRoll.id)
    shiftTrophy()
    expect(selectTrophyToastId(store.getState())).toBeNull()
    expect(store.getState().game.newTrophy).toBeNull()
  })

  it('queues every trophy one change awards, oldest first, and keeps newTrophy until the last is shown', () => {
    // 99 rolls behind and no trophies held: the hundredth roll earns both rolls trophies at once.
    replaceGame({ ...createInitialState(22), rolls: 99 })
    send({ type: 'roll' })
    expect(store.getState().ui.trophyQueue).toEqual([firstRoll.id, hundredRolls.id])
    expect(store.getState().game.newTrophy).toBe(hundredRolls.id)
    shiftTrophy()
    expect(selectTrophyToastId(store.getState())).toBe(hundredRolls.id)
    expect(store.getState().game.newTrophy).toBe(hundredRolls.id)
    shiftTrophy()
    expect(store.getState().ui.trophyQueue).toEqual([])
    expect(store.getState().game.newTrophy).toBeNull()
  })

  it('does not toast the trophies a loaded game already holds, only one it had not finished showing', () => {
    let game = createInitialState(23)
    for (let i = 0; i < 3; i++) game = dispatch(game, { type: 'roll' })
    expect(game.trophies).toContain(firstRoll.id)
    replaceGame(dispatch(game, { type: 'clearNewTrophy' }))
    expect(store.getState().ui.trophyQueue).toEqual([])
    replaceGame(game)
    expect(store.getState().ui.trophyQueue).toEqual([firstRoll.id])
  })
})
