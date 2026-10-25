// The points panel: the big formatted total (no live region, it changes every roll), the expected
// gain per roll and per second, and the next die to buy.
import {
  selectAutoEnabled,
  selectNextUnlockText,
  selectPerRollText,
  selectPerSecondText,
  selectPointsText,
} from '@/app/selectors'
import { useGameStore } from '@/app/store'

export function PointsPanel() {
  const points = useGameStore(selectPointsText)
  const perRoll = useGameStore(selectPerRollText)
  const perSecond = useGameStore(selectPerSecondText)
  const autoEnabled = useGameStore(selectAutoEnabled)
  const nextUnlock = useGameStore(selectNextUnlockText)

  return (
    <section aria-labelledby="points-heading" className="rounded-xl bg-card px-5 py-4 text-card-foreground ring-1 ring-foreground/10">
      <h2 id="points-heading" className="text-sm text-muted-foreground">
        Points
      </h2>
      <p data-testid="points" className="text-5xl font-semibold tracking-tight tabular-nums sm:text-6xl">
        {points}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        <span className="tabular-nums">{perRoll}</span> expected per roll
        {autoEnabled && (
          <>
            {' · '}
            <span className="tabular-nums">{perSecond}</span> per second
          </>
        )}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{nextUnlock}</p>
    </section>
  )
}
