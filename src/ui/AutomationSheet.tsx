// The automation sheet (a shadcn Dialog) the bench header's Automation button opens: three rows,
// each a switch with a one-line explanation. Auto-roll is the same setting as the play card's
// switch (that switch alone carries the auto-roll-switch test id; this row has none). Auto-level
// stays disabled with a hint until Steady Hands is owned. Auto-refine (auto-ascend in code) refines
// a die the moment it reaches the level cap. The auto-level-switch and auto-ascend-switch test ids
// live here and nowhere else.
import { content } from '@/content'
import { selectAutoAscend, selectAutoEnabled, selectAutoIntervalText, selectAutoUnlocked } from '@/app/selectors'
import { selectAutoLevelUpgradeName, selectAutoRollUnlockText } from '@/app/selectors.bench'
import { selectAutoLevel, selectAutoLevelAvailable } from '@/app/selectors.luck'
import { send, useGameStore } from '@/app/store'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

interface AutomationSheetProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

interface AutomationRowProps {
  /** DOM id of the switch; the label points at it. Distinct from the play card's "auto-roll". */
  readonly id: string
  readonly testId?: string
  readonly label: string
  /** One line: what the automation does, or what unlocks it while disabled. */
  readonly hint: string
  readonly checked: boolean
  readonly disabled?: boolean
  readonly onChange: (checked: boolean) => void
}

/** The whole row is the label, so the tap target is the full 56 px row and not the 18 px switch. */
function AutomationRow({ id, testId, label, hint, checked, disabled = false, onChange }: AutomationRowProps) {
  return (
    <li className={cn(disabled && 'opacity-70')}>
      <label htmlFor={id} className="flex min-h-14 items-center justify-between gap-4 py-2 text-sm select-none touch-manipulation">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="font-medium">{label}</span>
          <span className="text-sm text-muted-foreground">{hint}</span>
        </span>
        <Switch
          id={id}
          aria-label={label}
          data-testid={testId}
          checked={checked}
          disabled={disabled}
          onCheckedChange={onChange}
          className="shrink-0"
        />
      </label>
    </li>
  )
}

/** Capitalises an unlock clause for the start of a sentence. */
function sentence(clause: string): string {
  return clause.charAt(0).toUpperCase() + clause.slice(1)
}

export function AutomationSheet({ open, onOpenChange }: AutomationSheetProps) {
  const autoUnlocked = useGameStore(selectAutoUnlocked)
  const autoEnabled = useGameStore(selectAutoEnabled)
  const intervalText = useGameStore(selectAutoIntervalText)
  const autoLevelAvailable = useGameStore(selectAutoLevelAvailable)
  const autoLevel = useGameStore(selectAutoLevel)
  const autoAscend = useGameStore(selectAutoAscend)
  const autoRollUnlock = useGameStore(selectAutoRollUnlockText)
  const autoLevelUpgrade = useGameStore(selectAutoLevelUpgradeName)
  const { level: capLevel, multiplier: refineMultiplier } = content.rules.ascension

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="automation-sheet"
        showCloseButton={false}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Automation</DialogTitle>
          <DialogDescription>What the bench does on its own while you watch, or while you are away.</DialogDescription>
        </DialogHeader>

        <ul className="flex flex-col divide-y divide-border">
          <AutomationRow
            id="automation-roll"
            label="Auto-roll"
            hint={autoUnlocked ? `Rolls every ${intervalText} on its own.` : `${sentence(autoRollUnlock)} to unlock.`}
            checked={autoUnlocked && autoEnabled}
            disabled={!autoUnlocked}
            onChange={(checked) => send({ type: 'setAutoRoll', enabled: checked })}
          />
          <AutomationRow
            id="automation-level"
            testId="auto-level-switch"
            label="Auto-level"
            hint={
              autoLevelAvailable
                ? 'Every second buys the cheapest die level you can afford, and carves the next die when you can.'
                : `Needs ${autoLevelUpgrade} from the Luck tab.`
            }
            checked={autoLevel}
            disabled={!autoLevelAvailable}
            onChange={(checked) => send({ type: 'setAutoLevel', enabled: checked })}
          />
          <AutomationRow
            id="automation-refine"
            testId="auto-ascend-switch"
            label={`Auto-refine at level ${capLevel}`}
            hint={`A die that reaches level ${capLevel} is refined at once: back to level 1, every pip worth x${refineMultiplier} more.`}
            checked={autoAscend}
            onChange={(checked) => send({ type: 'setAutoAscend', enabled: checked })}
          />
        </ul>

        <DialogFooter>
          <Button variant="outline" data-testid="automation-done" onClick={() => onOpenChange(false)} className="min-h-11 touch-manipulation">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
