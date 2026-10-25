// Tweens the numeric prefix of an N.format string ("12.5K" to "13.1K") over 250 ms with an
// ease-out through requestAnimationFrame, keeping the target's decimals and suffix. Jumps straight
// to the target when the suffix changes (999 to 1.00K), under reduced motion, or when either
// string has no leading number. parseFormatted and formatTween are exported for tests.
// (motion's animate was the plan; the package is not installed, and rAF does the same 15 frames.)
import { useEffect, useRef, useState } from 'react'
import { useReduceMotion } from './useReduceMotion'

export const COUNT_UP_MS = 250

const NUMBER_PREFIX = /^(-?)(\d+)(?:\.(\d+))?(.*)$/

export interface ParsedNumber {
  /** Signed value of the prefix. */
  readonly value: number
  /** Decimals the prefix showed, kept while tweening. */
  readonly decimals: number
  /** Whatever followed the number: "", "K", "e45". */
  readonly suffix: string
}

/** "12.5K" -> { value: 12.5, decimals: 1, suffix: "K" }; null for "NaN", "Infinity" or an empty string. */
export function parseFormatted(text: string): ParsedNumber | null {
  const match = NUMBER_PREFIX.exec(text)
  if (match === null) return null
  const sign = match[1] ?? ''
  const whole = match[2] ?? '0'
  const fraction = match[3]
  const suffix = match[4] ?? ''
  const value = Number(fraction === undefined ? whole : `${whole}.${fraction}`)
  if (!Number.isFinite(value)) return null
  return { value: sign === '-' ? -value : value, decimals: fraction?.length ?? 0, suffix }
}

/** The text at progress t in [0, 1] from one parsed number to another with the same suffix. */
export function formatTween(from: ParsedNumber, to: ParsedNumber, t: number): string {
  const value = from.value + (to.value - from.value) * t
  const text = Math.abs(value).toFixed(to.decimals)
  const negative = value < 0 && Number(text) !== 0
  return (negative ? '-' : '') + text + to.suffix
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

/** The string to render for a formatted number that changes: it counts toward each new target. */
export function useCountUp(targetText: string): string {
  const reduce = useReduceMotion()
  const [text, setText] = useState(targetText)
  /** What is on screen right now, including mid-tween frames, so an interrupted tween continues from where it was. */
  const shown = useRef(targetText)

  useEffect(() => {
    if (shown.current === targetText) return
    const from = parseFormatted(shown.current)
    const to = parseFormatted(targetText)
    if (reduce || from === null || to === null || from.suffix !== to.suffix || typeof requestAnimationFrame !== 'function') {
      shown.current = targetText
      setText(targetText)
      return
    }
    const start = performance.now()
    const step = (now: number): void => {
      const t = Math.min(1, (now - start) / COUNT_UP_MS)
      const next = t >= 1 ? targetText : formatTween(from, to, easeOutCubic(t))
      shown.current = next
      setText(next)
      if (t < 1) frame = requestAnimationFrame(step)
    }
    let frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [targetText, reduce])

  return text
}
