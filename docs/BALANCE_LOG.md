# Balance log

One entry per balance change, newest at the top. A balance change is any edit to a number in `src/content` or to a formula in `src/core` that changes what the sim prints. The entry goes in the same pull request as the change, and the owner approves it before merge.

## 2026-10-25 M3 mechanics: ascension cost multiplier 300 (new) and luck threshold 1e6 to 1e10

Measured: the M3 systems as `docs/plans/active/m3-game.md` wrote them (combos, faces, ascension x100 at level 100 with the level cost restarting from baseCost, charms, luck from 1e6 run points, trophies), active bot, seeds 1 / 2 / 3, 8 h horizon. The early game held: die_2 affordable 0:01:04 / 0:01:22 / 0:01:08 (P1 pass), all five dice 0:14:49 / 0:13:42 / 0:13:58 (pass). The mid game did not. With the M1 shopping rule the bot never sprinted to level 100, so the first ascension and the first charm landed at 2:55:44 / 2:55:32 / 2:52:38 and the first luck at 0:29:24 / 0:30:47 / 0:30:03 (seed 1 FAIL against 0:30:00 to 1:30:00). Once a die did ascend the game ran away: a cycle to the cap cost the same ~250K every time while output went x100, so by 8 h every die had 155 ascensions, luck was 1.4e17 and lifetime points 4.21e342 / 5.61e345 / 2.82e342. With a bot that values the sprint to the cap (the ascension plus buying back to the same level on the x100 curve, see below) the first ascension moved to 0:14 to 0:16 and the runaway followed it: with a cost multiplier of 100 (a cycle costs what it pays) and the 1e6 threshold, seed 1 reached 1e6 at 0:15:54, prestiged at 0:16:39 and had 1e1646 points at 1 h; raising the threshold alone barely moved the first luck (1e7 to 2.5e8 gave 0:26 to 0:30) because the post-ascension income explodes within minutes. Sweep over `ascension.costMultiplier` x `luck.threshold`, first ascension / first luck, seeds 1 / 2 / 3, 90 min horizon:

| costMultiplier | threshold | First ascension | First luck | Lifetime points at 90 min |
|---|---|---|---|---|
| 1 (brief) | 1e6 | 2:55 / 2:55 / 2:52 (M1 bot) | 0:29:24 / 0:30:47 / 0:30:03 | about 1e9 (then 1e342 by 8 h) |
| 100 | 1e6 | 0:15:24 / 0:13:32 / 0:16:33 | 0:16:39 / 0:15:07 / 0:18:13 | 1e1646 at 1 h (seed 1) |
| 300 | 1e6 | 0:14:29 / 0:13:52 / 0:14:03 | 0:15:19 / 0:15:23 / 0:14:53 | 7e96 / 3e74 / 1e22 |
| 300 | 1e9 | same | 0:25:19 / 0:32:57 / 0:27:56 | 23B / 12B / 13B |
| 300 | 1e10 | same | 0:34:42 / 0:43:02 / 0:36:45 | 83B / 95B / 140B |
| 300 | 1e12 | same | 0:39:57 / 0:49:41 / 0:43:24 | 8T / 8T / 8T |
| 500 | 1e9 | 0:14:29 / 0:14:22 / 0:15:13 | 0:31:14 / 0:29:47 / 0:32:28 | 12B / 12B / 11B |
| 500 | 1e10 | same | 0:38:59 / 0:37:32 / 0:40:23 | 81B / 80B / 80B |
| 1000 | 1e6 | not reached / not reached / 0:50:18 | 0:28:24 / 0:29:22 / 0:31:38 | 16M / 15M / 18M |
| 1000 | 5e6 | 0:43:44 / 0:41:42 / 0:48:33 | 0:46:24 / 0:44:07 / 0:49:43 | 41M / 42M / 41M |

Changed: `src/content/rules.ts` `ascension.costMultiplier` added at 300 (every level cost on a die is multiplied by 300 per ascension, so the cost curve does not restart from baseCost; the formula is `levelCost(def, level, ascensions)` in `src/core/formulas.ts`), and `luck.threshold` 1000000 to 10000000000 (GDD section 7, trigger). GDD section 4 needs the cost multiplier in its level cost rule, section 5 the combos table (bases 2 / 3 / 4 / 6 / 8 / 12 / 50, upgrade 50 x 2.35^level, +0.1 of base per level), charms (14 rows) and the draft (ceil(1.15^taken), weights 6 / 3 / 1), section 7 the threshold, section 10 the trophies table (14 rows, x1.02 each); the GDD is owner-edited and still carries the brief's 1e6, so those rows need the owner's edit with this entry as the reason. `src/content/content.test.ts` pins the new values. No other content number changed: dice, combo bases, charm effects, face costs, draft growth and the luck formula are the brief as written.
Why: the m3-game.md balance windows (die_2 at 1 to 3 min, all five by 45 min, first luck between 30 and 90 min) plus the GDD section 8 proposal of a first draft at 10 to 20 min. 300 keeps the first ascension at about 14 minutes (a cycle costs three times what it pays, so a player still sprints for it) while 1000 pushed it past 40 minutes and left the first luck run without a draft; 1e10 puts the first luck a comfortable five minutes inside the window on the earliest seed. 500 x 1e10 was the runner-up (first luck 0:37 to 0:40, slightly tamer 8 h: 1e93 against 1e124).
Sim table (active bot, milestones from the 8 h run; `pnpm sim --strategy active,idle --seeds 1,2,3 --hours 0.25,1,8`, 100 ms ticks, bot acts once per simulated second):

