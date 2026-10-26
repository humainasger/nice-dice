// "While you were away": opens when the store carries an offline summary, closes through
// dismissOffline. The "estimated" note follows selectOfflineEstimated: only when at least one
// auto-roll interval was settled at expected value, so at least one whole roll was estimated,
// never for the sub-roll remainder every absence has.
import { useState } from 'react'
import {
  selectAutoUnlocked,
  selectHasOffline,
  selectOfflineAwayText,
  selectOfflineEstimated,
  selectOfflineGainedText,
  selectOfflineRolls,
} from '@/app/selectors'
import { dismissOffline, useGameStore } from '@/app/store'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface AwayView {
  readonly away: string
  readonly rolls: number
  readonly gained: string
  readonly estimated: boolean
  readonly autoUnlocked: boolean
}

function sameView(a: AwayView, b: AwayView): boolean {
  return (
    a.away === b.away && a.rolls === b.rolls && a.gained === b.gained && a.estimated === b.estimated && a.autoUnlocked === b.autoUnlocked
  )
}

export function OfflineModal() {
  const open = useGameStore(selectHasOffline)
  const current: AwayView = {
    away: useGameStore(selectOfflineAwayText),
    rolls: useGameStore(selectOfflineRolls),
    gained: useGameStore(selectOfflineGainedText),
    estimated: useGameStore(selectOfflineEstimated),
    autoUnlocked: useGameStore(selectAutoUnlocked),
  }
  // The summary is cleared the moment the player dismisses, but the dialog is still fading out.
  // Keep showing the last open view until then (the React "state from previous render" pattern).
  const [view, setView] = useState(current)
  if (open && !sameView(view, current)) setView(current)
  const { away, rolls, gained, estimated, autoUnlocked } = view

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismissOffline()
      }}
    >
      <DialogContent data-testid="offline-modal" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>While you were away</DialogTitle>
          <DialogDescription>You were gone for {away}.</DialogDescription>
        </DialogHeader>

        {rolls === 0 ? (
          <p className="text-sm">
            {autoUnlocked
              ? 'Auto-roll was switched off, so the dice sat still. Switch it on and they keep rolling while you are away.'
              : 'Auto-roll is not unlocked yet, so the dice sat still. Level a die to unlock it and they keep rolling while you are away.'}
          </p>
        ) : (
          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/60 px-3 py-2">
              <dt className="text-xs text-muted-foreground">Rolls</dt>
              <dd className="text-xl font-semibold tabular-nums">{rolls}</dd>
            </div>
            <div className="rounded-lg bg-muted/60 px-3 py-2">
              <dt className="text-xs text-muted-foreground">Points</dt>
              <dd className="text-xl font-semibold tabular-nums">+{gained}</dd>
            </div>
          </dl>
        )}

        {estimated && (
          <p className="text-xs text-muted-foreground">
            Partly estimated: part of that time was settled at the expected value per roll instead of rolled one by one.
          </p>
        )}

        <DialogFooter>
          <Button data-testid="offline-dismiss" onClick={dismissOffline} className="min-h-11 touch-manipulation">
            Back to the bench
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
