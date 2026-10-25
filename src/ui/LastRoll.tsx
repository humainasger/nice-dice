// The last roll as a line: small faces, the sum and what it earned, plus the lifetime roll count.
import { selectLastGainedText, selectLastRollFaces, selectRolls } from '@/app/selectors'
import { useGameStore } from '@/app/store'
import { DieFace } from './DieFace'

export function LastRoll() {
  const faces = useGameStore(selectLastRollFaces)
  const gained = useGameStore(selectLastGainedText)
  const rolls = useGameStore(selectRolls)

  if (faces === '') {
    return <p className="text-center text-sm text-muted-foreground">No rolls yet. Press Roll, or Space on a keyboard.</p>
  }

  const list = faces.split(' ')
  return (
    <section aria-label="Last roll" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
      <span>Last roll</span>
      <span className="flex items-center gap-1" aria-hidden="true">
        {list.map((face, i) => (
          <DieFace key={i} face={Number(face)} size={24} />
        ))}
      </span>
      <span>
        {list.join(' + ')} for <span className="font-medium text-foreground tabular-nums">+{gained}</span> points
      </span>
      <span className="tabular-nums">· {rolls} rolls in total</span>
    </section>
  )
}
