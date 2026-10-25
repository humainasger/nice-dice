// One die slot as a card: owned (face, level, multiplier, three level buttons), buyable (price and
// a buy button) or locked (what unlocks it). Every number arrives formatted from the selector.
import { useMemo } from 'react'
import type { Id } from '@/content'
import { selectDieCard, selectRolls } from '@/app/selectors'
import { send, useGameStore, useShallow } from '@/app/store'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DieFace } from './DieFace'

interface LevelButtonProps {
  readonly testId: string
  readonly label: string
  readonly description: string
  readonly cost: string
  readonly disabled: boolean
  readonly onClick: () => void
}

function LevelButton({ testId, label, description, cost, disabled, onClick }: LevelButtonProps) {
  return (
    <Button
      variant="secondary"
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      aria-label={cost === '' ? description : `${description} for ${cost}`}
      className="h-auto min-h-11 flex-col gap-0 px-1 py-1.5 touch-manipulation"
    >
      <span className="text-sm leading-tight font-semibold">{label}</span>
      <span className="text-[0.7rem] leading-tight text-muted-foreground tabular-nums">{cost === '' ? ' ' : cost}</span>
    </Button>
  )
}

export function DieCard({ id, index }: { readonly id: Id; readonly index: number }) {
  const selector = useMemo(() => selectDieCard(id, index), [id, index])
  const v = useGameStore(useShallow(selector))
  const rolls = useGameStore(selectRolls)

  if (!v.owned) {
    return (
      <Card data-testid={`die-card-${id}`} size="sm" className={v.unlocked ? 'items-center px-3 text-center' : 'items-center px-3 text-center opacity-70'}>
        <DieFace face={null} size={56} className={v.unlocked ? 'opacity-60' : 'opacity-30'} />
        <h3 className="font-medium">{v.name}</h3>
        {v.unlocked ? (
          <Button
            data-testid={`buy-${id}`}
            disabled={!v.canBuy}
            onClick={() => send({ type: 'buyDie', id })}
            className="min-h-11 w-full max-w-48 touch-manipulation"
          >
            Buy for {v.nextCost}
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">Locked. To unlock, {v.unlockText}.</p>
        )}
      </Card>
    )
  }

  return (
    <Card data-testid={`die-card-${id}`} size="sm" className="items-center px-3 text-center">
      <DieFace face={v.face} size={72} rollKey={rolls} />
      <div>
        <h3 className="font-medium">{v.name}</h3>
        <p className="text-xs text-muted-foreground">
          Level {v.level} · x{v.multiplier} per pip
        </p>
      </div>
      <div className="grid w-full grid-cols-3 gap-2" role="group" aria-label={`Level up ${v.name}`}>
        <LevelButton
          testId={`level1-${id}`}
          label="+1"
          description="Buy one level"
          cost={v.nextCost}
          disabled={!v.affordable}
          onClick={() => send({ type: 'levelDie', id, count: 1 })}
        />
        <LevelButton
          testId={`level10-${id}`}
          label="+10"
          description="Buy ten levels"
          cost={v.cost10}
          disabled={v.maxAffordable < 10}
          onClick={() => send({ type: 'levelDie', id, count: 10 })}
        />
        <LevelButton
          testId={`levelmax-${id}`}
          label={v.maxAffordable > 0 ? `Max (${v.maxAffordable})` : 'Max'}
          description={v.maxAffordable > 0 ? `Buy ${v.maxAffordable} levels` : 'Buy every affordable level'}
          cost={v.costMax}
          disabled={v.maxAffordable < 1}
          onClick={() => send({ type: 'levelDie', id, count: 'max' })}
        />
      </div>
    </Card>
  )
}
