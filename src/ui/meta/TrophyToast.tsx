// A bottom toast for newly earned marks (trophies in code), one at a time. The store queues every trophy a state
// change awards (ui.trophyQueue); the toast shows the head, plays the trophy sound, and shifts it
// off after TOAST_MS or on tap, so two trophies from one roll are shown one after another. The
// store clears the core's newTrophy when the queue drains. The last trophy shown stays in local
// state so the toast can fade out after the queue is already empty. Below lg it sits above the
// fixed bottom tab bar (56 px plus the safe area) instead of on top of it.
import { useEffect, useState } from 'react'
import { StampIcon } from 'lucide-react'
import { play } from '@/app/audio'
import { selectTrophyToastDescription, selectTrophyToastId, selectTrophyToastName } from '@/app/selectors.meta'
import { shiftTrophy, useGameStore } from '@/app/store'
import { cn } from '@/lib/utils'

export const TOAST_MS = 3000
const FADE_MS = 250

interface Shown {
  readonly id: string
  readonly name: string
  readonly description: string
}

export function TrophyToast() {
  const id = useGameStore(selectTrophyToastId)
  const name = useGameStore(selectTrophyToastName)
  const description = useGameStore(selectTrophyToastDescription)
  const [shown, setShown] = useState<Shown | null>(null)
  const visible = id !== null
  // State from the previous render: keep the last trophy while the queue is already empty.
  if (id !== null && (shown === null || shown.id !== id)) setShown({ id, name, description })

  useEffect(() => {
    if (id === null) return
    play('trophy')
    const timer = setTimeout(shiftTrophy, TOAST_MS)
    return () => clearTimeout(timer)
  }, [id])

  useEffect(() => {
    if (visible || shown === null) return
    const timer = setTimeout(() => setShown(null), FADE_MS)
    return () => clearTimeout(timer)
  }, [visible, shown])

  if (shown === null) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 lg:bottom-[max(1rem,env(safe-area-inset-bottom))]">
      <button
        key={shown.id}
        type="button"
        data-testid="trophy-toast"
        role="status"
        aria-live="polite"
        onClick={shiftTrophy}
        className={cn(
          'pointer-events-auto flex max-w-sm min-h-11 items-center gap-3 rounded-xl bg-popover px-4 py-3 text-left text-popover-foreground shadow-soft ring-1 ring-amber/50 glow-amber transition-opacity duration-200 touch-manipulation',
          visible ? 'slam-in opacity-100' : 'opacity-0',
        )}
      >
        <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber text-primary-foreground">
          <StampIcon className="size-5" />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-[0.65rem] font-medium tracking-wide text-amber-text uppercase">Mark</span>
          <span className="font-medium leading-snug">{shown.name}</span>
          <span className="text-xs text-muted-foreground">{shown.description}</span>
        </span>
      </button>
    </div>
  )
}
