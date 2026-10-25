# Architecture

Status: M0 scaffold, 2026-10-25. Sections marked M1 or M2 describe designs that are decided in PLAN.md section 4 but not yet built. Everything not marked exists in the repo today. When code and this file disagree, fix one of them in the same pull request.

## Codemap

- `src/core/` pure simulation. M0: `num.ts` (Decimal wrapper over break_infinity.js), `rng.ts` (seeded RNG over pure-rand). M1: state types, `dispatch`, `advance`, formulas, `save.ts`, migrations.
- `src/content/` tunable tables and zod schemas. M0: `schema.ts` (zod schemas and inferred types), `dice.ts` (five baseline dice), `index.ts` (`content` and `validateContent()`), `content.test.ts`.
- `src/app/` browser shell. M1: vanilla Zustand store. M2: game loop, storage, platform adapter, offline catch-up, autosave.
- `src/ui/` game screens and components. M2.
- `src/components/ui/` shadcn/ui generated components. M0: Button.
- `src/lib/` shadcn utilities (`cn`). Exempt from layer rules.
- `tests/arch/` guard tests that read raw source files: purity, layering, literals, Tailwind v4, selectors.
- `tests/e2e/` Playwright smoke tests. M2.
- `tools/sim/` headless sim CLI and bots. M1.
- `public/` favicon and PWA icons.
- `.github/workflows/deploy.yml` builds with `VITE_BASE` and deploys to GitHub Pages.
- `.claude/` rules and hooks for agents. `docs/` design and decision records.

## Layers

```
src/content  ->  src/core  ->  src/app  ->  src/ui, src/components
  tables         pure sim       shell        render, dispatch
```

The arrow is the only allowed import direction. A layer may import itself and anything to its left, never anything to its right.

| Layer | May import | npm packages |
|---|---|---|
| `src/content/**` | `src/content` | `zod` |
| `src/core/**` | `src/core`, `src/content` | `break_infinity.js`, `pure-rand`, `zod` |
| `src/app/**` | `src/app`, `src/core`, `src/content` | any |
| `src/ui/**`, `src/components/**` | anything | any |
| `src/lib/**` | exempt | any |

Test files (`*.test.ts`, `*.test.tsx`) are exempt from import and token rules and may import `vitest` and `fast-check`.

## Invariants

Invariants 1 to 5 each have a test in `tests/arch`; 7 is checked by `src/content/content.test.ts`; 6 lands with the save layer in M1. The guard tests read source with `import.meta.glob` on raw file contents (the Tailwind guard reads CSS with `node:fs`, because a `?raw` import of `.css` resolves to `""` under Vitest), so a violation fails `pnpm check` rather than a review.

1. Purity. Non-test files in `src/core` contain none of: `from 'react'`, `from "react"`, `window.`, `document.`, `localStorage`, `sessionStorage`, `indexedDB`, `Date.now(`, `new Date(`, `Math.random(`, `performance.now(`, `setTimeout(`, `setInterval(`, `requestAnimationFrame(`, `fetch(`, `navigator.`. Time and randomness arrive as arguments (`dtMs`, `rng`).
2. Layering. Imports follow the table above. `src/app` never imports `src/ui` or `src/components`. `src/content` imports only itself and `zod`. Per-file confinement: `break_infinity.js` may be imported only by `src/core/num.ts` and `pure-rand` (any subpath) only by `src/core/rng.ts`.
3. Literals. Numeric literals in non-test `src/core` files are forbidden except in `num.ts` and `rng.ts`, except `0`, `1`, `2`, `10`, `100`, `1000`, and except on a line carrying `// literal-ok`. A numeric string passed to `N.from` or `N.parse` is checked by value as well, so `N.from('1.08')` is flagged; a line that opens a type alias (`type Face = 1 | 2 | 3 | 4 | 5 | 6`) is exempt as a literal union. Every other number lives in `src/content`.
4. Tailwind v4. No `@tailwind ` directive anywhere in `src`. No `tailwind.config.*` and no `postcss.config.*` in the root.
5. Selectors. `src/ui` and `src/components` never call `useGameStore()` with no selector, never `useGameStore(s => s)` (nor `function (s) { return s }`), and never pass a selector that returns a fresh value unless wrapped in `useShallow(...)`: an object or array literal (`=> ({ ... })`, `=> [ ... ]`), a block body that returns one, or a body ending in `.map(`, `.filter(`, `.slice(`, `Object.entries(`, `Object.values(` or `Object.keys(`.
6. Save versioning (M1 onward). A change to the save or state shape bumps `SAVE_VERSION`, adds a migration to the ordered map, and adds a fixture test that loads a save from every historical version. The Bash guard hook blocks shell edits to `src/core/save.ts` that do not also touch a `*.migration.test.ts`.
7. Content shape. Tables hold plain JSON-like values (numbers, strings, booleans), never Decimal instances, and are validated with zod at startup.

