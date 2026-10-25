// Shared helpers for the Playwright specs: clearing and seeding this origin's save (the IndexedDB
// store src/app/platform.ts opens and the localStorage mirror), opening the game and waiting for
// boot, rolling. Storage is edited on a static asset of the same origin, so no page holds the
// database open while it is deleted or written.
import { expect, type Page } from '@playwright/test'

/** The current save's key in src/app/storage.ts; boot writes it to the localStorage mirror right after loading. */
export const SAVE_KEY = 'nice-dice:save'
export const QUARANTINE_PREFIX = 'nice-dice:quarantine:'
export const REPLACED_PREFIX = 'nice-dice:replaced:'
export const backupKey = (minutes: number): string => `nice-dice:backup:${minutes}`
/** The IndexedDB database and object store src/app/platform.ts opens. */
export const DB_NAME = 'nice-dice'
export const STORE_NAME = 'saves'
/** idb-keyval's default database name too, in case the store moves back to it. */
const DATABASES = [DB_NAME, 'keyval-store']
/** N.format output: "0", "12", "999.5", "1.23K", "4.56e21". Never a locale string. */
export const POINTS_PATTERN = /^\d+(\.\d+)?([A-Za-z]+|e\d+)?$/
export const PHONE = { width: 375, height: 812 }
export const MIN_TAP_PX = 44

/** A static asset of the same origin: storage is reachable and no game page holds the database open. */
export async function leaveGame(page: Page): Promise<void> {
  await page.goto('/favicon.svg')
}

/** Wipes this origin's save: the IndexedDB database and the localStorage mirror. */
export async function clearSave(page: Page): Promise<void> {
  await leaveGame(page)
  await page.evaluate(async (names: string[]) => {
    localStorage.clear()
    const drop = (name: string): Promise<void> =>
      new Promise((resolve) => {
        const request = indexedDB.deleteDatabase(name)
        request.onsuccess = () => resolve()
        request.onerror = () => resolve()
        request.onblocked = () => resolve()
      })
    await Promise.all(names.map(drop))
  }, DATABASES)
}

/**
 * Opens the game and waits until boot has settled. The roll button appearing is not enough on its
 * own: boot() replaces the game once the save is loaded (or a new one is created), and a roll
 * clicked before that would be thrown away. Boot saves straight after, and the save's mirror key
 * in localStorage is the signal that the game on screen is the one being ticked and saved.
 */
export async function openGame(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByTestId('roll-button')).toBeVisible()
  await page.waitForFunction((key: string) => localStorage.getItem(key) !== null, SAVE_KEY)
}

export async function rollTimes(page: Page, times: number): Promise<void> {
  const roll = page.getByTestId('roll-button')
  for (let i = 0; i < times; i++) await roll.click()
}

/** Writes raw strings into the IndexedDB save store and, when given, the localStorage mirror. Call on a static asset page. */
export async function seedSaves(page: Page, saves: Record<string, string>, mirror: Record<string, string> = {}): Promise<void> {
  await page.evaluate(
    async ({ dbName, storeName, saves, mirror }) => {
      for (const [key, value] of Object.entries(mirror)) localStorage.setItem(key, value)
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(dbName)
        request.onupgradeneeded = () => request.result.createObjectStore(storeName)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite')
        const store = tx.objectStore(storeName)
        for (const [key, value] of Object.entries(saves)) store.put(value, key)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
      db.close()
    },
    { dbName: DB_NAME, storeName: STORE_NAME, saves, mirror },
  )
}

/** Every string in the IndexedDB save store, by key. */
export async function readSaves(page: Page): Promise<Record<string, string>> {
  return page.evaluate(
    async ({ dbName, storeName }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(dbName)
        request.onupgradeneeded = () => request.result.createObjectStore(storeName)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      const out: Record<string, string> = {}
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly')
        const request = tx.objectStore(storeName).openCursor()
        request.onsuccess = () => {
          const cursor = request.result
          if (cursor === null) return resolve()
          if (typeof cursor.key === 'string' && typeof cursor.value === 'string') out[cursor.key] = cursor.value
          cursor.continue()
        }
        request.onerror = () => reject(request.error)
      })
      db.close()
      return out
    },
    { dbName: DB_NAME, storeName: STORE_NAME },
  )
}

/** The localStorage mirror of the current save, or null. */
export async function readMirror(page: Page): Promise<string | null> {
  return page.evaluate((key: string) => localStorage.getItem(key), SAVE_KEY)
}

/** The same envelope text with savedAt replaced, so a seeded copy reads as written at that moment. */
export function restamp(envelope: string, savedAt: number): string {
  const parsed = JSON.parse(envelope) as Record<string, unknown>
  return JSON.stringify({ ...parsed, savedAt })
}
