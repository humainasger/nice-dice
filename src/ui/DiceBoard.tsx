// The dice board: one card per content die, in content order. One column on phones, two from
// 640 px and three from 1024 px.
import { content } from '@/content'
import { DieCard } from './DieCard'

export function DiceBoard() {
  return (
    <section aria-label="Dice" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {content.dice.map((die, index) => (
        <DieCard key={die.id} id={die.id} index={index} />
      ))}
    </section>
  )
}
