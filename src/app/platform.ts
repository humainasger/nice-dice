// Platform adapter (CLAUDE.md rule 13): the one interface the shell talks to for portal hooks and
// the save store. The web build is a no-op whose saveStore is idb-keyval plus a synchronous
// localStorage mirror for unload-time saves; a portal SDK drops in behind setPlatform later
// without touching src/core or src/ui. Tests swap in memorySaveStore so the storage layer runs in
// node without IndexedDB.
import { createStore as createIdbStore, del, get, keys, set, type UseStore } from 'idb-keyval'

/**
 * Synchronous last-resort store. Browsers abort IndexedDB transactions still open when a page is
 * unloaded (Chrome does on a reload), so the save written at pagehide goes here as well.
 */
export interface SyncSaveStore {
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
}

/** String key-value persistence. The only thing in the shell that touches durable storage. */
export interface SaveStore {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
  /** Every stored key, so the recovery dialog can list backups and quarantined saves. */
  keys(): Promise<string[]>
  /** Mirror for the current save only; absent where nothing synchronous exists. */
  readonly sync?: SyncSaveStore
}

export type AdKind = 'midgame' | 'rewarded'
export type AdResult = 'shown' | 'skipped' | 'error'

export interface Platform {
  gameplayStart(): void
  gameplayStop(): void
  loadingStart(): void
  loadingStop(): void
  requestAd(kind: AdKind): Promise<AdResult>
  happytime(): void
  readonly saveStore: SaveStore
}

const DB_NAME = 'nice-dice'
const STORE_NAME = 'saves'

/** localStorage as the mirror, or undefined where it is missing or blocked (a sandboxed iframe throws on access). */
function localStorageSyncStore(): SyncSaveStore | undefined {
  try {
    if (typeof localStorage === 'undefined') return undefined
  } catch {
    return undefined
  }
  return {
    get: (key) => localStorage.getItem(key),
    set: (key, value) => localStorage.setItem(key, value),
    remove: (key) => localStorage.removeItem(key),
  }
}

/** idb-keyval behind SaveStore. The database opens on first use, so importing this file in node is safe. */
export function idbSaveStore(): SaveStore {
  let use: UseStore | undefined
  const idb = (): UseStore => (use ??= createIdbStore(DB_NAME, STORE_NAME))
  return {
    async get(key) {
      const value = await get<unknown>(key, idb())
      return typeof value === 'string' ? value : null
    },
    async set(key, value) {
      await set(key, value, idb())
    },
    async remove(key) {
      await del(key, idb())
    },
    async keys() {
      const all = await keys(idb())
      return all.filter((key): key is string => typeof key === 'string')
    },
    sync: localStorageSyncStore(),
  }
}

export interface MemorySaveStore extends SaveStore {
  readonly entries: Map<string, string>
  readonly sync: SyncSaveStore & { readonly entries: Map<string, string> }
}

/** In-memory SaveStore for tests and the sim. `entries` and `sync.entries` are exposed so a test can seed or inspect keys. */
export function memorySaveStore(): MemorySaveStore {
  const entries = new Map<string, string>()
  const syncEntries = new Map<string, string>()
  return {
    entries,
    async get(key) {
      return entries.get(key) ?? null
    },
    async set(key, value) {
      entries.set(key, value)
    },
    async remove(key) {
      entries.delete(key)
    },
    async keys() {
      return [...entries.keys()]
    },
    sync: {
      entries: syncEntries,
      get: (key) => syncEntries.get(key) ?? null,
      set: (key, value) => {
        syncEntries.set(key, value)
      },
      remove: (key) => {
        syncEntries.delete(key)
      },
    },
  }
}

/** The plain web build: no portal, no ads, IndexedDB saves. */
export const webPlatform: Platform = {
  gameplayStart() {},
  gameplayStop() {},
  loadingStart() {},
  loadingStop() {},
  async requestAd() {
    return 'skipped'
  },
  happytime() {},
  saveStore: idbSaveStore(),
}

let active: Platform = webPlatform

/** The platform in use. Storage reads saveStore through this call, never through webPlatform directly. */
export function platform(): Platform {
  return active
}

/** Swap the platform: a portal SDK, or a test double. */
export function setPlatform(next: Platform): void {
  active = next
}
