// Watches a roll counter and reports true for a short window after it changes, so a die can wear
// its roll animation class. The first value seen never pulses: mounting after a load is not a roll.
import { useEffect, useRef, useState } from 'react'

/** Length of the die roll nudge, matching the die-roll keyframes in index.css. */
export const ROLL_PULSE_MS = 300

export function useRollPulse(key: number, durationMs: number = ROLL_PULSE_MS): boolean {
  const [pulsing, setPulsing] = useState(false)
  const seen = useRef(key)
  useEffect(() => {
    if (seen.current === key) return
    seen.current = key
    setPulsing(true)
    const timer = setTimeout(() => setPulsing(false), durationMs)
    return () => clearTimeout(timer)
  }, [key, durationMs])
  return pulsing
}
