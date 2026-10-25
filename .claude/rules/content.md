---
paths:
  - "src/content/**"
---

# src/content holds the numbers

`src/content` is the leaf layer: every tunable number as typed tables with stable string ids. The owner (Asger) tunes here without touching logic. Tests in `tests/arch` and `pnpm validate:content` enforce the rules below.

## Rules

- Plain values only. Tables hold JSON-like values: numbers, strings, booleans, arrays and objects of those. Never a Decimal instance, never a function, never a class. `src/core` converts to `Num` at the boundary.
- Stable string ids. Every row has an `id` that never changes once it has shipped in a save. Rename the display name, not the id. Ids are lowercase snake_case (`die_1`), enforced by `idSchema` in `src/content/schema.ts`.
- Zod at the boundary. Every table has a zod schema next to it and a test that parses the table with it. The app validates at startup and fails loudly.
- No logic. No formulas, no conditionals, no derived values. If a value can be computed from other values, compute it in `src/core`.
- Imports. Only `src/content/**` (relative or `@/content`) and the npm package `zod`. Nothing from `src/core`, `src/app` or `src/ui`.
- Every number maps to a GDD field. Each table or field names the `docs/GDD.md` section and row it implements, in a comment or a `gdd` string field. A number with no GDD row is a question for the owner, not a default.
- A balance change is a `docs/BALANCE_LOG.md` entry with the sim table, in the same pull request.

## Baseline

The first dice table follows the Idle Dice baseline from PLAN.md section 3 and GDD section 4: five dice, base costs 10, 100, 1000, 10000, 100000, cost growth 1.08 per level, output multipliers 1, 2, 4, 8, 16. Diverge from there through the GDD, not in code.
