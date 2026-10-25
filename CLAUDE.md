# Nice Dice

Nice Dice is a browser dice incremental in the spirit of Idle Dice: roll dice for points, level and ascend dice, poker-hand combos, a three-choice draft on a progress bar, one prestige layer, and die-face editing as the v1 differentiator. Not casino themed. Built mostly by Claude Code around a pure TypeScript simulation core, a React shell and GitHub Pages hosting. PLAN.md is the plan of record. docs/GDD.md is the design of record and is owner-edited: Asger decides the numbers and targets there, agents propose and implement.

## Commands

- `pnpm check` typecheck, lint and test. Must be green before a turn ends (the Stop hook runs it after the first commit)
- `pnpm dev` Vite dev server
- `pnpm build` tsc -b then vite build
- `pnpm test`, `pnpm test:watch` Vitest (node environment, no globals, `import { ... } from 'vitest'`)
- `pnpm validate:content` content table tests only (`vitest run src/content`)
- `pnpm typecheck`, `pnpm lint` tsc -b, oxlint
- `pnpm sim` headless sim CLI, lands in M1

## Path map

| Path | Purpose |
|---|---|
| `src/core/` | Pure simulation: state types, `dispatch`, `advance`, formulas, `num.ts`, `rng.ts`, save and migrations |
| `src/content/` | Every tunable number as typed tables with stable string ids, zod schemas |
| `src/app/` | Browser shell: game loop, storage, platform adapter, vanilla Zustand store |
| `src/ui/` | Game screens and components. Render state, call `dispatch` |
| `src/components/` | shadcn/ui generated components |
| `src/lib/` | shadcn utilities (`cn`), exempt from layer rules |
| `tools/sim/` | Sim CLI and bots (M1) |
| `tests/arch/` | Guard tests: purity, layering, literals, Tailwind v4, selectors |
| `tests/e2e/` | Playwright smoke tests (M2) |
| `docs/` | GDD, DECISIONS, BALANCE_LOG, ROADMAP, plans/active, plans/done |

## Ground rules

Rules 6 and 7 quote PLAN.md section 4 (7 drops the modal sentence). Rules 1 to 4 and 11 to 13 condense section 4 and add the exact tokens, packages and allowlists the tests check. Rule 5 replaces section 4's `formatNumber` with a fixed `en-US` locale by the hand-rolled `N.format` (ARCHITECTURE.md, number policy). Rules 8 and 10 condense section 5, rule 9 condenses the tailwindcss row of section 2. Tests in `tests/arch` enforce rules 1 to 4 and 9.

