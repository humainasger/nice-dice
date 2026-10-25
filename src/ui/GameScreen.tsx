// The game screen: header with the settings button, the points panel, roll controls, the dice
// board, the last roll and the credits line, plus the settings and away dialogs. A quiet loading
// state holds the page until boot() has loaded the save, so the first paint is the real game.
import { useState } from 'react'
import { SettingsIcon } from 'lucide-react'
import { selectBooted } from '@/app/selectors'
import { useGameStore } from '@/app/store'
import { Button } from '@/components/ui/button'
import { DiceBoard } from './DiceBoard'
import { ErrorBanner } from './ErrorBanner'
import { LastRoll } from './LastRoll'
import { OfflineModal } from './OfflineModal'
import { PointsPanel } from './PointsPanel'
import { RecoveryDialog } from './RecoveryDialog'
import { RollControls } from './RollControls'
import { SettingsDialog } from './SettingsDialog'

export function GameScreen() {
  const booted = useGameStore(selectBooted)
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className="min-h-dvh bg-background pt-[max(1rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] text-foreground">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <header className="flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight">Nice Dice</h1>
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label="Settings"
            data-testid="settings-button"
            disabled={!booted}
            onClick={() => setSettingsOpen(true)}
            className="size-11 touch-manipulation"
          >
            <SettingsIcon className="size-5" />
          </Button>
        </header>

        <ErrorBanner />

        {booted ? (
          <main className="flex flex-col gap-4">
            <PointsPanel />
            <RollControls />
            <DiceBoard />
            <LastRoll />
          </main>
        ) : (
          <main aria-busy="true" className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
            Loading your dice
          </main>
        )}

        <footer className="pt-4 text-center text-xs text-muted-foreground">Icons: lucide (ISC). Font: Geist (OFL).</footer>
      </div>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <RecoveryDialog />
      <OfflineModal />
    </div>
  )
}
