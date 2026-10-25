// Declarative floating number: whenever `trigger` (or, without one, `text`) changes, `text` rises
// from the anchored element. The first value seen never fires. Wraps useFloatingNumbers for the
// common one-source case; callers with several sources use the hook directly.
import { useEffect, useRef, type RefObject } from 'react'
import { useFloatingNumbers, type FloatTone } from './useFloatingNumbers'

interface FloatingNumberProps {
  /** "+1.2K". Empty text never fires. */
  readonly text: string
  /** The element the number rises from (a die card, the points number). */
  readonly anchor: RefObject<Element | null>
  /** A counter that marks a new event (the roll count). Without it, a change of text fires. */
  readonly trigger?: number
  readonly tone?: FloatTone
}

export function FloatingNumber({ text, anchor, trigger, tone = 'amber' }: FloatingNumberProps) {
  const { spawn, portal } = useFloatingNumbers()
  const key: number | string = trigger ?? text
  const seen = useRef(key)
  useEffect(() => {
    if (seen.current === key) return
    seen.current = key
    spawn(text, anchor.current, tone)
  }, [key, text, anchor, tone, spawn])
  return portal
}
