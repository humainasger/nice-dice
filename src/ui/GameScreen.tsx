// The playable dev shell: points, roll controls, the dice board and an away banner. The full M2
// screen (dialogs, settings, export and import, lock screen) replaces this file.
import { useEffect } from 'react'
import { content } from '@/content'
import { boot } from '@/app/boot'
import {
  selectAutoEnabled,
  selectAutoProgress,
  selectAutoUnlocked,
  selectLastGainedText,
  selectOfflineText,
  selectPerRollText,
  selectPerSecondText,
  selectPointsText,
  selectRolls,
} from '@/app/selectors'
import { dismissOffline, send, useGameStore } from '@/app/store'
import { Button } from '@/components/ui/button'
import { DieCard } from './DieCard'

export function GameScreen() {
  const points = useGameStore(selectPointsText)
  const perRoll = useGameStore(selectPerRollText)
  const perSecond = useGameStore(selectPerSecondText)
  const rolls = useGameStore(selectRolls)
  const lastGained = useGameStore(selectLastGainedText)
  const autoUnlocked = useGameStore(selectAutoUnlocked)
  const autoEnabled = useGameStore(selectAutoEnabled)
  const autoProgress = useGameStore(selectAutoProgress)
  const offlineText = useGameStore(selectOfflineText)

  useEffect(() => {
    boot()
    const onKey = (e: KeyboardEvent): void => {
      if (e.code === 'Space' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault()
        send({ type: 'roll' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <main className="min-h-dvh bg-background text-foreground px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="mx-auto flex max-w-3xl items-center justify-between py-2">
        <h1 className="text-lg font-semibold">Nice Dice</h1>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">dev build</span>
      </header>

      {offlineText !== '' && (
        <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between gap-3 rounded-lg border bg-card px-4 py-2 text-sm">
          <span>{offlineText}</span>
          <Button size="sm" variant="ghost" onClick={dismissOffline}>
            OK
          </Button>
        </div>
      )}

      <section className="mx-auto max-w-3xl rounded-xl border bg-card p-4 text-card-foreground">
        <div className="text-sm text-muted-foreground">Points</div>
        <div className="text-4xl font-semibold tabular-nums">{points}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {perRoll} expected per roll · {perSecond}/s from auto-roll · {rolls} rolls
          {lastGained !== '' ? ` · last roll +${lastGained}` : ''}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={() => send({ type: 'roll' })} className="min-h-11 min-w-28 touch-manipulation select-none">
            Roll (Space)
          </Button>
          {autoUnlocked ? (
            <div className="flex items-center gap-3">
              <Button variant={autoEnabled ? 'secondary' : 'outline'} onClick={() => send({ type: 'setAutoRoll', enabled: !autoEnabled })} className="min-h-11 touch-manipulation select-none">
                Auto-roll {autoEnabled ? 'on' : 'off'}
              </Button>
              <div className="h-2 w-32 overflow-hidden rounded bg-muted" aria-hidden="true">
                <div className="h-full bg-primary" style={{ width: `${Math.round(autoProgress * 100)}%` }} />
              </div>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Level your first die to unlock auto-roll</span>
          )}
        </div>
      </section>

      <section className="mx-auto mt-4 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {content.dice.map((die, i) => (
          <DieCard key={die.id} id={die.id} index={i} />
        ))}
      </section>

      <p className="sr-only">Nice Dice development build. Roll dice for points, buy and level dice.</p>
    </main>
  )
}
