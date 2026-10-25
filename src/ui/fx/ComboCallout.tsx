// The combo callout: "FULL HOUSE 9.6x" slams in over the dice when `visibleKey` changes, holds
// for 900 ms, fades for 250 ms and unmounts, with the points gained riding under it when given.
// Colour and size follow the hand rank, 1 (pair) to 7 (five of a kind): the loudest thing on the
// screen, sized so the longest hand name still fits a 390 px phone on one line. Positioned
// absolutely over its parent (which must be position: relative); pass `items-start pt-*` in
// className to pin it to the first row of dice when the parent is taller than the viewport.
// aria-hidden because the last-roll line already carries the hand for screen readers.
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export const CALLOUT_HOLD_MS = 900
export const CALLOUT_FADE_MS = 250

interface ComboCalloutProps {
  /** "Full House x8". Empty text never shows (and clears a callout that is up). */
  readonly text: string
  /** Hand rank 1 to 7; sets colour and size. */
  readonly rank: number
  /** A counter; every change shows the callout again (the roll count that produced the hand). */
  readonly visibleKey: number
  /** A second, smaller line under the hand: the points gained, "+1.2K". */
  readonly detail?: string
  readonly className?: string
}

type Tier = 'low' | 'mid' | 'high' | 'top'

function tierFor(rank: number): Tier {
  if (rank >= 7) return 'top'
  if (rank >= 5) return 'high'
  if (rank >= 3) return 'mid'
  return 'low'
}

/** Phone sizes keep "FOUR OF A KIND 13.2x" inside a 358 px board; sm and up steps every tier up. */
const TIER_CLASS: Record<Tier, string> = {
  low: 'text-2xl text-rank-low sm:text-4xl',
  mid: 'text-3xl text-rank-mid sm:text-5xl',
  high: 'text-3xl text-rank-high sm:text-6xl',
  top: 'text-3xl text-rank-top glow-amber sm:text-6xl',
}

interface Phase {
  readonly key: number
  readonly stage: 'fading' | 'done'
}

export function ComboCallout({ text, rank, visibleKey, detail, className }: ComboCalloutProps) {
  /** The key at mount: that one never shows. */
  const [first] = useState(visibleKey)
  /** Where the current key's timeline stands; null while it is still fresh. */
  const [phase, setPhase] = useState<Phase | null>(null)
  const done = phase !== null && phase.key === visibleKey && phase.stage === 'done'
  const live = visibleKey !== first && text !== '' && !done
  const fading = live && phase !== null && phase.key === visibleKey && phase.stage === 'fading'

  useEffect(() => {
    if (!live) return
    const hold = setTimeout(() => setPhase({ key: visibleKey, stage: 'fading' }), CALLOUT_HOLD_MS)
    const hide = setTimeout(() => setPhase({ key: visibleKey, stage: 'done' }), CALLOUT_HOLD_MS + CALLOUT_FADE_MS)
    return () => {
      clearTimeout(hold)
      clearTimeout(hide)
    }
  }, [live, visibleKey])

  if (!live) return null
  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0 z-10 flex items-center justify-center', className)}>
      <span
        key={visibleKey}
        className={cn(
          'slam-in flex flex-col items-center rounded-2xl bg-card/95 px-5 py-2 font-bold tracking-tight whitespace-nowrap ring-1 ring-foreground/10 shadow-soft',
          TIER_CLASS[tierFor(rank)],
          fading && 'combo-out',
        )}
      >
        <span className="leading-none">{text}</span>
        {detail !== undefined && detail !== '' && (
          <span className="mt-1 text-lg leading-none font-semibold text-foreground/80 tabular sm:text-2xl">{detail}</span>
        )}
      </span>
    </div>
  )
}
