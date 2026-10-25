// Storage tests against an in-memory saveStore: round trip, quarantine, export and import, backup
// rotation by age (the slots take the save being replaced, never the new one), the set-aside copy
// a reset or import leaves behind, the quota banner and the offline clamp. Node environment: no
// IndexedDB, no DOM, the platform is swapped for a memory store before every test.
import { compressToEncodedURIComponent } from 'lz-string'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { content } from '@/content'
import { createInitialState, dispatch, serializeState, type GameState } from '@/core'
import { countsAsAway, creditAbsence, elapsedSince } from './offline'
import { memorySaveStore, setPlatform, webPlatform, type SaveStore } from './platform'
import {
  BACKUP_SLOT_MINUTES,
  EXPORT_PREFIX,
  QUARANTINE_PREFIX,
  REPLACED_PREFIX,
  SAVE_KEY,
  backupKey,
  decodeExport,
  exportString,
  importString,
  loadSave,
  resetGame,
  saveNow,
  saveSync,
  type Envelope,
} from './storage'
import { replaceGame, setSaveStatus, store } from './store'

let memory: ReturnType<typeof memorySaveStore>

function envelopeOf(key: string): Envelope {
  const raw = memory.entries.get(key)
  if (raw === undefined) throw new Error(`${key} is not stored`)
  return JSON.parse(raw) as Envelope
}

function played(seed: number, rolls: number): GameState {
  let game = createInitialState(seed)
  for (let i = 0; i < rolls; i++) game = dispatch(game, { type: 'roll' })
  return game
}

const text = (game: GameState): string => serializeState(game)

function withVersion(game: GameState, version: number): string {
  const plain = JSON.parse(text(game)) as Record<string, unknown>
  return JSON.stringify({ ...plain, version })
}

const envelopeText = (savedAt: number, game: GameState): string => JSON.stringify({ savedAt, payload: text(game) })

const replacedKeys = (): string[] => [...memory.entries.keys()].filter((key) => key.startsWith(REPLACED_PREFIX))

beforeEach(() => {
  memory = memorySaveStore()
  setPlatform({ ...webPlatform, saveStore: memory })
  replaceGame(createInitialState(7))
  setSaveStatus({ lastSavedAt: null, persisted: null, error: null, quarantined: false })
})

afterEach(() => {
  setPlatform(webPlatform)
})

describe('saveNow and loadSave', () => {
  it('round trips the game through the save key', async () => {
    const game = played(42, 5)
    replaceGame(game)
    await saveNow()
    const envelope = envelopeOf(SAVE_KEY)
    expect(envelope.payload).toBe(text(game))
    expect(store.getState().ui.save.lastSavedAt).toBe(envelope.savedAt)
    expect(store.getState().ui.save.error).toBeNull()

    replaceGame(createInitialState(1))
    const loaded = await loadSave()
    expect(loaded).toEqual({ kind: 'ok', savedAt: envelope.savedAt })
    expect(text(store.getState().game)).toBe(text(game))
  })

  it('mirrors every save into the synchronous store', async () => {
    await saveNow()
    expect(memory.sync.entries.get(SAVE_KEY)).toBe(memory.entries.get(SAVE_KEY))
  })

  it('reports none when nothing is stored and leaves the game alone', async () => {
    const before = store.getState().game
    expect(await loadSave()).toEqual({ kind: 'none' })
    expect(store.getState().game).toBe(before)
  })

  it('reports a quota error through the save status instead of throwing', async () => {
    const full: SaveStore = {
      ...memory,
      async set() {
        throw Object.assign(new Error('full'), { name: 'QuotaExceededError' })
      },
    }
    setPlatform({ ...webPlatform, saveStore: full })
    await expect(saveNow()).resolves.toBeUndefined()
    expect(store.getState().ui.save.error).toMatch(/storage is full/i)
    expect(store.getState().ui.save.lastSavedAt).toBeNull()
    expect(memory.entries.has(SAVE_KEY)).toBe(false)
  })

  it('keeps saving after a failed write', async () => {
    let fail = true
    const flaky: SaveStore = {
      ...memory,
      async set(key, value) {
        if (fail) throw new Error('disk hiccup')
        memory.entries.set(key, value)
      },
    }
    setPlatform({ ...webPlatform, saveStore: flaky })
    await saveNow()
    expect(store.getState().ui.save.error).toMatch(/disk hiccup/)
    fail = false
    await saveNow()
    expect(store.getState().ui.save.error).toBeNull()
    expect(envelopeOf(SAVE_KEY).payload).toBe(text(store.getState().game))
  })
})

