// Non-fatal save notices: a failed write (quota and friends) and a quarantined save that could not
// be read (shown behind the recovery dialog until the player has chosen). Hidden when neither applies.
import { TriangleAlertIcon } from 'lucide-react'
import { selectQuarantined, selectSaveError } from '@/app/selectors'
import { useGameStore } from '@/app/store'

export function ErrorBanner() {
  const error = useGameStore(selectSaveError)
  const quarantined = useGameStore(selectQuarantined)
  if (error === null && !quarantined) return null

  return (
    <div
      role="alert"
      data-testid="error-banner"
      className="flex gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        {quarantined && (
          <p>Your saved game could not be read. It is kept aside, not overwritten; pick a backup or a fresh start to continue.</p>
        )}
        {error !== null && <p>{error}</p>}
      </div>
    </div>
  )
}
