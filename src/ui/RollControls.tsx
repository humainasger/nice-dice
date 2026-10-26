// The roll pieces of the play card: the Roll button (Space rolls too, except while typing or in a
// dialog) with its roll sound, and the auto-roll control, a switch with the thin progress bar to
// the next roll under it. PlayCard.tsx lays them out side by side and shows the unlock hint while
// auto-roll is still locked.
import { useEffect } from 'react'
import { play } from '@/app/audio'
import { selectAutoEnabled, selectAutoIntervalText, selectAutoProgress } from '@/app/selectors'
import { send, useGameStore } from '@/app/store'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

/** Space on any of these is the element's own business, not a roll. */
const SPACE_OWNERS = 'button, input, textarea, select, [contenteditable], [role="dialog"]'

function roll(): void {
  send({ type: 'roll' })
  play('roll')
}

/** The primary action: 56 px tall on phones, 48 from sm. Carries the `roll-button` test id. */
export function RollButton({ className }: { readonly className?: string }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.code !== 'Space' || event.repeat || event.defaultPrevented) return
      if (event.target instanceof Element && event.target.closest(SPACE_OWNERS) !== null) return
      event.preventDefault()
      roll()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <Button
      size="lg"
      data-testid="roll-button"
      onClick={roll}
      className={cn('min-h-14 gap-2 text-lg font-semibold glow-amber touch-manipulation sm:min-h-12 sm:text-base', className)}
    >
      Roll
      <kbd
        aria-hidden="true"
        className="hidden rounded border border-primary-foreground/30 px-1.5 py-0.5 font-sans text-xs font-normal opacity-80 sm:inline"
      >
        Space
      </kbd>
    </Button>
  )
}

/** The auto-roll switch (the one `auto-roll-switch` test id) over its progress bar. Render only once auto-roll is unlocked. */
export function AutoRollControl({ className }: { readonly className?: string }) {
  const autoEnabled = useGameStore(selectAutoEnabled)
  const autoProgress = useGameStore(selectAutoProgress)
  const intervalText = useGameStore(selectAutoIntervalText)
  const title = `Auto-roll every ${intervalText}`

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label
        htmlFor="auto-roll"
        title={title}
        className="flex min-h-11 items-center justify-center gap-2 text-sm text-muted-foreground select-none touch-manipulation sm:justify-end"
      >
        <Switch
          id="auto-roll"
          aria-label={title}
          data-testid="auto-roll-switch"
          checked={autoEnabled}
          onCheckedChange={(checked) => send({ type: 'setAutoRoll', enabled: checked })}
        />
        <span>
          Auto
          <span className="hidden sm:inline">
            -roll <span className="tabular">{intervalText}</span>
          </span>
        </span>
      </label>
      <Progress value={autoEnabled ? autoProgress * 100 : 0} aria-label="Time to the next auto-roll" className="h-1" />
    </div>
  )
}
