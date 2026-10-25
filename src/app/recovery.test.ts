// Recovery candidates against an in-memory saveStore: what each stored copy is described as,
// the order the dialog lists them in, and restoring one into the store. Node environment.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createInitialState, dispatch, serializeState, type GameState } from '@/core'
import { memorySaveStore, setPlatform, webPlatform } from './platform'
import { describeCandidate, kindOfKey, listRecoveryCandidates, restoreFromKey } from './recovery'
import { QUARANTINE_PREFIX, REPLACED_PREFIX, SAVE_KEY, backupKey } from './storage'
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
