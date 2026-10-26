// The Luck tab as the luck shop: spendable and lifetime luck with the multiplier, the reset
// preview with the log formula (locked: the threshold and a progress bar) and its confirm dialog,
// then one row per luck upgrade with level pips, the effect line built from the def, the next cost
// and a Buy button, and under the seven the two sinks without a cap: Fortune's Favour (one row,
// +N% on every roll per level) and Mastery (one row per die on the bench, +N% on that die per
// level; the button does what the die card's Master button does). Before the first luck the rows
// show greyed with "Earn luck to spend here". A prestige plays the luck sound, shakes the panel and
// bursts cool particles; a buy plays the luck sound quietly and bursts the row.
import { useMemo, useState } from 'react'
import { CloverIcon } from 'lucide-react'
import { content, type Id, type LuckUpgradeId } from '@/content'
import { play, unlockAudio } from '@/app/audio'
import {
  selectAutoLevelAvailable,
  selectFavourRow,
  selectFirstDieName,
  selectHeadStartLevel,
  selectLuckPerDecade,
  selectLuckShopOpen,
  selectLuckSpendable,
  selectLuckSpent,
  selectLuckTotal,
  selectLuckUpgradeRow,
  selectMasteryRow,
  selectMemoryKept,
} from '@/app/selectors.luck'
import {
  selectLuckAfterResetText,
  selectLuckMultiplierText,
  selectLuckOnReset,
  selectLuckProgressPercent,
  selectLuckThresholdText,
  selectLuckUnlocked,
  selectPrestiges,
  selectRunEarnedText,
} from '@/app/selectors.meta'
import { send, useGameStore, useShallow } from '@/app/store'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Particles, ScreenShake } from '@/ui/fx'
import { Bar, PanelCard, PanelTitle } from './parts'

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

/** Level as pips: one dot per level, the bought ones cool. Up to ten across. */
function Pips({ level, max, name }: { readonly level: number; readonly max: number; readonly name: string }) {
  return (
    <span className="flex items-center gap-1.5" aria-label={`${name} level ${level} of ${max}`} title={`Level ${level} of ${max}`}>
      <span className="flex items-center gap-0.5" aria-hidden="true">
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className={cn('size-1.5 rounded-full', i < level ? 'bg-cool' : 'bg-foreground/15')} />
        ))}
      </span>
      <span className="text-xs text-muted-foreground tabular" aria-hidden="true">
        {level}/{max}
      </span>
    </span>
  )
}

/** One upgrade: name, pips, description, the effect line, the next cost and Buy. The burst fires on the level. */
function UpgradeRow({ id, shopOpen }: { readonly id: LuckUpgradeId; readonly shopOpen: boolean }) {
  const selector = useMemo(() => selectLuckUpgradeRow(id), [id])
  const v = useGameStore(useShallow(selector))
  const canBuy = shopOpen && v.affordable && !v.maxed

  const buy = (): void => {
    unlockAudio()
    send({ type: 'buyLuckUpgrade', id })
    play('luck', { rank: 1 })
  }

  return (
    <li data-testid={`luck-upgrade-${id}`} className={cn('relative flex items-start gap-3 py-3', !shopOpen && 'opacity-60')}>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="font-medium">{v.name}</p>
          <Pips level={v.level} max={v.maxLevel} name={v.name} />
        </div>
        <p className="text-xs text-muted-foreground">{v.description}</p>
        <p className={cn('text-sm', v.level > 0 ? 'font-medium text-cool-text' : 'text-muted-foreground')}>{v.effectText}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {v.maxed ? (
          <span className="text-xs text-muted-foreground">Maxed</span>
        ) : (
          <span className={cn('text-xs tabular', canBuy ? 'text-cool-text' : 'text-muted-foreground')}>
            {v.nextCost} luck
          </span>
        )}
        <Button
          data-testid={`luck-buy-${id}`}
          variant={canBuy ? 'default' : 'outline'}
          disabled={!canBuy}
          onClick={buy}
          aria-label={v.maxed ? `${v.name} is maxed` : `Buy ${v.name} for ${v.nextCost} luck`}
          className={cn('min-h-11 min-w-16 touch-manipulation', canBuy && 'glow-cool')}
        >
          {v.maxed ? 'Done' : 'Buy'}
        </Button>
      </div>
      <Particles trigger={v.level} kind="cool" count={16} />
    </li>
  )
}

interface SinkRowProps {
  readonly testId: string
  readonly buyTestId: string
  readonly name: string
  readonly level: number
  /** Under the name: what the sink does. */
  readonly description: string
  /** The effect line: "+5% points per level, now +15%". */
  readonly effectText: string
  readonly owned: boolean
  readonly nextCost: number
  readonly affordable: boolean
  readonly shopOpen: boolean
  readonly onBuy: () => void
}

