// Settings: theme, reduced motion, the save as an export string, import behind a confirmation
// step, reset behind a typed confirmation, and the save status line. The body mounts fresh on
// every open (Radix unmounts closed dialog content), so its local state needs no reset effect and
// the export string is read at open time.
import { useRef, useState } from 'react'
import { CheckIcon, CopyIcon } from 'lucide-react'
import { formatSaveStatus, selectLastSavedAt, selectPersisted, selectReduceMotion, selectSaveError, selectTheme } from '@/app/selectors'
import { decodeExport, exportString, importString, resetGame } from '@/app/storage'
import { setSettings, useGameStore } from '@/app/store'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useNow } from './useNow'

const RESET_WORD = 'RESET'

interface SettingsDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="settings-dialog"
        showCloseButton={false}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Theme and motion, your save as text, and a fresh start.</DialogDescription>
        </DialogHeader>
        <SettingsBody onClose={() => onOpenChange(false)} />
        <DialogFooter>
          <Button variant="outline" data-testid="settings-done" onClick={() => onOpenChange(false)} className="min-h-11 touch-manipulation">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type CopyState = 'idle' | 'copied' | 'failed'
/** The import flow: paste, then confirm the replacement with the export in view. */
type ImportStage = 'idle' | 'confirm'

interface Notice {
  readonly ok: boolean
  readonly text: string
}

function SectionTitle({ id, children }: { readonly id: string; readonly children: string }) {
  return (
    <h3 id={id} className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </h3>
  )
}

