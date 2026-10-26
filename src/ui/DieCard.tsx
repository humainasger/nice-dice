// One die slot as a card, in two layouts. Below lg (phones, tablets) the card is one compact row,
// 72 px tall: the face from the last roll at 48 px (ringed while it is part of the hand), the name,
// "Lv 34 · x7.48K per pip" with tiny icon badges for the refined count and mastery, and one primary
// button on the right: Buy for the next die, Refine at the cap, otherwise +1 with its price and
// "Max (N)" under it. A chevron (die-expand-<id>) expands the card in place to the full controls:
// the six-face strip, +1 / +10 / Max or Refine, the face upgrade, the luck-priced Master button.
// The level progress stays as a 2 px line under the row. At lg and up the card is always the full
// layout: badges, the 72 px face, name and multiplier, progress, then the same controls. Locked
// dice say what unlocks them. Refining is the copy for ascension; the code keeps `ascend`. Every
// number arrives formatted from the selector; the sounds and the bursts fire next to the commands,
// the refinement ones on the count so auto-ascend gets them too, the mastery ones on the level so
// the Luck tab's button gets them.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { ChevronDownIcon, ChevronsUpIcon, GemIcon } from 'lucide-react'
import { content, type Id } from '@/content'
import { play } from '@/app/audio'
import { selectDieSlot, selectHandRank, selectRolls, type DieSlotView } from '@/app/selectors'
import { selectLuckShopOpen, selectMasteryRow, type MasteryRowView } from '@/app/selectors.luck'
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
/** Tailwind's lg breakpoint: the full layout from here, the compact row below. */
const LG_QUERY = '(min-width: 64rem)'

