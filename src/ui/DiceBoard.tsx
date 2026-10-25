// The dice board: one card per content die, in content order, under a small header that carries
// the auto-ascend switch once ascension is in play. The board is the stage for the roll effects:
// a floating "+N" and the combo sound on every new roll, the combo callout over the first row of
// dice with the gain under it, and a gold burst plus a screen shake on four or five of a kind. One
// column on phones, two from 640 px, three from 1024 px. The effects anchor to the top of the
// board, not its centre: with five cards stacked on a phone the board is far taller than the
// viewport and its centre is off screen while the player taps Roll above it.
import { useEffect, useRef } from 'react'
import { content } from '@/content'
import { play } from '@/app/audio'
import {
  selectAscensionVisible,
  selectAutoAscend,
  selectBigHands,
  selectHandRank,
  selectHandText,
  selectLastGainedText,
  selectRolls,
} from '@/app/selectors'
import { send, useGameStore } from '@/app/store'
import { Switch } from '@/components/ui/switch'
import { ComboCallout, Particles, ScreenShake, useFloatingNumbers } from '@/ui/fx'
import { DieCard } from './DieCard'

export function DiceBoard() {
  const boardRef = useRef<HTMLDivElement>(null)
  /** Where the "+N" rises from: a strip along the top edge of the board, so it never crosses an ivory face. */
  const floatAnchorRef = useRef<HTMLDivElement>(null)
  const rolls = useGameStore(selectRolls)
  const gained = useGameStore(selectLastGainedText)
  const handText = useGameStore(selectHandText)
  const handRank = useGameStore(selectHandRank)
  const bigHands = useGameStore(selectBigHands)
  const ascensionVisible = useGameStore(selectAscensionVisible)
  const autoAscend = useGameStore(selectAutoAscend)
  const { spawn, portal } = useFloatingNumbers()

  // One "+N" and, with a hand, one combo note per new roll. The first roll count seen is a mount, not a roll.
  const seenRoll = useRef(rolls)
  useEffect(() => {
    if (seenRoll.current === rolls) return
    seenRoll.current = rolls
    const board = boardRef.current
    // A board hidden behind another tab has no box; a "+N" rising from (0, 0) would be noise.
    if (board !== null && board.getClientRects().length > 0) spawn(`+${gained}`, floatAnchorRef.current)
    if (handRank > 0) play('combo', { rank: handRank })
  }, [rolls, gained, handRank, spawn])

  return (
    <section aria-labelledby="dice-heading" className="flex flex-col gap-2">
      <header className="flex min-h-8 items-center justify-between gap-3 px-1">
        <h2 id="dice-heading" className="text-sm font-medium text-muted-foreground">
          Dice
        </h2>
        {ascensionVisible && (
          <label
            htmlFor="auto-ascend"
            className="flex min-h-11 items-center gap-2 text-xs text-muted-foreground select-none touch-manipulation"
          >
            Auto-ascend at level {content.rules.ascension.level}
            <Switch
              id="auto-ascend"
              aria-label="Auto-ascend"
              data-testid="auto-ascend-switch"
              checked={autoAscend}
              onCheckedChange={(checked) => send({ type: 'setAutoAscend', enabled: checked })}
            />
          </label>
        )}
      </header>

      <ScreenShake trigger={bigHands}>
        <div ref={boardRef} className="relative">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {content.dice.map((die, index) => (
              <DieCard key={die.id} id={die.id} index={index} />
            ))}
          </div>
          <div ref={floatAnchorRef} aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-20" />
          {/* pt-14 puts the callout over the faces of the first row of cards (badge row, then the 72 px face). */}
          <ComboCallout text={handText} rank={handRank} visibleKey={rolls} detail={`+${gained}`} className="items-start pt-14" />
          <Particles trigger={bigHands} kind="gold" count={24} />
        </div>
      </ScreenShake>
      {portal}
    </section>
  )
}
