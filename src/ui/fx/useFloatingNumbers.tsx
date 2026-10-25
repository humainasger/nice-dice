// Floating "+N" numbers without state in the caller: spawn(text, element) measures the element,
// adds a span at its top centre in a fixed, pointer-transparent layer portalled to document.body,
// and removes it after the float-up animation (index.css). Skipped under reduced motion.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { reduceMotionNow } from './useReduceMotion'

/** Matches the float-up keyframes in index.css. */
export const FLOAT_MS = 900

export type FloatTone = 'amber' | 'cool' | 'plain'

export interface FloatingNumbers {
  /** Show `text` rising from `element`. Nothing happens for an empty text, a missing element or reduced motion. */
  readonly spawn: (text: string, element: Element | null | undefined, tone?: FloatTone) => void
  /** Render this once anywhere in the component's tree; it is a portal, so placement does not matter. */
  readonly portal: ReactNode
}

interface Floater {
  readonly id: number
  readonly text: string
  readonly x: number
  readonly y: number
  readonly tone: FloatTone
}

const TONE_CLASS: Record<FloatTone, string> = {
  amber: 'text-amber-text',
  cool: 'text-cool-text',
  plain: 'text-foreground',
}

/** Most floaters alive at once; the oldest go first so a fast auto-roll cannot pile up spans. */
const MAX_ALIVE = 12

export function useFloatingNumbers(): FloatingNumbers {
  const [items, setItems] = useState<readonly Floater[]>([])
  const nextId = useRef(0)
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const timer of pending) clearTimeout(timer)
      pending.clear()
    }
  }, [])

  const spawn = useCallback((text: string, element: Element | null | undefined, tone: FloatTone = 'amber'): void => {
    if (text === '' || element === null || element === undefined || reduceMotionNow()) return
    const rect = element.getBoundingClientRect()
    const id = nextId.current++
    // A small horizontal stagger so back-to-back floats do not stack on one pixel column.
    const stagger = ((id % 5) - 2) * 6
    const floater: Floater = { id, text, x: rect.left + rect.width / 2 + stagger, y: rect.top + rect.height * 0.2, tone }
    setItems((list) => (list.length >= MAX_ALIVE ? [...list.slice(list.length - MAX_ALIVE + 1), floater] : [...list, floater]))
    const timer = setTimeout(() => {
      timers.current.delete(timer)
      setItems((list) => list.filter((f) => f.id !== id))
    }, FLOAT_MS + 50)
    timers.current.add(timer)
  }, [])

  const portal =
    items.length === 0 || typeof document === 'undefined'
      ? null
      : createPortal(
          <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
            {items.map((f) => (
              <span
                key={f.id}
                className={cn('float-up absolute text-lg font-semibold whitespace-nowrap tabular drop-shadow-sm', TONE_CLASS[f.tone])}
                style={{ left: f.x, top: f.y }}
              >
                {f.text}
              </span>
            ))}
          </div>,
          document.body,
        )

  return { spawn, portal }
}
