---
paths:
  - "src/core/**"
---

# src/core is pure

`src/core` is the simulation: state types, `dispatch(state, command)`, `advance(state, dtMs)`, formulas, save and migrations. It runs identically in Vitest, the sim CLI and the browser. Tests in `tests/arch` enforce every rule below on non-test files; test files (`*.test.ts`) are exempt.

## Imports

Only `src/core/**`, `src/content/**` (relative or `@/core`, `@/content`) and the npm packages `break_infinity.js`, `pure-rand` and `zod`. Within core: `break_infinity.js` only in `num.ts`, `pure-rand` only in `rng.ts` (enforced by `tests/arch/layering.test.ts`); everything else uses the `Num` helpers and the `rng` argument. `pure-rand` 8 has no root export (`from 'pure-rand'` fails at runtime): import `pure-rand/generator/xoroshiro128plus` and `pure-rand/distribution/uniformInt`. The layering test resolves subpaths to the package name, so these pass.

## Forbidden tokens

None of these may appear in a non-test file under `src/core`:

`from 'react'`, `from "react"`, `window.`, `document.`, `localStorage`, `sessionStorage`, `indexedDB`, `Date.now(`, `new Date(`, `Math.random(`, `performance.now(`, `setTimeout(`, `setInterval(`, `requestAnimationFrame(`, `fetch(`, `navigator.`

Time arrives as the `dtMs` argument. Randomness arrives as the `rng` argument built by `src/core/rng.ts`. The browser shell in `src/app` owns the clock, the timers and the storage.

## Numeric literals

Numeric literals are forbidden in non-test `src/core` files, except:

- in `src/core/num.ts` and `src/core/rng.ts`
- the literals `0`, `1`, `2`, `10`, `100`, `1000`
- on a line carrying the comment `// literal-ok`

The guard also flags numeric strings passed to `N.from` and `N.parse` (`N.from('1.08')` is the same hidden constant as `1.08`), so a string is not a way around the rule. Type-position literal unions are exempt: a line starting with `type X =` such as `type Face = 1 | 2 | 3 | 4 | 5 | 6` passes, so the M1 face types need no marker.

Every other number is a field in `src/content` with a stable id, mapped to a GDD field. If a formula needs a constant, add it to the content table, not to the formula.

## Numbers

Every game value is a `Num` (Decimal) from `src/core/num.ts`. No `a * b` or `a > b` on game values. Decimals serialise as strings.

## Save and state shape

A change to the save or state shape means a `SAVE_VERSION` bump plus a migration in the ordered map plus a fixture test for the old version, no exceptions. The Bash guard hook blocks shell edits to `src/core/save.ts` that do not also touch a `*.migration.test.ts`.

## Style

TypeScript 7 strict, `import type` for types, no enums, no parameter properties. Small files with a one-line header comment. Explicit `import { describe, it, expect } from 'vitest'` in tests.