1. `src/core/` is pure TypeScript: state types, `dispatch(state, command)`, `advance(state, dtMs)`, formulas, save and migrations. No `react`, `window`, `document`, `localStorage`, `sessionStorage`, `indexedDB`, `Date.now`, `new Date`, `Math.random`, `performance.now`, timers, `requestAnimationFrame`, `fetch` or `navigator`. Imports only `src/core`, `src/content`, `break_infinity.js`, `pure-rand` and `zod`; `break_infinity.js` only in `num.ts`, `pure-rand` only in `rng.ts`.
2. Dependency direction is content -> core -> app -> ui. `src/content` imports only itself and `zod`. `src/app` never imports `src/ui` or `src/components`. Test files are exempt.
3. `src/content/` holds every tunable number as typed tables with stable string ids, validated with zod at startup. Tables hold plain values, never Decimal instances. No numeric literal in a core formula outside content (allowed: 0, 1, 2, 10, 100, 1000, anything in `num.ts` or `rng.ts`, a `type X =` line, or a line marked `// literal-ok`; a numeric string in `N.from` or `N.parse` counts as a literal). The owner tunes here without touching logic.
4. UI components select primitives or formatted strings, never the whole store (`useGameStore()` or `s => s`) and never a fresh Decimal, object or array literal, or a `.map`, `.filter`, `.slice` or `Object.entries/values/keys` result unless wrapped in `useShallow`. Keep Decimals in the vanilla store, mirror formatted strings into React state at a few Hz.
5. All numbers shown to a player go through one formatter, `N.format` in `src/core/num.ts` (hand rolled, locale independent, no `Intl`). Never `toLocaleString()` on a game value. The dev machine is `da-DK` and would render `1.000,5`.
6. Saves: `SAVE_VERSION` number, ordered migration map, deep-merge over defaults, zod validation, fixture save from every historical version loaded in a test. A state-shape change means version bump plus migration plus test, no exceptions. Decimals serialise as strings so `Infinity` never becomes `null`.
7. Offline: `elapsed = clamp(now - lastUpdate, 0, cap)`. Negative means the clock went back: grant nothing, move `lastUpdate` forward. Run at most 1e5 fixed ticks, apply the expected-value remainder, test that EV-offline equals stepped-online within tolerance.
8. Every number in GDD sections 3 to 8 maps to a field in `src/content`. Each balance change gets a `docs/BALANCE_LOG.md` entry with the sim table. Decisions that change get a `docs/DECISIONS.md` entry.
9. Tailwind v4 only: `@import "tailwindcss"` in `src/index.css`, no `@tailwind` directives, no `tailwind.config.*`, no `postcss.config.*`. Use the shadcn CSS variables already defined there.
10. One feature per branch and pull request, each slice mergeable with tests green. Write `docs/plans/active/<slice>.md` before implementing, move it to `docs/plans/done/` when merged. Open the PR with evidence: `pnpm check` output, sim table where relevant, screenshot for UI.
11. `src/app` game loop (M2): fixed 100 ms accumulator, driven by `requestAnimationFrame` while visible and `setInterval` while hidden (rAF stops entirely in hidden tabs), autosave every 30 s and on `visibilitychange` and `pagehide`.
12. Save durability (`src/app`, M2): IndexedDB via `idb-keyval` plus `navigator.storage.persist()`, rotating backup slots at 1, 5, 20 and 60 min, `try/catch` on every write for `QuotaExceededError`, quarantine an unparseable save under a backup key instead of overwriting it, reject future-version saves without mutating them, export and import strings as a first-class feature with "export first" on import, a Web Locks guard refuses a second tab.
13. Platform adapter: one `Platform` interface with `gameplayStart`, `gameplayStop`, `loadingStart`, `loadingStop`, `requestAd`, `happytime` and `saveStore` (shape in ARCHITECTURE.md). The web build gets a no-op implementation; the CrazyGames SDK drops in behind it later without touching `src/core` or `src/ui`.

## Code style

TypeScript 7 strict. `verbatimModuleSyntax`: use `import type` for types. `erasableSyntaxOnly`: no enums, no parameter properties. Path alias `@/*` maps to `src/*` (no `baseUrl`, TS 7 rejects it). Small files, one short header comment per file saying what it is for. No em dashes in prose. `break_infinity.js` and `lz-string` are pinned exactly, do not bump them. Vitest guard tests read source with `import.meta.glob(..., { query: '?raw', import: 'default', eager: true })`; the Tailwind guard reads CSS with `node:fs` because a `?raw` import of `.css` resolves to `""` under Vitest.

## Docs and rules

- `PLAN.md` plan of record: decisions, stack, architecture rules, milestones, open questions
- `ARCHITECTURE.md` codemap, layer diagram, invariants, game loop, save design, platform adapter, number policy
- `docs/GDD.md` design of record, owner-edited, 14 sections, every tunable maps to `src/content`
- `docs/DECISIONS.md` ADR log D1 onward
- `docs/BALANCE_LOG.md` one entry per balance change with the sim table
- `docs/ROADMAP.md` milestones M0 to M6 and status
- `docs/plans/active/`, `docs/plans/done/` one plan file per slice
- `.claude/rules/` path-scoped rules: `core-purity.md`, `content.md`, `tailwind-v4.md`, `zustand-v5.md`
- `.claude/hooks/` `guard-bash.mjs` blocks force pushes and remote branch deletes, hard resets, `rm -rf` outside `node_modules` and `dist` or with a `..` segment, `git clean -f` and `save.ts` edits without a migration test, also inside `bash -c`, `eval`, `node -e` and `python3 -c` (self-test: `node .claude/hooks/guard-bash.test.mjs`); `stop-check.mjs` runs `pnpm check` when a turn ends (after the first commit, it needs a HEAD to diff against)
