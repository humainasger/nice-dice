// The points panel: the big amber total counting up to each new value, the expected gain per roll
// and per second, the multiplier breakdown as chips (dice with mastery, expected hand, charms,
// luck with favour, marks, total) and the next die to carve. The count-up is decoration for sighted players: the tweened
// number is aria-hidden (no live region either, it changes every roll) and the true value sits in
// a visually hidden span that carries the `points` test id, so screen readers and the smoke test
// never catch a frame of the tween.
import {
  selectAutoEnabled,
  selectBreakdown,
  selectNextUnlockText,
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
  readonly strong?: boolean
}

function Chip({ label, value, tone = 'plain', title, strong = false }: ChipProps) {
  const active = value !== '1'
  return (
    <li
      title={title}
      className={cn(
        'inline-flex items-baseline gap-1 rounded-full px-2.5 py-1 text-xs ring-1 tabular transition-colors',
        strong
          ? 'bg-foreground text-background ring-foreground'
          : active
            ? TONE_CLASS[tone]
            : 'bg-muted/60 text-muted-foreground ring-transparent',
      )}
    >
      <span className={strong ? 'opacity-75' : 'opacity-80'}>{label}</span>
      <span className="font-semibold">x{value}</span>
    </li>
  )
}

export function PointsPanel() {
  const pointsText = useGameStore(selectPointsText)
  const points = useCountUp(pointsText)
  const perRoll = useGameStore(selectPerRollText)
  const perSecond = useGameStore(selectPerSecondText)
  const autoEnabled = useGameStore(selectAutoEnabled)
  const nextUnlock = useGameStore(selectNextUnlockText)
  const b = useGameStore(useShallow(selectBreakdown))

  return (
    <section
      aria-labelledby="points-heading"
      className="rounded-xl bg-card px-5 py-4 text-card-foreground ring-1 ring-foreground/10 shadow-soft"
    >
      <h2 id="points-heading" className="text-sm text-muted-foreground">
        Points
      </h2>
      <p aria-hidden="true" className="text-points text-amber-text">
        {points}
      </p>
      <span data-testid="points" className="sr-only">
        {pointsText}
      </span>
      <p className="mt-2 text-sm text-muted-foreground">
        <span className="tabular">{perRoll}</span> expected per roll
        {autoEnabled && (
          <>
            {' · '}
            <span className="tabular">{perSecond}</span> per second
          </>
        )}
      </p>
      <ul aria-label="Multiplier breakdown" className="mt-3 flex flex-wrap gap-1.5">
        <Chip label="dice" value={b.dice} title="Sum of your dice's output multipliers, mastery included" />
        <Chip label="hand" value={b.combo} title="Expected best-hand multiplier over every roll of your dice" />
        <Chip label="charms" value={b.charms} tone="cool" title="Points charms held this run" />
        <Chip label="luck" value={b.luck} tone="cool" title="Lifetime luck, times Deep Pockets and Fortune's Favour from the Luck tab" />
        <Chip label="marks" value={b.trophies} tone="amber" title="Every mark earned" />
        <Chip label="total" value={b.total} strong title="What one face point is worth, on average" />
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">{nextUnlock}</p>
    </section>
  )
}
