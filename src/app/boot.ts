// Boot sequence (docs/plans/active/m2-demo.md): theme, refuse a second tab, load the save or start
// a new game, credit the time away, then start the loop, autosave and the persistence request.
// An unreadable save stops here instead: the recovery dialog lists the backups and nothing runs
// or saves until the player picks one or a fresh start (finishRecovery). Runs once; the React
// StrictMode double effect hits the guard. Under Vite HMR the old instance saves, stops its loop
// and autosave and lets the fresh module boot again.
import { createInitialState } from '@/core'
import { startLoop } from './loop'
import { creditAbsence } from './offline'
import { platform } from './platform'
import { listRecoveryCandidates, restoreFromKey, type RestoreResult } from './recovery'
import { loadSave, requestPersistence, saveNow, saveSync, startAutosave } from './storage'
import { newSeed, replaceGame, setSaveStatus, setUi, store } from './store'
import { acquireTabLock } from './tabLock'
import { startTheme } from './theme'

export type RecoveryChoice = { kind: 'fresh' } | { kind: 'restore'; key: string }

let started = false
let stopTheme: (() => void) | null = null
let stop: (() => void) | null = null

export async function boot(): Promise<void> {
  if (started) return
  started = true
  stopTheme = startTheme()
  stop = stopTheme
  platform().loadingStart()

  if (!(await acquireTabLock())) {
    setUi({ locked: true })
    platform().loadingStop()
    return
  }

  const loaded = await loadSave()
  if (loaded.kind === 'quarantined') {
    // The unreadable save sits in quarantine (loadSave copied it). The player chooses between the
    // stored copies and a fresh start before the loop or autosave can touch the main key.
    const candidates = await listRecoveryCandidates()
    setUi({ recovery: { reason: loaded.reason, candidates } })
    platform().loadingStop()
    return
  }
  if (loaded.kind === 'ok') {
    creditAbsence(loaded.savedAt)
  } else {
    // No save: a brand new game, saved at once so the key exists.
    replaceGame(createInitialState(newSeed()))
    void saveNow()
  }
  run()
}

/**
 * The player's answer to the recovery dialog: a fresh game, or one of the stored copies. On
 * success the game is saved, the loop starts and the dialog closes; a failed restore reports why
 * and leaves the dialog up.
 */
export async function finishRecovery(choice: RecoveryChoice): Promise<RestoreResult> {
  if (store.getState().ui.recovery === null) return { ok: false, reason: 'Nothing to recover.' }
  let savedAt = Date.now()
  if (choice.kind === 'restore') {
    const restored = await restoreFromKey(choice.key)
    if (!restored.ok) return restored
    savedAt = restored.savedAt
  } else {
    replaceGame(createInitialState(newSeed()))
  }
  creditAbsence(savedAt)
  setSaveStatus({ quarantined: false })
  setUi({ recovery: null })
  void saveNow()
  run()
  return { ok: true, savedAt }
}

/** The running state: loop, autosave, persistence request, booted flag. */
function run(): void {
  const stopLoop = startLoop()
  const stopAutosave = startAutosave()
  stop = () => {
    stopLoop()
    stopAutosave()
    stopTheme?.()
  }
  void requestPersistence()
  platform().loadingStop()
  platform().gameplayStart()
  setUi({ booted: true })
}

// Dev only: Vite replaces this module when it or an import changes. Save first so the fresh boot
// loads the current game, then stop the old loop and autosave so nothing ticks twice. A boot that
// is still waiting on the recovery dialog holds only the placeholder game and must not save it.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (started && store.getState().ui.booted) saveSync()
    stop?.()
  })
}
