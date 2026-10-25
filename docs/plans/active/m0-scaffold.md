# M0 Scaffold and guards

Date: 2026-10-25. Status: complete locally, review fixes applied 2026-10-25; awaits the first commit, repo creation and the first Pages deploy. Moves to `docs/plans/done/` when the first push to main deploys an empty page. Source: PLAN.md section 5, row M0.

## What M0 contains

- Tooling: pnpm 10, Vite 8 with `@vitejs/plugin-react`, TypeScript 7.0.2 strict (`verbatimModuleSyntax`, `erasableSyntaxOnly`, `@/*` alias via `paths`, no `baseUrl`), oxlint, Vitest 5 (node environment, no globals).
- Styling: Tailwind 4 via `@tailwindcss/vite`, shadcn radix-nova preset with Button installed, Geist self-hosted, dark and light CSS variables in `src/index.css`.
- Guard tests in `tests/arch`: core purity (forbidden tokens), layering (content -> core -> app -> ui), numeric literals in core, Tailwind v4 (no `@tailwind`, no config files), Zustand selector rules. They read source with `import.meta.glob` on raw file contents.
- `src/core/num.ts` wrapping break_infinity.js 2.2.0 (pinned) and `src/core/rng.ts` wrapping pure-rand.
- `src/content/dice.ts` with the five baseline dice (costs 10 to 100000, growth 1.08, multipliers 1, 2, 4, 8, 16) and its zod schema test, run by `pnpm validate:content`.
- PWA manifest through vite-plugin-pwa (`registerType: 'prompt'`), icons in `public/icons`.
- GitHub Actions workflow deploying `dist/` to GitHub Pages with `VITE_BASE` set to `/<repo>/`, actions pinned to their current majors (D13).
- Documents: CLAUDE.md, ARCHITECTURE.md, docs/GDD.md skeleton, docs/DECISIONS.md D1 to D14, docs/BALANCE_LOG.md (header only), docs/ROADMAP.md, this file.
- Agent rules and hooks: `.claude/rules/` (core-purity, content, tailwind-v4, zustand-v5), `.claude/settings.json` with a Bash guard hook (self-test in `.claude/hooks/guard-bash.test.mjs`) and a Stop hook that runs `pnpm check`.

## Deliberately deferred

- Sim CLI and bots (`tools/sim`, `pnpm sim`): M1.
- Save layer (`src/core/save.ts`, `SAVE_VERSION`, migrations, IndexedDB storage, backup slots, Web Locks guard, export and import): M1 core, M2 storage.
- Game loop, offline catch-up, platform adapter implementation, Zustand store: M2.
- Playwright and `tests/e2e`: M2.
- PWA update prompt UI: M2 (D11).
- GitHub repository creation, the first commit and the first deploy: the owner creates the repo once the working title is chosen (GDD Q1), then the workflow runs on the first push to main. Until then the Stop hook has no HEAD to diff against and skips `pnpm check`.
- Fantasy, working title, GDD sections 1 to 3 numbers: owner.

## Verify

```
pnpm check && pnpm build
```

`pnpm check` runs `tsc -b`, oxlint and `vitest run` (including `src/content` validation). `pnpm build` runs `tsc -b` then `vite build` and must produce `dist/` with the PWA manifest and service worker.

Verified 2026-10-25 by the M0 verifier pass: `pnpm check` green (8 test files, 87 tests; oxlint reports one accepted fast-refresh warning in the generated `src/components/ui/button.tsx`), `pnpm build` green, a `VITE_BASE=/incremental/` build rewrites the manifest, `registerSW.js` and asset links under the base while the favicon and apple-touch-icon hrefs stay relative, both hooks exit 0 on benign samples and 2 on blocked samples. Those counts predate the review fixes below. The post-fix verifier pass, same day: `pnpm check` green at 8 test files, 93 tests (same single oxlint warning), `pnpm build` green, the five guard probes (an `@tailwind base;` CSS file, `N.from('1.08')` in core, an array-literal and a `.map` selector in `src/ui`, `break_infinity.js` imported outside `num.ts`, and a `type Face = 1 | 2 | 3 | 4 | 5 | 6` union that must pass) each caught or passed as intended with `tsc -b` still exit 0, the hook samples (`rm -rf dist/../src`, `bash -c 'rm -rf src'`, `git push --delete origin main` exit 2; `rm -rf node_modules/.cache`, `pnpm check` exit 0; `stop-check` exit 0 with `stop_hook_active`) matched, `vitest run src/core` green three times in a row, and the six action majors matched `gh api repos/<action>/releases/latest`.

## Review fixes 2026-10-25

Findings from the M0 review, fixed in one pass by parallel agents, each in its own files:

- CSS guard: `tests/arch/tailwind-v4.test.ts` reads CSS with `node:fs`. Under Vitest the `?raw` import of a `.css` file resolved to an empty string, so the `@tailwind` directive check passed on any input.
- Literal string hole: `tests/arch/literals.test.ts` checks numeric strings handed to `N.from(...)` and `N.parse(...)` by value, so `N.from('1.08')` cannot smuggle a constant, and skips `type X =` literal unions so the M1 face types need no marker.
- Selector shapes: `tests/arch/store-selectors.test.ts` also catches `function (s) { return s }`, block bodies that return an object or array literal, and bodies ending in `.map`, `.filter`, `.slice`, `Object.entries`, `Object.values` or `Object.keys` outside `useShallow(...)`.
- Hook escapes: `.claude/hooks/guard-bash.mjs` rejects any `rm -rf` path with a `..` segment before the `node_modules` and `dist` allowlist (`dist/../src`, `node_modules/../src` and `./dist/..` all exited 0 before), checks the quoted code inside `bash`, `sh` and `zsh -c`, `eval`, `node -e` and `python3 -c`, splits on `&`, `(`, `)` and backticks with quotes respected, and blocks `git push --delete`, `-d` and `origin :branch`. `guard-bash.test.mjs` holds 60 fixtures and runs with `node .claude/hooks/guard-bash.test.mjs`.
- Action versions: `.github/workflows/deploy.yml` pinned to `checkout@v7`, `setup-node@v7`, `configure-pages@v6`, `upload-pages-artifact@v5`, `deploy-pages@v5` and `pnpm/action-setup@v6`, since the Node 20 runtime left hosted runners on 2026-09-23 (D13).
- Number normalisation: `src/core/num.ts` normalises every Decimal it returns, because break_infinity's `add` can return a mantissa just below 1 and that broke exact `N.serialize` round trips (D14).
- Startup content validation: `src/main.tsx` calls `validateContent()` before rendering, so a broken table fails the app at startup and not only `pnpm validate:content`.
- Test glob: the Vitest `include` in `vite.config.ts` lists `src/**`, `tests/**` and `tools/**` `*.test.{ts,tsx}`, so the `tests/arch` guards run under `pnpm test` and `pnpm check`.
- Docs: CLAUDE.md gained ground rules 11 to 13 (game loop, save durability, platform adapter) and names which rules quote and which condense PLAN.md; `.claude/rules/core-purity.md` describes the literal-string check and the per-file package confinement; `.gitignore` ignores `.claude/launch.json`; PLAN.md's pure-rand row names the v8 subpath imports; ARCHITECTURE.md invariants 2, 3 and 5 and CLAUDE.md rules 1, 3, 4 and the code-style note describe the same checks the guards now run; this plan moved back to `docs/plans/active/` until the first deploy.

## Done when

`pnpm check` is green, `pnpm build` succeeds, and an empty page deploys to a public GitHub Pages URL after the first push.
