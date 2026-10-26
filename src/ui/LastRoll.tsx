// The last-roll row of the play card: the rolled dice as a row of mini faces (the dice that form
// the hand ringed in its colour), the hand name with its multiplier ("FULL HOUSE 7x", muted "no
// hand" when none) and the gain "+12.3K". "Roll to begin" before the first roll. The faces and the
// hand's member indexes arrive as arrays through useShallow; the hand reads from the sides, so the
// row shows sides, not printed values.
import {
  selectHandRank,
  selectHandText,
  selectLastGainedText,
  selectLastRollFaceList,
  selectLastRollMemberList,
  selectRolls,
} from '@/app/selectors'
import { useGameStore, useShallow } from '@/app/store'
import { cn } from '@/lib/utils'
import { DiceRow } from './DiceRow'
import { RANK_TEXT_CLASS } from './useRollPulse'

export function LastRollRow() {
  const faces = useGameStore(useShallow(selectLastRollFaceList))
  const members = useGameStore(useShallow(selectLastRollMemberList))
  const rolls = useGameStore(selectRolls)
  const gained = useGameStore(selectLastGainedText)
  const handText = useGameStore(selectHandText)
  const handRank = useGameStore(selectHandRank)

  if (faces.length === 0) {
    return <p className="flex min-h-[30px] items-center text-sm text-muted-foreground">Roll to begin</p>
  }

  return (
    <div role="group" aria-label="Last roll" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <DiceRow
        faces={faces}
        members={members}
        size={28}
        tone={handRank > 0 ? `rank-${handRank}` : 'muted'}
        rollKey={rolls}
        testId="last-roll-faces"
      />
      {handText !== '' ? (
        <span className={cn('font-semibold tracking-wide tabular', RANK_TEXT_CLASS[handRank] ?? '')}>{handText}</span>
      ) : (
        <span className="text-muted-foreground">no hand</span>
      )}
      <span className="ml-auto font-semibold text-foreground tabular">+{gained}</span>
    </div>
  )
}