| Metric | Before (seed 1 / 2 / 3) | After (seed 1 / 2 / 3) | Target |
|---|---|---|---|
| die_2 affordable | 0:01:04 / 0:01:22 / 0:01:08 | 0:01:04 / 0:01:22 / 0:01:08 | P1: 0:01:00 to 0:03:00, pass |
| die_3 bought | 0:04:24 / 0:04:32 / 0:04:53 | 0:04:24 / 0:03:07 / 0:04:43 | none |
| die_4 bought | 0:09:54 / 0:08:57 / 0:09:23 | 0:07:49 / 0:06:57 / 0:08:28 | none |
| die_5 bought (all five owned) | 0:14:49 / 0:13:42 / 0:13:58 | 0:08:59 / 0:08:22 / 0:09:23 | by 0:45:00, pass |
| First ascension | 2:55:44 / 2:55:32 / 2:52:38 | 0:14:29 / 0:13:52 / 0:14:03 | GDD section 8 first draft 0:10 to 0:20 (proposal) |
| First charm | 2:55:45 / 2:55:33 / 2:52:39 | 0:14:30 / 0:13:53 / 0:14:04 | one second after the first ascension |
| First luck | 0:29:24 FAIL / 0:30:47 / 0:30:03 | 0:34:42 / 0:43:02 / 0:36:45 | 0:30:00 to 1:30:00, pass |
| Total earned 1.00M | 0:18:49 / 0:18:27 / 0:17:53 | 0:15:04 / 0:14:34 / 0:14:38 | none |
| Total earned 1.00B | 2:55:52 / 2:55:40 / 2:52:47 | 0:23:54 / 0:31:33 / 0:26:36 | none |
| Income at 1 h (points/s) | 642 / 816 / 832 | 40.7M / 348K / 104M | none |
| Total earned at 1 h | 8.09M / 8.12M / 8.15M | 52.8B / 42.4B / 61.0B | none |
| Total earned at 8 h | 4.21e342 / 5.61e345 / 2.82e342 | 3.85e124 / 1.15e122 / 1.11e134 | none, see below |
| Ascensions of die_1 at 8 h | 155 / 155 / 155 | 44 / 47 / 48 | none |
| Charms / prestiges at 8 h | 45 / 23, 45 / 23, 33 / 23 | 24 / 21, 25 / 20, 24 / 21 | none |
| Dead content at 2 h | none | none | none, pass |
| Idle bot (never clicks) | earns nothing | earns nothing | unchanged, see the die_5 entry |

Bot changes in the same slice (`tools/sim/bots.ts`, not content): the M1 rule "most output multiplier per point, save for it when it is not yet affordable" stays for die levels and new dice; the M3 purchases are valued in the same unit (a combo upgrade as the dice sum times the relative lift of the mean hand multiplier, a face upgrade as the die's multiplier over its face total); a "sprint" candidate values every level to the cap as the whole cycle a player sees (ascend, buy back to today's level on the x100 curve); a new die is bought the moment it is affordable (the per-point rule cannot see the hands a die adds, and without this the bot cycled die_1 forever and left dice 4 and 5 dead); levels are bought in chunks of at least a tenth of the room to the cap and the bot saves only for a target within ten minutes of income, so a round never stalls or ping-pongs. die_2 affordable moved from 0:01:14 / 0:01:22 / 0:01:28 (M1 log entry) to 0:01:04 / 0:01:22 / 0:01:08 from the bot's spending order, not from content.

Open for the owner, not changed here: (1) the game still runs away by 8 h (1e122 to 1e134) because luck is floor(sqrt(run / threshold)) with the bot prestiging every 20 minutes, which makes each run's multiplier the square root of an exponentially growing total; GDD section 3 expects 1e308 within hours, so this is noted, not fixed; the levers would be a log luck formula or a longer cadence, both design changes. (2) `luckOnReset` clamps one prestige's luck at MAX_SAFE_INTEGER in core so the integer save schema holds; by 8 h the sum shows as about 1e17. (3) All five dice now arrive by 0:09 and the first ascension at 0:14, both well inside their windows; if the owner wants a slower first quarter hour the levers are die_4 and die_5 baseCost or the combo bases.

Approved by: owner, pending (delegated M3 tuning per `docs/plans/active/m3-game.md`; this entry is the review record).

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
