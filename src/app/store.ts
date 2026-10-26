// The one vanilla Zustand store: { game, ui }. game is the pure GameState (Decimals stay here);
// ui holds app-only state (boot and lock flags, the away summary, settings, save status, the
// put-aside draft, the trophy toast queue). UI components read through useGameStore with primitive
// or string selectors (selectors.ts) and write through the action functions below. Settings persist
// in localStorage on their own key, never inside the game save. Every core transition (send, tick,
// creditOffline) lands through commit, which queues the trophies that change awarded; a store
// subscription clears the draft dismissal whenever the offer itself changes.
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import {
  N,
  advance,
  applyOffline,
  createInitialState,
  dispatch,
  type Command,
  type GameState,
  type OfflineSummary,
} from '@/core'

export { useShallow } from 'zustand/react/shallow'

export type Theme = 'auto' | 'light' | 'dark'

export interface Settings {
  readonly theme: Theme
  readonly reduceMotion: boolean
  /** Sound effects (src/app/audio.ts). On by default; nothing plays before the first user gesture either way. */
  readonly sound: boolean
}

export interface SaveStatus {
  /** Wall-clock time of the last successful write, null before the first one. */
  readonly lastSavedAt: number | null
  /** navigator.storage.persist() result, null until asked. */
  readonly persisted: boolean | null
  /** Short reason the last write failed (for example "quota exceeded"), null when the last write went through. */
  readonly error: string | null
  /** The stored save could not be parsed and was copied to a quarantine key. */
  readonly quarantined: boolean
}

export type RecoveryKind = 'backup' | 'quarantine' | 'replaced'

/** One stored save the recovery dialog can offer: a backup slot, a quarantined copy or a save set aside by reset or import. */
export interface RecoveryCandidate {
  readonly key: string
  readonly kind: RecoveryKind
  /** Short name for the row: "5 min backup slot", "Quarantined save". */
  readonly label: string
  /** When the copy was written; 0 when even that is unknown. */
  readonly savedAt: number
  /** This build can load it. Quarantined copies usually cannot be, unless a newer build wrote them and this one is newer still. */
  readonly readable: boolean
  /** Rolls in the save, 0 when unreadable. */
  readonly rolls: number
  /** Formatted points, empty when unreadable. */
  readonly points: string
  /** Why it cannot be loaded, empty when readable. */
  readonly detail: string
}

/** Set while the stored save could not be read and the player has not yet picked a backup or a fresh start. */
export interface RecoveryState {
  readonly reason: string
  readonly candidates: readonly RecoveryCandidate[]
}

export interface UiState {
  /** boot() finished: the save was loaded and the loop is running. */
  readonly booted: boolean
  /** Another tab holds the game lock; this tab renders the locked screen and runs nothing. */
  readonly locked: boolean
  /** Summary of the absences credited since the player last dismissed the away modal. */
  readonly offline: OfflineSummary | null
  /** The boot found an unreadable save and waits for the player's choice; nothing runs or saves meanwhile. */
  readonly recovery: RecoveryState | null
  readonly settings: Settings
  readonly save: SaveStatus
  /** A new build is installed and waiting; the update banner offers the reload. */
  readonly updateReady: boolean
  /** The player put the open draft aside ("Decide later"). Cleared the moment the offer changes. */
  readonly draftDismissed: boolean
  /** Trophies awarded and not yet shown, oldest first; the toast shows the head and shifts. */
  readonly trophyQueue: readonly string[]
  /** The player tapped Continue on the title screen (src/ui/title); the bench renders from here on. Never saved: the title plays on every load. */
  readonly titleDismissed: boolean
}

export interface StoreState {
  readonly game: GameState
  readonly ui: UiState
}

const SETTINGS_KEY = 'nice-dice:settings'
const THEMES: readonly Theme[] = ['auto', 'light', 'dark']

export const defaultSettings: Settings = { theme: 'auto', reduceMotion: false, sound: true }

/** Settings from their stored JSON text. Anything missing or malformed falls back to the default. Pure, for tests. */
export function parseSettings(raw: string | null): Settings {
  if (raw === null) return defaultSettings
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return defaultSettings
    const theme = 'theme' in parsed ? parsed.theme : undefined
    const reduceMotion = 'reduceMotion' in parsed ? parsed.reduceMotion : undefined
    const sound = 'sound' in parsed ? parsed.sound : undefined
    return {
      theme: THEMES.find((t) => t === theme) ?? defaultSettings.theme,
      reduceMotion: typeof reduceMotion === 'boolean' ? reduceMotion : defaultSettings.reduceMotion,
      sound: typeof sound === 'boolean' ? sound : defaultSettings.sound,
    }
  } catch {
    return defaultSettings
  }
}

function readSettings(): Settings {
  try {
    if (typeof localStorage === 'undefined') return defaultSettings
    return parseSettings(localStorage.getItem(SETTINGS_KEY))
  } catch {
    return defaultSettings
  }
}

function writeSettings(settings: Settings): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Private mode or a full quota: the setting still applies for this session.
  }
}

export function newSeed(): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0] === undefined || buf[0] === 0 ? 1 : buf[0]
}

export const store = createStore<StoreState>(() => ({
  game: createInitialState(newSeed()),
  ui: {
    booted: false,
    updateReady: false,
    locked: false,
    offline: null,
    recovery: null,
    settings: readSettings(),
    save: { lastSavedAt: null, persisted: null, error: null, quarantined: false },
    draftDismissed: false,
    trophyQueue: [],
    titleDismissed: false,
  },
}))

