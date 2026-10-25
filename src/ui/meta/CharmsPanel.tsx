// The Charms tab: locked until the first ascension, then the draft progress bar ("2 / 3
// ascensions"), a note while a draft is waiting, and the charms held this run as cards. A charm
// held twice is one card with an x2 badge.
import { SparklesIcon } from 'lucide-react'
import { charmDef } from '@/core'
import type { Id } from '@/content'
import {
  selectCharmCount,
  selectCharmsUnlocked,
  selectDraftOpen,
  selectDraftProgress,
  selectDraftRequirement,
  selectDraftTaken,
  selectHeldCharmIds,
} from '@/app/selectors.meta'
import { useGameStore, useShallow } from '@/app/store'
import { CharmCard } from './CharmCard'
import { Bar, LockedCard, PanelCard, PanelTitle } from './parts'

/** Held ids grouped in first-pick order with their copy counts. */
function groupHeld(ids: readonly Id[]): { id: Id; count: number }[] {
  const out: { id: Id; count: number }[] = []
  for (const id of ids) {
    const row = out.find((r) => r.id === id)
    if (row === undefined) out.push({ id, count: 1 })
    else row.count += 1
  }
  return out
}

export function CharmsPanel() {
  const unlocked = useGameStore(selectCharmsUnlocked)
  const progress = useGameStore(selectDraftProgress)
  const requirement = useGameStore(selectDraftRequirement)
  const taken = useGameStore(selectDraftTaken)
  const draftOpen = useGameStore(selectDraftOpen)
  const count = useGameStore(selectCharmCount)
  const held = useGameStore(useShallow(selectHeldCharmIds))

  if (!unlocked) {
    return (
      <div data-testid="charms-panel" className="flex flex-col gap-4">
        <LockedCard
          testId="charms-locked"
          headline="Charms open after your first ascension."
          detail="A die at level 100 ascends: back to level 1, output x100, and one step toward a draft of three charms."
        />
      </div>
    )
  }

  const percent = requirement > 0 ? (progress / requirement) * 100 : 0
  const groups = groupHeld(held)

  return (
    <div data-testid="charms-panel" className="flex flex-col gap-4">
      <PanelCard className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <PanelTitle>Next draft</PanelTitle>
          <span data-testid="draft-progress" className="text-sm text-muted-foreground tabular">
            {progress} / {requirement} {requirement === 1 ? 'ascension' : 'ascensions'}
          </span>
        </div>
        <Bar value={percent} tone="cool" label="Draft progress" />
        {draftOpen ? (
          <p className="flex items-center gap-2 text-sm text-cool-text">
            <SparklesIcon className="size-4" aria-hidden="true" />A draft is waiting. Pick one of three charms.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Every ascension fills the bar. {taken === 0 ? 'Your first draft offers three charms; take one.' : 'Each pick moves the next draft a little further away.'} Charms stay until you press your luck.
          </p>
        )}
      </PanelCard>

      <PanelCard className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <PanelTitle>Charms held</PanelTitle>
          <span className="text-sm text-muted-foreground tabular">{count}</span>
        </div>
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet. The first draft opens when the bar fills.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2" data-testid="charm-list">
            {groups.map(({ id, count: copies }) => (
              <li key={id} className="pt-2 pl-2">
                <CharmCard def={charmDef(id)} count={copies} testId={`charm-${id}`} />
              </li>
            ))}
          </ul>
        )}
      </PanelCard>
    </div>
  )
}
