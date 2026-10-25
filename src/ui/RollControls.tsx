// Roll controls: the manual Roll button (Space rolls too, except while typing or in a dialog), the
// auto-roll switch with its progress bar to the next roll, or the hint on how to unlock it.
import { useEffect } from 'react'
import { selectAutoEnabled, selectAutoIntervalText, selectAutoProgress, selectAutoUnlocked } from '@/app/selectors'
import { send, useGameStore } from '@/app/store'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'

/** Space on any of these is the element's own business, not a roll. */
const SPACE_OWNERS = 'button, input, textarea, select, [contenteditable], [role="dialog"]'

function roll(): void {
  send({ type: 'roll' })
}

export function RollControls() {
  const autoUnlocked = useGameStore(selectAutoUnlocked)
  const autoEnabled = useGameStore(selectAutoEnabled)
  const autoProgress = useGameStore(selectAutoProgress)
  const intervalText = useGameStore(selectAutoIntervalText)

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
    <section
      aria-label="Roll controls"
      className="flex flex-col gap-4 rounded-xl bg-card px-5 py-4 text-card-foreground ring-1 ring-foreground/10 sm:flex-row sm:items-center sm:justify-between"
    >
      <Button size="lg" data-testid="roll-button" onClick={roll} className="min-h-12 w-full gap-2 text-base touch-manipulation sm:w-auto sm:min-w-44">
        Roll
        <kbd aria-hidden="true" className="hidden rounded border border-primary-foreground/30 px-1.5 py-0.5 font-sans text-xs font-normal opacity-80 sm:inline">
          Space
        </kbd>
      </Button>

      {autoUnlocked ? (
        <div className="flex w-full flex-col gap-2 sm:max-w-xs">
          <label htmlFor="auto-roll" className="flex min-h-11 items-center justify-between gap-3 text-sm select-none touch-manipulation">
            <span>Auto-roll every {intervalText}</span>
            <Switch
              id="auto-roll"
              aria-label="Auto-roll"
              data-testid="auto-roll-switch"
              checked={autoEnabled}
              onCheckedChange={(checked) => send({ type: 'setAutoRoll', enabled: checked })}
            />
          </label>
          <Progress value={autoEnabled ? autoProgress * 100 : 0} aria-label="Time to the next auto-roll" className="h-1.5" />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Level a die to unlock auto-roll</p>
      )}
    </section>
  )
}