/**
 * One row of a sink without a cap: name with its level (no pips, the level is open ended), the
 * description, the effect line, the next cost (it only grows) and Buy. The burst fires on the level.
 */
function SinkRow({ testId, buyTestId, name, level, description, effectText, owned, nextCost, affordable, shopOpen, onBuy }: SinkRowProps) {
  const canBuy = shopOpen && affordable
  return (
    <li data-testid={testId} className={cn('relative flex items-start gap-3 py-3', !shopOpen && 'opacity-60')}>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="font-medium">{name}</p>
          <span className="text-xs text-muted-foreground tabular" title={`Level ${level}, no cap`}>
            {owned ? `Lv ${level}` : 'none yet'}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
        <p className={cn('text-sm', owned ? 'font-medium text-cool-text' : 'text-muted-foreground')}>{effectText}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={cn('text-xs tabular', canBuy ? 'text-cool-text' : 'text-muted-foreground')}>{nextCost} luck</span>
        <Button
          data-testid={buyTestId}
          variant={canBuy ? 'default' : 'outline'}
          disabled={!canBuy}
          onClick={onBuy}
          aria-label={`Buy ${name} level ${level + 1} for ${nextCost} luck`}
          className={cn('min-h-11 min-w-16 touch-manipulation', canBuy && 'glow-cool')}
        >
          Buy
        </Button>
      </div>
      <Particles trigger={level} kind="cool" count={16} />
    </li>
  )
}

/** Fortune's Favour: +N% on every roll per level, no cap, kept through every reset. */
function FavourRow({ shopOpen }: { readonly shopOpen: boolean }) {
  const v = useGameStore(useShallow(selectFavourRow))
  const buy = (): void => {
    unlockAudio()
    send({ type: 'buyFavour' })
    play('luck', { rank: 1 })
  }
  return (
    <SinkRow
      testId="luck-favour"
      buyTestId="favour-buy"
      name="Fortune's Favour"
      level={v.level}
      description="Every roll pays a little more. No cap; the price climbs with every level and the favour stays through every reset."
      effectText={`+${v.stepPercent}% points per level${v.level > 0 ? `, now +${v.bonusPercent}% (x${v.multiplier})` : ''}`}
      owned={v.level > 0}
      nextCost={v.nextCost}
      affordable={v.affordable}
      shopOpen={shopOpen}
      onBuy={buy}
    />
  )
}

/** One die's mastery row. Renders nothing while the die is not on the bench; the level waits for it. */
function MasteryRow({ id, shopOpen }: { readonly id: Id; readonly shopOpen: boolean }) {
  const selector = useMemo(() => selectMasteryRow(id), [id])
  const v = useGameStore(useShallow(selector))
  if (!v.owned) return null
  const buy = (): void => {
    unlockAudio()
    send({ type: 'masterDie', id })
    play('luck', { rank: 1 })
  }
  return (
    <SinkRow
      testId={`mastery-${id}`}
      buyTestId={`mastery-buy-${id}`}
      name={v.name}
      level={v.level}
      description={`+${v.stepPercent}% output on this die per level, on top of its refinements.`}
      effectText={v.level > 0 ? `x${v.multiplier} output, +${v.bonusPercent}%` : 'Not mastered yet'}
      owned={v.level > 0}
      nextCost={v.nextCost}
      affordable={v.affordable}
      shopOpen={shopOpen}
      onBuy={buy}
    />
  )
}

