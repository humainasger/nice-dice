// Save storage (CLAUDE.md rule 12): the current save, four rotating backup slots, a quarantine for
// saves this build cannot read and a set-aside copy for every game a reset or import replaced, all
// as { savedAt, payload } envelopes in platform.saveStore. The current save is mirrored into the
// synchronous store too, because browsers abort IndexedDB writes still open at unload; on load the
// newer of the two wins. Every write is wrapped so a full disk becomes a banner, never a crash.
// Export and import strings are 'ND1:' plus lz-string over the core's exact save text.
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import { createInitialState, parseSave, serializeState, type GameState, type ParseSaveReason } from '@/core'
import { platform, type SaveStore } from './platform'
import { newSeed, replaceGame, setSaveStatus, store } from './store'

export const SAVE_KEY = 'nice-dice:save'
export const BACKUP_SLOT_MINUTES = [1, 5, 20, 60] as const
export const BACKUP_PREFIX = 'nice-dice:backup:'
export const QUARANTINE_PREFIX = 'nice-dice:quarantine:'
/** Where the outgoing game goes right before a reset or import replaces it. */
export const REPLACED_PREFIX = 'nice-dice:replaced:'
export const EXPORT_PREFIX = 'ND1:'
const AUTOSAVE_MS = 30_000
const MINUTE_MS = 60_000

export function backupKey(minutes: number): string {
  return `${BACKUP_PREFIX}${minutes}`
}

/** What every stored key holds: when it was written and the core's exact save text. */
export interface Envelope {
  readonly savedAt: number
  readonly payload: string
}

export type LoadResult = { kind: 'none' } | { kind: 'ok'; savedAt: number } | { kind: 'quarantined'; reason: string }
export type ImportResult = { ok: true } | { ok: false; reason: string }
export type DecodeResult = { ok: true; state: GameState } | { ok: false; reason: string }

function saveStore(): SaveStore {
  return platform().saveStore
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** The envelope in a stored string, or null when the text is not one. */
export function readEnvelope(raw: string): Envelope | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const { savedAt, payload } = parsed as Record<string, unknown>
  if (typeof savedAt !== 'number' || !Number.isFinite(savedAt) || typeof payload !== 'string') return null
  return { savedAt, payload }
}

function envelopeText(game: GameState, now: number): string {
  const envelope: Envelope = { savedAt: now, payload: serializeState(game) }
  return JSON.stringify(envelope)
}

function currentEnvelopeText(now: number): string {
  return envelopeText(store.getState().game, now)
}

function describeWriteError(error: unknown, what: string): string {
  const name = typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : ''
  if (name === 'QuotaExceededError') {
    return `Storage is full, so ${what} could not be saved. Export your save to keep it safe.`
  }
  return `Saving ${what} failed: ${messageOf(error)}`
}

/** Writes one key, turning a failure into the save-status banner. Returns whether it succeeded. */
async function write(key: string, value: string, what: string): Promise<boolean> {
  try {
    await saveStore().set(key, value)
    return true
  } catch (error) {
    setSaveStatus({ error: describeWriteError(error, what) })
    return false
  }
}

/** Reads one key; a read failure counts as nothing stored. */
async function read(key: string): Promise<string | null> {
  try {
    return await saveStore().get(key)
  } catch {
    return null
  }
}

/** Best-effort copy of the current save into the synchronous mirror. Silent: the main write reports. */
function mirror(text: string): void {
  try {
    saveStore().sync?.set(SAVE_KEY, text)
  } catch {
    // A full or blocked localStorage: IndexedDB is still the save of record.
  }
}

async function writeSave(): Promise<void> {
  const now = Date.now()
  const text = currentEnvelopeText(now)
  // The save this one replaces is what the backup slots get: a slot always holds a game that was
  // once the main save, so the first save after a reset or import rotates the outgoing game into
  // the due slots, never the fresh one.
  const previous = await read(SAVE_KEY)
  mirror(text)
  if (!(await write(SAVE_KEY, text, 'the game'))) return
  setSaveStatus({ lastSavedAt: now, error: null })
  await rotateBackups(previous, now)
}

/**
 * Each slot keeps the save it last took and takes the previous main save once its own content is
 * older than its minutes (Antimatter Dimensions' pattern). Nothing happens on the very first save,
 * or when the previous main save is unreadable: a quarantined save never spreads into the slots.
 */
