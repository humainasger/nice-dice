// A d6 face as inline SVG: an ivory rounded square with ink pips, the favicon geometry. `face` is
// the side (1 to 6) and picks the pip layout; `value` is what is printed on that side, and when it
// differs (a raised face) the value is drawn as an amber numeral instead of pips. `rollKey` is the
// roll count; when it changes the face wears the die-tumble class for 400 ms and is remounted, so
// a roll landing inside the previous tumble restarts it. Pure presentation, themed by CSS variables.
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
  /** Side shown (1 to 6), or null for a blank die (not rolled yet, not owned). */
  readonly face: number | null
  /** Value printed on that side; defaults to the side itself. A different value draws as an amber numeral. */
  readonly value?: number | null
  readonly size?: number
  /** A counter that changes on every roll; drives the tumble. Leave it out for a static face. */
  readonly rollKey?: number
  readonly className?: string
}

export function DieFace({ face, value = face, size = 72, rollKey = 0, className }: DieFaceProps) {
  const rolling = useRollPulse(rollKey)
  const raised = face !== null && value !== null && value !== face
  const pips = face === null || raised ? [] : (PIPS[face] ?? [])
  const label = face === null ? 'Die, not rolled yet' : raised ? `Die showing ${value}, a raised face` : `Die showing ${face}`
  return (
    <svg
      key={rolling ? rollKey : -1}
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label={label}
      className={cn('shrink-0 drop-shadow-sm', rolling && 'die-tumble', className)}
    >
      <rect x="2" y="2" width="60" height="60" rx="12" className="fill-die stroke-die-edge" strokeWidth="2" />
      {pips.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="5.5" className="fill-die-pip" />
      ))}
      {raised && (
        <text x="32" y="34" textAnchor="middle" dominantBaseline="central" fontSize="30" fontWeight="700" className="fill-die-raised tabular">
          {value}
        </text>
      )}
    </svg>
  )
}
