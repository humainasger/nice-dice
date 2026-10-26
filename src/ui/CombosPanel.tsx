// The Hands tab (combos in code): the seven hands weakest first, each with its current upgraded multiplier, how
// often it is the best hand with the dice owned, how many times it has been seen, and an upgrade
// button with the next cost. The row of the last roll's hand lights up. Locked until the Oak Die
// is carved, since a hand needs two dice.
import { useMemo } from 'react'
import { content, type ComboId } from '@/content'
import { play } from '@/app/audio'
import { handRank, selectComboRow, selectCombosExpectedText, selectCombosUnlocked, selectLastHand } from '@/app/selectors'
import { send, useGameStore, useShallow } from '@/app/store'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { RANK_TEXT_CLASS } from './useRollPulse'

function ComboRow({ id, highlighted }: { readonly id: ComboId; readonly highlighted: boolean }) {
  const selector = useMemo(() => selectComboRow(id), [id])
  const v = useGameStore(useShallow(selector))
  const rank = handRank(id)
  return (
    <li
      data-testid={`combo-${id}`}
      className={cn(
        'grid grid-cols-[1fr_auto] items-center gap-x-3 rounded-lg px-3 py-2 ring-1 transition-colors',
        highlighted ? 'bg-amber/10 ring-amber/40' : 'bg-background/40 ring-foreground/10',
        !v.possible && 'opacity-60',
      )}
    >
      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-x-2 font-medium">
          {v.name}
          <span className={cn('font-semibold tabular', RANK_TEXT_CLASS[rank] ?? '')}>x{v.multiplier}</span>
          {v.level > 0 && <span className="text-xs text-muted-foreground tabular">level {v.level}</span>}
        </p>
        <p className="text-xs text-muted-foreground tabular">
          {v.possible ? `${v.frequency} of rolls` : 'needs more dice'}
          {' · '}
          seen {v.seen}
        </p>
      </div>
      <Button
        variant="outline"
        data-testid={`upgrade-${id}`}
        disabled={!v.affordable}
        aria-label={`Upgrade ${v.name} for ${v.nextCost}`}
        onClick={() => {
          send({ type: 'upgradeCombo', id })
          play('level')
        }}
        className="h-auto min-h-11 min-w-20 flex-col gap-0 px-2 py-1.5 touch-manipulation"
      >
        <span className="text-sm leading-tight font-semibold">Upgrade</span>
        <span className="text-[0.7rem] leading-tight text-muted-foreground tabular">{v.nextCost}</span>
      </Button>
    </li>
  )
}

export function CombosPanel() {
  const unlocked = useGameStore(selectCombosUnlocked)
  const expected = useGameStore(selectCombosExpectedText)
  const lastHand = useGameStore(selectLastHand)

  return (
    <section
      aria-labelledby="combos-heading"
      data-testid="combos-panel"
      className="flex flex-col gap-3 rounded-xl bg-card p-4 text-card-foreground ring-1 ring-foreground/10 shadow-soft"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="combos-heading" className="text-base font-semibold">
          Hands
        </h2>
        {unlocked && (
          <span className="text-xs text-muted-foreground tabular" title="Mean best-hand multiplier over every roll of your dice">
            expected x{expected} per roll
          </span>
        )}
      </header>

      {unlocked ? (
        <>
          <p className="text-xs text-muted-foreground">
            The best hand among your dice multiplies the whole roll. Each upgrade adds {content.rules.combo.step * 100}% of a
            hand's base.
          </p>
          <ol className="flex flex-col gap-2" aria-label="Hands">
            {content.combos.map((def) => (
              <ComboRow key={def.id} id={def.id} highlighted={def.id === lastHand} />
            ))}
          </ol>
        </>
      ) : (
        <p className="rounded-lg bg-muted/60 px-3 py-4 text-center text-sm text-muted-foreground">
          Carve the Oak Die to unlock. Two dice or more make a hand, and the best hand multiplies the whole roll.
        </p>
      )}
    </section>
  )
}