export function LuckPanel() {
  const luck = useGameStore(selectLuckSpendable)
  const luckTotal = useGameStore(selectLuckTotal)
  const luckSpent = useGameStore(selectLuckSpent)
  const shopOpen = useGameStore(selectLuckShopOpen)
  const prestiges = useGameStore(selectPrestiges)
  const multiplier = useGameStore(selectLuckMultiplierText)
  const unlocked = useGameStore(selectLuckUnlocked)
  const onReset = useGameStore(selectLuckOnReset)
  const afterReset = useGameStore(selectLuckAfterResetText)
  const threshold = useGameStore(selectLuckThresholdText)
  const runEarned = useGameStore(selectRunEarnedText)
  const percent = useGameStore(selectLuckProgressPercent)
  const perDecade = useGameStore(selectLuckPerDecade)
  const memoryKept = useGameStore(selectMemoryKept)
  const headStart = useGameStore(selectHeadStartLevel)
  const firstDie = useGameStore(selectFirstDieName)
  const autoLevelOwned = useGameStore(selectAutoLevelAvailable)
  /** The numbers the confirm dialog shows, frozen at open so the fade-out does not flip to "+0". */
  const [confirm, setConfirm] = useState<{ readonly onReset: number; readonly luckAfter: number; readonly totalAfter: number; readonly afterReset: string } | null>(null)

  const prestige = (): void => {
    unlockAudio()
    send({ type: 'prestige' })
    play('luck')
    setConfirm(null)
  }

  const resets: readonly string[] = [
    'Points',
    `Dice: back to ${firstDie} at level ${headStart}, faces 1 to 6, unrefined`,
    'Hand upgrades',
    memoryKept > 0 ? `Charms beyond the ${memoryKept} Memory keeps, and draft progress` : 'Charms and draft progress',
    'This run’s earnings',
  ]
  const stays: readonly string[] = [
    'Lifetime luck and its multiplier',
    'Luck upgrades and unspent luck',
    'Mastery on every die, and Fortune’s Favour',
    'Marks',
    'Lifetime stats',
    autoLevelOwned ? 'Settings, auto-roll and auto-level' : 'Settings and auto-roll',
  ]
  const shown = confirm ?? { onReset, luckAfter: luck + onReset, totalAfter: luckTotal + onReset, afterReset }

  return (
    <ScreenShake trigger={prestiges}>
      <div data-testid="luck-panel" className="flex flex-col gap-4">
        <PanelCard className="relative flex flex-col gap-1">
          <PanelTitle>Luck</PanelTitle>
          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-col">
              <p className="flex items-center gap-2">
                <CloverIcon className="size-7 text-cool-text" aria-hidden="true" />
                <span data-testid="luck-value" className="text-4xl font-semibold tracking-tight text-cool-text tabular">
                  <span data-testid="luck-spendable">{luck}</span>
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                to spend{luckSpent > 0 && <span className="tabular">, {luckSpent} spent</span>}
              </p>
            </div>
            <p className="text-right text-sm text-muted-foreground">
              <span data-testid="luck-total" className="font-medium text-foreground tabular">
                {luckTotal}
              </span>{' '}
              lifetime luck
              <br />
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
              This run earned <span className="tabular">{runEarned}</span>. Every tenfold past <span className="tabular">{threshold}</span> is worth{' '}
              <span className="tabular">{perDecade}</span> more luck, so pushing on pays, but each reset also makes the next run faster. The
              multiplier counts every luck you ever earned, spent or not.
            </p>
            <Button
              data-testid="luck-reset-button"
              onClick={() => setConfirm({ onReset, luckAfter: luck + onReset, totalAfter: luckTotal + onReset, afterReset })}
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
              <span className="tabular">{runEarned}</span> of <span className="tabular">{threshold}</span> this run. Once there, you can clear the bench for
              luck: a permanent points multiplier that survives every reset, and a currency for the upgrades below. Every tenfold past the threshold
              is worth <span className="tabular">{perDecade}</span> more luck.
            </p>
          </PanelCard>
        )}

        <PanelCard className="flex flex-col gap-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <PanelTitle>Luck shop</PanelTitle>
            {shopOpen ? (
              <span className="text-xs text-muted-foreground">
                Permanent, paid in luck. <span className="tabular">{luck}</span> to spend.
              </span>
            ) : (
              <span data-testid="luck-shop-locked" className="text-xs font-medium text-muted-foreground">
                Earn luck to spend here
              </span>
            )}
          </div>
          <ul data-testid="luck-shop-list" className="divide-y divide-border/60">
            {content.luckUpgrades.map((def) => (
              <UpgradeRow key={def.id} id={def.id} shopOpen={shopOpen} />
            ))}
          </ul>

          <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-border/60 pt-4">
            <PanelTitle>Without end</PanelTitle>
            <span className="text-xs text-muted-foreground">No cap. Each level costs more than the last.</span>
          </div>
          <ul data-testid="luck-favour-list" className="divide-y divide-border/60">
            <FavourRow shopOpen={shopOpen} />
          </ul>

          <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-border/60 pt-4">
            <PanelTitle>Mastery</PanelTitle>
            <span className="text-xs text-muted-foreground">Per die, for the dice on the bench. Kept through every reset.</span>
          </div>
          <ul data-testid="mastery-list" className="divide-y divide-border/60">
            {content.dice.map((def) => (
              <MasteryRow key={def.id} id={def.id} shopOpen={shopOpen} />
            ))}
          </ul>
        </PanelCard>

        <PanelCard className="grid gap-4 sm:grid-cols-2">
          <PlainList title="Resets" items={resets} tone="resets" />
          <PlainList title="Stays" items={stays} tone="stays" />
        </PanelCard>
      </div>

      <Dialog open={confirm !== null} onOpenChange={(next) => !next && setConfirm(null)}>
        <DialogContent data-testid="luck-confirm-dialog" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Reset for +{shown.onReset} luck?</DialogTitle>
            <DialogDescription>
              Points, dice, hand upgrades and charms go{memoryKept > 0 ? ` (Memory keeps the ${memoryKept} rarest)` : ''}. Spendable luck becomes{' '}
              {shown.luckAfter}, lifetime luck {shown.totalAfter}; marks, stats, luck upgrades, mastery and Fortune’s Favour stay, and every roll
              from now on pays x{shown.afterReset}.
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
