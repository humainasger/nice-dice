// The wall clock as React state, refreshed on an interval, for "saved 12 s ago" lines. Selectors
// stay pure (no Date.now inside the store) and the text keeps moving while the store is idle.
import { useEffect, useState } from 'react'

export function useNow(intervalMs: number = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}
