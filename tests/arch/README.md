# Architecture guards

Source-reading tests that keep the layer rules in CLAUDE.md true. The TypeScript guards read files
with `import.meta.glob(..., { query: '?raw' })`; the Tailwind guard reads CSS with `node:fs`, because
under Vitest the `?raw` import of a `.css` file resolves to `""`. Each skips `*.test.ts(x)` and reports
one soft assertion per offending file with token and line. Empty layers pass.
Run: `pnpm exec vitest run tests/arch`.

| File | Guard |
|---|---|
| `purity.test.ts` | Non-test `src/core` files contain none of the forbidden tokens (react, window, document, storage, Date.now, Math.random, timers, fetch, navigator). Comments ignored, strings scanned. |
| `layering.test.ts` | `src/content` imports only content and `zod`; `src/core` only core, content, `break_infinity.js`, `pure-rand`, `zod`; `src/app` only app, core, content and any npm package, never ui or components. Per-file confinement: `break_infinity.js` may be imported only by `src/core/num.ts` and `pure-rand` (any subpath) only by `src/core/rng.ts`. |
| `literals.test.ts` | Non-test `src/core` files use no numeric literal except 0, 1, 2, 10, 100, 1000 (by value), all of `num.ts` and `rng.ts`, and lines ending in `// literal-ok`. Comments and strings stripped, except that a numeric string passed to `N.from(...)` or `N.parse(...)` is checked by value first, so `N.from('1.08')` is flagged. Lines that open a type alias (`type Face = 1 \| 2 \| 3`) are exempt as literal unions. |
| `tailwind-v4.test.ts` | No `@tailwind ` directive in `src/**/*.css` (read with `node:fs`, rooted at the test file), no `tailwind.config.*` or `postcss.config.*` in the root, and `src/index.css` is read non-empty and carries `@import "tailwindcss"`. |
| `store-selectors.test.ts` | In `src/ui` and `src/components`, `useGameStore` always gets a selector and never the identity (`s => s`, `function (s) { return s }`). A selector that returns a fresh value is flagged unless wrapped in `useShallow(...)`: `=> ({ ... })`, `=> [ ... ]`, a block body that returns an object or array literal, or a body ending in `.map(`, `.filter(`, `.slice(`, `Object.entries(`, `Object.values(` or `Object.keys(`. |

Extending: tokens live in `FORBIDDEN_TOKENS` (purity), per-layer `allowedDirs`, `allowedPackages` and
`confinedPackages` (`CONFINED_PACKAGES`) in `RULES` (layering), `ALLOWED_VALUES`, `EXEMPT_FILES`,
`TYPE_LINE` and `NUMERIC_STRING_ARG` (literals), `FRESH_TAIL_CALL` (selectors). Add a new layer by
adding a glob constant plus a `RULES` entry. Every file ends with a `self-check` test on inline
fixtures; extend it when you change a regex. `helpers.ts` holds the shared comment/string stripper
and import resolver.
