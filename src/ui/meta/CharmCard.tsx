// One charm as a card: name, flavour, effect and a rarity chip. Common is muted, rare cool, epic
// amber with a glow. Used by the charms panel (held, with a copies badge) and the draft dialog
// (pickable, with a cool particle burst on the one picked).
import type { CharmDef, CharmRarity } from '@/content'
import { RARITY_LABEL, describeCharmEffect } from '@/app/selectors.meta'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Particles } from '@/ui/fx'

interface RarityStyle {
  readonly card: string
  readonly chip: string
  readonly effect: string
}

const RARITY_STYLE: Readonly<Record<CharmRarity, RarityStyle>> = {
  common: { card: 'ring-foreground/10', chip: 'bg-muted text-rarity-common', effect: 'text-foreground' },
  rare: { card: 'ring-cool/40', chip: 'bg-cool/15 text-cool-text', effect: 'text-cool-text' },
  epic: { card: 'ring-amber/50 glow-amber', chip: 'bg-amber/20 text-amber-text', effect: 'text-amber-text' },
}

interface CharmCardProps {
  readonly def: CharmDef
  /** Copies held; a badge shows from 2. */
  readonly count?: number
  /** Makes the card a pick button in the draft. */
  readonly onPick?: () => void
  readonly pickDisabled?: boolean
  /** The card the player just picked: highlighted, with a burst when `burst` changes. */
  readonly picked?: boolean
  readonly dimmed?: boolean
  readonly burst?: number
  readonly testId?: string
}

export function CharmCard({ def, count = 1, onPick, pickDisabled = false, picked = false, dimmed = false, burst = 0, testId }: CharmCardProps) {
  const style = RARITY_STYLE[def.rarity]
  return (
    <article
      data-testid={testId}
      className={cn(
        'relative flex flex-col gap-2 rounded-xl bg-card px-4 py-3 text-card-foreground ring-1 transition-[opacity,transform] duration-200',
        style.card,
        picked && 'glow-cool ring-cool/70',
        dimmed && 'opacity-40',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium leading-snug">{def.name}</h3>
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-medium tracking-wide uppercase', style.chip)}>
          {RARITY_LABEL[def.rarity]}
        </span>
      </div>
      <p className="text-xs text-muted-foreground italic">{def.flavour}</p>
      <p className={cn('text-sm font-medium', style.effect)}>{describeCharmEffect(def)}</p>
      {count > 1 && (
        <span className="absolute -top-2 -left-2 rounded-full bg-foreground px-2 py-0.5 text-xs font-semibold text-background tabular" aria-label={`${count} copies`}>
          x{count}
        </span>
      )}
      {onPick !== undefined && (
        <Button
          variant={def.rarity === 'common' ? 'secondary' : 'default'}
          disabled={pickDisabled}
          onClick={onPick}
          className="mt-1 min-h-11 w-full touch-manipulation"
        >
          {picked ? 'Taken' : 'Take it'}
        </Button>
      )}
      <Particles trigger={burst} kind="cool" count={18} />
    </article>
  )
}
