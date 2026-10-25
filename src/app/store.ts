// The one vanilla Zustand store. Holds the pure GameState plus app-only fields. UI reads through
// useGameStore with primitive or string selectors (see selectors.ts); writes go through send/tick.
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import {
  advance,
  applyOffline,
  createInitialState,
  dispatch,
  type Command,
  type GameState,
  type OfflineSummary,
} from '@/core'

export interface StoreState {
  readonly game: GameState
  /** Summary of the last credited absence, shown once by the UI. */
  readonly offline: OfflineSummary | null
  readonly savedAt: number | null
}

export function newSeed(): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0] === undefined || buf[0] === 0 ? 1 : buf[0]
}

export const store = createStore<StoreState>(() => ({
  game: createInitialState(newSeed()),
  offline: null,
  savedAt: null,
}))

/** Dispatch a player command. No state write when the command was a no-op. */
export function send(command: Command): void {
  const { game } = store.getState()
  const next = dispatch(game, command)
  if (next !== game) store.setState({ game: next })
}

/** Advance simulated time by one fixed tick. */
export function tick(dtMs: number): void {
  const { game } = store.getState()
  const next = advance(game, dtMs)
  if (next !== game) store.setState({ game: next })
}

/** Credit an absence through the core's offline policy and remember the summary for the UI. */
export function creditOffline(elapsedMs: number): void {
  const { game } = store.getState()
  const result = applyOffline(game, elapsedMs)
  if (result.state !== game) store.setState({ game: result.state, offline: result.summary })
}

export function dismissOffline(): void {
  store.setState({ offline: null })
}

export function useGameStore<T>(selector: (s: StoreState) => T): T {
  return useStore(store, selector)
}
