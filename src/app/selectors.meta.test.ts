// The pure text helpers behind the meta panels: every content charm gets a readable effect line,
// every trophy a progress line and a ratio in [0, 1], and the luck selectors agree with core.
import { describe, expect, it } from 'vitest'
import { content } from '@/content'
import { createInitialState, dispatch, luckPreview, N } from '@/core'
import {
  describeCharmEffect,
  selectCharmsUnlocked,
  selectLuckAfterResetText,
  selectLuckProgressPercent,
  trophyProgressRatio,
  trophyProgressText,
} from './selectors.meta'
import { defaultSettings, type StoreState } from './store'

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
    },
  }
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
    expect(selectLuckAfterResetText(s)).toBe(N.format(luckPreview(s.game).multiplier))
    expect(selectCharmsUnlocked(s)).toBe(false)
  })

  it('reports the full bar and the raised multiplier once the run has earned the threshold', () => {
    const threshold = N.from(content.rules.luck.threshold)
    const game = { ...createInitialState(5), totalEarned: N.mul(threshold, 4), totalEarnedRun: N.mul(threshold, 4) }
    const s = storeState(game)
    expect(selectLuckProgressPercent(s)).toBe(100)
    expect(luckPreview(game).onReset).toBe(2)
    expect(selectLuckAfterResetText(s)).toBe(N.format(N.add(1, N.mul(content.rules.luck.perPoint, 2))))
  })
})
