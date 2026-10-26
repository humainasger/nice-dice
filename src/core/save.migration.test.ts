// Fixture saves from every historical version load and survive a serialize/parse round trip, the
// migration map covers every version below SAVE_VERSION, the v1 to v2 migration fills the M3
// fields the way the brief says, the v2 to v3 migration the M4 luck fields and the v3 to v4
// migration the M5 luck sinks. The last test is the generator: run
// WRITE_SAVE_FIXTURE=1 pnpm exec vitest run src/core/save.migration.test.ts to (re)write
// tests/fixtures/saves/v<SAVE_VERSION>.json from the scripted game below, so a version bump always
// leaves a fixture for the version it replaces.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { content } from '@/content'
import { advance } from './advance'
import { dispatch } from './commands'
import { autoRollInterval, favourCost, luckEffects, luckOnReset, masteryCost } from './formulas'
import { N } from './num'
import { createInitialState, migrations, parseSave, SAVE_VERSION, serializeState } from './save'
import { multiplierBreakdown } from './selectors'
import type { GameState } from './state'

const fixtures = import.meta.glob('/tests/fixtures/saves/v*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const versionOf = (path: string): number => Number(/\/v(\d+)\.json$/.exec(path)?.[1])
const fixturePath = (version: number): string =>
  fileURLToPath(new URL(`../../tests/fixtures/saves/v${version}.json`, import.meta.url))

/** Hands the scripted game a purse, as a long session would have earned it. */
const earn = (state: GameState, points: number): GameState => ({
  ...state,
  points: N.add(state.points, points),
  totalEarned: N.add(state.totalEarned, points),
  totalEarnedRun: N.add(state.totalEarnedRun, points),
})

/** Luck the scripted game's prestige grants: a run worth four thresholds under the log formula. */
const SCRIPTED_LUCK = Math.floor(content.rules.luck.perDecade * Math.log10(4)) + 1

/**
 * createInitialState(1), a dozen manual rolls, a max level-up (unlocks auto-roll), a minute of ticks,
 * a toggle, a roll, then the M3 systems: a run worth four thresholds is prestiged, the M4 luck shop
 * buys Quick Hands and Steady Hands (auto-level on), the M5 sinks take the rest of the luck (one
 * mastery level on die_1, one Fortune's Favour), the next run buys three dice, levels the first to
 * the cap (auto-ascend opens the draft), picks a charm, rerolls the next offer, edits faces,
 * upgrades two hands, rolls a few times, ends on a partial interval with auto-level having had its
 * say, and clears the toast.
 */
function scriptedGame(): GameState {
  let state = createInitialState(1)
  for (let i = 0; i < 12; i++) state = dispatch(state, { type: 'roll' })
  state = dispatch(state, { type: 'levelDie', id: 'die_1', count: 'max' })
  for (let i = 0; i < 60; i++) state = advance(state, 100)
  state = dispatch(state, { type: 'setAutoRoll', enabled: false })
  state = dispatch(state, { type: 'roll' })
  state = dispatch(state, { type: 'setAutoRoll', enabled: true })
  state = earn(state, 4 * content.rules.luck.threshold)
  state = dispatch(state, { type: 'prestige' })
  state = dispatch(state, { type: 'buyLuckUpgrade', id: 'quick_hands' })
  state = dispatch(state, { type: 'buyLuckUpgrade', id: 'steady_hands' })
  state = dispatch(state, { type: 'masterDie', id: 'die_1' })
  state = dispatch(state, { type: 'buyFavour' })
  state = earn(state, 5e6)
  state = dispatch(state, { type: 'buyDie', id: 'die_2' })
  state = dispatch(state, { type: 'buyDie', id: 'die_3' })
  state = dispatch(state, { type: 'levelDie', id: 'die_1', count: 'max' })
  state = dispatch(state, { type: 'pickCharm', index: 0 })
  state = dispatch(state, { type: 'levelDie', id: 'die_2', count: 12 })
  for (let i = 0; i < 3; i++) state = dispatch(state, { type: 'upgradeFace', id: 'die_2' })
  state = dispatch(state, { type: 'upgradeCombo', id: 'pair' })
  state = dispatch(state, { type: 'upgradeCombo', id: 'pair' })
  state = dispatch(state, { type: 'upgradeCombo', id: 'three_kind' })
  for (let i = 0; i < 5; i++) state = dispatch(state, { type: 'roll' })
  state = advance(state, 2500)
  // Last, so the toast is clear even after auto-level bought a die on the closing ticks.
  return dispatch(state, { type: 'clearNewTrophy' })
}

describe('save fixtures', () => {
  const versions = Object.keys(fixtures).map(versionOf).sort((a, b) => a - b)

  it('exist for every version from 1 to SAVE_VERSION', () => {
    expect(versions).toEqual(Array.from({ length: SAVE_VERSION }, (_, i) => i + 1))
  })

  for (const [path, text] of Object.entries(fixtures)) {
    const version = versionOf(path)

    it(`${path} parses and round-trips`, () => {
      const parsed = parseSave(text)
      expect(parsed.ok, parsed.ok ? '' : `${parsed.reason}: ${parsed.detail}`).toBe(true)
      if (!parsed.ok) return
      expect((JSON.parse(text) as { version: unknown }).version).toBe(version)
      expect(parsed.state.version).toBe(SAVE_VERSION)
      const again = parseSave(serializeState(parsed.state))
      expect(again.ok).toBe(true)
      if (!again.ok) return
      expect(serializeState(again.state)).toBe(serializeState(parsed.state))
      expect(again.state).toEqual(parsed.state)
    })

    if (version === SAVE_VERSION) {
      it(`${path} is unchanged by serialize/parse field for field`, () => {
        const parsed = parseSave(text)
        if (!parsed.ok) throw new Error(`${parsed.reason}: ${parsed.detail}`)
        expect(JSON.parse(serializeState(parsed.state))).toEqual(JSON.parse(text))
      })
    }
  }
})

describe('migrations', () => {
  it('cover exactly the versions below SAVE_VERSION', () => {
    const covered = Object.keys(migrations)
      .map(Number)
      .sort((a, b) => a - b)
    expect(covered).toEqual(Array.from({ length: SAVE_VERSION - 1 }, (_, i) => i + 1))
  })

  it('v1 to v4 adds faces, ascensions, face upgrades, the run total and the hand, with the other fields (luck and the sinks included) defaulted', () => {
    const text = fixtures['/tests/fixtures/saves/v1.json']
    if (text === undefined) throw new Error('setup: no v1 fixture')
    const raw = JSON.parse(text) as { totalEarned: string; dice: { id: string; level: number }[]; lastRoll: { faces: number[] } }
    const parsed = parseSave(text)
    if (!parsed.ok) throw new Error(`${parsed.reason}: ${parsed.detail}`)
    const { state } = parsed
    expect(state.version).toBe(4)
    expect(N.eq(state.totalEarnedRun, N.parse(raw.totalEarned))).toBe(true)
    expect(state.dice.map((die) => die.level)).toEqual(raw.dice.map((die) => die.level))
    for (const die of state.dice) {
      expect(die.faces).toEqual([1, 2, 3, 4, 5, 6])
      expect(die.ascensions).toBe(0)
      expect(die.faceUpgrades).toBe(0)
    }
    expect(state.lastRoll?.faces).toEqual(raw.lastRoll.faces)
    expect(state.lastRoll?.hand).toBeNull()
    const fresh = createInitialState(state.seed)
    expect(state.combos).toEqual(fresh.combos)
    expect(state.charms).toEqual(fresh.charms)
    expect(state.draft).toEqual(fresh.draft)
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
    expect(state.stats).toEqual(fresh.stats)
    // The first command after loading awards the trophies the old save had already earned.
    expect(dispatch(state, { type: 'clearNewTrophy' })).toBe(state)
    expect(dispatch(state, { type: 'roll' }).trophies).toContain('first_roll')
    // With no luck, neither sink can be bought.
    expect(dispatch(state, { type: 'masterDie', id: 'die_1' })).toBe(state)
    expect(dispatch(state, { type: 'buyFavour' })).toBe(state)
  })

  it('v2 to v4 makes the luck held the lifetime luck, owns no upgrade, no mastery and no favour, and leaves auto-level off', () => {
    const text = fixtures['/tests/fixtures/saves/v2.json']
    if (text === undefined) throw new Error('setup: no v2 fixture')
    const raw = JSON.parse(text) as Record<string, unknown> & { luck: number; charms: string[]; trophies: string[] }
    expect(raw.luck).toBeGreaterThan(0)
    const parsed = parseSave(text)
    if (!parsed.ok) throw new Error(`${parsed.reason}: ${parsed.detail}`)
    const { state } = parsed
    expect(state.version).toBe(4)
    expect(state.luck).toBe(raw.luck)
    expect(state.luckTotal).toBe(raw.luck)
    expect(state.luckUpgrades).toEqual({})
    expect(state.mastery).toEqual({})
    expect(state.favour).toBe(0)
    expect(state.autoLevel).toBe(false)
    expect(state.charms).toEqual(raw.charms)
    expect(state.trophies).toEqual(raw.trophies)
    // The multiplier the v2 save enjoyed is exactly what it keeps.
    expect(N.eq(N.add(1, N.mul(content.rules.luck.perPoint, raw.luck)), N.add(1, N.mul(content.rules.luck.perPoint, state.luckTotal)))).toBe(true)
    // The migration itself, on the raw object, does not mutate its input.
    const migrate = migrations[2]
    if (migrate === undefined) throw new Error('setup: no v2 migration')
    const migrated = migrate(raw) as { version: number; luckTotal: unknown; luckUpgrades: unknown; autoLevel: unknown }
    expect(migrated.version).toBe(3)
    expect(migrated.luckTotal).toBe(raw.luck)
    expect(migrated.luckUpgrades).toEqual({})
    expect(migrated.autoLevel).toBeUndefined()
    expect(raw['luckTotal']).toBeUndefined()
    expect(raw['version']).toBe(2)
    // The loaded save can spend its luck straight away.
    const bought = dispatch(state, { type: 'buyLuckUpgrade', id: 'quick_hands' })
    expect(bought.luck).toBe(raw.luck - 1)
    expect(bought.luckTotal).toBe(raw.luck)
  })

  it('v3 to v4 adds an empty mastery and favour 0, keeps every multiplier, and the loaded luck can go into the sinks straight away', () => {
    const text = fixtures['/tests/fixtures/saves/v3.json']
    if (text === undefined) throw new Error('setup: no v3 fixture')
    const raw = JSON.parse(text) as Record<string, unknown> & {
      luck: number
      luckTotal: number
      luckUpgrades: Record<string, number>
      charms: string[]
      trophies: string[]
      dice: { id: string; level: number; ascensions: number }[]
    }
    expect(raw.luck).toBeGreaterThanOrEqual(content.rules.mastery.baseCost + 1)
    expect(raw['mastery']).toBeUndefined()
    expect(raw['favour']).toBeUndefined()
    const parsed = parseSave(text)
    if (!parsed.ok) throw new Error(`${parsed.reason}: ${parsed.detail}`)
    const { state } = parsed
    expect(state.version).toBe(4)
    expect(state.mastery).toEqual({})
    expect(state.favour).toBe(0)
    expect(state.luck).toBe(raw.luck)
    expect(state.luckTotal).toBe(raw.luckTotal)
    expect(state.luckUpgrades).toEqual(raw.luckUpgrades)
    expect(state.charms).toEqual(raw.charms)
    expect(state.trophies).toEqual(raw.trophies)
    expect(state.dice.map((die) => [die.id, die.level, die.ascensions])).toEqual(raw.dice.map((die) => [die.id, die.level, die.ascensions]))
    // Nothing mastered and no favour: the die multipliers and the luck factor are exactly what the v3 save enjoyed.
    const breakdownBefore = multiplierBreakdown({ ...state, mastery: {}, favour: 0 })
    const breakdownAfter = multiplierBreakdown(state)
    expect(N.eq(breakdownAfter.dice, breakdownBefore.dice)).toBe(true)
    expect(N.eq(breakdownAfter.luck, N.mul(N.add(1, N.mul(content.rules.luck.perPoint, raw.luckTotal)), luckEffects(state).points))).toBe(true)
    // The migration itself, on the raw object, does not mutate its input.
    const migrate = migrations[3]
    if (migrate === undefined) throw new Error('setup: no v3 migration')
    const migrated = migrate(raw) as { version: number; mastery: unknown; favour: unknown; luck: unknown }
    expect(migrated.version).toBe(4)
    expect(migrated.mastery).toEqual({})
    expect(migrated.favour).toBe(0)
    expect(migrated.luck).toBe(raw.luck)
    expect(raw['mastery']).toBeUndefined()
    expect(raw['version']).toBe(3)
    // The loaded save can spend its luck on the sinks straight away: one mastery level on die_1, then one favour.
    const mastered = dispatch(state, { type: 'masterDie', id: 'die_1' })
    expect(mastered).not.toBe(state)
    expect(mastered.mastery).toEqual({ die_1: 1 })
    expect(mastered.luck).toBe(raw.luck - masteryCost(0))
    expect(mastered.luckTotal).toBe(raw.luckTotal)
    const favoured = dispatch(mastered, { type: 'buyFavour' })
    expect(favoured.favour).toBe(1)
    expect(favoured.luck).toBe(mastered.luck - favourCost(0))
    expect(N.gt(multiplierBreakdown(favoured).total, breakdownAfter.total)).toBe(true)
    expect(parseSave(serializeState(favoured)).ok).toBe(true)
  })

  it('v1 to v2 clamps a level past the new cap and names the hand of a saved roll', () => {
    const migrate = migrations[1]
    if (migrate === undefined) throw new Error('setup: no v1 migration')
    const v1 = JSON.parse(fixtures['/tests/fixtures/saves/v1.json'] ?? '{}') as Record<string, unknown>
    const raw = {
      ...v1,
      dice: [
        { id: 'die_1', owned: true, level: 150 },
        { id: 'die_2', owned: true, level: 4 },
        { id: 'die_3', owned: false, level: 0 },
      ],
      lastRoll: { faces: [4, 4], gained: '1.6e1', at: 6000 },
    }
    const migrated = migrate(raw) as { version: number; dice: { level: number; faces: number[] }[]; lastRoll: { hand: string | null }; totalEarnedRun: unknown }
    expect(migrated.version).toBe(2)
    expect(migrated.dice.map((die) => die.level)).toEqual([content.rules.ascension.level, 4, 0])
    expect(migrated.lastRoll.hand).toBe('pair')
    expect(migrated.totalEarnedRun).toBe(v1['totalEarned'])
    // The input is not mutated.
    expect(raw.dice[0]?.level).toBe(150)
    const parsed = parseSave(JSON.stringify(raw))
    expect(parsed.ok, parsed.ok ? '' : parsed.detail).toBe(true)
    if (!parsed.ok) return
    // Auto-ascend takes the capped die from there on the next tick.
    const ticked = advance(parsed.state, 100)
    expect(ticked.dice[0]).toMatchObject({ level: 1, ascensions: 1 })
  })
})

describe('fixture generator', () => {
  it.runIf(process.env['WRITE_SAVE_FIXTURE'] === '1')(`writes tests/fixtures/saves/v${SAVE_VERSION}.json`, () => {
    const state = scriptedGame()
    const text = `${JSON.stringify(JSON.parse(serializeState(state)), null, 2)}\n`
    writeFileSync(fixturePath(SAVE_VERSION), text)
    expect(parseSave(text).ok).toBe(true)
  })

  it('scripts a game that exercises every M3, M4 and M5 system and a partial interval', () => {
    const state = scriptedGame()
    expect(state.rolls).toBeGreaterThanOrEqual(19)
    expect(state.autoRoll.unlocked).toBe(true)
    expect(state.autoRoll.enabled).toBe(true)
    expect(SCRIPTED_LUCK).toBe(luckOnReset({ ...state, totalEarnedRun: N.from(4 * content.rules.luck.threshold) }))
    expect(state.luckTotal).toBe(SCRIPTED_LUCK)
    // Quick Hands 1, Steady Hands 3, one mastery level 2, one favour 1: the seven luck are spent.
    expect(state.luck).toBe(SCRIPTED_LUCK - 1 - 3 - masteryCost(0) - favourCost(0))
    expect(state.luck).toBe(0)
    expect(state.luckUpgrades).toEqual({ quick_hands: 1, steady_hands: 1 })
    expect(state.mastery).toEqual({ die_1: 1 })
    expect(state.favour).toBe(1)
    expect(state.autoLevel).toBe(true)
    expect(state.autoRoll.intervalMs).toBe(autoRollInterval(state))
    expect(state.autoRoll.intervalMs).toBeLessThan(content.rules.autoRoll.baseIntervalMs)
    expect(state.prestiges).toBe(1)
    expect(state.dice[0]?.ascensions).toBe(1)
    // Three bought by the script; auto-level may pick up more on the closing ticks.
    expect(state.dice.filter((die) => die.owned).length).toBeGreaterThanOrEqual(3)
    expect(state.dice[1]?.faceUpgrades).toBe(3)
    expect(state.combos).toEqual({ pair: 2, three_kind: 1 })
    expect(state.charms).toHaveLength(1)
    expect(state.draft.taken).toBe(1)
    expect(state.trophies).toEqual(expect.arrayContaining(['first_roll', 'first_luck', 'second_die', 'third_die', 'first_ascension', 'first_charm']))
    expect(state.newTrophy).toBeNull()
    expect(N.gt(state.stats.bestRoll, 0)).toBe(true)
    expect(state.stats.lastLuckAt).toBeGreaterThan(0)
    expect(state.lastRoll).not.toBeNull()
    expect(state.autoRoll.elapsedMs).toBeGreaterThan(0)
    expect(state.autoRoll.elapsedMs).toBeLessThan(state.autoRoll.intervalMs)
  })
})
