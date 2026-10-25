// Roll-time presentation helpers shared by the dice, the last-roll line and the combo rows: the
// pulse hook that reports true for a short window after a roll counter changes (so a die can wear
// its tumble class, or a card its hand ring), and the hand-rank colour tables. The first value the
// hook sees never pulses: mounting after a load is not a roll.
import { useEffect, useRef, useState } from 'react'

/** Length of the die tumble, matching the die-tumble keyframes in index.css (the brief's 400 ms). */
export const ROLL_PULSE_MS = 400

/** Text colour per hand rank 0 (none) to 7 (five of a kind): pair muted, three of a kind cool, full house amber, five of a kind gold. */
export const RANK_TEXT_CLASS: readonly string[] = [
  '',
  'text-rank-low',
  'text-rank-low',
  'text-rank-mid',
  'text-rank-mid',
  'text-rank-high',
  'text-rank-high',
  'text-rank-top',
]

/** Ring colour per hand rank, for the dice that form the hand. */
export const RANK_RING_CLASS: readonly string[] = [
  '',
  'ring-rank-low',
  'ring-rank-low',
  'ring-rank-mid',
  'ring-rank-mid',
  'ring-rank-high',
  'ring-rank-high',
  'ring-rank-top',
]

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
