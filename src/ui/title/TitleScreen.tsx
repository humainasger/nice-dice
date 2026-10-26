// The title screen: shown on every load before the bench (docs/plans/active/m5-theme.md, "Title
// screen"). The workbench scene fills the viewport; over it the title in Fraunces, the subtitle, the
// one primary button and a muted Settings link that opens the usual settings dialog. boot() runs
// underneath, so the save is loaded by the time the player taps: the button reads "Continue" for a
// game with rolls or prestiges behind it and "Start carving" for a fresh one, and is disabled until
// boot has settled (or while the recovery dialog, rendered above by App, waits for a choice). The
// tap is the first user gesture, so it is where unlockAudio() happens; then the screen fades for
// 220 ms and dismissTitle() hands over to the bench. Portrait stacks title, die, button; landscape
// puts the text left of the die.
import { useEffect, useRef, useState } from 'react'
import { unlockAudio } from '@/app/audio'
import { selectBooted, selectHasSave } from '@/app/selectors'
import { dismissTitle, useGameStore } from '@/app/store'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useReduceMotion } from '@/ui/fx'
import { SettingsDialog } from '@/ui/SettingsDialog'
import { WorkbenchScene } from './WorkbenchScene'

/** Matches .title-leave in index.css. */
const LEAVE_MS = 220

export function TitleScreen() {
  const booted = useGameStore(selectBooted)
  const hasSave = useGameStore(selectHasSave)
  const reduceMotion = useReduceMotion()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current)
    },
    [],
  )

  const continueGame = (): void => {
    if (leaving) return
    unlockAudio()
    setLeaving(true)
    timer.current = setTimeout(dismissTitle, reduceMotion ? 0 : LEAVE_MS)
  }

  const label = !booted ? 'Lighting the lamp' : hasSave ? 'Continue' : 'Start carving'

  return (
    <section
      data-testid="title-screen"
      aria-label="Nice Dice title screen"
      className={cn('fixed inset-0 z-40 overflow-hidden bg-black text-die', leaving && 'title-leave')}
    >
      <WorkbenchScene motes={!reduceMotion} className="absolute inset-0 size-full" />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-6xl flex-col items-center justify-between px-6 pt-[max(3.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))] text-center landscape:items-start landscape:justify-center landscape:gap-10 landscape:px-[max(3rem,env(safe-area-inset-left))] landscape:text-left lg:landscape:px-20">
        <header className="landscape:max-w-[52%]">
          <h1 className="font-display text-[clamp(3.25rem,min(13vw,17vh),7.5rem)] leading-[0.95] font-semibold tracking-tight text-die [text-shadow:0_2px_28px_rgb(0_0_0/0.55)]">
            Nice Dice
          </h1>
          <p className="mt-3 text-base text-die/75 sm:text-lg [text-shadow:0_1px_12px_rgb(0_0_0/0.6)]">a dicewright&apos;s idle game</p>
        </header>

        <div className="flex flex-col items-center gap-3 landscape:items-start">
          <Button
            type="button"
            size="lg"
            autoFocus
            data-testid="title-continue"
            disabled={!booted || leaving}
            aria-busy={!booted}
            onClick={continueGame}
            className={cn(
              'min-h-12 min-w-48 touch-manipulation px-8 text-base font-semibold shadow-soft transition-shadow',
              booted && !leaving && 'glow-amber',
            )}
          >
            {label}
          </Button>
          <button
            type="button"
            data-testid="title-settings"
            disabled={!booted}
            onClick={() => setSettingsOpen(true)}
            className="min-h-11 touch-manipulation rounded-lg px-3 text-sm text-die/65 underline-offset-4 transition-colors hover:text-die hover:underline focus-visible:text-die focus-visible:underline focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
          >
            Settings
          </button>
        </div>
      </div>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </section>
  )
}
