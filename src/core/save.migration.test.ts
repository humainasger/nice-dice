// Fixture saves from every historical version load and survive a serialize/parse round trip, and
// the migration map covers every version below SAVE_VERSION. The last test is the generator: run
// WRITE_SAVE_FIXTURE=1 pnpm exec vitest run src/core/save.migration.test.ts to (re)write
// tests/fixtures/saves/v<SAVE_VERSION>.json from the scripted game below, so a version bump
// always leaves a fixture for the version it replaces.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { advance } from './advance'
import { dispatch } from './commands'
import { createInitialState, migrations, parseSave, SAVE_VERSION, serializeState } from './save'
import type { GameState } from './state'

const fixtures = import.meta.glob('/tests/fixtures/saves/v*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const versionOf = (path: string): number => Number(/\/v(\d+)\.json$/.exec(path)?.[1])
const fixturePath = (version: number): string =>
  fileURLToPath(new URL(`../../tests/fixtures/saves/v${version}.json`, import.meta.url))

/** createInitialState(1), a dozen manual rolls, a max level-up (unlocks auto-roll), a minute of ticks, a toggle, a roll, a partial interval. */
function scriptedGame(): GameState {
  let state = createInitialState(1)
  for (let i = 0; i < 12; i++) state = dispatch(state, { type: 'roll' })
  state = dispatch(state, { type: 'levelDie', id: 'die_1', count: 'max' })
  for (let i = 0; i < 60; i++) state = advance(state, 100)
  state = dispatch(state, { type: 'setAutoRoll', enabled: false })
  state = dispatch(state, { type: 'roll' })
  state = dispatch(state, { type: 'setAutoRoll', enabled: true })
  return advance(state, 2500)
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
})

describe('fixture generator', () => {
  it.runIf(process.env['WRITE_SAVE_FIXTURE'] === '1')(`writes tests/fixtures/saves/v${SAVE_VERSION}.json`, () => {
    const state = scriptedGame()
    const text = `${JSON.stringify(JSON.parse(serializeState(state)), null, 2)}\n`
    writeFileSync(fixturePath(SAVE_VERSION), text)
    expect(parseSave(text).ok).toBe(true)
  })

  it('scripts a game that exercises rolls, levels, the unlock and a partial interval', () => {
    const state = scriptedGame()
    expect(state.rolls).toBeGreaterThanOrEqual(14)
    expect(state.autoRoll.unlocked).toBe(true)
    expect(state.autoRoll.enabled).toBe(true)
    // 60 ticks of 100 ms leave 1000 ms in the interval; the final advance adds 2500.
    expect(state.autoRoll.elapsedMs).toBe(3500)
    expect(state.lastRoll).not.toBeNull()
    expect(state.dice[0]?.level).toBeGreaterThanOrEqual(2)
  })
})
