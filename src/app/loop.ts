// Game loop: fixed-step accumulator at the content tick size, driven by requestAnimationFrame
// while visible and setInterval while hidden (rAF stops entirely in hidden tabs). A gap longer
// than FOREGROUND_CATCHUP_MS (tab frozen, laptop asleep) is credited through the offline policy.
import { content } from '@/content'
import { creditOffline, tick } from './store'

const TICK_MS = content.rules.offline.tickMs
const FOREGROUND_CATCHUP_MS = 60_000

export function startLoop(): () => void {
  let last = performance.now()
  let acc = 0
  let raf = 0
  let interval: ReturnType<typeof setInterval> | null = null

  const step = (): void => {
    const now = performance.now()
    const dt = Math.max(0, now - last)
    last = now
    if (dt > FOREGROUND_CATCHUP_MS) {
      acc = 0
      creditOffline(dt)
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
    last = performance.now()
    if (document.hidden) interval = setInterval(step, TICK_MS)
    else raf = requestAnimationFrame(frame)
  }

  document.addEventListener('visibilitychange', onVisibility)
  onVisibility()
  return () => {
    document.removeEventListener('visibilitychange', onVisibility)
    stopAll()
  }
}
