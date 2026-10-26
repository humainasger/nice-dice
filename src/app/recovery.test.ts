// Recovery candidates against an in-memory saveStore: what each stored copy is described as,
// the order the dialog lists them in, restoring one into the store, and the Settings restore that
// sets the running game aside first. Node environment.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createInitialState, dispatch, parseSave, serializeState, type GameState } from '@/core'
import { memorySaveStore, setPlatform, webPlatform } from './platform'
import { describeCandidate, kindOfKey, listRecoveryCandidates, restoreBackup, restoreFromKey } from './recovery'
import { QUARANTINE_PREFIX, REPLACED_PREFIX, SAVE_KEY, backupKey, readEnvelope } from './storage'
import { replaceGame, store } from './store'

let memory: ReturnType<typeof memorySaveStore>

function played(seed: number, rolls: number): GameState {
  let game = createInitialState(seed)
  for (let i = 0; i < rolls; i++) game = dispatch(game, { type: 'roll' })
  return game
}

const envelope = (savedAt: number, game: GameState): string => JSON.stringify({ savedAt, payload: serializeState(game) })

beforeEach(() => {
  memory = memorySaveStore()
  setPlatform({ ...webPlatform, saveStore: memory })
  replaceGame(createInitialState(7))
})

afterEach(() => {
  setPlatform(webPlatform)
})

describe('describeCandidate', () => {
  it('knows the key families and ignores the main save', () => {
    expect(kindOfKey(backupKey(5))).toBe('backup')
    expect(kindOfKey(`${QUARANTINE_PREFIX}123`)).toBe('quarantine')
    expect(kindOfKey(`${REPLACED_PREFIX}123`)).toBe('replaced')
    expect(kindOfKey(SAVE_KEY)).toBeNull()
    expect(describeCandidate(SAVE_KEY, envelope(1, createInitialState(1)))).toBeNull()
  })

  it('describes a readable backup with its stamp, rolls and points', () => {
    const game = played(4, 3)
    const candidate = describeCandidate(backupKey(5), envelope(5000, game))
    expect(candidate).toMatchObject({ kind: 'backup', label: '5 min backup slot', savedAt: 5000, readable: true, rolls: 3, detail: '' })
    expect(candidate?.points).not.toBe('')
  })

  it('describes an unreadable copy with the reason, taking the stamp from the key when the text is not an envelope', () => {
    const garbage = describeCandidate(`${QUARANTINE_PREFIX}1700000000000`, 'garbage{{{')
    expect(garbage).toMatchObject({ kind: 'quarantine', readable: false, savedAt: 1_700_000_000_000, rolls: 0, points: '' })
    expect(garbage?.detail).toMatch(/not a save envelope/)

    const plain = JSON.parse(serializeState(createInitialState(2))) as Record<string, unknown>
    const future = describeCandidate(`${REPLACED_PREFIX}9`, JSON.stringify({ savedAt: 77, payload: JSON.stringify({ ...plain, version: 99 }) }))
    expect(future).toMatchObject({ kind: 'replaced', readable: false, savedAt: 77 })
    expect(future?.detail).toMatch(/newer Nice Dice/)
  })
})

describe('listRecoveryCandidates', () => {
  it('lists every backup, set-aside and quarantined copy newest first and leaves the main save out', async () => {
    memory.entries.set(SAVE_KEY, 'garbage')
    memory.entries.set(backupKey(1), envelope(3000, played(1, 1)))
    memory.entries.set(backupKey(60), envelope(1000, played(1, 2)))
    memory.entries.set(`${REPLACED_PREFIX}2000`, envelope(2000, played(1, 3)))
    memory.entries.set(`${QUARANTINE_PREFIX}4000`, 'garbage')
    memory.entries.set('unrelated', 'x')

    const listed = await listRecoveryCandidates()
    expect(listed.map((c) => c.key)).toEqual([`${QUARANTINE_PREFIX}4000`, backupKey(1), `${REPLACED_PREFIX}2000`, backupKey(60)])
    expect(listed.map((c) => c.readable)).toEqual([false, true, true, true])
  })

  it('returns nothing when the store cannot list keys', async () => {
    setPlatform({
      ...webPlatform,
      saveStore: {
        ...memory,
        async keys() {
          throw new Error('no keys here')
        },
      },
    })
    expect(await listRecoveryCandidates()).toEqual([])
  })
})

describe('restoreFromKey', () => {
  it('loads a backup into the store and reports its stamp', async () => {
    const game = played(9, 4)
    memory.entries.set(backupKey(20), envelope(1234, game))
    expect(await restoreFromKey(backupKey(20))).toEqual({ ok: true, savedAt: 1234 })
    expect(serializeState(store.getState().game)).toBe(serializeState(game))
  })

  it('refuses a missing, damaged or future copy with a reason and leaves the game alone', async () => {
    const before = store.getState().game
    const plain = JSON.parse(serializeState(createInitialState(2))) as Record<string, unknown>
    memory.entries.set(backupKey(1), 'junk')
    memory.entries.set(backupKey(5), JSON.stringify({ savedAt: 1, payload: JSON.stringify({ ...plain, version: 99 }) }))
    for (const key of [backupKey(60), backupKey(1), backupKey(5)]) {
      const result = await restoreFromKey(key)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.reason.length).toBeGreaterThan(20)
    }
    expect(store.getState().game).toBe(before)
  })
})

describe('restoreBackup', () => {
  it('sets the running game aside, loads the copy, credits the time since its stamp and saves', async () => {
    const now = 1_700_000_000_000
    const current = played(31, 3)
    replaceGame(current)
    const backup = played(32, 8)
    memory.entries.set(backupKey(20), envelope(now - 1_200_000, backup))

    const result = await restoreBackup(backupKey(20), now)
    expect(result).toEqual({ ok: true, savedAt: now - 1_200_000, creditedMs: 1_200_000 })

    // The copy is in the store with the 20 minutes credited on top (no auto-roll yet, so only time moves).
    const { game } = store.getState()
    expect(game.seed).toBe(backup.seed)
    expect(game.rolls).toBe(8)
    expect(game.playMs).toBe(backup.playMs + 1_200_000)

    // The game that was running is set aside under a replaced key, unchanged.
    const replacedKeys = [...memory.entries.keys()].filter((key) => key.startsWith(REPLACED_PREFIX))
    expect(replacedKeys).toHaveLength(1)
    const setAside = readEnvelope(memory.entries.get(replacedKeys[0] ?? '') ?? '')
    expect(setAside?.payload).toBe(serializeState(current))

    // The main save holds the restored game.
    const saved = readEnvelope(memory.entries.get(SAVE_KEY) ?? '')
    expect(saved).not.toBeNull()
    const parsed = saved === null ? null : parseSave(saved.payload)
    expect(parsed?.ok && parsed.state.rolls).toBe(8)
    expect(store.getState().ui.offline).toBeNull()
  })

  it('leaves the running game in place when the copy cannot be read', async () => {
    const current = played(33, 2)
    replaceGame(current)
    memory.entries.set(backupKey(5), 'junk')
    const result = await restoreBackup(backupKey(5))
    expect(result.ok).toBe(false)
    expect(store.getState().game).toBe(current)
    expect(memory.entries.has(SAVE_KEY)).toBe(false)
  })
})