describe('unload save and the mirror', () => {
  const envelope = (savedAt: number, game: GameState): string => JSON.stringify({ savedAt, payload: text(game) })

  it('saveSync writes the mirror before any await and queues the store write', async () => {
    const game = played(3, 2)
    replaceGame(game)
    saveSync()
    expect((JSON.parse(memory.sync.entries.get(SAVE_KEY) ?? '') as Envelope).payload).toBe(text(game))
    expect(memory.entries.has(SAVE_KEY)).toBe(false)
    await saveNow()
    expect(envelopeOf(SAVE_KEY).payload).toBe(text(game))
  })

  it('loads the newer mirror and writes it back to the main key', async () => {
    const older = played(4, 1)
    const newer = played(4, 3)
    memory.entries.set(SAVE_KEY, envelope(1000, older))
    memory.sync.entries.set(SAVE_KEY, envelope(2000, newer))
    expect(await loadSave()).toEqual({ kind: 'ok', savedAt: 2000 })
    expect(text(store.getState().game)).toBe(text(newer))
    expect(memory.entries.get(SAVE_KEY)).toBe(envelope(2000, newer))
    expect(store.getState().ui.save.quarantined).toBe(false)
  })

  it('keeps the main store when the mirror is older', async () => {
    const older = played(4, 1)
    const newer = played(4, 3)
    memory.entries.set(SAVE_KEY, envelope(2000, newer))
    memory.sync.entries.set(SAVE_KEY, envelope(1000, older))
    expect(await loadSave()).toEqual({ kind: 'ok', savedAt: 2000 })
    expect(text(store.getState().game)).toBe(text(newer))
    expect(memory.entries.get(SAVE_KEY)).toBe(envelope(2000, newer))
  })

  it('falls back to the mirror when the main store is damaged, setting the damaged copy aside', async () => {
    const good = played(4, 2)
    memory.entries.set(SAVE_KEY, 'garbage')
    memory.sync.entries.set(SAVE_KEY, envelope(3000, good))
    expect(await loadSave()).toEqual({ kind: 'ok', savedAt: 3000 })
    expect(text(store.getState().game)).toBe(text(good))
    const quarantined = [...memory.entries.entries()].filter(([key]) => key.startsWith(QUARANTINE_PREFIX))
    expect(quarantined.map(([, value]) => value)).toEqual(['garbage'])
    expect(memory.entries.get(SAVE_KEY)).toBe(envelope(3000, good))
    expect(store.getState().ui.save.quarantined).toBe(false)
  })
})

describe('quarantine', () => {
  const quarantineKeys = (): string[] => [...memory.entries.keys()].filter((key) => key.startsWith(QUARANTINE_PREFIX))

  it('sets aside a save that is not an envelope and never changes it in place', async () => {
    memory.entries.set(SAVE_KEY, 'garbage')
    const before = store.getState().game
    const result = await loadSave()
    expect(result.kind).toBe('quarantined')
    expect(quarantineKeys()).toHaveLength(1)
    expect(memory.entries.get(quarantineKeys()[0] ?? '')).toBe('garbage')
    expect(memory.entries.get(SAVE_KEY)).toBe('garbage')
    expect(store.getState().game).toBe(before)
    expect(store.getState().ui.save.quarantined).toBe(true)
  })

  it('sets aside a save from a newer version under its savedAt', async () => {
    const raw = JSON.stringify({ savedAt: 1_700_000_000_000, payload: withVersion(createInitialState(3), 99) })
    memory.entries.set(SAVE_KEY, raw)
    const result = await loadSave()
    expect(result.kind).toBe('quarantined')
    if (result.kind === 'quarantined') expect(result.reason).toMatch(/future-version/)
    expect(memory.entries.get(`${QUARANTINE_PREFIX}1700000000000`)).toBe(raw)
    expect(memory.entries.get(SAVE_KEY)).toBe(raw)
  })

  it('sets aside a payload the schema refuses, with the detail in the reason', async () => {
    const raw = JSON.stringify({ savedAt: 5, payload: JSON.stringify({ version: 1, points: '-5' }) })
    memory.entries.set(SAVE_KEY, raw)
    const result = await loadSave()
    expect(result.kind).toBe('quarantined')
    if (result.kind === 'quarantined') expect(result.reason).toMatch(/schema: .*points/)
    expect(memory.entries.get(`${QUARANTINE_PREFIX}5`)).toBe(raw)
  })

  it('does not overwrite an earlier quarantine entry with the same stamp', async () => {
    memory.entries.set(`${QUARANTINE_PREFIX}5`, 'earlier')
    memory.entries.set(SAVE_KEY, JSON.stringify({ savedAt: 5, payload: 'nope' }))
    await loadSave()
    expect(memory.entries.get(`${QUARANTINE_PREFIX}5`)).toBe('earlier')
    expect(quarantineKeys()).toHaveLength(2)
  })
})

