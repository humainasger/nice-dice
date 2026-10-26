// The Backups section of Settings: every stored copy of the game (the timed backup slots, games
// set aside by a reset or import, quarantined saves) newest first with when it was written, its
// rolls and points, and a Restore button on each copy this build can read. Restore asks first;
// restoreBackup then sets the current game aside the way a reset does, loads the copy, credits the
// time since its stamp and saves. The list is read when the section mounts (Settings mounts its
// body fresh on every open) and again after a restore, so the set-aside game shows up at once.
import { useEffect, useState } from 'react'
import { byRecency, listRecoveryCandidates, restoreBackup } from '@/app/recovery'
import { formatBackupTime, formatDuration } from '@/app/selectors'
import { BACKUP_SLOT_MINUTES } from '@/app/storage'
import type { RecoveryCandidate } from '@/app/store'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useNow } from '../useNow'

interface Notice {
  readonly ok: boolean
  readonly text: string
}

/** "1, 5, 20 and 60": the slot minutes as a list. */
function slotList(minutes: readonly number[]): string {
  if (minutes.length <= 1) return minutes.join('')
  return `${minutes.slice(0, -1).join(', ')} and ${minutes[minutes.length - 1]}`
}

async function listSorted(): Promise<RecoveryCandidate[]> {
  const listed = await listRecoveryCandidates()
  return [...listed].sort(byRecency)
}

export function BackupsSection({ onRestored }: { readonly onRestored?: () => void }) {
  /** null while the first read is in flight. */
  const [candidates, setCandidates] = useState<readonly RecoveryCandidate[] | null>(null)
  const [confirming, setConfirming] = useState<RecoveryCandidate | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState(false)
  // One clock for the list; the stamps are minutes to hours old, so a slow refresh is plenty.
  const now = useNow(10_000)

  useEffect(() => {
    let cancelled = false
    void listSorted().then((listed) => {
      if (!cancelled) setCandidates(listed)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const runRestore = async (): Promise<void> => {
    if (confirming === null) return
    setBusy(true)
    try {
      const result = await restoreBackup(confirming.key)
      if (result.ok) {
        const credited = result.creditedMs > 0 ? ` The ${formatDuration(result.creditedMs)} since it was saved count as time away.` : ''
        setNotice({
          ok: true,
          text: `Restored: ${confirming.label}, saved ${formatBackupTime(confirming.savedAt, Date.now())}. The game it replaced is set aside in this list.${credited}`,
        })
        onRestored?.()
      } else {
        setNotice({ ok: false, text: result.reason })
      }
      setCandidates(await listSorted())
    } finally {
      setConfirming(null)
      setBusy(false)
    }
  }

  // Restore buttons are numbered over the readable copies only, so backup-restore-0 is always the
  // newest copy that can be restored.
  let readableIndex = -1

  return (
    <section aria-labelledby="settings-backups" data-testid="backups-section" className="flex flex-col gap-2">
      <h3 id="settings-backups" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Backups
      </h3>
      <p className="text-xs text-muted-foreground">
        The {slotList(BACKUP_SLOT_MINUTES)} minute slots each keep the game as it was at least that long ago, a reset or import sets
        the outgoing game aside for good, and a save this version could not read is kept untouched in quarantine.
      </p>

      {candidates === null ? (
        <p className="text-sm text-muted-foreground" aria-busy="true">
          Looking for stored copies.
        </p>
      ) : candidates.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="backups-empty">
          No stored copies yet. The first slot fills a minute after your first save.
        </p>
      ) : (
        <ul aria-label="Stored copies" className="flex flex-col gap-2">
          {candidates.map((candidate) => {
            const index = candidate.readable ? ++readableIndex : -1
            const selected = confirming?.key === candidate.key
            return (
              <li
                key={candidate.key}
                className={cn('flex flex-col gap-2 rounded-lg bg-muted/60 px-3 py-2', selected && 'ring-1 ring-destructive/40')}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium">{candidate.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {candidate.readable
                        ? `${formatBackupTime(candidate.savedAt, now)}, ${candidate.rolls} rolls, ${candidate.points} points`
                        : `${formatBackupTime(candidate.savedAt, now)}: ${candidate.detail}`}
                    </span>
                  </div>
                  {candidate.readable && (
                    <Button
                      variant="outline"
                      data-testid={`backup-restore-${index}`}
                      disabled={busy || selected}
                      onClick={() => {
                        setNotice(null)
                        setConfirming(candidate)
                      }}
                      className="min-h-11 shrink-0 touch-manipulation"
                    >
                      Restore
                    </Button>
                  )}
                </div>
                {selected && (
                  <div className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2">
                    <p className="text-sm text-destructive">
                      Go back to this copy? The game you are playing now is set aside first and appears in this list, so you can return to it.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="destructive"
                        data-testid="backup-confirm-button"
                        disabled={busy}
                        onClick={() => void runRestore()}
                        className="min-h-11 touch-manipulation"
                      >
                        Yes, restore it
                      </Button>
                      <Button
                        variant="ghost"
                        data-testid="backup-cancel-button"
                        disabled={busy}
                        onClick={() => setConfirming(null)}
                        className="min-h-11 touch-manipulation"
                      >
                        Keep playing
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {notice !== null && (
        <p data-testid="backup-result" role={notice.ok ? 'status' : 'alert'} className={cn('text-xs', notice.ok ? 'text-muted-foreground' : 'text-destructive')}>
          {notice.text}
        </p>
      )}
    </section>
  )
}