## Game loop (M2)

Fixed-step accumulator in `src/app`:

- Tick length is 100 ms. The shell accumulates wall time and calls `advance(state, 100, rng)` once per full tick, carrying the remainder.
- Driven by `requestAnimationFrame` while the page is visible and by `setInterval` while hidden, because rAF stops entirely in hidden tabs and Chrome throttles timers to once a minute after five minutes hidden. The delta-time catch-up neutralises that throttling, so no Web Worker.
- Autosave every 30 s and on `visibilitychange` and `pagehide`.
- Offline catch-up on load: `elapsed = clamp(now - lastUpdate, 0, cap)`. A negative delta means the clock went back; grant nothing and move `lastUpdate` forward. Run at most 1e5 fixed ticks, then apply the expected-value remainder for anything left under the cap. A test asserts EV-offline equals stepped-online within tolerance. The UI shows a "while you were away" modal.
- The offline cap is a content value (GDD section 9, baseline 8 h).

## Save design (M1 core, M2 storage)

- `SAVE_VERSION` number in `src/core/save.ts`. An ordered migration map steps a save from any older version to the current one, one function per version. A zod schema validates the migrated result. Defaults are deep-merged under the loaded object so new fields never arrive undefined.
- Decimals serialise as strings so `Infinity` never becomes `null`. The RNG seed and state are part of the save.
- Fixture saves from every historical version live in the repo and load in a test.
- Storage (`src/app`): IndexedDB via `idb-keyval`, `navigator.storage.persist()` requested once. Rotating backup slots at 1, 5, 20 and 60 minutes (Antimatter Dimensions' pattern). Every write wrapped in `try/catch` for `QuotaExceededError`.
- An unparseable save is quarantined under a backup key and a recovery dialog is shown. It is never overwritten. A save with a future version is rejected without mutation.
- Export and import strings (lz-string compressed) are a first-class feature. Import shows "export first" before replacing the current save.
- A Web Locks guard refuses to run the game in a second tab.
- Portals run the game in cross-origin iframes with partitioned storage, so own URL, itch and CrazyGames are three separate saves. Export and import, the PWA and the `saveStore` seam below are the save system, not polish.

## Platform adapter (M2 interface, M0 decision)

```ts
interface Platform {
  gameplayStart(): void
  gameplayStop(): void
  loadingStart(): void
  loadingStop(): void
  requestAd(kind: 'midgame' | 'rewarded'): Promise<'done' | 'skipped' | 'unavailable'>
  happytime(): void
  saveStore: { get(key: string): Promise<string | null>; set(key: string, value: string): Promise<void> }
}
```

The web build gets a no-op implementation that logs nothing and backs `saveStore` with IndexedDB. The CrazyGames SDK v3 drops in behind the same interface later without touching `src/core` or `src/ui`. Method names mirror the SDK so the mapping is one line each.

## Number policy (M0)

- Every game value is a `Decimal` from `break_infinity.js` 2.2.0, pinned exactly. No plain-number arithmetic on game values anywhere, from the first formula. Swapping later would mean rewriting the whole sim (PLAN.md D3).
- `src/core/num.ts` is the only file that imports `break_infinity.js`. It exports the `Num` type and the helpers the rest of core uses: construct from number or string, add, sub, mul, div, pow, compare, floor, min, max, serialise to string, parse from string. Formulas call the helpers, not Decimal methods directly, so a change of library is a one-file change. `N.serialize` writes `<mantissa>e<exponent>` (exact round trip under property test; `Decimal.toString` drifts in the last digit for about two percent of values) and `N.parse` reads that form plus ordinary literals, strictly.
- `N.format` in `num.ts` is the one formatter for numbers shown to a player: hand rolled and locale independent (digits and a dot, no `Intl`), so the `da-DK` dev machine cannot render `1.000,5`. Below 1000 up to two decimals, trimmed; from 1e3 suffixes K M B T Qa Qi Sx Sp Oc No Dc with three significant digits; from 1e36 scientific. Never call `toLocaleString()` on a game value and never format in a component; the UI mirrors formatted strings from the store (M2).
- The notation thresholds live in `num.ts`, which is exempt from the literal rule. A player-facing notation setting is M2 or later.
- `src/core/rng.ts` wraps `pure-rand` (xoroshiro128plus). The sim and the browser inject the same RNG; the seed is saved so a session replays deterministically. `pure-rand` 8 has no root export: `rng.ts` imports `pure-rand/generator/xoroshiro128plus` and `pure-rand/distribution/uniformInt`, and the layering test resolves those subpaths to the `pure-rand` package.
