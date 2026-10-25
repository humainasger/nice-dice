// Dev-shell persistence: a localStorage envelope { savedAt, payload } around the core's exact
// save text, with the absence credited on load. M2 replaces this with the IndexedDB layer
// (backup slots, quarantine, export and import) described in docs/plans/active/m2-demo.md.
import { parseSave, serializeState } from '@/core'
import { creditOffline, store } from './store'

const KEY = 'nice-dice:dev-save'
const MIN_AWAY_MS = 10_000
const AUTOSAVE_MS = 10_000

interface Envelope {
  readonly savedAt: number
  readonly payload: string
}

export function saveNow(): void {
  try {
    const env: Envelope = { savedAt: Date.now(), payload: serializeState(store.getState().game) }
    localStorage.setItem(KEY, JSON.stringify(env))
    store.setState({ savedAt: env.savedAt })
  } catch {
    // Quota or a blocked storage: the dev shell keeps running without a save.
  }
}

export function loadSave(): 'none' | 'ok' | 'bad' {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(KEY)
  } catch {
    return 'none'
  }
  if (raw === null) return 'none'
  try {
    const env = JSON.parse(raw) as Partial<Envelope>
    if (typeof env.payload !== 'string') return 'bad'
    const parsed = parseSave(env.payload)
    if (!parsed.ok) return 'bad'
    const savedAt = typeof env.savedAt === 'number' ? env.savedAt : null
    store.setState({ game: parsed.state, savedAt })
    if (savedAt !== null) {
      const elapsed = Date.now() - savedAt
      if (elapsed > MIN_AWAY_MS) creditOffline(elapsed)
    }
    return 'ok'
  } catch {
    return 'bad'
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}

export function startAutosave(): () => void {
  const id = setInterval(saveNow, AUTOSAVE_MS)
  const onVisibility = (): void => {
    if (document.hidden) saveNow()
  }
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', saveNow)
  return () => {
    clearInterval(id)
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', saveNow)
  }
}
