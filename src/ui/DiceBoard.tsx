// The dice board (the bench): one card per content die, in content order, under a small header
// with one Automation button that opens the automation sheet (auto-roll, auto-level, auto-refine;
// src/ui/AutomationSheet.tsx). The board is the stage for the roll effects: a floating "+N" and
// the combo sound on every new roll, and a gold burst plus a screen shake on four or five of a
// kind. The combo callout itself hangs under the play card (src/ui/BenchCallout.tsx), so it stays
// over the visible dice while the card is pinned on a phone. One column of compact cards on
// phones, two from 640 px, three full cards from 1024 px (DieCard picks the layout). The "+N"
// anchors to the top of the board, not its centre: with five cards stacked on a phone the board is
// far taller than the viewport and its centre is off screen while the player taps Roll above it.
import { useEffect, useRef, useState } from 'react'
import { SlidersHorizontalIcon } from 'lucide-react'
import { content } from '@/content'
import { play } from '@/app/audio'
import { selectBigHands, selectHandRank, selectLastGainedText, selectRolls } from '@/app/selectors'
import { selectAutomationOnCount } from '@/app/selectors.bench'
import { useGameStore } from '@/app/store'
import { Button } from '@/components/ui/button'
import { Particles, ScreenShake, useFloatingNumbers } from '@/ui/fx'
import { AutomationSheet } from './AutomationSheet'
import { DieCard } from './DieCard'

export function DiceBoard() {
  const boardRef = useRef<HTMLDivElement>(null)
  /** Where the "+N" rises from: a strip along the top edge of the board, so it never crosses an ivory face. */
  const floatAnchorRef = useRef<HTMLDivElement>(null)
  const rolls = useGameStore(selectRolls)
  const gained = useGameStore(selectLastGainedText)
  const handRank = useGameStore(selectHandRank)
  const bigHands = useGameStore(selectBigHands)
  const automationOn = useGameStore(selectAutomationOnCount)
  const [automationOpen, setAutomationOpen] = useState(false)
  const { spawn, portal } = useFloatingNumbers()

  // One "+N" and, with a hand, one combo note per new roll. The first roll count seen is a mount, not a roll.
  const seenRoll = useRef(rolls)
  useEffect(() => {
    if (seenRoll.current === rolls) return
    seenRoll.current = rolls
    const board = boardRef.current
    const anchor = floatAnchorRef.current
    // A board hidden behind another tab has no box; a "+N" rising from (0, 0) would be noise. An
    // anchor scrolled off the top (the play card is pinned and the bench scrolled under it) would
    // float over the header; the last-roll row in the card shows the gain there anyway.
    if (board !== null && anchor !== null && board.getClientRects().length > 0 && anchor.getBoundingClientRect().top >= 0) {
      spawn(`+${gained}`, anchor)
    }
    if (handRank > 0) play('combo', { rank: handRank })
  }, [rolls, gained, handRank, spawn])

  return (
    <section aria-labelledby="dice-heading" className="flex flex-col gap-2">
      <header className="flex min-h-11 items-center justify-between gap-3 px-1">
        <h2 id="dice-heading" className="text-sm font-medium text-muted-foreground">
          On the bench
        </h2>
        <Button
          variant="outline"
          data-testid="automation-button"
          aria-haspopup="dialog"
          aria-expanded={automationOpen}
          onClick={() => setAutomationOpen(true)}
          title="Auto-roll, auto-level and auto-refine"
          className="min-h-11 gap-1.5 px-3 touch-manipulation"
        >
          <SlidersHorizontalIcon aria-hidden="true" />
          Automation
          {automationOn > 0 && (
            <span
              aria-label={`${automationOn} on`}
              className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground tabular"
            >
              {automationOn}
            </span>
          )}
        </Button>
      </header>

      <ScreenShake trigger={bigHands}>
        <div ref={boardRef} className="relative">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {content.dice.map((die, index) => (
              <DieCard key={die.id} id={die.id} index={index} />
            ))}
          </div>
          <div ref={floatAnchorRef} aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-20" />
          <Particles trigger={bigHands} kind="gold" count={24} />
        </div>
      </ScreenShake>
      {portal}

      <AutomationSheet open={automationOpen} onOpenChange={setAutomationOpen} />
    </section>
  )
}
