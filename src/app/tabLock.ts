// Second-tab guard (CLAUDE.md rule 12): the first tab holds the Web Lock 'nice-dice' for its whole
// life; a second tab finds it taken and shows the locked screen instead of running the game. Where
// Web Locks is missing, a BroadcastChannel ping asks any open tab to answer within a short window.
const LOCK_NAME = 'nice-dice'
const PING_TIMEOUT_MS = 250

/** Lets go of whatever this module holds (the Web Lock, or the fallback channel). Set once acquired. */
let release: (() => void) | null = null

/** Resolves true when this tab may run the game, false when another tab already does. */
export function acquireTabLock(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.locks !== undefined) return webLock()
  return broadcastLock()
}

function webLock(): Promise<boolean> {
  return new Promise((resolve) => {
    navigator.locks
      .request(LOCK_NAME, { ifAvailable: true }, (lock) => {
        if (lock === null) {
          resolve(false)
          return Promise.resolve()
        }
        resolve(true)
        // Settles only through release(): the lock is otherwise held until the page is unloaded.
        return new Promise<void>((done) => {
          release = done
        })
      })
      .catch(() => {
        // The request itself was refused (an insecure context, a disabled API): fall back to the ping.
        broadcastLock().then(resolve, () => resolve(true))
      })
  })
}

/**
 * Fallback without Web Locks: ping the channel and wait briefly for a holder to answer. Two tabs
 * opening in the same instant can both claim the lock here; the Web Locks path has no such race.
 */
function broadcastLock(): Promise<boolean> {
  if (typeof BroadcastChannel === 'undefined') return Promise.resolve(true)
  const channel = new BroadcastChannel(LOCK_NAME)
  return new Promise((resolve) => {
    let holding = false
    const timer = setTimeout(() => {
      // Nobody answered: this tab takes the lock and answers later pings for its whole life.
      holding = true
      release = () => {
        holding = false
        channel.close()
      }
      resolve(true)
    }, PING_TIMEOUT_MS)
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (event.data === 'ping') {
        if (holding) channel.postMessage('held')
      } else if (event.data === 'held' && !holding) {
        clearTimeout(timer)
        channel.close()
        resolve(false)
      }
    }
    channel.postMessage('ping')
  })
}

// Dev only: when Vite replaces this module the fresh instance asks for the lock again, so the old
// one must let go first or the tab would see itself as "another tab".
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    release?.()
    release = null
  })
}
