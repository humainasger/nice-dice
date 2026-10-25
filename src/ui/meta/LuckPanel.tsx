// The Luck tab: the luck held and its multiplier, a locked state with the threshold and a progress
// bar, the preview "Reset for +N luck (x1.N points)", what resets and what stays, and a confirm
// dialog. A prestige plays the luck sound, shakes the panel and bursts cool particles.
import { useState } from 'react'
import { CloverIcon } from 'lucide-react'
import { play, unlockAudio } from '@/app/audio'
import {
  selectLuck,
  selectLuckAfterResetText,
  selectLuckMultiplierText,
  selectLuckOnReset,
  selectLuckProgressPercent,
  selectLuckThresholdText,
  selectLuckUnlocked,
  selectPrestiges,
  selectRunEarnedText,
} from '@/app/selectors.meta'
import { send, useGameStore } from '@/app/store'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Particles, ScreenShake } from '@/ui/fx'
import { Bar, PanelCard, PanelTitle } from './parts'

const RESETS = ['Points', 'Dice: back to the first die at level 1, faces 1 to 6, no ascensions', 'Hand upgrades', 'Charms and draft progress', 'This run’s earnings'] as const
const STAYS = ['Luck and its multiplier', 'Trophies', 'Lifetime stats', 'Settings and auto-roll'] as const

function PlainList({ title, items, tone }: { readonly title: string; readonly items: readonly string[]; readonly tone: 'resets' | 'stays' }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className={tone === 'stays' ? 'text-xs font-medium tracking-wide text-cool-text uppercase' : 'text-xs font-medium tracking-wide text-muted-foreground uppercase'}>
        {title}
      </h3>
      <ul className="flex flex-col gap-1 text-sm">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden="true" className={tone === 'stays' ? 'text-cool-text' : 'text-muted-foreground'}>
              {tone === 'stays' ? '✓' : '✕'}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function LuckPanel() {
  const luck = useGameStore(selectLuck)
  const prestiges = useGameStore(selectPrestiges)
  const multiplier = useGameStore(selectLuckMultiplierText)
  const unlocked = useGameStore(selectLuckUnlocked)
  const onReset = useGameStore(selectLuckOnReset)
  const afterReset = useGameStore(selectLuckAfterResetText)
  const threshold = useGameStore(selectLuckThresholdText)
  const runEarned = useGameStore(selectRunEarnedText)
  const percent = useGameStore(selectLuckProgressPercent)
  /** The numbers the confirm dialog shows, frozen at open so the fade-out does not flip to "+0". */
  const [confirm, setConfirm] = useState<{ readonly onReset: number; readonly luckAfter: number; readonly afterReset: string } | null>(null)

  const prestige = (): void => {
    unlockAudio()
    send({ type: 'prestige' })
    play('luck')
    setConfirm(null)
  }

  return (
    <ScreenShake trigger={prestiges}>
      <div data-testid="luck-panel" className="flex flex-col gap-4">
        <PanelCard className="relative flex flex-col gap-1">
          <PanelTitle>Luck</PanelTitle>
          <div className="flex items-end justify-between gap-3">
            <p className="flex items-center gap-2">
              <CloverIcon className="size-7 text-cool-text" aria-hidden="true" />
              <span data-testid="luck-value" className="text-4xl font-semibold tracking-tight text-cool-text tabular">
                {luck}
              </span>
            </p>
            <p className="text-right text-sm text-muted-foreground">
              <span className="font-medium text-foreground tabular">x{multiplier}</span> points
              <br />
              <span className="tabular">{prestiges}</span> {prestiges === 1 ? 'reset' : 'resets'} so far
            </p>
          </div>
          <Particles trigger={prestiges} kind="cool" count={24} />
        </PanelCard>

        {unlocked ? (
          <PanelCard className="flex flex-col gap-3 ring-cool/40">
            <PanelTitle className="text-cool-text">Press your luck</PanelTitle>
            <p className="text-lg leading-snug font-medium">
              Reset for <span className="text-cool-text tabular">+{onReset}</span> luck{' '}
              <span className="text-muted-foreground">
                (x<span className="tabular">{afterReset}</span> points)
              </span>
            </p>
            <p className="text-sm text-muted-foreground">
              This run earned <span className="tabular">{runEarned}</span>. Luck grows with the square root of that, so pushing on pays, but each reset also makes the next run faster.
            </p>
            <Button
              data-testid="luck-reset-button"
              onClick={() => setConfirm({ onReset, luckAfter: luck + onReset, afterReset })}
              className="min-h-11 self-start touch-manipulation"
            >
              Reset for +{onReset} luck
            </Button>
          </PanelCard>
        ) : (
          <PanelCard data-testid="luck-locked" className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <PanelTitle>Luck opens at {threshold} points in one run</PanelTitle>
              <span className="text-sm text-muted-foreground tabular">{percent}%</span>
            </div>
            <Bar value={percent} tone="cool" label="Progress to luck" />
            <p className="text-sm text-muted-foreground">
              <span className="tabular">{runEarned}</span> of <span className="tabular">{threshold}</span> this run. Once there, you can reset the table for luck: a permanent points multiplier that survives every reset.
            </p>
          </PanelCard>
        )}

        <PanelCard className="grid gap-4 sm:grid-cols-2">
          <PlainList title="Resets" items={RESETS} tone="resets" />
          <PlainList title="Stays" items={STAYS} tone="stays" />
        </PanelCard>
      </div>

      <Dialog open={confirm !== null} onOpenChange={(next) => !next && setConfirm(null)}>
        <DialogContent data-testid="luck-confirm-dialog" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Reset for +{confirm?.onReset ?? onReset} luck?</DialogTitle>
            <DialogDescription>
              Points, dice, hand upgrades and charms go. Luck becomes {confirm?.luckAfter ?? luck + onReset}, trophies and stats stay, and every roll from
              now on pays x{confirm?.afterReset ?? afterReset}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" data-testid="luck-cancel-button" onClick={() => setConfirm(null)} className="min-h-11 touch-manipulation">
              Keep playing
            </Button>
            <Button data-testid="luck-confirm-button" disabled={onReset < 1} onClick={prestige} className="min-h-11 touch-manipulation">
              Reset now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ScreenShake>
  )
}
