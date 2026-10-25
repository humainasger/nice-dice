// One die slot as a card: owned (the face from the last roll with a ring while it is part of the
// hand, level and ascension badges, the six-face strip with raised faces in amber, level buttons or
// Ascend at the cap, the face upgrade once unlocked), buyable (price and a buy button) or locked
// (what unlocks it). Every number arrives formatted from the selector; the sounds and the gold
// burst fire next to the commands, the ascension ones on the count so auto-ascend gets them too.
import { useEffect, useMemo, useRef } from 'react'
import { ChevronsUpIcon } from 'lucide-react'
import { content, type Id } from '@/content'
import { play } from '@/app/audio'
import { selectDieSlot, selectHandRank, selectRolls } from '@/app/selectors'
import { send, useGameStore, useShallow } from '@/app/store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { CALLOUT_FADE_MS, CALLOUT_HOLD_MS, Particles } from '@/ui/fx'
import { DieFace } from './DieFace'
import { RANK_RING_CLASS, useRollPulse } from './useRollPulse'

/** The hand ring stays as long as the combo callout. */
const RING_MS = CALLOUT_HOLD_MS + CALLOUT_FADE_MS

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
      variant="outline"
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      aria-label={cost === '' ? description : `${description} for ${cost}`}
      className="h-auto min-h-11 flex-col gap-0 px-1 py-1.5 touch-manipulation"
    >
      <span className="text-sm leading-tight font-semibold">{label}</span>
      <span className="text-[0.7rem] leading-tight text-muted-foreground tabular">{cost === '' ? ' ' : cost}</span>
    </Button>
  )
}

interface FaceStripProps {
  /** "1 2 3 4 5 6": the printed faces in side order. */
  readonly faces: string
  /** Side index the next upgrade raises. */
  readonly next: number
  /** Mark the next side; false until face editing is unlocked. */
  readonly showNext: boolean
  readonly cap: number
}

/** The six printed faces as small tiles: raised ones amber, the one to be raised next dashed. */
function FaceStrip({ faces, next, showNext, cap }: FaceStripProps) {
  const values = faces.split(' ').map(Number)
  return (
    <ol className="flex items-center justify-center gap-1" aria-label="Printed faces">
      {values.map((value, i) => {
        const raised = value > i + 1
        return (
          <li
            key={i}
            aria-label={`Side ${i + 1} shows ${value}`}
            className={cn(
              'flex size-6 items-center justify-center rounded-[5px] text-[0.7rem] font-semibold ring-1 tabular transition-colors',
              raised ? 'bg-amber text-primary-foreground ring-amber/60' : 'bg-die text-die-pip ring-die-edge',
              showNext && i === next && value < cap && 'outline-2 outline-offset-1 outline-dashed outline-amber/70',
            )}
          >
            {value}
          </li>
        )
      })}
    </ol>
  )
}

