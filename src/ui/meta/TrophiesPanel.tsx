// The Trophies tab: the count and total bonus, the trophies held (a check each, in the order
// earned) and the ones still to earn with a progress line and a thin bar. Trophies never lock.
import { useMemo } from 'react'
import { CheckIcon, CircleIcon } from 'lucide-react'
import { content, type Id, type TrophyDef } from '@/content'
import { trophyDef } from '@/core'
import {
  selectTrophyBonusText,
  selectTrophyCount,
  selectTrophyIds,
  selectTrophyProgressRatio,
  selectTrophyProgressText,
} from '@/app/selectors.meta'
import { useGameStore, useShallow } from '@/app/store'
import { Bar, PanelCard, PanelTitle } from './parts'

function HeldRow({ def }: { readonly def: TrophyDef }) {
  return (
    <li data-testid={`trophy-${def.id}`} className="flex items-start gap-3 py-2">
      <span aria-hidden="true" className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-amber text-primary-foreground">
        <CheckIcon className="size-3.5" strokeWidth={3} />
      </span>
      <div className="flex min-w-0 flex-col">
        <p className="font-medium">{def.name}</p>
        <p className="text-xs text-muted-foreground">{def.description}</p>
      </div>
    </li>
  )
}

function NextRow({ def }: { readonly def: TrophyDef }) {
  const textSelector = useMemo(() => selectTrophyProgressText(def.id), [def.id])
  const ratioSelector = useMemo(() => selectTrophyProgressRatio(def.id), [def.id])
  const progress = useGameStore(textSelector)
  const ratio = useGameStore(ratioSelector)
  return (
    <li data-testid={`trophy-${def.id}`} className="flex items-start gap-3 py-2">
      <span aria-hidden="true" className="mt-0.5 flex size-6 shrink-0 items-center justify-center text-muted-foreground/60">
        <CircleIcon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-medium">{def.name}</p>
          <p className="shrink-0 text-xs text-muted-foreground tabular">{progress}</p>
        </div>
        <p className="text-xs text-muted-foreground">{def.description}</p>
        <Bar value={ratio * 100} className="mt-1 h-1" label={`${def.name} progress`} />
      </div>
    </li>
  )
}

export function TrophiesPanel() {
  const heldIds = useGameStore(useShallow(selectTrophyIds))
  const count = useGameStore(selectTrophyCount)
  const bonus = useGameStore(selectTrophyBonusText)
  const total = content.trophies.length
  const heldSet = new Set<Id>(heldIds)
  const next = content.trophies.filter((def) => !heldSet.has(def.id))

  return (
    <div data-testid="trophies-panel" className="flex flex-col gap-4">
      <PanelCard className="flex items-end justify-between gap-3">
        <div>
          <PanelTitle>Trophies</PanelTitle>
          <p className="mt-1 text-3xl font-semibold tracking-tight tabular">
            {count} <span className="text-base font-normal text-muted-foreground">of {total}</span>
          </p>
        </div>
        <p className="text-right text-sm text-muted-foreground">
          <span data-testid="trophy-bonus" className="font-medium text-amber-text tabular">
            x{bonus}
          </span>{' '}
          points
          <br />
          x1.02 each
        </p>
      </PanelCard>

      {heldIds.length > 0 && (
        <PanelCard className="flex flex-col gap-1">
          <PanelTitle>Held</PanelTitle>
          <ul className="divide-y divide-border/60">
            {heldIds.map((id) => (
              <HeldRow key={id} def={trophyDef(id)} />
            ))}
          </ul>
        </PanelCard>
      )}

      {next.length > 0 && (
        <PanelCard className="flex flex-col gap-1">
          <PanelTitle>Next</PanelTitle>
          <ul className="divide-y divide-border/60">
            {next.map((def) => (
              <NextRow key={def.id} def={def} />
            ))}
          </ul>
        </PanelCard>
      )}
    </div>
  )
}
