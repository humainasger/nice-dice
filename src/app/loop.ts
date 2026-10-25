// Game loop: fixed-step accumulator at the content tick size, driven by requestAnimationFrame
// while visible and setInterval while hidden (rAF stops entirely in hidden tabs). A gap longer
// than rules.offline.foregroundCatchupMs (tab frozen, laptop asleep) is credited through the
// offline policy instead of spinning the loop. While the tab is hidden those credits stay silent
// (Chrome wakes a long-hidden tab once a minute, each wake one such gap) and the whole hidden span
// is shown as one away summary when the tab is visible again.
import { content } from '@/content'
import { beginHiddenSpan, hiddenSummary, noteHiddenCredit, type HiddenSpan } from './offline'
import { creditOffline, showOffline, store, tick } from './store'

const TICK_MS = content.rules.offline.tickMs
const FOREGROUND_CATCHUP_MS = content.rules.offline.foregroundCatchupMs

/** Start ticking the store. Returns a stop function. */
export function startLoop(): () => void {
  let last = performance.now()
  let acc = 0
  let raf = 0
  let interval: ReturnType<typeof setInterval> | null = null
  let hidden: HiddenSpan | null = null

  const step = (): void => {
    const now = performance.now()
    const dt = Math.max(0, now - last)
    last = now
    if (dt > FOREGROUND_CATCHUP_MS) {
      acc = 0
      if (hidden === null) {
        creditOffline(dt)
      } else {
        const summary = creditOffline(dt, false)
        if (summary !== null) hidden = noteHiddenCredit(hidden, summary)
      }
      return
    }
    acc += dt
    while (acc >= TICK_MS) {
      tick(TICK_MS)
      acc -= TICK_MS
    }
  }
  const frame = (): void => {
    step()
    raf = requestAnimationFrame(frame)
  }
  const stopAll = (): void => {
    cancelAnimationFrame(raf)
    if (interval !== null) clearInterval(interval)
    interval = null
  }
  const onVisibility = (): void => {
    stopAll()
    // Run the pending slice under the driver that was active, so the switch itself loses no time.
    step()
    const now = performance.now()
    if (document.hidden) {
      hidden ??= beginHiddenSpan(store.getState().game, now)
      interval = setInterval(step, TICK_MS)
    } else {
      if (hidden !== null) {
        const summary = hiddenSummary(hidden, store.getState().game, now)
        if (summary !== null) showOffline(summary)
        hidden = null
      }
      raf = requestAnimationFrame(frame)
    }
  }

  document.addEventListener('visibilitychange', onVisibility)
  onVisibility()
  return () => {
    document.removeEventListener('visibilitychange', onVisibility)
    stopAll()
  }
}
