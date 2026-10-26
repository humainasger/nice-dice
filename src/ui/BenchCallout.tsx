// The combo callout wired to the store: "FULL HOUSE 9.6x" with the rolled faces (the hand's dice
// ringed) and the gain, slamming in over the bench on every roll that lands a hand. It renders
// inside the play card's wrapper (PlayCard.tsx), hung just under the card, rather than inside the
// board: below lg the wrapper is sticky, so the callout rides with the pinned card and lands over
// whichever dice are on screen at any scroll depth instead of under the card at the board's top;
// at lg and up the card is in flow and the callout sits over the first row of dice. aria-hidden,
// the last-roll row in the card carries the same facts for screen readers.
import {
  selectHandRank,
  selectHandText,
  selectLastGainedText,
  selectLastRollFaceList,
  selectLastRollMemberList,
  selectRolls,
} from '@/app/selectors'
import { useGameStore, useShallow } from '@/app/store'
import { ComboCallout } from '@/ui/fx'

export function BenchCallout() {
  const rolls = useGameStore(selectRolls)
  const gained = useGameStore(selectLastGainedText)
  const handText = useGameStore(selectHandText)
  const handRank = useGameStore(selectHandRank)
  const faces = useGameStore(useShallow(selectLastRollFaceList))
  const members = useGameStore(useShallow(selectLastRollMemberList))

  // A zero-height slot under the card; the callout's `items-start` plus the top padding place it
  // over the first die card on a phone (the bench header is 52 px with its gap) and over the first
  // row's faces at lg, where the full cards start with a badge row.
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-full h-0">
      <ComboCallout
        text={handText}
        rank={handRank}
        visibleKey={rolls}
        detail={`+${gained}`}
        faces={faces}
        members={members}
        className="items-start pt-14 lg:pt-32"
      />
    </div>
  )
}