async function rotateBackups(previous: string | null, now: number): Promise<void> {
  if (previous === null) return
  const envelope = readEnvelope(previous)
  if (envelope === null) return
  for (const minutes of BACKUP_SLOT_MINUTES) {
    const key = backupKey(minutes)
    const raw = await read(key)
    const current = raw === null ? null : readEnvelope(raw)
    if (current !== null) {
      if (now - current.savedAt < minutes * MINUTE_MS) continue
      if (envelope.savedAt <= current.savedAt) continue
    }
    await write(key, previous, `the ${minutes} minute backup`)
  }
}

let queue: Promise<void> = Promise.resolve()

/** Saves the current game now. Calls are serialised so an autosave and a pagehide save never interleave. */
export function saveNow(): Promise<void> {
  queue = queue.then(writeSave, writeSave)
  return queue
}

/**
 * The save for the moment the page goes away. The mirror is written synchronously, which survives
 * a reload; the normal save is queued behind it and lands when the page stays alive (a tab switch).
 */
export function saveSync(): void {
  mirror(currentEnvelopeText(Date.now()))
  void saveNow()
}

/**
 * Copies an unreadable save to its own quarantine key. An existing copy of the same text is left
 * alone; a different one under the same stamp gets a fresh key, so nothing in quarantine is ever
 * overwritten. Returns the reason for the caller's report.
 */
async function quarantine(raw: string, savedAt: number, reason: string): Promise<string> {
  const key = `${QUARANTINE_PREFIX}${Math.trunc(savedAt)}`
  try {
    const existing = await saveStore().get(key)
    if (existing !== raw) await saveStore().set(existing === null ? key : `${key}:${Date.now()}`, raw)
  } catch (error) {
    setSaveStatus({
      error: `The save could not be read and could not be set aside either: ${messageOf(error)}. Export nothing until you have a backup.`,
    })
  }
  return reason
}

let setAsideCount = 0

/**
 * Keeps the game about to be replaced by a reset or import under its own key, for good. A game
 * with no rolls has nothing to keep. Returns the key, or null when nothing was written.
 */
export async function setAsideCurrent(): Promise<string | null> {
  const { game } = store.getState()
  if (game.rolls === 0) return null
  const now = Date.now()
  const stamped = `${REPLACED_PREFIX}${now}`
  // Two replacements in the same millisecond (tests, a double click) must not share a key.
  const key = (await read(stamped)) === null ? stamped : `${stamped}:${++setAsideCount}`
  const stored = await write(key, envelopeText(game, now), 'a copy of the old game')
  return stored ? key : null
}

interface Candidate {
  readonly source: 'store' | 'mirror'
  readonly raw: string
  readonly envelope: Envelope | null
}

/** Newest first; the main store wins a tie and an envelope that does not even parse sorts last. */
function byAge(a: Candidate, b: Candidate): number {
  const stampA = a.envelope?.savedAt ?? Number.NEGATIVE_INFINITY
  const stampB = b.envelope?.savedAt ?? Number.NEGATIVE_INFINITY
  if (stampA === stampB) return 0
  return stampA > stampB ? -1 : 1
}

/**
 * Reads the current save from the main store and the mirror and loads the newer readable one. On
 * success the game is replaced in the store and savedAt comes back for the offline credit; a mirror
 * that was newer is written back to the main key. A save this build cannot read (damaged, or written
 * by a newer version) is copied to a quarantine key, never changed in place; when nothing readable
 * is left the result is quarantined and ui.save.quarantined is set.
 */
export async function loadSave(): Promise<LoadResult> {
  let storeRaw: string | null = null
  try {
    storeRaw = await saveStore().get(SAVE_KEY)
  } catch (error) {
    setSaveStatus({ error: `Could not read the save: ${messageOf(error)}` })
  }
  let mirrorRaw: string | null = null
  try {
    mirrorRaw = saveStore().sync?.get(SAVE_KEY) ?? null
  } catch {
    mirrorRaw = null
  }
  if (mirrorRaw === storeRaw) mirrorRaw = null
  if (storeRaw === null && mirrorRaw === null) return { kind: 'none' }

  const candidates: Candidate[] = []
  if (storeRaw !== null) candidates.push({ source: 'store', raw: storeRaw, envelope: readEnvelope(storeRaw) })
  if (mirrorRaw !== null) candidates.push({ source: 'mirror', raw: mirrorRaw, envelope: readEnvelope(mirrorRaw) })
  candidates.sort(byAge)

  // Every unreadable copy is set aside before anything is written back over the main key.
  const readable: { candidate: Candidate; envelope: Envelope; state: GameState }[] = []
  let reason = ''
  for (const candidate of candidates) {
    if (candidate.envelope === null) {
      reason = await quarantine(candidate.raw, Date.now(), 'save envelope is not { savedAt, payload }')
      continue
    }
    const parsed = parseSave(candidate.envelope.payload)
    if (!parsed.ok) {
      reason = await quarantine(candidate.raw, candidate.envelope.savedAt, `${parsed.reason}: ${parsed.detail}`)
      continue
    }
    readable.push({ candidate, envelope: candidate.envelope, state: parsed.state })
  }

  const winner = readable[0]
  if (winner === undefined) {
    setSaveStatus({ quarantined: true })
    return { kind: 'quarantined', reason }
  }
  replaceGame(winner.state)
  setSaveStatus({ lastSavedAt: winner.envelope.savedAt })
  if (winner.candidate.source === 'mirror') await write(SAVE_KEY, winner.candidate.raw, 'the game')
  return { kind: 'ok', savedAt: winner.envelope.savedAt }
}

