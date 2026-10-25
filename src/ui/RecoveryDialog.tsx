// Blocking dialog for a save this build could not read: the reason, every stored copy that can
// be restored (backup slots, games set aside by reset or import, quarantined saves a newer build
// wrote) and a fresh start. Opens while ui.recovery is set; boot() waits for the choice and
// finishRecovery closes it. No close button, no overlay dismiss: the choice has to be made.
import { useState } from 'react'
import { finishRecovery } from '@/app/boot'
import { formatAgo, selectHasRecovery, selectRecoveryCandidates, selectRecoveryReason } from '@/app/selectors'
import { useGameStore, useShallow, type RecoveryCandidate } from '@/app/store'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useNow } from './useNow'

export function RecoveryDialog() {
  const open = useGameStore(selectHasRecovery)
  const reason = useGameStore(selectRecoveryReason)
  const candidates = useGameStore(useShallow(selectRecoveryCandidates))
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  // One clock for the whole list; the stamps are minutes to hours old, so a slow refresh is plenty.
  const now = useNow(10_000)

  const choose = async (choice: Parameters<typeof finishRecovery>[0]): Promise<void> => {
    setBusy(true)
    setFailure(null)
    try {
      const result = await finishRecovery(choice)
      if (!result.ok) setFailure(result.reason)
    } finally {
      setBusy(false)
    }
  }

  const restorable = candidates.filter((c) => c.readable)
  const unreadable = candidates.filter((c) => !c.readable)

  return (
    <Dialog open={open}>
      <DialogContent
        data-testid="recovery-dialog"
        showCloseButton={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Your saved game could not be read</DialogTitle>
          <DialogDescription>
            The stored save is kept aside untouched ({reason}). Pick a backup to go back to, or start a fresh game.
          </DialogDescription>
        </DialogHeader>

        {restorable.length > 0 ? (
          <ul aria-label="Backups you can restore" className="flex flex-col gap-2">
            {restorable.map((candidate, index) => (
              <CandidateRow key={candidate.key} candidate={candidate} index={index} now={now} busy={busy} onRestore={choose} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No backup this version can read is in storage.</p>
        )}

        {unreadable.length > 0 && (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none py-1">
              {unreadable.length === 1 ? '1 copy this version cannot read' : `${unreadable.length} copies this version cannot read`}
            </summary>
            <ul className="mt-1 flex flex-col gap-1">
              {unreadable.map((candidate) => (
                <li key={candidate.key}>
                  {candidate.label}, {formatAgo(candidate.savedAt, now)}: {candidate.detail}
                </li>
              ))}
            </ul>
          </details>
        )}

        {failure !== null && (
          <p role="alert" data-testid="recovery-error" className="text-sm text-destructive">
            {failure}
          </p>
        )}

        <DialogFooter className="sm:justify-between">
          <p className="self-center text-xs text-muted-foreground">An export string from Settings can be imported later too.</p>
          <Button
            variant="outline"
            data-testid="recovery-fresh"
            disabled={busy}
            onClick={() => void choose({ kind: 'fresh' })}
            className="min-h-11 touch-manipulation"
          >
            Start fresh
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface CandidateRowProps {
  readonly candidate: RecoveryCandidate
  readonly index: number
  readonly now: number
  readonly busy: boolean
  readonly onRestore: (choice: { kind: 'restore'; key: string }) => Promise<void>
}

function CandidateRow({ candidate, index, now, busy, onRestore }: CandidateRowProps) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2">
      <div className="flex min-w-0 flex-col">
        <span className="text-sm font-medium">{candidate.label}</span>
        <span className="text-xs text-muted-foreground">
          {formatAgo(candidate.savedAt, now)}, {candidate.rolls} rolls, {candidate.points} points
        </span>
      </div>
      <Button
        data-testid={`recovery-restore-${index}`}
        disabled={busy}
        onClick={() => void onRestore({ kind: 'restore', key: candidate.key })}
        className="min-h-11 shrink-0 touch-manipulation"
      >
        Restore
      </Button>
    </li>
  )
}
