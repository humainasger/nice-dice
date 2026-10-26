# Balance log

One entry per balance change, newest at the top. A balance change is any edit to a number in `src/content` or to a formula in `src/core` that changes what the sim prints. The entry goes in the same pull request as the change, and the owner approves it before merge.

## 2026-10-26 M5 luck sinks: mastery per die and Fortune's Favour, brief values kept (no retune needed)

Measured: the M4 content as merged (`docs/balance-report.md` of humainasger/nice-dice#5, the entry below), active bot, seeds 1 / 2 / 3: every luck upgrade maxed by about the sixth reset (185 luck), lifetime luck 3887 / 3708 / 3939 at 8 h with nothing left to buy from about the first hour on (open point 2 of the M4 entry), lifetime points 3.96e37 / 1.41e37 / 2.10e37 at 8 h and 2.67e41 at 24 h (seed 1). Then the M5 sinks from `docs/plans/active/m5-theme.md` sections 1 to 3 at the brief's values, same bot and seeds, horizons 15 min, 1 h, 2 h, 8 h and 24 h on every seed: mastery per die, unbounded, `ceil(2 x 1.35 ^ level)` luck for x(1 + 0.1 x level) on that die's output, and Fortune's Favour, global, unbounded, `ceil(1.5 ^ level)` luck for x(1 + 0.05 x level) on every roll; both survive a luck reset; the bot spends on them right after each reset once every luck upgrade sits at its cap, by income lift per luck measured on the run it just finished (so a die it has not rebought yet is still judged). Results, seeds 1 / 2 / 3: lifetime points at 8 h 1.51e41 / 2.95e41 / 2.90e40 (target 1e25 to 1e45, pass, about four orders above the M4 figure and 3.5 to 4.5 orders below the ceiling), at 24 h 5.94e45 / 4.01e45 / 4.29e45 (target below 1e80, pass, 34 orders of headroom); the first hour is untouched (the sinks open only after the upgrades max out), so die_2, all five dice, the first and second luck and the purchase gap read exactly as in the M4 entry; mastery 18 / 17 / 14 / 13 / 13 (seed 1, content order) and favour 15 at 8 h, mastery 21 to 22 per die and favour 18 at 24 h; lifetime luck 4317 / 4110 / 4346 at 8 h and 20098 / 19818 / 20150 at 24 h; 22 prestiges at 8 h and 70 at 24 h as before. The compounding is mild and logarithmic: a sink level lifts income, a richer run pays a little more luck per reset (ten per decade), and the next level costs 1.35 or 1.5 times more, so by 24 h one mastery level costs about 1100 luck and one favour level about 1500 against 300 to 400 luck per reset, which leaves 187 / 716 / 239 luck unspent at 24 h waiting for the next level (and 30 / 26 / 59 at 8 h).

Changed: nothing retuned. New fields with the brief's values: `src/content/rules.ts` `mastery.baseCost` 2, `mastery.costGrowth` 1.35, `mastery.step` 0.1, `favour.costGrowth` 1.5, `favour.step` 0.05 (GDD section 7.1, which still needs the two rows added by the owner or the naming agent; this entry is the source). Untouched: every M4 number. `src/content/content.test.ts` and `src/core/defs.test.ts` pin the new fields. Formula changes in `src/core` that moved the numbers: `effectiveDieMultiplier` now carries x(1 + step x mastery level) per die (`masteryMultiplier`), `luckAndUpgradesMultiplier` carries x(1 + step x favour) (`favourMultiplier`), so `multiplierBreakdown.dice` includes mastery and `multiplierBreakdown.luck` includes favour and the chips still multiply to the total; commands `masterDie { id }` (any content die, owned or not) and `buyFavour`; `SAVE_VERSION` 4 with the v3 migration (`mastery: {}`, `favour: 0`) and `tests/fixtures/saves/v4.json`.
Why: m5-theme.md section 3, the balance check for the sinks: the 24 h active run below 1e80 and the 8 h run inside 1e25 to 1e45 on seeds 1 to 3, with the sink costs as the lever if either failed. Both pass at the brief's values on every seed, so the costs stay as written. Not measured, listed for the owner should the 8 h total feel high at 1.5e41 to 3e41: `mastery.costGrowth` 1.35 to 1.45 or `mastery.step` 0.1 to 0.08 would be the first levers (mastery is four fifths of the sink spend), `favour.costGrowth` the second; raising either also lengthens the stretch where a reset buys nothing, which at 24 h is already two to three resets per level.
Sim table (active bot; "Before" is the M4 entry's "After", `pnpm sim --strategy active,idle --seeds 1,2,3 --hours 0.25,1,8` plus the 24 h run on seed 1; "After" is `pnpm sim --strategy active --seeds 1,2,3 --hours 0.25,1,2,8,24` on this content, and the committed `docs/balance-report.md` regenerated with the default arguments; 100 ms ticks, bot acts once per simulated second):

| Metric | Before (seed 1 / 2 / 3) | After (seed 1 / 2 / 3) | Target |
|---|---|---|---|
| die_2 affordable | 0:01:04 / 0:01:22 / 0:01:08 | 0:01:04 / 0:01:22 / 0:01:08 | P1: 0:01:00 to 0:03:00, pass |
| die_5 bought (all five owned) | 0:08:59 / 0:08:02 / 0:09:48 | 0:08:59 / 0:08:02 / 0:09:48 | by 0:45:00, pass |
| First ascension and first charm | 0:14:39 / 0:13:07 / 0:14:58 | 0:14:39 / 0:13:07 / 0:14:58 | GDD section 8 first draft 0:10 to 0:20 (proposal), pass |
| First luck | 0:34:41 / 0:34:12 / 0:41:43 | 0:34:41 / 0:34:12 / 0:41:43 | 0:30:00 to 1:00:00, pass |
| Second luck, after the first | 0:25:45 / 0:33:30 / 0:31:50 | 0:25:45 / 0:33:30 / 0:31:50 | within 1:00:00, pass |
| Longest purchase gap in 8 h | 0:10:48 / 0:10:35 / 0:08:35 | 0:10:48 / 0:10:35 / 0:08:35 | at most 0:20:00, pass |
| Total earned at 1 h | 23.2B / 12.8B / 12.7B | 23.2B / 12.8B / 12.7B | none |
| Total earned at 2 h | not reported | 75.2B / 63.1B / 68.7B | none |
| Total earned at 8 h | 3.96e37 / 1.41e37 / 2.10e37 | 1.51e41 / 2.95e41 / 2.90e40 | 1e25 to 1e45, pass |
| Total earned at 24 h | 2.67e41 / not run / not run | 5.94e45 / 4.01e45 / 4.29e45 | below 1e80, pass |
| Income at 8 h (points/s) | 1.65e34 / 9.41e33 / 4.65e31 | 1.41e38 / 1.48e37 / 3.09e36 | none |
| Income at 24 h (points/s) | not reported | 6.22e41 / 1.93e41 / 9.30e39 | none |
| Ascensions per die at 8 h (seed 1) | 12 / 12 / 11 / 11 / 11 | 14 / 13 / 13 / 12 / 12 | none |
| Ascensions per die at 24 h (seed 1) | 13 / 13 / 13 / 12 / 12 | 15 / 15 / 14 / 14 / 14 | none |
| Hand upgrade level at 8 h (highest hand) | 88 / 88 / 79 | 99 / 97 / 93 | none |
| Charms held at 8 h | 13 / 13 / 13 | 14 / 14 / 13 | none |
| Lifetime luck at 8 h | 3887 / 3708 / 3939 | 4317 / 4110 / 4346 | none |
| Lifetime luck at 24 h | 17625 / not run / not run | 20098 / 19818 / 20150 | none |
| Prestiges at 8 h and 24 h | 22 and 70 (seed 1) | 22 and 70 on every seed | none |
| Luck upgrade levels at 8 h (content order) | 5 / 8 / 10 / 5 / 2 / 3 / 1 (all maxed) | 5 / 8 / 10 / 5 / 2 / 3 / 1 (all maxed) | none |
| Mastery levels at 8 h (content order) | no such sink | 18 / 17 / 14 / 13 / 13; 18 / 17 / 14 / 11 / 12; 17 / 18 / 14 / 13 / 13 | none |
| Mastery levels at 24 h (content order) | no such sink | 21 / 22 / 21 / 21 / 21; 21 / 22 / 21 / 20 / 21; 22 / 21 / 21 / 21 / 21 | none |
| Favour level at 8 h and 24 h | no such sink | 15 and 18 on every seed | none |
| Luck unspent at 8 h and 24 h | 0 / 0 / 0 (nothing to buy) | 30 / 26 / 59 and 187 / 716 / 239 (saving for the next level) | none |
| Idle bot (never clicks) | earns nothing | earns nothing | unchanged, see the die_5 entry |

Bot and sim changes in the same slice (`tools/sim`, not content): `rankLuckSinks` ranks the next mastery level of every content die and the next favour level by income lift per luck, the lift measured on a reference state (the pre-reset state in `manage`) carrying the post-reset mastery and favour levels, a candidate with no lift on the reference left out; `buyLuckSinks` buys the best affordable sink while any is, only once `luckUpgradesMaxed` (every upgrade at its cap, the brief's rule); `spendLuck` runs the upgrades then the sinks right after each prestige; `purchased` counts a mastery or favour buy; the report carries mastery levels and the favour level per horizon, the sink rules in its content line, and both in its diff. `tools/sim/balance.test.ts` keeps every M4 target (all pass on this content, seed 1 to 24 h) and adds the bot's sink spending (measured lifts, the upgrades-first rule, the reference-run judgement, luck in the sinks by 8 h).

Open for the owner, not changed here: (1) GDD section 7.1 needs the two sink rows and section 7 the "stays" list extended with mastery and favour; `docs/plans/active/m5-theme.md` section 3 delegates it, this entry is the record. (2) By 24 h a sink level costs two to three resets of luck, so the Luck tab will show luck piling up between buys; a cheaper third sink or a flatter growth is the lever if that reads as "nothing to buy" again. (3) Mastery can be bought on an unowned die (the level waits for the die to be rebought); the UI may want to show the row greyed rather than hidden.

Approved by: owner, pending (delegated M5 balance check per `docs/plans/active/m5-theme.md` section 3; this entry is the review record).

## 2026-10-26 M4 luck: log luck formula, luck upgrades, draft growth 1.15 to 1.3, die cups x3/x6 to x2/x4, ascension cost multiplier 300 to 400

Measured: two states. (a) The M3 content as merged (`luck = floor(sqrt(run / 1e10))`, luck as the multiplier directly, no luck shop), active bot, seeds 1 / 2 / 3, 8 h: lifetime points 3.85e124 / 1.15e122 / 1.11e134, luck summed near 1e17, 44 to 48 ascensions per die, first luck 0:34:42 / 0:43:02 / 0:36:45 (the "runaway" noted open in the M3 entry). (b) The M4 mechanics from `docs/plans/active/m4-luck.md` sections 1, 2 and 4 on the M3 numbers: luck on reset `floor(10 x log10(run / 1e10)) + 1`, the multiplier on lifetime luck, the seven luck upgrades bought greedily by the bot after each reset, M3 draft growth 1.15, cups x3 / x6 and cost multiplier 300. Same bot, same seeds, 8 h: first luck 0:28:44 (FAIL, before 0:30:00) / 0:36:51 / 0:30:58, second luck 0:23:50 / 0:33:30 / 0:22:35 after the first (pass), longest purchase gap 0:09:37 / 0:09:40 / 0:10:25 (pass), lifetime points 1.17e64 / 1.80e62 / 6.31e64 (FAIL against 1e25 to 1e45), lifetime luck 8514 / 7845 / 8657 (x851 to x866), 20 / 20 / 19 charms, hand upgrades at level 140 / 140 / 120, 21 / 21 / 18 ascensions on die_1. So the log formula alone took sixty orders of magnitude off the 8 h total and still left the ascension chain running away: with a cycle costing 300 times the last while paying 100 times more, each ascension only triples the wait, and a x1e9 "everything else" multiplier (luck x850, Deep Pockets x6, hand upgrades x15, charms about x5e3) lets a 20-minute run reach 15 to 21 ascensions per die before the wait catches up.

Sweep over the brief's levers in its order of preference (draft growth, charm values, ascension multiplier and cost multiplier, then luck threshold and perDecade), active bot, seeds 1 / 2 / 3, 8 h, first luck / second luck after the first / lifetime at 8 h; every row keeps die_2 at 0:01:04 to 0:01:22, all five dice by 0:09:48 and the purchase gap under 0:11:

| Config | draft growth | cups common / rare | points charms | ascension x / cost x | First luck | Second luck | Lifetime at 8 h |
|---|---|---|---|---|---|---|---|
| A, M4 mechanics on M3 numbers | 1.15 | 3 / 6 | 1.25 / 1.5 / 2 | 100 / 300 | 0:28:44 FAIL / 0:36:51 / 0:30:58 | +0:23:50 / +0:33:30 / +0:22:35 | 1.17e64 / 1.80e62 / 6.31e64 FAIL |
| B | 1.3 | 3 / 6 | same | 100 / 300 | same as A | same as A | 8.67e49 / 1.37e49 / 5.26e50 FAIL |
| C | 1.3 | 2 / 4 | same | 100 / 300 | 0:30:42 / 0:36:51 / 0:35:28 | +0:27:15 / +0:33:40 / +0:27:40 | 2.49e45 FAIL / 1.53e45 FAIL / 2.46e44 |
| H | 1.3 | 2 / 4 | 1.2 / 1.4 / 1.75 | 100 / 300 | 0:30:53 / 0:35:55 / 0:32:53 | +0:29:55 / +0:33:40 / +0:31:35 | 2.84e43 / 2.08e43 / 2.48e43 (runner-up) |
| I, shipped | 1.3 | 2 / 4 | same | 100 / 400 | 0:34:41 / 0:34:12 / 0:41:43 | +0:25:45 / +0:33:30 / +0:31:50 | 3.96e37 / 1.41e37 / 2.10e37 |
| J | 1.3 | 2 / 4 | same | 100 / 500 | 0:45:54 / 0:37:47 / 0:44:53 | +0:32:25 / +0:34:43 / +0:33:50 | 3.46e32 / 1.66e33 / 2.16e33 |
| K | 1.3 | 2 / 4 | 1.2 / 1.4 / 1.75 | 100 / 400 | 0:34:54 / 0:34:17 / 0:41:13 | +0:30:09 / +0:26:35 / +0:28:36 | 7.63e35 / 3.46e36 / 2.56e35 |
| L | 1.3 | 2 / 4 | same | 75 / 300 | 0:37:54 / 0:37:02 / 0:51:23 | +0:39:20 / +0:32:35 / +0:41:20 | 1.90e35 / 9.60e33 / 6.96e34 |
| M | 1.3 | 2 / 4 | same | 75 / 400 | 0:53:44 / 0:50:07 / 1:01:58 FAIL | +0:51:40 / +0:40:50 / +0:38:15 | 3.02e30 / 5.20e29 / 1.28e30 |
| D | 1.3 | 3 / 6 | same | 50 / 300 | 1:12:07 / 1:15:32 / 1:06:58 FAIL | +0:39:25 / +1:05:45 FAIL / +0:37:45 | 5.92e27 / 2.28e27 / 5.62e27 |
| E | 1.3 | 3 / 6 | same | 25 / 300 | 5:02:39 / 4:04:12 / 2:36:23 FAIL | hours | 2.5e10 / 2.8e10 / 2.6e10 FAIL |
| F, G | 1.3 | 3 / 6 | same | 25 / 500, 50 / 500 | 1:40 to 6:28 FAIL | | 1e10 to 1e11 FAIL |

Changed, in `src/content`: `rules.ts` `draft.growth` 1.15 to 1.3 (GDD section 5, Charms row; the top of the brief's range), `charms.ts` `oak_cup`, `tin_cup`, `clay_cup` `effect.value` 3 to 2 and `copper_cup`, `ivory_cup` 6 to 4 (GDD section 5, charms table), `rules.ts` `ascension.costMultiplier` 300 to 400 (GDD section 4, level cost rule). New fields with the brief's values, not retuned: `rules.luck.perDecade` 10 and `rules.luck.autoLevelEveryMs` 1000 (GDD section 7 and 7.1) and the `luckUpgrades.ts` table (GDD section 7.1). Untouched: `luck.threshold` 1e10, `luck.perPoint` 0.1, `ascension.multiplier` 100, the points, hand and auto-roll charms, every die, hand and face number. `src/content/content.test.ts` and `src/core/defs.test.ts` pin the new values. Formula changes in `src/core` that moved the numbers: `luckOnReset` (log curve), `luckMultiplier` on `luckTotal`, `comboMultiplier` with Keen Eye, `autoRollInterval` with Quick Hands, `globalMultiplier` with Deep Pockets, `draftOfferSize` with Lucky Draw, `prestige` with Memory and Head Start.
Why: the m4-luck.md section 3 targets, active bot, seeds 1 to 3: first luck between 30 and 60 min, second within 60 min of the first, lifetime at 8 h between 1e25 and 1e45 and at 24 h below 1e80, no purchase drought over 20 min in the first 8 h. The levers were pulled in the brief's order. Draft growth at its maximum (B) and the cup values (C) together land on the window's upper edge with seed 1's first luck 42 seconds inside its window; the points charms (H) stay inside but within two orders of the edge with a 0:30:53 first luck, so the third lever was taken as well, on the cost multiplier only (I): x100 per ascension stays, since the first ascension at about 14 minutes and its x100 are the mid game's reward, and a cycle that costs four times what it pays caps a 20-minute run at about 12 ascensions per die. 500 (J) overshoots towards the lower half of the window and delays the first luck to 0:45 on two seeds; any cut to the ascension multiplier (L, M, D) pushes the first luck towards or past an hour because the first ascension carries the run to the threshold. The fourth lever (threshold, perDecade) was not needed.
Sim table (active bot; "Before" is state (b) above, the M4 mechanics on the M3 numbers, `pnpm sim --strategy active --seeds 1,2,3 --hours 0.25,1,2,8` with the sweep harness; "After" is the committed `docs/balance-report.md`, `pnpm sim --strategy active,idle --seeds 1,2,3 --hours 0.25,1,8`, plus a 24 h run on seed 1; 100 ms ticks, bot acts once per simulated second):

| Metric | Before (seed 1 / 2 / 3) | After (seed 1 / 2 / 3) | Target |
|---|---|---|---|
| die_2 affordable | 0:01:04 / 0:01:22 / 0:01:08 | 0:01:04 / 0:01:22 / 0:01:08 | P1: 0:01:00 to 0:03:00, pass |
| die_5 bought (all five owned) | 0:08:59 / 0:08:22 / 0:09:23 | 0:08:59 / 0:08:02 / 0:09:48 | by 0:45:00, pass |
| First ascension and first charm | 0:14:29 / 0:13:52 / 0:14:03 | 0:14:39 / 0:13:07 / 0:14:58 | GDD section 8 first draft 0:10 to 0:20 (proposal), pass |
| First luck | 0:28:44 FAIL / 0:36:51 / 0:30:58 | 0:34:41 / 0:34:12 / 0:41:43 | 0:30:00 to 1:00:00, pass |
| Second luck, after the first | 0:23:50 / 0:33:30 / 0:22:35 | 0:25:45 / 0:33:30 / 0:31:50 | within 1:00:00, pass |
| Longest purchase gap in 8 h | 0:09:37 / 0:09:40 / 0:10:25 | 0:10:48 / 0:10:35 / 0:08:35 | at most 0:20:00, pass |
| Total earned 1.00B | 0:23:54 / 0:31:33 / 0:26:36 | 0:28:19 / 0:28:12 / 0:35:28 | none |
| Total earned at 1 h | 26.3B / 13.0B / 26.0B | 23.2B / 12.8B / 12.7B | none |
| Total earned at 8 h | 1.17e64 FAIL / 1.80e62 FAIL / 6.31e64 FAIL | 3.96e37 / 1.41e37 / 2.10e37 | 1e25 to 1e45, pass |
| Total earned at 24 h (seed 1) | not run | 2.67e41 | below 1e80, pass |
| Income at 8 h (points/s) | 1.32e55 / 1.07e55 / 1.46e48 | 1.65e34 / 9.41e33 / 4.65e31 | none |
| Ascensions per die at 8 h | 21 / 18 / 16 / 13 / 12 (seed 1) | 12 / 12 / 11 / 11 / 11 (seed 1) | none |
| Hand upgrade levels at 8 h | 140 / 140 / 120 | 88 / 88 / 79 | none |
| Charms held at 8 h | 20 / 20 / 19 | 13 / 13 / 13 | none |
| Lifetime luck at 8 h | 8514 / 7845 / 8657 | 3887 / 3708 / 3939 | none |
| Prestiges at 8 h | 23 / 22 / 23 | 22 / 22 / 22 | none |
| Luck upgrade levels at 8 h (content order) | 5 / 8 / 10 / 5 / 2 / 3 / 1 (all maxed) | 5 / 8 / 10 / 5 / 2 / 3 / 1 (all maxed) | none |
| 24 h, seed 1 | not run | lifetime luck 17625, 70 prestiges, ascensions 13 / 13 / 13 / 12 / 12 | none |
| Idle bot (never clicks) | earns nothing | earns nothing | unchanged, see the die_5 entry |

Bot and sim changes in the same slice (`tools/sim`, not content): after each luck reset the bot buys luck upgrades greedily by income lift per luck (Deep Pockets, Quick Hands and Keen Eye measured on a trial state; Head Start, Lucky Draw, Memory and Steady Hands at assumed lifts of 0.5, 0.15, 0.4 and 0.05 per level since the income figure cannot see them right after a reset), the prestige rule is unchanged (luck on reset at least 2, 20 minutes since the last), the sim records the second luck and the longest stretch without a purchase (a die, level, face, hand upgrade, charm pick, luck upgrade, ascension or reset), and the report carries the new windows, the luck upgrades table and the charms in its content snapshot. `tools/sim/balance.test.ts` asserts the new targets; seed 1 runs to 24 h and seeds 2 and 3 to 8 h, about 2.5 minutes in all.

GDD edits (delegated by the owner in m4-luck.md section 3): section 4 (level cost rule with the cost multiplier, ascension, die multiplier, head start), section 5 (shipped formula, every source with its content field, the stacking rule, the charms table), section 7 (trigger, log formula, two luck counters, resets and stays, cycle length) with the new section 7.1 (luck upgrades table), section 10 (trophies table). The M3 entry's "GDD is owner-edited and still carries the brief's 1e6" is resolved by these edits.

Open for the owner, not changed here: (1) the second luck lands 26 to 34 minutes after the first because the bot waits 20 minutes between resets; a player who resets the moment the preview reads 2 or more would reset sooner and earn slightly less per reset, so the window holds either way. (2) Lifetime luck reaches about 3900 at 8 h and 17600 at 24 h (x390 and x1760 on every roll); with every upgrade maxed by the sixth reset, luck has nothing to buy after about an hour of play; a second shop tier or a luck sink is the natural M5 question. (3) Config H (points charms 1.25 / 1.5 / 2 to 1.2 / 1.4 / 1.75, cost multiplier 300) is the alternative that keeps the M3 cost curve; it ships the same windows two orders below the 1e45 edge, with the first luck 53 seconds inside its window on seed 1. (4) The idle bot still earns nothing (auto-roll unlock needs die_1 level 2), unchanged from M1.

Approved by: owner, pending (delegated M4 tuning per `docs/plans/active/m4-luck.md` section 3; this entry is the review record).

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
