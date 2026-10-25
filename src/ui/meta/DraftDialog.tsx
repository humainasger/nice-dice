// The charm draft: a shadcn Dialog that opens while draft.offer is set, three charm cards side by
// side (stacked on phones), one free reroll. A pick dispatches pickCharm, plays the charm sound and
// bursts cool particles on the chosen card; the dialog holds the offer on screen for PICK_HOLD_MS
// so the burst is seen, then closes (or shows the next offer, if the bar filled twice).
import { useEffect, useState } from 'react'
import { ShuffleIcon } from 'lucide-react'
import type { Id } from '@/content'
import { charmDef } from '@/core'
import { play, unlockAudio } from '@/app/audio'
import { selectDraftCanReroll, selectDraftOfferIds, selectDraftOpen, selectDraftTaken } from '@/app/selectors.meta'
import { send, useGameStore, useShallow } from '@/app/store'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CharmCard } from './CharmCard'

/** How long the picked offer stays up after the pick: most of the particle burst. */
export const PICK_HOLD_MS = 700

interface Celebration {
  readonly ids: readonly Id[]
  readonly index: number
}

export function DraftDialog() {
  const open = useGameStore(selectDraftOpen)
  const offerIds = useGameStore(useShallow(selectDraftOfferIds))
  const canReroll = useGameStore(selectDraftCanReroll)
  const taken = useGameStore(selectDraftTaken)
  const [celebration, setCelebration] = useState<Celebration | null>(null)

  useEffect(() => {
    if (celebration === null) return
    const timer = setTimeout(() => setCelebration(null), PICK_HOLD_MS)
    return () => clearTimeout(timer)
  }, [celebration])

  const celebrating = celebration !== null
  const ids = celebration === null ? offerIds : celebration.ids

  const pick = (index: number): void => {
    if (celebrating) return
    unlockAudio()
    play('charm')
    setCelebration({ ids: offerIds, index })
    send({ type: 'pickCharm', index })
  }

  const reroll = (): void => {
    if (celebrating || !canReroll) return
    unlockAudio()
    play('buy')
    send({ type: 'rerollDraft' })
  }

  return (
    <Dialog open={open || celebrating}>
      <DialogContent
        data-testid="draft-dialog"
        showCloseButton={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle className="text-lg">Pick a charm</DialogTitle>
          <DialogDescription>
            {taken === 0 ? 'Your ascensions earned a draft.' : `Draft ${taken + 1}.`} One of these three joins your table until you press your luck.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 pt-1 sm:grid-cols-3" role="group" aria-label="Charms on offer">
          {ids.map((id, index) => {
            const isPicked = celebration !== null && celebration.index === index
            return (
              <CharmCard
                key={`${id}-${index}`}
                def={charmDef(id)}
                testId={`draft-pick-${index}`}
                onPick={() => pick(index)}
                pickDisabled={celebrating}
                picked={isPicked}
                dimmed={celebrating && !isPicked}
                burst={isPicked ? 1 : 0}
              />
            )
          })}
        </div>

        <DialogFooter className="sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">{canReroll ? 'Not these? One reroll is free.' : 'The reroll is spent for this draft.'}</p>
          <Button variant="outline" data-testid="draft-reroll" disabled={!canReroll || celebrating} onClick={reroll} className="min-h-11 touch-manipulation">
            <ShuffleIcon />
            Reroll
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
