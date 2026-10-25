// Wraps its children in a div that shakes 4 px for 200 ms when `trigger` changes (never on the
// first value). The wrapper is not remounted, so children keep their state and focus; a second
// trigger inside the 200 ms rides the running shake.
import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useReduceMotion } from './useReduceMotion'

export const SHAKE_MS = 200

interface ScreenShakeProps {
  /** A counter; every change shakes once. */
  readonly trigger: number
  readonly className?: string
  readonly children?: ReactNode
}

export function ScreenShake({ trigger, className, children }: ScreenShakeProps) {
  const reduce = useReduceMotion()
  /** The trigger value at mount: that one never shakes. */
  const [first] = useState(trigger)
  const [expired, setExpired] = useState<number | null>(null)
  const shaking = trigger !== first && expired !== trigger && !reduce

  useEffect(() => {
    if (!shaking) return
    const timer = setTimeout(() => setExpired(trigger), SHAKE_MS + 50)
    return () => clearTimeout(timer)
  }, [shaking, trigger])

  return <div className={cn(shaking && 'shake', className)}>{children}</div>
}
