// The play card: the one card at the top of the bench that holds the whole loop (M6 mobile brief,
// "Play card"): the points number with the expected gain per roll, the Roll button with the
// auto-roll control beside it, the last roll as mini faces with the hand and the gain, and the
// multiplier total with its details toggle. Below lg the card is sticky under the header (which is
// sticky too, so the offset is the header's height) on a solid background with a bottom border, so
// the bench scrolls under it; at lg and up it sits in flow. The combo callout hangs under the
// wrapper (BenchCallout.tsx) so it stays over the visible dice at any scroll depth. The pieces live
// in PointsPanel.tsx, RollControls.tsx and LastRoll.tsx.
import { selectAutoUnlocked } from '@/app/selectors'
import { useGameStore } from '@/app/store'
import { BenchCallout } from './BenchCallout'
import { LastRollRow } from './LastRoll'
import { MultiplierBreakdown, PointsReadout } from './PointsPanel'
import { AutoRollControl, RollButton } from './RollControls'

export function PlayCard() {
  const autoUnlocked = useGameStore(selectAutoUnlocked)

  // top = the sticky header's height below lg: its top padding (1rem or the safe area) plus 44 px
  // of content and 8 px of bottom padding. Keep it in step with GameScreen.tsx. The wrapper stays
  // positioned at lg (relative, in flow) so the callout's slot has a box to hang from.
  return (
    <div className="sticky top-[calc(max(1rem,env(safe-area-inset-top))+3.25rem)] z-20 border-b border-border bg-background pb-2 lg:relative lg:border-0 lg:pb-0">
      <section
        aria-labelledby="points-heading"
        className="flex flex-col gap-3 rounded-xl bg-card px-4 py-3 text-card-foreground ring-1 ring-foreground/10 shadow-soft sm:px-5 sm:py-4"
      >
        <PointsReadout />
        <div className="flex items-center gap-3">
          <RollButton className="min-w-0 flex-1" />
          {autoUnlocked && <AutoRollControl className="w-20 shrink-0 sm:w-auto sm:min-w-44" />}
        </div>
        {!autoUnlocked && <p className="-mt-1 text-sm text-muted-foreground">Level a die to unlock auto-roll</p>}
        <LastRollRow />
        <MultiplierBreakdown />
      </section>
      <BenchCallout />
    </div>
  )
}
