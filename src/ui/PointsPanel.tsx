// The points pieces of the play card: the readout (the amber total counting up to each new value,
// with the expected gain per roll muted beside it) and the multiplier breakdown, collapsed to
// "x271K total" with a details toggle that opens the five factor chips and the next-die hint. The
// details start open at lg and up and closed on phones. The count-up is decoration for sighted
// players: the tweened number is aria-hidden (no live region either, it changes every roll) and the
// true value sits in a visually hidden span that carries the `points` test id, so screen readers
// and the smoke test never catch a frame of the tween.
import { useState } from 'react'
import { ChevronDownIcon } from 'lucide-react'
import {
  selectAutoEnabled,
  selectBreakdown,
  selectNextUnlockHint,
  selectPerRollText,
  selectPerSecondText,
  selectPointsText,
} from '@/app/selectors'
import { useGameStore, useShallow } from '@/app/store'
import { cn } from '@/lib/utils'
import { useCountUp } from '@/ui/fx'

type ChipTone = 'plain' | 'cool' | 'amber'

const TONE_CLASS: Record<ChipTone, string> = {
  plain: 'bg-card text-foreground ring-foreground/15',
  cool: 'bg-cool/15 text-cool-text ring-cool/30',
  amber: 'bg-amber/15 text-amber-text ring-amber/30',
}

interface ChipProps {
  readonly label: string
  /** Formatted factor; "1" means the factor is not in play yet and the chip stays quiet. */
  readonly value: string
  readonly tone?: ChipTone
  readonly title?: string
}

function Chip({ label, value, tone = 'plain', title }: ChipProps) {
  const active = value !== '1'
  return (
    <li
      title={title}
      className={cn(
        'inline-flex items-baseline gap-1 rounded-full px-2.5 py-1 text-xs ring-1 tabular transition-colors',
        active ? TONE_CLASS[tone] : 'bg-muted/60 text-muted-foreground ring-transparent',
      )}
    >
      <span className="opacity-80">{label}</span>
      <span className="font-semibold">x{value}</span>
    </li>
  )
}

/** Row 1 of the play card: the big number and "948K per roll" (plus per second while auto-roll runs, from sm). */
export function PointsReadout() {
  const pointsText = useGameStore(selectPointsText)
  const points = useCountUp(pointsText)
  const perRoll = useGameStore(selectPerRollText)
  const perSecond = useGameStore(selectPerSecondText)
  const autoEnabled = useGameStore(selectAutoEnabled)

  return (
    <div className="flex flex-wrap items-baseline gap-x-3">
      <h2 id="points-heading" className="sr-only">
        Points
      </h2>
      <p aria-hidden="true" className="text-3xl font-semibold tracking-tight text-amber-text tabular sm:text-points">
        {points}
      </p>
      <span data-testid="points" className="sr-only">
        {pointsText}
      </span>
      <p className="text-sm text-muted-foreground">
        <span className="tabular">{perRoll}</span> per roll
        {autoEnabled && (
          <span className="hidden sm:inline">
            {' · '}
            <span className="tabular">{perSecond}</span> per second
          </span>
        )}
      </p>
    </div>
  )
}

/** Tailwind's lg breakpoint: the details start open there. */
const LG_QUERY = '(min-width: 64rem)'

function startsOpen(): boolean {
  try {
    return typeof window !== 'undefined' && window.matchMedia(LG_QUERY).matches
  } catch {
    return false
  }
}

/** The multiplier total on one line with the `breakdown-toggle`; open, the five factor chips and the next-die hint. */
export function MultiplierBreakdown() {
  const b = useGameStore(useShallow(selectBreakdown))
  const hint = useGameStore(selectNextUnlockHint)
  const [open, setOpen] = useState(startsOpen)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" title="What one face point is worth, on average">
          <span className="font-semibold text-foreground tabular">x{b.total}</span> total
        </p>
        <button
          type="button"
          data-testid="breakdown-toggle"
          aria-expanded={open}
          aria-controls="breakdown-details"
          onClick={() => setOpen((was) => !was)}
          className="-my-2 -mr-2 flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:text-foreground touch-manipulation"
        >
          details
          <ChevronDownIcon aria-hidden="true" className={cn('size-4 transition-transform duration-150', open && 'rotate-180')} />
        </button>
      </div>
      {open && (
        <div id="breakdown-details" className="flex flex-col gap-2">
          <ul aria-label="Multiplier breakdown" className="flex flex-wrap gap-1.5">
            <Chip label="dice" value={b.dice} title="Sum of your dice's output multipliers, mastery included" />
            <Chip label="hand" value={b.combo} title="Expected best-hand multiplier over every roll of your dice" />
            <Chip label="charms" value={b.charms} tone="cool" title="Points charms held this run" />
            <Chip label="luck" value={b.luck} tone="cool" title="Lifetime luck, times Deep Pockets and Fortune's Favour from the Luck tab" />
            <Chip label="marks" value={b.trophies} tone="amber" title="Every mark earned" />
          </ul>
          {hint !== '' && <p className="text-sm text-muted-foreground">{hint}</p>}
        </div>
      )}
    </div>
  )
}
