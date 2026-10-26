// Recovery after an unreadable save, and the Backups browser in Settings: list every stored copy a
// player could go back to (the backup slots, quarantined saves, games set aside by reset or import)
// with what this build can tell about each, and load one into the store. boot() shows the list
// when loadSave came back quarantined and waits for the choice; nothing runs or saves until then.
// restoreBackup is the Settings path for a game that is running: it sets the current game aside
// first, the way a reset does, so a restore is never a one-way door.
import { N, parseSave } from '@/core'
import { countsAsAway, elapsedSince } from './offline'
import { platform } from './platform'
import {
  BACKUP_PREFIX,
  QUARANTINE_PREFIX,
  REPLACED_PREFIX,
  describeParseFailure,
  messageOf,
  readEnvelope,
  saveNow,
  setAsideCurrent,
} from './storage'
import { creditOffline, replaceGame, setSaveStatus, type RecoveryCandidate, type RecoveryKind } from './store'

export type RestoreResult = { ok: true; savedAt: number } | { ok: false; reason: string }

/** What restoreBackup did: the copy's stamp and how much time since it was credited as away (0 when none was). */
export type RestoreBackupResult = { ok: true; savedAt: number; creditedMs: number } | { ok: false; reason: string }

/** Rows the dialog lists at most; older copies stay in storage but off the screen. */
export const MAX_CANDIDATES = 12

/** Which family a stored key belongs to, or null for the main save and anything else. */
export function kindOfKey(key: string): RecoveryKind | null {
  if (key.startsWith(BACKUP_PREFIX)) return 'backup'
  if (key.startsWith(QUARANTINE_PREFIX)) return 'quarantine'
  if (key.startsWith(REPLACED_PREFIX)) return 'replaced'
  return null
}

function labelOf(key: string, kind: RecoveryKind): string {
  switch (kind) {
    case 'backup':
      return `${key.slice(BACKUP_PREFIX.length)} min backup slot`
    case 'quarantine':
      return 'Quarantined save'
    case 'replaced':
      return 'Set aside by reset or import'
  }
}

/** The stamp a quarantine or replaced key carries, 0 for a backup slot or a malformed key. */
function stampOf(key: string, kind: RecoveryKind): number {
  if (kind === 'backup') return 0
  const prefix = kind === 'quarantine' ? QUARANTINE_PREFIX : REPLACED_PREFIX
  const stamp = Number(key.slice(prefix.length).split(':')[0])
  return Number.isFinite(stamp) ? stamp : 0
}

/** What this build can say about one stored copy. Pure. */
export function describeCandidate(key: string, raw: string): RecoveryCandidate | null {
  const kind = kindOfKey(key)
  if (kind === null) return null
  const base = { key, kind, label: labelOf(key, kind), rolls: 0, points: '' }
  const envelope = readEnvelope(raw)
  if (envelope === null) {
    return { ...base, savedAt: stampOf(key, kind), readable: false, detail: 'not a save envelope' }
  }
  const parsed = parseSave(envelope.payload)
  if (!parsed.ok) {
    return { ...base, savedAt: envelope.savedAt, readable: false, detail: describeParseFailure(parsed.reason, parsed.detail, 'save') }
  }
  return {
    ...base,
    savedAt: envelope.savedAt,
    readable: true,
    rolls: parsed.state.rolls,
    points: N.format(parsed.state.points),
    detail: '',
  }
}

/** Newest first; readable before unreadable at the same stamp. */
export function byRecency(a: RecoveryCandidate, b: RecoveryCandidate): number {
  if (a.savedAt !== b.savedAt) return b.savedAt - a.savedAt
  if (a.readable !== b.readable) return a.readable ? -1 : 1
  return a.key < b.key ? -1 : a.key > b.key ? 1 : 0
}

/** Every backup, quarantined and set-aside copy in storage, newest first, at most MAX_CANDIDATES. Read failures are skipped. */
export async function listRecoveryCandidates(): Promise<RecoveryCandidate[]> {
  const { saveStore } = platform()
  let keys: string[]
  try {
    keys = await saveStore.keys()
  } catch {
    return []
  }
  const out: RecoveryCandidate[] = []
  for (const key of keys) {
    if (kindOfKey(key) === null) continue
    let raw: string | null
    try {
      raw = await saveStore.get(key)
    } catch {
      continue
    }
    if (raw === null) continue
    const candidate = describeCandidate(key, raw)
    if (candidate !== null) out.push(candidate)
  }
  return out.sort(byRecency).slice(0, MAX_CANDIDATES)
}

/** Loads the save under key into the store. The caller saves and credits the time since savedAt. */
export async function restoreFromKey(key: string): Promise<RestoreResult> {
  let raw: string | null
  try {
    raw = await platform().saveStore.get(key)
  } catch (error) {
    return { ok: false, reason: `That backup could not be read: ${messageOf(error)}.` }
  }
  if (raw === null) return { ok: false, reason: 'That backup is no longer in storage.' }
  const envelope = readEnvelope(raw)
  if (envelope === null) return { ok: false, reason: 'That backup is not a save envelope.' }
  const parsed = parseSave(envelope.payload)
  if (!parsed.ok) return { ok: false, reason: describeParseFailure(parsed.reason, parsed.detail, 'backup') }
  replaceGame(parsed.state)
  return { ok: true, savedAt: envelope.savedAt }
}

/**
 * Restores a stored copy while the game is running (the Backups section in Settings). The current
 * game is set aside under a replaced key first, exactly as before a reset, then the copy is loaded,
 * the time since its stamp is credited through the offline policy (silently: the Settings dialog is
 * open, so the result line reports it instead of the away modal) and the result is saved. A copy
 * that cannot be loaded leaves the current game in place; the set-aside copy of it is harmless.
 */
export async function restoreBackup(key: string, now: number = Date.now()): Promise<RestoreBackupResult> {
  await setAsideCurrent()
  const restored = await restoreFromKey(key)
  if (!restored.ok) return restored
  const elapsed = elapsedSince(restored.savedAt, now)
  const creditedMs = countsAsAway(elapsed) && creditOffline(elapsed, false) !== null ? elapsed : 0
  setSaveStatus({ quarantined: false })
  await saveNow()
  return { ok: true, savedAt: restored.savedAt, creditedMs }
}
