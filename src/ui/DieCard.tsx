// One die slot: owned (face, level, multiplier, level buttons), buyable, or locked.
import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { Id } from '@/content'
import { selectDieCard } from '@/app/selectors'
import { send, useGameStore } from '@/app/store'
import { Button } from '@/components/ui/button'
import { DieFace } from './DieFace'

export function DieCard({ id, index }: { id: Id; index: number }) {
  const selector = useMemo(() => selectDieCard(id, index), [id, index])
  const v = useGameStore(useShallow(selector))

  if (!v.owned) {
    return (
      <div className="rounded-xl border bg-card text-card-foreground p-4 flex flex-col items-center gap-3 opacity-90">
        <DieFace face={null} size={56} />
        <div className="text-sm font-medium">{v.name}</div>
        {v.unlocked ? (
          <Button size="sm" disabled={!v.canBuy} onClick={() => send({ type: 'buyDie', id })} className="touch-manipulation select-none">
            Buy for {v.nextCost}
          </Button>
        ) : (
          <div className="text-xs text-muted-foreground text-center">Own the previous die to unlock</div>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-card text-card-foreground p-4 flex flex-col items-center gap-3">
      <DieFace face={v.face} size={72} />
      <div className="text-sm font-medium">{v.name}</div>
      <div className="text-xs text-muted-foreground">
        Level {v.level} · x{v.multiplier} per pip
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button size="sm" variant="secondary" disabled={!v.affordable} onClick={() => send({ type: 'levelDie', id, count: 1 })} className="touch-manipulation select-none">
          +1 · {v.nextCost}
        </Button>
        <Button size="sm" variant="secondary" disabled={v.maxAffordable < 10} onClick={() => send({ type: 'levelDie', id, count: 10 })} className="touch-manipulation select-none">
          +10 · {v.cost10}
        </Button>
        <Button size="sm" variant="secondary" disabled={v.maxAffordable < 1} onClick={() => send({ type: 'levelDie', id, count: 'max' })} className="touch-manipulation select-none">
          Max ({v.maxAffordable})
        </Button>
      </div>
    </div>
  )
}
