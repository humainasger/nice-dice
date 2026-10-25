# Balance log

One entry per balance change, newest at the top. A balance change is any edit to a number in `src/content` or to a formula in `src/core` that changes what the sim prints. The entry goes in the same pull request as the change, and the owner approves it before merge.

## 2026-10-25 die_5 baseCost 100000 to 35000

Measured: active clicker, seeds 1 / 2 / 3, 8 h horizon, committed Idle Dice baseline: all five dice owned at 1:17:44 / 1:17:52 / 1:17:48, target by 0:45:00 (`tools/sim/balance.test.ts`, "all five dice are owned within 45 minutes"), so the window failed by about 33 minutes on every seed. The earlier dice were on time (die_2 affordable 0:01:14 / 0:01:22 / 0:01:28 inside the 1 to 3 minute P1 window, die_3 at about 0:05, die_4 at about 0:18:40) and nothing was dead content at 2 h. The sim agent also measured costGrowth across the allowed 1.05 to 1.15 range: die_5 stays between 1:16:38 and 1:23:08 because its fixed baseCost dominates, and 1.06 or lower breaks P1 (die_2 affordable at 0:49 on seed 1), so growth is not the lever.
Changed: `src/content/dice.ts` die_5 `baseCost` 100000 to 35000 (factor 2.86, inside the 3x bound of `docs/plans/active/m1-core.md`; 33333 would overshoot it). GDD section 4, row `die_5`, column Base cost: the GDD is owner-edited and still shows 100000, so the row needs the owner's edit with this entry as the reason. `src/content/content.test.ts` pins the new table. costGrowth and every other die unchanged.
Why: the m1-core.md balance assertion "all five dice owned within 45 minutes of active play" (the demo's first-session goal from GDD section 12's spirit). The single die_5 change keeps the unlock gaps evenly spaced (1:14, 4:54, 18:34, 36:04 on seed 1) where the alternative of also halving die_4 bunches die_4 and die_5 (11:29 and 37:49). `pnpm sim --strategy active,idle --seeds 1,2,3 --hours 0.25,1,8` before and after, same engine (100 ms ticks, bot acts once per simulated second).
Sim table (active bot, milestones from the 8 h run, income and levels at 1 h and 8 h):

| Metric | Before (seed 1 / 2 / 3) | After (seed 1 / 2 / 3) | Target (GDD section 12) |
|---|---|---|---|
| Auto-roll unlocked | 0:00:04 / 0:00:02 / 0:00:03 | 0:00:04 / 0:00:02 / 0:00:03 | none |
| die_2 affordable | 0:01:14 / 0:01:22 / 0:01:28 | 0:01:14 / 0:01:22 / 0:01:28 | P1: 0:01:00 to 0:03:00, pass |
| die_3 bought | 0:04:54 / 0:05:17 / 0:05:18 | 0:04:54 / 0:05:17 / 0:05:18 | none |
| die_4 bought | 0:18:34 / 0:18:57 / 0:18:33 | 0:18:34 / 0:18:57 / 0:18:33 | none |
| die_5 bought (all five owned) | 1:17:44 / 1:17:52 / 1:17:48 FAIL | 0:36:04 / 0:36:57 / 0:36:08 pass | by 0:45:00 (m1-core.md) |
| Total earned 1.00K | 0:01:34 / 0:01:52 / 0:01:53 | 0:01:34 / 0:01:52 / 0:01:53 | none |
| Total earned 1.00M | 1:11:19 / 1:11:27 / 1:11:33 | 1:09:54 / 1:10:07 / 1:09:58 | none |
| Total earned 1.00B | not reached in 8 h | not reached in 8 h | none |
| Income at 1 h (points/s) | 340.2 / 340.2 / 340.2 | 365.4 / 365.4 / 365.4 | none |
| Income at 8 h (points/s) | 968.1 / 979.3 / 979.3 | 1.17K / 1.17K / 1.17K | none |
| Total earned at 8 h | 18.9M / 19.0M / 19.1M | 22.8M / 23.0M / 23.1M | none |
| Die levels at 1 h (seed 1) | 80 / 59 / 38 / 17 / 0 | 76 / 55 / 34 / 13 / 6 | none |
| Die levels at 8 h (seed 1) | 111 / 90 / 69 / 48 / 27 | 113 / 92 / 71 / 50 / 43 | none |
| Dead content at 2 h | none | none | none, pass |
| Idle bot (never clicks) | earns nothing, all dice dead | earns nothing, all dice dead | design question, see below |

