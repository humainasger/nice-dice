# M2 demo: app layer, playable UI, smoke test

Status: spec 2026-10-25, builds on M1 (`docs/plans/active/m1-core.md`). Branch `m2-demo`.

Goal: the first playable Nice Dice on the Pages URL. Roll dice for points, buy up to five dice, level them, auto-roll, offline progress, autosave, export and import. No combos, ascension, draft or prestige yet.

## App layer (`src/app`, may import core, content and any npm package, never ui or components)

- `store.ts`: a vanilla Zustand store (`createStore` from `zustand/vanilla`) holding `{ game: GameState; ui: UiState }` with `UiState = { booted: boolean; offline: OfflineSummary | null; locked: boolean; settings: { theme: 'auto' | 'light' | 'dark'; reduceMotion: boolean } }`. Actions on the store object: `dispatch(command)`, `tick(dtMs)`, `replaceGame(state)`, `setOffline(summary | null)`, `setSettings(partial)`. Export `useGameStore = <T>(selector: (s: StoreState) => T) => useStore(store, selector)` and `useShallow` re-exported from `zustand/react/shallow`. UI components select primitives or formatted strings (CLAUDE.md rule 4); provide string selectors in `src/app/selectors.ts` (`selectPointsText`, `selectPerRollText`, `selectDieCost(id)`, `selectDieLevel(id)`, and so on) so components never build objects in selectors.
- `loop.ts`: `startLoop(store)`. Fixed 100 ms accumulator (tick size from `content.rules.offline.tickMs`), driven by `requestAnimationFrame` while the document is visible and `setInterval` while hidden (rAF stops in hidden tabs). Wall-clock delta per frame is clamped: if more than `rules.offline.foregroundCatchupMs` (add it to the rules table, 60000) passed since the last frame, route the elapsed time through `applyOffline` and show the away summary instead of spinning the loop. Returns a stop function.
- `storage.ts`: IndexedDB via `idb-keyval`. Envelope `{ savedAt: number; payload: string }` where payload is `serializeState`. Keys `nice-dice:save`, `nice-dice:backup:1|5|20|60` (minute slots, rotated by age), `nice-dice:quarantine:<savedAt>`. `saveNow(store)`, `loadSave(): Promise<{ kind: 'none' } | { kind: 'ok'; state; savedAt } | { kind: 'quarantined'; reason }>`. `try/catch` on every write, `QuotaExceededError` surfaces as a non-fatal banner. An unparseable save is copied to a quarantine key and the game offers "start fresh" or "import a backup"; it is never overwritten silently. Autosave every 30 s, on `visibilitychange` to hidden and on `pagehide`. Call `navigator.storage.persist()` once after the first save. `exportString(state): string` is `ND1:` plus `lz-string` `compressToEncodedURIComponent(serializeState(state))`; `importString(text)` reverses it, validates through `parseSave`, and reports the same error kinds. Import asks for confirmation and offers export first.
- `offline.ts`: on boot, `elapsed = clamp(now - savedAt, 0, rules.offline.capMs)`; when elapsed is above `rules.offline.minAwayMs` (add, 10000) run `applyOffline` and set `ui.offline` for the modal.
- `tabLock.ts`: `navigator.locks.request('nice-dice', { ifAvailable: true }, ...)` held for the page lifetime; when unavailable set `ui.locked = true` and render the "already open in another tab" screen without starting the loop or autosave. Fall back to a `BroadcastChannel` ping where Web Locks is missing.
- `platform.ts`: `interface Platform { gameplayStart(); gameplayStop(); loadingStart(); loadingStop(); requestAd(kind: 'midgame' | 'rewarded'): Promise<'shown' | 'skipped' | 'error'>; happytime(); saveStore: { get; set; remove } }` and `webPlatform`, a no-op implementation whose `saveStore` is the idb-keyval functions. Only `src/app` touches it in M2.
- `boot.ts`: `boot(store)`: acquire the tab lock, `loadSave`, create a new game with a seed from `crypto.getRandomValues` when none, run offline, `replaceGame`, start the loop and autosave, mark `ui.booted`.
- `theme.ts`: moves the `.dark` bootstrap out of `main.tsx` and honours `settings.theme`; `reduceMotion` adds a `reduce-motion` class on `html` that CSS uses alongside `prefers-reduced-motion`.

## UI (`src/ui`, imports app, core types and selectors, content, shadcn components)

- `GameScreen.tsx`: header (title, settings button), points panel (big `N.format` value, expected per roll), `DiceBoard`, `RollControls`, `LastRoll`, footer with a credits line placeholder.
- `DiceBoard.tsx` and `DieCard.tsx`: one card per content die in order. Owned: die face SVG showing the last rolled face, level, multiplier, three level buttons (x1, x10, max) with their cost, disabled when unaffordable. Not owned but unlock satisfied: a buy button with the cost. Locked: a muted card saying what unlocks it (`nextUnlock`). Costs and multipliers are strings from selectors.
- `DieFace.tsx`: SVG die with pips for 1 to 6 (reuse the favicon geometry), a roll animation (CSS keyframes on transform only, 300 ms) that is skipped under `prefers-reduced-motion` or the `reduce-motion` class.
- `RollControls.tsx`: manual Roll button (Space key too), auto-roll switch with a progress bar to the next roll (from `autoRoll.elapsedMs / intervalMs`), locked state text "Level a die to unlock auto-roll".
- `OfflineModal.tsx`: shadcn Dialog: time away, rolls, points gained, "estimated" note when `estimatedMs > 0`.
- `SettingsDialog.tsx`: theme select, reduce motion switch, export (textarea plus copy button), import (textarea plus confirm), reset with a typed confirmation, save status line (last saved, persisted yes or no).
- `LockedScreen.tsx` for the second-tab case. `ErrorBanner.tsx` for quota and quarantine notices.
- Mobile: single column under 640 px, `min-h-dvh`, `touch-action: manipulation` and `select-none` on tap targets, 44 px minimum targets, safe-area padding kept from M0.
- Accessibility: buttons have labels, the points value is not an `aria-live` region, dialogs are shadcn (focus trapped), reduced motion respected.

shadcn components to add before the build (owner does this with the CLI): `dialog`, `switch`, `progress`, `card`, `textarea`, `badge`, `select`, `separator`, `tooltip`.

## Smoke test (`tests/e2e`)

`playwright.config.ts` at the root, Chromium only, `webServer` runs `pnpm dev` on 5173. One spec `tests/e2e/smoke.spec.ts`: load, points read 0, click Roll, points change, reload, points persist, open settings, export string starts with `ND1:`. Script `"test:e2e": "playwright test"`. Not part of `pnpm check` (browser download); the deploy workflow gets a step `pnpm exec playwright install --with-deps chromium` and `pnpm test:e2e` after `pnpm check`.

## Done when

`pnpm check` and `pnpm test:e2e` green, the live Pages URL plays on a phone and a laptop, a save survives a reload, closing the tab for a minute shows the away modal with a plausible gain, and the second tab shows the locked screen.
