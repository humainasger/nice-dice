# Balance log

One entry per balance change, newest at the top. A balance change is any edit to a number in `src/content` or to a formula in `src/core` that changes what the sim prints. The entry goes in the same pull request as the change, and the owner approves it before merge. No entries yet; the first lands with M3.

## Entry format

```
## YYYY-MM-DD <short title>

Measured: what the sim showed before the change, with the bot and horizon (for example "active clicker, 1 h: second die at 4 min 10 s, target 1 to 3 min").
Changed: the content fields or formula touched, old value to new value, with the GDD section and row.
Why: the pacing assertion or playtest note that motivated it.
Sim table:

| Metric | Before | After | Target (GDD section 12) |
|---|---|---|---|
| ... | ... | ... | ... |

Approved by: owner, date.
```

Rules:

- Measured and After come from `pnpm sim` output pasted or summarised, not from estimates.
- Every Changed row names a GDD field. If the GDD has no row, add it first.
- A change that moves a pacing assertion's bounds also edits GDD section 12 and `balance.test.ts` in the same pull request.