/** 'ND1:' plus URI-safe lz-string over the exact save text of the current game. */
export function exportString(): string {
  return EXPORT_PREFIX + compressToEncodedURIComponent(serializeState(store.getState().game))
}

const PARSE_FAILURE: Record<ParseSaveReason, (what: string, detail: string) => string> = {
  'future-version': (what, detail) => `This ${what} comes from a newer Nice Dice (${detail}). Update the game and try again.`,
  'invalid-json': (what, detail) => `The ${what} is damaged: ${detail}.`,
  schema: (what, detail) => `The ${what} is not a valid save: ${detail}.`,
}

/** A parseSave failure as a sentence a player can act on. what names the thing: "export", "backup". */
export function describeParseFailure(reason: ParseSaveReason, detail: string, what: string = 'export'): string {
  return PARSE_FAILURE[reason](what, detail)
}

/** Decodes an export string to a game state, or a reason a player can act on. Pure; importString applies it. */
export function decodeExport(text: string): DecodeResult {
  const trimmed = text.trim()
  if (!trimmed.startsWith(EXPORT_PREFIX)) {
    return { ok: false, reason: `Not a Nice Dice export: it should start with ${EXPORT_PREFIX}.` }
  }
  const body = trimmed.slice(EXPORT_PREFIX.length)
  if (body === '') return { ok: false, reason: `The export is empty after ${EXPORT_PREFIX}.` }
  let json: string | null
  try {
    json = decompressFromEncodedURIComponent(body)
  } catch {
    json = null
  }
  if (typeof json !== 'string' || json === '') {
    return { ok: false, reason: 'The export could not be decompressed. Check that it was copied whole.' }
  }
  const parsed = parseSave(json)
  if (!parsed.ok) return { ok: false, reason: describeParseFailure(parsed.reason, parsed.detail) }
  return { ok: true, state: parsed.state }
}

/**
 * Replaces the current game with the one in an export string and saves it. The UI confirms first.
 * The outgoing game is set aside under a replaced key before anything changes.
 */
export async function importString(text: string): Promise<ImportResult> {
  const decoded = decodeExport(text)
  if (!decoded.ok) return decoded
  await setAsideCurrent()
  replaceGame(decoded.state)
  setSaveStatus({ quarantined: false })
  await saveNow()
  return { ok: true }
}

/** A new game on a fresh seed, saved right away. The outgoing game is set aside under a replaced key first. */
export async function resetGame(): Promise<void> {
  await setAsideCurrent()
  replaceGame(createInitialState(newSeed()))
  setSaveStatus({ quarantined: false })
  await saveNow()
}

/** Autosave every 30 s, plus the synchronous save when the tab goes hidden and on pagehide. Returns a stop function. */
export function startAutosave(): () => void {
  const timer = setInterval(() => void saveNow(), AUTOSAVE_MS)
  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden') saveSync()
  }
  const onPageHide = (): void => saveSync()
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', onPageHide)
  return () => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', onPageHide)
  }
}

let persistenceRequested = false

/** Asks the browser to keep this origin's storage out of eviction. Once per page; persisted is null when unsupported. */
export async function requestPersistence(): Promise<boolean> {
  if (persistenceRequested) return store.getState().ui.save.persisted === true
  persistenceRequested = true
  const storage = typeof navigator === 'undefined' ? undefined : navigator.storage
  if (storage === undefined || typeof storage.persist !== 'function') {
    setSaveStatus({ persisted: null })
    return false
  }
  try {
    const persisted = await storage.persist()
    setSaveStatus({ persisted })
    return persisted
  } catch {
    setSaveStatus({ persisted: null })
    return false
  }
}
