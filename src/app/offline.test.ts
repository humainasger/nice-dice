// Away summaries: a pending summary absorbs later credits instead of being replaced, a silent
// credit leaves the modal alone, and a hidden-tab span is measured from the game itself so ticks
// and offline credits both count. Node environment, the store is reset before every test.
import { beforeEach, describe, expect, it } from 'vitest'
import { N, createInitialState, dispatch, type OfflineSummary } from '@/core'
import { beginHiddenSpan, hiddenSummary, noteHiddenCredit } from './offline'
import { creditOffline, dismissOffline, mergeOfflineSummaries, replaceGame, setUi, showOffline, store } from './store'

function summary(elapsedMs: number, rolls: number, gained: number, estimatedMs: number = 0): OfflineSummary {
  return { elapsedMs, simulatedMs: elapsedMs - estimatedMs, estimatedMs, rolls, gained: N.from(gained) }
}

beforeEach(() => {
  replaceGame(createInitialState(7))
  setUi({ offline: null })
})

describe('away summaries', () => {
  it('merges two absences into one', () => {
    const merged = mergeOfflineSummaries(summary(60_000, 12, 50, 100), summary(30_000, 6, 25))
    expect(merged).toEqual(summary(90_000, 18, 75, 100))
  })

  it('a pending summary absorbs the next one instead of being replaced', () => {
    showOffline(summary(60_000, 12, 50))
    showOffline(summary(60_000, 12, 50))
    showOffline(summary(60_000, 12, 50))
    expect(store.getState().ui.offline).toEqual(summary(180_000, 36, 150))
    dismissOffline()
    showOffline(summary(5_000, 1, 4))
    expect(store.getState().ui.offline).toEqual(summary(5_000, 1, 4))
  })

  it('creditOffline shows by default and adds to a pending summary', () => {
    creditOffline(60_000)
    creditOffline(60_000)
    expect(store.getState().ui.offline?.elapsedMs).toBe(120_000)
    expect(store.getState().game.playMs).toBe(120_000)
  })

  it('a silent credit advances the game without touching the modal', () => {
    const before = store.getState().game.playMs
    const credited = creditOffline(60_000, false)
    expect(credited?.elapsedMs).toBe(60_000)
    expect(store.getState().game.playMs).toBe(before + 60_000)
    expect(store.getState().ui.offline).toBeNull()
  })

  it('credits nothing for a gap of zero and says so', () => {
    expect(creditOffline(0)).toBeNull()
    expect(store.getState().ui.offline).toBeNull()
  })
})

describe('hidden span', () => {
  const start = createInitialState(3)

  it('reports nothing while no gap went through the offline path', () => {
    const span = beginHiddenSpan(start, 1000)
    expect(hiddenSummary(span, dispatch(start, { type: 'roll' }), 400_000)).toBeNull()
  })

  it('measures the whole span from the game: ticks and credits alike, estimated time kept', () => {
    const span = noteHiddenCredit(noteHiddenCredit(beginHiddenSpan(start, 1000), summary(60_000, 12, 50, 40)), summary(60_000, 12, 50, 60))
    const later = dispatch(dispatch(start, { type: 'roll' }), { type: 'roll' })
    const reported = hiddenSummary(span, later, 601_000)
    expect(reported).not.toBeNull()
    expect(reported?.elapsedMs).toBe(600_000)
    expect(reported?.estimatedMs).toBe(100)
    expect(reported?.simulatedMs).toBe(599_900)
    expect(reported?.rolls).toBe(2)
    expect(reported?.gained).toEqual(N.sub(later.totalEarned, start.totalEarned))
  })

  it('never reports a negative span, roll count or gain', () => {
    const span = noteHiddenCredit(beginHiddenSpan(dispatch(start, { type: 'roll' }), 5000), summary(60_000, 12, 50))
    const reported = hiddenSummary(span, start, 4000)
    expect(reported?.elapsedMs).toBe(0)
    expect(reported?.rolls).toBe(0)
    expect(reported?.gained).toEqual(N.zero)
  })
})