function SettingsBody({ onClose }: { readonly onClose: () => void }) {
  const theme = useGameStore(selectTheme)
  const reduceMotion = useGameStore(selectReduceMotion)
  const lastSavedAt = useGameStore(selectLastSavedAt)
  const persisted = useGameStore(selectPersisted)
  const saveError = useGameStore(selectSaveError)
  const now = useNow()
  const saveStatus = formatSaveStatus({ lastSavedAt, persisted, error: saveError }, now)

  const exportRef = useRef<HTMLTextAreaElement>(null)
  const [exportText, setExportText] = useState(() => exportString())
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const [importText, setImportText] = useState('')
  const [importStage, setImportStage] = useState<ImportStage>('idle')
  const [importNotice, setImportNotice] = useState<Notice | null>(null)
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [resetText, setResetText] = useState('')
  const [busy, setBusy] = useState(false)

  const onTheme = (value: string): void => {
    if (value === 'auto' || value === 'light' || value === 'dark') setSettings({ theme: value })
  }

  const copyExport = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(exportText)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  // First step: check the string, then ask. The export textarea takes focus (its text selected) so
  // the current game is one copy away before it is replaced.
  const armImport = (): void => {
    const decoded = decodeExport(importText)
    if (!decoded.ok) {
      setImportNotice({ ok: false, text: decoded.reason })
      return
    }
    setImportNotice(null)
    setImportStage('confirm')
    exportRef.current?.focus()
  }

  const runImport = async (): Promise<void> => {
    setBusy(true)
    try {
      const result = await importString(importText)
      if (result.ok) {
        setImportText('')
        setExportText(exportString())
        setImportNotice({ ok: true, text: 'Save imported. The game behind this dialog now shows it.' })
      } else {
        setImportNotice({ ok: false, text: result.reason })
      }
    } finally {
      setImportStage('idle')
      setBusy(false)
    }
  }

  const runReset = async (): Promise<void> => {
    setBusy(true)
    try {
      await resetGame()
    } catch {
      setBusy(false)
      return
    }
    onClose()
  }

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="settings-appearance" className="flex flex-col gap-2">
        <SectionTitle id="settings-appearance">Appearance</SectionTitle>
        <div className="flex min-h-11 items-center justify-between gap-3">
          <label htmlFor="theme-select" className="text-sm">
            Theme
          </label>
          <Select value={theme} onValueChange={onTheme}>
            <SelectTrigger id="theme-select" data-testid="theme-select" className="min-h-11 w-40 touch-manipulation">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Match system</SelectItem>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label htmlFor="reduce-motion" className="flex min-h-11 items-center justify-between gap-3 text-sm select-none touch-manipulation">
          <span>Reduce motion</span>
          <Switch
            id="reduce-motion"
            aria-label="Reduce motion"
            data-testid="reduce-motion-switch"
            checked={reduceMotion}
            onCheckedChange={(checked) => setSettings({ reduceMotion: checked })}
          />
        </label>
      </section>

      <Separator />

      <section aria-labelledby="settings-export" className="flex flex-col gap-2">
        <SectionTitle id="settings-export">Export</SectionTitle>
        <p className="text-xs text-muted-foreground">Your whole game as one line of text. Keep a copy before importing or resetting.</p>
        <Textarea
          ref={exportRef}
          data-testid="export-text"
          aria-label="Export string"
          readOnly
          rows={3}
          value={exportText}
          onFocus={(event) => event.currentTarget.select()}
          className="font-mono text-xs break-all md:text-xs"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" data-testid="copy-export-button" onClick={() => void copyExport()} className="min-h-11 touch-manipulation">
            {copyState === 'copied' ? <CheckIcon /> : <CopyIcon />}
            {copyState === 'copied' ? 'Copied' : 'Copy'}
          </Button>
          {copyState === 'failed' && (
            <span role="alert" className="text-xs text-destructive">
              Copy failed. Tap the text, select all and copy it yourself.
            </span>
          )}
        </div>
      </section>

      <Separator />

      <section aria-labelledby="settings-import" className="flex flex-col gap-2">
        <SectionTitle id="settings-import">Import</SectionTitle>
        <p className="text-xs text-muted-foreground">Paste an export string. Importing replaces the current game, so you are asked to confirm.</p>
        <Textarea
          data-testid="import-text"
          aria-label="Import string"
          rows={3}
          value={importText}
          placeholder="ND1:..."
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          onChange={(event) => {
            setImportText(event.target.value)
            setImportNotice(null)
            setImportStage('idle')
          }}
          className="font-mono text-xs break-all md:text-xs"
        />
        {importStage === 'confirm' ? (
          <div className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2">
            <p className="text-sm text-destructive">
              Replace the current game? The export above is selected: copy it now if you want this game back later.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="destructive"
                data-testid="import-confirm-button"
                disabled={busy}
                onClick={() => void runImport()}
                className="min-h-11 touch-manipulation"
              >
                Yes, replace it
              </Button>
              <Button
                variant="ghost"
                data-testid="import-cancel-button"
                disabled={busy}
                onClick={() => setImportStage('idle')}
                className="min-h-11 touch-manipulation"
              >
                Keep playing
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button data-testid="import-button" disabled={busy || importText.trim() === ''} onClick={armImport} className="min-h-11 touch-manipulation">
              Import
            </Button>
            {importNotice !== null && (
              <p
                data-testid="import-result"
                role={importNotice.ok ? 'status' : 'alert'}
                className={cn('text-xs', importNotice.ok ? 'text-muted-foreground' : 'text-destructive')}
              >
                {importNotice.text}
              </p>
            )}
          </div>
        )}
      </section>

      <Separator />

      <section aria-labelledby="settings-reset" className="flex flex-col gap-2">
        <SectionTitle id="settings-reset">Reset</SectionTitle>
        {confirmingReset ? (
          <div className="flex flex-col gap-2">
            <label htmlFor="reset-confirm" className="text-sm">
              Type {RESET_WORD} to start over. Points and dice go. Copy the export above first; it is the only way back.
            </label>
            <input
              id="reset-confirm"
              data-testid="reset-confirm-input"
              value={resetText}
              onChange={(event) => setResetText(event.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="destructive"
                data-testid="reset-confirm-button"
                disabled={busy || resetText !== RESET_WORD}
                onClick={() => void runReset()}
                className="min-h-11 touch-manipulation"
              >
                Reset now
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setConfirmingReset(false)
                  setResetText('')
                }}
                className="min-h-11 touch-manipulation"
              >
                Keep playing
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="destructive" data-testid="reset-button" onClick={() => setConfirmingReset(true)} className="min-h-11 self-start touch-manipulation">
            Reset game
          </Button>
        )}
      </section>

      <Separator />

      <p data-testid="save-status" className="text-xs text-muted-foreground">
        {saveStatus}
      </p>
    </div>
  )
}
