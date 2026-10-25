// "New version ready" notice. Shown when the service worker has a newer build waiting (prompt
// mode); the button saves and reloads. Hidden otherwise.
import { RefreshCwIcon } from 'lucide-react'
import { selectUpdateReady } from '@/app/selectors'
import { useGameStore } from '@/app/store'
import { applyUpdate } from '@/app/swUpdate'
import { Button } from '@/components/ui/button'

export function UpdateBanner() {
  const ready = useGameStore(selectUpdateReady)
  if (!ready) return null

  return (
    <div
      role="status"
      data-testid="update-banner"
      className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-sm text-card-foreground"
    >
      <span className="flex items-center gap-2">
        <RefreshCwIcon className="size-4 shrink-0" aria-hidden="true" />
        A new version of Nice Dice is ready.
      </span>
      <Button size="sm" onClick={applyUpdate} className="min-h-11 touch-manipulation select-none">
        Save and reload
      </Button>
    </div>
  )
}
