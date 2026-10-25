// A bottom toast for the latest trophy: slams in when newTrophy is set, plays the trophy sound,
// and clears itself (clearNewTrophy) after TOAST_MS or on tap. The last trophy shown stays in
// local state so the toast can fade out after the store has already cleared it. Below lg it sits
// above the fixed bottom tab bar (56 px plus the safe area) instead of on top of it.
import { useEffect, useState } from 'react'
import { TrophyIcon } from 'lucide-react'
import { play } from '@/app/audio'
import { selectNewTrophyDescription, selectNewTrophyId, selectNewTrophyName } from '@/app/selectors.meta'
import { send, useGameStore } from '@/app/store'
import { cn } from '@/lib/utils'

export const TOAST_MS = 3000
const FADE_MS = 250

interface Shown {
  readonly id: string
  readonly name: string
  readonly description: string
}

export function TrophyToast() {
  const id = useGameStore(selectNewTrophyId)
  const name = useGameStore(selectNewTrophyName)
  const description = useGameStore(selectNewTrophyDescription)
  const [shown, setShown] = useState<Shown | null>(null)
  const visible = id !== null
  // State from the previous render: keep the last trophy while the store's newTrophy is already null.
  if (id !== null && (shown === null || shown.id !== id)) setShown({ id, name, description })

  useEffect(() => {
    if (id === null) return
    play('trophy')
    const timer = setTimeout(() => send({ type: 'clearNewTrophy' }), TOAST_MS)
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
        type="button"
        data-testid="trophy-toast"
        role="status"
        aria-live="polite"
        onClick={() => send({ type: 'clearNewTrophy' })}
        className={cn(
          'pointer-events-auto flex max-w-sm min-h-11 items-center gap-3 rounded-xl bg-popover px-4 py-3 text-left text-popover-foreground shadow-soft ring-1 ring-amber/50 glow-amber transition-opacity duration-200 touch-manipulation',
          visible ? 'slam-in opacity-100' : 'opacity-0',
        )}
      >
        <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber text-primary-foreground">
          <TrophyIcon className="size-5" />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-[0.65rem] font-medium tracking-wide text-amber-text uppercase">Trophy</span>
          <span className="font-medium leading-snug">{shown.name}</span>
          <span className="text-xs text-muted-foreground">{shown.description}</span>
        </span>
      </button>
    </div>
  )
}