describe('export and import', () => {
  it('round trips through an ND1 string and saves the imported game', async () => {
    const game = played(9, 3)
    replaceGame(game)
    const exported = exportString()
    expect(exported.startsWith(EXPORT_PREFIX)).toBe(true)
    expect(exported).not.toMatch(/\s/)

    replaceGame(createInitialState(1))
    await expect(importString(` \n${exported}\n`)).resolves.toEqual({ ok: true })
    expect(text(store.getState().game)).toBe(text(game))
    expect(envelopeOf(SAVE_KEY).payload).toBe(text(game))
  })

  it('rejects a bad prefix, an empty body and noise with a readable reason, changing nothing', async () => {
    const before = store.getState().game
    for (const input of ['', 'hello', 'nd1:abc', EXPORT_PREFIX, `${EXPORT_PREFIX}!!! not an export !!!`]) {
      const result = await importString(input)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.reason.length).toBeGreaterThan(20)
    }
    expect(store.getState().game).toBe(before)
    expect(memory.entries.has(SAVE_KEY)).toBe(false)
  })

  it('names the cause when the export decompresses but is not a save this build reads', () => {
    const future = decodeExport(EXPORT_PREFIX + compressToEncodedURIComponent(withVersion(createInitialState(2), 99)))
    expect(future.ok).toBe(false)
    if (!future.ok) expect(future.reason).toMatch(/newer Nice Dice/)

    const damaged = decodeExport(EXPORT_PREFIX + compressToEncodedURIComponent('{"version":1,'))
    expect(damaged.ok).toBe(false)
    if (!damaged.ok) expect(damaged.reason).toMatch(/damaged/)

    const invalid = decodeExport(EXPORT_PREFIX + compressToEncodedURIComponent('{"version":1,"rolls":-1}'))
    expect(invalid.ok).toBe(false)
    if (!invalid.ok) expect(invalid.reason).toMatch(/not a valid save/)
  })
})

describe('backup slots', () => {
  it('writes no slot on the first save and copies that save into every slot on the next', async () => {
    const first = played(5, 1)
    replaceGame(first)
    await saveNow()
    for (const minutes of BACKUP_SLOT_MINUTES) expect(memory.entries.has(backupKey(minutes))).toBe(false)

    replaceGame(played(5, 3))
    await saveNow()
    const main = envelopeOf(SAVE_KEY)
    for (const minutes of BACKUP_SLOT_MINUTES) {
      const slot = envelopeOf(backupKey(minutes))
      expect(slot.payload).toBe(text(first))
      expect(slot.savedAt).toBeLessThanOrEqual(main.savedAt)
    }
  })

  it('rotates only the slots older than their minutes, and gives them the save being replaced', async () => {
    const old = played(5, 2)
    const twoMinutesOld = envelopeText(Date.now() - 2 * 60_000, old)
    for (const minutes of BACKUP_SLOT_MINUTES) memory.entries.set(backupKey(minutes), twoMinutesOld)
    const previous = played(5, 3)
    memory.entries.set(SAVE_KEY, envelopeText(Date.now() - 30_000, previous))

    const fresh = played(5, 4)
    replaceGame(fresh)
    await saveNow()

    expect(envelopeOf(SAVE_KEY).payload).toBe(text(fresh))
    expect(envelopeOf(backupKey(1)).payload).toBe(text(previous))
    expect(envelopeOf(backupKey(5)).payload).toBe(text(old))
    expect(envelopeOf(backupKey(20)).payload).toBe(text(old))
    expect(envelopeOf(backupKey(60)).payload).toBe(text(old))
  })

  it('treats a damaged slot as empty', async () => {
    const previous = played(5, 3)
    memory.entries.set(SAVE_KEY, envelopeText(Date.now() - 30_000, previous))
    memory.entries.set(backupKey(60), 'junk')
    await saveNow()
    expect(envelopeOf(backupKey(60)).payload).toBe(text(previous))
  })

  it('never spreads an unreadable main save into the slots', async () => {
    const keep = envelopeText(Date.now() - 2 * 60 * 60_000, played(5, 2))
    for (const minutes of BACKUP_SLOT_MINUTES) memory.entries.set(backupKey(minutes), keep)
    memory.entries.set(SAVE_KEY, 'garbage')
    await saveNow()
    for (const minutes of BACKUP_SLOT_MINUTES) expect(memory.entries.get(backupKey(minutes))).toBe(keep)
  })

  it('never puts an older save over a newer slot', async () => {
    const newer = envelopeText(Date.now() - 90 * 60_000, played(5, 4))
    memory.entries.set(backupKey(60), newer)
    memory.entries.set(SAVE_KEY, envelopeText(Date.now() - 100 * 60_000, played(5, 2)))
    await saveNow()
    expect(memory.entries.get(backupKey(60))).toBe(newer)
  })
})

