// The tab bar: tabs fixed to the bottom on phones (44 px targets and more, safe-area aware) or a
// segmented strip of the side panels at the top of the desktop column. The screen passes the tab
// ids to show and owns the active one; labels and lucide icons live here. A cool dot marks a tab
// that wants attention (an open draft, a new trophy).
import type { LucideIcon } from 'lucide-react'
import { CloverIcon, Dice5Icon, GemIcon, LayersIcon, TrophyIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type TabId = 'table' | 'combos' | 'charms' | 'luck' | 'trophies'
/** The tabs that render in the desktop side column (everything but the table). */
export type SideTabId = Exclude<TabId, 'table'>

interface TabDef {
  readonly label: string
  readonly Icon: LucideIcon
}

const TAB_DEFS: Readonly<Record<TabId, TabDef>> = {
  table: { label: 'Table', Icon: Dice5Icon },
  combos: { label: 'Combos', Icon: LayersIcon },
  charms: { label: 'Charms', Icon: GemIcon },
  luck: { label: 'Luck', Icon: CloverIcon },
  trophies: { label: 'Trophies', Icon: TrophyIcon },
}

interface TabBarProps {
  readonly tabs: readonly TabId[]
  readonly active: TabId
  readonly onChange: (id: TabId) => void
  /** bottom: the phone bar fixed to the viewport. strip: the desktop segmented control. */
  readonly variant: 'bottom' | 'strip'
  /** Tabs that show the attention dot. */
  readonly badges?: Readonly<Partial<Record<TabId, boolean>>>
  readonly className?: string
}

export function TabBar({ tabs, active, onChange, variant, badges, className }: TabBarProps) {
  if (variant === 'bottom') {
    return (
      <nav
        aria-label="Sections"
        className={cn(
          'fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md',
          className,
        )}
      >
        <div role="tablist" className="mx-auto grid max-w-3xl" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map((id) => {
            const { label, Icon } = TAB_DEFS[id]
            const selected = id === active
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={selected}
                data-testid={`tab-${id}`}
                onClick={() => onChange(id)}
                className={cn(
                  'relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[0.7rem] font-medium transition-colors select-none touch-manipulation',
                  selected ? 'text-amber-text' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {selected && <span aria-hidden="true" className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-amber" />}
                <Icon className={cn('size-5 transition-transform duration-150', selected && 'scale-110')} aria-hidden="true" />
                {label}
                {badges?.[id] === true && (
                  <span aria-label="Needs attention" className="absolute top-2 left-1/2 ml-1.5 size-2 rounded-full bg-cool ring-2 ring-background" />
                )}
              </button>
            )
          })}
        </div>
      </nav>
    )
  }

  return (
    <div role="tablist" aria-label="Side panel" className={cn('flex gap-1 rounded-xl bg-muted p-1', className)}>
      {tabs.map((id) => {
        const { label, Icon } = TAB_DEFS[id]
        const selected = id === active
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={selected}
            data-testid={`side-tab-${id}`}
            onClick={() => onChange(id)}
            className={cn(
              'relative flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium transition-colors select-none touch-manipulation',
              selected ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
            {badges?.[id] === true && <span aria-label="Needs attention" className="absolute top-1.5 right-1.5 size-2 rounded-full bg-cool" />}
          </button>
        )
      })}
    </div>
  )
}