Full tables, active bot, seed 1, before (committed baseline, `docs/balance-report.md` as generated 2026-10-25 before this change):

| Metric | 15 min | 1 h | 8 h |
| --- | --- | --- | --- |
| Auto-roll unlocked | 0:00:04 | 0:00:04 | 0:00:04 |
| die_2 affordable / bought | 0:01:14 / 0:01:14 | 0:01:14 / 0:01:14 | 0:01:14 / 0:01:14 |
| die_3 affordable / bought | 0:04:54 / 0:04:54 | 0:04:54 / 0:04:54 | 0:04:54 / 0:04:54 |
| die_4 affordable / bought | not reached | 0:18:34 / 0:18:34 | 0:18:34 / 0:18:34 |
| die_5 affordable / bought | not reached | not reached | 1:17:44 / 1:17:44 |
| Total earned 1.00K / 1.00M / 1.00B | 0:01:34 / not reached / not reached | 0:01:34 / not reached / not reached | 0:01:34 / 1:11:19 / not reached |
| Income at end (points/s) | 146.3 | 340.2 | 968.1 |
| Total earned at end | 73.6K | 760K | 18.9M |
| Points unspent at end | 719.07 | 27.6K | 799K |
| Rolls at end | 184 | 724 | 5764 |
| Die levels at end | 59 / 39 / 18 / 0 / 0 | 80 / 59 / 38 / 17 / 0 | 111 / 90 / 69 / 48 / 27 |
| Dead content | die_4, die_5 | die_5 | none |

Full tables, active bot, seed 1, after (`docs/balance-report.md` as committed with this change):

| Metric | 15 min | 1 h | 8 h |
| --- | --- | --- | --- |
| Auto-roll unlocked | 0:00:04 | 0:00:04 | 0:00:04 |
| die_2 affordable / bought | 0:01:14 / 0:01:14 | 0:01:14 / 0:01:14 | 0:01:14 / 0:01:14 |
| die_3 affordable / bought | 0:04:54 / 0:04:54 | 0:04:54 / 0:04:54 | 0:04:54 / 0:04:54 |
| die_4 affordable / bought | not reached | 0:18:34 / 0:18:34 | 0:18:34 / 0:18:34 |
| die_5 affordable / bought | not reached | 0:36:04 / 0:36:04 | 0:36:04 / 0:36:04 |
| Total earned 1.00K / 1.00M / 1.00B | 0:01:34 / not reached / not reached | 0:01:34 / not reached / not reached | 0:01:34 / 1:09:54 / not reached |
| Income at end (points/s) | 146.3 | 365.4 | 1.17K |
| Total earned at end | 73.6K | 769K | 22.8M |
| Points unspent at end | 719.07 | 10.8K | 375K |
| Rolls at end | 184 | 724 | 5764 |
| Die levels at end | 59 / 39 / 18 / 0 / 0 | 76 / 55 / 34 / 13 / 6 | 113 / 92 / 71 / 50 / 43 |
| Dead content | die_4, die_5 | none | none |

Seeds 2 and 3 before and after differ from seed 1 only in the seconds shown in the summary table above; the full per-seed tables are in `docs/balance-report.md` (after) and in the git history of that file (before).

Open for the owner, not changed here: the idle bot (never rolls by hand, as the spec defines it) earns nothing on this content because auto-roll unlocks at die_1 level 2, which costs 10.8 points that only manual rolls can fund. A player who never clicks never starts. Options are to let the idle bot bootstrap with manual rolls until the unlock (spec change for the bot), to start with auto-roll unlocked or die_1 at level 2 (content change, GDD section 6 row), or to accept it since any real player clicks at least three times.

Approved by: owner, pending (delegated demo tuning per `docs/plans/active/m1-core.md`; this entry is the review record).

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
