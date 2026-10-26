// A row of mini dice: the faces of a roll as small DieFace tiles in content order, the dice that
// form the hand ringed in the hand's rank colour (or a muted ring). 28 px by default. The play
// card's last-roll row and the combo callout's detail line both use it. Pure presentation: the
// faces and the member indexes (handMembers in src/core) arrive from a useShallow selector.
import { cn } from '@/lib/utils'
import { DieFace } from './DieFace'
import { RANK_RING_CLASS } from './useRollPulse'

/** muted, or rank-1 (pair) to rank-7 (five of a kind) for the ring colour. */
export type DiceRowTone = 'muted' | `rank-${number}`

const MUTED_RING = 'ring-muted-foreground/50'
const NO_MEMBERS: readonly number[] = []

interface DiceRowProps {
  /** Sides rolled, in content order. */
  readonly faces: readonly number[]
  /** Indexes into faces that form the hand; those dice wear the ring. */
  readonly members?: readonly number[]
  readonly size?: number
  readonly tone?: DiceRowTone
  /** The roll count; when it changes the faces tumble. Leave it out for a static row. */
  readonly rollKey?: number
  readonly className?: string
  readonly testId?: string
}

function ringClass(tone: DiceRowTone): string {
  if (tone === 'muted') return MUTED_RING
  const ring = RANK_RING_CLASS[Number(tone.slice('rank-'.length))] ?? ''
  return ring === '' ? MUTED_RING : ring
}

export function DiceRow({ faces, members = NO_MEMBERS, size = 28, tone = 'muted', rollKey, className, testId }: DiceRowProps) {
  const ring = ringClass(tone)
  return (
    <ol aria-label={`Rolled ${faces.join(' ')}`} data-testid={testId} className={cn('flex items-center gap-1', className)}>
      {faces.map((face, i) => (
        <li key={i} className={cn('rounded-[7px] p-px', members.includes(i) && `ring-2 ${ring}`)}>
          <DieFace face={face} size={size} rollKey={rollKey} />
        </li>
      ))}
    </ol>
  )
}