describe('resetGame', () => {
  it('starts a new game on a new seed, saves it and clears the quarantine flag', async () => {
    replaceGame(played(11, 6))
    setSaveStatus({ quarantined: true })
    await saveNow()
    await resetGame()
    const next = store.getState().game
    expect(next.rolls).toBe(0)
    expect(next.seed).not.toBe(11)
    expect(text(next)).toBe(text(createInitialState(next.seed)))
    expect(envelopeOf(SAVE_KEY).payload).toBe(text(next))
    expect(store.getState().ui.save.quarantined).toBe(false)
  })

  it('keeps the game it replaces: under a replaced key and in every due slot, even after an hour of play', async () => {
    const stale = envelopeText(Date.now() - 61 * 60_000, played(11, 1))
    for (const minutes of BACKUP_SLOT_MINUTES) memory.entries.set(backupKey(minutes), stale)
    const outgoing = played(11, 6)
    replaceGame(outgoing)
    await saveNow()

    await resetGame()

    expect(store.getState().game.rolls).toBe(0)
    for (const minutes of BACKUP_SLOT_MINUTES) expect(envelopeOf(backupKey(minutes)).payload).toBe(text(outgoing))
    expect(replacedKeys()).toHaveLength(1)
    expect(envelopeOf(replacedKeys()[0] ?? '').payload).toBe(text(outgoing))
  })

  it('sets nothing aside for a game with no rolls', async () => {
    await saveNow()
    await resetGame()
    expect(replacedKeys()).toEqual([])
  })
})

describe('importString and the game it replaces', () => {
  it('keeps the outgoing game under a replaced key and in the due slots', async () => {
    const incoming = played(9, 4)
    replaceGame(incoming)
    const exported = exportString()

    const stale = envelopeText(Date.now() - 61 * 60_000, played(11, 1))
    for (const minutes of BACKUP_SLOT_MINUTES) memory.entries.set(backupKey(minutes), stale)
    const outgoing = played(11, 7)
    replaceGame(outgoing)
    await saveNow()

    await expect(importString(exported)).resolves.toEqual({ ok: true })

    expect(text(store.getState().game)).toBe(text(incoming))
    expect(envelopeOf(SAVE_KEY).payload).toBe(text(incoming))
    for (const minutes of BACKUP_SLOT_MINUTES) expect(envelopeOf(backupKey(minutes)).payload).toBe(text(outgoing))
    expect(replacedKeys()).toHaveLength(1)
    expect(envelopeOf(replacedKeys()[0] ?? '').payload).toBe(text(outgoing))
  })

  it('sets nothing aside when the import is refused', async () => {
    replaceGame(played(11, 7))
    await importString('hello')
    expect(replacedKeys()).toEqual([])
  })
})

describe('offline policy', () => {
  const { capMs, minAwayMs } = content.rules.offline

  it('clamps the absence to [0, cap] and ignores a clock that went back', () => {
    expect(elapsedSince(1000, 6000)).toBe(5000)
    expect(elapsedSince(6000, 1000)).toBe(0)
    expect(elapsedSince(0, capMs * 3)).toBe(capMs)
    expect(elapsedSince(Number.NaN, 10)).toBe(0)
  })

  it('counts only gaps above minAwayMs as away', () => {
    expect(countsAsAway(minAwayMs)).toBe(false)
    expect(countsAsAway(minAwayMs + 1)).toBe(true)
  })

  it('credits a long absence into the game and skips a short one', () => {
    const now = 10_000_000
    const before = store.getState().game
    expect(creditAbsence(now - minAwayMs, now)).toBe(0)
    expect(store.getState().game).toBe(before)
    expect(creditAbsence(now - 60_000, now)).toBe(60_000)
    expect(store.getState().game.playMs).toBe(before.playMs + 60_000)
  })
})
