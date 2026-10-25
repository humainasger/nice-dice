// The last roll as a line: the sides as small faces (printed values when raised), the sum of the
// printed values and what it earned, the hand when there was one in its rank colour, and the
// lifetime roll count.
import {
  selectHandRank,
  selectHandText,
  selectLastGainedText,
  selectLastRollFaces,
  selectLastRollValues,
  selectRolls,
} from '@/app/selectors'
import { useGameStore } from '@/app/store'
import { cn } from '@/lib/utils'
import { DieFace } from './DieFace'
import { RANK_TEXT_CLASS } from './useRollPulse'

export function LastRoll() {
  const faces = useGameStore(selectLastRollFaces)
  const values = useGameStore(selectLastRollValues)
  const gained = useGameStore(selectLastGainedText)
  const rolls = useGameStore(selectRolls)
  const handText = useGameStore(selectHandText)
  const handRank = useGameStore(selectHandRank)

  if (faces === '') {
    return <p className="text-center text-sm text-muted-foreground">No rolls yet. Press Roll, or Space on a keyboard.</p>
  }

  const sides = faces.split(' ').map(Number)
  const printed = values.split(' ').map(Number)
  return (
    <section
      aria-label="Last roll"
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-muted-foreground"
    >
      <span>Last roll</span>
      <span className="flex items-center gap-1" aria-hidden="true">
        {sides.map((side, i) => (
          <DieFace key={i} face={side} value={printed[i] ?? side} size={24} />
        ))}
      </span>
      <span>
        {printed.join(' + ')} for <span className="font-medium text-foreground tabular">+{gained}</span> points
      </span>
      {handText !== '' && (
        <span className={cn('font-semibold tracking-wide tabular', RANK_TEXT_CLASS[handRank] ?? '')}>{handText}</span>
      )}
      <span className="tabular">· {rolls} rolls in total</span>
    </section>
  )
}