export function DieCard({ id, index }: { readonly id: Id; readonly index: number }) {
  const selector = useMemo(() => selectDieSlot(id, index), [id, index])
  const v = useGameStore(useShallow(selector))
  const rolls = useGameStore(selectRolls)
  const handRank = useGameStore(selectHandRank)
  const ringing = useRollPulse(rolls, RING_MS)

  // Ascension happens inside the core (the button or auto-ascend); the sound follows the count either way.
  const seenAscensions = useRef(v.ascensions)
  useEffect(() => {
    if (seenAscensions.current === v.ascensions) return
    seenAscensions.current = v.ascensions
    play('ascend')
  }, [v.ascensions])

  if (!v.owned) {
    return (
      <Card
        data-testid={`die-card-${id}`}
        size="sm"
        className={cn('items-center px-3 text-center shadow-soft', !v.unlocked && 'opacity-70')}
      >
        <DieFace face={null} size={56} className={v.unlocked ? 'opacity-60' : 'opacity-30'} />
        <h3 className="font-medium">{v.name}</h3>
        {v.unlocked ? (
          <Button
            data-testid={`buy-${id}`}
            disabled={!v.canBuy}
            onClick={() => {
              send({ type: 'buyDie', id })
              play('buy')
            }}
            className={cn('min-h-11 w-full max-w-48 touch-manipulation', v.canBuy && 'glow-amber')}
          >
            Buy for {v.nextCost}
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">Locked. To unlock, {v.unlockText}.</p>
        )}
      </Card>
    )
  }

  const ring = ringing && v.inHand ? (RANK_RING_CLASS[handRank] ?? '') : ''
  return (
    <Card data-testid={`die-card-${id}`} size="sm" className="relative items-center overflow-visible px-3 text-center shadow-soft">
      <Particles trigger={v.ascensions} kind="gold" count={24} />

      <div className="flex w-full items-center justify-between gap-2">
        <Badge variant="outline" className="tabular">
          Lv {v.level}
          <span className="text-muted-foreground">/{v.cap}</span>
        </Badge>
        {v.ascensions > 0 ? (
          <Badge className="tabular" title={`Ascended ${v.ascensions} ${v.ascensions === 1 ? 'time' : 'times'}`}>
            A{v.ascensions}
          </Badge>
        ) : (
          <span className="text-[0.7rem] text-muted-foreground">not ascended</span>
        )}
      </div>

      <div className={cn('rounded-2xl p-1 transition-shadow duration-150', ring !== '' && `ring-3 ${ring}`)}>
        <DieFace face={v.side} value={v.value} size={72} rollKey={rolls} />
      </div>

      <div>
        <h3 className="font-medium">{v.name}</h3>
        <p className="text-xs text-muted-foreground tabular">x{v.multiplier} per pip</p>
      </div>

      <Progress value={(v.level / v.cap) * 100} aria-label={`Level ${v.level} of ${v.cap}`} className="h-1 w-full" />

      <FaceStrip faces={v.faces} next={v.faceNext} showNext={v.faceUnlocked} cap={v.faceCap} />

      {v.atCap ? (
        <Button
          data-testid={`ascend-${id}`}
          disabled={!v.canAscend}
          onClick={() => send({ type: 'ascend', id })}
          className="min-h-11 w-full gap-1.5 glow-amber touch-manipulation"
        >
          <ChevronsUpIcon aria-hidden="true" />
          Ascend
          <span className="font-normal opacity-80 tabular">x{content.rules.ascension.multiplier} output</span>
        </Button>
      ) : (
        <div className="grid w-full grid-cols-3 gap-2" role="group" aria-label={`Level up ${v.name}`}>
          <LevelButton
            testId={`level1-${id}`}
            label="+1"
            description="Buy one level"
            cost={v.nextCost}
            disabled={!v.affordable}
            onClick={() => {
              send({ type: 'levelDie', id, count: 1 })
              play('level')
            }}
          />
          <LevelButton
            testId={`level10-${id}`}
            label="+10"
            description="Buy ten levels"
            cost={v.cost10}
            disabled={v.maxAffordable < 10}
            onClick={() => {
              send({ type: 'levelDie', id, count: 10 })
              play('level')
            }}
          />
          <LevelButton
            testId={`levelmax-${id}`}
            label={v.maxAffordable > 0 ? `Max (${v.maxAffordable})` : 'Max'}
            description={v.maxAffordable > 0 ? `Buy ${v.maxAffordable} levels` : 'Buy every affordable level'}
            cost={v.costMax}
            disabled={v.maxAffordable < 1}
            onClick={() => {
              send({ type: 'levelDie', id, count: 'max' })
              play('level')
            }}
          />
        </div>
      )}

      {v.faceUnlocked ? (
        <Button
          variant="outline"
          data-testid={`face-${id}`}
          disabled={!v.canUpgradeFace}
          onClick={() => {
            send({ type: 'upgradeFace', id })
            play('level')
          }}
          className="min-h-11 w-full gap-1 touch-manipulation"
        >
          {v.facesMaxed ? (
            <>Every face at the cap of {v.faceCap}</>
          ) : (
            <>
              Raise lowest face
              <span className="text-muted-foreground tabular">· {v.faceCost}</span>
            </>
          )}
        </Button>
      ) : (
        <p className="text-[0.7rem] text-muted-foreground">Face editing opens at level {content.rules.face.unlockLevel}</p>
      )}
    </Card>
  )
}