function subscribeLg(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const query = window.matchMedia(LG_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function readLg(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(LG_QUERY).matches
}

/** True at lg and up, live across resizes. One media query per card; five cards, trivial. */
function useLgUp(): boolean {
  return useSyncExternalStore(subscribeLg, readLg, () => false)
}

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
      <span className="text-xs leading-tight text-muted-foreground tabular">{cost === '' ? ' ' : cost}</span>
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
              'flex size-7 items-center justify-center rounded-[5px] text-xs font-semibold ring-1 tabular transition-colors',
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

interface IconBadgeProps {
  readonly Icon: typeof GemIcon
  readonly count: number
  readonly title: string
  readonly className?: string
}

/** A tiny count with an icon for the compact row: refined x3, mastery 2. The title is the desktop tooltip. */
function IconBadge({ Icon, count, title, className }: IconBadgeProps) {
  return (
    <span
      title={title}
      aria-label={title}
      className={cn('inline-flex h-5 shrink-0 items-center gap-0.5 rounded-full px-1.5 text-xs font-medium ring-1 tabular', className)}
    >
      <Icon className="size-3" aria-hidden="true" />
      {count}
    </span>
  )
}

interface OwnedProps {
  readonly id: Id
  readonly v: DieSlotView
  readonly m: MasteryRowView
  readonly luckEarned: boolean
  readonly rolls: number
  readonly ring: string
}

/** The controls every owned die shares: the face strip, the level buttons or Refine, the face upgrade, Master. */
function Controls({ id, v, m, luckEarned }: Pick<OwnedProps, 'id' | 'v' | 'm' | 'luckEarned'>) {
  return (
    <>
      <FaceStrip faces={v.faces} next={v.faceNext} showNext={v.faceUnlocked} cap={v.faceCap} />

      {v.atCap ? (
        <RefineButton id={id} v={v} />
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
        <p className="text-sm text-muted-foreground">Face editing opens at level {content.rules.face.unlockLevel}</p>
      )}

      {luckEarned && (
        <Button
          variant="outline"
          data-testid={`mastery-buy-${id}`}
          disabled={!m.affordable}
          onClick={() => {
            send({ type: 'masterDie', id })
            play('luck', { rank: 1 })
          }}
          aria-label={`Master ${v.name} for ${m.nextCost} luck: +${m.stepPercent}% output per level, now +${m.bonusPercent}%`}
          title={`Mastery ${m.level + 1}: +${m.stepPercent}% output on ${v.name}, paid in luck and kept through every reset`}
          className={cn('min-h-11 w-full gap-1 touch-manipulation', m.affordable && 'border-cool/50 text-cool-text glow-cool')}
        >
          Master (+{m.stepPercent}%)
          <span className="text-muted-foreground tabular">· {m.nextCost} luck</span>
        </Button>
      )}
    </>
  )
}

/** Refine at the cap, in the full layout (wide) or as the compact row's primary button. */
function RefineButton({ id, v, compact = false }: { readonly id: Id; readonly v: DieSlotView; readonly compact?: boolean }) {
  const multiplier = content.rules.ascension.multiplier
  return (
    <Button
      data-testid={`ascend-${id}`}
      disabled={!v.canAscend}
      onClick={() => send({ type: 'ascend', id })}
      aria-label={`Refine ${v.name}: back to level 1, every pip worth x${multiplier} more`}
      title={`Refine ${v.name}: back to level 1, every pip worth x${multiplier} more`}
      className={cn('min-h-11 touch-manipulation glow-amber', compact ? 'h-auto shrink-0 flex-col gap-0 px-2.5 py-1.5' : 'w-full gap-1.5')}
    >
      {compact ? (
        <>
          <span className="flex items-center gap-1 text-sm leading-tight font-semibold">
            <ChevronsUpIcon aria-hidden="true" className="size-4" />
            Refine
          </span>
          <span className="text-xs leading-tight font-normal opacity-80 tabular">x{multiplier} output</span>
        </>
      ) : (
        <>
          <ChevronsUpIcon aria-hidden="true" />
          Refine
          <span className="font-normal opacity-80 tabular">x{multiplier} output</span>
        </>
      )}
    </Button>
  )
}

/** The compact row's primary button below the cap: +1 with its price, "Max (N)" under it as plain text. */
function CompactLevelButton({ id, v }: { readonly id: Id; readonly v: DieSlotView }) {
  return (
    <Button
      data-testid={`level1-${id}`}
      disabled={!v.affordable}
      onClick={() => {
        send({ type: 'levelDie', id, count: 1 })
        play('level')
      }}
      aria-label={`Buy one level for ${v.nextCost}`}
      className={cn('h-auto min-h-11 shrink-0 flex-col gap-0 px-2.5 py-1.5 touch-manipulation', v.affordable && 'glow-amber')}
    >
      <span className="text-sm leading-tight font-semibold tabular">+1 · {v.nextCost}</span>
      {v.maxAffordable > 1 && <span className="text-xs leading-tight font-normal opacity-80 tabular">Max ({v.maxAffordable})</span>}
    </Button>
  )
}

/** The full card at lg and up: today's stacked layout. */
function OwnedCardFull({ id, v, m, luckEarned, rolls, ring }: OwnedProps) {
  return (
    <Card data-testid={`die-card-${id}`} size="sm" className="relative items-center overflow-visible px-3 text-center shadow-soft">
      <Particles trigger={v.ascensions} kind="gold" count={24} />
      <Particles trigger={m.level} kind="cool" count={16} />

      {/* Both rows wrap: at three columns a card is too narrow for Lv, Refined and Mastery side by side. */}
      <div className="flex w-full flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <Badge variant="outline" className="tabular">
          Lv {v.level}
          <span className="text-muted-foreground">/{v.cap}</span>
        </Badge>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {v.ascensions > 0 ? (
            <Badge className="tabular" title={`Refined ${v.ascensions} ${v.ascensions === 1 ? 'time' : 'times'}`}>
              Refined x{v.ascensions}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">not refined yet</span>
          )}
          {m.level > 0 && (
            <Badge
              variant="outline"
              className="border-cool/50 text-cool-text tabular"
              title={`Mastery ${m.level}: this die's output x${m.multiplier} (+${m.bonusPercent}%), kept through every reset`}
            >
              Mastery {m.level}
            </Badge>
          )}
        </div>
      </div>

      <div className={cn('rounded-2xl p-1 transition-shadow duration-150', ring !== '' && `ring-3 ${ring}`)}>
        <DieFace face={v.side} value={v.value} size={72} rollKey={rolls} />
      </div>

      <div>
        <h3 className="font-medium">{v.name}</h3>
        <p className="text-xs text-muted-foreground tabular">x{v.multiplier} per pip</p>
      </div>

      <Progress value={(v.level / v.cap) * 100} aria-label={`Level ${v.level} of ${v.cap}`} className="h-1 w-full" />

      <Controls id={id} v={v} m={m} luckEarned={luckEarned} />
    </Card>
  )
}

/** The compact row below lg, with the chevron that expands it in place to the full controls. */
function OwnedCardCompact({ id, v, m, luckEarned, rolls, ring }: OwnedProps) {
  const [expanded, setExpanded] = useState(false)
  return (
    <Card data-testid={`die-card-${id}`} size="sm" className="relative gap-0 overflow-visible py-0 shadow-soft">
      <Particles trigger={v.ascensions} kind="gold" count={24} />
      <Particles trigger={m.level} kind="cool" count={16} />

      {/* 390 px budget: 52 face, 44 chevron, about 88 for the button, three 8 px gaps and 10 px of padding leave 146 px for the text; "Lv 100 · x57.2K per pip" needs 143. Narrower phones drop "per pip". */}
      <div className="flex min-h-18 items-center gap-2 pl-2.5">
        <div className={cn('shrink-0 rounded-xl p-px transition-shadow duration-150', ring !== '' && `ring-3 ${ring}`)}>
          <DieFace face={v.side} value={v.value} size={48} rollKey={rolls} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-1.5">
          <h3 className="truncate text-sm leading-5 font-medium">{v.name}</h3>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm leading-5 text-muted-foreground">
            <span className="whitespace-nowrap tabular">
              Lv {v.level} · x{v.multiplier}
              <span className="max-[389px]:hidden"> per pip</span>
            </span>
            {v.ascensions > 0 && (
              <IconBadge
                Icon={ChevronsUpIcon}
                count={v.ascensions}
                title={`Refined ${v.ascensions} ${v.ascensions === 1 ? 'time' : 'times'}`}
                className="bg-amber/15 text-amber-text ring-amber/30"
              />
            )}
            {m.level > 0 && (
              <IconBadge
                Icon={GemIcon}
                count={m.level}
                title={`Mastery ${m.level}: this die's output x${m.multiplier} (+${m.bonusPercent}%), kept through every reset`}
                className="bg-cool/15 text-cool-text ring-cool/30"
              />
            )}
          </div>
        </div>

        {!expanded && (v.atCap ? <RefineButton id={id} v={v} compact /> : <CompactLevelButton id={id} v={v} />)}

        <Button
          variant="ghost"
          size="icon-lg"
          data-testid={`die-expand-${id}`}
          aria-expanded={expanded}
          aria-label={expanded ? `Collapse ${v.name}` : `Expand ${v.name}`}
          onClick={() => setExpanded((open) => !open)}
          className="size-11 shrink-0 touch-manipulation"
        >
          <ChevronDownIcon aria-hidden="true" className={cn('size-5 transition-transform duration-150', expanded && 'rotate-180')} />
        </Button>
      </div>

      <Progress
        value={(v.level / v.cap) * 100}
        aria-label={`Level ${v.level} of ${v.cap}`}
        className={cn('h-0.5 w-full rounded-none', !expanded && 'rounded-b-xl')}
      />

      {expanded && (
        <div className="flex flex-col items-center gap-3 px-3 pt-3 pb-3 text-center">
          <Controls id={id} v={v} m={m} luckEarned={luckEarned} />
        </div>
      )}
    </Card>
  )
}

interface UnownedProps {
  readonly id: Id
  readonly v: DieSlotView
  readonly m: MasteryRowView
}

function buy(id: Id): void {
  send({ type: 'buyDie', id })
  play('buy')
}

/** Buyable or locked, at lg and up: the stacked card with the Carve button or the unlock text. */
function UnownedCardFull({ id, v, m }: UnownedProps) {
  return (
    <Card data-testid={`die-card-${id}`} size="sm" className={cn('items-center px-3 text-center shadow-soft', !v.unlocked && 'opacity-70')}>
      <DieFace face={null} size={56} className={v.unlocked ? 'opacity-60' : 'opacity-30'} />
      <h3 className="font-medium">{v.name}</h3>
      {v.unlocked ? (
        <Button
          data-testid={`buy-${id}`}
          disabled={!v.canBuy}
          onClick={() => buy(id)}
          className={cn('min-h-11 w-full max-w-48 touch-manipulation', v.canBuy && 'glow-amber')}
        >
          Carve for {v.nextCost}
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">Locked. To unlock, {v.unlockText}.</p>
      )}
      {m.level > 0 && (
        <p className="text-xs text-muted-foreground tabular">
          Mastery {m.level} waits for it: x{m.multiplier} output once carved
        </p>
      )}
    </Card>
  )
}

/** Buyable or locked, below lg: one row with the blank face, the name, the unlock text or the Buy button. */
function UnownedCardCompact({ id, v, m }: UnownedProps) {
  return (
    <Card data-testid={`die-card-${id}`} size="sm" className={cn('gap-0 py-0 shadow-soft', !v.unlocked && 'opacity-70')}>
      <div className="flex min-h-18 items-center gap-2 pr-3 pl-2.5">
        <DieFace face={null} size={48} className={cn('m-px', v.unlocked ? 'opacity-60' : 'opacity-30')} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-1.5">
          <h3 className="truncate text-sm leading-5 font-medium">{v.name}</h3>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm leading-5 text-muted-foreground">
            <span>{v.unlocked ? 'Ready to carve' : `Locked. To unlock, ${v.unlockText}.`}</span>
            {m.level > 0 && (
              <IconBadge
                Icon={GemIcon}
                count={m.level}
                title={`Mastery ${m.level} waits for it: x${m.multiplier} output once carved`}
                className="bg-cool/15 text-cool-text ring-cool/30"
              />
            )}
          </div>
        </div>
        {v.unlocked && (
          <Button
            data-testid={`buy-${id}`}
            disabled={!v.canBuy}
            onClick={() => buy(id)}
            aria-label={`Carve the ${v.name} for ${v.nextCost}`}
            className={cn('min-h-11 shrink-0 gap-1 px-3 touch-manipulation', v.canBuy && 'glow-amber')}
          >
            Buy
            <span className="font-normal opacity-80 tabular">· {v.nextCost}</span>
          </Button>
        )}
      </div>
    </Card>
  )
}

export function DieCard({ id, index }: { readonly id: Id; readonly index: number }) {
  const selector = useMemo(() => selectDieSlot(id, index), [id, index])
  const v = useGameStore(useShallow(selector))
  const masterySelector = useMemo(() => selectMasteryRow(id), [id])
  const m = useGameStore(useShallow(masterySelector))
  const luckEarned = useGameStore(selectLuckShopOpen)
  const rolls = useGameStore(selectRolls)
  const handRank = useGameStore(selectHandRank)
  const ringing = useRollPulse(rolls, RING_MS)
  const lg = useLgUp()

  // Refining happens inside the core (the button or auto-ascend); the sound follows the count either way.
  const seenAscensions = useRef(v.ascensions)
  useEffect(() => {
    if (seenAscensions.current === v.ascensions) return
    seenAscensions.current = v.ascensions
    play('ascend')
  }, [v.ascensions])

  if (!v.owned) return lg ? <UnownedCardFull id={id} v={v} m={m} /> : <UnownedCardCompact id={id} v={v} m={m} />

  const ring = ringing && v.inHand ? (RANK_RING_CLASS[handRank] ?? '') : ''
  const props: OwnedProps = { id, v, m, luckEarned, rolls, ring }
  return lg ? <OwnedCardFull {...props} /> : <OwnedCardCompact {...props} />
}
