// Shown when another tab already holds the game lock. Nothing runs here: no loop, no autosave.
// The update banner renders here too, so a waiting build can be taken from this tab as well.
import { LockIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UpdateBanner } from './UpdateBanner'

export function LockedScreen() {
  return (
    <main
      data-testid="locked-screen"
      className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground"
    >
      <UpdateBanner className="w-full max-w-md text-left" />
      <LockIcon className="size-10 text-muted-foreground" aria-hidden="true" />
      <h1 className="text-xl font-semibold">Nice Dice is already open in another tab</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        The game runs in one tab at a time so your save stays in one piece. Close this tab, or close the other one and reload
        here.
      </p>
      <Button onClick={() => window.location.reload()} className="min-h-11 touch-manipulation">
        Reload
      </Button>
    </main>
  )
}
