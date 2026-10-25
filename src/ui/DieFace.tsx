// A d6 face as inline SVG: rounded square plus pips, the favicon geometry. `rollKey` is the roll
// count; when it changes the face wears the die-rolling class for 300 ms and is remounted, so a
// roll landing inside the previous nudge restarts it. Pure presentation, themed by CSS variables.
import { cn } from '@/lib/utils'
import { useRollPulse } from './useRollPulse'

const PIPS: Record<number, ReadonlyArray<readonly [number, number]>> = {
  1: [[32, 32]],
  2: [[19, 19], [45, 45]],
  3: [[19, 19], [32, 32], [45, 45]],
  4: [[19, 19], [45, 19], [19, 45], [45, 45]],
  5: [[19, 19], [45, 19], [32, 32], [19, 45], [45, 45]],
  6: [[19, 19], [45, 19], [19, 32], [45, 32], [19, 45], [45, 45]],
}

interface DieFaceProps {
  /** Face shown, or null for a blank die (not rolled yet, not owned). */
  readonly face: number | null
  readonly size?: number
  /** A counter that changes on every roll; drives the nudge. Leave it out for a static face. */
  readonly rollKey?: number
  readonly className?: string
}

export function DieFace({ face, size = 72, rollKey = 0, className }: DieFaceProps) {
  const rolling = useRollPulse(rollKey)
  const pips = face === null ? [] : (PIPS[face] ?? [])
  return (
    <svg
      key={rolling ? rollKey : -1}
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label={face === null ? 'Die, not rolled yet' : `Die showing ${face}`}
      className={cn('shrink-0', rolling && 'die-rolling', className)}
    >
      <rect x="2" y="2" width="60" height="60" rx="12" className="fill-primary stroke-border" strokeWidth="2" />
      {pips.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="5.5" className="fill-primary-foreground" />
      ))}
    </svg>
  )
}