// A dismissed draft stays dismissed only for the offer it was dismissed on: a pick, a reroll, a
// new offer or a loaded game all change the offer's identity and bring the dialog back.
store.subscribe((state, previous) => {
  if (state.ui.draftDismissed && state.game.draft.offer !== previous.game.draft.offer) {
    store.setState({ ui: { ...state.ui, draftDismissed: false } })
  }
})

/** Trophy ids in next that prev did not hold, in award order. Empty when the array is shared. */
function addedTrophies(prev: GameState, next: GameState): string[] {
  if (next.trophies === prev.trophies) return []
  return next.trophies.filter((id) => !prev.trophies.includes(id))
}

/**
 * Lands a core transition in the store. Trophies the change awarded join the toast queue, every
 * one of them, so two trophies from one roll are shown one after another instead of the latest
 * replacing the first. A transition that changed nothing writes nothing.
 */
function commit(prev: GameState, next: GameState): void {
  if (next === prev) return
  const added = addedTrophies(prev, next)
  if (added.length === 0) {
    store.setState({ game: next })
    return
  }
  const { ui } = store.getState()
  const fresh = added.filter((id) => !ui.trophyQueue.includes(id))
  store.setState({ game: next, ui: { ...ui, trophyQueue: [...ui.trophyQueue, ...fresh] } })
}

/** Dispatch a player command. No state write when the command was a no-op. */
export function send(command: Command): void {
  const { game } = store.getState()
  commit(game, dispatch(game, command))
}

/** Advance simulated time by one fixed tick. */
export function tick(dtMs: number): void {
  const { game } = store.getState()
  commit(game, advance(game, dtMs))
}

/**
 * Drops the trophy the toast just showed. When that empties the queue the core's newTrophy is
 * cleared too, so the tab badge goes with the last toast and a reload does not replay it.
 */
export function shiftTrophy(): void {
  const { ui, game } = store.getState()
  if (ui.trophyQueue.length === 0) {
    if (game.newTrophy !== null) send({ type: 'clearNewTrophy' })
    return
  }
  const trophyQueue = ui.trophyQueue.slice(1)
  store.setState({ ui: { ...ui, trophyQueue } })
  if (trophyQueue.length === 0 && game.newTrophy !== null) send({ type: 'clearNewTrophy' })
}

/** Put the open draft aside. The Charms tab offers to reopen it; a new offer reopens it on its own. */
export function dismissDraft(): void {
  setUi({ draftDismissed: true })
}

export function reopenDraft(): void {
  setUi({ draftDismissed: false })
}

/** Leave the title screen for the bench. The title's Continue tap calls this after unlockAudio(). */
export function dismissTitle(): void {
  setUi({ titleDismissed: true })
}

/**
 * Credit an absence through the core's offline policy. With show (the default) the summary goes to
 * the away modal through showOffline; without it the caller holds the summary (the loop does this
 * for gaps in a hidden tab and reports the whole hidden span at once). Returns the summary, or null
 * when nothing was credited.
 */
export function creditOffline(elapsedMs: number, show: boolean = true): OfflineSummary | null {
  const { game } = store.getState()
  const result = applyOffline(game, elapsedMs)
  if (result.state === game) return null
  commit(game, result.state)
  if (show) showOffline(result.summary)
  return result.summary
}

/** Two absences as one: times and rolls add up, points add up. */
export function mergeOfflineSummaries(a: OfflineSummary, b: OfflineSummary): OfflineSummary {
  return {
    elapsedMs: a.elapsedMs + b.elapsedMs,
    simulatedMs: a.simulatedMs + b.simulatedMs,
    estimatedMs: a.estimatedMs + b.estimatedMs,
    rolls: a.rolls + b.rolls,
    gained: N.add(a.gained, b.gained),
  }
}

/**
 * Hand a summary to the away modal. One the player has not dismissed yet absorbs it, so several
 * gaps in a row (a laptop that slept twice, a tab Chrome woke once a minute) read as one absence
 * instead of the last one replacing the rest.
 */
export function showOffline(summary: OfflineSummary): void {
  const { ui } = store.getState()
  const offline = ui.offline === null ? summary : mergeOfflineSummaries(ui.offline, summary)
  store.setState({ ui: { ...ui, offline } })
}

export function dismissOffline(): void {
  setUi({ offline: null })
}

/**
 * Swap in a loaded, imported or fresh game. The old game's pending toasts go with it; a trophy the
 * incoming game had not finished showing (newTrophy set when it was saved) is queued on its own.
 */
export function replaceGame(game: GameState): void {
  const { ui } = store.getState()
  const trophyQueue = game.newTrophy === null ? [] : [game.newTrophy]
  store.setState({ game, ui: { ...ui, trophyQueue } })
}

export function setUi(patch: Partial<UiState>): void {
  const { ui } = store.getState()
  store.setState({ ui: { ...ui, ...patch } })
}

/** Merge a settings change and persist the result under nice-dice:settings. */
export function setSettings(patch: Partial<Settings>): void {
  const { ui } = store.getState()
  const settings: Settings = { ...ui.settings, ...patch }
  store.setState({ ui: { ...ui, settings } })
  writeSettings(settings)
}

export function setSaveStatus(patch: Partial<SaveStatus>): void {
  const { ui } = store.getState()
  store.setState({ ui: { ...ui, save: { ...ui.save, ...patch } } })
}

export function useGameStore<T>(selector: (s: StoreState) => T): T {
  return useStore(store, selector)
}
