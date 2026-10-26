// The game screen: a header (title, the luck badge, settings), the banners, then the tab shell.
// Phones show one section at a time under a bottom tab bar (Bench, Hands, Charms, Luck,
// Marks); from lg the bench sits left (3/5) and the active side panel right (2/5) under a
// segmented strip. The active tab persists in localStorage. The draft dialog, the mark toast and
// the settings, recovery and away dialogs live here so every tab sees them. A quiet loading state
// holds the page until boot() has loaded the save, so the first paint is the real game.
import { useState } from 'react'
import { SettingsIcon } from 'lucide-react'
import { selectBooted, selectDraftOpen, selectHasNewTrophy } from '@/app/selectors'
import { selectLuckShopReady, selectLuckSinkReady, selectLuckTotal } from '@/app/selectors.luck'
import { useGameStore } from '@/app/store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CharmsPanel, DraftDialog, LuckPanel, StatsPanel, TrophiesPanel, TrophyToast } from '@/ui/meta'
import { CombosPanel } from './CombosPanel'
import { DiceBoard } from './DiceBoard'
import { ErrorBanner } from './ErrorBanner'
import { LastRoll } from './LastRoll'
import { OfflineModal } from './OfflineModal'
import { PointsPanel } from './PointsPanel'
import { RecoveryDialog } from './RecoveryDialog'
import { RollControls } from './RollControls'
import { SettingsDialog } from './SettingsDialog'
import { TabBar, type SideTabId, type TabId } from './TabBar'
import { UpdateBanner } from './UpdateBanner'

const TAB_KEY = 'nice-dice:tab'
const TAB_IDS: readonly TabId[] = ['table', 'combos', 'charms', 'luck', 'trophies']
const SIDE_TAB_IDS: readonly SideTabId[] = ['combos', 'charms', 'luck', 'trophies']

/** The stored tab, or the bench. A missing or unknown value and a blocked localStorage both mean the bench. */
function readTab(): TabId {
  try {
    if (typeof localStorage === 'undefined') return 'table'
    const raw = localStorage.getItem(TAB_KEY)
    return TAB_IDS.find((id) => id === raw) ?? 'table'
  } catch {
    return 'table'
  }
}

function writeTab(tab: TabId): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(TAB_KEY, tab)
  } catch {
    // Private mode or a full quota: the tab still applies for this session.
  }
}

function SidePanel({ tab }: { readonly tab: SideTabId }) {
  switch (tab) {
    case 'combos':
      return <CombosPanel />
    case 'charms':
      return <CharmsPanel />
    case 'luck':
      return <LuckPanel />
    case 'trophies':
      return (
        <>
          <TrophiesPanel />
          <StatsPanel />
        </>
      )
  }
}

export function GameScreen() {
  const booted = useGameStore(selectBooted)
  const draftOpen = useGameStore(selectDraftOpen)
  const newTrophy = useGameStore(selectHasNewTrophy)
  const luckTotal = useGameStore(selectLuckTotal)
  const luckShopReady = useGameStore(selectLuckShopReady)
  const luckSinkReady = useGameStore(selectLuckSinkReady)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [tab, setTab] = useState<TabId>(readTab)
  /** What the desktop side column shows: the bench is always on the left, so it falls back to hands. */
  const side: SideTabId = tab === 'table' ? 'combos' : tab
  /** The attention dots: a draft to decide, a mark to see, luck that can buy an upgrade, a mastery level or favour. */
  const badges = { charms: draftOpen, trophies: newTrophy, luck: luckShopReady || luckSinkReady }

  const choose = (next: TabId): void => {
    // The phone's bottom bar is reachable from any scroll depth, so a new panel starts at its top
    // instead of wherever the bench was scrolled to (a tap on a card's Master button, say).
    if (next !== tab) window.scrollTo(0, 0)
    setTab(next)
    writeTab(next)
  }

  return (
    <div className="min-h-dvh bg-background pt-[max(1rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-[calc(4.5rem+env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] text-foreground lg:pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight">Nice Dice</h1>
            {luckTotal > 0 && (
              <Badge
                variant="secondary"
                className="bg-cool/20 text-cool-text tabular"
                title="Lifetime luck: it multiplies every roll and survives every reset. Spend luck in the Luck tab."
              >
                Luck {luckTotal}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label="Settings"
            data-testid="settings-button"
            disabled={!booted}
            onClick={() => setSettingsOpen(true)}
            className="size-11 touch-manipulation"
          >
            <SettingsIcon className="size-5" />
          </Button>
        </header>

        <UpdateBanner />
        <ErrorBanner />

        {booted ? (
          <div className="lg:grid lg:grid-cols-5 lg:items-start lg:gap-6">
            <main className={cn('flex flex-col gap-4 lg:col-span-3', tab !== 'table' && 'hidden lg:flex')}>
              <PointsPanel />
              <RollControls />
              <DiceBoard />
              <LastRoll />
            </main>
            <aside aria-label="Side panel" className={cn('flex flex-col gap-4 lg:col-span-2', tab === 'table' && 'hidden lg:flex')}>
              <TabBar variant="strip" tabs={SIDE_TAB_IDS} active={side} onChange={choose} badges={badges} className="hidden lg:flex" />
              <SidePanel tab={side} />
            </aside>
          </div>
        ) : (
          <main aria-busy="true" className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
            Setting out the dice
          </main>
        )}

        <footer className="pt-4 text-center text-xs text-muted-foreground">
          Icons: lucide (ISC). Fonts: Geist and Fraunces (OFL). Sounds: jsfxr.
        </footer>
      </div>

      {booted && <TabBar variant="bottom" tabs={TAB_IDS} active={tab} onChange={choose} badges={badges} className="lg:hidden" />}

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <RecoveryDialog />
      <OfflineModal />
      {booted && (
        <>
          <DraftDialog />
          <TrophyToast />
        </>
      )}
    </div>
  )
}
